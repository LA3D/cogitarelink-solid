# D114 eval harness — read-path view authority (gate the push on this)

Two questions: (1) is D114 an improvement? (2) did anything regress? Cold agents run
in empty runs/probe?-*/workdir/, outside all repos. Sonnet. Criteria: grading/criteria.md.

## Arms
- Arm 1 (IMPROVEMENT): over-trust trap, Tier-3 (curl + solid-pod). `run_probe_cli.sh 1`
- Arm 2 (FLOOR HONESTY): over-trust trap, curl only. `run_probe.sh 2`
- Arm 3 (REGRESSION): write round-trip, curl only. `run_probe.sh 3`
- Regression re-runs: ~/dev/probes/d112 Probe-1 (curator); ~/dev/probes/rqview2 read arm.

## Run order
```bash
setup/plant_overtrust.sh                 # arms 1+2 trap (asserts TRAP ARMED)
./run_probe_cli.sh 1 run1                 # Tier-3
setup/check_state.sh > runs/probe1-run1/pod-state.txt
./run_probe.sh 2 run1                     # floor (same trap, still planted)
setup/check_state.sh > runs/probe2-run1/pod-state.txt
setup/cleanup.sh all                      # remove trap

./run_probe.sh 3 run1                     # write regression (no plant)
# grader: inspect the created concept, then setup/cleanup.sh author + delete it
```
Raw-audit each trajectory.jsonl (curl/solid-pod calls), grade vs criteria.md, then
`make audit` in cogitarelink-solid. Write the report to
cogitarelink-solid/docs/plans/2026-06-07-d114-eval-report.md.
