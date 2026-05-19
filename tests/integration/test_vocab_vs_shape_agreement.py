"""Every class referenced as sh:targetClass is defined locally or via known external vocab."""
from pathlib import Path
from rdflib import Graph, URIRef
from rdflib.namespace import RDF, OWL, RDFS

REPO = Path(__file__).parents[2]
SHAPES_DIR = REPO / "overlays/wiki-memory/shapes"
VOCAB_FILES = [
    REPO / "overlays/wiki-memory/vocabulary/wiki.ttl",
    REPO / "overlays/wiki-memory/ontology/mem.ttl",
]

# External classes whose definitions we don't include locally — trust standard vocabs
EXTERNAL_PREFIXES = (
    "https://schema.org/",
    "http://www.w3.org/2004/02/skos/core#",
    "http://xmlns.com/foaf/0.1/",
    "http://www.w3.org/ns/activitystreams#",
    "http://www.w3.org/ns/ldp#",
)


def _target_classes() -> set[str]:
    classes: set[str] = set()
    for sf in SHAPES_DIR.glob("*.shacl.ttl"):
        if sf.name == "template.shacl.ttl":
            continue
        g = Graph()
        g.parse(sf, format="turtle")
        for tc in g.objects(predicate=URIRef("http://www.w3.org/ns/shacl#targetClass")):
            classes.add(str(tc))
    return classes


def _defined_classes() -> set[str]:
    defined: set[str] = set()
    for vf in VOCAB_FILES:
        g = Graph()
        g.parse(vf, format="turtle")
        for s in g.subjects(RDF.type, OWL.Class):
            defined.add(str(s))
        for s in g.subjects(RDF.type, RDFS.Class):
            defined.add(str(s))
    return defined


def test_vocab_files_parse():
    for vf in VOCAB_FILES:
        g = Graph()
        g.parse(vf, format="turtle")
        assert len(g) > 0, f"{vf.name} parsed to empty graph"


def test_shapes_all_parse():
    for sf in SHAPES_DIR.glob("*.shacl.ttl"):
        if sf.name == "template.shacl.ttl":
            continue
        g = Graph()
        g.parse(sf, format="turtle")
        assert len(g) > 0, f"{sf.name} parsed to empty graph"


def test_every_targetclass_is_defined_or_external():
    """Every sh:targetClass must be defined in the local vocabularies or be an external standard class.

    Classes from schema.org, SKOS, FOAF, AS2, LDP are trusted external — we do not
    duplicate their definitions locally. wiki:* and mem:* classes must be in the
    local vocab files.
    """
    target_classes = _target_classes()
    defined_classes = _defined_classes()

    assert len(target_classes) > 0, "No sh:targetClass found across all shape files"
    assert len(defined_classes) > 0, "No class definitions found in vocab files"

    undefined = {
        tc for tc in target_classes
        if tc not in defined_classes and not tc.startswith(EXTERNAL_PREFIXES)
    }
    assert not undefined, (
        f"sh:targetClass values without local definition or known external prefix: {undefined}\n"
        f"Add the class to an appropriate vocab file (wiki.ttl or mem.ttl), or declare it "
        f"as external by adding its prefix to EXTERNAL_PREFIXES."
    )


def test_targetclass_count_sanity():
    """Sanity: at least 8 distinct target classes across the shape catalog."""
    classes = _target_classes()
    assert len(classes) >= 8, (
        f"Expected ≥8 sh:targetClass values (one per shape file minus template), got {len(classes)}"
    )
