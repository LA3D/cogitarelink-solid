# solid-affordance-descriptors — Design reference

Body-affordance descriptor architecture for this Pod. Sourced from D52, D55, D58 in `.claude/rules/decisions-index.md`.

## D52 — Affordance harness

Affordance harness — per-content-type affordance descriptors at storage description root, declared as LDP resources at `/meta/affordances/<name>`. Closes Solid spec gap on body-affordance discoverability.

**Rationale**: Solid's LDP RDFSource/NRSource split (D38) describes whether a resource has RDF metadata, but not what affordances the *body* carries. Markdown wikilinks, iCal events, PDF outlines, image OCR — each is a per-content-type capability that needs a discoverable surface. D52 makes each affordance a first-class linked-data resource.

## D55 — HATEOAS-correct three-tier access architecture

HATEOAS-correct three-tier access architecture — Tier 1 brute-force (spec-only) + Tier 2 harness (descriptor-aware) + Tier 3 skills (domain-specific). Lower tiers always functional even when higher used.

**Maps to**:
- Tier 1 = L1 Pod substrate (LDP/SPARQL/Memento)
- Tier 2 = L1 + L2 (memory substrate invariants discoverable via affordance descriptors)
- Tier 3 = L1 + L2 + L3 (specific memory profile, e.g., wiki-memory L3)

## D58 — Body affordances first-class when descriptor-declared

Body affordances first-class when descriptor-declared — REVISES D41. With D52 descriptor in place, body wikilinks are equivalent navigation surface to `.meta` triples. CLI reads both, merges with provenance. SHARPENED by D70/D71: implemented via `MarkdownProjectionListener` (analogous to `MementoCommitListener` in Rung 1.1) that materializes `.meta` triples from body wikilinks on write — enables dual-layer linking at single-request cost.

## How it composes

The MarkdownProjectionListener pattern is the canonical implementation:

1. CSS MonitoringStore emits `'changed'` on resource write (D17/D65 pattern)
2. Listener reads body (markdown), extracts typed wikilinks (`[[Other]]{.class}`)
3. Listener projects to `.meta` triples per the JSON-LD context at `/meta/context.jsonld` (D79)
4. Predicate-level governance (D81 Model A): substrate owns declared predicates, agent owns rest

Same pattern works for any content type with a declared affordance descriptor — iCal events project to `.meta` `as:Event` triples, PDF outline projects to `dct:hasPart` chain, etc.

## Authoritative artifacts

- Affordance catalog root: `/meta/affordances/` on a running pod
- MarkdownProjectionListener: `css/extensions/markdown-projection/src/`
- D58 sharpening (Rung 1.4): `docs/superpowers/specs/2026-05-15-rung-1-4-wiki-memory-l3-implementation-design.md`

## Open question

**RQ-Affordance-1** — Descriptor format: declarative SHACL vs custom RDF vs hybrid. Resolved for v1 by D79 hybrid stance; revisit for Rung 1.5.
