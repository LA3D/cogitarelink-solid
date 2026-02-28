"""Vault-to-Pod importer: reads Obsidian vault subset, generates LDP resources + RDF metadata.

Usage:
    python scripts/vault_import.py [--source VAULT_PATH] [--target POD_URL] [--subset FOLDER]

Default source: ~/Obsidian/obsidian/03 - Resources/Agentic Memory Systems
Default target: http://localhost:3000
"""
import argparse
import hashlib
import pathlib
import re
import sys
from datetime import datetime, timezone

# Stub — full implementation in Phase 1 Week 2-3


def parse_frontmatter(md_text: str) -> dict:
    """Extract YAML frontmatter from Markdown text."""
    if not md_text.startswith("---"):
        return {}
    end = md_text.find("---", 3)
    if end == -1:
        return {}
    # Lazy import to avoid hard dep
    import yaml
    return yaml.safe_load(md_text[3:end]) or {}


def resolve_wikilinks(text: str) -> list[str]:
    """Extract [[wikilink]] targets from Markdown text."""
    return re.findall(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', text)


def compute_digest(content: bytes) -> str:
    """SHA-256 digest as multibase z-encoded string (D21)."""
    h = hashlib.sha256(content).hexdigest()
    return f"z{h}"


def main():
    parser = argparse.ArgumentParser(description="Import Obsidian vault subset to Solid Pod")
    parser.add_argument("--source", default="~/Obsidian/obsidian/03 - Resources/Agentic Memory Systems")
    parser.add_argument("--target", default="http://localhost:3000")
    parser.add_argument("--subset", default=None, help="Subfolder within source")
    args = parser.parse_args()

    src = pathlib.Path(args.source).expanduser()
    if not src.exists():
        print(f"Source not found: {src}", file=sys.stderr)
        sys.exit(1)

    md_files = sorted(src.rglob("*.md"))
    print(f"Found {len(md_files)} Markdown files in {src}")

    for f in md_files:
        text = f.read_text()
        fm = parse_frontmatter(text)
        links = resolve_wikilinks(text)
        digest = compute_digest(f.read_bytes())
        note_type = fm.get("type", "unknown")
        print(f"  {f.name}: type={note_type}, links={len(links)}, digest={digest[:16]}...")

    print(f"\nImport to {args.target} not yet implemented (Phase 1 Week 2-3)")


if __name__ == "__main__":
    main()
