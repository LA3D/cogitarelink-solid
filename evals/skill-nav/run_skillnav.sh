#!/bin/bash
# SP1 gate — does a SKILL-delivered disposition bundle reproduce the prompt-injected
# gold (E5 3/3 / E7-combined)? Same de-confounded E5 trap; NEUTRAL prompt (no
# disposition preamble — H1 conditions); the ONLY variable is the pod-navigate skill
# installed in the workdir's .claude/skills/. Arms:
#   skill = pod-navigate installed (the SP1 arm)
#   bare  = no skill (H1-style baseline sanity; expect the 4:1 miss)
# Plant first: ../salience-e5/setup/plant_e5.sh
# Run from a COPY outside any repo (cp -R evals/skill-nav evals/salience-e5 ~/dev/probes/)
# so no repo CLAUDE.md leaks into the cold agent.
# Usage: ./run_skillnav.sh <skill|bare> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="${1:?usage: run_skillnav.sh <skill|bare> [tag]}"
TAG="${2:-run1}"
RUN="runs/$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/neutral.txt)

if [ "$ARM" = "skill" ]; then
  : "${SOLID_AGENT_SKILLS:?set SOLID_AGENT_SKILLS to the solid-agent-skills checkout}"
  mkdir -p "$RUN/workdir/.claude/skills"
  cp -R "$SOLID_AGENT_SKILLS/skills/pod-navigate" "$RUN/workdir/.claude/skills/"
fi

( cd "$RUN/workdir" && claude -p "$PROMPT" \
    --model sonnet \
    --allowedTools "Bash(curl:*),Skill" \
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
