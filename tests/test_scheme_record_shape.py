"""Offline SHACL conformance tests for SchemeRecordShape (D111)."""
from pathlib import Path
from pyshacl import validate
from rdflib import Graph

SHAPE = Path(__file__).parent.parent / "shapes" / "substrate" / "scheme-record.shacl.ttl"
IDOT = "http://identifiers.org/idot/"

GOOD = f"""
@prefix idot: <{IDOT}> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://pod.vardeman.me/id/schemes/doi> a foaf:Document ;
    dct:title "DOI scheme record" ;
    foaf:primaryTopic <https://pod.vardeman.me/id/schemes/#doi> .

<https://pod.vardeman.me/id/schemes/#doi> a idot:Namespace, skos:Concept, rdfs:Datatype ;
    skos:prefLabel "DOI"@en ;
    skos:definition "Digital Object Identifier."@en ;
    idot:luiPattern "^10\\\\." ;
    idot:sampleID "10.1038/sdata.2018.29" .
"""


def _validate(data: str) -> bool:
    sg = Graph().parse(SHAPE, format="turtle")
    dg = Graph().parse(data=data, format="turtle")
    ok, _, _ = validate(dg, shacl_graph=sg, inference="none")
    return ok


def test_conformant_record_passes():
    assert _validate(GOOD)


def test_missing_regex_fails():
    assert not _validate(GOOD.replace('idot:luiPattern "^10\\\\." ;', ""))


def test_missing_primary_topic_fails():
    assert not _validate(GOOD.replace(
        "foaf:primaryTopic <https://pod.vardeman.me/id/schemes/#doi> .",
        'dct:created "2026-06-05"^^xsd:date .'))


def test_topic_outside_catalog_namespace_fails():
    assert not _validate(GOOD.replace(
        "https://pod.vardeman.me/id/schemes/#doi", "https://example.org/elsewhere#doi"))


def test_missing_definition_fails():
    assert not _validate(GOOD.replace('skos:definition "Digital Object Identifier."@en ;', ""))


def test_overlay_shape_copy_matches_canonical():
    root = Path(__file__).parent.parent
    canon = (root / "shapes/substrate/scheme-record.shacl.ttl").read_text()
    copy = (root / "overlays/identifier-schemes/shapes/scheme-record.shacl.ttl").read_text()
    assert canon == copy
