# SOLID Pod Decisions Index

Always loaded. Concise index of all architectural decisions. Vault is canonical source:
`~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`

## Phase 1 foundation (D1–D28)

D1: CSS + TypeScript extensions + Comunica sidecar — CSS Pod server, CSS extensions for `.well-known/` (WaterfallHandler), Comunica SPARQL-over-LDP sidecar. Python is client-only (importer, SHACL dev, RLM agents)
D2: Pod as fabric node type — participates in fabric via `.well-known/` (revised by D42: every node is a Pod)
D3: Comunica for Pod SPARQL — client-side SPARQL federation over LDP; no data duplication
D4: Oxigraph deferred — fabric metadata only (revised by D43: Oxigraph is first-class Pod backend)
D5: Vault-to-Pod as MVP — Agentic Memory Systems concept notes
D6: Markdown as primary document format — Markdown + YAML; Turtle `.meta` sidecars; JSON-LD navigation
D7: Frontmatter → RDF via SHACL shape — shape defines predicate vocabulary; default wikilink = `skos:related`
D8: Solid Type Index as primary machine-actionable navigation — RDF class → container URL (expanded by D45/D48 as view catalog)
D9: Dual-index pattern — Type Index (machines) + JSON-LD index (agents) + `.well-known/void` (fabric) + VAULT-INDEX.md (humans). Collapsed by D44 to Type Index + Storage Description + VAULT-INDEX
D10: Three-layer Pod RDF — Layer A: LDP containers (auto); Layer B: `.meta` sidecars (SHACL); Layer C: navigation indexes
D11: Shared SHACL shapes — define in fabric (revised by D46: domain-neutral upstream to `solid/shapes`)
D12: CoreProfile conformance — Pod declares `dct:conformsTo fabric:CoreProfile, fabric:SolidPodProfile`
D13: Comunica federation across Pod LDP + Oxigraph SPARQL — unified SPARQL; agent reasons about datasets, not servers
D14: `alsoKnownAs` DID-WebID bridge — identity bridge in first WebID profile (Phase 1 foundation)
D15: VoID feature flags — distinguish Pod-type (LDP browse) from triplestore-type fabric nodes
D16: OSLC Query 3.0 for Pod search — standard URL parameters on LDP container GET
D17: TRS 3.0 for change tracking — drives index sync; replaces filesystem watchers (D56 adopts Solid Notifications as external delivery)
D18: SQLite FTS5 + sqlite-vec — embedded hybrid search index sidecar
D19: CSS extensions as primary integration — Components.js DI for all customization; `.well-known/` via WaterfallHandler + RouterHandler
D20: PROV-O provenance on Pod resources — `prov:wasGeneratedBy/wasDerivedFrom/wasAttributedTo` in `.meta` sidecars
D21: Content integrity via `digestMultibase` — SHA-256 hashes in `.meta`; re-computed on TRS events
D22: `.well-known/sparql-examples` — behavioral SPARQL templates from SHACL shapes (revised by D44/D48 into storage description + LDP resources)
D23: TBox cache in `/ontology/` container — local ontology stubs for offline/constrained queries
D24: SSSOM crosswalk generation — wikilinks → URIs, tags → SKOS concepts, frontmatter keys → predicates
D25: VC lifecycle for Pod access — ACP + `acp:vc` matchers; Credo-TS sidecar issues VCs
D26: LDN inbox multiplexing — type-based dispatch for VC delivery, TRS change, IoT notifications
D27: Schema-level TRS freshness — re-harvest VoID catalog on data shape change, not every resource write
D28: CSS v8 Alpha for development — chosen server, includes `@solidlab/policy-engine` for ACP

## Phase 2 — CLI, structure, content discipline (D29–D41)

