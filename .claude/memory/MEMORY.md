# cogitarelink-solid — Session Memory

## Project State (as of 2026-05-15)

**Repo**: `~/dev/git/LA3D/agents/cogitarelink-solid`
**Branch**: main (commits `f94228c` memento extension, `741e9b8` tombstones, `571385c` decisions-index D69)
**Status**: Phase 1 + 2 + 2b + Rung 1.4 complete. Read-only Memento (RFC 7089) + tombstone semantics + wiki-memory L3 reference profile (D78–D81) shipped. 134 vitest unit + 19 pytest integration tests green. Sibling `solid-agent-skills` shipped Phase 2 (11 commands + 5 skills + 53 tests).

**Direction pivot (2026-05-15)**: project reframed from "vault-to-Pod as MVP" to **wiki-memory L3 as canonical reference profile, vault as one application**. Forced by cross-system pattern research across memory-provider plugins, benchmark-tuned memory systems, and wiki-memory implementations — three independent traditions converge on the same substrate. D70–D74 record the stratification. See [[Memory Substrate vs Memory Profile]] and [[Wiki-Memory L3 Profile]] in the vault.

**Active focus**: **Round 1 Rung 1.5** — first measurable evaluation (B1 filesystem / B2 brute-force pod / T harness pod across navigation + temporal task suite, run against wiki-memory L3 reference). Rung 1.4 closed 2026-05-15.

## Sibling Projects (all under `~/dev/git/LA3D/agents/`)

| Repo | Role |
|---|---|
| `cogitarelink-solid` | Reference Pod: CSS + Comunica + vault importer (this repo) |
| `solid-agent-skills` | General-purpose Solid Pod CLI + Claude Code skills (D29). Phase 2 complete: 11 CLI commands, 5 skills, 53 tests, OpenProse navigator+judge 5/5 PASS |
| `cogitarelink-fabric` | Graph-native fabric nodes (Oxigraph + FastAPI + Credo); eval harness pattern reused by Pod evaluations |
| `rlm` | RLM agent substrate (dspy.RLM) |
| `ace-dspy`, `gepa-rlm-reasoning`, `ontology-agent-kr`, `earth616_extraction_workflow` | Other LA3D experiments |

## Active Plan — Unified Externalization Prototype Plan

Architectural commitment: **The Pod as Externalization Substrate** ([[@zhou-2026-externalization]] framing). Built from first principles on W3C web standards (LDP/RDF/SHACL/Memento/LDN/Notifications Protocol), which happen to align with the patterns Karpathy/Ghumare/AKBP/Supermemory/ByteRover have arrived at empirically. Evidence-first publication path. Four rounds compose with Phase 4–6 of `SOLID-Pod-PLAN.md`.

| Round | Claim | Status |
|---|---|---|
| **R1 Wiki-Memory L3 + Memento + Affordance Descriptor** | Pod-published affordance descriptors over wiki-memory L3 reduce harness cost vs spec-only navigation; RFC 7089 time-travel as substrate-level capability | Rung 1.0 ✅ (vocab alignment), Rung 1.1 ✅ (read-only Memento), Rung 1.2 ✅ (tombstones), Rung 1.4 ✅ closed 2026-05-15 (wiki-memory L3 + affordance descriptor); Rung 1.5 next |
| R2 Bridge edges with structural pointers | `cito:hasPageRange`/`cito:hasSection` enable demand-driven document granularity | Blocked on R1 |
| R3 Typed edges as ground truth | SPARQL over frontmatter edges beats flat semantic retrieval for typed graph queries | Minimal new build |
| R4 Multi-pod federation | Cross-pod federated queries correct + tractable latency | Blocked on R1–3 |

### Round 1 rungs

