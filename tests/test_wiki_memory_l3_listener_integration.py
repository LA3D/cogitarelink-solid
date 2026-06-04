"""Integration tests: MarkdownProjectionListener round-trip + Model A + concurrency + composability.

Prerequisites:
- Pod running at POD_URL (default: https://pod.vardeman.me)
- /wiki/{pages,sources,people,procedures,working}/ containers exist
- MarkdownProjectionListener wired and healthy (check docker logs)

Run:
    POD_URL=https://pod.vardeman.me pytest tests/test_wiki_memory_l3_listener_integration.py -v
"""
from __future__ import annotations

import asyncio
import os
import time
from pathlib import Path

import httpx
import pytest
from rdflib import Graph, URIRef

from tests.conftest import _pod_base

# All tests here hit the live Pod; the root conftest gate skips them when it's down.
pytestmark = pytest.mark.integration

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# D107: the storage root is /vault — writes outside it get no projection.
POD = _pod_base() + "/vault"
FIX = Path(__file__).parent / "fixtures" / "wiki-memory-l3"

DCT_MODIFIED = URIRef("http://purl.org/dc/terms/modified")
PROV_WAS_GENERATED_BY = URIRef("http://www.w3.org/ns/prov#wasGeneratedBy")

# Predicates injected by CSS itself — not governed, always excluded from comparison
CSS_PREDICATES = {
    URIRef("http://www.w3.org/ns/ldp#Resource"),                     # rdf:type value
    URIRef("http://www.w3.org/ns/posix/stat#mtime"),
    URIRef("http://www.w3.org/ns/posix/stat#size"),
    URIRef("http://www.w3.org/ns/ma-ont#format"),
    # The projection-provenance stamp. Its SUBJECT is in flux between the C-T2c
    # source (relocated to <…md.meta>) and the deployed Pod build (still on the
    # resource <…md>); the predicate+object are identical. Excluded like
    # dct:modified — it's a substrate stamp, not governed content. (Subject skew
    # tracked separately; this test asserts projected content, not stamp placement.)
    PROV_WAS_GENERATED_BY,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ensure_wiki_containers() -> None:
    """Create /wiki/{pages,sources,people,procedures,working}/ if absent."""
    for seg in ("wiki", "wiki/concepts", "wiki/people", "wiki/procedures", "wiki/working"):
        url = f"{POD}/{seg}/"
        r = httpx.get(url, headers={"Accept": "text/turtle"}, follow_redirects=True)
        if r.status_code == 404:
            httpx.put(
                url,
                content="@prefix ldp: <http://www.w3.org/ns/ldp#> . <> a ldp:BasicContainer .",
                headers={"Content-Type": "text/turtle"},
            )


def _wait_for_projection(target_url: str, timeout: float = 5.0) -> str:
    """Poll .meta until the listener has written projection triples.

    We distinguish CSS-only metadata from listener output by looking for
    either 'wiki#' (our namespace) or 'prov#' (provenance stamp), which
    CSS itself never writes.
    """
    start = time.time()
    while time.time() - start < timeout:
        r = httpx.get(f"{target_url}.meta", headers={"Accept": "text/turtle"})
        if r.status_code == 200:
            body = r.text
            if "wiki#" in body or "prov#wasGeneratedBy" in body:
                return body
        time.sleep(0.05)
    raise TimeoutError(
        f"Listener did not produce .meta at {target_url}.meta within {timeout}s"
    )


def _subset_check(expected: Graph, actual: Graph) -> list[str]:
    """Return list of triples in expected but NOT in actual.

    Excludes dct:modified (dynamic timestamp) and CSS-injected predicates.
    """
    missing = []
    for s, p, o in expected:
        if p == DCT_MODIFIED:
            continue  # dynamic — skip
        if p in CSS_PREDICATES:
            continue  # CSS-injected, never in fixture
        if (s, p, o) not in actual:
            missing.append(f"  MISSING triple: {s.n3()} {p.n3()} {o.n3()}")
    return missing


# ---------------------------------------------------------------------------
# Session-scoped setup: create wiki containers once
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session", autouse=True)
def wiki_containers() -> None:
    _ensure_wiki_containers()


# ---------------------------------------------------------------------------
# Task 32 — Round-trip: PUT body → listener fires → .meta matches fixture
# ---------------------------------------------------------------------------


# D98 merged pages/ + sources/ into concepts/. The concept + source fixtures
# carry [Label]{.prefLabel} body spans (verified), so they clear the D108
# admission floor on /wiki/concepts/; people/ stays prefLabel-free (schema:name).
@pytest.mark.parametrize("body_file,container,expected_meta", [
    ("wiki-memory-l3-profile.md", "concepts", "wiki-memory-l3-profile.md.meta"),
    ("agentic-memory-systems-moc.md", "concepts", "agentic-memory-systems-moc.md.meta"),
    ("ghumare---llm-wiki-v2-extending-karpathy.md", "concepts", "ghumare---llm-wiki-v2-extending-karpathy.md.meta"),
    ("karpathy-andrej.md", "people", "karpathy-andrej.md.meta"),
])
def test_round_trip(body_file: str, container: str, expected_meta: str) -> None:
    """PUT body → listener fires → .meta contains all expected governed triples."""
    body = (FIX / "bodies" / body_file).read_text()
    target = f"{POD}/wiki/{container}/{body_file}"

    expected = Graph()
    expected.parse(
        FIX / "meta" / expected_meta,
        format="turtle",
        publicID=target,
    )

    r = httpx.put(target, content=body, headers={"Content-Type": "text/markdown"})
    assert r.status_code in (201, 205), f"PUT failed: {r.status_code} {r.text[:200]}"

    actual_ttl = _wait_for_projection(target)
    actual = Graph()
    actual.parse(data=actual_ttl, format="turtle", publicID=target)

    missing = _subset_check(expected, actual)
    assert not missing, (
        f"Graph mismatch for {body_file}:\n"
        + "\n".join(missing)
        + f"\n\n--ACTUAL .meta--\n{actual_ttl}"
    )


# ---------------------------------------------------------------------------
# Task 33 — Model A: agent enrichment survives body rewrite
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "CSS FileDataAccessor.writeMetadataFile() overwrites the .meta file on each "
        "resource PUT, erasing any user-added triples before the MonitoringStore event "
        "fires and MetaWriter can read them. The MetaWriter's Model A preservation logic "
        "is correct (verified in unit tests) but operates too late in the request pipeline. "
        "Fix requires either: (a) MetaWriter reading pre-write .meta state via git history, "
        "or (b) a separate .meta.agent sidecar that CSS never touches, merged at read time. "
        "Tracked as a known limitation of the current MetaWriter architecture."
    ),
    strict=True,
)
def test_agent_enrichment_survives_body_rewrite() -> None:
    """Model A: PUT body → PATCH adds non-governed triple → PUT body again → enrichment persists."""
    body = (FIX / "bodies" / "wiki-memory-l3-profile.md").read_text()
    target = f"{POD}/wiki/concepts/wiki-memory-l3-profile.md"

    # Initial write
    r = httpx.put(target, content=body, headers={"Content-Type": "text/markdown"})
    assert r.status_code in (201, 205), f"First PUT failed: {r.status_code}"
    _wait_for_projection(target)

    # PATCH: add a non-governed triple using N3 Patch
    patch_n3 = """\
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#>.
_:patch a solid:InsertDeletePatch;
    solid:inserts {
        <> wiki:relevantToProject </project/rung-1-4> .
    }.
"""
    rp = httpx.patch(
        f"{target}.meta",
        content=patch_n3,
        headers={"Content-Type": "text/n3"},
    )
    if rp.status_code not in (200, 205):
        # Try SPARQL Update if N3 Patch not accepted
        sparql_update = (
            f"INSERT DATA {{ "
            f"<{target}> <https://pod.vardeman.me/vault/ontology/wiki#relevantToProject> </project/rung-1-4> . "
            f"}}"
        )
        rp = httpx.patch(
            f"{target}.meta",
            content=sparql_update,
            headers={"Content-Type": "application/sparql-update"},
        )
    assert rp.status_code in (200, 205), (
        f"PATCH failed: {rp.status_code} {rp.text[:200]}"
    )

    # Second PUT — listener should re-project body, MetaWriter should preserve the PATCH'd triple
    r2 = httpx.put(target, content=body, headers={"Content-Type": "text/markdown"})
    assert r2.status_code in (201, 205), f"Second PUT failed: {r2.status_code}"
    _wait_for_projection(target)

    # Verify the agent-owned triple survived
    r3 = httpx.get(f"{target}.meta", headers={"Accept": "text/turtle"})
    g = Graph()
    g.parse(data=r3.text, format="turtle", publicID=target)

    rel_pred = URIRef("https://pod.vardeman.me/vault/ontology/wiki#relevantToProject")
    agents_triples = list(g.triples((None, rel_pred, None)))
    assert len(agents_triples) == 1, (
        f"Agent-owned triple was clobbered or missing "
        f"(expected 1, got {len(agents_triples)}):\n{r3.text}"
    )


