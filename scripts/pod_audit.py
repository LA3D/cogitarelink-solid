#!/usr/bin/env python
# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx", "rdflib", "pyshacl"]
# ///
"""pod-audit — validate a Pod's substrate self-description (D104 / vault-D99).

Two complementary checks, per the SHACL-as-guardrails + agent-as-construction
split: (1) SHACL validation of the storage description and every affordance
descriptor against the substrate shapes; (2) HTTP cross-checks SHACL cannot
express — do the catalog pointers and rdfs:seeAlso targets actually resolve?

Emits findings (ERROR / WARN / INFO) as JSON (the pod-curator's work queue) or
markdown (human). Non-zero exit on any ERROR.

  python scripts/pod_audit.py [POD_URL] [--shapes-dir shapes/substrate/]
                              [--out-format json|markdown] [--out FILE]

Inference is forced to "none": RDFS entailment masks missing-predicate and
rooting violations (see FOLLOWUPS — ClassExtensionShape, and the storage
catalog pointers).
"""
import argparse, asyncio, json, os, subprocess, sys
from pathlib import Path
import httpx
import rdflib
from rdflib import Graph, RDF, URIRef
from pyshacl import validate

# The Pod that mints the substrate VOCAB namespaces (wiki:/sub:). These are STABLE
# vocabulary IRIs — they identify terms, not network locations, and do NOT vary with
# the Pod the audit runs against (that base is discovered live, see canon_base/pod_base
# in audit()). Hoisted to one constant so the vocab host can't drift across the IRIs.
CANONICAL_NS_HOST = "https://pod.vardeman.me"
WIKI   = f"{CANONICAL_NS_HOST}/vault/ontology/wiki#"
SUB    = f"{CANONICAL_NS_HOST}/vault/ontology/substrate#"
SOLID  = "http://www.w3.org/ns/solid/terms#"
LDP    = "http://www.w3.org/ns/ldp#"
SH     = "http://www.w3.org/ns/shacl#"
RDFS   = "http://www.w3.org/2000/01/rdf-schema#"
PIM    = "http://www.w3.org/ns/pim/space#"
PROF   = "http://www.w3.org/ns/dx/prof/"
SKOS   = "http://www.w3.org/2004/02/skos/core#"
INTEROP = "http://www.w3.org/ns/solid/interop#"
ST     = "http://www.w3.org/ns/shapetrees#"

# The wikirole SKOS scheme — prof:hasRole targets under this namespace must be
# defined here, else the role is dangling (e.g. the search-affordance role that
# wiki-search-grep cited before it was minted). W3C-standard roles (a different
# namespace) are out of scope for the membership check.
ROLE_DOC = "ontology/wikirole"  # relative to pod_base

# Storage-description pointers the walker HEAD-checks (label → predicate IRI).
CATALOG_POINTERS = {
    "affordanceCatalog": SUB + "affordanceCatalog",
    "typeIndex":         SOLID + "publicTypeIndex",
    "contextDocument":   SUB + "contextDocument",
    "shapeCatalog":      SUB + "shapeCatalog",
    "profileDocument":   SUB + "profileDocument",
}

SEV = {SH + "Violation": "ERROR", SH + "Warning": "WARN", SH + "Info": "INFO"}

ROUTES_TO_CLASS = SUB + "routesToClass"

# Cached published rdfs:range for the entailed predicates (schema.org / dct).
# Used ONLY for the agreement WARN. NOT the routing map — that is read live.
PUBLISHED_RANGE = {
    "https://schema.org/affiliation":       "https://schema.org/Organization",
    "https://schema.org/location":          "https://schema.org/Place",
    "http://purl.org/dc/terms/contributor": "https://schema.org/Person",
}


def load_routing_from_jsonld(path_or_text, is_text=False):
    g = rdflib.Graph()
    if is_text:
        g.parse(data=path_or_text, format="json-ld")
    else:
        g.parse(path_or_text, format="json-ld")
    p = rdflib.URIRef(ROUTES_TO_CLASS)
    return {str(s): str(o) for s, o in g.subject_objects(p)}


