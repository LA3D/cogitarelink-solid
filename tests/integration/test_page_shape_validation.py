"""PageShape governs page-resource metadata (<> subject). D98."""
import pytest
from pyshacl import validate
from rdflib import Graph

SHAPE = "overlays/wiki-memory/shapes/page.shacl.ttl"

def _validate(data_ttl: str) -> bool:
    data = Graph().parse(data=data_ttl, format="turtle")
    shapes = Graph().parse(SHAPE, format="turtle")
    conforms, _, _ = validate(data, shacl_graph=shapes, inference="rdfs")
    return conforms

def test_page_shape_accepts_minimal_valid_page():
    ttl = """
    @prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
    @prefix schema: <https://schema.org/> .
    @prefix dct: <http://purl.org/dc/terms/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    <#page> a wiki:Page ;
        dct:title "Context Graphs" ;
        schema:mainEntity <#thing> ;
        dct:created "2026-05-19T10:00:00Z"^^xsd:dateTime .
    """
    assert _validate(ttl)

def test_page_shape_rejects_missing_title():
    ttl = """
    @prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
    @prefix schema: <https://schema.org/> .
    <#page> a wiki:Page ;
        schema:mainEntity <#thing> .
    """
    assert not _validate(ttl)

def test_page_shape_rejects_missing_mainentity():
    ttl = """
    @prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
    @prefix dct: <http://purl.org/dc/terms/> .
    <#page> a wiki:Page ; dct:title "X" .
    """
    assert not _validate(ttl)