# ---------------------------------------------------------------------------
# Task 34 — Concurrency: two simultaneous PUTs → no torn triples
# ---------------------------------------------------------------------------


async def _async_put(client: httpx.AsyncClient, target: str, body: str) -> int:
    r = await client.put(target, content=body, headers={"Content-Type": "text/markdown"})
    return r.status_code


def test_concurrent_writes_serialize_via_file_lock() -> None:
    """Two simultaneous PUTs to same resource → exactly one rdf:type triple, no torn state."""
    body_v1 = (FIX / "bodies" / "wiki-memory-l3-profile.md").read_text()
    body_v2 = body_v1.replace("Wiki-Memory L3 Profile", "Wiki-Memory L3 Profile v2")
    target = f"{POD}/wiki/concepts/wiki-memory-l3-profile.md"

    async def run() -> None:
        async with httpx.AsyncClient() as client:
            await asyncio.gather(
                _async_put(client, target, body_v1),
                _async_put(client, target, body_v2),
            )

    asyncio.run(run())
    time.sleep(0.5)  # let listener catch up

    r = httpx.get(f"{target}.meta", headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f".meta unavailable after concurrent writes: {r.status_code}"

    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=target)

    rdf_type = URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
    wiki_types = [
        o for _, p, o in g.triples((None, rdf_type, None))
        if str(o).startswith("https://pod.vardeman.me/vault/ontology/wiki#")
    ]
    assert len(wiki_types) == 1, (
        f"Expected exactly 1 wiki rdf:type (no torn state), got {wiki_types}:\n{r.text}"
    )


