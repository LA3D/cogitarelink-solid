# TypeScript-First Architecture Restructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the repo from a Python adapter + CSS + Oxigraph stack to a CSS + Comunica stack with Python as client-only tooling.

**Architecture:** Remove the Python FastAPI adapter container. CSS serves the Pod (with future TypeScript extensions for `.well-known/`). Comunica provides SPARQL-over-LDP as a sidecar. Python stays for CLI tools (vault importer, SHACL dev) and RLM agent integration. Oxigraph deferred to Phase 2.

**Tech Stack:** CSS v7 (TypeScript), Comunica v5 (@comunica/query-sparql-solid), Python 3.12 (httpx, rdflib, pyshacl), Docker Compose.

---

### Task 1: Remove adapter directory

**Files:**
- Delete: `adapter/main.py`
- Delete: `adapter/Dockerfile`
- Delete: `adapter/requirements.txt`
- Delete: `adapter/__pycache__/` (untracked)

**Step 1: Delete tracked adapter files**

```bash
git rm -r adapter/main.py adapter/Dockerfile adapter/requirements.txt
```

**Step 2: Clean untracked pycache**

```bash
rm -rf adapter/__pycache__
rmdir adapter
```

**Step 3: Commit**

```bash
git add -u
git commit -m "[Agent: Claude] Remove Python adapter — replaced by CSS extensions + Comunica

D1 revised: server-side is all TypeScript now. Python stays as
client-only tooling (vault importer, SHACL dev, RLM agents).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Update docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Replace docker-compose.yml**

Remove adapter and oxigraph services. Add comunica service. New content:

```yaml
services:
  css:
    image: solidproject/community-server:7
    ports:
      - "3000:3000"
    volumes:
      - css-data:/data
      - ./css/config:/config:ro
    command: ["-c", "/config/solid-config.json", "-f", "/data", "-b", "http://localhost:3000"]
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:3000/.well-known/solid"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  comunica:
    image: node:20-slim
    ports:
      - "8080:8080"
    entrypoint: ["npx", "--yes", "@comunica/query-sparql-solid-http"]
    command: ["http://css:3000/", "-p", "8080", "--lenient"]
    depends_on:
      css:
        condition: service_healthy

volumes:
  css-data:
```

**Step 2: Verify YAML syntax**

```bash
docker compose config --quiet
```

Expected: no output (valid YAML)

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "[Agent: Claude] Revise docker-compose: CSS + Comunica sidecar

Two-container stack replacing three. Comunica provides SPARQL
Protocol endpoint over CSS LDP resources. Oxigraph deferred to
Phase 2 (lives in cogitarelink-fabric).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Update pyproject.toml

**Files:**
- Modify: `pyproject.toml`

**Step 1: Remove adapter optional deps, add yaml dep**

New content:

```toml
[project]
name = "cogitarelink-solid"
version = "0.1.0"
description = "Solid Pod as a knowledge fabric node: bridging document and graph access via navigational meta-structure"
readme = "README.md"
license = "Apache-2.0"
requires-python = ">=3.12"
authors = [
    { name = "Charles F. Vardeman II", email = "cvardema@nd.edu" },
]
dependencies = [
    "httpx>=0.28",
    "rdflib>=7.0",
    "pyshacl>=0.31",
    "pyyaml>=6.0",
]

