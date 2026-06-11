# Write-side E5b twin probe — floor vs instruction-content vs disposition (2026-06-11)

**Question** (spec §6.1/§12, `docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md`):
how much write-context *quality* does each station buy — the floor's presence requirement,
the floor's content-laden instruction, the agent-side write disposition (pod-navigate
Disposition 3)? This is the construct-side twin of the read-side E5b dose-response
(2026-06-09), and the first probe to exercise Disposition 3 at all (SP1's gate and the
generalization probe were read/execute-shaped).

**Rig**: `evals/e5b-write/` (run from `~/dev/probes/e5b-write/`). A floor-governed
Turtle container planted at `/vault/probe-w/notes/` (the D112 `.operations/` lane
pattern): `ldp:constrainedBy` → `/vault/probe-w/note.shacl.ttl`, shape requiring
`schema:Report` + `schema:name` + `schema:text` + `mem:rationale` (minCount 1 each —
deliberately shallow per §6.1's anti-boilerplate stance). Container `.meta` carries a
neutral pointer ("validated against the write contract at …; read it before writing"),
identical across arms. Task (identical across arms): investigate how the Pod handles
stale/superseded facts, then record the finding as a note for future agents — real
investigative work, so the write-context (what was consulted, what was concluded, why
written) is genuinely agent-only. Cold Sonnet (`claude-sonnet-4-6`), curl-only, n=3/arm.

| Arm | Floor | Shape instruction | Prompt |
|---|---|---|---|
| A | rationale minCount 1 | presence-only ("mem:rationale is required.") | bare |
| B | identical | content-laden (task/conclusion/why + consulted resources + don't-restate-title + audit warning), in `sh:agentInstruction` AND `sh:message` | bare |
| C | identical (shape B) | content-laden | + Disposition 3, near-verbatim from the shipped pod-navigate skill |

Pre-flight (E7 lesson): bad-note POST → 422 with the arm-correct message under both
shape variants (proves the floor dereferences the shape live — the swap works);
conformant POST → 201; investigation surface confirmed reachable (`ontology/mem`,
`.operations/`, curation affordance).

## Results

9/9 runs committed a conformant note. Grades on the committed `mem:rationale`
(0 absent / 1 vacuous / 2 restates-or-evidence-only / 3 genuine task+conclusion+basis):

| Run | Grade | Rationale chars | Shape read proactively | 422s | Note: extra predicates beyond required |
|---|---|---|---|---|---|
| a-run1 | 3 | 384 | call 5 of 12 | 0 | `dct:created` |
| a-run2 | 3 | 1357 | call 7 of 27 | 0 | none |
| a-run3 | 2 | 666 | call 9 of 20 | 0 | none |
| b-run1 | 3 | 2842 | call 4 of 23 | 0 | none |
| b-run2 | 3 | 2554 | call 11 of 18 | 0 | none |
| b-run3 | 3 | 745 | call 18 of 25 | 0 | none |
| c-run1 | 3 | 849 | call 22 of 29 | 0 | none |
| c-run2 | 3 | 2816 | call 15 of 17 | 0 | none |
| c-run3 | 3 | 2489 | call 17 of 18 | 0 | none |

Arm means — grade: A 2.67 / B 3.0 / C 3.0. Rationale length: A ≈ 800 / B ≈ 2 050 /
C ≈ 2 050 chars. (a-run3, the lone 2: a thorough numbered evidence chain with
no statement of the triggering task — write-provenance without write-context.)

## Findings

1. **★ The presence-only floor already elicited genuine write-context (A: 3/3 presence,
   2–3 quality) — the predicted vacuous-boilerplate baseline did NOT appear.** But see
   finding 4 for why, and the caveats for why this may not generalize.

2. **★ D112's minimal-satisfaction DOES replicate — at the property level.** 8/9 notes
   carry *exactly* the required predicates and nothing else; not one agent (arm C and its
   disposition included) volunteered `prov:wasGeneratedBy`, agent identity, or a date
   (one `dct:created`, ever). The partition is sharp: agents fill a **required** literal
   richly, and add **no** unrequired property. WHICH properties an agent writes is
   floor-decidable and floor-determined; instructions and dispositions do not move it.
   → SP2: anything wanted on every write (`prov:agent`, timestamps, links) must be
   REQUIRED by the shape or derived server-side (the D108 floor rule); no amount of
   guidance text will yield it as an option.

3. **The 422 teaching channel never fired: 9/9 first-try-conformant, after 9/9 proactive
   shape reads.** The write path has a consumption forcing function the read path lacks:
   to get a 201 you must engage the contract, so pod-delivered guidance on the *shape*
   IS consumed (contrast the read-side bootstrap leak, 0/3 cold consumption of
   `agentGuide`). Corollary: content-laden text placed ONLY in `sh:message` (the
   violation channel) would have reached nobody; it must live on the shape itself
   (`sh:agentInstruction`), where the pre-write read finds it. (Prompt caveat: the task
   said a write contract exists and must be satisfied — the *existence* pointer was
   prompt-carried, the engagement was the agents' own.)

4. **Arm A was not instruction-free in practice — the vocabulary taught it.** Every
   agent read `mem:rationale`'s own `rdfs:comment` ("…what was observed, what it was
   resolved against… so a human or later agent can reconstruct why a memory changed" —
   provenance-of-reasoning), because the investigation's primary source IS the ontology
   that defines the required property (a-run1 CoT: "Let me read the full memory
   ontology"). The E7 grounding channel acted as the write-side teacher. A well-defined,
   dereferenceable term name is itself a content-laden instruction — D109's ground-now
   policy and D84 conneg paying off on the construct side.

5. **What the content-laden instruction (B) bought: ~2.5× richer rationales with the
   instructed structure** (ordered consulted-resources lists matching "including which
   Pod resources you consulted"), at an already-saturated grade ceiling. **What the
   disposition (C) bought over B: nothing measurable on this rig** — same grades, same
   lengths, same structure; CoT (terse, narrating moves not deliberation) shows no
   visible pre-write context-composition step either. C could not differentiate because
   the channel it insures against — the floor's guidance going unconsumed — never
   failed here (finding 3).

## Caveats

- **Task-topology + topic-priming confound (real, disclosed):** the investigation target
  was the staleness/provenance mechanism — agents were primed provenance-minded AND
  forced past the required property's definition (finding 4). Arm A's high floor may
  not survive a task far from the provenance vocabulary (e.g. addressbook: look up a
  contact, save a note). De-confounding arm queued as an optional follow-up; do not run
  speculatively.
- n=3/arm, single model (Sonnet 4.6, the arc's standard instrument), single task.
- Rig contamination, minor: pre-flight 422s left `mem:UnprocessableWrite` events in
  `/vault/wiki/.events/`; two agents read them and cited them as evidence "confirming
  SHACL enforcement." Inadvertent extra teaching surface, uniform across arms. (Also a
  free observation: the UnprocessableWrite detector is live and agents can consume it.)
- Two runs died on transient API socket errors and were re-run (`*-apierror*` dirs
  retained; b-run3-apierror1 had already committed a note — consistent with its arm).
- Global `~/.claude/CLAUDE.md` loads in headless runs (no Pod content).
- `/vault/probe-w/` and the pre-flight `.events/` entries are disposable (cleared on
  next `make reset`).

## Implications (for the spec's §6.1 empirical question)

**The floor is the load-bearing quality station; the disposition is insurance, not the
driver.** Specifically: (a) REQUIRE the write-context property — required-ness, not
guidance, is what produces it (findings 1, 2); (b) define the property with a
content-laden comment in a dereferenceable vocabulary — the definition teaches through
the grounding channel even when no instruction is read (finding 4); (c) put the laden
instruction on the shape, not (only) in the violation message (finding 3); (d) keep
Disposition 3 in pod-navigate — it is cheap, and its expected payoff is precisely the
cells this rig couldn't probe: floors without laden shapes, tasks far from provenance
vocabulary, agents that skip the shape read. The §6.1 prediction "a bare MUST yields
boilerplate" is **not confirmed** for required-string quality on this task; the
boilerplate risk lives at the property-selection level instead, where the floor rules.

## Artifacts

- Rig: `evals/e5b-write/` (prompts, shapes A/B, plant/preflight/set-arm/check-state/
  cleanup, runner, ensemble chain, grading criteria + miner).
- Runs (machine-local, gitignored): `~/dev/probes/e5b-write/runs/{a,b,c}-run{1,2,3}/`
  — trajectory.jsonl + agent report + captured note body/.meta per run.
- Committed rationales quoted in full in the run dirs' `pod-state/note1.ttl`.