D29: General-purpose Solid Pod CLI — `solid-agent-skills` repo under LA3D, built on Bashlib + Comunica; not tied to cogitarelink
D30: PARA as container structure, memory partitions as metadata overlay — PARA = LDP layout; partitions = `.meta` triples via `vault:memoryPartition`
D31: `.meta` sidecars as source of truth — replaces YAML frontmatter as authoritative metadata. File-backed: `.meta` is source; graph-backed (D43): named graph is source, `.meta` is projected view
D32: Model 1 — one-way vault → pod import — vault stays authoring environment; importer decomposes content; no round-trip
D33: Agent-first, self-describing pod — agent discovers memory architecture via WebID → Type Index → VoID → SHACL → SPARQL. No `.claude/` injection
D34: SKOS as foundation vocabulary — first use of SKOS for end-user content in Solid ecosystem
D35: `pim:Workspace` for vault workspace — vault as `pim:Workspace` within `pim:Storage`; supports multiple workspaces
D36: Typed wikilinks via Pandoc attribute syntax — `[[Note]]{.class}` maps to RDF predicates (`.related` → `skos:related`, etc.)
D37: remark/rehype rendering pipeline as CSS RepresentationConverter — `text/markdown → remark-parse → wiki-link → rehype-rdfa → text/html`
D38: LDP RDFS/NR split as SHACL validation foundation — validates the `.meta` sidecar (RDF), never the body; targets RDF Source vs Non-RDF Source vs NR-with-body-affordances
D39: SHACL shapes ARE the per-content-type vocabulary registry — one shape per resource type; the shape file IS the documentation
D40: Deterministic timestamps from vault content — `dct:created`/`modified` from frontmatter or git history, never `os.path.getmtime`. PROV-O carries importer-run timestamp separately
D41: Markdown body affordances are advisory — `.meta` is authoritative for shape compliance (REVISED by D58 when descriptor declared)

## Phase 3 — Unified Pod Architecture (D42–D50)

D42: Unified Pod architecture — everything is a Solid Pod; storage backend (file/Oxigraph/hybrid) is implementation detail; one HTTP surface (revises D2, D4)
D43: Oxigraph as authoritative Pod storage backend — first-class via CSS `--sparqlEndpoint`; per-triple policy natural via query rewriting (revises D4)
D44: Storage Description Resource replaces `.well-known/void` — spec-mandated slot via `solid:storageDescription` Link header. Router, not manifest — points to browseable catalog containers via `rdfs:seeAlso`
D45: CONSTRUCT-based view projection over graph-backed Pods — multiple LDP views project from one named graph via `sh:SPARQLConstructExecutable` descriptors
D46: Shapes contributed upstream to `solid/shapes` — domain-neutral shapes go upstream; vault-specific shapes stay local (revises D11)
D47: `solid/object` as agent-side RDF-to-TS mapping — shape-derived typed TS classes; LDO as secondary fallback
D48: Agent affordance architecture (guiding principle) — every Pod concern is a linked-data resource with URI + typed `.meta` + Link headers. Follow-your-nose, progressive disclosure, standard-slot extension, containers over manifests
D49: Vocabulary grounding via `void:vocabulary` declarations — storage description MUST declare every RDF vocab used; each MUST be dereferenceable (canonical source or D23 TBox cache)
D50: SHACL shapes as agent guardrails — primary enforcement against agent hallucination at write boundary; shapes are both generation templates (read) and validation gates (write)

## Phase 4 — Externalization Substrate (D51–D60)

