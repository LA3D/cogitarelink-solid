#!/bin/bash
# RQ-Conneg-1 H1: A-vs-B discriminator over the D114 over-trust trap.
# Pure-Solid, curl-only, no ?_profile= mentioned. arm b = content (no currency);
# arm a = currency-in-question. Bucket each trajectory: graph-consulted? x surfaced-realignment?
# Trap must be planted first: (cd ../d114 && ./setup/plant_overtrust.sh)
# Usage: ./run_h1.sh <a|b> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="$1"; TAG="${2:-run1}"
RUN="runs/h1$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/h1$ARM-*.txt)

( cd "$RUN/workdir" && env -u ANTHROPIC_API_KEY claude -p "$PROMPT" \
    --model "${PROBE_MODEL:-sonnet}" --max-turns "${PROBE_MAX_TURNS:-60}" \
    --allowedTools "Bash(curl:*)" \
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

echo "run complete: $RUN"
