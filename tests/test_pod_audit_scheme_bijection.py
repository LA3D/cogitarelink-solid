"""Unit tests for scheme_bijection_findings — offline, fixture graphs only.

The derived identifier-scheme catalog (D111) must satisfy a bijection: every
catalog entry (subject with foaf:isPrimaryTopicOf) ↔ a record whose
foaf:primaryTopic points back. The async walker does the GETs; the pure function
does the set-logic, so it is testable offline.

Scenarios:
  A. Healthy 1:1 catalog → no findings.
  B. Orphan entry (entry with no backing record-topic) → ERROR entry-without-record.
  C. Orphan record-topic (record points at an entry absent from the catalog) → ERROR record-without-entry.
"""
from rdflib import Graph, URIRef

from scripts.pod_audit import scheme_bijection_findings, FOAF

CAT = "https://pod.vardeman.me/id/schemes/"
IS_PRIMARY_TOPIC_OF = URIRef(FOAF + "isPrimaryTopicOf")


def _catalog_g(*entries: str) -> Graph:
    "Catalog graph: each entry IRI carries foaf:isPrimaryTopicOf its record."
    g = Graph()
    for e in entries:
        g.add((URIRef(CAT + "#" + e), IS_PRIMARY_TOPIC_OF, URIRef(CAT + e)))
    return g


def _topics(*entries: str) -> list[str]:
    "The foaf:primaryTopic objects a record GET would yield (the entry IRIs)."
    return [CAT + "#" + e for e in entries]


def test_healthy_bijection_no_findings():
    cat_g = _catalog_g("doi", "orcid", "ror")
    findings = scheme_bijection_findings(cat_g, _topics("doi", "orcid", "ror"))
    assert findings == [], f"Expected no findings, got: {findings}"


def test_orphan_entry_errors():
    "Hand-edited entry with no backing record → entry-without-record ERROR."
    cat_g = _catalog_g("doi", "orcid", "bogus")  # bogus has no record
    findings = scheme_bijection_findings(cat_g, _topics("doi", "orcid"))
    assert any(
        f["severity"] == "ERROR"
        and f["constraint"] == "scheme:entry-without-record"
        and "bogus" in f["location"]
        for f in findings
    ), f"Expected ERROR scheme:entry-without-record for #bogus, got: {findings}"


def test_orphan_record_topic_errors():
    "Record points at an entry missing from the derived catalog → record-without-entry ERROR."
    cat_g = _catalog_g("doi", "orcid")
    findings = scheme_bijection_findings(cat_g, _topics("doi", "orcid", "ghost"))
    assert any(
        f["severity"] == "ERROR"
        and f["constraint"] == "scheme:record-without-entry"
        and "ghost" in f["location"]
        for f in findings
    ), f"Expected ERROR scheme:record-without-entry for #ghost, got: {findings}"


def test_both_directions_in_one_pass():
    "An orphan entry AND an orphan record-topic both fire in a single pass."
    cat_g = _catalog_g("doi", "stale-entry")        # stale-entry has no record
    findings = scheme_bijection_findings(cat_g, _topics("doi", "stale-record"))  # stale-record absent from catalog
    constraints = {f["constraint"] for f in findings if f["severity"] == "ERROR"}
    assert "scheme:entry-without-record" in constraints
    assert "scheme:record-without-entry" in constraints
