"""Manifest parser: overlay:installsResourceMetaPatch -> resource_meta_patches."""
from pathlib import Path


def test_manifest_parses_installs_resource_meta_patch(tmp_path: Path):
    manifest_text = """
@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> .

<https://pod.vardeman.me/vault/ontology/overlay#test-overlay>
    a overlay:Overlay ;
    overlay:name "test" ;
    overlay:version "0.1" ;
    overlay:installsResourceMetaPatch
        [ overlay:targetResource </vault/profile/card> ;
          overlay:metaPatchContent "profile-card-meta.ttl" ] .
"""
    (tmp_path / "manifest.ttl").write_text(manifest_text)
    (tmp_path / "patches").mkdir()
    (tmp_path / "patches" / "profile-card-meta.ttl").write_text(
        "@prefix dct: <http://purl.org/dc/terms/> .\n"
        "</vault/profile/card> dct:conformsTo </vault/meta/shapes/x.ttl#X> .\n"
    )

    from scripts.overlay.common import parse_manifest
    m = parse_manifest(tmp_path, pod_url="https://pod.vardeman.me/vault/")
    assert hasattr(m, "resource_meta_patches"), "Manifest must expose resource_meta_patches"
    assert len(m.resource_meta_patches) == 1
    rp = m.resource_meta_patches[0]
    assert rp.target_resource == "https://pod.vardeman.me/vault/profile/card"
    assert "dct:conformsTo" in rp.patch_body
