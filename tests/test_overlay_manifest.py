"""Overlay manifest parses installsProfile + installsView + installsViewArtifact (view-layer Task 3)."""
from pathlib import Path

from scripts.overlay.common import parse_manifest

ROOT = Path(__file__).parent.parent


def test_manifest_parses_profiles_and_views():
    m = parse_manifest(ROOT / "overlays" / "wiki-memory")
    assert any(u.endswith("/vault/meta/profiles/page") for u in m.profile_urls)
    # D114: fused + people views present; document + graph removed
    assert any(u.endswith("/vault/meta/views/fused") for u in m.view_urls)
    assert any(u.endswith("/vault/meta/views/people") for u in m.view_urls)
    assert not any(u.endswith("/vault/meta/views/document") for u in m.view_urls)
    assert not any(u.endswith("/vault/meta/views/graph") for u in m.view_urls)
    assert any(u.endswith("/vault/meta/views/fused-projection") for u in m.view_artifact_urls)


def test_view_hosted_documents_resolve_to_disk():
    m = parse_manifest(ROOT / "overlays" / "wiki-memory")
    for hd in m.views + m.view_artifacts:
        assert hd.document.exists(), f"missing view artifact on disk: {hd.document}"
    arts = {hd.hosted_at.rsplit("/", 1)[-1]: hd for hd in m.view_artifacts}
    assert arts["fused-projection"].content_type == "application/sparql-query"
