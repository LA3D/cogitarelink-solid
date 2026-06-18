"""The derivation computes a durable container's constrainedBy from its ShapeTree
plus the injected substrate write contract."""
from scripts.overlay.derive_constraints import (
    derive_constrainedby, committed_constrainedby, WRITE_CONTRACT_SHAPE, WIKI_DURABLE,
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


def test_contract_injected_for_id_schemes_lane():
    # id-schemes keeps the contract (its operational-vs-memory classification is a
    # separate decision — 2026-06-18 memory-systems spec, open questions).
    got = derive_constrainedby("overlays/identifier-schemes", "https://pod.vardeman.me/id/schemes/")
    assert WRITE_CONTRACT_SHAPE in got


def test_contract_NOT_injected_for_addressbook():
    # AddressBook is operational LD, not memory — no memory write contract.
    got = derive_constrainedby("overlays/addressbook", "https://pod.vardeman.me/vault/contacts/")
    assert WRITE_CONTRACT_SHAPE not in got
    # but the vcard shapes are still derived
    assert any(s.endswith("contact-card.shacl.ttl") for s in got)


def test_addressbook_resolves_hosted_url_fragment_shapes():
    got = derive_constrainedby("overlays/addressbook", "https://pod.vardeman.me/vault/contacts/")
    assert any(s.endswith("contact-card.shacl.ttl") for s in got)
    assert any(s.endswith("organization-card.shacl.ttl") for s in got)
    assert all("#" not in s for s in got)  # fragments stripped to file URLs
