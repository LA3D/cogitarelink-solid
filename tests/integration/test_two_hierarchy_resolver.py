"""Integration: two-hierarchy wikilink resolver routes edges by predicate class.

Three scenarios validate the D106 routing.jsonld Pod-doc + live listener (Task 8):
1. {.affiliation} → schema:affiliation predicate → schema:Organization class → organizations/
2. {.related}     → skos:related predicate → no class entailment → defaults to concepts/
3. routing.jsonld deployed at /vault/meta/routing.jsonld with routesToClass entries

Source pages are written to /vault/wiki/working/ (permissive shape, D73).
The assertion is on the projected object IRI in the .meta sidecar — NOT the source container.

See also: test_addressbook_e2e.py for the established client pattern.
"""
import uuid
import httpx
import pytest
from rdflib import Graph, URIRef, Namespace

from tests.conftest import _pod_base, resolve_ca as _resolve_ca

POD    = _pod_base() + "/vault"
SCHEMA = Namespace("https://schema.org/")
SKOS   = Namespace("http://www.w3.org/2004/02/skos/core#")

_CA = _resolve_ca() or False
CLIENT = httpx.Client(verify=_CA, timeout=10)


def _working_url(slug: str) -> str:
    return f"{POD}/wiki/working/{slug}.md"


def _meta_url(resource_url: str) -> str:
    return resource_url + ".meta"


def _put_working_page(slug: str, body: str) -> httpx.Response:
    url = _working_url(slug)
    return CLIENT.put(url, content=body, headers={"Content-Type": "text/markdown"})


def _get_meta_graph(resource_url: str) -> Graph:
    meta_url = _meta_url(resource_url)
    r = CLIENT.get(meta_url, headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"GET {meta_url} → {r.status_code}: {r.text[:300]}"
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=meta_url)
    return g


def test_affiliation_routes_to_organizations():
    """[[Notre Dame]]{.affiliation} → schema:affiliation → org container, object has /organizations/."""
    uid = uuid.uuid4().hex[:8]
    slug = f"affiliation-test-{uid}"
    page_url = _working_url(slug)
    body = f"# Affiliation Test {uid}\n\n[[Notre Dame]]{{.affiliation}}\n"

    r = _put_working_page(slug, body)
    assert r.status_code in (200, 201, 204, 205), (
        f"PUT to working/ returned {r.status_code}: {r.text[:400]}"
    )

    try:
        g = _get_meta_graph(page_url)

        # The projection should have emitted schema:affiliation on <#this>
        thing = URIRef(page_url + "#this")
        affiliation_triples = list(g.triples((thing, SCHEMA.affiliation, None)))
        assert affiliation_triples, (
            f"No schema:affiliation triples found on {thing}. "
            f"Turtle:\n{CLIENT.get(_meta_url(page_url), headers={'Accept': 'text/turtle'}).text}"
        )

        # The object IRI should route to /wiki/organizations/
        obj_iri = str(affiliation_triples[0][2])
        assert "/wiki/organizations/" in obj_iri, (
            f"schema:affiliation object routed incorrectly: {obj_iri!r} — expected /wiki/organizations/"
        )
        assert obj_iri.endswith("#this"), (
            f"THING-scoped object should end with #this, got: {obj_iri!r}"
        )
    finally:
        CLIENT.delete(page_url)


def test_related_defaults_to_concepts():
    """[[Context Graphs]]{.related} → skos:related → no class entailment → concepts/."""
    uid = uuid.uuid4().hex[:8]
    slug = f"related-test-{uid}"
    page_url = _working_url(slug)
    body = f"# Related Test {uid}\n\n[[Context Graphs]]{{.related}}\n"

    r = _put_working_page(slug, body)
    assert r.status_code in (200, 201, 204, 205), (
        f"PUT to working/ returned {r.status_code}: {r.text[:400]}"
    )

    try:
        g = _get_meta_graph(page_url)

        thing = URIRef(page_url + "#this")
        related_triples = list(g.triples((thing, SKOS.related, None)))
        assert related_triples, (
            f"No skos:related triples found on {thing}. "
            f"Turtle:\n{CLIENT.get(_meta_url(page_url), headers={'Accept': 'text/turtle'}).text}"
        )

        obj_iri = str(related_triples[0][2])
        assert "/wiki/concepts/" in obj_iri, (
            f"skos:related object should route to /wiki/concepts/, got: {obj_iri!r}"
        )
        assert obj_iri.endswith("#this"), (
            f"THING-scoped object should end with #this, got: {obj_iri!r}"
        )
    finally:
        CLIENT.delete(page_url)


def test_routing_jsonld_deployed():
    """GET /vault/meta/routing.jsonld → 200 JSON-LD with routesToClass entries."""
    r = CLIENT.get(f"{POD}/meta/routing.jsonld", headers={"Accept": "application/ld+json"})
    assert r.status_code == 200, (
        f"routing.jsonld not found: {r.status_code}. "
        "Ensure pod-setup applied the wiki-memory overlay (make reset)."
    )
    ct = r.headers.get("content-type", "")
    assert "json" in ct or "ld+json" in ct, f"Unexpected Content-Type: {ct!r}"

    doc = r.json()
    graph = doc.get("@graph", [])
    assert graph, f"routing.jsonld has no @graph: {doc}"

    has_routes_to_class = any(
        "routesToClass" in node for node in graph
    )
    assert has_routes_to_class, (
        f"No routesToClass found in @graph entries: {graph}"
    )
