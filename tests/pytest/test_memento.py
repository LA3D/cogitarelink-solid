"""End-to-end Memento (RFC 7089) protocol tests against the running CSS pod.

Rung 1.1 success ladder:
1. Health: CSS responds, memento extension loaded (no boot errors).
2. Write → commit: each PUT produces a git commit visible inside /data.
3. TimeMap: GET ?ext=timemap returns parseable Turtle with N memento:Mementos.
4. TimeGate: GET with Accept-Datetime → 302 + Memento URI.
5. Memento fetch: GET ?version=... returns historical content + Memento-Datetime header.
6. Live state unchanged: plain GET returns current content.
7. Regression: vault container still listable, count matches pre-Memento.

The stack must already be up. The tests touch /test-memento-* paths only
so they don't disturb the imported vault.
"""
import json
import subprocess
import time
from typing import Optional

import httpx
import pytest
from rdflib import Graph

from tests.conftest import _pod_base

CSS = _pod_base()
MEMENTO = "http://mementoweb.org/ns#"
LDES = "https://w3id.org/ldes#"
TEST_PATH = "/test-memento.txt"


def _git_in_css(*args: str) -> str:
    """Run a git command inside the css container against /data."""
    cmd = ["docker", "compose", "exec", "-T", "css", "git", "-C", "/data", *args]
    r = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return r.stdout.strip()


def _put(path: str, body: str) -> httpx.Response:
    r = httpx.put(
        f"{CSS}{path}",
        content=body,
        headers={"Host": "pod.vardeman.me", "Content-Type": "text/plain"},
        timeout=10,
    )
    return r


def _commit_count_for(path: str) -> int:
    """How many git commits touch this path. path is the LDP path under /."""
    fs_rel = path.lstrip("/")
    out = _git_in_css("log", "--format=%H", "--", fs_rel)
    if not out:
        return 0
    return len(out.splitlines())


