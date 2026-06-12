"""Templates parse and reference correct shapes."""
import pytest
import pyshacl
from rdflib import Graph, Namespace
from pathlib import Path

TMPL_DIR   = Path(__file__).parent.parent / "overlays" / "addressbook" / "templates"
SHAPES_DIR = Path(__file__).parent.parent / "overlays" / "addressbook" / "shapes"
TMPL = Namespace("https://pod.vardeman.me/vault/ontology/template#")
RDF  = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")

# Base URL used consistently when parsing both shape and template body.
# Relative IRIs in both documents resolve against this origin so sh:hasValue
# comparisons work without a live server.
_BASE = "https://pod.vardeman.me/vault/"

PLACEHOLDER_VALUES = {
    "<<FULL_NAME>>":           "Test Person",
    "<<ORCID>>":               "0000-0001-0000-0000",
    "<<EMAIL>>":               "test@example.org",
    "<<PHONE>>":               "+1-555-555-5555",
    "<<ORGANIZATION_NAME>>":   "Test Organization",
    "<<ROR>>":                 "00mkhxb43",
    "<<HOMEPAGE>>":            "example.org",
    "<<GROUP_NAME>>":          "Test Group",
    "<<PERSON_UUID>>":         "7f3a1b8c-0000-0000-0000-000000000001",
    "<<ORG_UUID>>":            "a8b9c1d2-0000-0000-0000-000000000001",
    "<<MEMBER_UUID_1>>":       "7f3a1b8c-0000-0000-0000-000000000002",
    "<<MEMBER_UUID_2>>":       "7f3a1b8c-0000-0000-0000-000000000003",
    "<<MEMBERSHIP_UUID>>":     "9a8b7c6d-0000-0000-0000-000000000001",
    "<<START_DATE>>":          "2024-01-01",
    "<<END_DATE>>":            "2024-12-31",
    "<<ISO_DATETIME>>":        "2026-05-17T12:00:00Z",
    "<<ROLE>>":                "Researcher",
    "<<ORG_TYPE>>":            "Research Lab",
    "<<HOST>>":                "example.org",
    "<<PREDICATE>>":           "vcard:hasEmail",
    "<<OBJECT>>":              "<mailto:new@example.org>",
    # SP2 §6 write contract — contact-create template carries mem:rationale
    "<<RATIONALE>>":           "Test write: template substitution check.",
}


def _substitute(body: str) -> str:
    for k, v in PLACEHOLDER_VALUES.items():
        body = body.replace(k, v)
    return body


def _clean_body(body: str) -> str:
    """Strip comment lines and fix trailing semicolons so substituted bodies parse.

    Template bodies have commented-out optional triples after the last active
    triple. After substitution, comment lines remain but the preceding active
    triple may still carry a trailing semicolon — invalid Turtle without a
    following predicate. Strip comment-only lines, then replace the last
    dangling semicolon (with only whitespace/comments after it) with a period.
    """
    import re
    # Remove full-line comments (lines whose only non-whitespace content is #...)
    lines = [ln for ln in body.splitlines() if not ln.strip().startswith("#")]
    cleaned = "\n".join(lines)
    # Replace a trailing semicolon that has nothing but whitespace after it
    # (end of the last property list in a subject block).
    cleaned = re.sub(r";\s*$", " .", cleaned.rstrip())
    return cleaned


def _shape_file_for(validates_against: str) -> Path:
    """Map tmpl:validatesAgainst IRI → local shape file.

    The IRI is like /vault/meta/shapes/contact-card.shacl.ttl#ContactCardShape;
    extract the filename part and map to overlays/addressbook/shapes/.
    """
    path_part = validates_against.split("#")[0]
    fname = path_part.rstrip("/").split("/")[-1]
    return SHAPES_DIR / fname


def _load(name: str) -> Graph:
    return Graph().parse(TMPL_DIR / f"{name}.ttl", format="turtle")


