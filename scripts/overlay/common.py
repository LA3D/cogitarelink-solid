"""Shared utilities for overlay apply/remove/verify scripts.

All HTTP operations go through a single httpx.Client; N3 Patch construction
is shared because it's the same shape for every modification of a shared
substrate resource (storage description, Type Index, context.jsonld).

NOTE on capability resolution: an overlay's `overlay:requiresCapability` clauses
use the full descriptor URL as the IRI in `cap:requires`, e.g.,
`<https://pod.vardeman.me:3000/vault/meta/capabilities/markdown-content-projection>`.
fetch_capability_catalog returns a dict keyed by these descriptor URLs.
Manifest authors should NOT use the capability class IRI like cap:ContentProjection
in cap:requires — those are types, not implementations.
"""
from __future__ import annotations
import json
from dataclasses import dataclass
from pathlib import Path

import httpx
from rdflib import Graph, Namespace, URIRef, Literal
from rdflib.namespace import RDF, RDFS, DCTERMS

OVERLAY = Namespace("https://pod.vardeman.me:3000/vault/ontology/overlay#")
CAP     = Namespace("https://pod.vardeman.me:3000/vault/ontology/capability#")
SOLID   = Namespace("http://www.w3.org/ns/solid/terms#")
VOID    = Namespace("http://rdfs.org/ns/void#")
SH      = Namespace("http://www.w3.org/ns/shacl#")
WIKI    = Namespace("https://pod.vardeman.me:3000/vault/ontology/wiki#")  # only when overlay uses it


@dataclass(frozen=True)
class CapabilityRequirement:
    iri: URIRef          # IRI of the capability descriptor expected on the Pod
    min_version: str     # e.g., "1.0"
    optional: bool = False
    degrades_to: str | None = None


@dataclass(frozen=True)
class VocabularyDeclaration:
    namespace: URIRef    # vocabulary namespace IRI (e.g., wiki:)
    document: Path       # overlay-local path to the vocab .ttl file
    hosted_at: str       # Pod-side path where it will be uploaded


@dataclass(frozen=True)
class TypeRegistration:
    for_class: URIRef
    instance_container: URIRef


@dataclass(frozen=True)
class Manifest:
    """Parsed view of an overlay's manifest.ttl."""
    name: str
    version: str
    overlay_iri: URIRef
    profile_iri: URIRef | None
    depends_on_overlays: list[URIRef]
    required_capabilities: list[CapabilityRequirement]
    optional_capabilities: list[CapabilityRequirement]
    vocabularies: list[VocabularyDeclaration]
    container_paths: list[str]        # e.g., "/vault/wiki/pages/"
    shape_urls: list[str]             # full Pod URLs
    affordance_urls: list[str]
    type_registrations: list[TypeRegistration]
    overlay_dir: Path                 # local directory holding manifest + artifacts


def parse_manifest(overlay_dir: Path) -> Manifest:
    """Parse manifest.ttl into a structured Manifest."""
    manifest_path = overlay_dir / "manifest.ttl"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Overlay manifest not found: {manifest_path}")

    g = Graph()
    g.parse(manifest_path, format="turtle")

    overlay_subjects = list(g.subjects(RDF.type, OVERLAY.Overlay))
    if not overlay_subjects:
        raise ValueError(f"No overlay:Overlay declaration in {manifest_path}")
    overlay_iri = overlay_subjects[0]

    def one(predicate):
        objs = list(g.objects(overlay_iri, predicate))
        return objs[0] if objs else None

    def many(predicate):
        return list(g.objects(overlay_iri, predicate))

    name = str(one(OVERLAY.name) or "")
    version = str(one(OVERLAY.version) or "")
    profile_iri = one(DCTERMS.conformsTo)

    depends_on = [URIRef(o) for o in many(OVERLAY.dependsOnOverlay)]

    req_caps = []
    for req_node in many(OVERLAY.requiresCapability):
        iri = next(g.objects(req_node, CAP.requires), None)
        mv = next(g.objects(req_node, CAP.minVersion), Literal("0.0"))
        if iri:
            req_caps.append(CapabilityRequirement(URIRef(iri), str(mv), optional=False))

    opt_caps = []
    for opt_node in many(OVERLAY.optionalCapability):
        iri = next(g.objects(opt_node, CAP.requires), None)
        mv = next(g.objects(opt_node, CAP.minVersion), Literal("0.0"))
        deg = next(g.objects(opt_node, OVERLAY.degradesTo), None)
        if iri:
            opt_caps.append(CapabilityRequirement(URIRef(iri), str(mv), optional=True,
                                                  degrades_to=str(deg) if deg else None))

    vocabs = []
    for v_node in many(OVERLAY.declaresVocabulary):
        ns = next(g.objects(v_node, OVERLAY.namespace), None)
        doc = next(g.objects(v_node, OVERLAY.document), None)
        host = next(g.objects(v_node, OVERLAY.hostedAt), None)
        if ns and doc and host:
            vocabs.append(VocabularyDeclaration(URIRef(ns), overlay_dir / str(doc), str(host)))

    containers = [str(o) for o in many(OVERLAY.installsContainer)]
    shapes = [str(o) for o in many(OVERLAY.installsShape)]
    affordances = [str(o) for o in many(OVERLAY.installsAffordance)]

    type_regs = []
    for tr_node in many(OVERLAY.installsTypeRegistration):
        fc = next(g.objects(tr_node, SOLID.forClass), None)
        ic = next(g.objects(tr_node, SOLID.instanceContainer), None)
        if fc and ic:
            type_regs.append(TypeRegistration(URIRef(fc), URIRef(ic)))

    return Manifest(
        name=name, version=version, overlay_iri=overlay_iri, profile_iri=profile_iri,
        depends_on_overlays=depends_on,
        required_capabilities=req_caps, optional_capabilities=opt_caps,
        vocabularies=vocabs,
        container_paths=containers, shape_urls=shapes, affordance_urls=affordances,
        type_registrations=type_regs,
        overlay_dir=overlay_dir,
    )


