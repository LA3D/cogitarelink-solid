# Phase A Pilot Report + Next-Session Handoff

**Date**: 2026-05-23
**Status**: Phase A pilot shipped (iter-1 + iter-2); next-session option-B build deferred
**Decisions ratified this session**: D97/D102 (Rung 1.5 reframe), D98/D103 (skills bootstrap), D99/D104 (substrate is self-validating wiki-memory L3)
**Companion doc**: `docs/plans/2026-05-23-rung-1.5-redesign-design.md` (the design that frames this work)

This document is the handoff for the next session. Read this first if you're picking up the eval work cold.

---

## TL;DR

We shipped the Phase A pilot of Rung 1.5 across two iterations, validated the harness end-to-end, ratified three architectural decisions, and surfaced 18 substrate failure modes that group cleanly into a SHACL-vs-agent partition. The next session's job is the option-B unified build: SHACL shapes for substrate resources, a `pod-audit` walker, a `pod-curator` skill body, and an immediate sweep of the four highest-priority failure modes. The architectural foundation is in place; the work is incremental from here.

---

## 1. Session methodology

### 1.1 Rung 1.5 reframed (D97 / D102)

Original Rung 1.5 framed the evaluation as a claim-proof experiment with three conditions (B1 filesystem baseline / B2 Pod brute-force / T Pod-harness) and a single task suite. We reframed it as an **engineering feedback loop** for designing a good agentic memory Pod — the artifact is a Pod design that demonstrably works, not a publication.

Key reframings:

