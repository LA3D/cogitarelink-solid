"""PSP live contract: enrichment survives; subtraction idempotent; version stamped."""
import httpx, pytest, uuid
from rdflib import Graph, Namespace, URIRef
from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")

BODY1 = "---\ntype: Concept\nrationale: \"PSP subtraction test\"\n---\n# PSP Probe\n\n[PSP Probe]{.prefLabel} is [a subtraction test concept.]{.definition}\n\n[[Biology]]{.broader}\n"
BODY2 = BODY1.replace("a subtraction test concept", "a REVISED subtraction test concept").replace("\n\n[[Biology]]{.broader}\n", "\n")  # drops the broader edge too
N3_ENRICH = """@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<> a solid:InsertDeletePatch;
solid:inserts {{ <{this}> <https://example.org/agent#assessedBy> <https://example.org/agents/probe> . }}.
"""

def _meta(url):
    g = Graph()
    g.parse(data=httpx.get(f"{url}.meta", headers={"Accept": "text/turtle"}, verify=_CA).text,
            format="turtle", publicID=url)
    return g

# Server-managed mutable metadata CSS re-stamps on every PUT (not projection output);
# excluded from the idempotency comparison, which measures projection-triple stability.
_VOLATILE = (
    "http://purl.org/dc/terms/modified",
    "http://purl.org/dc/elements/1.1/modified",
    "http://www.w3.org/ns/posix/stat#mtime",
)

def _projection_nt(url):
    return sorted(l for l in _meta(url).serialize(format="nt").splitlines()
                  if not any(p in l for p in _VOLATILE))

def test_enrichment_survives_and_projection_updates_and_edge_dropped():
    slug = f"psp-{uuid.uuid4().hex[:8]}"
    url = f"{POD}/vault/wiki/concepts/{slug}.md"
    assert httpx.put(url, content=BODY1, headers={"Content-Type":"text/markdown"}, verify=_CA).status_code in (201,205)
    r = httpx.patch(f"{url}.meta", content=N3_ENRICH.format(this=f"{url}#this"),
                    headers={"Content-Type":"text/n3"}, verify=_CA)
    assert r.status_code in (200,205), r.text[:200]
    assert httpx.put(url, content=BODY2, headers={"Content-Type":"text/markdown"}, verify=_CA).status_code in (201,205)
    g = _meta(url)
    this = URIRef(f"{url}#this")
    assert (this, URIRef("https://example.org/agent#assessedBy"), None) in g, "enrichment clobbered"
    assert "REVISED" in g.serialize(format="turtle"), "projection not updated"
    assert (this, URIRef("http://www.w3.org/2004/02/skos/core#broader"), None) not in g, "dropped edge not removed (exact subtraction failed)"
    assert len(list(g.objects(None, SUB.projectorVersion))) == 1, "version stamp not singular"
    assert len(list(g.objects(None, SUB.bodyHash))) == 1, "bodyHash not singular"
    httpx.delete(url, verify=_CA)

def test_reput_same_body_is_meta_noop():
    slug = f"psp-{uuid.uuid4().hex[:8]}"
    url = f"{POD}/vault/wiki/concepts/{slug}.md"
    httpx.put(url, content=BODY1, headers={"Content-Type":"text/markdown"}, verify=_CA)
    before = _projection_nt(url)
    httpx.put(url, content=BODY1, headers={"Content-Type":"text/markdown"}, verify=_CA)
    after = _projection_nt(url)
    assert before == after, "re-PUT same body changed projected .meta (not idempotent)"
    httpx.delete(url, verify=_CA)

SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")

# N3 patch that swaps the floor-stamped projectorVersion for a fake OLD one, simulating a
# pre-migration resource — the input to the floor's degraded re-baseline branch
# (markdownBodyProjector.materialize, versionMatches false). The floor does NOT protect its
# own stamp against a .meta PATCH (verified live 2026-06-13), so the mangle takes; the
# migration sweep's re-PUT then drives the degraded re-baseline → re-stamp to current.
_VERSION_MANGLE = """@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<> a solid:InsertDeletePatch;
solid:deletes {{ <{subj}> <{ver}> "{real}" . }};
solid:inserts {{ <{subj}> <{ver}> "0.0.1-old" . }}.
"""

def test_old_version_reput_rebaselines_to_current():
    """The floor's old-version → degraded re-baseline path (the migration sweep's action):
    a resource carrying a stale projectorVersion, re-PUT unchanged, is re-stamped to the
    current version with its projection intact and stamps singular. Live twin of the
    markdownBodyProjector version-mismatch unit case."""
    slug = f"psp-{uuid.uuid4().hex[:8]}"
    url = f"{POD}/vault/wiki/concepts/{slug}.md"
    assert httpx.put(url, content=BODY1, headers={"Content-Type":"text/markdown"},
                     verify=_CA).status_code in (201, 205)
    g0 = _meta(url)
    real = str(list(g0.objects(None, SUB.projectorVersion))[0])
    subj = str(next(s for s, _ in g0.subject_objects(SUB.projectorVersion)))

    # Mangle the version stamp to a fake OLD value (the pre-migration state).
    pr = httpx.patch(f"{url}.meta",
                     content=_VERSION_MANGLE.format(subj=subj, ver=SUB.projectorVersion, real=real),
                     headers={"Content-Type":"text/n3"}, verify=_CA)
    assert pr.status_code in (200, 205), pr.text[:200]
    assert str(list(_meta(url).objects(None, SUB.projectorVersion))[0]) == "0.0.1-old", \
        "version mangle did not take — floor now protects its own stamp; re-examine Fix 3"

    # Re-PUT the body unchanged — the migration sweep's action — drives re-baseline.
    assert httpx.put(url, content=BODY1, headers={"Content-Type":"text/markdown"},
                     verify=_CA).status_code in (201, 205)

    g = _meta(url)
    versions = list(g.objects(None, SUB.projectorVersion))
    assert len(versions) == 1, "version stamp not singular after re-baseline"
    assert str(versions[0]) == real, f"version not re-stamped to current ({real}): {versions[0]}"
    assert len(list(g.objects(None, SUB.bodyHash))) == 1, "bodyHash not singular"
    # Body's projected triples survive the re-baseline.
    assert (None, SKOS.prefLabel, None) in g, "prefLabel projection lost on re-baseline"
    assert (None, SKOS.broader, None) in g, "broader projection lost on re-baseline"
    httpx.delete(url, verify=_CA)
