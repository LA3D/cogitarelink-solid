# View-layer cold-probe harness (D113 §8 eval)

For the OPERATOR/GRADER. Cold agents never read this — they run in empty
`runs/probe?-*/workdir/` with curl-only tools, outside all repos.

Closes RQ-Substrate-4 (view-layer piece) if Arm A passes. Re-runs D112 Probe-2's
read-path question now that the conditional `pod:notice` trailer (D113) puts the
open-action signal in the markdown body. Baseline = D112 Probe-2 0/2.

## Prereqs
- Pod live at the D113 build (view-layer merged to main): `make verify` → audit
  0 ERROR / 1 known WARN; `curl -sk https://pod.vardeman.me/vault/ -w '%{http_code}'` 200.
- curl trusts the Pod TLS (`-k` used throughout; no env needed).

## Run order (Arm A and Arm B plants must not coexist — different targets, but
##  cleanup proposals between every run so each cold agent sees one open action)

```bash
# ---- Arm A: markdown trailer (the fix) ----
setup/plant_A.sh                                  # concept + open action; asserts trailer present
./run_probe.sh A run1
setup/check_state.sh > runs/probeA-run1/pod-state.txt
setup/cleanup.sh proposals
setup/plant_A.sh                                  # re-plant (cleanup cleared the action)
./run_probe.sh A run2
setup/check_state.sh > runs/probeA-run2/pod-state.txt
setup/cleanup.sh all                              # remove proposals + the planted concept

# ---- Arm B: turtle coverage probe (faithful D112 replication) ----
setup/plant_B.sh                                  # open action on /id/schemes/orcid; asserts Link header
./run_probe.sh B run1
setup/check_state.sh "https://pod.vardeman.me/id/schemes/orcid" > runs/probeB-run1/pod-state.txt
setup/cleanup.sh proposals
```

## After the runs
Raw-audit each `trajectory.jsonl` (mine the curl tool calls — DO NOT trust
`report.md` narrative), grade against `grading/criteria.md`, then `make audit` in
cogitarelink-solid. Write the report to
`cogitarelink-solid/docs/plans/2026-06-07-view-layer-cold-probe-report.md` (mirror
the D112 report format) and flip RQ-Substrate-4 in MEMORY.md per the result.

## Caveats (inherited from D112)
- Back-pointer cleanup is SAME-UPTIME ONLY (listener seen-map in-memory). No CSS
  restart between plant and cleanup, or the back-pointer dangles → `make reset` + re-plant.
- `cleanup.sh proposals` between runs is what keeps ensemble runs independent.
- Sonnet, `--allowedTools "Bash(curl:*)"`. Global `~/.claude/CLAUDE.md` loads (no
  Pod content; disclose in grading).
