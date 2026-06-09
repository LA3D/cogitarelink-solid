#!/bin/bash
# Reset D114 eval residue.
#   cleanup.sh proposals  — delete all proposals in /id/.operations/ (same-uptime only)
#   cleanup.sh concept    — delete the over-trust concept + .meta
#   cleanup.sh author     — delete the write-regression concept(s) the agent created
#   cleanup.sh all        — all of the above
set -euo pipefail
POD="https://pod.vardeman.me"
MODE="${1:-all}"

if [ "$MODE" = "proposals" ] || [ "$MODE" = "all" ]; then
  curl -sk "$POD/id/.operations/" -H 'Accept: text/turtle' \
    | ~/uvws/.venv/bin/python -c "
import sys
from rdflib import Graph, URIRef
g=Graph(); g.parse(data=sys.stdin.read(), format='turtle', publicID='$POD/id/.operations/')
for o in g.objects(URIRef('$POD/id/.operations/'), URIRef('http://www.w3.org/ns/ldp#contains')): print(o)
" | sort -u | while read -r op; do
    curl -sk -o /dev/null -w "DELETE $op: %{http_code}\n" -X DELETE "$op"
  done
fi

if [ "$MODE" = "concept" ] || [ "$MODE" = "all" ]; then
  curl -sk -o /dev/null -w "DELETE overtrust concept: %{http_code}\n" -X DELETE "$POD/vault/wiki/concepts/d114-overtrust.md"
  curl -sk -o /dev/null -w "DELETE overtrust .meta: %{http_code}\n" -X DELETE "$POD/vault/wiki/concepts/d114-overtrust.md.meta" 2>/dev/null || true
fi

if [ "$MODE" = "author" ] || [ "$MODE" = "all" ]; then
  # the write-regression agent may name its concept anything; list what's there for the grader
  echo "concepts container (grader: delete the transactive-memory concept the agent made):"
  curl -sk "$POD/vault/wiki/concepts/" -H 'Accept: text/turtle' | grep -oE 'concepts/[a-z0-9-]+\.md' | sort -u
fi
