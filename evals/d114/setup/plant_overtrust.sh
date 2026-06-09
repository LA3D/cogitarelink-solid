#!/bin/bash
# The over-trust trap (D114 eval, the centerpiece).
# Plant a concept whose BODY in-band wikilink says broader = [[Progressive Disclosure]],
# then file an open mem:RealignAction declaring that body link STALE and the authoritative
# broader is [[Hierarchical Retrieval]]. Now the two views DISAGREE:
#   - document view (body wikilink): broader = Progressive Disclosure  (the convenience projection)
#   - authoritative graph (.meta + open action): that link is under realignment; real broader = Hierarchical Retrieval
# A graph question ("what broader topic is this filed under?") then separates:
#   - OVER-TRUST  = answer "Progressive Disclosure" from the body, no caveat  (the RQ-View-2 failure)
#   - AUTHORITATIVE = surface the open action / staleness (only reachable via fused read or the .meta)
set -euo pipefail
POD="https://pod.vardeman.me"
MEM="$POD/vault/ontology/mem#"
DESC="$POD/vault/meta/affordances/curation.ttl"
TARGET="$POD/vault/wiki/concepts/d114-overtrust.md"

curl -sk -o /dev/null -w "PUT concept: %{http_code}\n" -X PUT \
  -H 'Content-Type: text/markdown' "$TARGET" --data-binary @- <<'MD'
---
type: Concept
---
# Spreading Activation

[Spreading Activation]{.prefLabel} is a retrieval mechanism in which activating one
memory node propagates activation to neighbouring nodes along typed edges, so that
related concepts become more retrievable. It is [[Progressive Disclosure]]{.broader}
applied to associative recall.
MD

cat > /tmp/d114-overtrust-op.ttl <<TTL
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <$MEM> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce , mem:RealignAction , prov:Activity ;
    as:object <$TARGET> ;
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    mem:rationale "The skos:broader target in the body ([[Progressive Disclosure]]) is stale; this concept was re-filed under [[Hierarchical Retrieval]]. The body wikilink has not yet been realigned — treat the graph as authoritative." ;
    prov:qualifiedAssociation [ a prov:Association ;
        prov:agent <urn:agent:d114-eval-harness> ;
        prov:hadPlan <$DESC> ] ;
    as:published "2026-06-07T12:00:00Z"^^xsd:dateTime .
TTL

LOC=$(curl -sk -i -X POST -H 'Content-Type: text/turtle' "$POD/id/.operations/" \
  --data-binary @/tmp/d114-overtrust-op.ttl | grep -i '^location:' | awk '{print $2}' | tr -d '\r')
echo "open action: $LOC"

echo "verify the disagreement is live (poll up to 6s):"
for i in $(seq 1 12); do
  FUSED=$(curl -sk "$TARGET?_profile=fused" | grep -c 'hasOpenAction' || true)
  BODY=$(curl -sk "$TARGET" | grep -c 'Progressive Disclosure' || true)
  if [ "$FUSED" -ge 1 ] && [ "$BODY" -ge 1 ]; then
    echo "  body says broader=Progressive Disclosure; fused view carries the open action — TRAP ARMED"
    exit 0
  fi
  sleep 0.5
done
echo "  TRAP NOT ARMED — investigate (fused hasOpenAction=$FUSED, body PD=$BODY)"
exit 1
