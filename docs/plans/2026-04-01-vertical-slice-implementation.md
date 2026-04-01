# Vertical Slice: Vault → Pod → SPARQL Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import 5 concept notes from the Obsidian vault into the Solid pod with `.meta` sidecars, then query them via Comunica SPARQL — proving the full pipeline end-to-end.

**Architecture:** Python importer reads vault markdown + YAML frontmatter, generates Turtle `.meta` triples via rdflib, uploads content via httpx PUT + metadata via PATCH to CSS. Comunica sidecar traverses LDP containers + `describedby` links, exposing `.meta` triples via SPARQL.

**Tech Stack:** Python 3.12 (~/uvws/.venv), rdflib 7.x, httpx, pyshacl, CSS v8 (Docker), Comunica link-traversal-solid (Docker)

---

## Prerequisites

- CSS running at http://localhost:3000 (`docker compose up -d`)
- Python venv at `~/uvws/.venv` with rdflib, httpx, pyshacl, pyyaml installed
- All commands use `~/uvws/.venv/bin/python` unless stated otherwise

## Target Notes (5 concept notes from Agentic Memory Systems)

1. `Contextual Retrieval.md` — has `extends`, `related`, tags
2. `Compound AI Systems.md` — has `related`, tags
3. `Episodic Memory.md` — has `related`, tags
4. `Progressive Disclosure.md` — core concept, likely many inbound links
5. `Context Graphs.md` or `Memory Partitions.md` — theory-adjacent concept

---

### Task 1: Switch CSS to allow-all auth for development

The pod currently uses WebACL which blocks unauthenticated writes (401 on PUT/PATCH). For the development vertical slice, switch to `allow-all` authorization.

**Files:**
- Modify: `css/config/solid-config.json`
- Modify: `docker-compose.yml` (rebuild needed)

**Step 1: Update CSS config to use allow-all authorization**

In `css/config/solid-config.json`, the base config imports `css:config/file.json` which includes `css:config/ldp/authorization/webacl.json`. We need to override this.

Add to the `"import"` array a local override file, OR change the base config. Simplest: create a dev config overlay.

Create file `css/config/dev-allow-all.json`:
```json
{
  "@context": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
  "import": [
    "css:config/ldp/authorization/allow-all.json"
  ]
}
```

Then in `solid-config.json`, add `"./dev-allow-all.json"` to the imports array.

**Step 2: Rebuild and restart CSS**

Run:
```bash
docker compose down
docker compose build css
docker compose up -d css
```

**Step 3: Verify unauthenticated write works**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:3000/test-write.txt \
  -H "Content-Type: text/plain" -d "hello"
```
Expected: `201` (Created) or `205` (Reset Content)

Then clean up:
```bash
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:3000/test-write.txt
```

**Step 4: Commit**

```bash
git add css/config/dev-allow-all.json css/config/solid-config.json
git commit -m "[Agent: Claude] Add dev-allow-all auth config for vertical slice

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Create PARA container structure in the pod

Create the container hierarchy from D30 design.

**Files:**
- Create: `scripts/pod_init.py`
- Test: `tests/pytest/test_pod_init.py`

**Step 1: Write the test**

```python
# tests/pytest/test_pod_init.py
"""Test pod container initialization."""
import httpx
import pytest

CONTAINERS = [
    "/vault/",
    "/vault/resources/",
    "/vault/resources/concepts/",
    "/vault/resources/theories/",
    "/vault/resources/literature/",
    "/vault/projects/",
    "/vault/areas/",
    "/vault/archive/",
    "/procedures/",
    "/procedures/shapes/",
    "/ontology/",
]

@pytest.mark.integration
def test_containers_exist(css_url):
    """All PARA containers should exist after pod_init."""
    for path in CONTAINERS:
        r = httpx.get(f"{css_url}{path}", headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200, f"Container {path} returned {r.status_code}"
        assert "ldp:BasicContainer" in r.text or "ldp#BasicContainer" in r.text, \
            f"{path} is not a container"
```

**Step 2: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/pytest/test_pod_init.py -v -m integration`
Expected: FAIL — containers don't exist yet (most will 404)

**Step 3: Write pod_init.py**

```python
# scripts/pod_init.py
"""Initialize pod container structure (D30 PARA layout)."""
import httpx, sys

