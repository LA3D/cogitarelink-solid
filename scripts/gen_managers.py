# Emit per-container .shapetree Manager auxiliaries (interop foundation, Task 5).
# Run from repo root: ~/uvws/.venv/bin/python scripts/gen_managers.py
# Commit the generated overlays/wiki-memory/interop/managers/*.shapetree.ttl files.
#
# A Manager associates a container with its CONTAINER shape tree (st:assigns). The shapes
# themselves live on the container tree's contained resource trees (st:contains), so the
# assignment carries NO st:shape — correct for the co-resident concepts/ container
# (Concept + Source). It also carries NO st:focusNode — a container Manager has no single focus
# node; the per-resource validation focus is each contained resource's <#this>, resolved at
# validation time (the earlier "{instance}#this" form was dropped: it was an invalid IRI that
# crashed RDF re-serialization).
#
# Built with rdflib (Graph + st: Namespace + serialize) so the triples can't be malformed by
# string concatenation. The served file must use the relative `<>` (the manager doc) and `<#a1>`
# (the assignment) forms so the assignment resolves against the served URL — rdflib's turtle
# serializer relativizes `<>` but NOT `<#a1>`, so we deterministically rewrite the doc's own
# absolute self-IRIs (the served base, a controlled constant — no injection surface) back to the
# relative forms and drop the @base line. The result re-parses isomorphic to the committed files.
from pathlib import Path

from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF

ST = Namespace("http://www.w3.org/ns/shapetrees#")
BASE = "https://pod.vardeman.me/vault"
TREE_NS = f"{BASE}/meta/shapetrees/wiki-memory.tree#"

# container slug -> (ContainerTree localname, served manager URL).
# 7 containers; concepts/ covers Concept + Source.
CONTAINERS = {
    "concepts": "ConceptContainerTree",
    "people": "PersonContainerTree",
    "places": "PlaceContainerTree",
    "events": "EventContainerTree",
    "organizations": "OrganizationContainerTree",
    "procedures": "ProcedureContainerTree",
    "working": "WorkingNoteContainerTree",
}


def served_url(slug: str) -> str:
    return f"{BASE}/meta/interop/managers/{slug}.shapetree"


def manager_graph(slug: str, tree: str) -> Graph:
    "The 4-triple Manager graph, self-IRIs minted against the served URL."
    base = served_url(slug)
    g = Graph()
    g.bind("st", ST)
    doc = URIRef(base)
    a1 = URIRef(base + "#a1")
    g.add((doc, RDF.type, ST.Manager))
    g.add((doc, ST.hasAssignment, a1))
    g.add((a1, ST.assigns, URIRef(f"{TREE_NS}{tree}")))
    g.add((a1, ST.manages, URIRef(f"{BASE}/wiki/{slug}/")))
    return g


def serialize_relative(slug: str, g: Graph) -> str:
    "Turtle with the doc's self-IRIs relativized to <> / <#frag> (no @base line)."
    base = served_url(slug)
    ttl = g.serialize(format="turtle", base=base)
    out = []
    for line in ttl.splitlines():
        if line.startswith("@base "):
            continue
        line = line.replace(f"<{base}#", "<#").replace(f"<{base}>", "<>")
        out.append(line)
    return "\n".join(out).strip() + "\n"


if __name__ == "__main__":
    out = Path("overlays/wiki-memory/interop/managers")
    out.mkdir(parents=True, exist_ok=True)
    for slug, tree in CONTAINERS.items():
        (out / f"{slug}.shapetree.ttl").write_text(serialize_relative(slug, manager_graph(slug, tree)))
    print(f"wrote {len(CONTAINERS)} manager files")
