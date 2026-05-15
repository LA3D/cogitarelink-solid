# Rung 1.5 Eval Matrix — Prioritize the Unknown

**Surfaced**: 2026-05-15 evening
**Revised**: 2026-05-15 evening (second revision — corrected cost framing + reprioritized around actual unknowns)
**Status**: Plan — execution-ready via Claude Code skill-creator harness
**Relates to**: H-D82, D44, D52, D58, D71, D77, D78, D81, RQ-Listener-1, RQ-Affordance-2/3/4, RQ-Hub-1, RQ-Discovery-1
**Sibling docs**: `2026-05-15-d82-listener-extension-plan.md`, `2026-05-15-akbp-to-w3c-mapping.md`; vault `[[Affordance Spectrum for Agentic Memory]]`

---

## Revision history

**v1 (superseded)**: 6-arm matrix (B0/B1/B2/T-meta/T-class/T-jsonld) × 20 tasks × 5–10 reps = ~1,200 sub-agent runs. Priced naively against raw Anthropic API token rates ($1,800–6,000). **Two problems**: (1) wrong execution model — Claude Code's skill-creator pattern runs evals as sub-agents under the existing subscription, no per-token billing; (2) wrong priority — most of the arms test architectural questions where prior evidence already exists.

**v2 (this revision)**: focus on what we actually don't know. Use Claude Code skill-creator harness. Defer architectural-comparison arms.

---

## What we already have evidence for (do NOT re-test)

| Prior evidence | Source | What it establishes |
|---|---|---|
| Markdown-as-substrate works for agent memory | ByteRover, peer-reviewed, 96.1% LoCoMo / 92.8% LongMemEval-S | A flat markdown corpus + BM25 + LLM curation outperforms specialized memory systems on standard benchmarks |
| Bounded hierarchical retrieval beats flat top-k | xMemory, peer-reviewed ICML 2026 | Fano bound $n_k \leq 12$ holds empirically; structure-first dominates retrieval-algorithm choice (60% of gain comes from organization) |
| Knowledge graphs work for retrieval | GraphRAG literature (LightRAG, HippoRAG, KAG, MAGMA, etc.) | Typed-edge KGs improve multi-hop reasoning over flat embedding retrieval |
| LLMs understand W3C vocabularies well | Proto-knowledge paper + qualitative observation | Pre-training exposure to DC/SKOS/PROV-O/CITO/FOAF/schema.org means W3C predicates are *not* foreign to current LLMs |
| Lifecycle metadata helps | ByteRover AKL (importance/maturity/recency with hysteresis) | Active consolidation + decay outperforms flat append-only |
| W3C standards substrate is viable | LDP, SHACL, JSON-LD, Memento, LDN spec ratifications + this project's Rung 1.1+1.2 shipped | Mechanical foundations work |

**Implication**: do not waste eval budget re-testing whether markdown-with-typing beats plain filesystem, whether KGs help retrieval, or whether LLMs can read W3C vocab. These are settled. The original B0/B1/B2/T-* matrix was largely re-running settled questions.

---

## What we don't have evidence for — the actual targets

The novel architectural commitments of cogitarelink-solid wiki-memory L3 are **affordance discovery, schema interpretation, and round-trip consistency**. These are the unknowns:

| Unknown | Why it matters |
|---|---|
| **Affordance navigation** — does an agent arriving cold actually discover and use storage description + Type Index + per-container affordance descriptors (D44, D52)? | If agents don't follow `.well-known/solid` → storage description → catalog → descriptors → schema → resource as designed, the Pod self-description architecture is fiction |
| **Schema interpretation** — does `sh:agentInstruction` (SHACL 1.2 §8.3) actually guide agents to produce conformant resources? | This is the load-bearing mechanism of D50, D77, D78. Untested whether agents read and apply shape guidance correctly |
| **Round-trip consistency** — does what the agent writes round-trip correctly through SPARQL retrieval, and is the agent's behavior reliable across reps? | Basic functionality gate. If consistency < 80%, no architectural comparison matters yet |
| **In-band class-hint value** (H-D82.a) | Does `[[Note]]{.class}` add value over plain `[[Note]]` for typed navigation? Distinct from "does typing help" (settled) — specifically about the body-vs-frontmatter location choice |
| **Inline JSON-LD authoring quality** (RQ-Affordance-2) | Can LLM agents reliably emit valid JSON-LD code blocks with W3C predicates? Gate for H-D82.b |

