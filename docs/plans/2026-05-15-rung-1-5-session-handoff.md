# Rung 1.5 Eval — Session Handoff

> **⚠ SUPERSEDED (2026-05-23)** — The Rung 1.5 framing in this doc was redesigned per **vault-D97 / repo-D102**. The original three-condition matrix (B1 filesystem / B2 brute-force / T Pod-harness) and the Strategy A/B sequencing are no longer the design. See `docs/plans/2026-05-23-rung-1.5-redesign-design.md` for the current engineering-feedback-loop framing (L1/L2/L3 axes, three measurement axes including round-trip consistency, A → C → B1 → B2 → D phase sequence).
>
> The "spec corrections" findings (Penfield misattribution, ByteRover overreach, AKBP architecture) and the hypothesis-downgrade work (H-D82, D77, D78, D81 as v1 design choices) **remain valid** and continue to inform the current design. This doc is retained for that historical context — but do not use its eval-matrix sections as a plan.

**Purpose** (original — superseded by D97): hand off the Rung 1.5 eval work to a fresh session. Captures where we are, what was decided, and what to do next.

**Origin session**: 2026-05-15 evening — long working session covering primary-source audit + spec corrections + eval matrix design (twice).

**Open decision**: Strategy A (build all eval prerequisites then run) vs Strategy B (minimum viable Pilot first to validate harness). User leaning toward B after second look.

---

## Where we are (state)

Everything below is committed to `main` in `~/dev/git/LA3D/agents/cogitarelink-solid` (4 commits) and `~/Obsidian/obsidian` (2 commits).

**Spec corrections** (committed) — `Wiki-Memory L3 Profile.md`, `Memory Substrate vs Memory Profile.md`, `SOLID-Pod-Decisions.md` (D71), `decisions-index.md` (D71 + Phase 5d), `MEMORY.md`, `phase2_direction.md`, `DOT-LD - Markdown Knowledge Graph Syntax.md`. Three findings drove the corrections:

- **Penfield Labs misattribution** — `{.class}` is D36 Pandoc syntax, not Penfield's `[[@type|disp]] [[Target]]`
- **ByteRover overreach** — 96.1% LoCoMo was achieved with flat untyped pointers; doesn't validate typed edges
- **AKBP architecture** — parallel surfaces with structured-API writes, NOT body-projection (the opposite of our D58 commitment)

**Affordance spectrum** (committed) — new vault concept note articulating typed-edge authoring as a 0–6 cognitive-cost spectrum. AKBP/Penfield/DOT-LD/ByteRover/cogitarelink each sit at distinct levels. The "Measured vs Conjecture" section is the load-bearing part: only ByteRover and xMemory carry actual benchmark evidence.

**H-D82 hypothesis** (committed) — D82 was initially written as a ratified decision; downgraded to hypothesis after recognizing AKBP/Penfield/DOT-LD/Karpathy/Ghumare are all unmeasured design proposals. Three testable sub-hypotheses (H-D82.a/b/c). D77/D78/D81 also relabeled as v1 design choices, not validated decisions.

**Supporting docs** (committed in `docs/plans/`):
- `2026-05-15-d82-listener-extension-plan.md` — conditional plan for inline JSON-LD listener extension, gated on E4+E5 eval support + RQ-Listener-1
- `2026-05-15-akbp-to-w3c-mapping.md` — structural translation table (correct as mapping; behavioral claims pending eval)
- `2026-05-15-rung-1-5-eval-matrix.md` — **v2 matrix** (read this first). Five experiments around the actual unknowns: affordance discovery, schema interpretation, round-trip consistency, in-band typing value. ~210 sub-agent runs total via Claude Code skill-creator harness.

**v1 of the eval matrix was wrong** in two ways (corrected in v2):
1. Priced naively against raw API per-token rates ($1,800–6,000 for 1,200 runs). Actual execution is via Claude Code sub-agents under existing subscription — no per-token billing.
2. 6-arm B0/B1/B2/T-* matrix re-tested questions where prior evidence already exists (markdown-as-substrate per ByteRover, KGs per GraphRAG lit, LLM W3C-vocab knowledge per proto-knowledge paper).

---

## What the new session needs to decide

### Strategy A — Build all prerequisites then run

~3–5 days engineering before any eval run:
1. Reference Pod content fixtures (~20–30 synthetic wiki-memory L3 resources)
2. E1 arm-specific Pod configurations (3 CSS configs: bare-LDP / storage-desc-only / full)
3. E4 frontmatter-only listener mode (config flag)
4. Eval workspace + seed scripts
5. Sub-agent harness wrapper
6. Ground truth dataset (12 task answers)
7. Backlinks affordance descriptor (close known L3 spec gap)

Then run Pilot → E3 (gate) → E1 → E2 → E4 (~3–5 more days). Total: ~1.5–2 weeks.

### Strategy B — Minimum Viable Pilot first (recommended)

