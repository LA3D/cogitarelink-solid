# Write-side E5b twin — grading criteria

Source: spec §6.1 / §12 (`docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md`).
Question: **how much write-context quality does the floor's instruction content buy vs the
agent-side write disposition?** Arms are a cumulative ladder:

| Arm | Floor | Shape instruction | Prompt disposition |
|---|---|---|---|
| A | mem:rationale minCount 1 | presence-only ("is required") | none |
| B | identical | content-laden (task/conclusion/why + don't-restate-title + audit warning) | none |
| C | identical (shape B) | content-laden | Disposition 3 (pod-navigate, near-verbatim) |

## Primary metric — rationale grade (per run, on the FINAL committed note's mem:rationale)

| Grade | Meaning | Markers |
|---|---|---|
| 0 | absent / floor evaded | no mem:rationale (untyped body slipped the targetClass dispatch, or agent gave up) |
| 1 | vacuous boilerplate | "Created this note", "Required field", generic filler with no task content |
| 2 | restates title/finding | repeats schema:name or summarizes schema:text content; NO write-context (no triggering task, no consulted-resources, no why-written) |
| 3 | genuine write-context | names the triggering task AND what was concluded AND why/basis (consulted Pod resources or evidence). The D112-unrecoverable test: could a future agent reconstruct WHY this note exists from the rationale alone? |

Grade what is in `mem:rationale` only — a great schema:text does not rescue a vacuous rationale
(the finding and the write-context are different things; conflating them is exactly grade 2).

## Secondary metrics (per run)

- **422 rounds**: count of 422 responses before the 201/205 commit (the floor teaching loop, D112).
- **first-write rationale grade**: grade of the rationale in the FIRST write attempt (pre-422
  if any) — isolates "what the agent does unprompted by the report channel."
- **shape read proactively?** did the agent GET note.shacl.ttl BEFORE its first write attempt
  (vs learning the contract only from a 422)?
- **arm B channel reached?** did the content-laden text enter the agent's context at all
  (shape fetched OR a 422 carrying the laden sh:message)? If B's content never fires for
  first-try-conformant writers, that is itself the finding (presence is satisfiable vacuously
  → the report channel alone cannot deliver quality guidance).
- **declared before write?** (arm C) does the CoT show the agent composing/considering the
  write-context BEFORE its first POST (disposition behavior), vs retrofitting after a 422?
- **optional provenance**: did the agent volunteer prov:* / dct:created / agent identity
  beyond the required three properties? (D112 minimal-satisfaction replication.)
- **floor evasion**: body not typed schema:Report (zero focus nodes → trivially conforms).

## Discipline

- Raw-audit the stream-json: tool calls AND full assistant text per step (a miss can be
  never-registered vs registered-then-dismissed; mode matters — Chuck's rule).
- Capture note bodies + .meta with check_state.sh BEFORE cleanup.
- Disclose: global ~/.claude/CLAUDE.md loads in headless runs (no Pod content).
- n=3 per arm; Sonnet; curl-only.

## Predictions to test (from the spec, stated before running)

- A yields minimal satisfaction (D112: agents satisfy shapes minimally) — grade 1–2 typical.
- B > A only when the laden channel actually fires; first-try-conformant writers may never see it.
- C ≥ B (disposition is carried in-context from step 1, not gated on a fetch/422).
- The floor (all arms) yields presence 100% minus evasions — presence is not the question.
