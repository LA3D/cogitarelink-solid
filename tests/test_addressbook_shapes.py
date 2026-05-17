"""SHACL conformance tests for AddressBook shapes."""
from pathlib import Path
import pytest
from rdflib import Graph, Namespace
from pyshacl import validate

SHAPES_DIR = Path(__file__).parent.parent / "overlays" / "addressbook" / "shapes"
VCARD = Namespace("http://www.w3.org/2006/vcard/ns#")
FOAF = Namespace("http://xmlns.com/foaf/0.1/")
OWL = Namespace("http://www.w3.org/2002/07/owl#")
ORG = Namespace("http://www.w3.org/ns/org#")


def load_shapes(filename: str) -> Graph:
    return Graph().parse(SHAPES_DIR / filename, format="turtle")


# ----- ContactCardShape -----

CONTACT_VALID_WITH_ORCID = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .

<#this> a vcard:Individual, foaf:Person ;
    vcard:fn "Jarek Nabrzyski" ;
    vcard:inAddressBook </contacts/index.ttl#this> ;
    owl:sameAs <https://orcid.org/0000-0001-7882-1326> .
"""

CONTACT_VALID_WITH_EMAIL = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .

<#this> a vcard:Individual, foaf:Person ;
    vcard:fn "Wang Wei" ;
    vcard:inAddressBook </contacts/index.ttl#this> ;
    vcard:hasEmail <mailto:wangwei@example.org> .
"""

CONTACT_MISSING_FN = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .

<#this> a vcard:Individual, foaf:Person ;
    vcard:inAddressBook </contacts/index.ttl#this> ;
    owl:sameAs <https://orcid.org/0000-0000-0000-0000> .
"""

CONTACT_NO_ANCHOR = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .

<#this> a vcard:Individual, foaf:Person ;
    vcard:fn "Just A Name" ;
    vcard:inAddressBook </contacts/index.ttl#this> .
"""


def _validate(data_turtle: str, shape_file: str) -> tuple[bool, str]:
    data = Graph().parse(data=data_turtle, format="turtle")
    shapes = load_shapes(shape_file)
    conforms, _report_graph, report_text = validate(data, shacl_graph=shapes)
    return conforms, report_text


def test_contact_valid_with_orcid_passes():
    conforms, report = _validate(CONTACT_VALID_WITH_ORCID, "contact-card.shacl.ttl")
    assert conforms, f"Expected conformance, got:\n{report}"


def test_contact_valid_with_email_passes():
    conforms, report = _validate(CONTACT_VALID_WITH_EMAIL, "contact-card.shacl.ttl")
    assert conforms, f"Expected conformance, got:\n{report}"


def test_contact_missing_fn_fails():
    conforms, report = _validate(CONTACT_MISSING_FN, "contact-card.shacl.ttl")
    assert not conforms
    assert "vcard:fn" in report or "fn" in report.lower()


def test_contact_no_anchor_fails():
    conforms, report = _validate(CONTACT_NO_ANCHOR, "contact-card.shacl.ttl")
    assert not conforms
    assert "anchor" in report.lower() or "owl:sameAs" in report or "vcard:hasEmail" in report


# ----- OrganizationCardShape -----

ORG_VALID_WITH_ROR = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .

<#this> a vcard:Organization, foaf:Organization ;
    vcard:fn "University of Notre Dame" ;
    vcard:inAddressBook </contacts/index.ttl#this> ;
    owl:sameAs <https://ror.org/00mkhxb43> .
"""

ORG_MISSING_FN = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .

<#this> a vcard:Organization, foaf:Organization ;
    vcard:inAddressBook </contacts/index.ttl#this> ;
    owl:sameAs <https://ror.org/00mkhxb43> .
"""

ORG_NO_ANCHOR = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .

<#this> a vcard:Organization, foaf:Organization ;
    vcard:fn "Mystery Lab" ;
    vcard:inAddressBook </contacts/index.ttl#this> .
"""


def test_org_valid_with_ror_passes():
    conforms, report = _validate(ORG_VALID_WITH_ROR, "organization-card.shacl.ttl")
    assert conforms, f"Expected conformance:\n{report}"


def test_org_missing_fn_fails():
    conforms, _ = _validate(ORG_MISSING_FN, "organization-card.shacl.ttl")
    assert not conforms


def test_org_no_anchor_fails():
    conforms, _ = _validate(ORG_NO_ANCHOR, "organization-card.shacl.ttl")
    assert not conforms


# ----- GroupShape -----

GROUP_VALID = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .

<#this> a vcard:Group ;
    vcard:fn "Notre Dame Collaborators" ;
    vcard:hasMember </contacts/Person/7f3a1b8c-9d2e-4c5a-8f1b-2e6d4a8c0f9e/index.ttl#this> ,
                    </contacts/Person/c4e5d6f7-1234-5678-9abc-def012345678/index.ttl#this> .
"""

GROUP_EMPTY = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .

<#this> a vcard:Group ;
    vcard:fn "Empty Group" .
"""


def test_group_valid_passes():
    conforms, report = _validate(GROUP_VALID, "group.shacl.ttl")
    assert conforms, f"Expected conformance:\n{report}"


def test_group_empty_fails():
    conforms, _ = _validate(GROUP_EMPTY, "group.shacl.ttl")
    assert not conforms
