"""Vault-to-Pod importer: reads Obsidian vault, generates LDP resources + .meta RDF.

Usage:
    PYTHONPATH=. python scripts/vault_import.py [--source PATH] [--target URL] [--dry-run]
"""
import argparse, hashlib, pathlib, sys
import yaml

from scripts.lib.rdf_gen import frontmatter_to_graph, slug
from scripts.lib.ldp_client import put_resource, patch_meta

# All knowledge-bearing note types we surface in the pod. Expanding beyond
# the original concept-note + theory-note set so wikilink navigation works
# across the vault subtree — most wikilinks from a concept body target one
# of these types, and if they're not imported, the link 404s.
IMPORTABLE_TYPES = {
    "concept-note",
    "theory-note",
    "external-resource",
    "method-note",
    "implementation-note",
    "finding",
    "literature-note",
    "book-note",
    "author-note",
    "person",
    "organization",
    "area",
    "tool",
    "moc",
    "reference",
    "index",
}

# Note types whose wikilink slug derives from the FILENAME STEM (with any
# leading @ stripped) rather than the frontmatter title. The convention in
# this vault is that literature and people are cited by citekey in wikilink
# bodies — e.g. `[[@li-2026-skillsbench]]` or `[[li-2026-skillsbench]]` —
# while concept-notes and theory-notes are cited by their title.
CITEKEY_SLUG_TYPES = {
    "literature-note",
    "book-note",
    "author-note",
    "person",
}


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

    # Pick the slug source: citekey-slug types use the filename stem (minus
    # any leading @), everyone else uses the frontmatter title. This matches
    # the wikilink citation convention — literature and people are referenced
    # by citekey in body wikilinks, not by title.
    if note_type in CITEKEY_SLUG_TYPES:
        slug_source = path.stem.lstrip("@")
    else:
        slug_source = title

    url = f"{target.rstrip('/')}{container}{slug(slug_source)}.md"
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
                   action="append",
                   default=None,
                   help="Vault subtree(s) to import. Can be passed multiple "
                        "times. Defaults to ['03 - Resources', '02 - Areas "
                        "of Focus']. Walks recursively for *.md files with a "
                        "type: in IMPORTABLE_TYPES.")
    p.add_argument("--target", default="http://pod.vardeman.me:3000")
    p.add_argument("--container", default="/vault/resources/concepts/")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    sources = args.source or [
        "~/Obsidian/obsidian/03 - Resources",
        "~/Obsidian/obsidian/02 - Areas of Focus",
    ]

    md_files = []
    for source in sources:
        src = pathlib.Path(source).expanduser()
        if not src.exists():
            print(f"Source not found: {src}", file=sys.stderr)
            continue
        found = sorted(src.rglob("*.md"))
        print(f"Found {len(found)} files in {src}")
        md_files.extend(found)

    imported, total_triples = 0, 0
    for f in md_files:
        if import_note(f, args.target, args.container, args.dry_run):
            imported += 1

    print(f"\nImported {imported} notes to {args.target}{args.container}")

    # Patch container .meta with member count (rdfs:comment summary)
    if imported > 0 and not args.dry_run:
        from rdflib import Graph, URIRef, Literal
        from rdflib.namespace import RDFS
        container_url = f"{args.target.rstrip('/')}{args.container.rstrip('/')}"
        g = Graph()
        g.add((URIRef(container_url + "/"), RDFS.comment,
               Literal(f"Contains {imported} imported notes.")))
        try:
            patch_meta(container_url + "/", g)
            print(f"  Patched container comment: {imported} notes")
        except Exception as e:
            print(f"  WARNING: Could not patch container stats: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
