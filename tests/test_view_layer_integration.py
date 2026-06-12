"""E2E: the view layer (spec §8 eval hook), live Pod over TLS.

The live-Pod proof of the view layer (D114):
  - ?_profile=fused conneg works substrate-wide + content-type-agnostic: a markdown
    resource fuses to a fenced (---/```turtle) doc carrying body + graph; an RDF
    resource fuses to ONE merged turtle graph carrying its own triples + the
    governed context (the open-action back-pointer).
  - the default GET stays pristine even with an open mem:RealignAction (the D113
    trailer is gone; the open-action signal lives in the fused view instead).
  - read-only view 405s naming the writable home.
  - the view-authority contract is discoverable on the page profile and surfaced
    from the storage description so a cold agent meets it on arrival.
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


def test_profile_fused_contains_body_and_graph():
    with C() as c:
        t = c.get(f"{R}?_profile=fused").text
        assert t.startswith("---") and "```turtle" in t and "prefLabel" in t


def test_profile_alt_falls_through_to_ldp():
    # SP2-T7: alt retired — the handler no longer claims it; plain LDP serves
    # the document itself (unknown query params are ignored on GET).
    with C() as c:
        r = c.get(f"{R}?_profile=alt")
        assert r.status_code == 200 and r.text == BODY


def test_profile_fused_missing_resource_404():
    # SP2-T7: a missing base resource is an honest 404, not the blanket 500.
    with C() as c:
        r = c.get(f"{POD}/vault/wiki/concepts/nonexistent-sp2t7.md?_profile=fused")
        assert r.status_code == 404


def test_profile_link_header_present():
    with C() as c:
        links = c.get(R).headers.get_list("link")
        assert any('rel="profile"' in l for l in links)


# ─── lens law: read-only views reject writes ───────────────────────────────────

def test_view_write_405():
    with C() as c:
        r = _put(c, f"{R}?_profile=fused", "x")
        assert r.status_code == 405 and "document view" in r.text


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


# ─── D114: fused view substrate-wide + pristine default + view authority ──────

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


def _post_realign(target_url):
    slug = f"vl-realign-{uuid.uuid4().hex[:8]}"
    with C() as c:
        r = c.post(OPS, content=_proposal_body(target_url, slug),
                   headers={"Content-Type": "text/turtle", "Slug": slug})
        assert r.status_code == 201, f"proposal POST {r.status_code}: {r.text[:300]}"
        loc = r.headers.get("location", "")
        assert loc, "201 but no Location header"
        return loc


def test_profile_fused_markdown_carries_body_and_graph():
    with C() as c:
        t = c.get(f"{R}?_profile=fused").text
        assert t.startswith("---") and "```turtle" in t


def test_profile_fused_rdf_is_one_turtle_graph_with_governed_context():
    target = f"{POD}/id/schemes/orcid"
    op = _post_realign(target)
    try:
        time.sleep(2)
        with C() as c:
            r = c.get(f"{target}?_profile=fused")
            assert "turtle" in r.headers["content-type"]
            assert "hasOpenAction" in r.text          # governed context merged in
            assert "ORCID" in r.text or "orcid" in r.text  # the resource's OWN triples present
            assert "```turtle" not in r.text          # one merged graph, NOT a fenced markdown doc
            assert "posix" not in r.text              # SP2-T7: ResponseMetadata bookkeeping filtered
            assert "@prefix" in r.text                # SP2-T7: prefixed turtle
    finally:
        with C() as c:
            c.delete(op)


def test_default_get_pristine_even_with_open_action():
    op = _post_realign(R)
    try:
        time.sleep(2)
        with C() as c:
            assert "<!-- pod:notice" not in c.get(R).text   # trailer gone: default GET stays pristine
    finally:
        with C() as c:
            c.delete(op)


def test_view_authority_discoverable_on_profile():
    with C() as c:
        prof = c.get(f"{POD}/vault/meta/profiles/page", headers={"Accept": "text/turtle"}).text
        assert "agentInstruction" in prof and "?_profile=fused" in prof and "authoritative" in prof


def test_view_authority_carried_by_storage_description():
    # SP2-T8 re-cut: the D114 sub:viewAuthority POINTER is gone (H0/E8: agents never
    # consult pointers); its CONTENT lives in the immediate sh:agentInstruction literal
    # so a cold agent meets the authority division on arrival, and the page profile
    # stays discoverable via prof:hasResource.
    with C() as c:
        sd_url = f"{POD}/vault/.well-known/solid"
        sd = c.get(sd_url, headers={"Accept": "text/turtle"}).text
        assert "viewAuthority" not in sd
        assert "profiles/page" in sd
        assert "describedby" in sd and "authoritative" in sd


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
