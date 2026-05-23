# Follow-ups

Things to come back to. Open items only; closed items move to commit history and decisions-index.

## Shape-validator TBox bundle sync pattern (added 2026-05-23)

`css/extensions/shape-validator/data/{mem,as-subclass-axioms}.ttl` are bundled copies
of the canonical files at `overlays/wiki-memory/ontology/`. Bundling is structurally
required: the Dockerfile COPYs only `extensions/shape-validator` into the image;
`overlays/` is applied at runtime over HTTP and is never present inside the container.

- **Sync**: `make sync-validator-tbox` copies canonical → bundle.
- **Guard**: `make check-validator-tbox` fails if bundle has drifted. Wired as a
  prerequisite of `make test` so drift is caught in every local test run. Run `make
  sync-validator-tbox` before committing any change to the canonical ontology files.

### getClosure() TOCTOU note

`ShapeValidationStore.getClosure()` uses a lazy-init pattern (`if (!this.subClassClosure)`).
Under concurrent first-writes — two requests hitting the store before the cache is warm —
both will build an identical Map in parallel and the second assignment will overwrite the
first with an equivalent value. This is benign under CSS's default single-threaded async
model: Node.js event-loop interleaving cannot split between the `if (!this.subClassClosure)`
check and the `this.subClassClosure = ...` assignment (no `await` in between). It would
become a real TOCTOU only if CSS ever moves to Worker threads with shared state. If that
ever applies, fix by caching a `Promise<Map<string, string[]>>` instead of the Map itself
so concurrent callers await the same in-flight build.

---

## Substrate audit + curator — option-B unified build (next session after 2026-05-23)

**Status**: deferred to next session. Decision ratified as **D104 / vault-D99**. Phase A pilot report at `docs/plans/2026-05-23-phase-a-pilot-report.md` §5 has the full task breakdown.

**Architecture** (per D104): the Pod's self-description IS wiki-memory L3 content. SHACL shapes provide guardrails; an agentic curator provides construction. They feed each other through a violation-report → reasoning → patched-substrate loop. **One unified toolkit** (audit + curator + review) works on both content-side (vault pages) and substrate-side (descriptors). The Phase B2 lint skill collapses into the substrate-curator; build once.

**Estimated**: ~3-4 hours focused next-session work.

### Component 1 — Substrate-resource SHACL shapes

Start with two exemplars:

**`shapes/substrate/storage-description.shacl.ttl`** (StorageDescriptionShape):

- Targets: `wiki:L3StorageDescription` (mint this class if not present) or `pim:Storage` via filter
- Required predicates: `wiki:affordanceCatalog`, `wiki:typeIndex`, `wiki:contextDocument`, `wiki:shapeCatalog`, `wiki:profileDocument` (cardinality 1 each); `dct:conformsTo` (≥1)
- `rdfs:seeAlso` constraint: targets must resolve. Either custom pyshacl extension (HTTP HEAD per target) OR post-validation cross-check in the walker
- `sh:agentInstruction` required (cardinality 1, non-empty, ≥100 chars)
- All `void:vocabulary` IRIs must be dereferenceable (cross-check)

**`shapes/substrate/affordance-descriptor.shacl.ttl`** (AffordanceDescriptorShape):

- Targets: `wiki:SearchAffordance`, `wiki:DerivedClassAffordance`, etc., via `sh:targetClass`. Or use `prof:ResourceDescriptor` as a parent and rely on `rdfs:subClassOf` inference
- Required predicates: `rdfs:label` (xsd:string, cardinality 1, min length 3); `rdfs:comment` (cardinality 1, min length 20); `sh:agentInstruction` (cardinality 1, min length 100); `prof:hasRole` (cardinality 1, must be in wikirole concept scheme); `wiki:dispatchPattern` (cardinality 1, regex `^\?ext=[a-z-]+$`); `wiki:targetContainer` (IRI); `dct:conformsTo` (≥1)
- `prof:hasRole` membership: cross-check against `/vault/ontology/wikirole`

Defer (write when Phase B+ surfaces need):

- `CapabilityDescriptorShape` (similar structure; targets `cap:Capability` subclasses)
- `AffordanceCatalogEntryShape` (per-LDP-entry label/comment requirements)
- `VocabularyDeclarationShape` (per `void:vocabulary` IRI)
- `JSONLDContextShape` (the `/meta/context.jsonld`)
- `TypeIndexShape` (the `/settings/publicTypeIndex`)

### Component 2 — `pod-audit` walker

`scripts/pod_audit.py`. Python + pyshacl + httpx. CLI usage:

```bash
~/uvws/.venv/bin/python scripts/pod_audit.py [POD_URL] [--shapes-dir shapes/substrate/] [--out-format json|markdown]
```

Behavior:

1. GET `<POD>/vault/.well-known/solid` (Accept: text/turtle)
2. Parse as RDF graph; locate the `pim:Storage` subject
3. Validate against `StorageDescriptionShape` via pyshacl
4. Cross-check: HEAD each declared catalog IRI (affordance/capability/context/type-index/shape); report 4xx/5xx
5. HEAD each `rdfs:seeAlso` target; report 404s as ERROR
6. GET affordance catalog; for each `ldp:contains` entry:
   - GET the entry
   - Validate against `AffordanceDescriptorShape`
   - Cross-check: dispatch pattern matches a CSS extension handler (parse `css/config/*.json` to confirm)
