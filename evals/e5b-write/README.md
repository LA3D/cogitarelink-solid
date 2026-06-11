# e5b-write — write-side E5b twin (spec §6.1/§12)

Does write-context QUALITY come from the floor's presence requirement (arm A), the
floor's content-laden instruction (arm B), or the agent-side write disposition —
pod-navigate Disposition 3 (arm C)? Construct-side twin of the read-side E5b
dose-response. Report: `docs/plans/2026-06-11-e5b-write-twin-report.md`.

Run from a copy OUTSIDE any repo (`cp -R evals/e5b-write ~/dev/probes/`):

```bash
./setup/plant.sh a        # plant /vault/probe-w/{note.shacl.ttl,notes/} on the live Pod
./setup/preflight.sh      # verify 422/201 mechanics + arm-correct messages BEFORE burning runs
./run_probe.sh a run1     # one run: set shape -> cold sonnet curl-only agent -> capture -> cleanup
./run_ensemble.sh         # the remaining 8 (a2..c3), one retry per run on transient API death
python3 grading/mine.py runs/a-run1 ...   # secondary metrics; grade rationales per grading/criteria.md
```

Probe substrate is disposable (`make reset` clears it). Caveat for re-runs: pre-flight
422s leave `mem:UnprocessableWrite` events in `/vault/wiki/.events/` that agents can
read (uniform across arms, but reset the Pod for a clean cell). Known confound to
de-confound in any follow-up: the investigation task's domain overlaps the vocabulary
defining `mem:rationale` (see report caveats).