def check_routing(routing, type_index, published_range=PUBLISHED_RANGE):
    "routing: {predicate: class}. type_index: {class_iri: container_path}."
    registered = set(type_index.keys())
    findings = []
    for pred, cls in routing.items():
        if cls not in registered:
            findings.append(finding("ERROR", cls, "routing:type-index-coverage",
                f"{pred} routes to {cls} but that class is not registered in the Type Index.",
                f"Register {cls} in the Type Index so {pred} can route."))
        pub = published_range.get(pred)
        if pub and pub != cls:
            findings.append(finding("WARN", pred, "routing:published-range-agreement",
                f"{pred}→{cls} differs from published rdfs:range {pub}; confirm intentional.",
                f"Confirm {pred}→{cls} is intentional or correct the routing map."))
    return findings


def finding(sev, location, constraint, message, remediation=""):
    return dict(severity=sev, location=str(location), constraint=constraint,
                message=message.strip(), remediation=remediation)


def load_shapes(shapes_dir):
    g = Graph()
    for f in sorted(Path(shapes_dir).glob("*.ttl")):
        g.parse(f, format="turtle")
    return g


def rewrite(iri, canon_base, pod_base):
    "Map a canonical-IRI to the reachable Pod base for HTTP cross-checks."
    return pod_base + iri[len(canon_base):] if iri.startswith(canon_base) else iri


def run_shacl(data_g, shapes_g, focus_label):
    "Validate data_g; return findings parsed from the SHACL results graph."
    conforms, results_g, _ = validate(
        data_g, shacl_graph=shapes_g, inference="none",
        advanced=True, meta_shacl=False)
    if conforms:
        return []
    out = []
    R = lambda p: URIRef(SH + p)
    for r in results_g.subjects(RDF.type, URIRef(SH + "ValidationResult")):
        sev = SEV.get(str(results_g.value(r, R("resultSeverity"))), "ERROR")
        focus = results_g.value(r, R("focusNode"))
        msg = results_g.value(r, R("resultMessage"))
        path = results_g.value(r, R("resultPath"))
        comp = results_g.value(r, R("sourceConstraintComponent"))
        constraint = f"{focus_label}:{str(path).rsplit('#', 1)[-1].rsplit('/', 1)[-1]}" \
            if path else f"{focus_label}:{str(comp).rsplit('#', 1)[-1]}"
        out.append(finding(sev, focus or focus_label, constraint,
                           str(msg) if msg else "SHACL violation",
                           "Patch the resource's .meta to satisfy the shape."))
    return out


async def head_ok(client, url):
    try:
        r = await client.head(url, follow_redirects=True)
        if r.status_code == 405:  # some handlers reject HEAD; fall back to GET
            r = await client.get(url, follow_redirects=True)
        return r.status_code
    except httpx.HTTPError as e:
        return f"error: {e.__class__.__name__}"


def resolve_ca():
    "TLS CA for the dev Pod. SSL_CERT_FILE wins; else auto-detect the mkcert CA "
    "(so the caller never has to wrangle the spaces-in-path env var — D85). Else system CAs."
    f = os.environ.get("SSL_CERT_FILE")
    if f and os.path.exists(f):
        return f
    try:
        root = subprocess.run(["mkcert", "-CAROOT"], capture_output=True,
                              text=True, timeout=5).stdout.strip()
        ca = os.path.join(root, "rootCA.pem")
        if root and os.path.exists(ca):
            return ca
    except (OSError, subprocess.SubprocessError):
        pass
    return True


async def fetch_type_index(client, sd_g, storage, canon_base, pod_base):
    "Fetch the Type Index and return {class_iri: container_path} or {}."
    ti_iri = next((str(o) for o in sd_g.objects(storage, URIRef(SOLID + "publicTypeIndex"))), None)
    if ti_iri is None:
        return {}
    ti_url = rewrite(ti_iri, canon_base, pod_base)
    r = await client.get(ti_url)
    if r.status_code != 200:
        return {}
    ti_g = Graph().parse(data=r.text, format="turtle", publicID=ti_url)
    result = {}
    for reg in ti_g.subjects(RDF.type, URIRef(SOLID + "TypeRegistration")):
        cls = ti_g.value(reg, URIRef(SOLID + "forClass"))
        ctr = ti_g.value(reg, URIRef(SOLID + "instanceContainer"))
        if cls and ctr:
            result[str(cls)] = str(ctr)
    return result


