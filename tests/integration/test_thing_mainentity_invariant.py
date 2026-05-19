"""schema:mainEntity / schema:mainEntityOfPage are substrate-emitted on every page."""
import pytest
import httpx
from rdflib import Graph, URIRef

POD = "https://pod.vardeman.me/vault"
SCHEMA = "https://schema.org/"

CLIENT = httpx.Client(verify=False, timeout=10)


def test_substrate_emits_main_entity_pair():
    """Page and Thing linked via schema:mainEntity / schema:mainEntityOfPage."""
    body = "---\ntitle: Invariant Test\ntype: skos:Concept\n---\n\n# Test"
    CLIENT.put(
        POD + "/wiki/concepts/invariant-test.md",
        content=body,
        headers={"Content-Type": "text/markdown"},
    ).raise_for_status()

    resp = CLIENT.get(
        POD + "/wiki/concepts/invariant-test.md.meta",
        headers={"Accept": "text/turtle"}
    )
    resp.raise_for_status()
    g = Graph()
    g.parse(data=resp.text, format="turtle",
            publicID=POD + "/wiki/concepts/invariant-test.md")

    page = URIRef(POD + "/wiki/concepts/invariant-test.md")
    thing = URIRef(POD + "/wiki/concepts/invariant-test.md#this")

    assert (page, URIRef(SCHEMA + "mainEntity"), thing) in g
    assert (thing, URIRef(SCHEMA + "mainEntityOfPage"), page) in g
