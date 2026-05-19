"""Shared utilities for overlay apply/remove/verify scripts.

All HTTP operations go through a single httpx.Client; N3 Patch construction
is shared because it's the same shape for every modification of a shared
substrate resource (storage description, Type Index, context.jsonld).

NOTE on capability resolution: an overlay's `overlay:requiresCapability` clauses
use the full descriptor URL as the IRI in `cap:requires`, e.g.,
`<https://pod.vardeman.me/vault/meta/capabilities/markdown-content-projection>`.
fetch_capability_catalog returns a dict keyed by these descriptor URLs.
Manifest authors should NOT use the capability class IRI like cap:ContentProjection
in cap:requires — those are types, not implementations.
"""
from __future__ import annotations
import json
from dataclasses import dataclass, field
from pathlib import Path

import httpx
from rdflib import Graph, Namespace, URIRef, Literal
from rdflib.namespace import RDF, DCTERMS

OVERLAY = Namespace("https://pod.vardeman.me/vault/ontology/overlay#")
CAP     = Namespace("https://pod.vardeman.me/vault/ontology/capability#")
SOLID   = Namespace("http://www.w3.org/ns/solid/terms#")
VOID    = Namespace("http://rdfs.org/ns/void#")
SH      = Namespace("http://www.w3.org/ns/shacl#")
WIKI    = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")  # only when overlay uses it


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
    instance_container: URIRef | None = None
    instance: URIRef | None = None


@dataclass(frozen=True)
class CapabilityProvision:
    url: str        # full URL where the descriptor will live (e.g., /vault/meta/capabilities/foo.ttl)
    document: str   # raw Turtle body of the descriptor


@dataclass(frozen=True)
class TemplateEntry:
    url: str
    document: str


@dataclass(frozen=True)
class ContainerMetaPatch:
    container_url: str  # the target container URL (where .meta lives)
    patch_body: str     # the N3 Patch body to apply


@dataclass(frozen=True)
class ResourceMetaPatch:
    target_resource: str  # the target resource URL (where .meta lives)
    patch_body: str       # the N3 Patch body to apply


@dataclass(frozen=True)
class BootstrapContent:
    local_path: Path    # local file in overlay_dir
    hosted_at: str      # Pod-side path (e.g., "/vault/contacts/index.ttl")
    content_type: str   # MIME type (default: text/turtle)


@dataclass(frozen=True)
class PageInstall:
    """Deploy a wiki-memory page (body + .meta sidecar) to a target resource URL.

    Body is text/markdown; meta is text/turtle. Used for the wiki-memory L3
    synthesis page at /vault/wiki/index.md and any future per-overlay page
    deployments that need both body and meta committed atomically.
    """
    target_resource: str  # Pod URL where the page is deployed
    body_path: Path       # local body file (markdown), relative to overlay_dir
    meta_path: Path       # local .meta file (Turtle), relative to overlay_dir


@dataclass(frozen=True)
class HintMapping:
    """A wikilink class-hint → RDF predicate mapping declared by an overlay (D98).

    Runtime consumers: MarkdownProjectionListener reads these at startup to extend
    the built-in hint table. No deploy step — pure data for the listener.
    """
    class_hint: str    # e.g., "affiliation"
    predicate: str     # full IRI e.g., "https://schema.org/affiliation"
    subject: str       # "PAGE" or "THING" — which resource becomes the subject


@dataclass(frozen=True)
class ExtensionGuide:
    """An L4 extension manual to be deployed to the Pod (D100)."""
    document: str    # local filename within overlay_dir (e.g., "extending-l3.md")
    hosted_at: str   # Pod-side path (e.g., "/vault/meta/extending-l3.md")


@dataclass(frozen=True)
class Manifest:
    """Parsed view of an overlay's manifest.ttl."""
    name: str
    version: str
    overlay_iri: URIRef
    profile_iri: URIRef | None
    required_capabilities: list[CapabilityRequirement]
    optional_capabilities: list[CapabilityRequirement]
    vocabularies: list[VocabularyDeclaration]
    container_paths: list[str]        # e.g., "/vault/wiki/pages/"
    shape_urls: list[str]             # full Pod URLs
    affordance_urls: list[str]
    role_scheme_urls: list[str]
    profile_urls: list[str]
    type_registrations: list[TypeRegistration]
    provides: list[CapabilityProvision]
    templates: list[TemplateEntry]
    bootstrap_content: list[BootstrapContent]
    page_installs: list[PageInstall]
    container_meta_patches: list[ContainerMetaPatch]
    resource_meta_patches: list[ResourceMetaPatch]
    hint_mappings: list[HintMapping]          # overlay:installsHintMapping (D98)
    extension_guides: list[ExtensionGuide]    # overlay:installsExtensionGuide (D100)
    overlay_dir: Path                 # local directory holding manifest + artifacts


