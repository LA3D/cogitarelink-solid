# Provenance-Scoped Projection Replacement (dissolving D82)

**Status:** APPROACH CONFIRMED (Chuck 2026-06-12) — §7 DECIDED: version-stamp +
migration sweep. Ready for the implementation plan. Supersedes the F7 review fix
(the `prov:wasGeneratedBy` subject-scope special case in `MetaWriter`, commit `8b6e816`)
once built. **Decision lineage:** the SP2 review found the projection's predicate-keyed
strip clobbering non-projection triples (F7); the frame-scoped-strip proposal was
sanity-checked against linked-data and wiki-memory prior art (2026-06-12, research
summarized in §2) and revised to this design; the named-graph alternative was killed by
a spike (§3). **Payoff:** D82 (`.meta.agent` sidecar) dissolves; the markdown-lane write
contract (🧷 follow-on (a)) unblocks.

**▶▶ EXECUTED 2026-06-13 (D116; branch `prov-scoped-projection`, 8 tasks PSP-T1–T8).** Plan:
`docs/superpowers/plans/2026-06-12-provenance-scoped-projection.md`. The subtraction contract,
the three-station partition, the floor pre-commit snapshot + listener Memento backstop (degraded
pair-shadow + `mem:StalenessDetected`/`mem:Materialization` curation signal), the
`sub:projectorVersion` stamp + migration sweep, and the F7 special-case deletion all shipped as
designed; knob §7 settled = version-stamp + sweep. **D82 DISSOLVED** — `.meta.agent` sidecar
unbuilt, `test_agent_enrichment_survives_body_rewrite` flipped strict-xfail → expected-pass; the
markdown-lane write contract (🧷 (a)) ungated. **Probe PASS 2/2** (`evals/proj-enrich/`, Haiku,
$0.26; report `docs/plans/2026-06-13-psp-enrichment-probe-report.md`). **One recorded residue:**
the hand-edited `dist-cjs/*.jsonld` (`gitDir` param, PSP-T5) is overwritten if
`componentsjs-generator` is re-run — same drift class as the `stampPredicate`→config precedent
(FOLLOWUPS markdown-projection tech-debt §5). Decision text: D116 in
`.claude/skills/decision-lookup/decisions.md`. Controller merges after a final whole-branch review.

## 1. Problem

`MetaWriter.replaceGoverned` makes re-projection idempotent by stripping previously
materialized triples before writing the new projection — keyed by **predicate alone,
on all subjects** (`metaWriter.ts:64-69`). Anything else in `.meta` that uses a
governed predicate is collateral damage: the SP2 index's derivation pointer (F7,
found by review), any agent enrichment using a governed predicate on a non-projection
subject, and — the D82 case — agent `.meta` enrichment generally, whenever the strip's
schema and an agent's vocabulary overlap. The strip is doing two jobs: **idempotent
regeneration** (its real job) and **ownership enforcement** (not its job — the
admission floor already enforces who may write governed pairs, with 422s + teaching).

## 2. Prior-art grounding (what the 2026-06-12 research established)

- **Predicate-scoped server ownership is mainstream** — it is LDP's own
  "server-managed triples" mechanism (predicate set, same graph, 409 +
  `rel="constrainedBy"`). Our floor is a generalization of it. **Keep.**
- **Schema-keyed clobbering is the anti-pattern** — every surveyed memory system
  without provenance-scoped writes (mem0, LangMem) destroys authored content on
  re-derivation; every system that survives (Graphiti, OBO/ROBOT pipelines, SMW,
  the wiki lineage: Karpathy / gbrain / ByteRover / AKBP) scopes regeneration to
  **its own prior output** — by separate artifact, separate store, per-item
  provenance tag (`is_inferred`), or one-writer-per-layer.
- **The strongest single-graph precedent** (Graphiti) tags per-edge provenance and
  invalidates rather than deletes — already our curation posture
  (`mem:RealignAction`, Memento).
