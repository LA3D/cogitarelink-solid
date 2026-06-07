#!/bin/bash
# Probe-2 plant: one open curation action targeting the orcid scheme record.
# Body mirrors tests/test_curation_protocol_e2e.py (conformant proposal → 201;
# OperationsIndexListener derives the mem:hasOpenAction back-pointer; the
# CurationLinkMetadataWriter surfaces it as a Link header on the target).
# Run AFTER the probe-1 ensemble is done and cleaned up.
set -euo pipefail
POD="https://pod.vardeman.me"
MEM="$POD/vault/ontology/mem#"
DESC="$POD/vault/meta/affordances/curation.ttl"
TARGET="$POD/id/schemes/orcid"

LOC=$(curl -s -i -o - -X POST \
  -H 'Content-Type: text/turtle' \
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
    mem:rationale "Planted by the D112 probe-2 harness: verify the orcid pub-api provider still returns application/json for sample ID 0000-0003-4091-6059." ;
    prov:qualifiedAssociation [ a prov:Association ;
        prov:agent <urn:agent:d112-probe-harness> ;
        prov:hadPlan <$DESC> ] ;
    as:published "2026-06-06T12:00:00Z"^^xsd:dateTime .
TTL
)
LOC=$(printf '%s' "$LOC" | grep -i '^location:' | awk '{print $2}' | tr -d '\r')
echo "proposal created at: $LOC"

echo "back-pointer Link header on target (poll up to 5s):"
for i in $(seq 1 10); do
  LINKS=$(curl -s -I "$TARGET" | grep -i '^link:' | grep -i 'hasOpenAction' || true)
  [ -n "$LINKS" ] && { echo "$LINKS"; exit 0; }
  sleep 0.5
done
echo "BACK-POINTER NOT SURFACED — investigate before running probe 2"
exit 1
