"""E2E: the view layer (spec §8 eval hook), live Pod over TLS.

The live-Pod proof of the view layer:
  - ?_profile= conneg on /vault/wiki/* resources (doc|fused|graph|alt), the
    document view being the writable + pristine escape hatch.
  - the marker guard (server-managed <!-- pod:notice --> region can't be written back).
  - read-only view 405s naming the writable home.
  - the A' conditional trailer: when a resource has an open mem:RealignAction in
    the .operations ledger, the default GET carries a pod:notice trailer with the
    rationale; ?_profile=doc stays pristine. This is the channel D112 Probe 2 showed
    was broken via Link headers — surfaced in the representation instead.
  - the /vault/views/people/ cross-cutting demonstrator: one person, one URL,
    assembled from both homes (wiki note + addressbook contact) over the
    schema:sameAs bridge (Verborgh contacts-conundrum existence proof).

Run: SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem pytest tests/test_view_layer_integration.py -v
"""
import time
import uuid

import httpx
import pytest
from rdflib import Graph

from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
MEM = f"{POD}/vault/ontology/mem#"
OPS = f"{POD}/id/.operations/"
DESC = f"{POD}/vault/meta/affordances/curation.ttl"

R = f"{POD}/vault/wiki/concepts/view-layer-e2e.md"
BODY = "---\ntype: Concept\n---\n# View Layer E2E\n\n[View Layer E2E]{.prefLabel} test page.\n"

# The seeded bridge person (sameAs → /vault/contacts/Person/marie-curie.ttl#this).
BRIDGE_SLUG = "marie-curie"

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def C():
    return httpx.Client(verify=_CA, timeout=15)


def _put(c, url, body, ct="text/markdown"):
    return c.put(url, content=body, headers={"Content-Type": ct})


def setup_module():
    with C() as c:
        _put(c, R, BODY)


def teardown_module():
    with C() as c:
        c.delete(R)
        c.delete(f"{R}.meta")


# ─── ?_profile= conneg ─────────────────────────────────────────────────────────

def test_default_get_pristine_when_no_open_action():
    with C() as c:
        assert c.get(R).text == BODY


def test_profile_doc_byte_identical():
    with C() as c:
        assert c.get(f"{R}?_profile=doc").text == BODY


def test_profile_fused_contains_body_and_graph():
    with C() as c:
        t = c.get(f"{R}?_profile=fused").text
        assert t.startswith("---") and "```turtle" in t and "prefLabel" in t


def test_profile_graph_is_turtle():
    with C() as c:
        r = c.get(f"{R}?_profile=graph")
        assert "turtle" in r.headers["content-type"] and "prefLabel" in r.text


def test_profile_alt_lists_tokens():
    with C() as c:
        t = c.get(f"{R}?_profile=alt").text
        for tok in ("doc", "fused", "graph"):
            assert f'"{tok}"' in t


def test_profile_link_header_present():
    with C() as c:
        links = c.get(R).headers.get_list("link")
        assert any('rel="profile"' in l for l in links)


# ─── lens law: read-only views reject writes ───────────────────────────────────

def test_view_write_405():
    with C() as c:
        r = _put(c, f"{R}?_profile=fused", "x")
        assert r.status_code == 405 and "document view" in r.text


def test_marker_guard_422():
    with C() as c:
        bad = BODY + "\n<!-- pod:notice — imitated -->\n"
        r = _put(c, f"{POD}/vault/wiki/concepts/view-layer-e2e-marker.md", bad)
        try:
            assert r.status_code == 422 and "server-managed" in r.text
        finally:
            c.delete(f"{POD}/vault/wiki/concepts/view-layer-e2e-marker.md")
            c.delete(f"{POD}/vault/wiki/concepts/view-layer-e2e-marker.md.meta")


# ─── /vault/views/people/ cross-cutting view ───────────────────────────────────

def test_people_view_lists_members():
    with C() as c:
        r = c.get(f"{POD}/vault/views/people/", headers={"Accept": "text/turtle"})
        assert r.status_code == 200 and "contains" in r.text


def test_people_view_write_405():
    with C() as c:
        r = c.put(f"{POD}/vault/views/people/x", content="x",
                  headers={"Content-Type": "text/turtle"})
        assert r.status_code == 405


# ─── A' conditional trailer (the D112-Probe-2 channel, in the representation) ──

def _proposal_body(target_url, slug):
    return (
        "@prefix as:     <https://www.w3.org/ns/activitystreams#> .\n"
        f"@prefix mem:    <{MEM}> .\n"
        "@prefix prov:   <http://www.w3.org/ns/prov#> .\n"
        "@prefix schema: <https://schema.org/> .\n"
        "@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .\n"
        "<> a as:Announce , mem:RealignAction , prov:Activity ;\n"
        f"    as:object <{target_url}> ;\n"
        "    schema:actionStatus schema:PotentialActionStatus ;\n"
        "    mem:stalenessClass mem:ProviderDrift ;\n"
        '    mem:rationale "view-layer e2e" ;\n'
        "    prov:qualifiedAssociation [ a prov:Association ;\n"
        "        prov:agent <urn:agent:pytest> ;\n"
        f"        prov:hadPlan <{DESC}> ] ;\n"
        '    as:published "2026-06-07T12:00:00Z"^^xsd:dateTime .\n'
    )


def test_trailer_appears_with_open_action():
    # Distinct target (R2) so the open-action state never contaminates R's
    # pristine-GET assertions even if test ordering changes.
    slug = f"vl-trailer-{uuid.uuid4().hex[:8]}"
    R2 = f"{POD}/vault/wiki/concepts/view-layer-e2e-trailer.md"
    op_url = None
    with C() as c:
        _put(c, R2, BODY)
        try:
            r = c.post(OPS, content=_proposal_body(R2, slug),
                       headers={"Content-Type": "text/turtle", "Slug": slug})
            assert r.status_code == 201, f"proposal POST {r.status_code}: {r.text[:300]}"
            op_url = r.headers.get("location", "")
            assert op_url, "201 but no Location header"

            # Poll for the trailer (listener derives the back-pointer async).
            deadline = time.monotonic() + 8.0
            t = ""
            while time.monotonic() < deadline:
                t = c.get(R2).text
                if "<!-- pod:notice" in t:
                    break
                time.sleep(0.25)
            assert "<!-- pod:notice" in t and "view-layer e2e" in t, (
                f"trailer + rationale not in default GET:\n{t}")
            # The escape hatch stays pristine.
            assert c.get(f"{R2}?_profile=doc").text == BODY
        finally:
            if op_url:
                c.delete(op_url)
            c.delete(R2)
            c.delete(f"{R2}.meta")


# ─── the bridge card: two homes unified (Verborgh contacts conundrum) ──────────

def test_people_view_bridge_card():
    with C() as c:
        r = c.get(f"{POD}/vault/views/people/{BRIDGE_SLUG}", headers={"Accept": "text/turtle"})
        assert r.status_code == 200, f"bridge card GET {r.status_code}: {r.text[:300]}"
        g = Graph()
        g.parse(data=r.text, format="turtle", publicID=f"{POD}/vault/views/people/{BRIDGE_SLUG}")
        text = r.text
        # Both homes present: rdfs:seeAlso bridge + the contact resource quads.
        assert "seeAlso" in text, f"card missing rdfs:seeAlso (the bridge):\n{text}"
        assert "/contacts/" in text, f"card missing the contact home (/contacts/):\n{text}"
