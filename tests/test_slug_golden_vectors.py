"""Cross-language slug golden vectors (R-T7, audit R3).

The TS minter css/extensions/shared/markdown-parsing/src/wikiUrl.ts:slug() is
canonical (R-T2 made it THE live wiki-memory L3 URL minter). scripts/lib/rdf_gen.py
:slug() is RECONCILED to match it. This pytest runs the PYTHON slug over the SHARED
fixture tests/fixtures/slug-vectors.json; the vitest test
shared/markdown-parsing/src/slugVectors.test.ts runs the TS slug over the SAME file.
Both must agree on every `expected`, so the two implementations can't drift on the
minted URL (the bug: importer writes orphan/colliding resources vs substrate writes).

The `citekeyVectors` cases run slug(strip_citekey_marker(input)) — the URL-minting
path (_resolve / the subject in frontmatter_to_graph), not bare slug.
"""
import json
from pathlib import Path
import pytest

from scripts.lib.rdf_gen import slug, strip_citekey_marker

FIXTURE = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "slug-vectors.json"
_FX = json.loads(FIXTURE.read_text())


@pytest.mark.parametrize("v", _FX["vectors"], ids=lambda v: v["input"] or "<empty>")
def test_slug_vector(v):
    assert slug(v["input"]) == v["expected"], v["note"]


@pytest.mark.parametrize("v", _FX["citekeyVectors"], ids=lambda v: v["input"])
def test_citekey_slug_vector(v):
    assert slug(strip_citekey_marker(v["input"])) == v["expected"], v["note"]
