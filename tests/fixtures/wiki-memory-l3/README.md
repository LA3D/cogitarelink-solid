# Wiki-Memory L3 Golden Fixtures

Truth function for the `MarkdownProjectionListener`. Tests assert:
- Listener output for `bodies/X.md` graph-equals `meta/X.md.meta`
- pyshacl validates `meta/X.md.meta` against the shape at `overlays/wiki-memory/shapes/<shape>.shacl.ttl`
- The 3 traversal queries in `traversal-queries/` return expected results against the loaded bundle

## Bundle
- `agentic-memory-systems-moc.md` — `wiki:Concept` (MOC; derives `wiki:Hub` when threshold met)
- `wiki-memory-l3-profile.md` — `wiki:Concept`
- `ghumare---llm-wiki-v2-extending-karpathy.md` — `wiki:Source` (external-resource flavor; triple-hyphen is the deterministic `slug()` output for "Ghumare - LLM Wiki v2 Extending Karpathy" — the algorithm doesn't collapse consecutive hyphens)
- `karpathy-andrej.md` — `wiki:Person`

## Other fixtures
- `enriched/wiki-memory-l3-profile-enriched.md.meta` — adds an agent-owned (non-governed) triple to test Model A preservation
- `shape-stubs/procedure-stub.ttl`, `working-note-stub.ttl` — minimal synthetic instances for shape lint-validation only

See `docs/superpowers/specs/2026-05-15-rung-1-4-wiki-memory-l3-implementation-design.md` §2 for the full bundle definition.
