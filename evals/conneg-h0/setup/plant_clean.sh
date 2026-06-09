#!/bin/bash
# H0 (RQ-Conneg-1): a CLEAN concept — no staleness trap, no open action.
# The body carries prose + a broader wikilink, but deliberately NO metadata.
# The H0 question asks for dct:modified + dct:conformsTo, which live ONLY in the
# <>-page graph (Accept: text/turtle / describedby->.meta), never in the markdown
# body. So the only path to the answer is content negotiation or the description
# resource — which is exactly what H0 measures.
set -euo pipefail
POD="https://pod.vardeman.me"
TARGET="$POD/vault/wiki/concepts/h0-conneg.md"

curl -sk -o /dev/null -w "PUT concept: %{http_code}\n" -X PUT \
  -H 'Content-Type: text/markdown' "$TARGET" --data-binary @- <<'MD'
---
type: Concept
---
# Transactive Memory

[Transactive Memory]{.prefLabel} is a shared store of knowledge held across the
members of a group, where individuals specialise and rely on one another to
encode, store, and retrieve information. It is [[Distributed Cognition]]{.broader}
applied to the division of memory labour within a team.
MD

echo "verify graph-only facts are live (poll up to 6s):"
for i in $(seq 1 12); do
  TTL=$(curl -sk -H 'Accept: text/turtle' "$TARGET")
  MOD=$(printf '%s' "$TTL" | grep -c 'modified' || true)
  CON=$(printf '%s' "$TTL" | grep -c 'conformsTo' || true)
  BODYHASMOD=$(curl -sk "$TARGET" | grep -ci 'modified' || true)
  if [ "$MOD" -ge 1 ] && [ "$CON" -ge 1 ]; then
    echo "  turtle view carries dct:modified + dct:conformsTo; body mentions 'modified' $BODYHASMOD times — GRAPH-ONLY QUESTION ARMED"
    exit 0
  fi
  sleep 0.5
done
echo "  NOT ARMED — investigate (turtle modified=$MOD conformsTo=$CON)"
exit 1
