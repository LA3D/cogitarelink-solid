"""prefs: vocabulary parses and defines required terms."""
from rdflib import Graph, Namespace

PREFS = Namespace("https://pod.vardeman.me/vault/ontology/owner-prefs#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")


def test_owner_prefs_vocab_defines_required_terms():
    g = Graph().parse(
        "overlays/owner-identity/vocabulary/owner-prefs.ttl",
        format="turtle",
    )
    expected = [
        PREFS.PodOwnerPreferences,
        PREFS.fullName,
        PREFS.orcid,
        PREFS.wikiSlug,
        PREFS.primaryAffiliationROR,
        PREFS.primaryAffiliationName,
        PREFS.membershipRole,
        PREFS.membershipStart,
        PREFS.email,
        PREFS.foafImg,
        PREFS.setupOwnerCompleted,
    ]
    for term in expected:
        assert (term, None, None) in g, f"Missing definition for {term}"
        labels = list(g.objects(term, RDFS.label))
        assert labels, f"Missing rdfs:label for {term}"
