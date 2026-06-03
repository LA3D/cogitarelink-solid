from pathlib import Path
import pytest
from rdflib import Graph, Namespace, URIRef

SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
SH_AGENT_INSTRUCTION = URIRef("http://www.w3.org/ns/shacl#agentInstruction")
BASE = "https://pod.vardeman.me/vault/wiki/{c}/"
EXPECT = {
    "concepts": "concept.shacl.ttl",
    "places": "place.shacl.ttl",
    "events": "event.shacl.ttl",
    "organizations": "organization.shacl.ttl",
}

@pytest.mark.parametrize("ctr,shape", EXPECT.items())
def test_container_meta_has_shape_and_instruction(ctr, shape):
    p = Path(f"overlays/wiki-memory/containers/wiki/{ctr}/.meta")
    assert p.exists(), f"{p} missing"
    g = Graph(); g.parse(p, format="turtle", publicID=BASE.format(c=ctr))
    shapes = [str(o) for o in g.objects(None, SUB.shape)]
    assert any(shape in s for s in shapes), f"{ctr}: sub:shape not -> {shape}"
    assert list(g.objects(None, SH_AGENT_INSTRUCTION)), f"{ctr}: no sh:agentInstruction"
