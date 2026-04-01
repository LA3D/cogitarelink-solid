# tests/pytest/test_pod_structure.py
"""Verify pod structure created by CSS seed config + pod templates."""
import httpx
import pytest

BASE = "http://pod.vardeman.me:3000"

EXPECTED_CONTAINERS = [
    "/vault/",
    "/vault/resources/",
    "/vault/resources/concepts/",
    "/vault/resources/theories/",
    "/vault/resources/literature/",
    "/vault/resources/methods/",
    "/vault/resources/people/",
    "/vault/resources/external/",
    "/vault/projects/",
    "/vault/areas/",
    "/vault/archive/",
    "/vault/procedures/",
    "/vault/procedures/shapes/",
    "/vault/procedures/queries/",
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

    def test_type_index_has_concept_registration(self):
        """Type Index should map skos:Concept to /resources/concepts/."""
        r = httpx.get(f"{BASE}/vault/settings/publicTypeIndex",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "Concept" in r.text
        assert "resources/concepts" in r.text

    @pytest.mark.parametrize("path", EXPECTED_CONTAINERS)
    def test_container_exists(self, path):
        """All PARA containers should exist as LDP containers."""
        r = httpx.get(f"{BASE}{path}",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200, f"Container {path} returned {r.status_code}"
        assert "ldp:BasicContainer" in r.text or "ldp#BasicContainer" in r.text or \
               "Container" in r.text, f"{path} is not a container"

    def test_unauthenticated_write_allowed(self):
        """Dev mode: unauthenticated PUT should succeed (allow-all auth)."""
        url = f"{BASE}/vault/resources/concepts/_test-write.md"
        r = httpx.put(url, content=b"# Test", headers={"Content-Type": "text/markdown"},
                      timeout=10)
        assert r.status_code in (200, 201, 205), f"PUT failed: {r.status_code}"
        # Cleanup
        httpx.delete(url, timeout=10)


@pytest.mark.integration
class TestPodSetup:

    def test_shapes_uploaded(self):
        """SHACL shapes should be uploaded by pod-setup service."""
        r = httpx.get(f"{BASE}/vault/procedures/shapes/concept-note.ttl",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "ConceptNoteShape" in r.text

    def test_ontology_uploaded(self):
        """Ontology stubs should be uploaded by pod-setup service."""
        r = httpx.get(f"{BASE}/vault/ontology/solid-pod-profile.ttl",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "SolidPodProfile" in r.text
