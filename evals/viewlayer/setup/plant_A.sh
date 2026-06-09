#!/bin/bash
# Arm A plant: a markdown wiki concept + ONE open curation action targeting it.
# The OperationsIndexListener derives mem:hasOpenAction into the concept's .meta;
# the TrailerDecoratingStore then appends a <!-- pod:notice --> trailer to the
# DEFAULT GET body (the channel D112 Probe-2 proved the Link header could not reach).
# A cold curl agent doing an ordinary "summarize this note" task fetches the body
# and the trailer is unavoidably in context — this converts the D112 DELIVERY
# failure into a pure SALIENCE test.
set -euo pipefail
POD="https://pod.vardeman.me"
MEM="$POD/vault/ontology/mem#"
DESC="$POD/vault/meta/affordances/curation.ttl"
TARGET="$POD/vault/wiki/concepts/vl-probe-topic.md"

# 1. Plant a conformant concept (prefLabel literal span + broader; passes the floor).
curl -sk -o /dev/null -w "PUT concept: %{http_code}\n" -X PUT \
  -H 'Content-Type: text/markdown' "$TARGET" --data-binary @- <<'MD'
---
type: Concept
---
# Tiered Retrieval

[Tiered Retrieval]{.prefLabel} is the memory-substrate practice of serving
results from progressively deeper, higher-cost stores — a small fast tier
answers most reads, and only misses fall through to slower, broader tiers.
It is one of the seven memory-substrate invariants and is [[Progressive
Disclosure]]{.broader} applied to retrieval rather than to navigation.

Bounded branching keeps each tier's fan-out under the routing limit so the
tier boundary stays a reliable discriminator rather than a flat scan.
MD

# 2. Plant ONE open action on it (body mirrors tests/test_view_layer_integration.py
#    _proposal_body; rationale is a realistic staleness note, not a test giveaway).
LOC=$(curl -sk -i -o - -X POST -H 'Content-Type: text/turtle' \
  "$POD/id/.operations/" --data-binary @- <<TTL
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <$MEM> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce , mem:RealignAction , prov:Activity ;
    as:object <$TARGET> ;
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    mem:rationale "The skos:broader target [[Progressive Disclosure]] was renamed; this link needs realignment before the note is treated as authoritative." ;
    prov:qualifiedAssociation [ a prov:Association ;
        prov:agent <urn:agent:viewlayer-probe-harness> ;
        prov:hadPlan <$DESC> ] ;
    as:published "2026-06-07T12:00:00Z"^^xsd:dateTime .
TTL
)
LOC=$(printf '%s' "$LOC" | grep -i '^location:' | awk '{print $2}' | tr -d '\r')
echo "proposal created at: $LOC"

echo "trailer in default GET body (poll up to 6s):"
for i in $(seq 1 12); do
  if curl -sk "$TARGET" | grep -q '<!-- pod:notice'; then
    echo "  TRAILER PRESENT"; exit 0
  fi
  sleep 0.5
done
echo "  TRAILER NOT PRESENT — investigate before running probe A"
exit 1
