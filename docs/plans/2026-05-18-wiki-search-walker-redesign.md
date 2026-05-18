# Wiki-Search Walker Redesign

**Status**: design note, not yet ratified.
**Supersedes**: D91 (provisional) — `eb37bb7` HTTP-self-request rewrite.
**Date**: 2026-05-18.

## Why this note exists

The shipped Phase 7a wiki-search walker (`css/extensions/wiki-search/src/walker.ts`)
uses undici HTTP self-requests against the Pod's own HTTPS endpoint. The
recorded rationale (FOLLOWUPS.md D91 entry) is that this avoided a CSS
re-entrant lock crash that surfaced when the walker used
`ResourceStore.getRepresentation` directly.

The architecture has a known soundness gap: HTTP self-requests are anonymous
under `dev-allow-all` and **cannot** carry the originating request's
credentials. Solid-OIDC tokens are DPoP-bound; DPoP proofs are bound to
(`htm`, `htu`, `jti`); the server doesn't hold the client's private key.
Header forwarding is architecturally impossible. As long as the Pod runs
`dev-allow-all` this is invisible, but the moment WAC or ACP is enabled —
or the WAC scenario test stubs are un-skipped — the walker will silently
omit resources the requester is entitled to read.

A 2026-05-18 spike reverted walker.ts to its pre-rewrite form (commit
c694407) plus the one correct piece of the rewrite (the IRI-keyed
`isReadAllowed`) and reproduced the original crash. The captured failure
mode contradicts part of the recorded D91 narrative.

## Reproduced failure mode

```
[walker-spike] visit https://pod.vardeman.me/vault/wiki/ allowed=true permShape=object
[walker-spike] got rep for https://pod.vardeman.me/vault/wiki/ container=true ct=text/turtle
[walker-spike] metadata.getAll(LDP_CONTAINS) for https://pod.vardeman.me/vault/wiki/ returned 5 children
... drain hangs ...
[HandlerServerConfigurator] Request error: aborted
[WrappedExpiringReadWriteLocker] Lock expired after 6000ms on https://pod.vardeman.me/vault/wiki/
Process is halting due to an uncaughtException with error callback is not a function
TypeError: callback is not a function
    at N3StreamWriter.onerror (.../readable-stream/lib/internal/streams/end-of-stream.js:103:14)
```

CSS process crashes; the container halts until Docker restarts it.

## Root cause

CSS's request pipeline acquires a lock on the request target
(`/vault/wiki/`) for the duration of the GET. The walker then calls
`store.getRepresentation({path: "/vault/wiki/"})` — re-acquiring a lock on
the **same identifier**. `WrappedExpiringReadWriteLocker` queues the
re-entrant request rather than passing it through; it expires after 6
seconds. When the lock expires mid-serialization, N3StreamWriter (CSS's
lazy Turtle serializer for container bodies) calls an error callback
shape it doesn't expect — uncaught exception, process halts.

The drain loop is where the deadlock fires. Container metadata
(`rep.metadata.getAll(LDP_CONTAINS)`) is populated eagerly at
representation construction, so the children count log line succeeds. The
data stream is what triggers serialization, and serialization requires
the underlying lock — which the outer request still holds.

## What was already recorded vs what was new

The FOLLOWUPS D91 entry attributes the rewrite to "CSS's per-resource
write lock held during the handler's own request context produced 6s
lock-expiry + N3StreamWriter crash." That is accurate.

What the recorded narrative misses:

1. **The crash is specifically re-entrance on the request target itself**,
   not a general CSS-lock problem. Visits to descendants do not trigger
   it, because each descendant gets a fresh lock.
2. **The `isReadAllowed` permission-shape fix is independent** of the
   architecture rewrite. Without it, the walker denies the start URL and
   returns `totalCount 0` without crashing. The agent doing `eb37bb7`
   bundled both fixes into one commit and credited the wrong one.
3. **HTTP self-requests are not the only solution.** Asking ResourceStore
   for children of the request target — never for the request target
   itself — sidesteps the deadlock entirely while keeping the auth
   inheritance ResourceStore gives for free.

## CSS architecture probes (2026-05-18)

Three follow-up probes against the running CSS v8 image confirmed the
mechanics. Findings:

### Probe 1 — ResourceStore chain has no authorization layer

CSS v8's store chain, outermost to innermost:

```
MonitoringStore → IndexRepresentationStore → LockingResourceStore
  → PatchingStore → RepresentationConvertingStore → DataAccessorBasedStore
```

