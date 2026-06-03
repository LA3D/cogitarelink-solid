"""test_substrate_mirror_consistency.py

Guards the three-way agreement between:
  1. BOOTSTRAP_PREDICATE_TO_CLASS  — TypeScript constant in wikilinkProjection.ts
  2. overlays/wiki-memory/routing.jsonld  — runtime JSON-LD source of truth
  3. PUBLISHED_RANGE  — dict in scripts/pod_audit.py

Migration guard for the sub: namespace migration (RQ-Substrate-4 Phase 0).
routing.jsonld is the runtime SoT; every entry it declares must agree with the
others where present.

R-T7 (audit R3, F8-python): the TS leg previously REGEX-SCRAPED wikilinkProjection.ts
(computed-key string concatenation), which the fragility audit flagged as brittle.
It now reads the committed maps sidecar (css/extensions/markdown-projection/maps.json
:: bootstrapPredicateToClass), emitted from the live TS constant by `npm run
emit-maps` and guarded against drift by test/mapsSidecar.test.ts.
"""
import json, pathlib
import rdflib
from scripts.pod_audit import ROUTES_TO_CLASS, PUBLISHED_RANGE

ROOT = pathlib.Path(__file__).resolve().parents[1]
_MAPS = json.loads((ROOT / "css/extensions/markdown-projection/maps.json").read_text())


def _bootstrap_from_ts() -> dict[str, str]:
    """BOOTSTRAP_PREDICATE_TO_CLASS via the maps sidecar (JSON, not TS scraping)."""
    return dict(_MAPS["bootstrapPredicateToClass"])


def _routing_jsonld() -> dict[str, str]:
    """Parse routing.jsonld via rdflib (same path used in pod_audit.py's load_routing_from_jsonld).

    ROUTES_TO_CLASS is imported from scripts.pod_audit — when the migration updates
    that constant, this query IRI moves with it automatically.
    """
    g = rdflib.Graph()
    g.parse(str(ROOT / "overlays/wiki-memory/routing.jsonld"), format="json-ld")
    return {str(s): str(o) for s, o in g.subject_objects(rdflib.URIRef(ROUTES_TO_CLASS))}


def _published_range() -> dict[str, str]:
    """Return PUBLISHED_RANGE from scripts.pod_audit as {str: str}.

    Plain package import — same pattern as test_pod_audit_routing.py.
    """
    return {str(k): str(v) for k, v in PUBLISHED_RANGE.items()}


def test_three_mirrors_agree():
    ts = _bootstrap_from_ts()
    rj = _routing_jsonld()
    pr = _published_range()

    assert ts, "BOOTSTRAP_PREDICATE_TO_CLASS parsed empty — regex may need updating"
    assert rj, "routing.jsonld parsed empty — check file format"
    assert pr, "PUBLISHED_RANGE parsed empty — check pod_audit.py"

    # routing.jsonld is the runtime SoT; check agreement where entries overlap.
    disagreements = []
    for pred, cls in rj.items():
        if pred in ts and ts[pred] != cls:
            disagreements.append(
                f"BOOTSTRAP_PREDICATE_TO_CLASS disagrees on {pred}: "
                f"TS={ts[pred]!r} vs routing.jsonld={cls!r}"
            )
        if pred in pr and pr[pred] != cls:
            disagreements.append(
                f"PUBLISHED_RANGE disagrees on {pred}: "
                f"pod_audit={pr[pred]!r} vs routing.jsonld={cls!r}"
            )

    assert not disagreements, "\n".join(disagreements)


def test_bootstrap_nonempty():
    """Sanity: BOOTSTRAP_PREDICATE_TO_CLASS contains at least the three known entries."""
    ts = _bootstrap_from_ts()
    assert "https://schema.org/affiliation" in ts
    assert "https://schema.org/location" in ts
    assert "http://purl.org/dc/terms/contributor" in ts


def test_routing_jsonld_nonempty():
    """Sanity: routing.jsonld contains at least the three known entries."""
    rj = _routing_jsonld()
    assert "https://schema.org/affiliation" in rj
    assert "https://schema.org/location" in rj
    assert "http://purl.org/dc/terms/contributor" in rj


def test_published_range_nonempty():
    """Sanity: PUBLISHED_RANGE contains at least the three known entries."""
    pr = _published_range()
    assert "https://schema.org/affiliation" in pr
    assert "https://schema.org/location" in pr
    assert "http://purl.org/dc/terms/contributor" in pr
