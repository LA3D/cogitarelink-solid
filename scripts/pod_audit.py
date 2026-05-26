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

WIKI = "https://pod.vardeman.me/vault/ontology/wiki#"
LDP  = "http://www.w3.org/ns/ldp#"
SH   = "http://www.w3.org/ns/shacl#"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
PIM  = "http://www.w3.org/ns/pim/space#"
PROF = "http://www.w3.org/ns/dx/prof/"
SKOS = "http://www.w3.org/2004/02/skos/core#"

# The wikirole SKOS scheme — prof:hasRole targets under this namespace must be
# defined here, else the role is dangling (e.g. the search-affordance role that
# wiki-search-grep cited before it was minted). W3C-standard roles (a different
# namespace) are out of scope for the membership check.
ROLE_DOC = "ontology/wikirole"  # relative to pod_base

# Storage-description pointers the walker HEAD-checks (label → predicate IRI).
CATALOG_POINTERS = {
    "affordanceCatalog": WIKI + "affordanceCatalog",
    "typeIndex":         WIKI + "typeIndex",
    "contextDocument":   WIKI + "contextDocument",
    "shapeCatalog":      WIKI + "shapeCatalog",
    "profileDocument":   WIKI + "profileDocument",
}

SEV = {SH + "Violation": "ERROR", SH + "Warning": "WARN", SH + "Info": "INFO"}

SOLID = "http://www.w3.org/ns/solid/terms#"
ROUTES_TO_CLASS = WIKI + "routesToClass"

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
    ti_iri = next((str(o) for o in sd_g.objects(storage, URIRef(WIKI + "typeIndex"))), None)
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

        # 5. Routing sanity-check (--check-routing)
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
        # across overlays (the addressbook affordances are wiki:Affordance only,
        # so prof:ResourceDescriptor-targeted SHACL never sees them). Enforce the
        # governing type here so under-described entries can't slip through.
        if (URIRef(entry), RDF.type, URIRef(PROF + "ResourceDescriptor")) not in ent_g:
            findings.append(finding("WARN", entry, "descriptor:untyped",
                "Catalog entry is not typed prof:ResourceDescriptor, so it escapes "
                "the descriptor contract (no role/label/conformsTo/installedBy enforced).",
                "Add 'a prof:ResourceDescriptor' plus prof:hasRole, rdfs:label, "
                "dct:conformsTo, wiki:installedBy to bring it under governance."))
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
    ap.add_argument("pod_url", nargs="?", default="https://pod.vardeman.me/vault/")
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
