"""Pod setup init service: uploads shapes + ontology to CSS after pod creation.

Runs inside Docker container via docker-compose pod-setup service.
CSS seed config + pod templates handle account, WebID, and PARA containers.
This script handles content that requires file-based generation.

Usage (inside container):
    python pod_setup.py --target http://css:3000

Usage (from host, for development):
    ~/uvws/.venv/bin/python scripts/pod_setup.py --target https://pod.vardeman.me
"""
import argparse, pathlib, sys, time
import httpx


def wait_for_pod(base: str, root: str = "/vault", retries: int = 30, delay: float = 2.0):
    """Wait for pod to be ready (seed config may still be running)."""
    pod_url = f"{base}{root}/"
    for i in range(retries):
        try:
            r = httpx.get(pod_url, timeout=5)
            if r.status_code == 200:
                print(f"  Pod ready at {pod_url}")
                return True
        except httpx.ConnectError:
            pass
        if i < retries - 1:
            print(f"  Waiting for pod... ({i+1}/{retries})")
            time.sleep(delay)
    print(f"  Pod not ready after {retries} attempts", file=sys.stderr)
    return False


def upload_file(client: httpx.Client, local_path: pathlib.Path,
                pod_path: str, content_type: str) -> bool:
    """PUT a file to the pod. Idempotent."""
    content = local_path.read_bytes()
    try:
        r = client.put(pod_path, content=content,
                       headers={"Content-Type": content_type})
        if r.status_code in (200, 201, 205):
            print(f"  PUT {pod_path} ({len(content)} bytes)")
            return True
        else:
            print(f"  FAILED {pod_path}: {r.status_code} {r.text[:200]}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"  ERROR {pod_path}: {e}", file=sys.stderr)
        return False


def upload_shapes(client: httpx.Client, shapes_dir: pathlib.Path, root: str = "/vault") -> int:
    """Upload SHACL shapes to <root>/meta/shapes/.

    Deprecated post-substrate-cleanup (2026-05-16): shape upload moved to the
    wiki-memory overlay (scripts/overlay/apply.py). Kept as a fallback helper
    only; not called from main(). Apply the overlay instead.
    """
    count = 0
    for f in sorted(shapes_dir.glob("*.ttl")):
        pod_path = f"{root}/meta/shapes/{f.name}"
        if upload_file(client, f, pod_path, "text/turtle"):
            count += 1
    return count


def upload_ontology(client: httpx.Client, onto_dir: pathlib.Path, root: str = "/vault") -> int:
    """Upload ontology stubs to <root>/ontology/."""
    count = 0
    for f in sorted(onto_dir.glob("*.ttl")):
        pod_path = f"{root}/ontology/{f.name}"
        if upload_file(client, f, pod_path, "text/turtle"):
            count += 1
    return count


def verify_pod(client: httpx.Client, root: str = "/vault") -> bool:
    """Smoke test: check key pod resources exist."""
    checks = [
        (f"{root}/", "Pod root"),
        (f"{root}/profile/card", "WebID card"),
        (f"{root}/settings/publicTypeIndex", "Type Index (empty post-Phase 1)"),
        (f"{root}/.well-known/solid", "Storage description"),
    ]
    ok = True
    for path, label in checks:
        r = client.get(path, timeout=10)
        status = "OK" if r.status_code == 200 else f"FAIL ({r.status_code})"
        print(f"  {label}: {status}")
        if r.status_code != 200:
            ok = False
    return ok


def main():
    p = argparse.ArgumentParser(description="Pod setup: upload shapes + ontology")
    p.add_argument("--target", default="https://pod.vardeman.me",
                   help="CSS base URL (default: https://pod.vardeman.me)")
    p.add_argument("--shapes-dir", default="/shapes",
                   help="Path to SHACL shapes directory")
    p.add_argument("--ontology-dir", default="/ontology",
                   help="Path to ontology directory")
    p.add_argument("--storage-root", default="/vault",
                   help="Storage root path on the Pod (default: /vault; D107 §4.4 parameterization)")
    args = p.parse_args()

    print(f"Pod setup targeting {args.target}")

    if not wait_for_pod(args.target, args.storage_root):
        sys.exit(1)

    shapes_dir = pathlib.Path(args.shapes_dir)
    onto_dir = pathlib.Path(args.ontology_dir)

    with httpx.Client(base_url=args.target, timeout=30) as c:
        n_shapes = 0
        # NOTE: Phase 1 substrate cleanup — shape upload moved to wiki-memory overlay.
        # Do not call upload_shapes here. Apply the overlay instead:
        #   python -m scripts.overlay.apply overlays/wiki-memory --target <pod-url>
        # if shapes_dir.exists():
        #     print(f"\nUploading shapes from {shapes_dir}")
        #     n_shapes = upload_shapes(c, shapes_dir)

        n_onto = 0
        if onto_dir.exists():
            print(f"\nUploading ontology from {onto_dir}")
            n_onto = upload_ontology(c, onto_dir, args.storage_root)

        print(f"\nVerifying pod structure:")
        ok = verify_pod(c, args.storage_root)

    print(f"\nDone: {n_shapes} shapes, {n_onto} ontology files uploaded")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
