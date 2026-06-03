"""Test frontmatter -> RDF triple generation."""
import pytest
from rdflib import Graph, URIRef, Literal, Namespace
from rdflib.namespace import RDF, DCTERMS, XSD, SKOS

from scripts.lib.rdf_gen import frontmatter_to_graph, slug

VAULT = Namespace("https://pod.vardeman.me/vault/ontology#")
WIKI  = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")
BASE = "https://pod.vardeman.me/vault/resources/concepts/"


def test_slug():
    assert slug("Context Graphs") == "context-graphs"
    assert slug("Compound AI Systems") == "compound-ai-systems"
    assert slug("HippoRAG v2") == "hipporag-v2"


def test_concept_note():
    """Real frontmatter from Contextual Retrieval.md."""
    fm = {
        "type": "concept-note",
        "created": "2026-03-09",
        "up": "[[Agentic Memory Systems MOC]]",
        "extends": "[[Progressive Disclosure]]",
        "related": ["[[Context Graphs]]", "[[Context Engineering]]"],
        "tags": ["retrieval", "rag"],
    }
    g = frontmatter_to_graph(fm, "Contextual Retrieval", BASE)
    subj = URIRef(f"{BASE}contextual-retrieval.md")

    # R-T7: TYPE_MAP reconciled to L3 wiki: classes (was bare skos:Concept).
    assert (subj, RDF.type, WIKI.Concept) in g
    assert (subj, SKOS.prefLabel, Literal("Contextual Retrieval", datatype=XSD.string)) in g
    assert (subj, DCTERMS.created, Literal("2026-03-09", datatype=XSD.date)) in g

    related = [str(o) for o in g.objects(subj, SKOS.related)]
    assert f"{BASE}context-graphs.md" in related

    tags = [str(o) for o in g.objects(subj, DCTERMS.subject)]
    assert "retrieval" in tags


def test_theory_note():
    """Theory notes map to the L3 wiki:Concept class (R-T7: reconciled from the
    pre-D70 legacy vault:TheoryNote, which no deployed shape governed)."""
    fm = {"type": "theory-note", "up": "[[Agentic Memory Systems MOC]]"}
    g = frontmatter_to_graph(fm, "Progressive Disclosure", BASE)
    subj = URIRef(f"{BASE}progressive-disclosure.md")

    assert (subj, RDF.type, WIKI.Concept) in g
    assert (subj, SKOS.prefLabel, Literal("Progressive Disclosure", datatype=XSD.string)) in g


def test_minimal_note():
    """Note with only type -- should still produce valid triples."""
    fm = {"type": "concept-note"}
    g = frontmatter_to_graph(fm, "Test Note", BASE)
    subj = URIRef(f"{BASE}test-note.md")

    assert (subj, RDF.type, WIKI.Concept) in g
    assert (subj, SKOS.prefLabel, Literal("Test Note", datatype=XSD.string)) in g
    assert len(g) >= 2


def test_digest():
    """Digest should appear when provided."""
    fm = {"type": "concept-note"}
    g = frontmatter_to_graph(fm, "Test", BASE, digest="zabc123")
    subj = URIRef(f"{BASE}test.md")
    digests = list(g.objects(subj, URIRef("http://www.w3.org/2021/ni#digestMultibase")))
    assert len(digests) == 1


def test_serializes_to_turtle():
    fm = {"type": "concept-note", "created": "2026-01-01"}
    g = frontmatter_to_graph(fm, "Test", BASE)
    ttl = g.serialize(format="turtle")
    # R-T7: concept-note now maps to the L3 wiki:Concept (was skos:Concept).
    assert "wiki:Concept" in ttl or "ontology/wiki#Concept" in ttl