CONTAINERS = [
    "/vault/",
    "/vault/resources/",
    "/vault/resources/concepts/",
    "/vault/resources/theories/",
    "/vault/resources/literature/",
    "/vault/projects/",
    "/vault/areas/",
    "/vault/archive/",
    "/procedures/",
    "/procedures/shapes/",
    "/ontology/",
]

def init_pod(base: str = "http://localhost:3000"):
    """Create PARA container hierarchy via LDP."""
    with httpx.Client(base_url=base, timeout=30) as c:
        for path in CONTAINERS:
            # Check if exists
            r = c.head(path)
            if r.status_code == 200:
                print(f"  exists: {path}")
                continue
            # Create container — PUT with container Link header
            r = c.put(path, content=b"",
                       headers={"Content-Type": "text/turtle",
                                "Link": '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"'})
            if r.status_code in (200, 201, 205):
                print(f"  created: {path}")
            else:
                print(f"  FAILED: {path} → {r.status_code} {r.text[:200]}", file=sys.stderr)

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="Initialize pod containers")
    p.add_argument("--target", default="http://localhost:3000")
    args = p.parse_args()
    init_pod(args.target)
```

**Step 4: Run pod_init and then test**

Run:
```bash
~/uvws/.venv/bin/python scripts/pod_init.py
~/uvws/.venv/bin/python -m pytest tests/pytest/test_pod_init.py -v -m integration
```
Expected: All containers created, tests PASS

**Step 5: Commit**

```bash
git add scripts/pod_init.py tests/pytest/test_pod_init.py
git commit -m "[Agent: Claude] Add pod container initialization script (D30 PARA layout)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Build the frontmatter → RDF triple generator

The core of the importer: read frontmatter, generate rdflib Graph with triples matching the SHACL shape contract.

**Files:**
- Create: `scripts/lib/rdf_gen.py`
- Test: `tests/pytest/test_rdf_gen.py`

**Step 1: Write the test**

```python
# tests/pytest/test_rdf_gen.py
"""Test frontmatter → RDF triple generation."""
import pytest
from rdflib import Graph, URIRef, Literal, Namespace
from rdflib.namespace import RDF, DCTERMS, XSD, SKOS

# Import will fail initially — that's the point
from scripts.lib.rdf_gen import frontmatter_to_graph, slug

VAULT = Namespace("https://pod.vardeman.me/vault/ontology#")
BASE = "http://localhost:3000/vault/resources/concepts/"

def test_slug_generation():
    assert slug("Context Graphs") == "context-graphs"
    assert slug("Compound AI Systems") == "compound-ai-systems"
    assert slug("HippoRAG v2") == "hipporag-v2"

def test_minimal_concept_note():
    """Concept note with just title, type, created."""
    fm = {"type": "concept-note", "title": "Context Graphs", "created": "2026-02-26"}
    g = frontmatter_to_graph(fm, note_title="Context Graphs", base_url=BASE)

    subj = URIRef(f"{BASE}context-graphs.md")
    assert (subj, RDF.type, SKOS.Concept) in g
    assert (subj, SKOS.prefLabel, Literal("Context Graphs", datatype=XSD.string)) in g
    assert (subj, DCTERMS.created, Literal("2026-02-26", datatype=XSD.date)) in g

def test_tags_become_subjects():
    fm = {"type": "concept-note", "title": "Test", "created": "2026-01-01",
          "tags": ["memory", "agents"]}
    g = frontmatter_to_graph(fm, note_title="Test", base_url=BASE)
    subj = URIRef(f"{BASE}test.md")
    subjects = [str(o) for o in g.objects(subj, DCTERMS.subject)]
    assert "memory" in subjects
    assert "agents" in subjects

def test_wikilink_related():
    fm = {"type": "concept-note", "title": "Test", "created": "2026-01-01",
          "related": ["[[Progressive Disclosure]]", "[[Context Graphs]]"]}
    g = frontmatter_to_graph(fm, note_title="Test", base_url=BASE)
    subj = URIRef(f"{BASE}test.md")
    related = [str(o) for o in g.objects(subj, SKOS.related)]
    assert f"{BASE}progressive-disclosure.md" in related
    assert f"{BASE}context-graphs.md" in related

def test_up_becomes_ispartof():
    fm = {"type": "concept-note", "title": "Test", "created": "2026-01-01",
          "up": "[[Agentic Memory Systems MOC]]"}
    g = frontmatter_to_graph(fm, note_title="Test", base_url=BASE)
    subj = URIRef(f"{BASE}test.md")
    parts = [str(o) for o in g.objects(subj, DCTERMS.isPartOf)]
    assert any("agentic-memory-systems-moc" in p for p in parts)

def test_source_becomes_dctsource():
    fm = {"type": "concept-note", "title": "Test", "created": "2026-01-01",
          "source": ["[[@zhang-2025-rlm]]"]}
    g = frontmatter_to_graph(fm, note_title="Test", base_url=BASE)
    subj = URIRef(f"{BASE}test.md")
    sources = [str(o) for o in g.objects(subj, DCTERMS.source)]
    assert any("zhang-2025-rlm" in s for s in sources)

def test_serializes_to_turtle():
    fm = {"type": "concept-note", "title": "Test", "created": "2026-01-01"}
    g = frontmatter_to_graph(fm, note_title="Test", base_url=BASE)
    ttl = g.serialize(format="turtle")
    assert "skos:Concept" in ttl or "skos/core#Concept" in ttl
```