async def audit(pod_url, shapes_dir, check_routing_flag=False):
    findings = []
    shapes_g = load_shapes(shapes_dir)
    verify = resolve_ca()
    pod_base = pod_url if pod_url.endswith("/") else pod_url + "/"
    sd_url = pod_base + ".well-known/solid"

    async with httpx.AsyncClient(verify=verify, timeout=20.0,
                                 headers={"Accept": "text/turtle"}) as client:
        # 1. Storage description
        r = await client.get(sd_url)
        if r.status_code != 200:
            findings.append(finding("ERROR", sd_url, "discovery:storage-description",
                f"Storage description not reachable (HTTP {r.status_code}).",
                "Confirm the Pod is up and StorageDescriber override is loaded."))
            return findings
        sd_g = Graph().parse(data=r.text, format="turtle", publicID=sd_url)

        storage = next(sd_g.subjects(RDF.type, URIRef(PIM + "Storage")), None)
        if storage is None:
            findings.append(finding("ERROR", sd_url, "discovery:pim-storage",
                "No pim:Storage subject in the storage description.",
                "StaticStorageDescriber must assert rdf:type pim:Storage."))
            return findings
        canon_base = str(storage)

        # 2. SHACL: storage description
        findings += run_shacl(sd_g, shapes_g, "StorageDescriptionShape")

        # 3. Cross-check catalog pointers + rdfs:seeAlso targets resolve
        targets = {}
        for label, pred in CATALOG_POINTERS.items():
            for o in sd_g.objects(storage, URIRef(pred)):
                targets[str(o)] = f"catalog:{label}"
        for o in sd_g.objects(storage, URIRef(RDFS + "seeAlso")):
            targets[str(o)] = "seeAlso"
        # prof:hasResource targets (PROF profile descriptors) must resolve too —
        # the source→concept / procedure→howto drift left two stale pointers here
        # that the walker previously didn't dereference.
        for o in sd_g.objects(storage, URIRef(PROF + "hasResource")):
            targets[str(o)] = "hasResource"

        codes = await asyncio.gather(*(
            head_ok(client, rewrite(t, canon_base, pod_base)) for t in targets))
        for (iri, kind), code in zip(targets.items(), codes):
            if code == 200:
                continue
            sev = "WARN" if kind in ("seeAlso", "hasResource") else "ERROR"
            findings.append(finding(sev, iri, f"resolve:{kind}",
                f"{kind} target does not resolve (got {code}).",
                "Stale pointer — update or remove it (Type Index already routes containers)."))

        # 4. Affordance catalog walk
        role_members = await load_role_members(client, pod_base)
        cat_iri = next(iter(o for o, k in targets.items() if k == "catalog:affordanceCatalog"), None)
        if cat_iri:
            await walk_affordances(client, rewrite(cat_iri, canon_base, pod_base),
                                   canon_base, pod_base, shapes_g, role_members, findings)

        # 5. Interop registration graph
        await audit_interop_registration(client, pod_base, findings)

        # 6. Live Type Index registration validation
        await audit_type_index(client, sd_g, storage, canon_base, pod_base, findings)

        # 7. Routing sanity-check (--check-routing)
        if check_routing_flag:
            routing_url = pod_base + "meta/routing.jsonld"
            rr = await client.get(routing_url, headers={"Accept": "application/ld+json"})
            if rr.status_code != 200:
                findings.append(finding("ERROR", routing_url, "routing:unreachable",
                    f"routing.jsonld not reachable (HTTP {rr.status_code}).",
                    "Ensure /meta/routing.jsonld is published on the Pod."))
            else:
                routing_map = load_routing_from_jsonld(rr.text, is_text=True)
                type_index = await fetch_type_index(client, sd_g, storage, canon_base, pod_base)
                findings += check_routing(routing_map, type_index)

    return findings


async def load_role_members(client, pod_base):
    "IRIs defined in the wikirole SKOS scheme; None if unreachable (skip the check)."
    url = pod_base + ROLE_DOC
    try:
        r = await client.get(url)
        if r.status_code != 200:
            return None
        g = Graph().parse(data=r.text, format="turtle", publicID=url)
        return {str(s) for s in g.subjects(URIRef(SKOS + "inScheme"), None)}
    except (httpx.HTTPError, ValueError):
        return None


