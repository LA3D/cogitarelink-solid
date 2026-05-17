"""End-to-end integration tests for Phase 7a wiki-search.

Assumes the docker-compose stack is running with CSS at
https://pod.vardeman.me (TLS via mkcert dev cert). Reuses the test
helpers from existing integration tests.
"""

from __future__ import annotations

import os
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import quote

import httpx
import pytest

BASE_URL = "https://pod.vardeman.me"
WIKI_BASE = f"{BASE_URL}/vault/wiki/"

# Fixtures use the dev-allow-all config (no auth); private/public WAC
# scenarios use a per-resource ACL drop.

@pytest.fixture(scope="module")
def client():
    ca = subprocess.check_output(["mkcert", "-CAROOT"], text=True).strip()
    verify = Path(ca) / "rootCA.pem"
    with httpx.Client(verify=str(verify), base_url=BASE_URL) as c:
        yield c

@pytest.fixture(scope="module")
def seeded_pages(client: httpx.Client):
    """PUT a small known set of markdown pages and tear down afterward."""
    pages = {
        "pages/wsearch-alpha.md": "# alpha\n\nthis page discusses progressive disclosure deeply.\n",
        "pages/wsearch-beta.md": "# beta\n\nESPRESSO is the access-control system.\nProgressive disclosure is also mentioned.\n",
        "pages/wsearch-gamma.md": "# gamma\n\nnothing relevant here at all.\n",
        "working/wsearch-delta.md": "# delta\n\nworking note about progressive disclosure and ESPRESSO together.\n",
    }
    headers = {"Content-Type": "text/markdown"}
    for path, body in pages.items():
        url = f"{WIKI_BASE}{path}"
        r = client.put(url, content=body, headers=headers)
        assert r.status_code in (201, 205), f"PUT {url} → {r.status_code}: {r.text}"
    # Give the projection listener a beat to settle
    time.sleep(1.0)
    yield pages
    # Teardown
    for path in pages:
        client.delete(f"{WIKI_BASE}{path}")

def _grep(client, terms: list[str], **params) -> httpx.Response:
    quoted = ",".join(f'"{t}"' for t in terms)
    qp = {"ext": "search-grep", "oslc.searchTerms": quoted}
    for k, v in params.items():
        qp[f"oslc.{k}"] = v
    parts = []
    for k, v in qp.items():
        parts.append(f"{k}={quote(str(v), safe=chr(34) + chr(44))}")
    qs = "&".join(parts)
    return client.get(f"{WIKI_BASE}?{qs}")

class TestWiringAndSmoke:
    def test_link_header_advertises_querybase_on_wiki_root(self, client: httpx.Client):
        r = client.get(WIKI_BASE)
        link = r.headers.get("link", "")
        assert "ext=search-grep" in link
        assert 'rel="http://open-services.net/ns/core#queryBase"' in link

    def test_link_header_absent_on_profile(self, client: httpx.Client):
        r = client.get(f"{BASE_URL}/vault/profile/")
        link = r.headers.get("link", "")
        assert "ext=search-grep" not in link

    def test_400_on_missing_search_terms(self, client: httpx.Client):
        r = client.get(f"{WIKI_BASE}?ext=search-grep")
        assert r.status_code == 400
        assert r.headers["content-type"].startswith("application/problem+json")
        body = r.json()
        assert "example" in body
        assert "%22" in body["example"]

    def test_400_on_unquoted_terms(self, client: httpx.Client):
        r = client.get(f"{WIKI_BASE}?ext=search-grep&oslc.searchTerms=agent")
        assert r.status_code == 400

    def test_501_on_oslc_where(self, client: httpx.Client):
        encoded = f'{WIKI_BASE}?ext=search-grep&oslc.searchTerms={quote(chr(34) + "x" + chr(34))}&oslc.where=foo'
        r = client.get(encoded)
        assert r.status_code == 501

