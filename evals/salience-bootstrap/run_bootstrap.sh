#!/bin/bash
# RQ-Salience-1 bootstrap test: does POD-DELIVERED disposition (audit-before-trust in
# the agentGuide that .well-known advertises) work like the PROMPT-delivered E5 did?
# consumption = generic prompt (does the agent bootstrap cold + pick it up?).
# efficacy = told to read the self-description first (given it reads it, does it catch?).
# Trap planted via ../salience-e5/setup/plant_e5.sh ; agentGuide augmented (see setup/).
# Usage: ./run_bootstrap.sh <consumption|efficacy> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="$1"; TAG="${2:-run1}"
RUN="runs/$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/$ARM-*.txt)

( cd "$RUN/workdir" && env -u ANTHROPIC_API_KEY claude -p "$PROMPT" \
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
echo "run complete: $RUN"
