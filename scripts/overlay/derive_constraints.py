"""Derive each durable container's ldp:constrainedBy from its ShapeTree.

Source of truth = the app ShapeTrees (declaration-only subset): a ContainerTree
st:contains ResourceTree(s), each carrying st:shape -> a deployed SHACL NodeShape.
The derived constrainedBy = the union of those shapes' hosted files PLUS the
substrate sub:WriteContractShape (the universal agentic write contract, injected
here so no app re-declares it). The D108 floor enforces the result unchanged.

Run as a module from repo root:
    ~/uvws/.venv/bin/python -m scripts.overlay.derive_constraints        # rewrite container .meta
The agreement test (tests/test_constraints_derivation.py) fails the build if a
committed .meta drifts from this derivation.
"""
from pathlib import Path
from rdflib import Graph, Namespace, URIRef

ST = Namespace("http://www.w3.org/ns/shapetrees#")
WIKI = "https://pod.vardeman.me/vault/ontology/wiki#"
SHAPES_BASE = "https://pod.vardeman.me/vault/meta/shapes/"
WRITE_CONTRACT_SHAPE = SHAPES_BASE + "write-contract.shacl.ttl"

# NodeShape IRI -> hosted shape-file URL. Shapes referenced in a ShapeTree by an
# absolute hosted URL + fragment (addressbook) resolve by stripping the fragment;
# shapes referenced by a wiki: vocab IRI resolve through this map. Agreement-
# guarded: a wiki: shape IRI with no entry raises, surfacing the gap.
_WIKI_SHAPES = ["Page", "Thing", "Concept", "Source", "Person", "Place",
                "Event", "Organization", "HowTo", "WorkingNote"]
SHAPE_NODE_TO_FILE = {
    f"{WIKI}{name}Shape": SHAPES_BASE + file + ".shacl.ttl"
    for name, file in {
        "Page": "page", "Thing": "thing", "Concept": "concept", "Source": "source",
        "Person": "person", "Place": "place", "Event": "event",
        "Organization": "organization", "HowTo": "howto", "WorkingNote": "working",
    }.items()
}
SHAPE_NODE_TO_FILE[f"{WIKI}SchemeRecordShape"] = SHAPES_BASE + "scheme-record.shacl.ttl"

TREE = "https://pod.vardeman.me/vault/meta/shapetrees/"

# Durable containers across all lanes (working/ excluded — D73 permissive):
#   container_url -> (overlay_dir, tree_file, ContainerTree IRI)
DURABLE_CONTAINERS = {
    "https://pod.vardeman.me/vault/wiki/concepts/":
        ("overlays/wiki-memory", "overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl", TREE + "wiki-memory.tree#ConceptContainerTree"),
    "https://pod.vardeman.me/vault/wiki/people/":
        ("overlays/wiki-memory", "overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl", TREE + "wiki-memory.tree#PersonContainerTree"),
    "https://pod.vardeman.me/vault/wiki/places/":
        ("overlays/wiki-memory", "overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl", TREE + "wiki-memory.tree#PlaceContainerTree"),
    "https://pod.vardeman.me/vault/wiki/events/":
        ("overlays/wiki-memory", "overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl", TREE + "wiki-memory.tree#EventContainerTree"),
    "https://pod.vardeman.me/vault/wiki/organizations/":
        ("overlays/wiki-memory", "overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl", TREE + "wiki-memory.tree#OrganizationContainerTree"),
    "https://pod.vardeman.me/vault/wiki/procedures/":
        ("overlays/wiki-memory", "overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl", TREE + "wiki-memory.tree#ProcedureContainerTree"),
    "https://pod.vardeman.me/vault/contacts/":
        ("overlays/addressbook", "overlays/addressbook/shapetrees/addressbook.tree.ttl", TREE + "addressbook.tree#ContactContainerTree"),
    "https://pod.vardeman.me/id/schemes/":
        ("overlays/identifier-schemes", "overlays/identifier-schemes/shapetrees/id-schemes.tree.ttl", TREE + "id-schemes.tree#SchemeRecordContainerTree"),
}

_ROOT = Path(__file__).resolve().parents[2]


def _shape_url(node_iri: str) -> str:
    "Resolve a st:shape object IRI to its hosted .shacl.ttl URL."
    if ".shacl.ttl#" in node_iri:           # hosted URL + fragment (addressbook)
        return node_iri.split("#", 1)[0]
    if node_iri in SHAPE_NODE_TO_FILE:       # wiki: vocab IRI
        return SHAPE_NODE_TO_FILE[node_iri]
    raise KeyError(f"no hosted-file mapping for st:shape {node_iri}")


def derive_constrainedby(overlay_dir: str, container_url: str) -> set:
    "The derived ldp:constrainedBy URL set for a durable container."
    _odir, tree_file, container_tree = DURABLE_CONTAINERS[container_url]
    g = Graph(); g.parse(_ROOT / tree_file, format="turtle")
    shapes = set()
    for resource_tree in g.objects(URIRef(container_tree), ST.contains):
        for shape in g.objects(resource_tree, ST.shape):
            shapes.add(_shape_url(str(shape)))
    shapes.add(WRITE_CONTRACT_SHAPE)
    return shapes


# --- writer + agreement (wiki lane first; RDF-native lanes are a follow-up: their
#     ShapeTrees diverge from the deployed container layout — addressbook constrains
#     /vault/contacts/{Person,Organization}/ subcontainers, id-schemes uses /id/ URLs).
POD = "https://pod.vardeman.me"
WIKI_DURABLE = [u for u in DURABLE_CONTAINERS if u.startswith(f"{POD}/vault/wiki/")]


def _meta_path(container_url: str) -> Path:
    slug = container_url[len(f"{POD}/vault/wiki/"):].rstrip("/")
    return _ROOT / "overlays/wiki-memory/containers/wiki" / slug / ".meta"


def committed_constrainedby(container_url: str) -> set:
    "The ldp:constrainedBy URL set currently committed in the container's .meta (absolute)."
    g = Graph(); g.parse(_meta_path(container_url), format="turtle", publicID=container_url)
    LDP_CB = URIRef("http://www.w3.org/ns/ldp#constrainedBy")
    return {str(o) for o in g.objects(URIRef(container_url), LDP_CB)}


def _relative(url: str) -> str:
    return f"<{url[len(POD):]}>" if url.startswith(POD) else f"<{url}>"


def rewrite_meta(container_url: str) -> None:
    "Surgically rewrite the .meta's ldp:constrainedBy + sub:shape object lists to the derived set."
    derived = sorted(derive_constrainedby("overlays/wiki-memory", container_url))
    objs = " , ".join(_relative(u) for u in derived)
    path = _meta_path(container_url)
    out = []
    for line in path.read_text().splitlines():
        stripped = line.strip()
        for pred in ("ldp:constrainedBy", "sub:shape"):
            if stripped.startswith(pred):
                indent = line[:len(line) - len(line.lstrip())]
                term = stripped[-1]  # ; or .
                line = f"{indent}{pred} {objs} {term}"
                break
        out.append(line)
    path.write_text("\n".join(out) + "\n")


if __name__ == "__main__":
    for url in WIKI_DURABLE:
        rewrite_meta(url)
    print(f"rewrote constrainedBy + sub:shape in {len(WIKI_DURABLE)} wiki container .meta files")
