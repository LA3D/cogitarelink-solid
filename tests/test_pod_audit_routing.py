from scripts.pod_audit import load_routing_from_jsonld, check_routing


def test_loads_map_from_jsonld(tmp_path):
    m = load_routing_from_jsonld("tests/fixtures/routing.jsonld")
    assert m["https://schema.org/affiliation"] == "https://schema.org/Organization"


def test_coverage_error_when_class_not_registered():
    routing = {"https://schema.org/affiliation": "https://schema.org/Organization"}
    type_index = {"https://schema.org/Person": "/vault/wiki/people/"}  # no Organization
    findings = check_routing(routing, type_index)
    assert any(f["severity"] == "ERROR" and "Organization" in f["location"] for f in findings)


def test_published_range_disagreement_warns():
    routing = {"https://schema.org/location": "https://schema.org/Organization"}  # wrong
    type_index = {"https://schema.org/Organization": "/vault/wiki/organizations/"}
    findings = check_routing(routing, type_index,
                             published_range={"https://schema.org/location": "https://schema.org/Place"})
    assert any(f["severity"] == "WARN" and "range" in f["constraint"] for f in findings)