def fetch_capability_catalog(client: httpx.Client, pod_url: str) -> dict[str, str]:
    """Fetch the capability catalog and return a mapping of capability IRI → version string."""
    catalog_url = pod_url.rstrip("/") + "/meta/capabilities/"
    r = client.get(catalog_url, headers={"Accept": "text/turtle"}, timeout=10)
    if r.status_code != 200:
        raise RuntimeError(f"Capability catalog not reachable at {catalog_url}: HTTP {r.status_code}")
    g = Graph().parse(data=r.text, format="turtle", publicID=catalog_url)
    LDP = Namespace("http://www.w3.org/ns/ldp#")
    entries = list(g.objects(predicate=LDP.contains))
    versions = {}
    for entry in entries:
        entry_url = str(entry)
        if not entry_url.startswith("http"):
            entry_url = catalog_url + entry_url
        r2 = client.get(entry_url, headers={"Accept": "text/turtle"}, timeout=10)
        if r2.status_code != 200:
            continue
        eg = Graph().parse(data=r2.text, format="turtle", publicID=entry_url)
        v = next(eg.objects(predicate=CAP.version), None)
        if v is not None:
            versions[entry_url] = str(v)
    return versions


def put_file(client: httpx.Client, pod_url: str, local: Path, content_type: str) -> None:
    """Idempotent PUT of a local file to a Pod URL. Raises on non-2xx."""
    body = local.read_bytes()
    r = client.put(pod_url, content=body, headers={"Content-Type": content_type}, timeout=15)
    if r.status_code not in (200, 201, 204, 205):
        raise RuntimeError(f"PUT {pod_url} failed: HTTP {r.status_code}: {r.text[:300]}")


def ensure_container(client: httpx.Client, container_url: str) -> None:
    """Create an LDP container if it doesn't exist. Idempotent."""
    r = client.head(container_url, timeout=5)
    if r.status_code == 200:
        return
    # Create by PUT-ing an empty Turtle representation; CSS treats trailing-slash PUT as container creation
    body = "@prefix dct: <http://purl.org/dc/terms/> . <> dct:title \"Container\" .\n"
    r2 = client.put(container_url, content=body.encode("utf-8"),
                    headers={"Content-Type": "text/turtle"}, timeout=10)
    if r2.status_code not in (200, 201, 204, 205):
        raise RuntimeError(f"Container create {container_url} failed: HTTP {r2.status_code}: {r2.text[:300]}")


def n3_patch_inserts(client: httpx.Client, target_url: str, ntriples: str) -> None:
    """Apply an N3 Patch to target_url that inserts the given N-Triples.

    The `ntriples` string must contain only fully-qualified IRI triples
    (no @prefix directives, no prefixed names). Prefix declarations belong
    at the patch envelope's outer scope, not inside solid:inserts { ... }.
    """
    patch_body = f"""@prefix solid: <http://www.w3.org/ns/solid/terms#>.

_:patch a solid:InsertDeletePatch ;
   solid:inserts {{ {ntriples} }} .
"""
    r = client.patch(target_url, content=patch_body.encode("utf-8"),
                     headers={"Content-Type": "text/n3"}, timeout=15)
    if r.status_code not in (200, 201, 204, 205):
        raise RuntimeError(f"PATCH {target_url} failed: HTTP {r.status_code}: {r.text[:300]}")


def version_at_least(actual: str, required: str) -> bool:
    """Numeric dotted-version comparison sufficient for "1.0" / "1.1" / "2.0" style strings."""
    def tup(v: str) -> tuple[int, ...]:
        return tuple(int(x) for x in v.split(".") if x.isdigit())
    return tup(actual) >= tup(required)
