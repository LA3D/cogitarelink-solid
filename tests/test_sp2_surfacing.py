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