**Step 2: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/pytest/test_rdf_gen.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.lib.rdf_gen'`

**Step 3: Implement rdf_gen.py**

```python
# scripts/lib/__init__.py
# (empty, makes scripts/lib a package)

# scripts/lib/rdf_gen.py
"""Frontmatter → RDF triple generation (D7, D31)."""
import re
from rdflib import Graph, URIRef, Literal, Namespace, BNode
from rdflib.namespace import RDF, DCTERMS, XSD, SKOS, PROV

VAULT = Namespace("https://pod.vardeman.me/vault/ontology#")

# Frontmatter type → RDF class
TYPE_MAP = {
    "concept-note": SKOS.Concept,
    "theory-note": VAULT.TheoryNote,
    "literature-note": VAULT.LiteratureNote,
    "method-note": VAULT.MethodNote,
    "project": VAULT.Project,
}

# Frontmatter key → (predicate, handler)
# handler: "literal" | "iri_list" | "iri_single" | "tag_list" | "date"
FIELD_MAP = {
    "title":   (SKOS.prefLabel, "literal"),
    "created": (DCTERMS.created, "date"),
    "tags":    (DCTERMS.subject, "tag_list"),
    "related": (SKOS.related, "iri_list"),
    "up":      (DCTERMS.isPartOf, "iri_single"),
    "source":  (DCTERMS.source, "iri_list"),
    "extends": (VAULT.extends, "iri_list"),
    "area":    (VAULT.area, "iri_single"),
    "concept": (VAULT.concept, "iri_list"),
    "supports":(VAULT.supports, "iri_list"),
    "criticizes":(VAULT.criticizes, "iri_list"),
}

def slug(title: str) -> str:
    """Convert note title to URL slug."""
    s = title.strip()
    s = re.sub(r'[^\w\s-]', '', s)  # drop special chars except hyphens
    s = re.sub(r'\s+', '-', s)       # spaces → hyphens
    return s.lower()

def _strip_wikilink(val: str) -> str:
    """Extract title from [[Title]] or [[Title|Display]]."""
    m = re.match(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', val.strip())
    return m.group(1) if m else val.strip()

def _resolve_wikilink(val: str, base_url: str) -> URIRef:
    """Resolve a wikilink string to a pod URI."""
    title = _strip_wikilink(val)
    return URIRef(f"{base_url.rstrip('/')}/{slug(title)}.md")

def frontmatter_to_graph(fm: dict, note_title: str, base_url: str,
                         digest: str | None = None,
                         source_path: str | None = None) -> Graph:
    """Convert frontmatter dict to rdflib Graph of .meta triples."""
    g = Graph()
    g.bind("skos", SKOS)
    g.bind("dct", DCTERMS)
    g.bind("vault", VAULT)
    g.bind("prov", PROV)

    subj = URIRef(f"{base_url.rstrip('/')}/{slug(note_title)}.md")

    # rdf:type from frontmatter type field
    note_type = fm.get("type", "concept-note")
    rdf_class = TYPE_MAP.get(note_type, SKOS.Concept)
    g.add((subj, RDF.type, rdf_class))

    # title — use frontmatter title or note_title
    title = fm.get("title", note_title)
    g.add((subj, SKOS.prefLabel, Literal(title, datatype=XSD.string)))

    # Map each frontmatter field
    for key, (pred, handler) in FIELD_MAP.items():
        val = fm.get(key)
        if val is None or key in ("title",):  # title handled above
            continue
        if handler == "literal":
            g.add((subj, pred, Literal(str(val), datatype=XSD.string)))
        elif handler == "date":
            g.add((subj, pred, Literal(str(val), datatype=XSD.date)))
        elif handler == "tag_list":
            tags = val if isinstance(val, list) else [val]
            for t in tags:
                g.add((subj, pred, Literal(str(t), datatype=XSD.string)))
        elif handler == "iri_list":
            items = val if isinstance(val, list) else [val]
            for item in items:
                g.add((subj, pred, _resolve_wikilink(str(item), base_url)))
        elif handler == "iri_single":
            g.add((subj, pred, _resolve_wikilink(str(val), base_url)))

    # Content integrity (D21)
    if digest:
        g.add((subj, URIRef("http://www.w3.org/2021/ni#digestMultibase"),
               Literal(digest, datatype=XSD.string)))

    # Provenance (D20) — minimal for vertical slice
    if source_path:
        activity = BNode()
        g.add((subj, PROV.wasDerivedFrom, URIRef(f"file://{source_path}")))
        g.add((subj, PROV.wasGeneratedBy, activity))
        g.add((activity, RDF.type, PROV.Activity))
        g.add((activity, PROV.wasAssociatedWith,
               URIRef("https://orcid.org/0000-0003-4091-6059")))

    return g
```

