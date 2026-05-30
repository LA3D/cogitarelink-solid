# SKOS Conceptual Backbone + Dual-View Enforcement — Decision (D108)

**Date:** 2026-05-30. **Status:** Decision recorded; implementation is a two-front program
(brainstorm → plan → build). **Gates:** RQ-View-2 cold-probe eval (must land before the eval
can fairly re-run — the eval is what surfaced this mismatch).

Origin: pulling the `skos:prefLabel`-not-enforced thread (from the RQ-View-2 Probe-A repeats,
2026-05-29) unravelled a structural finding — the entire wiki-memory L3 content corpus is
**unvalidated at write time** — which forced a decision about (a) what wiki-memory's conceptual
structure *is* and (b) where integrity enforcement lives in a dual document/graph-view substrate.

---

## 1. Decision summary

1. **SKOS is the conceptual backbone, for real.** `skos:broader`/`narrower`/`related` are the
   **navigation/content access axis** (consistent with D105/D106), not decoration. Concepts ARE
   a SKOS concept scheme; **pages/notes are memories that attach to that scheme** via typed edges.
2. **Three node-kinds, three label frames, by design** (matches the deployed shapes):
   - `<>` **Page** (a document/work) → `dct:title` (PageShape).
   - `<#this>` **Thing** (an entity) → `schema:name` (ThingShape).
   - `<#this>` **Concept** (a SKOS unit) → `skos:prefLabel` (+ `skos:altLabel` synonyms) (ConceptShape).
   `schema:name` and `skos:prefLabel` on a concept are **not redundant** — Thing-level entity name
   vs Concept-level canonical term (one-per-language, with alt/hidden siblings). See the property
   semantics in §3.
3. **`skos:prefLabel` is enforced on concepts** (`minCount 1`) AND **materialized** so the graph
   view can label SKOS-traversal results in-frame. Today it is materialized **nowhere**
   (corpus-wide `prefLabel`=0), so SKOS-frame label queries return empty — a half-thesaurus.
4. **Derive the inferable; reserve the guardrail for judgment.**
   - **Derive** (mechanically inferable interop labels, agent need not learn them): `rdfs:label`
     on every node (the apex — one "label of any node" query; also covers `schema:name`'s being
     *outside* the `rdfs:label` subproperty chain), plus `schema:name` (Thing-level interop).
   - **Reserve the write-time 422 for un-inferable metadata that requires agent judgment**:
     `skos:prefLabel` (the SKOS-frame act — **agent-authored via the write template, NOT silently
     substrate-derived**; silent derivation is *how the understanding got lost*), `dct:identifier`
     on a `wiki:Source` (a DOI/arXiv ID cannot be derived from a title), and choosing the right
     `skos:broader`.
5. **Enforcement architecture (corrects the root cause): container = gate, class = dispatch.**
   - **Container/path = the GATE**: which shapes apply, permissive-`working/`/strict-durable (D73),
     per-view minimums, and the **a-priori `Link: rel="constrainedBy"` discovery affordance** that
     hands the rules to the agent *before* it writes. This is the **human-curatable rule layer**.
   - **Class (`sh:targetClass`) = DISPATCH within the gate**: which shape fires on `<#this>` vs `<>`
     once inside a governed place, plus `targetClassCheck` as the untyped/mistyped **reject**.
   - **Load-bearing fix**: make projection **in-band / synchronous** so the validator validates the
     **projected graph** (the `.meta`), not the markdown body. Today projection is post-commit
     (D58/D71 MonitoringStore listener) and the validator validates the incoming markdown body —
     so it never sees the graph it must judge.
   - Keep contacts/WebID **as-is** (RDF-body + `constrainedBy` already works); the class-targeted
     graph-validation path **subsumes** the RDF-body case (the body *is* the graph there).
6. **Enforcement has TWO audiences — both first-class:**
   - **Runtime content-writing agent** (e.g. an RLM/Claude agent storing a memory) ← SHACL + `422`
     + `sh:agentInstruction` remediation. The 422 + `sh:ValidationReport` IS the teaching signal.
   - **Software-engineering / dev agent** (Claude Code building the substrate) ← **tests + CI that
     encode the frame model and the artifact-agreement contracts**, failing with **meaningful
     messages** when the substrate is rewritten without understanding it. A dev-agent that drops
     the conceptual model must get red tests, not silent green.
   The shape's `sh:agentInstruction` is the **shared teaching artifact** across both audiences and
   across delivery channels (entry-point agentGuide, skill, error message, test assertion).

---

## 2. Problem — the root cause this corrects (proven 2026-05-29/30)

Wiki-memory L3 content shapes are **never evaluated at write time**:
- The inherited upstream `ShaclValidator` fires only when the **parent container** declares
  `ldp:constrainedBy`; absent it, `canHandle` throws and `handleSafe` silently skips
  (`css/extensions/shape-validator/src/storage/validators/ShaclValidator.ts:66-79,166-177`).
- **No `/vault/wiki/` container declares `constrainedBy`** (verified live; only
  `/vault/contacts/{Person,Group,Organization,Membership}/` + `/vault/profile/card` do).
- Even if wired, the validator validates the **incoming body** → wiki bodies are **markdown**
  (no RDF); `targetClassCheck` would *reject* a markdown body. The RDF lives in the **projected
  `.meta`**, which is **explicitly exempt** (auxiliary-file check) and skipped by the path-constraint.
- Projection is **post-commit**. Controlled experiment: a minimal markdown concept with no
  `prefLabel` → `201`, projected `a skos:Concept`, ConceptShape violated, accepted.

