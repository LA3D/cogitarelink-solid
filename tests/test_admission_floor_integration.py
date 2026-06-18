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

from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA  = _resolve_ca() or False
POD  = _pod_base()
SKOS = "http://www.w3.org/2004/02/skos/core#"
STAMP = f"{_pod_base()}/vault/ontology/substrate#bodyHash"

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def _get(path, **kwargs):
    return httpx.get(f"{POD}{path}", verify=_CA, **kwargs)


def _put(path, body, ct="text/markdown"):
    return httpx.put(f"{POD}{path}", content=body, headers={"Content-Type": ct}, verify=_CA)


def _patch(path, body, ct):
    return httpx.patch(f"{POD}{path}", content=body, headers={"Content-Type": ct}, verify=_CA)


def _delete(path):
    return httpx.delete(f"{POD}{path}", verify=_CA)


def test_preflabel_less_concept_rejected_422_with_report():
    body = "---\ntype: Concept\n---\n# NoLabel\n\nbody only, no prefLabel span\n"
    r = _put("/vault/wiki/concepts/e2e-floor-nolabel.md", body)
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:200]}"
    assert "ValidationReport" in r.text and "prefLabel" in r.text


def test_rejected_write_leaves_no_artifacts():
    body = "---\ntype: Concept\n---\n# NoLabel2\n\nno prefLabel\n"
    _put("/vault/wiki/concepts/e2e-floor-nolabel2.md", body)
    assert _get("/vault/wiki/concepts/e2e-floor-nolabel2.md").status_code == 404
    assert _get("/vault/wiki/concepts/e2e-floor-nolabel2.md.meta").status_code == 404


def test_valid_concept_commits_with_synchronous_stamped_meta():
    body = ("---\ntype: Concept\nrationale: \"e2e floor admission test\"\n---\n# E2E Floor Valid\n\n"
            "[E2E Floor Valid]{.prefLabel} is a test concept.\n\n[[Biology]]{.broader}\n")
    r = _put("/vault/wiki/concepts/e2e-floor-valid.md", body)
    assert r.status_code in (201, 205)
    # synchronous: read .meta immediately, NO polling
    m = _get("/vault/wiki/concepts/e2e-floor-valid.md.meta", headers={"Accept": "text/turtle"})
    assert m.status_code == 200
    g = Graph()
    g.parse(data=m.text, format="turtle", publicID=f"{POD}/vault/wiki/concepts/e2e-floor-valid.md")
    assert (None, URIRef(SKOS + "prefLabel"), None) in g, "prefLabel not materialized synchronously"
    assert (None, URIRef(STAMP), None) in g, "bodyHash stamp missing"


def test_working_container_is_permissive():
    body = "---\ntype: Concept\n---\n# E2E Draft\n\nno prefLabel — drafts allowed here (D73)\n"
    r = _put("/vault/wiki/working/e2e-floor-draft.md", body)
    assert r.status_code in (201, 205), f"working/ must accept incomplete drafts, got {r.status_code}"


def test_direct_meta_patch_dropping_preflabel_rejected():
    body = "---\ntype: Concept\nrationale: \"e2e floor patch test\"\n---\n# E2E Patch Target\n\n[E2E Patch Target]{.prefLabel} here.\n"
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
    r2 = _patch("/vault/wiki/concepts/e2e-floor-patch.md.meta", patch, "text/n3")
    assert r2.status_code == 422, (
        f"D108-Floor-Bug-1: dropping prefLabel via .meta PATCH must be floored (expected 422), "
        f"got {r2.status_code}: {r2.text[:200]}"
    )


def test_direct_meta_patch_agent_enrichment_accepted():
    body = "---\ntype: Concept\nrationale: \"e2e floor enrich test\"\n---\n# E2E Enrich Target\n\n[E2E Enrich Target]{.prefLabel} here.\n"
    r = _put("/vault/wiki/concepts/e2e-floor-enrich.md", body)
    assert r.status_code in (201, 205)
    patch = (
        '@prefix solid: <http://www.w3.org/ns/solid/terms#> .\n'
        '<> a solid:InsertDeletePatch ;\n'
        '   solid:inserts { '
        f'<{POD}/vault/wiki/concepts/e2e-floor-enrich.md#this> <http://example.org/agentOwned> "anything" . '
        '} .'
    )
    r2 = _patch("/vault/wiki/concepts/e2e-floor-enrich.md.meta", patch, "text/n3")
    assert r2.status_code in (200, 204, 205), (
        f"agent-owned enrichment must pass (sh:closed false), got {r2.status_code}: {r2.text[:200]}"
    )


def test_rdf_body_contacts_path_unchanged():
    r = _get("/vault/contacts/", headers={"Accept": "text/turtle"})
    assert r.status_code in (200, 404)   # smoke: floor didn't break the RDF-body substrate


# --- C-T2b: SourceShape fires live via merged-shape class dispatch ---------
# concepts/ now declares TWO ldp:constrainedBy docs (concept + source). The floor
# MERGES them, so a wiki:Source node is gated by SourceShape (dct:identifier minCount
# 1) + the inherited ConceptShape (skos:prefLabel) — both via sh:targetClass dispatch
# within the merged store. Pre-C-T2b the floor fetched only the primary (concept) shape,
# so SourceShape never fired and a no-identifier Source got 201.

DCT = "http://purl.org/dc/terms/"


