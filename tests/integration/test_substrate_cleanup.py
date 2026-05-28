"""Integration tests for the substrate cleanup (Phase 1 onward).

Each test should fail BEFORE its corresponding cleanup step, pass AFTER.
Run individually with: pytest tests/integration/test_substrate_cleanup.py::<test_name> -v
"""
import os
import pytest
import httpx
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF

POD = os.environ.get("POD_URL", "https://pod.vardeman.me")
POD_URL = f"{POD}/vault/"


def test_no_para_residue():
    """After Phase 1 cleanup, PARA-era containers should 404 on a fresh Pod."""
    para_paths = [
        "resources/", "areas/", "projects/", "archive/",
        "procedures/", "resources/concepts/", "resources/theories/",
        "resources/literature/", "resources/methods/", "resources/people/",
        "resources/external/", "procedures/queries/", "procedures/shapes/",
    ]
    failures = []
    for path in para_paths:
        r = httpx.head(POD_URL + path, timeout=5)
        if r.status_code != 404:
            failures.append(f"{path}: HTTP {r.status_code}")
    assert not failures, f"Phase 1 expected 404 for all PARA paths; got: {failures}"


def test_type_index_has_no_para_registrations():
    """Type Index has no PARA-era registrations.

    Phase 1's original intent was 'no PARA residue in Type Index.' Pre-Phase-3
    that was equivalent to 'empty list'. Post-Phase-3 the Type Index legitimately
    holds 5 wiki:* registrations from the wiki-memory overlay, so we check the
    actual invariant: no registrations for the PARA-era classes (vault:*, the
    old skos:Concept theory-note / concept-note routing, etc.).
    """
    SOLID = Namespace("http://www.w3.org/ns/solid/terms#")
    VAULT = Namespace("https://pod.vardeman.me/vault/ontology/vault#")
    r = httpx.get(POD_URL + "settings/publicTypeIndex",
                  headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200, f"Type Index should exist; got {r.status_code}"
    g = Graph().parse(data=r.text, format="turtle",
                      publicID=POD_URL + "settings/publicTypeIndex")
    for_classes = {str(o) for o in g.objects(predicate=SOLID.forClass)}
    para_residue = [c for c in for_classes if str(VAULT) in c]
    assert not para_residue, f"Type Index has PARA-era registrations: {para_residue}"


def test_meta_affordances_only_holds_overlay_descriptors():
    """/meta/affordances/ holds only the 4 overlay-installed descriptors.

    Phase 1's original intent was 'no Phase-0-era affordances left behind.'
    Pre-Phase-3 that was equivalent to 'empty or absent.' Post-Phase-3 the
    container legitimately holds the 4 overlay-installed descriptors
    (markdown-projection, hub-view, breadcrumb-view, memento); we check
    that no other entries leaked in.
    """
    r = httpx.get(POD_URL + "meta/affordances/",
                  headers={"Accept": "text/turtle"}, timeout=5)
    if r.status_code == 404:
        return  # acceptable — overlay may not yet be applied
    LDP = Namespace("http://www.w3.org/ns/ldp#")
    g = Graph().parse(data=r.text, format="turtle",
                      publicID=POD_URL + "meta/affordances/")
    expected = {"markdown-projection.ttl", "hub-view.ttl",
                "breadcrumb-view.ttl", "memento.ttl"}
    actual = {str(c).rsplit("/", 1)[-1] for c in g.objects(predicate=LDP.contains)}
    extras = actual - expected
    assert not extras, f"Unexpected entries in /meta/affordances/: {extras}"


def test_storage_description_announces_capabilities():
    """GET /vault/.well-known/solid returns the storage description with cap:catalog pointer.

    Resolves RQ-Substrate-2 (deferred from Phase 2). Phase 1's pod template wrote
    `<../> a pim:Storage` in /vault/.meta — against base /vault/.meta, `<../>`
    resolves to the server root, not /vault/, so CSS's StorageDescriptionHandler.
    canHandle() couldn't find pim:Storage on /vault/ and threw NotImplementedHttpError.
    Fix: change `<../>` to `<>` in the template (substrate-cleanup-step-6).
    """
    sd_url = POD_URL + ".well-known/solid"
    g = Graph().parse(sd_url, format="turtle", publicID=sd_url)
    CAP = Namespace("https://pod.vardeman.me/vault/ontology/capability#")
    catalog_triple = (None, CAP.catalog,
                      URIRef("https://pod.vardeman.me/vault/meta/capabilities/"))
    assert catalog_triple in g, "Storage description missing cap:catalog pointer"


def test_capability_catalog_lists_three_primitives():
    """Three primitives shipped: markdown-content-projection, time-travel, derived-view."""
    catalog_url = POD_URL + "meta/capabilities/"
    r = httpx.get(catalog_url, headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200
    text = r.text
    for descriptor in ["markdown-content-projection",
                       "time-travel", "derived-view"]:
        assert descriptor in text, f"Capability catalog missing {descriptor}"


def test_capability_descriptors_are_well_formed():
    """Each capability descriptor parses as Turtle and declares cap:version."""
    CAP = Namespace("https://pod.vardeman.me/vault/ontology/capability#")
    base = POD_URL + "meta/capabilities/"
    for descriptor in ["markdown-content-projection.ttl",
                       "time-travel.ttl", "derived-view.ttl"]:
        url = base + descriptor
        r = httpx.get(url, headers={"Accept": "text/turtle"}, timeout=5)
        assert r.status_code == 200, f"{descriptor} not reachable: {r.status_code}"
        g = Graph().parse(data=r.text, format="turtle", publicID=url)
        versions = list(g.objects(predicate=CAP.version))
        assert len(versions) >= 1, f"{descriptor} missing cap:version"


def test_capability_vocabulary_dereferenceable():
    """The cap: namespace resolves to its vocab document hosted on the Pod."""
    CAP = Namespace("https://pod.vardeman.me/vault/ontology/capability#")
    r = httpx.get(POD_URL + "ontology/capability.ttl",
                  headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle",
                      publicID=POD_URL + "ontology/capability.ttl")
    from rdflib.namespace import RDFS
    assert (CAP.ContentProjection, RDFS.subClassOf, CAP.Capability) in g
    assert (CAP.TimeTravel, RDFS.subClassOf, CAP.Capability) in g


def test_overlay_vocabulary_dereferenceable():
    """The overlay: namespace resolves to its vocab document hosted on the Pod."""
    OVERLAY = Namespace("https://pod.vardeman.me/vault/ontology/overlay#")
    r = httpx.get(POD_URL + "ontology/overlay.ttl",
                  headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle",
                      publicID=POD_URL + "ontology/overlay.ttl")
    from rdflib.namespace import RDFS
    assert (OVERLAY.Overlay, RDF.type, RDFS.Class) in g


WIKI = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")


def test_wiki_vocabulary_dereferenceable():
    """Class IRIs resolve to vocabulary document hosted by the Pod."""
    from rdflib.namespace import RDFS
    r = httpx.get(POD_URL + "ontology/wiki.ttl",
                  headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle",
                      publicID=POD_URL + "ontology/wiki.ttl")
    assert (WIKI.Concept, RDFS.subClassOf, WIKI.Page) in g, \
           "wiki:Concept should be subclass of wiki:Page (subclass model)"
    assert (WIKI.Page, RDFS.subClassOf, WIKI.Resource) in g
    assert (WIKI.Source, RDFS.subClassOf, WIKI.Resource) in g


def test_shape_files_resolve():
    """All 5 shape files exist at /meta/shapes/ (no 404s)."""
    for shape in ["page", "source", "person", "procedure", "working"]:
        r = httpx.head(POD_URL + f"meta/shapes/{shape}.shacl.ttl", timeout=5)
        assert r.status_code == 200, f"{shape}.shacl.ttl missing: {r.status_code}"


def test_affordance_descriptors_present():
    """All 4 affordance descriptors land in /meta/affordances/."""
    for aff in ["markdown-projection", "hub-view", "breadcrumb-view", "memento"]:
        r = httpx.head(POD_URL + f"meta/affordances/{aff}.ttl", timeout=5)
        assert r.status_code == 200, f"{aff}.ttl missing: {r.status_code}"


def test_no_sparql_endpoint_claimed():
    """Affordance descriptors don't claim /sparql endpoint anymore."""
    hub = httpx.get(POD_URL + "meta/affordances/hub-view.ttl", timeout=5).text
    assert "wiki:invokedAt" not in hub, "hub-view should not have wiki:invokedAt"
    assert "sub:requiresCapability" in hub, "hub-view should declare cap requirement"


def test_type_index_has_wiki_registrations():
    """Type Index registers wiki:* classes pointing at /wiki/* containers."""
    SOLID = Namespace("http://www.w3.org/ns/solid/terms#")
    ti = httpx.get(POD_URL + "settings/publicTypeIndex",
                   headers={"Accept": "text/turtle"}, timeout=5)
    assert ti.status_code == 200
    g = Graph().parse(data=ti.text, format="turtle", publicID=POD_URL + "settings/publicTypeIndex")
    regs = list(g.subjects(RDF.type, SOLID.TypeRegistration))
    assert len(regs) >= 5, f"Expected 5+ Type Index registrations, found {len(regs)}"
    wiki_page_reg = list(g.triples((None, SOLID.forClass, WIKI.Page)))
    assert len(wiki_page_reg) == 1, "wiki:Page should be registered once"


def test_wiki_containers_resolve():
    """Five wiki containers exist post-overlay."""
    for c in ["pages", "sources", "people", "procedures", "working"]:
        r = httpx.head(POD_URL + f"wiki/{c}/", timeout=5)
        assert r.status_code == 200, f"/wiki/{c}/ missing: {r.status_code}"


def test_no_comunica_service():
    """The Comunica HTTP service should NOT respond at port 8080.

    Comunica is a client-side SPARQL engine (per D3, D29) — it should not run
    as a Pod sidecar. After Phase 4 cleanup, Comunica wiring lives in
    solid-agent-skills as a TypeScript library; the Pod hosts no SPARQL endpoint.
    """
    with pytest.raises((httpx.ConnectError, httpx.ConnectTimeout)):
        httpx.get("http://localhost:8080/sparql", timeout=2)


def test_apply_overlay_is_idempotent():
    """Running apply twice produces no errors."""
    import subprocess, os
    py = os.path.expanduser("~/uvws/.venv/bin/python")
    r2 = subprocess.run(
        [py, "-m", "scripts.overlay.apply", "overlays/wiki-memory",
         "--target", POD_URL],
        cwd="/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid",
        capture_output=True, text=True,
    )
    assert r2.returncode == 0, f"Second apply failed: {r2.stderr}"
