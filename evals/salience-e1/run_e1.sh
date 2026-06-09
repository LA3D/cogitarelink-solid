#!/bin/bash
# RQ-Salience-1 E1: does STANDARD supersession vocab (dcterms:isReplacedBy) on the
# traversed target make a BARE agent surface the contestation, where bespoke
# mem:hasOpenAction (H1-b) got 4/5 missed? curl-only, bare content question.
# Plant first: ./setup/plant_e1.sh   Usage: ./run_e1.sh [tag]
set -euo pipefail
cd "$(dirname "$0")"
TAG="${1:-run1}"
RUN="runs/e1-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/e1-content.txt)

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
echo "run complete: $RUN"
