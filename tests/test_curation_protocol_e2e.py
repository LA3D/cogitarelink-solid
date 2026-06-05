"""D112 Task-9: end-to-end curation protocol — propose / derive / surface / resolve / clear.

Permanent regression suite for the full back-pointer loop:
  propose → OperationsIndexListener derives back-pointer → CurationLinkMetadataWriter
  surfaces it in Link headers → resolve (status flip) → back-pointer cleared.

Two tests:
  test_full_loop       — the complete propose→derive→surface→resolve→clear cycle live
  test_descriptor_is_plan_and_versioned — curation.ttl carries prov:Plan + has Memento timemap
"""
import time
import uuid

import httpx
import pytest
from rdflib import Graph, URIRef

from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA  = _resolve_ca() or False
POD  = _pod_base()
MEM  = f"{POD}/vault/ontology/mem#"
OPS  = f"{POD}/id/.operations/"
DESC = f"{POD}/vault/meta/affordances/curation.ttl"

# as:object must be independent of other test suite targets (which use doi/doi).
# orcid is the designated e2e target — distinct from the T5 floor tests (doi).
TARGET = f"{POD}/id/schemes/orcid"

# rel value the CurationLinkMetadataWriter uses (full IRI, not a short name)
HAS_OPEN_ACTION_REL = f"{MEM}hasOpenAction"

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _get(url, **kw):
    return httpx.get(url, verify=_CA, **kw)

def _put(url, body, ct="text/turtle"):
    return httpx.put(url, content=body, headers={"Content-Type": ct}, verify=_CA)

def _post(url, body, ct="text/turtle", **kw):
    hdrs = {"Content-Type": ct, **kw.pop("headers", {})}
    return httpx.post(url, content=body, headers=hdrs, verify=_CA, **kw)

def _delete(url):
    return httpx.delete(url, verify=_CA)


def _link_header(resp) -> str:
    """Join all Link header values into one string (httpx returns a list)."""
    return ", ".join(resp.headers.get_list("link"))


# ---------------------------------------------------------------------------
# Poll helper — mirrors _wait_for_projection idiom from l3_listener_integration
# ---------------------------------------------------------------------------

def _poll(fn, *, timeout=5.0, interval=0.25):
    """Poll fn() until it returns truthy or timeout expires; return last value."""
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        last = fn()
        if last:
            return last
        time.sleep(interval)
    return last


# ---------------------------------------------------------------------------
# Proposal body template (as:object = orcid — independent of T5 doi target)
# ---------------------------------------------------------------------------

def _proposal_body(slug: str) -> str:
    return (
        "@prefix as:     <https://www.w3.org/ns/activitystreams#> .\n"
        f"@prefix mem:    <{MEM}> .\n"
        "@prefix prov:   <http://www.w3.org/ns/prov#> .\n"
        "@prefix schema: <https://schema.org/> .\n"
        "@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .\n"
        "<> a as:Announce , mem:RealignAction , prov:Activity ;\n"
        f"    as:object <{TARGET}> ;\n"
        "    schema:actionStatus schema:PotentialActionStatus ;\n"
        "    mem:stalenessClass mem:ProviderDrift ;\n"
        f'    mem:rationale "e2e loop probe {slug}." ;\n'
        "    prov:qualifiedAssociation [ a prov:Association ;\n"
        "        prov:agent <urn:agent:pytest> ;\n"
        f"        prov:hadPlan <{DESC}> ] ;\n"
        '    as:published "2026-06-05T12:00:00Z"^^xsd:dateTime .\n'
    )


def _resolved_body(target_url: str, slug: str) -> str:
    """Same proposal body with status flipped to FailedActionStatus."""
    return (
        "@prefix as:     <https://www.w3.org/ns/activitystreams#> .\n"
        f"@prefix mem:    <{MEM}> .\n"
        "@prefix prov:   <http://www.w3.org/ns/prov#> .\n"
        "@prefix schema: <https://schema.org/> .\n"
        "@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .\n"
        "<> a as:Announce , mem:RealignAction , prov:Activity ;\n"
        f"    as:object <{target_url}> ;\n"
        "    schema:actionStatus schema:FailedActionStatus ;\n"
        "    mem:stalenessClass mem:ProviderDrift ;\n"
        f'    mem:rationale "e2e loop probe {slug} — resolved." ;\n'
        "    prov:qualifiedAssociation [ a prov:Association ;\n"
        "        prov:agent <urn:agent:pytest> ;\n"
        f"        prov:hadPlan <{DESC}> ] ;\n"
        '    as:published "2026-06-05T12:00:00Z"^^xsd:dateTime .\n'
    )


