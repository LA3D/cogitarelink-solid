"""mem:rationale (L2 write contract) is defined at the substrate layer, not inside the wiki overlay."""
from pathlib import Path
from rdflib import Graph, URIRef
from rdflib.namespace import RDFS

ROOT = Path(__file__).parent.parent
MEM_RATIONALE = URIRef("https://pod.vardeman.me/vault/ontology/mem#rationale")

def test_rationale_defined_in_substrate_ontology():
    g = Graph(); g.parse(ROOT / "ontology" / "mem.ttl", format="turtle")
    assert (MEM_RATIONALE, RDFS.label, None) in g

def test_rationale_not_redefined_in_wiki_overlay():
    g = Graph(); g.parse(ROOT / "overlays" / "wiki-memory" / "ontology" / "mem.ttl", format="turtle")
    # the wiki overlay may REFERENCE mem:rationale in examples but must not (re)define it with a label
    assert (MEM_RATIONALE, RDFS.label, None) not in g
