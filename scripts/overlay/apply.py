"""Apply an overlay to a Pod.

Idempotent: re-running against an already-applied overlay produces no errors
and no new state changes. Uses PUT (creates or overwrites) for file resources
and N3 Patch with solid:inserts (no-op if triples exist) for shared resources.

Usage:
    python scripts/overlay/apply.py <overlay-dir> --target <pod-url>

Example:
    python scripts/overlay/apply.py overlays/wiki-memory \
        --target http://pod.vardeman.me:3000/vault/
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

import httpx

from .common import (
    Manifest, parse_manifest, fetch_capability_catalog, put_file,
    ensure_container, n3_patch_inserts, version_at_least,
)


def check_overlay_dependencies(client: httpx.Client, pod_url: str, manifest: Manifest) -> None:
    """Refuse to apply if any depends_on_overlay isn't already installed."""
    if not manifest.depends_on_overlays:
        return
    storage_url = pod_url.rstrip("/") + "/.well-known/solid"
    from rdflib import Graph, Namespace
    OVERLAY = Namespace("https://pod.vardeman.me:3000/vault/ontology/overlay#")
    r = client.get(storage_url, headers={"Accept": "text/turtle"}, timeout=10)
    if r.status_code != 200:
        raise RuntimeError(f"Storage description not reachable: HTTP {r.status_code}")
    g = Graph().parse(data=r.text, format="turtle", publicID=storage_url)
    installed = set(g.objects(predicate=OVERLAY.installedOverlay))
    missing = [d for d in manifest.depends_on_overlays if d not in installed]
    if missing:
        raise RuntimeError(
            f"Overlay {manifest.name} requires these overlays to be installed first: "
            f"{[str(m) for m in missing]}"
        )


def check_capabilities(client: httpx.Client, pod_url: str, manifest: Manifest) -> None:
    """Verify required capabilities are present at minVersion. Warn on missing optional."""
    catalog = fetch_capability_catalog(client, pod_url)
    for req in manifest.required_capabilities:
        actual = catalog.get(str(req.iri))
        if actual is None:
            raise RuntimeError(f"Required capability missing: {req.iri}")
        if not version_at_least(actual, req.min_version):
            raise RuntimeError(
                f"Required capability {req.iri} at version {actual}; need >= {req.min_version}"
            )
    for opt in manifest.optional_capabilities:
        actual = catalog.get(str(opt.iri))
        if actual is None or not version_at_least(actual, opt.min_version):
            print(f"  [warn] Optional capability missing: {opt.iri} — {opt.degrades_to or 'degrades'}",
                  file=sys.stderr)


