"""SP2: derived index.md children — write a concept, the index updates, provenance present.

IndexViewListener (css/extensions/view-layer/src/IndexViewListener.ts) regenerates each
registered wiki container's index.md on member writes. The index is an honestly-TYPED
substrate document: frontmatter `type: sub:ContainerIndex` projects to
`<#this> a sub:ContainerIndex` through the normal in-band floor (frontmatter wins over
the D98 container fallback; no shape targets the class). Its .meta carries derivation
provenance — audit it before trusting the listing (the index is a VIEW, not an authority).
"""
import time
import uuid

import httpx
import pytest
from rdflib import Graph, Namespace, URIRef

from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
PROV = Namespace("http://www.w3.org/ns/prov#")
SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
RDF_TYPE = URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
CONCEPTS = f"{POD}/vault/wiki/concepts/"
pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def _mk_concept(slug: str) -> httpx.Response:
    body = (
        f"---\ntype: Concept\n---\n# SP2 Index Probe\n\n"
        f"[SP2 Index Probe]{{.prefLabel}} is [a test marker for the derived index.]{{.definition}}\n"
    )
    return httpx.put(
        f"{CONCEPTS}{slug}.md", content=body,
        headers={"Content-Type": "text/markdown"}, verify=_CA,
    )


def _wait_for_index(predicate, timeout: float = 5.0) -> str:
    """Regeneration is event-driven (the listener queues an async regenerate AFTER
    the member write returns) — poll until `predicate(index_body)` holds."""
    deadline = time.time() + timeout
    text = ""
    while time.time() < deadline:
        r = httpx.get(f"{CONCEPTS}index.md", verify=_CA)
        text = r.text if r.status_code == 200 else ""
        if predicate(text):
            return text
        time.sleep(0.25)
    return text


def _index_meta_graph() -> Graph:
    m = httpx.get(f"{CONCEPTS}index.md.meta", headers={"Accept": "text/turtle"}, verify=_CA)
    assert m.status_code == 200
    g = Graph()
    g.parse(data=m.text, format="turtle", publicID=f"{CONCEPTS}index.md")
    return g


def test_concept_write_refreshes_index_with_provenance():
    slug = f"sp2-idx-{uuid.uuid4().hex[:8]}"
    r = _mk_concept(slug)
    assert r.status_code in (201, 205)
    try:
        body = _wait_for_index(lambda t: f"({slug}.md)" in t)
        assert "SP2 Index Probe" in body and f"({slug}.md)" in body
        g = _index_meta_graph()
        assert (None, PROV.wasDerivedFrom, URIRef(CONCEPTS)) in g
        assert (None, PROV.generatedAtTime, None) in g
        assert (None, PROV.wasGeneratedBy,
                URIRef(f"{POD}/vault/meta/views/container-index")) in g
    finally:
        httpx.delete(f"{CONCEPTS}{slug}.md", verify=_CA)


def test_index_meta_types_this_as_container_index():
    # The projection materialized the frontmatter type honestly: the index's own
    # .meta types <#this> a sub:ContainerIndex (in-band floor, frontmatter-wins).
    slug = f"sp2-idx-{uuid.uuid4().hex[:8]}"
    assert _mk_concept(slug).status_code in (201, 205)
    try:
        _wait_for_index(lambda t: f"({slug}.md)" in t)
        g = _index_meta_graph()
        this = URIRef(f"{CONCEPTS}index.md#this")
        assert (this, RDF_TYPE, SUB.ContainerIndex) in g
    finally:
        httpx.delete(f"{CONCEPTS}{slug}.md", verify=_CA)


def test_delete_refreshes_index():
    # MonitoringStore emits 'changed' with as:Delete for the removed member itself,
    # so the listener regenerates from the post-delete ldp:contains listing.
    slug = f"sp2-idx-{uuid.uuid4().hex[:8]}"
    assert _mk_concept(slug).status_code in (201, 205)
    body = _wait_for_index(lambda t: f"({slug}.md)" in t)
    assert f"({slug}.md)" in body

    httpx.delete(f"{CONCEPTS}{slug}.md", verify=_CA)
    body = _wait_for_index(lambda t: f"({slug}.md)" not in t)
    assert f"({slug}.md)" not in body, "deleted member still listed in index.md"
