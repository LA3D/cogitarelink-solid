#!/bin/bash
# Remove probe residue between ensemble runs / after the eval.
#   cleanup.sh proposals   — delete ALL proposals in /id/.operations/ (listener
#                            clears back-pointers; same-uptime only, FOLLOWUPS item 2)
#   cleanup.sh scheme      — delete the planted acme-asset record
#   cleanup.sh all         — both
# NOTE: run between probe-1 ensemble runs so every cold agent sees the same
# initial state (run N must not see run N-1's proposals).
set -euo pipefail
POD="https://pod.vardeman.me"
MODE="${1:-all}"

if [ "$MODE" = "proposals" ] || [ "$MODE" = "all" ]; then
  curl -s "$POD/id/.operations/" -H 'Accept: text/turtle' \
    | ~/uvws/.venv/bin/python -c "
import sys
from rdflib import Graph, URIRef
g = Graph(); g.parse(data=sys.stdin.read(), format='turtle', publicID='$POD/id/.operations/')
for o in g.objects(URIRef('$POD/id/.operations/'), URIRef('http://www.w3.org/ns/ldp#contains')): print(o)
" | sort -u | while read -r op; do
    curl -s -o /dev/null -w "DELETE $op: %{http_code}\n" -X DELETE "$op"
  done
  sleep 1
  echo "orcid back-pointer after cleanup (expect empty):"
  curl -s -I "$POD/id/schemes/orcid" | grep -i 'hasOpenAction' || echo "  clear"
fi

if [ "$MODE" = "scheme" ] || [ "$MODE" = "all" ]; then
  curl -s -o /dev/null -w "DELETE acme-asset: %{http_code}\n" -X DELETE "$POD/id/schemes/acme-asset"
  sleep 1
  echo "catalog entry after cleanup (expect 0):"
  curl -s "$POD/id/schemes/" -H 'Accept: text/turtle' | grep -c 'acme-asset' || true
fi
