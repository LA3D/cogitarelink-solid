"""The addressbook ShapeTree must describe the REAL nested layout:
/vault/contacts/{Person,Organization,Group,Membership}/ subcontainers, each
holding flat vcard resources. Root ContactContainerTree st:contains the four
subcontainer container trees; each subcontainer tree st:contains one resource
tree carrying its vcard shape. Documentation lives in formal annotation triples
(rdfs:label/comment), NOT inline # comments (those are stripped on reserialize).
See docs/superpowers/specs/2026-06-19-addressbook-shapetree-layout-reshape-design.md.
"""
from pathlib import Path
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF, RDFS

ST = Namespace("http://www.w3.org/ns/shapetrees#")
ABTREE = "https://pod.vardeman.me/vault/meta/shapetrees/addressbook.tree#"
SHAPES = "https://pod.vardeman.me/vault/meta/shapes/"
TREE_FILE = Path("overlays/addressbook/shapetrees/addressbook.tree.ttl")

def _g():
    g = Graph(); g.parse(TREE_FILE, format="turtle"); return g

def test_four_container_trees_and_four_resource_trees():
    g = _g()
    assert len(set(g.subjects(ST.expectsType, ST.Container))) == 5  # root + 4 subcontainers
    assert len(set(g.subjects(ST.expectsType, ST.Resource))) == 4

def test_root_contains_the_four_subcontainer_trees():
    g = _g()
    root = URIRef(ABTREE + "ContactContainerTree")
    contained = {str(o).split("#")[-1] for o in g.objects(root, ST.contains)}
    assert contained == {"PersonContainerTree", "OrganizationContainerTree",
                         "GroupContainerTree", "MembershipContainerTree"}, contained

def test_each_subcontainer_contains_its_resource_tree_with_the_right_shape():
    g = _g()
    expect = {
        "PersonContainerTree":       ("ContactResourceTree",      SHAPES + "contact-card.shacl.ttl#ContactCardShape"),
        "OrganizationContainerTree": ("OrganizationResourceTree", SHAPES + "organization-card.shacl.ttl#OrganizationCardShape"),
        "GroupContainerTree":        ("GroupResourceTree",        SHAPES + "group.shacl.ttl#GroupShape"),
        "MembershipContainerTree":   ("MembershipResourceTree",   SHAPES + "membership.shacl.ttl#MembershipShape"),
    }
    for ctree, (rtree, shape) in expect.items():
        contained = list(g.objects(URIRef(ABTREE + ctree), ST.contains))
        assert contained == [URIRef(ABTREE + rtree)], f"{ctree} contains {contained}"
        shapes = list(g.objects(URIRef(ABTREE + rtree), ST.shape))
        assert shapes == [URIRef(shape)], f"{rtree} st:shape {shapes}"

def test_every_tree_node_carries_a_formal_annotation():
    # No inline # comments — every st:ShapeTree subject has rdfs:label or rdfs:comment.
    g = _g()
    for s in set(g.subjects(RDF.type, ST.ShapeTree)):
        ann = list(g.objects(s, RDFS.label)) + list(g.objects(s, RDFS.comment))
        assert ann, f"{s} has no rdfs:label/comment (annotation must be a triple, not a # comment)"
