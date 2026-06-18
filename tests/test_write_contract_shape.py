"""The substrate write-contract shape: foaf:Document must carry mem:rationale."""
from pathlib import Path
from pyshacl import validate
from rdflib import Graph

SHAPE = Path(__file__).parent.parent / "shapes" / "substrate" / "write-contract.shacl.ttl"

def _data(ttl: str) -> Graph:
    g = Graph(); g.parse(data=ttl, format="turtle"); return g

def test_document_without_rationale_fails():
    shapes = Graph(); shapes.parse(SHAPE, format="turtle")
    data = _data('@prefix foaf: <http://xmlns.com/foaf/0.1/> . <urn:r> a foaf:Document .')
    conforms, _, _ = validate(data_graph=data, shacl_graph=shapes, inference="none")
    assert not conforms

def test_document_with_rationale_conforms():
    shapes = Graph(); shapes.parse(SHAPE, format="turtle")
    data = _data('@prefix foaf: <http://xmlns.com/foaf/0.1/> . '
                 '@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> . '
                 '<urn:r> a foaf:Document ; mem:rationale "because the task required it" .')
    conforms, _, _ = validate(data_graph=data, shacl_graph=shapes, inference="none")
    assert conforms
