# TypeScript-First Pod Architecture

**Date**: 2026-02-28
**Status**: Approved
**Supersedes**: Original D1 (CSS + Python adapter)

## Problem

The original architecture (D1) used a Python FastAPI adapter container as the server-side gateway for `.well-known/` endpoints, LDP proxying, and fabric integration. This mixed Python and TypeScript in the server stack despite CSS already being TypeScript. The Python adapter:

- Added a third container and second language runtime to the server
- Duplicated functionality CSS can provide natively via extensions
- Created an extra HTTP hop between agents and the Pod
- Missed the opportunity to use Comunica (TypeScript) for SPARQL federation

Meanwhile, the cogitarelink-fabric repo already demonstrates that RLM agents talk to fabric nodes via standard SPARQL Protocol over HTTP. The agent doesn't care what language the server is — it sends SPARQL, gets JSON back.

## Decision

Replace the Python adapter with CSS TypeScript extensions + a Comunica SPARQL sidecar. Python stays as client-side tooling only (vault importer, SHACL development, RLM agent substrate).

## Architecture

```
┌─────────────────────────────────┐
│  CSS (TypeScript)               │
│  ├─ LDP containers              │
│  ├─ .well-known/void extension  │
│  ├─ .well-known/shacl extension │
│  ├─ .well-known/sparql-examples │
│  ├─ Solid-OIDC                  │
│  └─ MonitoringStore events      │
└──────────┬──────────────────────┘
           │ HTTP/LDP (internal network)
           │
┌──────────┴──────────────────────┐
│  Comunica (Node.js sidecar)     │
│  ├─ SPARQL Protocol at /sparql  │
│  ├─ Link traversal over LDP    │
│  └─ Type Index discovery        │
└──────────┬──────────────────────┘
           │ HTTP (SPARQL Protocol)
     ┌─────┴─────┐
     │           │
 RLM agents   Python CLI tools
 (dspy.RLM)   (vault_import.py)
 via httpx     via httpx
```

### Docker Compose (Phase 1)

```yaml
services:
  css:
    image: solidproject/community-server:7
    ports: ["3000:3000"]
    volumes:
      - css-data:/data
      - ./css/config:/config:ro
    command: ["-c", "/config/solid-config.json", "-f", "/data", "-b", "http://localhost:3000"]

  comunica:
    image: node:20-slim
    ports: ["8080:8080"]
    command: ["npx", "@comunica/query-sparql-solid-http", "http://css:3000/", "-p", "8080", "--lenient"]
    depends_on:
      css:
        condition: service_healthy
```

Oxigraph returns in Phase 2 when fabric metadata (VoID catalog, SSSOM crosswalks) is needed.

### Port Assignments

| Port | Service |
|------|---------|
| 3000 | CSS (Solid Pod server) |
| 8080 | Comunica (SPARQL endpoint over LDP) |

### Agent Integration Pattern

Identical to cogitarelink-fabric's `make_fabric_query_tool`:

```python
def make_pod_query_tool(ep, max_chars=10_000):
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

The `discover_endpoint()` function works unchanged — `.well-known/void`, `.well-known/shacl`, `.well-known/sparql-examples` are served by CSS extensions instead of the Python adapter, but the HTTP interface is identical.

## Decision Changes

### D1 (revised): CSS + TypeScript extensions + Comunica sidecar

CSS (TypeScript Pod server, file backend) + CSS extensions (.well-known/ endpoints via WaterfallHandler) + Comunica sidecar (SPARQL-over-LDP). Python is client-only: vault importer CLI, SHACL shape development, RLM agents via httpx.

### D4 (revised): Oxigraph deferred to Phase 2

Oxigraph stays in cogitarelink-fabric for fabric metadata (VoID catalog, SSSOM crosswalks). Not needed for Phase 1 Pod work. Added to docker-compose in Phase 2 when federation across Pod + fabric is tested.

### D19 (expanded): CSS extensions as primary integration

CSS extensions via Components.js DI are now the primary mechanism for Pod customization. Reference implementations: `shape-validator-component` (SHACL on write), `predicate-cardinalities-component` (.well-known/ with VoID). `.well-known/void`, `.well-known/shacl`, `.well-known/sparql-examples` are all CSS extension handlers.

### D28 (new): Comunica SPARQL-over-LDP sidecar

Comunica exposes standard SPARQL Protocol endpoint over CSS's LDP resources. Uses link traversal to discover resources via Type Index and `ldp:contains`. RLM agents query via httpx POST (same pattern as cogitarelink-fabric). VoID feature flag `fabric:LDPBrowse` distinguishes Pod nodes from triplestore nodes (D15).

## Repo Structure

```
css/
  config/             — CSS Components.js configuration
  extensions/         — TypeScript CSS component package (Phase 2)
    package.json      — Components.js component metadata
    src/              — TypeScript handlers (.well-known/*)
    config/           — JSON-LD config fragments
shapes/               — SHACL shapes for Pod content
ontology/             — PROF SolidPodProfile + cached ontology stubs
scripts/              — Python CLI tools (vault importer, SPARQL query)
tests/                — pytest integration tests (against CSS + Comunica)
provenance/           — PROV-O templates (D20)
docs/plans/           — Design documents
```

## What Gets Removed

- `adapter/` directory (main.py, Dockerfile, requirements.txt) — replaced by CSS extensions
- `pyproject.toml` adapter optional dependency group
- Oxigraph from docker-compose (Phase 1)

## Language Responsibilities

| Layer | Language | Packages |
|-------|----------|----------|
| Pod server | TypeScript | CSS, Components.js |
| .well-known/ | TypeScript | CSS extension (WaterfallHandler) |
| SPARQL federation | TypeScript | Comunica (@comunica/query-sparql-solid) |
| SHACL on write | TypeScript | shape-validator-component or shacl-engine |
| Vault importer | Python | rdflib, pyshacl, httpx |
| SHACL dev/test | Python | pyshacl (SHACL-AF support) |
| RLM agents | Python | dspy, httpx (SPARQL Protocol client) |
| Ad-hoc RDF | Python | rdflib, rdflib SPARQLStore |

## Phase Impact

| Phase | Change |
|-------|--------|
| Phase 1 | CSS + Comunica only. Vault importer POSTs to CSS. No adapter. |
| Phase 2 | Add CSS .well-known/ extensions (TypeScript). Add Oxigraph for fabric metadata. |
| Phase 2b | OSLC Query as CSS extension (was planned for adapter). |
| Phase 3 | RLM agents query Comunica SPARQL — identical to fabric pattern. |
