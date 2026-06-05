"""D112 §4/§6: policy-as-data artifacts — needs declared, descriptor conformant."""
import os
import pyshacl
from rdflib import Graph, URIRef, RDF

MEM    = "https://pod.vardeman.me/vault/ontology/mem#"
INTEROP = "http://www.w3.org/ns/solid/interop#"

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP   = os.path.join(_ROOT, "overlays/identifier-schemes/interop/application.ttl")
DESC  = os.path.join(_ROOT, "overlays/wiki-memory/affordances/curation.ttl")
AFFORDANCE_SHAPE = os.path.join(_ROOT, "shapes/substrate/affordance-descriptor.shacl.ttl")


def test_application_declares_two_needs():
    g = Graph().parse(APP, format="turtle")
    apps = list(g.subjects(RDF.type, URIRef(INTEROP + "Application")))
    assert len(apps) == 1
    needs = list(g.objects(apps[0], URIRef(MEM + "hasCurationNeed")))
    assert len(needs) == 2


def test_needs_carry_lane_ledger_instruction():
    g = Graph().parse(APP, format="turtle")
    SH_AI = URIRef("http://www.w3.org/ns/shacl#agentInstruction")
    lanes = set()
    for need in g.subjects(RDF.type, URIRef(MEM + "CurationNeed")):
        assert list(g.objects(need, URIRef(MEM + "applyClass"))), f"{need} lacks applyClass"
        ledgers = list(g.objects(need, URIRef(MEM + "ledger")))
        assert ledgers and str(ledgers[0]).endswith("/id/.operations/")
        instr = list(g.objects(need, SH_AI))
        assert instr and len(str(instr[0])) > 100, f"{need} instruction too thin to follow cold"
        lanes.update(str(o) for o in g.objects(need, URIRef(MEM + "applyClass")))
    assert lanes == {MEM + "DeriveClass", MEM + "JudgmentClass"}, "one need per lane (spec §2)"


def test_descriptor_conforms_to_affordance_shape():
    data = Graph().parse(
        DESC, format="turtle",
        publicID="https://pod.vardeman.me/vault/meta/affordances/curation.ttl"
    )
    shapes = Graph().parse(AFFORDANCE_SHAPE, format="turtle")
    conforms, _, report = pyshacl.validate(data, shacl_graph=shapes, inference="none")
    assert conforms, report


def test_descriptor_encodes_propose_only_and_plan_pinning():
    text = open(DESC).read()
    for required in ("propose-only", "?ext=timemap", "hadPlan", "FalsePositive",
                     "never apply", "dereference"):
        assert required in text, f"descriptor instruction missing: {required}"
