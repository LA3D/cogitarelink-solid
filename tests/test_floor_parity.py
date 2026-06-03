"""Floor parity (D108 Front-2 §5.8).

The admission floor gates a write against the container's ldp:constrainedBy shape.
The interop layer declares the SAME conformance contract structurally, via the
Shape-Trees doc (container Manager -> ContainerTree -> st:contains ResourceTree
-> st:shape wiki:*Shape). This test asserts the two are in parity: for every
governed wiki container, the shape DOC its ldp:constrainedBy points to declares a
NodeShape that overlaps the shapes its ShapeTree expects.

If they drift (constrainedBy points at one shape, the tree expects another) the
floor enforces a different contract than the substrate advertises — the bug this
test exists to catch.

R-T7 (audit R3, FOLLOWUPS item 6): UPGRADED from filename-string matching to RDF
dereference. Each container's ldp:constrainedBy IRI is resolved to its repo file
(URL basename -> SHAPES_DIR), THAT file is parsed, and its sh:NodeShape subjects
are taken directly — then overlapped with the tree's st:shape set. Offline (repo
files only); no live Pod.
"""
from pathlib import Path
import pytest
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF

ST   = Namespace("http://www.w3.org/ns/shapetrees#")
LDP  = Namespace("http://www.w3.org/ns/ldp#")
SH   = Namespace("http://www.w3.org/ns/shacl#")
WIKI = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")

OVERLAY    = Path("overlays/wiki-memory")
SHAPES_DIR = OVERLAY / "shapes"
TREE_DOC   = OVERLAY / "shapetrees" / "wiki-memory.tree.ttl"
MANAGERS   = OVERLAY / "interop" / "managers"
TREE_BASE  = "https://pod.vardeman.me/vault/meta/shapetrees/wiki-memory.tree"

# The 7 governed containers (working/ included — its constrainedBy is the
# permissive working-note shape; the floor's isPermissive suppresses the 422).
GOVERNED = ["concepts", "people", "places", "events", "organizations", "procedures", "working"]


def _constrainedby_file(cb_iri: str) -> Path:
    """Resolve an ldp:constrainedBy IRI to the repo shape file (offline).

    The deployed IRI is .../vault/meta/shapes/<name>.shacl.ttl; the repo copy is
    SHAPES_DIR/<name>.shacl.ttl. Map by basename so the test never touches the Pod.
    """
    return SHAPES_DIR / Path(cb_iri).name


def _nodeshapes_declared(shape_file: Path) -> set[str]:
    """Parse shape_file; return its sh:NodeShape subject IRIs (the shapes it
    DEFINES). Restricted to wiki: shapes (the substrate's own NodeShapes)."""
    g = Graph(); g.parse(shape_file, format="turtle")
    return {
        str(s) for s in g.subjects(RDF.type, SH.NodeShape)
        if str(s).startswith(str(WIKI))
    }


def _tree_shapes_for_container() -> dict[str, set[str]]:
    """container-path -> {shape IRIs reachable via Manager -> ContainerTree -> st:contains -> st:shape}."""
    tg = Graph(); tg.parse(TREE_DOC, format="turtle", publicID=TREE_BASE)
    out: dict[str, set[str]] = {}
    for mf in MANAGERS.glob("*.shapetree.ttl"):
        mg = Graph(); mg.parse(mf, format="turtle")
        for assignment in mg.objects(None, ST.hasAssignment):
            ctr  = mg.value(assignment, ST.manages)
            tree = mg.value(assignment, ST.assigns)
            if ctr is None or tree is None:
                continue
            shapes: set[str] = set()
            for res_tree in tg.objects(URIRef(str(tree)), ST.contains):
                sh = tg.value(res_tree, ST.shape)
                if sh is not None:
                    shapes.add(str(sh))
            out[str(ctr)] = shapes
    return out


TREE_SHAPES  = _tree_shapes_for_container()


@pytest.mark.parametrize("ctr", GOVERNED)
def test_constrainedby_matches_shapetree_shape(ctr):
    meta = OVERLAY / "containers" / "wiki" / ctr / ".meta"
    assert meta.exists(), f"{meta} missing"
    container_url = f"https://pod.vardeman.me/vault/wiki/{ctr}/"
    g = Graph(); g.parse(meta, format="turtle", publicID=container_url)

    cb = list(g.objects(None, LDP.constrainedBy))
    assert cb, f"{ctr}: no ldp:constrainedBy — the floor would be inert for this container"
    assert len(cb) == 1, f"{ctr}: expected exactly one ldp:constrainedBy, got {cb}"

    # Dereference the constrainedBy doc (repo file) and read the NodeShapes it
    # actually DECLARES — not a filename string match.
    cb_file = _constrainedby_file(str(cb[0]))
    assert cb_file.exists(), f"{ctr}: constrainedBy {cb[0]} -> {cb_file} not found in repo"
    defined = _nodeshapes_declared(cb_file)
    assert defined, f"{ctr}: constrainedBy doc {cb_file.name} declares no wiki:*Shape"

    # The shapes the container's ShapeTree reaches.
    expected = TREE_SHAPES.get(container_url)
    assert expected, f"{ctr}: no ShapeTree manager assigns a tree to {container_url}"

    # Parity: a NodeShape the constrainedBy doc declares must be one the tree
    # expects for this container. (concepts/ reaches BOTH Concept + Source;
    # constrainedBy names the primary, Concept.)
    overlap = defined & expected
    assert overlap, (
        f"{ctr}: ldp:constrainedBy -> {cb_file.name} (declares {defined}) is NOT among "
        f"the ShapeTree-expected shapes {expected} — floor/interop contract drift"
    )


def test_all_governed_containers_constrained():
    """No governed container is left inert (every one declares ldp:constrainedBy)."""
    missing = []
    for ctr in GOVERNED:
        meta = OVERLAY / "containers" / "wiki" / ctr / ".meta"
        g = Graph(); g.parse(meta, format="turtle",
                             publicID=f"https://pod.vardeman.me/vault/wiki/{ctr}/")
        if not list(g.objects(None, LDP.constrainedBy)):
            missing.append(ctr)
    assert not missing, f"governed containers with no ldp:constrainedBy (floor inert): {missing}"