**Step 4: Run tests**

Run: `cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid && PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_rdf_gen.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add scripts/lib/__init__.py scripts/lib/rdf_gen.py tests/pytest/test_rdf_gen.py
git commit -m "[Agent: Claude] Add frontmatter → RDF triple generator (D7, D31)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Build the LDP upload client

HTTP client that PUTs markdown content and PATCHes `.meta` triples to CSS.

**Files:**
- Create: `scripts/lib/ldp_client.py`
- Test: `tests/pytest/test_ldp_client.py`

**Step 1: Write the test**

```python
# tests/pytest/test_ldp_client.py
"""Test LDP client upload to CSS."""
import httpx
import pytest
from rdflib import Graph, URIRef, Literal, Namespace
from rdflib.namespace import RDF, SKOS, DCTERMS, XSD

from scripts.lib.ldp_client import put_resource, patch_meta, get_meta

@pytest.mark.integration
def test_put_markdown(css_url):
    """PUT a markdown file to pod."""
    url = f"{css_url}/vault/resources/concepts/test-note.md"
    md = "# Test Note\n\nThis is a test."
    status = put_resource(url, md.encode(), "text/markdown")
    assert status in (200, 201, 205)
    # Verify it's there
    r = httpx.get(url, headers={"Accept": "text/markdown"}, timeout=10)
    assert r.status_code == 200
    # Cleanup
    httpx.delete(url, timeout=10)

@pytest.mark.integration
def test_patch_meta(css_url):
    """PATCH metadata onto a resource's .meta."""
    url = f"{css_url}/vault/resources/concepts/test-meta.md"
    # First create the resource
    put_resource(url, b"# Test", "text/markdown")
    # Build metadata graph
    g = Graph()
    subj = URIRef(url)
    g.add((subj, RDF.type, SKOS.Concept))
    g.add((subj, SKOS.prefLabel, Literal("Test Meta", datatype=XSD.string)))
    # Patch it
    status = patch_meta(url, g)
    assert status in (200, 201, 205)
    # Read it back
    meta_g = get_meta(url)
    assert (subj, RDF.type, SKOS.Concept) in meta_g
    # Cleanup
    httpx.delete(url, timeout=10)
```

**Step 2: Run test to verify failure**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_ldp_client.py -v -m integration`
Expected: FAIL — `ModuleNotFoundError`

**Step 3: Implement ldp_client.py**

