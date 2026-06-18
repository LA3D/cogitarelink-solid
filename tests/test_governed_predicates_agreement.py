"""Agreement: the projection's governed-predicate partition is consistent with the SHACL
shapes agents are taught by. Path B (chosen over codegen 2026-06-18): rather than generate
governedPredicates.ts from the shapes (which would split the agent-facing teaching from the
agent-invisible behavior file), we keep the hand file and TEST that every predicate a durable
shape *requires* (minCount>=1) is governed on the correct subject. This catches the drift that
matters agentically — a shape requires a predicate the substrate doesn't manage, so the agent
is taught it matters but a later rewrite silently mishandles it. Runtime-derivation (compute the
governed set from the loaded shapes) is the real target; see FOLLOWUPS.
"""
import re
from pathlib import Path
from rdflib import Graph, URIRef
from rdflib.namespace import SH

ROOT = Path(__file__).parent.parent
GP = ROOT / "css/extensions/markdown-projection/src/governedPredicates.ts"

# PAGE-axis target classes (subject = <>); everything else is THING-axis (subject = <#this>).
PAGE_AXIS = {"https://pod.vardeman.me/vault/ontology/wiki#Page", "http://xmlns.com/foaf/0.1/Document"}

DURABLE_SHAPES = [
    ROOT / "shapes/substrate/write-contract.shacl.ttl",
    *[ROOT / f"overlays/wiki-memory/shapes/{s}.shacl.ttl"
      for s in ("page", "thing", "concept", "source", "person", "place", "event", "organization", "howto")],
]


def _governed_iris():
    "Extract (PAGE set, ALL set) of governed predicate IRIs from governedPredicates.ts."
    txt = GP.read_text()
    ns = dict(re.findall(r'const\s+(\w+)\s*=\s*"([^"]+)"\s*;', txt))
    def resolve(block: str):
        out = set()
        for pfx, local in re.findall(r'namedNode\((\w+)\s*\+\s*"([^"]+)"\)', block):
            if pfx in ns:
                out.add(ns[pfx] + local)
        return out
    m = re.search(r"PAGE_GOVERNED_PREDICATES\s*:\s*NamedNode\[\]\s*=\s*\[(.*?)\]", txt, re.DOTALL)
    page_block = m.group(1) if m else ""
    return resolve(page_block), resolve(txt)


def _required_paths_by_axis(shape_file: Path):
    "Yield (axis, required-path-IRI) for each minCount>=1 property of each targeted NodeShape."
    g = Graph(); g.parse(shape_file, format="turtle")
    for node in g.subjects(SH.targetClass, None):
        tc = str(g.value(node, SH.targetClass))
        axis = "PAGE" if tc in PAGE_AXIS else "THING"
        for prop in g.objects(node, SH.property):
            mc = g.value(prop, SH.minCount)
            if mc is not None and int(mc) >= 1:
                path = g.value(prop, SH.path)
                if path is not None:
                    yield axis, str(path)


def test_required_predicates_are_governed_on_the_right_subject():
    page_governed, all_governed = _governed_iris()
    violations = []
    for sf in DURABLE_SHAPES:
        for axis, path in _required_paths_by_axis(sf):
            target = page_governed if axis == "PAGE" else all_governed
            if path not in target:
                violations.append(f"{sf.name}: requires {path} ({axis}-axis) but it is not governed there")
    assert not violations, "shapes teach predicates the projection does not govern:\n" + "\n".join(violations)
