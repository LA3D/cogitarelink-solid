# Content Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import 5 vault notes (concept + theory) into the Solid Pod with `.meta` sidecars, then query them via Comunica SPARQL — proving the full vault → pod → SPARQL pipeline.

**Architecture:** Python rdflib generates RDF triples from YAML frontmatter. Minimal httpx helpers PUT markdown content and PATCH `.meta` sidecars to CSS. Comunica link-traversal discovers `.meta` triples via `describedby` links. Python surface area is intentionally minimal — this gets replaced by a TypeScript CLI (D29) for agent tooling.

**Tech Stack:** Python 3.12 (`~/uvws/.venv`), rdflib 7.x, httpx, pyyaml. CSS v8 at `http://pod.vardeman.me:3000`. Comunica at `http://localhost:8080/sparql`.

---

## Prerequisites

- Pod running with PARA containers: `make reset` (should already be up)
- Python venv: `~/uvws/.venv` with rdflib, httpx, pyshacl, pyyaml
- All commands use `~/uvws/.venv/bin/python` and `PYTHONPATH=.` from repo root

## Target Notes

| Note | Type | Key fields |
|------|------|------------|
| Contextual Retrieval.md | concept-note | created, up, area, extends, related (3), tags (3) |
| Compound AI Systems.md | concept-note | created, up, area, related (4), tags (3) |
| Episodic Memory.md | concept-note | created, up, area, related (4), tags (2) |
| Progressive Disclosure.md | theory-note | up (minimal frontmatter) |
| Context Graphs.md | theory-note | up (minimal frontmatter) |

---

### Task 1: Build the frontmatter → RDF generator

**Files:**
- Create: `scripts/__init__.py`
- Create: `scripts/lib/__init__.py`
- Create: `scripts/lib/rdf_gen.py`
- Test: `tests/pytest/test_rdf_gen.py`

**Step 1: Write the test**

Write to `tests/pytest/test_rdf_gen.py`:

```python
"""Test frontmatter → RDF triple generation."""
import pytest
from rdflib import Graph, URIRef, Literal, Namespace
from rdflib.namespace import RDF, DCTERMS, XSD, SKOS

from scripts.lib.rdf_gen import frontmatter_to_graph, slug

VAULT = Namespace("https://pod.vardeman.me/vault/ontology#")
BASE = "http://pod.vardeman.me:3000/vault/resources/concepts/"


def test_slug():
    assert slug("Context Graphs") == "context-graphs"
    assert slug("Compound AI Systems") == "compound-ai-systems"
    assert slug("HippoRAG v2") == "hipporag-v2"


def test_concept_note():
    """Real frontmatter from Contextual Retrieval.md."""
    fm = {
        "type": "concept-note",
        "created": "2026-03-09",
        "up": "[[Agentic Memory Systems MOC]]",
        "extends": "[[Progressive Disclosure]]",
        "related": ["[[Context Graphs]]", "[[Context Engineering]]"],
        "tags": ["retrieval", "rag"],
    }
    g = frontmatter_to_graph(fm, "Contextual Retrieval", BASE)
    subj = URIRef(f"{BASE}contextual-retrieval.md")

    assert (subj, RDF.type, SKOS.Concept) in g
    assert (subj, SKOS.prefLabel, Literal("Contextual Retrieval", datatype=XSD.string)) in g
    assert (subj, DCTERMS.created, Literal("2026-03-09", datatype=XSD.date)) in g

    related = [str(o) for o in g.objects(subj, SKOS.related)]
    assert f"{BASE}context-graphs.md" in related

    tags = [str(o) for o in g.objects(subj, DCTERMS.subject)]
    assert "retrieval" in tags


def test_theory_note():
    """Theory notes get vault:TheoryNote type."""
    fm = {"type": "theory-note", "up": "[[Agentic Memory Systems MOC]]"}
    g = frontmatter_to_graph(fm, "Progressive Disclosure", BASE)
    subj = URIRef(f"{BASE}progressive-disclosure.md")

    assert (subj, RDF.type, VAULT.TheoryNote) in g
    assert (subj, SKOS.prefLabel, Literal("Progressive Disclosure", datatype=XSD.string)) in g


def test_minimal_note():
    """Note with only type — should still produce valid triples."""
    fm = {"type": "concept-note"}
    g = frontmatter_to_graph(fm, "Test Note", BASE)
    subj = URIRef(f"{BASE}test-note.md")

    assert (subj, RDF.type, SKOS.Concept) in g
    assert (subj, SKOS.prefLabel, Literal("Test Note", datatype=XSD.string)) in g
    assert len(g) >= 2


def test_digest():
    """Digest should appear when provided."""
    fm = {"type": "concept-note"}
    g = frontmatter_to_graph(fm, "Test", BASE, digest="zabc123")
    subj = URIRef(f"{BASE}test.md")
    digests = list(g.objects(subj, URIRef("http://www.w3.org/2021/ni#digestMultibase")))
    assert len(digests) == 1


def test_serializes_to_turtle():
    fm = {"type": "concept-note", "created": "2026-01-01"}
    g = frontmatter_to_graph(fm, "Test", BASE)
    ttl = g.serialize(format="turtle")
    assert "skos:Concept" in ttl or "skos/core#Concept" in ttl
```

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_rdf_gen.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.lib'`