```python
# scripts/lib/ldp_client.py
"""LDP client for CSS — PUT resources, PATCH .meta sidecars."""
import httpx
from rdflib import Graph

def put_resource(url: str, content: bytes, content_type: str,
                 timeout: float = 30.0) -> int:
    """PUT a resource to CSS. Returns HTTP status code."""
    r = httpx.put(url, content=content,
                  headers={"Content-Type": content_type},
                  timeout=timeout)
    r.raise_for_status()
    return r.status_code

def patch_meta(resource_url: str, g: Graph, timeout: float = 30.0) -> int:
    """PATCH triples into a resource's .meta via N3 Patch."""
    meta_url = f"{resource_url}.meta"
    # Build N3 Patch body
    inserts = g.serialize(format="nt").strip()
    if not inserts:
        return 200  # nothing to patch
    n3_body = (
        '@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n'
        '<> a solid:InsertDeletePatch;\n'
        'solid:inserts {\n'
        f'{inserts}\n'
        '}.\n'
    )
    r = httpx.patch(meta_url, content=n3_body.encode(),
                    headers={"Content-Type": "text/n3"},
                    timeout=timeout)
    r.raise_for_status()
    return r.status_code

def get_meta(resource_url: str, timeout: float = 30.0) -> Graph:
    """GET a resource's .meta as rdflib Graph."""
    meta_url = f"{resource_url}.meta"
    r = httpx.get(meta_url, headers={"Accept": "text/turtle"}, timeout=timeout)
    r.raise_for_status()
    g = Graph()
    g.parse(data=r.text, format="turtle")
    return g
```

**Step 4: Run tests**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_ldp_client.py -v -m integration`
Expected: PASS (requires Task 1 + Task 2 completed — CSS with allow-all auth and containers created)

**Step 5: Commit**

```bash
git add scripts/lib/ldp_client.py tests/pytest/test_ldp_client.py
git commit -m "[Agent: Claude] Add LDP client for CSS resource upload + .meta PATCH

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Wire the full vault importer

Replace the stub `vault_import.py` with the real implementation that uses `rdf_gen` + `ldp_client`.

**Files:**
- Modify: `scripts/vault_import.py`
- Test: `tests/pytest/test_vault_import.py`

**Step 1: Write integration test**

```python
# tests/pytest/test_vault_import.py
"""Integration test: import a concept note and verify it's in the pod."""
import httpx
import pytest

@pytest.mark.integration
def test_import_creates_resource(css_url):
    """After import, concept note should be readable."""
    # We test against a known note that vault_import.py will have imported
    url = f"{css_url}/vault/resources/concepts/contextual-retrieval.md"
    r = httpx.get(url, timeout=10)
    assert r.status_code == 200
    assert "Contextual Retrieval" in r.text

@pytest.mark.integration
def test_import_creates_meta(css_url):
    """After import, .meta should contain RDF triples."""
    url = f"{css_url}/vault/resources/concepts/contextual-retrieval.md.meta"
    r = httpx.get(url, headers={"Accept": "text/turtle"}, timeout=10)
    assert r.status_code == 200
    assert "skos:Concept" in r.text or "skos/core#Concept" in r.text
    assert "prefLabel" in r.text

@pytest.mark.integration
def test_meta_has_relationships(css_url):
    """Meta should include vault relationships from frontmatter."""
    from rdflib import Graph
    url = f"{css_url}/vault/resources/concepts/contextual-retrieval.md.meta"
    r = httpx.get(url, headers={"Accept": "text/turtle"}, timeout=10)
    g = Graph()
    g.parse(data=r.text, format="turtle")
    # Should have at least: type, prefLabel, created, and some relationships
    assert len(g) >= 4, f"Expected ≥4 triples, got {len(g)}"
```

**Step 2: Rewrite vault_import.py**

Replace full contents of `scripts/vault_import.py`:

