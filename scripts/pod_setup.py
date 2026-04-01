"""Pod setup init service: uploads shapes + ontology to CSS after pod creation.

Runs inside Docker container via docker-compose pod-setup service.
CSS seed config + pod templates handle account, WebID, and PARA containers.
This script handles content that requires file-based generation.

Usage (inside container):
    python pod_setup.py --target http://css:3000

Usage (from host, for development):
    ~/uvws/.venv/bin/python scripts/pod_setup.py --target http://pod.vardeman.me:3000
"""
import argparse, pathlib, sys, time
import httpx


def wait_for_pod(base: str, retries: int = 30, delay: float = 2.0):
    """Wait for pod to be ready (seed config may still be running)."""
    pod_url = f"{base}/vault/"
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


def upload_shapes(client: httpx.Client, shapes_dir: pathlib.Path) -> int:
    """Upload SHACL shapes to /vault/procedures/shapes/."""
    count = 0
    for f in sorted(shapes_dir.glob("*.ttl")):
        pod_path = f"/vault/procedures/shapes/{f.name}"
        if upload_file(client, f, pod_path, "text/turtle"):
            count += 1
    return count


def upload_ontology(client: httpx.Client, onto_dir: pathlib.Path) -> int:
    """Upload ontology stubs to /vault/ontology/."""
    count = 0
    for f in sorted(onto_dir.glob("*.ttl")):
        pod_path = f"/vault/ontology/{f.name}"
        if upload_file(client, f, pod_path, "text/turtle"):
            count += 1
    return count


def verify_pod(client: httpx.Client) -> bool:
    """Smoke test: check key pod resources exist."""
    checks = [
        ("/vault/", "Pod root"),
        ("/vault/profile/card", "WebID card"),
        ("/vault/settings/publicTypeIndex", "Type Index"),
        ("/vault/resources/concepts/", "Concepts container"),
        ("/vault/procedures/shapes/", "Shapes container"),
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
    p.add_argument("--target", default="http://pod.vardeman.me:3000",
                   help="CSS base URL (default: http://pod.vardeman.me:3000)")
    p.add_argument("--shapes-dir", default="/shapes",
                   help="Path to SHACL shapes directory")
    p.add_argument("--ontology-dir", default="/ontology",
                   help="Path to ontology directory")
    args = p.parse_args()

    print(f"Pod setup targeting {args.target}")

    if not wait_for_pod(args.target):
        sys.exit(1)

    shapes_dir = pathlib.Path(args.shapes_dir)
    onto_dir = pathlib.Path(args.ontology_dir)

    with httpx.Client(base_url=args.target, timeout=30) as c:
        n_shapes = 0
        if shapes_dir.exists():
            print(f"\nUploading shapes from {shapes_dir}")
            n_shapes = upload_shapes(c, shapes_dir)

        n_onto = 0
        if onto_dir.exists():
            print(f"\nUploading ontology from {onto_dir}")
            n_onto = upload_ontology(c, onto_dir)

        print(f"\nVerifying pod structure:")
        ok = verify_pod(c)

    print(f"\nDone: {n_shapes} shapes, {n_onto} ontology files uploaded")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
