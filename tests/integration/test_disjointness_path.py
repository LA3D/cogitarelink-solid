"""Layer 2 disjointness: shape-validator path constraints (D99).

Layer 2 catches mem:Event PUT to /wiki/events/* and mem:Action PUT to
/wiki/procedures/* before per-resource SHACL dispatch, via pathConstraint
forbiddenClasses in shape-validator resource-store.json config.

NOTE: Task 23 (test_path_constraint_e2e.py) tests basic positive/negative cases.
This file focuses on error-message content patterns to ensure agents reading 422
responses get clear remediation hints.
"""
import os
import pytest
import httpx

POD = os.environ.get("POD_URL", "https://pod.vardeman.me/vault")

def test_mem_event_rejected_at_content_events_path_with_error_message():
    """mem:Event PUT to /wiki/events/ returns 422 with clear disjointness message."""
    body = """@prefix schema: <https://schema.org/> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .

<#this> a schema:Thing, mem:Event ;
    schema:name "wrong" ;
    schema:mainEntityOfPage <#page> .
"""
    with httpx.Client(verify=False, base_url=POD) as client:
        resp = client.put(
            "/wiki/events/test-disjoint.ttl",
            content=body,
            headers={"Content-Type": "text/turtle"},
        )
    assert resp.status_code == 422
    body_lower = resp.text.lower()
    # Error message should name the disjointness explicitly or mention the type
    assert (
        "disjoint" in body_lower
        or "mem:event" in body_lower
        or "mem#event" in body_lower
    ), f"Error response missing disjointness hint: {resp.text}"


def test_mem_action_rejected_at_procedures_path_with_error_message():
    """mem:Action PUT to /wiki/procedures/ returns 422 with clear message."""
    body = """@prefix schema: <https://schema.org/> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .

<#this> a schema:Thing, mem:Action ;
    schema:name "wrong" ;
    schema:mainEntityOfPage <#page> .
"""
    with httpx.Client(verify=False, base_url=POD) as client:
        resp = client.put(
            "/wiki/procedures/test-disjoint.ttl",
            content=body,
            headers={"Content-Type": "text/turtle"},
        )
    assert resp.status_code == 422
    body_lower = resp.text.lower()
    assert (
        "disjoint" in body_lower
        or "mem:action" in body_lower
        or "mem#action" in body_lower
    ), f"Error response missing disjointness hint: {resp.text}"
