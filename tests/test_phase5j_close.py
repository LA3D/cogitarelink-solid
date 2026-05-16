"""Phase 5j close-out integration tests — wikirole scheme + PROF Link writer."""
from pathlib import Path

import pytest
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF, RDFS, SKOS, OWL

PROF = Namespace("http://www.w3.org/ns/dx/prof/")
DCT = Namespace("http://purl.org/dc/terms/")
WIKIROLE = Namespace("https://pod.vardeman.me/vault/ontology/wikirole#")

OVERLAY_ROOT = Path(__file__).parent.parent / "overlays" / "wiki-memory"


def test_wikirole_scheme_has_five_role_concepts():
    g = Graph()
    g.parse(OVERLAY_ROOT / "vocabulary" / "wikirole.ttl", format="turtle")

    scheme = URIRef("https://pod.vardeman.me/vault/ontology/wikirole")
    assert (scheme, RDF.type, SKOS.ConceptScheme) in g
    assert (scheme, RDF.type, OWL.Ontology) in g
    assert (scheme, DCT.conformsTo, URIRef("http://www.w3.org/TR/dx-prof/")) in g

    expected = {
        WIKIROLE["affordance"],
        WIKIROLE["write-affordance"],
        WIKIROLE["version-affordance"],
        WIKIROLE["derived-class-affordance"],
        WIKIROLE["derived-navigation-affordance"],
    }
    found = set(g.subjects(RDF.type, PROF.ResourceRole))
    assert expected == found, f"missing roles: {expected - found}; extra: {found - expected}"

    for role in expected:
        assert (role, RDF.type, SKOS.Concept) in g
        assert (role, RDF.type, OWL.NamedIndividual) in g
        assert (role, SKOS.topConceptOf, scheme) in g

    # Scheme metadata
    assert (scheme, DCT.publisher, URIRef("https://orcid.org/0000-0003-4091-6059")) in g
    assert any(g.triples((scheme, RDFS.comment, None))), "scheme missing rdfs:comment"

    # Per-role labels and definitions
    for role in expected:
        assert any(g.triples((role, SKOS.prefLabel, None))), f"{role} missing skos:prefLabel"
        assert any(g.triples((role, SKOS.definition, None))), f"{role} missing skos:definition"

    # Hierarchy: children must have skos:broader :affordance; parent must NOT
    parent = WIKIROLE["affordance"]
    children = expected - {parent}
    for child in children:
        assert (child, SKOS.broader, parent) in g, f"{child} missing skos:broader :affordance"
    assert not list(g.triples((parent, SKOS.broader, None))), \
        "parent :affordance should not have skos:broader"
