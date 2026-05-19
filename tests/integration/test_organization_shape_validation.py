"""OrganizationShape governs schema:Organization Things. D98."""
import pytest
from pyshacl import validate
from rdflib import Graph

SHAPES = [
    "overlays/wiki-memory/shapes/thing.shacl.ttl",
    "overlays/wiki-memory/shapes/organization.shacl.ttl",
]

def _validate(data_ttl: str) -> bool:
    data = Graph().parse(data=data_ttl, format="turtle")
    shapes = Graph()
    for s in SHAPES: shapes.parse(s, format="turtle")
    conforms, _, _ = validate(data, shacl_graph=shapes, inference="rdfs")
    return conforms

def test_organization_minimal():
    ttl = """
    @prefix schema: <https://schema.org/> .
    <#this> a schema:Thing, schema:Organization ;
        schema:name "University of Notre Dame" ;
        schema:mainEntityOfPage <#page> .
    """
    assert _validate(ttl)

def test_organization_with_ror_and_hierarchy():
    ttl = """
    @prefix schema: <https://schema.org/> .
    <#this> a schema:Thing, schema:Organization ;
        schema:name "ND" ;
        schema:mainEntityOfPage <#page> ;
        schema:identifier "https://ror.org/00mkhxb43" ;
        schema:sameAs <https://ror.org/00mkhxb43> ;
        schema:parentOrganization </organizations/parent.md#this> ;
        schema:member </people/jane.md#this> .
    """
    assert _validate(ttl)

def test_organization_with_legal_name_and_dates():
    ttl = """
    @prefix schema: <https://schema.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    <#this> a schema:Thing, schema:Organization ;
        schema:name "Example Corp" ;
        schema:mainEntityOfPage <#page> ;
        schema:legalName "Example Corporation, Inc." ;
        schema:foundingDate "2010-03-15"^^xsd:date ;
        schema:dissolutionDate "2025-12-31"^^xsd:date .
    """
    assert _validate(ttl)

def test_organization_with_sub_organizations():
    ttl = """
    @prefix schema: <https://schema.org/> .
    <#this> a schema:Thing, schema:Organization ;
        schema:name "Parent Lab" ;
        schema:mainEntityOfPage <#page> ;
        schema:subOrganization </organizations/team-a.md#this> ;
        schema:subOrganization </organizations/team-b.md#this> ;
        schema:member </people/lead.md#this> .
    """
    assert _validate(ttl)
