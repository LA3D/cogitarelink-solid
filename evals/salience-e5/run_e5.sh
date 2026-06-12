#!/bin/bash
# RQ-Salience-1 E5: does a Pod-agnostic DISPOSITION preamble (break confirm-mode) make
# a curl agent audit + surface the contestation, where H1 (same signal, no preamble)
# missed it 4:1? curl-only. Plant first: ./setup/plant_e5.sh   Usage: ./run_e5.sh [tag]
set -euo pipefail
cd "$(dirname "$0")"
TAG="${1:-run1}"
RUN="runs/e5-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/e5-content.txt)

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
