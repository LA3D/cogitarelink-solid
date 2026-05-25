# Memory-operation provenance by derivation from the operation log (RQ-Listener-1)

**Date**: 2026-05-25
**Status**: Design — hypothesis to validate experimentally via agentic trajectories
**Supersedes**: the recommendation in `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md`
(that doc's path B `.meta.agent` sidecar remains the answer for the *broad* agent-extension
question, which this design does **not** close — see §8)
**Related**: D81 (predicate-level governance), D58/D71 (dual-layer linking / projection),
D73 (two-stage commit), RQ-Pod-4 (Comunica `.meta` traversal), the VC roadmap
(`docs/plans/2026-05-18-vc-credential-roadmap.md`), `mem.ttl` (mem:Action / mem:Event)

> **One-line framing.** A resource's memory-operation provenance is not *stored* on the
> resource and *preserved* across writes (timing-fragile, D81's broken assumption). It is
> **re-derived** from the canonical operation log every time `.meta` is regenerated. The
> data model for this is settled; the *policy* (what gets surfaced, when, which action) is
> held open and decided by what agentic trajectories show works.

---

## 1. The problem

`MarkdownProjectionListener` regenerates a resource's `.meta` wholesale on every body write.
CSS's `FileDataAccessor.writeMetadataFile()` clears `.meta` *before* the MonitoringStore
`'changed'` event fires (T2 < T3), so any agent-PATCHed triple is gone before the listener
can read and preserve it. The 6 `tests/integration/test_mem_operations.py` e2e tests
(crystallize/supersede/merge/demote/archive/link) fail because the agent's
`<resource> prov:wasGeneratedBy [ a mem:…Action ]` edge is clobbered.

Modeling the collision shows it is **two independent problems**:

1. **Semantic overloading.** Projection unconditionally emits
   `<resource> prov:wasGeneratedBy </meta/affordances/markdown-projection>`
   (`projectionPipeline.ts:168–174`), and `prov:wasGeneratedBy` is in
   `PAGE_GOVERNED_PREDICATES` (`governedPredicates.ts:41`). So one predicate on one subject
   is forced to carry two different statements: *"this metadata was produced by the projector"*
   (provenance of the **metadata**, mis-attached to the resource subject — a PROV category
   error) and *"this resource was brought into being by a memory operation"* (provenance of
   the **resource's generation**).

2. **Timing / persistence.** Even with zero semantic collision, CSS's wholesale `.meta`
   clear wipes any in-resource agent triple before preservation logic can run. This defeats
   *any* "keep it on the resource and preserve it" approach (paths A/C of the 2026-05-15 doc).

---

## 2. The decision, in two layers

The brainstorm separated two things that had been entangled:

| Layer | Status | Content |
|---|---|---|
| **Data model / mechanism** | **Settled** | Derive-from-log (E1); three-statement disambiguation; `as:object` as the canonical announcement→target link; "log wins" holds by reconstruction. |
| **Policy** | **Open — experimentally validated** | Which edge to surface on the resource (origin / current-generation / both); the announce-first contract and its heal path; how much provenance enters agent context by default. |

This split is deliberate. The mechanism is a sound substrate primitive regardless of policy;
the policy is a tuning question we answer by observing agent behavior, not by argument.

---

## 3. Data model (settled)

### 3.1 Three distinct PROV statements, pulled apart

| # | Statement | Subject | Predicate | Object | Author |
|---|---|---|---|---|---|
| 1 | Resource generation | `<resource>` | `prov:wasGeneratedBy` | the mem-action node | **projection, derived from the log** |
| 2 | Operation record (canonical) | `<.operations/{id}>` | `as:object` → target; action via `prov:wasGeneratedBy [ a mem:…Action ]` | — | agent (announce step) |
| 3 | Metadata provenance (audit) | the **`.meta` document**, not the resource | `prov:wasGeneratedBy` | `</meta/affordances/markdown-projection>` | projection |

The fix for problem #1 (§1) is to **move statement #3 off the resource subject** onto the
metadata document (where it is true) and **stop emitting the affordance stamp on
`<resource>`**. That alone removes the semantic collision: `<resource> prov:wasGeneratedBy`
is then free to mean exactly one thing.

### 3.2 The derive() function

Statement #1 becomes a projection-**derived** triple, exactly like the projector already
derives `dct:identifier` from the URI slug:

```
edge(X) = derive(X) = f( operation-log announcements where as:object = X )
```

It is recomputed on every `.meta` regeneration from the op log as a source. Consequences
that fall out for free:

- **Timing bug becomes irrelevant** — you cannot lose what you recompute from scratch.
- **"Log wins" is structural** — there is no stored copy to drift or to reconcile against;
  the surfaced edge *is* a view of the log.
- Projection gains one new source (the op log) alongside body + frontmatter + Type Index.

### 3.3 Canonical announcement → target link

Every `mem:Action` announcement in `/vault/wiki/.operations/` MUST carry
`as:object <target-resource-IRI>` — the resource the operation produced or rewrote, i.e. the
resource whose `.meta` should surface the edge. `mem.ttl` currently describes this
inconsistently (prose says `as:object`; one example uses `prov:wasDerivedFrom`). The design
**tightens `mem.ttl`** so `as:object` is the required, canonical target pointer on every
action announcement; sources/partners of n-ary operations (merge inputs, link counterpart)
go on `prov:wasDerivedFrom` / operation-specific predicates, never on `as:object`.

---

## 4. Design tenets

### 4.1 Universal operation provenance (for VC + traceability)

**Every agentic operation carries audit-grade provenance, by default, not only the six
named mem-operations.** The operation log is the universal provenance substrate. Rationale:
verifiable credentials and traceability (the trusted-AI thread) require that any agent
mutation be attributable — *who* (WebID/ORCID via `prov:wasAssociatedWith`), *what*
(action class), *when* (`prov:startedAtTime`), *from what* (`prov:used` /
`prov:wasDerivedFrom`), and *why* (`mem:rationale`, already required on `mem:RealignAction`).
The announcement record (statement #2) is designed to be VC-ready so a later
`VerifiableCredentialExtractor` (VC roadmap, route C) can wrap an announcement as a credential
without reshaping the data. The immediate implementation target is the six mem-operations
(the failing tests); the *tenet* is universal and constrains future operation types.

### 4.2 Context economy — minimal surface, history by affordance

Do **not** load a memory's full provenance/history into the agent's context by default.
Surface a *minimal* edge on the resource (one action node, per the policy in §5), and provide
an **affordance** the agent invokes *on demand* to reconstruct the full history of a memory.
This is progressive disclosure / handle-first retrieval applied to provenance: the agent sees
a handle, follows it only when the task needs the history. See §6.

### 4.3 Two history axes, log canonical, Memento as version axis

- **`/vault/wiki/.operations/`** — the append-only operation log; canonical source of truth
  for *what operations happened*.
- **Memento (RFC 7089)** — the "git log" version axis; canonical for *what the bytes were at
  time T*. Not yet exercised end-to-end. Whether op-log + Memento *together* give complete,
  reconstructable memory history is an explicit experiment (§7), not an assumption.

---

## 5. Policy (open — to be decided by trajectories)

The mechanism in §3 can surface any of the following; the design does **not** pre-commit.
Each is cheap to switch because the edge is derived, not migrated.

- **P-current** — `prov:wasGeneratedBy` = the **latest** action with `as:object = X`.
  PROV-correct ("the activity that produced the entity in its current form"). Cost: after a
  supersede the edge no longer answers "how was this *born*"; genesis must be fetched from the
  log/Memento. A moving pointer.
- **P-origin** — surface an **immutable** origin edge (the earliest/Crystallize action). Set
  once, never drifts, best serves "at a glance, how did this come to be." But it isn't
  `prov:wasGeneratedBy` in strict PROV terms (closer to a custom `mem:originatedBy` or
  `prov:wasDerivedFrom` the working note).
- **P-both** — two derived edges: an immutable origin and a current-generation pointer. Most
  informative, most triples in `.meta`, mild redundancy with the log.

**Decision criterion:** run the mem-operation trajectories (§7) and observe which edge agents
actually read and whether they answer history questions correctly with it. Default to
**P-current** for PROV-tidiness *only* if trajectories show agents don't need at-a-glance
genesis; switch to P-origin or P-both the moment a trajectory needs origin and pays a
round-trip for it.

**Announce-first contract (open).** Because the edge is derived, the announcement must exist
*before* the body PUT that triggers projection, or the edge is empty until the next write.
This flips today's `mem.ttl` sequence (PUT → PATCH → announce) to **announce → PUT**. Open
sub-question: accept the soft-failure (late/forgotten announce → silently missing edge) with a
lint check, or add a **heal path** (the announcement landing in `.operations/` triggers
re-derivation of its `as:object` target's `.meta`). The heal path also future-proofs against
out-of-order agents. Decide from trajectories: do agents reliably announce-first?

---

## 6. The history affordance

A descriptor at `/vault/meta/affordances/` (e.g. `memory-history`) that, given a resource IRI,
returns its operation history — the `.operations/` announcements with `as:object = X` ordered
by time, optionally joined with the Memento TimeMap for byte-level versions. Per D52/D55 this
is machine-actionable: the descriptor quotes the query (Comunica SELECT over `.operations/`
with explicit `.meta` sources, per the RQ-Pod-4 workaround) and the agent runs it locally.
This is the on-demand counterpart to §4.2: the resource `.meta` carries the minimal edge; the
affordance reconstructs the rest only when invoked.

---

## 7. Open questions / experiments (this design is a hypothesis)

Validate via agentic trajectories (Phase A/B Rung-1.5 tasks) and falsify freely:

1. **Policy P-current vs P-origin vs P-both** (§5) — which edge do agents read; do they answer
   genesis questions correctly under P-current, or pay round-trips? Surfaced from trajectory
   logs.
2. **Announce-first reliability** — do agents announce before PUT unprompted, or is a heal path
   required? Count late/missing announcements across runs.
3. **op-log + Memento sufficiency** (§4.3) — can an agent reconstruct a memory's full history
   from the two axes? Memento is untested; this is the first real exercise of it.
4. **Context-economy payoff** — does surfacing only the minimal edge + history affordance keep
   context lean *and* let agents recover history when needed, vs. inlining full provenance?
5. **VC-readiness** — can an announcement be wrapped as a verifiable credential without
   reshaping it? (Dry-run against the VC roadmap's route-C extractor sketch.)
6. **op-log lookup at scale** — container scan + `as:object` filter + time-sort is fine at
   pilot scale; at what N does it need an index? (RQ-Pod-6 neighbor.)

---

## 8. Scope boundary

- **In scope (immediate):** the six mem-operations and their failing e2e tests; the semantic
  cleanup of statement #3; the `mem.ttl` `as:object` tightening; the derive-from-log mechanism;
  the history affordance; the policy *framework* (with the choice left open).
- **NOT in scope:** the **broad** agent-extension question — agents PATCHing *arbitrary*
  non-governed triples (e.g. `wiki:relevantToProject`) and expecting them to survive rewrites.
  That is the original `test_agent_enrichment_survives_body_rewrite` xfail; it stays xfailed and
  its answer remains the `.meta.agent` sidecar (path B → D82), deferred until eval shows agents
  actually extend `.meta`. This design handles operation provenance *specifically* because it
  has a canonical external source (the log) to derive from; arbitrary agent triples do not.
- **Coexistence — vault-importer provenance (D20).** The importer stamps
  `<> prov:wasGeneratedBy [ importer activity ]`. Today projection *already* overwrites this
  with the affordance stamp, so removing the affordance stamp is not a regression — but the
  design must decide whether non-operation resources carry *no* resource-level
  `prov:wasGeneratedBy` (projection emits the derived edge only when an announcement exists) or
  a fallback. Confirm nothing relies on the importer stamp before deleting it.

---

## 9. Implementation sketch (for the later plan, not binding)

1. **Verify CSS behavior first** (the substrate has bitten us here — agentic-development rule):
   does the projection listener have read access to `/vault/wiki/.operations/` at projection
   time? Can it query a sibling container mid-write? Establish this before building.
2. **Tighten `mem.ttl`** — `as:object` required + canonical on every `mem:Action` announcement;
   document the announce-first contract; clarify n-ary target vs sources.
3. **Projection changes** (`projectionPipeline.ts`): drop the unconditional affordance stamp on
   `<resource>`; relocate the projector's audit provenance onto the `.meta` document
   (statement #3); add the op-log source and the `derive(X)` step emitting the policy-selected
   edge.
4. **History affordance** descriptor at `/vault/meta/affordances/memory-history`.
5. **Rewrite the 6 e2e tests** to: announce → PUT → assert the derived edge appears in `.meta`
   *and* the canonical announcement in `.operations/`. Keep `test_agent_enrichment_survives_body_rewrite`
   xfailed (broad case, §8).
6. **Trajectory instrumentation** for the §7 experiments (reuse the Phase A pilot harness).

---

## 10. References

- `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md` — paths A/B/C; B (sidecar) still
  the broad-case answer
- `css/extensions/markdown-projection/src/projectionPipeline.ts` (stamp at 168–174),
  `governedPredicates.ts` (predicate at 41)
- `overlays/wiki-memory/ontology/mem.ttl` — mem:Action / mem:Event; announcement examples
- `docs/plans/2026-05-18-vc-credential-roadmap.md` — VC extractor routes (tenet §4.1)
- D52/D55 affordance descriptors; D58/D71 projection; D73 two-stage commit; D81 governance
- `tests/integration/test_mem_operations.py` (the 6 failing tests);
  `tests/test_wiki_memory_l3_listener_integration.py::test_agent_enrichment_survives_body_rewrite`
  (the broad xfail)
