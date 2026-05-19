"""ConceptShape governs skos:Concept Things. D98."""
import pytest
from pyshacl import validate
from rdflib import Graph

SHAPES = [
    "overlays/wiki-memory/shapes/thing.shacl.ttl",
    "overlays/wiki-memory/shapes/concept.shacl.ttl",
]

def _validate(data_ttl: str) -> tuple[bool, str]:
    data = Graph().parse(data=data_ttl, format="turtle")
    shapes = Graph()
    for s in SHAPES: shapes.parse(s, format="turtle")
    conforms, _, report = validate(data, shacl_graph=shapes, inference="rdfs")
    return conforms, report

def test_concept_shape_accepts_minimal_concept():
    ttl = """
    @prefix schema: <https://schema.org/> .
    @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
    <#this> a schema:Thing, skos:Concept ;
        schema:name "Context Graph" ;
        schema:mainEntityOfPage <> ;
        skos:prefLabel "Context Graph" .
    """
    conforms, _ = _validate(ttl)
    assert conforms

def test_concept_shape_rejects_missing_preflabel():
    ttl = """
    @prefix schema: <https://schema.org/> .
    @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
    <#this> a schema:Thing, skos:Concept ;
        schema:name "X" ;
        schema:mainEntityOfPage <> .
    """
    conforms, _ = _validate(ttl)
    assert not conforms

def test_concept_shape_accepts_skos_edges():
    ttl = """
    @prefix schema: <https://schema.org/> .
    @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
    @prefix cito: <http://purl.org/spar/cito/> .
    <#this> a schema:Thing, skos:Concept ;
        schema:name "X" ;
        schema:mainEntityOfPage <> ;
        skos:prefLabel "X" ;
        skos:broader </concepts/parent.md#this> ;
        cito:extends </concepts/source.md#this> .
    """
    conforms, _ = _validate(ttl)
    assert conforms
