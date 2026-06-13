#!/usr/bin/env python
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx", "rdflib"]
# ///
"""Migration sweep (spec §6): after a projector version bump, re-baseline every
markdown resource — re-PUT each body unchanged so the floor re-projects (degraded
pair-shadow on old-version resources), stamps the new sub:projectorVersion, and flags
any residue to the curation lane. Idempotent; run once per bump.

Usage: SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python scripts/projector_migrate.py [--pod https://pod.vardeman.me]
"""
import argparse, sys
from urllib.parse import urljoin
import httpx
from rdflib import Graph, Namespace, URIRef

# Mirror pod_audit.py: the substrate VOCAB host is STABLE (it identifies terms, not a
# network location) and does NOT vary with the Pod being swept.
SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
LDP_CONTAINS = URIRef("http://www.w3.org/ns/ldp#contains")

# Current projector version. The robust post-sweep check is "did the .meta gain ANY
# sub:projectorVersion stamp" (any swept body re-projects through the floor that
# stamps), so we don't hard-pin to this — but read it for the summary line.
PROJECTOR_VERSION = "0.1.0"

WIKI_CONTAINERS = [
    "concepts", "people", "places", "events",
    "organizations", "procedures", "working",
]


def resolve_ca():
    "SSL_CERT_FILE wins; else auto-detect the mkcert CA (D85); else verify=False."
    import os, subprocess
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
    return False


def container_members(client, ctr_url):
    "GET the container, return absolute member URLs ending in .md (index.md skipped)."
    r = client.get(ctr_url, headers={"Accept": "text/turtle"})
    r.raise_for_status()
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=ctr_url)
    members = []
    for o in g.objects(None, LDP_CONTAINS):
        url = str(o)
        if not url.endswith(".md"):
            continue
        # index.md is a substrate-derived view (sub:ContainerIndex), re-baselined by
        # the listener, not an agent body to re-PUT — skip by name.
        if url.rsplit("/", 1)[-1] == "index.md":
            continue
        members.append(url)
    return sorted(members)


def has_version_stamp(client, member_url):
    "True if the member's .meta carries ANY sub:projectorVersion after the sweep."
    r = client.get(f"{member_url}.meta", headers={"Accept": "text/turtle"})
    if r.status_code >= 400:
        return False
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=member_url)
    return len(list(g.objects(None, SUB.projectorVersion))) > 0


def sweep(pod):
    ca = resolve_ca()
    client = httpx.Client(verify=ca if ca else False, timeout=30.0)
    vault = pod.rstrip("/") + "/vault/wiki/"
    grand_ok = grand_fail = grand_stamped = 0
    failures = []
    try:
        for name in WIKI_CONTAINERS:
            ctr = urljoin(vault, name + "/")
            try:
                members = container_members(client, ctr)
            except httpx.HTTPStatusError as e:
                print(f"  {name}/: container GET {e.response.status_code} — skipped")
                continue
            ok = fail = stamped = 0
            for m in members:
                body = client.get(m, headers={"Accept": "text/markdown"})
                if body.status_code >= 400:
                    fail += 1
                    failures.append(f"{m} (GET {body.status_code})")
                    continue
                put = client.put(m, content=body.content,
                                 headers={"Content-Type": "text/markdown"})
                if put.status_code in (200, 201, 204, 205):
                    ok += 1
                    if has_version_stamp(client, m):
                        stamped += 1
                else:
                    fail += 1
                    failures.append(f"{m} (PUT {put.status_code})")
            print(f"  {name}/: {ok} re-PUT, {stamped} stamped, {fail} failed "
                  f"({len(members)} .md members)")
            grand_ok += ok; grand_fail += fail; grand_stamped += stamped
    finally:
        client.close()

    print(f"\nTotal: {grand_ok} re-PUT, {grand_stamped} carry sub:projectorVersion "
          f"(current = {PROJECTOR_VERSION}), {grand_fail} failed")
    if failures:
        print("Failures:")
        for f in failures:
            print(f"  - {f}")
    return grand_fail


def main():
    ap = argparse.ArgumentParser(description="Projector migration sweep (spec §6).")
    ap.add_argument("--pod", default="https://pod.vardeman.me")
    args = ap.parse_args()
    print(f"Migration sweep over {args.pod}/vault/wiki/ (projector {PROJECTOR_VERSION})\n")
    fail = sweep(args.pod)
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
