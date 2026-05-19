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
