"""Every L3 shape and minted class carries full FAIR metadata (D97).

Runs locally — does not require live Pod.
"""
from pathlib import Path
from rdflib import Graph, URIRef
from rdflib.namespace import RDFS, DCTERMS

REPO = Path(__file__).parents[2]
SHAPES_DIR = REPO / "overlays/wiki-memory/shapes"
VOCAB = REPO / "overlays/wiki-memory/vocabulary/wiki.ttl"

REQUIRED_ON_SHAPE = [
    URIRef("http://www.w3.org/2000/01/rdf-schema#label"),
    URIRef("http://www.w3.org/2000/01/rdf-schema#comment"),
    URIRef("http://www.w3.org/2000/01/rdf-schema#isDefinedBy"),
    URIRef("http://purl.org/dc/terms/conformsTo"),
    URIRef("http://purl.org/dc/terms/created"),
    URIRef("http://purl.org/dc/terms/creator"),
]

SH_NODE_SHAPE = URIRef("http://www.w3.org/ns/shacl#NodeShape")
RDF_TYPE = URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")


def test_every_shape_has_fair_metadata():
    failures = []
    for shape_file in sorted(SHAPES_DIR.glob("*.shacl.ttl")):
        if shape_file.name == "template.shacl.ttl":
            continue  # template uses placeholder values
        g = Graph()
        g.parse(shape_file, format="turtle")
        for shape in g.subjects(RDF_TYPE, SH_NODE_SHAPE):
            for required in REQUIRED_ON_SHAPE:
                if (shape, required, None) not in g:
                    failures.append(f"{shape_file.name}: <{shape}> missing <{required}>")
    assert not failures, "\n".join(failures)


def test_vocabulary_has_vann_prefix_and_uri():
    g = Graph()
    g.parse(VOCAB, format="turtle")
    onto = URIRef("https://pod.vardeman.me/vault/ontology/wiki")
    assert (onto, URIRef("http://purl.org/vocab/vann/preferredNamespacePrefix"), None) in g, \
        "vocabulary missing vann:preferredNamespacePrefix"
    assert (onto, URIRef("http://purl.org/vocab/vann/preferredNamespaceUri"), None) in g, \
        "vocabulary missing vann:preferredNamespaceUri"
