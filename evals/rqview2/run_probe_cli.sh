#!/bin/bash
# Arm-2 runner: identical to run_probe.sh but the cold agent's tool surface is
# curl + the `solid-pod` shim (PATH-injected; TLS pre-wired in the shim).
# Usage: ./run_probe_cli.sh <3> [tag]
set -euo pipefail
cd "$(dirname "$0")"
N="$1"; TAG="${2:-$(date +%Y%m%d-%H%M%S)}"
RUN="runs/probe$N-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/probe$N-*.txt)
BIN="$(pwd)/bin"

( cd "$RUN/workdir" && PATH="$BIN:$PATH" claude -p "$PROMPT" \
    --model sonnet \
    --allowedTools "Bash(curl:*)" "Bash(solid-pod:*)" \
    --output-format stream-json --verbose \
    > ../trajectory.jsonl 2> ../stderr.log ) || echo "claude exited non-zero (see $RUN/stderr.log)"

python3 - "$RUN/trajectory.jsonl" > "$RUN/report.md" <<'PY'
import json, sys
for line in open(sys.argv[1]):
    try:
        d = json.loads(line)
    except json.JSONDecodeError:
        continue
    if d.get("type") == "result":
        print(d.get("result", ""))
PY

echo "run complete: $RUN"