```python
"""Vault-to-Pod importer: reads Obsidian vault subset, generates LDP resources + RDF .meta.

Usage:
    python scripts/vault_import.py [--source VAULT_PATH] [--target POD_URL] [--dry-run]

Default source: ~/Obsidian/obsidian/03 - Resources/Agentic Memory Systems
Default target: http://localhost:3000
"""
import argparse, hashlib, pathlib, re, sys
from datetime import datetime, timezone

import yaml

from scripts.lib.rdf_gen import frontmatter_to_graph, slug
from scripts.lib.ldp_client import put_resource, patch_meta


def parse_frontmatter(md_text: str) -> dict:
    """Extract YAML frontmatter from Markdown text."""
    if not md_text.startswith("---"):
        return {}
    end = md_text.find("---", 3)
    if end == -1:
        return {}
    return yaml.safe_load(md_text[3:end]) or {}


def compute_digest(content: bytes) -> str:
    """SHA-256 digest as multibase z-encoded string (D21)."""
    return f"z{hashlib.sha256(content).hexdigest()}"


def import_note(md_path: pathlib.Path, base_url: str, container: str,
                dry_run: bool = False) -> bool:
    """Import a single markdown note to the pod."""
    text = md_path.read_text()
    raw = md_path.read_bytes()
    fm = parse_frontmatter(text)
    note_type = fm.get("type", "unknown")

    # Only import concept-notes for this vertical slice
    if note_type != "concept-note":
        return False

    title = fm.get("title", md_path.stem)
    resource_url = f"{base_url.rstrip('/')}{container}{slug(title)}.md"
    digest = compute_digest(raw)

    # Generate .meta triples
    g = frontmatter_to_graph(
        fm, note_title=title,
        base_url=f"{base_url.rstrip('/')}{container}",
        digest=digest,
        source_path=str(md_path),
    )
    meta_ttl = g.serialize(format="turtle")

    if dry_run:
        print(f"  [dry-run] {title}")
        print(f"    → {resource_url}")
        print(f"    → {len(g)} triples in .meta")
        return True

    # PUT markdown content
    try:
        put_resource(resource_url, raw, "text/markdown")
        print(f"  PUT {resource_url}")
    except Exception as e:
        print(f"  FAILED PUT {resource_url}: {e}", file=sys.stderr)
        return False

    # PATCH .meta with generated triples
    try:
        patch_meta(resource_url, g)
        print(f"  PATCH {resource_url}.meta ({len(g)} triples)")
    except Exception as e:
        print(f"  FAILED PATCH {resource_url}.meta: {e}", file=sys.stderr)
        return False

    return True


def main():
    parser = argparse.ArgumentParser(description="Import Obsidian vault subset to Solid Pod")
    parser.add_argument("--source", default="~/Obsidian/obsidian/03 - Resources/Agentic Memory Systems")
    parser.add_argument("--target", default="http://localhost:3000")
    parser.add_argument("--container", default="/vault/resources/concepts/",
                        help="Target container path")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be imported")
    args = parser.parse_args()

    src = pathlib.Path(args.source).expanduser()
    if not src.exists():
        print(f"Source not found: {src}", file=sys.stderr)
        sys.exit(1)

    md_files = sorted(src.rglob("*.md"))
    print(f"Found {len(md_files)} Markdown files in {src}")

    imported = 0
    for f in md_files:
        if import_note(f, args.target, args.container, args.dry_run):
            imported += 1

    print(f"\nImported {imported} concept notes to {args.target}{args.container}")


if __name__ == "__main__":
    main()
```

**Step 3: Dry-run to verify**

Run:
```bash
PYTHONPATH=. ~/uvws/.venv/bin/python scripts/vault_import.py --dry-run
```
Expected: Lists concept notes with their target URLs and triple counts

**Step 4: Run the actual import**

Run:
```bash
PYTHONPATH=. ~/uvws/.venv/bin/python scripts/vault_import.py
```
Expected: PUT + PATCH for each concept note

**Step 5: Run integration tests**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_vault_import.py -v -m integration`
Expected: PASS

**Step 6: Commit**

```bash
git add scripts/vault_import.py tests/pytest/test_vault_import.py
git commit -m "[Agent: Claude] Implement vault importer — PUT content + PATCH .meta (D31)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Start Comunica sidecar and test SPARQL over `.meta`

The payoff: SPARQL queries over the pod's `.meta` graph.

**Files:**
- Modify: `docker-compose.yml` (ensure Comunica starts)
- Test: `tests/pytest/test_sparql.py`

**Step 1: Fix Comunica service in docker-compose.yml**

The current Comunica service may need adjustment. Update to use a working configuration:

```yaml
  comunica:
    image: node:20-slim
    command: >
      npx -y @comunica/query-sparql-link-traversal-solid-http
      http://localhost:3000/vault/resources/concepts/
      --port 8080
      --lenient
    ports:
      - "8080:8080"
    depends_on:
      css:
        condition: service_healthy
    restart: unless-stopped
```