def apply_overlay(overlay_dir: Path, pod_url: str) -> None:
    manifest = parse_manifest(overlay_dir)
    pod_url = pod_url.rstrip("/") + "/"
    print(f"Applying overlay: {manifest.name} v{manifest.version}")
    print(f"  Target: {pod_url}")

    with httpx.Client() as client:
        check_overlay_dependencies(client, pod_url, manifest)
        check_capabilities(client, pod_url, manifest)

        # 1. Upload vocabulary documents
        for vocab in manifest.vocabularies:
            url = pod_url.rstrip("/") + vocab.hosted_at
            put_file(client, url, vocab.document, "text/turtle")
            print(f"  vocab → {url}")

        # 2. Upload shape files
        for shape_url in manifest.shape_urls:
            local = overlay_dir / "shapes" / Path(shape_url).name
            url = absolutize(pod_url, shape_url)
            put_file(client, url, local, "text/turtle")
            print(f"  shape → {url}")

        # 3. Upload affordance descriptors
        for aff_url in manifest.affordance_urls:
            local = overlay_dir / "affordances" / Path(aff_url).name
            url = absolutize(pod_url, aff_url)
            put_file(client, url, local, "text/turtle")
            print(f"  aff   → {url}")

        # 4. Create containers + their .meta files
        for container_path in manifest.container_paths:
            container_url = absolutize(pod_url, container_path)
            ensure_container(client, container_url)
            # Look for a matching .meta file under overlay_dir/containers/<path>/.meta
            rel = container_path.replace("/vault/", "", 1).rstrip("/") + "/.meta"
            meta_local = overlay_dir / "containers" / rel
            if meta_local.exists():
                meta_url = container_url.rstrip("/") + "/.meta"
                put_file(client, meta_url, meta_local, "text/turtle")
                print(f"  meta  → {meta_url}")

        # 5. Merge JSON-LD context fragment
        ctx_fragment = overlay_dir / "context-fragment.jsonld"
        if ctx_fragment.exists():
            merge_jsonld_context(client, pod_url, ctx_fragment, manifest.overlay_iri)
            print(f"  ctx merged into /vault/meta/context.jsonld")

        # 6. PATCH Type Index with registrations
        if manifest.type_registrations:
            ti_url = pod_url.rstrip("/") + "/settings/publicTypeIndex"
            inserts = build_type_index_inserts(manifest)
            n3_patch_inserts(client, ti_url, inserts)
            print(f"  type index → {len(manifest.type_registrations)} registrations patched in")

        # 7. PATCH storage description with this overlay's conformsTo + rdfs:seeAlso + vocab
        storage_patch = overlay_dir / "storage-patch.ttl"
        if storage_patch.exists():
            sd_url = pod_url.rstrip("/") + "/.well-known/solid"
            inserts = extract_inserts_block(storage_patch.read_text())
            n3_patch_inserts(client, sd_url, inserts)
            print(f"  storage description patched")

    print(f"Applied overlay {manifest.name} successfully.")


def absolutize(pod_url: str, maybe_relative: str) -> str:
    """Convert a path like '/vault/wiki/pages/' to an absolute URL."""
    if maybe_relative.startswith("http"):
        return maybe_relative
    if maybe_relative.startswith("/vault/"):
        # pod_url already includes /vault/ — strip the duplicate.
        # Use removesuffix (Python 3.9+) — rstrip("/vault") strips a character SET,
        # not the literal suffix, which silently misbehaves for Pod URLs ending in t/l/u/a/v.
        return pod_url.rstrip("/").removesuffix("/vault") + maybe_relative
    return pod_url.rstrip("/") + maybe_relative


def merge_jsonld_context(client: httpx.Client, pod_url: str, fragment_path: Path, overlay_iri) -> None:
    """Merge a JSON-LD context fragment into /vault/meta/context.jsonld.

    Strategy: PUT a merged document. Reads current context (or creates new), unions
    the @context keys (overlay's win on conflict to enable updates), writes back.
    """
    import json
    ctx_url = pod_url.rstrip("/") + "/meta/context.jsonld"
    r = client.get(ctx_url, headers={"Accept": "application/ld+json"}, timeout=10)
    if r.status_code == 200 and r.text.strip():
        try:
            existing = json.loads(r.text)
        except json.JSONDecodeError:
            existing = {"@context": {}}
    else:
        existing = {"@context": {}}

    fragment = json.loads(fragment_path.read_text())
    existing_ctx = existing.get("@context", {})
    if not isinstance(existing_ctx, dict):
        existing_ctx = {}
    fragment_ctx = fragment.get("@context", {})
    existing_ctx.update(fragment_ctx)
    existing["@context"] = existing_ctx

    body = json.dumps(existing, indent=2).encode("utf-8")
    r2 = client.put(ctx_url, content=body, headers={"Content-Type": "application/ld+json"}, timeout=15)
    if r2.status_code not in (200, 201, 204, 205):
        raise RuntimeError(f"context merge PUT failed: HTTP {r2.status_code}: {r2.text[:300]}")