7. Emit structured findings (severity: ERROR / WARN / INFO; location: IRI; constraint: shape predicate or cross-check name; remediation: short hint)

Output: JSON (machine-consumable, for the curator agent) + Markdown (human-readable). Non-zero exit on any ERROR.

Hooks:

- `Makefile`: `make audit` target invokes pod_audit.py against the running Pod
- `make reset` chains `make audit` after `pod-setup`; ERROR findings fail the reset
- CI (GitHub Actions or equivalent) runs `make reset` + `make audit` on every PR

### Component 3 — `pod-curator` skill (proof-of-concept)

Location: `solid-agent-skills/skills/pod-curator/SKILL.md`. Bootstrapper-form per D103 (~25-40 lines):

- **When to use**: after `pod-audit` produces ≥1 ERROR or WARN; or in response to a `mem:*` substrate event
- **Tool**: `solid-pod` CLI for substrate edits via N3 Patch; `pod-audit` for re-validation
- **Pointer**: the substrate's SHACL shapes at `<pod>/meta/shapes/substrate/` are the canonical contract; the audit report (JSON) is the work queue
- **Two-stage commit (D73)**: all curator proposals go to `/vault/working/curator-proposals/<timestamp>/`, NOT directly to the affected resource. Crystallize step requires human or higher-trust agent review
- **Per-violation playbook**: 
  - "Missing required predicate" + reconstructible from context → auto-propose
  - "Stale reference (rdfs:seeAlso 404)" → propose update (read overlay manifests for new path) or removal
  - "Missing intent-bearing prose" → compose by reading descriptor purpose + sibling examples
  - Anything else → flag for review with diagnostic context

Skill body refers to a long-form playbook at `solid-agent-skills/skills/pod-curator/playbook.md` (similar to how vault skills have references/ subdirs).

### Component 4 — Immediate sweep (post-audit)

After Components 1-3 land, run `pod-audit` against the live Pod and fix the highest-priority findings:

- **Fix stale `rdfs:seeAlso`**: storage description currently lists `<../wiki/pages/>, <../wiki/sources/>, <../wiki/people/>, <../wiki/procedures/>, <../wiki/working/>`. After D98 8-shape, only `people/`, `procedures/`, `working/` exist; `pages/` → `concepts/`; `sources/` merged into `concepts/`. **Fix path**: either remove `rdfs:seeAlso` entirely (Type Index already lists containers — preferred), or update to the 8-shape list (`concepts/, people/, places/, organizations/, events/, procedures/, working/`).
- **Add labels + comments to affordance catalog entries**: each `.ttl` file in `/vault/meta/affordances/` needs `.meta` predicates `rdfs:label` + `rdfs:comment`. Patch via N3 Patch to each entry's `.meta`. Curator agent can generate from descriptor content; first pass can be hand-curated.
- **Add entry-point `sh:agentInstruction` to storage description**: compose prose. Suggested seed: *"Agents arriving at this Pod should first dereference `wiki:affordanceCatalog` to enumerate capabilities. Each capability lives at the named affordance descriptor; the descriptor's `sh:agentInstruction` is the canonical wire form. For taxonomic navigation (class → container routing), see `wiki:typeIndex`. For prefix → IRI resolution, see `wiki:contextDocument`. For SHACL shapes governing content, see `wiki:shapeCatalog`. The wiki-memory L3 profile this Pod conforms to is at `wiki:profileDocument`."*
- **Document OSLC parameter compliance map**: for each affordance accepting OSLC parameters (currently just `wiki-search-grep.ttl`), declare `wiki:supportedParameters` (or similar predicate; design during this build) listing supported + 501-returning parameters. Generate from CSS handler code introspection.

### Component 5 — Re-run Phase A pilot iter-3

After Components 1-4 land, run iter-3 with **per-condition assertions**:

- **With-skill** assertions: tests skill-usage efficiency. "Agent invoked `solid-pod wiki-search` without burning tool calls on bootstrap"; "agent did NOT redundantly fetch the affordance catalog (skill provided enough info)"; "outcome correct."
- **Without-skill** assertions: tests cold-discovery. Same as iter-1/iter-2 (followed storage description → catalog → descriptor → invocation; used OSLC quoting; outcome correct).
- **Both**: outcome correctness (count + URLs).

Compare iter-3 against iter-1 + iter-2 via `generate_review.py --previous-workspace iteration-2`. The substrate sweep should ALSO improve without-skill efficiency (no 404s on stale `rdfs:seeAlso`, better narrowable catalog labels).

### Component 6 (optional, time-permitting) — Skill audit pass

If Components 1-5 finish with time to spare, audit the other skills in `solid-agent-skills/skills/` for D103 conformance:

- `pod-discover/SKILL.md` (most relevant — cold-start orientation)
- `solid-addressbook/SKILL.md`, `solid-wiki-memory-l3/SKILL.md`, `solid-owner-identity/SKILL.md`
- Action skills (crystallize, demote, archive, supersede, merge, link)
- Inbox skills (inbox-list, inbox-read, inbox-subscribe)

For each: is the skill ≤25 lines? Does it point at the canonical substrate descriptor? Does it duplicate substrate content? Refactor as needed.

### Dependencies + risks

