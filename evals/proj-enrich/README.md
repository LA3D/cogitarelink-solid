# proj-enrich — PSP enrichment round-trip probe (PSP-T7)

Validates the provenance-scoped-projection (PSP) enrichment round-trip: a cold agent's own
`.meta` annotation — one triple it PATCHes onto the `photosynthesis.md#this` entity under
`https://example.org/probe#`, dated today — survives a subsequent body rewrite + re-projection.
This is the D82-dissolution behavior of the PSP build observed by a cold agent: the
MarkdownProjectionListener re-derives only the predicates it governs (provenance-scoped) and
leaves agent-authored triples intact, rather than clobbering the whole `.meta` graph on every
body write. It is a MECHANISM-VALIDATION probe (deterministic substrate behavior), so it runs
on **Haiku** per the model-selection policy in `../README.md` — the instrument model (Sonnet)
is reserved for disposition/salience measurement, not mechanism checks. n=2.

**Run** (outside the repo, per the harness rule — in-repo agents inherit CLAUDE.md = warm):

```bash
cp -R evals/proj-enrich ~/dev/probes/proj-enrich
cd ~/dev/probes/proj-enrich
# Pre-flight: Pod live + seeded (NOT mid-seed-window): photosynthesis.md → 200, .meta → 200
PROBE_MODEL=haiku ./run_probe.sh run1
PROBE_MODEL=haiku ./run_probe.sh run2
python3 ../../cogitarelink-solid/evals/lib/cost.py runs/*/trajectory.jsonl
```

The runner snapshots `meta-before.ttl`, `meta-after.ttl`, `body-after.md` per run for
raw-audit. The probe MUTATES the live photosynthesis concept (its definition + body); restore
with `make reset` (+ wait for seeding) in the Pod repo afterward. Grading: `grading/criteria.md`.
