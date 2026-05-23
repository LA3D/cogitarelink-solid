# Rung 1.4 — Wiki-memory L3 implementation summary

Full design at `docs/superpowers/specs/2026-05-15-rung-1-4-wiki-memory-l3-implementation-design.md`. Below is the implementation snapshot at Rung 1.4 close (2026-05-15).

## What shipped

- `css/extensions/markdown-projection/` — `MarkdownProjectionListener` materializes wikilinks → `.meta` triples on body write (D58/D71/D81)
- `css/extensions/markdown-render/` — rehype-based markdown → HTML (renamed from `markdown-rdfa`; RDFa step dropped per D75); `wikilinks.css` for semantic CSS classes
- `css/extensions/shared/markdown-parsing/` — wikilinks/predicates/resolver modules reused by renderer + projection listener
- `overlays/wiki-memory/shapes/` — at Rung 1.4: 6 shape files (ResourceShape + 5 entity shapes per D77, D78 class-based targeting). Note: the substrate-cleanup sprint (2026-05-16) moved shapes from the original `shapes/wiki-memory-l3/` to this overlay location and renamed `concept.shacl.ttl` → `page.shacl.ttl` (D77). **Superseded by D98** (2026-05-19): catalog is now 8 NodeShapes / 11 shape files; `source`→`concept`, `procedure`→`howto`.
- `/meta/context.jsonld` — JSON-LD context document (D79 hybrid vocabulary registry)
- `/meta/affordances/` — affordance catalog with 4 descriptors (markdown-projection, hub-view, breadcrumb-view, memento)

## Tests landed

- 41 vitest unit tests (markdown-projection: 20; markdown-render: 21)
- 19 pytest integration tests:
  - Round-trip (4)
  - Discovery (4)
  - Traversal (3)
  - Shape validation (6)
  - Listener integration (6, with 1 xfailed for RQ-Listener-1)

## Open items deferred to Rung 1.5

- RQ-Listener-1 — agent enrichment vs CSS `.meta` overwrite (4 mitigation paths documented)
- WIKI_NS central constant — `https://pod.vardeman.me/vault/ontology/wiki#` placeholder appears in 18 files; sed-replaceable when namespace mints
- `foaf:affiliation` frontmatter mapping — PersonShape allows it, governedPredicates includes it, but frontmatter projection has no key for it
- Task 42 (context-driven listener dispatch) — listener uses hardcoded class-hint table; reading `/meta/context.jsonld` at runtime is the planned refactor
- K2 (triple-hyphen slugs) — collapse refinement
- K3 (`.author` → `dct:contributor`) — `.creator` class hint distinction for sources

## Commit boundaries

- Rung 1.4 close: D78-D81 + K2-K3 + RQ-Listener-1 documented; commit `ce2eb5f`
- Pod-relative classHintTable URI fix: `54fdad3`
- FOLLOWUPS tracking: `61dcd60`
