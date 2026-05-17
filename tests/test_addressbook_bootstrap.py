"""AddressBook bootstrap content and patches parse correctly."""
from pathlib import Path
from rdflib import Graph, Namespace, URIRef

BOOTSTRAP_DIR = Path(__file__).parent.parent / "overlays" / "addressbook"
VCARD = Namespace("http://www.w3.org/2006/vcard/ns#")
DCT   = Namespace("http://purl.org/dc/terms/")
LDP   = Namespace("http://www.w3.org/ns/ldp#")
SOLID = Namespace("http://www.w3.org/ns/solid/terms#")
RDF   = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")


def test_addressbook_index_declares_required_predicates():
    g = Graph().parse(BOOTSTRAP_DIR / "containers" / "index.ttl", format="turtle",
                      publicID="https://pod.vardeman.me/vault/contacts/index.ttl")
    book = URIRef("https://pod.vardeman.me/vault/contacts/index.ttl#this")
    assert (book, RDF.type, VCARD.AddressBook) in g
    assert (book, DCT.title, None) in g
    assert (book, VCARD.nameEmailIndex, None) in g
    assert (book, VCARD.groupIndex, None) in g


def test_people_ttl_parses():
    Graph().parse(BOOTSTRAP_DIR / "containers" / "people.ttl", format="turtle")


def test_groups_ttl_parses():
    Graph().parse(BOOTSTRAP_DIR / "containers" / "groups.ttl", format="turtle")


def test_typeindex_patch_parses():
    g = Graph().parse(BOOTSTRAP_DIR / "typeindex-patch.ttl", format="n3")
    inserts = list(g.subjects(RDF.type, SOLID.InsertDeletePatch))
    assert len(inserts) == 1


def test_container_meta_patches_parse_and_carry_constrainedBy():
    """Each per-container meta patch inserts ldp:constrainedBy pointing at the matching shape."""
    expected = {
        "person-container-meta": ("/vault/contacts/Person/",       "contact-card.shacl.ttl"),
        "organization-container-meta": ("/vault/contacts/Organization/", "organization-card.shacl.ttl"),
        "group-container-meta": ("/vault/contacts/Group/",         "group.shacl.ttl"),
        "membership-container-meta": ("/vault/contacts/Membership/", "membership.shacl.ttl"),
    }
    for stem, (container_path, shape_file) in expected.items():
        # Parse as N3 (formula-bearing patch files are not valid Turtle)
        Graph().parse(BOOTSTRAP_DIR / "patches" / f"{stem}.ttl", format="n3")
        # Check raw source text for required tokens
        body = (BOOTSTRAP_DIR / "patches" / f"{stem}.ttl").read_text()
        assert "ldp:constrainedBy" in body, f"{stem} missing ldp:constrainedBy"
        assert container_path in body, f"{stem} container_path {container_path} not in body"
        assert shape_file in body, f"{stem} shape file {shape_file} not in body"
