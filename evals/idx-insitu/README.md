# sp2-idx-insitu — in-situ index probe (SP2 Task 12, format A/B)

Validates the RQ-Discovery-1 index-view result against the REAL substrate: the live
`/vault/wiki/concepts/` corpus with the SP2 IndexViewListener's derived definition-line
`index.md` served as a container child (not the mock probe-a/probe-b corpora of
`evals/idxview`).

Task: locate-among-members. Target = `how-wiki-memory-works.md`; the prompt paraphrases
its content (two subjects per document / per-subject label properties / supply-vs-derive
write contract) and never names "wiki-memory".

Arms (n=2 each, sonnet, curl-only):
- **a** — forbidden-index control: prompt adds "Do not read any resource named index.md"
  (brute-force baseline on the real corpus).
- **b** — bare: unmodified prompt; the served definition-line index is discoverable but
  never mentioned (discovery is the point).
- **c** — prefLabel-only format: `setup/swap_index_c.sh` PUTs a label-only index body
  (definition tails stripped) before the c runs; `setup/restore_index.sh` re-PUTs a
  member unchanged to trigger IndexViewListener regeneration and verifies the
  definition-line version is back.

Run from OUTSIDE any repo (cold agent — no CLAUDE.md inheritance):
  ./run_insitu.sh a run1   # etc.
Raw-audit: python3 audit_insitu.py runs/*-run*
Metrics: member GETs / wrong GETs / index read / index.md.meta (derivation provenance)
consulted / CoT provenance mentions / correctness. ALWAYS read the full CoT, not just
the table (cold-probe harness pattern).

Caveats: corpus is small (5 seed concepts) — brute force is cheap, so fetch-count deltas
are muted vs the 30-member mock; descriptive slugs leak label info; the live substrate
also serves `.well-known/solid`, shapes, etc. (agents may orient through Layer-0).
