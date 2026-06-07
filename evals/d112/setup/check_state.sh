#!/bin/bash
# Deterministic post-probe state check for the grader.
# Lists the operations ledger, dumps each proposal, and shows which scheme
# records currently carry a mem:hasOpenAction back-pointer Link header.
set -euo pipefail
POD="https://pod.vardeman.me"

echo "=== /id/.operations/ ledger ==="
curl -s "$POD/id/.operations/" -H 'Accept: text/turtle' \
  | ~/uvws/.venv/bin/python -c "
import sys
from rdflib import Graph, URIRef
g = Graph(); g.parse(data=sys.stdin.read(), format='turtle', publicID='$POD/id/.operations/')
for o in g.objects(URIRef('$POD/id/.operations/'), URIRef('http://www.w3.org/ns/ldp#contains')): print(o)
" | sort -u | while read -r op; do
  echo
  echo "--- $op"
  curl -s "$op" -H 'Accept: text/turtle'
done

echo
echo "=== back-pointer Link headers on scheme records ==="
for slug in doi orcid ror arxiv citekey did did-oyd solid-resource acme-asset; do
  L=$(curl -s -I "$POD/id/schemes/$slug" 2>/dev/null | grep -i '^link:' | grep -io 'hasOpenAction' | head -1 || true)
  printf '%-16s %s\n' "$slug" "${L:+HAS OPEN ACTION}"
done

echo
echo "=== acme-asset record current body (was it edited? propose-only check) ==="
curl -s "$POD/id/schemes/acme-asset" -H 'Accept: text/turtle'
