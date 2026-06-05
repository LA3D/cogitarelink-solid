from pathlib import Path
from pyshacl import validate
from rdflib import Graph, URIRef

ROOT = Path(__file__).parent.parent
SHAPE = ROOT / "shapes" / "substrate" / "scheme-record.shacl.ttl"
SEEDS = ROOT / "overlays" / "identifier-schemes" / "schemes"
KEYS = ["doi", "orcid", "ror", "arxiv", "citekey", "did", "did-oyd", "solid-resource"]
BASE = "https://pod.vardeman.me/id/schemes/"

def test_all_eight_seeds_exist():
    assert sorted(p.stem for p in SEEDS.glob("*.ttl")) == sorted(KEYS)

def test_each_seed_conforms_to_shape():
    sg = Graph().parse(SHAPE, format="turtle")
    for k in KEYS:
        dg = Graph().parse(SEEDS / f"{k}.ttl", format="turtle", publicID=f"{BASE}{k}")
        ok, _, report = validate(dg, shacl_graph=sg, inference="none")
        assert ok, f"{k}: {report}"

def test_each_topic_is_catalog_fragment():
    for k in KEYS:
        dg = Graph().parse(SEEDS / f"{k}.ttl", format="turtle", publicID=f"{BASE}{k}")
        topic = next(dg.objects(URIRef(f"{BASE}{k}"),
                     URIRef("http://xmlns.com/foaf/0.1/primaryTopic")))
        assert str(topic) == f"{BASE}#{k}", f"{k} topic is {topic} — hazard!"

def test_roles_doc_parses_with_four_roles():
    g = Graph().parse(ROOT / "overlays" / "identifier-schemes" / "roles.ttl",
                      format="turtle", publicID="https://pod.vardeman.me/id/roles")
    for r in ("landing-page", "metadata-record", "did-document", "the-resource"):
        assert (URIRef(f"https://pod.vardeman.me/id/roles#{r}"), None, None) in g
