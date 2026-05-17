"""Apply an overlay to a Pod.

Idempotent: re-running against an already-applied overlay produces no errors
and no new state changes. Uses PUT (creates or overwrites) for file resources
and N3 Patch with solid:inserts (no-op if triples exist) for shared resources.

Usage:
    python scripts/overlay/apply.py <overlay-dir> --target <pod-url>

Example:
    python scripts/overlay/apply.py overlays/wiki-memory \
        --target https://pod.vardeman.me/vault/
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path
from urllib.parse import urljoin

import httpx

from .common import (
    Manifest, parse_manifest, fetch_capability_catalog, put_file,
    ensure_container, n3_patch_inserts, version_at_least, CapabilityProvision,
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
    pod_url = pod_url.rstrip("/") + "/"
    manifest = parse_manifest(overlay_dir, pod_url=pod_url)
    print(f"Applying overlay: {manifest.name} v{manifest.version}")
    print(f"  Target: {pod_url}")

    with httpx.Client() as client:
        check_capabilities(client, pod_url, manifest)

        # 1. Upload vocabulary documents
        for vocab in manifest.vocabularies:
            url = absolutize(pod_url, vocab.hosted_at)
            put_file(client, url, vocab.document, "text/turtle")
            print(f"  vocab → {url}")

        # 2. Upload role scheme (before affordances that reference its IRIs)
        for rs_url in manifest.role_scheme_urls:
            local = overlay_dir / "vocabulary" / (Path(rs_url).name + ".ttl")
            url = absolutize(pod_url, rs_url)
            put_file(client, url, local, "text/turtle")
            print(f"  role  → {url}")

        # 3. Upload shape files + patch .meta with dct:conformsTo SHACL spec
        #    so ProfileLinkMetadataWriter emits Link: rel="profile" per D86.
        DCT = "http://purl.org/dc/terms/"
        SHACL_SPEC = "https://www.w3.org/TR/shacl/"
        PROF_SPEC = "http://www.w3.org/TR/dx-prof/"
        for shape_url in manifest.shape_urls:
            local = overlay_dir / "shapes" / Path(shape_url).name
            url = absolutize(pod_url, shape_url)
            put_file(client, url, local, "text/turtle")
            print(f"  shape → {url}")
            meta_url = f"{url}.meta"
            n3_patch_inserts(client, meta_url,
                             f"<{url}> <{DCT}conformsTo> <{SHACL_SPEC}> .")
            print(f"  shape.meta → dct:conformsTo SHACL")

        # 4. Upload affordance descriptors + patch .meta with dct:conformsTo PROF spec
        for aff_url in manifest.affordance_urls:
            local = overlay_dir / "affordances" / Path(aff_url).name
            url = absolutize(pod_url, aff_url)
            put_file(client, url, local, "text/turtle")
            print(f"  aff   → {url}")
            meta_url = f"{url}.meta"
            n3_patch_inserts(client, meta_url,
                             f"<{url}> <{DCT}conformsTo> <{PROF_SPEC}> .")
            print(f"  aff.meta  → dct:conformsTo PROF")

        # 5. Upload PROF profile descriptors (after affordances; refs are IRIs not dereferences)
        #    Patch .meta with dct:conformsTo PROF so ProfileLinkMetadataWriter fires.
        for prof_url in manifest.profile_urls:
            local = overlay_dir / "profiles" / (Path(prof_url).name + ".ttl")
            url = absolutize(pod_url, prof_url)
            put_file(client, url, local, "text/turtle")
            print(f"  prof  → {url}")
            meta_url = f"{url}.meta"
            n3_patch_inserts(client, meta_url,
                             f"<{url}> <{DCT}conformsTo> <{PROF_SPEC}> .")
            print(f"  prof.meta → dct:conformsTo PROF")

        # 6. Upload provided capabilities to the catalog
        for cap in manifest.provides:
            r = client.put(cap.url, content=cap.document.encode("utf-8"),
                           headers={"Content-Type": "text/turtle"}, timeout=15)
            if r.status_code not in (200, 201, 204, 205):
                raise RuntimeError(f"PUT capability {cap.url} failed: HTTP {r.status_code}: {r.text[:300]}")
            print(f"  capability → {cap.url}")

        # 7. Upload template documents
        for tmpl in manifest.templates:
            r = client.put(tmpl.url, content=tmpl.document.encode("utf-8"),
                           headers={"Content-Type": "text/turtle"}, timeout=15)
            if r.status_code not in (200, 201, 204, 205):
                raise RuntimeError(f"PUT template {tmpl.url} failed: HTTP {r.status_code}: {r.text[:300]}")
            print(f"  template → {tmpl.url}")

        # 8. Create containers + their .meta files
        for container_path in manifest.container_paths:
            container_url = absolutize(pod_url, container_path)
            ensure_container(client, container_url)
            # Look for a matching .meta file under overlay_dir/containers/<path>/.meta.
            # container_url is fully-absolute (e.g., http://pod/.../vault/wiki/pages/);
            # strip the Pod URL to recover the path relative to the Pod root
            # (e.g., wiki/pages/), then append .meta.
            rel = container_url[len(pod_url):].rstrip("/") + "/.meta"
            meta_local = overlay_dir / "containers" / rel
            if meta_local.exists():
                meta_url = container_url.rstrip("/") + "/.meta"
                # CSS rejects PUT on .meta ("Not allowed to create or edit
                # metadata resources using PUT; use PATCH instead"). Parse the
                # local Turtle, serialize as N-Triples with the container URL
                # as publicID so `<>` resolves to the container, then PATCH
                # via solid:inserts.
                from rdflib import Graph
                mg = Graph()
                mg.parse(meta_local, format="turtle", publicID=container_url)
                inserts = mg.serialize(format="nt").strip()
                if inserts:
                    n3_patch_inserts(client, meta_url, inserts)
                    print(f"  meta  → {meta_url}")

        # 9. Merge JSON-LD context fragment
        ctx_fragment = overlay_dir / "context-fragment.jsonld"
        if ctx_fragment.exists():
            merge_jsonld_context(client, pod_url, ctx_fragment, manifest.overlay_iri)
            print(f"  ctx merged into /vault/meta/context.jsonld")
            patch_context_meta(client, pod_url)
            print(f"  ctx.meta dct:conformsTo patched")

        # 10. PATCH Type Index with registrations
        if manifest.type_registrations:
            ti_url = pod_url.rstrip("/") + "/settings/publicTypeIndex"
            inserts = build_type_index_inserts(manifest)
            n3_patch_inserts(client, ti_url, inserts)
            print(f"  type index → {len(manifest.type_registrations)} registrations patched in")

        # 11. PATCH storage description with this overlay's conformsTo + rdfs:seeAlso + vocab
        storage_patch = overlay_dir / "storage-patch.ttl"
        if storage_patch.exists():
            sd_url = pod_url.rstrip("/") + "/.well-known/solid"
            try:
                inserts = extract_inserts_block(storage_patch.read_text())
                n3_patch_inserts(client, sd_url, inserts)
                print(f"  storage description patched")
            except RuntimeError as e:
                # DEFERRED SUBSTRATE BUG: CSS v8-alpha.3 returns 405/501 on
                # PATCH/GET for .well-known/solid in this configuration. Same
                # root-cause class as the Phase 2 .well-known/solid 501 bug
                # documented in tests/integration/test_substrate_cleanup.py
                # ::test_storage_description_announces_capabilities. Storage
                # description data lives at /vault/.meta (verified discoverable
                # via the describedby Link header on /vault/). Overlay-specific
                # entries (dct:conformsTo, rdfs:seeAlso wiki containers,
                # void:vocabulary for wiki:/cito:/foaf:) would normally land
                # here. Workaround: agent navigation still works via
                # /vault/.meta + the catalog containers. Restore the PATCH path
                # when the upstream CSS routing issue is resolved.
                print(f"  [warn] storage description PATCH failed ({e}); "
                      f"deferred — overlay data still discoverable via /vault/.meta",
                      file=sys.stderr)

    print(f"Applied overlay {manifest.name} successfully.")


def absolutize(pod_url: str, maybe_relative: str) -> str:
    """Resolve maybe_relative against pod_url.

    Three cases handled:
      1. Already absolute (http:// or https://) → return as-is.
      2. file:///... (left over from rdflib parsing a manifest without publicID,
         where a relative IRI got resolved against the local file path) → strip
         the file:// scheme and resolve the remaining absolute path against
         pod_url's origin via urljoin. This is the recovery path for callers
         that didn't pass pod_url into parse_manifest.
      3. Anything else (absolute path, fragment, or relative path) → urljoin
         against pod_url. urljoin's RFC 3986 behaviour: an absolute path like
         "/vault/ontology/wiki.ttl" REPLACES the path component of the base
         URL, so urljoin("http://pod/vault/", "/vault/ontology/wiki.ttl")
         correctly produces "http://pod/vault/ontology/wiki.ttl" — no doubling.
    """
    if maybe_relative.startswith(("http://", "https://")):
        return maybe_relative
    if maybe_relative.startswith("file:///"):
        path = maybe_relative[len("file://"):]
        return urljoin(pod_url, path)
    return urljoin(pod_url, maybe_relative)


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


def patch_context_meta(client: httpx.Client, pod_url: str) -> None:
    """Patch .meta for context.jsonld to declare dct:conformsTo JSON-LD 1.1.

    The body is JSON-LD (non-RDF), so CSS never derives this triple from the
    body itself. Idempotent: N3 Patch solid:inserts is a no-op when the
    triple already exists.
    """
    ctx_url = pod_url.rstrip("/") + "/meta/context.jsonld"
    meta_url = ctx_url + ".meta"
    DCT = "http://purl.org/dc/terms/"
    ntriples = (
        f"<{ctx_url}> <{DCT}conformsTo> <https://www.w3.org/TR/json-ld11/> ."
    )
    n3_patch_inserts(client, meta_url, ntriples)


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
