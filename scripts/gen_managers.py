# Emit per-container .shapetree Manager auxiliaries (interop foundation, Task 5).
# Run from repo root: ~/uvws/.venv/bin/python scripts/gen_managers.py
# Commit the generated overlays/wiki-memory/interop/managers/*.shapetree.ttl files.
#
# A Manager associates a container with its CONTAINER shape tree (st:assigns). The shapes
# themselves live on the container tree's contained resource trees (st:contains), so the
# assignment carries NO st:shape — correct for the co-resident concepts/ container
# (Concept + Source). It also carries NO st:focusNode — a container Manager has no single focus
# node; the per-resource validation focus is each contained resource's <#this>, resolved at
# validation time (the earlier "{instance}#this" form was dropped: it was an invalid IRI that
# crashed RDF re-serialization).
from pathlib import Path

BASE = "https://pod.vardeman.me/vault"
TREE_NS = f"{BASE}/meta/shapetrees/wiki-memory.tree#"

# container slug -> ContainerTree localname (7 containers; concepts/ covers Concept + Source)
CONTAINERS = {
    "concepts": "ConceptContainerTree",
    "people": "PersonContainerTree",
    "places": "PlaceContainerTree",
    "events": "EventContainerTree",
    "organizations": "OrganizationContainerTree",
    "procedures": "ProcedureContainerTree",
    "working": "WorkingNoteContainerTree",
}

out = Path("overlays/wiki-memory/interop/managers")
out.mkdir(parents=True, exist_ok=True)
for slug, tree in CONTAINERS.items():
    container = f"{BASE}/wiki/{slug}/"
    (out / f"{slug}.shapetree.ttl").write_text(
        "@prefix st: <http://www.w3.org/ns/shapetrees#> .\n\n"
        "<> a st:Manager ; st:hasAssignment <#a1> .\n"
        "<#a1>\n"
        f"    st:assigns <{TREE_NS}{tree}> ;\n"
        f"    st:manages <{container}> .\n"
    )
print(f"wrote {len(CONTAINERS)} manager files")
