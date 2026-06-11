#!/bin/bash
# Write-side E5b twin (spec §12): does the floor's instruction content (arm B) or the
# agent-side write disposition (arm C) buy rationale QUALITY over the presence-only
# floor (arm A)? One run = set shape variant -> cold sonnet agent, curl-only ->
# capture created notes -> cleanup. Plant first: ./setup/plant.sh
# Usage: ./run_probe.sh <a|b|c> <tag>
set -euo pipefail
cd "$(dirname "$0")"
ARM="${1:?usage: run_probe.sh <a|b|c> <tag>}"
TAG="${2:-run1}"
RUN="runs/$ARM-$TAG"
mkdir -p "$RUN/workdir"

./setup/set_arm.sh "$ARM"
case "$ARM" in
  c) PROMPT=$(cat prompts/task-c.txt) ;;
  *) PROMPT=$(cat prompts/task-ab.txt) ;;
esac

( cd "$RUN/workdir" && claude -p "$PROMPT" \
    --model sonnet \
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

./setup/check_state.sh "$RUN/pod-state"
./setup/cleanup.sh
echo "run complete: $RUN"
