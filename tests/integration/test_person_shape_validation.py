"""PersonShape governs schema:Person Things. D98."""
import pytest
from pyshacl import validate
from rdflib import Graph

SHAPES = [
    "overlays/wiki-memory/shapes/thing.shacl.ttl",
    "overlays/wiki-memory/shapes/person.shacl.ttl",
]

def _validate(data_ttl: str) -> bool:
    data = Graph().parse(data=data_ttl, format="turtle")
    shapes = Graph()
    for s in SHAPES: shapes.parse(s, format="turtle")
    conforms, _, _ = validate(data, shacl_graph=shapes, inference="rdfs")
    return conforms

def test_person_minimal():
    ttl = """
    @prefix schema: <https://schema.org/> .
    <#this> a schema:Thing, schema:Person ;
        schema:name "Jane Doe" ;
        schema:mainEntityOfPage <#page> .
    """
    assert _validate(ttl)

def test_person_with_orcid_and_affiliation():
    ttl = """
    @prefix schema: <https://schema.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    <#this> a schema:Thing, schema:Person ;
        schema:name "Jane Doe" ;
        schema:mainEntityOfPage <#page> ;
        schema:identifier "https://orcid.org/0000-0000-0000-0000" ;
        schema:sameAs <https://orcid.org/0000-0000-0000-0000> ;
        schema:affiliation </organizations/nd.md#this> ;
        foaf:nick "jdoe" .
    """
    assert _validate(ttl)