Note: Comunica needs to reference the CSS container's internal hostname. In docker-compose networking, CSS is reachable as `css:3000` from within the Comunica container. Update the command to use `http://css:3000/vault/resources/concepts/`.

**Step 2: Start Comunica**

Run:
```bash
docker compose up -d comunica
docker compose logs comunica --tail 20
```
Expected: Comunica starts and logs that it's listening on port 8080

**Step 3: Write SPARQL test**

```python
# tests/pytest/test_sparql.py
"""Test SPARQL queries over pod content via Comunica."""
import httpx
import pytest

SPARQL_URL = "http://localhost:8080/sparql"

@pytest.mark.integration
@pytest.mark.sparql
def test_select_all_concepts(sparql_url):
    """Query should find concept notes via .meta triples."""
    query = """
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?concept ?label WHERE {
        ?concept a skos:Concept ;
                 skos:prefLabel ?label .
    }
    """
    r = httpx.post(sparql_url, data={"query": query},
                   headers={"Accept": "application/sparql-results+json"},
                   timeout=60)
    assert r.status_code == 200
    results = r.json()
    bindings = results["results"]["bindings"]
    assert len(bindings) >= 3, f"Expected ≥3 concepts, got {len(bindings)}"
    labels = [b["label"]["value"] for b in bindings]
    print(f"Found concepts: {labels}")

@pytest.mark.integration
@pytest.mark.sparql
def test_concept_relationships(sparql_url):
    """Query should traverse skos:related in .meta."""
    query = """
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?from ?to WHERE {
        ?from skos:related ?to .
    }
    """
    r = httpx.post(sparql_url, data={"query": query},
                   headers={"Accept": "application/sparql-results+json"},
                   timeout=60)
    assert r.status_code == 200
    results = r.json()
    bindings = results["results"]["bindings"]
    assert len(bindings) >= 1, f"Expected ≥1 relationship, got {len(bindings)}"
```

**Step 4: Run SPARQL tests**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_sparql.py -v -m sparql`
Expected: PASS — Comunica traverses LDP containers, follows `describedby` links to `.meta` files, finds SKOS concepts

**Step 5: Commit**

```bash
git add docker-compose.yml tests/pytest/test_sparql.py
git commit -m "[Agent: Claude] Add Comunica sidecar + SPARQL integration tests (D28)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Verify end-to-end and document results

**Step 1: Run full pipeline from scratch**

```bash
# Reset pod data (optional — if you want clean state)
docker compose down -v
docker compose up -d css
# Wait for healthy
sleep 5
# Init containers
PYTHONPATH=. ~/uvws/.venv/bin/python scripts/pod_init.py
# Import vault notes
PYTHONPATH=. ~/uvws/.venv/bin/python scripts/vault_import.py
# Start Comunica
docker compose up -d comunica
sleep 10
# Run all tests
PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/ -v -m integration
```

**Step 2: Manual SPARQL verification**

```bash
curl -s http://localhost:8080/sparql \
  -d "query=PREFIX skos: <http://www.w3.org/2004/02/skos/core#> SELECT ?c ?label WHERE { ?c a skos:Concept ; skos:prefLabel ?label }" \
  -H "Accept: application/sparql-results+json" | python3 -m json.tool
```

**Step 3: Document what worked, what didn't**

Update `docs/plans/2026-04-01-pod-agentic-memory-structure-design.md` with an "Experiment Results" section noting:
- How many notes imported successfully
- Whether Comunica found `.meta` triples via `describedby`
- SPARQL query latency
- Any issues encountered

**Step 4: Final commit**

```bash
git add -A  # careful — review what's staged
git commit -m "[Agent: Claude] Complete vertical slice: vault → pod → SPARQL end-to-end

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Dependency Chain

```
Task 1 (auth) ──→ Task 2 (containers) ──→ Task 4 (LDP client)
                                      └──→ Task 3 (RDF gen)
                                                    ↓
                                              Task 5 (importer)
                                                    ↓
                                              Task 6 (Comunica + SPARQL)
                                                    ↓
                                              Task 7 (verify E2E)
```

Tasks 3 and 4 can be done in parallel (no dependency between them). Everything else is sequential.