~half-day setup, then validate harness end-to-end with a single sub-agent invocation:
1. Confirm Pod is up (`make up`) and has at least one resource to query
2. Spawn one Agent call (`subagent_type: general-purpose`) with prompt: *"You're being given a Solid Pod at http://pod.vardeman.me:3000/vault/. Discover what resource types it supports. Report your method and the answer."*
3. Capture: agent output, the path it took, did it find the answer
4. Decide based on result: harness works → invest in Strategy A prereqs. Harness has gaps → fix those first.

Strategy B catches integration bugs early without committing 3–5 days of arm-config engineering.

**Recommended**: B first. The Pilot validates whether (a) the Agent tool reliably spawns Pod-aware sub-agents, (b) the sub-agent can navigate the substrate, (c) what captured output looks like in practice. Cheap insurance against expensive surprises.

---

## Prerequisite items that would be needed for full eval (Strategy A scope)

If/when Strategy B succeeds and we move to A, here's the build list with context. These are NOT in the task tracker — they live here for the new session to pick up:

### 1. Reference Pod content fixtures
- Location: `eval-fixtures/wiki-memory-l3/`
- Scope: 20–30 synthetic resources across concept/source/person/procedure types
- Must be rich enough for multi-hop nav + type discrimination + authoring tasks
- Existing `tests/fixtures/wiki-memory-l3/` is for shape testing — different content scope
- Effort: 4–6 hours of careful curation

### 2. E1 arm-specific CSS configurations
- Three configs:
  - `eval-arm-A1.1-bare-ldp.json` — strip `.well-known/solid`, Type Index, `/meta/affordances/` serving
  - `eval-arm-A1.2-storage-desc.json` — add storage description + Type Index but no per-container affordance descriptors
  - `eval-arm-A1.3-full.json` — current Rung 1.4 state (essentially `solid-config.json`)
- Implementation: Components.js variant configs that import base + override what each arm hides
- Note: the K1 limitation (`OverrideListInsertAt` against empty list) may bite when stripping initializer handlers
- Effort: ~1 day

### 3. E4 frontmatter-only listener mode
- Config flag in `markdown-projection.json` (or parallel config) to disable `wikilinkProjection.ts`
- Probably: env var `WIKILINK_PROJECTION_ENABLED=false` consumed in `projectionPipeline.ts`
- Or Components.js parameter
- Effort: ~2–3 hours including tests

### 4. Eval workspace + seed scripts
- `eval-workspace/wiki-memory-l3/iteration-1/` directory structure per skill-creator pattern
- `make eval-pod-fresh ARM=A1.x` target — reset Pod + apply arm config + import fixtures
- Python seed script using existing `ldp_client.py` to POST fixtures
- Effort: ~half-day

