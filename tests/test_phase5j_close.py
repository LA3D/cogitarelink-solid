"""Phase 5j close-out integration tests — wikirole scheme + PROF Link writer."""
import os
from pathlib import Path

import httpx
import pytest
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF, RDFS, SKOS, OWL

PROF = Namespace("http://www.w3.org/ns/dx/prof/")
DCT = Namespace("http://purl.org/dc/terms/")
WIKIROLE = Namespace("https://pod.vardeman.me/vault/ontology/wikirole#")
OVERLAY_NS = Namespace("https://pod.vardeman.me/vault/ontology/overlay#")

OVERLAY_ROOT = Path(__file__).parent.parent / "overlays" / "wiki-memory"
OVERLAY_TTL = Path(__file__).parent.parent / "css" / "config" / "pod-templates" / "base" / "ontology" / "overlay.ttl"


def test_wikirole_scheme_affordance_family_well_formed():
    """The wikirole scheme's affordance-family roles are well-formed SKOS + PROF.

    Re-scoped 2026-06-04 C-T4 (was test_wikirole_scheme_has_five_role_concepts): the
    scheme grew 5→11 roles (added the standalone overview / operation-log /
    operation-vocabulary / event-stream top concepts and the query/search affordance
    children). We assert the ORIGINAL 5 affordance-family roles are a SUBSET of the
    scheme and verify their full structure + the :affordance sub-hierarchy, rather
    than pinning an exact role count that churns every time a role is added.
    """
    g = Graph()
    g.parse(OVERLAY_ROOT / "vocabulary" / "wikirole.ttl", format="turtle")

    scheme = URIRef("https://pod.vardeman.me/vault/ontology/wikirole")
    assert (scheme, RDF.type, SKOS.ConceptScheme) in g
    assert (scheme, RDF.type, OWL.Ontology) in g
    assert (scheme, DCT.conformsTo, URIRef("http://www.w3.org/TR/dx-prof/")) in g

    affordance_family = {
        WIKIROLE["affordance"],
        WIKIROLE["write-affordance"],
        WIKIROLE["version-affordance"],
        WIKIROLE["derived-class-affordance"],
        WIKIROLE["derived-navigation-affordance"],
    }
    found = set(g.subjects(RDF.type, PROF.ResourceRole))
    assert affordance_family <= found, f"missing affordance-family roles: {affordance_family - found}"

    for role in affordance_family:
        assert (role, RDF.type, SKOS.Concept) in g
        assert (role, RDF.type, OWL.NamedIndividual) in g
        assert (role, SKOS.inScheme, scheme) in g, f"{role} missing skos:inScheme"
        assert (role, RDFS.isDefinedBy, scheme) in g, f"{role} missing rdfs:isDefinedBy"

    # SKOS hierarchy within the family: :affordance is the top concept; its children
    # are NOT top concepts (SKOS §B.3.2.3). Other top concepts (overview, operation-*)
    # are out of scope for this family check.
    parent = WIKIROLE["affordance"]
    assert (parent, SKOS.topConceptOf, scheme) in g
    for child in affordance_family - {parent}:
        assert (child, SKOS.topConceptOf, scheme) not in g, \
            f"{child} should not be skos:topConceptOf when it has skos:broader"

    # Scheme metadata
    assert (scheme, DCT.publisher, URIRef("https://orcid.org/0000-0003-4091-6059")) in g
    assert any(g.triples((scheme, RDFS.comment, None))), "scheme missing rdfs:comment"

    # Per-role labels and definitions
    for role in affordance_family:
        assert any(g.triples((role, SKOS.prefLabel, None))), f"{role} missing skos:prefLabel"
        assert any(g.triples((role, SKOS.definition, None))), f"{role} missing skos:definition"

    # Hierarchy: family children have skos:broader :affordance; the parent must NOT.
    for child in affordance_family - {parent}:
        assert (child, SKOS.broader, parent) in g, f"{child} missing skos:broader :affordance"
    assert not list(g.triples((parent, SKOS.broader, None))), \
        "parent :affordance should not have skos:broader"