async def audit_type_index(client, sd_g, storage, canon_base, pod_base, findings):
    """Validate every solid:TypeRegistration in the live Type Index.

    Checks per-registration:
    1. solid:forClass present and an IRI (WARN if literal / missing).
    2. solid:instanceContainer present, an IRI, and under the discovered storage root (ERROR if outside).
    3. The container HEAD-resolves (2xx/3xx; WARN on 404 — registered-but-absent).
    4. No two registrations map the same instanceContainer to different forClass values (WARN — dup-container).
    """
    ti_iri = next((str(o) for o in sd_g.objects(storage, URIRef(SOLID + "publicTypeIndex"))), None)
    if ti_iri is None:
        findings.append(finding("WARN", str(storage), "typeindex:missing-pointer",
            "No solid:publicTypeIndex pointer in the storage description.",
            "Add solid:publicTypeIndex <.../publicTypeIndex> to the storage description."))
        return
    ti_url = rewrite(ti_iri, canon_base, pod_base)
    r = await client.get(ti_url)
    if r.status_code != 200:
        findings.append(finding("ERROR", ti_url, "typeindex:unreachable",
            f"Type Index not reachable (HTTP {r.status_code}).",
            "Ensure the Type Index resource is seeded and publicly readable."))
        return
    ti_g = Graph().parse(data=r.text, format="turtle", publicID=ti_url)

    # container_iri → [forClass IRI, ...] — for dup-container detection
    container_classes: dict[str, list[str]] = {}

    heads = []  # (reg_iri, container_iri) pairs needing HEAD checks
    for reg in ti_g.subjects(RDF.type, URIRef(SOLID + "TypeRegistration")):
        reg_iri = str(reg)

        # 1. solid:forClass
        cls_node = ti_g.value(reg, URIRef(SOLID + "forClass"))
        if cls_node is None:
            findings.append(finding("WARN", reg_iri, "typeindex:missing-forClass",
                "TypeRegistration has no solid:forClass.",
                "Add solid:forClass <ClassName> to the registration."))
            cls_iri = None
        elif not isinstance(cls_node, URIRef):
            findings.append(finding("WARN", reg_iri, "typeindex:forClass-literal",
                f"solid:forClass value is a literal ({cls_node!r}), expected an IRI.",
                "Replace the literal with an IRI reference."))
            cls_iri = None
        else:
            cls_iri = str(cls_node)

        # 2. solid:instanceContainer
        # solid:instance (single-resource) registrations are valid per the Solid Type Index
        # spec — skip the container checks for those; they are not containers.
        has_instance = ti_g.value(reg, URIRef(SOLID + "instance")) is not None
        ctr_node = ti_g.value(reg, URIRef(SOLID + "instanceContainer"))
        if ctr_node is None:
            if not has_instance:
                findings.append(finding("WARN", reg_iri, "typeindex:missing-instanceContainer",
                    "TypeRegistration has no solid:instanceContainer (and no solid:instance).",
                    "Add solid:instanceContainer <container/> or solid:instance <resource> "
                    "to the registration."))
            continue
        if not isinstance(ctr_node, URIRef):
            findings.append(finding("WARN", reg_iri, "typeindex:instanceContainer-literal",
                f"solid:instanceContainer value is a literal ({ctr_node!r}), expected an IRI.",
                "Replace the literal with an IRI reference."))
            continue
        ctr_iri = str(ctr_node)

        # Check the container is under the storage root.
        # We compare against canon_base (the pim:Storage IRI) and also against pod_base
        # (the reachable equivalent) so the check passes regardless of which host was used.
        canon_root = canon_base if canon_base.endswith("/") else canon_base + "/"
        pod_root   = pod_base   if pod_base.endswith("/")   else pod_base + "/"
        reachable_ctr = rewrite(ctr_iri, canon_base, pod_base)
        if not ctr_iri.startswith(canon_root) and not ctr_iri.startswith(pod_root) \
                and not reachable_ctr.startswith(pod_root):
            findings.append(finding("ERROR", reg_iri, "typeindex:container-outside-root",
                f"instanceContainer {ctr_iri} is not under the storage root {canon_root}.",
                "Registration must point only at containers within this Pod's storage root."))
            continue

        # 4. Accumulate per-container class list (for dup-container check after the loop)
        if ctr_iri not in container_classes:
            container_classes[ctr_iri] = []
        if cls_iri:
            container_classes[ctr_iri].append(cls_iri)

        heads.append((reg_iri, reachable_ctr))

    # 3. HEAD-check all containers in parallel.
    if heads:
        codes = await asyncio.gather(*(head_ok(client, url) for _, url in heads))
        for (reg_iri, ctr_url), code in zip(heads, codes):
            if isinstance(code, int) and code in (200, 301, 302, 303, 307, 308):
                continue
            sev = "WARN" if code == 404 else "WARN"
            findings.append(finding(sev, reg_iri, "typeindex:container-unreachable",
                f"Registered instanceContainer does not resolve (got {code}): {ctr_url}",
                "Create the container or remove the stale registration."))

    # 4. Dup-container: same container → multiple different forClass values.
    for ctr_iri, classes in container_classes.items():
        unique = list(dict.fromkeys(classes))  # preserve order, deduplicate
        if len(unique) > 1:
            findings.append(finding("WARN", ctr_iri, "typeindex:dup-container-conflict",
                f"instanceContainer {ctr_iri} is registered for multiple classes: "
                + ", ".join(unique) + ". The loader resolves deterministically but the "
                "intent may be wrong.",
                "Use distinct containers per class, or confirm the multi-class sharing is intentional."))


