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

Single-container stack: CSS (Solid Pod server). The Pod hosts no SPARQL endpoint —
SPARQL is a client concern. Comunica wiring lives in the sibling `solid-agent-skills`
repo as an embedded TypeScript library (per D3, D29); affordance descriptors declare
which capability an agent needs and quote the query, but execution happens in the
agent's own engine.

Python is client-only: vault importer CLI, SHACL development, RLM agent substrate.

Build order (current direction): build the wiki-memory L3 reference Pod first;
vault import becomes a use case of the wiki-memory L3, not the project's MVP.

Sibling repos under `~/dev/git/LA3D/agents/`:
- `solid-agent-skills` — General-purpose Solid Pod CLI + skills (D29). Phase 2 shipped.
- `cogitarelink-fabric` — Graph-native fabric nodes (Oxigraph + FastAPI + Credo)
- `rlm` — RLM agent substrate (dspy.RLM)

See @.claude/rules/decisions-index.md for architectural decisions (D1-D81).
See @.claude/memory/MEMORY.md for experiment state, active plan, and key patterns.
See @~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Unified Externalization Prototype Plan.md (active plan)
See @~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md (phase plan)
See @~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md (canonical decisions log)

## Key Commands

```bash
docker compose up -d                                    # start stack (CSS only)
docker compose logs -f                                  # tail all logs
curl http://localhost:3000/                              # CSS root (Solid Pod)
# SPARQL runs client-side in solid-agent-skills:
#   (cd ../solid-agent-skills && node dist/cli.js sparql <url> "SELECT ...")
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
css/extensions/
  markdown-render/          — (renamed from markdown-rdfa) rehype-based markdown→HTML; wikilinks.css (D75)
  markdown-projection/      — body wikilinks → .meta projection via MonitoringStore listener (D58/D71/D81)
  memento/                  — RFC 7089 Memento support (MementoCommitListener + TimeGate + TimeMap)
  shared/markdown-parsing/  — wikilinks, predicates, resolver modules (reused by renderer + projection)
shapes/
  wiki-memory-l3/           — 6 SHACL shapes: resource + concept + source + person + procedure + working (D77/D78)
  *.ttl                     — legacy shapes (concept-note, project-note, daily-note)
ontology/        — PROF SolidPodProfile + cached ontology stubs (SKOS, DC, PROV-O)
scripts/         — Python CLI tools (vault importer, SPARQL query)
tests/           — pytest conformance + integration tests
docs/plans/      — Architecture design documents
```

## Rules & Skills

| Rules (always loaded) | Scope |
|---|---|
| `decisions-index.md` | D1-D86 + K1-K3 architectural decisions; D5/D32 superseded by D70-D74; D37 revised by D75; D71/D77 revised by D78-D80; D81 Model A predicate governance; D83 Pod-as-toolkit + capability catalog; D84/D85/D86 URI conformance + TLS + PROF-based resource-kind hints; K2/K3 implementation notes |
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

| Solid spec & integration skills (Claude-invokable; `.claude/skills/<name>/SKILL.md`) | Topic |
|---|---|
| `solid-spec` | Solid Protocol, WebID Profile, Solid-OIDC, ACP, WAC (upstream-derived) |
| `solid-servers` | CSS, Pivot, public servers, Docker, CLI (upstream-derived) |
| `solid-data-modelling` | Vocabularies, SHACL conventions, Type Index (upstream-derived) |
| `solid-integration-guide` | Inrupt SDK, solid-client-authn, LDO, N3.js, Bashlib (upstream-derived) |
| `solid-spec-documents` | Canonical index of Solid specs with version pins (upstream-derived) |
| `solid-memento` | Memento (RFC 7089) + tombstones (D61-D68, K1) |
| `solid-affordance-descriptors` | Body-affordance descriptor architecture (D52, D55, D58) |
| `solid-wiki-memory-l3` | Wiki-memory L3 reference profile (D70-D81, K2-K3) |
| `solid-storage-description` | Storage description as router (D44, D48, D49) |
| `solid-uri-conformance` | URI conformance + TLS + PROF-based resource-kind hints (D84, D85, D86; closes RQ-Substrate-3) |

| Builder skills (Claude-invokable; `.claude/skills/<name>/SKILL.md`) | Topic |
|---|---|
| `css-extension` | Scaffold a new CSS v8 extension |
| `components-override` | Components.js Override patterns |
| `metadata-writer` | MetadataWriter composition (additive Link/Vary headers) |
| `monitoring-store` | MonitoringStore CDC (D17 + D65) |
| `comunica-sources` | Comunica explicit-source SPARQL queries |
| `shacl-shapes` | SHACL shape design conventions |

Upstream solid/solid-llm-skills content lives in `.claude/skills/solid-{spec,servers,data-modelling,integration-guide,spec-documents}/references/spec.md`, synced via `scripts/sync_solid_skills.py`.

## Sync upstream Solid skills

```bash
~/uvws/.venv/bin/python scripts/sync_solid_skills.py --check  # detect drift
~/uvws/.venv/bin/python scripts/sync_solid_skills.py          # refresh all
~/uvws/.venv/bin/python scripts/sync_solid_skills.py solid-spec  # refresh one
```

Commit message format: `[Agent: Claude] sync: solid-llm-skills <new-sha>`.

## Git Protocol

Prefix: `[Agent: Claude]`
Co-Author: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
Never force push. Stage specific files.

## Identity

ORCID: https://orcid.org/0000-0003-4091-6059
Notre Dame ROR: https://ror.org/00mkhxb43
CI-Compass ROR: https://ror.org/001zwgm84
