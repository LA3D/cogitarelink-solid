"""Verify an installed overlay matches its manifest.

Walks the manifest and checks each declared artifact is present on the Pod.
Reports any drift.

Usage:
    python scripts/overlay/verify.py <overlay-dir> --target <pod-url>
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

import httpx

from .apply import absolutize
from .common import parse_manifest


def verify_overlay(overlay_dir: Path, pod_url: str) -> int:
    """Return number of drift errors found (0 = clean)."""
    pod_url = pod_url.rstrip("/") + "/"
    manifest = parse_manifest(overlay_dir, pod_url=pod_url)
    print(f"Verifying overlay: {manifest.name} v{manifest.version} against {pod_url}")
    errors = 0

    with httpx.Client() as client:
        # Containers
        for c in manifest.container_paths:
            url = absolutize(pod_url, c)
            r = client.head(url, timeout=5)
            if r.status_code != 200:
                print(f"  [drift] container missing: {url} (HTTP {r.status_code})", file=sys.stderr)
                errors += 1

        # Shape files
        for s in manifest.shape_urls:
            url = absolutize(pod_url, s)
            r = client.head(url, timeout=5)
            if r.status_code != 200:
                print(f"  [drift] shape missing: {url} (HTTP {r.status_code})", file=sys.stderr)
                errors += 1

        # Affordances
        for a in manifest.affordance_urls:
            url = absolutize(pod_url, a)
            r = client.head(url, timeout=5)
            if r.status_code != 200:
                print(f"  [drift] affordance missing: {url} (HTTP {r.status_code})", file=sys.stderr)
                errors += 1

        # Vocabularies
        for v in manifest.vocabularies:
            url = absolutize(pod_url, v.hosted_at)
            r = client.head(url, timeout=5)
            if r.status_code != 200:
                print(f"  [drift] vocab missing: {url} (HTTP {r.status_code})", file=sys.stderr)
                errors += 1

    if errors == 0:
        print(f"Overlay {manifest.name}: clean (no drift).")
    else:
        print(f"Overlay {manifest.name}: {errors} drift errors.", file=sys.stderr)
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("overlay_dir", type=Path, help="Path to overlay directory")
    parser.add_argument("--target", required=True, help="Pod URL")
    args = parser.parse_args()
    errors = verify_overlay(args.overlay_dir, args.target)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
