"""SHACL conformance tests for owner-identity shapes."""
from pathlib import Path
import pytest
from rdflib import Graph
from pyshacl import validate

SHAPES_DIR = Path(__file__).parent.parent / "overlays" / "owner-identity" / "shapes"
_BASE = "https://pod.vardeman.me/vault/"


def load_shapes(filename: str) -> Graph:
    return Graph().parse(SHAPES_DIR / filename, format="turtle", publicID=_BASE + "meta/shapes/" + filename)


# ----- PodOwnerPreferencesShape -----

PREFS_VALID = """
@prefix prefs: <https://pod.vardeman.me/vault/ontology/owner-prefs#> .

</vault/settings/prefs.ttl#owner> a prefs:PodOwnerPreferences ;
    prefs:fullName "Charles F. Vardeman II" ;
    prefs:orcid    "0000-0003-4091-6059" ;
    prefs:wikiSlug "charles" .
"""

PREFS_MISSING_ORCID = """
@prefix prefs: <https://pod.vardeman.me/vault/ontology/owner-prefs#> .

</vault/settings/prefs.ttl#owner> a prefs:PodOwnerPreferences ;
    prefs:fullName "Charles F. Vardeman II" ;
    prefs:wikiSlug "charles" .
"""

PREFS_BAD_ORCID = """
@prefix prefs: <https://pod.vardeman.me/vault/ontology/owner-prefs#> .

</vault/settings/prefs.ttl#owner> a prefs:PodOwnerPreferences ;
    prefs:fullName "X" ;
    prefs:orcid    "not-an-orcid" ;
    prefs:wikiSlug "x" .
"""


def _validate(prefs_ttl: str):
    shapes_g = load_shapes("pod-owner-preferences.shacl.ttl")
    data_g = Graph().parse(data=prefs_ttl, format="turtle", publicID=_BASE)
    conforms, _, report_text = validate(
        data_graph=data_g, shacl_graph=shapes_g,
        inference="rdfs", debug=False,
    )
    return conforms, report_text


def test_prefs_valid_conforms():
    conforms, report = _validate(PREFS_VALID)
    assert conforms, f"Valid prefs failed: {report}"


def test_prefs_missing_orcid_fails():
    conforms, report = _validate(PREFS_MISSING_ORCID)
    assert not conforms
    assert "orcid" in report.lower()


def test_prefs_bad_orcid_pattern_fails():
    conforms, report = _validate(PREFS_BAD_ORCID)
    assert not conforms
    assert "orcid" in report.lower() or "pattern" in report.lower()
