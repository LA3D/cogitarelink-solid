"""Integration test: vault import creates resources + .meta in pod."""
import httpx
import pytest
from rdflib import Graph

BASE = "http://pod.vardeman.me:3000"


@pytest.mark.integration
def test_concept_note_exists():
    """After import, a concept note should be readable."""
    r = httpx.get(f"{BASE}/vault/resources/concepts/contextual-retrieval.md", timeout=10)
    assert r.status_code == 200
    assert "Contextual Retrieval" in r.text


@pytest.mark.integration
def test_meta_has_type():
    """After import, .meta should have rdf:type triple."""
    r = httpx.get(f"{BASE}/vault/resources/concepts/contextual-retrieval.md.meta",
                  headers={"Accept": "text/turtle"}, timeout=10)
    assert r.status_code == 200
    assert "Concept" in r.text


@pytest.mark.integration
def test_meta_has_relationships():
    """Meta should include relationships from frontmatter."""
    r = httpx.get(f"{BASE}/vault/resources/concepts/contextual-retrieval.md.meta",
                  headers={"Accept": "text/turtle"}, timeout=10)
    g = Graph()
    g.parse(data=r.text, format="turtle")
    assert len(g) >= 4, f"Expected >=4 triples, got {len(g)}"


@pytest.mark.integration
def test_theory_note_exists():
    """Theory notes should also be imported."""
    r = httpx.get(f"{BASE}/vault/resources/concepts/progressive-disclosure.md", timeout=10)
    assert r.status_code == 200


@pytest.mark.integration
def test_multiple_notes_imported():
    """At least 3 notes should be importable."""
    slugs = ["contextual-retrieval", "compound-ai-systems", "episodic-memory"]
    for s in slugs:
        r = httpx.get(f"{BASE}/vault/resources/concepts/{s}.md", timeout=10)
        assert r.status_code == 200, f"{s}.md not found"
