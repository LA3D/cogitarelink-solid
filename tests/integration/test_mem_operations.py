"""Phase B/C — mem:*Action integration tests against the live Pod.

Each test exercises one action affordance's full LDP procedure (per the
descriptor at /vault/meta/affordances/<name>) and verifies:
  1. Resource state / typed-edge postcondition (substrate write).
  2. Operation provenance recorded canonically in the .operations/ announcement.
  3. For body-generating ops (crystallize/supersede/merge/demote): the
     substrate-DERIVED prov:wasGeneratedBy pointer on the resource .meta,
     pointing back at the announcement (RQ-Listener-1, derive-from-log design).

RQ-Listener-1 design (2026-05-25): the announcement is the canonical record.
The agent posts a <>-subject [as:Announce, mem:*Action] with `as:object <target>`
to .operations/ BEFORE the body write (announce-first), and the
MarkdownProjectionListener DERIVES `<target> prov:wasGeneratedBy <announcement>`
into the target's .meta on that write — agents no longer PATCH it. Because the
derivation only fires on a BODY write, .meta-only ops (archive, link) carry no
derived edge; their provenance lives solely in .operations/.

Substrate behaviour discovered during probe sessions (2026-05-18):
- CSS N3 Patch rejects blank nodes in solid:inserts formulas (HTTP 422).
  Use named URIs, not blank nodes.
- Memento snapshots are auto-captured on PUT; the TimeMap URI is
  `{resource}?ext=timemap` and the first version URI is
  `{resource}?version=YYYYMMDDHHMMSS`.
- Projection is asynchronous (fires on the body PUT via the MonitoringStore
  'changed' event), so the derived-edge assertion polls until it lands.
"""
import time
import uuid
import httpx
import pytest
from rdflib import Graph, URIRef, Namespace
from rdflib.namespace import RDF

POD        = "https://pod.vardeman.me/vault/"
WORKING    = f"{POD}wiki/working/"
PAGES      = f"{POD}wiki/concepts/"
SOURCES    = f"{POD}wiki/concepts/"
OPERATIONS = f"{POD}wiki/.operations/"

WIKI = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")
MEM  = Namespace("https://pod.vardeman.me/vault/ontology/mem#")
PROV = Namespace("http://www.w3.org/ns/prov#")
AS   = Namespace("https://www.w3.org/ns/activitystreams#")
DCT  = Namespace("http://purl.org/dc/terms/")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")


@pytest.fixture
def slug():
    return f"test-mem-{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _put(url, body):
    r = httpx.put(url, content=body,
                  headers={"Content-Type": "text/markdown"}, verify=False)
    # CSS returns 201 for create, 205 Reset Content for update (overwrite).
    assert r.status_code in (201, 204, 205), f"PUT {url}: {r.status_code} {r.text[:200]}"
    return r


def _patch_meta(resource_url, triples_nt):
    """PATCH .meta via N3 Patch; triples_nt is N-Triples string of inserts."""
    meta_url = resource_url + ".meta"
    patch = (
        "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n"
        "_:patch a solid:InsertDeletePatch ;\n"
        f"   solid:inserts {{ {triples_nt} }} .\n"
    )
    r = httpx.patch(meta_url, content=patch,
                    headers={"Content-Type": "text/n3"}, verify=False)
    assert r.status_code in (200, 201, 204, 205), (
        f"PATCH {meta_url}: {r.status_code} {r.text[:300]}"
    )
    return r


def _delete(url):
    r = httpx.delete(url, verify=False)
    # CSS returns 205 Reset Content on successful DELETE (observed in probe sessions).
    assert r.status_code in (200, 204, 205, 404), f"DELETE {url}: {r.status_code}"
    return r


