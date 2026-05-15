# D82 Listener Extension Plan — Inline JSON-LD Block Projection

**Surfaced**: 2026-05-15 evening (after H-D82 hypothesis specified)
**Status**: **Conditional plan** — implementation gated on (1) RQ-Listener-1 resolution AND (2) Rung 1.5 eval supporting H-D82.b (T-jsonld > T-class)
**Relates to**: H-D82 (hypothesis pending eval), D81 (Model A), D71, D58, RQ-Listener-1, RQ-Affordance-2/3/4
**Sibling docs**: `2026-05-15-akbp-to-w3c-mapping.md`, `2026-05-15-rq-listener-1-mitigation-design.md`, `2026-05-15-rung-1-5-eval-matrix.md`, [[Affordance Spectrum for Agentic Memory]] in vault

---

## Goal

**IF Rung 1.5 eval supports H-D82.b** (T-jsonld > T-class), extend the `MarkdownProjectionListener` to extract inline `json-ld` fenced code blocks from the markdown body and merge their triples into `.meta`, alongside the existing class-hint wikilink projection. This adds the **level-4 affordance** (in-band rich claims with confidence/evidence/supersession) hypothesized by H-D82.

**Not in scope**: implementation. This document specifies the design **so that implementation is unblocked if the hypothesis is supported**. The design exists pre-eval to ensure the eval can meaningfully test H-D82 (you can't test "is inline JSON-LD better" without knowing what inline JSON-LD looks like).

**If Rung 1.5 eval refutes H-D82.b** (T-class ≥ T-jsonld), this plan becomes a documented "design we considered but eval didn't support" artifact. No implementation work.

---

## Current state (Rung 1.4 close)

The `MarkdownProjectionListener` lives in `css/extensions/markdown-projection/` with this pipeline:

```
body PUT/PATCH event (CSS MonitoringStore)
  → projectionPipeline.ts (orchestrator)
    → wikilinkProjection.ts (extract [[Note]]{.class}, map class → predicate)
    → frontmatterProjection.ts (extract typed YAML keys)
    → governedPredicates.ts (D81 Model A: which predicates substrate owns)
    → metaWriter.ts (file-lock-protected .meta replacement)
```

D81 Model A governance: for each resource, the substrate owns a *governed predicate set*; on body write, it DELETEs all governed-predicate triples and INSERTs the freshly projected ones; non-governed (agent-added) triples are preserved.

The pipeline only sees:
- Body wikilinks `[[Note]]{.class}` (level 2)
- Frontmatter YAML keys (also level 2-ish, parallel surface)

It does NOT see:
- Inline JSON-LD code blocks (the level 4 affordance D82 introduces)
- Inline DOT-LD `::rel` blocks (out of scope; D82 prefers JSON-LD)

---

## Proposed extension

Add a third extractor, `jsonldProjection.ts`, parallel to the wikilink and frontmatter projections:

```
body PUT/PATCH event
  → projectionPipeline.ts (orchestrator)
    → wikilinkProjection.ts (extract [[Note]]{.class})
    → frontmatterProjection.ts (extract typed YAML keys)
    → jsonldProjection.ts (NEW — extract ```json-ld ... ``` blocks)
    → governedPredicates.ts (D81 Model A — extended set, see below)
    → metaWriter.ts (file-lock-protected .meta replacement)
```

### Parser change

Use the existing markdown parser (already pulling unified/remark for markdown-render) to identify fenced code blocks with `lang === 'json-ld'`. For each block:

1. Parse the JSON content (standard `JSON.parse`).
2. Resolve `@context` — fetch from `/meta/context.jsonld` if relative, or use embedded if inline.
3. Expand to RDF triples via a JSON-LD processor (`jsonld.js` in TypeScript).
4. Emit triples to the projection pipeline.

### Class-hint vs JSON-LD interaction

When the body contains BOTH affordances for the same edge:

```markdown
A context graph extends [[Knowledge Graphs]]{.extends}.

\`\`\`json-ld
{
  "@context": "/meta/context.jsonld",
  "@id": "context-graphs",
  "wiki:extends": "knowledge-graphs",
  "cred:credibility": 0.85
}
\`\`\`
```

The wikilink projects `<context-graphs> skos:related <knowledge-graphs>` (or whatever `.extends` maps to in `wikilinkProjection.ts:HINT_TO_PREDICATE`). The JSON-LD also projects `<context-graphs> wiki:extends <knowledge-graphs>` PLUS `<context-graphs> cred:credibility "0.85"^^xsd:decimal`.

This is **RQ-Affordance-3**: should the listener canonicalize to a single edge, or preserve both? **Proposed v1 behavior**: preserve both. The wikilink-extracted triple is its own atomic edge in the substrate-governed set; the JSON-LD-extracted triples are additional substrate-governed annotations on the same resource. The two predicates may not be identical (`.extends` → `skos:related` vs `wiki:extends`) — keeping both surfaces the authoring choice.

Rationale: the agent may have authoring intent (use `{.class}` for cheap nav, use JSON-LD for the rich claim). Forcing canonicalization erases that intent.

### Subject restriction (D81 Model A interaction)

D81 Model A invariant: substrate owns triples where (subject = this resource) AND (predicate ∈ governed-set).

JSON-LD `@graph` can express triples with arbitrary subjects. This is **RQ-Affordance-4**.

**Proposed v1 behavior**: the listener only extracts triples where `@id` (after JSON-LD expansion) matches the current resource URI. Triples about other subjects are *logged but not projected*. Rationale:

- Preserves D81's clean governance story (substrate doesn't have to resolve "who said this" for cross-subject triples)
- Doesn't force the reification problem D81 deliberately sidestepped
- Agents who need cross-subject assertions can use direct N3 PATCH (level 6) on the target resource's `.meta`, where the subject is local

