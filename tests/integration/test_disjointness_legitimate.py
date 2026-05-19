"""No false positives: legitimate writes are accepted by Layer 2 + Layer 3 (D99).

Verify that disjointness constraints do not reject legitimate writes:
- schema:Event (not mem:Event) at /wiki/events/
- schema:HowTo (not mem:Action) at /wiki/procedures/
- Markdown content with front-matter type declarations
"""
import os
import pytest
import httpx

POD = os.environ.get("POD_URL", "https://pod.vardeman.me/vault")

def test_substrate_mem_event_at_events_ephemeral_path_skipped():
    """Substrate should POST mem:Event to /wiki/.events/ (ephemeral layer).

    Skipped pending VC credential flow; until credentials land, only the
    substrate's internal write code path exercises this. Not externally testable.
    """
    pytest.skip(
        "Requires substrate-credentialed POST; reactivate when VC credentials land."
    )


def test_schema_event_at_content_events_path_accepted():
    """Sanity: a real schema:Event content page IS accepted at /wiki/events/."""
    body = """@prefix schema: <https://schema.org/> .

<#this> a schema:Event ;
    schema:name "allowed event" ;
    schema:startDate "2026-06-01" .
"""
    with httpx.Client(verify=False, base_url=POD) as client:
        resp = client.put(
            "/wiki/events/nd-visit-2026.ttl",
            content=body,
            headers={"Content-Type": "text/turtle"},
        )
    # Should not get a 422 from disjointness (may get other errors if no shape,
    # but not a path-constraint or sh:not violation)
    assert (
        resp.status_code != 422
        or "disjoint" not in resp.text.lower()
        and "mem:event" not in resp.text.lower()
    )


def test_schema_howto_at_procedures_path_accepted():
    """Sanity: a real schema:HowTo content page IS accepted at /wiki/procedures/."""
    body = """@prefix schema: <https://schema.org/> .

<#this> a schema:HowTo ;
    schema:name "Crystallize Procedure" ;
    schema:step [
        schema:position 1 ;
        schema:text "PUT draft"
    ] .
"""
    with httpx.Client(verify=False, base_url=POD) as client:
        resp = client.put(
            "/wiki/procedures/crystallize-test.ttl",
            content=body,
            headers={"Content-Type": "text/turtle"},
        )
    assert (
        resp.status_code != 422
        or "disjoint" not in resp.text.lower()
        and "mem:action" not in resp.text.lower()
    )