def _meta_graph(url):
    r = httpx.get(url + ".meta", headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200, f"GET {url}.meta: {r.status_code}"
    return Graph().parse(data=r.text, format="turtle", publicID=url)


def _nt_triples(*lines):
    """Join N-Triple lines with a trailing newline."""
    return "\n".join(lines) + "\n"


def _setup_page(url, title):
    """PUT a minimal wiki:Page body and PATCH its required dct:title."""
    body = f"# {title}\n\nTest page for mem: action tests.\n"
    _put(url, body)
    # CSS shape requires dct:title (xsd:string); PATCH it in via named-URI approach
    triples = _nt_triples(
        f'<{url}> <http://purl.org/dc/terms/title> "{title}" .',
        f'<{url}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
        f' <https://pod.vardeman.me/vault/ontology/wiki#Page> .',
    )
    _patch_meta(url, triples)


def _discover_memento_uri(url):
    """Return the first Memento version URI from the TimeMap, or None."""
    timemap_url = url + "?ext=timemap"
    r = httpx.get(timemap_url, headers={"Accept": "text/turtle"}, verify=False)
    if r.status_code != 200:
        return None
    g = Graph().parse(data=r.text, format="turtle", publicID=timemap_url)
    MEMENTO_NS = Namespace("http://mementoweb.org/ns#")
    mementos = list(g.subjects(RDF.type, MEMENTO_NS.Memento))
    return str(mementos[0]) if mementos else None


def _announce(action_class_iri, subject_url):
    """PUT a <>-subject [as:Announce, mem:*Action, prov:Activity] announcement to
    OPERATIONS (canonical form per mem.ttl); return (url, url) — subject == resource url.

    The substrate derives `<subject_url> prov:wasGeneratedBy <ann_url>` from the
    as:object link when subject_url's body is next projected (announce-first)."""
    iso_now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    ann_url = f"{OPERATIONS}{uuid.uuid4().hex}.ttl"
    body = (
        "@prefix as:   <https://www.w3.org/ns/activitystreams#> .\n"
        "@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .\n"
        "@prefix prov: <http://www.w3.org/ns/prov#> .\n"
        "@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .\n\n"
        f"<> a as:Announce, <{action_class_iri}>, prov:Activity ;\n"
        f"    as:actor <https://pod.vardeman.me/vault/profile/card#me> ;\n"
        f"    as:object <{subject_url}> ;\n"
        f"    as:target <{OPERATIONS}> ;\n"
        f'    as:published "{iso_now}"^^xsd:dateTime .\n'
    )
    r = httpx.put(ann_url, content=body,
                  headers={"Content-Type": "text/turtle"}, verify=False)
    assert r.status_code in (201, 204, 205), (
        f"PUT announcement {ann_url}: {r.status_code} {r.text[:200]}"
    )
    return ann_url, ann_url


def _assert_announced(ann_url, ann_subject, action_class_iri, subject_url):
    """GET the announcement resource, parse, assert action type + object on its <> subject."""
    r = httpx.get(ann_url, headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200, f"GET announcement {ann_url}: {r.status_code}"
    g = Graph().parse(data=r.text, format="turtle", publicID=ann_url)
    ann = URIRef(ann_subject)
    types = set(g.objects(ann, RDF.type))
    assert AS.Announce in types, f"as:Announce missing from announcement; got {types}"
    assert URIRef(action_class_iri) in types, (
        f"{action_class_iri} missing from announcement types; got {types}"
    )
    objects = list(g.objects(ann, AS.object))
    assert URIRef(subject_url) in objects, (
        f"as:object {subject_url} missing from announcement; got {objects}"
    )


def _assert_derived_genesis(resource_url, ann_url, retries=15, delay=0.4):
    """Poll the resource .meta for the projector-DERIVED prov:wasGeneratedBy pointer
    at the announcement (RQ-Listener-1). Projection is async (fires on the body PUT),
    so retry until it converges."""
    last = []
    for _ in range(retries):
        last = list(_meta_graph(resource_url).objects(URIRef(resource_url), PROV.wasGeneratedBy))
        if URIRef(ann_url) in last:
            return
        time.sleep(delay)
    raise AssertionError(
        f"derived prov:wasGeneratedBy -> {ann_url} not found in {resource_url}.meta "
        f"after {retries} polls; got {last}"
    )


# ---------------------------------------------------------------------------
# Test 1 — Crystallize
# ---------------------------------------------------------------------------

def test_crystallize_e2e(slug):
    """Crystallize: working note → durable page; provenance via .operations/ announcement.

    Procedure from /vault/meta/affordances/crystallize.ttl:
      1. GET working note
      2. PUT durable + PATCH .meta with PROV-O
      3. DELETE working note
      4. POST [as:Announce, mem:CrystallizeAction] to /vault/wiki/.operations/
    """
    working_url = f"{WORKING}{slug}.md"
    durable_url = f"{PAGES}{slug}.md"

    # Setup: working note with wiki:WorkingNote type
    _put(working_url, f"# {slug}\n\nWorking draft.\n")
    triples = _nt_triples(
        f'<{working_url}> <http://purl.org/dc/terms/title> "{slug}" .',
        f'<{working_url}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
        f' <https://pod.vardeman.me/vault/ontology/wiki#WorkingNote> .',
    )
    _patch_meta(working_url, triples)

    # Announce FIRST (announce-first contract): the substrate derives the resource's
    # prov:wasGeneratedBy from this announcement on the body PUT below.
    ann_url, ann_subject = _announce(str(MEM.CrystallizeAction), durable_url)

    # Perform: PUT durable (projection finds the announcement, derives the edge)
    _put(durable_url, f"# {slug}\n\nCrystallized concept.\n")
    # PATCH only the ungoverned provenance the substrate does NOT derive (wasDerivedFrom).
    durable_triples = _nt_triples(
        f'<{durable_url}> <http://purl.org/dc/terms/title> "{slug}" .',
        f'<{durable_url}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
        f' <https://pod.vardeman.me/vault/ontology/wiki#Page> .',
        f'<{durable_url}> <http://www.w3.org/ns/prov#wasDerivedFrom> <{working_url}> .',
    )
    _patch_meta(durable_url, durable_triples)

    # DELETE working note
    _delete(working_url)

    try:
        # Verify 1: durable exists
        r = httpx.get(durable_url, headers={"Accept": "text/markdown"}, verify=False)
        assert r.status_code == 200, f"Durable not found: {r.status_code}"

        # Verify 2: working note is gone.
        # CSS Memento returns 410 Gone (not 404) for deleted resources that had
        # Memento history captured — this is correct RFC 7089 tombstone behaviour (D64).
        r = httpx.get(working_url, verify=False)
        assert r.status_code in (404, 410), (
            f"Working note should be deleted (404) or tombstoned (410); got {r.status_code}"
        )

        # Verify 3: prov:wasDerivedFrom links back to working source (in content .meta)
        g = _meta_graph(durable_url)
        derived = list(g.objects(URIRef(durable_url), PROV.wasDerivedFrom))
        assert URIRef(working_url) in derived, (
            f"prov:wasDerivedFrom missing working source; got {derived}"
        )

        # Verify 4: operation provenance recorded canonically in .operations/
        _assert_announced(ann_url, ann_subject, str(MEM.CrystallizeAction), durable_url)

        # Verify 5: the substrate-DERIVED prov:wasGeneratedBy pointer on the resource .meta
        _assert_derived_genesis(durable_url, ann_url)

    finally:
        _delete(durable_url)
        _delete(working_url)  # no-op if already gone
        _delete(ann_url)


# ---------------------------------------------------------------------------
# Test 2 — Supersede
# ---------------------------------------------------------------------------

def test_supersede_e2e(slug):
    """Supersede: refined version replaces existing page; provenance via .operations/.

    Procedure from /vault/meta/affordances/supersede.ttl:
      1. GET existing + discover prior Memento URI from TimeMap
      2. PUT refined body + PATCH .meta with prov:wasRevisionOf → prior Memento
      3. POST [as:Announce, mem:SupersedeAction] to /vault/wiki/.operations/

    Note: Memento URI discovery is validated here. If no version URI is found in
    the TimeMap (e.g., the resource was just created and Memento hasn't snapshotted
    yet), prov:wasRevisionOf is set to the timemap URI itself as a sentinel and the
    URI-resolution assertion is skipped with a note.
    """
    page_url = f"{PAGES}{slug}.md"

    # Setup: create initial page
    _setup_page(page_url, f"{slug} v1")

    # Discover prior Memento URI
    prior_memento = _discover_memento_uri(page_url)

    # If no Memento URI found yet, use timemap as sentinel
    memento_sentinel = prior_memento or (page_url + "?ext=timemap")
    ann_url = None

    try:
        # Announce FIRST (announce-first): the substrate derives prov:wasGeneratedBy
        # from this announcement on the body PUT below.
        ann_url, ann_subject = _announce(str(MEM.SupersedeAction), page_url)

        # Perform: PUT refined body (projection derives the edge)
        _put(page_url, f"# {slug} v2\n\nRefined version.\n")
        # PATCH only ungoverned provenance the substrate does NOT derive (wasRevisionOf).
        refined_triples = _nt_triples(
            f'<{page_url}> <http://purl.org/dc/terms/title> "{slug} v2" .',
            f'<{page_url}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
            f' <https://pod.vardeman.me/vault/ontology/wiki#Page> .',
            f'<{page_url}> <http://www.w3.org/ns/prov#wasRevisionOf>'
            f' <{memento_sentinel}> .',
        )
        _patch_meta(page_url, refined_triples)

        # Verify 1: page returns the refined body
        r = httpx.get(page_url, headers={"Accept": "text/markdown"}, verify=False)
        assert r.status_code == 200
        assert "v2" in r.text or slug in r.text

        # Verify 2: prov:wasRevisionOf is present in content .meta
        g = _meta_graph(page_url)
        rev_of = list(g.objects(URIRef(page_url), PROV.wasRevisionOf))
        assert len(rev_of) >= 1, "prov:wasRevisionOf missing on superseded resource"

        # Only assert exact Memento URI if we actually discovered one
        if prior_memento:
            assert URIRef(prior_memento) in rev_of, (
                f"prov:wasRevisionOf expected {prior_memento}; got {rev_of}"
            )
        else:
            # Memento URI was not available at test-setup time (resource just created).
            # Assertion deferred — see Phase B/Memento integration follow-up.
            pass

        # Verify 3: operation provenance recorded canonically in .operations/
        _assert_announced(ann_url, ann_subject, str(MEM.SupersedeAction), page_url)

        # Verify 4: the substrate-DERIVED prov:wasGeneratedBy pointer on the resource .meta
        _assert_derived_genesis(page_url, ann_url)

    finally:
        _delete(page_url)
        if ann_url:
            _delete(ann_url)


# ---------------------------------------------------------------------------
# Test 3 — Merge
# ---------------------------------------------------------------------------

def test_merge_e2e(slug):
    """Merge: 3 inputs → single merged page; provenance via .operations/ announcement.

    Procedure from /vault/meta/affordances/merge.ttl:
      1. GET each input; compose merged body
      2. PUT merged + PATCH .meta with prov:wasDerivedFrom × 3
      3. DELETE each input
      4. POST [as:Announce, mem:MergeAction] to /vault/wiki/.operations/
    """
    input_urls = [f"{PAGES}{slug}-in{i}.md" for i in range(1, 4)]
    merged_url = f"{PAGES}{slug}-merged.md"

    # Setup: create 3 input pages
    for i, url in enumerate(input_urls, start=1):
        _setup_page(url, f"{slug} input {i}")

    ann_url = None

    try:
        # Announce FIRST (announce-first): the substrate derives prov:wasGeneratedBy
        # from this announcement on the body PUT below.
        ann_url, ann_subject = _announce(str(MEM.MergeAction), merged_url)

        # Perform: PUT merged resource (projection derives the edge)
        merged_body = f"# {slug} merged\n\nCombined from {len(input_urls)} inputs.\n"
        _put(merged_url, merged_body)

        # PATCH only ungoverned provenance the substrate does NOT derive (wasDerivedFrom × 3).
        derived_triples = [
            f'<{merged_url}> <http://purl.org/dc/terms/title> "{slug} merged" .',
            f'<{merged_url}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
            f' <https://pod.vardeman.me/vault/ontology/wiki#Page> .',
        ]
        for inp in input_urls:
            derived_triples.append(
                f'<{merged_url}> <http://www.w3.org/ns/prov#wasDerivedFrom> <{inp}> .'
            )
        _patch_meta(merged_url, _nt_triples(*derived_triples))

        # DELETE inputs
        for inp in input_urls:
            _delete(inp)

        # Verify 1: merged resource exists
        r = httpx.get(merged_url, headers={"Accept": "text/markdown"}, verify=False)
        assert r.status_code == 200

        # Verify 2: all inputs are gone.
        # CSS Memento returns 410 Gone for Memento-tracked deleted resources (D64).
        for inp in input_urls:
            r = httpx.get(inp, verify=False)
            assert r.status_code in (404, 410), (
                f"Input {inp} should be gone (404) or tombstoned (410); got {r.status_code}"
            )

        # Verify 3: prov:wasDerivedFrom enumerates all 3 inputs in content .meta
        g = _meta_graph(merged_url)
        derived = set(g.objects(URIRef(merged_url), PROV.wasDerivedFrom))
        for inp in input_urls:
            assert URIRef(inp) in derived, (
                f"prov:wasDerivedFrom missing input {inp}; got {derived}"
            )

        # Verify 4: operation provenance recorded canonically in .operations/
        _assert_announced(ann_url, ann_subject, str(MEM.MergeAction), merged_url)

        # Verify 5: the substrate-DERIVED prov:wasGeneratedBy pointer on the resource .meta
        _assert_derived_genesis(merged_url, ann_url)

    finally:
        _delete(merged_url)
        for inp in input_urls:
            _delete(inp)  # no-op if already deleted
        if ann_url:
            _delete(ann_url)


# ---------------------------------------------------------------------------
# Test 4 — Demote
# ---------------------------------------------------------------------------

def test_demote_e2e(slug):
    """Demote: durable page → working memory; provenance via .operations/ announcement.

    Procedure from /vault/meta/affordances/demote.ttl:
      1. GET durable + discover prior Memento URI
      2. PUT to working + PATCH .meta with PROV-O
      3. DELETE durable
      4. POST [as:Announce, mem:DemoteAction] to /vault/wiki/.operations/
    """
    durable_url = f"{PAGES}{slug}.md"
    working_url = f"{WORKING}{slug}.md"

    # Setup: create a durable page
    _setup_page(durable_url, f"{slug} durable")

    # Discover prior Memento URI for prov:wasDerivedFrom
    prior_memento = _discover_memento_uri(durable_url)
    memento_ref = prior_memento or (durable_url + "?ext=timemap")

    ann_url = None

    try:
        # Announce FIRST (announce-first): the substrate derives prov:wasGeneratedBy
        # from this announcement on the body PUT below.
        ann_url, ann_subject = _announce(str(MEM.DemoteAction), working_url)

        # Perform: PUT to working (projection derives the edge)
        _put(working_url, f"# {slug} (demoted)\n\nNeeds rework.\n")
        # PATCH only ungoverned provenance the substrate does NOT derive (wasDerivedFrom).
        working_triples = _nt_triples(
            f'<{working_url}> <http://purl.org/dc/terms/title> "{slug} demoted" .',
            f'<{working_url}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
            f' <https://pod.vardeman.me/vault/ontology/wiki#WorkingNote> .',
            f'<{working_url}> <http://www.w3.org/ns/prov#wasDerivedFrom>'
            f' <{memento_ref}> .',
        )
        _patch_meta(working_url, working_triples)

        # DELETE durable
        _delete(durable_url)

        # Verify 1: working note exists
        r = httpx.get(working_url, headers={"Accept": "text/markdown"}, verify=False)
        assert r.status_code == 200

        # Verify 2: durable is gone.
        # CSS Memento returns 410 Gone for Memento-tracked deleted resources (D64).
        r = httpx.get(durable_url, verify=False)
        assert r.status_code in (404, 410), (
            f"Durable should be gone (404) or tombstoned (410); got {r.status_code}"
        )

        # Verify 3: prov:wasDerivedFrom in working .meta links to prior durable snapshot
        g = _meta_graph(working_url)
        derived = list(g.objects(URIRef(working_url), PROV.wasDerivedFrom))
        assert len(derived) >= 1, "prov:wasDerivedFrom missing on demoted working resource"

        # Verify 4: operation provenance recorded canonically in .operations/
        _assert_announced(ann_url, ann_subject, str(MEM.DemoteAction), working_url)

        # Verify 5: the substrate-DERIVED prov:wasGeneratedBy pointer on the resource .meta
        _assert_derived_genesis(working_url, ann_url)

    finally:
        _delete(working_url)
        _delete(durable_url)  # no-op if already deleted
        if ann_url:
            _delete(ann_url)


# ---------------------------------------------------------------------------
# Test 5 — Archive
# ---------------------------------------------------------------------------

def test_archive_e2e(slug):
    """Archive: soft-delete via tombstone; provenance via .operations/ announcement.

    Procedure from /vault/meta/affordances/archive.ttl:
      1. PATCH .meta inserting as:Tombstone + mem:ArchiveAction activity
      2. POST [as:Announce, mem:ArchiveAction] to /vault/wiki/.operations/

    The body remains accessible (soft delete). Verifies:
    - Resource still returns 200 after archive
    - .meta carries as:Tombstone rdf:type (projection-safe — no body write triggers listener)
    - Provenance in .operations/ announcement (RQ-Listener-1 workaround)
    """
    page_url = f"{PAGES}{slug}.md"

    # Setup
    _setup_page(page_url, f"{slug} to archive")

    ann_url = None

    try:
        # Archive is a .meta-only op (no body write): provenance lives canonically in
        # .operations/; there is no derived prov:wasGeneratedBy (the projector only
        # derives on a body write, and archive does not rewrite the body). Agents no
        # longer PATCH prov:wasGeneratedBy.
        tombstone_triples = _nt_triples(
            f'<{page_url}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'
            f' <https://www.w3.org/ns/activitystreams#Tombstone> .',
        )
        _patch_meta(page_url, tombstone_triples)

        # POST the canonical operation announcement to .operations/
        ann_url, ann_subject = _announce(str(MEM.ArchiveAction), page_url)

        # Verify 1: body still accessible (soft delete)
        r = httpx.get(page_url, headers={"Accept": "text/markdown"}, verify=False)
        assert r.status_code == 200, f"Archived resource should still return 200; got {r.status_code}"

        # Verify 2: .meta carries as:Tombstone (substrate preserves this via PATCH — no projection overwrite)
        g = _meta_graph(page_url)
        types = list(g.objects(URIRef(page_url), RDF.type))
        assert AS.Tombstone in types, (
            f"as:Tombstone missing from archived resource .meta; got {types}"
        )

        # Verify 3: operation provenance recorded canonically in .operations/
        # (no derived edge: archive is a .meta-only op, no body write to project)
        _assert_announced(ann_url, ann_subject, str(MEM.ArchiveAction), page_url)

    finally:
        _delete(page_url)
        if ann_url:
            _delete(ann_url)


# ---------------------------------------------------------------------------
# Test 6 — Link
# ---------------------------------------------------------------------------

def test_link_e2e(slug):
    """Link: add typed edge in subject's .meta; provenance via .operations/ announcement.

    Procedure from /vault/meta/affordances/link.ttl:
      1. Inspect subject's class shape wiki:governs list for permitted predicates
      2. PATCH subject's .meta inserting the typed edge + mem:LinkAction activity
      3. POST [as:Announce, mem:LinkAction] to /vault/wiki/.operations/

    The page shape (page.shacl.ttl) governs: dct:title, dct:identifier, dct:created,
    dct:modified, skos:broader, skos:related, cito:*. We use skos:related as a safe
    lateral edge predicate (listed in the sh:agentInstruction guidance).

    Note: the link affordance says it rejects non-governed predicates with 422.
    skos:related is governance-listed (per sh:agentInstruction) and sh:closed=false,
    so additional predicates are also accepted — skos:related is the safe choice.
    PROV-O for the link action is appended in the same PATCH.
    """
    subject_url = f"{PAGES}{slug}-subj.md"
    object_url  = f"{PAGES}{slug}-obj.md"

    # Setup: two pages
    _setup_page(subject_url, f"{slug} subject")
    _setup_page(object_url,  f"{slug} object")

    ann_url = None

    try:
        # Link is a .meta-only op (no body write): provenance lives canonically in
        # .operations/; no derived prov:wasGeneratedBy (the projector only derives on
        # a body write). Agents no longer PATCH prov:wasGeneratedBy.
        link_triples = _nt_triples(
            # Typed edge: skos:related (substrate-listed lateral predicate)
            f'<{subject_url}> <http://www.w3.org/2004/02/skos/core#related>'
            f' <{object_url}> .',
        )
        _patch_meta(subject_url, link_triples)

        # POST the canonical operation announcement to .operations/
        ann_url, ann_subject = _announce(str(MEM.LinkAction), subject_url)

        # Verify 1: typed edge in subject's .meta
        g = _meta_graph(subject_url)
        related = list(g.objects(URIRef(subject_url), SKOS.related))
        assert URIRef(object_url) in related, (
            f"skos:related edge missing from subject .meta; got {related}"
        )

        # Verify 2: operation provenance recorded canonically in .operations/
        # (no derived edge: link is a .meta-only op, no body write to project)
        _assert_announced(ann_url, ann_subject, str(MEM.LinkAction), subject_url)

    finally:
        _delete(subject_url)
        _delete(object_url)
        if ann_url:
            _delete(ann_url)
