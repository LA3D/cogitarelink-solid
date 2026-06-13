#!/usr/bin/env python
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx", "rdflib"]
# ///
"""Migration sweep (spec §6): after a projector version bump, re-baseline every
markdown resource — re-PUT each body unchanged so the floor re-projects (degraded
pair-shadow on old-version resources), stamps the new sub:projectorVersion, and flags
any residue to the curation lane. Idempotent; run once per bump.

Each member is classified into ONE of four outcomes:

  - rebaselined — re-PUT returned 2xx. The normal/expected outcome. Includes degraded
                  re-baselines (old-version resources): the floor's pair-shadow may leave
                  residue, but it FLAGS that residue via a curation signal — so the residue
                  is the curation lane's job, and for THIS sweep a 2xx re-PUT is success.
  - skipped     — the body GET or the member 404'd (concurrently deleted). Benign for a
                  one-shot sweep; the resource is simply gone.
  - rejected    — re-PUT returned 422. The body no longer conforms to a shape that was
                  tightened after the body was written. A real FINDING that needs human
                  attention — but NOT a sweep transport failure.
  - error       — any other non-2xx, or a network/transport exception. The genuine failure.

Exit contract: nonzero ONLY when an `error` occurred (transport / unexpected status).
A sweep that produced only rebaselined / skipped / rejected members exits 0 — rejections
are surfaced prominently for review but do not fail the sweep (a shape tightened under
existing data is a curation decision, not a broken sweep). This lets automation gate on
the exit code without a single stale or newly-nonconforming resource defeating the gate.

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


# Re-baseline one member. Returns (outcome, detail) where outcome is one of
# "rebaselined" / "skipped" / "rejected" / "error" — never raises; transport
# exceptions become ("error", ...).
def rebaseline(client, m):
    try:
        body = client.get(m, headers={"Accept": "text/markdown"})
    except httpx.HTTPError as e:
        return "error", f"{m} (GET {type(e).__name__})"
    if body.status_code == 404:
        return "skipped", f"{m} (GET 404 — concurrently deleted)"
    if body.status_code >= 400:
        return "error", f"{m} (GET {body.status_code})"
    try:
        put = client.put(m, content=body.content,
                         headers={"Content-Type": "text/markdown"})
    except httpx.HTTPError as e:
        return "error", f"{m} (PUT {type(e).__name__})"
    if put.status_code in (200, 201, 204, 205):
        return "rebaselined", m
    if put.status_code == 404:
        return "skipped", f"{m} (PUT 404 — concurrently deleted)"
    if put.status_code == 422:
        return "rejected", f"{m} (PUT 422 — body no longer conforms to current shape)"
    return "error", f"{m} (PUT {put.status_code})"


def sweep(pod):
    ca = resolve_ca()
    client = httpx.Client(verify=ca if ca else False, timeout=30.0)
    vault = pod.rstrip("/") + "/vault/wiki/"
    grand = {"rebaselined": 0, "skipped": 0, "rejected": 0, "error": 0}
    grand_stamped = 0
    rejected, errors = [], []
    try:
        for name in WIKI_CONTAINERS:
            ctr = urljoin(vault, name + "/")
            try:
                members = container_members(client, ctr)
            except httpx.HTTPStatusError as e:
                # The container itself is gone — benign for a one-shot sweep over a
                # known-fixed layout. Surface it but don't fail the sweep.
                print(f"  {name}/: container GET {e.response.status_code} — skipped")
                continue
            counts = {"rebaselined": 0, "skipped": 0, "rejected": 0, "error": 0}
            stamped = 0
            for m in members:
                outcome, detail = rebaseline(client, m)
                counts[outcome] += 1
                if outcome == "rebaselined" and has_version_stamp(client, m):
                    stamped += 1
                elif outcome == "rejected":
                    rejected.append(detail)
                elif outcome == "error":
                    errors.append(detail)
            print(f"  {name}/: {counts['rebaselined']} rebaselined, {stamped} stamped, "
                  f"{counts['skipped']} skipped, {counts['rejected']} rejected, "
                  f"{counts['error']} error ({len(members)} .md members)")
            for k in grand:
                grand[k] += counts[k]
            grand_stamped += stamped
    finally:
        client.close()

    print(f"\nTotal: {grand['rebaselined']} rebaselined, {grand_stamped} carry "
          f"sub:projectorVersion (current = {PROJECTOR_VERSION}), "
          f"{grand['skipped']} skipped, {grand['rejected']} rejected, {grand['error']} error")
    if rejected:
        print(f"\n{grand['rejected']} resources rejected by current shapes — review "
              f"(a shape tightened under existing data; not a sweep failure):")
        for r in rejected:
            print(f"  ! {r}")
    if errors:
        print(f"\n{grand['error']} resources errored (transport / unexpected status) — "
              f"the sweep FAILED:")
        for e in errors:
            print(f"  - {e}")
    return grand


def main():
    ap = argparse.ArgumentParser(description="Projector migration sweep (spec §6).")
    ap.add_argument("--pod", default="https://pod.vardeman.me")
    args = ap.parse_args()
    print(f"Migration sweep over {args.pod}/vault/wiki/ (projector {PROJECTOR_VERSION})\n")
    grand = sweep(args.pod)
    # Exit nonzero ONLY on a genuine transport/unexpected error. Rejections and skips
    # are reported but do not fail the sweep (automation gates on the exit code).
    sys.exit(1 if grand["error"] else 0)


if __name__ == "__main__":
    main()
