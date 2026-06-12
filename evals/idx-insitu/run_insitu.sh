#!/bin/bash
# SP2-T12 in-situ index probe. Runs against the REAL /vault/wiki/concepts/ corpus
# (live SP2 substrate: derived definition-line index.md is a served child).
# Arms:
#   a = forbidden-index control (prompt adds "do not read index.md") — brute-force baseline
#   b = bare (unmodified prompt; the served definition-line index is discoverable)
#   c = prefLabel-only index format (swap the served index body BEFORE c runs: setup/swap_index_c.sh)
# Target = how-wiki-memory-works.md; the task paraphrases its content (two subjects /
# label properties / supply-vs-derive) and never names "wiki-memory".
# Usage: ./run_insitu.sh <a|b|c> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="${1:?usage: run_insitu.sh <a|b|c> [tag]}"
TAG="${2:-run1}"
CONTAINER="https://pod.vardeman.me/vault/wiki/concepts/"
case "$ARM" in
  a) EXTRA='- Do not read any resource named index.md.' ;;
  b|c) EXTRA='' ;;
  *) echo "arm must be a, b or c"; exit 1 ;;
esac
RUN="runs/$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(sed -e "s#CONTAINER_URL#$CONTAINER#g" -e "s#EXTRA_CONSTRAINT#$EXTRA#" prompts/task.tmpl.txt)

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
