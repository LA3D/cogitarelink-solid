"""Integration tests for the substrate cleanup (Phase 1 onward).

Each test should fail BEFORE its corresponding cleanup step, pass AFTER.
Run individually with: pytest tests/integration/test_substrate_cleanup.py::<test_name> -v
"""
import pytest
import httpx
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF, RDFS

POD_URL = "http://pod.vardeman.me:3000/vault/"
CAP = Namespace("https://pod.vardeman.me:3000/vault/ontology/capability#")
WIKI = Namespace("https://pod.vardeman.me:3000/vault/ontology/wiki#")


def test_no_para_residue():
    """After Phase 1 cleanup, PARA-era containers should 404 on a fresh Pod."""
    para_paths = [
        "resources/", "areas/", "projects/", "archive/",
        "procedures/", "resources/concepts/", "resources/theories/",
        "resources/literature/", "resources/methods/", "resources/people/",
        "resources/external/", "procedures/queries/", "procedures/shapes/",
    ]
    failures = []
    for path in para_paths:
        r = httpx.head(POD_URL + path, timeout=5)
        if r.status_code != 404:
            failures.append(f"{path}: HTTP {r.status_code}")
    assert not failures, f"Phase 1 expected 404 for all PARA paths; got: {failures}"


def test_type_index_empty():
    """After Phase 1, Type Index resource exists but has no solid:TypeRegistration entries."""
    SOLID = Namespace("http://www.w3.org/ns/solid/terms#")
    r = httpx.get(POD_URL + "settings/publicTypeIndex",
                  headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200, f"Type Index should exist; got {r.status_code}"
    g = Graph().parse(data=r.text, format="turtle")
    registrations = list(g.subjects(RDF.type, SOLID.TypeRegistration))
    assert len(registrations) == 0, f"Type Index should be empty; found {len(registrations)} registrations"


def test_meta_affordances_empty_or_absent():
    """After Phase 1, /meta/affordances/ either 404s or returns empty container."""
    r = httpx.get(POD_URL + "meta/affordances/",
                  headers={"Accept": "text/turtle"}, timeout=5)
    if r.status_code == 404:
        return  # acceptable — overlay re-creates in Phase 3
    LDP = Namespace("http://www.w3.org/ns/ldp#")
    g = Graph().parse(data=r.text, format="turtle")
    contents = list(g.objects(predicate=LDP.contains))
    assert len(contents) == 0, f"Affordances container should be empty pre-overlay; found {contents}"
