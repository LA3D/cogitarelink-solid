# Probe prompt template (new rigs only — NEVER retrofit an established arc's prompt)

Established arcs' prompts are instruments: byte-stable, or the baseline is dead.
New rigs start from this cost-optimized form (2026-06-12; the verbose self-logged
trajectory was the single biggest output-token sink and duplicates stream-json).

```
You are working against a Solid Pod at <URL>

<the task>

Constraints:
- Interact over HTTP only, using curl. Do not read any other files on this machine,
  do not search the web, and do not use any prior knowledge of this particular Pod or
  project — only generic HTTP / RDF / Linked Data standards and whatever you can learn
  from the Pod itself.

Your final output must contain three sections:
1. ROUTE — at most 10 lines: the path you took and the decisions that drove it
   (not a request log; the harness records every request).
2. ANSWER — <task-specific answer contract>, naming which Pod resource(s) each
   claim came from.
3. PROVENANCE — separate what you learned from the Pod itself from what you knew
   from training.
```

Deltas vs the legacy template:
- "Keep a trajectory log as you work" + full request-by-request TRAJECTORY section is
  GONE — the stream-json transcript is ground truth and is always raw-audited anyway;
  ROUTE (≤10 lines) preserves the self-narrative signal (what the agent THINKS it did,
  the claim-vs-reality comparison) at ~10% of the output cost.
- Headers/requests are never asked for in the output.

Runner knobs (all runners support these):
- `PROBE_MODEL=haiku ./run_*.sh` — shakedowns + mechanism-validation probes
  (measured disposition runs stay sonnet; see README "Probe model selection").
- `PROBE_MAX_TURNS` — runaway cap, default 60 (typical runs are 12–30 calls;
  the cap should never bind on a healthy run).
- After every ensemble: `python3 ../lib/cost.py runs/*/trajectory.jsonl`.
