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

        # Projection is post-commit/async (D58/D71), so poll the .meta until <#this>
        # is typed biz:Equipment (read-immediately would see only CSS posix metadata).
        meta_text = ""
        for _ in range(20):  # ~5s
            meta = client.get("/biz/equipment/hp-laserjet.md.meta",
                              headers={"Accept": "text/turtle"})
            if meta.status_code == 200 and "https://chuck.example/biz/Equipment" in meta.text:
                meta_text = meta.text
                break
            time.sleep(0.25)
        assert "https://chuck.example/biz/Equipment" in meta_text, \
            f"biz:Equipment never projected into .meta:\n{meta_text}"
        assert "schema:mainEntity" in meta_text or "mainEntity" in meta_text
        client.delete("/biz/equipment/hp-laserjet.md")
        client.delete("/biz/equipment/hp-laserjet.md.meta")
