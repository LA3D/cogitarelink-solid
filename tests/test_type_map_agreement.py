"""TYPE_MAP cross-language + shape-catalog agreement (R-T7, audit R3 / P2).

Three encodings of frontmatter type token -> class exist:
  1. TS projection  — frontmatterProjection.ts TYPE_MAP (read from the maps sidecar)
  2. Python importer — scripts/lib/rdf_gen.py TYPE_MAP
  3. the deployed shape catalog — overlays/wiki-memory/shapes/*.shacl.ttl sh:targetClass

They intentionally differ in COVERAGE (the TS map covers wiki-content tokens; the
importer covers the vault-author tokens it reads). So full equality is the WRONG
invariant. The invariants this test enforces:

  (A) for every token BOTH maps define, they map to the SAME class IRI;
  (B) every class IRI either map uses is GOVERNED — it is (or resolves, via the
      wiki: -> Thing class dispatch, to) a class in the shapes' sh:targetClass set.

(A) caught the pre-D70 drift: the importer mapped concept-note -> bare skos:Concept
and theory-note -> a legacy vault:TheoryNote (ungoverned) while the TS map used the
L3 wiki: classes; reconciled by aligning the importer to the TS L3 classes.
"""
import json
from pathlib import Path
from rdflib import Graph, Namespace
from rdflib.namespace import RDF

from scripts.lib.rdf_gen import TYPE_MAP as PY_TYPE_MAP

ROOT = Path(__file__).resolve().parents[1]
MAPS = json.loads((ROOT / "css/extensions/markdown-projection/maps.json").read_text())
SHAPES_DIR = ROOT / "overlays/wiki-memory/shapes"
SH = Namespace("http://www.w3.org/ns/shacl#")

TS_TYPE_MAP: dict[str, str] = MAPS["typeMap"]
PY = {k: str(v) for k, v in PY_TYPE_MAP.items()}
# Importer's fallback class for any token NOT in TYPE_MAP (frontmatter_to_graph
# default) — must also be governed; included in the value-coverage check.
PY_DEFAULT = "http://www.w3.org/2004/02/skos/core#Concept"
WIKI_TO_THING: dict[str, str] = MAPS["wikiClassToThingClass"]


def _target_classes() -> set[str]:
    out: set[str] = set()
    for f in SHAPES_DIR.glob("*.shacl.ttl"):
        g = Graph(); g.parse(f, format="turtle")
        for tc in g.objects(None, SH.targetClass):
            out.add(str(tc))
    return out


TARGET_CLASSES = _target_classes()


def _is_governed(cls: str) -> bool:
    """A class is governed if a shape targets it directly, or it is a wiki:
    dispatch class whose canonical Thing class a shape targets."""
    if cls in TARGET_CLASSES:
        return True
    thing = WIKI_TO_THING.get(cls)
    return thing is not None and thing in TARGET_CLASSES


def test_target_classes_nonempty():
    # The template.shacl.ttl uses a placeholder targetClass (YOURPFX:YourThing);
    # the real classes must still be present.
    assert "http://www.w3.org/2004/02/skos/core#Concept" in TARGET_CLASSES
    assert "https://schema.org/Person" in TARGET_CLASSES


def test_shared_tokens_agree():
    shared = set(TS_TYPE_MAP) & set(PY)
    assert shared, "TS and Python TYPE_MAP share no tokens — coverage check would be vacuous"
    disagreements = [
        f"{t}: TS={TS_TYPE_MAP[t]!r} vs Python={PY[t]!r}"
        for t in sorted(shared)
        if TS_TYPE_MAP[t] != PY[t]
    ]
    assert not disagreements, "TYPE_MAP shared-token disagreement:\n" + "\n".join(disagreements)


def test_every_ts_class_is_governed():
    bad = sorted({c for c in TS_TYPE_MAP.values() if not _is_governed(c)})
    assert not bad, f"TS TYPE_MAP maps to ungoverned class(es): {bad}"


def test_every_python_class_is_governed():
    used = set(PY.values()) | {PY_DEFAULT}
    bad = sorted({c for c in used if not _is_governed(c)})
    assert not bad, f"Python TYPE_MAP maps to ungoverned class(es): {bad}"
