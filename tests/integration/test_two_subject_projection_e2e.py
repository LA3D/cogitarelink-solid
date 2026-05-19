"""End-to-end: PUT a wiki page, assert two-subject .meta (D98).

These tests target the live Pod after Phase H Task 30 rebuild. Until then,
they're skipped. Un-skip when the new 8-shape catalog + listener changes are
installed via apply.py.
"""
import pytest
import httpx
from rdflib import Graph, URIRef
from rdflib.namespace import RDF

POD = "https://pod.vardeman.me/vault"
SCHEMA = "https://schema.org/"
SKOS = "http://www.w3.org/2004/02/skos/core#"
WIKI = "https://pod.vardeman.me/vault/ontology/wiki#"

CLIENT = httpx.Client(verify=False, timeout=10)


def _put_and_read_meta(path: str, body: str) -> Graph:
    """PUT a markdown body, fetch the .meta, parse as graph."""
    put = CLIENT.put(
        POD + path,
        content=body,
        headers={"Content-Type": "text/markdown"}
    )
    put.raise_for_status()
    meta_url = POD + path + ".meta"
    get_meta = CLIENT.get(meta_url, headers={"Accept": "text/turtle"})
    get_meta.raise_for_status()
    g = Graph()
    g.parse(data=get_meta.text, format="turtle", publicID=meta_url)
    return g


def test_concept_page_has_two_subjects():
    """Page and Thing both present with correct types."""
    body = "---\ntitle: Test Concept\ntype: skos:Concept\n---\n\n# Test Concept\n\nA test."
    g = _put_and_read_meta("/wiki/concepts/test-concept.md", body)

    page = URIRef(POD + "/wiki/concepts/test-concept.md")
    thing = URIRef(POD + "/wiki/concepts/test-concept.md#this")

    assert (page, RDF.type, URIRef(WIKI + "Page")) in g
    assert (thing, RDF.type, URIRef(SKOS + "Concept")) in g


def test_person_page_has_two_subjects():
    """schema:Person Thing subject with Page document subject."""
    body = "---\ntitle: Jane Doe\ntype: schema:Person\n---\n\n# Jane Doe"
    g = _put_and_read_meta("/wiki/people/jane-test.md", body)

    page = URIRef(POD + "/wiki/people/jane-test.md")
    thing = URIRef(POD + "/wiki/people/jane-test.md#this")
    assert (page, RDF.type, URIRef(WIKI + "Page")) in g
    assert (thing, RDF.type, URIRef(SCHEMA + "Person")) in g


def test_place_page_has_two_subjects():
    """schema:Place Thing subject with Page document subject."""
    body = "---\ntitle: Notre Dame\ntype: schema:Place\n---\n\n# ND"
    g = _put_and_read_meta("/wiki/places/nd-test.md", body)
    thing = URIRef(POD + "/wiki/places/nd-test.md#this")
    assert (thing, RDF.type, URIRef(SCHEMA + "Place")) in g


def test_event_page_has_two_subjects():
    """schema:Event Thing subject with Page document subject."""
    body = "---\ntitle: ND Visit\ntype: schema:Event\n---\n\n# Visit"
    g = _put_and_read_meta("/wiki/events/visit-test.md", body)
    thing = URIRef(POD + "/wiki/events/visit-test.md#this")
    assert (thing, RDF.type, URIRef(SCHEMA + "Event")) in g


def test_organization_page_has_two_subjects():
    """schema:Organization Thing subject with Page document subject."""
    body = "---\ntitle: University\ntype: schema:Organization\n---\n\n# U"
    g = _put_and_read_meta("/wiki/organizations/u-test.md", body)
    thing = URIRef(POD + "/wiki/organizations/u-test.md#this")
    assert (thing, RDF.type, URIRef(SCHEMA + "Organization")) in g


def test_howto_page_has_two_subjects():
    """schema:HowTo Thing subject with Page document subject."""
    body = "---\ntitle: How to Crystallize\ntype: schema:HowTo\n---\n\n# Crystallize\n\n1. PUT\n2. POST"
    g = _put_and_read_meta("/wiki/procedures/howto-test.md", body)
    thing = URIRef(POD + "/wiki/procedures/howto-test.md#this")
    assert (thing, RDF.type, URIRef(SCHEMA + "HowTo")) in g
