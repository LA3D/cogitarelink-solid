from pyshacl import validate
from rdflib import Graph, URIRef

SHAPE = "overlays/wiki-memory/shapes/class-extension.shacl.ttl"
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

def test_conforming_extension_passes():
    assert _conforms(CONFORMING, "Source") is True

def test_rootless_extension_fails():
    assert _conforms(ROOTLESS, "Bad") is False
