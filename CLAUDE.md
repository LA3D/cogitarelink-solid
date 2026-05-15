# cogitarelink-solid

Solid Pod as a general-purpose memory substrate for agentic applications.
Built from first principles on W3C web standards (LDP, RDF, SHACL, Memento, LDN,
Solid Notifications) which happen to align with the patterns that
[[Karpathy LLM Wiki|wiki-memory]], [[ByteRover]], [[AKBP]], [[Supermemory]] and
others arrive at empirically.

**Three layers** (stratification matters — see [[Memory Substrate vs Memory Profile]]):
- **L1 — Pod substrate**: LDP / WAC / SPARQL / Memento / `.well-known/` (universal)
- **L2 — Memory substrate**: seven invariants (bounded branching, tiered retrieval,
  lifecycle metadata, explicit write + implicit signals, hybrid blob+graph storage,
  separable procedural memory, OOD honesty)
- **L3 — Memory profile**: wiki-memory is the canonical reference profile.
  Vault PARA+SKOS is one application of the wiki-memory L3.

**Dual-layer linking** is the architectural commitment that distinguishes this work:
markdown wikilinks at the token layer (cheap for LLMs to read, low-ceremony to write) +
RDF predicates in `.meta` at the data layer (queryable, validatable). Unified by D58's
body-affordance projection: agent writes typed wikilinks; substrate generates Turtle.

**Vault**: `~/Obsidian/obsidian` — launch with `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`

## Architecture

Two-container stack: CSS (Solid Pod server) + Comunica (SPARQL-over-LDP sidecar).
Python is client-only: vault importer CLI, SHACL development, RLM agent substrate.

Build order (current direction): build the wiki-memory L3 reference Pod first;
vault import becomes a use case of the wiki-memory L3, not the project's MVP.

Sibling repos under `~/dev/git/LA3D/agents/`:
- `solid-agent-skills` — General-purpose Solid Pod CLI + skills (D29). Phase 2 shipped.
- `cogitarelink-fabric` — Graph-native fabric nodes (Oxigraph + FastAPI + Credo)
- `rlm` — RLM agent substrate (dspy.RLM)

See @.claude/rules/decisions-index.md for architectural decisions (D1-D77).
See @.claude/memory/MEMORY.md for experiment state, active plan, and key patterns.
See @~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Unified Externalization Prototype Plan.md (active plan)
See @~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md (phase plan)
See @~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md (canonical decisions log)

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
| `decisions-index.md` | D1-D77 + K1 architectural decisions; D5/D32 superseded by D70-D74 wiki-memory L3 framing; D37 revised by D75 (RDFa dropped); D75-D77 specify L3 reference profile (vault is canonical) |
| `python-patterns.md` | fastai style, rdflib, httpx, pyshacl (client-only) |
| `typescript-patterns.md` | CSS extensions, Components.js, N3.js, Comunica |
| `rdf-patterns.md` | Turtle, JSON-LD, three-layer Pod RDF |
| `docker-patterns.md` | CSS + Comunica containers |
| `solid-patterns.md` | LDP, WAC, Solid-OIDC, Type Index |

| Operational skills (on demand) | Trigger |
|---|---|
| Pod discovery | `/pod-discover` |
| Pod init | `/pod-init` |
| Vault import | `/vault-import` |
| Pod validate | `/pod-validate` |
| Pod SPARQL | `/pod-sparql` |
| Pod status | `/pod-status` |
| Decision lookup | `/decision-lookup` |
| SBOM update | `/sbom-update` |

| Builder skills (on demand) | Trigger |
|---|---|
| Scaffold a CSS v8 extension | `/css-extension` |
| Components.js Override patterns | `/components-override` |
| MetadataWriter composition | `/metadata-writer` |
| MonitoringStore CDC (D17) | `/monitoring-store` |
| Comunica explicit-source queries | `/comunica-sources` |
| SHACL shape design for Pod content | `/shacl-shapes` |
| Solid Protocol reference (vendored upstream) | `/solid-spec` |
| Solid client integration (`@inrupt/solid-client`, harness skills) | `/solid-integration` |

Upstream Solid documentation is vendored at `vendor/solid-llm-skills/` (synced from `solid/solid-llm-skills` commit `9a1cab17`, 2026-05-14). See `vendor/solid-llm-skills/README.md` for resync instructions.

## Git Protocol

Prefix: `[Agent: Claude]`
Co-Author: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
Never force push. Stage specific files.

## Identity

ORCID: https://orcid.org/0000-0003-4091-6059
Notre Dame ROR: https://ror.org/00mkhxb43
CI-Compass ROR: https://ror.org/001zwgm84