These are the high-value experiments. Each tests something not previously measured.

---

## Execution model — Claude Code skill-creator harness

The skill-creator skill (`~/.claude/plugins/marketplaces/anthropic-agent-skills/skills/skill-creator/SKILL.md`) provides the eval pattern Claude Code uses internally. Reuse it:

1. **Sub-agent spawning** via the `Agent` tool — each eval task = one sub-agent invocation.
2. **Workspace layout**: `wiki-memory-l3-eval-workspace/iteration-N/eval-<ID>/{arm-A,arm-B,...}/outputs/`.
3. **Eval metadata** per task in `eval_metadata.json` — prompt + assertions + arm config.
4. **Token/duration capture** from sub-agent completion notifications → `timing.json`.
5. **Grader sub-agent** (per `agents/grader.md`) — evaluates assertions, writes `grading.json`.
6. **Programmatic assertions** preferred over LLM-as-judge wherever possible (e.g., SHACL validation pass, SPARQL probe queries).
7. **Aggregation** via `scripts/aggregate_benchmark` → `benchmark.json` + `.md`.
8. **HTML viewer** via `eval-viewer/generate_review.py` for human review of outputs.

**Why this matters for cost**: each sub-agent run is folded into the existing Claude Code subscription, not metered separately. The v1 dollar estimates ($1,800–6,000) were wrong because they used raw API per-token pricing. Real costs are:

- **Quota** — sub-agent calls consume Max subscription quota; ~5-hour rolling windows matter at scale. 50–100 runs is comfortable; 1,000+ in a tight window will hit limits.
- **Wall-clock** — each agent run is ~30s–5min. 50 runs ≈ 2–4 hours of wall-clock if serial; ~30–60 min if parallelized to ~5 concurrent.
- **Human review** — viewing outputs in the HTML viewer + leaving feedback. Real but bounded.
- **Engineering** — writing the assertions, setting up arm-specific Pod states, interpreting results. The biggest real cost.

No per-token dollar billing.

---

## The four high-value experiments

Each spec'd to be ready-to-run with existing Rung 1.4 infrastructure (no new code for E1/E2/E3; light setup for E4).

### E1 — Cold-start affordance discovery

**Unknown**: does an agent arriving at a Pod with zero out-of-band instruction discover and use `.well-known/solid` → storage description → Type Index → per-container affordance descriptors?

**Arms** (Pod states):

| Arm | Pod state |
|---|---|
| A1.1 — Bare LDP | LDP containers only. No `.well-known/`, no Type Index, no `/meta/affordances/`. Pod root returns `ldp:contains` listing |
| A1.2 — Storage description router | + D44 storage description at `.well-known/solid` with `rdfs:seeAlso` to catalog containers; + Type Index for class→container routing |
| A1.3 — Full affordance catalog | A1.2 + per-container affordance descriptors at `/meta/affordances/` with `sh:agentInstruction` (full Rung 1.4 state) |

**Tasks** (n=3 reps each):

- T1.1 "Find all concepts in this Pod" — tests Type Index discovery
- T1.2 "What resource types does this Pod support?" — tests storage description reading
- T1.3 "Find the source cited by `<context-graphs.md>`" — tests cross-resource navigation via descriptors

**Assertions** (programmatic where possible):

- ✅ **Found correct answer** (LLM-as-judge against ground truth)
- ✅ **Steps to answer** (count tool calls from transcript — programmatic)
- ✅ **Read storage description** (check transcript for `.well-known/solid` GET — programmatic)
- ✅ **Read affordance descriptor** (check for `/meta/affordances/` access — programmatic)
- ✅ **Used correct query pattern** (LLM-as-judge or pattern-match)

**Decision rule** (pre-registered):

