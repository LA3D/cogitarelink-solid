# tests/pytest/test_pod_structure.py
"""Verify pod structure created by CSS seed config + pod templates.

Post-substrate-cleanup (2026-05-16, tag `substrate-cleanup-complete`): the base
Pod template is PARA-free. Wiki-memory containers are added by the wiki-memory
overlay (scripts/overlay/apply.py); see test_substrate_cleanup.py for the
substrate invariants and the wiki-memory L3 discovery / traversal / listener
tests for the overlay-side coverage.
"""
import httpx
import pytest
from rdflib import Graph, URIRef, Namespace
from rdflib.namespace import RDF

from tests.conftest import _pod_base, resolve_ca as _resolve_ca

_CA  = _resolve_ca() or False
BASE = _pod_base()

PIM = Namespace("http://www.w3.org/ns/pim/space#")
FOAF = Namespace("http://xmlns.com/foaf/0.1/")
LDP = Namespace("http://www.w3.org/ns/ldp#")

EXPECTED_CONTAINERS = [
    "/vault/",
    "/vault/meta/",
    "/vault/meta/shapes/",
    "/vault/meta/capabilities/",
    "/vault/ontology/",
]


@pytest.mark.integration
class TestPodStructure:

    def test_pod_root_is_storage(self):
        """Pod root should be marked as pim:Storage."""
        url = f"{BASE}/vault/"
        r = httpx.get(url, headers={"Accept": "text/turtle"}, timeout=10, verify=_CA)
        assert r.status_code == 200
        g = Graph().parse(data=r.text, format="turtle", publicID=url)
        storage_instances = list(g.subjects(RDF.type, PIM.Storage))
        assert storage_instances, (
            f"No pim:Storage triple found in {url}. Text excerpt: {r.text[:300]}"
        )

    def test_webid_exists(self):
        """WebID card should exist and contain foaf:Person."""
        url = f"{BASE}/vault/profile/card"
        r = httpx.get(url, headers={"Accept": "text/turtle"}, timeout=10, verify=_CA)
        assert r.status_code == 200
        g = Graph().parse(data=r.text, format="turtle", publicID=url)
        persons = list(g.subjects(RDF.type, FOAF.Person))
        assert persons, (
            f"No foaf:Person triple found in {url}. Text excerpt: {r.text[:300]}"
        )

    def test_webid_references_type_index(self):
        """WebID should reference the public Type Index."""
        r = httpx.get(f"{BASE}/vault/profile/card",
                      headers={"Accept": "text/turtle"}, timeout=10, verify=_CA)
        assert r.status_code == 200
        assert "publicTypeIndex" in r.text

    def test_type_index_exists(self):
        """Type Index should exist and be a solid:TypeIndex."""
        r = httpx.get(f"{BASE}/vault/settings/publicTypeIndex",
                      headers={"Accept": "text/turtle"}, timeout=10, verify=_CA)
        assert r.status_code == 200
        assert "TypeIndex" in r.text

    @pytest.mark.parametrize("path", EXPECTED_CONTAINERS)
    def test_container_exists(self, path):
        """Substrate containers (base pod template + capability catalog) exist as LDP containers."""
        url = f"{BASE}{path}"
        r = httpx.get(url, headers={"Accept": "text/turtle"}, timeout=10, verify=_CA)
        assert r.status_code == 200, f"Container {path} returned {r.status_code}"
        g = Graph().parse(data=r.text, format="turtle", publicID=url)
        is_container = (
            (url, RDF.type, LDP.BasicContainer) in g
            or (url, RDF.type, LDP.Container) in g
            or any(g.subjects(RDF.type, LDP.BasicContainer))
            or any(g.subjects(RDF.type, LDP.Container))
        )
        assert is_container, f"{path} is not an LDP Container. Text excerpt: {r.text[:300]}"

    def test_unauthenticated_write_allowed(self):
        """Dev mode: unauthenticated PUT should succeed (allow-all auth)."""
        url = f"{BASE}/vault/wiki/working/_test-write.md"
        r = httpx.put(url, content=b"# Test", headers={"Content-Type": "text/markdown"},
                      timeout=10, verify=_CA)
        # 404 acceptable when the wiki-memory overlay hasn't been applied to this Pod.
        assert r.status_code in (200, 201, 205, 404), f"PUT failed: {r.status_code}"
        if r.status_code != 404:
            httpx.delete(url, timeout=10, verify=_CA)


@pytest.mark.integration
class TestPodSetup:

    def test_ontology_uploaded(self):
        """Ontology stubs should be uploaded by pod-setup service."""
        r = httpx.get(f"{BASE}/vault/ontology/solid-pod-profile.ttl",
                      headers={"Accept": "text/turtle"}, timeout=10, verify=_CA)
        assert r.status_code == 200
        assert "SolidPodProfile" in r.text