# ---------------------------------------------------------------------------
# Test 1: full propose → derive → surface → resolve → clear loop
# ---------------------------------------------------------------------------

def test_full_loop():
    slug = f"d112-t9-e2e-{uuid.uuid4().hex[:8]}"
    op_url = None

    try:
        # Step 1: POST conformant Potential proposal → 201 + Location
        r = _post(OPS, _proposal_body(slug), headers={"Slug": slug})
        assert r.status_code == 201, (
            f"step-1 POST {r.status_code}: {r.text[:400]}")
        op_url = r.headers.get("location", "")
        assert op_url, "step-1: 201 but no Location header"

        # Step 2: poll until .meta contains back-pointer
        meta_url = f"{TARGET}.meta"

        def _has_back_pointer():
            m = _get(meta_url, headers={"Accept": "text/turtle"})
            if m.status_code != 200:
                return False
            g = Graph()
            g.parse(data=m.text, format="turtle", publicID=meta_url)
            triples = list(g.triples((
                URIRef(TARGET),
                URIRef(HAS_OPEN_ACTION_REL),
                URIRef(op_url),
            )))
            return bool(triples)

        found = _poll(_has_back_pointer, timeout=5.0, interval=0.25)
        assert found, (
            f"step-2: back-pointer not in {meta_url} after 5s\n"
            f"op_url={op_url}")

        # Step 3: GET target with Accept: text/turtle; assert Link header contains
        # both the op URL and the hasOpenAction relation
        resp = _get(TARGET, headers={"Accept": "text/turtle"})
        assert resp.status_code == 200, f"step-3 GET {resp.status_code}"
        link = _link_header(resp)
        assert op_url in link, (
            f"step-3: op_url not in Link header\nop_url={op_url}\nLink={link}")
        assert HAS_OPEN_ACTION_REL in link, (
            f"step-3: hasOpenAction rel not in Link header\nLink={link}")

        # Step 4: resolve — PUT the proposal back with FailedActionStatus
        resolved = _resolved_body(TARGET, slug)
        r2 = _put(op_url, resolved)
        assert r2.status_code in (200, 205), (
            f"step-4 PUT {r2.status_code}: {r2.text[:300]}")

        # Step 5: poll until back-pointer is GONE from .meta
        def _back_pointer_gone():
            m = _get(meta_url, headers={"Accept": "text/turtle"})
            if m.status_code != 200:
                return False
            g = Graph()
            g.parse(data=m.text, format="turtle", publicID=meta_url)
            triples = list(g.triples((
                URIRef(TARGET),
                URIRef(HAS_OPEN_ACTION_REL),
                URIRef(op_url),
            )))
            return not triples  # truthy when gone

        cleared = _poll(_back_pointer_gone, timeout=5.0, interval=0.25)
        assert cleared, (
            f"step-5: back-pointer still in .meta after 5s\n"
            f"op_url={op_url}")

        # Assert op URL no longer in Link headers
        resp2 = _get(TARGET, headers={"Accept": "text/turtle"})
        link2 = _link_header(resp2)
        assert op_url not in link2, (
            f"step-5: op_url still in Link header after resolve\n"
            f"op_url={op_url}\nLink={link2}")

    finally:
        # Cleanup: delete op even if test fails mid-flight
        if op_url:
            _delete(op_url)


# ---------------------------------------------------------------------------
# Test 2: curation descriptor is prov:Plan + Memento-versioned
# ---------------------------------------------------------------------------

def test_descriptor_is_plan_and_versioned():
    # Part A: descriptor carries a:Plan
    r = _get(DESC, headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"descriptor GET {r.status_code}: {r.text[:300]}"
    g = Graph()
    try:
        g.parse(data=r.text, format="turtle", publicID=DESC)
    except Exception as e:
        pytest.fail(f"descriptor not parseable Turtle: {e}\n{r.text[:300]}")

    PROV_PLAN = URIRef("http://www.w3.org/ns/prov#Plan")
    plans = list(g.subjects(None, PROV_PLAN))  # any subject typed prov:Plan
    # broaden: check objects too (type triple)
    from rdflib import RDF
    plans = list(g.subjects(RDF.type, PROV_PLAN))
    assert plans, (
        f"descriptor has no prov:Plan subject\nParsed triples: {len(g)}\n"
        f"Body (first 400):\n{r.text[:400]}")

    # Part B: timemap returns 200 (Memento-versioned — hadPlan pinning works)
    tm_url = f"{DESC}?ext=timemap"
    tm = _get(tm_url, headers={"Accept": "text/turtle"})
    assert tm.status_code == 200, (
        f"timemap GET {tm.status_code}: {tm.text[:300]}")
