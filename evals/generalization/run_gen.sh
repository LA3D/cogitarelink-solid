#!/bin/bash
# Generalization probe — does the disclosure discipline route a cold agent to an
# OPERATION-shaped app's declared access pattern (the addressbook's contact-find-by-orcid
# affordance), vs brute-forcing every contact or hitting the wrong store (/wiki/people/)?
# Arms:
#   bare-curl  = no skill, curl only            (baseline)
#   skill-curl = pod-navigate, curl only        (does the skill route + can curl reach it?)
#   skill-cli  = pod-navigate + solid-pod CLI    (does it route + execute via the CLI?)
# Plant first: ./setup/plant_contacts.sh (from a COPY outside any repo).
# Usage: ./run_gen.sh <bare-curl|skill-curl|skill-cli> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="${1:?usage: run_gen.sh <bare-curl|skill-curl|skill-cli> [tag]}"
TAG="${2:-run1}"
RUN="runs/$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/orcid.txt)

TOOLS="Bash(curl:*)"
EXTRA_PATH=""
case "$ARM" in
  skill-curl) TOOLS="Bash(curl:*),Skill" ;;
  skill-cli)  TOOLS="Bash(curl:*),Bash(solid-pod:*),Skill" ;;
  bare-curl)  : ;;
  *) echo "unknown arm: $ARM" >&2; exit 2 ;;
esac

case "$ARM" in
  skill-*)
    : "${SOLID_AGENT_SKILLS:?set SOLID_AGENT_SKILLS to the solid-agent-skills checkout}"
    mkdir -p "$RUN/workdir/.claude/skills"
    cp -R "$SOLID_AGENT_SKILLS/skills/pod-navigate" "$RUN/workdir/.claude/skills/" ;;
esac

if [ "$ARM" = "skill-cli" ]; then
  EXTRA_PATH="$(pwd)/bin:"
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
    claude -p "$PROMPT" \
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
