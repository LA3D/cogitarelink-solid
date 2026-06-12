#!/bin/bash
# RQ-Conneg-1 H0: do cold agents do plain content negotiation / follow describedby?
# One cold headless claude (Sonnet), empty cwd outside all repos, curl-only.
# Usage: ./run_h0.sh <a|b|c> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="$1"; TAG="${2:-run1}"
RUN="runs/h0$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/h0$ARM-*.txt)

( cd "$RUN/workdir" && env -u ANTHROPIC_API_KEY claude -p "$PROMPT" \
    --model "${PROBE_MODEL:-sonnet}" --max-turns "${PROBE_MAX_TURNS:-60}" \
    --allowedTools "Bash(curl:*)" \
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
echo "  report:     $RUN/report.md"
echo "  trajectory: $RUN/trajectory.jsonl"
