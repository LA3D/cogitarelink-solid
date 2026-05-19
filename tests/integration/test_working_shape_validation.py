"""WorkingNoteShape is the permissive D73 drafting tier."""
import pytest
from pyshacl import validate
from rdflib import Graph


SHAPES = ["overlays/wiki-memory/shapes/working.shacl.ttl"]


def _validate(data_ttl: str) -> bool:
    data = Graph().parse(data=data_ttl, format="turtle")
    shapes = Graph()
    for s in SHAPES:
        shapes.parse(s, format="turtle")
    conforms, _, _ = validate(data, shacl_graph=shapes, inference="rdfs")
    return conforms


def test_working_note_accepts_minimal_body_only():
    """Permissive: only wiki:WorkingNote type required."""
    ttl = """
    @prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
    @prefix dct: <http://purl.org/dc/terms/> .
    <#page> a wiki:WorkingNote ;
        dct:created "2026-05-19T10:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    """
    assert _validate(ttl)


def test_working_note_accepts_any_thing_subclass():
    """Permissive: accepts any rdf:type, not just wiki: classes."""
    ttl = """
    @prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
    @prefix schema: <https://schema.org/> .
    @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
    <#page> a wiki:WorkingNote .
    <#this> a schema:Thing, skos:Concept .
    """
    assert _validate(ttl)


def test_working_note_accepts_arbitrary_predicates():
    """Permissive (sh:closed false): accepts any predicate."""
    ttl = """
    @prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix dc: <http://purl.org/dc/elements/1.1/> .
    <#page> a wiki:WorkingNote ;
        foaf:name "My Note" ;
        dc:contributor "someone" ;
        foaf:mbox <mailto:test@example.org> .
    """
    assert _validate(ttl)


def test_working_note_rejects_bad_dct_created_datatype():
    """Only dct:created is constrained: must be xsd:dateTime if present."""
    ttl = """
    @prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
    @prefix dct: <http://purl.org/dc/terms/> .
    <#page> a wiki:WorkingNote ;
        dct:created "not a datetime" .
    """
    assert not _validate(ttl)


def test_working_note_rejects_multiple_dct_created():
    """dct:created: maxCount 1."""
    ttl = """
    @prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
    @prefix dct: <http://purl.org/dc/terms/> .
    <#page> a wiki:WorkingNote ;
        dct:created "2026-05-19T10:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
        dct:created "2026-05-19T11:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    """
    assert not _validate(ttl)