def build_type_index_inserts(manifest: Manifest) -> str:
    """Emit N-Triples (absolute IRIs) suitable as the body of solid:inserts { ... }.

    Per Solid N3 Patch grammar, prefix declarations belong at the patch envelope's
    outer scope, not inside the inserts formula. This function returns one
    N-Triple per line using absolute IRIs only.
    """
    SOLID_NS = "http://www.w3.org/ns/solid/terms#"
    RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
    lines = []
    for i, tr in enumerate(manifest.type_registrations):
        reg = f"<#reg{i}-{manifest.name}>"
        lines.append(f"{reg} <{RDF_TYPE}> <{SOLID_NS}TypeRegistration> .")
        lines.append(f"{reg} <{SOLID_NS}forClass> <{tr.for_class}> .")
        lines.append(f"{reg} <{SOLID_NS}instanceContainer> <{tr.instance_container}> .")
    return "\n".join(lines)


def extract_inserts_block(patch_text: str) -> str:
    """Parse storage-patch.ttl and return its solid:inserts triples as N-Triples.

    The patch file uses prefix names (cito:, dct:, etc.) inside the
    solid:inserts formula. Per Solid N3 Patch grammar, prefixes belong outside
    the formula. We use rdflib's N3 parser to expand prefixes and serialize
    the inserts block as fully-qualified N-Triples. As a bonus, this handles
    braces in string literals correctly (the brace-matching fallback below
    would mis-parse them).
    """
    from rdflib import Graph, URIRef, BNode, Literal as RdfLiteral
    from rdflib.namespace import Namespace

    SOLID = Namespace("http://www.w3.org/ns/solid/terms#")
    g = Graph()
    try:
        g.parse(data=patch_text, format="n3")
    except Exception as e:
        raise ValueError(f"storage-patch.ttl: n3 parse failed: {e}") from e

    inserts_obj = None
    for s, p, o in g:
        if p == SOLID.inserts:
            inserts_obj = o
            break
    if inserts_obj is None:
        raise ValueError("storage-patch.ttl missing solid:inserts block")

    triples = []
    try:
        formula = g.graph(inserts_obj)
        triples = list(formula)
    except Exception:
        triples = []

    if not triples:
        triples = _fallback_parse_inserts(patch_text)

    def term_to_nt(t) -> str:
        if isinstance(t, URIRef):
            return f"<{t}>"
        if isinstance(t, BNode):
            return f"_:{t}"
        if isinstance(t, RdfLiteral):
            lex = str(t).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
            if t.datatype:
                return f'"{lex}"^^<{t.datatype}>'
            if t.language:
                return f'"{lex}"@{t.language}'
            return f'"{lex}"'
        return f"<{t}>"

    lines = []
    for s, p, o in triples:
        lines.append(f"{term_to_nt(s)} {term_to_nt(p)} {term_to_nt(o)} .")
    return "\n".join(lines)


def _fallback_parse_inserts(patch_text: str) -> list:
    """Fallback: brace-extract inserts block, prepend file's @prefix decls, parse as Turtle.

    Used only when rdflib's formula graph access returns empty (some rdflib
    versions don't expose the quoted graph cleanly). Limitation: brace-matching
    does not respect string literals containing '{' or '}'. The primary
    rdflib-N3 path handles those correctly; this is a best-effort fallback.
    """
    from rdflib import Graph
    start = patch_text.find("solid:inserts")
    if start == -1:
        return []
    brace_open = patch_text.find("{", start)
    if brace_open == -1:
        return []
    depth = 1
    pos = brace_open + 1
    while depth and pos < len(patch_text):
        c = patch_text[pos]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        pos += 1
    inner = patch_text[brace_open + 1:pos - 1]
    prefix_lines = [line for line in patch_text.splitlines() if line.strip().startswith("@prefix")]
    turtle = "\n".join(prefix_lines) + "\n" + inner
    g = Graph()
    try:
        g.parse(data=turtle, format="turtle")
    except Exception:
        return []
    return list(g)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("overlay_dir", type=Path, help="Path to overlay directory")
    parser.add_argument("--target", required=True, help="Pod URL")
    args = parser.parse_args()
    apply_overlay(args.overlay_dir, args.target)


if __name__ == "__main__":
    main()
