"""Every wikilink hint's predicate appears in exactly one shape's governed list."""
import re
from pathlib import Path
from rdflib import Graph, URIRef

REPO = Path(__file__).parents[2]
SHAPES_DIR = REPO / "overlays/wiki-memory/shapes"
LISTENER = REPO / "css/extensions/markdown-projection/src/wikilinkProjection.ts"


def _hint_predicates_from_listener() -> dict[str, str]:
    """Extract hint → predicate IRI map from HINT_TO_PROJECTION in wikilinkProjection.ts.

    The source declares entries as:
        related:     { subject: "THING", predicate: namedNode(SKOS + "related") },
    """
    src = LISTENER.read_text()
    pattern = re.compile(
        r'(\w+):\s*\{\s*subject:\s*"[A-Z]+",\s*predicate:\s*namedNode\((\w+)\s*\+\s*"([^"]+)"\)'
    )
    prefix_map = {
        "SKOS":   "http://www.w3.org/2004/02/skos/core#",
        "CITO":   "http://purl.org/spar/cito/",
        "SCHEMA": "https://schema.org/",
        "DCT":    "http://purl.org/dc/terms/",
        "WIKI":   "https://pod.vardeman.me/vault/ontology/wiki#",
    }
    out = {}
    for m in pattern.finditer(src):
        hint, prefix_name, suffix = m.group(1), m.group(2), m.group(3)
        if prefix_name in prefix_map:
            out[hint] = prefix_map[prefix_name] + suffix
    return out


def _all_governed_predicates() -> set[str]:
    """Collect sh:path values from every NodeShape across all shape files."""
    paths: set[str] = set()
    for sf in SHAPES_DIR.glob("*.shacl.ttl"):
        if sf.name == "template.shacl.ttl":
            continue
        g = Graph()
        g.parse(sf, format="turtle")
        for p in g.objects(predicate=URIRef("http://www.w3.org/ns/shacl#path")):
            paths.add(str(p))
    return paths


def test_listener_hint_table_extractable():
    hints = _hint_predicates_from_listener()
    assert len(hints) > 0, "Failed to extract any hint mappings from wikilinkProjection.ts"
    assert len(hints) >= 10, f"Expected ≥10 hints in HINT_TO_PROJECTION, got {len(hints)}"


def test_every_hint_predicate_appears_in_some_shape():
    """Every hint in HINT_TO_PROJECTION must appear as sh:path in at least one shape.

    Findings flagged by this test are REAL cross-batch drift — the hint table and
    shape catalog have diverged. Do not suppress; file as a shape gap.

    Known gaps as of 2026-05-19 (shape completion sprint follow-on):
      - source  → dct:source     (no shape covers dct:source as sh:path)
      - author  → dct:contributor (no shape covers dct:contributor as sh:path)
      - embed   → wiki:embeds     (page-scoped embed hint; no shape covers wiki:embeds)
    """
    hints = _hint_predicates_from_listener()
    governed = _all_governed_predicates()
    missing = {h: p for h, p in hints.items() if p not in governed}
    assert not missing, (
        f"Hint-table predicates with no shape-governed sh:path coverage: {missing}\n"
        f"This is a cross-batch drift gap — add sh:property [ sh:path <predicate> ] to "
        f"the relevant shape, or remove the hint from HINT_TO_PROJECTION."
    )