def test_overlay_schema_has_installs_profile_and_role_scheme():
    g = Graph()
    g.parse(OVERLAY_TTL, format="turtle")
    rdf_property = URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#Property")
    for predicate in [OVERLAY_NS.installsProfile, OVERLAY_NS.installsRoleScheme]:
        assert (predicate, RDF.type, rdf_property) in g, f"missing predicate: {predicate}"


MANIFEST_TTL = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "manifest.ttl"
OVERLAY_DIR = Path(__file__).parent.parent / "overlays" / "wiki-memory"


# D98 profile set: procedure→howto, source folded into concept, + the schema.org
# Thing profiles (place/event/organization/thing) and the template profile.
# (Updated 2026-06-04 C-T4 from the original 6-profile phase5j list.)
WIKI_MEMORY_PROFILES = [
    "page", "concept", "person", "howto", "working",
    "place", "event", "organization", "thing", "template",
]


def test_overlay_helpers_extract_role_scheme_and_profiles():
    from scripts.overlay.common import parse_manifest
    manifest = parse_manifest(OVERLAY_DIR, pod_url="http://localhost:3000/")

    assert manifest.role_scheme_urls == ["http://localhost:3000/vault/ontology/wikirole"]

    assert sorted(manifest.profile_urls) == sorted(
        f"http://localhost:3000/vault/meta/profiles/{name}"
        for name in WIKI_MEMORY_PROFILES
    )


def test_manifest_declares_role_scheme_and_profiles():
    g = Graph()
    g.parse(MANIFEST_TTL, format="turtle")
    overlay = URIRef("https://pod.vardeman.me/vault/ontology/overlay#wiki-memory")

    role_schemes = set(g.objects(overlay, OVERLAY_NS.installsRoleScheme))
    assert role_schemes == {URIRef("file:///vault/ontology/wikirole")}, \
        f"unexpected role schemes: {role_schemes}"

    profiles = set(g.objects(overlay, OVERLAY_NS.installsProfile))
    expected = {URIRef(f"file:///vault/meta/profiles/{name}") for name in
                WIKI_MEMORY_PROFILES}
    assert profiles == expected, f"diff: missing={expected - profiles}, extra={profiles - expected}"


SHAPES_DIR = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "shapes"
SHACL_SPEC = URIRef("https://www.w3.org/TR/shacl/")


@pytest.mark.parametrize("filename", [
    "page.shacl.ttl", "concept.shacl.ttl", "source.shacl.ttl", "person.shacl.ttl",
    "howto.shacl.ttl", "working.shacl.ttl",
])
def test_shape_declares_conformsTo_shacl(filename):
    g = Graph()
    shape_path = SHAPES_DIR / filename
    g.parse(shape_path, format="turtle", publicID=f"file://{shape_path}")
    found = any(SHACL_SPEC in g.objects(s, DCT.conformsTo) for s in g.subjects())
    assert found, f"{filename} does not declare dct:conformsTo <SHACL spec>"


VOCAB_TTL = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "vocabulary" / "wiki.ttl"
PROFILES_DIR = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "profiles"
PROF_SPEC = URIRef("http://www.w3.org/TR/dx-prof/")
RDFS_SPEC = URIRef("http://www.w3.org/2000/01/rdf-schema")


def test_wiki_vocab_declares_conformsTo_owl2():
    # Updated 2026-06-04 C-T4: the wiki vocab now declares dct:conformsTo the OWL 2
    # overview (it uses owl:Class/owl:NamedIndividual constructs), not bare RDFS.
    g = Graph()
    g.parse(VOCAB_TTL, format="turtle")
    vocab = URIRef("https://pod.vardeman.me/vault/ontology/wiki")
    owl2_spec = URIRef("https://www.w3.org/TR/owl2-overview/")
    assert (vocab, DCT.conformsTo, owl2_spec) in g


@pytest.mark.parametrize("name", ["page", "concept", "howto", "person", "procedure", "working"])
def test_profile_descriptor_declares_conformsTo_prof(name):
    g = Graph()
    g.parse(PROFILES_DIR / f"{name}.ttl", format="turtle")
    profile = URIRef(f"https://pod.vardeman.me/vault/meta/profiles/{name}")
    assert (profile, DCT.conformsTo, PROF_SPEC) in g


from tests.conftest import _pod_base, resolve_ca as _resolve_ca
_CA = _resolve_ca() or False
POD = _pod_base()


