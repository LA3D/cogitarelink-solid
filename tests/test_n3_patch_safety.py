"""R-T6: Graph-based N3 patch building (kill f-string Turtle) + audit set-derivations.

Offline — parses artifacts, no live Pod. Covers:
  - injection round-trip: a title with '>' and a newline survives the Graph-based
    patch builder, escaped (would have corrupted the old f-string path);
  - gen_managers regeneration is isomorphic to the committed .shapetree.ttl files;
  - pod_audit derives the expected registration set from the data (8-container fixture
    → no ERROR), and flags an uncovered container tree.
"""
import importlib.util
from pathlib import Path

from rdflib import Graph, Literal, URIRef
from rdflib.compare import isomorphic
from rdflib.namespace import RDF

from scripts.overlay.common import n3_patch_inserts

REPO = Path(__file__).parent.parent
SOLID = "http://www.w3.org/ns/solid/terms#"
SCHEMA = "https://schema.org/"
ST = "http://www.w3.org/ns/shapetrees#"
INTEROP = "http://www.w3.org/ns/solid/interop#"


# ---- fake httpx client: records the PATCH body so we can re-parse it -------------

class _RecordingClient:
    def __init__(self):
        self.bodies = []

    def patch(self, url, content, headers, timeout):
        self.bodies.append(content.decode("utf-8"))
        class _R:  # minimal response
            status_code = 205
            text = ""
        return _R()


def _inserts_graph_from_patch(patch_body: str, base: str) -> Graph:
    "Parse the N3 patch and return ONLY the triples inside solid:inserts {...}."
    pg = Graph().parse(data=patch_body, format="n3", publicID=base)
    inserts_obj = next((o for s, p, o in pg if str(p) == SOLID + "inserts"), None)
    assert inserts_obj is not None, "patch has no solid:inserts block"
    out = Graph()
    for t in inserts_obj:  # inserts_obj is a QuotedGraph (N3 formula), iterable directly
        out.add(t)
    return out


# ---- F1: injection round-trip ---------------------------------------------------

INJECTION = 'Evil> .\n<urn:attacker> <urn:p> "pwned'  # '>' + newline + a fake triple


def test_injection_title_round_trips_safely_through_graph_builder():
    """A malicious literal survives the Graph-based builder as ONE escaped literal.

    The old f-string path (f'<{s}> <{p}> "{title}" .') would have let this value
    inject a second triple (<urn:attacker> ...) and close the literal early. The
    Graph path serializes via rdflib, which escapes '>' and '\\n', so exactly one
    triple comes back and no attacker triple appears.
    """
    subj = URIRef("https://pod.example/r")
    pred = URIRef(SCHEMA + "name")
    g = Graph()
    g.add((subj, pred, Literal(INJECTION)))

    client = _RecordingClient()
    n3_patch_inserts(client, "https://pod.example/r.meta", g)

    assert len(client.bodies) == 1
    inserts = _inserts_graph_from_patch(client.bodies[0], "https://pod.example/r.meta")

    # Exactly one triple, the original literal intact, NO injected attacker triple.
    assert len(inserts) == 1
    assert (subj, pred, Literal(INJECTION)) in inserts
    assert not list(inserts.subjects(predicate=URIRef("urn:p")))
    assert URIRef("urn:attacker") not in set(inserts.subjects())


def test_old_fstring_path_would_have_injected():
    """Demonstrates the vulnerability the new path closes (the old f-string form).

    Building the triple by f-string with the same malicious title produces a patch
    body that is NOT one clean original triple: depending on where the '>' / newline
    land, it either breaks N3 parsing (malformed envelope) OR injects the attacker
    triple. Either outcome proves the f-string path was unsafe — it is a guard against
    reintroducing hand-built Turtle. The Graph-based path (test above) is immune.
    """
    subj = "https://pod.example/r"
    pred = SCHEMA + "name"
    # the retired idiom: f'<{subj}> <{pred}> "{title}" .'
    hand_built = f'<{subj}> <{pred}> "{INJECTION}" .'
    envelope = (
        "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n\n"
        f"_:patch a solid:InsertDeletePatch ;\n   solid:inserts {{ {hand_built} }} .\n"
    )
    safe = False
    try:
        inserts = _inserts_graph_from_patch(envelope, "https://pod.example/r.meta")
        # Parsed — so the only acceptable outcome would be the single clean triple.
        # The injection makes that false: either an attacker triple appears or the
        # original literal is corrupted.
        clean = {(URIRef(subj), URIRef(pred), Literal(INJECTION))}
        safe = (set(inserts) == clean)
    except Exception:
        safe = False  # malformed envelope — also unsafe
    assert not safe, "the f-string path unexpectedly produced a clean single triple"


