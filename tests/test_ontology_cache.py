from pathlib import Path
from rdflib import Graph

ONT = Path(__file__).parent.parent / "ontology"

def test_idot_cached_and_parses():
    g = Graph().parse(ONT / "idot.ttl", format="turtle")
    assert len(g) > 20
    ns = [str(s) for s in g.subjects()]
    # v0.3 actual term names (the D111 plan guessed idRegexPattern/exampleIdentifier,
    # which do not exist in v0.3): the ID-regex pattern is idot:luiPattern and the
    # example identifier is idot:sampleID. Cache is source of truth, not the plan.
    for local in ("Namespace", "Resource", "luiPattern", "sampleID", "urlPattern"):
        assert any(s.endswith(local) for s in ns), f"idot term missing: {local}"

def test_datacite_cached_and_parses():
    g = Graph().parse(ONT / "datacite.ttl", format="turtle")
    assert len(g) > 100
    assert any(str(s).endswith("/doi") for s in g.subjects()), "datacite:doi individual missing"