### 5. Sub-agent harness wrapper
- Helper Python scripts (since I can't directly call `Agent` from a separate process — the harness is the orchestrating Claude Code session):
  - State management: `apply_arm_state.py`, `reset_pod.py`
  - Programmatic assertions: `check_shacl_pass.py`, `query_sparql_probe.py`, `grep_transcript.py`
  - Aggregation: borrow `scripts.aggregate_benchmark` from skill-creator
- Effort: ~1 day

### 6. Eval metadata files (12 tasks)
- Per skill-creator schema: `eval_metadata.json` per task with prompt + arms + ground_truth + assertions
- Tasks listed in `2026-05-15-rung-1-5-eval-matrix.md`:
  - E1: T1.1, T1.2, T1.3 (cold-start affordance discovery, 3 tasks)
  - E2: T2.1, T2.2, T2.3 (schema interpretation, 3 tasks)
  - E3: T3.1, T3.2, T3.3 (round-trip consistency, 3 tasks)
  - E4: T4.1, T4.2, T4.3, T4.4 (in-band class-hint value, 4 tasks)
- Effort: ~half-day for ground truth + assertion drafting

### 7. Backlinks affordance descriptor
- L3 spec called for backlinks as first-class; Rung 1.4 shipped only hub-view + breadcrumb-view at `/meta/affordances/`
- Add `/meta/affordances/backlinks.ttl` with `sparql:DerivedNavigationAffordance` for `?ext=backlinks` pattern
- Closes known L3 spec gap
- Effort: ~1 day (descriptor + matching SPARQL CONSTRUCT view + Link header on resources)

**Total Strategy A engineering: ~3–5 days before any eval run.**

---

## Strategy B starting point

If the new session opens with Strategy B, here's the kickoff:

**Pre-flight checks**:
```bash
cd ~/dev/git/LA3D/agents/cogitarelink-solid
make status      # confirm Pod is healthy
make up          # if not
```

**Pilot prompt**: spawn an Agent (`subagent_type: general-purpose`) with:

> You're being given a Solid Pod at http://pod.vardeman.me:3000/vault/. Your task: discover what resource types this Pod supports. Report (1) the steps you took, (2) what you found, (3) any HTTP requests you made and what you learned from each response. You have access to curl via Bash and may use any web standards (RDF, SPARQL, HTTP content negotiation) you know.

**What to watch for**:
- Does the agent find `.well-known/solid`? (It should — that's the Solid spec entry point.)
- Does it follow `solid:storageDescription` Link header?
- Does it parse Turtle / JSON-LD content?
- Does it find the affordance catalog at `/meta/affordances/`?
- Does it reach the Type Index?
- What's the wall-clock for one task?
- What's the captured output / transcript look like in practice?

**Capture pattern (per skill-creator)**:
- Output → `eval-workspace/wiki-memory-l3/pilot/outputs/`
- Transcript → save from the Agent return message
- Timing → from the Agent completion notification (`total_tokens`, `duration_ms`)
- Grading → manual eyeball for the pilot; programmatic for the full eval

**Decision criteria after Pilot**:
- ✅ Agent finds resource types reliably → harness works, invest in Strategy A prereqs
- ⚠️ Agent finds them but takes weird paths → harness works but task prompts need tuning; iterate before full eval
- ❌ Agent fails or harness has integration bugs → fix harness first, postpone eval

---

## Files to read in the new session (in order)

1. **This handoff doc** — start here
2. `docs/plans/2026-05-15-rung-1-5-eval-matrix.md` — the v2 matrix (full eval spec)
3. `~/Obsidian/obsidian/03 - Resources/Agentic Memory Systems/Core Concepts/Affordance Spectrum for Agentic Memory.md` — foundational design vocabulary
4. `.claude/memory/MEMORY.md` — current project state (line 154 onward has the 2026-05-15 evening dated finding)
5. `.claude/rules/decisions-index.md` Phase 5h — H-D82 hypothesis spec

Skip on first pass (read only if relevant):
- `docs/plans/2026-05-15-akbp-to-w3c-mapping.md` (vocabulary reference; needed only if eval result supports H-D82.c)
- `docs/plans/2026-05-15-d82-listener-extension-plan.md` (implementation plan; needed only if E4 + E5 are positive)

---

## Specific guard rails for the new session

To avoid repeating the mistakes from the origin session:

1. **Don't ratify decisions before measurement.** Anything labeled "v1 design choice" or "hypothesis" stays that way until eval produces evidence. Specifically: H-D82, D77, D78, D81 are all v1 choices.

2. **Don't aggregate measured + unmeasured systems as equal evidence.** ByteRover and xMemory are peer-reviewed; AKBP/Penfield/DOT-LD/Karpathy/Ghumare are unmeasured. Cite each appropriately.

3. **Don't price eval against raw API rates.** Execution is via Claude Code sub-agents under existing subscription. Cost framing is quota + wall-clock + human review + engineering, not dollars.

4. **Don't re-test settled questions.** Prior evidence covers: markdown-as-substrate works, hierarchical retrieval beats flat, KGs help retrieval, LLMs know W3C vocab, lifecycle metadata helps. Don't allocate eval budget to these.

5. **Pre-register tasks + decision rules before running.** The matrix doc already does this. Don't loosen it mid-run.

---

## Open architectural questions deferred to during/after eval

- RQ-Listener-1 — agent `.meta` PATCH survival. Blocks E5. Mitigation menu at `2026-05-15-rq-listener-1-mitigation-design.md`.
- RQ-Hub-1 — is N=3 the right hub threshold? Eval question, surfaces in E1.
- RQ-Discovery-1 — does the 7-step first-arrival ritual scale to cold Pods? Exactly what E1 tests.
- RQ-Affordance-2/3/4 — added 2026-05-15 evening; about inline JSON-LD authoring reliability + canonicalization + subject restriction. Blocked behind E5.

---

## Git state at handoff

```
cogitarelink-solid main:
  44ecbf0 Revise Rung 1.5 eval matrix — fix cost framing + prioritize unknowns
  8139388 Add Rung 1.5 eval matrix + supporting design docs
  3c52ace Audit corrections + downgrade D82 to H-D82 hypothesis
  cb34389 (pre-session baseline) Cleanup: remove vendor + legacy routers

vault main:
  89fa5452 Add Affordance Spectrum for Agentic Memory concept note
  751e1bed Wiki-memory L3 audit: corrections + AKBP parallel-surface finding
  3dc25807 (pre-session baseline) Capture: Lassila KGC 2026 talks 2 and 3
```

No uncommitted changes in cogitarelink-solid. Vault has unrelated pre-existing dirty files (Agentic Engineering MOC, Navy Mental Health, etc.) that are NOT mine and should be handled separately.

Auto-memory at `~/.claude/projects/-Users-cvardema-dev-git-LA3D-agents-cogitarelink-solid/memory/phase2_direction.md` is updated and points at this handoff.

---

## Kickoff prompt for new session

Suggested first message to start the new session:

> Read `docs/plans/2026-05-15-rung-1-5-session-handoff.md` to pick up where the previous session left off. We're deciding between Strategy A (build all eval prerequisites, ~3-5 days) and Strategy B (minimum viable Pilot first, ~half-day). I want to start with Strategy B to validate the harness wiring before committing to prereq engineering. Walk me through what the Pilot run looks like concretely — what I need to do, what you need to spawn, and what we'll learn.
