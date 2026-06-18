"""AddressBook is a traditional LD app (operational substrate) — its vcard shapes
must NOT require the memory write-contract (mem:rationale). See the 2026-06-18
pod-memory-systems architecture spec."""
import glob
from rdflib import Graph, URIRef

SH_PATH = URIRef("http://www.w3.org/ns/shacl#path")
MEM_RATIONALE = URIRef("https://pod.vardeman.me/vault/ontology/mem#rationale")

def test_no_addressbook_shape_constrains_mem_rationale():
    offenders = []
    for f in glob.glob("overlays/addressbook/shapes/*.shacl.ttl"):
        g = Graph(); g.parse(f, format="turtle")
        if (None, SH_PATH, MEM_RATIONALE) in g:
            offenders.append(f)
    assert offenders == [], f"mem:rationale still required by vcard shapes: {offenders}"

def test_addressbook_shapes_still_parse_and_target_vcard():
    # de-conflation must not break the vcard contracts the shapes still enforce
    g = Graph(); g.parse("overlays/addressbook/shapes/contact-card.shacl.ttl", format="turtle")
    SH_TC = URIRef("http://www.w3.org/ns/shacl#targetClass")
    VCARD_IND = URIRef("http://www.w3.org/2006/vcard/ns#Individual")
    assert (None, SH_TC, VCARD_IND) in g
