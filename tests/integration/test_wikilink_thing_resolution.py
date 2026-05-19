"""Body wikilinks project as Thing-to-Thing edges (D98)."""
import pytest
import httpx
from rdflib import Graph, URIRef

POD = "https://pod.vardeman.me/vault"
SKOS = "http://www.w3.org/2004/02/skos/core#"

CLIENT = httpx.Client(verify=False, timeout=10)


def test_wikilink_object_is_target_thing_iri():
    """Wikilinks project with target Thing as object IRI, not page URL."""
    target_body = "---\ntitle: Target\ntype: skos:Concept\n---\n\n# Target"
    source_body = "---\ntitle: Source\ntype: skos:Concept\n---\n\n# Source\n\nRefers to [[Target]]{.related}."

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
