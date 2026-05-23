---
type: concept
created: 2026-05-23T00:00:00Z
modified: 2026-05-23T00:00:00Z
maturity: draft
---

# ByteRover

ByteRover is a benchmark-tuned agent memory system based on flat markdown pointers. Empirically validated at 96.1% LoCoMo benchmark accuracy — one of the few [[agentic-memory]]{.related} implementations carrying real benchmark evidence.

Parent category: [[agentic-memory]]{.broader}.

ByteRover shares the markdown-as-substrate commitment with [[wiki-memory]]{.related} but diverges on typed structure: ByteRover uses flat untyped `@path` pointers, where wiki-memory commits to typed wikilinks projected to RDF predicates. The benchmark validates the substrate choice (markdown is sufficient); it does not validate the typed-edge commitment.

ByteRover's five-tier architecture (latency-banded retrieval) is concept-level evidence for tiered/progressive retrieval, one of the seven L2 invariants. Its separate procedural-memory tier validates procedural memory as a category distinct from semantic memory — knowledge of how to do something, stored separately from knowledge of what is true.

Closed system; no schema visibility. Adjacent to but distinct from [[wiki-memory]]{.related} — both belong to the broader [[agentic-memory]] category but make different operational commitments. Where wiki-memory bets on typed-edge navigation as the route to compound knowledge, ByteRover bets on benchmark-tuned ranking heuristics.
