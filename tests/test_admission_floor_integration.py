"""E2E: the D108 Front-2 in-band admission floor (AdmissionFloorStore), live Pod.

The floor: projects markdown → .meta graph in-band, validates against the
container's ldp:constrainedBy shape pre-commit, 422s non-conforming writes
(text/turtle sh:ValidationReport), commits + synchronously materializes stamped
.meta for conforming ones. Direct .meta PATCHes are floored too (path-agnostic)
— with the exception noted in test_direct_meta_patch_dropping_preflabel_rejected.

Run: SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem pytest tests/test_admission_floor_integration.py -v
"""
import os
import httpx
import pytest
from rdflib import Graph, URIRef

POD = os.environ.get("POD_URL", "https://pod.vardeman.me")
SKOS = "http://www.w3.org/2004/02/skos/core#"
STAMP = "https://pod.vardeman.me/vault/ontology/substrate#bodyHash"


def _pod_up():
    try:
        return httpx.get(f"{POD}/vault/", timeout=3).status_code < 500
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def _put(path, body, ct="text/markdown"):
    return httpx.put(f"{POD}{path}", content=body, headers={"Content-Type": ct})


def test_preflabel_less_concept_rejected_422_with_report():
    body = "---\ntype: Concept\n---\n# NoLabel\n\nbody only, no prefLabel span\n"
    r = _put("/vault/wiki/concepts/e2e-floor-nolabel.md", body)
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:200]}"
    assert "ValidationReport" in r.text and "prefLabel" in r.text


def test_rejected_write_leaves_no_artifacts():
    body = "---\ntype: Concept\n---\n# NoLabel2\n\nno prefLabel\n"
    _put("/vault/wiki/concepts/e2e-floor-nolabel2.md", body)
    assert httpx.get(f"{POD}/vault/wiki/concepts/e2e-floor-nolabel2.md").status_code == 404
    assert httpx.get(f"{POD}/vault/wiki/concepts/e2e-floor-nolabel2.md.meta").status_code == 404


def test_valid_concept_commits_with_synchronous_stamped_meta():
    body = ("---\ntype: Concept\n---\n# E2E Floor Valid\n\n"
            "[E2E Floor Valid]{.prefLabel} is a test concept.\n\n[[Biology]]{.broader}\n")
    r = _put("/vault/wiki/concepts/e2e-floor-valid.md", body)
    assert r.status_code in (201, 205)
    # synchronous: read .meta immediately, NO polling
    m = httpx.get(f"{POD}/vault/wiki/concepts/e2e-floor-valid.md.meta", headers={"Accept": "text/turtle"})
    assert m.status_code == 200
    g = Graph()
    g.parse(data=m.text, format="turtle", publicID=f"{POD}/vault/wiki/concepts/e2e-floor-valid.md")
    assert (None, URIRef(SKOS + "prefLabel"), None) in g, "prefLabel not materialized synchronously"
    assert (None, URIRef(STAMP), None) in g, "bodyHash stamp missing"


def test_working_container_is_permissive():
    body = "---\ntype: Concept\n---\n# E2E Draft\n\nno prefLabel — drafts allowed here (D73)\n"
    r = _put("/vault/wiki/working/e2e-floor-draft.md", body)
    assert r.status_code in (201, 205), f"working/ must accept incomplete drafts, got {r.status_code}"


@pytest.mark.xfail(
    strict=True,
    reason=(
        "D108-Floor-Bug-1: the .meta PATCH path bypasses floor validation. "
        "PatchingStore.modifyResource falls through to the N3Patcher which reads "
        "the current .meta as internal/quads, applies the patch, and calls "
        "AdmissionFloorStore.setRepresentation with content-type 'internal/quads'. "
        "isRdfRepresentation() returns False for that type, so the floor exits the "
        "auxiliary-branch early and passes through. Fix: include 'internal/quads' in "
        "isRdfRepresentation() OR treat missing/internal content-types as RDF for "
        "auxiliary identifiers (a .meta write is always a quads write by definition). "
        "The agent-enrichment PATCH (adds triples without dropping governed ones) "
        "coincidentally passes because the resulting graph still has prefLabel; "
        "this bug surface only when governed triples are deleted. "
        "Tracked as D108-Floor-Bug-1; must be fixed before RQ-View-2 full re-eval."
    ),
)
def test_direct_meta_patch_dropping_preflabel_rejected():
    body = "---\ntype: Concept\n---\n# E2E Patch Target\n\n[E2E Patch Target]{.prefLabel} here.\n"
    r = _put("/vault/wiki/concepts/e2e-floor-patch.md", body)
    assert r.status_code in (201, 205)
    patch = (
        '@prefix solid: <http://www.w3.org/ns/solid/terms#> .\n'
        '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .\n'
        '<> a solid:InsertDeletePatch ;\n'
        '   solid:deletes { '
        f'<{POD}/vault/wiki/concepts/e2e-floor-patch.md#this> skos:prefLabel "E2E Patch Target" . '
        '} .'
    )
    r2 = httpx.patch(f"{POD}/vault/wiki/concepts/e2e-floor-patch.md.meta", content=patch,
                     headers={"Content-Type": "text/n3"})
    assert r2.status_code == 422, (
        f"D108-Floor-Bug-1: dropping prefLabel via .meta PATCH must be floored (expected 422), "
        f"got {r2.status_code}: {r2.text[:200]}"
    )


def test_direct_meta_patch_agent_enrichment_accepted():
    body = "---\ntype: Concept\n---\n# E2E Enrich Target\n\n[E2E Enrich Target]{.prefLabel} here.\n"
    r = _put("/vault/wiki/concepts/e2e-floor-enrich.md", body)
    assert r.status_code in (201, 205)
    patch = (
        '@prefix solid: <http://www.w3.org/ns/solid/terms#> .\n'
        '<> a solid:InsertDeletePatch ;\n'
        '   solid:inserts { '
        f'<{POD}/vault/wiki/concepts/e2e-floor-enrich.md#this> <http://example.org/agentOwned> "anything" . '
        '} .'
    )
    r2 = httpx.patch(f"{POD}/vault/wiki/concepts/e2e-floor-enrich.md.meta", content=patch,
                     headers={"Content-Type": "text/n3"})
    assert r2.status_code in (200, 204, 205), (
        f"agent-owned enrichment must pass (sh:closed false), got {r2.status_code}: {r2.text[:200]}"
    )


def test_rdf_body_contacts_path_unchanged():
    r = httpx.get(f"{POD}/vault/contacts/", headers={"Accept": "text/turtle"})
    assert r.status_code in (200, 404)   # smoke: floor didn't break the RDF-body substrate


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    for c, names in (("concepts", ["e2e-floor-nolabel", "e2e-floor-nolabel2", "e2e-floor-valid",
                                    "e2e-floor-patch", "e2e-floor-enrich"]),
                     ("working", ["e2e-floor-draft"])):
        for n in names:
            httpx.delete(f"{POD}/vault/wiki/{c}/{n}.md")
            httpx.delete(f"{POD}/vault/wiki/{c}/{n}.md.meta")