- **UMP corroboration (universalmemoryprotocol.io, v0.1, reviewed 2026-06-12):** the
  draft Universal Memory Protocol independently lands on the same three commitments —
  non-destructive updates (`revise` + `supersedes`/`superseded_by` chains, bi-temporal
  `valid_at` queries ≈ our Memento+supersession), a REQUIRED write-time provenance
  contract at L2+ (`actor`, `actor_kind` ∈ {user, agent, model, import, scan},
  `method` ≈ our `hadPlan`; our twin-probe "require-or-derive" finding standardized),
  and consolidation left to engines (our curation-lane stance). Its sharpest lesson for
  THIS spec: UMP never faces our clobber problem because ownership is RECORD-granular
  (one writer per record + supersession — the wiki-lineage one-writer-per-layer pattern
  again). A Solid `.meta` is deliberately a SHARED-write graph (dual-layer, D58/D81),
  so we need provenance-scoping *within* the unit — which is exactly what subtraction
  provides. Maturity caveat: v0.1, no named implementations; treat as convergence
  evidence, not a binding target.
- The **subject-frame strip** (the F7 fix's generalization) has no named precedent;
  it would be a bespoke middle between LDP's predicate scope and the mainstream's
  provenance scope. Dropped in favor of provenance scope.

## 3. Spike result: no named graphs on disk

CSS holds `.meta` as quads internally (its own `ResponseMetadata` bookkeeping is
graph-partitioned), but the **file backend serializes `.meta` to plain Turtle** —
verified on the live volume (`/data/vault/wiki/concepts/*.md.meta` are triples, no
graph terms). A named-graph partition (projection writes into a derived graph;
regeneration = replace-graph) would require changing the on-disk metadata format
(N-Quads/TriG) plus every parser touchpoint (conneg, floor, tooling). Killed —
the functional design below achieves the same invariant with zero format change.

## 4. The design

Three stations, each keeping one job:

| Station | Job | Status |
|---|---|---|
| **Admission floor** | WHO may write a governed pair (422 + ValidationReport + teaching; LDP precedent) | already built (D108); unchanged |
| **Projection replacement** | idempotent regeneration that touches ONLY its own prior output | **this spec** |
| **Curation lane** | contested values: invalidate, never delete (Graphiti convergence) | already built (D112); unchanged |

**The replacement contract:**

```
.meta_next  =  ( .meta_current  −  f(body_old) )  ∪  f(body_new)
```

where `f` is the deterministic projection. The subtraction removes exactly the triple
set the projection produced last time — recomputed from the old body, not matched by
schema. Everything an agent (or another substrate component) wrote survives **by
construction**, including triples that use governed predicates on other subjects.

**Consequences for the governed set's role:** `PAGE/THING_GOVERNED_PREDICATES` stops
being the clobber list. It remains (a) the floor's validation dispatch and (b) the
agent-facing declaration (`sub:governs`, D81 Model A) — both unchanged. The F7
special case in `MetaWriter` is deleted, subsumed.

## 5. Mechanics per write path

**Primary path — the in-band floor** (`AdmissionFloorStore` → `markdownBodyProjector`):
the floor runs *inside* `setRepresentation`, before commit, so the old body is in hand
(one `getRepresentation` before overwrite; tolerate 404 → first write, empty
subtraction). Compute `f(body_old)`, subtract, union `f(body_new)`, materialize.
Exact, synchronous, no new storage.

**Backstop path — the async listener** (`MarkdownProjectionListener`, fires on
out-of-band writes when the `sub:bodyHash` stamp mismatches): the new body is already
committed, so `body_old` comes from **Memento** (the TimeGate's prior version — the
versioning substrate we already run). If no prior memento exists (resource predates
Memento, or version store unavailable): fall back to subtracting `f(body_current)`'s
*pair-shadow* (remove only quads matching subject+predicate pairs the new projection
emits — strictly narrower than today's predicate strip) **and emit a
`mem:DeriveClass` curation signal** naming the resource, so the lane sweeps any
residue. Degraded mode is narrower-than-today, never wider.

**Idempotency property:** projecting twice with the same body is a no-op
(`f(b) − f(b) ∪ f(b) = f(b)`); property-tested.

## 6. Projector-version drift

Within a projector version, subtraction is exact (recompute). Across versions,
`f_new(body_old)` may differ from what `f_old` actually wrote — recompute cannot be
exact because `f_old` no longer exists in the deployed code.

**Design (the lean, pending Chuck — §7):**
- **Stamp the projector version** in `.meta` alongside `sub:bodyHash` (e.g.
  `sub:projectorVersion "<pkg version or descriptor memento datetime>"` — the
  affordance descriptor is already Memento'd; D112's `hadPlan` pinning pattern reused).
  Cheap: one triple, written by the path that already stamps.
- **On version match:** exact subtraction as in §5.
- **On version mismatch:** this resource's `.meta` predates the current projector —
  do the §5 degraded subtraction + curation signal, then stamp the new version. The
  authoritative re-baseline for a whole Pod is the **migration sweep**: `make reset`
  in dev; for a live Pod, a walk that re-projects every markdown resource once per
  version bump (a `pod_audit`-style script, ~50 lines, runs the floor path with
  Memento-old bodies).

## 7. The knob — DECIDED (Chuck, 2026-06-12): version-stamp + migration sweep

**(i) Version-stamp + migration sweep** (CHOSEN): one extra triple per resource;
exact within version; explicit, auditable re-baseline at version bumps; drift is
*detected*, degraded handling is *flagged*.

**(ii) Projected-set inventory**: store the projection's full output inventory in
`.meta` itself (e.g. a canonical serialization or hash-list under a substrate
predicate). Exact under ALL conditions including version drift, no Memento dependency
— but roughly doubles `.meta` size, puts a machine blob in the agent-facing graph,
and re-introduces a derived artifact that can itself drift. Rejected in the lean for
cost and legibility; recorded as the fallback if version-drift handling proves noisy
in practice.

## 8. What gets built (sketch for the plan)

1. `projectionDelta.ts` (markdown-projection): `subtract(current, oldProjected)` +
   the pair-shadow fallback; pure functions, property-tested (idempotency, first-write,
   agent-survival, same-pair semantics).
2. `markdownBodyProjector` (floor path): read old body pre-overwrite; pass
   `f(body_old)` into the new `MetaWriter.replaceProjected(oldProjected, newProjected)`;
   delete `replaceGoverned`'s predicate strip + the F7 special case.
3. `MarkdownProjectionListener` (backstop): Memento old-body fetch; degraded mode +
   curation signal emission (reuse the mem-trigger event path).
4. Version stamp + mismatch handling + the migration-sweep script.
5. **D82 re-cut:** flip `test_agent_enrichment_survives_body_rewrite` from
   strict-xfail to expected-pass; decisions entry recording D82
   **resolved-by-dissolution** (sidecar unbuilt); ungate 🧷 (a) — the markdown-lane
   write contract (mem:rationale on wiki lanes at crystallization, D73 preserved).
6. **Probe lands with it (§12 discipline):** the enrichment round-trip — agent
   PATCHes (a) an ungoverned triple, (b) a governed predicate on a foreign subject,
   (c) a governed pair the floor owns (expect 422, the floor's job); body rewrite;
   (a)+(b) survive, projection stays current, idempotency holds live.

## 9. Out of scope, recorded

- Named-graph/TriG metadata backend (§3 spike; revisit only if a second consumer
  needs graph-partitioned `.meta`).
- The index-as-member design (independently validated by the wiki lineage —
  ByteRover `context.md` / gbrain `index.md`; revisit trigger is 🧷 (e)'s
  legibility probe, not this spec).
- Inverse/derived-edge re-materialization policy (D109 derive-rule scope).

## References

In-repo: the SP2 review fixes (`8b6e816`, F7); `docs/research/2026-06-12-solid-design-intent-harmonization.md`;
D81/D82/D95/D96/D108/D109/D112 (decision-lookup); the e5b-write + SP2 probe reports.
External (research pass 2026-06-12): LDP server-managed triples (w3.org/TR/ldp §2,
§4.2.4, §5.2.4); CSS metadata docs (graph-partitioned internals, protected metadata
409s); OBO/ROBOT release artefacts + `is_inferred` annotation; Graphiti/Zep bitemporal
edge invalidation; Web Annotation (assertions as separate resources); m-ld SU-Set;
Karpathy LLM-wiki layers / gbrain RESOLVER + index conventions / ByteRover context.md
/ AKBP rebuildable-cache doctrine; SMW separate property store; Universal Memory
Protocol v0.1 (universalmemoryprotocol.io/specification — record model §2, revise/
supersession §3, provenance-required-at-L2 write contract, conformance levels §7).
