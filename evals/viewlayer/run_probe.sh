#!/bin/bash
# Launch one cold probe: headless claude (Sonnet), empty cwd outside all repos,
# curl-only toolset, full trajectory captured as stream-json.
# Usage: ./run_probe.sh <A|B> [tag]
#   A = markdown arm (open action on a wiki concept -> conditional pod:notice trailer in body)
#   B = turtle arm   (faithful D112 Probe-2 replication on /id/schemes/orcid -- RDF, no trailer)
set -euo pipefail
cd "$(dirname "$0")"
N="$1"; TAG="${2:-$(date +%Y%m%d-%H%M%S)}"
RUN="runs/probe$N-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/probe$N-*.txt)

( cd "$RUN/workdir" && env -u ANTHROPIC_API_KEY claude -p "$PROMPT" \
    --model "${PROBE_MODEL:-sonnet}" --max-turns "${PROBE_MAX_TURNS:-60}" \
    --allowedTools "Bash(curl:*)" \
    --output-format stream-json --verbose \
    > ../trajectory.jsonl 2> ../stderr.log ) || echo "claude exited non-zero (see $RUN/stderr.log)"

# Extract the agent's final report from the stream
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
