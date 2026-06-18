"""D111 e2e: the identifier-scheme substrate against the live Pod.

Covers: registration loop (spec §7.2), derived catalog in-band (§4.4),
typed literals through the in-band projection path (§11.4), authoring (§6.2).

The /id/ space is a top-level LDP space OUTSIDE the /vault storage root — its
fragment IRIs (…/id/schemes/#<key>) are the datatypes of identifier literals
(rename-proof). Scheme records are validated by SchemeRecordShape via
ldp:constrainedBy; thin catalog entries are server-derived by IdCatalogStore.

Pod-availability gate mirrors tests/test_admission_floor_integration.py exactly:
module-level skipif on _pod_up(); helpers go straight through httpx with the
mkcert-resolved CA. The suite SKIPS cleanly (not errors) when the Pod is down.

Run: SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem pytest tests/test_id_schemes_integration.py -v
"""
import httpx
import pytest
from rdflib import Graph, URIRef

from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
CAT = f"{POD}/id/schemes/"
SKOS = "http://www.w3.org/2004/02/skos/core#"
DCT = "http://purl.org/dc/terms/"

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")

SEED_KEYS = ("doi", "orcid", "ror", "arxiv", "citekey", "did", "did-oyd", "solid-resource")


def _get(url, **kwargs):
    return httpx.get(url, verify=_CA, **kwargs)


def _put(url, body, ct="text/turtle"):
    return httpx.put(url, content=body, headers={"Content-Type": ct}, verify=_CA)


def _patch(url, body, ct):
    return httpx.patch(url, content=body, headers={"Content-Type": ct}, verify=_CA)


def _delete(url):
    return httpx.delete(url, verify=_CA)


