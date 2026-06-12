#!/bin/bash
# SP2 GATE (T13) — end-to-end contract walk. ONE task spanning two apps across the
# disclosure layers: orient (storage description) → route the wiki leg via the derived
# index (not enumeration) → audit governance before declaring "current" → route the
# addressbook leg per its operation-shaped consumption hint (declared affordance, not
# member enumeration). Arms:
#   bare  = no skill, curl only              (control: expected to miss legs)
#   skill = pod-navigate + the solid-pod CLI (the SP1 consumption channel, Tier-3)
# Plant first: ./setup/plant_e2e.sh (from a COPY outside any repo).
# Usage: ./run_e2e.sh <bare|skill> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="${1:?usage: run_e2e.sh <bare|skill> [tag]}"
TAG="${2:-run1}"
RUN="runs/$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/e2e.txt)

TOOLS="Bash(curl:*)"
EXTRA_PATH=""
if [ "$ARM" = "skill" ]; then
  : "${SOLID_AGENT_SKILLS:?set SOLID_AGENT_SKILLS to the solid-agent-skills checkout}"
  TOOLS="Bash(curl:*),Bash(solid-pod:*),Skill"
  EXTRA_PATH="$(pwd)/bin:"
  mkdir -p "$RUN/workdir/.claude/skills"
  cp -R "$SOLID_AGENT_SKILLS/skills/pod-navigate" "$RUN/workdir/.claude/skills/"
  PROMPT="$PROMPT

A command-line tool \`solid-pod\` is available in your environment. Examples:
  solid-pod read <url>                     (fused body+metadata in one call)
  solid-pod sparql <url> \"<SPARQL query>\"  (runs a query via embedded Comunica)
  solid-pod affordances <url>              (lists the Pod's declared affordances)
  solid-pod invoke <resource-url> <name>   (runs a resource-scoped affordance)
You may use it or plain curl."
fi

( cd "$RUN/workdir" && PATH="$EXTRA_PATH$PATH" \
    NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-$(mkcert -CAROOT)/rootCA.pem}" \
    env -u ANTHROPIC_API_KEY claude -p "$PROMPT" \
      --model sonnet \
      --allowedTools "$TOOLS" \
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
