"""test_dual_view_roundtrip.py — RQ-View-2 round-trip-across-views (D107 §5).

Author an entity via the DOCUMENT view (PUT markdown), retrieve it via the GRAPH
view (GET .meta, parse RDF). If authoring in one view isn't retrievable in the
other, the dual-view model (Verborgh) is broken — the diagnostic-most signal.
Exercises the D71 body->.meta projection listener.

Live-Pod integration test. Needs the Pod up + SSL_CERT_FILE set (mkcert CA), or
verify=False (acceptable for local mkcert dev).
"""
import os
import httpx
import pytest
from rdflib import Graph, URIRef, RDF

POD = os.environ.get("POD_URL", "https://pod.vardeman.me")
WORKING = f"{POD}/vault/wiki/working/"
WIKI = "https://pod.vardeman.me/vault/ontology/wiki#"
SKOS = "http://www.w3.org/2004/02/skos/core#"
SCHEMA = "https://schema.org/"

SLUG = "roundtrip-probe"
DOC_URL = f"{WORKING}{SLUG}.md"
META_URL = f"{DOC_URL}.meta"
BODY = "Round-trip probe. See [[Roundtrip Target]]{.related}.\n"


@pytest.fixture
def authored_doc():
    # Document-view write.
    r = httpx.put(DOC_URL, content=BODY,
                  headers={"Content-Type": "text/markdown"}, verify=False)
    assert r.status_code in (201, 205, 200), f"PUT failed: {r.status_code}"
    yield
    httpx.delete(DOC_URL, verify=False)


def test_document_view_roundtrips_to_graph_view(authored_doc):
    """An entity authored via the document view is retrievable via the graph view."""
    r = httpx.get(META_URL, headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200, f"graph-view (.meta) GET failed: {r.status_code}"
    g = Graph().parse(data=r.text, format="turtle", publicID=DOC_URL)

    this = URIRef(f"{DOC_URL}#this")

    # The substrate projected a type onto the canonical entity node (working ->
    # wiki:WorkingNote). Proves the graph view sees what the document write created.
    types = set(g.objects(this, RDF.type))
    assert URIRef(f"{WIKI}WorkingNote") in types, (
        f"<#this> not typed wiki:WorkingNote in graph view; got {types}"
    )

    # The {.related} body wikilink projected to skos:related on the entity.
    related = list(g.objects(this, URIRef(f"{SKOS}related")))
    assert related, f"{{.related}} wikilink not projected to skos:related: {r.text}"

    # schema:name derived on the entity node (so it satisfies ThingShape).
    names = list(g.objects(this, URIRef(f"{SCHEMA}name")))
    assert names, f"schema:name not derived on <#this>: {r.text}"
