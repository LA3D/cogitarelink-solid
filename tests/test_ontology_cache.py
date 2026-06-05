from pathlib import Path
from rdflib import Graph, URIRef
from rdflib.namespace import RDFS

ONT = Path(__file__).parent.parent / "ontology"

def test_idot_cached_and_parses():
    g = Graph().parse(ONT / "idot.ttl", format="turtle")
    assert len(g) > 20
    ns = [str(s) for s in g.subjects()]
    # v0.3 actual names differ from D111 plan guesses (luiPattern not idRegexPattern, sampleID not exampleIdentifier)
    for local in ("Namespace", "Resource", "luiPattern", "sampleID", "urlPattern"):
        assert any(s.endswith(local) for s in ns), f"idot term missing: {local}"

def test_datacite_cached_and_parses():
    g = Graph().parse(ONT / "datacite.ttl", format="turtle")
    assert len(g) > 100
    assert any(str(s).endswith("/doi") for s in g.subjects()), "datacite:doi individual missing"

def test_prov_o_cached_and_parses():
    g = Graph().parse(ONT / "prov.ttl", format="turtle")
    assert len(g) > 1000, "PROV-O cache suspiciously small"

def test_prov_o_hadplan_axioms():
    g = Graph().parse(ONT / "prov.ttl", format="turtle")
    PROV = "http://www.w3.org/ns/prov#"
    hadPlan = URIRef(PROV + "hadPlan")
    assert (hadPlan, RDFS.domain, URIRef(PROV + "Association")) in g
    assert (hadPlan, RDFS.range, URIRef(PROV + "Plan")) in g
    qa = URIRef(PROV + "qualifiedAssociation")
    assert (qa, RDFS.domain, URIRef(PROV + "Activity")) in g
