---
type: concept
created: 2026-05-23T00:00:00Z
modified: 2026-05-23T00:00:00Z
maturity: draft
---

# Agentic Memory

Agentic memory refers to persistent, structured memory architectures for autonomous agents. Distinct from chat-history memory or vector-only retrieval: agentic memory commits to structured representations that survive across sessions and across agent instances.

[[wiki-memory]]{.related} is one approach — page-as-unit with typed cross-references. [[byterover]]{.related} is a benchmark-tuned alternative based on flat untyped markdown pointers. AKBP, Supermemory, xMemory, and Mnemis all represent variant approaches within this category, each making different commitments about storage, transport, and the read-write contract.

The seven L2 invariants — bounded branching with typed containment, tiered retrieval, lifecycle metadata as first-class, explicit write plus implicit signals, hybrid blob and graph storage, separable procedural memory, out-of-domain honesty — cut across all agentic memory implementations. Different L3 profiles realize these invariants with different concrete choices.

Adjacent discipline: [[agentic-engineering]]{.related} — the engineering practice of building agent systems, of which memory architecture is one concern. The two disciplines coevolve.
