#!/bin/bash
# Probe-1 judgment-lane plant: a shape-conformant scheme record whose provider
# is dead (.example host — guaranteed unresolvable). The liveness detector in
# the curation affordance should surface it; the cold curator should file a
# mem:ProviderDrift proposal, NOT edit the record.
# The derive-lane finding (no PropertyValue projection on any record) is
# naturally present on a fresh Pod — nothing to plant for that lane.
set -euo pipefail
POD="https://pod.vardeman.me"

curl -s -o /dev/null -w 'PUT acme-asset: %{http_code}\n' -X PUT \
  -H 'Content-Type: text/turtle' \
  "$POD/id/schemes/acme-asset" --data-binary @- <<'TTL'
@prefix idot:     <http://identifiers.org/idot/> .
@prefix dcat:     <http://www.w3.org/ns/dcat#> .
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix skos:     <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix foaf:     <http://xmlns.com/foaf/0.1/> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .

<> a foaf:Document ;
   dct:title "ACME asset identifier-scheme record" ;
   dct:created "2026-06-06"^^xsd:date ;
   foaf:primaryTopic <https://pod.vardeman.me/id/schemes/#acme-asset> .

<https://pod.vardeman.me/id/schemes/#acme-asset>
    a idot:Namespace, skos:Concept, rdfs:Datatype ;
    skos:prefLabel "ACME asset"@en ;
    skos:definition "ACME Corp internal asset identifier — tracks physical assets across ACME facilities."@en ;
    skos:inScheme <https://pod.vardeman.me/id/schemes/> ;
    idot:luiPattern "^AA-[0-9]{6}$" ;
    idot:sampleID "AA-001234" .

<#acme-api> a idot:Resource ;
    dct:title "ACME asset registry API"@en ;
    idot:urlPattern "https://id.acme-corp.example/assets/{$id}" ;
    dcat:servesDataset <https://pod.vardeman.me/id/schemes/#acme-asset> ;
    dcat:mediaType <https://www.iana.org/assignments/media-types/application/json> ;
    dct:type <https://pod.vardeman.me/id/roles#metadata-record> .
TTL

echo "verify derived catalog entry:"
sleep 1
curl -s "$POD/id/schemes/" -H 'Accept: text/turtle' | grep -c '#acme-asset' || echo "NOT IN CATALOG"
