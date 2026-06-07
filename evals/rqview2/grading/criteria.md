# RQ-View-2 cold-probe grading criteria

Source: decisions.md RQ-View-2 + D107 §5. Frame: D102 three-axis (trajectory /
outcome / round-trip). Instrument: cold Sonnet, curl-only, empty cwd outside repo.
Baseline to beat = the 2026-05-26/27 cold probes (`docs/plans/2026-05-27-two-hierarchy-eval.md`):
two agents independently misread `/vault/wiki/` as "a MediaWiki-style wiki application."

Dual view on this Pod (verified): document view = `GET .md` (text/markdown body);
graph view = follow `Link: rel="describedby"` → `GET .md.meta` (Turtle SKOS graph).
No `rel="profile"` header is emitted on wiki notes (PROF/Probe-C moot here).

## Probe V-A — cold authoring (write→graph round-trip + misread regression)

Ask: "store a concept note about cellular respiration." Grader: `setup/check_va.sh`.

| # | Criterion | Pass |
|---|---|---|
| 1 | **Misread regression (PRIMARY, vs baseline)** | Does NOT treat `/vault/wiki/` as a MediaWiki app; reads it as this Pod's concept memory |
| 2 | In-band discovery | Finds the concept container + shape + exemplar from the Pod (storage desc / type index / `how-wiki-memory-works` / photosynthesis exemplar) |
| 3 | Authoring modality | Writes a **markdown** note (document view) with the body grammar — `[label]{.prefLabel}` + `[[Biology]]{.broader}` — NOT a hand-built Turtle `.meta` PATCH (the D36/RQ-Grammar-1 no-PATCH expectation) |
| 4 | **Write→graph round-trip (crown jewel, write side)** | The authored body projects into a correct `.meta` graph view: `#this a skos:Concept`, `skos:prefLabel`, `skos:broader <biology.md#this>`; Page node typed `wiki:Page` |
| 5 | Inverse-edge maintenance | Biology's graph view gains `skos:narrower` → the new concept (substrate maintains the back-edge) |
| 6 | Self-confirmation | Agent verifies its own write (re-GET); ideally notices the dual-view projection happened |

Note the RQ-Grammar-1 expectation: a cold agent may be UNABLE to express a
conformant concept inline and fall back to PATCH `.meta` (both 2026-06-01 probes
scored 3/5 this way). Whether that still happens post-D108/D109-A is exactly what
criterion 3+4 measure.

## Probe V-B — dual-view read selection (follow-nose + interpret)

Ask: Q1 "what is photosynthesis?" (prose) + Q2 "what broader topic is it filed
under, and what else is filed there?" Fixture: `setup/plant_vb_fixture.sh` adds
`ecology` under Biology so the sibling set is real and graph-only.

| # | Criterion | Pass |
|---|---|---|
| 1 | Q1 via document view | Answers prose from `GET photosynthesis.md` body |
| 2 | Parent (markdown-reachable) | Identifies Biology as broader — available from the body wikilink OR the graph |
| 3 | **Siblings via graph view (PRIMARY)** | Names the sibling set {photosynthesis, ecology} under Biology — obtainable ONLY from the `.meta` graph (no single `.md` body lists siblings) |
| 4 | **View discovery mechanism** | Reaches the graph view via `rel="describedby"` (the Solid affordance) vs guessing the `.meta` URL vs never finding it — record which |
| 5 | View-selection awareness | Trajectory shows the agent distinguishing "prose lives in the body, relations live in the graph" — the dual-view comprehension itself |

## Cross-cutting (Chuck's asks this session)

- **Instruction-following**: did the agent do what the Pod told it to (shape
  `sh:agentInstruction`, exemplar conventions) vs improvising?
- **Follow-the-nose / sense-making**: when a step 404s or a view lacks the answer,
  does it pivot to the right next view, or stall / hallucinate from training?
- **Channel reliance** (feeds the read-path brainstorm): which channel did each
  agent treat as canonical — markdown body, `.meta` graph, or Link headers? This
  is the wiki-content counterpart to the D112 finding (body channel carried the
  ledger probes; here body and graph are genuinely different documents).
- Raw-trajectory audit required (verify self-reports vs stream-json, per the
  D112 lesson — self-logs are narratives, not ground truth).
