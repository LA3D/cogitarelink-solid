"""End-to-end: cold-start discovery → create contact → SHACL rejection → find by ORCID.

Four scenarios validate the full AddressBook substrate (Batch 12 / Task 27):
1. Cold-start TypeIndex discovery finds vcard:AddressBook
2. Valid contact PUT with ORCID anchor succeeds (201/205)
3. Anchorless contact PUT is rejected (422) with parseable sh:ValidationReport
4. Created contact is findable by owl:sameAs ORCID

URL pattern: /vault/contacts/Person/<uuid>.ttl (flat; sub-containers blocked by constrainedBy).
SHACL inAddressBook value: https://pod.vardeman.me/contacts/index.ttl#this
(shape uses </contacts/index.ttl#this> which resolves from server root, not /vault/).
"""
import shutil
import subprocess
import uuid
import httpx
import pytest
from rdflib import Graph, Namespace, URIRef

POD   = "https://pod.vardeman.me/vault/"
VCARD = Namespace("http://www.w3.org/2006/vcard/ns#")
OWL   = Namespace("http://www.w3.org/2002/07/owl#")
FOAF  = Namespace("http://xmlns.com/foaf/0.1/")
SOLID = Namespace("http://www.w3.org/ns/solid/terms#")
SH    = Namespace("http://www.w3.org/ns/shacl#")

# inAddressBook value the shape requires (</contacts/...> resolves from server root)
ADDRESSBOOK_IRI = "https://pod.vardeman.me/contacts/index.ttl#this"

CLIENT = httpx.Client(verify=False, timeout=10)


def _card_url(contact_uuid: str) -> str:
    return f"{POD}contacts/Person/{contact_uuid}.ttl"


def _card_body(contact_uuid: str, orcid: str | None = None, anchored: bool = True) -> str:
    anchor = f"   owl:sameAs <{orcid}> ;" if orcid else ""
    if anchored and not orcid:
        anchor = f"   vcard:hasEmail <mailto:{contact_uuid[:8]}@example.org> ;"
    return f"""\
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .

<#this> a vcard:Individual, foaf:Person ;
   vcard:fn "Test Person {contact_uuid[:8]}" ;
   vcard:inAddressBook <{ADDRESSBOOK_IRI}> ;
{anchor}
   foaf:name "Test Person {contact_uuid[:8]}" .
"""


@pytest.fixture
def created_card():
    """Create a contact card and clean up after the test."""
    contact_uuid = str(uuid.uuid4())
    orcid = f"https://orcid.org/0000-0009-{contact_uuid[:4]}-{contact_uuid[4:8]}"
    card_url = _card_url(contact_uuid)
    body = _card_body(contact_uuid, orcid=orcid)
    r = CLIENT.put(card_url, content=body, headers={"Content-Type": "text/turtle"})
    assert r.status_code in (201, 205), f"Fixture PUT failed: {r.status_code} {r.text[:200]}"
    yield {"uuid": contact_uuid, "orcid": orcid, "url": card_url}
    CLIENT.delete(card_url)


def test_addressbook_discoverable_via_typeindex():
    """Cold agent: TypeIndex → vcard:AddressBook registration present."""
    r = CLIENT.get(POD + "settings/publicTypeIndex", headers={"Accept": "text/turtle"})
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=str(r.url))
    matches = list(g.subjects(SOLID.forClass, VCARD.AddressBook))
    assert matches, "vcard:AddressBook not registered in publicTypeIndex"
    # Also verify the instance points to the AddressBook root
    for reg in matches:
        instance = list(g.objects(reg, SOLID.instance))
        if instance:
            assert "contacts/index.ttl#this" in str(instance[0])


def test_create_contact_with_orcid_succeeds():
    """Valid contact card (fn + inAddressBook + owl:sameAs) is accepted."""
    contact_uuid = str(uuid.uuid4())
    orcid = f"https://orcid.org/0000-0001-{contact_uuid[:4]}-{contact_uuid[4:8]}"
    card_url = _card_url(contact_uuid)
    body = _card_body(contact_uuid, orcid=orcid)

    r = CLIENT.put(card_url, content=body, headers={"Content-Type": "text/turtle"})
    assert r.status_code in (201, 205), f"PUT failed: {r.status_code} {r.text[:300]}"

    try:
        r2 = CLIENT.get(card_url, headers={"Accept": "text/turtle"})
        assert r2.status_code == 200
        g = Graph().parse(data=r2.text, format="turtle", publicID=card_url)
        person = URIRef(card_url + "#this")
        assert (person, VCARD.fn, None) in g, "vcard:fn missing on round-trip"
        assert (person, OWL.sameAs, URIRef(orcid)) in g, "owl:sameAs ORCID missing on round-trip"
    finally:
        CLIENT.delete(card_url)


def test_create_contact_missing_anchor_rejected():
    """SHACL minimum-metadata invariant: anchorless contact returns 422 + ValidationReport."""
    contact_uuid = str(uuid.uuid4())
    card_url = _card_url(contact_uuid)
    # No owl:sameAs, no vcard:hasEmail, no vcard:hasTelephone → sh:OrConstraintComponent fires
    body = f"""\
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .

<#this> a vcard:Individual, foaf:Person ;
   vcard:fn "Anchorless {contact_uuid[:8]}" ;
   vcard:inAddressBook <{ADDRESSBOOK_IRI}> .
"""
    r = CLIENT.put(card_url, content=body, headers={"Content-Type": "text/turtle"})
    assert r.status_code in (400, 409, 422), (
        f"Expected SHACL rejection (4xx), got {r.status_code}: {r.text[:200]}"
    )

    ct = r.headers.get("content-type", "")
    assert "turtle" in ct or "ld+json" in ct, (
        f"Expected RDF response body (text/turtle or application/ld+json), "
        f"got Content-Type: {ct!r}. Body: {r.text[:300]!r}"
    )

    rdf_format = ct.split(";")[0].strip()
    g = Graph().parse(data=r.text, format=rdf_format)
    reports = list(g.subjects(predicate=None, object=SH.ValidationReport))
    assert reports, f"Expected sh:ValidationReport in response body, got: {r.text[:300]}"

    # Verify sh:conforms false is present
    conforms_vals = list(g.objects(reports[0], SH.conforms))
    assert conforms_vals and str(conforms_vals[0]).lower() == "false", (
        "sh:conforms should be false in the report"
    )


def test_find_by_orcid_returns_created_contact(created_card):
    """After creation, contact is retrievable and owl:sameAs ORCID is present."""
    orcid = created_card["orcid"]
    card_url = created_card["url"]

    if shutil.which("solid-pod"):
        query = (
            f"PREFIX owl: <http://www.w3.org/2002/07/owl#> "
            f"SELECT ?p WHERE {{ ?p owl:sameAs <{orcid}> }}"
        )
        result = subprocess.run(
            ["solid-pod", "sparql", card_url, query],
            capture_output=True, text=True,
        )
        assert created_card["uuid"] in result.stdout or orcid in result.stdout, (
            f"solid-pod lookup did not return expected contact:\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    else:
        # Fallback: GET card, parse, verify owl:sameAs triple
        r = CLIENT.get(card_url, headers={"Accept": "text/turtle"})
        assert r.status_code == 200, f"GET {card_url} failed: {r.status_code}"
        g = Graph().parse(data=r.text, format="turtle", publicID=card_url)
        person = URIRef(card_url + "#this")
        assert (person, OWL.sameAs, URIRef(orcid)) in g, (
            f"owl:sameAs <{orcid}> not found on {person}"
        )