Consequence: every content shape (Page/Thing/Concept/Source/Person) is **deployed, cataloged,
advertised — and inert** for the markdown corpus. The D104 "self-validating substrate" property
held only for the RDF-body substrates (contacts/WebID). On the **query side**, `prefLabel` is
materialized nowhere, so SKOS-frame traversal (`?c skos:broader ?b . ?b skos:prefLabel ?l`)
returns no labels corpus-wide, and the traversal frontier is sparse (forward-reference targets
have no `.meta`, D106).

---

## 3. Property semantics (the frame, for the record)

- `rdfs:label` (RDF Schema): generic display string for any resource; apex; `skos:prefLabel` ⊑
  `rdfs:label`. Use for the universal "label of any node" query.
- `skos:prefLabel` (SKOS): the **canonical preferred term of a *concept* in a KOS**, ≤1 per
  language (S14), with `altLabel`/`hiddenLabel` siblings (pairwise disjoint, S13). Carries the
  terminology-management commitment. **Coherent with the concept's other predicates** (`broader`/
  `related`/`cito:*`) — a concept labelled only by `schema:name` mixes frames.
- `schema:name` (schema.org): the **name of an entity/Thing**; web-data/discoverability frame.
  **Not** officially `⊑ rdfs:label` (the gotcha — emit `rdfs:label` explicitly for uniform read).
- `dct:title` (Dublin Core): the **title of a resource/document/work**; bibliographic frame.

For an agent: read-side, fall back `rdfs:label → prefLabel → schema:name → dct:title`; write-side
they are **not** interchangeable — the choice declares the node's ontological frame.

---

## 4. Why the meta-lesson matters

It took deliberate reverse-engineering (code + live `.meta`) to reconstruct this frame model.
**That reconstruction cost is exactly the cost every cold agent pays — and mostly fails to pay.**
That is *why* the corpus drifted (prefLabel never materialized, shapes silently inert, sessions
"agreed" the substrate self-validated when it didn't). The fix principle:

> **The conceptual model must be canonical and cheap-to-acquire — not reconstructable-with-effort.**
> Single-source the model; reference it from every delivery channel (entry-point `sub:agentGuide`,
> shape `sh:agentInstruction`, skills (D103), the 422 correction message, and the dev-side tests).
> Never re-explain it differently per channel — that divergence is how it drifted.

The enforcement layer (shapes/422) and the explanation layer (agentGuide/skills) are **two faces
of one artifact**. So is the dev-side test layer.

---

## 5. The two-front program

- **Front 1 — Agentic harness / making the model legible.** One canonical "how wiki-memory works"
  model (Page/Thing/Concept ↔ `<>`/`<#this>` ↔ label frames; SKOS-as-navigation; write recipe;
  validation contract per D81; **correction protocol** — what a 422 means + how to fix), delivered
  where agents look and single-sourced. (Brainstorm this first — highest leverage, lowest cost; it
  sharpens what each shape's `sh:agentInstruction` must say before the plumbing is built.)
- **Front 2 — Memory guardrails + dual-graph structure.** In-band synchronous projection;
  container=gate/class=dispatch enforcement; `constrainedBy` on durable wiki containers,
  `working/` permissive (D73); uniform `rdfs:label` + frame-specific labels materialized;
  `prefLabel` enforced (agent-authored); reserve 422 for judgment metadata; **dev-side tests/CI
  encoding the frame model + agreement contracts** (the symbolic guardrail for the building agent).

Coupled via the shared `sh:agentInstruction`/correction artifact.

---

## 6. Sequencing

This **gates RQ-View-2.** The cold-probe eval (D107 §5) is what surfaced the conceptual mismatch;
re-running it before the conceptual structure + enforcement is right would measure a moving,
broken target. Get D108 working → then resume the dual-view cold-probe eval. The deterministic
round-trip is already green; the behavioral probes wait on this.

---

## 7. Scope + open question

- **Resolved this session:** SKOS-as-backbone; three-frame label model; `prefLabel` enforced +
  agent-authored (not silently derived); derive-inferable-vs-guardrail-judgment principle;
  container=gate/class=dispatch; in-band projection as the load-bearing fix; two enforcement
  audiences (runtime SHACL+422, dev-agent tests).
- **RQ-Enforce-1 (open):** *how* to make projection in-band/synchronous without breaking the
  post-commit MonitoringStore architecture (D58/D71) — options: project-then-validate inside the
  validator (`ShapeValidationStore`), a synchronous pre-commit transform, or a PassthroughStore
  that runs the projection pipeline and validates before delegating. Resolve in Front-2 design.
- **Still deferred:** the full view layer (one entity, multiple *writable* views — D107 §6); this
  decision builds the single-view (document→graph) enforcement that the view layer generalizes.

## 8. Relationship to prior decisions

- **Refines D78** — class-targeting is a *dispatch/discovery* axis, **not** an enforcement key
  (raw SHACL target semantics pass untyped data; `targetClassCheck` is the bespoke reject-gate).
- **Realizes D96** — the Page/Thing governance split's *enforcement* intent (PageShape on `<>`,
  Thing-shapes on `<#this>`) without the two-N3-patch ceremony; projection builds both subjects.
- **Corrects D104** — "self-validating substrate" held only for RDF-body substrates; D108 makes it
  true for the markdown profile.
- **Confirms D73** — permissive-`working/`/strict-durable is inherently **container-keyed**.
- **Builds on D98/D105/D106** — SKOS backbone; the two-hierarchy addressing/navigation split.
- **Honors D81** — governed-predicate model (`sh:closed false`; agent owns the rest).
- **Gates D107/RQ-View-2** — the dual-view cold-probe eval.
