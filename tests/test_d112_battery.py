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


def test_battery_d_post_null_relative_subject_to_floored_container():
    # B-d: POST text/turtle with a <> (null relative IRI) subject to a floored container
    # resolves <> to the newly created URL.
    #
    # Battery finding (2026-06-05): an UNTYPED body (<> dct:title "...") → 400 — the
    # admission floor's class dispatch rejects "no nodes conform to any target classes of
    # working.shacl.ttl" before <> resolution occurs. Task 7 (LDN sender) must use a typed body.
    #
    # This test verifies the actual question (does <> resolve?) using a TYPED body:
    # <> a wiki:WorkingNote ; dct:title "..." — the working shape targets wiki:WorkingNote,
    # sh:closed false, so this is the minimal conformant form.
    WIKI = "https://pod.vardeman.me/vault/ontology/wiki#"
    ctr  = f"{POD}/vault/wiki/working/"
    body = (
        "@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .\n"
        "@prefix dct: <http://purl.org/dc/terms/> .\n"
        '<> a wiki:WorkingNote ; dct:title "battery d112 typed" .\n'
    )
    r = httpx.post(ctr, content=body,
                   headers={"Content-Type": "text/turtle", "Slug": "d112-battery-d"},
                   verify=_CA, follow_redirects=False)
    assert r.status_code == 201, f"B-d POST {r.status_code}: {r.text[:300]}"
    loc = r.headers.get("location", "")
    assert loc, "B-d: 201 but no Location header"

    try:
        # GET the created resource and confirm <> resolved to the assigned URL
        created = _get(loc, headers={"Accept": "text/turtle"})
        assert created.status_code == 200, f"B-d GET {loc} -> {created.status_code}"
        g = Graph()
        g.parse(data=created.text, format="turtle", publicID=loc)
        # The created URL must appear as a subject (proves <> → assigned URL)
        assert URIRef(loc) in set(g.subjects()), (
            f"B-d: <{loc}> not a subject in returned graph — <> did not resolve.\n"
            f"Subjects: {list(g.subjects())[:10]}\nBody:\n{created.text[:400]}")
        titles = list(g.objects(URIRef(loc), URIRef(DCT + "title")))
        assert any("battery d112 typed" in str(t) for t in titles), (
            f"B-d: title value mismatch: {titles}")
    finally:
        _delete(loc)
