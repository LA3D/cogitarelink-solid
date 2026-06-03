import json
from pathlib import Path
from rdflib import Graph, Namespace, RDF

SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
ROOT = Path(__file__).resolve().parents[1]
DESC = ROOT / "overlays/wiki-memory/affordances/markdown-projection.ttl"
MAPS = json.loads((ROOT / "css/extensions/markdown-projection/maps.json").read_text())
RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"

def _graph():
    g = Graph(); g.parse(DESC, format="turtle", publicID="https://pod.vardeman.me/vault/meta/affordances/markdown-projection.ttl")
    return g

def test_governs_includes_literal_axis():
    g = _graph()
    governed = set(g.objects(None, SUB.governs))
    for p in (SKOS.prefLabel, SKOS.altLabel, SKOS.definition):
        assert p in governed, f"sub:governs missing {p}"

def test_projects_from_body_declared():
    g = _graph()
    body = set(str(o) for o in g.objects(None, SUB.projectsFromBody))
    assert body, "sub:projectsFromBody not declared"
    assert any("literal" in b.lower() for b in body)


# --- R-T7 (audit R3 / D108-final-review item 2): descriptor ↔ runtime governed set ---

def _descriptor_governs() -> set[str]:
    return {str(o) for o in _graph().objects(None, SUB.governs)}

def test_governs_equals_runtime_union():
    """sub:governs is the agent-facing declaration of what the substrate writes on
    a regovern; it must EQUAL what MetaWriter.replaceGoverned actually replaces —
    the runtime governed union (maps sidecar) PLUS rdf:type (the type axis the
    substrate also owns). Drift = the descriptor advertises a different contract
    than the listener enforces."""
    expected = set(MAPS["governedUnion"]) | {RDF_TYPE}
    actual = _descriptor_governs()
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    assert not missing and not extra, (
        f"sub:governs drifted from the runtime union.\n  missing: {missing}\n  extra: {extra}"
    )

def test_substrate_internal_bodyhash_unadvertised():
    """sub:bodyHash is written by the admission floor (the stamp) and is
    DELIBERATELY not advertised in sub:governs — assert its absence."""
    governed = _descriptor_governs()
    for internal in MAPS["substrateInternal"]:
        assert internal not in governed, f"substrate-internal {internal} must not be in sub:governs"

def test_rdf_type_governed_but_not_in_union():
    """rdf:type is advertised (the substrate dispatches it from frontmatter type:)
    but is NOT part of the replaceGoverned union — pin both facts so the
    union ∪ {rdf:type} framing can't silently change."""
    assert RDF_TYPE in _descriptor_governs()
    assert RDF_TYPE not in set(MAPS["governedUnion"])
