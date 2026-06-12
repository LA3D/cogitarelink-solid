#!/bin/bash
# Index-view probe runner. Arm a = bare ldp:contains (probe-a/); arm b = definition-line
# index view present (probe-b/). Same locate-among-30 task; the ONLY difference is the
# container (and thus the presence of index.md). Measures whether a discoverable
# definition-line index reduces fetch count / wrong-resource GETs vs brute-force.
# Plant first: ./setup/plant_idx.sh   Usage: ./run_idx.sh <a|b> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="${1:?usage: run_idx.sh <a|b> [tag]}"
TAG="${2:-run1}"
case "$ARM" in
  a) CONTAINER="https://pod.vardeman.me/vault/probe-a/" ;;
  b) CONTAINER="https://pod.vardeman.me/vault/probe-b/" ;;
  *) echo "arm must be a or b"; exit 1 ;;
esac
RUN="runs/$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(sed "s#CONTAINER_URL#$CONTAINER#g" prompts/task.tmpl.txt)

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
