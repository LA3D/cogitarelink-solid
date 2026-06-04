"""Unit tests for audit_type_index — offline, fixture graphs only.

Five scenarios:
  A. 8-container valid Type Index → no findings.
  B. forClass is a literal → WARN typeindex:forClass-literal.
  C. instanceContainer same-origin but outside storage root → WARN typeindex:container-outside-root
     (D100: L4 extension contract allows any same-origin path; this is notable, not a violation).
  C2. instanceContainer on a different origin → ERROR typeindex:container-outside-root
      (off-origin IS an integrity violation).
  D. Dup-container conflict (same container, two classes) → WARN typeindex:dup-container-conflict.
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
import rdflib
from rdflib import Graph, Literal, URIRef, RDF, Namespace

from scripts.pod_audit import audit_type_index, SOLID

CANON_BASE = "https://pod.vardeman.me/vault/"
POD_BASE   = "https://pod.vardeman.me/vault/"
STORAGE    = URIRef(CANON_BASE)


def _sd_g_with_type_index(ti_iri: str) -> Graph:
    g = Graph()
    g.add((STORAGE, RDF.type,
           URIRef("http://www.w3.org/ns/pim/space#Storage")))
    g.add((STORAGE, URIRef(SOLID + "publicTypeIndex"), URIRef(ti_iri)))
    return g


def _ti_ttl(*registrations: str) -> str:
    """Build a minimal Type Index Turtle document from individual registration strings."""
    prefixes = (
        "@prefix solid: <http://www.w3.org/ns/solid/terms#> .\n"
        "@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n"
    )
    return prefixes + "\n".join(registrations)


def _mock_client_returning(ti_url: str, ti_body: str, container_code: int = 200):
    """Async mock client: GET <ti_url> → ti_body (200); HEAD/GET any other URL → container_code."""
    async def get(url, **kwargs):
        r = MagicMock()
        if url == ti_url:
            r.status_code = 200
            r.text = ti_body
        else:
            r.status_code = 404
        return r

    async def head(url, **kwargs):
        r = MagicMock()
        r.status_code = container_code
        return r

    client = MagicMock()
    client.get = get
    client.head = head
    return client


TI_URL = CANON_BASE + "settings/publicTypeIndex"
SD_G   = _sd_g_with_type_index(TI_URL)


# ---------------------------------------------------------------------------
# A — Valid 8-container Type Index
# ---------------------------------------------------------------------------
def _valid_8_container_ttl():
    classes = [
        "https://pod.vardeman.me/vault/ontology/wiki#Concept",
        "https://pod.vardeman.me/vault/ontology/wiki#Source",
        "https://pod.vardeman.me/vault/ontology/wiki#Person",
        "https://pod.vardeman.me/vault/ontology/wiki#HowTo",
        "https://pod.vardeman.me/vault/ontology/wiki#Organization",
        "https://pod.vardeman.me/vault/ontology/wiki#Place",
        "https://pod.vardeman.me/vault/ontology/wiki#Event",
        "https://pod.vardeman.me/vault/ontology/wiki#WorkingNote",
    ]
    containers = [
        CANON_BASE + "wiki/concepts/",
        CANON_BASE + "wiki/sources/",
        CANON_BASE + "wiki/people/",
        CANON_BASE + "wiki/procedures/",
        CANON_BASE + "wiki/organizations/",
        CANON_BASE + "wiki/places/",
        CANON_BASE + "wiki/events/",
        CANON_BASE + "wiki/working/",
    ]
    regs = []
    for i, (cls, ctr) in enumerate(zip(classes, containers)):
        regs.append(
            f"<#reg{i}> a solid:TypeRegistration ;\n"
            f"  solid:forClass <{cls}> ;\n"
            f"  solid:instanceContainer <{ctr}> ."
        )
    return _ti_ttl(*regs)


def test_valid_8_container_no_findings():
    body = _valid_8_container_ttl()
    client = _mock_client_returning(TI_URL, body, container_code=200)
    findings = []
    asyncio.run(audit_type_index(client, SD_G, STORAGE, CANON_BASE, POD_BASE, findings))
    errors = [f for f in findings if f["severity"] == "ERROR"]
    warns  = [f for f in findings if f["severity"] == "WARN"
              and "typeindex:" in f["constraint"]]
    assert not errors, f"Expected no ERRORs, got: {errors}"
    assert not warns,  f"Expected no typeindex WARNs, got: {warns}"


# ---------------------------------------------------------------------------
# B — forClass is a literal
# ---------------------------------------------------------------------------
def test_forclass_literal_warns():
    body = _ti_ttl(
        '<#reg1> a solid:TypeRegistration ;\n'
        '  solid:forClass "wiki:Concept" ;\n'          # literal — wrong
        f'  solid:instanceContainer <{CANON_BASE}wiki/concepts/> .'
    )
    client = _mock_client_returning(TI_URL, body, container_code=200)
    findings = []
    asyncio.run(audit_type_index(client, SD_G, STORAGE, CANON_BASE, POD_BASE, findings))
    assert any(
        f["severity"] == "WARN" and "forClass-literal" in f["constraint"]
        for f in findings
    ), f"Expected WARN typeindex:forClass-literal, got: {findings}"


# ---------------------------------------------------------------------------
# C — instanceContainer same-origin but outside storage root → WARN (D100)
# ---------------------------------------------------------------------------
def test_container_outside_root_same_origin_warns():
    """D100: L4 extension contract allows any same-origin path. WARN, not ERROR."""
    body = _ti_ttl(
        '<#reg1> a solid:TypeRegistration ;\n'
        '  solid:forClass <https://pod.vardeman.me/vault/ontology/wiki#Concept> ;\n'
        '  solid:instanceContainer <https://pod.vardeman.me/biz/equipment/> .'  # same host, outside /vault/
    )
    client = _mock_client_returning(TI_URL, body, container_code=200)
    findings = []
    asyncio.run(audit_type_index(client, SD_G, STORAGE, CANON_BASE, POD_BASE, findings))
    assert any(
        f["severity"] == "WARN" and "container-outside-root" in f["constraint"]
        for f in findings
    ), f"Expected WARN typeindex:container-outside-root (D100), got: {findings}"
    assert not any(
        f["severity"] == "ERROR" and "container-outside-root" in f["constraint"]
        for f in findings
    ), f"Expected no ERROR for same-origin outside-root (D100 allows it), got: {findings}"


# ---------------------------------------------------------------------------
# C2 — instanceContainer on a different origin → ERROR (integrity violation)
# ---------------------------------------------------------------------------
def test_container_outside_root_off_origin_errors():
    """Off-origin registration IS an integrity violation — ERROR."""
    body = _ti_ttl(
        '<#reg1> a solid:TypeRegistration ;\n'
        '  solid:forClass <https://pod.vardeman.me/vault/ontology/wiki#Concept> ;\n'
        '  solid:instanceContainer <https://evil.example.org/containers/stolen/> .'  # different host
    )
    client = _mock_client_returning(TI_URL, body, container_code=200)
    findings = []
    asyncio.run(audit_type_index(client, SD_G, STORAGE, CANON_BASE, POD_BASE, findings))
    assert any(
        f["severity"] == "ERROR" and "container-outside-root" in f["constraint"]
        for f in findings
    ), f"Expected ERROR typeindex:container-outside-root (off-origin), got: {findings}"


# ---------------------------------------------------------------------------
# D — Dup-container conflict (same container, two different classes)
# ---------------------------------------------------------------------------
def test_dup_container_conflict_warns():
    shared_ctr = CANON_BASE + "wiki/shared/"
    body = _ti_ttl(
        f'<#reg1> a solid:TypeRegistration ;\n'
        f'  solid:forClass <https://pod.vardeman.me/vault/ontology/wiki#Concept> ;\n'
        f'  solid:instanceContainer <{shared_ctr}> .',
        f'<#reg2> a solid:TypeRegistration ;\n'
        f'  solid:forClass <https://pod.vardeman.me/vault/ontology/wiki#Source> ;\n'
        f'  solid:instanceContainer <{shared_ctr}> .',
    )
    client = _mock_client_returning(TI_URL, body, container_code=200)
    findings = []
    asyncio.run(audit_type_index(client, SD_G, STORAGE, CANON_BASE, POD_BASE, findings))
    assert any(
        f["severity"] == "WARN" and "dup-container-conflict" in f["constraint"]
        for f in findings
    ), f"Expected WARN typeindex:dup-container-conflict, got: {findings}"


# ---------------------------------------------------------------------------
# Extra: 404 container → WARN container-unreachable
# ---------------------------------------------------------------------------
def test_absent_container_warns():
    body = _ti_ttl(
        '<#reg1> a solid:TypeRegistration ;\n'
        '  solid:forClass <https://pod.vardeman.me/vault/ontology/wiki#Concept> ;\n'
        f'  solid:instanceContainer <{CANON_BASE}wiki/concepts/> .'
    )
    client = _mock_client_returning(TI_URL, body, container_code=404)
    findings = []
    asyncio.run(audit_type_index(client, SD_G, STORAGE, CANON_BASE, POD_BASE, findings))
    assert any(
        f["severity"] == "WARN" and "container-unreachable" in f["constraint"]
        for f in findings
    ), f"Expected WARN typeindex:container-unreachable, got: {findings}"
