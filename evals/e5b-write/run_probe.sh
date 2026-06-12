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

# allowedTools NOTE (changed 2026-06-11 AFTER the reported run, which was pure
# "Bash(curl:*)"): Write is allowed so agents can compose a scratch .ttl and send it
# with `curl --data-binary @file` — the curl-only sandbox forced inline `-d` bodies,
# which collide with curl's leading-@ file semantics (Turtle starts with @prefix;
# exit 26). The Pod-interaction constraint (HTTP via curl only) is unchanged and
# enforced by the prompt; local scratch composition is not a Pod interaction.
( cd "$RUN/workdir" && env -u ANTHROPIC_API_KEY claude -p "$PROMPT" \
    --model "${PROBE_MODEL:-sonnet}" --max-turns "${PROBE_MAX_TURNS:-60}" \
    --allowedTools "Bash(curl:*),Write" \
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
