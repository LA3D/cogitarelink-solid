"""G10 live round-trip: a concept authored PURELY inline (frontmatter + body grammar, no .meta
PATCH) projects a .meta that conforms to ConceptShape — the RQ-View-2 forward target.

Projection is post-commit/async (D58/D71; in-band enforcement is sub-project B), so we poll the
.meta until prefLabel appears. We validate client-side with pyshacl (simulating what the B floor
will do): this proves the GRAMMAR produces a conformant graph, not that the floor rejects bad ones.
"""
import time
import glob
import httpx
import rdflib
import pytest
from pyshacl import validate

POD = "https://pod.vardeman.me/vault"
REPO = __file__.rsplit("/tests/", 1)[0]
SKOS_PREFLABEL = "http://www.w3.org/2004/02/skos/core#prefLabel"


def _pod_up():
    try:
        return httpx.get(POD + "/", verify=False, timeout=3).status_code < 500
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def _load_shapes():
    g = rdflib.Graph()
    for f in glob.glob(f"{REPO}/overlays/wiki-memory/shapes/*.shacl.ttl"):
        if f.endswith("template.shacl.ttl"):  # placeholder shape (YOURPFX:) — skip
            continue
        g.parse(f, format="turtle")
    return g


def test_inline_authored_concept_conforms_without_patch():
    body = (
        "---\ntype: concept\n---\n# Photosynthesis\n"
        "[Photosynthesis]{.prefLabel}; "
        "[The conversion of light energy into chemical energy]{.definition}; "
        "broader [[Biology]]{.broader}."
    )
    url = POD + "/wiki/concepts/rqg1-photosynthesis.md"
    try:
        httpx.put(url, content=body, headers={"Content-Type": "text/markdown"},
                  verify=False, timeout=10).raise_for_status()

        # poll the post-commit projection until prefLabel is materialised in .meta
        meta = ""
        for _ in range(20):
            r = httpx.get(url + ".meta", headers={"Accept": "text/turtle"}, verify=False, timeout=10)
            if r.status_code == 200 and SKOS_PREFLABEL in r.text:
                meta = r.text
                break
            time.sleep(0.5)
        assert SKOS_PREFLABEL in meta, f"prefLabel never projected; last .meta:\n{meta}"

        data = rdflib.Graph()
        data.parse(data=meta, format="turtle")
        conforms, _g, report = validate(data, shacl_graph=_load_shapes(), inference="none")
        assert conforms, f"projected .meta does not conform to the wiki shapes:\n{report}"
    finally:
        httpx.delete(url, verify=False, timeout=10)
