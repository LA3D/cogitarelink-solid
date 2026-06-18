# write-contract — Task 11: the multiple-`st:shape` wiki write gate (shape-governance reconciliation)

The reconciliation makes a wiki ResourceTree carry MULTIPLE `st:shape` values
(`PageShape`, `ThingShape`, leaf `ConceptShape`), and the derivation unions them — plus the
injected `sub:WriteContractShape` — into the container's `ldp:constrainedBy`. So a single
durable `/vault/wiki/concepts/` write is gated by all four shapes at once (one floor pass,
`sh:targetClass` dispatch). The spec flags this as its **one mechanism not covered by prior
probes**: can a cold agent satisfy the unioned set, and is the path coherent (or a 422 loop)?

This probe: a cold agent (curl-only, generic HTTP/RDF knowledge) is asked to record a new
wiki concept into the durable store and must discover-and-satisfy the gate from the Pod's own
self-description + the laden 422 messages. Mechanism-validation → **Haiku**, n=2 (escalate to
one Sonnet run only to separate capability-floor from mechanism-fault; see `grading/criteria.md`).

**Run** (outside the repo, per the harness rule — in-repo agents inherit CLAUDE.md = warm):

```bash
cp -R evals/write-contract ~/dev/probes/write-contract
cd ~/dev/probes/write-contract
# Pre-flight: Pod live + seeded at HEAD (make reset && make verify): /vault/wiki/concepts/ → 200
PROBE_MODEL=haiku ./run_probe.sh run1
PROBE_MODEL=haiku ./run_probe.sh run2
python3 ../../cogitarelink-solid/evals/lib/cost.py runs/*/trajectory.jsonl
```

The runner snapshots `concepts-before.ttl` / `concepts-after.ttl` per run and the full
`trajectory.jsonl` for raw-audit (reconstruct the write attempts + status codes from it; do
not trust the agent's narration). The probe CREATES a concept under `/vault/wiki/concepts/`;
restore with `make reset` (+ wait for seeding) in the Pod repo afterward.
Grading: `grading/criteria.md`. Report: `docs/plans/2026-06-17-write-contract-probe-report.md`.
