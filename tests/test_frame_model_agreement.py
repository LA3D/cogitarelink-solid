from pathlib import Path
from rdflib import Graph, Namespace, URIRef, RDF, RDFS
import pytest

ROOT = Path(__file__).resolve().parent.parent
OVL = ROOT / "overlays" / "wiki-memory"
SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")

def _g(p: Path) -> Graph:
    g = Graph(); g.parse(p, format="turtle"); return g

def test_spine_terms_defined():
    g = _g(OVL / "vocabulary" / "substrate.ttl")
    for term in ("frameRole", "governsSubject", "labelProperty"):
        t = SUB[term]
        assert (t, RDF.type, None) in g, f"sub:{term} not typed in substrate.ttl"
        assert (t, RDFS.label, None) in g, f"sub:{term} missing rdfs:label"
        assert (t, RDFS.comment, None) in g, f"sub:{term} missing rdfs:comment"

# the three governed content shapes and their expected frame annotations
SCHEMA = Namespace("https://schema.org/")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
DCT = Namespace("http://purl.org/dc/terms/")
WIKI = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")

# (shape_file, shape_iri, frameRole, governsSubject, labelProperty)
FRAMES = [
    ("page.shacl.ttl",    WIKI.PageShape,    "page",    "<>",     DCT.title),
    ("thing.shacl.ttl",   WIKI.ThingShape,   "thing",   "<#this>", SCHEMA.name),
    ("concept.shacl.ttl", WIKI.ConceptShape, "concept", "<#this>", SKOS.prefLabel),
]

@pytest.mark.parametrize("fname,shape,role,subj,labelprop", FRAMES)
def test_shape_declares_frame(fname, shape, role, subj, labelprop):
    g = _g(OVL / "shapes" / fname)
    assert (shape, SUB.frameRole, None) in g, f"{shape} missing sub:frameRole"
    assert str(g.value(shape, SUB.frameRole)) == role
    assert str(g.value(shape, SUB.governsSubject)) == subj
    assert g.value(shape, SUB.labelProperty) == labelprop
