# RQ-Conneg-1 H0 — do agents do plain content negotiation?

The foundational measurement of `docs/research/2026-06-08-solid-view-mechanism-vs-profiles.md`
§7. Upstream of everything in RQ-Conneg-1 (H1/H2) and feeds RQ-Salience-1.

**Design:** the question asks for `dct:modified` + `dct:conformsTo` — graph-only facts the
markdown body does NOT contain — so the agent must conneg (`Accept: text/turtle`/`ld+json`)
or follow `describedby`→`.meta`, or fail. This dodges the dual-layer confound (RQ-View-2:
agents answer graph questions from the body because the body carries the projected graph).

Three arms = increasing cue:
- **a** bare — no hint the Pod has a graph view.
- **b** told-graph — "each note is also a machine-readable RDF graph view."
- **c** told-conventions — the actual `Accept` + `describedby` mechanics spelled out.

## Run order (Pod must be up: `cd cogitarelink-solid && make reset`)
```bash
setup/plant_clean.sh                 # asserts GRAPH-ONLY QUESTION ARMED
./run_h0.sh a run1; ./run_h0.sh a run2
./run_h0.sh b run1; ./run_h0.sh b run2
./run_h0.sh c run1; ./run_h0.sh c run2
# raw-audit each runs/h0?-*/trajectory.jsonl vs grading/criteria.md
curl -sk -X DELETE https://pod.vardeman.me/vault/wiki/concepts/h0-conneg.md   # cleanup
```
Report → `cogitarelink-solid/docs/plans/2026-06-09-rq-conneg-1-h0-report.md`.
