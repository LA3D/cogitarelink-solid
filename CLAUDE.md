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
