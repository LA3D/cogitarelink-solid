#!/bin/bash
# Grader snapshot — capture the agent-facing surfaces at grading time.
# Run immediately AFTER a probe and BEFORE cleanup.
set -euo pipefail
POD="https://pod.vardeman.me"
TARGET="${1:-$POD/vault/wiki/concepts/vl-probe-topic.md}"

echo "=== default GET body of $TARGET (what the cold agent saw) ==="
curl -sk "$TARGET"

echo
echo "=== ?_profile=doc (pristine escape hatch — should NOT carry the trailer) ==="
curl -sk "$TARGET?_profile=doc"

echo
echo "=== Link headers on $TARGET ==="
curl -sk -I "$TARGET" | grep -i '^link:' || echo "  (none)"

echo
echo "=== /id/.operations/ ledger ==="
curl -sk "$POD/id/.operations/" -H 'Accept: text/turtle' \
  | ~/uvws/.venv/bin/python -c "
import sys
from rdflib import Graph, URIRef
g = Graph(); g.parse(data=sys.stdin.read(), format='turtle', publicID='$POD/id/.operations/')
for o in g.objects(URIRef('$POD/id/.operations/'), URIRef('http://www.w3.org/ns/ldp#contains')): print(o)
" | sort -u | while read -r op; do
  echo "--- $op"; curl -sk "$op" -H 'Accept: text/turtle'
done
