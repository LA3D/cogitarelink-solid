"""D111: overlay:registersScheme — overlays declare which /id/schemes/ records they need."""
from pathlib import Path
from scripts.overlay.common import parse_manifest

ROOT = Path(__file__).parent.parent


def test_wiki_memory_registers_three_schemes():
    m = parse_manifest(ROOT / "overlays" / "wiki-memory")
    assert set(map(str, m.registers_schemes)) == {
        "https://pod.vardeman.me/id/schemes/doi",
        "https://pod.vardeman.me/id/schemes/citekey",
        "https://pod.vardeman.me/id/schemes/orcid",
    }


def test_addressbook_registers_two_schemes():
    m = parse_manifest(ROOT / "overlays" / "addressbook")
    assert set(map(str, m.registers_schemes)) == {
        "https://pod.vardeman.me/id/schemes/orcid",
        "https://pod.vardeman.me/id/schemes/did",
    }


def test_overlay_without_registration_has_empty_tuple():
    m = parse_manifest(ROOT / "overlays" / "owner-identity")
    assert m.registers_schemes == ()
