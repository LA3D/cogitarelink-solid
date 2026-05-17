"""Templates parse and reference correct shapes."""
from rdflib import Graph, Namespace
from pathlib import Path

TMPL_DIR = Path(__file__).parent.parent / "overlays" / "addressbook" / "templates"
TMPL = Namespace("https://pod.vardeman.me/vault/ontology/template#")
RDF  = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")


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
