---
name: solid-wiki-memory-l3
description: Wiki-memory L3 reference profile on this Pod — page-as-unit, dual-layer linking (markdown wikilinks + .meta predicates), 8-shape SHACL catalog (D98, supersedes D77). Substrate stratification L1/L2/L3 (D70). Class-based shape targeting (D78). Predicate-level governance (D81 Model A).
when_to_use: When working with /wiki/{concepts,people,places,events,organizations,procedures,working}/ containers, designing wiki-memory L3 content, implementing or debugging MarkdownProjectionListener, or answering questions about wiki-memory L3 conventions.
---

# Wiki-Memory L3 Reference Profile

Canonical L3 memory profile built from first principles on W3C standards. Full design in [`references/design.md`](references/design.md). Rung 1.4 implementation summary in [`references/rung-1-4-implementation.md`](references/rung-1-4-implementation.md).

## Quick reference

- **D70**: L1/L2/L3 stratification (Pod substrate / memory substrate / memory profile)
- **D71**: Wiki-memory as canonical L3 — dual-layer linking is the architectural commitment
- **D72**: Compile-once principle — substrate maintains compiled state, agents don't re-derive
- **D73**: Two-stage commit — `working-memory/` low-ceremony, `mem:Crystallize` to durable
- **D74**: `mem:*` AS2 trigger vocabulary on LDN + Notifications Protocol
- **D75**: Rendered HTML serves humans only; RDFa dropped (revises D37)
- **D76**: URI layout (5 containers), slug algorithm with S3a `@`-strip rule, class-hint resolver, attachment co-location
- **D77**: original 5 SHACL shapes (page + source + person + procedure + working) — SUPERSEDED by D98
- **D78**: Class-based shape targeting via `rdf:type` + `rdfs:subClassOf`
- **D95**: Thing-as-top-class; **D96**: Page+Thing governance split (`<>` vs `<#this>`)
- **D98**: current catalog — 8 SHACL NodeShapes / 11 shape files (supersedes D77). Containers `/wiki/{concepts,people,places,events,organizations,procedures,working}/`
- **D100**: L4 extension contract — substrate is URI-independent; Type Index registration triggers full treatment
- **D79**: Hybrid vocabulary + JSON-LD context at /meta/context.jsonld
- **D80**: Substrate-derived navigation classes (wiki:Hub, breadcrumbs) via Comunica CONSTRUCT
- **D81**: Predicate-level governance (Model A) — substrate owns governed predicates, agent owns rest
- **K2**: slug() doesn't collapse consecutive hyphens (accepted for v1)
- **K3**: `.author` class hint → `dct:contributor`

## Open caveats

- **RQ-Listener-1**: CSS overwrites `.meta` on body PUT before listener fires. Mitigation paths in `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md` (A/B/C) plus `docs/plans/2026-05-15-rdf-star-provenance-exploration.md` (candidate D).
- **RQ-Hub-1**: Is N=3 the right hub threshold? Eval question for Rung 1.5.
- **RQ-Discovery-1**: Does the 7-step first-arrival ritual scale to agents arriving on cold Pods?

## Implementation

- `css/extensions/markdown-projection/` — MarkdownProjectionListener (D58 sharpened by D70/D71)
- `css/extensions/markdown-render/` — HTML rendering with semantic CSS classes (RDFa dropped per D75)
- `overlays/wiki-memory/shapes/` — wiki-memory L3 SHACL catalog: 8 NodeShapes / 11 shape files (D98)

## Related skills

- `solid-affordance-descriptors` — D58 body affordance projection
- `solid-spec` — D75 RDFa drop divergence
- `solid-data-modelling` — D98 SHACL catalog (supersedes D77), D78 class-based targeting
- `solid-memento` — pairs with wiki-memory L3 for time-travel queries
- `shacl-shapes` — shape design conventions
