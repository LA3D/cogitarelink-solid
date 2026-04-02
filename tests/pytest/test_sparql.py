"""Test SPARQL queries over pod .meta triples via Comunica (D28).

Comunica runs as @comunica/query-sparql with --contextOverride, so each
query must supply {"sources": [...]} via the `context` form parameter.
A session-scoped fixture discovers all .meta URLs from the LDP container
and passes them to every query.
"""
import json
import httpx
import pytest
from rdflib import Graph

CSS = "http://pod.vardeman.me:3000"
SPARQL = "http://localhost:8080/sparql"
CONCEPTS = f"{CSS}/vault/resources/concepts/"


@pytest.fixture(scope="module")
def meta_sources() -> list[str]:
    """Discover all .meta URLs from the concepts container."""
    r = httpx.get(CONCEPTS, headers={"Accept": "text/turtle"}, timeout=30)
    r.raise_for_status()
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=CONCEPTS)
    LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains"
    resources = [str(o) for _, p, o in g if str(p) == LDP_CONTAINS]
    assert len(resources) > 0, "No resources in concepts container"
    return [f"{res}.meta" for res in sorted(resources)]


def _query(sparql: str, sources: list[str]) -> list[dict]:
    """Execute a SPARQL query against Comunica with explicit sources."""
    ctx = json.dumps({"sources": sources})
    r = httpx.post(SPARQL,
                   data={"query": sparql, "context": ctx},
                   headers={"Accept": "application/sparql-results+json"},
                   timeout=120)
    r.raise_for_status()
    return r.json()["results"]["bindings"]


@pytest.mark.integration
@pytest.mark.sparql
def test_find_concepts(meta_sources):
    """Comunica should find skos:Concept instances from .meta."""
    bindings = _query("""
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        SELECT ?c ?label WHERE {
            ?c a skos:Concept ; skos:prefLabel ?label .
        }
    """, meta_sources)
    labels = [b["label"]["value"] for b in bindings]
    assert len(labels) >= 3, f"Expected >=3 concepts, got {labels}"
    assert "Contextual Retrieval" in labels


@pytest.mark.integration
@pytest.mark.sparql
def test_find_all_labels(meta_sources):
    """Every imported resource should have a skos:prefLabel."""
    bindings = _query("""
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        SELECT ?s ?label WHERE {
            ?s skos:prefLabel ?label .
        }
    """, meta_sources)
    assert len(bindings) >= 10, f"Expected >=10 labelled resources, got {len(bindings)}"


@pytest.mark.integration
@pytest.mark.sparql
def test_find_relationships(meta_sources):
    """Comunica should find skos:related links between concepts."""
    bindings = _query("""
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        SELECT ?from ?to WHERE {
            ?from skos:related ?to .
        }
    """, meta_sources)
    assert len(bindings) >= 1, f"Expected >=1 relationship, got {len(bindings)}"


@pytest.mark.integration
@pytest.mark.sparql
def test_find_tags(meta_sources):
    """Comunica should find dct:subject tags from .meta."""
    bindings = _query("""
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        SELECT ?concept ?tag WHERE {
            ?concept dct:subject ?tag .
        }
    """, meta_sources)
    tags = [b["tag"]["value"] for b in bindings]
    assert len(tags) >= 5, f"Expected >=5 tags, got {len(tags)}"
    tag_set = set(tags)
    assert tag_set & {"retrieval", "rag", "context-engineering", "agent-memory",
                      "knowledge-fabric"}, f"No expected tags found, got {tag_set}"


@pytest.mark.integration
@pytest.mark.sparql
def test_provenance_triples(meta_sources):
    """Imported resources should have prov:wasDerivedFrom triples."""
    bindings = _query("""
        PREFIX prov: <http://www.w3.org/ns/prov#>
        SELECT ?resource ?source WHERE {
            ?resource prov:wasDerivedFrom ?source .
        }
    """, meta_sources)
    assert len(bindings) >= 5, f"Expected >=5 provenance triples, got {len(bindings)}"
    sources = [b["source"]["value"] for b in bindings]
    assert any(s.startswith("file://") for s in sources), \
        f"No file:// sources found in {sources[:5]}"


@pytest.mark.integration
@pytest.mark.sparql
def test_digest_integrity(meta_sources):
    """Imported resources should have ni:digestMultibase hashes."""
    bindings = _query("""
        PREFIX ni: <http://www.w3.org/2021/ni#>
        SELECT ?resource ?digest WHERE {
            ?resource ni:digestMultibase ?digest .
        }
    """, meta_sources)
    assert len(bindings) >= 5, f"Expected >=5 digest triples, got {len(bindings)}"
    digests = [b["digest"]["value"] for b in bindings]
    assert all(d.startswith("z") for d in digests), \
        f"Digests should start with 'z' (base58btc), got {digests[:3]}"
