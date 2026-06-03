"""Phase C.15 — /vault/wiki/.operations/ announcement log integration tests.

Verifies that agents can POST as:Announce activities multi-typed with
mem:*Action classes to the operations log, that LDP listing reflects
those entries, and that the container's .meta carries the correct
substrate self-description.
"""
import time
import uuid
import httpx
import pytest
from rdflib import Graph, URIRef, Namespace
from rdflib.namespace import RDF

from tests.conftest import _pod_base, resolve_ca as _resolve_ca

_CA        = _resolve_ca() or False
POD        = _pod_base() + "/vault/"
OPERATIONS = f"{POD}wiki/.operations/"
EVENTS     = f"{POD}wiki/.events/"

MEM = Namespace(f"{_pod_base()}/vault/ontology/mem#")
AS  = Namespace("https://www.w3.org/ns/activitystreams#")
DCT = Namespace("http://purl.org/dc/terms/")


@pytest.fixture
def slug():
    return f"test-{uuid.uuid4().hex[:8]}"


def test_operations_log_accepts_announcement(slug):
    """Agent can write a [as:Announce, mem:CrystallizeAction] activity to .operations/."""
    url = f"{OPERATIONS}{slug}.ttl"
    body = f"""@prefix as:   <https://www.w3.org/ns/activitystreams#> .
@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

<urn:uuid:{uuid.uuid4()}> a as:Announce, mem:CrystallizeAction ;
    as:actor <https://pod.vardeman.me/profile/card#me> ;
    prov:wasAssociatedWith <urn:agent:claude-code> ;
    as:object <{POD}wiki/pages/test.md> ;
    as:target <{OPERATIONS}> ;
    as:published "{time.strftime('%Y-%m-%dT%H:%M:%SZ')}"^^xsd:dateTime .
"""
    r = httpx.put(url, content=body,
                  headers={"Content-Type": "text/turtle"}, verify=_CA)
    assert r.status_code in (201, 204, 205), (
        f"PUT failed: {r.status_code} {r.text[:200]}"
    )
    httpx.delete(url, verify=_CA)


def test_operations_log_listing(slug):
    """GET /vault/wiki/.operations/ returns LDP container with ldp:contains for entries."""
    url = f"{OPERATIONS}{slug}.ttl"
    body = f"""@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
<urn:uuid:{uuid.uuid4()}> a as:Announce, mem:CrystallizeAction ;
    as:actor <https://pod.vardeman.me/profile/card#me> .
"""
    httpx.put(url, content=body,
              headers={"Content-Type": "text/turtle"}, verify=_CA)

    r = httpx.get(OPERATIONS, headers={"Accept": "text/turtle"}, verify=_CA)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=OPERATIONS)
    LDP_CONTAINS = URIRef("http://www.w3.org/ns/ldp#contains")
    entries = [str(e) for e in g.objects(predicate=LDP_CONTAINS)]
    assert url in entries, (
        f"Posted announcement not in container's ldp:contains: {entries}"
    )
    httpx.delete(url, verify=_CA)


def test_operations_log_meta_advertises_purpose():
    """.operations/ container .meta carries dct:title 'Wiki-memory operation log'."""
    r = httpx.get(f"{OPERATIONS}.meta",
                  headers={"Accept": "text/turtle"}, verify=_CA)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=OPERATIONS)
    DCT_TITLE = URIRef("http://purl.org/dc/terms/title")
    titles = list(g.objects(predicate=DCT_TITLE))
    assert any("operation log" in str(t).lower() for t in titles), (
        f"dct:title missing or wrong — got: {[str(t) for t in titles]}"
    )
    # sh:agentInstruction should be present (substrate self-description)
    SHACL_AI = URIRef("http://www.w3.org/ns/shacl#agentInstruction")
    instructions = list(g.objects(predicate=SHACL_AI))
    assert len(instructions) >= 1, (
        "sh:agentInstruction missing from .operations/ container .meta"
    )
