"""Floor parity (D108 Front-2 §5.8).

The admission floor gates a write against the container's ldp:constrainedBy shape
SET (D108 §1.5: container = the shape set, class = dispatch by sh:targetClass).
The interop layer declares the SAME conformance contract structurally, via the
Shape-Trees doc (container Manager -> ContainerTree -> st:contains ResourceTree
-> st:shape wiki:*Shape). This test asserts the two are in parity: for every
governed wiki container, the set of NodeShapes its ldp:constrainedBy docs DECLARE
must EQUAL the set of NodeShapes its ShapeTree expects (st:shape of all the
container tree's resource trees).

If they drift (constrainedBy names fewer/other shapes than the tree expects) the
floor enforces a different contract than the substrate advertises — the bug this
test exists to catch. concepts/ is the worked case: its tree's ConceptContainerTree
st:contains {ConceptResourceTree, SourceResourceTree} -> {ConceptShape, SourceShape},
so its constrainedBy MUST name both concept.shacl.ttl AND source.shacl.ttl for
SourceShape to fire at the live floor (C-T2b). Others are singletons.

R-T7 (audit R3, FOLLOWUPS item 6): UPGRADED from filename-string matching to RDF
dereference. Each container's ldp:constrainedBy IRIs are resolved to their repo files
(URL basename -> SHAPES_DIR), each file is parsed, and its sh:NodeShape subjects are
taken directly — then required to EQUAL the tree's st:shape set. C-T2b: upgraded from
overlap to set equality so the shapetree is the source of truth the floor provably
tracks. Offline (repo files only); no live Pod.
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
# working shape conforms trivially for drafts (D73 — the data model carries the policy)).
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

    # Dereference EVERY constrainedBy doc (repo file) and union the NodeShapes they
    # actually DECLARE — not a filename string match. The floor merges these same docs
    # into one shape store, so the declared union is exactly what gates a write.
    declared: set[str] = set()
    for cb_iri in cb:
        cb_file = _constrainedby_file(str(cb_iri))
        assert cb_file.exists(), f"{ctr}: constrainedBy {cb_iri} -> {cb_file} not found in repo"
        declared |= _nodeshapes_declared(cb_file)
    assert declared, f"{ctr}: constrainedBy docs declare no wiki:*Shape"

    # The shapes the container's ShapeTree reaches.
    expected = TREE_SHAPES.get(container_url)
    assert expected, f"{ctr}: no ShapeTree manager assigns a tree to {container_url}"

    # Parity = SET EQUALITY (C-T2b): the NodeShapes the constrainedBy docs declare must
    # be EXACTLY the ones the tree expects for this container. concepts/ -> both Concept +
    # Source; others -> singletons. Inequality either way is a floor/interop contract drift
    # (under-declared: SourceShape would never fire; over-declared: a spurious gate).
    assert declared == expected, (
        f"{ctr}: ldp:constrainedBy docs declare {declared} but the ShapeTree expects "
        f"{expected} — floor/interop contract drift (the floor would gate a different "
        f"shape set than the substrate advertises)"
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
