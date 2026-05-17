"""Phase 7a wiki-search performance smoke.

D87 success criterion: p95 < 500ms for representative queries against a
realistic vault import (~1000 pages). If exceeded, log a follow-up to
swap RegexpSearchEngine for @vscode/ripgrep or WASM ripgrep (Phase 7b).
"""

from __future__ import annotations

import statistics
import subprocess
from pathlib import Path
from time import perf_counter
from urllib.parse import quote

import httpx
import pytest

BASE_URL = "https://pod.vardeman.me"
WIKI_BASE = f"{BASE_URL}/vault/wiki/"

REPRESENTATIVE_QUERIES = [
    ["progressive disclosure"],
    ["ESPRESSO"],
    ["agent"],
    ["context graph"],
    ["RDF"],
    ["wiki"],
    ["progressive disclosure", "ESPRESSO"],
    ["memory", "agent"],
    ["WAC"],
    ["citation"],
]

@pytest.fixture(scope="module")
def client():
    ca = subprocess.check_output(["mkcert", "-CAROOT"], text=True).strip()
    verify = Path(ca) / "rootCA.pem"
    with httpx.Client(verify=str(verify), base_url=BASE_URL) as c:
        yield c

def _grep_url(terms: list[str]) -> str:
    quoted = ",".join(f'"{t}"' for t in terms)
    return f"{WIKI_BASE}?ext=search-grep&oslc.searchTerms={quote(quoted, safe='')}&oslc.pageSize=25"

@pytest.mark.perf
def test_p95_latency_under_500ms(client: httpx.Client):
    """Issue each representative query 5 times; assert p95 across all 50 < 500ms."""
    latencies: list[float] = []
    for terms in REPRESENTATIVE_QUERIES:
        url = _grep_url(terms)
        for _ in range(5):
            t0 = perf_counter()
            r = client.get(url)
            elapsed = (perf_counter() - t0) * 1000.0
            assert r.status_code == 200, f"{terms} → {r.status_code}"
            latencies.append(elapsed)

    latencies.sort()
    p95 = latencies[int(len(latencies) * 0.95)]
    median = statistics.median(latencies)
    print(f"\nlatencies: median={median:.1f}ms  p95={p95:.1f}ms  n={len(latencies)}")

    # D87 success criterion
    assert p95 < 500, f"p95 {p95:.1f}ms exceeded 500ms ceiling"
