# Grading — PSP enrichment round-trip (PSP-T7)

Mechanism under test: an agent's OWN `.meta` annotation (a triple it PATCHes onto the
concept's `#this` entity under `https://example.org/probe#`) survives a subsequent body
re-projection. This is the D82-dissolution behavior of the provenance-scoped projection
build — the MarkdownProjectionListener re-derives only the predicates it governs and
leaves agent-authored triples intact, instead of clobbering the whole `.meta` graph.

This is a MECHANISM-VALIDATION probe, not a disposition measurement. Haiku is correct
per the model-selection policy (deterministic substrate behavior). n=2.

## Verdict ladder (per run)

Cross-check EVERYTHING against the captured `meta-before.ttl` / `meta-after.ttl` (direct
curl snapshots), NOT the agent's narration (raw-audit discipline).

- **PASS** — the agent's own `https://example.org/probe#…` triple (subject
  `…photosynthesis.md#this`, an `xsd:date` object) is present in `meta-after.ttl` AND the
  body was successfully rewritten (definition sentence changed in `body-after.md`, prefLabel
  intact). The annotation survived the re-projection. The agent's before/after quotes should
  agree with the curl truth; note any divergence.
- **FAIL (clobbered)** — the PATCH succeeded (the probe triple was in `.meta` after step 2)
  but the probe triple is ABSENT from `meta-after.ttl` after the body PUT. The re-projection
  overwrote the agent's annotation. This grades the mechanism as broken.
- **INCONCLUSIVE (tooling, not the mechanism)** — the agent never successfully landed the
  PATCH (could not form the N3 InsertDeletePatch, hit repeated 4xx, gave up). No probe triple
  ever entered `.meta`, so the survival question is unanswerable. RE-RUN this run; do NOT
  count it toward the mechanism verdict. If Haiku cannot form the PATCH in 2 tries, run ONE
  sonnet run as the mechanism check and record the model-capability observation.

Only a successful-PATCH-then-survived (PASS) or successful-PATCH-then-clobbered (FAIL)
outcome grades the mechanism.

## How to confirm the PATCH actually landed (step-2 success)

The runner captures `meta-after.ttl` only at the END. To distinguish FAIL-clobbered from
INCONCLUSIVE, raw-audit the trajectory: find the PATCH request, confirm a 2xx response, and
look for the agent's own step-4 GET showing the triple present BEFORE the body PUT (or
present-then-gone). If the trajectory shows the triple landed and then `meta-after.ttl` lacks
it → FAIL-clobbered. If it never landed → INCONCLUSIVE.

## Raw-audit checklist (both runs)

- Read the full assistant CoT + tool calls, not just the result text.
- Confirm the PATCH Content-Type was `text/n3` and the body was a `solid:InsertDeletePatch`.
- Confirm the body PUT changed the definition sentence and kept the prefLabel.
- Compare the agent's narrated verdict against `meta-after.ttl` ground truth — record agree/disagree.
