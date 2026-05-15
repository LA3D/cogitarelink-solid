# Rung 1.5 Eval Matrix — Testing the Wiki-Memory L3 Hypotheses

**Surfaced**: 2026-05-15 evening (after second epistemic audit)
**Status**: Plan — to be reviewed/refined before any eval runs
**Relates to**: H-D82, D58, D71, D77, D78, D81, RQ-Listener-1, RQ-Affordance-2/3/4, RQ-Hub-1, RQ-Discovery-1
**Sibling docs**: `2026-05-15-d82-listener-extension-plan.md`, `2026-05-15-akbp-to-w3c-mapping.md`; vault `[[Affordance Spectrum for Agentic Memory]]`

---

## Purpose

Most of the wiki-memory L3 spec (D70–D82) is **design-space conjecture**, not measurement. Only two cited systems carry peer-reviewed benchmark evidence: ByteRover (96.1% LoCoMo, with flat untyped pointers) and xMemory (BLEU+23%, hierarchical theme clustering). AKBP, Penfield, DOT-LD, Karpathy gist, and Ghumare gist are all unmeasured design proposals. The original "research convergence" framing in the L3 spec aggregated measured + unmeasured systems with equal evidentiary weight.

This document specifies the **Rung 1.5 eval matrix that turns the L3 spec from "ratified decisions" into "hypotheses to test."** The eval result determines which architectural commitments survive contact with measurement.

---

## The six arms

Each arm is a fully-functional system the agent can author to and query from. All arms get the same task suite; the only differences are storage architecture and authoring affordance.

### B0 — Plain filesystem (zero structure)

| Aspect | Spec |
|---|---|
| Storage | Plain markdown files in a directory tree |
| Body markdown | Bare `[[Note]]` wikilinks only; no typing |
| Frontmatter | None (or only `created:` timestamp) |
| Graph layer | None |
| Authoring | Agent uses Edit / Write directly on files |
| Retrieval | Agent uses grep / Glob / Read |

**Floor**: tests whether ANY of our architecture beats raw filesystem.

### B1 — ByteRover replica

| Aspect | Spec |
|---|---|
| Storage | Plain markdown files (same as B0) |
| Body markdown | Bare `[[Note]]` + flat untyped `@domain/topic/file.md` cross-references in a "Relations" section |
| Frontmatter | AKL lifecycle: `importance` (0–100), `maturity` (draft/validated/core with hysteresis), `recency` (decay), `access_count`, `update_count`, `created_at`, `updated_at` |
| Graph layer | None (frontmatter is the only typed data) |
| Authoring | Agent generates body + frontmatter directly |
| Retrieval | 5-tier: exact hash cache → fuzzy cache (Jaccard ≥ 0.6) → BM25 (MiniSearch) → single LLM call → full agentic loop |

**Tests**: does ByteRover's measured architecture transfer to our task suite? If yes, this is the new floor and any T-arm must beat it.

### B2 — AKBP-replica Pod

