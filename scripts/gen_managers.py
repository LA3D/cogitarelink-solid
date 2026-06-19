# Emit per-container .shapetree Manager auxiliaries (interop foundation).
# Run from repo root: ~/uvws/.venv/bin/python scripts/gen_managers.py
# Commit the generated overlays/*/interop/managers/*.shapetree.ttl files.
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

# Each lane: where to write, its tree namespace, and slug -> (ContainerTree localname,
# managed-container path under BASE). Managers host to the shared /vault/meta/interop/managers/.
LANES = {
    "wiki": {
        "out": "overlays/wiki-memory/interop/managers",
        "tree_ns": f"{BASE}/meta/shapetrees/wiki-memory.tree#",
        "containers": {
            "concepts": ("ConceptContainerTree", "wiki/concepts"),
            "people": ("PersonContainerTree", "wiki/people"),
            "places": ("PlaceContainerTree", "wiki/places"),
            "events": ("EventContainerTree", "wiki/events"),
            "organizations": ("OrganizationContainerTree", "wiki/organizations"),
            "procedures": ("ProcedureContainerTree", "wiki/procedures"),
            "working": ("WorkingNoteContainerTree", "wiki/working"),
        },
    },
    "addressbook": {
        "out": "overlays/addressbook/interop/managers",
        "tree_ns": f"{BASE}/meta/shapetrees/addressbook.tree#",
        "containers": {
            "person": ("PersonContainerTree", "contacts/Person"),
            "organization": ("OrganizationContainerTree", "contacts/Organization"),
            "group": ("GroupContainerTree", "contacts/Group"),
            "membership": ("MembershipContainerTree", "contacts/Membership"),
        },
    },
}


def served_url(slug: str) -> str:
    return f"{BASE}/meta/interop/managers/{slug}.shapetree"


def manager_graph(slug: str, tree_ns: str, tree_local: str, ctr_path: str) -> Graph:
    "The 4-triple Manager graph, self-IRIs minted against the served URL."
    base = served_url(slug)
    g = Graph(); g.bind("st", ST)
    doc = URIRef(base); a1 = URIRef(base + "#a1")
    g.add((doc, RDF.type, ST.Manager))
    g.add((doc, ST.hasAssignment, a1))
    g.add((a1, ST.assigns, URIRef(f"{tree_ns}{tree_local}")))
    g.add((a1, ST.manages, URIRef(f"{BASE}/{ctr_path}/")))
    return g


def serialize_relative(slug: str, g: Graph) -> str:
    "Turtle with the doc's self-IRIs relativized to <> / <#frag> (no @base line)."
    base = served_url(slug)
    out = []
    for line in g.serialize(format="turtle", base=base).splitlines():
        if line.startswith("@base "):
            continue
        line = line.replace(f"<{base}#", "<#").replace(f"<{base}>", "<>")
        out.append(line)
    return "\n".join(out).strip() + "\n"


if __name__ == "__main__":
    total = 0
    for lane in LANES.values():
        out = Path(lane["out"]); out.mkdir(parents=True, exist_ok=True)
        for slug, (tree_local, ctr_path) in lane["containers"].items():
            g = manager_graph(slug, lane["tree_ns"], tree_local, ctr_path)
            (out / f"{slug}.shapetree.ttl").write_text(serialize_relative(slug, g))
            total += 1
    print(f"wrote {total} manager files")
