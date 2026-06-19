"""The derivation computes a durable container's constrainedBy from its ShapeTree
plus the injected substrate write contract."""
import pytest
from scripts.overlay.derive_constraints import (
    derive_constrainedby, committed_constrainedby, WRITE_CONTRACT_SHAPE, WIKI_DURABLE,
    committed_addressbook_constrainedby, ADDRESSBOOK_DEPLOY,
)


def test_committed_wiki_meta_matches_derivation():
    """Each wiki container's committed .meta constrainedBy == the ShapeTree derivation.
    (RDF-native lanes are a follow-up — their trees diverge from the deployed layout.)"""
    for url in WIKI_DURABLE:
        assert committed_constrainedby(url) == derive_constrainedby("overlays/wiki-memory", url), url


def test_wiki_concepts_unions_tree_shapes_plus_contract():
    got = derive_constrainedby("overlays/wiki-memory", "https://pod.vardeman.me/vault/wiki/concepts/")
    assert WRITE_CONTRACT_SHAPE in got
    assert any(s.endswith("concept.shacl.ttl") for s in got)
    assert any(s.endswith("source.shacl.ttl") for s in got)


def test_wiki_concepts_includes_page_and_thing():
    """Task 8: the dual-layer base (Page governs <>, Thing governs <#this>) is now in
    the floored gate — closes the audit's '<> ungoverned' finding."""
    got = derive_constrainedby("overlays/wiki-memory", "https://pod.vardeman.me/vault/wiki/concepts/")
    assert any(s.endswith("page.shacl.ttl") for s in got)
    assert any(s.endswith("thing.shacl.ttl") for s in got)


def test_contract_NOT_injected_for_id_schemes():
    # id-schemes records are operational reference data (2026-06-18 memory-systems
    # spec, open-Q #3 resolved) — no memory write contract, like addressbook.
    got = derive_constrainedby("overlays/identifier-schemes", "https://pod.vardeman.me/id/schemes/")
    assert WRITE_CONTRACT_SHAPE not in got
    assert any(s.endswith("scheme-record.shacl.ttl") for s in got)  # the domain shape stays


AB_EXPECT = {
    "https://pod.vardeman.me/vault/contacts/Person/":       "contact-card.shacl.ttl",
    "https://pod.vardeman.me/vault/contacts/Organization/": "organization-card.shacl.ttl",
    "https://pod.vardeman.me/vault/contacts/Group/":        "group.shacl.ttl",
    "https://pod.vardeman.me/vault/contacts/Membership/":   "membership.shacl.ttl",
}

@pytest.mark.parametrize("url,shape_file", AB_EXPECT.items())
def test_addressbook_subcontainer_derives_one_vcard_shape_no_contract(url, shape_file):
    got = derive_constrainedby("overlays/addressbook", url)
    assert got == {"https://pod.vardeman.me/vault/meta/shapes/" + shape_file}, got
    assert WRITE_CONTRACT_SHAPE not in got  # operational lane — no memory contract

@pytest.mark.parametrize("url", AB_EXPECT)
def test_addressbook_deploy_source_matches_derivation(url):
    # The committed deploy file (patch or Person .meta) must equal the derived set —
    # fails the build if a hand-edit drifts from the tree.
    assert committed_addressbook_constrainedby(url) == derive_constrainedby("overlays/addressbook", url)
