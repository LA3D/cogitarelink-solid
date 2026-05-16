"""Load the 4-note fixture bundle into a clean Pod via HTTP PUT."""
import os
import sys
from pathlib import Path
import httpx

POD = os.environ.get("POD_URL", "https://pod.vardeman.me")
FIX = Path(__file__).parent.parent / "tests" / "fixtures" / "wiki-memory-l3" / "bodies"

UPLOADS = [
    ("agentic-memory-systems-moc.md", "pages"),
    ("wiki-memory-l3-profile.md", "pages"),
    ("ghumare---llm-wiki-v2-extending-karpathy.md", "sources"),
    ("karpathy-andrej.md", "people"),
]


def main() -> int:
    for name, container in UPLOADS:
        body = (FIX / name).read_text()
        url = f"{POD}/wiki/{container}/{name}"
        r = httpx.put(url, content=body, headers={"Content-Type": "text/markdown"})
        if r.status_code not in (201, 205):
            print(f"FAIL: {url}: {r.status_code} {r.text}", file=sys.stderr)
            return 1
        print(f"OK: {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
