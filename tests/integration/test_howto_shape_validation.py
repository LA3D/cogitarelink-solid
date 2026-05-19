"""HowToShape governs schema:HowTo Things, with sh:not disjointness vs mem:Action. D99."""
import pytest
from pyshacl import validate
from rdflib import Graph

SHAPES = [
    "overlays/wiki-memory/shapes/thing.shacl.ttl",
    "overlays/wiki-memory/shapes/howto.shacl.ttl",
]

def _validate(data_ttl: str) -> bool:
    data = Graph().parse(data=data_ttl, format="turtle")
    shapes = Graph()
    for s in SHAPES: shapes.parse(s, format="turtle")
    conforms, _, _ = validate(data, shacl_graph=shapes, inference="rdfs")
    return conforms

def test_howto_minimal():
    ttl = """
    @prefix schema: <https://schema.org/> .
    <#this> a schema:Thing, schema:HowTo ;
        schema:name "Crystallize a Working Note" ;
        schema:mainEntityOfPage <#page> .
    """
    assert _validate(ttl)

def test_howto_rejects_multitype_with_mem_action():
    ttl = """
    @prefix schema: <https://schema.org/> .
    @prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
    <#this> a schema:Thing, schema:HowTo, mem:Action ;
        schema:name "Bad" ;
        schema:mainEntityOfPage <#page> .
    """
    assert not _validate(ttl)
