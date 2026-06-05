"""D112 §3 vocab: curation-protocol terms in mem.ttl."""
from pathlib import Path

from rdflib import Graph, URIRef, RDF, RDFS, SKOS

MEM = "https://pod.vardeman.me/vault/ontology/mem#"
MEM_TTL = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "ontology" / "mem.ttl"


def g():
    return Graph().parse(MEM_TTL, format="turtle")


def test_has_open_action_declared():
    graph = g()
    t = URIRef(MEM + "hasOpenAction")
    assert (t, RDF.type, None) in graph
    comments = list(graph.objects(t, RDFS.comment))
    assert comments and "server-derived" in str(comments[0]).lower()


def test_curation_need_terms():
    graph = g()
    for term in ("CurationNeed", "hasCurationNeed", "applyClass", "ledger",
                 "DeriveClass", "JudgmentClass"):
        assert (URIRef(MEM + term), RDF.type, None) in graph, f"mem:{term} missing"


def test_apply_class_lanes_are_skos_concepts():
    graph = g()
    for lane in ("DeriveClass", "JudgmentClass"):
        assert (URIRef(MEM + lane), RDF.type, SKOS.Concept) in graph


def test_provider_drift_and_materialization_in_staleness_scheme():
    graph = g()
    for name in ("ProviderDrift", "Materialization"):
        t = URIRef(MEM + name)
        assert (t, RDF.type, URIRef(MEM + "StalenessClass")) in graph
        assert (t, RDF.type, SKOS.Concept) in graph