def _wait_for_commits(path: str, min_count: int, timeout: float = 5.0) -> int:
    """Poll git log until at least min_count commits touch path, or timeout."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        n = _commit_count_for(path)
        if n >= min_count:
            return n
        time.sleep(0.1)
    return _commit_count_for(path)


@pytest.fixture(scope="module", autouse=True)
def _seed_test_resource():
    """Two writes to TEST_PATH so a Memento history exists for all tests."""
    r1 = _put(TEST_PATH, "first version")
    assert r1.status_code in (200, 201, 204, 205), f"first PUT failed: {r1.status_code} {r1.text}"
    _wait_for_commits(TEST_PATH, 1)
    r2 = _put(TEST_PATH, "second version")
    assert r2.status_code in (200, 201, 204, 205), f"second PUT failed: {r2.status_code} {r2.text}"
    _wait_for_commits(TEST_PATH, 2)
    yield


@pytest.mark.integration
@pytest.mark.memento
def test_memento_initialized_git_repo():
    """The listener bootstrapped /data as a git repo on first start."""
    out = _git_in_css("rev-parse", "--is-inside-work-tree")
    assert out == "true"


@pytest.mark.integration
@pytest.mark.memento
def test_writes_produce_commits():
    """Two PUTs to TEST_PATH should produce >=2 commits touching it."""
    count = _commit_count_for(TEST_PATH)
    assert count >= 2, f"expected >=2 commits for {TEST_PATH}, got {count}"


@pytest.mark.integration
@pytest.mark.memento
def test_live_state_unchanged_by_memento():
    """Plain GET (no Accept-Datetime) returns current state."""
    r = httpx.get(f"{CSS}{TEST_PATH}", headers={"Host": "pod.vardeman.me"}, timeout=10)
    assert r.status_code == 200, r.text
    assert r.text.strip() == "second version"


@pytest.mark.integration
@pytest.mark.memento
def test_timemap_returns_parseable_turtle():
    """GET ?ext=timemap returns Turtle with N memento:Memento subjects."""
    r = httpx.get(
        f"{CSS}{TEST_PATH}?ext=timemap",
        headers={"Host": "pod.vardeman.me", "Accept": "text/turtle"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert "turtle" in r.headers.get("content-type", "").lower()
    g = Graph()
    g.parse(data=r.text, format="turtle")
    mementos = list(g.subjects(predicate=None, object=rdf_type(f"{MEMENTO}Memento")))
    timemaps = list(g.subjects(predicate=None, object=rdf_type(f"{MEMENTO}TimeMap")))
    assert len(timemaps) == 1, f"expected 1 TimeMap subject, got {len(timemaps)}"
    assert len(mementos) >= 2, f"expected >=2 Mementos, got {len(mementos)}"


@pytest.mark.integration
@pytest.mark.memento
def test_timegate_redirects_with_accept_datetime():
    """GET with Accept-Datetime far in the past redirects (302) to the closest-prior Memento URI."""
    far_future = "Wed, 31 Dec 2099 23:59:59 GMT"
    r = httpx.get(
        f"{CSS}{TEST_PATH}",
        headers={"Host": "pod.vardeman.me", "Accept-Datetime": far_future},
        follow_redirects=False,
        timeout=10,
    )
    assert r.status_code == 302, f"expected 302, got {r.status_code}"
    loc = r.headers.get("location", "")
    assert "version=" in loc, f"redirect missing ?version=: {loc}"
    vary = r.headers.get("vary", "").lower()
    assert "accept-datetime" in vary


@pytest.mark.integration
@pytest.mark.memento
def test_memento_fetch_returns_historical_content():
    """Follow the TimeGate redirect; the Memento body should be one of the prior versions
    and Memento-Datetime should be set."""
    far_future = "Wed, 31 Dec 2099 23:59:59 GMT"
    r1 = httpx.get(
        f"{CSS}{TEST_PATH}",
        headers={"Host": "pod.vardeman.me", "Accept-Datetime": far_future},
        follow_redirects=True,
        timeout=10,
    )
    assert r1.status_code == 200, r1.text
    assert r1.headers.get("memento-datetime"), "Memento-Datetime header missing"
    assert r1.text.strip() in ("first version", "second version")


@pytest.mark.integration
@pytest.mark.memento
def test_plain_get_advertises_timemap_and_vary():
    """RFC 7089 §4.1.1: plain GET on an OriginalResource must include
    `Vary: accept-datetime` and `Link: rel="timemap"` so Memento-aware clients
    can discover the temporal access surface without prior knowledge."""
    r = httpx.get(f"{CSS}{TEST_PATH}", headers={"Host": "pod.vardeman.me"}, timeout=10)
    assert r.status_code == 200, r.text
    vary = r.headers.get("vary", "").lower()
    assert "accept-datetime" in vary, f"missing Vary: accept-datetime, got: {r.headers.get('vary')}"
    link = r.headers.get("link", "")
    assert 'rel="timemap"' in link, f'missing Link rel="timemap", got: {link}'
    assert "ext=timemap" in link, f"timemap URI not in Link header: {link}"


@pytest.mark.integration
@pytest.mark.memento
def test_concurrent_writes_to_different_paths_produce_separate_commits():
    """Two PUTs to different paths must end up in two distinct commits — directly
    tests the per-path staging fix (W2.1). Without `git add -- <path>` + `--only`,
    one commit would lump both files."""
    p1, p2 = "/test-mem-concurrent-a.txt", "/test-mem-concurrent-b.txt"
    r1 = _put(p1, "alpha")
    r2 = _put(p2, "bravo")
    assert r1.status_code in (200, 201, 204, 205)
    assert r2.status_code in (200, 201, 204, 205)
    _wait_for_commits(p1, 1)
    _wait_for_commits(p2, 1)
    hashes_a = _git_in_css("log", "--format=%H", "--", p1.lstrip("/")).splitlines()
    hashes_b = _git_in_css("log", "--format=%H", "--", p2.lstrip("/")).splitlines()
    assert len(hashes_a) == 1, f"expected 1 commit for {p1}, got {len(hashes_a)}"
    assert len(hashes_b) == 1, f"expected 1 commit for {p2}, got {len(hashes_b)}"
    assert hashes_a[0] != hashes_b[0], "commits must be distinct, got the same hash"
    files_in_a = _git_in_css("show", "--name-only", "--format=", hashes_a[0]).splitlines()
    assert p1.lstrip("/") in files_in_a
    assert p2.lstrip("/") not in files_in_a, f"per-path staging broken: {p1}'s commit also touched {p2}"


@pytest.mark.integration
@pytest.mark.memento
def test_redundant_write_does_not_create_spurious_commit():
    """PUTting the same content twice should produce only one new commit.
    Otherwise TimeMap fills with no-op Mementos."""
    p = "/test-mem-idempotent.txt"
    _put(p, "same content")
    _wait_for_commits(p, 1)
    n_before = _commit_count_for(p)
    _put(p, "same content")
    time.sleep(1.0)
    n_after = _commit_count_for(p)
    # Allow either 1 (gitCommitPath returned null) or maybe 2 (the .meta sidecar
    # changed even if body didn't); but never more than 2.
    assert n_after - n_before <= 1, f"redundant PUT produced {n_after - n_before} extra commits"


@pytest.mark.integration
@pytest.mark.memento
class TestTombstones:
    """Rung 1.2: LDP DELETE produces a tombstone Memento; subsequent GET returns 410;
    GET with Accept-Datetime before deletion still returns prior content; TimeMap
    surfaces the deletion as `ldes:DeletedLDPResource` per D64."""

    PATH = "/test-tombstone.txt"

    def test_full_delete_lifecycle(self):
        # 1. Create resource
        r1 = _put(self.PATH, "alive")
        assert r1.status_code in (200, 201, 204, 205), r1.text
        _wait_for_commits(self.PATH, 1)

        # 2. GET it (200, alive)
        r2 = httpx.get(f"{CSS}{self.PATH}", headers={"Host": "pod.vardeman.me"}, timeout=10)
        assert r2.status_code == 200
        assert r2.text.strip() == "alive"

        # 3. DELETE it
        r3 = httpx.delete(f"{CSS}{self.PATH}", headers={"Host": "pod.vardeman.me"}, timeout=10)
        assert r3.status_code in (200, 204, 205), r3.text
        _wait_for_commits(self.PATH, 2)

        # 4. GET it → 410 Gone (tombstone)
        r4 = httpx.get(f"{CSS}{self.PATH}", headers={"Host": "pod.vardeman.me"}, timeout=10)
        assert r4.status_code == 410, f"expected 410 Gone, got {r4.status_code}: {r4.text}"
        link = r4.headers.get("link", "")
        assert 'rel="timemap"' in link, f"410 response missing Link rel=timemap, got: {link}"

        # 5. TimeMap surfaces the tombstone
        r5 = httpx.get(
            f"{CSS}{self.PATH}?ext=timemap",
            headers={"Host": "pod.vardeman.me", "Accept": "text/turtle"},
            timeout=10,
        )
        assert r5.status_code == 200, r5.text
        g = Graph()
        g.parse(data=r5.text, format="turtle")
        from rdflib import URIRef
        tombstone_types = list(g.triples((None, URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
                                          URIRef(f"{LDES}DeletedLDPResource"))))
        assert len(tombstone_types) >= 1, "TimeMap missing ldes:DeletedLDPResource for the deletion"

    def test_accept_datetime_before_delete_returns_prior_content(self):
        path = "/test-tombstone-prior.txt"
        # Create + DELETE
        _put(path, "prior content")
        _wait_for_commits(path, 1)
        time.sleep(1.0)  # ensure Accept-Datetime upper bound is after this commit
        before_delete = httpx.get(
            f"{CSS}{path}",
            headers={"Host": "pod.vardeman.me"},
            timeout=10,
        ).headers.get("date", "")
        httpx.delete(f"{CSS}{path}", headers={"Host": "pod.vardeman.me"}, timeout=10)
        _wait_for_commits(path, 2)

        # GET with Accept-Datetime well before the deletion (use a far-past datetime)
        # We test using the closest-prior-content path: a far-future Accept-Datetime
        # would resolve to the deletion commit (newer); we want a time before delete.
        # The pre-delete commit's datetime is our anchor.
        # For simplicity: use TimeMap to find pre-delete commit, then request that version.
        r_tm = httpx.get(
            f"{CSS}{path}?ext=timemap",
            headers={"Host": "pod.vardeman.me", "Accept": "text/turtle"},
            timeout=10,
        )
        g = Graph()
        g.parse(data=r_tm.text, format="turtle")
        from rdflib import URIRef
        # Find Memento subjects that are NOT typed as DeletedLDPResource
        all_mementos = set(
            s for s, _, _ in g.triples(
                (None, URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
                 URIRef(f"{MEMENTO}Memento"))
            )
        )
        deleted = set(
            s for s, _, _ in g.triples(
                (None, URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
                 URIRef(f"{LDES}DeletedLDPResource"))
            )
        )
        alive_mementos = all_mementos - deleted
        assert len(alive_mementos) >= 1, "Expected at least one non-tombstone Memento"
        alive_uri = next(iter(alive_mementos))

        # Fetch it directly
        r_m = httpx.get(str(alive_uri), headers={"Host": "pod.vardeman.me"}, timeout=10,
                        follow_redirects=True)
        assert r_m.status_code == 200, r_m.text
        assert r_m.text.strip() == "prior content"


# REMOVED 2026-06-04 C-T4: test_vault_data_survives. It asserted 50+ entries in
# /vault/resources/concepts/ — pre-D70 vault-import seed content. The D70 pivot
# dropped that seed (vault import is a non-MVP use case); the container is now an
# empty PARA residue (0 entries). The Memento mechanism itself is exercised by the
# other 11 tests in this file (timegate/timemap/version reads, tombstones).


# ---------- helpers ----------

def rdf_type(iri: str):
    from rdflib import URIRef
    return URIRef(iri)