| Aspect | Spec |
|---|---|
| Storage | Solid Pod (CSS) — same infrastructure as T-arms |
| Body markdown | **Plain prose only**, no wikilinks, no typing in body |
| Frontmatter | Minimal (created, modified) |
| Graph layer | `.meta` Turtle written via `solid-agent-skills` CLI structured operations (parallel to AKBP's `akbp.remember` / `akbp.crystallize`) |
| Authoring | Agent calls `solid-pod create` for new resource, `solid-pod patch` for typed-edge writes — never types in body |
| Retrieval | Comunica SPARQL over `.meta` |

**Tests**: does the AKBP-style architecture (which we just argued against) actually perform worse? If B2 ≈ T-class, our D58 body→`.meta` projection commitment is unjustified.

### T-meta — Frontmatter-only typing on Pod

| Aspect | Spec |
|---|---|
| Storage | Solid Pod |
| Body markdown | Plain prose + bare `[[Note]]` wikilinks for navigation |
| Frontmatter | Typed edge fields (`concept:`, `extends:`, `supports:`, etc.) — same as the Obsidian vault uses today |
| Graph layer | `.meta` projected from frontmatter via existing `frontmatterProjection.ts` |
| Authoring | Agent writes body + typed frontmatter |
| Retrieval | Comunica SPARQL over `.meta` |

**Tests**: does in-band class-hint syntax (T-class) add value over frontmatter-only typing? If T-meta ≈ T-class, the body wikilink projection complexity is unjustified.

### T-class — Rung 1.4 baseline (what we shipped)

| Aspect | Spec |
|---|---|
| Storage | Solid Pod |
| Body markdown | `[[Note]]{.class}` typed wikilinks per D36/D58 + bare wikilinks |
| Frontmatter | Typed edge fields (same as T-meta) |
| Graph layer | `.meta` projected from BOTH class-hint wikilinks AND frontmatter |
| Authoring | Agent writes body with class hints + frontmatter |
| Retrieval | Comunica SPARQL over `.meta` |

**Tests**: this is the *current* shipped state. Whether to extend it (T-jsonld) or simplify it (T-meta, B2) depends on the surrounding arms.

### T-jsonld — D82 hypothesized extension

| Aspect | Spec |
|---|---|
| Storage | Solid Pod |
| Body markdown | `[[Note]]{.class}` + inline `json-ld` code blocks for rich claims |
| Frontmatter | Typed edge fields (same as T-class) |
| Graph layer | `.meta` projected from class-hint wikilinks + frontmatter + extracted JSON-LD blocks |
| Authoring | Agent writes body + class hints + inline JSON-LD for confidence/evidence/supersession |
| Retrieval | Comunica SPARQL over `.meta` |

**Tests**: H-D82.b — does the level-4 affordance add value over level-2 alone?

**Implementation gate**: T-jsonld requires the listener extension specified in `2026-05-15-d82-listener-extension-plan.md`, which requires RQ-Listener-1 resolution. **Phase-2 of this eval; run only after Phase-1 (B0/B1/B2/T-meta/T-class) results justify the implementation cost.**

---

## Task suite

Six task categories. Each category has 3–5 specific tasks; specific tasks pre-registered before any arm runs to prevent post-hoc selection.

### Category 1 — Navigation

Given a starting resource, traverse N hops to reach a target.

- **N1**: 1-hop forward — "Starting from `[[Context Graphs]]`, what does it extend?" → expect `[[Knowledge Graphs]]`.
- **N2**: 1-hop reverse (backlinks) — "What notes extend `[[Knowledge Graphs]]`?"
- **N3**: 2-hop with type discrimination — "From `[[Context Graphs]]`, find the literature note that establishes its provenance" (requires following `dct:source` not `skos:related`).
- **N4**: 3-hop — "From `[[Context Graphs]]`, find what criticizes a paper that influenced it."

**What this tests**: whether typed edges help discrimination at 2+ hops. ByteRover's flat `@path` should fail N3-style discrimination tasks; the question is whether real agent task distributions actually contain these patterns or if 1-hop navigation dominates.

### Category 2 — Multi-hop reasoning

Synthesize information across multiple resources to answer a question.

- **M1**: "What do we know about the Fano bound across vault notes?" (requires aggregating from xMemory note + Memory Partitions + Hierarchical Retrieval theory)
- **M2**: "Compare the typed-edge approaches in ByteRover vs Supermemory vs our wiki-memory L3" (requires reading 3+ notes, identifying salient differences)
- **M3**: "What are the unresolved research questions in cogitarelink-solid?" (requires aggregating RQ-* across decisions log + plans)

**What this tests**: whether structured retrieval beats flat retrieval when the question needs cross-document synthesis.

### Category 3 — Temporal (Memento)

Answer questions about resource state at a specific time.

- **T1**: "What did `[[Wiki-Memory L3 Profile]]` say about Penfield Labs syntax on 2026-05-15 morning vs evening?" (validates Memento time-travel + finding the correction)
- **T2**: "When was the convergence-framing claim corrected in the L3 spec?" (requires temporal predicate + change detection)
- **T3**: "Show the version history of the affordance spectrum scale across this session."

**What this tests**: whether the Memento infrastructure shipped in Rung 1.1+1.2 is usable for actual agent tasks. (Pod-only; B0/B1 don't have Memento, so this category only compares B2/T-meta/T-class/T-jsonld.)

### Category 4 — Contradiction-handling

Identify and resolve conflicting claims.

- **C1**: "Find two notes that disagree about X" (substrate must surface the disagreement, not just retrieve top-k)
- **C2**: "Given a new claim that contradicts an existing one, propose a supersession edge"
- **C3**: "What claims in the vault have been superseded but not removed?"

**What this tests**: whether structured supersession (Memento + `dct:isReplacedBy`) outperforms flat similarity retrieval (which would return both contradictory claims as equally valid).

### Category 5 — OOD honesty

Recognize when a query is outside stored knowledge.

- **O1**: "What does this vault say about quantum chromodynamics in agent memory?" → expect "no relevant notes" or "out of scope"
- **O2**: "Find sources on Byzantine consensus protocols" → expect OOD signal
- **O3**: "What's the optimal embedding dimensionality for RAG?" (tangentially relevant — measure whether the agent hallucinates a confident answer or signals uncertainty)

**What this tests**: whether the substrate gives the agent enough information to refuse / signal OOD vs. confabulate. ByteRover has explicit OOD detection (BM25 confidence < 0.85); our Pod has `void:vocabulary` declarations + `mem:OODQuerySignal` triggers. Open question whether either actually triggers honest OOD behavior at the agent layer.

### Category 6 — Authoring

Agent creates new memory from a conversation snippet or external source.

- **A1**: "Write a new concept note about X" — measure schema compliance, link quality, typing completeness
- **A2**: "Update note Y to reflect new claim Z with confidence 0.8 and evidence from source W" — measure correct use of confidence/evidence affordances per arm
- **A3**: "Mark claim X as superseded by claim Y" — measure correct supersession typing per arm

**What this tests**: authoring affordance quality. Particularly informs H-D82.b/c — can agents reliably emit inline JSON-LD for rich claims (T-jsonld) vs. using structured API (B2) vs. just frontmatter (T-meta)?

---

## Metrics

For every task in every arm, record:

| Metric | What it measures | How |
|---|---|---|
| **Success (binary)** | Did agent produce the correct answer? | LLM-as-judge with rubric per task; human spot-check on N=20% |
| **Success (graded)** | Quality of partial answers | 1–5 Likert scale per task; LLM-as-judge |
| **Tokens (input)** | Cost of context loaded | Sum from API responses |
| **Tokens (output)** | Cost of agent reasoning | Sum from API responses |
| **Latency p50/p95** | Wall-clock per task | N=5–10 runs per (arm, task) cell |
| **Schema compliance (authoring only)** | Does the produced artifact validate? | SHACL validation against the arm's shape catalog |
| **Predicate accuracy (authoring only)** | Right predicates for right relationships | LLM-as-judge against ground truth |
| **SPARQL-queryability (authoring only)** | Can subsequent queries find the agent's claims? | Re-run a probe query against the resulting graph |

---

## Controls

- **Same LLM across arms.** Pick one — Opus 4.7 by default; Sonnet 4.6 as a cheaper secondary run. Document which.
- **Same eval harness.** Reuse the `cogitarelink-fabric` Claude Code sub-agent harness pattern.
- **Same task suite.** Pre-register tasks before any arm runs.
- **N=5–10 repetitions per (arm, task) cell** for variance estimation.
- **Random task ordering per arm** to avoid order effects.
- **Identical retrieval budgets across arms** where applicable (max tokens, max iterations).
- **No human-in-the-loop intervention** — fully autonomous agent runs.
- **Pre-registered task seeds** so reruns are reproducible.

---

## Decision rules

What each result pattern implies. Pre-register these before running so we can't rationalize post-hoc:

| Observation | Conclusion | Action |
|---|---|---|
| B0 ≈ B1 ≈ B2 ≈ T-* | All architecture is overhead for our tasks | Abandon project, or rescope to tasks where structure matters |
| B0 < B1 ≪ B2 ≈ T-* | Lifecycle metadata + Pod help; typed edges don't | Adopt B1 (ByteRover) or B2 (AKBP); drop wiki-memory L3 |
| B1 ≈ T-meta < T-class | Frontmatter typing ≈ no typing; body typing helps | Keep T-class; drop the frontmatter-typing simplification |
| B2 ≈ T-class | Body→`.meta` projection adds no value over parallel surfaces | Drop D58; adopt AKBP-style architecture; ship `solid-pod` CLI as primary interface |
| T-meta ≈ T-class | In-band class hints don't help over frontmatter | Drop the listener; agents write frontmatter, not body class hints |
| T-class < T-jsonld | Inline JSON-LD blocks add measurable value | Ratify H-D82; ship listener extension |
| T-class ≥ T-jsonld | JSON-LD overhead not justified | Refute H-D82.b; do not ship listener; document negative result; revisit affordance-spectrum framing |
| Authoring quality decreases as affordance level rises | Higher-cost affordances harder for LLM to author correctly | Cap affordance ceiling at the level where authoring stays reliable |

---

## Sequencing

Two phases. Phase 1 runs with existing infrastructure; Phase 2 is conditional.

### Phase 1 — Eval with existing arms (B0, B1, B2, T-meta, T-class)

**Effort estimate**: ~2 weeks total

1. **Build B0 harness** (~1 day) — markdown directory + grep/Glob retrieval skill
2. **Build B1 harness** (~3–5 days) — ByteRover replica. Could reimplement minimal subset (frontmatter lifecycle + BM25 via MiniSearch + 2-tier retrieval; skip the LLM-curation pipeline for v1)
3. **Build B2 harness** (~2 days) — existing Pod, agent uses `solid-agent-skills` CLI only, no body wikilinks
4. **Set up T-meta harness** (~1 day) — existing Pod with frontmatter-only projection (turn off class-hint extraction in `wikilinkProjection.ts`)
5. **T-class is current Rung 1.4 state** — no work needed
6. **Pre-register task suite** (~2 days) — write concrete tasks for all 6 categories
7. **Run eval** (~3–5 days) — automated, but needs human checking for quality
8. **Analyze + write up results** (~2–3 days)

**Output of Phase 1**: data on B0/B1/B2/T-meta/T-class. Decision: do we proceed to Phase 2 (T-jsonld)?

### Phase 2 — T-jsonld (conditional on Phase 1 results)

Run ONLY if:
- T-class > B2 in Phase 1 (body→`.meta` projection has value), AND
- The "rich claims" task categories (4, 6) show ceiling on T-class that JSON-LD might address

If both conditions hold:
1. **Resolve RQ-Listener-1** (~1 week — pick A/B/C/D from mitigation menu, implement)
2. **Build T-jsonld harness** (~1 week — listener extension per `2026-05-15-d82-listener-extension-plan.md`)
3. **Run T-jsonld arm against same task suite** (~3–5 days)
4. **Analyze + compare T-jsonld vs T-class** — decide whether to ratify H-D82 as D82

---

## What this eval will NOT settle

Honest scoping — things outside the scope of this eval:

- **Federation across pods** (Round 4 territory). Single-pod eval only.
- **Multi-agent coordination** (deferred to later rounds).
- **Production scale** — synthetic task suite, not 100B+ tokens/mo.
- **Vault-flavored L4** — eval uses generic wiki-memory L3 content; vault-specific PARA/SKOS layering tested separately.
- **Agent identity / WebID flows** — single fixed identity per arm.
- **Notification protocol triggers** — D74 `mem:*` trigger vocabulary tested in a different round.

---

## Risks / open questions

- **Q1**: Are LLM-as-judge graded scores reliable across the 6 task categories? May need human spot-checks beyond 20%, especially for authoring quality.
- **Q2**: Is the B1 ByteRover replica faithful enough to their measured architecture? Their 5-tier retrieval is complex; minimal subset may miss what makes them strong.
- **Q3**: How do we ensure the agent doesn't preferentially use whichever affordance it was shown last (priming effects)? Random task ordering helps but isn't perfect.
- **Q4**: Tasks are written by us — selection bias toward tasks where our preferred architecture wins. Mitigate by having someone external (vault collaborator) review the task suite before pre-registration.
- **Q5**: Should we include real Obsidian vault content as task fixtures, or synthetic? Synthetic is cleaner but may not transfer to actual use. Compromise: bootstrap with synthetic, validate with vault subset.
- **Q6**: How do we measure "rich claim authoring quality" objectively? Schema compliance is binary; quality is graded. Need clear rubric.

---

## What this eval DOES settle (if cleanly run)

Pre-stating expected payoffs:

1. **Whether the Pod architecture beats plain filesystem** for our task domain (B1/B2/T-* vs B0).
2. **Whether body typing beats `.meta`-only typing** (T-class vs T-meta).
3. **Whether body→`.meta` projection beats parallel surfaces** (T-class vs B2).
4. **Whether inline JSON-LD blocks add value** (T-jsonld vs T-class) — IF Phase 2 runs.
5. **Whether W3C vocab is no worse than `wiki:*`** — sub-eval in Phase 2.
6. **Which task categories most distinguish architectures** — informs future eval design.

This is the doc that turns the wiki-memory L3 from a spec we believe in to a spec we've measured. Until it runs, **all of D70–D82 are v1 design choices, not validated decisions**.

---

## References

- [[Affordance Spectrum for Agentic Memory]] — foundational concept note (vault); design vocabulary
- `decisions-index.md` Phase 5h — H-D82 hypothesis spec
- `2026-05-15-d82-listener-extension-plan.md` — T-jsonld implementation plan, eval-gated
- `2026-05-15-akbp-to-w3c-mapping.md` — vocabulary translation reference (structural; behavioral pending eval)
- `2026-05-15-rq-listener-1-mitigation-design.md` — RQ-Listener-1 mitigation menu
- [[@nguyen-2026-byterover|ByteRover paper]] — B1 replica source
- [[AKBP - Agent Knowledge Base Protocol]] — B2 replica source
- `cogitarelink-fabric` repo — eval harness pattern
