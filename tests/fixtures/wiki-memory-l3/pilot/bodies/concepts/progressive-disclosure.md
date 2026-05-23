---
type: concept
created: 2026-05-23T00:00:00Z
modified: 2026-05-23T00:00:00Z
maturity: draft
---

# Progressive Disclosure

Progressive disclosure is the retrieval pattern of starting from a high-level index and descending only into nodes that the current task requires. It contrasts with flat-RAG, which retrieves a fixed-size context window over the entire corpus regardless of structure.

Extends [[wiki-memory]]{.extends} as a retrieval discipline.

Criticizes [[flat-rag]]{.criticizes} as a pattern that fails to escape the no-escape theorem at scale: as the corpus grows, similarity-only retrieval has a bounded ceiling on accuracy. Typed-edge navigation escapes this ceiling because typed edges are independent dimensions, not collapsed similarity scores.

Operationally:

1. Read the synthesis page (the entry point)
2. Follow Link headers to the affordance catalog
3. Use the affordance most appropriate for the current query
4. Descend into specific pages only when an affordance points there

The pattern is foundational to [[wiki-memory]]'s [[compounding-knowledge]]{.related} claim — without progressive disclosure, the wiki collapses into a flat document store under load. The Fano bound (n_k ≤ 12 children per node) is the structural constraint that keeps progressive disclosure tractable.
