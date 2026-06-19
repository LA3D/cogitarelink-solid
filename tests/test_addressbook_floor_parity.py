# tests/test_addressbook_floor_parity.py
"""Floor↔tree parity for the addressbook lane (vcard, operational — no memory
contract). For each /vault/contacts/<Sub>/ subcontainer, the constraint its
deploy source carries (Person .meta sidecar; Organization/Group/Membership N3
patches) must EQUAL the shape its ShapeTree expects, reached the same way the
wiki parity test does: Manager -> ContainerTree -> st:contains -> ResourceTree
-> st:shape. Drift means the floor would gate a different contract than the
substrate advertises. Offline (repo files only). Sibling of test_floor_parity.py
(which is wiki-namespace-hardwired)."""
from pathlib import Path
import pytest
from rdflib import Graph, Namespace, URIRef
from scripts.overlay.derive_constraints import committed_addressbook_constrainedby, ADDRESSBOOK_DEPLOY

ST = Namespace("http://www.w3.org/ns/shapetrees#")
REPO = Path(__file__).resolve().parents[1]
TREE = REPO / "overlays/addressbook/shapetrees/addressbook.tree.ttl"
MGR_DIR = REPO / "overlays/addressbook/interop/managers"


def _tree_shapes_by_container() -> dict:
    "managed-container-url -> {st:shape IRIs reachable via Manager->ContainerTree->contains}."
    tg = Graph(); tg.parse(TREE, format="turtle")
    out = {}
    for mf in MGR_DIR.glob("*.shapetree.ttl"):
        mg = Graph(); mg.parse(mf, format="turtle")
        for a in mg.objects(None, ST.hasAssignment):
            ctr = mg.value(a, ST.manages); tree = mg.value(a, ST.assigns)
            if ctr is None or tree is None:
                continue
            shapes = set()
            for res_tree in tg.objects(URIRef(str(tree)), ST.contains):
                for sh in tg.objects(res_tree, ST.shape):
                    shapes.add(str(sh))
            out[str(ctr)] = shapes
    return out


TREE_SHAPES = _tree_shapes_by_container()


@pytest.mark.parametrize("container_url", ADDRESSBOOK_DEPLOY)
def test_deployed_constraint_matches_shapetree(container_url):
    # The tree references shapes by hosted URL + fragment; the deploy source names
    # the shape FILE (no fragment). Compare on the file URL.
    expected_files = {s.split("#", 1)[0] for s in TREE_SHAPES.get(container_url, set())}
    assert expected_files, f"{container_url}: no manager assigns a tree"
    deployed = committed_addressbook_constrainedby(container_url)
    # deploy sources use root-relative IRIs; normalize the tree's absolute URLs to match
    POD = "https://pod.vardeman.me"
    expected_rel = {u[len(POD):] if u.startswith(POD) else u for u in expected_files}
    deployed_rel = {u[len(POD):] if u.startswith(POD) else u for u in deployed}
    assert deployed_rel == expected_rel, (
        f"{container_url}: deploy constraint {deployed_rel} != tree-expected {expected_rel}")
