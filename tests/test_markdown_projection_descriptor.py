from pathlib import Path
from rdflib import Graph, Namespace, RDF

SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
DESC = Path("overlays/wiki-memory/affordances/markdown-projection.ttl")

def _graph():
    g = Graph(); g.parse(DESC, format="turtle", publicID="https://pod.vardeman.me/vault/meta/affordances/markdown-projection.ttl")
    return g

def test_governs_includes_literal_axis():
    g = _graph()
    governed = set(g.objects(None, SUB.governs))
    for p in (SKOS.prefLabel, SKOS.altLabel, SKOS.definition):
        assert p in governed, f"sub:governs missing {p}"

def test_projects_from_body_declared():
    g = _graph()
    body = set(str(o) for o in g.objects(None, SUB.projectsFromBody))
    assert body, "sub:projectsFromBody not declared"
    assert any("literal" in b.lower() for b in body)