def test_source_without_identifier_rejected_422():
    # type: wiki:Source (CURIE) -> <#this> a wiki:Source (frontmatter type wins over the
    # concepts/ container's skos:Concept). Has a prefLabel (so ConceptShape passes) but NO
    # citekey/identifier -> SourceShape's dct:identifier minCount 1 fires in the MERGED
    # {concept,source} shape store -> 422. (Pre-C-T2b the floor fetched only the concept
    # shape, so SourceShape never fired and this got 201.)
    body = ("---\ntype: wiki:Source\n---\n# E2E Source NoId\n\n"
            "[E2E Source NoId]{.prefLabel} is a paper without an identifier.\n")
    r = _put("/vault/wiki/concepts/e2e-floor-source-noid.md", body)
    assert r.status_code == 422, (
        f"C-T2b: a wiki:Source missing dct:identifier must be floored by SourceShape "
        f"(expected 422), got {r.status_code}: {r.text[:200]}"
    )
    assert "ValidationReport" in r.text and "identifier" in r.text
    # all-or-nothing: nothing committed
    assert _get("/vault/wiki/concepts/e2e-floor-source-noid.md").status_code == 404


def test_source_with_citekey_commits_with_identifier_materialized():
    # citekey -> dct:identifier; prefLabel from the body literal axis -> conforms to BOTH
    # SourceShape (identifier) and ConceptShape (prefLabel) in the merged store.
    body = ("---\ntype: wiki:Source\ncitekey: vardeman-2026-ct2b\nrationale: \"e2e source ok test\"\n---\n# E2E Source Ok\n\n"
            "[E2E Source Ok]{.prefLabel} is a properly-identified paper.\n")
    r = _put("/vault/wiki/concepts/e2e-floor-source-ok.md", body)
    assert r.status_code in (201, 205), (
        f"a wiki:Source with citekey + prefLabel must be admitted, got {r.status_code}: {r.text[:200]}"
    )
    m = _get("/vault/wiki/concepts/e2e-floor-source-ok.md.meta", headers={"Accept": "text/turtle"})
    assert m.status_code == 200
    g = Graph()
    g.parse(data=m.text, format="turtle",
            publicID=f"{POD}/vault/wiki/concepts/e2e-floor-source-ok.md")
    assert (None, URIRef(DCT + "identifier"), None) in g, "dct:identifier not materialized on the Source"


RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
WIKI_SOURCE = f"{_pod_base()}/vault/ontology/wiki#Source"


def test_shortform_source_with_citekey_commits_as_wiki_source():
    # C-T2c: SHORT-FORM `type: source` (not the wiki:Source CURIE) must resolve
    # <#this> a wiki:Source so SourceShape fires. citekey -> dct:identifier; prefLabel
    # from the body. Conforms to BOTH SourceShape (identifier) and ConceptShape (prefLabel)
    # in the merged {concept,source} store -> 201, with <#this> typed wiki:Source.
    body = ("---\ntype: source\ncitekey: vardeman-2026-ct2c\nrationale: \"e2e shortform source test\"\n---\n# E2E Shortform Source\n\n"
            "[E2E Shortform Source]{.prefLabel} is a properly-identified paper.\n")
    r = _put("/vault/wiki/concepts/e2e-floor-shortform-source.md", body)
    assert r.status_code in (201, 205), (
        f"C-T2c: short-form `type: source` with citekey + prefLabel must be admitted, "
        f"got {r.status_code}: {r.text[:200]}"
    )
    m = _get("/vault/wiki/concepts/e2e-floor-shortform-source.md.meta",
             headers={"Accept": "text/turtle"})
    assert m.status_code == 200
    g = Graph()
    g.parse(data=m.text, format="turtle",
            publicID=f"{POD}/vault/wiki/concepts/e2e-floor-shortform-source.md")
    this = URIRef(f"{POD}/vault/wiki/concepts/e2e-floor-shortform-source.md#this")
    assert (this, URIRef(RDF_TYPE), URIRef(WIKI_SOURCE)) in g, (
        "C-T2c: short-form `type: source` did not type <#this> a wiki:Source "
        f"(SourceShape would not fire):\n{m.text}"
    )
    assert (None, URIRef(DCT + "identifier"), None) in g, "dct:identifier not materialized on the Source"


def test_shortform_source_without_identifier_rejected_422():
    # C-T2c: same short-form path, but no citekey/identifier -> SourceShape's
    # dct:identifier minCount 1 fires -> 422. Proves the short-form token reaches
    # the Source class dispatch (pre-C-T2c it fell back to skos:Concept and got 201).
    body = ("---\ntype: source\n---\n# E2E Shortform Source NoId\n\n"
            "[E2E Shortform Source NoId]{.prefLabel} is a paper without an identifier.\n")
    r = _put("/vault/wiki/concepts/e2e-floor-shortform-source-noid.md", body)
    assert r.status_code == 422, (
        f"C-T2c: short-form `type: source` missing dct:identifier must be floored by SourceShape "
        f"(expected 422), got {r.status_code}: {r.text[:200]}"
    )
    assert "ValidationReport" in r.text and "identifier" in r.text
    assert _get("/vault/wiki/concepts/e2e-floor-shortform-source-noid.md").status_code == 404


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    for c, names in (("concepts", ["e2e-floor-nolabel", "e2e-floor-nolabel2", "e2e-floor-valid",
                                    "e2e-floor-patch", "e2e-floor-enrich",
                                    "e2e-floor-source-noid", "e2e-floor-source-ok",
                                    "e2e-floor-shortform-source", "e2e-floor-shortform-source-noid"]),
                     ("working", ["e2e-floor-draft"])):
        for n in names:
            _delete(f"/vault/wiki/{c}/{n}.md")
            _delete(f"/vault/wiki/{c}/{n}.md.meta")
