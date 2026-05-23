---
type: concept
created: 2026-05-23T00:00:00Z
modified: 2026-05-23T00:00:00Z
maturity: draft
---

# Compounding Knowledge

Compounding knowledge is the wiki-memory value proposition: the corpus gets richer over time rather than merely accumulating. Extends [[wiki-memory]]{.extends}.

The mechanism is fan-out during ingest. When an agent processes a new source, the operation produces multiple page updates plus new entity pages plus a log entry — not a single dump-everything page. Each cross-reference reinforces existing structure; each new entity page becomes a future hub.

Without fan-out, ingestion is accumulation: pages pile up but typed-edge density stays constant. The wiki gets bigger but not richer. Knowledge does not compound — it merely accretes.

[[karpathy-andrej]]{.author} named this distinction explicitly: "knowledge compounds over time rather than being re-derived per query." This is the architectural claim that distinguishes [[wiki-memory]]{.related} from caching, RAG, or vector-only retrieval.

The compounding claim is observable only as a round-trip — agent A ingests, agent B retrieves later, the structure A created lets B find what A added. This is why round-trip consistency is a load-bearing axis in [[harness-engineering]]{.related} for memory systems: retrieval-only and creation-only evaluations both miss the compounding observation entirely.