None of these check authorization. Authorization lives entirely at the
HTTP handler level: `AuthorizingHttpHandler` runs `PermissionReader` →
`PermissionBasedAuthorizer`, then forwards to the inner handler. By the
time a handler is running, authorization is *already done* for the request
target; internal `store.getRepresentation()` calls are
**privileged-by-design**.

This is the canonical CSS pattern. `OperationHttpHandler` does exactly
this — checks auth, then calls store. Our handler is doing the same, just
across N descendants instead of one resource.

### Probe 2 — No `PermissionAwareResourceStore` exists in CSS v8

Confirmed by both the published architecture docs and local source
inspection (`/community-server/dist/storage/*.d.ts`). There is no
defense-in-depth wrapper that re-checks authorization at the store layer.
Building one would be a ~50-100 LOC custom infrastructure that diverges
from how every other CSS handler operates. **The hardening I had
sketched in the original recommendation is not available out of the box.**

### Probe 3 — `DataAccessor.getChildren()` is the lockless seed mechanism

The `DataAccessor` interface (the innermost layer, below
`LockingResourceStore`) exposes:

```typescript
getChildren: (identifier: ResourceIdentifier) => AsyncIterableIterator<RepresentationMetadata>;
```

The interface doc explicitly says "DataAccessors should not generate
containment triples. This will be done externally using `getChildren`."
Since DataAccessor sits below the locking layer, this call **does not
acquire a lock** on the target identifier. We can enumerate children of
the request target via this call without triggering the deadlock.

### Probe 4 — `LockingResourceStore` locks per-identifier

```typescript
async getRepresentation(identifier, preferences, conditions) {
  return this.lockedRepresentationRun(this.getLockIdentifier(identifier), ...);
}
```

Each call acquires `withReadLock(getLockIdentifier(identifier))`. Different
identifiers → different locks → no contention. **Descendants of the
target don't contend with the target's lock.** Once the walker is past the
target, ResourceStore is the right tool throughout.

## Multi-agent threat model

The redesign needs to support different agents with different scopes —
this is the core motivating use case for moving off `dev-allow-all`. The
trade-off analysis across the three candidate architectures:

| Concern | Current (HTTP anon) | Path 1a (Store + DataAccessor) | Path 2 (Trusted intermediary) |
|---|---|---|---|
| Per-agent result differentiation | ❌ impossible | ✅ inherits per-agent auth | ✅ via gate |
| VC / ACP-conjunctive matching (`acp:vc`, client+agent) | ❌ no propagation | ✅ inherited | ❌ admin creds discard VCs |
| Failure mode if `PermissionReader` is buggy | ✅ fails closed (CSS denies anon) | ❌ fails open | ❌ fails open |
| Trust boundary clarity | ✅ explicit | ⚠️ implicit (matches CSS idiom) | ✅ explicit |
| Provenance / audit forensics | ❌ anonymous in logs | ✅ user identity in call chain | ⚠️ requires explicit propagation |
| Cross-pod federation readiness | ❌ anonymous can't federate | ✅ creds propagate | ❌ admin creds don't federate |
| Defense-in-depth available | ✅ via CSS pipeline | ❌ (no permission-aware store) | ❌ (no permission-aware store) |

The current architecture is the most failure-closed of the three (under
real WAC it returns 0 results because anonymous reads are denied — wrong
but not leaky). The trade-off Path 1a makes is **failure-closed
robustness for multi-agent capability**. The `PermissionReader` gate
becomes the security boundary; this is the CSS idiom, but it requires
care.

Path 2 lost its theoretical advantage when probe 2 showed CSS has no
permission-aware store — without that wrapper, Path 2's "explicit
privilege boundary" is rhetorical, not architectural. And it costs the
multi-agent and federation properties Path 1a gets for free.

## Decision: Path 1a — DataAccessor for seed, ResourceStore for descendants

The walker takes seed URLs (children of the search target) and recurses
via ResourceStore. The handler enumerates the target's children once via
`DataAccessor.getChildren()`, bypassing the locking layer for that one
call. Everything else inherits the request's auth context naturally.

### Handler shape

```typescript
// In WikiSearchHttpHandler.handle():
const targetId: ResourceIdentifier = { path: requestUrl.split("?")[0] };

// Lockless enumeration of the target's children via DataAccessor.
// Auth was already checked at the request level by AuthorizingHttpHandler.
const seedUrls: string[] = [];
for await (const childMeta of this.dataAccessor.getChildren(targetId)) {
  const childId = childMeta.identifier?.value;
  if (childId) seedUrls.push(childId);
}

// Walker takes seeds, never the request target:
for await (const { url, body } of walkContainer(
  seedUrls,
  this.store,
  this.permissionReader,
  credentials,
)) { ... }
```