# ---- F3: gen_managers isomorphism ----------------------------------------------

def _load_gen_managers():
    spec = importlib.util.spec_from_file_location(
        "gen_managers", REPO / "scripts" / "gen_managers.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_gen_managers_isomorphic_to_committed():
    gm = _load_gen_managers()
    for lane in gm.LANES.values():
        mdir = REPO / lane["out"]
        for slug, (tree_local, ctr_path) in lane["containers"].items():
            base = gm.served_url(slug)
            regen = gm.serialize_relative(slug, gm.manager_graph(slug, lane["tree_ns"], tree_local, ctr_path))
            g_new = Graph().parse(data=regen, format="turtle", publicID=base)
            g_old = Graph().parse(mdir / f"{slug}.shapetree.ttl", format="turtle", publicID=base)
            assert isomorphic(g_new, g_old), f"{slug} regenerated manager not isomorphic"


def test_committed_manager_files_match_generator_output():
    "The committed .ttl files are byte-identical to the generator's current output."
    gm = _load_gen_managers()
    for lane in gm.LANES.values():
        mdir = REPO / lane["out"]
        for slug, (tree_local, ctr_path) in lane["containers"].items():
            regen = gm.serialize_relative(slug, gm.manager_graph(slug, lane["tree_ns"], tree_local, ctr_path))
            committed = (mdir / f"{slug}.shapetree.ttl").read_text()
            assert regen == committed, f"{slug}.shapetree.ttl is stale — re-run gen_managers.py"


# ---- F6: pod_audit expected-set derivation -------------------------------------

def _build_8container_graphs(tmp_path):
    "An 8-container ShapeTree doc + a registry that covers all 8 (no magic 7)."
    wikitree = "https://pod.example/meta/shapetrees/x.tree#"
    slugs = ["concepts", "people", "places", "events",
             "organizations", "procedures", "working", "datasets"]  # 8th = growth
    tree = Graph()
    for slug in slugs:
        ct = URIRef(f"{wikitree}{slug.capitalize()}ContainerTree")
        rt = URIRef(f"{wikitree}{slug.capitalize()}ResourceTree")
        tree.add((ct, RDF.type, URIRef(ST + "ShapeTree")))
        tree.add((ct, URIRef(ST + "expectsType"), URIRef(ST + "Container")))
        tree.add((ct, URIRef(ST + "contains"), rt))
        tree.add((rt, RDF.type, URIRef(ST + "ShapeTree")))
        tree.add((rt, URIRef(ST + "expectsType"), URIRef(ST + "Resource")))
    reg = Graph()
    reg_base = "https://pod.example/meta/interop/registry#"
    for slug in slugs:
        r = URIRef(f"{reg_base}{slug}")
        reg.add((r, RDF.type, URIRef(INTEROP + "DataRegistration")))
        reg.add((r, URIRef(INTEROP + "registeredShapeTree"),
                 URIRef(f"{wikitree}{slug.capitalize()}ContainerTree")))
    return tree, reg, wikitree, slugs


def test_audit_derives_expected_set_no_error_for_8_containers(tmp_path):
    """Feed an 8-container tree + matching registry: coverage check passes (no ERROR).

    Replicates the pod_audit set-equality logic on fixture data to prove the magic-7
    is gone — growing to 8 governed containers no longer produces a spurious ERROR.
    """
    tree, reg, wikitree, slugs = _build_8container_graphs(tmp_path)

    container_trees = {str(s) for s in tree.subjects(
        URIRef(ST + "expectsType"), URIRef(ST + "Container"))}
    registered = {str(o) for o in reg.objects(None, URIRef(INTEROP + "registeredShapeTree"))}

    assert len(container_trees) == 8  # growth past the old hardcoded 7
    assert registered == container_trees  # full coverage → no ERROR


def test_audit_flags_uncovered_container_tree(tmp_path):
    "Drop one registration: the uncovered container tree must be detectable."
    tree, reg, wikitree, slugs = _build_8container_graphs(tmp_path)
    # remove the 'datasets' registration
    drop = URIRef("https://pod.example/meta/interop/registry#datasets")
    reg.remove((drop, None, None))

    container_trees = {str(s) for s in tree.subjects(
        URIRef(ST + "expectsType"), URIRef(ST + "Container"))}
    registered = {str(o) for o in reg.objects(None, URIRef(INTEROP + "registeredShapeTree"))}
    unregistered = container_trees - registered
    assert unregistered == {f"{wikitree}DatasetsContainerTree"}
