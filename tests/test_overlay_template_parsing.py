"""Tests for overlay manifest parsing: providesCapability and installsTemplate."""
import pytest
from pathlib import Path

# ---------------------------------------------------------------------------
# F4: malformed installsShape blank node (document present, hostedAt absent)
# ---------------------------------------------------------------------------

_OVERLAY_PREFIX = "@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> ."

def _manifest_with_malformed_shape(tmp_path):
    """Blank node carries overlay:document but no overlay:hostedAt — manifest defect."""
    text = f"""
{_OVERLAY_PREFIX}
<https://pod.vardeman.me/vault/ontology/overlay#test-overlay>
    a overlay:Overlay ;
    overlay:name "test" ;
    overlay:version "0.1" ;
    overlay:installsShape
        [ overlay:document "shapes/bad-shape.ttl" ] .
"""
    (tmp_path / "manifest.ttl").write_text(text)
    (tmp_path / "shapes").mkdir()
    (tmp_path / "shapes" / "bad-shape.ttl").write_text("# bad shape")
    return tmp_path


def test_installs_shape_missing_hosted_at_raises_value_error(tmp_path):
    _manifest_with_malformed_shape(tmp_path)
    from scripts.overlay.common import parse_manifest
    with pytest.raises(ValueError) as exc_info:
        parse_manifest(tmp_path, pod_url="https://pod.vardeman.me/vault/")
    msg = str(exc_info.value)
    assert "bad-shape.ttl" in msg, f"expected document name in error: {msg}"


def test_installs_shape_well_formed_blank_node_parses(tmp_path):
    """A blank node WITH hostedAt must still parse (regression guard for the fix)."""
    text = f"""
{_OVERLAY_PREFIX}
<https://pod.vardeman.me/vault/ontology/overlay#test-overlay>
    a overlay:Overlay ;
    overlay:name "test" ;
    overlay:version "0.1" ;
    overlay:installsShape
        [ overlay:document "shapes/good.ttl" ;
          overlay:hostedAt "/vault/meta/shapes/good.ttl" ] .
"""
    (tmp_path / "manifest.ttl").write_text(text)
    (tmp_path / "shapes").mkdir()
    (tmp_path / "shapes" / "good.ttl").write_text("# good shape")
    from scripts.overlay.common import parse_manifest
    m = parse_manifest(tmp_path, pod_url="https://pod.vardeman.me/vault/")
    assert len(m.shape_urls) == 1


def test_manifest_parses_provides_capability(tmp_path):
    manifest_text = """
@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> .
@prefix cap:     <https://pod.vardeman.me/vault/ontology/capability#> .

<https://pod.vardeman.me/vault/ontology/overlay#test-overlay>
    a overlay:Overlay ;
    overlay:name "test" ;
    overlay:version "0.1" ;
    overlay:providesCapability
        [ cap:capability <https://pod.vardeman.me/vault/meta/capabilities/foo.ttl> ;
          cap:version "1.0" ;
          cap:descriptor "capabilities/foo.ttl" ] .
"""
    (tmp_path / "manifest.ttl").write_text(manifest_text)
    (tmp_path / "capabilities").mkdir()
    (tmp_path / "capabilities" / "foo.ttl").write_text("# foo capability descriptor")

    from scripts.overlay.common import parse_manifest
    m = parse_manifest(tmp_path, pod_url="https://pod.vardeman.me/vault/")
    assert len(m.provides) == 1
    assert m.provides[0].url == "https://pod.vardeman.me/vault/meta/capabilities/foo.ttl"
    assert "foo capability descriptor" in m.provides[0].document


def test_manifest_parses_installs_template(tmp_path):
    manifest_text = """
@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> .
@prefix dct:     <http://purl.org/dc/terms/> .

<https://pod.vardeman.me/vault/ontology/overlay#test-overlay>
    a overlay:Overlay ;
    overlay:name "test" ;
    overlay:version "0.1" ;
    overlay:installsTemplate
        <https://pod.vardeman.me/vault/meta/templates/foo.ttl> ,
        <https://pod.vardeman.me/vault/meta/templates/bar.ttl> .
"""
    (tmp_path / "manifest.ttl").write_text(manifest_text)
    (tmp_path / "templates").mkdir()
    (tmp_path / "templates" / "foo.ttl").write_text("# foo")
    (tmp_path / "templates" / "bar.ttl").write_text("# bar")

    from scripts.overlay.common import parse_manifest
    m = parse_manifest(tmp_path, pod_url="https://pod.vardeman.me/vault/")
    assert len(m.templates) == 2
    urls = {t.url for t in m.templates}
    assert "https://pod.vardeman.me/vault/meta/templates/foo.ttl" in urls
    assert "https://pod.vardeman.me/vault/meta/templates/bar.ttl" in urls


def test_addressbook_manifest_parses_with_all_artifacts():
    from pathlib import Path
    from scripts.overlay.common import parse_manifest
    m = parse_manifest(
        Path(__file__).parent.parent / "overlays" / "addressbook",
        pod_url="https://pod.vardeman.me/vault/"
    )
    assert m.name == "addressbook"
    assert len(m.shape_urls) == 4
    assert len(m.templates) == 5
    assert len(m.affordance_urls) == 8
    assert len(m.container_paths) == 5
    assert len(m.provides) == 5
    # required_capabilities should have 3 entries (wiki-vocabulary, foaf-primarytopic-bridge, wiki-type-index-registration)
    assert len(m.required_capabilities) == 3
    # Organization / Group / Membership are constrained post-creation (block 11).
    # Person/ is constrained AT creation via containers/contacts/Person/.meta
    # (block 8) so the marie-curie bridge contact can be bootstrapped into it —
    # a block-11 re-constraint of the now-non-empty container would H400.
    assert len(m.container_meta_patches) == 3
    person_meta = Path(__file__).parent.parent / "overlays" / "addressbook" / \
        "containers" / "contacts" / "Person" / ".meta"
    assert person_meta.exists() and "constrainedBy" in person_meta.read_text()
