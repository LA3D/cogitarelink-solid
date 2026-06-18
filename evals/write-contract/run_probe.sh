#!/bin/bash
# Task 11 (shape-governance reconciliation): can a cold agent satisfy the MULTIPLE-st:shape
# wiki write gate first try? A durable wiki/concepts/ write fires the UNIONED shape set —
# PageShape (<>) + ThingShape (<#this>) + ConceptShape (leaf, skos:prefLabel) +
# WriteContractShape (mem:rationale on <>) — all via sh:targetClass dispatch in one floor pass.
# The spec's one unverified mechanism: does that union teach a coherent path, or 422-loop?
# MECHANISM-VALIDATION probe -> Haiku per the model-selection policy (422-teaching/floor
# round-trip). If Haiku can't form ANY conformant write in 2 runs, do ONE sonnet run to
# separate capability-floor from mechanism-fault (see grading/criteria.md).
# The probe CREATES a concept under /vault/wiki/concepts/; restore with `make reset` afterward.
# Usage: PROBE_MODEL=haiku ./run_probe.sh <tag>
set -euo pipefail
cd "$(dirname "$0")"
TAG="${1:-run1}"
RUN="runs/$TAG"
mkdir -p "$RUN/workdir"

PROMPT=$(cat prompts/task.txt)

# Snapshot the concepts/ container listing BEFORE (ground-truth baseline: what the agent adds).
curl -sk -H "Accept: text/turtle" \
  https://pod.vardeman.me/vault/wiki/concepts/ \
  > "$RUN/concepts-before.ttl" 2>/dev/null || true

( cd "$RUN/workdir" && env -u ANTHROPIC_API_KEY claude -p "$PROMPT" \
    --model "${PROBE_MODEL:-haiku}" --max-turns "${PROBE_MAX_TURNS:-60}" \
    --allowedTools "Bash(curl:*),Write" \
    --output-format stream-json --verbose \
    > ../trajectory.jsonl 2> ../stderr.log ) || echo "claude exited non-zero (see $RUN/stderr.log)"

python3 - "$RUN/trajectory.jsonl" > "$RUN/report.md" <<'PY'
import json, sys
for line in open(sys.argv[1]):
    try: d = json.loads(line)
    except json.JSONDecodeError: continue
    if d.get("type") == "result":
        print(d.get("result", ""))
PY

# Snapshot the concepts/ listing AFTER + raw-audit the write attempts (status codes per
# PUT/POST to wiki/concepts) directly from the trajectory — do NOT trust the agent's narration.
curl -sk -H "Accept: text/turtle" \
  https://pod.vardeman.me/vault/wiki/concepts/ \
  > "$RUN/concepts-after.ttl" 2>/dev/null || true

echo "run complete: $RUN"
echo "  concepts-before.ttl / concepts-after.ttl captured for raw-audit"
echo "  raw-audit the write attempts:  grep -o 'HTTP/[0-9.]* [0-9]*' $RUN/trajectory.jsonl  (and read the 422 bodies)"
