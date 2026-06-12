"""SP2 Phase A: the An layer is discoverable the way SAI §3/§7 intends (owner side).

Run: SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_sp2_surfacing.py -v
"""
import httpx
import pytest
from rdflib import Graph, URIRef, Namespace

from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
INTEROP = Namespace("http://www.w3.org/ns/solid/interop#")
CARD = URIRef(f"{POD}/vault/profile/card#me")
REGSET = URIRef(f"{POD}/vault/meta/interop/registry#set")

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def _graph(path, accept="text/turtle"):
    r = httpx.get(f"{POD}{path}", headers={"Accept": accept}, verify=_CA)
    assert r.status_code == 200, f"{path}: {r.status_code}"
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=f"{POD}{path}")
    return g


def test_card_meta_carries_has_registry_set():
    g = _graph("/vault/profile/card.meta")
    assert (CARD, INTEROP.hasRegistrySet, REGSET) in g, \
        "SAI §3: hasRegistrySet must be discoverable from the dereferenced WebID"


def test_registry_covers_all_three_apps():
    g = _graph("/vault/meta/interop/registry")
    regs = set(g.objects(None, INTEROP.hasDataRegistration))
    REG = Namespace(f"{POD}/vault/meta/interop/registry#")
    assert REG["id-schemes"] in regs and REG["contacts"] in regs, f"got: {sorted(str(r) for r in regs)}"


ST = Namespace("http://www.w3.org/ns/shapetrees#")


def test_addressbook_application_declared():
    g = _graph("/vault/meta/interop/addressbook-application")
    app = URIRef(f"{POD}/vault/meta/interop/addressbook-application#addressbook")
    assert (app, INTEROP.applicationName, None) in g


def test_each_app_declares_consumption_shape():
    body = _graph("/vault/meta/shapetrees/wiki-memory.tree").serialize(format="turtle").lower()
    assert "index-shaped" in body, \
        "wiki-memory st:Description must declare its consumption shape"
    for path in ("/vault/meta/interop/id-schemes-application",
                 "/vault/meta/interop/addressbook-application"):
        body = _graph(path).serialize(format="turtle").lower()
        assert "operation-shaped" in body, \
            f"{path} must declare operation-shaped"


def test_shape_catalog_members_all_parse():
    """All shapes catalog members must parse cleanly — no scaffold placeholders."""
    g = _graph("/vault/meta/shapes/")
    LDP = Namespace("http://www.w3.org/ns/ldp#")
    members = list(g.objects(None, LDP.contains))
    assert members, "catalog empty?"
    for m in members:
        r = httpx.get(str(m), headers={"Accept": "text/turtle"}, verify=_CA)
        assert r.status_code == 200, f"{m}: {r.status_code}"
        # N3.js (solid-pod shapes) hard-fails on any unparseable member (e.g. the
        # scaffold template's bracket-placeholder IRIs); a real parse catches the
        # same class of problem, not just one known marker string.
        Graph().parse(data=r.text, format="turtle", publicID=str(m))


def test_d80_recut_no_handed_constructs():
    """D80 re-cut: hub-view and breadcrumb-view must not carry handed query artifacts.

    Post-re-cut, both descriptors point agents at the served views rather than
    handing them a CONSTRUCT/SELECT to run. The handed queries are dead surface —
    evals show agents never execute them (SP2-T6).
    """
    for name in ("hub-view.ttl", "breadcrumb-view.ttl"):
        body = _graph(f"/vault/meta/affordances/{name}").serialize(format="turtle")
        assert "constructQuery" not in body and "selectQuery" not in body, \
            f"{name}: still carries a handed query artifact (constructQuery or selectQuery)"
        assert "index.md" in body or "views/" in body or "container-index" in body, \
            f"{name}: must reference the served view (index.md / views/ / container-index)"
