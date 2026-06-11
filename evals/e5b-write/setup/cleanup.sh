#!/bin/bash
# Delete all agent-created notes between ensemble runs (capture with check_state.sh FIRST).
set -euo pipefail
POD="https://pod.vardeman.me"
NOTES="$POD/vault/probe-w/notes/"
MEMBERS=$(curl -sk -H 'Accept: text/turtle' "$NOTES" | python3 -c "
import sys,re
t=sys.stdin.read()
for m in re.findall(r'ldp[:#]contains>?\s*((?:<[^>]+>,?\s*)+)', t.replace('ldp:contains','<http://www.w3.org/ns/ldp#contains>')):
    for u in re.findall(r'<([^>]+)>', m): print(u)
" | sort -u)
for m in $MEMBERS; do
  case "$m" in http*) url="$m" ;; *) url="$NOTES$m" ;; esac
  curl -sk -o /dev/null -w "DELETE $url: %{http_code}\n" -X DELETE "$url"
done
echo "cleanup done"
