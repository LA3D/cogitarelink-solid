# cogitarelink-solid — Session Memory

## Project State (as of 2026-05-14)

**Repo**: `~/dev/git/LA3D/agents/cogitarelink-solid`
**Branch**: main
**Status**: Phase 1 + 2 + 2b complete; Phase 2c in flight. Pod reproducible, 107 vault notes imported, SPARQL queryable, agent-navigable. Sibling `solid-agent-skills` shipped Phase 2 (11 commands + 5 skills + 53 tests). Active focus: **Unified Externalization Prototype Plan Round 1** (Memento + Affordance Descriptor + Pod-Native Harness Skill).

## Sibling Projects (all under `~/dev/git/LA3D/agents/`)

| Repo | Role |
|---|---|
| `cogitarelink-solid` | Reference Pod: CSS + Comunica + vault importer (this repo) |
| `solid-agent-skills` | General-purpose Solid Pod CLI + Claude Code skills (D29). Phase 2 complete: 11 CLI commands, 5 skills, 53 tests, OpenProse navigator+judge 5/5 PASS |
| `cogitarelink-fabric` | Graph-native fabric nodes (Oxigraph + FastAPI + Credo); eval harness pattern reused by Pod evaluations |
| `rlm` | RLM agent substrate (dspy.RLM) |
| `ace-dspy`, `gepa-rlm-reasoning`, `ontology-agent-kr`, `earth616_extraction_workflow` | Other LA3D experiments |

## Active Plan — Unified Externalization Prototype Plan

Architectural commitment: **The Pod as Externalization Substrate** ([[@zhou-2026-externalization]] framing). Evidence-first publication path. Four rounds compose with Phase 4–6 of `SOLID-Pod-PLAN.md`.

| Round | Claim | Status |
|---|---|---|
| **R1 Memento + Affordance Descriptor + Harness Skill** | Pod-published affordance descriptors + RFC 7089 time-travel reduce harness cost vs spec-only navigation | Rung 1.0 ✅ (vocab alignment); Rung 1.1 next (read-only Memento spike) |
| R2 Bridge edges with structural pointers | `cito:hasPageRange`/`cito:hasSection` enable demand-driven document granularity | Blocked on R1 |
| R3 Typed edges as ground truth | SPARQL over frontmatter edges beats flat semantic retrieval for typed graph queries | Minimal new build |
| R4 Multi-pod federation | Cross-pod federated queries correct + tractable latency | Blocked on R1–3 |

### Round 1 rungs

- Rung 1.0 ✅ Vocabulary Alignment — see `Memento Vocabulary Alignment.md` in vault
- **Rung 1.1 (next, gating)** — Read-only Memento spike: git-wrapped CSS data dir + ~150 LOC TS plugin parsing `Accept-Datetime` → `git log --before` → return `Memento-Datetime`-headered content; TimeMap at `?ext=timemap`; TimeGate 302-redirect
- Rung 1.2 — Tombstone semantics for DELETE (`ldes:DeletedLDPResource` + `as:Delete`)
- Rung 1.3 — VC-aware operation gating (routine vs elevated `acp:purgeAllowed`)
- Rung 1.4 — Affordance descriptor declaration at storage description root
- Rung 1.5 — First measurable evaluation (B1 filesystem / B2 brute-force pod / T harness pod across navigation + temporal task suite)

## Completed Work (Phase 1 + 2 + 2b)

- [x] Claude Code scaffold (CLAUDE.md, settings, rules, skills, memory)
- [x] Architecture restructure: removed Python adapter, added Comunica sidecar (D1, D28 superseded by D28 = CSS v8 Alpha)
- [x] Pod as Agentic Memory System design (D30–D35)
- [x] Reproducible setup: CSS seed config + pod templates + Docker init service (`make reset`)
- [x] Content pipeline: rdf_gen.py + ldp_client.py + vault_import.py (107 notes)
- [x] SPARQL integration tests via Comunica (6 tests, explicit sources)
- [x] Ontology refactor: SKOS ConceptSchemes for PARA + memory partitions (D34)
- [x] `.well-known/solid` with VoID + DCAT + `fabric:LDPBrowse` feature flag (D44 superseded — moved to storage description)
- [x] SolidPodProfile aligned with fabric PROF/DCAT pattern (`prof:hasResource` + W3C roles)
- [x] Zero-shot agent navigation tests validate D33
- [x] `solid-agent-skills` shipped: 11 CLI commands + 5 skills + 53 tests + OpenProse navigator+judge agentic test 5/5 PASS (D29)
- [x] Architectural pivot D42–D60 (unified Pod, externalization substrate, three-tier access)
- [x] Memento integration design D61–D64 + `Memento Vocabulary Alignment.md` (Rung 1.0)
- [ ] Phase 2c — markdown-flavor shapes + sidecar validation discipline (in flight)
- [ ] Phase 4a — storage description as harness root (Round 1 Rung 1.4)
- [ ] Phase 4b — affordance descriptors (Round 1 Rung 1.4)
- [ ] Phase 6a — eval harness (Round 1 Rung 1.5)