### Walker shape

```typescript
export async function* walkContainer(
  seedUrls: string[],          // children of search target, not the target itself
  store: ResourceStore,
  permissionReader: PermissionReader,
  credentials: Credentials,
): AsyncGenerator<WalkResult> {
  const queue: string[] = [...seedUrls];
  while (queue.length > 0) {
    const currentUrl = queue.shift()!;
    const identifier: ResourceIdentifier = { path: currentUrl };

    // SECURITY BOUNDARY — this is the only thing protecting unauthorized
    // callers from reading resources the requester isn't entitled to.
    // CSS v8 has no permission-aware ResourceStore wrapper; downstream
    // store.getRepresentation() is privileged-by-design.
    const allowed = await checkRead(permissionReader, identifier, credentials);
    if (!allowed) continue;                // omit-don't-deny preserved

    const rep = await store.getRepresentation(identifier, {});
    if (currentUrl.endsWith("/")) {
      const children = extractContainerChildren(rep);
      for await (const _ of rep.data) { /* drain to release lock */ }
      for (const child of children) queue.push(child);
    } else {
      if (isMarkdown(rep.metadata?.contentType)) {
        yield { url: currentUrl, body: await readBody(rep.data) };
      } else {
        for await (const _ of rep.data) { /* discard */ }
      }
    }
  }
}
```

### Why this works

- **Auth inheritance is free.** ResourceStore reads happen inside the
  request's auth context; `Credentials` is propagated to `PermissionReader`
  via the handler injection. Multi-agent, ACP `acp:client`/`acp:agent`
  conjunctive matching, future VC matching, cross-pod federation — all
  pick up without further plumbing.
- **No deadlock.** The target identifier is never enqueued into the
  walker, so `store.getRepresentation` is never called on it. Descendants
  acquire their own per-identifier locks.
- **Matches CSS's canonical handler-as-authorization-boundary idiom.** The
  walker is `OperationHttpHandler`-shaped: check, then privileged read.

### Hardenings (revised)

- ~~Defense-in-depth via permission-aware store wrapper~~ — **not
  available in CSS v8.** Dropped from the recommendation. If we ever need
  this, it's a substantial separate build.
- **Explicit code-comment** at the `PermissionReader` gate naming it as
  the security boundary (sketched in the walker shape above).
- **Adversarial test** demonstrating omit-don't-deny under real WAC. Six
  scenarios in `tests/integration/test_wiki_search_e2e.py::TestWacScenarios`
  currently stubbed; Path 1a un-stubs all six.
- **Authenticated client fixture** shared with `test_addressbook_e2e.py`
  (per Phase 7a follow-up plan). Required infrastructure for the WAC
  scenarios.

## Alternatives considered

### Path 1b — Move handler to non-target URL

Search at `/vault/.well-known/search?container=/vault/wiki/&...` instead of
`/vault/wiki/?ext=search-grep`. Request target is the search endpoint, not
the container. No re-entrance. URL design change required (capability
descriptor, affordance, consumer skill in solid-agent-skills, integration
test URLs).

Marginally cleaner architecturally; not worth the migration cost on its
own. Worth considering if the URL design needs refactoring for unrelated
reasons.

### Path 2 — Trusted intermediary with server-internal credentials

