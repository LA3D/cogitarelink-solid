"""Extension manual is dereferenceable + typed wiki:ExtensionGuide."""
import os
import pytest
import httpx
from rdflib import Graph, URIRef

from tests.conftest import _pod_base, resolve_ca as _resolve_ca

POD = _pod_base() + "/vault"
WIKI = f"{_pod_base()}/vault/ontology/wiki#"
_CA = _resolve_ca() or False

def test_extending_l3_md_accessible():
    with httpx.Client(verify=_CA, base_url=POD) as client:
        resp = client.get("/meta/extending-l3.md",
                          headers={"Accept": "text/markdown"})
    assert resp.status_code == 200
    assert "Extending Wiki-Memory L3" in resp.text


def test_extending_l3_typed_extension_guide():
    with httpx.Client(verify=_CA, base_url=POD) as client:
        resp = client.get("/meta/extending-l3.md.meta",
                          headers={"Accept": "text/turtle"})
    assert resp.status_code == 200
    g = Graph()
    g.parse(data=resp.text, format="turtle", publicID=POD.rstrip("/") + "/meta/extending-l3.md")
    thing = URIRef(POD.rstrip("/") + "/meta/extending-l3.md#this")
    assert (thing, URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
            URIRef(WIKI + "ExtensionGuide")) in g
