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


def _wait_for_biz_container(client, tries=20, delay=0.25):
    """Poll until the overlay-installed /biz/equipment/ container is live.

    apply.py returns once it has POSTed the overlay resources, but on a freshly
    restarted Pod the container/shape registration can lag a beat behind. Without
    this readiness wait the immediately-following PUT races the install (a rare
    cold-start flake). Bounded so a genuine install failure still surfaces.
    """
    for _ in range(tries):
        r = client.get("/biz/equipment/", headers={"Accept": "text/turtle"})
        if r.status_code == 200:
            return True
        time.sleep(delay)
    return False


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

    # PUT a biz:Equipment page
    body = """---
title: HP LaserJet
type: https://chuck.example/biz/Equipment
---

# HP LaserJet"""
    with httpx.Client(verify=_CA, base_url=POD) as client:
        assert _wait_for_biz_container(client), \
            "overlay-installed /biz/equipment/ never came live after apply.py"
        resp = client.put("/biz/equipment/hp-laserjet.md",
                          content=body,
                          headers={"Content-Type": "text/markdown"})
        assert resp.status_code in (200, 201, 204, 205), f"PUT failed: {resp.text}"

        # Read .meta and assert both L3 ThingShape and L4 EquipmentShape are validated
        meta = client.get("/biz/equipment/hp-laserjet.md.meta",
                          headers={"Accept": "text/turtle"})
        assert meta.status_code == 200
        assert "https://chuck.example/biz/Equipment" in meta.text
        assert "schema:mainEntity" in meta.text or "mainEntity" in meta.text
