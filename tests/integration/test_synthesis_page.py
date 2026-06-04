"""Phase A — blind-agent navigation integration tests.

Verifies that a fresh client with only HTTP + RDF parsing can reach the
synthesis page from the Pod root, and that the synthesis carries the
bootstrap pointers a blind agent needs.

Per the spec, the synthesis page lives at /vault/wiki/index.md (a
resource), not /vault/wiki/ (the container). CSS treats trailing-slash
URLs as LDP containers and ignores arbitrary bodies PUT to them.
"""
import httpx
import pytest
from rdflib import Graph, URIRef

from tests.conftest import _pod_base, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base() + "/vault/"
SYNTH = f"{_pod_base()}/vault/wiki/index.md"
WIKI_NS = f"{_pod_base()}/vault/ontology/wiki#"
SUB_NS = f"{_pod_base()}/vault/ontology/substrate#"


def test_pod_root_advertises_profile_document():
    """A GET on /vault/.well-known/solid emits sub:profileDocument → synthesis page."""
    well_known = f"{POD}.well-known/solid"
    r = httpx.get(well_known, headers={"Accept": "text/turtle"}, verify=_CA)
    assert r.status_code == 200
    # Parse with the response URL as publicID so relative IRIs in the
    # storage description (e.g. <../wiki/index.md>) resolve correctly
    # against /vault/.well-known/solid, not against /vault/.
    g = Graph().parse(data=r.text, format="turtle", publicID=well_known)
    profile_docs = list(g.objects(predicate=URIRef(f"{SUB_NS}profileDocument")))
    assert len(profile_docs) >= 1
    assert any(str(p) == SYNTH for p in profile_docs), (
        f"sub:profileDocument should point at {SYNTH}; got {[str(p) for p in profile_docs]}"
    )


def test_synthesis_page_markdown_body_has_required_sections():
    """GET /vault/wiki/index.md with Accept: text/markdown returns the synthesis body."""
    r = httpx.get(SYNTH, headers={"Accept": "text/markdown"}, verify=_CA)
    assert r.status_code == 200
    body = r.text
    assert "Wiki-Memory L3" in body
    # The eight required section headings per spec §A.1.
    for heading in [
        "Overview",
        "Container layout",
        "Type taxonomy",
        "Conventions",
        "Affordances available",
        "Operations",
        "Events and announcements",
        "Cross-session orientation",
    ]:
        assert heading in body, f"Missing required section: {heading}"
    # The navigation principle (LD-explicit framing — section earned in HR-5 review).
    assert "Linked Data" in body or "linked data" in body
    assert "Follow your nose" in body


def test_synthesis_page_meta_has_bootstrap_pointers():
    """The synthesis page's .meta carries the sub:bootstrapResource pointers."""
    r = httpx.get(f"{SYNTH}.meta",
                  headers={"Accept": "text/turtle"}, verify=_CA)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=SYNTH)
    bootstrap = list(g.objects(predicate=URIRef(f"{SUB_NS}bootstrapResource")))
    assert len(bootstrap) >= 4, (
        f"Expected ≥4 bootstrap pointers (storage description, shape catalog, "
        f"affordance catalog, type index); got {len(bootstrap)}: {bootstrap}"
    )
    # Self-reference: the synthesis declares itself as the profile document.
    profile_docs = list(g.objects(predicate=URIRef(f"{SUB_NS}profileDocument")))
    assert any(str(p) == SYNTH for p in profile_docs)


def test_synthesis_page_html_embeds_jsonld_script():
    """The synthesis page's HTML representation embeds JSON-LD in a <script> tag."""
    r = httpx.get(SYNTH, headers={"Accept": "text/html"}, verify=_CA)
    assert r.status_code == 200, f"HTML conversion failed: {r.status_code} {r.text[:200]}"
    html = r.text
    assert '<script type="application/ld+json">' in html, (
        "Missing embedded JSON-LD script tag; the markdown-render JsonLdScriptInjector "
        "may not be firing, or the converter integration broke."
    )
    # The script tag should reference the synthesis URL as @id.
    assert SYNTH in html


def test_apex_resource_shape_agent_instruction_references_synthesis():
    """The apex resource.shacl.ttl back-references the synthesis page from its
    sh:agentInstruction, so an agent reading any wiki-memory shape can route to the
    full L3 profile and inter-shape conventions.

    Relaxed 2026-06-04 C-T4 (was test_all_wiki_memory_shape_agent_instructions_
    reference_synthesis): the "every shape references the synthesis" convention is no
    longer how the substrate works — only the apex shape (resource.shacl.ttl), which
    all the concrete Thing-shapes build on, carries the synthesis pointer. The
    specific shapes inherit the routing through the apex rather than each repeating
    the URL. This asserts the real current invariant.
    """
    SHACL_AI = URIRef("http://www.w3.org/ns/shacl#agentInstruction")

    apex_url = f"{POD}meta/shapes/resource.shacl.ttl"
    rr = httpx.get(apex_url, headers={"Accept": "text/turtle"}, verify=_CA)
    assert rr.status_code == 200, f"Failed to GET apex shape {apex_url}: {rr.status_code}"
    sg = Graph().parse(data=rr.text, format="turtle", publicID=apex_url)
    instructions = list(sg.objects(predicate=SHACL_AI))
    assert len(instructions) >= 1, f"No sh:agentInstruction on {apex_url}"
    assert any(SYNTH in str(i) for i in instructions), (
        f"apex resource.shacl.ttl sh:agentInstruction doesn't reference {SYNTH}: "
        f"got {[str(i)[:120] for i in instructions]}"
    )
