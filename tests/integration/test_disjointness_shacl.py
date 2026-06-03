"""Layer 3 disjointness: SHACL sh:not constraints in shapes (D99).

Layer 3 applies per-resource SHACL shape validation after path constraint.
Shapes declare sh:not constraints to forbid multi-typing of schema:Event
and mem:Event, schema:HowTo and mem:Action.

These tests verify that even at the correct path, prohibited multi-types
are rejected by SHACL at validation time.
"""
import os
import pytest
import httpx

from tests.conftest import _pod_base, resolve_ca as _resolve_ca

POD = _pod_base() + "/vault"
_CA = _resolve_ca() or False

def test_event_multitype_schema_event_and_mem_event_rejected():
    """Multi-typing schema:Event + mem:Event is rejected by SHACL sh:not."""
    body = """@prefix schema: <https://schema.org/> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .

<#this> a schema:Thing, schema:Event, mem:Event ;
    schema:name "Bad multitype" ;
    schema:mainEntityOfPage <#page> .
"""
    with httpx.Client(verify=_CA, base_url=POD) as client:
        resp = client.put(
            "/wiki/events/multitype-bad.ttl",
            content=body,
            headers={"Content-Type": "text/turtle"},
        )
    assert resp.status_code == 422


def test_howto_multitype_schema_howto_and_mem_action_rejected():
    """Multi-typing schema:HowTo + mem:Action is rejected by SHACL sh:not."""
    body = """@prefix schema: <https://schema.org/> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .

<#this> a schema:Thing, schema:HowTo, mem:Action ;
    schema:name "Bad multitype" ;
    schema:mainEntityOfPage <#page> .
"""
    with httpx.Client(verify=_CA, base_url=POD) as client:
        resp = client.put(
            "/wiki/procedures/multitype-bad.ttl",
            content=body,
            headers={"Content-Type": "text/turtle"},
        )
    assert resp.status_code == 422
