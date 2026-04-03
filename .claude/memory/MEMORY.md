# cogitarelink-solid — Session Memory

## Project State (as of 2026-04-03)

**Repo**: `~/dev/git/LA3D/agents/cogitarelink-solid`
**Branch**: main
**Status**: Phase 1 complete. Pod reproducible, 107 vault notes imported, SPARQL queryable, agent-navigable.

## Completed Work

- [x] Claude Code scaffold: CLAUDE.md, settings.json, rules (6), skills (8), memory
- [x] Initial scaffold: pyproject.toml, docker-compose.yml, adapter, CSS config
- [x] Architecture restructure: removed Python adapter, added Comunica sidecar (D1 revised, D28 new)
- [x] Pod as Agentic Memory System design (D30-D35)
- [x] Reproducible pod setup: CSS seed config + pod templates + Docker init service
- [x] Content pipeline: rdf_gen.py + ldp_client.py + vault_import.py (107 notes)
- [x] SPARQL integration tests via Comunica (6 tests, explicit sources)
- [x] Enriched container .meta with SKOS schemes, sh:agentInstruction, dct:type
- [x] Ontology refactor: SKOS ConceptSchemes for PARA + memory partitions
- [x] .well-known/solid VoID + DCAT + fabric:LDPBrowse feature flag
- [x] SolidPodProfile aligned with fabric PROF/DCAT pattern (prof:hasResource + W3C roles)
- [x] Zero-shot agent navigation tests (D33 validated)
- [ ] Phase 2: TypeScript CLI (D29) — next

## Key Architecture Patterns

- **Reproducible setup**: `make reset` = working pod from git clone (CSS seed + pod templates + init service)
- **TypeScript-first server** (D1): CSS + extensions + Comunica. Python is client-only (disposable, D29).
- **Three-layer Pod RDF** (D10): Content (Markdown) + Layer A (LDP) + Layer B (.meta sidecars) + Layer C (navigation indexes)
- **PARA as containers, partitions as SKOS** (D30, D34): PARA provides container hierarchy; partitions modeled as skos:ConceptScheme + dct:type
- **Four-layer self-description** (D9): .well-known/solid (VoID+DCAT) → SolidPodProfile (PROF) → SHACL shapes (sh:agentInstruction) → SPARQL examples
- **Agent-first, self-describing** (D33): Validated via zero-shot navigation test — agent discovers pod structure from metadata alone
- **SKOS foundation** (D34): All knowledge-bearing note types rdfs:subClassOf skos:Concept

## Key Files

| File | Purpose |
|---|---|
| `css/config/solid-config.json` | CSS Components.js main config |
| `css/config/seed.json` | CSS seed config (account + pod creation) |
| `css/config/pod-templates/` | Pod template directory (PARA containers) |
| `css/config/void-description.json` | VoID + DCAT StorageDescriber override |
| `css/config/dev-allow-all.json` | Dev auth (allow-all, replaces file.json) |
| `css/config/pod-templates-override.json` | Template folder Components.js override |
| `comunica/package.json` | Comunica link-traversal with traqula version fix |
| `comunica/config.json` | Custom Comunica config (LDP + describedby actors, no auth) |
| `ontology/vault-ontology.ttl` | Vault vocabulary (note types, SKOS schemes, edge properties) |
| `ontology/solid-pod-profile.ttl` | PROF SolidPodProfile with ResourceDescriptors |
| `shapes/concept-note.ttl` | SHACL shape with sh:agentInstruction |
| `scripts/lib/rdf_gen.py` | Frontmatter → RDF (rdflib) |
| `scripts/lib/ldp_client.py` | Minimal PUT/PATCH/GET (3 functions, disposable) |
| `scripts/vault_import.py` | Vault-to-Pod importer |
| `scripts/pod_setup.py` | Docker init service (shapes + ontology upload) |

## Key Research Findings

### 2026-04-03 (Agent navigation + ontology refactor)
- Zero-shot agent navigation validated D33: agent follows .well-known/solid → PROF profile → Type Index → container .meta → sh:agentInstruction → constructs queries
- sh:agentInstruction on container .meta is the crucial piece — tells agent which predicates to use
- PROF ResourceDescriptor + W3C roles vocabulary aligns pod with fabric four-layer pattern
- vault:agentGuidance was unnecessary — sh:agentInstruction (SHACL 1.2 §8.3) covers the use case
- VoID properties (void:class, void:entities) should only be used on void:Dataset — misapplication on containers corrected
- PARA categories and memory partitions properly modeled as SKOS ConceptSchemes (not custom types)

### 2026-04-02 (Comunica link-traversal investigation)
- @comunica/query-sparql-link-traversal@0.8.0 has traqula parser bug (0.0.24 vs 1.0.x conflict)
- Fixed via npm overrides in comunica/package.json
- Link-traversal follows ldp:contains (containers) but NOT describedby headers on non-RDF resources
- Markdown resources don't trigger describedby following because Comunica skips unparseable content types
- This is an architectural gap — agents must discover .meta files explicitly or via SPARQL with explicit sources
- The TypeScript CLI (D29) will handle .meta discovery programmatically

### 2026-04-01 (Reproducible setup + content pipeline)
- CSS Components.js Override pattern required (not @id re-declaration) for single-value params
- allow-all auth must REPLACE file.json entirely (not layer on top) — mutually exclusive auth modules
- CSS rejects requests where Host header doesn't match base URL — Docker network alias required
- CSS seed config runs SeededAccountInitializer on startup — idempotent account/pod creation
- Pod templates: directories become containers, .meta files become container metadata, $.hbs files get Handlebars processing

### 2026-04-01 (Pod structure design)
- .meta description resources are Solid's native metadata layer
- SKOS has never been used for end-user pod content (present in infra only)
- pim:Workspace maps naturally to vault as named workspace
- Memory partitions map to pod via .meta triples (now SKOS ConceptScheme)
- Pod discovery path: .well-known/solid → PROF → Type Index → container .meta → SHACL shapes

## Research Findings (Answered)

- RQ-Pod-1 (container vs metadata for partitions): **Metadata** — partitions are SKOS concepts in .meta, not container layout
- RQ-Pod-2 (PARA-as-containers): **Viable** — validated with 15 containers, agent navigates successfully
- RQ-Pod-3 (minimum discovery path): **5 steps** — .well-known/solid → profile → Type Index → container .meta → SHACL shape
- RQ-Pod-5 (procedural memory location): **/procedures/ container** with sh:agentInstruction in shapes

## Open Research Questions

- RQ-Pod-4: Comunica .meta traversal vs pre-built index — blocked by link-traversal .meta gap
- RQ-Pod-6: .meta richness vs query overhead — needs performance benchmarks with 100+ resources
- Comunica link-traversal: when will upstream fix traqula version conflict? (PR #195 open)
- Comunica describedby following for non-RDF resources: architectural limitation or configurable?

## Next Steps

- **Phase 2**: TypeScript CLI (D29) — new repo under LA3D, built on Bashlib + Comunica
- **Phase 3**: Formal agent navigation experiments (browsing, querying, creation, hybrid tasks)
- File Comunica issue about describedby header following for non-RDF resources

## Sibling Projects

- `~/dev/git/LA3D/agents/cogitarelink-fabric` — graph-native fabric nodes (Oxigraph + FastAPI + Credo)
- `~/dev/git/LA3D/agents/rlm` — RLM agent substrate (dspy.RLM)