- Rung 1.0 ✅ Vocabulary Alignment — see `Memento Vocabulary Alignment.md` in vault
- Rung 1.1 ✅ Read-only Memento — `css/extensions/memento/` (MementoHttpHandler + MementoCommitListener + MementoLinkMetadataWriter); D65–D68 decisions logged; full code review + Wave 1-5 fixes applied (commit `f94228c`)
- Rung 1.2 ✅ Tombstone semantics for DELETE — `ldes:DeletedLDPResource` + `as:Delete` typing; 410 Gone on plain GET; worktree-first race-safety check (commit `741e9b8`)
- Rung 1.3 — VC-aware operation gating (routine vs elevated `acp:purgeAllowed`) — also folds in `ResponseDescription` refactor (deferred review finding #10) since both require OperationHttpHandler migration
- Rung 1.4 ✅ Wiki-memory L3 reference profile — `css/extensions/markdown-projection/` (MarkdownProjectionListener), `css/extensions/markdown-render/` (renamed from markdown-rdfa; RDFa dropped), `css/extensions/shared/markdown-parsing/`, `shapes/wiki-memory-l3/` (6 shapes), JSON-LD context + affordance catalog at `/meta/`; D78–D81 + K2/K3 decisions logged; 41 vitest + 19 pytest tests green (1 xfailed RQ-Listener-1)
- Rung 1.5 — First measurable evaluation (B1 filesystem / B2 brute-force pod / T harness pod across navigation + temporal task suite, run against wiki-memory L3 reference)

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
- [x] Rung 1.1 — `css/extensions/memento/` with MonitoringStore CDC, per-path git commits, `.git/memento.lock` for multi-worker safety, RFC 7089 §4.1.1 Vary/Link advertisement via MementoLinkMetadataWriter (D65–D68)
- [x] Code review + Wave 1-5 hardening: timemap async, fsPath HttpError, gitLogBefore opt, per-path staging, attach-before-bootstrap, file lock, TimeMap from/until/timegate, link advertisement, gitDir variable, poll-not-sleep tests
- [x] Rung 1.2 — Tombstone semantics for DELETE: gitLatestOpForPath probe, ldes:DeletedLDPResource + as:Delete typing in TimeMap, 410 Gone on plain GET of tombstoned resource, worktree-first check for race-safety, 410 with Memento-Datetime for ?version= resolving to a deletion commit
- [x] Builder-skill layer — `.claude/skills/{css-extension,components-override,metadata-writer,monitoring-store,comunica-sources,shacl-shapes,solid-spec,solid-integration}.md` capture lessons learned; `vendor/solid-llm-skills/` vendors upstream Solid reference (commit `9a1cab17`)
- [x] Cross-system memory-pattern research (2026-05-15) — Hermes/Supermemory provider interfaces, ByteRover/MemGPT/xMemory/Hindsight benchmark systems, Karpathy/Ghumare/AKBP/agentmemory wiki-memory. Three traditions converge. New design notes: `[[Memory Substrate vs Memory Profile]]`, `[[Wiki-Memory L3 Profile]]` in vault Core Concepts. Three new external-resource notes: Ghumare LLM Wiki v2, AKBP, agentmemory
- [x] D70–D74 substrate stratification (L1/L2/L3 + wiki-memory L3 + compile-once + two-stage commit + memory-substrate trigger vocab)
- [x] D75 (rendered HTML serves humans; RDFa dropped — revises D37); D76 (wiki-memory L3 URI layout, slug algorithm with explicit `@`-strip rule S3a, class-hint resolver, attachment co-location); D77 (five-shape SHACL catalog: page/source/person/procedure/working). L3 spec input for Rung 1.4 implementation now complete
- [x] Audit of vault-import Python pipeline + markdown-rdfa extension (2026-05-15) — confirmed `MarkdownProjectionListener` doesn't exist yet; the markdown-rdfa extension renders HTML+RDFa (D37 scope) but doesn't project body wikilinks to `.meta` (D58/D71 scope). Reusable modules: `wikilinks.ts`, `predicates.ts`, `resolver.ts`. Importer is frontmatter-only — body wikilinks invisible to SPARQL across 1243 vault notes
- [x] D78–D81 + K2/K3: class-based shape targeting, hybrid vocab + JSON-LD context, substrate-derived navigation, Model A predicate governance with RQ-Listener-1 caveat
- [x] markdown-projection extension: MarkdownProjectionListener, MetaWriter with file lock, governed-predicate replacement; 20 unit tests
- [x] markdown-render extension (renamed from markdown-rdfa): rehype-rdfa dropped, rehype-wikilink-classes added, wikilinks.css shipped; 21 unit tests
- [x] shared/markdown-parsing module: wikilinks, predicates, resolver, extractWikilinks reused across renderer and projection listener
- [x] shapes/wiki-memory-l3/: 6 SHACL shape files (ResourceShape + 5 entity shapes)
- [x] tests/fixtures/wiki-memory-l3/: 4 bundle fixtures, enriched fixture, 2 shape stubs, 3 traversal queries
- [x] JSON-LD context at /meta/context.jsonld; storage description extended; affordance catalog at /meta/affordances/ with 4 descriptors (markdown-projection, hub-view, breadcrumb-view, memento)
- [x] Integration tests: round-trip (4), discovery (4), traversal (3), shape validation (6); 6 listener integration tests with 1 xfailed (RQ-Listener-1)
- [ ] Phase 2c — markdown-flavor shapes + sidecar validation discipline (in flight)
- [ ] Wiki-memory L3 reference Pod (template + scripts) — built from first principles before vault import work resumes
- [ ] Vault import path migration — write through wiki-memory L3 surface rather than direct LDP POST; importer becomes a translation table mapping 12+ vault L4 types into 5 L3 shapes
- [ ] Phase 6a — eval harness (Round 1 Rung 1.5)

## Key Architecture Patterns

- **L1/L2/L3 stratification (D70)**: L1 = Pod substrate (LDP/WAC/SPARQL/Memento/`.well-known/`); L2 = memory substrate (seven invariants); L3 = memory profile (wiki-memory is canonical reference). Multiple L3 profiles can coexist on one Pod
- **Wiki-memory as canonical L3 (D71)**: page-as-unit, dual-layer linking (markdown wikilinks at token layer + RDF predicates in `.meta` at data layer, unified by D58 projection), backlinks as first-class, low-ceremony writes. Vault PARA+SKOS is an L4 specialization sitting on top
- **Dual-layer linking — the architectural commitment**: markdown body carries LLM-readable typed wikilinks; `.meta` sidecar carries SPARQL-queryable typed predicates; `MarkdownProjectionListener` (D58 sharpened) projects body→`.meta` on write
- **Two-stage commit (D73)**: `working-memory/` permissive shape + `mem:Crystallize` operation to durable container — wiki-edit ergonomics with SHACL guardrails at the durable boundary
- **Memory-substrate triggers (D74)**: `mem:*` AS2 vocab on LDN inbox (durable) + Solid Notifications Protocol (real-time); agent dispatches by `rdf:type`; agent identity has its own WebID + separate inbox
- **Three-tier access (D55)**: brute-force (spec) → harness (descriptors) → skills (`solid-agent-skills`). Maps cleanly onto L1 / L1+L2 / L1+L2+L3. Lower tiers always functional
- **TypeScript-first server** (D1): CSS + extensions + Comunica. Python is client-only (importer + SHACL dev)
- **Three-layer Pod RDF** (D10): blob content + LDP container structure + `.meta` sidecars + navigation indexes (now Type Index + Storage Description per D44)
- **Hybrid contextualized KG** (D57): blobs first-class (markdown, PDF, iCal); `.meta` contextualizes; both views legitimate per Verborgh 2022
- **Compile-once principle (D72)**: substrate maintains compiled, cross-referenced state; agents don't re-derive at query time
- **Agent-first, self-describing** (D33, D48): every concern is a linked-data resource; follow-your-nose; standard slots over invented endpoints
- **SHACL as guardrails** (D50): primary defense against agent hallucination at write boundary
- **`.meta` validation, never body** (D38): RDF Source vs Non-RDF Source split; body affordances first-class when descriptor-declared (D58)
- **Memento via Trellis convention** (D61): `?ext=timemap`, `?version=<14-digit>`; OriginalResource doubles as TimeGate
- **PARA + SKOS as L3-specific (D30, D34)**: PARA hierarchy + SKOS ConceptScheme partitions are the vault's L3 specialization — NOT substrate-level

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

- **RQ-Affordance-1**: descriptor format — declarative SHACL vs custom RDF vs hybrid (resolved for v1 by D79 hybrid stance; revisit for Rung 1.5)
- **RQ-Harness-1**: fabric namespace minting at `https://cogitarelink.org/ns/fabric#` — blocks all `fabric:*` predicates past prototype
- **RQ-Memento-1**: ACP fragmentation across time (D62 known limitation)
- **RQ-Memento-2**: Comunica `-d` propagation to federated sources (Round 4)
- **RQ-Federation-1**: cross-pod SPARQL federation works at all (gate for RQ-Memento-2)
- **RQ-Eval-1/2/3**: task suite, sub-agent config, GEPA convergence (Round 1 Rung 1.5)
- **RQ-Pod-4**: `.meta` traversal vs pre-built index (confirmed in Rung 1.4 — Comunica skips `text/markdown` `describedby`; workaround: explicit `default-graph-uri` params; deferred to Rung 1.5+)
- **RQ-Pod-6**: `.meta` richness vs query overhead (needs 100+ resource benchmarks)
- **RQ-Listener-1** (new, 2026-05-15): CSS `FileDataAccessor.writeMetadataFile()` overwrites `.meta` on every resource PUT before MonitoringStore event fires — Model A's preserve-agent-triples behavior requires reading pre-write state from alternate source. Mitigation paths: (a) pre-write Memento/git read; (b) `.meta.agent` sidecar CSS never touches; (c) PassthroughStore interception. Integration test xfailed. Rung 1.5 design question.
- **RQ-Hub-1** (new): Is N=3 the right hub threshold? Eval question for Rung 1.5.
- **RQ-Discovery-1** (new): Does the 7-step first-arrival ritual scale to agents arriving on cold Pods? Eval question for Rung 1.5.

## Resolved Research Questions

- RQ-Pod-1 (container vs metadata for partitions): **Metadata** — partitions are SKOS concepts in `.meta` (D30)
- RQ-Pod-2 (PARA-as-containers): **Viable** — validated with 15 containers, agent navigates successfully
- RQ-Pod-3 (minimum discovery path): **5 steps** — `.well-known/solid` → profile → Type Index → container `.meta` → SHACL shape (now via D44 storage description)
- RQ-Pod-5 (procedural memory location): **`/procedures/` container** with `sh:agentInstruction` in shapes

## Key Research Findings

### 2026-05-15 (afternoon) — L3 spec drafted (D75-D77) + audit findings
- **D75 revises D37** — drop rehype-rdfa step. The reasoning: under D58 dual-layer linking, RDFa-in-HTML would be a redundant third surface. LLM agents read raw markdown; SPARQL agents query `.meta`; humans use Obsidian-style rendered HTML. Nobody consumes RDFa-annotated HTML in practice. Rename `css/extensions/markdown-rdfa/` → `markdown-render/`.
- **D76 pins the L3 URI layout** — five typed containers (`/wiki/{pages,sources,people,procedures,working}/`), each with one SHACL shape per D77. Within `/wiki/pages/`, vault note types collapse via `vault:kind` predicate rather than container proliferation.
- **Slug algorithm rule S3a (drop leading `@`)** — explicit, not derived. Handles BibTeX citekey conventions without leaking `@` into URIs, RDF terms, or JSON-LD contexts. Three concrete LOD hazards prevented: JSON-LD keyword reservation conflict (sharpest — `@`-prefix terms get rejected/dropped by JSON-LD processors); Pandoc citation parser ambiguity; RFC 3986 URI encoding inconsistency (`@` vs `%40` mismatches across tools).
- **Non-markdown blobs use LDP RDFS/NR split (D38) directly** — co-locate with describing wiki page in same container, share slug stem. PDF/Word/image and markdown are architecturally identical to the substrate; only the L3 convention pins where they sit relative to their describing record. Rich extraction (PDF outline, OCR) is opt-in via D53 per-flavor descriptors.
- **Embed prefix `!`** is the only new wikilink syntax — `![[image.png]]` projects `vault:embeds` and triggers inline `<img>` rendering. The bare wikilink and class-hint forms cover everything else.
- **Vault import becomes a translation table** — 12+ vault L4 note types map to 5 L3 shapes. ~200 lines of Python; transient code; runs once during migration. The vault is a *legacy system the Pod replaces*, not an ongoing pipeline.
- **Audit confirms `MarkdownProjectionListener` doesn't exist yet**. The markdown-rdfa extension implements D37 (HTML+RDFa rendering) but not D58/D71 (`.meta` projection). The wikilinks/predicates/resolver modules are reusable for both renderer (D75) and listener (Rung 1.4).

### 2026-05-15 (morning) — Memory-substrate stratification from cross-system research
- **Three independent research traditions converge on the same substrate**: memory-provider plugins (Hermes ABC, Supermemory API), benchmark-tuned memory systems (ByteRover, MemGPT, xMemory, Hindsight, Mnemis, MemoryAgentBench, MemoryArena), and wiki-memory implementations (Karpathy, Ghumare, AKBP, agentmemory). Each tradition calls it differently — "provider abstraction", "structural commitments", "knowledge contract below the tools" — but the seven L2 invariants are the same set. AKBP's phrase is cleanest: substrate = the contract that survives when tools change.
- **W3C web standards are the natural carrier**: built from first principles, the Pod substrate (LDP + RDF + SHACL + Memento + LDN + Notifications + ACP) gives us all seven invariants because the standards were designed for the same distributed-knowledge problem. The convergence is structural, not coincidental. This is not "we copied Karpathy"; this is "first principles plus W3C primitives lands in the same place Karpathy and AKBP land empirically."
- **Dual-layer linking is the novel architectural commitment**: markdown wikilinks at the token layer + RDF predicates at the data layer, unified by D58 projection. AKBP and agentmemory each have one layer; our wiki-memory L3 has both — token-layer is what LLMs naturally read/write, data-layer is what SPARQL queries over and what federates. `MarkdownProjectionListener` is the concrete mechanism (analogous to `MementoCommitListener`).
- **Vault import role changes**: the vault is one L3 (or L4) consumer of wiki-memory, not the project's MVP. D5 superseded; D32 reframed. The importer becomes "vault → wiki-memory L3 → Pod" rather than "vault → Pod direct."
- **`.well-known/solid` already does most of what AKBP's `capabilities` endpoint does**. The Solid stack has been hiding the answer in plain sight; we just had to stratify it correctly.

### 2026-05-14 — Rung 1.1 implementation
- **MonitoringStore is the right CDC integration point** (D65). CSS already emits AS.Create/Update/Delete events on every resource write — no need for a fswatch/inotify sidecar. The in-repo ShapeValidationStore precedent (`PassthroughStore` subclass) proves the wrap-store pattern works for write-time hooks; the listener variant works for read-only event subscription.
- **CSS `addHeader` (HeaderUtil) accumulates, `setHeader` overwrites** — this is the key discovery that made RFC 7089 §4.1.1 advertisement clean (D67). A parallel MetadataWriter alongside `LinkRelMetadataWriter` can always append `rel="timemap"`/`rel="timegate"` and `Vary: accept-datetime` without conflicting with whatever CSS itself sets. Design header-bearing extensions around `addHeader` to compose, not collide.
- **`git add -- <path>` + `commit --only -- <path>` is required for per-path commit semantics** (D66). The naive `git add -A` lumps concurrent writes to sibling resources into the wrong commit, which breaks `git log -- <path>` and therefore per-resource TimeMap. Direct integration-test (`test_concurrent_writes_to_different_paths_produce_separate_commits`).
- **In-`.git/` lock files survive `git add -A`** — lock files in the worktree get staged into commits (we hit this); lock files inside `.git/` are excluded by git itself. D68 puts the memento mutex at `.git/memento.lock`.
- **Components.js `OverrideListInsertAt` against an empty list is broken in v8.0.0-alpha.3** (K1 known limitation). Reproducible `collectEntries` error. Worked around with `overrideParameters` (full replacement) of `WorkerParallelInitializer`; risk: silent drop of upstream additions. Revisit when the target list gets an entry to anchor against.
- **The `:next` Docker tag actually tracks v8.0.0-alpha.3**, not v7.1.9 stable as one research agent initially reported. Verified by reading `/community-server/package.json` in the running container. `markdown-rdfa`'s `@solid/community-server: ^8.0.0-alpha.3` devDep matches exactly.

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
