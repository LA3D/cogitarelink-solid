"""SP2 §6 write contract, Turtle lanes: id-schemes rationale required; contacts de-conflated (no mem:rationale)."""
import httpx
import pytest
from rdflib import Graph, Namespace
from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
MEM = Namespace("https://pod.vardeman.me/vault/ontology/mem#")
LDP = Namespace("http://www.w3.org/ns/ldp#")
pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")

BARE_CARD = """@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
<> a vcard:Individual ; vcard:fn "No Context" ;
   vcard:inAddressBook <https://pod.vardeman.me/vault/contacts/index.ttl#this> ;
   vcard:hasEmail <mailto:noctx@example.org> .
"""

BARE_ORG = """@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
<> a vcard:Organization, foaf:Organization ;
   vcard:fn "Test Org" ;
   vcard:inAddressBook <https://pod.vardeman.me/vault/contacts/index.ttl#this> ;
   owl:sameAs <https://ror.org/00mkhxb43> .
"""


def test_bare_contact_admitted_no_memory_contract():
    # AddressBook is operational LD — a vcard card with no mem:rationale is valid.
    r = httpx.post(f"{POD}/vault/contacts/Person/", content=BARE_CARD,
                   headers={"Content-Type": "text/turtle", "Slug": "deconflate-card"}, verify=_CA)
    assert r.status_code == 201, f"got {r.status_code}: {r.text[:300]}"
    httpx.delete(r.headers.get("location", f"{POD}/vault/contacts/Person/deconflate-card"), verify=_CA)


def test_bare_org_admitted_no_memory_contract():
    r = httpx.post(f"{POD}/vault/contacts/Organization/", content=BARE_ORG,
                   headers={"Content-Type": "text/turtle", "Slug": "deconflate-org"}, verify=_CA)
    assert r.status_code == 201, f"got {r.status_code}: {r.text[:300]}"
    httpx.delete(r.headers.get("location", f"{POD}/vault/contacts/Organization/deconflate-org"), verify=_CA)


def _sweep(ctr_path):
    g = Graph()
    r = httpx.get(f"{POD}{ctr_path}", headers={"Accept": "text/turtle"}, verify=_CA)
    g.parse(data=r.text, format="turtle", publicID=f"{POD}{ctr_path}")
    members = [str(m) for m in g.objects(None, LDP.contains)]
    assert members, f"{ctr_path} empty?"
    missing = []
    for m in members:
        mg = Graph()
        body = httpx.get(m, headers={"Accept": "text/turtle"}, verify=_CA).text
        mg.parse(data=body, format="turtle", publicID=m)
        if (None, MEM.rationale, None) not in mg:
            missing.append(m)
    return missing


BARE_SCHEME = """\
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix idot: <http://identifiers.org/idot/> .
@prefix dct:  <http://purl.org/dc/terms/> .
<> a foaf:Document ; dct:title "deconflate scheme" ;
   foaf:primaryTopic <{cat}#zz-deconflate> .
<{cat}#zz-deconflate> a idot:Namespace, skos:Concept, rdfs:Datatype ;
   skos:prefLabel "ZZ deconflate"@en ; skos:definition "de-conflation test scheme"@en ;
   idot:luiPattern "^Z\\\\d+$" ; idot:sampleID "Z1" .
"""


def test_bare_scheme_record_admitted_no_memory_contract():
    # id-schemes is operational reference data — a bare scheme record (no mem:rationale) is valid.
    url = f"{POD}/id/schemes/zz-deconflate"
    body = BARE_SCHEME.format(cat=f"{POD}/id/schemes/")
    r = httpx.put(url, content=body, headers={"Content-Type": "text/turtle"}, verify=_CA)
    assert r.status_code in (201, 205), f"got {r.status_code}: {r.text[:300]}"
    httpx.delete(url, verify=_CA)