D51: Pod as general-purpose substrate for agentic applications — agentic memory is one specialization; to-do, calendar, project workspaces are others. Different views composed from spec primitives
D52: Affordance harness — per-content-type affordance descriptors at storage description root, declared as LDP resources at `/meta/affordances/<name>`. Closes Solid spec gap on body-affordance discoverability
D53: Per-flavor markdown affordance descriptors — Obsidian/MyST/Quarto/GFM each get own descriptor; multi-flavor support via composition not standardization
D54: Agentic-memory view — declarative policy at Pod (typed-edge vocab, Fano bound, lifecycle schema, container conventions); procedural algorithm at agent (ByteRover-style tiers, xMemory submodular selection)
D55: HATEOAS-correct three-tier access architecture — Tier 1 brute-force (spec-only) + Tier 2 harness (descriptor-aware) + Tier 3 skills (domain-specific). Lower tiers always functional even when higher used
D56: Adopt Solid Notifications Protocol for change feeds — WebSocket/Webhook/WebPush/LDN channels per use case. D17 TRS remains internal CDC; D56 is external delivery
D57: Hybrid storage as Verborgh's "hybrid contextualized KG" — blobs (markdown/PDF/iCal) are first-class citizens; `.meta` contextualizes them; both views first-class (formalizes D6/D10/D31/D43)
D58: Body affordances first-class when descriptor-declared — REVISES D41. With D52 descriptor in place, body wikilinks are equivalent navigation surface to `.meta` triples. CLI reads both, merges with provenance
D59: `solid/object` adoption — Phase 4 refactor detail for D47; integrate shape-generation pipeline into `solid-agent-skills` build
D60: Evaluation methodology — clean Claude Code sub-agents + metric harness + GEPA skill refinement. Compare agent performance across D55 tiers

## Phase 5 — Memento (D61–D64, 2026-05-06)

D61: Memento URI minting convention — Trellis-style query strings. OriginalResource doubles as TimeGate (RFC 7089 Pattern 1.1). TimeMap at `?ext=timemap`, Memento at `?version=<14-digit-datetime>`
D62: ACP applies to OriginalResource and inherits across all Mementos — no time-fragmented ACP in v1; RQ-Memento-1 tracks future need
D63: Standards-aligned vocabulary for pod-native versioning — mint nothing in v1. Reuse Memento + LDES + AS2 + PROV-O + VCDM + ACP
D64: Soft delete via tombstone + hard purge as VC-gated distinct operation — Layer 1: LDP DELETE → `ldes:DeletedLDPResource` + `as:Delete` commit (routine VC). Layer 2: `?ext=purge` → `git filter-repo` (elevated VC with `acp:purgeAllowed`). Layer 3 crypto-shredding deferred

## Open research questions

RQ-Affordance-1: descriptor format (declarative SHACL vs custom RDF vs hybrid)
RQ-Harness-1: fabric namespace minting at `https://cogitarelink.org/ns/fabric#` — blocks all `fabric:*` predicates
RQ-Memento-1: ACP fragmentation across time travel (when does D62 inheritance break?)
RQ-Memento-2: federated time travel — does Comunica propagate `Accept-Datetime` to every source?
RQ-Federation-1: cross-pod SPARQL federation works at all (untested; gate for RQ-Memento-2)
RQ-Eval-1/2/3: task suite design, sub-agent config, GEPA convergence
RQ-App-1/2: multi-application composition mechanics; cross-application agent routing
RQ-View-1: algebraic flows as richer alternative to CONSTRUCT (Phase 3 territory)
RQ-ACP-1: per-triple ACP via query-rewriting (meccano 2016 pattern)
RQ-Spec-1: spec issue #715 — SPARQL Update returning to Solid Protocol
RQ-Pod-4: Comunica `.meta` traversal vs pre-built index (blocked by link-traversal `.meta` gap)
RQ-Pod-6: `.meta` richness vs query overhead — needs benchmarks with 100+ resources

## References

Vault sources of truth:
- Decisions log: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`
- Plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md`
- Active plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Unified Externalization Prototype Plan.md`
- Memento vocab: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Memento Vocabulary Alignment.md`
- Phase 1 findings: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Solid Pod Phase 1 - Vertical Slice Findings.md`
- Infrastructure: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Self-Hosted Pod Infrastructure Design.md`

Design doc in this repo: `docs/plans/2026-04-01-pod-agentic-memory-structure-design.md`