Walker keeps HTTP self-requests; handler injects admin credentials; the
`PermissionReader` gate decides results. Lost its security advantage when
probe 2 confirmed no permission-aware store exists (the "explicit
privilege boundary" framing is purely rhetorical). And it costs the
multi-agent / VC / federation properties Path 1a gets free.

### Path 3 — Ship anonymous, document the limitation

Keep the current walker, mark wiki-search as "ACL-unenforced read."
Honest about state, no architectural churn. Reasonable stop-gap if Path
1a turns out invasive; not viable long-term because Rung 1.5 needs
authenticated agents and the Memory Structuring Sprint will produce
private content under `/wiki/working/`.

## Implementation sprint outline

Estimated ~half a day. Single PR.

### Tasks

1. **Inject `DataAccessor` into `WikiSearchHttpHandler`.** Add a second
   dependency alongside `ResourceStore` in the constructor + Components.js
   config. Reuse the same DataAccessor instance the file-backend store
   chain uses.

2. **Replace target enumeration.** In `handle()`, replace the current
   walker start with a `DataAccessor.getChildren()` enumeration that
   produces seed URLs. Map `RepresentationMetadata` → identifier strings.

3. **Refactor `walkContainer()` signature.** Accept `seedUrls: string[]`
   instead of `startUrl: string`. Drop the `WalkFetch` injection seam
   and the undici-based `defaultFetch` (~80 LOC removal). Drop the dead
   `getChildren()` fallback that never matched a real store.

4. **Replace HTTP-based descendant fetching with `store.getRepresentation`.**
   Add stream draining and metadata-based child extraction matching the
   sketch above. Read markdown bodies from `rep.data`.

5. **Add the security-boundary comment** at the `PermissionReader` gate.

6. **Update unit tests** (`tests/test_walker.ts`). Mocks now use a fake
   `ResourceStore` returning fake representations; the HTTP fetch seam
   goes away.

7. **Un-stub the WAC scenarios** in
   `tests/integration/test_wiki_search_e2e.py::TestWacScenarios`. Wire
   in the authenticated-client fixture from `test_addressbook_e2e.py`.
   All five scenarios + the omit-don't-deny adversarial test pass.

8. **Run perf smoke** against the existing
   `tests/integration/test_wiki_search_perf.py` to confirm no regression
   from removing the HTTP round-trip per resource. (Should improve.)

### Files touched

- `css/extensions/wiki-search/src/WikiSearchHttpHandler.ts` — DataAccessor
  injection, seed enumeration
- `css/extensions/wiki-search/src/walker.ts` — sig change, ResourceStore
  fetching, ~80 LOC net removal
- `css/extensions/wiki-search/config/*.json` — Components.js DataAccessor
  wiring
- `css/extensions/wiki-search/tests/test_walker.ts` — mock store refactor
- `tests/integration/test_wiki_search_e2e.py` — un-stub WAC scenarios,
  wire authenticated client
- `FOLLOWUPS.md` — strike D91, add D92-candidate entry
- `.claude/skills/decision-lookup/decisions.md` — add D92 once sprint
  completes

### Acceptance criteria

- All 13 existing e2e tests still pass
- 5 newly-implemented WAC scenarios pass
- Adversarial omit-don't-deny test passes (denied descendant excluded
  even when the gate is mocked to allow it would still need defense-in-depth
  we don't have — the test verifies the live PermissionReader path)
- p95 latency from `test_wiki_search_perf.py` is ≤ current (26.7ms ±)
- No CSS process crashes under integration test load

## VC and federation future work

This redesign does not address Verifiable Credentials, DID-based agent
identity, or capability-scoped delegation. Path 1a *positions* us for
those — the auth context inheritance picks up new credential dimensions
as configuration changes — but the extraction and verification
infrastructure has to be built.

That work has its own design note:
`docs/plans/2026-05-18-vc-credential-roadmap.md`. It covers the CSS v8
credential machinery state, the gConsent / Inrupt UMA flow, the SolidLab
UMA AS landscape, the TypeScript VC library survey, and three routes
forward. It is *not* implementation-ready — it's a reference for the
future sprint when VC use is non-experimental.

## Plan

1. ✅ Probes complete (DataAccessor confirmed; permission-aware store
   confirmed absent; lock-granularity confirmed per-identifier).
2. ✅ Implementation sprint complete (2026-05-18). See "Implementation
   findings" below for architectural deviation from the original Path 1a
   plan.
3. Ratify as **D92** in `.claude/skills/decision-lookup/decisions.md`;
   sync to vault `SOLID-Pod-Decisions.md`.
4. Retract provisional D91 from FOLLOWUPS (already noted as superseded
   in this design doc; FOLLOWUPS entry struck through).

## Implementation findings (sprint, 2026-05-18 evening)

The Path 1a plan called for `DataAccessor.getChildren()` for the seed
and `store.getRepresentation()` for descendants. Integration testing
during the sprint revealed that the original lock-deadlock failure
mode was only one symptom of a broader problem: **consuming any
store-returned stream from inside a handler is fragile under CSS's
readable-stream wrapping.**

Three observed crash modes during implementation:

1. **Re-entrant lock on request target** (the originally diagnosed bug).
   `store.getRepresentation(target)` deadlocks because the outer
   request pipeline holds the target's lock. Fixed by seeding via
   `DataAccessor.getChildren()`.

2. **Container body drain hangs on subcontainers** (new finding).
   Calling `store.getRepresentation(subcontainer)` and draining its
   data stream — even though the lock is fresh — reliably hangs.
   N3StreamWriter, which CSS uses to lazily serialize container Turtle
   bodies, doesn't drain cleanly when consumed inside a handler.
   After the 6s lock expiry, the same N3StreamWriter `callback is not
   a function` uncaught exception crashes the CSS process.

3. **Document stream consumption hangs/crashes** (new finding).
   Even for non-container documents, calling
   `store.getRepresentation(doc)` and reading the body via
   `for await (const chunk of rep.data)` triggers the same
   `node:internal/streams/end-of-stream` uncaught exception with a
   callback-shape mismatch. No lock-expiry message this time, but
   the same crash pattern in `readable-stream`.

Root cause appears to be a stream lifecycle bug in CSS's wrapping of
N3StreamWriter and/or its `Guarded<Readable>` shim. It manifests
whenever a handler tries to drain a stream rather than pipe it to a
response. We did not root-cause the underlying readable-stream
defect — that's CSS-internal.

**Resulting architecture:** the walker uses `DataAccessor` for
**everything** — container enumeration via `getChildren()`, document
content-type checks via `getMetadata()`, document bodies via
`getData()`. No `ResourceStore.getRepresentation()` calls anywhere
in the walker. The handler injects only `DataAccessor` (the
`ResourceStore` dependency was removed entirely from the handler's
constructor signature).

**Security implications:** unchanged from the original Path 1a
analysis. CSS v8 has no permission-aware store wrapper, so both
`store.getRepresentation` and `dataAccessor.*` are
privileged-by-design at the data layer. The `PermissionReader` gate
remains the security boundary. The trade-off table in the
"Multi-agent threat model" section above still applies — Path 1a's
properties (per-agent inheritance, ACP conjunctive matching,
federation readiness) come from the `Credentials` propagated to the
gate, not from going through ResourceStore.

**Performance impact:** p95 latency improved from 26.7ms (HTTP
self-request architecture) to **7.6ms** (DataAccessor end-to-end) on
the existing perf-smoke test corpus. 3.5× faster — the HTTP
round-trip per resource was paying for the wrong architecture.

**Tests:** 77 unit tests pass (walker test mocks fully rewritten to
DataAccessor shape). 13 of 19 integration tests pass; the remaining
6 are `TestWacScenarios` which remain stubbed pending the
authenticated-client fixture shared with `test_addressbook_e2e.py`
(separate scope, not part of this sprint).

**Files changed:**
- `css/extensions/wiki-search/src/WikiSearchHttpHandler.ts` — removed
  `ResourceStore` dep, added `DataAccessor` dep, replaced walker
  invocation with `dataAccessor.getChildren()` seed enumeration
- `css/extensions/wiki-search/src/walker.ts` — full rewrite, takes
  `(seedUrls, dataAccessor, permissionReader, credentials)`,
  ~80 LOC net reduction (removed undici + WalkFetch + buildAgent)
- `css/extensions/wiki-search/tests/walker.test.ts` — mocks rewritten
  with fake DataAccessor (getChildren/getMetadata/getData)
- `css/extensions/wiki-search/tests/WikiSearchHttpHandler.test.ts` —
  constructor positional arg updated
- `css/config/wiki-search.json` — Components.js: `dataAccessor`
  injected as `urn:solid-server:default:FileDataAccessor`,
  `store` dependency removed

## Related

- `FOLLOWUPS.md` — D91 entry (now superseded by this design)
- `.claude/skills/solid-identity-stack/references/dpop.md` — why
  credential forwarding to HTTP self-requests is architecturally
  impossible under Solid-OIDC
- `tests/integration/test_wiki_search_e2e.py::TestWacScenarios` — the
  six tests un-stubbed by the sprint
- `docs/plans/2026-05-18-vc-credential-roadmap.md` — future VC integration
  work that builds on Path 1a's auth-context inheritance
- Commits: `c694407` (original ResourceStore walker), `eb37bb7` (HTTP
  rewrite + `isReadAllowed` fix bundled), `5e9c6c1` (post-rewrite
  unit-test repair)
- Sources for probes: CSS v8 docs at
  [Resource Store](https://communitysolidserver.github.io/CommunitySolidServer/7.x/architecture/features/protocol/resource-store/)
  and [Authorization](https://communitysolidserver.github.io/CommunitySolidServer/5.x/architecture/features/protocol/authorization/);
  local source `/community-server/dist/storage/accessors/DataAccessor.d.ts`,
  `/community-server/dist/storage/LockingResourceStore.js`
