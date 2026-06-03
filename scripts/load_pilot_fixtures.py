"""Load the Phase A pilot fixture bundle (10 pages) into the Pod via HTTP PUT.

Targets the 8-shape L3 container layout (concepts/, people/, procedures/).
Pages span agentic-memory + agentic-engineering + harness-engineering themes
with deliberate hub structure (wiki-memory, agentic-memory, karpathy-andrej).
"""
import os
import sys
import time
from pathlib import Path

import httpx
from rdflib import Graph, URIRef

POD = os.environ.get("POD_URL", "https://pod.vardeman.me")
OSLC_TOTAL = URIRef("http://open-services.net/ns/core#totalCount")
FIX = Path(__file__).parent.parent / "tests" / "fixtures" / "wiki-memory-l3" / "pilot" / "bodies"

CONTAINERS = ("concepts", "people", "procedures")


def discover_uploads() -> list[tuple[str, str]]:
    "Return [(local_path, container), ...] for every .md file under FIX."
    uploads = []
    for c in CONTAINERS:
        for p in sorted((FIX / c).glob("*.md")):
            uploads.append((p, c))
    return uploads


def put_one(client: httpx.Client, path: Path, container: str) -> bool:
    body = path.read_text()
    url = f"{POD}/vault/wiki/{container}/{path.name}"
    r = client.put(url, content=body, headers={"Content-Type": "text/markdown"})
    if r.status_code in (201, 205):
        print(f"  OK  {r.status_code}  {url}")
        return True
    print(f"  FAIL {r.status_code}  {url}\n       {r.text[:200]}", file=sys.stderr)
    return False


def verify_search(client: httpx.Client, query: str, expected_min: int) -> bool:
    "Sanity-check: wiki-search returns at least expected_min hits."
    url = f'{POD}/vault/wiki/?ext=search-grep&oslc.searchTerms="{query}"'
    r = client.get(url, headers={"Accept": "text/turtle"})
    if r.status_code != 200:
        print(f"  FAIL search {query!r}: HTTP {r.status_code}", file=sys.stderr)
        return False
    g = Graph().parse(data=r.text, format="turtle", publicID=url)
    total = next(g.objects(None, OSLC_TOTAL), None)
    count = int(total) if total is not None else 0
    ok = count >= expected_min
    mark = "OK  " if ok else "FAIL"
    print(f"  {mark} search {query!r}: {count} hits (expected ≥ {expected_min})")
    return ok


def main() -> int:
    uploads = discover_uploads()
    if not uploads:
        print(f"No fixtures under {FIX}", file=sys.stderr)
        return 2
    print(f"Loading {len(uploads)} fixtures to {POD} ...")
    with httpx.Client(timeout=10.0) as client:
        ok_all = True
        for path, container in uploads:
            if not put_one(client, path, container):
                ok_all = False
        if not ok_all:
            return 1
        # Let MarkdownProjectionListener catch up before search verification.
        time.sleep(2)
        print("\nVerifying via wiki-search:")
        checks = [
            ("progressive disclosure", 2),
            ("karpathy", 4),
            ("compounding", 2),
            ("how to ingest a source", 1),
        ]
        for q, n in checks:
            if not verify_search(client, q, n):
                ok_all = False
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())
