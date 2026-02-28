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
