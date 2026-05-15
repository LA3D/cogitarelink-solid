"""Validate every fixture .meta against its shape via pyshacl."""
from pathlib import Path

import pytest
from pyshacl import validate
from rdflib import Graph

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "wiki-memory-l3"
SHAPE_ROOT = Path(__file__).parent.parent / "shapes" / "wiki-memory-l3"

BUNDLE_FIXTURES = [
    "agentic-memory-systems-moc.md.meta",
    "wiki-memory-l3-profile.md.meta",
    "ghumare-llm-wiki-v2-extending-karpathy.md.meta",
    "karpathy-andrej.md.meta",
]


def _load_shapes() -> Graph:
    g = Graph()
    for f in [
        "resource.shacl.ttl",
        "concept.shacl.ttl",
        "source.shacl.ttl",
        "person.shacl.ttl",
        "procedure.shacl.ttl",
        # working.shacl.ttl uses a separate relaxed validator — see test below
    ]:
        g.parse(SHAPE_ROOT / f, format="turtle")
    return g


def _load_all_fixtures() -> Graph:
    """Load all bundle fixtures into one graph so cross-references resolve."""
    g = Graph()
    for fix in BUNDLE_FIXTURES:
        g.parse(FIXTURE_ROOT / "meta" / fix, format="turtle")
    return g


def _validate(data: Graph, shapes: Graph) -> tuple[bool, str]:
    conforms, _, text = validate(
        data_graph=data,
        shacl_graph=shapes,
        inference="rdfs",
        advanced=True,
    )
    return conforms, text


@pytest.mark.parametrize("fixture", BUNDLE_FIXTURES)
def test_bundle_fixture_validates(fixture: str) -> None:
    """Each fixture validates against the combined shape graph.

    All four fixtures are loaded together so cross-document IRI references
    (e.g. skos:related, dct:references, dct:contributor) resolve to typed
    nodes in the data graph. This mirrors Pod behaviour: when a SPARQL agent
    queries the Pod, all .meta sidecars are queryable together, so sh:class
    constraints can be checked across documents.

    Architectural note: per-resource isolation is enforced at write time by
    the MarkdownProjectionListener (Rung 1.4); at query / validation time the
    full Pod state is the relevant data graph.
    """
    shapes = _load_shapes()
    # Load all fixtures together so sh:class constraints on cross-references
    # can be satisfied via the co-loaded typed IRIs.
    data = _load_all_fixtures()
    conforms, report = _validate(data, shapes)
    assert conforms, f"Combined fixture graph failed validation:\n{report}"


def test_procedure_stub_validates() -> None:
    shapes = _load_shapes()
    data = Graph()
    data.parse(FIXTURE_ROOT / "shape-stubs" / "procedure-stub.ttl", format="turtle")
    conforms, report = _validate(data, shapes)
    assert conforms, f"procedure-stub failed:\n{report}"


def test_working_note_stub_validates_against_only_working_shape() -> None:
    """WorkingNote uses a relaxed validator (D73).

    The stub deliberately omits dct:identifier, dct:modified, and wiki:maturity
    which ResourceShape requires. Validating against only working.shacl.ttl
    confirms the permissive shape accepts low-ceremony writes without the
    ResourceShape's stricter constraints.
    """
    shapes = Graph()
    shapes.parse(SHAPE_ROOT / "working.shacl.ttl", format="turtle")
    data = Graph()
    data.parse(FIXTURE_ROOT / "shape-stubs" / "working-note-stub.ttl", format="turtle")
    conforms, report = _validate(data, shapes)
    assert conforms, f"working-note-stub failed:\n{report}"