def test_contact_create_template_parses():
    g = _load("contact-create")
    tmpls = list(g.subjects(RDF.type, TMPL.Template))
    assert len(tmpls) == 1
    tmpl_iri = tmpls[0]
    # Required predicates per design §4.2
    assert (tmpl_iri, TMPL.validatesAgainst, None) in g
    assert (tmpl_iri, TMPL.operation, None) in g
    assert (tmpl_iri, TMPL.targetContainer, None) in g
    assert (tmpl_iri, TMPL.slugAlgorithm, None) in g
    assert (tmpl_iri, TMPL.templateBody, None) in g


def test_contact_create_template_body_contains_required_predicates():
    g = _load("contact-create")
    tmpl_iri = next(iter(g.subjects(RDF.type, TMPL.Template)))
    body = str(next(g.objects(tmpl_iri, TMPL.templateBody)))
    assert "vcard:fn" in body
    assert "vcard:inAddressBook" in body
    assert "owl:sameAs" in body or "vcard:hasEmail" in body


def test_contact_update_template_parses():
    g = _load("contact-update")
    tmpls = list(g.subjects(RDF.type, TMPL.Template))
    assert len(tmpls) == 1
    tmpl_iri = tmpls[0]
    assert str(next(g.objects(tmpl_iri, TMPL.operation))) == "PATCH"
    body = str(next(g.objects(tmpl_iri, TMPL.templateBody)))
    assert "solid:inserts" in body or "solid:deletes" in body


def test_org_create_template_parses():
    g = _load("org-create")
    tmpls = list(g.subjects(RDF.type, TMPL.Template))
    assert len(tmpls) == 1
    tmpl_iri = tmpls[0]
    assert (tmpl_iri, TMPL.validatesAgainst, None) in g
    body = str(next(g.objects(tmpl_iri, TMPL.templateBody)))
    assert "vcard:Organization" in body
    assert "vcard:fn" in body
    assert "owl:sameAs" in body or "vcard:hasURL" in body


def test_group_create_template_parses():
    g = _load("group-create")
    tmpls = list(g.subjects(RDF.type, TMPL.Template))
    assert len(tmpls) == 1
    tmpl_iri = tmpls[0]
    body = str(next(g.objects(tmpl_iri, TMPL.templateBody)))
    assert "vcard:Group" in body
    assert "vcard:hasMember" in body


def test_membership_create_template_parses():
    g = _load("membership-create")
    tmpls = list(g.subjects(RDF.type, TMPL.Template))
    assert len(tmpls) == 1
    tmpl_iri = tmpls[0]
    body = str(next(g.objects(tmpl_iri, TMPL.templateBody)))
    assert "org:Membership" in body
    assert "org:member" in body
    assert "org:organization" in body
    assert "org:memberDuring" in body


@pytest.mark.parametrize("template_stem", [
    "contact-create",
    "org-create",
    "group-create",
    "membership-create",
])
def test_template_substituted_body_conforms_to_shape(template_stem):
    """Substituted template body must pass its declared SHACL shape.

    Catches template-vs-shape IRI mismatches before a live-Pod round trip.
    Both the template body and shape are parsed with the same base URL so
    relative IRI comparisons (e.g., sh:hasValue) are consistent.
    """
    g = Graph().parse(TMPL_DIR / f"{template_stem}.ttl", format="turtle",
                      publicID=_BASE)
    tmpl_iri = next(iter(g.subjects(RDF.type, TMPL.Template)))
    body = str(next(g.objects(tmpl_iri, TMPL.templateBody)))
    shape_iri = str(next(g.objects(tmpl_iri, TMPL.validatesAgainst)))

    substituted = _clean_body(_substitute(body))
    data_graph  = Graph().parse(data=substituted, format="turtle",
                                publicID=_BASE)
    shape_graph = Graph().parse(_shape_file_for(shape_iri), format="turtle",
                                publicID=_BASE)

    conforms, _rg, report_text = pyshacl.validate(
        data_graph, shacl_graph=shape_graph
    )
    assert conforms, (
        f"Template '{template_stem}' substituted body fails its shape:\n{report_text}"
    )
