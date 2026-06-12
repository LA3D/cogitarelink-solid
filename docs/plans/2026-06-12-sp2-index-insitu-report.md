# SP2 Task 12 — in-situ index probe with format A/B (cold-probe report)

**Date:** 2026-06-12. **Question:** the 2026-06-10 RQ-Discovery-1 probe validated the
definition-line index *shape* against a 30-member mock corpus with opaque slugs (fetches
~18→~0.7, index read+used 3/3). SP2 (T4/T5) shipped the real thing: an
`IndexViewListener`-derived `index.md` child with derivation provenance in its `.meta`, served
in every wiki container. Two questions against the REAL substrate: (1) does the served index
still earn its keep in situ (small corpus, descriptive slugs, full Layer-0 around it)?
(2) **format A/B** — does the queued prefLabel-only variant (no definition tails) hurt
routing/comprehension? Plus the spec §7 check: do agents consult the index's **derivation
provenance** before trusting it (~1/3 prior)?

**Rig:** `evals/idx-insitu` (NEW — adapted from `evals/idxview`), run from
`~/dev/probes/sp2-idx-insitu/`. Live corpus `/vault/wiki/concepts/` (5 seed concepts + the
derived `index.md`), Sonnet, curl-only, fresh `make reset` before the probe (audit 0 ERROR).

**Task (identical all arms):** locate the one concept note explaining "a single document
carries more than one subject in its metadata — record-level and entity-level, each with its
own label property — and what an agent must supply vs what the substrate derives."
Target = `how-wiki-memory-works.md` (index definition line: *"The conceptual model of this
Pod's memory: three node-frames and the SKOS backbone."*; the slug does not echo the
paraphrase). Prompt mirrors the original probe's style incl. the work-efficiently instruction.

**Arms (n=2 each, 6 runs):**
- **A — forbidden-index control:** prompt adds "Do not read any resource named index.md."
- **B — bare:** unmodified prompt; the served definition-line index discoverable, never mentioned.
- **C — prefLabel-only format:** served index body swapped (direct PUT — sticks; the listener
  does not regenerate on index.md writes) for a label-only variant; restored after the runs by
  re-PUTting a member to trigger regeneration (verified — with one D82 side effect, below).

## TL;DR

**In situ, the index was never consulted — 0/6 runs read `index.md`, so the mock result does
not transfer to this corpus, and the format question (B vs C) is moot at this scale.** All six
runs were correct anyway, via the same strategy: one container listing → slug-plausibility
ranking → 2–3 member-body GETs. The arms are statistically indistinguishable (A 2–3 member
GETs, B 2–3, C 3). The decisive micro-finding is *why* B/C agents skipped the index: both
bare-arm runs (and c-run2) explicitly **triaged `index.md` as an answer-candidate and ruled it
out by byte size** ("484 bytes… too small to be an explanatory concept note", "tiny content
stub") — cold agents under an efficiency instruction treat container children as *candidates*,
not *navigation aids*, when descriptive slugs offer a cheaper route. The index earns its keep
where the original probe put it — opaque slugs, large corpora — and this in-situ corpus (5
legible slugs) sits below the threshold where consulting it pays. Derivation provenance was
consulted 0/6 (trivially — nobody opened the index). **No regression: the index's presence
cost nothing** (no run wasted more than one listing line on it). Verdict for SP2: the derived
index is validated as *harmless at small scale* and *unexercised*; its value case remains the
mock's regime (opaque slugs / many members), plus non-locate consumers (orientation, MCP
tooling) not measured here.

## Results — raw-audited from the actual curl calls (all 6 trajectories fully read)

| Run | curl calls | member GETs | wrong-member GETs | read index.md | read index.md.meta | correct |
|---|---|---|---|---|---|---|
| a-run1 | 7 | 2 | 1 | forbidden | no | ✓ |
| a-run2 | 4 | 3 | 2 | forbidden | no | ✓ |
| b-run1 | 4 | 3 | 2 | **no** | no | ✓ |
| b-run2 | 3 | 2 | 1 | **no** | no | ✓ |
| c-run1 | 4 | 3 | 2 | **no** | no | ✓ |
| c-run2 | 5 | 3 | 2 | **no** | no | ✓ |

A-vs-B fetch reduction on the real corpus: **none** (B did not use the index; means 2.5 vs
2.5 member GETs). B-vs-C format comparison: **no signal** (neither read the index, so
definition tails never entered any decision).

## The mechanism (CoT evidence)

