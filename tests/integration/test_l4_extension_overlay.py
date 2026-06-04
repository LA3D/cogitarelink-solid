"""End-to-end L4 extension: apply stub biz overlay on wiki-l3, validate a biz:Equipment.

This test demonstrates the D100 extension contract:
1. L4 overlay declares biz:Equipment rdfs:subClassOf schema:Product, schema:Thing
2. apply.py installs the overlay on top of wiki-memory L3
3. A page typed biz:Equipment validates against L3 ThingShape AND L4 EquipmentShape

Skipped pending Phase H Task 30 Pod rebuild.
"""
import os
import subprocess
import time
import pytest
import httpx

from tests.conftest import _pod_base, resolve_ca as _resolve_ca

POD = _pod_base() + "/vault"
_CA = _resolve_ca() or False
PYTHON = os.environ.get("VENV_PYTHON", os.path.expanduser("~/uvws/.venv/bin/python"))

# Type-Index URL and the registration fragment ID minted by apply.py's
# build_type_index_graph: reg{index}-{overlay_name} (index=0, name="test-biz-overlay")
_TI_URL = POD + "/settings/publicTypeIndex"
_REG_IRI = _TI_URL + "#reg0-test-biz-overlay"

# Resources installed by the overlay that teardown must remove (deepest-first)
_OVERLAY_RESOURCES = [
    POD + "/ontology/biz",
    POD + "/ontology/biz.meta",
    POD + "/meta/shapes/biz-equipment.shacl.ttl",
    POD + "/meta/shapes/biz-equipment.shacl.ttl.meta",
]
# Containers to delete deepest-first (after deleting their contents)
_OVERLAY_CONTAINERS = [
    _pod_base() + "/biz/equipment/",
    _pod_base() + "/biz/",
]


def _delete_if_exists(client: httpx.Client, url: str) -> None:
    """DELETE url; silently ignore 404 (idempotent, robust to partial runs)."""
    r = client.delete(url)
    if r.status_code not in (200, 204, 205, 404):
        # Log but don't raise — teardown should be best-effort
        print(f"  [teardown] DELETE {url} → {r.status_code} {r.text[:80]}")


def _n3_patch_delete_ti_registration(client: httpx.Client) -> None:
    """N3-Patch-DELETE the biz-overlay Type-Index registration triples.

    Mirrors what apply.py does with solid:inserts but uses solid:deletes.
    Reads the current TI to find the exact triples, then removes them.
    """
    # Build the three triples to remove as N-Triples (rdflib canonical form)
    from rdflib import Graph, URIRef, RDF, Namespace
    SOLID_NS = Namespace("http://www.w3.org/ns/solid/terms#")
    reg = URIRef(_REG_IRI)
    g = Graph()
    g.add((reg, RDF.type, SOLID_NS.TypeRegistration))
    g.add((reg, SOLID_NS.forClass, URIRef("https://chuck.example/biz/Equipment")))
    g.add((reg, SOLID_NS.instanceContainer, URIRef(_pod_base() + "/biz/equipment/")))
    ntriples = g.serialize(format="nt").strip()
    if not ntriples:
        return
    patch_body = (
        "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n\n"
        f"_:patch a solid:InsertDeletePatch ;\n"
        f"   solid:deletes {{ {ntriples} }} .\n"
    )
    r = client.patch(_TI_URL, content=patch_body.encode("utf-8"),
                     headers={"Content-Type": "text/n3"})
    if r.status_code not in (200, 204, 205):
        print(f"  [teardown] PATCH-DELETE TI registration → {r.status_code} {r.text[:120]}")


@pytest.fixture(autouse=True)
def _cleanup_biz_overlay():
    """Teardown: remove all biz-overlay artifacts from the Pod after each test run.

    Runs after the test (yield), and also at setup to clear any residue from
    a previous interrupted run.  Robust to partial runs — all deletes ignore 404.
    """
    def _do_cleanup():
        with httpx.Client(verify=_CA, timeout=10) as client:
            # 1. Remove the Type-Index registration triples
            _n3_patch_delete_ti_registration(client)
            # 2. Delete the equipment resource (if the test created it)
            _delete_if_exists(client, POD + "/biz/equipment/hp-laserjet.md")
            _delete_if_exists(client, POD + "/biz/equipment/hp-laserjet.md.meta")
            # 3. Delete overlay-installed vocab + shape resources
            for url in _OVERLAY_RESOURCES:
                _delete_if_exists(client, url)
            # 4. Delete containers deepest-first
            for ctr_url in _OVERLAY_CONTAINERS:
                # Try to delete the .meta sidecar first (CSS creates one)
                meta_url = ctr_url.rstrip("/") + "/.meta"
                _delete_if_exists(client, meta_url)
                _delete_if_exists(client, ctr_url)

    # Pre-test cleanup: clear residue from a previous interrupted run
    _do_cleanup()
    yield
    # Post-test cleanup: remove what this test run created
    _do_cleanup()


def test_biz_overlay_applies_and_validates_equipment():
    # Apply the stub overlay
    result = subprocess.run(
        [PYTHON, "-m", "scripts.overlay.apply",
         "tests/fixtures/test-biz-overlay",
         "--target", POD],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"apply.py failed: {result.stderr}"

    # PUT a biz:Equipment page (the PUT itself creates the /biz/equipment/ container).
    body = """---
title: HP LaserJet
type: https://chuck.example/biz/Equipment
---

# HP LaserJet"""
    with httpx.Client(verify=_CA, base_url=POD) as client:
        resp = client.put("/biz/equipment/hp-laserjet.md",
                          content=body,
                          headers={"Content-Type": "text/markdown"})
        assert resp.status_code in (200, 201, 204, 205), f"PUT failed: {resp.text}"

        # Projection is post-commit/async (D58/D71). The projection listener only
        # projects writes to DURABLE containers, and it reloads that set from the
        # Type Index lazily — so the FIRST write to the just-registered /biz/
        # container won't project until the listener re-reads the Type Index (after
        # its ~15s startup grace on a freshly restarted Pod). Re-PUT periodically to
        # drive that reload; budget covers the grace window so the test is robust on
        # both a warm and a cold (post-restart) Pod.
        meta_text = ""
        for attempt in range(80):  # ~40s
            meta = client.get("/biz/equipment/hp-laserjet.md.meta",
                              headers={"Accept": "text/turtle"})
            if meta.status_code == 200 and "https://chuck.example/biz/Equipment" in meta.text:
                meta_text = meta.text
                break
            time.sleep(0.5)
            if attempt % 6 == 5:  # re-fire the listener so it reloads durable containers
                client.put("/biz/equipment/hp-laserjet.md", content=body,
                           headers={"Content-Type": "text/markdown"})
        assert "https://chuck.example/biz/Equipment" in meta_text, \
            f"biz:Equipment never projected into .meta:\n{meta_text}"
        assert "schema:mainEntity" in meta_text or "mainEntity" in meta_text
        # Note: resource cleanup is handled by the _cleanup_biz_overlay fixture
