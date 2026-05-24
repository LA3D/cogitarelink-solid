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
from rdflib import Graph, RDF, URIRef
from pyshacl import validate

WIKI = "https://pod.vardeman.me/vault/ontology/wiki#"
LDP  = "http://www.w3.org/ns/ldp#"
SH   = "http://www.w3.org/ns/shacl#"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
PIM  = "http://www.w3.org/ns/pim/space#"
PROF = "http://www.w3.org/ns/dx/prof/"

# Storage-description pointers the walker HEAD-checks (label → predicate IRI).
CATALOG_POINTERS = {
    "affordanceCatalog": WIKI + "affordanceCatalog",
    "typeIndex":         WIKI + "typeIndex",
    "contextDocument":   WIKI + "contextDocument",
    "shapeCatalog":      WIKI + "shapeCatalog",
    "profileDocument":   WIKI + "profileDocument",
}

SEV = {SH + "Violation": "ERROR", SH + "Warning": "WARN", SH + "Info": "INFO"}


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


async def audit(pod_url, shapes_dir):
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

        codes = await asyncio.gather(*(
            head_ok(client, rewrite(t, canon_base, pod_base)) for t in targets))
        for (iri, kind), code in zip(targets.items(), codes):
            if code == 200:
                continue
            sev = "ERROR" if kind != "seeAlso" else "WARN"
            findings.append(finding(sev, iri, f"resolve:{kind}",
                f"{kind} target does not resolve (got {code}).",
                "Stale pointer — update or remove it (Type Index already routes containers)."))

        # 4. Affordance catalog walk
        cat_iri = next(iter(o for o, k in targets.items() if k == "catalog:affordanceCatalog"), None)
        if cat_iri:
            await walk_affordances(client, rewrite(cat_iri, canon_base, pod_base),
                                   canon_base, pod_base, shapes_g, findings)
    return findings


async def walk_affordances(client, cat_url, canon_base, pod_base, shapes_g, findings):
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
    args = ap.parse_args()

    findings = asyncio.run(audit(args.pod_url, args.shapes_dir))
    text = json.dumps({"pod": args.pod_url, "findings": findings}, indent=2) \
        if args.out_format == "json" else to_markdown(args.pod_url, findings)
    if args.out:
        Path(args.out).write_text(text)
    print(text)
    sys.exit(1 if any(f["severity"] == "ERROR" for f in findings) else 0)


if __name__ == "__main__":
    main()