- If A1.1 ≈ A1.2 ≈ A1.3 on success rate → affordance investment is not justified. Defer further investment in storage description / affordance catalog.
- If A1.3 > A1.2 > A1.1 → affordance investment is justified at full richness. Continue with current direction.
- If A1.2 ≈ A1.3 on success but A1.3 uses fewer steps → per-container descriptors add efficiency but storage description is sufficient. Decide based on agent latency tolerance.

**Runs**: 3 arms × 3 tasks × 3 reps = **27 sub-agent runs.** Plus 27 grader runs = 54 total.

### E2 — Schema interpretation → valid authoring

**Unknown**: does an agent given SHACL shapes with `sh:agentInstruction` produce conformant resources, or does it hallucinate predicates/structure?

**Arms**:

| Arm | Available schema documentation |
|---|---|
| A2.1 — No schema docs | Agent given only the task prompt + existing example resources in the container; must reverse-engineer |
| A2.2 — SHACL + `sh:agentInstruction` | Shape file with embedded procedural guidance |
| A2.3 — SHACL + JSON-LD context + worked example | Full Rung 1.4 documentation surface |

**Tasks** (n=3 reps each):

- T2.1 "Create a literature note for paper X by author Y in venue Z" — tests SourceShape conformance
- T2.2 "Create a concept note about X that extends Y and is criticized by Z" — tests ConceptShape + multiple edge predicates
- T2.3 "Add a procedure note for workflow X with three steps" — tests ProcedureShape with `sh:agentInstruction` body

**Assertions** (mostly programmatic):

- ✅ **SHACL validation pass** (run `pyshacl` over produced `.meta`)
- ✅ **Required predicates present** (SPARQL ASK probe)
- ✅ **No hallucinated predicates outside vocabulary** (filter against context.jsonld registry)
- ✅ **Correct subject = current resource** (D81 Model A check)
- ✅ **Subjective: well-structured prose body** (LLM-as-judge)

**Decision rule**:

- If A2.1 ≈ A2.3 on SHACL pass rate → agents can reverse-engineer from examples, schema docs add little
- If A2.3 > A2.1 but A2.2 ≈ A2.3 → SHACL alone is sufficient; JSON-LD context is extra ceremony with no agent benefit
- If A2.3 > A2.2 > A2.1 → full descriptor set is justified

**Runs**: 3 arms × 3 tasks × 3 reps = **27 sub-agent runs.** Plus grader = 54 total.

### E3 — Round-trip consistency

**Unknown**: does the substrate behave reliably? Does what the agent writes round-trip correctly? Does the same task at different times give the same answer?

**Single arm**: T-class (Rung 1.4 baseline). This isn't a comparative experiment — it's a reliability gate.

**Tasks** (n=5 reps each, same task identical reps):

- T3.1 "Create a concept note X. Then in the same session, retrieve and summarize X." — tests single-session round-trip
- T3.2 "What concepts exist in this Pod?" — run 5 identical reps with no Pod state changes — tests inter-rep consistency
- T3.3 "What's the most-extended concept in this Pod?" — tests SPARQL discovery consistency across reps

**Assertions**:

- ✅ **Round-trip success** (does retrieval find what was written? — programmatic SPARQL probe)
- ✅ **Inter-rep consistency** (did 5 reps give the same answer? — programmatic string-similarity / set-equality)
- ✅ **Variance bounds** (tool-call count stddev / N runs; output token stddev / N runs — programmatic)

**Decision rule** (gate, not comparative):

- If round-trip success < 95% → there's a substrate bug, not a research result. Fix first.
- If inter-rep consistency < 80% on identical tasks → behavior is too noisy for further comparison; investigate root cause (LLM nondeterminism vs prompt sensitivity vs substrate randomness) before running E1/E2/E4.
- If both are ≥ 80% → we're good to run comparative experiments.

**Runs**: 3 tasks × 5 reps = **15 sub-agent runs.** Plus grader = 30 total.

### E4 — In-band class-hint value (H-D82.a)

**Unknown**: do body-located `[[Note]]{.class}` hints outperform frontmatter-only typing for agent navigation tasks?

