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
        allow_warnings=True,
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


# ----- PodOwnerWebIDShape -----

WEBID_VALID_ENRICHED = """
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix pim:   <http://www.w3.org/ns/pim/space#> .

</vault/profile/card#me>
    a foaf:Agent, foaf:Person ;
    foaf:name              "Charles F. Vardeman II" ;
    solid:oidcIssuer       <https://pod.vardeman.me/> ;
    pim:storage            <https://pod.vardeman.me/vault/> ;
    pim:preferencesFile    </vault/settings/prefs.ttl> ;
    solid:publicTypeIndex  </vault/settings/publicTypeIndex> ;
    owl:sameAs             <https://orcid.org/0000-0003-4091-6059> ,
                           </vault/contacts/Person/abc-uuid.ttl#this> ;
    foaf:isPrimaryTopicOf  </vault/wiki/people/charles/index.md> .
"""

WEBID_CSS_DEFAULT_MISSING_MUSTS = """
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix pim:   <http://www.w3.org/ns/pim/space#> .

</vault/profile/card#me>
    a foaf:Person ;
    solid:oidcIssuer       <https://pod.vardeman.me/> ;
    pim:storage            <https://pod.vardeman.me/vault/> ;
    solid:publicTypeIndex  </vault/settings/publicTypeIndex> .
"""


def _validate_webid(ttl: str):
    shapes_g = load_shapes("webid-profile.shacl.ttl")
    data_g = Graph().parse(data=ttl, format="turtle", publicID=_BASE)
    conforms, _, report_text = validate(
        data_graph=data_g, shacl_graph=shapes_g,
        inference="rdfs", debug=False,
        allow_warnings=True,
    )
    return conforms, report_text


def test_webid_valid_enriched_conforms():
    conforms, report = _validate_webid(WEBID_VALID_ENRICHED)
    assert conforms, f"Enriched WebID failed: {report}"


def test_webid_css_default_fails_on_missing_musts():
    # Missing foaf:Agent type and pim:preferencesFile (both spec MUSTs)
    conforms, report = _validate_webid(WEBID_CSS_DEFAULT_MISSING_MUSTS)
    assert not conforms
    # foaf:Agent missing AND/OR pim:preferencesFile missing
    assert "agent" in report.lower() or "preferencesfile" in report.lower()


WEBID_PARTIAL_ENRICHED = """
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix pim:   <http://www.w3.org/ns/pim/space#> .

</vault/profile/card#me>
    a foaf:Agent, foaf:Person ;
    solid:oidcIssuer       <https://pod.vardeman.me/> ;
    pim:storage            <https://pod.vardeman.me/vault/> ;
    pim:preferencesFile    </vault/settings/prefs.ttl> ;
    solid:publicTypeIndex  </vault/settings/publicTypeIndex> .
"""


def test_webid_partial_enrichment_warns_not_violates():
    """All MUSTs satisfied; SHOULDs absent. conforms=True (Warnings don't block),
    but the report should reference the warned fields so an agent can advise."""
    conforms, report = _validate_webid(WEBID_PARTIAL_ENRICHED)
    assert conforms, f"Partial enrichment should conform (Warnings don't block): {report}"
    # At least one of the SHOULD predicates should appear in the report
    expected_warnings = ["foaf:name", "owl:sameAs", "isPrimaryTopicOf", "name", "sameAs"]
    assert any(w.lower() in report.lower() for w in expected_warnings), \
        f"Expected Warnings in report for missing SHOULDs, got: {report}"
