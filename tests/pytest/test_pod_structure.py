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

BASE = "https://pod.vardeman.me"

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
        r = httpx.get(f"{BASE}/vault/", headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "pim:Storage" in r.text or "pim/space#Storage" in r.text

    def test_webid_exists(self):
        """WebID card should exist and contain foaf:Person."""
        r = httpx.get(f"{BASE}/vault/profile/card",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "foaf:Person" in r.text or "foaf/0.1/Person" in r.text

    def test_webid_references_type_index(self):
        """WebID should reference the public Type Index."""
        r = httpx.get(f"{BASE}/vault/profile/card",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "publicTypeIndex" in r.text

    def test_type_index_exists(self):
        """Type Index should exist and be a solid:TypeIndex."""
        r = httpx.get(f"{BASE}/vault/settings/publicTypeIndex",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "TypeIndex" in r.text

    @pytest.mark.parametrize("path", EXPECTED_CONTAINERS)
    def test_container_exists(self, path):
        """Substrate containers (base pod template + capability catalog) exist as LDP containers."""
        r = httpx.get(f"{BASE}{path}",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200, f"Container {path} returned {r.status_code}"
        assert "ldp:BasicContainer" in r.text or "ldp#BasicContainer" in r.text or \
               "Container" in r.text, f"{path} is not a container"

    def test_unauthenticated_write_allowed(self):
        """Dev mode: unauthenticated PUT should succeed (allow-all auth)."""
        url = f"{BASE}/vault/wiki/working/_test-write.md"
        r = httpx.put(url, content=b"# Test", headers={"Content-Type": "text/markdown"},
                      timeout=10)
        # 404 acceptable when the wiki-memory overlay hasn't been applied to this Pod.
        assert r.status_code in (200, 201, 205, 404), f"PUT failed: {r.status_code}"
        if r.status_code != 404:
            httpx.delete(url, timeout=10)


@pytest.mark.integration
class TestPodSetup:

    def test_ontology_uploaded(self):
        """Ontology stubs should be uploaded by pod-setup service."""
        r = httpx.get(f"{BASE}/vault/ontology/solid-pod-profile.ttl",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "SolidPodProfile" in r.text
