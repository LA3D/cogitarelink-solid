"""
End-to-end test: shape-validator rejects mem:Event PUT to /wiki/events/ (D99 Layer 2).

Skipped until Phase H Task 30 rebuilds the reference Pod via apply.py with the
new pathConstraints config in shape-validation/resource-store.json.
"""
import os
import pytest
import httpx

POD = os.environ.get("POD_URL", "https://pod.vardeman.me/vault")


@pytest.mark.skip(
    reason=(
        "Requires Pod rebuild via apply.py (Phase H Task 30 / shape-validator "
        "pathConstraints config). Re-activate once the live Pod is rebuilt with "
        "the new resource-store.json that includes pathConstraints."
    )
)
def test_mem_event_rejected_at_content_events_path():
    """mem:Event PUT to /vault/wiki/events/ returns 422 with sh:ValidationReport body."""
    body = """
@prefix schema: <https://schema.org/> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .

<#this> a schema:Thing, mem:Event ;
    schema:name "wrong-place" ;
    schema:mainEntityOfPage <#page> .
"""
    with httpx.Client(verify=False) as client:
        resp = client.put(
            f"{POD}/wiki/events/test-disjoint.ttl",
            content=body,
            headers={"Content-Type": "text/turtle"},
        )
    assert resp.status_code == 422, f"Expected 422, got {resp.status_code}: {resp.text}"
    body_lower = resp.text.lower()
    assert "sh:validationreport" in body_lower or "validationreport" in body_lower
    assert "disjoint" in body_lower or "mem" in body_lower


@pytest.mark.skip(
    reason="Requires Pod rebuild via apply.py (Phase H Task 30). Re-activate then."
)
def test_schema_event_accepted_at_content_events_path():
    """schema:Event (not in forbiddenClasses) PUT to /vault/wiki/events/ passes path check."""
    body = """
@prefix schema: <https://schema.org/> .

<#this> a schema:Event ;
    schema:name "allowed event" .
"""
    with httpx.Client(verify=False) as client:
        resp = client.put(
            f"{POD}/wiki/events/test-allowed.ttl",
            content=body,
            headers={"Content-Type": "text/turtle"},
        )
    # Should not get a 422 from path constraint (may get other errors if no shape
    # is present for this container, but not a path-constraint violation)
    assert resp.status_code != 422 or "path-constraint" not in resp.text.lower()


@pytest.mark.skip(
    reason="Requires Pod rebuild via apply.py (Phase H Task 30). Re-activate then."
)
def test_mem_event_accepted_at_events_ephemeral_path():
    """mem:Event PUT to /vault/wiki/.events/ is allowed (ephemeral layer)."""
    body = """
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix schema: <https://schema.org/> .

<#this> a mem:Event ;
    schema:name "ephemeral event" .
"""
    with httpx.Client(verify=False) as client:
        resp = client.put(
            f"{POD}/wiki/.events/test-mem-event.ttl",
            content=body,
            headers={"Content-Type": "text/turtle"},
        )
    # Should not get a 422 from path constraint
    assert resp.status_code != 422 or "path-constraint" not in resp.text.lower()
