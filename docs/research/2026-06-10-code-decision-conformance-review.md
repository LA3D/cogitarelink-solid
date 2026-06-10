# Code ↔ Decision Conformance Review

**Status:** complete 2026-06-10. Companion to the decision sanity check
(`2026-06-09-decision-record-sanity-check.md`) — that doc triaged decisions against
*behavioral* evidence; this one checks the *code* against what the decisions claim.
Method: four parallel review agents over the extension clusters, each verifying
specific decision claims with file:line evidence, plus a live `make test-js` run.
Pod was down; live-HTTP claims not re-verified (noted where relevant).

## 1. Headline

The substrate code is **substantially commensurate with the decision record** — 30+
specific decision claims verified conformant across memento (D61–D68), id-catalog
(D111), ops-index/profile-link (D112/D86, incl. no `Content-Profile` ever emitted),
mem-trigger (D74/D101), shape-validator (D108/D78/D99), view-layer (D113-kept/D114 —
trailer fully removed, fused substrate-wide + content-type-agnostic, declared queries
fetched from artifact files not inlined), wiki-search (D92), markdown-render (D75/K4),
overlay machinery (D87/D88/D113), and `void-description.json` (D44 + cut-A disposition
literal + D114 view-authority pointer). The D114 removals are clean — no dead trailer
or marker-guard code remains.

The drift that exists clusters in three places: **decision text describing mechanisms
the code implements differently (intent intact), bootstrap machinery
(parameterization/seeds/deployment gaps), and the test suite's freshness contract.**
Nothing found contradicts an architectural commitment.

## 2. Drift findings (code side)

### 2.1 Mechanism drift — decision text stale, intent conformant

- **D95/D96 "two N3 Patch envelopes":** projection actually does a subject-scoped
  Store merge (`metaWriter.ts:48-72` `replaceGoverned()` — filter governed predicates
  per subject, merge, write). The *intent* (disjoint `<>`/`<#this>` governed sets;
  agent-owned triples survive) is implemented and tested; the *mechanism* in the
  decision text is not. `buildTwoSubjectPatch()` exists but is never called — dead
  code to remove or annotate.
- **D106 "interim HINT_TO_CONTAINER retained":** better than decided — no role→container
  table exists at all; routing is predicate→class→Type Index
  (`wikilinkProjection.ts targetContainer()`), i.e. the full fix shipped and the
  decision's interim caveat is stale.
- **D81/D104/D108 "shapes are the source of truth for governance":** governed-predicate
  sets are hardcoded TS maps (`governedPredicates.ts:39-161`), with **no SHACL shape
  consultation**. Two sources that can diverge; partially mitigated by the
  fragility-audit agreement tests, but the decision claim and the code disagree about
  where authority lives. Either derive the sets from `shapes/` at build time (one
  source) or annotate the decisions to say the TS maps are authoritative and the
  shapes mirror them (and keep the agreement tests as the contract).

### 2.2 Bootstrap/deployment drift — real gaps

- **D107 storage-root parameterization incomplete:** extensions are parameterized
  (`storagePath` injected, defaults documented), but `scripts/pod_setup.py` hardcodes
  `/vault/` (lines 19, 62, 72, 81–84), `apply.py` hardcodes `/vault/meta/views/`
  (line 159), and the wiki-memory manifest mixes relative paths with absolute
  `https://pod.vardeman.me/...` IRIs for the D113 view entries (manifest lines
  119–127) — overlays are pod-URL-dependent where they shouldn't be. Vocabulary
  namespace IRIs hardcoding `pod.vardeman.me` in TS constants
  (`governedPredicates.ts:29`, `types.ts:4-5`, `spanLiteralProjection.ts:15`,
  `parseProposal.ts:4,14`) are defensible under D84 (the Pod *is* the namespace
  authority — they identify schema, not deployment) but mean a fork edits code;
  worth one config-injection pass when D107 is next touched.
- **D98/D109 stale seeds still live:** the hand-seeded `skos:narrower`/`broader`
  inverses flagged by RQ-View-2 are still in the bootstrap exemplars
  (`overlays/wiki-memory/concepts/{biology,photosynthesis}.md.meta.ttl:19`). Violates
  the derive-rule; known-stale; remove or derive.
