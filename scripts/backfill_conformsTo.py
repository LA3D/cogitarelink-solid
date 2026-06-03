"""Backfill content-level dct:conformsTo on already-imported wiki-memory L3 resources.

Walks the live Type Index to discover the governed containers (the pod_audit
walker pattern), reads each resource's .meta, checks rdf:type, and PATCHes in
dct:conformsTo if the type maps to a known profile and the conformsTo triple
isn't already there.

Idempotent. Safe to re-run. One-shot D98 migration helper.
"""
import argparse
import asyncio
import sys

import httpx
from rdflib import Graph, URIRef
from rdflib.namespace import RDF, DCTERMS

SOLID = "http://www.w3.org/ns/solid/terms#"
LDP   = "http://www.w3.org/ns/ldp#"
SCHEMA = "https://schema.org/"
SKOS   = "http://www.w3.org/2004/02/skos/core#"
WIKI   = "https://pod.vardeman.me/vault/ontology/wiki#"
PROFILE = "https://pod.vardeman.me/vault/meta/profiles/"

# D98 class → PROF profile. Classes match the live Type Index registrations
# (skos:Concept / schema:Person|Place|Event|Organization|HowTo / wiki:Source|WorkingNote).
TYPE_TO_PROFILE = {
    URIRef(f"{SKOS}Concept"):        f"{PROFILE}concept",
    URIRef(f"{WIKI}Source"):         f"{PROFILE}source",
    URIRef(f"{SCHEMA}Person"):       f"{PROFILE}person",
    URIRef(f"{SCHEMA}Place"):        f"{PROFILE}place",
    URIRef(f"{SCHEMA}Event"):        f"{PROFILE}event",
    URIRef(f"{SCHEMA}Organization"): f"{PROFILE}organization",
    URIRef(f"{SCHEMA}HowTo"):        f"{PROFILE}howto",
    URIRef(f"{WIKI}WorkingNote"):    f"{PROFILE}working",
}

# Fallback if the Type Index is unreachable. These are the D98 containers
# (pre-D98 used pages/sources/people/procedures/working — that list is RETIRED).
FALLBACK_CONTAINERS = [
    "/vault/wiki/concepts/", "/vault/wiki/people/", "/vault/wiki/places/",
    "/vault/wiki/events/", "/vault/wiki/organizations/",
    "/vault/wiki/procedures/", "/vault/wiki/working/",
]


async def discover_containers(client: httpx.AsyncClient, base: str) -> list[str]:
    "Container paths from the live Type Index (instanceContainer set). Fallback on failure."
    ti_url = f"{base}/vault/settings/publicTypeIndex"
    try:
        r = await client.get(ti_url, headers={"Accept": "text/turtle"})
        r.raise_for_status()
        g = Graph().parse(data=r.text, format="turtle", publicID=ti_url)
        ctrs = sorted({str(o) for o in g.objects(None, URIRef(f"{SOLID}instanceContainer"))})
        return [c[len(base):] if c.startswith(base) else c for c in ctrs] or FALLBACK_CONTAINERS
    except (httpx.HTTPError, ValueError):
        print(f"WARN type index unreachable at {ti_url}; using fallback container list",
              file=sys.stderr)
        return FALLBACK_CONTAINERS


async def list_container(client: httpx.AsyncClient, base: str, path: str) -> list[str]:
    r = await client.get(f"{base}{path}", headers={"Accept": "text/turtle"})
    r.raise_for_status()
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=f"{base}{path}")
    return [str(o) for o in g.objects(URIRef(f"{base}{path}"),
            URIRef(f"{LDP}contains"))]


async def backfill_one(client: httpx.AsyncClient, resource_url: str, dry_run: bool) -> str:
    meta_url = f"{resource_url}.meta"
    r = await client.get(meta_url, headers={"Accept": "text/turtle"})
    if r.status_code != 200:
        return f"SKIP {resource_url} (no .meta, status {r.status_code})"
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=meta_url)
    res = URIRef(resource_url)
    types = set(g.objects(res, RDF.type))
    profile = next((TYPE_TO_PROFILE[t] for t in types if t in TYPE_TO_PROFILE), None)
    if not profile:
        return f"SKIP {resource_url} (no recognized type)"
    if (res, DCTERMS.conformsTo, URIRef(profile)) in g:
        return f"SKIP {resource_url} (already has conformsTo)"
    if dry_run:
        return f"DRY {resource_url} → conformsTo {profile}"
    # Build the insert as a Graph → N3 Patch (rdflib serializes inside; no
    # hand-built Turtle/SPARQL — the injection class is impossible).
    patch_g = Graph()
    patch_g.add((res, DCTERMS.conformsTo, URIRef(profile)))
    inserts = patch_g.serialize(format="nt").strip()
    n3 = (
        "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n\n"
        f"_:patch a solid:InsertDeletePatch ;\n   solid:inserts {{ {inserts} }} .\n"
    )
    pr = await client.patch(meta_url, content=n3.encode("utf-8"),
                            headers={"Content-Type": "text/n3"})
    pr.raise_for_status()
    return f"OK   {resource_url} → conformsTo {profile}"


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pod", default="https://pod.vardeman.me")
    ap.add_argument("--containers", nargs="+", default=None,
                    help="LDP container paths to scan (default: derive from live Type Index)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    async with httpx.AsyncClient(timeout=10, verify=False) as client:
        containers = args.containers or await discover_containers(client, args.pod)
        for path in containers:
            try:
                resources = await list_container(client, args.pod, path)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    print(f"SKIP {path} (container not found)")
                    continue
                print(f"ERROR listing {path}: {e}", file=sys.stderr)
                continue
            except httpx.HTTPError as e:
                print(f"ERROR listing {path}: {e}", file=sys.stderr)
                continue
            if not resources:
                print(f"SKIP {path} (empty container)")
                continue
            results = await asyncio.gather(
                *(backfill_one(client, r, args.dry_run) for r in resources),
                return_exceptions=True,
            )
            for r in results:
                print(r)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