**Step 3: Create package init files**

Write empty files:
- `scripts/__init__.py`
- `scripts/lib/__init__.py`

**Step 4: Implement rdf_gen.py**

Write to `scripts/lib/rdf_gen.py`:

```python
"""Frontmatter → RDF triple generation (D7, D31). Minimal — replaced by TS CLI (D29)."""
import re
from rdflib import Graph, URIRef, Literal, Namespace, BNode
from rdflib.namespace import RDF, DCTERMS, XSD, SKOS, PROV

VAULT = Namespace("https://pod.vardeman.me/vault/ontology#")

TYPE_MAP = {
    "concept-note": SKOS.Concept,
    "theory-note": VAULT.TheoryNote,
    "literature-note": VAULT.LiteratureNote,
    "method-note": VAULT.MethodNote,
    "project": VAULT.Project,
}

FIELD_MAP = {
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
    s = re.sub(r'[^\w\s-]', '', title.strip())
    return re.sub(r'\s+', '-', s).lower()


def _strip_wikilink(val: str) -> str:
    m = re.match(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', val.strip())
    return m.group(1) if m else val.strip()


def _resolve(val: str, base: str) -> URIRef:
    return URIRef(f"{base.rstrip('/')}/{slug(_strip_wikilink(val))}.md")


def frontmatter_to_graph(fm: dict, title: str, base: str,
                         digest: str | None = None,
                         source_path: str | None = None) -> Graph:
    g = Graph()
    g.bind("skos", SKOS); g.bind("dct", DCTERMS)
    g.bind("vault", VAULT); g.bind("prov", PROV)

    subj = URIRef(f"{base.rstrip('/')}/{slug(title)}.md")
    rdf_class = TYPE_MAP.get(fm.get("type", "concept-note"), SKOS.Concept)
    g.add((subj, RDF.type, rdf_class))
    g.add((subj, SKOS.prefLabel, Literal(title, datatype=XSD.string)))

    for key, (pred, handler) in FIELD_MAP.items():
        val = fm.get(key)
        if val is None: continue
        if handler == "date":
            g.add((subj, pred, Literal(str(val), datatype=XSD.date)))
        elif handler == "tag_list":
            for t in (val if isinstance(val, list) else [val]):
                g.add((subj, pred, Literal(str(t), datatype=XSD.string)))
        elif handler == "iri_list":
            for item in (val if isinstance(val, list) else [val]):
                g.add((subj, pred, _resolve(str(item), base)))
        elif handler == "iri_single":
            g.add((subj, pred, _resolve(str(val), base)))

    if digest:
        g.add((subj, URIRef("http://www.w3.org/2021/ni#digestMultibase"),
               Literal(digest, datatype=XSD.string)))

    if source_path:
        g.add((subj, PROV.wasDerivedFrom, URIRef(f"file://{source_path}")))

    return g
```

**Step 5: Run tests**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_rdf_gen.py -v`
Expected: All PASS

**Step 6: Commit**

```bash
git add scripts/__init__.py scripts/lib/__init__.py scripts/lib/rdf_gen.py tests/pytest/test_rdf_gen.py
git commit -m "[Agent: Claude] Add frontmatter → RDF generator (D7, D31)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Build the minimal LDP client

Three functions. No classes, no retry, no auth. Intentionally disposable (D29: replaced by TS CLI).

**Files:**
- Create: `scripts/lib/ldp_client.py`
- Test: `tests/pytest/test_ldp_client.py`

**Step 1: Write the test**

Write to `tests/pytest/test_ldp_client.py`:

