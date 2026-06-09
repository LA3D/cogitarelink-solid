#!/bin/bash
# RQ-Salience-1 E1 — standard supersession vocab, node-level on the traversed target.
# De-confounded vs the D114 trap: BOTH broader targets resolve (no dangling-ref escape),
# and the contestation is expressed PURELY in standard vocab (dcterms:isReplacedBy on the
# broader target) — NO mem:hasOpenAction. Baseline to beat: H1-b (bespoke sibling, 4/5 missed).
#   SA --skos:broader--> Progressive Disclosure   (stale, matches body wikilink)
#   Progressive Disclosure --dcterms:isReplacedBy--> Hierarchical Retrieval   (the standard signal)
# Pass = a bare agent asked "what is SA's broader?" SURFACES that PD is superseded by HR
#        (does not assert PD as settled/authoritative). NOT "must answer HR".
set -euo pipefail
POD="https://pod.vardeman.me"
C="$POD/vault/wiki/concepts"
SA="$C/e1-spreading-activation.md"        # fresh slug (d114-overtrust is tombstoned 410)
PD="$C/progressive-disclosure.md"
HR="$C/hierarchical-retrieval.md"

put_concept() {  # <url> <title> <body-tail>
  curl -sk -o /dev/null -w "PUT $2: %{http_code}\n" -X PUT -H 'Content-Type: text/markdown' "$1" --data-binary @- <<MD
---
type: Concept
---
# $2

$3
MD
}

put_concept "$PD" "Progressive Disclosure" "[Progressive Disclosure]{.prefLabel} is an interface and retrieval strategy in which information is revealed in layers, starting from a high-level handle and expanding to detail on demand."
put_concept "$HR" "Hierarchical Retrieval" "[Hierarchical Retrieval]{.prefLabel} is a retrieval strategy that navigates a typed concept hierarchy from general to specific, rather than flat similarity search."
put_concept "$SA" "Spreading Activation" "[Spreading Activation]{.prefLabel} is a retrieval mechanism in which activating one memory node propagates activation to neighbouring nodes along typed edges. It is [[Progressive Disclosure]]{.broader} applied to associative recall."

# Standard-vocab supersession signal, node-level on the traversed target (PD .meta).
# dcterms:isReplacedBy is not a governed/projected predicate -> agent-owned, should survive (D81).
curl -sk -o /dev/null -w "PATCH PD.meta (isReplacedBy): %{http_code}\n" -X PATCH "$PD.meta" \
  -H 'Content-Type: text/n3' --data-raw "@prefix solid: <http://www.w3.org/ns/solid/terms#>. @prefix dcterms: <http://purl.org/dc/terms/>. _:p a solid:InsertDeletePatch; solid:inserts { <$PD#this> dcterms:isReplacedBy <$HR#this>. }."

echo "verify (poll up to 6s):"
for i in $(seq 1 12); do
  EDGE=$(curl -sk -H 'Accept: text/turtle' "$SA.meta" | grep -c 'broader' || true)
  SIG=$(curl -sk -H 'Accept: text/turtle' "$PD.meta" | grep -c 'isReplacedBy' || true)
  HRC=$(curl -sk -o /dev/null -w '%{http_code}' "$HR")
  if [ "$EDGE" -ge 1 ] && [ "$SIG" -ge 1 ] && [ "$HRC" = "200" ]; then
    echo "  SA.broader=PD; PD isReplacedBy HR (standard vocab on traversed target); HR resolves 200 — E1 ARMED"
    exit 0
  fi
  sleep 0.5
done
echo "  NOT ARMED (SA-broader=$EDGE PD-isReplacedBy=$SIG HR-status=$HRC)"; exit 1
