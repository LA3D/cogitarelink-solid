# cogitarelink-solid — Session Memory

## Project State (as of 2026-02-28)

**Repo**: `~/dev/git/LA3D/agents/cogitarelink-solid`
**Branch**: main
**Status**: Scaffolding — Claude Code config + project infrastructure

## Completed Work

- [x] Claude Code scaffold: CLAUDE.md, settings.json, rules (6), skills (8), memory
- [ ] Project infrastructure: pyproject.toml, docker-compose.yml, adapter, CSS config

## Key Architecture Patterns

- **Three-layer Pod RDF** (D10): Content (Markdown) + Layer A (LDP container structure) + Layer B (Turtle `.meta` sidecars) + Layer C (navigation indexes)
- **Frontmatter → RDF via SHACL** (D7): Shape defines predicate vocabulary; importer reads shape, maps YAML keys to predicates, validates output
- **Dual-index navigation** (D9): Type Index (machines) + JSON-LD (agents) + VoID (fabric) + VAULT-INDEX.md (humans)
- **CSS + Python adapter** (D1): CSS handles LDP/auth; Python adapter adds `.well-known/`, import, fabric integration
- **Comunica for SPARQL** (D3): Client-side federation over LDP resources; no data duplication
- **Oxigraph for metadata only** (D4): Catalog (VoID), crosswalks (SSSOM), navigational ontology

## Phase Map

| Phase | Timeline | Features | Status |
|---|---|---|---|
| Phase 1 | Weeks 1-4 | CSS Docker + vault importer + LDP verification | In progress |
| Phase 2 | Weeks 5-8 | Fabric adapter (.well-known/, SHACL, Comunica) | Not started |
| Phase 2b | Weeks 7-8 | OSLC Query + TRS for Pod search | Not started |
| Phase 2c | Weeks 8-9 | Provenance, integrity, SPARQL examples | Not started |
| Phase 3 | Weeks 9-10 | Agent navigation experiments | Not started |

## Key Files

| File | Purpose |
|---|---|
| `adapter/main.py` | FastAPI gateway (.well-known/, LDP proxy, import) |
| `css/config/solid-config.json` | CSS Components.js configuration |
| `shapes/concept-note.ttl` | SHACL shape for concept notes |
| `ontology/solid-pod-profile.ttl` | PROF CoreProfile for Pod |
| `scripts/vault_import.py` | Vault-to-Pod importer CLI |
| `docker-compose.yml` | CSS + adapter + Oxigraph stack |

## Sibling Projects

- `~/dev/git/LA3D/agents/cogitarelink-fabric` — graph-native fabric nodes (Oxigraph + FastAPI + Credo)
- `~/dev/git/LA3D/agents/rlm` — RLM agent substrate (dspy.RLM)

## Open Questions

- CSS v7 Shape Trees support maturity — can we get validation on POST?
- Comunica performance over 20+ LDP resources — when does a local index become necessary?
- PARA → LDP container mapping — encode PARA semantics in RDF or rely on container hierarchy?

## Vault Planning Docs

- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration.md` — main project note
- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md` — 10-week plan
- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md` — D1-D27 full log
- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Fabric-Pod Synergy - Unified Design Thesis.md` — synergy points S1-S8