```python
"""Test LDP client — requires running CSS at pod.vardeman.me:3000."""
import httpx
import pytest
from rdflib import Graph, URIRef, Literal
from rdflib.namespace import RDF, SKOS, XSD

from scripts.lib.ldp_client import put_resource, patch_meta, get_meta

BASE = "http://pod.vardeman.me:3000"


@pytest.mark.integration
def test_put_markdown():
    url = f"{BASE}/vault/resources/concepts/_test-ldp.md"
    status = put_resource(url, b"# Test LDP\n\nHello.", "text/markdown")
    assert status in (200, 201, 205)
    r = httpx.get(url, timeout=10)
    assert r.status_code == 200
    httpx.delete(url, timeout=10)


@pytest.mark.integration
def test_patch_and_get_meta():
    url = f"{BASE}/vault/resources/concepts/_test-meta.md"
    put_resource(url, b"# Test", "text/markdown")

    g = Graph()
    g.add((URIRef(url), RDF.type, SKOS.Concept))
    g.add((URIRef(url), SKOS.prefLabel, Literal("Test Meta", datatype=XSD.string)))
    status = patch_meta(url, g)
    assert status in (200, 201, 205)

    meta_g = get_meta(url)
    assert (URIRef(url), RDF.type, SKOS.Concept) in meta_g

    httpx.delete(url, timeout=10)
```

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_ldp_client.py -v -m integration`
Expected: FAIL — `ModuleNotFoundError`

**Step 3: Implement ldp_client.py**

Write to `scripts/lib/ldp_client.py`:

```python
"""Minimal LDP client for CSS. Disposable — replaced by TS CLI (D29)."""
import httpx
from rdflib import Graph


def put_resource(url: str, content: bytes, content_type: str) -> int:
    r = httpx.put(url, content=content,
                  headers={"Content-Type": content_type}, timeout=30)
    r.raise_for_status()
    return r.status_code


def patch_meta(url: str, g: Graph) -> int:
    inserts = g.serialize(format="nt").strip()
    if not inserts: return 200
    n3 = (
        '@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n'
        '<> a solid:InsertDeletePatch;\n'
        f'solid:inserts {{\n{inserts}\n}}.\n'
    )
    r = httpx.patch(f"{url}.meta", content=n3.encode(),
                    headers={"Content-Type": "text/n3"}, timeout=30)
    r.raise_for_status()
    return r.status_code


def get_meta(url: str) -> Graph:
    r = httpx.get(f"{url}.meta", headers={"Accept": "text/turtle"}, timeout=30)
    r.raise_for_status()
    g = Graph()
    g.parse(data=r.text, format="turtle")
    return g
```

**Step 4: Run tests**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_ldp_client.py -v -m integration`
Expected: All PASS (requires CSS running with allow-all auth + concepts container)

**Step 5: Commit**

```bash
git add scripts/lib/ldp_client.py tests/pytest/test_ldp_client.py
git commit -m "[Agent: Claude] Add minimal LDP client (D29: replaced by TS CLI)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Rewrite the vault importer

Replace the stub `scripts/vault_import.py` with a working importer using rdf_gen + ldp_client.

**Files:**
- Modify: `scripts/vault_import.py`
- Test: `tests/pytest/test_vault_import.py`

**Step 1: Write integration test**

Write to `tests/pytest/test_vault_import.py`:

```python
"""Integration test: vault import creates resources + .meta in pod."""
import httpx
import pytest
from rdflib import Graph

BASE = "http://pod.vardeman.me:3000"


@pytest.mark.integration
def test_concept_note_exists():
    """After import, a concept note should be readable."""
    r = httpx.get(f"{BASE}/vault/resources/concepts/contextual-retrieval.md", timeout=10)
    assert r.status_code == 200
    assert "Contextual Retrieval" in r.text


@pytest.mark.integration
def test_meta_has_type():
    """After import, .meta should have rdf:type triple."""
    r = httpx.get(f"{BASE}/vault/resources/concepts/contextual-retrieval.md.meta",
                  headers={"Accept": "text/turtle"}, timeout=10)
    assert r.status_code == 200
    assert "Concept" in r.text


@pytest.mark.integration
def test_meta_has_relationships():
    """Meta should include relationships from frontmatter."""
    r = httpx.get(f"{BASE}/vault/resources/concepts/contextual-retrieval.md.meta",
                  headers={"Accept": "text/turtle"}, timeout=10)
    g = Graph()
    g.parse(data=r.text, format="turtle")
    assert len(g) >= 4, f"Expected ≥4 triples, got {len(g)}"


@pytest.mark.integration
def test_theory_note_exists():
    """Theory notes should also be imported."""
    r = httpx.get(f"{BASE}/vault/resources/concepts/progressive-disclosure.md", timeout=10)
    assert r.status_code == 200


@pytest.mark.integration
def test_multiple_notes_imported():
    """At least 3 notes should be importable."""
    slugs = ["contextual-retrieval", "compound-ai-systems", "episodic-memory"]
    for s in slugs:
        r = httpx.get(f"{BASE}/vault/resources/concepts/{s}.md", timeout=10)
        assert r.status_code == 200, f"{s}.md not found"
