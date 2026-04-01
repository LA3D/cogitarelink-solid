# cogitarelink-solid — Session Memory

## Project State (as of 2026-04-01)

**Repo**: `~/dev/git/LA3D/agents/cogitarelink-solid`
**Branch**: main
**Status**: Pod running (CSS healthy on :3000), design phase for vault-to-pod structure

## Completed Work

- [x] Claude Code scaffold: CLAUDE.md, settings.json, rules (6), skills (8), memory
- [x] Initial scaffold: pyproject.toml, docker-compose.yml, adapter, CSS config
- [x] Architecture restructure: removed Python adapter, added Comunica sidecar (D1 revised, D28 new)
- [x] CSS running in Docker with LDP containers: /vault/ (concepts/, profile/, shapes/, README)
- [x] Pod as Agentic Memory System design (D30-D35) — design doc at docs/plans/2026-04-01-pod-agentic-memory-structure-design.md
- [ ] Phase 1 implementation: vault importer + LDP verification

## Key Architecture Patterns

- **TypeScript-first server** (D1 revised): CSS + TypeScript extensions + Comunica sidecar. Python is client-only.
- **Three-layer Pod RDF** (D10): Content (Markdown) + Layer A (LDP) + Layer B (Turtle .meta) + Layer C (navigation indexes)
- **PARA as containers, partitions as metadata** (D30): PARA provides LDP container hierarchy; memory partitions expressed in `.meta` triples via `vault:memoryPartition`
- **`.meta` as source of truth** (D31): Replaces YAML frontmatter. Comunica follows `describedby` links automatically. Richer than YAML (provenance, qualified relationships, partition membership).
- **Agent-first, self-describing** (D33): Pod describes own structure via standard Solid protocol. No `.claude/` injection needed.
- **SKOS foundation** (D34): First use of SKOS for end-user content in Solid ecosystem. Vault ontology extends SKOS.
- **Model 1** (D32): One-way vault → pod import. Evolves toward pod-native (Model 2) as research progresses.
- **Comunica for SPARQL** (D3, D28): SPARQL Protocol sidecar over LDP. Link traversal discovers resources via Type Index + ldp:contains + describedby.
- **Dual-index navigation** (D9): Type Index (machines) + JSON-LD (agents) + VoID (fabric) + VAULT-INDEX.md (humans)

## Pod Container Structure (D30)

```
pod.vardeman.me/
├── profile/card              # WebID — discovery entry point
├── settings/                 # Type Index (public + private)
├── vault/                    # pim:Workspace — knowledge workspace
│   ├── projects/             # PARA: P
│   ├── areas/                # PARA: A (8 areas)
│   ├── resources/            # PARA: R
│   │   ├── concepts/         # skos:Concept
│   │   ├── theories/         # vault:TheoryNote
│   │   ├── literature/       # vault:LiteratureNote
│   │   └── ...
│   └── archive/              # PARA: Archive
├── procedures/               # Agent behavioral memory
│   ├── shapes/               # SHACL shapes
│   ├── queries/              # SPARQL templates
│   └── guidance/             # Agent navigation rules
├── ontology/                 # Self-describing vocabulary
└── .well-known/              # void, shacl, solid
```

## Key Files

| File | Purpose |
|---|---|
| `css/config/solid-config.json` | CSS Components.js configuration |
| `shapes/concept-note.ttl` | SHACL shape for concept notes |
| `ontology/solid-pod-profile.ttl` | PROF SolidPodProfile |
| `scripts/vault_import.py` | Vault-to-Pod importer CLI (Python) |
| `docker-compose.yml` | CSS + Comunica stack |
| `docs/plans/` | Architecture design documents |
| `docs/plans/2026-04-01-pod-agentic-memory-structure-design.md` | Pod as Agentic Memory System design |

## Key Research Findings

### 2026-04-01 (Pod structure design session)
- `.meta` description resources are Solid's native metadata layer — arbitrary RDF, PATCH-only, Comunica-traversable
- SKOS has never been used for end-user pod content (present in infra only)
- `pim:Workspace` maps naturally to the vault as a named workspace with access policies
- Memory partitions (from vault theory notes) map to pod via `.meta` triples, not container layout
- The vault KG's self-referential quality (KG describes its own structure) is the key property to replicate in the pod
- Pod discovery path: WebID → Type Index → VoID → SHACL → SPARQL → resources

### 2026-02-28
- CSS has existing extension components: shape-validator (SHACL on write), predicate-cardinalities (.well-known/ + VoID)
- Comunica v5 supports SPARQL 1.2, link traversal over Solid Pods, Solid-OIDC auth
- cogitarelink-fabric `fabric_agent.py` pattern works unchanged for Pod

## Research Questions (Pod Structure)

- RQ-Pod-1: Container structure vs metadata for agent partition navigation
- RQ-Pod-2: PARA-as-containers viability for agent navigation
- RQ-Pod-3: Minimum agent discovery path for unknown pod
- RQ-Pod-4: Comunica `.meta` traversal vs pre-built knowledge graph performance
- RQ-Pod-5: Procedural memory location (`.well-known/` vs `/procedures/` vs SHACL annotations)
- RQ-Pod-6: `.meta` richness vs query overhead

## Open Questions

- Comunica performance over 20+ LDP resources — when does a local index become necessary?
- Comunica docker image: use `node:20-slim` + npx, or build custom image with pre-installed packages?

## Sibling Projects

- `~/dev/git/LA3D/agents/cogitarelink-fabric` — graph-native fabric nodes (Oxigraph + FastAPI + Credo)
- `~/dev/git/LA3D/agents/rlm` — RLM agent substrate (dspy.RLM)

## Vault Planning Docs

- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration.md` — main project note
- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md` — 10-week plan
- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md` — D1-D35 full log
- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Fabric-Pod Synergy - Unified Design Thesis.md` — synergy points S1-S8
