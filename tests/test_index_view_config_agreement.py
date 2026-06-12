"""test_index_view_config_agreement.py

Drift guard (F10): the `containers` array on css/config/view-layer.json's
IndexViewListener instance duplicates the wiki-memory registration declaration.
This test derives the durable wiki container set from the declarations and
asserts the config agrees, so adding a 7th durable wiki DataRegistration
without updating view-layer.json FAILS here.

Derivation source (machine-readable end to end, named per the F10 instruction):
  1. overlays/wiki-memory/interop/registry.ttl
       DataRegistrations with interop:registeredWith app:wiki-memory
       -> interop:registeredShapeTree (7 ContainerTree IRIs)
  2. overlays/wiki-memory/interop/managers/*.shapetree.ttl
       st:assigns <ContainerTree> ; st:manages <container URL>
       -> tree -> container path
  3. minus /vault/wiki/working/ (D73 two-stage commit: drafts are not
     navigable members-of-record — same WHY recorded in the view-layer.json
     instance comment)

The shapetree itself (wiki-memory.tree.ttl) carries no container URL; the
manager docs are the declared tree->container link, which is why they are the
leg used here instead of a naming convention or the Type Index.
"""
import json, pathlib
from urllib.parse import urlparse
import rdflib

ROOT = pathlib.Path(__file__).resolve().parents[1]
INTEROP = rdflib.Namespace("http://www.w3.org/ns/solid/interop#")
ST = rdflib.Namespace("http://www.w3.org/ns/shapetrees#")
WIKI_APP = rdflib.URIRef("https://pod.vardeman.me/vault/meta/interop/application#wiki-memory")
DRAFT_STAGE = "/vault/wiki/working/"  # excluded by design (D73 two-stage commit)


def _registered_trees() -> set[rdflib.URIRef]:
    g = rdflib.Graph()
    g.parse(str(ROOT / "overlays/wiki-memory/interop/registry.ttl"), format="turtle")
    return {
        tree
        for reg in g.subjects(INTEROP.registeredWith, WIKI_APP)
        for tree in g.objects(reg, INTEROP.registeredShapeTree)
    }


def _tree_to_container() -> dict[rdflib.URIRef, str]:
    g = rdflib.Graph()
    for f in sorted((ROOT / "overlays/wiki-memory/interop/managers").glob("*.shapetree.ttl")):
        g.parse(str(f), format="turtle")
    out = {}
    for a in g.subjects(ST.assigns, None):
        trees = list(g.objects(a, ST.assigns))
        ctrs = list(g.objects(a, ST.manages))
        for tree in trees:
            for ctr in ctrs:
                out[tree] = urlparse(str(ctr)).path
    return out


def _config_containers() -> set[str]:
    doc = json.loads((ROOT / "css/config/view-layer.json").read_text())
    for node in doc["@graph"]:
        if node.get("@type") == "IndexViewListener":
            return set(node["containers"])
    raise AssertionError("no IndexViewListener instance found in view-layer.json")


def test_index_view_containers_match_wiki_registrations():
    trees = _registered_trees()
    assert trees, "registry.ttl yielded no wiki-memory DataRegistrations — parse drift?"

    tree_ctr = _tree_to_container()
    unmapped = trees - tree_ctr.keys()
    assert not unmapped, (
        "registered ContainerTrees with no manager doc (st:assigns/st:manages) under "
        f"interop/managers/: {sorted(str(t) for t in unmapped)} — a new registration "
        "needs a manager doc AND a view-layer.json containers entry"
    )

    declared = {tree_ctr[t] for t in trees} - {DRAFT_STAGE}
    configured = _config_containers()
    assert configured == declared, (
        "IndexViewListener containers drifted from the registry declaration.\n"
        f"  declared (registry minus working/): {sorted(declared)}\n"
        f"  view-layer.json:                    {sorted(configured)}\n"
        "Update css/config/view-layer.json (or the registration) so they agree."
    )


def test_derivation_sanity():
    declared = {_tree_to_container()[t] for t in _registered_trees()}
    assert DRAFT_STAGE in declared, "working/ registration missing — D73 premise changed?"
    assert "/vault/wiki/concepts/" in declared
