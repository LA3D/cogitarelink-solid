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

POD = "https://pod.vardeman.me/vault/"
SYNTH = "https://pod.vardeman.me/vault/wiki/index.md"
WIKI_NS = "https://pod.vardeman.me/vault/ontology/wiki#"


def test_pod_root_advertises_profile_document():
    """A GET on /vault/.well-known/solid emits wiki:profileDocument → synthesis page."""
    well_known = f"{POD}.well-known/solid"
    r = httpx.get(well_known, headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200
    # Parse with the response URL as publicID so relative IRIs in the
    # storage description (e.g. <../wiki/index.md>) resolve correctly
    # against /vault/.well-known/solid, not against /vault/.
    g = Graph().parse(data=r.text, format="turtle", publicID=well_known)
    profile_docs = list(g.objects(predicate=URIRef(f"{WIKI_NS}profileDocument")))
    assert len(profile_docs) >= 1
    assert any(str(p) == SYNTH for p in profile_docs), (
        f"wiki:profileDocument should point at {SYNTH}; got {[str(p) for p in profile_docs]}"
    )


def test_synthesis_page_markdown_body_has_required_sections():
    """GET /vault/wiki/index.md with Accept: text/markdown returns the synthesis body."""
    r = httpx.get(SYNTH, headers={"Accept": "text/markdown"}, verify=False)
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
    """The synthesis page's .meta carries the wiki:bootstrapResource pointers."""
    r = httpx.get(f"{SYNTH}.meta",
                  headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=SYNTH)
    bootstrap = list(g.objects(predicate=URIRef(f"{WIKI_NS}bootstrapResource")))
    assert len(bootstrap) >= 4, (
        f"Expected ≥4 bootstrap pointers (storage description, shape catalog, "
        f"affordance catalog, type index); got {len(bootstrap)}: {bootstrap}"
    )
    # Self-reference: the synthesis declares itself as the profile document.
    profile_docs = list(g.objects(predicate=URIRef(f"{WIKI_NS}profileDocument")))
    assert any(str(p) == SYNTH for p in profile_docs)


def test_synthesis_page_html_embeds_jsonld_script():
    """The synthesis page's HTML representation embeds JSON-LD in a <script> tag."""
    r = httpx.get(SYNTH, headers={"Accept": "text/html"}, verify=False)
    assert r.status_code == 200, f"HTML conversion failed: {r.status_code} {r.text[:200]}"
    html = r.text
    assert '<script type="application/ld+json">' in html, (
        "Missing embedded JSON-LD script tag; the markdown-render JsonLdScriptInjector "
        "may not be firing, or the converter integration broke."
    )
    # The script tag should reference the synthesis URL as @id.
    assert SYNTH in html


def test_all_wiki_memory_shape_agent_instructions_reference_synthesis():
    """U-shape: every wiki-memory L3 SHACL shape's sh:agentInstruction back-references the synthesis.

    Filtered to wiki-memory L3 shapes (page, source, person, procedure, working, resource).
    AddressBook overlay shapes (contact-card, organization-card, group, membership,
    pod-owner-preferences, webid-profile) live in the same /vault/meta/shapes/ catalog
    but are NOT in scope of the wiki-memory L3 U-shape append; they have their own
    overlay's conventions.
    """
    SHACL_AI = URIRef("http://www.w3.org/ns/shacl#agentInstruction")
    LDP_CONTAINS = URIRef("http://www.w3.org/ns/ldp#contains")

    WIKI_MEMORY_SHAPES = {
        "page.shacl.ttl", "source.shacl.ttl", "person.shacl.ttl",
        "procedure.shacl.ttl", "working.shacl.ttl", "resource.shacl.ttl",
    }

    r = httpx.get(f"{POD}meta/shapes/",
                  headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200
    container = Graph().parse(data=r.text, format="turtle", publicID=f"{POD}meta/shapes/")
    all_shape_urls = list(container.objects(predicate=LDP_CONTAINS))
    wiki_memory_shapes = [s for s in all_shape_urls
                          if str(s).rsplit("/", 1)[-1] in WIKI_MEMORY_SHAPES]
    assert len(wiki_memory_shapes) >= 5, (
        f"Expected ≥5 wiki-memory L3 shapes in catalog, got {len(wiki_memory_shapes)}: "
        f"{[str(s).rsplit('/', 1)[-1] for s in wiki_memory_shapes]}"
    )

    for shape_url in wiki_memory_shapes:
        rr = httpx.get(str(shape_url),
                       headers={"Accept": "text/turtle"}, verify=False)
        assert rr.status_code == 200, f"Failed to GET shape {shape_url}: {rr.status_code}"
        sg = Graph().parse(data=rr.text, format="turtle", publicID=str(shape_url))
        instructions = list(sg.objects(predicate=SHACL_AI))
        assert len(instructions) >= 1, f"No sh:agentInstruction on {shape_url}"
        # Each instruction's literal should mention the synthesis URL.
        assert any(SYNTH in str(i) for i in instructions), (
            f"{shape_url} sh:agentInstruction doesn't reference {SYNTH}: "
            f"got {[str(i)[:120] for i in instructions]}"
        )