@pytest.mark.integration
def test_context_jsonld_meta_declares_conformsTo_jsonld11():
    """Requires a running Pod with the overlay applied."""
    import httpx
    r = httpx.get(f"{POD}/vault/meta/context.jsonld.meta", timeout=5, verify=_CA)
    assert r.status_code == 200, f"unexpected status: {r.status_code}, body: {r.text[:200]}"
    g = Graph()
    g.parse(data=r.text, format="turtle",
            publicID=f"{POD}/vault/meta/context.jsonld.meta")
    ctx = URIRef(f"{POD}/vault/meta/context.jsonld")
    assert (ctx, DCT.conformsTo, URIRef("https://www.w3.org/TR/json-ld11/")) in g


AFFORDANCES_DIR = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "affordances"

AFFORDANCE_ROLE_MAP = {
    "markdown-projection.ttl": "write-affordance",
    "memento.ttl":              "version-affordance",
    "hub-view.ttl":             "derived-class-affordance",
    "breadcrumb-view.ttl":      "derived-navigation-affordance",
}


@pytest.mark.parametrize("filename,role", list(AFFORDANCE_ROLE_MAP.items()))
def test_affordance_additive_prof_typing(filename, role):
    g = Graph()
    affordance_path = AFFORDANCES_DIR / filename
    g.parse(affordance_path, format="turtle", publicID=f"file://{affordance_path}")
    doc_uri = URIRef(f"file://{affordance_path}")

    # 1) Affordance-class typing preserved (any *Affordance subclass passes). The
    # affordance classes moved wiki: -> sub: in D107 Bucket 2 (substrate namespace);
    # the descriptor must still carry a substrate Affordance type.
    has_affordance_type = any(
        str(t).startswith("https://pod.vardeman.me/vault/ontology/substrate#")
        and "Affordance" in str(t)
        for t in g.objects(doc_uri, RDF.type)
    )
    assert has_affordance_type, f"{filename} lost sub:*Affordance typing"

    # 2) New PROF typing.
    assert (doc_uri, RDF.type, PROF.ResourceDescriptor) in g, \
        f"{filename} missing prof:ResourceDescriptor type"
    assert (doc_uri, PROF.hasRole, WIKIROLE[role]) in g, \
        f"{filename} missing prof:hasRole wikirole:{role}"
    assert (doc_uri, DCT.conformsTo, PROF_SPEC) in g, \
        f"{filename} missing dct:conformsTo <PROF>"


# --- Task 10: importer emits content-level dct:conformsTo per wiki:* class ---

from scripts.lib.rdf_gen import frontmatter_to_graph  # noqa: E402

_PROFILE_BASE = "https://pod.vardeman.me/vault/meta/profiles"
_FIXTURE_BASE = "https://pod.vardeman.me/vault/wiki/pages"
_FIXTURE_IRI  = f"{_FIXTURE_BASE}/fixture"


@pytest.mark.parametrize("class_hint,profile_slug", [
    ("concept",   "concept"),
    ("source",    "source"),
    ("person",    "person"),
    ("procedure", "procedure"),
    ("working",   "working"),
])
def test_importer_emits_content_level_conformsTo(class_hint, profile_slug):
    """Imported wiki:X resources declare dct:conformsTo on the matching wiki:XProfile (D86)."""
    g = frontmatter_to_graph(
        fm={"type": class_hint, "title": "Fixture"},
        title="Fixture",
        base=_FIXTURE_BASE,
    )
    resource = URIRef(f"{_FIXTURE_IRI}.md")
    expected_profile = URIRef(f"{_PROFILE_BASE}/{profile_slug}")
    assert (resource, DCT.conformsTo, expected_profile) in g, \
        f"importer did not emit dct:conformsTo <{expected_profile}>"


# --- Task 12: storage description advertises wikirole + the core PROF profiles ---

