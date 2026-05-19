"""EventShape governs schema:Event Things, with sh:not disjointness vs mem:Event and mem:Action. D99."""
import pytest
from pyshacl import validate
from rdflib import Graph

SHAPES = [
    "overlays/wiki-memory/shapes/thing.shacl.ttl",
    "overlays/wiki-memory/shapes/event.shacl.ttl",
]

def _validate(data_ttl: str) -> bool:
    data = Graph().parse(data=data_ttl, format="turtle")
    shapes = Graph()
    for s in SHAPES: shapes.parse(s, format="turtle")
    conforms, _, _ = validate(data, shacl_graph=shapes, inference="rdfs")
    return conforms

def test_event_minimal():
    ttl = """
    @prefix schema: <https://schema.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    <#this> a schema:Thing, schema:Event ;
        schema:name "ND Visit" ;
        schema:mainEntityOfPage <#page> ;
        schema:startDate "2026-05-15T10:00:00Z"^^xsd:dateTime .
    """
    assert _validate(ttl)

def test_event_rejects_multitype_with_mem_event():
    ttl = """
    @prefix schema: <https://schema.org/> .
    @prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
    <#this> a schema:Thing, schema:Event, mem:Event ;
        schema:name "Bad multi-type" ;
        schema:mainEntityOfPage <#page> .
    """
    assert not _validate(ttl)

def test_event_rejects_multitype_with_mem_action():
    ttl = """
    @prefix schema: <https://schema.org/> .
    @prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
    <#this> a schema:Thing, schema:Event, mem:Action ;
        schema:name "Bad multi-type" ;
        schema:mainEntityOfPage <#page> .
    """
    assert not _validate(ttl)