The trade-off: agents lose the ability to do "while writing X, also assert about Y" in-band. They must either (a) write X first then PATCH Y separately, or (b) batch via a structured operation (level 5). **Eval-able question — RQ-Affordance-4 stays open until Rung 1.5 measures whether agents actually need cross-subject in-body assertions.**

### Governed-predicate set extension (D81)

The governed set in `governedPredicates.ts` currently covers the predicates projected from class-hint wikilinks. With D82, the set must extend to cover predicates projected from JSON-LD code blocks. Two options:

**Option A — fixed governed set, fail closed.** The governed set is statically declared. Any predicate in a JSON-LD block that's *not* in the governed set is rejected with a validation error. This forces predicate vocabulary discipline.

**Option B — declarative per-shape governed set, fail open.** Each SHACL shape declares its governed-predicate set via `sh:agentInstruction` (existing D81 pattern). The listener reads the shape, computes the set dynamically per resource type. JSON-LD predicates outside the declared set are emitted to `.meta` as agent-owned (D81 non-governed bucket).

**Proposed v1**: **Option B**. Aligns with D81's existing pattern. JSON-LD becomes a way to add agent-owned predicates *in-band* (rather than requiring direct PATCH). The substrate doesn't need to know every predicate the agent might use; it just enforces governance for the set it owns.

