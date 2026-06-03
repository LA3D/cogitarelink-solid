"""Verify CSS returns SHACL ValidationReport on shape violations.

Blocker check for Task 1 of the addressbook-substrate plan:
the agentic-substrate pattern requires SHACL rejection to return a
parseable ValidationReport so agents can self-correct.

Setup: the ShapeValidationStore only gates writes when the parent
container has ldp:constrainedBy in its .meta.  No existing container
has this set, so the test creates a scratch container, patches its
.meta to add ldp:constrainedBy pointing at resource.shacl.ttl, then
tries to PUT a wiki:Resource subclass (wiki:Concept) with no required
predicates (dct:title, dct:created, dct:modified, dct:identifier).
"""
import httpx
import pytest
from rdflib import Graph, Namespace

from tests.conftest import _pod_base, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base() + "/vault/"
SHAPE_URL = f"{_pod_base()}/vault/meta/shapes/page.shacl.ttl"
SH = Namespace("http://www.w3.org/ns/shacl#")

# Resource that violates wiki:PageShape — wiki:Page without dct:title (minCount 1).
BAD_CONCEPT = """\
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<#this> a wiki:Page .
"""

# N3 Patch to add ldp:constrainedBy to a container's .meta
PATCH_CONSTRAINED_BY = """\
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .

<> a solid:InsertDeletePatch ;
   solid:inserts {{
       <{container_url}> ldp:constrainedBy <{shape_url}> .
   }} .
"""


def _put_container(url: str) -> httpx.Response:
    return httpx.put(
        url, content="", headers={"Content-Type": "text/turtle"}, verify=_CA
    )


def _patch_meta(meta_url: str, container_url: str, shape_url: str) -> httpx.Response:
    patch_body = PATCH_CONSTRAINED_BY.format(
        container_url=container_url, shape_url=shape_url
    )
    return httpx.patch(
        meta_url,
        content=patch_body,
        headers={"Content-Type": "text/n3"},
        verify=_CA,
    )


def _put_resource(url: str, body: str) -> httpx.Response:
    return httpx.put(
        url, content=body, headers={"Content-Type": "text/turtle"}, verify=_CA
    )


def _delete(url: str) -> None:
    httpx.delete(url, verify=_CA)


def test_shacl_violation_returns_readable_report():
    """Writing data that violates an existing shape via a constrained container.

    Three expected outcomes (checked in order):
    1. PASS: 4xx response with RDF body containing sh:ValidationReport.
    2. FAIL (2xx): shape-validator not gating writes — misconfiguration.
    3. FAIL (4xx but not RDF): gating works but body is plain-text error.
       This is the current behavior — see DONE_WITH_CONCERNS in task report.
    """
    scratch_ctr = POD + "_test_shacl_scratch/"
    scratch_meta = scratch_ctr + ".meta"
    scratch_resource = scratch_ctr + "_test_bad_concept.ttl"

    # Step 1: create scratch container
    r = _put_container(scratch_ctr)
    assert r.status_code in (200, 201, 205), (
        f"Could not create scratch container: {r.status_code} {r.text[:200]}"
    )

    try:
        # Step 2: add ldp:constrainedBy to the container .meta
        r = _patch_meta(scratch_meta, scratch_ctr, SHAPE_URL)
        assert r.status_code in (200, 201, 205), (
            f"Could not PATCH .meta to add ldp:constrainedBy: {r.status_code} {r.text[:200]}"
        )

        # Step 3: verify constrainedBy is now present
        r = httpx.head(scratch_ctr, verify=_CA)
        link_header = r.headers.get("link", "")
        assert "constrainedBy" in link_header, (
            f"Expected ldp:constrainedBy in Link header after PATCH, got: {link_header}"
        )

        # Step 4: PUT a resource that violates wiki:ResourceShape
        r = _put_resource(scratch_resource, BAD_CONCEPT)

        # Primary assertion: must be rejected (4xx)
        assert r.status_code in (400, 409, 422), (
            f"Expected 4xx from shape-validator, got {r.status_code}: {r.text[:200]}"
        )

        # Secondary assertion: response should be RDF with sh:ValidationReport
        ct = r.headers.get("content-type", "")
        assert "turtle" in ct or "ld+json" in ct, (
            f"Expected RDF response body (text/turtle or application/ld+json), "
            f"got Content-Type: {ct!r}. "
            f"Body excerpt: {r.text[:300]!r}. "
            "Current CSS ShaclValidator throws BadRequestHttpError with plain-text — "
            "no sh:ValidationReport is emitted. Tasks 9-13 need a wrapper extension."
        )

        g = Graph().parse(
            data=r.text, format=ct.split(";")[0].strip()
        )
        reports = list(g.subjects(predicate=None, object=SH.ValidationReport))
        assert reports, "Expected at least one sh:ValidationReport in response"

    finally:
        _delete(scratch_resource)
        _delete(scratch_ctr)