def parse_manifest(overlay_dir: Path, pod_url: str | None = None) -> Manifest:
    """Parse manifest.ttl into a structured Manifest.

    If `pod_url` is given, it is used as the publicID so that relative IRIs
    in the manifest (e.g., </vault/wiki/pages/>) resolve against the target
    Pod URL rather than the local file path (which would produce file:///...
    IRIs that aren't usable as HTTP targets). The file:// fallback is kept
    for tooling that calls parse_manifest without a Pod URL — those callers
    must handle file:// IRIs themselves (apply.py's absolutize does).
    """
    manifest_path = overlay_dir / "manifest.ttl"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Overlay manifest not found: {manifest_path}")

    g = Graph()
    g.parse(manifest_path, format="turtle",
            publicID=pod_url or manifest_path.as_uri())

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
    role_schemes = sorted(str(o) for o in many(OVERLAY.installsRoleScheme))
    profiles = sorted(str(o) for o in many(OVERLAY.installsProfile))

    type_regs = []
    for tr_node in many(OVERLAY.installsTypeRegistration):
        fc = next(g.objects(tr_node, SOLID.forClass), None)
        ic = next(g.objects(tr_node, SOLID.instanceContainer), None)
        inst = next(g.objects(tr_node, SOLID.instance), None)
        if fc and (ic or inst):
            type_regs.append(TypeRegistration(
                for_class=URIRef(fc),
                instance_container=URIRef(ic) if ic else None,
                instance=URIRef(inst) if inst else None,
            ))

    cap_provisions = []
    for prov_node in many(OVERLAY.providesCapability):
        cap_iri = next(g.objects(prov_node, CAP.capability), None)
        descriptor_path = next(g.objects(prov_node, CAP.descriptor), None)
        if cap_iri and descriptor_path:
            doc_file = overlay_dir / str(descriptor_path)
            cap_provisions.append(CapabilityProvision(
                url=str(cap_iri),
                document=doc_file.read_text(),
            ))

    templates = []
    for tmpl_url in many(OVERLAY.installsTemplate):
        local = overlay_dir / "templates" / Path(str(tmpl_url)).name
        templates.append(TemplateEntry(url=str(tmpl_url), document=local.read_text()))

    meta_patches = []
    for mp_node in many(OVERLAY.installsContainerMetaPatch):
        ctr_url = next(g.objects(mp_node, OVERLAY.targetContainer), None)
        patch_path = next(g.objects(mp_node, OVERLAY.metaPatchContent), None)
        if ctr_url and patch_path:
            patch_file = overlay_dir / "patches" / str(patch_path)
            meta_patches.append(ContainerMetaPatch(
                container_url=str(ctr_url),
                patch_body=patch_file.read_text(),
            ))

    res_meta_patches = []
    for rmp_node in many(OVERLAY.installsResourceMetaPatch):
        res_url = next(g.objects(rmp_node, OVERLAY.targetResource), None)
        patch_path = next(g.objects(rmp_node, OVERLAY.metaPatchContent), None)
        if res_url and patch_path:
            patch_file = overlay_dir / "patches" / str(patch_path)
            res_meta_patches.append(ResourceMetaPatch(
                target_resource=str(res_url),
                patch_body=patch_file.read_text(),
            ))

    # installsBootstrapContent: list of {contentPath, hostedAt} nodes
    bootstrap = []
    for bc_node in many(OVERLAY.installsBootstrapContent):
        cp = next(g.objects(bc_node, OVERLAY.contentPath), None)
        ha = next(g.objects(bc_node, OVERLAY.hostedAt), None)
        ct = next(g.objects(bc_node, OVERLAY.contentType), Literal("text/turtle"))
        if cp and ha:
            local_file = overlay_dir / str(cp)
            bootstrap.append(BootstrapContent(
                local_path=local_file,
                hosted_at=str(ha),
                content_type=str(ct),
            ))

    # pod_prefix is used to strip the resolved publicID from body/meta IRIs
    # back to overlay-relative paths (e.g., "synthesis/index.md").
    pod_prefix = (pod_url or "").rstrip("/") + "/"
    page_installs = []
    for pi_node in many(OVERLAY.installsPage):
        target = next(g.objects(pi_node, OVERLAY.targetResource), None)
        body = next(g.objects(pi_node, OVERLAY.body), None)
        meta = next(g.objects(pi_node, OVERLAY.meta), None)
        if target and body and meta:
            body_rel = str(body).removeprefix(pod_prefix)
            meta_rel = str(meta).removeprefix(pod_prefix)
            page_installs.append(PageInstall(
                target_resource=str(target),
                body_path=overlay_dir / body_rel,
                meta_path=overlay_dir / meta_rel,
            ))

    # overlay:installsHintMapping — listener hint-table extensions (D98)
    # No deploy step: pure data for MarkdownProjectionListener at runtime.
    hint_mappings = []
    for hint_node in g.objects(overlay_iri, OVERLAY.installsHintMapping):
        hint_class = g.value(hint_node, OVERLAY.classHint)
        predicate = g.value(hint_node, OVERLAY.projectsToPredicate)
        subject_scope = g.value(hint_node, OVERLAY.projectsToSubject)
        if hint_class and predicate and subject_scope:
            hint_mappings.append(HintMapping(
                class_hint=str(hint_class),
                predicate=str(predicate),
                subject=str(subject_scope),
            ))

    # overlay:installsExtensionGuide — L4 extension manual installs (D100)
    extension_guides = []
    for guide_node in g.objects(overlay_iri, OVERLAY.installsExtensionGuide):
        document = g.value(guide_node, OVERLAY.document)
        hosted_at = g.value(guide_node, OVERLAY.hostedAt)
        if document and hosted_at:
            extension_guides.append(ExtensionGuide(
                document=str(document),
                hosted_at=str(hosted_at),
            ))

    return Manifest(
        name=name, version=version, overlay_iri=overlay_iri, profile_iri=profile_iri,
        required_capabilities=req_caps, optional_capabilities=opt_caps,
        vocabularies=vocabs,
        container_paths=containers, shape_urls=shapes, affordance_urls=affordances,
        role_scheme_urls=role_schemes, profile_urls=profiles,
        type_registrations=type_regs,
        provides=cap_provisions,
        templates=templates,
        bootstrap_content=bootstrap,
        page_installs=page_installs,
        container_meta_patches=meta_patches,
        resource_meta_patches=res_meta_patches,
        hint_mappings=hint_mappings,
        extension_guides=extension_guides,
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