**Run only if E1 shows affordances work at all** (otherwise the substrate-level signal is the bottleneck, not the typing-location detail).

**Arms**:

| Arm | Body typing | Frontmatter typing |
|---|---|---|
| A4.1 — Plain wikilinks | `[[Note]]` only | None |
| A4.2 — Frontmatter only (T-meta) | `[[Note]]` only | Typed edge fields |
| A4.3 — Class-hint (T-class, Rung 1.4 baseline) | `[[Note]]{.class}` | Typed edge fields |

**Tasks** (n=3 reps each):

- T4.1 "From `[[X]]`, find what it extends" — `.extends` discrimination required
- T4.2 "From `[[X]]`, find what criticizes it" — `.criticizes` reverse-edge discrimination
- T4.3 "What sources are cited across all concepts in this Pod?" — `.source` aggregation across body
- T4.4 "Find any related note to `[[X]]`" — control: bare wikilink should suffice

**Assertions**:

- ✅ **Found correct answer** (LLM-as-judge against ground truth)
- ✅ **Used typed edge discrimination** (transcript inspection — did agent leverage edge types or brute-force?)
- ✅ **Steps to answer** (tool-call count)

**Decision rule**:

- If A4.1 ≈ A4.3 → typing doesn't help our task domain; drop both projection and frontmatter typing
- If A4.2 ≈ A4.3 → frontmatter typing is sufficient; drop class-hint projection (D58 unjustified)
- If A4.3 > A4.2 > A4.1 → class-hint projection is justified; **this is the result that supports keeping D58**
- T4.4 (control) should be ≈ across all arms — if it isn't, there's a confound

**Runs**: 3 arms × 4 tasks × 3 reps = **36 sub-agent runs.** Plus grader = 72 total.

---

## Sequencing — pilot to full

| Tier | What runs | Run count | Purpose |
|---|---|---|---|
| **Pilot (smoke)** | E1 × 1 task × 1 rep × 3 arms | 3 + grader = 6 | Validates harness wiring; checks output format; reveals task-prompt issues before scaling |
| **E3 (gate)** | Round-trip consistency | 15 + grader = 30 | Confirms substrate is reliable enough for comparative experiments. If it fails, stop here and debug substrate |
| **E1 (full)** | Cold-start affordance discovery | 27 + grader = 54 | First high-value comparison — does the affordance architecture work? |
| **E2** | Schema interpretation | 27 + grader = 54 | Second high-value comparison — does `sh:agentInstruction` actually guide authoring? |
| **E4** | In-band class-hint value (H-D82.a) | 36 + grader = 72 | H-D82.a test, conditional on E1 showing affordances work |
| **Total** | | **~210 sub-agent runs** | Across 3–5 hours of wall-clock if parallelized to ~5 concurrent |

If E4 is positive and we want to test inline JSON-LD blocks (H-D82.b):
- Requires implementing the listener extension (`2026-05-15-d82-listener-extension-plan.md`)
- Requires RQ-Listener-1 resolution
- Adds ~30–50 more runs

If we want the original B0/B1/B2 architectural comparison (substrate-choice arms):
- Adds B1 (ByteRover replica) + B2 (AKBP-replica) builds — significant engineering work
- Adds ~50–100 more runs
- Deferred unless E1/E2 results suggest the choice between Pod-with-affordances vs ByteRover-with-lifecycle is genuinely contested

---

## Cost (realistic estimate)

No per-token billing — these run under the existing Claude Code subscription. Real costs:

| Cost dimension | Pilot + E3 + E1 + E2 + E4 (~210 runs) |
|---|---|
| **Quota (Max subscription)** | Tractable; not pushing limits if spread over 1–2 days |
| **Wall-clock** | ~3–5 hours total if parallelized to ~5 concurrent sub-agents; ~half-day to a full day if serial |
| **Human review time** | ~1–2 hours total (viewer interaction across iterations) |
| **Engineering setup** | ~1 day to write assertions + spin up A1.1/A1.2/A1.3 Pod variants + write tasks + set up workspace |
| **Total elapsed (calendar)** | ~2–3 working days from "let's run E1–E4" to "we have benchmark.json + analyst pass" |

