#!/bin/bash
# Swap the live write contract to the given arm's shape variant (a|b; arm c uses b).
set -euo pipefail
cd "$(dirname "$0")"
ARM="${1:?usage: set_arm.sh a|b}"
[ "$ARM" = "c" ] && ARM=b
curl -sk -o /dev/null -w "PUT note.shacl.ttl (arm $ARM): %{http_code}\n" -X PUT \
  -H 'Content-Type: text/turtle' "https://pod.vardeman.me/vault/probe-w/note.shacl.ttl" \
  --data-binary "@shape-$ARM.ttl"