def test_catalog_dereferences_with_all_seed_entries():
    r = _get(CAT, headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"catalog GET {r.status_code}: {r.text[:200]}"
    for key in SEED_KEYS:
        assert f"#{key}" in r.text, f"thin entry missing: #{key}"


def test_datatype_iri_dereferences_to_catalog():
    # An agent holding "10.1/x"^^<…/id/schemes/#doi> GETs the datatype IRI; HTTP
    # strips the fragment, so the CATALOG document answers and describes #doi.
    r = _get(f"{CAT}#doi", headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"datatype IRI deref {r.status_code}: {r.text[:200]}"
    assert "prefLabel" in r.text, "catalog has no prefLabel for the datatype fragment"


def test_record_has_abstract_subject_and_providers():
    r = _get(f"{CAT}doi", headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"doi record GET {r.status_code}: {r.text[:200]}"
    t = r.text
    # the FULL abstract subject (a catalog fragment, NOT <doi#this>)
    assert f"{CAT}#doi" in t, "abstract scheme subject /id/schemes/#doi missing from record"
    # a provider urlPattern ({$id}) + the real idot v0.3 ID-regex term
    assert "{$id}" in t, "no provider urlPattern ({$id}) in the doi record"
    assert "luiPattern" in t, "no idot:luiPattern in the doi record"


def test_nonconformant_registration_422_with_report():
    # foaf:Document typed so SchemeRecordShape (sh:targetClass foaf:Document) fires;
    # missing foaf:primaryTopic -> ValidationReport. No residue (GET -> 404).
    url = f"{CAT}zz-bad"
    body = ('<> a <http://xmlns.com/foaf/0.1/Document> ; '
            '<http://purl.org/dc/terms/title> "no topic" .')
    r = _put(url, body)
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:200]}"
    assert "ValidationReport" in r.text, "422 body is not a SHACL ValidationReport"
    assert _get(url).status_code == 404, "rejected registration left residue"


def test_curl_grade_registration_loop_and_derived_entry():
    # The §7.2 registration loop, mechanically: PUT a CONFORMANT record (foaf:Document
    # frame; topic triple-typed idot:Namespace/skos:Concept/rdfs:Datatype; prefLabel +
    # definition; real idot v0.3 terms luiPattern/sampleID) -> 201/205; the derived
    # thin entry is IMMEDIATELY in the catalog (in-band). finally: DELETE -> the entry
    # is gone (end state clean).
    url = f"{CAT}zz-e2e"
    body = (
        '@prefix foaf: <http://xmlns.com/foaf/0.1/> . '
        '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .\n'
        '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> . '
        '@prefix idot: <http://identifiers.org/idot/> .\n'
        '@prefix dct: <http://purl.org/dc/terms/> .\n'
        '@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .\n'
        # mem:rationale: SP2 §6 write contract — conformant writes carry write-context
        f'<> a foaf:Document ; dct:title "e2e scheme" ;\n'
        '  mem:rationale "Test write: D111 registration-loop e2e (test_id_schemes_integration)." ;\n'
        f'  foaf:primaryTopic <{CAT}#zz-e2e> .\n'
        f'<{CAT}#zz-e2e> a idot:Namespace, skos:Concept, rdfs:Datatype ;\n'
        '  skos:prefLabel "ZZ"@en ; skos:definition "e2e scheme record"@en ;\n'
        '  idot:luiPattern "^Z\\\\d+$" ; idot:sampleID "Z1" .\n'
    )
    try:
        r = _put(url, body)
        assert r.status_code in (201, 205), f"conformant register {r.status_code}: {r.text[:200]}"
        cat = _get(CAT, headers={"Accept": "text/turtle"})
        assert cat.status_code == 200
        assert "#zz-e2e" in cat.text, "derived entry not in catalog in-band"
    finally:
        _delete(url)
    after = _get(CAT, headers={"Accept": "text/turtle"})
    assert "#zz-e2e" not in after.text, "derived entry survived record DELETE"


def test_patch_touching_derived_entry_rejected():
    # IdCatalogStore guards the server-derived triples: a client PATCH inserting a
    # triple ABOUT a catalog fragment is a 409 (write the record, not the index).
    patch = (
        '@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n'
        '<> a solid:InsertDeletePatch; solid:inserts { '
        f'<{CAT}#fake> a <http://example.org/T> . '
        '}.'
    )
    r = _patch(f"{CAT}.meta", patch, "text/n3")
    assert r.status_code == 409, f"expected 409 on derived-subject PATCH, got {r.status_code}: {r.text[:200]}"


def test_body_span_typed_literal_survives_inband_projection():
    # Spec §11.4 — the full RQ-Grammar-1 grammar + D108 floor + typed-datatype path
    # together. The concepts floor REQUIRES an agent-authored prefLabel, so the body
    # carries [..]{.prefLabel}; the body span [..]{.identifier^^ids:doi} AND the
    # frontmatter compact-id (identifier: doi:..) both materialize a dct:identifier
    # literal on <#this> carrying the catalog-fragment datatype.
    url = f"{POD}/vault/wiki/concepts/d111-span-probe.md"
    md = (
        "---\n"
        "type: source\n"
        "title: D111 span probe\n"
        "created: 2026-06-05T00:00:00Z\n"
        "identifier: doi:10.1234/seed\n"
        "rationale: \"D111 span-axis projection test\"\n"
        "---\n"
        "# D111 span probe\n\n"
        "[D111 span probe]{.prefLabel}\n\n"
        "[10.5555/span-axis]{.identifier^^ids:doi}\n"
    )
    try:
        r = _put(url, md, ct="text/markdown")
        assert r.status_code in (201, 205), f"span-probe PUT {r.status_code}: {r.text[:300]}"
        m = _get(f"{url}.meta", headers={"Accept": "text/turtle"})
        assert m.status_code == 200, f".meta GET {m.status_code}: {m.text[:200]}"
        meta = m.text
        assert "id/schemes/#doi" in meta, "doi datatype IRI absent from .meta"
        assert "10.1234/seed" in meta, "frontmatter compact-id literal absent from .meta"
        assert "10.5555/span-axis" in meta, "body span literal absent from .meta"
        # Datatypes may serialize as relative IRIs; let rdflib resolve them and
        # assert BOTH dct:identifier literals carry the catalog-fragment datatype.
        g = Graph()
        g.parse(data=meta, format="turtle", publicID=url)
        dt = URIRef(f"{POD}/id/schemes/#doi")
        id_lits = list(g.objects(None, URIRef(DCT + "identifier")))
        lex = {str(o): getattr(o, "datatype", None) for o in id_lits}
        assert "10.1234/seed" in lex, f"frontmatter id not a dct:identifier object: {lex}"
        assert "10.5555/span-axis" in lex, f"span id not a dct:identifier object: {lex}"
        assert lex["10.1234/seed"] == dt, (
            f"frontmatter dct:identifier datatype is {lex['10.1234/seed']}, expected {dt}")
        assert lex["10.5555/span-axis"] == dt, (
            f"span dct:identifier datatype is {lex['10.5555/span-axis']}, expected {dt}")
    finally:
        _delete(url)
        _delete(f"{url}.meta")
    # Post-DELETE the resource is gone: 410 (Memento tombstone, settles to 404) or
    # 404. NOT a live 2xx — that would be residue. (Distinct from the floor's
    # rejected-write 404: those never committed, so no tombstone.)
    assert _get(url).status_code in (404, 410), "span probe left live residue"


def test_bootstrap_memory_page_served():
    # The seeded how-identifiers-work memory IS the Pod's memory about its own PID
    # system. It must serve (200), dog-food the compact-id convention (frontmatter
    # `identifier: citekey:..` projects a dct:identifier literal carrying the
    # …/id/schemes/#citekey datatype on <#this>) AND author a prefLabel inline, and
    # the entry-point storage-description agentInstruction must point at /id/schemes/.
    page = f"{POD}/vault/wiki/concepts/how-identifiers-work.md"
    r = _get(page)
    assert r.status_code == 200, f"bootstrap page GET {r.status_code}: {r.text[:200]}"

    m = _get(f"{page}.meta", headers={"Accept": "text/turtle"})
    assert m.status_code == 200, f"bootstrap .meta GET {m.status_code}: {m.text[:200]}"
    g = Graph()
    g.parse(data=m.text, format="turtle", publicID=page)
    citekey_dt = URIRef(f"{POD}/id/schemes/#citekey")
    id_lits = list(g.objects(None, URIRef(DCT + "identifier")))
    typed = {str(o): getattr(o, "datatype", None) for o in id_lits}
    assert "how-identifiers-2026" in typed, f"compact-id not a dct:identifier object: {typed}"
    assert typed["how-identifiers-2026"] == citekey_dt, (
        f"dct:identifier datatype is {typed['how-identifiers-2026']}, expected {citekey_dt}")
    pref = list(g.objects(None, URIRef(SKOS + "prefLabel")))
    assert pref, "bootstrap concept carries no skos:prefLabel"

    sd = _get(f"{POD}/vault/.well-known/solid", headers={"Accept": "text/turtle"})
    assert sd.status_code == 200, f"storage description GET {sd.status_code}: {sd.text[:200]}"
    assert "/id/schemes/" in sd.text, "agentInstruction does not mention the scheme catalog"
