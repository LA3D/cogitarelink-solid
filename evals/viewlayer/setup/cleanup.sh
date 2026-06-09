#!/bin/bash
# Reset probe residue between/after runs.
#   cleanup.sh proposals  — delete all proposals in /id/.operations/ (listener
#                           clears back-pointers; SAME-UPTIME ONLY — do not restart
#                           the CSS container between plant and cleanup)
#   cleanup.sh concept    — delete the Arm-A planted concept + its .meta
#   cleanup.sh all        — both
set -euo pipefail
POD="https://pod.vardeman.me"
MODE="${1:-all}"

if [ "$MODE" = "proposals" ] || [ "$MODE" = "all" ]; then
  curl -sk "$POD/id/.operations/" -H 'Accept: text/turtle' \
    | ~/uvws/.venv/bin/python -c "
import sys
from rdflib import Graph, URIRef
g = Graph(); g.parse(data=sys.stdin.read(), format='turtle', publicID='$POD/id/.operations/')
for o in g.objects(URIRef('$POD/id/.operations/'), URIRef('http://www.w3.org/ns/ldp#contains')): print(o)
" | sort -u | while read -r op; do
    curl -sk -o /dev/null -w "DELETE $op: %{http_code}\n" -X DELETE "$op"
  done
  sleep 1
  echo "trailer on the concept after cleanup (expect none):"
  curl -sk "$POD/vault/wiki/concepts/vl-probe-topic.md" | grep -c '<!-- pod:notice' || true
  echo "orcid back-pointer after cleanup (expect clear):"
  curl -sk -I "$POD/id/schemes/orcid" | grep -i 'hasOpenAction' || echo "  clear"
fi

if [ "$MODE" = "concept" ] || [ "$MODE" = "all" ]; then
  curl -sk -o /dev/null -w "DELETE concept: %{http_code}\n" -X DELETE "$POD/vault/wiki/concepts/vl-probe-topic.md"
  curl -sk -o /dev/null -w "DELETE concept .meta: %{http_code}\n" -X DELETE "$POD/vault/wiki/concepts/vl-probe-topic.md.meta" || true
fi