async def audit_interop_registration(client, pod_base, findings):
    """Walk the interop registration graph (Task 7 / D109 interop foundation).

    Checks:
    1. WebID + registry doc: RegistrySet → DataRegistry → 7 DataRegistrations.
    2. Each registeredShapeTree names a st:ShapeTree in the deployed tree doc.
    3. Each st:shape in the tree doc resolves to a sh:NodeShape in the shape catalog.
    """
    webid_url    = pod_base + "profile/card"
    registry_url = pod_base + "meta/interop/registry"
    trees_url    = pod_base + "meta/shapetrees/wiki-memory.tree"
    shapes_url   = pod_base + "meta/shapes/"
    webid_iri    = pod_base + "profile/card#me"

    # Fetch and merge the WebID card + registry doc.
    card_r, reg_r = await asyncio.gather(
        client.get(webid_url,    headers={"Accept": "text/turtle"}),
        client.get(registry_url, headers={"Accept": "text/turtle"}),
    )
    for url, r in ((webid_url, card_r), (registry_url, reg_r)):
        if r.status_code != 200:
            findings.append(finding("ERROR", url, "interop:unreachable",
                f"Interop registration resource not reachable (HTTP {r.status_code}).",
                "Ensure the resource is seeded and publicly readable."))
            return
    g = Graph()
    g.parse(data=card_r.text, format="turtle", publicID=webid_url)
    g.parse(data=reg_r.text,  format="turtle", publicID=registry_url)

    me = URIRef(webid_iri)
    reg_sets = list(g.objects(me, URIRef(INTEROP + "hasRegistrySet")))
    if not reg_sets:
        findings.append(finding("ERROR", webid_iri, "interop:no-registry-set",
            "No interop:hasRegistrySet on the WebID subject (merged card + registry).",
            "Publish the registry doc at meta/interop/registry with the hasRegistrySet triple."))
        return

    data_regs = []
    for rs in reg_sets:
        data_regs += list(g.objects(rs, URIRef(INTEROP + "hasDataRegistry")))
    if not data_regs:
        findings.append(finding("ERROR", registry_url, "interop:no-data-registry",
            "No interop:hasDataRegistry found on any RegistrySet.",
            "Add a DataRegistry node linked from the RegistrySet."))
        return

    registrations = []
    for dr in data_regs:
        registrations += list(g.objects(dr, URIRef(INTEROP + "hasDataRegistration")))
    # No magic count: registrations just have to be non-empty here; the real check
    # is set-equality against the container trees declared in the deployed tree doc
    # (computed below, once tree_g is fetched) — so substrate growth can't produce a
    # spurious "expected N" ERROR.
    if not registrations:
        findings.append(finding("ERROR", registry_url, "interop:no-registrations",
            "No interop:DataRegistration found on any DataRegistry.",
            "Add a DataRegistration per governed container tree."))
        return

    # Collect the registeredShapeTree IRIs.
    reg_trees = {}  # registration IRI → tree IRI
    for reg in registrations:
        tree = g.value(reg, URIRef(INTEROP + "registeredShapeTree"))
        if tree:
            reg_trees[str(reg)] = str(tree)
        else:
            findings.append(finding("ERROR", str(reg), "interop:missing-shape-tree",
                "DataRegistration has no interop:registeredShapeTree.",
                "Add interop:registeredShapeTree pointing at a ShapeTree in the tree doc."))

    # 2. Fetch the ShapeTree doc; verify every referenced tree exists there.
    trees_r = await client.get(trees_url)
    if trees_r.status_code != 200:
        findings.append(finding("ERROR", trees_url, "interop:shapetrees-unreachable",
            f"ShapeTree document not reachable (HTTP {trees_r.status_code}).",
            "Seed the wiki-memory.tree file into the Pod."))
        return
    tree_g = Graph().parse(data=trees_r.text, format="turtle", publicID=trees_url)
    defined_trees = {str(s) for s in tree_g.subjects(RDF.type, URIRef(ST + "ShapeTree"))}
    # Container trees = ShapeTrees that expect an st:Container (one per governed container).
    # The registrations must register exactly these — derive the expected set from the data,
    # never a hardcoded count, so adding a container can't trigger a false ERROR.
    container_trees = {str(s) for s in tree_g.subjects(
        URIRef(ST + "expectsType"), URIRef(ST + "Container"))}

    for reg_iri, tree_iri in reg_trees.items():
        if tree_iri not in defined_trees:
            findings.append(finding("ERROR", reg_iri, "interop:dangling-shape-tree",
                f"registeredShapeTree {tree_iri} is not defined (a st:ShapeTree) in {trees_url}.",
                "Define the missing ShapeTree in wiki-memory.tree or correct the registration."))

    # Set-equality: every container tree must have a registration, and no registration
    # may point at a non-container tree. This is the magic-7 replacement.
    registered_trees = set(reg_trees.values())
    unregistered = container_trees - registered_trees
    coverage_ok = (registered_trees == container_trees)
    for tree_iri in sorted(unregistered):
        findings.append(finding("ERROR", tree_iri, "interop:registration-coverage",
            f"Container tree {tree_iri} is declared in the ShapeTree doc but has no "
            f"DataRegistration.",
            "Add an interop:DataRegistration with registeredShapeTree pointing at it."))

    # 3. Collect all st:shape IRIs from the tree doc; resolve each against the shape catalog.
    tree_shapes = {str(o) for o in tree_g.objects(None, URIRef(ST + "shape"))}
    if not tree_shapes:
        findings.append(finding("WARN", trees_url, "interop:no-tree-shapes",
            "No st:shape predicates found in the ShapeTree document.",
            "Ensure resource trees declare st:shape pointing at SHACL NodeShapes."))
        return

    # Walk the shape catalog: GET container, then fetch each shape doc, collect NodeShapes.
    shapes_r = await client.get(shapes_url, headers={"Accept": "text/turtle"})
    if shapes_r.status_code != 200:
        findings.append(finding("ERROR", shapes_url, "interop:shapes-catalog-unreachable",
            f"Shape catalog not reachable (HTTP {shapes_r.status_code}).",
            "Ensure /meta/shapes/ is published on the Pod."))
        return
    cat_g = Graph().parse(data=shapes_r.text, format="turtle", publicID=shapes_url)
    shape_docs = [str(o) for o in cat_g.objects(URIRef(shapes_url), URIRef(LDP + "contains"))]

    fetched = await asyncio.gather(*(
        client.get(doc_url) for doc_url in shape_docs), return_exceptions=True)
    defined_shapes = set()
    for doc_url, resp in zip(shape_docs, fetched):
        if isinstance(resp, Exception) or resp.status_code != 200:
            continue
        sg = Graph().parse(data=resp.text, format="turtle", publicID=doc_url)
        defined_shapes.update(str(s) for s in sg.subjects(RDF.type, URIRef(SH + "NodeShape")))

    dangling_shapes = tree_shapes - defined_shapes
    for iri in sorted(dangling_shapes):
        findings.append(finding("ERROR", iri, "interop:dangling-shape",
            f"st:shape {iri} referenced in the tree doc is not a sh:NodeShape in the shape catalog.",
            "Define the missing NodeShape in the appropriate shape file under /meta/shapes/."))

    trees_all_defined = all(t in defined_trees for t in reg_trees.values())
    if not dangling_shapes and coverage_ok and trees_all_defined:
        findings.append(finding("INFO", registry_url, "interop:registration-ok",
            f"Interop registration graph: {len(registrations)} DataRegistrations covering "
            f"{len(container_trees)} container trees, all shape trees defined, all st:shape "
            f"IRIs resolve in the catalog.", ""))


