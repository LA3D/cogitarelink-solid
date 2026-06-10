#!/bin/bash
# RQ-Salience-1 E5 — DISPOSITION. Same REAL substrate signal as the D114 trap
# (mem:RealignAction open action + derived mem:hasOpenAction), de-confounded (both
# broader targets resolve). Tools = curl only — apples-to-apples with H1 (which had
# the same signal in .meta + Link header and missed it 4:1 in confirm-mode). The ONLY
# change vs H1 is the prompt's disposition preamble. Tests: does breaking confirm-mode
# make a curl agent audit + surface the contestation?
set -euo pipefail
POD="https://pod.vardeman.me"
C="$POD/vault/wiki/concepts"
MEM="$POD/vault/ontology/mem#"
DESC="$POD/vault/meta/affordances/curation.ttl"
SA="$C/e5-spreading-activation.md"
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
put_concept "$PD" "Progressive Disclosure" "[Progressive Disclosure]{.prefLabel} reveals information in layers, from a high-level handle to detail on demand."
put_concept "$HR" "Hierarchical Retrieval" "[Hierarchical Retrieval]{.prefLabel} navigates a typed concept hierarchy from general to specific, rather than flat similarity search."
put_concept "$SA" "Spreading Activation" "[Spreading Activation]{.prefLabel} is a retrieval mechanism in which activating one memory node propagates activation to neighbouring nodes along typed edges. It is [[Progressive Disclosure]]{.broader} applied to associative recall."

cat > /tmp/e5-op.ttl <<TTL
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <$MEM> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce , mem:RealignAction , prov:Activity ;
    as:object <$SA> ;
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    mem:rationale "The skos:broader target in the body ([[Progressive Disclosure]]) is stale; this concept was re-filed under [[Hierarchical Retrieval]]. The body wikilink has not yet been realigned — treat the graph as authoritative." ;
    prov:qualifiedAssociation [ a prov:Association ;
        prov:agent <urn:agent:e5-harness> ;
        prov:hadPlan <$DESC> ] ;
    as:published "2026-06-09T13:00:00Z"^^xsd:dateTime .
TTL
LOC=$(curl -sk -i -X POST -H 'Content-Type: text/turtle' "$POD/id/.operations/" --data-binary @/tmp/e5-op.ttl | grep -i '^location:' | awk '{print $2}' | tr -d '\r')
echo "open action: $LOC"

echo "verify (poll up to 8s):"
for i in $(seq 1 16); do
  OA=$(curl -sk -H 'Accept: text/turtle' "$SA.meta" | grep -c 'hasOpenAction' || true)
  HRC=$(curl -sk -o /dev/null -w '%{http_code}' "$HR")
  PDC=$(curl -sk -o /dev/null -w '%{http_code}' "$PD")
  if [ "$OA" -ge 1 ] && [ "$HRC" = "200" ] && [ "$PDC" = "200" ]; then
    echo "  SA.meta carries mem:hasOpenAction; both broader targets resolve 200 — E5 ARMED (same signal as H1; only the prompt differs)"
    exit 0
  fi
  sleep 0.5
done
echo "  NOT ARMED (hasOpenAction=$OA HR=$HRC PD=$PDC)"; exit 1
