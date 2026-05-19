"""PlaceShape governs schema:Place Things. D98."""
import pytest
from pyshacl import validate
from rdflib import Graph


SHAPES = [
    "overlays/wiki-memory/shapes/thing.shacl.ttl",
    "overlays/wiki-memory/shapes/place.shacl.ttl",
]


def _validate(data_ttl: str) -> bool:
    data = Graph().parse(data=data_ttl, format="turtle")
    shapes = Graph()
    for s in SHAPES:
        shapes.parse(s, format="turtle")
    conforms, _, _ = validate(data, shacl_graph=shapes, inference="rdfs")
    return conforms


def test_place_minimal():
    ttl = """
    @prefix schema: <https://schema.org/> .
    <#this> a schema:Thing, schema:Place ;
        schema:name "Notre Dame" ;
        schema:mainEntityOfPage <#page> .
    """
    assert _validate(ttl)


def test_place_with_coordinates():
    ttl = """
    @prefix schema: <https://schema.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    <#this> a schema:Thing, schema:Place ;
        schema:name "Notre Dame" ;
        schema:mainEntityOfPage <#page> ;
        schema:latitude "41.7"^^xsd:decimal ;
        schema:longitude "-86.2"^^xsd:decimal ;
        schema:containedInPlace </places/in.md#this> .
    """
    assert _validate(ttl)
