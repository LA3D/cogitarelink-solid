"""Every content-side owl:disjointWith pair has a matching SHACL sh:not enforcement.

Substrate-side (mem:Event, mem:Action) sh:not constraints are scheduled for
next-plan #2 (MemTriggerListener detector wiring). This test only verifies the
content-side (schema:Event, schema:HowTo) disjointness, which is fully
enforced in the shipped shapes.
"""
from pathlib import Path
from rdflib import Graph, URIRef
from rdflib.namespace import OWL

REPO = Path(__file__).parents[2]
VOCAB = REPO / "overlays/wiki-memory/vocabulary/wiki.ttl"
SHAPES_DIR = REPO / "overlays/wiki-memory/shapes"

SH_NOT = URIRef("http://www.w3.org/ns/shacl#not")
SH_CLASS = URIRef("http://www.w3.org/ns/shacl#class")
SH_TARGET_CLASS = URIRef("http://www.w3.org/ns/shacl#targetClass")


def _disjoint_pairs() -> set[tuple[str, str]]:
    """Extract all owl:disjointWith pairs from the wiki vocabulary."""
    g = Graph()
    g.parse(VOCAB, format="turtle")
    pairs: set[tuple[str, str]] = set()
    for s, _, o in g.triples((None, OWL.disjointWith, None)):
        pairs.add((str(s), str(o)))
    return pairs


def _shape_sh_not_classes() -> dict[str, set[str]]:
    """Map sh:targetClass → set of forbidden sh:class values declared via sh:not."""
    result: dict[str, set[str]] = {}
    for sf in SHAPES_DIR.glob("*.shacl.ttl"):
        if sf.name == "template.shacl.ttl":
            continue
        g = Graph()
        g.parse(sf, format="turtle")
        for shape in g.subjects(SH_TARGET_CLASS, None):
            target = str(g.value(shape, SH_TARGET_CLASS))
            forbidden: set[str] = set()
            for sh_not_node in g.objects(shape, SH_NOT):
                fc = g.value(sh_not_node, SH_CLASS)
                if fc:
                    forbidden.add(str(fc))
            if forbidden:
                result.setdefault(target, set()).update(forbidden)
    return result


def test_vocab_declares_disjoint_pairs():
    pairs = _disjoint_pairs()
    assert len(pairs) >= 2, (
        f"Expected ≥2 owl:disjointWith pairs in wiki.ttl (schema:Event/mem:Event, "
        f"schema:HowTo/mem:Action), got {len(pairs)}"
    )


def test_shapes_declare_sh_not_constraints():
    sh_not_map = _shape_sh_not_classes()
    assert len(sh_not_map) > 0, "No sh:not constraints found across any shape file"


def test_disjointwith_pairs_have_shacl_enforcement():
    """For every owl:disjointWith pair, at least one side's shape must enforce via sh:not.

    Content-side (schema:*) MUST have enforcement now. Substrate-side (mem:*) shapes
    are not shapes governing agent-written content, so the enforcement only needs to
    exist on the content-side shape.
    """
    pairs = _disjoint_pairs()
    sh_not_map = _shape_sh_not_classes()

    missing = []
    for left, right in pairs:
        left_forbids_right = left in sh_not_map and right in sh_not_map[left]
        right_forbids_left = right in sh_not_map and left in sh_not_map[right]
        if not (left_forbids_right or right_forbids_left):
            missing.append((left, right))

    assert not missing, (
        f"owl:disjointWith pairs with no SHACL sh:not enforcement on either side: {missing}\n"
        f"Add sh:not [ sh:class <other> ] to the relevant NodeShape."
    )


def test_schema_event_forbids_mem_event():
    """schema:Event shape must explicitly forbid mem:Event instances."""
    sh_not_map = _shape_sh_not_classes()
    schema_event = "https://schema.org/Event"
    mem_event = "https://pod.vardeman.me/vault/ontology/mem#Event"
    assert schema_event in sh_not_map, (
        f"No sh:not constraints found on wiki:EventShape (sh:targetClass schema:Event)"
    )
    assert mem_event in sh_not_map[schema_event], (
        f"wiki:EventShape does not forbid mem:Event via sh:not [ sh:class mem:Event ]"
    )


def test_schema_howto_forbids_mem_action():
    """schema:HowTo shape must explicitly forbid mem:Action instances."""
    sh_not_map = _shape_sh_not_classes()
    schema_howto = "https://schema.org/HowTo"
    mem_action = "https://pod.vardeman.me/vault/ontology/mem#Action"
    assert schema_howto in sh_not_map, (
        f"No sh:not constraints found on wiki:HowToShape (sh:targetClass schema:HowTo)"
    )
    assert mem_action in sh_not_map[schema_howto], (
        f"wiki:HowToShape does not forbid mem:Action via sh:not [ sh:class mem:Action ]"
    )
