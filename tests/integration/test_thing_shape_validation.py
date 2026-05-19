"""ThingShape governs common <#this> Thing predicates. D98."""
import pytest
from pyshacl import validate
from rdflib import Graph

SHAPE = "overlays/wiki-memory/shapes/thing.shacl.ttl"

def _validate(data_ttl: str) -> bool:
    data = Graph().parse(data=data_ttl, format="turtle")
    shapes = Graph().parse(SHAPE, format="turtle")
    conforms, _, _ = validate(data, shacl_graph=shapes, inference="rdfs")
    return conforms

def test_thing_shape_accepts_minimal_thing():
    ttl = """
    @prefix schema: <https://schema.org/> .
    <#this> a schema:Thing ;
        schema:name "Some Thing" ;
        schema:mainEntityOfPage <> .
    """
    assert _validate(ttl)

def test_thing_shape_rejects_missing_name():
    ttl = """
    @prefix schema: <https://schema.org/> .
    <#this> a schema:Thing ;
        schema:mainEntityOfPage <> .
    """
    assert not _validate(ttl)

def test_thing_shape_rejects_missing_mainentityofpage():
    ttl = """
    @prefix schema: <https://schema.org/> .
    <#this> a schema:Thing ; schema:name "X" .
    """
    assert not _validate(ttl)

def test_thing_shape_accepts_optional_keywords_and_sameas():
    ttl = """
    @prefix schema: <https://schema.org/> .
    <#this> a schema:Thing ;
        schema:name "X" ;
        schema:mainEntityOfPage <> ;
        schema:keywords "kw1" , "kw2" ;
        schema:sameAs <https://www.wikidata.org/entity/Q1> .
    """
    assert _validate(ttl)
