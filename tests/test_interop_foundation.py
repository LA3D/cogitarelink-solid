import rdflib
from pathlib import Path

ST = rdflib.Namespace("http://www.w3.org/ns/shapetrees#")
WIKI = "https://pod.vardeman.me/vault/ontology/wiki#"
TREE_NS = "https://pod.vardeman.me/vault/meta/shapetrees/wiki-memory.tree#"
REPO = Path(__file__).resolve().parents[1]
TREE = REPO / "overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl"

RESOURCE_SHAPES = ["ConceptShape", "SourceShape", "PersonShape", "PlaceShape",
                   "EventShape", "OrganizationShape", "HowToShape", "WorkingNoteShape"]
N_CONTAINERS = 7

def _g():
    g = rdflib.Graph(); g.parse(TREE, format="turtle"); return g

def test_tree_parses_with_8_resource_trees_and_7_container_trees():
    g = _g()
    assert len(set(g.subjects(ST.expectsType, ST.Resource))) == 8
    assert len(set(g.subjects(ST.expectsType, ST.Container))) == N_CONTAINERS

def test_every_resource_tree_shape_is_a_wiki_nodeshape_iri():
    g = _g()
    shapes = {str(o) for o in g.objects(None, ST.shape)}
    assert shapes == {WIKI + s for s in RESOURCE_SHAPES}, shapes

def test_concepts_container_contains_both_concept_and_source():
    g = _g()
    cct = rdflib.URIRef(TREE_NS + "ConceptContainerTree")
    contained = {str(o).split("#")[-1] for o in g.objects(cct, ST.contains)}
    assert contained == {"ConceptResourceTree", "SourceResourceTree"}, contained

INTEROP = rdflib.Namespace("http://www.w3.org/ns/solid/interop#")
APP = REPO / "overlays/wiki-memory/interop/application.ttl"

def test_application_declares_8_access_needs_each_with_a_resource_tree_and_modes():
    g = rdflib.Graph(); g.parse(APP, format="turtle")
    app = next(g.subjects(rdflib.RDF.type, INTEROP.Application))
    group = g.value(app, INTEROP.hasAccessNeedGroup)
    assert group is not None, "Application has no AccessNeedGroup"
    needs = list(g.objects(group, INTEROP.hasAccessNeed))
    assert len(needs) == 8, f"expected 8 AccessNeeds, got {len(needs)}"
    for n in needs:
        tree = g.value(n, INTEROP.registeredShapeTree)
        assert tree is not None and str(tree).endswith("ResourceTree"), f"{n}: registeredShapeTree must be a ResourceTree, got {tree}"
        assert list(g.objects(n, INTEROP.accessMode)), f"{n}: missing accessMode"
