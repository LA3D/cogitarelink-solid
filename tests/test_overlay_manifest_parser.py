"""Manifest parser handles installsHintMapping and installsExtensionGuide (D98, D100)."""
from pathlib import Path
import pytest
from scripts.overlay.common import parse_manifest


def test_parser_recognizes_hint_mapping(tmp_path):
    manifest_ttl = """
@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> .
@prefix dct: <http://purl.org/dc/terms/> .

<https://pod.vardeman.me/vault/ontology/overlay#test>
    a overlay:Overlay ;
    overlay:name "test" ;
    overlay:version "0.1" ;
    overlay:installsHintMapping [
        overlay:classHint "affiliation" ;
        overlay:projectsToPredicate <https://schema.org/affiliation> ;
        overlay:projectsToSubject "THING"
    ] .
"""
    f = tmp_path / "manifest.ttl"
    f.write_text(manifest_ttl)
    m = parse_manifest(tmp_path, pod_url="https://pod.vardeman.me/vault/")
    assert len(m.hint_mappings) == 1
    assert m.hint_mappings[0].class_hint == "affiliation"
    assert m.hint_mappings[0].predicate == "https://schema.org/affiliation"
    assert m.hint_mappings[0].subject == "THING"


def test_parser_recognizes_extension_guide(tmp_path):
    manifest_ttl = """
@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> .

<https://pod.vardeman.me/vault/ontology/overlay#test>
    a overlay:Overlay ;
    overlay:name "test" ;
    overlay:version "0.1" ;
    overlay:installsExtensionGuide [
        overlay:document "extending-l3.md" ;
        overlay:hostedAt "/vault/meta/extending-l3.md"
    ] .
"""
    f = tmp_path / "manifest.ttl"
    f.write_text(manifest_ttl)
    m = parse_manifest(tmp_path, pod_url="https://pod.vardeman.me/vault/")
    assert len(m.extension_guides) == 1
    assert m.extension_guides[0].document == "extending-l3.md"
    assert m.extension_guides[0].hosted_at == "/vault/meta/extending-l3.md"


def test_parser_returns_empty_lists_when_predicates_absent(tmp_path):
    manifest_ttl = """
@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> .

<https://pod.vardeman.me/vault/ontology/overlay#test>
    a overlay:Overlay ;
    overlay:name "test" ;
    overlay:version "0.1" .
"""
    f = tmp_path / "manifest.ttl"
    f.write_text(manifest_ttl)
    m = parse_manifest(tmp_path, pod_url="https://pod.vardeman.me/vault/")
    assert m.hint_mappings == []
    assert m.extension_guides == []


def test_wiki_memory_manifest_parses_extension_guide():
    """The real wiki-memory manifest now declares installsExtensionGuide."""
    from pathlib import Path
    m = parse_manifest(
        Path(__file__).parent.parent / "overlays" / "wiki-memory",
        pod_url="https://pod.vardeman.me/vault/",
    )
    assert len(m.extension_guides) == 1
    assert m.extension_guides[0].document == "extending-l3.md"
    assert m.extension_guides[0].hosted_at == "/vault/meta/extending-l3.md"


def test_identifier_schemes_out_of_root_container_meta_placement():
    """D111: /id/schemes/ lives OUTSIDE the /vault storage root, so apply.py
    block 8 resolves its container .meta via the URL path (id/schemes/.meta),
    not by stripping pod_url. This guards both the manifest's out-of-root
    container declaration and the on-disk .meta placement block 8 depends on
    to apply ldp:constrainedBy AT CREATION (the empty-container ordering
    constraint — CSS H400s a re-constrain of a non-empty container)."""
    from pathlib import Path
    from urllib.parse import urlsplit
    root = Path(__file__).parent.parent
    pod_url = "https://pod.vardeman.me/vault/"
    m = parse_manifest(root / "overlays" / "identifier-schemes", pod_url=pod_url)
    container_url = "https://pod.vardeman.me/id/schemes/"
    assert container_url in m.container_paths
    assert not container_url.startswith(pod_url)  # out-of-root: the fallback branch
    rel = urlsplit(container_url).path.lstrip("/").rstrip("/") + "/.meta"
    assert rel == "id/schemes/.meta"
    meta_local = root / "overlays" / "identifier-schemes" / "containers" / rel
    assert meta_local.exists()
    body = meta_local.read_text()
    assert "ldp:constrainedBy" in body
    assert "/id/scheme-record.shacl.ttl" in body