The 210-run figure is right-sized for actual decisions — large enough for statistical signal with n=3 reps; small enough to fit in a focused work block.

---

## What this eval will NOT settle

Out of scope for Rung 1.5 (deferred to later rounds):

- **Federation across Pods** — Round 4 territory
- **Multi-agent coordination** — later round
- **Production-scale latency** — synthetic task suite, not 100B+ tokens/mo
- **GEPA convergence** (RQ-Eval-3) — substantial separate eval; defer until single-shot eval shows the architecture is worth optimizing
- **Vault-flavored L4 specialization** — generic wiki-memory L3 here; vault PARA/SKOS tested separately
- **The original 6-arm architectural comparison (B0/B1/B2 vs T-*)** — most of those arms re-test settled questions; defer unless E1/E2 results surface genuine architectural alternatives to evaluate

---

## What this eval DOES settle (if cleanly run)

Pre-stating expected payoffs:

1. **Whether agents actually discover and use Pod affordances** (E1) — gates the entire wiki-memory L3 thesis
2. **Whether `sh:agentInstruction` works as guidance** (E2) — gates D50, D77, D78
3. **Whether the substrate is reliable enough for further work** (E3) — gates everything
4. **Whether body class-hint typing is justified** (E4) — gates H-D82.a and D58 projection
5. **Where the agent's affordance-interpretation bottleneck actually is** — informs what to optimize next

This is the doc that turns the wiki-memory L3 from a spec we believe in into a spec we've measured *on the right questions*. Until it runs, **all of D70–D82 are v1 design choices, not validated decisions**.

---

## Workspace layout (per skill-creator pattern)

```
~/dev/git/LA3D/agents/cogitarelink-solid/
└── eval-workspace/wiki-memory-l3/
    └── iteration-1/
        ├── eval-E1-T1.1-cold-discovery/
        │   ├── A1.1-bare-ldp/
        │   │   ├── outputs/        # agent's final response + any artifacts
        │   │   ├── transcript.txt  # full agent turn-by-turn
        │   │   ├── timing.json     # total_tokens, duration_ms
        │   │   └── grading.json    # assertions + pass/fail
        │   ├── A1.2-storage-desc/
        │   └── A1.3-full-catalog/
        ├── eval-E1-T1.2-supported-types/
        ├── eval-E2-T2.1-literature-note/
        ├── ...
        ├── benchmark.json          # aggregated stats
        ├── benchmark.md            # human-readable summary
        └── eval-viewer-output.html # generated by generate_review.py
```

Each eval directory holds the three or so arms compared on that task. `benchmark.json` aggregates across all evals for the iteration.

---

## Pre-registration

To prevent post-hoc rationalization:

1. Before any eval runs, this document gets committed (it's now committed) with all tasks, arms, assertions, and decision rules.
2. Modifications during a run are recorded as `iteration-1-amendments.md` with date and rationale.
3. Results are written up regardless of outcome — negative results are valuable.

---

## References

- `~/.claude/plugins/marketplaces/anthropic-agent-skills/skills/skill-creator/SKILL.md` — eval harness pattern
- `~/.claude/plugins/marketplaces/anthropic-agent-skills/skills/skill-creator/agents/grader.md` — grader sub-agent spec
- `~/.claude/plugins/marketplaces/anthropic-agent-skills/skills/skill-creator/references/schemas.md` — JSON schema for eval_metadata.json, grading.json, benchmark.json
- [[Affordance Spectrum for Agentic Memory]] — design vocabulary
- `decisions-index.md` Phase 5h — H-D82 hypothesis spec
- `2026-05-15-d82-listener-extension-plan.md` — T-jsonld implementation plan, gated on E4 + RQ-Listener-1
- `2026-05-15-akbp-to-w3c-mapping.md` — vocabulary translation reference
- [[@nguyen-2026-byterover|ByteRover]] — prior evidence: markdown-as-substrate works
- [[@hu-2026-beyond-rag|xMemory]] — prior evidence: bounded hierarchical retrieval works
- `cogitarelink-fabric` repo — eval harness reuse pattern
