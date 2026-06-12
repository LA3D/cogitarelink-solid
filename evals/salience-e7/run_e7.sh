#!/bin/bash
# RQ-Salience-1 E7 — GROUNDING disposition. Same de-confounded E5 trap (real
# mem:RealignAction open action + derived mem:hasOpenAction, both broader targets
# resolve, curl-only). The ONLY change vs H1 is the prompt preamble. Two arms:
#   g  = grounding-only ("dereference unfamiliar terms before relying on the data")
#   ga = grounding + audit (E5 audit preamble + grounding) — predicted strongest
# Tests: does installing a "ground unknown terms" disposition make a curl agent
# dereference mem:hasOpenAction, learn it flags a pending realignment, and surface
# the contestation — where H1 (same signal, no preamble) missed it 4:1?
# Plant first: ./setup/plant_e7.sh   Usage: ./run_e7.sh <g|ga> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="${1:?usage: run_e7.sh <g|ga> [tag]}"
TAG="${2:-run1}"
case "$ARM" in
  g)  PROMPT_FILE=prompts/g-grounding.txt ;;
  ga) PROMPT_FILE=prompts/ga-combined.txt ;;
  *)  echo "arm must be g or ga"; exit 1 ;;
esac
RUN="runs/$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat "$PROMPT_FILE")

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
