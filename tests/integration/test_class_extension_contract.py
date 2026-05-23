from pyshacl import validate
from rdflib import Graph, URIRef

SHAPE = "overlays/wiki-memory/shapes/class-extension.shacl.ttl"
SOURCE_SHAPE = "overlays/wiki-memory/shapes/source.shacl.ttl"
CONCEPT_SHAPE = "overlays/wiki-memory/shapes/concept.shacl.ttl"
AI = URIRef("http://www.w3.org/ns/shacl#agentInstruction")

CONFORMING = """
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
wiki:Source a rdfs:Class ; rdfs:subClassOf skos:Concept ;
    rdfs:label "Source" ; rdfs:comment "Citation record / literature note." .
"""

ROOTLESS = """
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
wiki:Bad a rdfs:Class ; rdfs:label "Bad" ; rdfs:comment "no parent" .
"""

SOURCE_VOCAB = """
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
wiki:Source a rdfs:Class ; rdfs:subClassOf skos:Concept ;
    rdfs:label "Source" ; rdfs:comment "Citation record / literature note." .
"""

SOURCE_MISSING_IDENTIFIER = """
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
<https://example.org/s1> a wiki:Source ;
    skos:prefLabel "Beyond RAG" .
"""

SOURCE_CONFORMING = """
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix dct:   <http://purl.org/dc/terms/> .
<https://example.org/s1> a wiki:Source ;
    skos:prefLabel "Beyond RAG" ;
    dct:identifier "arXiv:2601.00000" .
"""


def _conforms(data, node_local):
    g = Graph().parse(data=data, format="turtle")
    s = Graph().parse(SHAPE, format="turtle")
    # Target the candidate node explicitly against ClassExtensionShape.
    s.add((URIRef("https://pod.vardeman.me/vault/ontology/wiki#ClassExtensionShape"),
           URIRef("http://www.w3.org/ns/shacl#targetNode"),
           URIRef("https://pod.vardeman.me/vault/ontology/wiki#" + node_local)))
    # inference="none": RDFS entailment adds rdfs:subClassOf rdfs:Resource to every
    # class, trivially satisfying the minCount-1 rooting check. We want to validate
    # what the agent explicitly asserted, not what RDFS derives.
    conforms, _, _ = validate(data_graph=g, shacl_graph=s, inference="none")
    return conforms


def _source_shape_conforms(data):
    g = Graph().parse(data=data, format="turtle")
    # Load source shape + concept shape (needed for sh:node wiki:ConceptShape resolution).
    s = Graph()
    s.parse(SOURCE_SHAPE, format="turtle")
    s.parse(CONCEPT_SHAPE, format="turtle")
    # inference="rdfs" so wiki:Source rdfs:subClassOf skos:Concept resolves for sh:targetClass.
    conforms, _, _ = validate(data_graph=g, shacl_graph=s, inference="rdfs")
    return conforms


def test_conforming_extension_passes():
    assert _conforms(CONFORMING, "Source") is True


def test_rootless_extension_fails():
    assert _conforms(ROOTLESS, "Bad") is False


def test_source_extension_conforms_to_contract():
    """wiki:Source as defined in vocabulary/wiki.ttl satisfies ClassExtensionShape."""
    # Load the actual vocabulary definition (not an inline stub).
    g = Graph()
    g.parse("overlays/wiki-memory/vocabulary/wiki.ttl", format="turtle")
    s = Graph().parse(SHAPE, format="turtle")
    s.add((URIRef("https://pod.vardeman.me/vault/ontology/wiki#ClassExtensionShape"),
           URIRef("http://www.w3.org/ns/shacl#targetNode"),
           URIRef("https://pod.vardeman.me/vault/ontology/wiki#Source")))
    conforms, _, _ = validate(data_graph=g, shacl_graph=s, inference="none")
    assert conforms is True


def test_source_shape_requires_identifier():
    """wiki:Source node without dct:identifier does not conform; with it does."""
    assert _source_shape_conforms(SOURCE_MISSING_IDENTIFIER) is False
    assert _source_shape_conforms(SOURCE_CONFORMING) is True
