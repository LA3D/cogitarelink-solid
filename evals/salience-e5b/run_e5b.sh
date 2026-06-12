#!/bin/bash
# RQ-Salience-1 E5b — disposition STRENGTH GRADIENT on the de-confounded E5 trap
# (same mem:RealignAction signal, curl-only). Find the minimal preamble that flips
# confirm-mode -> audit-mode. l0=none / l2=why-only / l3=+where / (l4=full E5, anchored).
# Plant first: (cd ../salience-e5 && ./setup/plant_e5.sh)
# Usage: ./run_e5b.sh <l0|l2|l3> [tag]
set -euo pipefail
cd "$(dirname "$0")"
LV="$1"; TAG="${2:-run1}"
RUN="runs/$LV-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/$LV-*.txt)

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