- **pyshacl HTTP-resolve constraint**: pyshacl doesn't natively dereference IRIs as part of validation. Either subclass the validator OR post-process with a separate walker that does the cross-checks. Latter is simpler.
- **wikirole concept scheme**: shape constraint `prof:hasRole` membership requires the wikirole scheme at `/vault/ontology/wikirole` to be loadable + complete. Verify before relying on the constraint.
- **Two-stage commit for substrate**: the `/vault/working/curator-proposals/` container doesn't exist yet. Create it during Component 3 work, with permissive shape per D73 working/ semantics.
- **N3 Patch on `.meta`**: confirmed working from prior sprints (e.g., AddressBook overlay's `installsResourceMetaPatch`). Use the same pattern.

### Subsumes earlier task #10 (Pod-side lint/audit/curator skill)

Task #10 from the Rung 1.5 redesign session (filed as a Phase B2 prerequisite) collapses into this unified build. The pod-curator skill body (Component 3) IS the Phase B2 lint skill — same shape inputs, same reasoning loop, different work-queue source (audit report vs runtime `mem:*` event). Build once, apply to both.

---

## Pod-hosted memory-structure UI for transparency (2026-05-22)

The Pod runs on `localhost` (127.0.0.1 via `/etc/hosts`), so externally-hosted Solid apps (Penny, SolidOS at solidcommunity.net) only browse it via the user's own browser. Workable for read-only inspection, but not robust for end-users who need to see the substrate's memory structure (wikilinks, shapes, events, affordances, type-index, Memento history) at a glance.

**The actual need**: a substrate-aware UI served BY the Pod, same-origin, no CORS / OIDC redirect dance. Not just a generic LDP file browser — a transparency surface for:

- Dual-layer linking (wikilinks in body, projected predicates in `.meta`) rendered together
- Shape conformance per resource (which shape governs, current SHACL state)
- `/vault/wiki/.events/` substrate-signal stream (live via Solid Notifications subscription)
- Affordance catalog at `/vault/meta/affordances/` (what agents can do here)
- Type Index browsing (class → container routing)
- Memento history (time-travel queries with TimeMap rendering)

**Architectural sketch** (not yet a design):

- New CSS extension `memory-browser` serving static assets + a JSON API at `/vault/_ui/`
- Probably React/Preact + solid-client + N3.js (same stack as Penny)
- Or simpler: vanilla HTML + the existing JSON-LD context (`/vault/meta/context.jsonld`) for self-description
- Same-origin → no CORS, no OIDC popup, works with any browser without `mkcert -install`

**Why this matters beyond UX**: Rung 1.5 eval will need to observe agent behavior. A transparency surface that shows "what the agent saw, what it changed, what the substrate signalled" is useful for eval analysis even if not used by end-users.

**Trigger to start this**: post-Rung-1.5, OR when an end-user / demo needs human-readable Pod browsing as a primary affordance. Until then, the CLI (`solid-pod` in solid-agent-skills) and curl-based debugging cover developer needs.

Cross-refs: D75 (we explicitly traded the default container-browser HTML for clean markdown rendering — this would be the deliberate re-introduction of UI, scoped to substrate concerns).

## resource.shacl.ttl FAIR metadata retrofit (post-D97, 2026-05-19)

The D38 LDP RDFS/NRSource guard shape at `overlays/wiki-memory/shapes/resource.shacl.ttl` predates D97 and lacks the FAIR metadata properties (`rdfs:label`, `rdfs:comment`, `rdfs:isDefinedBy`, `dct:conformsTo`, `dct:created`, `dct:creator`) the rest of the L3 catalog now carries.

Exempted from `test_fair_metadata_present.py` (test fix in commit TBD) since the spec preserves it as-is per Phase B migration plan ("Preserved as-is. D38 invariant unchanged; not part of L3 content model"). Worth retrofitting as a future cleanup pass to make the L3 catalog uniformly FAIR-conformant.

Effort: ~10 minutes (just add the 6 properties).

## Shape catalog reconciliation (2026-05-18) — pyshacl fixture rebaseline

The shape-catalog reconciliation commit deleted the legacy `shapes/wiki-memory-l3/`
directory and re-pointed `tests/test_wiki_memory_l3_shapes.py` at the canonical
`overlays/wiki-memory/shapes/`. The four `test_bundle_fixture_validates` cases are
now `xfail` (strict) because the canonical shapes have tighter constraints than
the Rung-1.4-vintage fixtures.

Known fixture violations against canonical shapes:

- `karpathy-andrej.md.meta` — canonical `PersonShape` requires `foaf:name`
  (minCount 1); fixture has only `dct:title` + `foaf:nick`.
- Other bundle fixtures share the same combined-graph failure mode; need to
  re-validate each against canonical shapes individually to enumerate the
  delta.

This is part of **Shape Completion sprint** scope, not a standalone fix:
the sprint will retighten/finalize the shapes (page, source, person,
procedure, working) and add a Concept-specific shape, then rebaseline
fixtures to match. Once fixtures pass, remove the `@pytest.mark.xfail`
decorator and `strict=True` will catch any subsequent regression.

## ~~Phase C.10 — MemTrigger v1 wiring (Memory Structuring Sprint, 2026-05-18)~~

**Closed 2026-05-21** by MemTrigger detector wiring sprint (D101).
See `docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md`
and `docs/superpowers/plans/2026-05-20-mem-trigger-detector-wiring.md`.

All four detectors wired:
- BoundExceeded — real checkBound implementation via fetch() (D92 lock pattern)
- UnprocessableWrite — IUnprocessableWriteHook injected into ShaclValidator
- ContradictionDetected — IPostProjectionHook invoked by MarkdownProjectionListener
- ReflectionDue — setInterval timer in handle(); integration test deferred

Three of four mem_events integration tests passing on live Pod;
test_reflection_due_emits_event remains pytest.skip pending test-mode
config activation (artifact exists at `css/config/mem-trigger-test.json`
+ `css/config/solid-config-test.json`; activation pattern documented in
mem-trigger README).

### K1 consolidation note

`mem-trigger.json` now holds the WorkerParallelInitializer Override
listing all three listeners. Components.js rejected the configuration
when two files (markdown-projection.json + mem-trigger.json) both declared
Overrides on the same instance — "Found multiple Overrides targeting" is
a hard preprocessing error, not resolved by import order. Future memory
substrate listeners must be added to mem-trigger.json's handlers list.

## Phase 7a wiki-search — shipped (2026-05-18)

D87 ratified. Wiki-search CSS extension + Link MetadataWriter + capability
+ affordance descriptors + consumer CLI + Claude skill all shipped. Pod
returns OSLC Query 3.0 responses with WAC-filtered, AND-filtered,
score-sorted, paginated matches over recursive `/vault/wiki/` walks.
p95 latency: 26.7ms (D87 ceiling 500ms — 18.7× headroom).

Key commits (cogitarelink-solid):
- Implementation plan: `b064a79`
- Scaffold + interfaces: `d41f40c`, `5332c1a`
- Pure-Node engine + parsers + helpers: `1eafdab`, `7c1c054`, `821cf5b`,
  `0bd4bc3`, `fbb4e44`, `57abce4`
- Walker (recursive BFS + WAC subtree-omission): `c694407`, `5e9c6c1`
- Handler + Components.js + Dockerfile: `6cbccb1`
- Link MetadataWriter (Tier-1 discovery): `a014967`
- Capability + affordance descriptors: `7c68fca`
- E2E integration tests: `eb37bb7`
- Perf smoke (p95 26.7ms): `4905731`

Sibling repo (solid-agent-skills):
- Consumer CLI + Claude skill: `b17be6f`

### Architectural deviations from plan

- [x] ~~**D91 — Walker uses HTTP self-requests, not in-process ResourceStore.**~~
  **Provisional D91 retracted on 2026-05-18 spike.** The recorded narrative
  bundled two independent fixes ("HTTP-self-request rewrite" + `isReadAllowed`
  permission-shape fix) and credited the wrong one for resolving the original
  test failures. The actual root cause is re-entrant lock on the *request
  target itself* — not a general ResourceStore problem. Header forwarding
  to fix the anonymous-content leak is **architecturally impossible** under
  Solid-OIDC (DPoP proofs are bound to htm/htu/jti and one-shot; the server
  cannot mint replacement proofs without the client's private key).
  Replaced by Path 1a (DataAccessor for seed enumeration, ResourceStore for
  descendants). See `docs/plans/2026-05-18-wiki-search-walker-redesign.md`
  for the full reproduced failure mode, CSS architecture probes, multi-agent
  threat model, and revised recommendation. D92 ratification follows
  implementation sprint.

- [x] ~~**Wiki-search walker Path 1a redesign sprint.**~~ **Shipped 2026-05-18,
  commit `2f2f28b`.** Ratified as **D92** in
  `.claude/skills/decision-lookup/decisions.md`; synced to vault as D88
  (`SOLID-Pod-Decisions.md`). Implementation found two crash modes beyond
  the originally diagnosed re-entrant lock — both rooted in CSS's
  `N3StreamWriter` / `Guarded<Readable>` stream wrapping rather than in
  locking — so the final architecture uses `DataAccessor` for **all** Pod
  data access (`getChildren()` for container enumeration, `getMetadata()`
  for content-type checks, `getData()` for document bodies). No
  `ResourceStore.getRepresentation()` calls in the walker. p95 latency
  improved 3.5× (26.7ms → 7.6ms). 77/77 unit + 13/13 non-skipped
  integration tests pass. Findings recorded in
  `docs/plans/2026-05-18-wiki-search-walker-redesign.md` "Implementation
  findings" section.

- [ ] **WAC scenario integration tests un-stubbed.** Six tests in
  `tests/integration/test_wiki_search_e2e.py::TestWacScenarios` remain
  stubbed pending an authenticated-client fixture shared with
  `test_addressbook_e2e.py`. **Deferred under the behavior-before-security
  sequencing principle**: agent credential storage (DPoP key management,
  agent-vs-human WebID, VC delegation, refresh semantics) is its own
  design exercise downstream of Rung 1.5 (or equivalent) eval evidence
  about how agents actually traverse the substrate. Don't lock in a
  fixture shape until the credential model is designed; don't design the
  credential model until behavior is observed. See project MEMORY
  `behavior_before_security.md`.

- [ ] **VC credential extension (future research-track).** CSS v8 has
  the `@solidlab/policy-engine` VC matcher (`evaluateVc`) and ACP support,
  but **no `VerifiableCredentialExtractor`** ships out of the box.
  Roadmap in `docs/plans/2026-05-18-vc-credential-roadmap.md` covers:
  CSS v8 credential machinery state, the Inrupt UMA + Access Grants flow
  (gConsent), the SolidLab UMA AS landscape (real, MIT-licensed, but no
  W3C VC claim_token support yet), TypeScript VC library survey
  (`@digitalbazaar/vc` recommended core), and three routes — B rejected
  (build from scratch), C as v1 prototype (custom header + inline
  verifier, ~150 LOC), A' as v2 destination (SolidLab UMA + custom
  `VcVerifier` + `VcAuthorizer`, ~400 LOC contribution upstream).
  Not scoped to a sprint. Implementation triggers documented in the
  roadmap; typically Rung 1.5 eval evidence or a concrete use case
  requiring VC-gated access.

### Deferred to Phase 7b/c/d (out of scope for 7a)

- [ ] **Engine swap to BM25 or ripgrep** (Phase 7b). Decision criterion: if
  Rung 1.5 eval shows literal-witness recall < 90% on representative tasks,
  or p95 latency regresses past 500ms.
- [ ] **`oslc.where` structured filter** (RQ-Search-2). Either post-filter via
  Comunica over `.meta`, or push the structured filter into a pre-scan step.
  Defer until eval shows a real workload.
- [ ] **Hybrid RRF orchestrator** (Phase 7c). ~200 LOC; combines literal + BM25.
- [ ] **WebID-partitioned in-pod index** (Phase 7d, ESPRESSO pattern).
- [ ] **`_profile=alt` introspection** for the search response (low-priority).

### Deferred from Phase 7a implementation

- [ ] **WAC scenario integration tests** — see the dedicated entry above
  under "Architectural deviations from plan". Deferred under
  behavior-before-security; not blocked by Path 1a (Path 1a is shipped),
  blocked by the agent credential-model design exercise.
- [ ] **Score formula tuning** (RQ-Search-1). v1 baseline is density + log
  dampening; tune against Rung 1.5 eval evidence.
- [ ] **Whether to embed `.meta` triples in search responses** (RQ-Search-4).
  Phase 1 omits; revisit if Rung 1.5 shows agents repeatedly fetching `.meta`
  after a search hit.
- [ ] **Snapshot tokens for transactional pagination consistency**. Phase 1
  documents "stable-within-instant only"; revisit only if Rung 1.5 shows
  pagination drift hurts.

## Phase 5j (2026-05-16) — URI conformance close-out

### Deferred from D86 implementation

- [x] **PROF descriptor installation via overlay machinery.** Closed by Phase 5j close-out (2026-05-16) — see new section below for follow-ups.
  ~~5 descriptors written at `overlays/wiki-memory/profiles/{page,concept,source,person,procedure,working}.ttl` but the overlay manifest schema doesn't yet have `installsProfile` (parallel to `installsShape`, `installsAffordance`). To install:~~
  ~~1. Add `overlay:installsProfile` predicate to `css/config/pod-templates/base/ontology/overlay.ttl`~~
  ~~2. Parse it in `scripts/overlay/common.py` (mirror `shape_urls`/`affordance_urls`)~~
  ~~3. Add upload loop in `scripts/overlay/apply.py` step 3.5 (after affordances)~~
  ~~4. Update `overlays/wiki-memory/manifest.ttl` with the 5 profile URLs~~
  ~~\~15 LOC change. Files are committed; just unwired.~~

- [x] **`Link: rel="profile"` MetadataWriter CSS extension** (D86). Closed by Phase 5j close-out (2026-05-16) — see new section below for follow-ups.
  ~~Mirrors the `MementoLinkMetadataWriter` pattern at `css/extensions/memento/src/MementoLinkMetadataWriter.ts` (~30 LOC). Need:~~
  ~~1. New extension at `css/extensions/profile-link/` with package.json (lsd:* fields, `@cogitarelink/profile-link`), tsconfig.json, src/, dist/~~
  ~~2. `ProfileLinkMetadataWriter.ts`: path-based dispatch (`/vault/wiki/pages/*` → `wiki:PageProfile`, etc.) — use `addHeader` so Link composes with existing MementoLink + describedby headers~~
  ~~3. Components.js config that inserts the writer into the MetadataWriter ParallelHandler after `MetadataWriter_LinkRel`~~
  ~~4. Add `@cogitarelink/profile-link` to solid-config.json @context array and imports~~
  ~~5. Update Dockerfile with the symlink trick (per `css-extension` skill)~~
  ~~6. Tests: assert Link header presence on every resource GET~~
  ~~Design fully specified in `.claude/skills/solid-uri-conformance/SKILL.md` + `templates.md` Template E.~~

- [ ] **`_profile=alt` introspection view.**
  Reserved spec token (NOT `alternates` — see PROF research finding). Lists all profile × media-type combos for a resource. Part of the ProfileLinkMetadataWriter extension or a separate handler. Defer until Pod-bound agent eval shows a use case.

- [ ] **CSS storage description PATCH gate.**
  Surfaced during overlay apply: CSS returns `405 MethodNotAllowedHttpError "Only GET requests can target the storage description."` Overlay's storage-patch.ttl couldn't be applied at runtime — the wiki:* L3 pointers in `.well-known/solid` come exclusively from `css/config/void-description.json` (static StaticStorageDescriber). Decision: either (a) keep all storage description triples in static config (current state, works); (b) override CSS to allow PATCH on storage description; (c) move L3 pointers entirely into overlay-patched `/vault/.meta`. Currently working as-is; revisit if RQ-Substrate-3 successor surfaces.

### Closed by Phase 5j

- [x] **RQ-Substrate-3** — namespace mismatch resolved by D84 commitments (https, port-less, hash-namespace, extension-less). All 55+ source files migrated; volume wiped; Pod regenerated with new IRIs. Verified end-to-end.
- [x] **PROF descriptor installation via overlay machinery** — done via `overlay:installsProfile` + `overlay:installsRoleScheme` predicates in manifest + apply.py upload step. Wikirole SKOS scheme at `/vault/ontology/wikirole`.
- [x] **`Link: rel="profile"` MetadataWriter CSS extension** — done via `css/extensions/profile-link/` + Components.js wiring consolidated into memento.json. Emits one `Link: rel="profile"` per `dct:conformsTo` value in `.meta`. 32 integration tests green.

## Phase 5j close-out (2026-05-16) — Deferred follow-ups

### Architectural — schedule per Rung 1.5 evidence

- [ ] **Framing-2 refactor: drop wiki:*Affordance classes for pure PROF typing.**
  Affordances currently carry BOTH `a wiki:WriteAffordance` AND
  `a prof:ResourceDescriptor; prof:hasRole wikirole:*` (Framing 1.5
  additive, shipped in Phase 5j close-out). Pure-PROF refactor would
  retire the `wiki:*Affordance` classes from `wiki.ttl`, update any
  SHACL shapes or queries that target those classes, and possibly
  enrich the wikirole vocabulary further if eval shows agents reading
  those roles. Decision criterion: Rung 1.5 evidence of whether agents
  branch on `prof:hasRole` vs `rdf:type wiki:*Affordance`.

### Code findings to clean up

- [ ] **css/config/profile-link.json may be deletable.** Task 16 consolidated
  the profile-link Override into memento.json (Components.js forbids
  multiple Override declarations against the same component instance).
  If profile-link.json no longer carries any non-redundant config, delete
  it and remove the import from solid-config.json. Verify CSS still starts
  cleanly after deletion.

- [ ] **Apply.py body-triple vs .meta divergence.** Plan Tasks 6/7 added
  `dct:conformsTo` to RDF resource bodies for self-documentation, but
  CSS only reads `.meta` sidecar triples into `RepresentationMetadata`.
  Apply.py compensates by PATCHing `.meta` on every apply (Task 17 fix,
  idempotent). Long-term cleaner: either (a) drop the body declarations
  since they're redundant for header emission, or (b) build a
  MetadataReader that surfaces body `dct:conformsTo` into
  `RepresentationMetadata` for RDF resources. Defer decision until more
  body-vs-.meta patterns accumulate.

- [ ] **DCT vocabulary helper for the codebase.** CSS's `DC` export is a
  3-term subset (description/modified/title) and does not include
  conformsTo, references, hasPart, etc. `ProfileLinkMetadataWriter`
  inlined the named-node URI directly. If more DCT-using extensions are
  added, consider publishing a shared `vocab/dct.ts` helper or a
  project-wide constant module.

### Confirmation of close-out

- [x] **PROF descriptor installation via overlay machinery** — done via
  `overlay:installsProfile` + apply.py upload step.
- [x] **`Link: rel="profile"` MetadataWriter CSS extension** — done via
  `css/extensions/profile-link/` + Components.js wiring in memento.json.

## AddressBook substrate sprint (2026-05-17)

D87 + D88 ratified. Substrate shipped + agent-discoverable. Cross-batch
adversarial review surfaced these items. None are blockers; trim or address
as need arises.

### Future trims (do when justified, not now)

- [ ] **9 capability descriptors with no consumers** (`/vault/meta/capabilities/`):
  5 AddressBook-provided (vcard-individual-substrate, vcard-organization-substrate,
  external-anchor-tracking, contact-discovery, tmpl-vocabulary) + 1 wiki-memory
  (wiki-page-as-unit). All are speculative — built for hypothetical future
  overlays that don't exist yet. Cost-to-carry is ~50 lines of Turtle. Trim
  when a third overlay materializes and we can see which caps actually get
  consumed vs which were YAGNI violations. Cross-batch review identified;
  see `0f1295f..be26866` for sprint commits.

### Coverage gaps (next plan or backlog)

- [ ] **`verify.py` doesn't check bootstrap content, TypeIndex registrations,
  or container `.meta` patches landed correctly.** After `apply_overlay()` runs,
  verify only checks artifacts (containers, shapes, affordances, vocabularies,
  capabilities, templates). Missing: people.ttl/groups.ttl/index.ttl exist,
  TypeIndex contains the registration, container .meta has `ldp:constrainedBy`.
  Add when the next overlay's verify needs them.

- [ ] **`find-by-orcid` affordance not exercised end-to-end** via
  `solid-pod invoke`. E2E test falls back to direct GET+parse because the
  CLI isn't on PATH in the test runner. Add a proper affordance-invocation
  integration test when the AddressBook skill plan lands (the skill needs to
  exercise affordances anyway, so this work folds into that plan).

- [ ] **`org-find-by-ror` SPARQL test is too weak** — checks `owl:sameAs`
  in query text but doesn't verify `vcard:Organization` type-filtering.
  Could quietly accept a Person ORCID match. Two-line test strengthening.

### Cross-batch design lessons (captured for future plans)

- [ ] **Template-to-SHACL agreement tests are non-optional**: the
  AddressBook sprint's `vcard:inAddressBook` IRI bug — templates said
  `</vault/contacts/index.ttl#this>` but SHACL `sh:hasValue` resolved to
  `<https://pod.vardeman.me/contacts/index.ttl#this>` (server-root, not
  vault-root, due to CSS relative-IRI resolution quirk) — would have
  silently broken every agent following the template. Caught by the
  cross-batch review and the new parametric test in
  `tests/test_addressbook_templates.py::test_template_substituted_body_conforms_to_shape`.
  Any overlay that adds templates MUST add the equivalent agreement test.
  Consider hoisting this test pattern to a reusable test helper if a second
  overlay ships templates.

### AddressBook-specific deferred design choices

- [ ] **Person flat-file layout** (`/vault/contacts/Person/<uuid>.ttl` instead
  of design's `/vault/contacts/Person/<uuid>/index.ttl#this`): CSS
  shape-validator rejects sub-container creation within a constrained
  container, blocking the per-Person container approach intended for
  attachment co-location. Two options when attachment use-cases surface:
  (a) add a separate `Photo/` (or per-attachment-type) container with its
  own SHACL constraint; (b) drop `ldp:constrainedBy` on `Person/` and
  validate via a write-handler hook on individual cards instead.

- [ ] **SHACL relative-IRI resolution quirk on Pod**: shape uses
  `sh:hasValue </contacts/index.ttl#this>` which CSS resolves relative to
  server root, not vault root. Sprint resolved this by switching both
  shape and template to absolute IRIs (`<https://pod.vardeman.me/vault/...>`).
  Worth grepping all SHACL shapes in `overlays/*/shapes/` for relative IRI
  patterns and converting to absolute where the resolution would surprise
  agents. Defer until a second overlay shape uses `sh:hasValue` with a
  relative IRI.

- [ ] **Pod owner contact card** — no `/vault/profile/card#me`-linked
  AddressBook entry exists. Addressed by the next plan's `solid-pod
  setup-owner` CLI flow (would mint UUID, PUT card, add `owl:sameAs
  </vault/profile/card#me>`, PATCH people.ttl). Defer to that plan.

### Wiki URI scheme rethink (informed by Swartz)

- [ ] **Revisit wiki entity URIs in light of Aaron Swartz, *A Programmable
  Web: An Unfinished Work* (Synthesis Lectures on the Semantic Web, 2013,
  ed. Hendler).** The AddressBook substrate adopted opaque `UUIDv4` slugs
  for Person/Organization (class-by-class exception to "mnemonic over
  opaque for everything" per `solid-uri-conformance/references/deltas.md`).
  Swartz's positions on URI design (hash-vs-slash pragmatism, Wikipedia
  URLs as a good model, avoiding technical-leakage in URLs, JSON-LD over
  RDF/XML) deserve a careful read before extending the per-class-opacity
  pattern to other wiki entity classes. Specifically: which wiki:Resource
  subclasses have collision/rename risk substantively higher than the
  current name-slug assumption (where wikilink affordance is the design
  centerpiece)? Most likely candidates: none today; the wiki was designed
  for name-slug stability and the Pod-owner controls naming. But the
  question of when to mint opaque slugs for instances (vs vocabularies,
  covered by D84) is open.

  Action when picked up:
  1. Re-fetch Swartz's book (likely CC-licensed; check Hendler's site or
     archive.org) and read Chapter 4-5 specifically on URI design
  2. Synthesize the project's deltas (URI conformance skill), Swartz's
     positions, and the Cool URIs guidance into a single design-doc-level
     URI design principles reference
  3. Per-entity-class opacity audit (where is `UUIDv4` justified beyond
     Person/Org? Where does mnemonic-by-default still hold?)

  Surfaced during the AddressBook design conversation (2026-05-16); flagged
  again at sprint close-out (2026-05-17).

### Confirmation of close-out

- [x] AddressBook substrate shipped — see MEMORY.md ship entry
- [x] D87 + D88 ratified — see `decisions.md`
- [x] 38 commits pushed to origin/main (33dd1d9..be26866)
- [x] Template-to-SHACL agreement test pattern added (commit `04e26ef`)
- [x] Pre-push cleanups (consolidated TypeIndex mechanism, dead code, stale comments)

## Rung 1.4 close (2026-05-15)

### Critical — deferred to Rung 1.5 eval

- [ ] **RQ-Listener-1: Model A preservation across CSS .meta overwrite**.
  `test_agent_enrichment_survives_body_rewrite` xfailed with diagnosis. Mitigation paths:
  - Paths (A) Memento-history read, (B) `.meta.agent` sidecar, (C) PassthroughStore wrap analyzed in `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md`.
  - Path (D) RDF-star triple-level provenance + reification shim explored in `docs/plans/2026-05-15-rdf-star-provenance-exploration.md` — **candidate, not committed**. Avoids the `.meta.agent` sidecar entirely by partitioning substrate vs agent triples via `prov:wasGeneratedBy` annotations on quoted triples. Tooling probe: N3.js ready, CSS conneg ready with overrides, rdflib lacks RDF-star (hard blocker for Python clients) — ~50 LOC reification shim closes that gap by serving classical `rdf:Statement` reification to non-star clients. Decision criteria documented; promotes to D82 only when Rung 1.5 eval evidence justifies.
  Decision criterion (general): if Rung 1.5 eval surfaces real agent-extension use cases (agents PATCHing `.meta` outside the governed set), pick between paths (B) and (D) based on whether per-triple provenance is load-bearing for RLM behavior. If eval shows agents never extend, reframe the xfail as documentation.

### Small — fix when needed

- [x] ~~**WIKI_NS central constant**.~~ **Closed by Phase 5j (D84)**: all `urn:example:wiki#` and port-baked refs migrated to `https://pod.vardeman.me/vault/ontology/wiki#`. If the Pod hostname ever changes, the substitution remains sed-replaceable — but the IRI is now Pod-namespace-authority style, not placeholder. The "central constant" idea no longer applies (predicate IRIs reflect deployment intent, not a future TBD mint).

- [ ] **`foaf:affiliation` frontmatter mapping**.
  PersonShape allows `foaf:affiliation`, `governedPredicates` includes it, but `frontmatterProjection.ts` has no `affiliation:` key. Agents can't set affiliation via body+frontmatter today. Two-line fix when an eval task needs affiliation traversal.

### Documented elsewhere (cross-references)

- **RQ-Pod-4** — Comunica `.meta` traversal gap, workaround documented at `docs/plans/2026-05-15-rq-pod-4-workaround-notes.md`. Decision point: Rung 1.5+ if explicit-source pattern becomes a bottleneck.
- **K2 (triple-hyphen slugs)** — `slug()` doesn't collapse consecutive hyphens. Accepted for v1 in `decisions-index.md`; refinement is post-spike.
- **K3 (`.author` → `dct:contributor`)** — class-hint dispatch can't differentiate concept-contributor from source-creator. Distinct `.creator` class hint is a Rung 1.5+ option.
- **Task 42 (context-driven listener dispatch)** — `wikilinkProjection.ts` uses hardcoded class-hint table instead of reading `/meta/context.jsonld` at runtime. Functionally equivalent; deferred to Rung 1.5 cleanup per D79.

## Owner-identity sprint (2026-05-17)

- **T4 PodOwnerPreferencesShape — sh:targetClass deviation from plan.** The plan specified `sh:targetNode </vault/settings/prefs.ttl#owner>`, but the shape uses `sh:targetClass prefs:PodOwnerPreferences` instead. Class-based targeting matches every other shape in the repo (compare `contact-card.shacl.ttl`) and is resilient to a future change in the prefs resource path. The test data and the prefs-init template (T6) both declare `a prefs:PodOwnerPreferences` on the subject, so the targeting catches the production case. No action needed — captured for the sprint reflection.

- **TLS dev-cert: solid-pod CLI should detect SELF_SIGNED_CERT_IN_CHAIN and either auto-resolve mkcert root CA or emit a clear remediation hint.** T30 cold-session surfaced an agent reaching for `NODE_TLS_REJECT_UNAUTHORIZED=0` (disables verification globally) instead of `NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem` (the D85 correct fix). The mkcert root CA exists at `$(mkcert -CAROOT)/rootCA.pem`, the Pod's cert is correctly signed by it — only documentation + UX of the failure mode were broken. Skill docs were updated to surface the right env var (`solid-agent-skills/skills/solid-{owner-identity,addressbook,wiki-memory-l3}/SKILL.md` Pre-flight section, commit `d430c24`). The deeper fix: `solid-agent-skills/src/lib/http.ts` should (option a) catch Node's `SELF_SIGNED_CERT_IN_CHAIN` error code and rewrite it as `"TLS verification failed against system trust store. If using a mkcert dev cert, run: export NODE_EXTRA_CA_CERTS=\"$(mkcert -CAROOT)/rootCA.pem\""`; or (option b) probe for `$(mkcert -CAROOT)/rootCA.pem` at startup and prepend it to `NODE_EXTRA_CA_CERTS` automatically when the user hasn't set it — zero-config dev ergonomics, no effect on prod since the file doesn't exist there. Picking up post-Rung-1.5.

- **`tmpl:targetResource` `rdfs:comment` over-constrains** (T6 code review). The vocab entry says *"Used for PATCH templates..."* but `prefs-init.ttl` proves PUT-on-fixed-IRI is equally valid. Broaden to: *"The specific resource a filled template is applied to, for templates that target a known IRI rather than minting a slug under a container. Works with both PUT (creating at a fixed path) and PATCH (modifying an existing resource)."* Lives in `overlays/addressbook/vocabulary/template.ttl`. Pick up next time the AddressBook vocab is touched; bumps `cap:tmpl-vocabulary` to v1.2.

- **`tmpl:Template` XOR invariant unenforced by SHACL** (T1 code review). The vocab `rdfs:comment` says exactly one of `tmpl:targetContainer` / `tmpl:targetResource` must be present, but this is documentation-only. Per-template tests in T6 (`assert not container` for prefs-init) and T7 (`assert not container` for webid-enrich) cover the immediate risk for this sprint's templates. A `TemplateShape` `sh:NodeShape` with `sh:xone` over the two predicates would enforce substrate-wide and surface in any future template's ValidationReport. Low-priority — current discipline is two assertions in test files.

## Path constraint primary-topic-only rdf:type extraction (post-Bug-E)

Bug E (2026-05-19) fixed a false positive where container `.meta`
PATCHes were rejected because `rdf:type` was extracted from ALL
subjects in the body. The current fix skips path constraint
checks entirely for `.meta` resources (Option 1).

The cleaner long-term fix is Option 2: restrict `rdf:type`
extraction to the primary-topic subject (the resource IRI or its
hash fragment). This would let the substrate enforce path
constraints on `.meta` content with precision, in case an L4 use
case demands it.

Effort: ~30 min in checkPathConstraint + new unit tests.

## Pre-existing (earlier rungs)

- **RQ-Harness-1** — fabric namespace minting at `https://cogitarelink.org/ns/fabric#` — blocks all `fabric:*` predicates past prototype.
- **RQ-Eval-1/2/3** — task suite design, sub-agent config, GEPA convergence (Rung 1.5 work).
- **RQ-Memento-1/2**, **RQ-Federation-1** — see `decisions-index.md`.
