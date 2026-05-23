---
type: person
created: 2026-05-23T00:00:00Z
modified: 2026-05-23T00:00:00Z
maturity: draft
---

# Andre Ghumare

Author of LLM Wiki v2, the most direct extension of Karpathy's wiki-memory design. Extends [[wiki-memory]]{.related} with explicit typed edges, lifecycle metadata, and supersession semantics.

Names edge labels (uses, depends on, contradicts, caused, fixed, supersedes) as concepts but does not commit to syntax or schema — leaving the operational details for downstream implementations to settle. The gap between concept-level prescription and operational commitment is what distinguishes wiki-memory L3 from Ghumare's predecessor document.

Mattia83it's gist comment on Ghumare's design ("event-driven auto-ingest corrupts wikis when LLMs hallucinate") is the central critique Ghumare's framing acknowledges but doesn't directly solve. The two-stage commit pattern (working-memory + crystallize) is the operational answer this project commits to — permissive writes go to a working container; validated promotion produces durable content.

Ghumare's contribution is conceptual scaffolding for an extension space; the operational details — predicate-level governance, dual-layer projection, the eight-shape catalog — are the implementation's own.
