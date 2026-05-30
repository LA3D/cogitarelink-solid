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

# exemplar source meta files (named <name>.md.meta.ttl in the overlay tree) and the frame each must satisfy
EX_DIR = OVL / "concepts"   # concept exemplars live in the concepts container
EXEMPLARS = [
    # (meta_file, entity_subject_suffix, shape_label_prop)
    ("photosynthesis.md.meta.ttl", "photosynthesis.md#this", SKOS.prefLabel),
]

@pytest.mark.parametrize("meta,subj_suffix,labelprop", EXEMPLARS)
def test_exemplar_materializes_frame_label(meta, subj_suffix, labelprop):
    g = _g(EX_DIR / meta)
    subj = [s for s in set(g.subjects()) if str(s).endswith(subj_suffix)]
    assert subj, f"entity subject ...{subj_suffix} not found in {meta}"
    s = subj[0]
    assert (s, labelprop, None) in g, f"{s} missing required {labelprop} (frame label)"

def test_exemplar_concept_is_skos_concept():
    g = _g(EX_DIR / "photosynthesis.md.meta.ttl")
    s = URIRef([str(x) for x in g.subjects() if str(x).endswith("photosynthesis.md#this")][0])
    assert (s, RDF.type, SKOS.Concept) in g, "exemplar concept not typed skos:Concept"
    assert (s, SKOS.broader, None) in g, "exemplar concept missing a skos:broader hop"

import pyshacl

def _shapes_graph():
    g = Graph()
    for f in ("page.shacl.ttl", "thing.shacl.ttl", "concept.shacl.ttl"):
        g.parse(OVL / "shapes" / f, format="turtle")
    return g

def test_exemplar_concept_conforms_to_shapes():
    data = _g(EX_DIR / "photosynthesis.md.meta.ttl")
    conforms, _, report = pyshacl.validate(
        data, shacl_graph=_shapes_graph(), inference="none")
    assert conforms, f"gold exemplar violates its own shapes:\n{report}"

PEOPLE_DIR = OVL / "people"

def test_broader_target_exists_and_conforms():
    p = EX_DIR / "biology.md.meta.ttl"
    assert p.exists(), "skos:broader target biology.md.meta.ttl missing (would dangle)"
    data = _g(p)
    conforms, _, report = pyshacl.validate(data, shacl_graph=_shapes_graph(), inference="none")
    assert conforms, f"biology exemplar violates shapes:\n{report}"

def test_thing_exemplar_uses_schema_name_not_preflabel():
    g = _g(PEOPLE_DIR / "marie-curie.md.meta.ttl")
    s = URIRef([str(x) for x in g.subjects() if str(x).endswith("marie-curie.md#this")][0])
    assert (s, SCHEMA.name, None) in g, "person thing missing schema:name"
    assert (s, RDF.type, SCHEMA.Person) in g
    # thing-frame: a Person is not a concept, must NOT carry prefLabel
    assert (s, SKOS.prefLabel, None) not in g, "person wrongly carries skos:prefLabel (frame confusion)"
