"""Backfill content-level dct:conformsTo on already-imported wiki-memory L3 resources.

Iterates LDP containers /vault/wiki/{pages,sources,people,procedures,working}/ ,
reads each resource's .meta, checks rdf:type, and PATCHes in dct:conformsTo if
the type maps to a known profile and the conformsTo triple isn't already there.

Idempotent. Safe to re-run.
"""
import argparse
import asyncio
import sys

import httpx
from rdflib import Graph, URIRef
from rdflib.namespace import RDF

DCT_CONFORMS_TO = URIRef("http://purl.org/dc/terms/conformsTo")
WIKI = "https://pod.vardeman.me/vault/ontology/wiki#"
TYPE_TO_PROFILE = {
    URIRef(f"{WIKI}Concept"):     "https://pod.vardeman.me/vault/meta/profiles/concept",
    URIRef(f"{WIKI}Source"):      "https://pod.vardeman.me/vault/meta/profiles/source",
    URIRef(f"{WIKI}Person"):      "https://pod.vardeman.me/vault/meta/profiles/person",
    URIRef(f"{WIKI}Procedure"):   "https://pod.vardeman.me/vault/meta/profiles/procedure",
    URIRef(f"{WIKI}WorkingNote"): "https://pod.vardeman.me/vault/meta/profiles/working",
}
CONTAINERS = [
    "/vault/wiki/pages/", "/vault/wiki/sources/", "/vault/wiki/people/",
    "/vault/wiki/procedures/", "/vault/wiki/working/",
]


async def list_container(client: httpx.AsyncClient, base: str, path: str) -> list[str]:
    r = await client.get(f"{base}{path}", headers={"Accept": "text/turtle"})
    r.raise_for_status()
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=f"{base}{path}")
    return [str(o) for o in g.objects(URIRef(f"{base}{path}"),
            URIRef("http://www.w3.org/ns/ldp#contains"))]


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
        return f"SKIP {resource_url} (no recognized wiki:* type)"
    if (res, DCT_CONFORMS_TO, URIRef(profile)) in g:
        return f"SKIP {resource_url} (already has conformsTo)"
    if dry_run:
        return f"DRY {resource_url} → conformsTo {profile}"
    patch = (
        "PREFIX dct: <http://purl.org/dc/terms/>\n"
        f"INSERT DATA {{ <{resource_url}> dct:conformsTo <{profile}> . }}"
    )
    pr = await client.patch(meta_url, content=patch,
                            headers={"Content-Type": "application/sparql-update"})
    pr.raise_for_status()
    return f"OK   {resource_url} → conformsTo {profile}"


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pod", default="https://pod.vardeman.me")
    ap.add_argument("--containers", nargs="+", default=CONTAINERS,
                    help="LDP container paths to scan (default: vault/wiki/* hierarchy)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    async with httpx.AsyncClient(timeout=10, verify=False) as client:
        for path in args.containers:
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