# ---------------------------------------------------------------------------
# Task 35 — Cross-listener composability: Memento + MarkdownProjection coexist
# ---------------------------------------------------------------------------


def test_memento_and_projection_compose() -> None:
    """A body PUT fires both listeners: Memento Link headers present AND .meta has projection."""
    body = (FIX / "bodies" / "karpathy-andrej.md").read_text()
    target = f"{POD}/wiki/people/karpathy-andrej.md"

    r = httpx.put(target, content=body, headers={"Content-Type": "text/markdown"})
    assert r.status_code in (201, 205), f"PUT failed: {r.status_code}"
    _wait_for_projection(target)

    # Check Memento Link headers on subsequent GET
    r2 = httpx.get(target)

    # httpx uses a case-insensitive multi-map; gather all link values
    link_header = r2.headers.get("link", "")
    has_timemap = "timemap" in link_header.lower()
    assert has_timemap, (
        f"Memento Link header missing after PUT. All headers:\n"
        + "\n".join(f"  {k}: {v}" for k, v in r2.headers.items())
    )

    # Check .meta has the projected Thing type. D95/D98: a person page types
    # <#this> as schema:Person (the Thing), not wiki:Person — wiki:Page governs
    # the document <>, schema.org types the Thing.
    r3 = httpx.get(f"{target}.meta", headers={"Accept": "text/turtle"})
    assert r3.status_code == 200
    assert "schema.org/Person" in r3.text or "schema:Person" in r3.text, (
        f".meta missing schema:Person Thing type — projection didn't fire:\n{r3.text}"
    )
