# Grading — Task 11: the multiple-`st:shape` wiki write gate

Mechanism under test: a durable `/vault/wiki/concepts/` write fires the UNIONED shape set
(`PageShape` on `<>`, `ThingShape` on `<#this>`, `ConceptShape` leaf, `WriteContractShape`
`mem:rationale` on `<>`) in one floor pass via `sh:targetClass` dispatch. The spec's open
question: does that union present a coherent, satisfiable contract to a cold agent, or does
satisfying one shape's requirement just surface the next in a frustrating 422 loop?

MECHANISM-VALIDATION probe (422-teaching / floor round-trip) → **Haiku**, n=2. This is NOT a
disposition measurement.

## Raw-audit FIRST (do not trust the agent's narration)

For each run, reconstruct the write attempts from `trajectory.jsonl` (every curl request +
response is there) and cross-check `concepts-after.ttl` (the container listing) against
`concepts-before.ttl`:
- list each PUT/POST to `wiki/concepts/…` and its status code, in order;
- read the body of every 422 — which shape's `sh:message`/`sh:resultMessage` fired
  (prefLabel? mem:rationale? something else?);
- confirm a created resource appears in `concepts-after.ttl` and GET it (200) to verify it
  conforms (carries `skos:prefLabel` on `<#this>` and `mem:rationale` on `<>`).

## Verdict ladder (per run)

- **PASS (first try)** — the agent's FIRST durable write to `wiki/concepts/` returned 201/205
  and the resource conforms. The union was satisfiable without iteration: the agent discovered
  prefLabel + rationale (+ the markdown literal axis) from the Pod's self-description before
  writing.
- **PASS (converged)** — the agent reached an accepted, conforming create after one or more
  422s, AND each 422 it hit was a single coherent teaching it then satisfied (no oscillation —
  it did not fix prefLabel only to lose rationale, or thrash between shapes). Record the number
  of attempts and the teaching sequence. This still validates the union mechanism (the laden
  messages compose into a convergent path); note the friction cost.
- **FAIL (loop / incoherent union)** — the agent oscillated or could not converge within the
  turn budget BECAUSE the multi-shape union gave contradictory or non-composable teachings
  (e.g. satisfying ThingShape broke ConceptShape; a 422 message named a requirement the agent
  could not act on from Pod info alone). This is the outcome that would reopen the spec's
  design (surface the dual-layer set via one composed shape instead of multiple `st:shape`).
- **INCONCLUSIVE (tooling/capability, not the mechanism)** — the agent never landed a
  syntactically valid markdown write at all (couldn't form the body, curl `@`-file confusion,
  gave up before any shape feedback). The union question is unanswerable. RE-RUN. If Haiku
  cannot form a valid write in 2 tries, run ONE **sonnet** run as the mechanism check and record
  the model-capability observation (a union that only Haiku-fails is a skill-floor finding, not
  a mechanism fault).

Only PASS (either form) or FAIL grades the mechanism. n=2; if the two runs disagree, run a 3rd.

## What to record in the report

- Per run: verdict, attempt count, the ordered status codes, and the teaching sequence (which
  shape taught what, in what order).
- Whether the agent found the markdown literal axis (`[text]{.prefLabel}`) and the `rationale:`
  frontmatter slot, and FROM WHERE (storage description → agent guide → container/shape
  `sh:agentInstruction` → 422 `sh:message`).
- Claim-vs-reality: does the agent's ROUTE/ANSWER narration match the trajectory ground truth?
- Verdict on the spec open question: keep multiple `st:shape` unioned by the derivation, or
  surface a composed shape.
