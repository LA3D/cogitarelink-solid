#!/bin/bash
# Remove probe residue. Deletes a concept's .md (CSS removes the paired .meta).
#   cleanup.sh va        — delete agent-authored cellular-respiration note(s)
#   cleanup.sh fixture   — delete the V-B ecology fixture
#   cleanup.sh all       — both
# NOTE: same-uptime only (projection listener seen-map is in-memory, like D112).
set -euo pipefail
POD="https://pod.vardeman.me"
MODE="${1:-all}"

del() {
  for slug in "$@"; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$POD/vault/wiki/concepts/$slug.md")
    [ "$code" = "200" ] && curl -s -o /dev/null -w "DELETE $slug.md: %{http_code}\n" -X DELETE "$POD/vault/wiki/concepts/$slug.md"
  done
}

{ [ "$MODE" = "va" ] || [ "$MODE" = "all" ]; } && del cellular-respiration cellular_respiration respiration cellularrespiration || true
{ [ "$MODE" = "fixture" ] || [ "$MODE" = "all" ]; } && del ecology || true

echo "Biology narrower edges after cleanup:"
curl -s "$POD/vault/wiki/concepts/biology.md.meta" -H 'Accept: text/turtle' | grep -ic 'narrower' || true