async def walk_affordances(client, cat_url, canon_base, pod_base, shapes_g, role_members, findings):
    r = await client.get(cat_url)
    if r.status_code != 200:
        findings.append(finding("ERROR", cat_url, "resolve:affordanceCatalog",
            f"Affordance catalog not reachable (HTTP {r.status_code}).", ""))
        return
    cat_g = Graph().parse(data=r.text, format="turtle", publicID=cat_url)
    entries = [str(o) for o in cat_g.objects(URIRef(cat_url), URIRef(LDP + "contains"))]
    results = await asyncio.gather(*(
        client.get(rewrite(e, canon_base, pod_base)) for e in entries),
        return_exceptions=True)
    for entry, resp in zip(entries, results):
        if isinstance(resp, Exception) or resp.status_code != 200:
            findings.append(finding("ERROR", entry, "resolve:affordance-entry",
                "Affordance descriptor not reachable.", ""))
            continue
        ent_g = Graph().parse(data=resp.text, format="turtle", publicID=entry)
        # Catalog membership is ground truth: anything in ldp:contains IS a
        # descriptor and should conform to the contract. Typing is inconsistent
        # across overlays (the addressbook affordances are sub:Affordance only,
        # so prof:ResourceDescriptor-targeted SHACL never sees them). Enforce the
        # governing type here so under-described entries can't slip through.
        if (URIRef(entry), RDF.type, URIRef(PROF + "ResourceDescriptor")) not in ent_g:
            findings.append(finding("WARN", entry, "descriptor:untyped",
                "Catalog entry is not typed prof:ResourceDescriptor, so it escapes "
                "the descriptor contract (no role/label/conformsTo/installedBy enforced).",
                "Add 'a prof:ResourceDescriptor' plus prof:hasRole, rdfs:label, "
                "dct:conformsTo, sub:installedBy to bring it under governance."))
        # prof:hasRole membership: a role under the wikirole namespace must be
        # defined in the scheme. Catches dangling roles SHACL can't see (it only
        # checks cardinality, not that the target concept exists).
        if role_members is not None:
            role_ns = pod_base + ROLE_DOC + "#"
            for role in ent_g.objects(URIRef(entry), URIRef(PROF + "hasRole")):
                if str(role).startswith(role_ns) and str(role) not in role_members:
                    findings.append(finding("WARN", entry, "descriptor:dangling-role",
                        f"prof:hasRole {role} is not skos:inScheme the wikirole scheme.",
                        "Define the role concept in /vault/ontology/wikirole, or point "
                        "prof:hasRole at an existing role."))
        findings += run_shacl(ent_g, shapes_g, f"AffordanceDescriptor<{entry.rsplit('/', 1)[-1]}>")


