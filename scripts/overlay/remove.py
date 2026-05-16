"""Remove an overlay from a Pod.

Two modes:
  --keep-data (default in interactive use, but explicit here): leaves containers
              and user data intact; removes app infrastructure (descriptors,
              shapes, vocab, Type Index entries, storage description entries).
  --uninstall: same as keep-data, plus deletes containers (requires --confirm).

Usage:
    python scripts/overlay/remove.py <overlay-dir> --target <pod-url> [--keep-data | --uninstall --confirm]

KNOWN LIMITATION: This module does NOT undo apply.py's merge_jsonld_context.
The JSON-LD context entries that apply.py merged into /vault/meta/context.jsonld
are left in place. Rationale: context entries are shared vocabulary (multiple
overlays may register the same prefix), and removing them without ref-counting
would break other installed overlays. Future improvement: track overlay→key
bindings in the storage description so safe cleanup is possible.
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

import httpx

from .common import parse_manifest


def delete_resource(client: httpx.Client, url: str) -> None:
    """DELETE a resource. 404 is fine (already gone)."""
    r = client.delete(url, timeout=10)
    if r.status_code not in (200, 204, 205, 404):
        print(f"  [warn] DELETE {url} returned HTTP {r.status_code}: {r.text[:200]}", file=sys.stderr)


def patch_deletes(client: httpx.Client, target_url: str, turtle_deletes: str) -> None:
    """N3 Patch with solid:deletes."""
    patch_body = f"""@prefix solid: <http://www.w3.org/ns/solid/terms#>.

_:patch a solid:InsertDeletePatch ;
   solid:deletes {{ {turtle_deletes} }} .
"""
    r = client.patch(target_url, content=patch_body.encode("utf-8"),
                     headers={"Content-Type": "text/n3"}, timeout=15)
    if r.status_code not in (200, 201, 204, 205):
        print(f"  [warn] DELETE-patch {target_url} returned HTTP {r.status_code}: {r.text[:200]}", file=sys.stderr)


def remove_overlay(overlay_dir: Path, pod_url: str, uninstall: bool, confirm: bool) -> None:
    manifest = parse_manifest(overlay_dir)
    pod_url = pod_url.rstrip("/") + "/"
    print(f"Removing overlay: {manifest.name} v{manifest.version}")
    print(f"  Mode: {'UNINSTALL (deletes containers)' if uninstall else 'DEACTIVATE (keeps containers)'}")
    print(f"  Target: {pod_url}")

    if uninstall and not confirm:
        raise SystemExit(
            "--uninstall is destructive (deletes containers + their contents). "
            "Re-run with --confirm to proceed."
        )

    with httpx.Client() as client:
        # 1. Delete affordance descriptors
        for aff_url in manifest.affordance_urls:
            url = aff_url if aff_url.startswith("http") else (pod_url.rstrip("/").removesuffix("/vault") + aff_url)
            delete_resource(client, url)
            print(f"  aff   ✗ {url}")

        # 2. Delete shape files
        for shape_url in manifest.shape_urls:
            url = shape_url if shape_url.startswith("http") else (pod_url.rstrip("/").removesuffix("/vault") + shape_url)
            delete_resource(client, url)
            print(f"  shape ✗ {url}")

        # 3. Delete vocabulary documents
        for vocab in manifest.vocabularies:
            url = pod_url.rstrip("/") + vocab.hosted_at
            delete_resource(client, url)
            print(f"  vocab ✗ {url}")

        # 4. PATCH Type Index — remove this overlay's registrations
        if manifest.type_registrations:
            ti_url = pod_url.rstrip("/") + "/settings/publicTypeIndex"
            removes = []
            for i, tr in enumerate(manifest.type_registrations):
                removes.append(
                    f"@prefix solid: <http://www.w3.org/ns/solid/terms#> . "
                    f"<#reg{i}-{manifest.name}> a solid:TypeRegistration ; "
                    f"solid:forClass <{tr.for_class}> ; "
                    f"solid:instanceContainer <{tr.instance_container}> ."
                )
            patch_deletes(client, ti_url, "\n".join(removes))
            print(f"  type index ✗ {len(manifest.type_registrations)} registrations removed")

        # 5. PATCH storage description — remove this overlay's conformsTo + rdfs:seeAlso + vocab
        sd_url = pod_url.rstrip("/") + "/.well-known/solid"
        # Build delete body from storage-patch.ttl (use same inserts content but as deletes)
        sp = overlay_dir / "storage-patch.ttl"
        if sp.exists():
            from .apply import extract_inserts_block
            inserts = extract_inserts_block(sp.read_text())
            patch_deletes(client, sd_url, inserts)
            print(f"  storage description ✗ overlay entries removed")

        # 6. If --uninstall, delete containers
        if uninstall:
            # Delete in reverse depth order (children before parents)
            for container_path in sorted(manifest.container_paths, key=len, reverse=True):
                url = container_path if container_path.startswith("http") else (pod_url.rstrip("/").removesuffix("/vault") + container_path)
                delete_resource(client, url)
                print(f"  container ✗ {url}")

    print(f"Removed overlay {manifest.name} successfully.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("overlay_dir", type=Path, help="Path to overlay directory")
    parser.add_argument("--target", required=True, help="Pod URL")
    parser.add_argument("--keep-data", action="store_true",
                        help="Default behavior; leaves containers + user data intact")
    parser.add_argument("--uninstall", action="store_true",
                        help="Destructive: also delete containers and user data")
    parser.add_argument("--confirm", action="store_true",
                        help="Required with --uninstall")
    args = parser.parse_args()
    if args.uninstall and args.keep_data:
        raise SystemExit("--uninstall and --keep-data are mutually exclusive")
    remove_overlay(args.overlay_dir, args.target, uninstall=args.uninstall, confirm=args.confirm)


if __name__ == "__main__":
    main()
