# Shape-governance reconciliation + write-contract substrate — design

**Date:** 2026-06-17
**Status:** SHIPPED for the wiki lane + MERGED to `main` (2026-06-18, merge `6510e2a`; D117).
Tasks 1–6, 8, 10, 11, 12 done; **Tasks 7/9 (RDF-native lanes) DEFERRED** — addressbook is now
DE-CONFLATED (see the appended note below); id-schemes still enforces via its own per-app
`mem:rationale` shape (the derivation writes `constrainedBy` for the wiki lane only; the RDF-native
ShapeTrees diverge from the deployed layout). So the
"big-bang across all three lanes" goal below holds for the **wiki lane only** as shipped; the
RDF-native unification is the remaining work (FOLLOWUPS 🔵). Multiple-`st:shape` union cold-agent
validated (Task 11; `docs/plans/2026-06-17-write-contract-probe-report.md`).
**Addressbook de-conflation (2026-06-18) supersedes this spec's Task 7/9 framing.** The goal of
"remove per-app `mem:rationale` duplication so the injected `sub:WriteContractShape` supplies it"
is **corrected**: `mem:rationale` is **removed** from the addressbook shapes entirely — the write
contract is a memory-substrate invariant, not Pod-wide, so it does not belong on vCard operational
data. The addressbook ShapeTree↔layout reconciliation becomes a vcard-domain-only interop fix. See
`docs/superpowers/specs/2026-06-18-pod-memory-systems-architecture-design.md`.
**Relates to:** D96 (Page+Thing split), D81 (predicate-level governance Model A), D98/D108
(container=gate / class=dispatch; in-band floor), D109/D110 (interop adoption; SAI vocab-now /
runtime-deferred), D116 (PSP). Supersedes the per-app write-contract duplication shipped in SP2.
**Grounding:** `docs/research/2026-06-12-solid-design-intent-harmonization.md`.
**Blocks/feeds:** the paused `markdown-lane-write-contract` branch, which redoes as the agentic
*test* of this reconciliation.

## Why

The Pod has **three parallel, hand-maintained declarations of "which SHACL shape governs this
container," only one of which is enforced**, and nothing tests that they agree:

| Route | Declares | Enforced? |
|---|---|---|
| `ldp:constrainedBy` on the container `.meta` (D108) | the shape set the floor loads | ✅ floor |
| ShapeTree `st:shape` / `st:contains` (SAI / `wiki-memory.tree.ttl` etc.) | container → shape, app-portable | ❌ inert (no ST runtime) |
| `governedPredicates.ts` (projection) | per-subject (page `<>` / thing `<#this>`) governed predicates | ✅ projection |

On top of that, the **agentic write contract** (`mem:rationale` MUST accompany every durable
write — the L2 invariant, "the defining agentic-vs-Solid difference," = Verborgh's trust-envelope
construct side) is implemented by **copy-pasting the same `sh:property` block into every app's
shapes** (`contact-card`, `scheme-record` ×2, and the attempted 7 wiki shapes), built on a `mem:`
vocabulary that itself lives *inside* the wiki-memory application overlay.

