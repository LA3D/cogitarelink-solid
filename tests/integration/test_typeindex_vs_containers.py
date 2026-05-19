"""Type Index registrations point to installed containers."""
from pathlib import Path
from rdflib import Graph, URIRef

REPO = Path(__file__).parents[2]
MANIFEST = REPO / "overlays/wiki-memory/manifest.ttl"
OVERLAY = "https://pod.vardeman.me/vault/ontology/overlay#"
SOLID = "http://www.w3.org/ns/solid/terms#"


def _load_manifest() -> Graph:
    g = Graph()
    g.parse(MANIFEST, format="turtle")
    return g


def test_manifest_parses():
    g = _load_manifest()
    assert len(g) > 0, "manifest.ttl parsed to an empty graph"


def test_typeindex_containers_match_installed_containers():
    """Every container registered in the Type Index must also be declared as installed.

    Relative IRIs in the manifest are resolved against the file's base URI by rdflib,
    so both sets share the same resolved IRI form after parsing.
    """
    g = _load_manifest()

    installed_containers = {
        str(c) for c in g.objects(predicate=URIRef(OVERLAY + "installsContainer"))
    }
    typeindex_containers = {
        str(c) for c in g.objects(predicate=URIRef(SOLID + "instanceContainer"))
    }

    assert len(installed_containers) > 0, "No installsContainer found in manifest"
    assert len(typeindex_containers) > 0, "No solid:instanceContainer found in manifest"

    # Every Type Index container must be in the installed set
    missing = typeindex_containers - installed_containers
    assert not missing, (
        f"Type Index references containers not in overlay:installsContainer: {missing}\n"
        f"Either add the container to installsContainer or remove the TypeRegistration."
    )


def test_installed_containers_count():
    """Sanity: manifest declares the expected set of wiki-memory containers."""
    g = _load_manifest()
    installed = {
        str(c) for c in g.objects(predicate=URIRef(OVERLAY + "installsContainer"))
    }
    # wiki-memory L3: /vault/wiki/ + 7 class containers + 2 hidden substrate containers
    assert len(installed) >= 9, (
        f"Expected ≥9 installed containers (root + 7 class + 2 substrate), got {len(installed)}: {installed}"
    )