class TestRecursion:
    def test_finds_markdown_in_subcontainers(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"])
        assert r.status_code == 200
        ttl = r.text
        # Three resources should match: alpha (pages/), beta (pages/), delta (working/)
        assert "wsearch-alpha.md" in ttl
        assert "wsearch-beta.md" in ttl
        assert "wsearch-delta.md" in ttl
        assert "wsearch-gamma.md" not in ttl

class TestAndSemantics:
    def test_and_filter_omits_resources_missing_a_term(self, client: httpx.Client, seeded_pages):
        # Only beta and delta mention both phrases
        r = _grep(client, ["progressive disclosure", "ESPRESSO"])
        ttl = r.text
        assert "wsearch-beta.md" in ttl
        assert "wsearch-delta.md" in ttl
        assert "wsearch-alpha.md" not in ttl  # missing ESPRESSO

class TestResponseShape:
    def test_total_count_reflects_post_filter(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"])
        m = re.search(r"oslc:totalCount\s+(\d+)", r.text)
        assert m, "no oslc:totalCount found"
        assert int(m.group(1)) >= 3

    def test_results_sorted_descending_by_score(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"])
        # Extract resource URL → score pairs from the perResult blocks
        pairs = re.findall(r"<([^>]+wsearch-[^>]+)>\s+oslc:score\s+(\d+)", r.text)
        scores = [int(s) for _, s in pairs]
        assert scores == sorted(scores, reverse=True)

    def test_includes_matched_context_snippet(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"])
        assert "vault:matchedContext" in r.text
        assert "vault:matchedLine" in r.text

class TestPaging:
    def test_next_page_emitted_when_more_results(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"], pageSize=1)
        ttl = r.text
        assert "oslc:nextPage" in ttl
        assert "oslc.startIndex=1" in ttl

    def test_no_next_page_on_final_page(self, client: httpx.Client, seeded_pages):
        # pageSize=1, startIndex=10 — far beyond totalCount of 3, so empty page
        r = _grep(client, ["progressive disclosure"], pageSize=1, startIndex=10)
        assert "oslc:nextPage" not in r.text

    def test_start_index_beyond_total(self, client: httpx.Client, seeded_pages):
        r = _grep(client, ["progressive disclosure"], startIndex=999)
        # Should return 200 with empty ldp:contains, totalCount reflects truth
        assert r.status_code == 200
        m = re.search(r"oslc:totalCount\s+(\d+)", r.text)
        assert m

class TestWac:
    """Validates omit-don't-deny + subtree omission.

    Each test re-applies an ACL to a specific subdirectory before running.
    """
    def test_anonymous_request_gets_empty_when_all_resources_private(self, client: httpx.Client, seeded_pages):
        # This test depends on the dev config. If dev-allow-all is on, anonymous
        # reads succeed and this test should be skipped. Real WAC tests run in
        # a separate fixture with an authenticated WebID.
        pytest.skip("dev-allow-all config; WAC scenarios covered by Phase 7a follow-up auth fixture")


class TestWacScenarios:
    """The four scenarios from §7 of the original plan + the subtree-omission
    addition from Refinement 1.

    These tests require an authenticated client. The pattern follows
    tests/integration/test_addressbook_e2e.py — read that file before
    implementing; reuse its OIDC + DPoP helpers.

    Skip these in the smoke-test pass; implement them once the base
    plan is green and the authenticated-client harness is in place.
    """

    def test_a_full_access(self):
        """WebID A has read on all wiki content → search returns all matches."""
        pytest.skip("auth fixture pending — implement after smoke green")

    def test_b_partial_access(self):
        """WebID B has read on /vault/wiki/pages/public/ only → search returns
        only that subtree; totalCount reflects post-filter count."""
        pytest.skip("auth fixture pending — implement after smoke green")

    def test_c_container_denied(self):
        """WebID C cannot read /vault/wiki/ → 403 on search GET."""
        pytest.skip("auth fixture pending — implement after smoke green")

    def test_d_container_ok_no_matches_readable(self):
        """WebID D can read container, no matching resource is readable →
        200 + empty ldp:contains + oslc:totalCount 0."""
        pytest.skip("auth fixture pending — implement after smoke green")

    def test_e_subtree_omission(self):
        """Deny WebID E read on /vault/wiki/pages/private/. Place a matching
        markdown under it. Confirm: results don't include private/* AND
        totalCount excludes the private resource."""
        pytest.skip("auth fixture pending — implement after smoke green")
