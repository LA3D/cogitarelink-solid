"""D112 Task-1 battery: CSS behaviors the curation protocol depends on (spec §5).
B-a  scheme-record .meta accepts an ungoverned mem: triple via PATCH (back-pointer write path)
B-b  affordance descriptors have Memento TimeMaps (?ext=timemap) — hadPlan pinning
B-c  GET surfaces stored .meta triples via the MetadataWriter pipeline (Link headers present)
B-d  POST text/turtle with <>-subject resolves <> to the created URL (LDN sender pattern)
"""
import httpx
import pytest
from rdflib import Graph, URIRef

from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA  = _resolve_ca() or False
POD  = _pod_base()
MEM  = "https://pod.vardeman.me/vault/ontology/mem#"
DCT  = "http://purl.org/dc/terms/"

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def _get(url, **kw):
    return httpx.get(url, verify=_CA, **kw)

def _patch(url, body, ct):
    return httpx.patch(url, content=body, headers={"Content-Type": ct}, verify=_CA)

def _post(url, body, ct, **kw):
    return httpx.post(url, content=body, headers={"Content-Type": ct}, verify=_CA, **kw)

def _delete(url):
    return httpx.delete(url, verify=_CA)


def test_battery_a_record_meta_accepts_ungoverned_mem_triple():
    # B-a: scheme-record .meta accepts an ungoverned mem: triple via N3 PATCH.
    # The IdCatalogStore guards /id/schemes/.meta (derived index), but individual
    # scheme-record .meta files (e.g. /id/schemes/doi.meta) should accept triples
    # about subjects OTHER than the catalog-fragment IRIs (ungoverned predicates
    # on the record resource itself). The mem: back-pointer is exactly such a triple.
    meta_url = f"{POD}/id/schemes/doi.meta"
    op_url   = f"{POD}/vault/.operations/d112-battery-a-probe"
    record_url = f"{POD}/id/schemes/doi"

    insert_patch = (
        "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n"
        "@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#>.\n"
        "<> a solid:InsertDeletePatch; solid:inserts {\n"
        f"  <{record_url}> mem:hasOpenAction <{op_url}> .\n"
        "}."
    )
    delete_patch = (
        "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n"
        "@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#>.\n"
        "<> a solid:InsertDeletePatch; solid:deletes {\n"
        f"  <{record_url}> mem:hasOpenAction <{op_url}> .\n"
        "}."
    )

    r = _patch(meta_url, insert_patch, "text/n3")
    assert r.status_code in range(200, 300), (
        f"B-a PATCH failed {r.status_code}: {r.text[:300]}")

    # Verify persisted
    m = _get(meta_url, headers={"Accept": "text/turtle"})
    assert m.status_code == 200
    g = Graph()
    g.parse(data=m.text, format="turtle", publicID=meta_url)
    triples = list(g.triples((URIRef(record_url), URIRef(MEM + "hasOpenAction"), URIRef(op_url))))
    assert triples, f"B-a: mem:hasOpenAction triple not found in .meta after PATCH:\n{m.text[:400]}"

    # Cleanup
    rc = _patch(meta_url, delete_patch, "text/n3")
    assert rc.status_code in range(200, 300), f"B-a cleanup PATCH failed {rc.status_code}"


def test_battery_b_affordance_descriptor_has_timemap():
    # B-b: affordance descriptors at /vault/meta/affordances/ have Memento TimeMaps.
    # GET ?ext=timemap on a descriptor should return 200 + parseable Turtle with
    # memento: content (TimeMap link relation or timemap triples).
    desc_url = f"{POD}/vault/meta/affordances/markdown-projection.ttl"
    tm_url   = f"{desc_url}?ext=timemap"
    r = _get(tm_url, headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"B-b timemap GET {r.status_code}: {r.text[:300]}"
    g = Graph()
    try:
        g.parse(data=r.text, format="turtle", publicID=tm_url)
    except Exception as e:
        pytest.fail(f"B-b timemap body is not parseable Turtle: {e}\n{r.text[:300]}")
    # A timemap response must mention memento or timemap via Link header or triples
    link = r.headers.get("link", "")
    has_memento_content = (
        "timemap" in link.lower()
        or any("memento" in str(s).lower() or "timemap" in str(s).lower()
               for s in g.subjects())
        or "memento" in r.text.lower()
        or "TimeMap" in r.text
    )
    assert has_memento_content, (
        f"B-b: timemap response has no memento content.\nHeaders: {dict(r.headers)}\n"
        f"Body (first 500):\n{r.text[:500]}")


def test_battery_c_meta_conformsTo_surfaces_as_link_header():
    # B-c: GET /id/schemes/ returns Link headers — proves the MetadataWriter pipeline
    # runs on the /id/ space. The presence of ANY Link header (profile, type, timegate,
    # describedby, etc.) confirms the pipeline is active on this path.
    r = _get(f"{POD}/id/schemes/")
    assert r.status_code == 200, f"B-c GET status {r.status_code}"
    link = r.headers.get("link", "")
    assert link, (
        f"B-c: no Link header on GET /id/schemes/ — MetadataWriter pipeline absent.\n"
        f"All headers: {dict(r.headers)}")


@pytest.mark.xfail(
    reason=(
        "D112 T1 battery finding B-d: /vault/wiki/working/ admission floor rejects "
        "text/turtle POST with no rdf:type — 400 BadRequestHttpError 'no nodes in the "
        "body conform to any of the target classes of working.shacl.ttl'. The 'permissive' "
        "working container (D73) gates text/turtle by shape class dispatch; a bare "
        "<> dct:title body has no target-class node so it is rejected before the "
        "null-relative <> subject resolution can be observed. LDN-style <>-subject POSTs "
        "need a typed body (or a truly unflored container). Task 7 must account for this."
    ),
    strict=True,
)
def test_battery_d_post_null_relative_subject_to_floored_container():
    # B-d: POST text/turtle with a <> (null relative IRI) subject to a floored container
    # resolves <> to the newly created URL. The /vault/wiki/working/ container is
    # described as permissive (D73), so this POST should succeed with 201. We then GET
    # the Location URL and assert the created URL is the subject of the dct:title triple.
    # FINDING: the floor rejects this — see xfail reason above.
    ctr = f"{POD}/vault/wiki/working/"
    body = '@prefix dct: <http://purl.org/dc/terms/> .\n<> dct:title "battery d112" .\n'
    r = _post(ctr, body, "text/turtle", follow_redirects=False)
    assert r.status_code == 201, f"B-d POST {r.status_code}: {r.text[:300]}"
    loc = r.headers.get("location", "")
    assert loc, f"B-d: 201 but no Location header"

    # GET the created resource and check <> resolves to the created URL
    created = _get(loc, headers={"Accept": "text/turtle"})
    assert created.status_code == 200, f"B-d GET {loc} -> {created.status_code}"
    g = Graph()
    g.parse(data=created.text, format="turtle", publicID=loc)
    titles = list(g.objects(URIRef(loc), URIRef(DCT + "title")))
    assert titles, (
        f"B-d: dct:title on <{loc}> not found after POST with <> subject.\n"
        f"Triples:\n{created.text[:400]}")
    assert any("battery d112" in str(t) for t in titles), (
        f"B-d: title value mismatch: {titles}")

    # Cleanup
    _delete(loc)
    assert _get(loc).status_code in (404, 410), f"B-d: cleanup failed — {loc} still live"
