#!/bin/bash
# Pre-flight (the E7 lesson): verify the trap mechanics BEFORE burning agent runs.
# 1. floor 422s a typed-but-rationale-less note, with the ARM-CORRECT message text
# 2. floor 201s a conformant note
# 3. shape swap is LIVE (arm A vs B 422 text differs)
# 4. the investigation path exists (mem ontology + an operations trail are reachable)
set -uo pipefail
cd "$(dirname "$0")"
POD="https://pod.vardeman.me"
NOTES="$POD/vault/probe-w/notes/"

bad_note() { cat <<TTL
@prefix schema: <https://schema.org/> .
<> a schema:Report ; schema:name "preflight bad" ; schema:text "no rationale here" .
TTL
}
good_note() { cat <<TTL
@prefix schema: <https://schema.org/> .
@prefix mem: <$POD/vault/ontology/mem#> .
<> a schema:Report ; schema:name "preflight good" ; schema:text "finding" ;
   mem:rationale "preflight conformance check" .
TTL
}

for ARM in a b; do
  ./set_arm.sh $ARM >/dev/null
  R=$(bad_note | curl -sk -X POST -H 'Content-Type: text/turtle' -H 'Slug: preflight-bad' "$NOTES" --data-binary @- -w "\n%{http_code}")
  CODE=$(echo "$R" | tail -1)
  echo "arm $ARM bad-note POST -> $CODE (expect 422)"
  echo "$R" | grep -o "mem:rationale is required[^\"]*" | head -1 || echo "$R" | grep -io "rationale[^\"]*" | head -2
done

./set_arm.sh a >/dev/null
G=$(good_note | curl -sk -o /dev/null -X POST -H 'Content-Type: text/turtle' -H 'Slug: preflight-good' "$NOTES" --data-binary @- -w "%{http_code}")
echo "good-note POST -> $G (expect 201)"
curl -sk -o /dev/null -w "GET created -> %{http_code} (expect 200)\n" "${NOTES}preflight-good"
./cleanup.sh

echo "--- investigation path ---"
curl -sk -o /dev/null -w "mem ontology -> %{http_code}\n" -H 'Accept: text/turtle' "$POD/vault/ontology/mem"
curl -sk -o /dev/null -w "wiki .operations/ -> %{http_code}\n" -H 'Accept: text/turtle' "$POD/vault/wiki/.operations/"
curl -sk -o /dev/null -w "how-wiki-memory-works -> %{http_code}\n" "$POD/vault/wiki/procedures/how-wiki-memory-works.md"