@pytest.mark.integration
def test_storage_description_advertises_wikirole_and_profiles():
    """Storage description lists the wikirole vocab and the core PROF profile descriptors (D86).

    CSS only serves .well-known/solid on storage containers (pim:Storage). The vault at
    /vault/ is the storage root, so its description is at /vault/.well-known/solid.

    Re-scoped 2026-06-04 C-T4: procedure→howto, source folded into concept. The
    storage description advertises the CORE wiki-memory profiles (page/concept/person/
    howto/working) via prof:hasResource; assert that core set is present rather than
    pinning the original 6-name list.
    """
    import httpx
    sd_url = f"{POD}/vault/.well-known/solid"
    r = httpx.get(sd_url, headers={"Accept": "text/turtle"}, timeout=5, verify=_CA)
    assert r.status_code == 200
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=sd_url)

    void_vocab = URIRef("http://rdfs.org/ns/void#vocabulary")
    vocabs = set(str(o) for o in g.objects(predicate=void_vocab))
    assert "https://pod.vardeman.me/vault/ontology/wiki#" in vocabs, \
        f"wiki vocab missing from storage description; found: {vocabs}"
    assert "https://pod.vardeman.me/vault/ontology/wikirole#" in vocabs, \
        f"wikirole vocab missing from storage description; found: {vocabs}"

    prof_has_resource = URIRef("http://www.w3.org/ns/dx/prof/hasResource")
    profiles = set(str(o) for o in g.objects(predicate=prof_has_resource))
    core_profiles = {
        f"https://pod.vardeman.me/vault/meta/profiles/{name}"
        for name in ["page", "concept", "person", "howto", "working"]
    }
    missing = core_profiles - profiles
    assert not missing, f"core profiles missing from prof:hasResource: {missing}"


# --- Task 17: end-to-end Link: rel="profile" emission from live Pod ---

@pytest.mark.integration
def test_shape_response_carries_shacl_profile_link():
    r = httpx.get(f"{POD}/vault/meta/shapes/page.shacl.ttl", timeout=5, verify=_CA)
    assert r.status_code == 200
    link = r.headers.get("link", "")
    assert '<https://www.w3.org/TR/shacl/>; rel="profile"' in link, \
        f"Link header missing SHACL profile: {link!r}"


@pytest.mark.integration
def test_affordance_response_carries_prof_profile_link():
    r = httpx.get(f"{POD}/vault/meta/affordances/markdown-projection.ttl", timeout=5, verify=_CA)
    assert r.status_code == 200
    link = r.headers.get("link", "")
    assert '<http://www.w3.org/TR/dx-prof/>; rel="profile"' in link, \
        f"Link header missing PROF profile: {link!r}"


@pytest.mark.integration
def test_profile_descriptor_response_carries_prof_profile_link():
    r = httpx.get(f"{POD}/vault/meta/profiles/page", timeout=5, verify=_CA)
    assert r.status_code == 200
    link = r.headers.get("link", "")
    assert '<http://www.w3.org/TR/dx-prof/>; rel="profile"' in link, \
        f"Link header missing PROF profile: {link!r}"


@pytest.mark.integration
def test_wikirole_scheme_is_dereferenceable_and_has_roles():
    # Updated 2026-06-04 C-T4: the scheme grew 5→11 roles; assert it resolves and
    # carries the original affordance-family roles rather than pinning an exact count.
    r = httpx.get(f"{POD}/vault/ontology/wikirole", timeout=5, verify=_CA)
    assert r.status_code == 200
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=f"{POD}/vault/ontology/wikirole")
    found = {str(s) for s in g.subjects(RDF.type, PROF.ResourceRole)}
    assert len(found) >= 5, f"expected ≥5 prof:ResourceRole instances, got {len(found)}: {found}"
    base = "https://pod.vardeman.me/vault/ontology/wikirole#"
    for role in ["affordance", "write-affordance", "version-affordance",
                 "derived-class-affordance", "derived-navigation-affordance"]:
        assert base + role in found, f"affordance-family role {role!r} missing: {found}"


@pytest.mark.integration
def test_profile_link_composes_with_memento_link():
    """A regular vault resource should carry rel=timegate (Memento)
    even if no profile is declared. This verifies profile-link writer
    does not clobber memento's Link header."""
    r = httpx.get(f"{POD}/vault/wiki/pages/", timeout=5, verify=_CA)
    if r.status_code != 200:
        pytest.skip(f"container not present (status {r.status_code})")
    link = r.headers.get("link", "")
    assert 'rel="timegate"' in link, f"missing Memento timegate link: {link!r}"
