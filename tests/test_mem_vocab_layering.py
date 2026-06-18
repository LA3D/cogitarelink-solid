"""The mem: vocabulary (L2 memory-substrate) lives at the substrate layer, not inside the
wiki-memory application overlay. The whole vocab was relocated 2026-06-17 (shape-governance
reconciliation); the wiki overlay deploys it from the substrate source via overlay:document."""
from pathlib import Path
from rdflib import Graph, URIRef
from rdflib.namespace import RDFS

ROOT = Path(__file__).parent.parent
MEM = "https://pod.vardeman.me/vault/ontology/mem#"
MEM_RATIONALE = URIRef(MEM + "rationale")
MEM_CRYSTALLIZE = URIRef(MEM + "CrystallizeAction")


def test_full_mem_vocab_defined_in_substrate_ontology():
    g = Graph(); g.parse(ROOT / "ontology" / "mem.ttl", format="turtle")
    # both the write-contract slice (rationale) and a lifecycle term are here
    assert (MEM_RATIONALE, RDFS.label, None) in g
    assert (MEM_CRYSTALLIZE, None, None) in g


def test_mem_vocab_not_hosted_inside_wiki_overlay():
    assert not (ROOT / "overlays" / "wiki-memory" / "ontology" / "mem.ttl").exists(), \
        "mem: vocab must live at the substrate layer (ontology/mem.ttl), not in the wiki overlay"


def test_manifest_deploys_mem_from_substrate_source():
    txt = (ROOT / "overlays" / "wiki-memory" / "manifest.ttl").read_text()
    assert '"../../ontology/mem.ttl"' in txt, \
        "the /vault/ontology/mem deployment must source the substrate ontology/mem.ttl"
