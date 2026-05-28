"""Affordance descriptors parse and embed valid SPARQL."""
from pathlib import Path
from rdflib import Graph, Namespace
from rdflib.plugins.sparql.parser import parseQuery

AFFORDANCE_DIR = Path(__file__).parent.parent / "overlays" / "addressbook" / "affordances"
WIKI = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")
SUB  = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
RDF  = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")


def _load(name: str) -> Graph:
    return Graph().parse(AFFORDANCE_DIR / f"{name}.ttl", format="turtle")


def _query_text(g: Graph, query_predicate) -> str:
    return str(next(g.objects(None, query_predicate)))


def _check_affordance(name: str, must_contain: list[str]):
    """Reusable helper: affordance file parses, has selectQuery, SPARQL is valid, contains expected predicates."""
    g = _load(name)
    query = _query_text(g, SUB.selectQuery)
    for marker in must_contain:
        assert marker in query, f"{name}: query missing expected marker {marker!r}"
    parseQuery(query)  # raises on invalid SPARQL


def test_bridge_card_to_wiki_parses():
    _check_affordance("bridge-card-to-wiki", ["foaf:primaryTopic"])


def test_contact_find_by_name_parses():
    _check_affordance("contact-find-by-name", ["vcard:fn", "CONTAINS"])


def test_contact_find_by_orcid_parses():
    _check_affordance("contact-find-by-orcid", ["owl:sameAs"])


def test_contact_find_by_email_parses():
    _check_affordance("contact-find-by-email", ["vcard:hasEmail"])


def test_contact_find_by_affiliation_parses():
    _check_affordance("contact-find-by-affiliation", ["org:hasMembership", "org:organization"])


def test_contact_find_by_group_parses():
    _check_affordance("contact-find-by-group", ["vcard:hasMember"])


def test_org_find_by_name_parses():
    _check_affordance("org-find-by-name", ["vcard:Organization", "vcard:fn"])


def test_org_find_by_ror_parses():
    _check_affordance("org-find-by-ror", ["owl:sameAs"])
