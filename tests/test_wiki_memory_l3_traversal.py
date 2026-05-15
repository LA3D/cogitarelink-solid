"""Run the 3 traversal target queries against the loaded fixture bundle.

Comunica is queried via the explicit-source workaround (RQ-Pod-4): each .meta URL
participates as an explicit source in the query context. Pure link-traversal from
the markdown body URL does NOT follow describedby Link headers on non-RDF resources
(known Comunica limitation — see docs/plans/2026-05-15-rq-pod-4-workaround-notes.md).

All three queries use absolute URIs; relative IRIs are rejected by Comunica HTTP
endpoint when no base IRI is set in the query context.

Query file alignment notes:
- 03-source-creator-roundtrip.rq uses dct:contributor (not dct:creator) because
  MarkdownProjectionListener emits dct:contributor for {.author} class hints.
"""
import json
import sys
from pathlib import Path

import httpx
import pytest

POD = "http://pod.vardeman.me:3000"
COMUNICA = "http://localhost:8080/sparql"
QUERIES = Path(__file__).parent / "fixtures" / "wiki-memory-l3" / "traversal-queries"


def _query(sparql: str, sources: list[str]) -> dict:
    ctx = json.dumps({"sources": sources})
    r = httpx.post(
        COMUNICA,
        data={"query": sparql, "context": ctx},
        headers={"Accept": "application/sparql-results+json"},
        timeout=60.0,
    )
    r.raise_for_status()
    return r.json()


@pytest.fixture(autouse=True, scope="module")
def _load_fixtures():
    sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
    from load_l3_fixtures import main as load_main
    rc = load_main()
    assert rc == 0, "Fixture loading failed"
    yield


@pytest.mark.integration
def test_query_1_moc_to_source_titles() -> None:
    """Query 1: concepts linked to the MOC should reference a source with a title."""
    q = (QUERIES / "01-moc-to-source-titles.rq").read_text()
    meta_paths = [
        f"{POD}/wiki/pages/agentic-memory-systems-moc.md.meta",
        f"{POD}/wiki/pages/wiki-memory-l3-profile.md.meta",
        f"{POD}/wiki/sources/ghumare---llm-wiki-v2-extending-karpathy.md.meta",
    ]
    try:
        result = _query(q, meta_paths)
    except Exception as e:
        pytest.skip(f"Comunica unavailable: {e}")

    bindings = result.get("results", {}).get("bindings", [])
    assert len(bindings) >= 1, f"Expected at least one source title, got: {bindings}"
    titles = [b["title"]["value"] for b in bindings]
    assert any("Ghumare" in t for t in titles), f"Expected Ghumare in titles, got {titles}"


@pytest.mark.integration
def test_query_2_concept_to_author_affiliation() -> None:
    """Query 2: wiki-memory L3 profile should have a contributor with a name."""
    q = (QUERIES / "02-concept-to-author-affiliation.rq").read_text()
    meta_paths = [
        f"{POD}/wiki/pages/wiki-memory-l3-profile.md.meta",
        f"{POD}/wiki/people/karpathy-andrej.md.meta",
    ]
    try:
        result = _query(q, meta_paths)
    except Exception as e:
        pytest.skip(f"Comunica unavailable: {e}")

    bindings = result.get("results", {}).get("bindings", [])
    assert len(bindings) >= 1, f"Expected at least one contributor, got: {bindings}"
    names = [b["name"]["value"] for b in bindings]
    assert any("Karpathy" in n for n in names), f"Expected Karpathy in names, got {names}"


@pytest.mark.integration
def test_query_3_source_contributor_roundtrip() -> None:
    """Query 3: Ghumare source should link back to citing concept + contributor name.

    Uses dct:contributor (not dct:creator) — MarkdownProjectionListener emits
    dct:contributor for {.author} class hints per current predicate dispatch.
    """
    q = (QUERIES / "03-source-creator-roundtrip.rq").read_text()
    meta_paths = [
        f"{POD}/wiki/sources/ghumare---llm-wiki-v2-extending-karpathy.md.meta",
        f"{POD}/wiki/pages/wiki-memory-l3-profile.md.meta",
        f"{POD}/wiki/people/karpathy-andrej.md.meta",
    ]
    try:
        result = _query(q, meta_paths)
    except Exception as e:
        pytest.skip(f"Comunica unavailable: {e}")

    bindings = result.get("results", {}).get("bindings", [])
    assert len(bindings) >= 1, f"Expected at least one roundtrip result, got: {bindings}"
    creator_names = [b["creatorName"]["value"] for b in bindings]
    assert any("Karpathy" in n for n in creator_names), \
        f"Expected Karpathy in contributor names, got {creator_names}"
    concept_titles = [b["conceptTitle"]["value"] for b in bindings]
    assert any("Wiki-Memory" in t for t in concept_titles), \
        f"Expected Wiki-Memory concept in results, got {concept_titles}"