```

**Step 2: Rewrite vault_import.py**

Replace full contents of `scripts/vault_import.py`:

```python
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
```

**Step 3: Dry-run to verify parsing works**

Run:
```bash
PYTHONPATH=. ~/uvws/.venv/bin/python scripts/vault_import.py --dry-run
```
Expected: Lists importable notes with triple counts

**Step 4: Run the actual import**

Run:
```bash
PYTHONPATH=. ~/uvws/.venv/bin/python scripts/vault_import.py
```
Expected: PUT + PATCH for each note

**Step 5: Run integration tests**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_vault_import.py -v -m integration`
Expected: All PASS

**Step 6: Commit**

```bash
git add scripts/vault_import.py tests/pytest/test_vault_import.py
git commit -m "[Agent: Claude] Implement vault importer — PUT content + PATCH .meta (D31)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: SPARQL integration tests via Comunica

The payoff: query the pod's `.meta` triples via Comunica SPARQL.

**Files:**
- Create: `tests/pytest/test_sparql.py`

**Step 1: Write SPARQL tests**

Write to `tests/pytest/test_sparql.py`:

```python
"""Test SPARQL queries over pod .meta triples via Comunica."""
import httpx
import pytest

SPARQL = "http://localhost:8080/sparql"


def _query(sparql: str) -> list[dict]:
    r = httpx.post(SPARQL, data={"query": sparql},
                   headers={"Accept": "application/sparql-results+json"},
                   timeout=120)
    r.raise_for_status()
    return r.json()["results"]["bindings"]


@pytest.mark.integration
@pytest.mark.sparql
def test_find_concepts():
    """Comunica should find skos:Concept instances from .meta."""
    bindings = _query("""
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        SELECT ?c ?label WHERE {
            ?c a skos:Concept ; skos:prefLabel ?label .
        }
    """)
    labels = [b["label"]["value"] for b in bindings]
    assert len(labels) >= 3, f"Expected ≥3 concepts, got {labels}"
    assert "Contextual Retrieval" in labels


@pytest.mark.integration
@pytest.mark.sparql
def test_find_relationships():
    """Comunica should find skos:related links between concepts."""
    bindings = _query("""
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        SELECT ?from ?to WHERE {
            ?from skos:related ?to .
        }
    """)
    assert len(bindings) >= 1, f"Expected ≥1 relationship, got {len(bindings)}"


@pytest.mark.integration
@pytest.mark.sparql
def test_find_tags():
    """Comunica should find dct:subject tags from .meta."""
    bindings = _query("""
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        SELECT ?concept ?tag WHERE {
            ?concept a skos:Concept ; dct:subject ?tag .
        }
    """)
    tags = [b["tag"]["value"] for b in bindings]
    assert "retrieval" in tags or "rag" in tags, f"Expected retrieval/rag tag, got {tags}"
```

**Step 2: Run SPARQL tests**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_sparql.py -v -m sparql`

Expected: PASS — Comunica traverses LDP containers, follows `describedby` links to `.meta`, finds SKOS triples.

NOTE: Comunica link-traversal is experimental and may need time to crawl. The 120s timeout accounts for this. If tests fail due to timeout, Comunica may need a restart after import to pick up new resources: `docker compose restart comunica`.

**Step 3: Commit**

```bash
git add tests/pytest/test_sparql.py
git commit -m "[Agent: Claude] Add SPARQL integration tests via Comunica (D28)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: End-to-end verification

Full pipeline from clean slate.

**Step 1: Reset and reimport**

Run:
```bash
make reset
# Wait ~60s for CSS + pod-setup + Comunica
make status
# All should be 200
PYTHONPATH=. ~/uvws/.venv/bin/python scripts/vault_import.py
# Should import concept + theory notes
```

**Step 2: Run all integration tests**

Run: `PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/ -v -m integration`
Expected: All tests PASS (pod_structure + ldp_client + vault_import + sparql)

**Step 3: Manual SPARQL verification**

Run:
```bash
curl -s http://localhost:8080/sparql \
  -d "query=PREFIX skos: <http://www.w3.org/2004/02/skos/core#> SELECT ?c ?label WHERE { ?c a skos:Concept ; skos:prefLabel ?label }" \
  -H "Accept: application/sparql-results+json" | ~/uvws/.venv/bin/python -m json.tool
```

Expected: JSON with concept labels including "Contextual Retrieval", "Compound AI Systems", "Episodic Memory"

**Step 4: Commit tests + any fixes**

```bash
git add -p  # review carefully
git commit -m "[Agent: Claude] Verify end-to-end: vault → pod → SPARQL pipeline complete

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Dependency Chain

```
Task 1 (rdf_gen) ──┐
                    ├──→ Task 3 (vault_import) ──→ Task 4 (SPARQL tests) ──→ Task 5 (E2E)
Task 2 (ldp_client) ┘
```

Tasks 1 and 2 are independent (can be parallelized). Task 3 depends on both. Task 4 depends on 3. Task 5 depends on all.