This subtly changes D81: agent-owned predicates can now arrive via body write, not only via direct PATCH. RQ-Listener-1 mitigation must handle this (the agent-owned triples projected from JSON-LD must survive body rewrites just like agent-PATCH'd triples).

### Failure modes

| Failure | Behavior |
|---|---|
| Malformed JSON in code block | Skip the block; log warning; continue projection from wikilinks + frontmatter |
| Unresolvable `@context` | Skip the block; log warning |
| JSON-LD valid but expands to no triples | Skip silently (empty graph is not an error) |
| Triples with cross-resource subjects | Skip those triples per Model A; emit triples where subject = this resource |
| Conflict between wikilink-extracted and JSON-LD-extracted triple for the same governed predicate | Preserve both; flag in audit log |
| Same predicate as agent-owned (from JSON-LD) AND substrate-owned (from wikilink) | Error — the agent is asserting into the substrate's governed set; reject the JSON-LD block with a clear error message |

---

## Dependencies

### Hard blockers (BOTH required before any code lands)

1. **Rung 1.5 eval must support H-D82.b.** Specifically: T-jsonld arm > T-class arm on at least one task category (rich-claim retrieval, evidence-aware reasoning, or supersession-aware update). If T-class ≥ T-jsonld, this plan is shelved as a documented negative result. See `docs/plans/2026-05-15-rung-1-5-eval-matrix.md`.

2. **RQ-Listener-1 must be resolved.** Inline JSON-LD that includes agent-owned predicates needs the same preservation guarantee as direct PATCH. See `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md` for the (A)/(B)/(C) mitigation menu — pick one before shipping the listener extension.

### Implementation-time prerequisites

3. **`/meta/context.jsonld` must be readable by the listener at projection time.** Currently the wikilink projection uses a hardcoded class-hint table; the JSON-LD projection requires reading the context document. This is the refactor flagged in D79's "Task 42" — context-driven listener dispatch.

4. **JSON-LD processor in Components.js DI.** Need `jsonld.js` (or `jsonld-streaming-parser` for performance) wired into the CSS extension. Adds a runtime dependency to `markdown-projection/package.json`.

### Soft dependencies

4. **AKBP-to-W3C mapping** (`2026-05-15-akbp-to-w3c-mapping.md`) — vocabulary alignment for `@context` definitions. Update `/meta/context.jsonld` to include W3C predicates per the mapping, so agents authoring JSON-LD use standard vocabulary by default.

5. **SHACL shape `sh:agentInstruction` extension** — each shape documents which predicates can come from JSON-LD blocks (governed) vs agent-owned (passthrough). Adds a sentence or two per shape.

6. **Listener integration test fixture** — add a test fixture with a body containing a JSON-LD block, verify expected `.meta` triples appear. Probably extends `tests/integration/listener_*.py` with one new scenario.

---

## Test plan (Rung 1.5)

Three concrete tests gating the implementation:

### Test 1 — Basic JSON-LD block extraction
- PUT a body with a single `json-ld` block expressing `<this-resource> wiki:confidence 0.7`
- ASSERT `.meta` contains that triple
- ASSERT non-governed predicates from the block survive the body rewrite

### Test 2 — Class-hint + JSON-LD coexistence
- PUT a body with `[[Other]]{.extends}` AND a JSON-LD block adding `cred:credibility 0.85`
- ASSERT `.meta` contains both the wikilink-projected triple AND the JSON-LD-projected triple
- ASSERT the credibility annotation is a separate triple, not a reification of the extends edge

### Test 3 — Cross-subject JSON-LD triples are skipped
- PUT a body with a JSON-LD block where `@id` ≠ this resource URI
- ASSERT those triples are NOT projected to `.meta`
- ASSERT an audit log entry is emitted noting the skip

### Test 4 — Malformed JSON degrades gracefully
- PUT a body with a syntactically invalid JSON-LD block PLUS valid wikilinks
- ASSERT wikilink projection still works
- ASSERT no `.meta` write fails the request

### Test 5 — JSON-LD agent-owned predicates survive RQ-Listener-1 mitigation
- (Requires RQ-Listener-1 chosen mitigation in place)
- Agent PUT body with JSON-LD `wiki:confidence` (agent-owned)
- Agent PUT same resource again with different body
- ASSERT `wiki:confidence` from the first JSON-LD block survives the second body rewrite

---

## Sequencing for Rung 1.5

1. **Pick RQ-Listener-1 mitigation** (A/B/C from the mitigation doc, or D from the RDF-star exploration). Implement.
2. **Implement context-driven dispatch in `wikilinkProjection.ts`** (D79 Task 42). Listener reads `/meta/context.jsonld` at startup; classHintTable becomes derived state.
3. **Add `jsonldProjection.ts`** following this plan. Wires JSON-LD parser into the pipeline.
4. **Extend governed-predicate-set declaration in SHACL shapes** (D81 + D82). Each shape's `sh:agentInstruction` documents which JSON-LD predicates are governed vs passthrough.
5. **Land Tests 1–5** as integration tests.
6. **Update `/meta/context.jsonld`** with W3C vocabulary per AKBP-to-W3C mapping. Drop `wiki:*` predicates that have W3C equivalents.

Approximate effort: 2-3 sessions if RQ-Listener-1 mitigation is chosen and (1)–(2) are decoupled prerequisites; 1 session for (3)–(6) if (1)–(2) are done.

---

## Open questions

- **RQ-Affordance-2** — agent reliability on inline JSON-LD authoring. Eval question for Rung 1.5; gating decision for whether the level-4 affordance is actually used in practice.
- **RQ-Affordance-3** — canonicalization of class-hint vs JSON-LD for the same edge. v1 picks "preserve both"; eval may suggest canonical form.
- **RQ-Affordance-4** — cross-subject in-body JSON-LD. v1 picks "skip"; eval may suggest different policy.
- **JSON-LD context size** — at scale (~100+ predicates), the context document grows. Performance impact of reading it on every projection?
- **`@graph` vs single `@id` form** — should the listener accept both, or canonicalize? v1 accepts both; might tighten.

---

## References

- D82 (decisions-index.md Phase 5h)
- D81 Model A (decisions-index.md Phase 5f)
- D58 sharpened (decisions-index.md Phase 4)
- RQ-Listener-1 mitigation: `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md`
- RDF-star exploration: `docs/plans/2026-05-15-rdf-star-provenance-exploration.md`
- AKBP-to-W3C mapping: `docs/plans/2026-05-15-akbp-to-w3c-mapping.md`
- [[Affordance Spectrum for Agentic Memory]] (vault concept note)
- [[Wiki-Memory L3 Profile]] (vault concept note)
- Current implementation: `css/extensions/markdown-projection/src/`
