#!/bin/bash
# Capture every agent-created note (body + .meta) into the given dir — run BEFORE cleanup.
set -euo pipefail
POD="https://pod.vardeman.me"
NOTES="$POD/vault/probe-w/notes/"
OUT="${1:?usage: check_state.sh <out-dir>}"
mkdir -p "$OUT"
MEMBERS=$(curl -sk -H 'Accept: text/turtle' "$NOTES" | grep -oE 'contains> *<[^>]+>|<[^>]+>\s*\.' | grep -oE 'https?://[^>]+|<[a-zA-Z0-9._%-]+>' || true)
# robust member listing via ldp:contains
MEMBERS=$(curl -sk -H 'Accept: text/turtle' "$NOTES" | python3 -c "
import sys,re
t=sys.stdin.read()
for m in re.findall(r'ldp[:#]contains>?\s*((?:<[^>]+>,?\s*)+)', t.replace('ldp:contains','<http://www.w3.org/ns/ldp#contains>')):
    for u in re.findall(r'<([^>]+)>', m): print(u)
" | sort -u)
echo "members:" ; echo "$MEMBERS"
i=0
for m in $MEMBERS; do
  case "$m" in http*) url="$m" ;; *) url="$NOTES$m" ;; esac
  i=$((i+1))
  curl -sk -H 'Accept: text/turtle' "$url"        > "$OUT/note$i.ttl"
  curl -sk -H 'Accept: text/turtle' "$url.meta"   > "$OUT/note$i.meta.ttl" 2>/dev/null || true
  echo "$url" > "$OUT/note$i.url"
done
echo "captured $i note(s) into $OUT"