def to_markdown(pod_url, findings):
    n = {s: sum(1 for f in findings if f["severity"] == s) for s in ("ERROR", "WARN", "INFO")}
    lines = [f"# pod-audit report — {pod_url}", "",
             f"**{n['ERROR']} ERROR · {n['WARN']} WARN · {n['INFO']} INFO**", ""]
    if not findings:
        lines.append("All substrate checks pass. ✅")
    for sev in ("ERROR", "WARN", "INFO"):
        fs = [f for f in findings if f["severity"] == sev]
        if not fs:
            continue
        lines.append(f"## {sev} ({len(fs)})")
        for f in fs:
            lines.append(f"- **{f['constraint']}** — {f['message']}")
            lines.append(f"  - `{f['location']}`")
            if f["remediation"]:
                lines.append(f"  - _fix_: {f['remediation']}")
        lines.append("")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="Audit a Pod's substrate self-description.")
    ap.add_argument("pod_url", nargs="?", default=f"{CANONICAL_NS_HOST}/vault/")
    ap.add_argument("--shapes-dir", default="shapes/substrate/")
    ap.add_argument("--out-format", choices=["json", "markdown"], default="markdown")
    ap.add_argument("--out")
    ap.add_argument("--check-routing", action="store_true",
                    help="Fetch /meta/routing.jsonld and validate routing entries against the live Type Index.")
    args = ap.parse_args()

    findings = asyncio.run(audit(args.pod_url, args.shapes_dir, args.check_routing))
    text = json.dumps({"pod": args.pod_url, "findings": findings}, indent=2) \
        if args.out_format == "json" else to_markdown(args.pod_url, findings)
    if args.out:
        Path(args.out).write_text(text)
    print(text)
    sys.exit(1 if any(f["severity"] == "ERROR" for f in findings) else 0)


if __name__ == "__main__":
    main()