- **D23/D109 ontology-cache deployment gap:** the `ontology/` cache exists repo-side
  with the README policy, but **no machinery deploys it to the Pod** — D23 claims a
  Pod-resident TBox cache, and D49's dereference-or-ground policy is only half-true
  if the ground copies aren't served. The Layer-0/index-view design should decide
  whether the cache becomes Pod-resident or D23 is annotated repo-only.

### 2.3 Test-suite freshness — the "honestly green" claim is currently false

`make test-js` was **red** on this checkout, two distinct causes:

1. **Stale local build artifacts (env, fixed):** markdown-projection's
   `MarkdownBodyProjector` test failed (`loadRoutingMap is not a function`) because
   the CJS mirror dynamically imports the *built* ESM at `dist/`, which was stale.
   `npm run build` fixed it; wiki-search's config-guard entry likewise cleared after
   rebuild. Root issue: `make test-js` has no build dependency, so tests can silently
   run against stale `dist/` — the runtime-import architecture (CJS mirror → built
   ESM) makes the suite build-freshness-sensitive in a way the Makefile doesn't encode.
2. **configGuard failure, NOT fixed by rebuild (open):** shape-validator's
   `configGuard.test.ts` flags `css/config/memento.json` with
   `Invalid predicate IRI: baseUrl`, persisting after regenerating memento's
   components AND with the pre-D113 config (bisected) — so it's neither the D113
   config edit nor simple staleness. All three Memento classes declare `baseUrl` in
   the regenerated `context.jsonld` scoped contexts (verified), and the live server
   demonstrably boots this config (D114 `make reset` 13/13 on 2026-06-07), so this is
   a **guard-vs-boot resolution divergence**, not a production bug — but it means the
   guard can't currently do its job (catching the 3×-boot class) and the suite is red.
   Needs root-cause: likely the guard's replicated `ModuleStateBuilder` state diverges
   from boot's for the memento module specifically. Filed in FOLLOWUPS.

## 3. Decision-internal contradictions (beyond the 2026-06-09 experiments)

From the full corpus read — supersessions-in-effect that are unmarked, for the
distillation's annotation pass:

- **D31 vs D109:** "`.meta` sidecars as source of truth" is superseded in effect by
  layer-partitioned co-equal authority. Unmarked.
- **D3/D29 vs D113:** "SPARQL is a client concern; the Pod hosts no engine" silently
  narrowed to "no SPARQL *HTTP endpoint*" — the ViewAssembler runs embedded Comunica
  server-side. The narrowing is sound (and the PD-audit index views will widen
  server-side execution further); the principle text should say what it now means.
- **D72 vs D80:** compile-once ("substrate maintains compiled state") vs
  derive-on-demand ("no materialization") have no stated decision rule; the index-view
  design needs one (materialized vs virtual is exactly this question).
- **D91 vs the queued MCP gateway:** "no MCP — zero capability gain" was correct on
  the capability axis; the consumption-leak finding justifies MCP on a different axis
  (forced consumption/disposition). Needs a formal amendment when the MCP decision
  is minted (companion to the D33 scope amendment).
- **D17/D21/D24/D12/D15 vestigials:** TRS-era machinery (D17 superseded by D56) is
  still referenced by D21 (`digestMultibase` re-computed "on TRS events" —
  implementation never verified to exist); D24 SSSOM, D12 CoreProfile conformance,
  D15 VoID feature flags appear unimplemented/superseded-in-effect. Annotate as
  vestigial rather than active in the distillation (verify D21 before annotating).
- **D54 vs D112:** "procedural algorithm lives at the agent" vs curation equipment as
  Pod state — the boundary moved; annotate.
- **Vault-D vs repo-D numbering** divergence — reconcile during the distillation pass.

None of these is a live contradiction in behavior — each is the supersession chain
lagging the build, which is exactly what the status-annotation pass is for.

## 4. What this changes

- **The distillation plan is reinforced:** the dominant drift mode is "decision text
  describes a mechanism; code implements the intent differently." Distill *principles*
  (stable) and annotate *mechanisms* (drift-prone) rather than treating decision prose
  as ground truth.
- **Three concrete fix items** (FOLLOWUPS): configGuard divergence root-cause;
  `make test-js` build-freshness dependency; stale seed inverses + governed-set
  source-of-truth choice + bootstrap parameterization batched for the next
  substrate-touch session.
- **No architectural correction needed** — nothing found contradicts the validated
  keep-list, and the D114 removals were verified clean.