- **Filesystem dropped**: not a real alternative. Pod-as-substrate is settled (multi-machine, shareable).
- **Wiki-memory L3 stipulated good**: three-tradition convergence + D98 8-shape catalog settle it. The question shifts from "is the design right?" to "do agents use it correctly?"
- **L1/L2/L3 axes**: agentic behavior at L1 (Solid features), L2 invariants (the seven from `Memory Substrate vs Memory Profile.md`), L3 (wiki-memory affordance utilization + Karpathy three operations: Ingest with fan-out / Query-with-file-back / Lint), plus multi-Pod federation as Phase D.
- **Three measurement axes**: trajectory (self-logged + Claude Code persisted JSONL), outcome (skill-creator native grader), **round-trip consistency** (paired create + retrieve verifies wiki-memory's compounding claim).
- **Phase sequence**: A pilot → A full → C (scale extension) → B1 (Karpathy Ingest + Query-with-file-back) → B2 (Karpathy Lint, gated on lint skill) → D (multi-Pod federation). B subdivision provisional; A and C reshape it.

Full design at `docs/plans/2026-05-23-rung-1.5-redesign-design.md`.

### 1.2 Skill-as-bootstrapper (D98 / D103)

Surfaced from the iter-1 code review. The wiki-search SKILL.md was 70 lines and duplicated substrate content (response shapes, score formulas, WAC semantics, limitations). When the CLI it recommended wasn't on PATH for subagents, with-skill agents burned 2-3 tool calls discovering the dist/cli.js fallback.

The architectural commitment: **skills under `solid-agent-skills/skills/` are minimal bootstrappers (~15-25 lines)**. They route the agent (when to use), name the tool (CLI command), and **point at the canonical specification on the Pod itself** — the affordance descriptor at `/vault/meta/affordances/<name>.ttl`, whose `sh:agentInstruction` is the source of truth. Skills do not duplicate substrate content.

Substrate obligation: every published affordance must publish a descriptor with concrete copy-pasteable invocation in `sh:agentInstruction`. The descriptor is the contract.

Validated by iter-2: refactored skill (`09acfd9` in solid-agent-skills) dropped with-skill wall-clock 22% (32.1s → 25.0s) without changing correctness. The 4-tool-call iter-2 with-skill eval-1 trajectory (Read SKILL.md → solid-pod CLI → mkdir → Write) is the clean execution this enables.

### 1.3 Substrate is self-validating wiki-memory L3 content (D99 / D104)

Surfaced from interrogating the 18 failure modes (see §4 below). The insight: substrate self-description IS wiki-memory L3 content. Same patterns we already designed (D81 governance, D73 two-stage commit, D74 `mem:*` triggers, D77/D98 shape catalog) apply to substrate-side resources.

The architecture has two complementary layers:

1. **SHACL = guardrails**. Rule-based, deterministic. Catches "is this well-formed?" violations.
2. **Agent = construction**. LLM reasoning. Handles "what should this be?" intent.

The feedback loop:
```
agent constructs → SHACL validates → violation report
                                            ↓
                                   curator agent reasons
                                            ↓
                                    patched substrate
                                            ↓
                                       (re-validate; loop)
```

Consequence: **one unified curator/audit/review toolkit** works on both content-side (vault pages) and substrate-side (descriptors). The Phase B2 lint skill collapses into the substrate-curator. Build once.

---

## 2. Phase A pilot execution

### 2.1 Fixture seeding

The Pod was empty of wiki-memory content (only synthesis page + MemTrigger test fixtures). We seeded a 10-page corpus spanning agentic-memory / agentic-engineering / harness-engineering themes:

- 7 concepts/ (wiki:Concept): wiki-memory, agentic-memory, agentic-engineering, harness-engineering, progressive-disclosure, compounding-knowledge, byterover
- 2 people/ (wiki:Person): karpathy-andrej (hub), ghumare-andre
- 1 procedures/ (wiki:HowTo): how-to-ingest-source

Hub structure deliberate: wiki-memory has 6 incoming edges, karpathy-andrej has 3+. Many-to-many typed edges (`.extends`, `.related`, `.author`, `.supports`, `.criticizes`, `.broader`). Fixtures committed at `tests/fixtures/wiki-memory-l3/pilot/` and loaded via `scripts/load_pilot_fixtures.py`.

### 2.2 Iter-1: harness shakedown

Two task prompts, two conditions, four subagents in parallel, four behavior judges. All via Claude Code's Agent tool with persisted JSONL trajectories. Workspace at `solid-agent-skills/eval-workspace/pilot-wiki-search/iteration-1/`.

Headline results:

| Metric | With Skill | Without Skill | Delta |
|---|---|---|---|
| Pass rate | 67% | 100% | −0.33 |
| Wall-clock | 32.1s | 42.4s | −10.2s |
| Tokens | 74,020 | 79,168 | −5,148 |

**Outcome correctness**: all 4 agents got the right answer (Q1: 1 hit, Q2: 6 hits).

**Cold-discovery worked**: without-skill agents successfully navigated storage description → affordance catalog → wiki-search-grep.ttl → invocation, using only standard Solid/LDP/OSLC conventions. First positive datapoint for **RQ-Discovery-1**.

**Pass-rate gap was assertion design**: with-skill agents correctly *skipped* L1 storage-description discovery and L3 affordance-catalog discovery (the skill told them the wire format). The assertions encoded an unintended expectation conflating cold-discovery with task completion. Multiple judges flagged this independently.

### 2.3 Iter-2: skill refactor + CLI fix validation

After ratifying D98/D103 (skills bootstrap), we refactored `wiki-search/SKILL.md` to ~36 lines (commit `09acfd9` in solid-agent-skills) and fixed CLI installability (commit `a308d80`: `chmod +x dist/cli.js` in build script + `npm link` + README documentation).

Same 2 prompts, same assertions (deliberately — to make iter-1 vs iter-2 comparable).

Iter-2 vs iter-1 (with-skill):
- Pass rate: 67% → 67% (unchanged — same assertion-design issue)
- Wall-clock: 32.1s → **25.0s** (−22%)
- Tokens: 74,020 → 73,050 (−970)
- Tool calls (eval-1): 7 → **4** (−43%)

The iter-2 with-skill eval-1 trajectory ran in 4 tool calls total: Read SKILL.md → `solid-pod wiki-search` → mkdir → Write. The CLI bootstrap waste that dominated iter-1 with-skill is eliminated.

Iter-2 vs iter-1 (without-skill): essentially unchanged. Substrate didn't change, so cold-discovery didn't change.

**The architectural refactor delivered the expected efficiency gain without changing correctness.** Validated.

---

## 3. The Phase A pilot architecture stack

Things now in place (committed across this session):

- **Fixtures**: 10-page wiki-memory L3 corpus (`tests/fixtures/wiki-memory-l3/pilot/bodies/`)
- **Loader**: `scripts/load_pilot_fixtures.py` PUTs fixtures to the 8-shape container layout
- **Eval workspace**: `solid-agent-skills/eval-workspace/pilot-wiki-search/{iteration-1,iteration-2}/` with eval_metadata + outputs + trajectories + gradings + benchmark + viewer
- **Subagent-trajectory discovery**: confirmed Claude Code persists JSONL at `~/.claude/projects/<slug>/<parent-session>/subagents/agent-<hash>.jsonl` discoverable via meta.json description-grep; helper script `find_subagent_trajectory.py`
- **CLI**: `solid-pod` on PATH via `npm link`; `dist/cli.js` exec bit set by build script
- **README**: `solid-agent-skills/README.md` documents install + subagent-PATH gotcha
- **Bootstrapper-form skill**: `wiki-search/SKILL.md` refactored from 70 to 36 lines

Decisions ratified:

- D97 / D102: Rung 1.5 redesigned as L1/L2/L3 engineering eval
- D98 / D103: Skills bootstrap; affordance descriptors are the manual
- D99 / D104: Substrate self-description is wiki-memory L3 content; SHACL + agent feedback loop

Research questions filed:

- RQ-Eval-4: would extended-thinking blocks on eval subagents change findings? (Filed not solved; the architectural reading is "Claude Code subagents are workhorses; thinking lives in the parent and the judge.")
- RQ-Discovery-1: positive datapoint from Phase A — the 7-step first-arrival ritual works for fluent agents at this content scale.

---

## 4. The 18 failure modes (the empirical grounding for D104)

Found by inspecting the four without-skill trajectories. None of them caused a Phase A failure (the tasks were happy-path retrieval); all are latent for Phase B+ or for less-fluent agents.

Categorized by **who catches them**:

### 4.1 SHACL catches (pure-rule, deterministic)

1. **Missing rdfs:label/comment on affordance catalog entries** — catalog ships filenames + `dc:modified` only. Multi-affordance discrimination requires N× dereferences.
2. **Stale `rdfs:seeAlso` in storage description** — points at `<../wiki/pages/>, <../wiki/sources/>` which don't exist after D98 8-shape migration. Following these gets 404s. **Highest-priority immediate fix.**
3. **Missing OSLC parameter compliance map** — descriptor mentions supported params but not unsupported (501) params. OSLC-fluent agent might probe and hit failures.
4. **Vocabulary IRIs that don't dereference** — `void:vocabulary` advertises N vocabularies; not all are dereferenceable. Required for SHACL validation tasks.
5. **`wikirole:` IRIs without comments** — agents see `prof:hasRole wikirole:search-affordance` but the role meaning isn't dereferenceable.

### 4.2 Agent-required (intent-bearing)

6. **Missing entry-point `sh:agentInstruction` on storage description** — the storage description is a flat property bag. An agent has to infer "start with `wiki:affordanceCatalog`" from naming. Agent has to compose the prose.
7. **Synthesis-page bypass** — `wiki:profileDocument <../wiki/index.md>` is declared as the navigation entry; no agent visits it. Either it's YAGNI or its purpose isn't clear. Agent reasoning needed to decide which.
8. **JSON-LD context bypass** — `wiki:contextDocument <../meta/context.jsonld>` is declared; no agent fetched it during Phase A. Required for class-hint wikilink interpretation in Phase B1. When does an agent know to load it?
9. **Multi-affordance discrimination at scale** — works fine with 12 catalog entries; at 50+ the agent needs better narrowing. SHACL can require labels (catches it as a gap) but writing them well is reasoning work.
10. **Federation gaps not documented** — what's a substrate IRI vs a cross-Pod IRI vs a vocabulary IRI? Documentation needs writing for Phase D.

### 4.3 Hybrid (SHACL detects gap; agent fills it)

11. **Missing labels on affordance entries** (#1 in SHACL list) — SHACL says "label required"; agent writes label from filename + descriptor context.
12. **Missing entry-point agentInstruction** (#6) — SHACL says "agentInstruction required on StorageDescription"; agent composes the prose.
13. **OSLC parameter compliance map** (#3) — SHACL says "must declare supported/unsupported parameters"; agent introspects handler code + spec to generate map.
14. **Stale references** (#2) — SHACL detects unreachable IRI; agent decides remove vs update vs migrate.
15. **Vocabulary completeness** (#4) — SHACL detects undefined IRIs; agent decides what they should mean or removes them.

### 4.4 Substrate-environment level (not curator scope)

16. **TLS dev cert** — handled in README + skill pre-flight. Cold-start agents using macOS curl picked it up via Keychain; Python httpx needed `SSL_CERT_FILE`.
17. **CLI install** — fixed this session (`npm link` + chmod + README documentation).
18. **Comunica `describedby` traversal gap (RQ-Pod-4)** — agents using Comunica won't follow `describedby` on text/markdown resources. Phase C+ concern. Workaround documented: explicit `default-graph-uri` params.

---

## 5. What needs to be done next session (option B — the unified build)

Estimated: ~3-4 hours focused work.

### 5.1 Define exemplary substrate-resource SHACL shapes

Start with two shapes, one per critical substrate-resource type:

**`shapes/substrate/storage-description.shacl.ttl`** — StorageDescriptionShape:
- Required predicates: `wiki:affordanceCatalog`, `wiki:typeIndex`, `wiki:contextDocument`, `wiki:shapeCatalog`, `wiki:profileDocument`, `pim:Storage` typing
- `rdfs:seeAlso` targets must all resolve (via custom HTTP-resolve constraint or post-validation check)
- Must carry an entry-point `sh:agentInstruction` (write the prose during this build; this is one of the immediate sweep items)
- `dct:conformsTo` to a known L3 profile IRI

**`shapes/substrate/affordance-descriptor.shacl.ttl`** — AffordanceDescriptorShape:
- Required predicates: `rdfs:label`, `rdfs:comment`, `sh:agentInstruction`, `prof:hasRole`, `wiki:dispatchPattern`, `wiki:targetContainer`, `dct:conformsTo`
- Cardinality 1 on label/comment/agentInstruction
- `prof:hasRole` must be in the wikirole concept scheme
- `sh:agentInstruction` content must be non-empty + non-trivial length (>100 chars heuristic)

Defer shapes for capability descriptors, vocabulary declarations, type index, JSON-LD context — write them as Phase B exposes the need.

### 5.2 Build `scripts/pod_audit.py` walker

Python script using pyshacl. Inputs: Pod URL + optional shape directory. Behavior:

1. Start at `/vault/.well-known/solid`, dereference Turtle
2. Validate against `StorageDescriptionShape` via pyshacl
3. Cross-check: for each declared catalog IRI (affordance, capability, type-index, context), HEAD it and confirm 200
4. For each `rdfs:seeAlso` target, HEAD and report 404s
5. Walk affordance catalog: dereference each entry, validate against `AffordanceDescriptorShape`
6. Aggregate findings: severity-ranked (ERROR / WARN / INFO) with violating IRI + violated constraint + remediation hint

Output: structured JSON report (consumable by curator agent) + a human-readable Markdown report.

Wire into `Makefile`: add `make audit` target. Optionally hook into `make reset` post-pod-setup so substrate misconfigurations fail the rebuild.

### 5.3 Sketch `pod-curator` skill body

Skill in `solid-agent-skills/skills/pod-curator/SKILL.md`. Bootstrapper-form per D103. The skill body explains:

- When to invoke: after `pod-audit` produces a violation report, or in response to a `mem:*` substrate event
- How to invoke: agent reads the violation report, considers each violation in turn
- For each violation:
  - If pattern matches "missing required predicate" + the predicate is reconstructible from context → auto-propose a fix to `working/`
  - If pattern matches "stale reference" → propose either removal or update based on overlay state
  - If pattern matches "missing intent-bearing prose" (e.g., entry-point agentInstruction) → compose prose by reading descriptor purpose, then propose to `working/`
  - Anything else → flag for human review
- Two-stage commit (D73): all curator proposals go to `working/` first; humans (or higher-trust agents) crystallize

This proof-of-concept skill body is built against just the 2 shapes from §5.1. Phase B+ extends it to more shapes as substrate-resource types accumulate.

### 5.4 Immediate sweep — fix the 4 highest-priority failure modes

Run pod-audit (or its proxy hand-checks), then fix:

- **#2 (mode #5 above)**: stale `rdfs:seeAlso` in storage description. Update to point at the actual D98 8-shape container paths (`/vault/wiki/concepts/`, `/vault/wiki/people/`, etc.) OR remove (preferred — Type Index already lists them).
- **#1 (mode #1 above)**: add `rdfs:label` + `rdfs:comment` to each affordance catalog entry via `.meta` patches. Pull labels from each descriptor's existing label; write comments by reading descriptor purpose.
- **#6 (mode #2 above)**: add entry-point `sh:agentInstruction` to storage description. Compose: "Agents arriving at this Pod should first dereference `wiki:affordanceCatalog` to enumerate capabilities. Each capability lives at the named affordance descriptor; the descriptor's `sh:agentInstruction` is the canonical wire form. For taxonomic navigation, see `wiki:typeIndex`. For vocabulary, see `wiki:contextDocument`."
- **#3 (mode #3 above)**: declare OSLC parameter compliance map on `wiki-search-grep.ttl` and other descriptors that accept OSLC parameters. New predicate `wiki:supportedParameters` (or similar). List supported + unsupported.

### 5.5 Re-run Phase A pilot iter-3

After the sweep + bootstrapper-form skill, run iter-3 with **per-condition assertions**:

- With-skill assertions: test skill-usage efficiency (didn't burn tool calls on bootstrap; used the CLI; got correct result)
- Without-skill assertions: test cold-discovery (followed storage description → catalog → descriptor; used OSLC quoting)
- Both: outcome correctness

Compare iter-3 against iter-1 + iter-2 via the eval-viewer `--previous-workspace` flag. Substrate sweep should ALSO improve without-skill efficiency (no 404 on `rdfs:seeAlso`, better catalog labels).

### 5.6 Optional: extend to other Phase A skills

If time permits in the next session, audit + refactor:

- `pod-discover/SKILL.md` (cold-start orientation — direct relevance)
- Any other skills in `solid-agent-skills/skills/` that have grown past ~25 lines

These are bootstrapper-form conversions per D103.

---

## 6. Open research questions surfaced this session

- **RQ-Eval-4** (filed): would extended-thinking blocks on eval subagents change behavior-judge attributions on harder tasks? Filed in repo decision-lookup. Architectural reading: Claude Code subagents are workhorses; thinking lives in the parent and the post-hoc judge. Filed not solved.
- **RQ-Discovery-1** (positive datapoint, ongoing): does the 7-step first-arrival ritual scale? Phase A shows yes for fluent (Opus 4.x) agents at ~12-affordance catalog scale. Doesn't address less-fluent models or larger catalogs.
- **Model-prior dependency** (new RQ candidate): how much of Phase A's cold-start success depends on Claude Opus knowing W3C standards a priori? Same eval against a less-fluent model would show where the substrate's self-description is truly sufficient vs adequate-for-good-models.
- **Multi-affordance discrimination at scale** (new RQ candidate): at what catalog size does the bare LDP listing stop being navigable? 12 entries works; the substrate-audit fix (#1) will validate labels at the current scale, but the scale question is Phase C territory.
- **Synthesis-page bypass** (new RQ candidate): does any agent ever visit `wiki:profileDocument`? If never, the synthesis page is YAGNI for agent navigation — but it's still useful for human navigation. Decide its scope.

---

## 7. Where the eval workspace stands

- `iteration-1/`: 4 subagent runs + 4 judges + benchmark + viewer. Committed.
- `iteration-2/`: 4 subagent runs (post-refactor) + 4 judges + benchmark + viewer (with `--previous-workspace iteration-1`). Committed.
- `iteration-3/`: not yet created. The next-session sweep + per-condition assertion redesign + iter-3 run is the natural arc.

Use `find_subagent_trajectory.py` for any future subagent spawn — it does the meta.json description-grep + copy.

---

## 8. Where the substrate stands

The Pod at `https://pod.vardeman.me/vault/` is healthy and on the 8-shape L3 layout. Substrate state:

- Storage description at `/vault/.well-known/solid` — well-formed but missing entry-point `sh:agentInstruction` and has stale `rdfs:seeAlso`
- Affordance catalog at `/vault/meta/affordances/` — 11 descriptors enumerated; affordances catalog itself lacks per-entry labels/comments
- Capability catalog at `/vault/meta/capabilities/` — declared but not exercised by Phase A
- JSON-LD context at `/vault/meta/context.jsonld` — well-formed; the class-hint mappings we documented in MEMORY.md verified against this
- Type Index at `/vault/settings/publicTypeIndex` — declared but not exercised by Phase A
- Wiki content under `/vault/wiki/`: synthesis page + MemTrigger test fixtures + the 10-page Phase A fixture corpus

Substrate readiness for Phase B+: the substrate works for Phase A retrieval. Phase B (creation tasks) will exercise JSON-LD context + Type Index + SHACL shapes for the first time — those need their own audits, but only as Phase B surfaces them.

---

## 9. Final state — what's committed this session

Across three repos, 12 commits:

**cogitarelink-solid** (6 commits):
- `3537d23` Rung 1.5 redesign D102 + design doc + propagation
- `667e4ef` Phase A pilot fixtures (10-page corpus + loader)
- `82a133f` Trajectory capture revision (Claude Code persisted JSONL + extended-thinking gap)
- `ce3c73b` RQ-Eval-4 (defer thinking-token capture)
- `cc3d2f9` D103 (skills bootstrap; affordance descriptors are the manual)
- *(pending this session)* D104 + handoff doc + FOLLOWUPS + MEMORY update

**solid-agent-skills** (5 commits):
- `d6eb808` Phase A pilot iteration-1 workspace
- `a308d80` CLI installability (README + npm link)
- `09acfd9` wiki-search SKILL.md bootstrapper refactor
- `144fd71` Phase A pilot iteration-2 workspace

**Obsidian vault** (3 commits):
- `e293efef` D97 Rung 1.5 reframed
- `a8936b71` D98 skills bootstrap
- *(pending this session)* D99 substrate self-validating

**Auto-memory** (project-scoped, not git-tracked):
- `eval_as_engineering_feedback.md` — durable framing
- `subagent_trajectories.md` — Claude Code persisted JSONL + PATH discovery
- (this session may add: SHACL+agent split memory)

---

## 10. Cold-start instructions for the next session

If you're reading this as a fresh-context Claude:

1. **Read this doc fully** — it's the methodology + state map.
2. **Read the design doc**: `docs/plans/2026-05-23-rung-1.5-redesign-design.md` — the framing this session is grounded in.
3. **Read the three decisions**: D97/D102, D98/D103, D99/D104 in the decision-lookup skill or vault decisions log.
4. **Check Pod health**: `curl https://pod.vardeman.me/vault/` should return 200; `solid-pod --version` should print `0.1.0` (if missing, see `solid-agent-skills/README.md`).
5. **The next-session build is §5 of this doc** — option B from the 2026-05-23 session. Start with §5.1 (the 2 SHACL shapes), execute §5.2 (pod-audit walker), §5.3 (curator skill body), §5.4 (immediate sweep), then §5.5 (iter-3 with per-condition assertions).
6. **Use the existing fixtures** — don't reseed unless they were wiped (`load_pilot_fixtures.py` handles this idempotently).
7. **Use the substrate-trajectories pattern** for any subagent spawning — Claude Code persists JSONL automatically; `find_subagent_trajectory.py` does the lookup.

Good luck.
