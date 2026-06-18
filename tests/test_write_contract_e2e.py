"""Live: the injected sub:WriteContractShape gates the wiki durable lane on mem:rationale,
required on the document subject <> (foaf:Document) — the uniform write-contract hook.

The shape comes ONLY from the ShapeTree-derived constrainedBy injection (no per-app
re-declaration); the projection types <> a foaf:Document and rebinds rationale: frontmatter
to <>, so the requirement and the value land on the same subject (fixes the markdown-lane
subject mismatch by construction).

Run: SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem pytest tests/test_write_contract_e2e.py -v
"""
import httpx
import pytest
from rdflib import Graph, URIRef

from tests.conftest import _pod_base, _pod_up, resolve_ca as _ca

CA = _ca() or False
POD = _pod_base()
MEM_RATIONALE = URIRef("https://pod.vardeman.me/vault/ontology/mem#rationale")
FOAF_DOCUMENT = URIRef("http://xmlns.com/foaf/0.1/Document")

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def _put(path, body, ct="text/markdown"):
    return httpx.put(f"{POD}{path}", content=body, headers={"Content-Type": ct}, verify=CA)


def _get(path, **kw):
    return httpx.get(f"{POD}{path}", verify=CA, **kw)


def test_wiki_concept_without_rationale_rejected_422():
    body = "---\ntype: concept\n---\n# No Rationale\n\n[No Rationale]{.prefLabel} body.\n"
    r = _put("/vault/wiki/concepts/e2e-wc-norat.md", body)
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:200]}"
    assert "rationale" in r.text


def test_rejected_write_leaves_no_artifacts():
    _put("/vault/wiki/concepts/e2e-wc-norat2.md", "---\ntype: concept\n---\n# N2\n\n[N2]{.prefLabel} b.\n")
    assert _get("/vault/wiki/concepts/e2e-wc-norat2.md").status_code == 404


def test_wiki_concept_with_rationale_commits_and_materializes_on_document_subject():
    body = ("---\ntype: concept\n"
            "rationale: \"Authored in the e2e to verify the injected write contract.\"\n"
            "---\n# With Rationale\n\n[With Rationale]{.prefLabel} body.\n")
    r = _put("/vault/wiki/concepts/e2e-wc-ok.md", body)
    assert r.status_code in (201, 205), f"expected commit, got {r.status_code}: {r.text[:200]}"
    base = f"{POD}/vault/wiki/concepts/e2e-wc-ok.md"
    m = _get("/vault/wiki/concepts/e2e-wc-ok.md.meta", headers={"Accept": "text/turtle"})
    g = Graph(); g.parse(data=m.text, format="turtle", publicID=base)
    # both the contract hook and the value land on the document subject <>
    assert (URIRef(base), URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), FOAF_DOCUMENT) in g
    assert (URIRef(base), MEM_RATIONALE, None) in g


def test_working_note_without_rationale_is_permissive():
    body = "---\ntype: concept\n---\n# Draft\n\n[Draft]{.prefLabel} drafting, no rationale.\n"
    r = _put("/vault/wiki/working/e2e-wc-draft.md", body)
    assert r.status_code in (201, 205), f"working/ must stay permissive (D73), got {r.status_code}"
