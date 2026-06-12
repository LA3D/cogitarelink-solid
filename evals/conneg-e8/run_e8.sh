#!/bin/bash
# RQ-Conneg-1/Salience E8: graph-navigation tool over the over-trust trap.
# Tool surface = curl + the `solid-pod` shim (PATH-injected, TLS pre-wired) —
# so the agent CAN navigate the graph (sparql/invoke), not just read documents.
# arm free = discover the CLI itself; arm directed = told to pull operation history.
# Trap must be planted: (cd ../d114 && ./setup/plant_overtrust.sh)
# Usage: ./run_e8.sh <free|directed> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="$1"; TAG="${2:-run1}"
RUN="runs/e8$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/e8$ARM-*.txt)
BIN="$(pwd)/bin"

( cd "$RUN/workdir" && PATH="$BIN:$PATH" env -u ANTHROPIC_API_KEY claude -p "$PROMPT" \
    --model sonnet \
    --allowedTools "Bash(curl:*)" "Bash(solid-pod:*)" \
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
