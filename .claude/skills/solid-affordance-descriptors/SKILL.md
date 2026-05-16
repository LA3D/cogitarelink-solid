---
name: solid-affordance-descriptors
description: Body-affordance descriptor architecture on this Pod — per-content-type discoverability for body content beyond LDP RDFSource/NRSource. Closes the Solid spec gap (D52); HATEOAS three-tier access (D55); body affordances first-class when descriptor-declared (D58, sharpened by D70/D71 via MarkdownProjectionListener).
when_to_use: When designing or debugging an affordance descriptor at /meta/affordances/, building a new content-type handler (markdown flavor, iCal, etc.), or deciding whether body content should project into `.meta` triples.
---

# Solid Affordance Descriptors

Per-content-type body-affordance descriptors at `/meta/affordances/<name>`. Closes the Solid spec gap on body-affordance discoverability. Full design in [`references/design.md`](references/design.md).

## Quick reference

- **D52**: Per-content-type affordance descriptors at storage description root, declared as LDP resources at `/meta/affordances/<name>`
- **D55**: HATEOAS three-tier access — brute-force (spec) + harness (descriptors) + skills (domain). Lower tiers always functional
- **D58**: Body affordances first-class when descriptor-declared. Implemented via `MarkdownProjectionListener` that materializes `.meta` triples from body wikilinks on write — dual-layer linking at single-request cost

## Implementation

- `css/extensions/markdown-projection/` — canonical example: MarkdownProjectionListener materializes wikilinks → `.meta`
- `/meta/affordances/markdown-projection` — descriptor declaring the affordance
- Discoverable via storage description's `rdfs:seeAlso` chain (D44)

## Related skills

- `solid-storage-description` — affordance catalog discoverable from storage description
- `solid-wiki-memory-l3` — primary consumer of body affordances (markdown wikilinks)
- `monitoring-store` — projection listener pattern
- `solid-spec` — Solid Protocol baseline; LDP RDFSource/NRSource split (D38)
- `solid-uri-conformance` — affordance descriptors are PROF ResourceDescriptors under a `wikirole:affordance` custom role (D86); URI structure for affordance IRIs (D84)