## Key Architecture Patterns

- **Three-tier access (D55)**: brute-force (spec) → harness (descriptors) → skills (`solid-agent-skills`). Lower tiers always functional
- **TypeScript-first server** (D1): CSS + extensions + Comunica. Python is client-only (importer + SHACL dev)
- **Three-layer Pod RDF** (D10): blob content + LDP container structure + `.meta` sidecars + navigation indexes (now Type Index + Storage Description per D44)
- **PARA as containers, partitions as SKOS** (D30, D34): PARA = hierarchy; partitions = `skos:ConceptScheme` + `dct:type` in `.meta`
- **Hybrid contextualized KG** (D57): blobs first-class (markdown, PDF, iCal); `.meta` contextualizes; both views legitimate per Verborgh 2022
- **Agent-first, self-describing** (D33, D48): every concern is a linked-data resource; follow-your-nose; standard slots over invented endpoints
- **SHACL as guardrails** (D50): primary defense against agent hallucination at write boundary
- **`.meta` validation, never body** (D38): RDF Source vs Non-RDF Source split; body affordances first-class when descriptor-declared (D58)
- **Memento via Trellis convention** (D61): `?ext=timemap`, `?version=<14-digit>`; OriginalResource doubles as TimeGate

## Key Files

| File | Purpose |
|---|---|
| `css/config/solid-config.json` | CSS Components.js main config |
| `css/config/seed.json` | CSS seed config (account + pod creation) |
| `css/config/pod-templates/` | Pod template directory (PARA containers) |
| `css/config/void-description.json` | VoID + DCAT StorageDescriber override |
| `css/config/dev-allow-all.json` | Dev auth (allow-all replaces file.json) |
| `comunica/package.json` | Comunica link-traversal with traqula version fix |
| `comunica/config.json` | Custom Comunica config (LDP + describedby actors) |
| `ontology/vault-ontology.ttl` | Vault vocabulary (note types, SKOS schemes, edge properties) |
| `ontology/solid-pod-profile.ttl` | PROF SolidPodProfile with ResourceDescriptors |
| `shapes/concept-note.ttl` | SHACL shape with `sh:agentInstruction` |
| `scripts/lib/rdf_gen.py` | Frontmatter → RDF (rdflib) |
| `scripts/lib/ldp_client.py` | Minimal PUT/PATCH/GET (3 functions) |
| `scripts/vault_import.py` | Vault-to-Pod importer |
| `scripts/pod_setup.py` | Docker init service (shapes + ontology upload) |

## Open Research Questions

- **RQ-Affordance-1**: descriptor format — declarative SHACL vs custom RDF vs hybrid (Round 1 Rung 1.4 forces resolution)
- **RQ-Harness-1**: fabric namespace minting at `https://cogitarelink.org/ns/fabric#` — blocks all `fabric:*` predicates past prototype
- **RQ-Memento-1**: ACP fragmentation across time (D62 known limitation)
- **RQ-Memento-2**: Comunica `-d` propagation to federated sources (Round 4)
- **RQ-Federation-1**: cross-pod SPARQL federation works at all (gate for RQ-Memento-2)
- **RQ-Eval-1/2/3**: task suite, sub-agent config, GEPA convergence (Round 1 Rung 1.5)
- **RQ-Pod-4**: `.meta` traversal vs pre-built index (blocked by link-traversal `.meta` gap — Comunica skips unparseable content types)
- **RQ-Pod-6**: `.meta` richness vs query overhead (needs 100+ resource benchmarks)

## Resolved Research Questions

- RQ-Pod-1 (container vs metadata for partitions): **Metadata** — partitions are SKOS concepts in `.meta` (D30)
- RQ-Pod-2 (PARA-as-containers): **Viable** — validated with 15 containers, agent navigates successfully
- RQ-Pod-3 (minimum discovery path): **5 steps** — `.well-known/solid` → profile → Type Index → container `.meta` → SHACL shape (now via D44 storage description)
- RQ-Pod-5 (procedural memory location): **`/procedures/` container** with `sh:agentInstruction` in shapes