The paused markdown-lane branch tripped on exactly this fragmentation: the projection rebinds
frontmatter to `<>` while the requirement was placed on the `<#this>` Thing shapes, and the floor
only loads the leaf Thing shapes (PageShape is in *no* durable container's `constrainedBy`), so
`<>` governance is unenforced. The bug was a *symptom* of the three routes drifting.

These are experimental prototypes for learning the neurosymbolic / linked-data approach to
distributed agentic memory; nothing depends on them. So the goal is a **uniform end-state across
all three lanes**, not incremental caution — making all lanes pass through one mechanism is itself
the test of whether the abstraction generalizes (dual-subject markdown lane vs single-subject
RDF-native lanes).

## Decisions (settled forks)

1. **ShapeTrees are the source of truth** — the **declaration-only subset** (`st:shape`→SHACL,
   `st:contains` hierarchy, `st:Manager`/`st:Assignment`; **no** plant/Manager runtime, per
   harmonization-doc delta #2 — nobody ships it; the D108 floor is the enforcement). This is the
   endpoint, not a stepping stone: **Option-2 runtime ST enforcement is off the table.**
2. **Derive the two enforcement artifacts from the ShapeTrees + the shapes they bind**, at
   build/seed time, guarded by tests: `ldp:constrainedBy` (generated, no longer hand-authored) and
   `governedPredicates` (**codegen from the shapes** so it cannot drift).
3. **The write contract is one substrate shape, injected by the derivation.** A single
   `sub:WriteContractShape` (requires `mem:rationale`) is **unioned into every durable container's
   derived `constrainedBy`** — apps no longer declare it. (Factoring option (i): apps declare only
   their leaf shapes; the substrate injects the universal contract.)
4. **`foaf:Document` on `<>` is the universal targeting hook.** The write-provenance subject is the
   resource *document* `<>` in every lane (this resolves the Page-vs-Thing question: `<>` / Page,
   D96-faithful — and needs **no `rebindSubject` change** since frontmatter already lands on `<>`).
   `sub:WriteContractShape sh:targetClass foaf:Document` requires `mem:rationale` on `<>`.
5. **Proto-knowledge:** keep `mem:rationale` (cold-probe-validated; its laden 422 `sh:message`
   teaches its own purpose) and use a **proto-known standard class** as the hook rather than a
   bespoke marker — `foaf:Document` (`owl:equivalentClass schema:CreativeWork`, so recognized
   across FOAF *and* schema.org training corpora; already deployed on `<>` in id-schemes). The
   class is only a legible *targeting hook*; the contract's *purpose* rides on the laden message.
6. **Big-bang scope across all three lanes** (prototypes; no dependants).

## Architecture — the layering

The two specs are **stratified, not rival**: SAI ShapeTrees *describe* (app-portable, interop-
facing) and sit on top of LDP, whose `ldp:constrainedBy` is the server-facing *enforcement* hook.
Deriving `constrainedBy` from the ShapeTree applies this codebase's signature dual-layer pattern
(author-high → project-to-enforceable) **recursively, to governance itself** — ShapeTree =
authoring/interop view of governance; `constrainedBy` = its projection.

```
App layer (per overlay):  ShapeTree (declaration-only)  +  leaf shapes
   tree:  st:contains → ResourceTree(s); ResourceTree st:shape → leaf SHACL shape(s)
                       │
   ┌───────────────────┴─────────────────────────────────────────────┐
   │  build/seed-time derivation  (scripts/overlay/ + a codegen step) │
   │     constrainedBy(container) = ⋃ st:shape(trees under it)         │
   │                              ∪ { sub:WriteContractShape }   ←  universal injection
   │     governedPredicates       = codegen from the bound shapes      │
   └───────────────────┬─────────────────────────────────────────────┘
                       ▼
Substrate layer:  D108 floor enforces ldp:constrainedBy   (unchanged)
                  agreement/codegen tests guard both derivations
                  sub:WriteContractShape + foaf:Document hook + relocated mem: (L2) live here
```

**Boundary:** the app declares *its* shapes + tree (its content governance); the substrate owns
the derivation, the universal contract, the floor, and the relocated `mem:` vocab. This is the
agentic-app-construction principle — "the code is substrate machinery; the app expresses itself in
Turtle" — with the ShapeTree as that Turtle.

## The cross-lane unification (`foaf:Document` on `<>`)

The write contract attaches to the **document subject `<>`** uniformly. Current state vs target:

| Lane | Today: rationale subject | Target |
|---|---|---|
| id-schemes | `<>` typed `foaf:Document` | unchanged ✅ |
| wiki-memory | (was placed on `<#this>` — the bug) | **`<>`**: emit `<> a foaf:Document` (via `wiki:Page rdfs:subClassOf foaf:Document` + floor subclass expansion) |
| addressbook | `<#this>` (`vcard:Individual`) — the outlier | **realign to `<>`**: type the contact document `<> a foaf:Document`, move `mem:rationale` there |

`mem:rationale` on `<>` is the sibling of the other write-lifecycle metadata
(`dct:created/modified`, `wiki:maturity`, `prov:wasGeneratedBy`) that D96 already governs on the
Page. The floor's existing **`rdfs:subClassOf` closure expansion** (shipped 2026-05-23,
`subClassClosure.ts`) means a wiki `<> a wiki:Page` matches a `foaf:Document` target without
emitting a second type — but to keep the floor inference-free we emit `foaf:Document` explicitly on
`<>` in the projection/templates and *also* carry the subclass axiom for agent proto-knowledge.

## Components

| Unit | Change |
|---|---|
| `shapes/substrate/write-contract.shacl.ttl` (**new**) | `sub:WriteContractShape a sh:NodeShape ; sh:targetClass foaf:Document ; sh:property [ sh:path mem:rationale ; sh:minCount 1 ; sh:datatype xsd:string ; sh:message <…> ]` + a laden `sh:agentInstruction`. Reuse the **already-validated** message wording shipped on `contact-card`/`scheme-record` ("mem:rationale is required — record the task that triggered this write, what you concluded, and why, including what you consulted. Do not merely restate the record's name; a future agent audits this context before trusting it."). The single source of the contract. |
| Substrate `mem:` vocab (**relocate**) | Move the **L2 write-contract slice** of `overlays/wiki-memory/ontology/mem.ttl` (`mem:rationale` at minimum) to a substrate-hosted vocab (e.g. `ontology/` / `shapes/substrate/` companion), deployed at its existing `/vault/ontology/mem#` IRI (already Pod-general — only the source-tree location moves). Lifecycle actions (`mem:CrystallizeAction`, `mem:RealignAction`) that are genuinely wiki-L3 may stay; split documented in the vocab README. |
| App ShapeTrees (`overlays/*/shapetrees/*.tree.ttl`) | wiki ResourceTrees gain **multiple `st:shape` values** — the full dual-layer set `{wiki:PageShape (governs `<>`), wiki:ThingShape (common `<#this>` predicates), <leaf> (e.g. wiki:ConceptShape)}`; RDF-native trees keep their single `st:shape`. None declare the write contract (the derivation injects it). This is also what finally brings PageShape + ThingShape into the floored gate (closing the audit's "`<>` ungoverned" finding). |
| `scripts/overlay/apply.py` + `common.py` | Replace hand-authored container `constrainedBy` with a **derivation**: parse the overlay's ShapeTree (`st:Manager` → assignment → `st:contains` → `st:shape` set), union `sub:WriteContractShape`, PATCH each durable container's `.meta` with the computed `constrainedBy`. |
| `governedPredicates.ts` (**becomes generated**) | A codegen step reads the bound SHACL shapes (their `sh:targetClass` → page/thing axis + `sh:path` set) and emits `PAGE_GOVERNED_PREDICATES` / per-class `THING_GOVERNED_PREDICATES`. `mem:rationale` lands in the **PAGE** set (it's on `<>`). |
| Per-app leaf shapes | **Remove** the duplicated `mem:rationale` `sh:property` from `contact-card`, `organization-card`, `scheme-record` (×2), and do **not** add it to the 7 wiki shapes (the markdown-lane branch's `d84e583` is dropped in the redo). The contract now comes only from the injected `sub:WriteContractShape`. |
| Projection (`frontmatterProjection.ts` / `projectionPipeline.ts`) | Emit `<> a foaf:Document` on the Page subject (substrate invariant). Keep the markdown-lane branch's `rationale:`→`mem:rationale` frontmatter projection (commit `477e52b`) — it already lands on `<>` (no `rebindSubject` change). |
| Seeds + templates | wiki seeds keep their `rationale:` frontmatter (branch `4130060`); contact/scheme templates carry `mem:rationale` on `<>` + `foaf:Document`; addressbook seeds realigned. |
| Tests | codegen agreement tests; per-lane floor integration; an **agentic probe** for the multiple-`st:shape` wiki path; `make reset` green; `make audit` 0 ERROR. |

## Data flow

**Build/seed (derivation):** `apply.py` deploys an overlay → reads its ShapeTree → for each managed
durable container computes `constrainedBy = ⋃ st:shape(contained ResourceTrees) ∪ {WriteContractShape}`
→ PATCHes the container `.meta`. A separate codegen target regenerates `governedPredicates.ts` from
the deployed shapes. Agreement tests assert deployed `constrainedBy` == derived, and
`governedPredicates.ts` == codegen output (fail the build on drift).

**Write (enforcement, unchanged D108):** agent PUTs a body → floor projects body→`.meta` (markdown
lane) or takes the RDF body (RDF-native lanes) → loads the container's (derived) `constrainedBy`
shape set → `sh:targetClass` dispatch fires each shape on its subject: `foaf:Document`→
`WriteContractShape` on `<>`; `wiki:Page`→`PageShape` on `<>`; `skos:Concept`→`ConceptShape` on
`<#this>`; etc. Missing `mem:rationale` on `<>` → 422 with the laden `WriteContractShape`
`sh:message`. PSP (D116) keeps agent `.meta` enrichment across rewrites; `mem:rationale` is
body-projected (frontmatter) so it survives by re-projection.

## Multiple `st:shape` on the wiki ResourceTree

`st:shape` is one-per-tree in the ST algorithm we don't run, but `st:shape` is a plain
`owl:ObjectProperty` (open range) — so a ResourceTree may carry **several** `st:shape` values, and
our derivation simply unions them into `constrainedBy`. wiki `ConceptResourceTree` →
`{wiki:PageShape, wiki:ThingShape, wiki:ConceptShape}`; RDF-native trees keep one. **Flagged for
agentic verification** (a cold-agent wiki write must validate against the full
Page+contract+leaf set, first try) — this is the part of the generalization least covered by prior
probes.

## `governedPredicates` codegen

Read each deployed shape: a shape whose `sh:targetClass` is the page axis (`wiki:Page` /
`foaf:Document`) contributes its `sh:path`s to `PAGE_GOVERNED_PREDICATES`; a Thing-axis shape
(`schema:Thing` subclasses) contributes to the per-class `THING_GOVERNED_PREDICATES`. `mem:rationale`
(on `WriteContractShape`, page axis) → PAGE set. The generated file carries a "DO NOT EDIT —
generated from shapes" header; the agreement test re-runs codegen and diffs.

## Error handling

- **Missing `mem:rationale`:** laden 422 (`WriteContractShape` message), source not committed,
  agent retries. Threat model is cooperative-but-lazy — the message names the anti-pattern; the
  SHACL stays shallow (non-emptiness + datatype), no semantic-quality gate.
- **Drift:** the agreement/codegen tests fail CI when a hand-edit to `constrainedBy` /
  `governedPredicates.ts` diverges from the ShapeTree-derived truth.
- **Floor inference:** `foaf:Document` is emitted explicitly on `<>` so enforcement needs no
  reasoner; the `wiki:Page ⊑ foaf:Document` axiom is for agent proto-knowledge, not the floor.

## Testing

1. **Codegen agreement** (no Pod): `constrainedBy` derived == deployed; `governedPredicates.ts` ==
   regenerated. One per app.
2. **Per-lane floor integration** (Pod up, `make reset`): for wiki / contacts / id-schemes — a
   durable write **without** `mem:rationale` → laden 422; **with** → 201 + `mem:rationale` on `<>`
   in `.meta`. Working/ stays permissive (D73).
3. **Agentic probe** (`evals/`): a cold agent performs a wiki crystallize and the write validates
   against the multiple-`st:shape` set first try (verifies the dual-layer union end-to-end).
4. **Regression:** `make reset` green (all seeds admit under the injected contract); `make audit`
   0 ERROR; `make test-js`; the existing Turtle-lane contract tests pass after de-duplication.

## Scope / phasing (within the big bang)

1. Substrate `WriteContractShape` + `foaf:Document` hook + `mem:` relocation.
2. ShapeTree → `constrainedBy` derivation in `apply.py` + agreement test (wiki first, then
   contacts + id-schemes).
3. `governedPredicates` codegen + agreement test.
4. Projection emits `foaf:Document` on `<>`; de-duplicate the per-app `mem:rationale`.
5. Wire all three lanes through it; seeds/templates realigned (addressbook off `<#this>`).
6. `make reset` + audit + per-lane integration green.

**Immediately after:** the markdown-lane branch redoes as the **agentic test** — it keeps its
projection (`477e52b`) + seeds (`4130060`) + crystallize affordance (`683c072`), **drops** the
7-shape edits (`d84e583`, replaced by the injected `WriteContractShape`), and adds the cold-agent
probe.

## Out of scope (YAGNI)

- ST runtime (plant/unplant/`st:Manager` interception/`st:references` enforcement) — nobody ships
  it; the floor is the enforcement (harmonization delta #2).
- `prov:agent` / authenticated-WebID derivation — gated on the security profile.
- LWS Protocol 1.0 conformance migration — named as the eventual target, no action here.
- A queryable "agentic record" class beyond the `foaf:Document` hook — no consumer yet.

## Open questions

- **Multiple-`st:shape` union** is the one mechanism not covered by prior probes; the agentic probe
  (testing item 3) is the gate. If a cold agent can't satisfy the unioned set first try, reconsider
  surfacing the dual-layer set (e.g. a composed shape pointed at by one `st:shape`) — but the
  default is multiple `st:shape` values unioned by the derivation.
