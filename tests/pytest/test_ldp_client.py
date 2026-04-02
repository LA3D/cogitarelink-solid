"""Test LDP client — requires running CSS at pod.vardeman.me:3000."""
import httpx
import pytest
from rdflib import Graph, URIRef, Literal
from rdflib.namespace import RDF, SKOS, XSD

from scripts.lib.ldp_client import put_resource, patch_meta, get_meta

BASE = "http://pod.vardeman.me:3000"


@pytest.mark.integration
def test_put_markdown():
    url = f"{BASE}/vault/resources/concepts/_test-ldp.md"
    status = put_resource(url, b"# Test LDP\n\nHello.", "text/markdown")
    assert status in (200, 201, 205)
    r = httpx.get(url, timeout=10)
    assert r.status_code == 200
    httpx.delete(url, timeout=10)


@pytest.mark.integration
def test_patch_and_get_meta():
    url = f"{BASE}/vault/resources/concepts/_test-meta.md"
    put_resource(url, b"# Test", "text/markdown")

    g = Graph()
    g.add((URIRef(url), RDF.type, SKOS.Concept))
    g.add((URIRef(url), SKOS.prefLabel, Literal("Test Meta", datatype=XSD.string)))
    status = patch_meta(url, g)
    assert status in (200, 201, 205)

    meta_g = get_meta(url)
    assert (URIRef(url), RDF.type, SKOS.Concept) in meta_g

    httpx.delete(url, timeout=10)
