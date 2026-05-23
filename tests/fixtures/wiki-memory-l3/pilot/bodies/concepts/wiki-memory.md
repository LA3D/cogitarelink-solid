---
type: concept
created: 2026-05-23T00:00:00Z
modified: 2026-05-23T00:00:00Z
maturity: draft
---

# Wiki-Memory

Wiki-memory is a pattern for agent memory built around durable, navigable wiki pages with typed cross-references. Each page is a unit of knowledge; the corpus compounds over time as agents ingest sources, file queries back as new pages, and lint for contradictions.

Parent category: [[agentic-memory]]{.broader}.

The pattern originated with [[karpathy-andrej]]{.author} as a personal knowledge approach for LLMs. The architectural commitment that distinguishes this implementation is [[dual-layer-linking]]{.related} — markdown body with typed wikilinks at the token layer, RDF predicates in `.meta` at the data layer, unified by server-side projection.

The value proposition is [[compounding-knowledge]]{.related} — the wiki gets richer over time rather than accumulating. [[progressive-disclosure]]{.related} is the retrieval pattern that makes this navigable at scale.

Empirical support comes from [[byterover]]{.supports} — markdown-as-substrate validated at 96.1% LoCoMo benchmark performance. The benchmark validates the substrate choice (markdown is sufficient); it does not validate the typed-edge commitment, which is this implementation's novel contribution.
