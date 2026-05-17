"""owner-identity overlay end-to-end against live Pod."""
import httpx
import pytest
from rdflib import Graph, Namespace, URIRef

POD = "https://pod.vardeman.me/vault/"
DCT  = Namespace("http://purl.org/dc/terms/")
LDP  = Namespace("http://www.w3.org/ns/ldp#")
TMPL = Namespace("https://pod.vardeman.me/vault/ontology/template#")
CAP  = Namespace("https://pod.vardeman.me/vault/ontology/capability#")

CLIENT = httpx.Client(verify=False, timeout=10)


def _fetch_ttl(url: str) -> Graph:
    r = CLIENT.get(url, headers={"Accept": "text/turtle"})
    r.raise_for_status()
    return Graph().parse(data=r.text, format="turtle", publicID=url)


def test_owner_identity_overlay_artifacts_dereference():
    for path in [
        "ontology/owner-prefs",
        "meta/shapes/webid-profile.shacl.ttl",
        "meta/shapes/pod-owner-preferences.shacl.ttl",
        "meta/templates/webid-enrich.ttl",
        "meta/templates/prefs-init.ttl",
        "meta/capabilities/pod-owner-identity.ttl",
        "meta/capabilities/webid-profile-shape.ttl",
        "meta/capabilities/pod-owner-preferences-shape.ttl",
        "meta/capabilities/webid-enrich-template.ttl",
        "meta/capabilities/prefs-init-template.ttl",
    ]:
        r = CLIENT.get(POD + path, headers={"Accept": "text/turtle"})
        assert r.status_code == 200, f"{path} -> HTTP {r.status_code}"


def test_profile_card_meta_advertises_shape():
    """/vault/profile/card.meta should carry dct:conformsTo + ldp:constrainedBy
    pointing at PodOwnerWebIDShape (applied by step 11b of apply.py)."""
    g = _fetch_ttl(POD + "profile/card.meta")
    card = URIRef(POD + "profile/card")
    shape = URIRef(POD + "meta/shapes/webid-profile.shacl.ttl#PodOwnerWebIDShape")
    assert (card, DCT.conformsTo, shape) in g, \
        f"profile/card.meta missing dct:conformsTo PodOwnerWebIDShape"
    assert (card, LDP.constrainedBy, shape) in g, \
        f"profile/card.meta missing ldp:constrainedBy PodOwnerWebIDShape"


def test_webid_enrich_template_has_target_resource():
    g = _fetch_ttl(POD + "meta/templates/webid-enrich.ttl")
    ops = list(g.objects(predicate=TMPL.operation))
    assert ops and str(ops[0]) == "PATCH"
    tgts = list(g.objects(predicate=TMPL.targetResource))
    assert tgts and str(tgts[0]).endswith("/profile/card")