[project.optional-dependencies]
test = [
    "pytest>=9.0",
    "pytest-httpx>=0.35",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
testpaths = ["tests/pytest"]
```

Changes: removed `[project.optional-dependencies] adapter` group. Added `pyyaml` to core deps (vault importer uses it). Added `pytest-httpx` for mocking HTTP calls in tests.

**Step 2: Commit**

```bash
git add pyproject.toml
git commit -m "[Agent: Claude] Update pyproject.toml: drop adapter deps, add pyyaml

Python is client-only now. No FastAPI/uvicorn needed.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Update decisions-index.md

**Files:**
- Modify: `.claude/rules/decisions-index.md`

**Step 1: Revise D1, D4, D19 and add D28**

Replace the full content of decisions-index.md:

```markdown
# SOLID Pod Decisions Index

Always loaded. Concise index of all architectural decisions.

D1: CSS + TypeScript extensions + Comunica sidecar — CSS (TypeScript Pod server, file backend) + CSS extensions (.well-known/ via WaterfallHandler) + Comunica (SPARQL-over-LDP sidecar). Python is client-only: vault importer CLI, SHACL shape development, RLM agents via httpx. Supersedes original "CSS + Python adapter" design.
D2: Pod as fabric node type — Pod participates in fabric via `.well-known/` protocol (same as Oxigraph nodes); not client, not overlay
D3: Comunica for Pod SPARQL — client-side SPARQL federation over LDP resources; no data duplication into triplestore
D4: Oxigraph deferred to Phase 2 — fabric metadata (VoID catalog, SSSOM crosswalks, navigational ontology) lives in cogitarelink-fabric; added to Pod docker-compose when federation across Pod + fabric is tested
D5: Vault-to-Pod as MVP — Agentic Memory Systems concept notes (~20 files); not synthetic data, not full vault
D6: Markdown as primary Pod document format — Markdown with YAML frontmatter (content layer); Turtle for `.meta` sidecars (Layer B); JSON-LD for navigation index (Layer C)
D7: Frontmatter → RDF mapping via SHACL shape — SHACL shape defines predicate vocabulary per note type; default wikilink predicate = `skos:related`; importer reads shape, builds mapping, validates generated Turtle
D8: Solid Type Index as primary machine-actionable navigation — maps RDF class → container URL (coarse discovery)
D9: Dual-index pattern — Type Index (machines) + JSON-LD index (agents) + `.well-known/void` (fabric) + VAULT-INDEX.md (humans) coexist
D10: Three-layer Pod RDF architecture — Layer A: LDP container structure (automatic, CSS-generated); Layer B: resource metadata (Turtle `.meta` sidecars, SHACL-governed); Layer C: navigation indexes (Type Index, JSON-LD, VoID)
D11: Shared SHACL shapes — define in fabric, reference from Shape Trees; also governs frontmatter → RDF mapping (three-way enforcement: import, Pod write, fabric load)
D12: CoreProfile conformance for Pod — Pod declares `dct:conformsTo fabric:CoreProfile, fabric:SolidPodProfile`; CoreProfile is canonical in cogitarelink-fabric (never redefine locally); SolidPodProfile extends it with Pod-specific vocab + guidance
D13: Comunica federation across Pod LDP + Oxigraph SPARQL — unified SPARQL layer; agent reasons about datasets (VoID), not servers
D14: `alsoKnownAs` DID-WebID bridge in first WebID profile — identity bridge as foundation, not add-on (Phase 1)
D15: VoID feature flags — `void:feature` entries distinguish Pod-type nodes (LDP browse) from triplestore-type nodes
D16: OSLC Query 3.0 for Pod search — standard URL parameters on LDP container GET (`oslc.searchTerms`, `oslc.where`, `oslc.select`)
D17: TRS 3.0 for change tracking — standard change data capture drives index sync; replaces filesystem watchers
D18: SQLite FTS5 + sqlite-vec — embedded hybrid search index sidecar; no additional container
D19: CSS extensions as primary integration — Components.js DI config for all Pod customization. Reference implementations: `shape-validator-component` (SHACL on write), `predicate-cardinalities-component` (.well-known/ with VoID). `.well-known/void`, `.well-known/shacl`, `.well-known/sparql-examples` are CSS extension handlers inserted via WaterfallHandler + RouterHandler.
D20: PROV-O provenance on Pod resources — importer-generated in `.meta` sidecars; `prov:wasGeneratedBy`, `prov:wasDerivedFrom`, `prov:wasAttributedTo`; SHACL-validated
D21: Content integrity via `digestMultibase` — SHA-256 hashes in `.meta` sidecars; re-computed on TRS events
D22: `.well-known/sparql-examples` — behavioral SPARQL templates generated from SHACL shapes; `sh:SPARQLExecutable` format
D23: TBox cache in `/ontology/` container — local ontology stubs (SKOS, DC, PROV-O) for offline/constrained query resolution
D24: SSSOM crosswalk generation — wikilink names → Pod URIs, tags → SKOS concepts, frontmatter keys → predicates
D25: VC lifecycle for Pod access — ACP + `acp:vc` matchers; Credo-TS sidecar issues VCs; Phase 3 experiment
D26: LDN inbox multiplexing — type-based dispatch for VC delivery, TRS change, IoT notifications; single `POST /inbox`
D27: Schema-level TRS freshness — re-harvest VoID catalog when Pod data shape changes, not on every resource write
D28: Comunica SPARQL-over-LDP sidecar — `comunica-sparql-http` pointed at CSS, exposes standard SPARQL Protocol endpoint at port 8080. RLM agents query via httpx POST (same `make_fabric_query_tool` pattern from cogitarelink-fabric). VoID feature flag `fabric:LDPBrowse` distinguishes Pod nodes from triplestore nodes (D15). Link traversal discovers resources via Type Index + `ldp:contains`.

Full log: ~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md
Plan: ~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md
```

**Step 2: Commit**

```bash
git add .claude/rules/decisions-index.md
git commit -m "[Agent: Claude] Update decisions: D1, D4, D19 revised + D28 new

D1: CSS + TS extensions + Comunica (was CSS + Python adapter)
D4: Oxigraph deferred to Phase 2 (was in docker-compose)
D19: CSS extensions as primary integration (expanded)
D28: Comunica SPARQL-over-LDP sidecar (new)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update architecture, commands, repo structure sections**

Replace full content:

```markdown
# cogitarelink-solid

Solid Pod as a knowledge fabric node — bridging document access (LDP containers) and
graph access (SPARQL) through a navigational meta-structure at `.well-known/`.

**Vault**: `~/Obsidian/obsidian` — launch with `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`

## Architecture

Two-container stack: CSS (Solid Pod server) + Comunica (SPARQL-over-LDP sidecar).
Python is client-only: vault importer CLI, SHACL development, RLM agent substrate.
Sibling project: `~/dev/git/LA3D/agents/cogitarelink-fabric` (graph-native fabric nodes).
Agent substrate: `~/dev/git/LA3D/agents/rlm` (RLM REPL agents).

See @.claude/rules/decisions-index.md for architectural decisions (D1-D28).
See @.claude/memory/MEMORY.md for experiment state and key patterns.
See @~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md

## Key Commands

```bash
docker compose up -d                                    # start stack (CSS + Comunica)
docker compose logs -f                                  # tail all logs
curl http://localhost:3000/                              # CSS root (Solid Pod)
curl http://localhost:8080/sparql -d "query=SELECT * WHERE { ?s ?p ?o } LIMIT 10"  # Comunica SPARQL
~/uvws/.venv/bin/python -m pytest tests/ -v             # run test suite
~/uvws/.venv/bin/python scripts/vault_import.py         # import vault subset to Pod
uv pip install -e ".[test]"                             # install project in dev mode
```

## Python Environment

Global uv venv at `~/uvws/.venv` — always use this, never create a project-local venv.
Python is client-only (CLI tools + tests). No Python in the server stack.
See @.claude/rules/python-patterns.md for details.

## Repo Structure

```
css/config/      — CSS Components.js configuration (file backend, WAC)
css/extensions/  — TypeScript CSS component package (Phase 2: .well-known/ handlers)
shapes/          — SHACL shapes for Pod content (concept-note, project-note, daily-note)
ontology/        — PROF SolidPodProfile + cached ontology stubs (SKOS, DC, PROV-O)
scripts/         — Python CLI tools (vault importer, SPARQL query)
tests/           — pytest conformance + integration tests
docs/plans/      — Architecture design documents
```

## Rules & Skills

| Rules (always loaded) | Scope |
|---|---|
| `decisions-index.md` | D1-D28 architectural decisions |
| `python-patterns.md` | fastai style, rdflib, httpx, pyshacl (client-only) |
| `typescript-patterns.md` | CSS extensions, Components.js, N3.js, Comunica |
| `rdf-patterns.md` | Turtle, JSON-LD, three-layer Pod RDF |
| `docker-patterns.md` | CSS + Comunica containers |
| `solid-patterns.md` | LDP, WAC, Solid-OIDC, Type Index |

| Skills (on demand) | Trigger |
|---|---|
| Pod discovery | `/pod-discover` |
| Pod init | `/pod-init` |
| Vault import | `/vault-import` |
| Pod validate | `/pod-validate` |
| Pod SPARQL | `/pod-sparql` |
| Pod status | `/pod-status` |
| Decision lookup | `/decision-lookup` |
| SBOM update | `/sbom-update` |

## Git Protocol

Prefix: `[Agent: Claude]`
Co-Author: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
Never force push. Stage specific files.

## Identity

ORCID: https://orcid.org/0000-0003-4091-6059
Notre Dame ROR: https://ror.org/00mkhxb43
CI-Compass ROR: https://ror.org/001zwgm84
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "[Agent: Claude] Update CLAUDE.md for TypeScript-first architecture

Two-container stack (CSS + Comunica). Python is client-only.
Updated commands, repo structure, and rule descriptions.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Update CLAUDE.local.md

**Files:**
- Modify: `CLAUDE.local.md`

**Step 1: Update service URLs**

```markdown
# Local dev overrides — not committed (gitignored)

## Running services
CSS=http://localhost:3000
COMUNICA_SPARQL=http://localhost:8080/sparql

## Local paths
VAULT=~/Obsidian/obsidian
SOLID_REPO=~/dev/git/LA3D/agents/cogitarelink-solid
FABRIC_REPO=~/dev/git/LA3D/agents/cogitarelink-fabric
RLM_REPO=~/dev/git/LA3D/agents/rlm

## Python (global uv venv — use for Claude Code tool invocations)
PYTHON=~/uvws/.venv/bin/python
# Packages: rdflib, pyshacl, owlrl, httpx, pyyaml
# Install project: uv pip install -e ".[test]"
```

**Step 2: Commit**

```bash
git add CLAUDE.local.md
git commit -m "[Agent: Claude] Update CLAUDE.local.md: adapter → Comunica SPARQL

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Update Makefile

**Files:**
- Modify: `Makefile`

**Step 1: Replace Makefile**

```makefile
PYTHON := ~/uvws/.venv/bin/python

.PHONY: up down logs status test import clean install

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

status:
	@echo "=== Docker services ==="
	docker compose ps
	@echo ""
	@echo "=== CSS health ==="
	curl -sf http://localhost:3000/.well-known/solid | $(PYTHON) -m json.tool 2>/dev/null || echo "CSS not responding"
	@echo ""
	@echo "=== Comunica SPARQL ==="
	curl -sf http://localhost:8080/sparql -d "query=SELECT * WHERE {} LIMIT 1" -H "Accept: application/sparql-results+json" 2>/dev/null | head -1 || echo "Comunica not responding"
	@echo ""
	@echo "=== LDP root ==="
	curl -sf http://localhost:3000/ -H "Accept: text/turtle" 2>/dev/null | head -5 || echo "LDP not browsable"

test:
	$(PYTHON) -m pytest tests/ -v

import:
	$(PYTHON) scripts/vault_import.py

install:
	uv pip install -e ".[test]"

clean:
	docker compose down -v
```

**Step 2: Commit**

```bash
git add Makefile
git commit -m "[Agent: Claude] Update Makefile: adapter → Comunica health check

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Update docker-patterns.md rule

**Files:**
- Modify: `.claude/rules/docker-patterns.md`

**Step 1: Replace content**

```markdown
---
paths: ["**/docker-compose*.yml", "**/Dockerfile*"]
---

# Docker Patterns

## Two-service stack (Phase 1)

```yaml
services:
  css:              # Community Solid Server (TypeScript/Node.js)
    image: solidproject/community-server:7
    ports: ["3000:3000"]
    volumes:
      - css-data:/data
      - ./css/config:/config:ro

  comunica:         # SPARQL-over-LDP sidecar (D28)
    image: node:20-slim
    ports: ["8080:8080"]
    entrypoint: ["npx", "--yes", "@comunica/query-sparql-solid-http"]
    command: ["http://css:3000/", "-p", "8080", "--lenient"]
    depends_on: [css]

volumes:
  css-data:
```

Phase 2 adds Oxigraph for fabric metadata federation (D4, D13).

## Port conventions
- 3000: CSS (Community Solid Server)
- 8080: Comunica SPARQL endpoint (was Python adapter)

## CSS container
- Official image: `solidproject/community-server:7`
- Config via `-c /config/solid-config.json`
- File backend via `-f /data`
- Base URL via `-b http://localhost:3000`
- Named volume for `css-data` — not bind mount (macOS permission issues)

## Comunica container
- Uses `node:20-slim` with npx to run `@comunica/query-sparql-solid-http`
- `--lenient` flag: log errors instead of crashing on invalid documents
- Queries CSS over internal Docker network (`http://css:3000/`)
- Exposes standard SPARQL Protocol at `http://localhost:8080/sparql`

## Apple Silicon
- CSS image is multi-arch (no issue)
- node:20-slim is multi-arch (no issue)
- If adding Credo sidecar later: `platform: linux/amd64` required (Askar ARM unavailable)

## Health checks
```yaml
# CSS
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/.well-known/solid"]
  interval: 10s
  timeout: 5s
  retries: 3
```

Comunica has no built-in health check; test via `curl /sparql?query=...`.

## Named volumes
Use named volumes for persistence — not bind mounts.
Bind mounts cause permission issues on macOS Docker Desktop.
Exception: read-only config/shapes/ontology use bind mounts (`:ro`).
```

**Step 2: Commit**

```bash
git add .claude/rules/docker-patterns.md
git commit -m "[Agent: Claude] Update docker-patterns rule: two-service stack

CSS + Comunica sidecar. Removed adapter and Oxigraph references.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Update python-patterns.md rule

**Files:**
- Modify: `.claude/rules/python-patterns.md`

**Step 1: Replace content**

Remove the adapter Docker environment row and FastAPI pattern section. Add Comunica client pattern.

```markdown
---
paths: ["**/*.py"]
---

# Python Patterns

## Environment

Python is client-only — CLI tools, tests, RLM agent integration. No Python in the server stack.

| Context | Python | Key packages |
|---|---|---|
| **Claude Code tool use** | `~/uvws/.venv/bin/python` (3.12) | rdflib, pyshacl, owlrl, httpx, pyyaml |

## Package management — uv

Global venv at `~/uvws/.venv`, managed by `uv`:

```bash
# Install project in dev mode
uv pip install -e ".[test]"

# Add a dependency
uv pip install <package>

# Run tests
~/uvws/.venv/bin/python -m pytest tests/ -v

# Ad-hoc RDF/SPARQL work
~/uvws/.venv/bin/python
```

Always use `~/uvws/.venv/bin/python` for Claude Code tool invocations, not system Python.
Never create a project-local venv — use the global uv workspace.

## Style (fastai philosophy)
- Brevity facilitates reasoning — one concept per screen
- Abbreviations: `g` for graph, `ep` for endpoint, `res` for resource, `ctr` for container
- No comments unless explaining WHY
- No docstrings on internal functions; type hints on public functions only
- No auto-linter formatting; maintain intentional style

## RDF — rdflib 7.x

```python
from rdflib import Graph, Dataset, Namespace, URIRef, Literal
from rdflib.namespace import RDF, RDFS, SKOS, PROV, DCAT, DCTERMS, FOAF

# Parse Turtle / JSON-LD
g = Graph()
g.parse("resource.ttl", format="turtle")
g.parse("index.jsonld", format="json-ld")

# Serialize
g.serialize("out.ttl", format="turtle")
g.serialize("out.jsonld", format="json-ld")
```

## HTTP — httpx

```python
import httpx

# Sync for RLM sandbox tools (dspy.RLM requires sync)
def sparql_query(query: str, endpoint: str = "http://localhost:8080/sparql") -> str:
    r = httpx.post(endpoint, data={"query": query},
                   headers={"Accept": "application/sparql-results+json"},
                   timeout=30.0)
    r.raise_for_status()
    return r.text

# Async for CLI tools and tests
async with httpx.AsyncClient(base_url="http://localhost:3000") as client:
    # LDP container listing
    r = await client.get("/vault/concepts/",
                         headers={"Accept": "text/turtle"})
    # Create resource (LDP POST)
    r = await client.post("/vault/concepts/",
                          content=turtle_bytes,
                          headers={"Content-Type": "text/turtle",
                                   "Slug": "context-graphs"})
```

## SHACL Validation — pyshacl

```python
from pyshacl import validate

conforms, report_g, report_text = validate(
    data_graph=data_g,
    shacl_graph=shapes_g,
    inference="rdfs",
    advanced=True,
)
```

## RLM Agent Tool Pattern (from cogitarelink-fabric)

```python
def make_pod_query_tool(ep, max_chars=10_000):
    """Closure bound to a discovered endpoint — same pattern as fabric."""
    def sparql_query(query: str) -> str:
        r = httpx.post(ep.sparql_url, data={"query": query},
                       headers={"Accept": "application/sparql-results+json"},
                       timeout=30.0)
        r.raise_for_status()
        txt = r.text
        if len(txt) > max_chars:
            return txt[:max_chars] + f"\n... truncated ({len(txt)} total chars)."
        return txt
    return sparql_query
```

## Async-first (for CLI tools)

All IO in CLI tools: async/await. Use `asyncio.gather` for parallel requests.
No blocking calls in async context.
Exception: RLM sandbox tools must be sync (dspy.RLM limitation).

## Error handling

Raise specific exceptions at system boundaries. Don't catch-all internally.
RLM tools return error strings (not exceptions) so the agent can reason about failures.
```

**Step 2: Commit**

```bash
git add .claude/rules/python-patterns.md
git commit -m "[Agent: Claude] Update python-patterns: client-only, add Comunica/RLM patterns

Removed adapter Docker env and FastAPI patterns. Added SPARQL
client pattern, RLM tool factory pattern from cogitarelink-fabric.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Update typescript-patterns.md rule

**Files:**
- Modify: `.claude/rules/typescript-patterns.md`

**Step 1: Expand with CSS extension details and JS RDF ecosystem**

```markdown
---
paths: ["**/*.ts", "**/*.js", "**/*.json"]
---

# TypeScript Patterns

## CSS Extension Architecture (D19)

Community Solid Server uses Components.js (JSON-LD dependency injection).
Extensions are **configuration-level** — no CSS fork required.

### Extension template

Follow the [hello-world-component](https://github.com/CommunitySolidServer/hello-world-component) pattern:

```
css/extensions/
  package.json        — Components.js component metadata + lsd:* fields
  tsconfig.json       — TypeScript config (strict, ESM)
  src/
    index.ts          — Re-export all handler classes
    VoidHandler.ts    — .well-known/void endpoint
    ShaclHandler.ts   — .well-known/shacl endpoint
  config/
    void.json         — Components.js wiring for VoidHandler
    shacl.json        — Components.js wiring for ShaclHandler
```

### Key CSS extension points
- `WaterfallHandler`: HTTP request routing — insert custom handlers before LdpHandler
- `RouterHandler`: Match routes by regex (`allowedPathNames: ["/\\.well-known/void"]`)
- `MonitoringStore`: Intercepts resource CRUD — emits AS.Create/Update/Delete events (D17)
- `StorageDescriptionHandler`: Reference pattern for `.well-known/` endpoints

### WaterfallHandler insertion (Components.js)

```json
{
  "@type": "Override",
  "overrideInstance": { "@id": "urn:solid-server:default:BaseHttpHandler" },
  "overrideSteps": [{
    "@type": "OverrideListInsertAfter",
    "overrideParameter": { "@id": "BaseHttpHandler:_handlers" },
    "overrideTarget": { "@id": "urn:solid-server:default:StorageDescriptionHandler" },
    "overrideValue": { "@id": "urn:cogitarelink:VoidHandler" }
  }]
}
```

### Reference implementations
- [shape-validator-component](https://github.com/CommunitySolidServer/shape-validator-component) — SHACL validation on Pod writes
- [predicate-cardinalities-component](https://github.com/CommunitySolidServer/predicate-cardinalities-component) — `.well-known/` with VoID vocabulary

## Comunica (D3, D13, D28)

SPARQL federation over Solid LDP resources.

Key packages:
- `@comunica/query-sparql` — core SPARQL engine
- `@comunica/query-sparql-solid` — Solid auth support
- `@comunica/query-sparql-link-traversal-solid` — link traversal (experimental)

CLI SPARQL endpoint:
```bash
npx @comunica/query-sparql-solid-http http://localhost:3000/ -p 8080 --lenient
```

Programmatic:
```typescript
import { QueryEngine } from '@comunica/query-sparql-solid';
const engine = new QueryEngine();
const bindings = await engine.queryBindings(query, {
  sources: ['http://localhost:3000/'],
  lenient: true,
});
```

## JavaScript RDF Ecosystem

| Package | Purpose | npm |
|---------|---------|-----|
| N3.js v2 | RDF parsing/serialization, in-memory store | `n3` |
| shacl-engine | Fast SHACL Core validation (no SHACL-AF) | `shacl-engine` |
| rdf-validate-shacl | SHACL validation (Zazuko) | `rdf-validate-shacl` |
| @inrupt/solid-client | Solid data access, WAC, ACP | `@inrupt/solid-client` |
| @inrupt/solid-client-authn-node | Solid-OIDC auth for Node.js | `@inrupt/solid-client-authn-node` |

## CSS Config Files

- Base configs at `@css:config/*.json` (imported, not copied)
- Override specific components by re-declaring their `@id`
- File backend: `@css:config/file.json`
- In-memory: `@css:config/default.json`

## Node.js Conventions

- CSS requires Node.js 18+ (recommend 20 LTS)
- TypeScript strict mode
- ESM modules (`"type": "module"` in package.json)
- CSS v7.x is latest stable
```

**Step 2: Commit**

```bash
git add .claude/rules/typescript-patterns.md
git commit -m "[Agent: Claude] Expand typescript-patterns: CSS extensions, Comunica, JS RDF

Added extension template, WaterfallHandler insertion pattern,
reference implementations, Comunica usage, JS RDF ecosystem.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Update test fixtures

**Files:**
- Modify: `tests/pytest/conftest.py`

**Step 1: Replace fixtures to match new stack**

```python
"""Shared fixtures for cogitarelink-solid tests."""
import pytest


@pytest.fixture
def css_url():
    """Base URL for Community Solid Server (local dev)."""
    return "http://localhost:3000"


@pytest.fixture
def comunica_url():
    """Base URL for Comunica SPARQL endpoint (local dev)."""
    return "http://localhost:8080"


@pytest.fixture
def sparql_url(comunica_url):
    """SPARQL Protocol endpoint URL."""
    return f"{comunica_url}/sparql"
```

**Step 2: Commit**

```bash
git add tests/pytest/conftest.py
git commit -m "[Agent: Claude] Update test fixtures: adapter → Comunica SPARQL

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: Update MEMORY.md

**Files:**
- Modify: `.claude/memory/MEMORY.md`

**Step 1: Replace content**

```markdown
# cogitarelink-solid — Session Memory

## Project State (as of 2026-02-28)

**Repo**: `~/dev/git/LA3D/agents/cogitarelink-solid`
**Branch**: main
**Status**: Architecture restructured — TypeScript-first stack

## Completed Work

- [x] Claude Code scaffold: CLAUDE.md, settings.json, rules (6), skills (8), memory
- [x] Initial scaffold: pyproject.toml, docker-compose.yml, adapter, CSS config
- [x] Architecture restructure: removed Python adapter, added Comunica sidecar (D1 revised, D28 new)
- [ ] Phase 1 implementation: CSS up + vault importer + LDP verification

## Key Architecture Patterns

- **TypeScript-first server** (D1 revised): CSS + TypeScript extensions + Comunica sidecar. Python is client-only.
- **Three-layer Pod RDF** (D10): Content (Markdown) + Layer A (LDP) + Layer B (Turtle .meta) + Layer C (navigation indexes)
- **Frontmatter → RDF via SHACL** (D7): Shape defines predicate vocabulary; importer reads shape, maps YAML keys to predicates, validates output
- **Dual-index navigation** (D9): Type Index (machines) + JSON-LD (agents) + VoID (fabric) + VAULT-INDEX.md (humans)
- **Comunica for SPARQL** (D3, D28): SPARQL Protocol sidecar over LDP. Link traversal discovers resources via Type Index + ldp:contains.
- **RLM agent integration**: Same `make_fabric_query_tool` pattern from cogitarelink-fabric. Agent sends SPARQL, gets JSON — doesn't know it's LDP underneath.
- **Oxigraph deferred** (D4 revised): Fabric metadata lives in cogitarelink-fabric. Added to Pod stack in Phase 2 for federation.

## Phase Map

| Phase | Timeline | Features | Status |
|---|---|---|---|
| Phase 1 | Weeks 1-4 | CSS Docker + vault importer + LDP verification | In progress |
| Phase 2 | Weeks 5-8 | CSS extensions (.well-known/), Comunica federation, Oxigraph | Not started |
| Phase 2b | Weeks 7-8 | OSLC Query + TRS (CSS extensions) | Not started |
| Phase 2c | Weeks 8-9 | Provenance, integrity, SPARQL examples | Not started |
| Phase 3 | Weeks 9-10 | Agent navigation experiments (RLM → Comunica → Pod) | Not started |

## Key Files

| File | Purpose |
|---|---|
| `css/config/solid-config.json` | CSS Components.js configuration |
| `shapes/concept-note.ttl` | SHACL shape for concept notes |
| `ontology/solid-pod-profile.ttl` | PROF SolidPodProfile |
| `scripts/vault_import.py` | Vault-to-Pod importer CLI (Python) |
| `docker-compose.yml` | CSS + Comunica stack |
| `docs/plans/` | Architecture design documents |

## Sibling Projects

- `~/dev/git/LA3D/agents/cogitarelink-fabric` — graph-native fabric nodes (Oxigraph + FastAPI + Credo)
- `~/dev/git/LA3D/agents/rlm` — RLM agent substrate (dspy.RLM)

## Key Research Findings (2026-02-28)

- CSS has existing extension components: shape-validator (SHACL on write), predicate-cardinalities (.well-known/ + VoID)
- Comunica v5 supports SPARQL 1.2, link traversal over Solid Pods, Solid-OIDC auth
- shacl-engine (JS) covers SHACL Core but not SHACL-AF — keep pyshacl for shape development
- cogitarelink-fabric `fabric_agent.py` pattern works unchanged for Pod: discover_endpoint() → make_fabric_query_tool() → dspy.RLM
- JS RLM (hampton-io/RLM) is not viable — 2 stars, not on npm, likely AI-generated

## Open Questions

- Comunica performance over 20+ LDP resources — when does a local index become necessary?
- PARA → LDP container mapping — encode PARA semantics in RDF or rely on container hierarchy?
- Comunica docker image: use `node:20-slim` + npx, or build custom image with pre-installed packages?

## Vault Planning Docs

- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration.md` — main project note
- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md` — 10-week plan
- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md` — D1-D28 full log
- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Fabric-Pod Synergy - Unified Design Thesis.md` — synergy points S1-S8
```

**Step 2: Commit**

```bash
git add .claude/memory/MEMORY.md
git commit -m "[Agent: Claude] Update MEMORY.md: TypeScript-first architecture state

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 13: Update skills that reference adapter

**Files:**
- Modify: `.claude/skills/pod-status.md`
- Modify: `.claude/skills/pod-init.md`
- Modify: `.claude/skills/pod-sparql.md`
- Modify: `.claude/skills/sbom-update.md`

**Step 1: Update pod-status.md**

Replace references to adapter and oxigraph with Comunica:

```markdown
# /pod-status

Health check: verify all services are running and Pod is functional.

## Usage
```
/pod-status
```

## Steps

1. **Docker services**:
   ```bash
   docker compose ps
   ```
   Verify: css (healthy), comunica (running)

2. **CSS health**:
   ```bash
   curl -s http://localhost:3000/.well-known/solid
   ```
   Expected: JSON with server metadata

3. **Comunica SPARQL**:
   ```bash
   curl -s http://localhost:8080/sparql -d "query=SELECT * WHERE {} LIMIT 1" -H "Accept: application/sparql-results+json"
   ```
   Expected: SPARQL results JSON

4. **LDP browsability**:
   ```bash
   curl -s http://localhost:3000/ -H "Accept: text/turtle"
   ```
   Expected: Turtle with root container description

5. Report: service status table, any issues found
```

**Step 2: Update pod-init.md**

```markdown
# /pod-init

Scaffold a new Pod configuration: CSS config, docker-compose service, shared artifacts.

## Usage
```
/pod-init [--port <css-port>] [--sparql-port <comunica-port>]
```
Example: `/pod-init --port 3000 --sparql-port 8080`

## Steps

1. **CSS configuration** (`css/config/`):
   - `solid-config.json` — Components.js config importing `@css:config/file.json`
   - File backend, WAC authorization, dev token provider
   - Storage path: `/data`

2. **docker-compose.yml** entry:
   - CSS service (image, ports, volumes, healthcheck)
   - Comunica service (node:20-slim, npx @comunica/query-sparql-solid-http, depends_on CSS)
   - Named volumes for persistence

3. **Shared artifacts**:
   - `shapes/concept-note.ttl` — initial SHACL shape
   - `ontology/solid-pod-profile.ttl` — PROF SolidPodProfile

4. Report: files created + next steps (docker compose up, verify health, import vault)
```

**Step 3: Update pod-sparql.md**

```markdown
# /pod-sparql

Execute SPARQL queries over Pod LDP resources via Comunica sidecar.

## Usage
```
/pod-sparql <query> [--endpoint <sparql-url>]
```
Example: `/pod-sparql "SELECT ?concept WHERE { ?concept a skos:Concept }" --endpoint http://localhost:8080/sparql`

## Steps

1. **Determine endpoint**:
   - Default: `http://localhost:8080/sparql` (Comunica over CSS LDP)
   - Override with `--endpoint` for remote or federated queries

2. **Execute query**:
   ```bash
   curl -s http://localhost:8080/sparql \
     -d "query=<SPARQL>" \
     -H "Accept: application/sparql-results+json"
   ```
   Or via Python:
   ```python
   import httpx
   r = httpx.post("http://localhost:8080/sparql",
                   data={"query": query},
                   headers={"Accept": "application/sparql-results+json"})
   ```

3. **Format results**:
   - SELECT → table format
   - CONSTRUCT → Turtle output
   - ASK → boolean

4. **Common queries** (from `.well-known/sparql-examples`):
   - List all concepts: `SELECT ?c ?label WHERE { ?c a skos:Concept ; skos:prefLabel ?label }`
   - Find by tag: `SELECT ?c WHERE { ?c dct:subject "tag-name" }`
   - Find related: `SELECT ?related WHERE { <iri> skos:related ?related }`
   - Navigate PARA: `SELECT ?child WHERE { ?child dct:isPartOf <container-iri> }`
```

**Step 4: Update sbom-update.md**

```markdown
# /sbom-update

Generate or update SPDX 3.0 Software Bill of Materials for the project.

## Usage
```
/sbom-update
```

## Steps

1. **Scan dependencies**:
   - Python: parse `pyproject.toml`
   - Docker: parse `docker-compose.yml` for container images (CSS, node:20-slim)
   - CSS extensions (Phase 2): parse any `package.json` for Node.js dependencies

2. **Generate SPDX 3.0 SBOM**:
   - Create `provenance/sbom.spdx.json`
   - Include all direct dependencies with versions
   - Include container image references
   - Add creator info (ORCID, agent DID if available)

3. **Update codemeta.json**:
   - Sync dependency list
   - Update version if changed

4. **PROV-O activity record**:
   - Record SBOM generation as `prov:Activity`
   - Link to `prov:wasAssociatedWith` (Claude Code agent)

5. Report: dependencies counted, any new/changed/removed deps
```

**Step 5: Commit all skill updates**

```bash
git add .claude/skills/pod-status.md .claude/skills/pod-init.md .claude/skills/pod-sparql.md .claude/skills/sbom-update.md
git commit -m "[Agent: Claude] Update skills: adapter references → Comunica SPARQL

pod-status, pod-init, pod-sparql, sbom-update all updated for
TypeScript-first stack with Comunica sidecar.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 14: Update rdf-patterns.md

**Files:**
- Modify: `.claude/rules/rdf-patterns.md`

**Step 1: Update Layer C author and named graph section**

In the Three-Layer table, change Layer C author from "Vault importer + adapter" to "Vault importer + CSS extensions":

Change line: `| C | Navigation indexes (Type Index, JSON-LD, VoID) | Vault importer + adapter | Turtle / JSON-LD |`
To: `| C | Navigation indexes (Type Index, JSON-LD, VoID) | Vault importer + CSS extensions | Turtle / JSON-LD |`

In the Named Graph Conventions section header, clarify Oxigraph is Phase 2:

Change: `## Named Graph Conventions (Oxigraph fabric metadata, D4)`
To: `## Named Graph Conventions (Oxigraph fabric metadata, D4 — Phase 2)`

**Step 2: Commit**

```bash
git add .claude/rules/rdf-patterns.md
git commit -m "[Agent: Claude] Update rdf-patterns: Layer C author, Oxigraph phase note

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 15: Update solid-patterns.md

**Files:**
- Modify: `.claude/rules/solid-patterns.md`

**Step 1: Update .well-known/ section**

Change the `.well-known/ Protocol` section comment to reference CSS extensions instead of adapter:

Change line: `- `/.well-known/void` — VoID dataset description (L1)`
To: `- `/.well-known/void` — VoID dataset description (CSS extension, Phase 2)`

Change: `- `/.well-known/shacl` — SHACL shapes for Pod content (L3)`
To: `- `/.well-known/shacl` — SHACL shapes for Pod content (CSS extension, Phase 2)`

Change: `- `/.well-known/sparql-examples` — behavioral SPARQL templates (L4)`
To: `- `/.well-known/sparql-examples` — behavioral SPARQL templates (CSS extension, Phase 2)`

**Step 2: Commit**

```bash
git add .claude/rules/solid-patterns.md
git commit -m "[Agent: Claude] Update solid-patterns: .well-known/ served by CSS extensions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 16: Update .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Add TypeScript build artifacts for future CSS extensions**

Add after the Node.js section:

```
# TypeScript build
dist/
*.js.map
*.d.ts
!css/extensions/src/**/*.d.ts
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "[Agent: Claude] Update .gitignore: add TypeScript build artifacts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 17: Verify clean state

**Step 1: Run git status**

```bash
git status
```

Expected: clean working tree, no untracked files (except `adapter/__pycache__` which was cleaned in Task 1).

**Step 2: Run git log to verify all commits**

```bash
git log --oneline -20
```

Expected: ~12 new commits since the design doc, all with `[Agent: Claude]` prefix.

**Step 3: Verify docker-compose syntax**

```bash
docker compose config --quiet
```

Expected: no output (valid).

**Step 4: Verify pyproject.toml installs**

```bash
~/uvws/.venv/bin/python -c "import tomllib; print(tomllib.load(open('pyproject.toml','rb'))['project']['name'])"
```

Expected: `cogitarelink-solid`

---

## Summary

| Task | What | Commit message prefix |
|------|------|-----------------------|
| 1 | Delete adapter/ directory | Remove Python adapter |
| 2 | Rewrite docker-compose.yml | Revise docker-compose |
| 3 | Update pyproject.toml | Update pyproject.toml |
| 4 | Update decisions-index.md | Update decisions |
| 5 | Update CLAUDE.md | Update CLAUDE.md |
| 6 | Update CLAUDE.local.md | Update CLAUDE.local.md |
| 7 | Update Makefile | Update Makefile |
| 8 | Update docker-patterns.md | Update docker-patterns |
| 9 | Update python-patterns.md | Update python-patterns |
| 10 | Update typescript-patterns.md | Expand typescript-patterns |
| 11 | Update test fixtures | Update test fixtures |
| 12 | Update MEMORY.md | Update MEMORY.md |
| 13 | Update 4 skills | Update skills |
| 14 | Update rdf-patterns.md | Update rdf-patterns |
| 15 | Update solid-patterns.md | Update solid-patterns |
| 16 | Update .gitignore | Update .gitignore |
| 17 | Verify clean state | (no commit) |
