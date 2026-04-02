"""Vault-to-Pod importer: reads Obsidian vault, generates LDP resources + .meta RDF.

Usage:
    PYTHONPATH=. python scripts/vault_import.py [--source PATH] [--target URL] [--dry-run]
"""
import argparse, hashlib, pathlib, sys
import yaml

from scripts.lib.rdf_gen import frontmatter_to_graph, slug
from scripts.lib.ldp_client import put_resource, patch_meta

IMPORTABLE_TYPES = {"concept-note", "theory-note"}


def parse_frontmatter(text: str) -> dict:
    if not text.startswith("---"): return {}
    end = text.find("---", 3)
    if end == -1: return {}
    return yaml.safe_load(text[3:end]) or {}


def import_note(path: pathlib.Path, target: str, container: str,
                dry_run: bool = False) -> bool:
    text = path.read_text()
    raw = path.read_bytes()
    fm = parse_frontmatter(text)
    note_type = fm.get("type", "unknown")

    if note_type not in IMPORTABLE_TYPES:
        return False

    title = fm.get("title", path.stem)
    url = f"{target.rstrip('/')}{container}{slug(title)}.md"
    digest = f"z{hashlib.sha256(raw).hexdigest()}"

    g = frontmatter_to_graph(fm, title, f"{target.rstrip('/')}{container}",
                             digest=digest, source_path=str(path))

    if dry_run:
        print(f"  [dry-run] {title} → {url} ({len(g)} triples)")
        return True

    try:
        put_resource(url, raw, "text/markdown")
        patch_meta(url, g)
        print(f"  {title} → {len(g)} triples")
        return True
    except Exception as e:
        print(f"  FAILED {title}: {e}", file=sys.stderr)
        return False


def main():
    p = argparse.ArgumentParser(description="Import vault notes to Solid Pod")
    p.add_argument("--source",
                   default="~/Obsidian/obsidian/03 - Resources/Agentic Memory Systems")
    p.add_argument("--target", default="http://pod.vardeman.me:3000")
    p.add_argument("--container", default="/vault/resources/concepts/")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    src = pathlib.Path(args.source).expanduser()
    if not src.exists():
        print(f"Source not found: {src}", file=sys.stderr)
        sys.exit(1)

    md_files = sorted(src.rglob("*.md"))
    print(f"Found {len(md_files)} files in {src}")

    imported = 0
    for f in md_files:
        if import_note(f, args.target, args.container, args.dry_run):
            imported += 1

    print(f"\nImported {imported} notes to {args.target}{args.container}")


if __name__ == "__main__":
    main()
