"""Verify agent can complete the 7-step first-arrival ritual from any resource.

Covers Phase 6 (Tasks 36-41) of Rung 1.4: JSON-LD context, storage description
extension, 4 affordance descriptors, wiki containers. Tests the full L3 discovery
chain that a first-arriving agent would follow (D33, D48, D55 Tier 2).

Run:
    pytest tests/test_wiki_memory_l3_discovery.py -v
"""
import os
import json

import httpx
import pytest
from rdflib import Graph, Namespace

POD = os.environ.get("POD_URL", "http://pod.vardeman.me:3000")
WIKI = Namespace("urn:example:wiki#")


def test_seven_step_first_arrival_ritual() -> None:
    """Agent arrives at any resource and completes the 7-step L3 discovery ritual."""

    # Step 1: GET pod container, find Link rel="solid:storageDescription"
    r = httpx.get(f"{POD}/vault/", follow_redirects=True)
    assert r.status_code == 200, f"Pod root GET failed: {r.status_code}"

    # httpx returns a Headers multi-map; collect all Link values
    link_values = r.headers.get_list("link") if hasattr(r.headers, "get_list") else [r.headers.get("link", "")]
    combined = ", ".join(link_values)
    sd_url = None
    for entry in combined.split(","):
        if "storageDescription" in entry:
            # Extract URL from < ... >
            start = entry.find("<")
            end = entry.find(">", start)
            if start != -1 and end != -1:
                sd_url = entry[start + 1:end]
                break
    assert sd_url, f"No storageDescription Link header on /vault/: {combined}"

    # Resolve relative URL if needed
    if sd_url.startswith("/"):
        sd_url = f"{POD}{sd_url}"
    elif not sd_url.startswith("http"):
        sd_url = f"{POD}/vault/{sd_url}"

    # Step 2: GET storage description, verify L3 pointers present
    r = httpx.get(sd_url, headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"Storage description GET failed: {r.status_code}"
    sd = Graph()
    sd.parse(data=r.text, format="turtle", publicID=sd_url)

    ctx_objects = list(sd.objects(predicate=WIKI.contextDocument))
    assert ctx_objects, f"Storage description lacks wiki:contextDocument:\n{r.text}"

    aff_objects = list(sd.objects(predicate=WIKI.affordanceCatalog))
    assert aff_objects, f"Storage description lacks wiki:affordanceCatalog:\n{r.text}"

    shape_objects = list(sd.objects(predicate=WIKI.shapeCatalog))
    assert shape_objects, f"Storage description lacks wiki:shapeCatalog:\n{r.text}"

    ti_objects = list(sd.objects(predicate=WIKI.typeIndex))
    assert ti_objects, f"Storage description lacks wiki:typeIndex:\n{r.text}"

    # Step 3: GET context document — must be valid JSON-LD with Concept term
    ctx_url = str(ctx_objects[0])
    if ctx_url.startswith("/"):
        ctx_url = f"{POD}{ctx_url}"
    r = httpx.get(ctx_url)
    assert r.status_code == 200, f"Context document GET failed: {r.status_code}\nURL: {ctx_url}"
    ctx_doc = json.loads(r.text)
    assert "@context" in ctx_doc, "Context document has no @context key"
    assert "Concept" in ctx_doc["@context"], "Context document missing 'Concept' term"
    assert "Person" in ctx_doc["@context"], "Context document missing 'Person' term"
    assert "Source" in ctx_doc["@context"], "Context document missing 'Source' term"

    # Step 4: GET affordance catalog — must be LDP container listing 4 affordances
    aff_url = str(aff_objects[0])
    if aff_url.startswith("/"):
        aff_url = f"{POD}{aff_url}"
    r = httpx.get(aff_url, headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"Affordance catalog GET failed: {r.status_code}\nURL: {aff_url}"
    aff_g = Graph()
    aff_g.parse(data=r.text, format="turtle", publicID=aff_url)
    from rdflib.namespace import RDF
    LDP = Namespace("http://www.w3.org/ns/ldp#")
    assert (None, RDF.type, LDP.BasicContainer) in aff_g, "Affordance catalog is not an LDP BasicContainer"

    # Step 5: GET projection affordance — must declare wiki:governs
    proj_url = f"{POD}/vault/meta/affordances/markdown-projection.ttl"
    r = httpx.get(proj_url, headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"Projection affordance GET failed: {r.status_code}\nURL: {proj_url}"
    proj = Graph()
    proj.parse(data=r.text, format="turtle", publicID=proj_url)
    governs_objects = list(proj.objects(predicate=WIKI.governs))
    assert governs_objects, f"Projection affordance lacks wiki:governs: {r.text}"

    # Step 6: GET shape catalog — 200 or 404 acceptable (populated in Rung 1.5)
    shape_url = str(shape_objects[0])
    if shape_url.startswith("/"):
        shape_url = f"{POD}{shape_url}"
    r = httpx.get(shape_url, headers={"Accept": "text/turtle"})
    assert r.status_code in (200, 404), (
        f"Shape catalog GET unexpected status: {r.status_code}\nURL: {shape_url}"
    )
    # If 200, verify it's a container
    if r.status_code == 200:
        sc_g = Graph()
        sc_g.parse(data=r.text, format="turtle", publicID=shape_url)
        assert (None, RDF.type, LDP.BasicContainer) in sc_g, "Shape catalog is not LDP BasicContainer"

    # Step 7: GET Type Index — 200 or 404 acceptable
    ti_url = str(ti_objects[0])
    if ti_url.startswith("/"):
        ti_url = f"{POD}{ti_url}"
    r = httpx.get(ti_url)
    assert r.status_code in (200, 404), (
        f"Type Index GET unexpected status: {r.status_code}\nURL: {ti_url}"
    )


def test_wiki_containers_exist() -> None:
    """All five L3 wiki containers must exist and be LDP BasicContainers."""
    containers = ["pages", "sources", "people", "procedures", "working"]
    for name in containers:
        url = f"{POD}/vault/wiki/{name}/"
        r = httpx.get(url, headers={"Accept": "text/turtle"})
        assert r.status_code == 200, f"Wiki container /{name}/ not found: {r.status_code}"
        g = Graph()
        g.parse(data=r.text, format="turtle", publicID=url)
        LDP = Namespace("http://www.w3.org/ns/ldp#")
        from rdflib.namespace import RDF
        assert (None, RDF.type, LDP.BasicContainer) in g, (
            f"/{name}/ is not an LDP BasicContainer:\n{r.text}"
        )


def test_affordance_descriptors_parseable() -> None:
    """All four affordance descriptors must be parseable Turtle with correct rdf:type."""
    affordances = {
        "markdown-projection.ttl": WIKI.WriteAffordance,
        "hub-view.ttl": WIKI.DerivedClassAffordance,
        "breadcrumb-view.ttl": WIKI.DerivedNavigationAffordance,
        "memento.ttl": WIKI.VersionAffordance,
    }
    from rdflib.namespace import RDF
    for fname, expected_type in affordances.items():
        url = f"{POD}/vault/meta/affordances/{fname}"
        r = httpx.get(url, headers={"Accept": "text/turtle"})
        assert r.status_code == 200, f"Affordance {fname} not found: {r.status_code}"
        g = Graph()
        g.parse(data=r.text, format="turtle", publicID=url)
        types = list(g.objects(predicate=RDF.type))
        assert expected_type in types, (
            f"{fname} lacks expected rdf:type {expected_type}: found {types}"
        )


def test_storage_description_wiki_vocabs() -> None:
    """Storage description declares wiki# and cito/ vocabularies."""
    sd_url = f"{POD}/vault/.well-known/solid"
    r = httpx.get(sd_url, headers={"Accept": "text/turtle"})
    assert r.status_code == 200
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=sd_url)
    VOID = Namespace("http://rdfs.org/ns/void#")
    from rdflib import URIRef
    vocabs = {str(o) for _, _, o in g.triples((None, VOID.vocabulary, None))}
    assert "urn:example:wiki#" in vocabs, f"wiki# not in void:vocabulary: {vocabs}"
    assert "http://purl.org/spar/cito/" in vocabs, f"cito/ not in void:vocabulary: {vocabs}"
