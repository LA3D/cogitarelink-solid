"""tmpl: vocabulary parses and has required predicates."""
from rdflib import Graph, Namespace

TMPL = Namespace("https://pod.vardeman.me/vault/ontology/template#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")


def test_template_vocab_defines_required_terms():
    g = Graph().parse("overlays/addressbook/vocabulary/template.ttl", format="turtle")
    expected_terms = [
        TMPL.Template, TMPL.validatesAgainst, TMPL.operation,
        TMPL.targetContainer, TMPL.slugAlgorithm, TMPL.templateBody,
    ]
    for term in expected_terms:
        # Each term should appear as subject of at least one triple
        assert (term, None, None) in g, f"Missing definition for {term}"
        # Each term should have an rdfs:label
        labels = list(g.objects(term, RDFS.label))
        assert labels, f"Missing rdfs:label for {term}"
