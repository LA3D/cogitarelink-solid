"""Body wikilinks project as Thing-to-Thing edges (D98)."""
import pytest
import httpx
from rdflib import Graph, URIRef

from tests.conftest import _pod_base, resolve_ca as _resolve_ca

POD = _pod_base() + "/vault"
SKOS = "http://www.w3.org/2004/02/skos/core#"

_CA = _resolve_ca() or False
CLIENT = httpx.Client(verify=_CA, timeout=10)


def test_wikilink_object_is_target_thing_iri():
    """Wikilinks project with target Thing as object IRI, not page URL."""
    # prefLabel spans satisfy the D108 admission floor on /wiki/concepts/.
    target_body = "---\ntitle: Target\ntype: skos:Concept\n---\n\n# Target\n\n[Target]{.prefLabel}\n"
    source_body = "---\ntitle: Source\ntype: skos:Concept\n---\n\n# Source\n\n[Source]{.prefLabel}\n\nRefers to [[Target]]{.related}."

    CLIENT.put(
        POD + "/wiki/concepts/target.md",
        content=target_body,
        headers={"Content-Type": "text/markdown"}
    ).raise_for_status()
    CLIENT.put(
        POD + "/wiki/concepts/source.md",
        content=source_body,
        headers={"Content-Type": "text/markdown"}
    ).raise_for_status()

    resp = CLIENT.get(
        POD + "/wiki/concepts/source.md.meta",
        headers={"Accept": "text/turtle"}
    )
    resp.raise_for_status()
    g = Graph()
    g.parse(data=resp.text, format="turtle",
            publicID=POD + "/wiki/concepts/source.md")

    source_thing = URIRef(POD + "/wiki/concepts/source.md#this")
    target_thing = URIRef(POD + "/wiki/concepts/target.md#this")

    assert (source_thing, URIRef(SKOS + "related"), target_thing) in g