- **Slug-routing dominates.** Every run ranked members by slug/name plausibility after one
  listing. 5/6 fetched `two-hierarchy-memory-addressing.md` first (its name pattern-matches
  "two …-level subjects"), found it was about RDFS-vs-SKOS axes, moved on, and converged on
  the target in ≤3 body fetches. With 5 legible slugs, the expected cost of brute force is
  ~2–3 fetches — cheaper than the mock's 30-opaque-slug regime where the index collapsed ~18
  fetches to ~0.7.
- **The index was seen and dismissed as a candidate, not used as a tool.** b-run1:
  *"`index.md` eliminated by size — 104, 269, 484 bytes respectively — too small to be
  explanatory concept notes."* b-run2: *"`biology.md` (104 B), `photosynthesis.md` (269 B),
  and `index.md` (484 B) are tiny content stubs, not conceptual essays."* The container
  listing's `posix:size` made the dismissal cheap. Nothing in the listing marks `index.md` as
  *about the container* (its `sub:ContainerIndex` type lives in its own `.meta`, one fetch
  away that nobody took).
- **arm-A `.meta` triage (in-situ-only strategy):** a-run1 read three members' `.meta`
  sidecars and used their `skos:definition`/`dct:conformsTo` to down-select before fetching
  any body — the governed graph already gives per-resource definitions, so the index's
  definition-line content is *redundant per-resource* in situ; what the index uniquely adds is
  aggregation into ONE fetch, which only pays at larger member counts.
- **Derivation provenance: 0/6.** No run fetched `index.md.meta` or mentioned the index's
  derived/audit status. (Consistent with nobody reading the index at all; the spec §7 ~1/3
  consultation prior remains untested in situ.)

## Format A/B (B vs C)

No behavioral difference — both formats went unread. The format question cannot be answered
on a corpus where the index is not consulted; it should be re-cut on the mock corpus (opaque
slugs, 30 members) where index reading is 3/3, by swapping the planted index body. Recorded
as the follow-up rather than over-concluding from null-by-vacuity data here.

## Bonus substrate finding (D82, live): restore path drops seeded enrichment

The arm-C restore (re-PUT `photosynthesis.md` unchanged to trigger `IndexViewListener`
regeneration) worked — the definition-line index regenerated — but the re-PUT member **lost
its own seeded `skos:definition`** (projection rewrite clobbers non-derived `.meta`
enrichment), so its index tail vanished: *"Photosynthesis — The process by which…"* became
bare *"Photosynthesis"*. This is exactly the D82 hard-dependency called out in the
2026-06-10 spec amendment (agent/seed `.meta` enrichment doesn't survive projection
rewrites — strict-xfail), observed here end-to-end through the index view. Healed by the
end-of-task `make reset`. Two practical notes: (1) any "touch a member to refresh the index"
workflow is destructive under current projection semantics; (2) the index view faithfully
propagates the data loss, making it visible — a cheap D82 detector.

Mechanical rig note: a direct PUT to `index.md` **sticks** (the listener skips index.md
writes — no immediate regeneration), so format swaps are stable; and the first cut of the
swap-verification grep false-matched the index header's own em-dash ("derived — see this
document's .meta") — fixed to match a definition tail.

## Caveats

- **n=2/arm; one model (Sonnet); one task; 5-member corpus with descriptive slugs.** The
  null result is about THIS regime; it does not contradict the mock result (different regime:
  30 members, opaque slugs), it bounds where the index pays.
- The efficiency instruction ("as few requests as you need") actively discourages a
  speculative index fetch when slugs look informative — deliberate mirror of the original
  probe, but it shapes the dismissal.
- The forbidden-index constraint in arm A was never binding (B/C didn't read it either), so
  A is effectively a second bare arm this time — harmless, but it means the control bought
  no information.
- Environment: full SP2 substrate live (lean Layer-0, D80 re-cut, write-contract shapes);
  no run navigated via `.well-known/solid` (all went straight to the container URL given in
  the prompt).
- Run artifacts: `~/dev/probes/sp2-idx-insitu/runs/` (machine-local); restored index +
  pod state snapshotted to `runs/pod-state/` before final reset.

## Actionable

1. **Don't index-optimize small legible-slug containers** — the substrate's derived index is
   already harmless there; its payoff regime is opaque-slug / many-member containers (and the
   `working/` container as it accumulates), as the mock showed.
2. **Make the index legible AS an index from the container listing** if in-situ consultation
   matters: agents triaged it by size because nothing in the listing distinguishes it from a
   member. Candidate: the `sub:ContainerIndex` type (or `rdfs:seeAlso`/`describedby` hint) on
   the container's own listing graph — one triple, testable with this rig.
3. **Re-cut the format A/B on the mock corpus** (where the index is actually read) before
   deciding the definition-tail question.
4. **D82 stays a hard dependency** for any member-rewrite-based refresh path (finding above).