## Key Research Findings

### 2026-05-06 — Memento integration design
- Trellis-style query-string URI minting picked (D61) over path-prefix and child-container conventions — keeps container hierarchy clean for D54 agentic-memory navigation
- v1 commits to standards-only vocabulary (D63): Memento + LDES + AS2 + PROV-O + VCDM + ACP. Mints nothing
- Soft delete + hard purge as two distinct operations with distinct ACP requirements (D64) — gives defensible compliance posture
- `Memento Vocabulary Alignment.md` is the canonical standards-mapping reference; Round 1 implementation cites back here

### 2026-04-25 — Externalization substrate pivot
- D51: Pod is general-purpose substrate for agentic applications; agentic memory is one specialization. Validated by Verborgh 2017-2022 program and ByteRover/xMemory empirics
- D55: HATEOAS-correct three-tier access — brute-force always works; harness optimizes; skills specialize
- D58 revises D41: body affordances first-class when descriptor-declared. Importer can stop forcing every wikilink into `.meta` triple — descriptor IS materialization rule applied at read time
- D60: evaluation methodology = clean Claude Code sub-agents + metric harness + GEPA. Tier comparison IS the evaluation

### 2026-04-24 — Unified Pod architecture
- D42: every node is a Pod; storage backend (file/Oxigraph/hybrid) is implementation detail. Dissolves pod-vs-triplestore dualism
- D43: Oxigraph as first-class Pod backend via CSS `--sparqlEndpoint` (revises D4). Meccano 2016 precedent
- D44: storage description resource replaces `.well-known/void` — spec-mandated slot. Router, not manifest; points to browseable catalog containers via `rdfs:seeAlso`
- D48: agent affordance architecture as guiding principle. Anti-patterns: flat `.well-known/*` endpoints, embedded SPARQL literals, magic paths, dual parallel mechanisms
- D49: vocabulary hallucination is real (Claude minted `void:shape`, `void:constructTemplate` etc. — none exist). `void:vocabulary` declarations + D23 TBox cache + D50 SHACL backstop
- D50: SHACL shapes as primary enforcement against agent hallucination at write boundary

### 2026-04-03 — Agent navigation + ontology refactor
- Zero-shot agent navigation validated D33: agent follows `.well-known/solid` → PROF profile → Type Index → container `.meta` → `sh:agentInstruction` → constructs queries
- `sh:agentInstruction` on container `.meta` is the crucial piece — tells agent which predicates to use
- PROF ResourceDescriptor + W3C roles aligns pod with fabric four-layer pattern
- `vault:agentGuidance` unnecessary — `sh:agentInstruction` (SHACL 1.2 §8.3) covers it
- PARA categories and memory partitions properly modeled as SKOS ConceptSchemes (not custom types)

### 2026-04-02 — Comunica link-traversal investigation
- `@comunica/query-sparql-link-traversal@0.8.0` has traqula parser bug — fixed via npm overrides
- Link-traversal follows `ldp:contains` but NOT `describedby` headers on non-RDF resources
- Markdown resources don't trigger `describedby` following — Comunica skips unparseable content types
- Architectural gap — agents must discover `.meta` explicitly or via SPARQL with explicit sources. `solid-agent-skills` (D29) handles this programmatically

### 2026-04-01 — Reproducible setup + pod structure
- CSS Components.js Override pattern required (not `@id` re-declaration) for single-value params
- Allow-all auth must REPLACE file.json entirely (auth modules are mutually exclusive)
- CSS rejects Host header mismatches — Docker network alias required
- CSS seed config runs `SeededAccountInitializer` on startup — idempotent
- Pod templates: directories → containers, `.meta` files → container metadata, `$.hbs` → Handlebars processing
- `.meta` description resources are Solid's native metadata layer
- SKOS has never been used for end-user pod content (present in infra only) — D34 is novel
- `pim:Workspace` maps naturally to vault as named workspace

## Vault Sources of Truth

Active plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Unified Externalization Prototype Plan.md`
Decisions log: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`
Phase plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md`
Memento vocab: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Memento Vocabulary Alignment.md`
Infrastructure design: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Self-Hosted Pod Infrastructure Design.md`
Phase 1 findings: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Solid Pod Phase 1 - Vertical Slice Findings.md`
Fabric-Pod synergy: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Fabric-Pod Synergy - Unified Design Thesis.md`
