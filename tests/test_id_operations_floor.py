"""D112 Task-5 floor tests: /id/.operations/ ledger + CurationProposalShape.

Covers:
  - container exists and is accessible (200)
  - shape document served and parseable
  - conformant proposal accepted (201)
  - plan-undeclared body rejected (422)
  - rationale-missing body rejected (422)
"""
import httpx
import pytest
from rdflib import Graph

from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA  = _resolve_ca() or False
POD  = _pod_base()
MEM  = f"{POD}/vault/ontology/mem#"
OPS  = f"{POD}/id/.operations/"
SHAPE = f"{POD}/id/curation-proposal.shacl.ttl"

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def _get(url, **kw):
    return httpx.get(url, verify=_CA, **kw)

def _post(url, body, ct="text/turtle", **kw):
    hdrs = {"Content-Type": ct, **kw.pop("headers", {})}
    return httpx.post(url, content=body, headers=hdrs, verify=_CA, **kw)

def _delete(url):
    return httpx.delete(url, verify=_CA)


_CONFORMANT_BODY = """\
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <{mem}> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce , mem:RealignAction , prov:Activity ;
    as:object <{pod}/id/schemes/doi> ;
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    mem:rationale "e2e floor probe." ;
    prov:qualifiedAssociation [ a prov:Association ;
        prov:agent <urn:agent:pytest> ;
        prov:hadPlan <{pod}/vault/meta/affordances/curation.ttl> ] ;
    as:published "2026-06-05T12:00:00Z"^^xsd:dateTime .
"""

_NO_PLAN_BODY = """\
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <{mem}> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce , mem:RealignAction , prov:Activity ;
    as:object <{pod}/id/schemes/doi> ;
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    mem:rationale "e2e floor probe — no plan." ;
    as:published "2026-06-05T12:00:00Z"^^xsd:dateTime .
"""

_NO_RATIONALE_BODY = """\
@prefix as:     <https://www.w3.org/ns/activitystreams#> .
@prefix mem:    <{mem}> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce , mem:RealignAction , prov:Activity ;
    as:object <{pod}/id/schemes/doi> ;
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    prov:qualifiedAssociation [ a prov:Association ;
        prov:agent <urn:agent:pytest> ;
        prov:hadPlan <{pod}/vault/meta/affordances/curation.ttl> ] ;
    as:published "2026-06-05T12:00:00Z"^^xsd:dateTime .
"""


def test_container_exists():
    r = _get(OPS, headers={"Accept": "text/turtle"})
    assert r.status_code == 200, f"container GET {r.status_code}: {r.text[:300]}"


def test_shape_document_served():
    r = _get(SHAPE)
    assert r.status_code == 200, f"shape doc GET {r.status_code}: {r.text[:300]}"
    g = Graph()
    try:
        g.parse(data=r.text, format="turtle", publicID=SHAPE)
    except Exception as e:
        pytest.fail(f"shape doc is not parseable Turtle: {e}\n{r.text[:300]}")
    assert len(g) > 0, "shape document parsed to empty graph"


def test_conformant_proposal_201():
    body = _CONFORMANT_BODY.format(pod=POD, mem=MEM)
    r = _post(OPS, body, headers={"Slug": "d112-t5-floor-probe"})
    assert r.status_code == 201, f"conformant POST {r.status_code}: {r.text[:400]}"
    loc = r.headers.get("location", "")
    assert loc, "201 but no Location header"
    try:
        pass  # nothing else to verify — existence of 201 + Location is sufficient
    finally:
        if loc:
            _delete(loc)


def test_plan_undeclared_422():
    body = _NO_PLAN_BODY.format(pod=POD, mem=MEM)
    r = _post(OPS, body, headers={"Slug": "d112-t5-no-plan"})
    assert r.status_code == 422, (
        f"expected 422 for plan-undeclared body, got {r.status_code}: {r.text[:400]}")


def test_rationale_missing_422():
    body = _NO_RATIONALE_BODY.format(pod=POD, mem=MEM)
    r = _post(OPS, body, headers={"Slug": "d112-t5-no-rationale"})
    assert r.status_code == 422, (
        f"expected 422 for rationale-missing body, got {r.status_code}: {r.text[:400]}")
