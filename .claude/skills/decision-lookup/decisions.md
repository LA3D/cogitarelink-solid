# SOLID Pod Decisions Index

Always loaded. Concise index of all architectural decisions (D1-D112, K1-K4). Vault is canonical source:
`~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`

## Skill cross-reference

Topic-coherent D-clusters surface as Claude Code skills at `.claude/skills/<name>/SKILL.md`:

| Skill | Decisions covered |
|---|---|
| `solid-spec` | D14, D44, D75 (Solid Protocol deltas) |
| `solid-servers` | D1, D28 (CSS architecture + v8 alpha) |
| `solid-data-modelling` | D34, D46, D77, D78 (vocab + SHACL + class-based targeting) |
| `solid-integration-guide` | D29, D14 (client libraries + DID bridge) |
| `solid-storage-description` | D44, D48, D49 (storage description as router) |
| `solid-affordance-descriptors` | D52, D55, D58 (body-affordance harness) |
| `solid-memento` | D61-D68, K1, RQ-Memento-1/2 (RFC 7089 + tombstones) |
| `solid-wiki-memory-l3` | D70-D81 (v1 choices, tested in Rung 1.5), H-D82 (hypothesis pending eval), K2-K3, RQ-Listener-1, RQ-Affordance-2/3/4 (L3 reference profile + affordance-spectrum hypothesis) |
| `solid-uri-conformance` | D84 (URI structure: hash-namespace, port-less HTTPS, extension-less vocab files; closes RQ-Substrate-3) |
| `solid-tls-deployment` | D85 (TLS deployment: mkcert dev, Caddy+LE prod) |
| `solid-profiles-and-conneg` | D86 (PROF + RFC 6906 + conneg-by-profile resource-kind hints) |

CSS-builder skills (no D-cluster but referenced by many decisions): `css-extension`, `components-override`, `metadata-writer`, `monitoring-store`, `comunica-sources`, `shacl-shapes`.

**D87 (capabilities-only overlay deps), D88 (tmpl: vocab), D89 (owner-identity overlay), D90 (agent↔human elicitation)** — Phase 5k substrate decisions; no dedicated skill yet. See Phase 5k section below.

**D91 (wiki-memory search layer)** — Phase 7 decision. No dedicated skill yet; buildable spec at `docs/plans/2026-05-17-wiki-search-design.md`.

**D92 (wiki-search walker — DataAccessor end-to-end)** — Phase 7a closeout decision. Supersedes provisional/retracted D91-walker-architecture (HTTP self-request rewrite). Design + findings doc: `docs/plans/2026-05-18-wiki-search-walker-redesign.md`.

**D93 (synthesis page as primary agent entry point) + D94 (mem: Action/Event vocabulary) + K4 (JSON-LD script tag is not RDFa)** — Memory Structuring Sprint. Design + plan: `docs/superpowers/specs/2026-05-18-memory-structuring-sprint-design.md` + `docs/superpowers/plans/2026-05-18-memory-structuring-sprint.md`. See "Memory Structuring Sprint" section below + the substrate-behavior findings recorded in the same section.

**D95 (Thing-as-top-class) + D96 (Page+Thing governance split) + D97 (FAIR vocabulary metadata invariant) + D98 (8-shape catalog, supersedes D77) + D99 (belt-and-braces disjointness) + D100 (L4 extension contract + URI-independent substrate)** — Wiki-Memory L3 Shape Completion Sprint (2026-05-19). Design + plan: `docs/superpowers/specs/2026-05-19-l3-shape-completion-design.md` + `docs/superpowers/plans/2026-05-19-l3-shape-completion-plan.md`. See "Wiki-Memory L3 Shape Completion Sprint" section below. Vault-D91 = repo-D95 … vault-D96 = repo-D100.

**D101 (MemTrigger detector wiring and substrate-signal delivery model)** — MemTrigger detector wiring sprint (2026-05-21). Closes D74 implementation gap. Design + plan: `docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md` + `docs/superpowers/plans/2026-05-20-mem-trigger-detector-wiring.md`. See "MemTrigger detector wiring sprint" section below.

## Phase 1 foundation (D1–D28)

D1: CSS + TypeScript extensions + Comunica sidecar — CSS Pod server, CSS extensions for `.well-known/` (WaterfallHandler), Comunica SPARQL-over-LDP sidecar. Python is client-only (importer, SHACL dev, RLM agents)
D2: Pod as fabric node type — participates in fabric via `.well-known/` (revised by D42: every node is a Pod)
D3: Comunica for Pod SPARQL — client-side SPARQL federation over LDP; no data duplication
D4: Oxigraph deferred — fabric metadata only (revised by D43: Oxigraph is first-class Pod backend)
D5: Vault-to-Pod as MVP — Agentic Memory Systems concept notes (SUPERSEDED by D70/D71/D72; vault import is one application of wiki-memory L3, not the project MVP)
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
D32: Model 1 — one-way vault → pod import — vault stays authoring environment; importer decomposes content; no round-trip (REFRAMED by D73: round-trip writes are the default at L2 working-memory; one-way is the vault L3's specific authoring discipline)
D33: Agent-first, self-describing pod — agent discovers memory architecture via WebID → Type Index → VoID → SHACL → SPARQL. No `.claude/` injection
D34: SKOS as foundation vocabulary — first use of SKOS for end-user content in Solid ecosystem
D35: `pim:Workspace` for vault workspace — vault as `pim:Workspace` within `pim:Storage`; supports multiple workspaces
D36: Typed wikilinks via Pandoc attribute syntax — `[[Note]]{.class}` maps to RDF predicates (`.related` → `skos:related`, etc.)
D37: remark/rehype rendering pipeline as CSS RepresentationConverter — `text/markdown → remark-parse → wiki-link → rehype-rdfa → text/html` (REVISED by D75: rehype-rdfa step dropped; rendered HTML serves humans only via semantic CSS classes, data layer lives exclusively in `.meta`)
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
D58: Body affordances first-class when descriptor-declared — REVISES D41. With D52 descriptor in place, body wikilinks are equivalent navigation surface to `.meta` triples. CLI reads both, merges with provenance. SHARPENED by D70/D71: implemented via `MarkdownProjectionListener` (analogous to `MementoCommitListener` in Rung 1.1) that materializes `.meta` triples from body wikilinks on write — enables dual-layer linking at single-request cost
D59: `solid/object` adoption — Phase 4 refactor detail for D47; integrate shape-generation pipeline into `solid-agent-skills` build
D60: Evaluation methodology — clean Claude Code sub-agents + metric harness + GEPA skill refinement. Compare agent performance across D55 tiers

## Phase 5 — Memento (D61–D64, 2026-05-06)

D61: Memento URI minting convention — Trellis-style query strings. OriginalResource doubles as TimeGate (RFC 7089 Pattern 1.1). TimeMap at `?ext=timemap`, Memento at `?version=<14-digit-datetime>`
D62: ACP applies to OriginalResource and inherits across all Mementos — no time-fragmented ACP in v1; RQ-Memento-1 tracks future need
D63: Standards-aligned vocabulary for pod-native versioning — mint nothing in v1. Reuse Memento + LDES + AS2 + PROV-O + VCDM + ACP
D64: Soft delete via tombstone + hard purge as VC-gated distinct operation — Layer 1: LDP DELETE → `ldes:DeletedLDPResource` + `as:Delete` commit (routine VC). Layer 2: `?ext=purge` → `git filter-repo` (elevated VC with `acp:purgeAllowed`). Layer 3 crypto-shredding deferred

## Phase 5b — Rung 1.1 implementation decisions (D65–D68, 2026-05-14)

D65: MonitoringStore-driven CDC over fswatch for Memento substrate — listen to CSS's native `'changed'` event (D17 internal CDC) instead of inotify/fswatch sidecar. Synchronous with the write, knows WebID + identifier + activity type, no second process, matches the architecture D17 already prescribes. (Original plan called fswatch a "spike hack"; in-repo `PassthroughStore` precedent in `shape-validator/src/storage/ShapeValidationStore.ts` proves the wrap-pattern is viable.)
D66: Per-path staging in commit listener — `git add -- <path>` + `commit --only -- <path>` per resource event, not `git add -A`. Reason: TimeMap-per-resource depends on `git log -- <path>` returning one commit per write to that path; `add -A` lumps concurrent writes from sibling resources into the wrong commits. Verified by `test_concurrent_writes_to_different_paths_produce_separate_commits`.
D67: Additive Link/Vary headers via `MementoLinkMetadataWriter` — CSS's `addHeader` accumulates Link entries across MetadataWriters, so a parallel writer that ALWAYS emits `Link: <...?ext=timemap>; rel="timemap", <orig>; rel="timegate"` and `Vary: accept-datetime` advertises Memento support per RFC 7089 §4.1.1 without conflicting with CSS's `LinkRelMetadataWriter`. Inserted after `MetadataWriter_LinkRel` in the `urn:solid-server:default:MetadataWriter` ParallelHandler. Closes a real conformance gap: Memento-aware clients can now discover the TimeMap from a plain GET.
D68: Filesystem lock for multi-worker safety — `.git/memento.lock` (in the git dir so it's outside the worktree and never staged) acquired via `O_CREAT | O_EXCL` open with stale recovery via mtime check. Wraps every `gitCommit{,Path}` call. Avoids `.git/index.lock` races between CSS workers. ~10 LOC, no extra dependency. Bare-minimum hardening for the "multi-worker mode in future deployment" case the reviewer flagged.

## Phase 5b — Known limitations (2026-05-14)

K1: `OverrideListInsertAt` against an empty handlers list reproducibly fails with a Components.js `collectEntries` error in v8.0.0-alpha.3. Worked around by `overrideParameters` (full replacement) of `urn:solid-server:default:WorkerParallelInitializer`; documented in `css/config/memento.json` with a revisit-when-target-exists note.

## Phase 5c — Documentation strategy (D69, 2026-05-14)

D69: Two-layer documentation strategy — Pod-resident agent instructions (Layer 1, Rung 1.4 territory: storage description + container `.meta` + affordance descriptors, served via HTTP, tells runtime agents how to navigate THIS Pod) AND repo-resident builder skills (Layer 2, restructured 2026-05-15: `.claude/skills/<name>/SKILL.md` subdirectory pattern with frontmatter, including upstream-derived solid-* skills synced via `scripts/sync_solid_skills.py` and local-only deltas; loaded by Claude Code via skill discovery; tells the author how to BUILD the Pod reliably). Layers are orthogonal; D33's "no .claude/ injection" applies only to Layer 1.

## Phase 5d — Memory substrate stratification (D70–D74, 2026-05-15)

Forced by cross-system pattern research (Hermes/Supermemory provider interfaces; ByteRover/MemGPT/xMemory/Hindsight benchmark systems; Karpathy/Ghumare/AKBP/agentmemory wiki-memory). Concept-level support from three research traditions for the seven L2 invariants (memory-provider plugins, benchmark-tuned memory systems, wiki-memory). **Important caveat (2026-05-15 evening audit)**: no single source names all seven invariants; the synthesis is ours. AKBP — the most concrete implementation in the lineage — explicitly took a *different* operational direction (parallel surfaces, structured API) than D71's body-projection choice. The convergence is real at the pattern layer, fictitious at the operational layer. See [[Affordance Spectrum for Agentic Memory]] and [[Memory Substrate vs Memory Profile]] for the corrected attribution.

D70: L1/L2/L3 substrate stratification — **L1** = Pod substrate (LDP/WAC/SPARQL/Memento/`.well-known/`/Solid-OIDC/LDN/Notifications Protocol — universal). **L2** = Memory substrate (seven invariants: bounded branching with typed containment, tiered/progressive retrieval, lifecycle metadata as first-class, explicit write + implicit signals, hybrid blob+graph storage, separable procedural memory, OOD honesty). **L3** = Memory profile (specific edge vocabulary + container layout + consolidation policy). Multiple L3 profiles can coexist on one Pod, scoped via Type Index + SHACL shape catalog + per-container affordance descriptors. The vault PARA+SKOS arrangement is one L3 specialization sitting on top of [[Wiki-Memory L3 Profile|wiki-memory L3]].

D71: Wiki-memory as canonical L3 reference profile — built from first principles on W3C web standards (not copied from Karpathy/AKBP). Page-as-unit; **body→`.meta` projection** is our distinct architectural commitment: markdown wikilinks at the token layer + RDF predicates in `.meta` at the data layer, unified by D58's body-affordance projection. AKBP — the most concrete implementation in the lineage — took the *opposite* direction (parallel surfaces, no projection; structured API for graph writes). v1 framing claimed "AKBP has one layer; we have both" — this is factually wrong, corrected by the 2026-05-15 evening audit. AKBP has two unprojected layers; we have two projected layers (our novel choice). Concept-level support from Karpathy/Ghumare/AKBP/agentmemory/Supermemory/ByteRover at the pattern layer (page-as-unit, typed edges, lifecycle, two-stage commit) does NOT extend to syntax, vocabulary, or projection mechanism — those are our committed choices. **FURTHER REVISED by D82** (affordance spectrum + inline JSON-LD blocks as second body affordance).

D72: Compile-once principle as substrate guarantee — the substrate maintains compiled, cross-referenced state (`.meta` triples projected from body; Type Index updated on resource creation; SHACL shape catalog cached); agents don't re-derive at query time. Karpathy's "stop re-deriving, start compiling" framing applied as L2 contract. Already true in practice via the importer pipeline; D72 elevates it to a stated substrate guarantee.

D73: Two-stage commit for memory writes — `working-memory/` container accepts low-ceremony body-only writes with permissive SHACL shape (cribbed from [[AKBP - Agent Knowledge Base Protocol|AKBP]]'s `remember`); `mem:Crystallize` operation validates against strict L3 profile shape and promotes to durable container (cribbed from AKBP's `crystallize`). Solves the Mattia83it critique on Ghumare's gist ("event-driven auto-ingest corrupts wikis when LLMs hallucinate") without abandoning the low-ceremony ergonomics agents need.

D74: Memory-substrate trigger vocabulary — `mem:*` AS2 extension delivered via LDN inbox (durable) and Solid Notifications Protocol (real-time): `mem:ConsolidationSuggested`, `mem:BoundExceeded`, `mem:ContradictionDetected`, `mem:ReflectionDue`, `mem:OODQuerySignal`. Each subclasses `as:Announce` / `as:Offer` and carries a SHACL shape. Substrate emits when SHACL rules flip (via MonitoringStore listener — same pattern as Memento commit listener). Agent dispatches by `rdf:type` to skill family. Agent identity has its own WebID + separate inbox, distinct from user inbox. Extends D26 (LDN multiplexing) with the memory-substrate vocabulary; closes the implicit-signals half of D70 invariant #4.

## Phase 5e — Wiki-memory L3 spec (D75–D77, 2026-05-15)

D75: Rendered HTML serves humans; no RDFa embedding (REVISES D37) — keep the remark/rehype pipeline for converting markdown to HTML for browser viewing, but drop the rehype-rdfa step. Rendered HTML carries semantic CSS classes only (`<a class="wikilink wikilink-{type}">`), no `property="vault:concept"` or other RDFa attributes. The data layer is exclusively `.meta` Turtle, projected from the same body by the `MarkdownProjectionListener` (D58 sharpened). RDFa would be a redundant third surface nobody reads — LLM agents read raw markdown, SPARQL agents query `.meta`, humans use Obsidian/IDE/browser-rendered HTML. The Obsidian Preview model is the reference. Implies a rename: `css/extensions/markdown-rdfa/` → `markdown-render/`.

D76: Wiki-memory L3 URI layout, slug algorithm, resolver, and attachment convention — the L3 reference profile commits to: (a) ~~**five typed containers** `/wiki/{pages,sources,people,procedures,working}/`~~ **(SUPERSEDED by D98: eight containers `/wiki/{concepts,people,places,organizations,events,procedures,working}/`; `pages`→`concepts`, `sources` merged into `concepts` as `wiki:Source ⊑ skos:Concept`)** (one SHACL shape each per D77/D98; flavor within a container distinguished by predicates not by sub-containers); (b) **slug algorithm with explicit S3a `@`-strip rule** (handles BibTeX citekey conventions without leaking `@` into URIs/RDF terms/JSON-LD contexts — prevents JSON-LD keyword collision, Pandoc citation ambiguity, RFC 3986 encoding inconsistency); (c) **class-hint resolver** — ~~`{.class}` annotation determines target container (`{.source}`/`@`-prefix → `/wiki/sources/`, `{.author}` → `/wiki/people/`, etc.)~~ **(SUPERSEDED by D106: the `{.class}` annotation determines the projected *predicate* (D36); the target *container* is resolved from the target's class via the Type Index, not the role. The role→container map was a layer violation that broke on D98's container rename.)**; (d) **attachment co-location** — non-markdown blobs (PDFs, images, Word docs) live alongside their describing wiki page in the same container, sharing slug stem; per-source folder is the promotion path for multi-attachment cases; (e) **embed prefix `!`** projects `vault:embeds` and triggers inline `<img>` rendering. URIs are absolute with `.md` suffix kept; rename ceremony and cross-pod federation deferred.

D77: Wiki-memory L3 SHACL shape catalog — five shapes, one per D76 container: `wiki:PageShape` (general wiki content, permissive), `wiki:SourceShape` (citation records with `dct:identifier` required), `wiki:PersonShape` (FOAF-based with `foaf:nick` aliases for cross-system linking), `wiki:ProcedureShape` (procedural memory with `sh:agentInstruction` carrying the procedure body), `wiki:WorkingNoteShape` (permissive per D73). Each carries `sh:agentInstruction` per D50. Flavor-within-shape pattern: 12+ vault L4 note types collapse into 5 L3 shapes distinguished by `.meta` predicates (`vault:kind`, `vault:isMOC`, `vault:isOrganization`) rather than separate containers. The vault L4 specialization extends via shape subclassing without modifying the L3 baseline. Shape files at `overlays/wiki-memory/shapes/{page,source,person,procedure,working}.shacl.ttl` (moved from the original `shapes/wiki-memory-l3/` path during the substrate-cleanup sprint, 2026-05-16; `concept.shacl.ttl` renamed to `page.shacl.ttl` to reflect the subclass model — `wiki:Concept rdfs:subClassOf wiki:Page`).

## Phase 5f — Rung 1.4 implementation decisions (D78–D81, 2026-05-15)

D78: **Class-based shape targeting** — shapes target `rdf:type` (wiki:Concept, wiki:Source, wiki:Person, wiki:Procedure, wiki:WorkingNote) rather than container paths. REVISES D77. Solid Type Index does double duty for routing; SHACL `sh:targetClass` with `rdfs:subClassOf` inference gives automatic shape dispatch. L4 specialization via subclass. **Implementation note**: `sh:class` value-type constraints (e.g., "the target of dct:references must be a wiki:Source") cannot be enforced in per-resource validation because cross-resource targets aren't in the data graph. Shapes use `sh:nodeKind sh:IRI` only; cross-resource integrity belongs in whole-Pod SPARQL ASK checks (deferred to Rung 1.5).

D79: **Hybrid vocabulary stance + JSON-LD context discovery** — DCT/SKOS/CiTO/FOAF/PROV by default; mint `wiki:*` (Resource/Concept/Source/Person/Procedure/WorkingNote/Hub/maturity) only for genuine gaps. JSON-LD context document at `/meta/context.jsonld` is the canonical prefix→IRI registry and the agent's vocabulary discovery surface. REVISES D71. Closes RQ-Vocab-1 by deferring namespace minting via `urn:example:wiki#` placeholder. **Implementation note**: Listener uses hardcoded class-hint table in `wikilinkProjection.ts` rather than reading the JSON-LD context at runtime. Context-driven dispatch is functionally equivalent for the *predicate* mapping and deferred to Rung 1.5 (no behavior change, just refactor). **(D106 sharpens: the hardcoded table is correct for predicate mapping but WRONG for container resolution — the container must come from the target's class via the Type Index, not a role→container guess.)**

D80: **Substrate-derived navigation classes** — `wiki:Hub` and breadcrumb chains are computed by Comunica CONSTRUCT views (D45 pattern), declared as `wiki:DerivedClassAffordance` / `wiki:DerivedNavigationAffordance` in the affordance catalog. Agent invocation pattern: on-demand for v1 — when agent needs hub info, runs the CONSTRUCT against `/sparql`. No materialization, no push, no D74 trigger. Materialize-then-push deferred to Rung 1.5+ once eval shows latency matters. REVISES D77's `vault:isMOC` predicate.

D81: **Predicate-level governance (Model A)** — SHACL shape declares which predicates the substrate governs. Listener owns triples where (subject = this resource) AND (predicate ∈ governed-set); agent owns everything else. On body write: DELETE governed-predicates, INSERT projection, leave non-governed alone. Sidesteps reification (no named graphs, no RDF-star, no per-triple prov tags). SHACL shapes stay `sh:closed false`; each shape documents its governed set via `sh:agentInstruction`. **Known limitation (RQ-Listener-1)**: CSS `FileDataAccessor.writeMetadataFile()` overwrites the `.meta` file completely on every resource PUT, before the MonitoringStore event fires. So agent enrichment via direct PATCH to `.meta` is lost when the body is rewritten. Mitigation paths for Rung 1.5: (a) read pre-write `.meta` state from Memento/git history before projection; (b) separate `.meta.agent` sidecar that CSS never touches; (c) intercept the PUT at the store layer (PassthroughStore pattern) so projection runs before CSS clears .meta. Unit tests validate Model A logic; integration test marked xfail with this diagnosis.

## Phase 5g — Rung 1.4 implementation notes (2026-05-15)

K2: `slug()` algorithm does not collapse consecutive hyphens. "Ghumare - LLM Wiki v2 Extending Karpathy" produces `ghumare---llm-wiki-v2-extending-karpathy` (triple-hyphen) because " - " (space-hyphen-space) maps each space to `-` independently. Trade-off accepted for v1; collapsing consecutive hyphens is a future refinement.

K3: `.author` class hint projects to `dct:contributor` (not `dct:creator`) in `wikilinkProjection.ts` HINT_TO_PREDICATE. SourceShape allows `dct:creator` (substrate-governed) but the listener never emits it from `.author` class hints. Result: the Phase 1 Ghumare fixture's `dct:creator` was changed to `dct:contributor` to match listener emission. Subsequent SPARQL queries for source authorship must use `dct:contributor`. Rung 1.5 may introduce a distinct `.creator` class hint for sources.

## Phase 5h — Hypothesis: Affordance spectrum + W3C vocabulary reuse (H-D82, 2026-05-15 evening)

Forced by the 2026-05-15 evening primary-source audit (Wiki-Memory L3 spec claims-vs-sources). Findings: Penfield Labs misattribution in v1; ByteRover validation overreach; AKBP repo audit revealed parallel-surface architecture (not body-projection) — see [[Affordance Spectrum for Agentic Memory]] and `docs/plans/2026-05-15-akbp-to-w3c-mapping.md`. **Second audit pass (same evening)**: realized AKBP/Penfield/DOT-LD/Karpathy/Ghumare are all **unmeasured** design proposals; only ByteRover (peer-reviewed 96.1% LoCoMo) and xMemory (peer-reviewed BLEU+23%) carry actual benchmark evidence. The "concept-level convergence" framing aggregates measured + unmeasured systems as if they had equal evidentiary weight; they don't. **Decisions in this phase are reframed as hypotheses pending Rung 1.5 measurement.**

H-D82 (HYPOTHESIS, not ratified decision): **Dual body affordance + W3C vocabulary reuse over `wiki:*` invention may improve agent memory authoring.** Three testable sub-hypotheses:

- **H-D82.a**: In-band class-hint wikilinks `[[Note]]{.class}` at affordance level 2 outperform plain `[[Note]]` (level 1) on agent navigation tasks. Status: untested; eval arm T-class vs B0/B1.
- **H-D82.b**: Inline `json-ld` code blocks at level 4 outperform class-hints-only on rich-claim tasks (confidence, evidence, supersession). Status: untested; eval arm T-jsonld vs T-class.
- **H-D82.c**: W3C standard vocabulary (`cred:credibility`, `dct:isReplacedBy`, `cito:disagreesWith`, etc.) is no worse for agent reliability than minted `wiki:*` aliases. Status: untested; sub-eval comparing vocab variants if H-D82.b holds.

**Status**: Hypothesis to *test* in Rung 1.5, not decision to *implement*. Design fully specified in `docs/plans/2026-05-15-d82-listener-extension-plan.md` + `docs/plans/2026-05-15-akbp-to-w3c-mapping.md` so implementation is unblocked *if* the eval supports H-D82. If eval refutes H-D82.b, the listener extension is not built — D82 ships as documented "design we considered but eval didn't support."

**The proposed design content** (concrete enough to test):

- (a) Class-hint wikilinks `[[Note]]{.class}` at level 2 (existing D36 form, kept).
- (b) Inline `json-ld` code blocks at level 4 (new, conditional on H-D82.b).
- Both project to `.meta` via `MarkdownProjectionListener`.
- Level-4 vocabulary: PROV-O, SKOS, DCT, CITO, FOAF, schema.org standards.
- Substitution candidates: `wiki:confidence` → `cred:credibility`; `wiki:supersedes` → `dct:isReplacedBy`; `wiki:contradicts` → `prov:wasInvalidatedBy` or `cito:disagreesWith`; lifecycle status → SKOS concept scheme; entity types → existing FOAF/schema.org/SKOS classes.
- Direct N3 PATCH to `.meta` (level 6) as escape hatch.

**Why hypothesis-not-decision**: AKBP (a primary source of the affordance framing) is itself unmeasured. The 0–6 affordance spectrum is useful *design vocabulary* but predicts no measurement outcome. Ratifying H-D82 without eval data would label speculation as commitment. **D77/D78/D81 are also v1 choices, not ratified decisions** — same epistemological status as H-D82; the redesigned Rung 1.5 (D102, 2026-05-23) is the empirical test.

**Implementation gates** (ALL must hold before listener extension code lands; gates updated per D102 redesign):
1. **Rung 1.5 Phase A must show affordances work** — if cold-start affordance utilization (Phase A trajectory + behavior judge against `wiki-search` and the affordance catalog) shows the affordance architecture doesn't actually help agents navigate, the entire wiki-memory L3 direction is in doubt and H-D82.b is moot.
2. **Rung 1.5 Phase B1 must support H-D82.a** — if body class-hints `{.class}` don't add value over frontmatter typing during Karpathy Ingest + Query-with-file-back round-trip tasks, then inline JSON-LD blocks (which build on the same in-band typing thesis) won't either.
3. **RQ-Listener-1 mitigation chosen and shipped** — agent triples must survive body rewrites.
4. **Inline JSON-LD value (conditional, separate study)** — if H-D82 is ever revisited as a listener-extension proposal, a separate eval must show inline JSON-LD adds value beyond class-hints. If not, ship class-hints as final, document the negative result.

The original four-E-experiment matrix (`docs/plans/2026-05-15-rung-1-5-eval-matrix.md`, superseded 2026-05-23) is retained for historical input. Current design: `docs/plans/2026-05-23-rung-1.5-redesign-design.md`.

**See also**: [[Affordance Spectrum for Agentic Memory]] (foundational design vocabulary, also reframed as hypothesis-bearing); `docs/plans/2026-05-15-d82-listener-extension-plan.md` (implementation design, eval-gated); `docs/plans/2026-05-15-akbp-to-w3c-mapping.md` (vocabulary translation table, structurally correct; behavioral claims pending eval); `docs/plans/2026-05-23-rung-1.5-redesign-design.md` (current Rung 1.5 design that tests this hypothesis along with D77/D78/D81 et al).

## Phase 5i — Substrate cleanup + Pod-as-toolkit framing (2026-05-15 / 2026-05-16)

Forced by Sprint 1 pod-discover eval surfacing three substrate inconsistencies
(PARA legacy in base template, shape files at wrong path, Comunica running as
docker service) that all expressed one architectural problem: pre-D70 infrastructure
not stripped when wiki-memory L3 landed.

Full design at `docs/superpowers/specs/2026-05-15-substrate-cleanup-design.md`.
Implementation tracked in `docs/superpowers/plans/2026-05-15-substrate-cleanup-plan.md`.

### D83 — Pod as self-describing toolkit (capability catalog)

The Pod is a **self-describing toolkit**, not a database. Three discoverable layers:

1. **L1** = standard Solid Protocol (LDP, WAC, Memento, storage description, etc.).
2. **Substrate capabilities** = generic primitives the Pod offers. Three shipped in v1
   (`cap:ContentProjection`, `cap:DerivedView`, `cap:TimeTravel`), each implemented by a
   CSS extension + advertised via a `cap:Capability` descriptor at
   `/vault/meta/capabilities/<name>.ttl`. Four planned but not yet shipped
   (`cap:TwoStageCommit`, `cap:TriggerEmission`, `cap:ValidationHook`, `cap:ReferenceCatalog`)
   — D74's `mem:Crystallize` is the candidate first implementation of `cap:TwoStageCommit`.
3. **Installed applications** = composable peer overlays declaring `cap:requires`
   against the catalog. Wiki-memory is the canonical first overlay (pre-installed).

Mechanically:
- Overlay machinery (`scripts/overlay/{apply,remove,verify}.py`) installs, removes,
  and verifies applications. Idempotent via PUT (overwrite-safe) + N3 Patch (insert-safe).
- Composability via manifest-tracked PATCH-merge — multiple overlays accumulate triples
  on shared substrate resources (storage description, Type Index, JSON-LD context);
  each removable separately via its manifest's bill of triples (wiki:installedBy tag).
- Vocabulary dereferenceability per D79: Pod-local Category 3 hosting (`/vault/ontology/<vocab>.ttl`)
  for app-specific vocabularies; standard W3C vocabularies (SKOS, DCT, PROV, CITO, FOAF)
  remain external with TBox cache.

### Reframes / sharpens of prior decisions

- **D70 reframed**: "L2 = memory substrate" becomes "L2 is occupied by applications,
  of which memory (wiki-memory) is one type." Non-memory applications (calendar, todo)
  live at the same layer with different invariants.
- **D71 unchanged**: wiki-memory still the canonical first application; dual-layer
  body+meta architecture stays.
- **D77 superseded by subclass model**: shapes are class-targeted with `rdfs:subClassOf`
  reasoning. Base shape (`page.shacl.ttl`) covers wiki:Page and its subclasses
  (wiki:Concept, wiki:MOC, future vault:TheoryNote). Five-container layout (D76) stays.
- **D78 sharpened**: class-based shape targeting applies up the subclass chain.
- **D79 strengthened**: hybrid vocab stance + dereferenceable class IRIs via Pod-local
  hosting (Path X), with w3id.org migration as deferred future (Path Y).

### Architectural commitments (seven invariants)

1. L1 = standard Solid Protocol; invent only where standards don't exist.
2. Capabilities are RDF resources discoverable via the capability catalog.
3. Applications are overlays — installable, composable, removable, declaring
   required capabilities.
4. Structure is data (overlays); behavior is code (CSS extensions). Capability
   catalog is the contract between them.
5. Pod-defined vocabularies dereference on the Pod itself.
6. Agents bring their own SPARQL (Pod publishes derived-view descriptors, doesn't
   host the engine).
7. Skills bridge substrate self-description to agent action patterns. Generic
   agents using only L1 still succeed; skills are accelerants, not gatekeepers.

## Phase 5j — URI conformance + TLS + profile-based resource-kind hints (D84–D86, 2026-05-16)

Forced by RQ-Substrate-3 (namespace mismatch between `void-description.json` and
overlay-managed `.meta`) which surfaced a deeper problem: vocabulary IRIs baked
deployment details (port 3000, http scheme) into class identifiers. Research
across Solid official guidance, W3C profile stack (PROF + conneg-by-profile +
RFC 6906), and OGC SELFIE conventions consolidated in
`.claude/skills/solid-uri-conformance/` (authoritative reference + templates +
project deltas).

### D84 — URI conformance commitments

Per-Pod application vocabularies live on the Pod itself (Pod is the namespace
authority); cross-Pod shared profiles live at `w3id.org/cogitarelink/`. All
vocabulary IRIs are **HTTPS, port-less, hash-namespaced, mnemonic-classed,
extension-less**. Three app-local vocabs:

- `https://pod.vardeman.me/vault/ontology/wiki#`
- `https://pod.vardeman.me/vault/ontology/capability#`
- `https://pod.vardeman.me/vault/ontology/overlay#`

Vocabulary files at extension-less paths (`/vault/ontology/wiki` with `Content-Type: text/turtle`).
CSS handles RDF conneg automatically. Solid Protocol §3.1 trailing-slash MUST is honored
(document vs container cannot coexist at the same stem). URI normalization (Solid spec
issue #22 unresolved) — always normalize before compare. Closes **RQ-Substrate-3**. Full
guidance lives in the `solid-uri-conformance` skill; this entry is the canonical commitment.

**Scope note (D111, 2026-06-05):** "all vocabulary IRIs are Pod-hosted / hash-namespaced" applies to **application** vocabularies (wiki/capability/overlay). Foundational **external** vocabularies (`idot:`, `datacite:`) keep their canonical external IRIs under the D49/D109 declare-or-ground policy — D111 follows this. The D111 fragment-datatype form (`…/id/schemes/#doi`) is itself a canonical *application* of D84's hash rule (a Pod-hosted, hash-namespaced datatype IRI).

### D85 — TLS deployment

Solid Protocol §3 mandates HTTPS. Dev: **mkcert** local CA + CSS native `--httpsKey`/`--httpsCert`
flags, certs cover `pod.vardeman.me` + `localhost` + `127.0.0.1` + `::1`, 825-day validity
(macOS user-CA cap). Production: **Caddy + Let's Encrypt DNS-01** against a real registered
subdomain — same hostname dev↔prod so vocabulary IRIs don't change again. Critical client gotcha:
**Node.js doesn't read macOS Keychain** — Comunica, Bashlib, inrupt-client-authn-node all need
`NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem` in shell + container env. Python httpx needs
`SSL_CERT_FILE` likewise. HSTS off in dev (Chrome pinning), on in prod (start `max-age=300`,
ratchet). CSS healthcheck switches from `http://localhost:3000/` to `https://localhost:3443/`
(container-internal `-k` is fine; not user-facing). Fallback if CSS v8 alpha lacks `--httpsKey`:
Caddy as TLS terminator + CSS plain-http behind, same external URL.

### D86 — Profile-based resource kind declaration (PROF + RFC 6906)

Every typed resource declares **both** what KIND of thing it is (`rdf:type wiki:Concept`)
and what CONSTRAINTS apply (`dct:conformsTo wiki:ConceptProfile`). Class IRI ≠ Profile IRI —
`prof:Profile rdfs:subClassOf dct:Standard` requires the profile be its own resource. SHACL
shapes are **artifacts inside profiles**, not profiles themselves — `prof:hasResource →
prof:ResourceDescriptor → prof:hasRole role:validation → prof:hasArtifact <shape-file>`.

**Implementation surface**:

- 5 PROF profile descriptors at `/vault/meta/profiles/{page,concept,source,person,procedure,working}`
- New CSS extension `css/extensions/profile-link/` — `MetadataWriter` emits `Link: <profile-IRI>; rel="profile"`
  on every resource GET (parallels D67 `MementoLinkMetadataWriter`, additive `addHeader` not `setHeader`)
- `?_profile=alt` introspection view (spec-reserved token is `alt`, not `alternates`)
- Profile catalog discovery: `<storage> rdfs:seeAlso </vault/meta/profiles/>` + typed `wiki:profileCatalog` pointer
- Custom role `wikirole:affordance` for D52 affordance descriptors (none of the 8 standard PROF
  roles fit; GeoSPARQL precedent for minting custom roles)

**Standards-stack caveats (cited honestly in the skill)**:

- W3C PROF is a Working Group Note, not a Recommendation (§7/§8/§11 normative, rest informative)
- W3C Conneg-by-Profile is a Working Draft, not REC
- RFC 6906 (`Link: rel="profile"`) is the only IETF-published piece — **Informational** (March 2013), not Standards-Track; the link relation is IANA-registered
- IETF `draft-svensson-profiled-representations-01` **expired 10 Sept 2021**; never adopted as a WG document. `Content-Profile` header lives nowhere live — DO NOT emit it
- PROF `dct:conformsTo` property chain axiom (§8.4.2) is "at risk" (Issue 1078) — emit
  `prof:isTransitiveProfileOf` explicitly instead of relying on reasoners
- PROF role registry "at risk" (Issue 1073) but extension is permitted by §8.5

Sharpens **D44** (storage description as router) and **D52** (affordance descriptors) at the
per-resource level. D44 declares the Pod has profiles; D86 declares each individual resource's
profile membership.

### D87 — Capabilities-only overlay dependencies

The capability catalog at `/vault/meta/capabilities/` is the **only** mechanism
for overlay-to-overlay and overlay-to-extension coupling. Overlays declare what
they need via `overlay:requiresCapability` (already existing) and what they
provide via `overlay:providesCapability` (newly added). At install time,
`scripts/overlay/apply.py` iterates `providesCapability` and PUTs each capability
descriptor into the catalog; existing `requiresCapability` checks the catalog for
the descriptor at the required `cap:minVersion`.

**Deprecated and removed from machinery**:

- `overlay:dependsOnOverlay` — was overlay-level coupling; superseded by capability-level coupling
- `overlay:installedOverlay` — was installation tracking in `.well-known/solid`; was unworkable because CSS returns 405 on PATCH to the storage description (which is now intentionally static per `css/config/void-description.json`)
- `check_overlay_dependencies()` in `apply.py` — fully removed

**Why capabilities over overlays for coupling**:

1. **Atomic** — overlays can split/merge/rename without breaking consumers, as long as the same capabilities still exist somewhere
2. **Substitutable** — multiple overlays can provide the same capability; consumers don't care which
3. **Version-aware** — `cap:minVersion` already in the model
4. **Runtime-mutable** — `/vault/meta/capabilities/` is a normal LDP container; no CSS-extension workarounds
5. **Honest** — the dependency is on the artifact actually consumed, not the wrapper

Completes **D83** (Pod-as-toolkit) for overlay-to-overlay coupling. Resolves the deferred-decision flag in `solid-uri-conformance/references/deltas.md`. Full rationale in `docs/plans/2026-05-16-capabilities-only-overlay-deps.md`. First consumer is the AddressBook overlay (declares 3 requires + 5 provides); wiki-memory was retrofitted to declare 4 provides.

**Clarification (D111, 2026-06-05):** "the capability catalog is the only mechanism for overlay coupling" is about *capability* coupling. `overlay:registersScheme` (D111) is **resource registration** — an overlay declaring it contributes a Pod-infrastructure resource (an identifier scheme record) — a different axis from overlay-to-overlay capability coupling, not a second coupling mechanism.

### D88 — `tmpl:` substrate template vocabulary

Templates are a first-class substrate artifact class — RDF skeletons paired with
a SHACL shape via `tmpl:validatesAgainst`. Agents fetch a template before write
operations to front-load structured context, fill `<<PLACEHOLDER>>` values, and
PUT the result. SHACL backstops; on violation, the response body carries a
parseable `sh:ValidationReport` (D88's implementation requires the shape-validator
extension to serialize the report — done in `css/extensions/shape-validator/`,
commits `0f1295f` + `056f18d`).

**Vocabulary** at `https://pod.vardeman.me/vault/ontology/template#` (Pod-hosted
per D84):

- `tmpl:Template` — the document class
- `tmpl:validatesAgainst` → SHACL shape IRI
- `tmpl:operation` → "PUT" | "PATCH" | "POST"
- `tmpl:targetContainer` → where filled templates land
- `tmpl:slugAlgorithm` → "uuid4" | "kebab-case-mnemonic" | etc.
- `tmpl:templateBody` → the literal Turtle skeleton

**Overlay machinery support**:

- `overlay:installsTemplate` predicate (new) — overlays declare which templates they install
- `scripts/overlay/apply.py` iterates `manifest.templates` and PUTs each to `/vault/meta/templates/`
- `scripts/overlay/verify.py` checks deployed templates round-trip

**Discovery**:

- `wiki:templateCatalog → /vault/meta/templates/` advertised in storage description (`.well-known/solid`)
- Cold agents can find templates without prior knowledge of any specific overlay

**Trajectory token cost argument** (the substrate-pattern rationale):

- Template fetch (~200 tokens) + happy-path PUT (~50 tokens) on success
- vs error-loop trajectory (1000s of tokens across multiple retries) when only SHACL is present without templates
- Templates eliminate ~90% of SHACL hits by giving the agent the right shape upfront; SHACL catches the residual

First consumer: AddressBook overlay (5 templates: contact-create, contact-update, org-create, group-create, membership-create). Pattern is general — any overlay with write operations should provide templates. Generalization to wiki-memory shapes (currently no templates) is post-Rung-1.5.

## Phase 5k — owner-identity overlay + setup-owner skill suite (D89–D90, 2026-05-17)

### D89 — Owner-identity overlay as substrate-level concern

**Status:** Ratified (2026-05-17). Confirmed by the first end-to-end cold-session run: agent invoked `solid-owner-identity`, walked human through Phase A elicitation, minted Person + Org + Membership cards via `solid-addressbook` (Phases B/C), minted wiki person page with bridge `.meta` triples via `solid-wiki-memory-l3` (Phase D), PATCHed `/vault/profile/card` with all MUSTs + SHOULDs + the `org:hasMembership` MAY (Phase E), and marked `prefs:setupOwnerCompleted true` (Phase F). The "follow-the-nose" A+C design held: a single dereference of the WebID returns both `foaf:isPrimaryTopicOf <wiki-page>` AND the inlined `<wiki-page> a wiki:Person` typing.

**Decision:** The Pod-owner identity contract (enriched WebID profile per spec + extensibility to VCs, DIDs, ACL ownership) is a distinct substrate concern, not a sub-feature of AddressBook. It gets its own overlay (`overlays/owner-identity/`) **above** AddressBook in the D87 capability stack.

**Rationale:** The identity stack will grow — VC issuance (`cred:credentialSubject`), DID bridging (`alsoKnownAs <did:web:...>` per D14), ACL ownership (`acl:owner`), multi-WebID Pods (`solid:account`) — none of these are AddressBook concerns. Keeping the WebID profile shape + enrichment template in a separate overlay leaves room for that growth without renaming AddressBook's responsibility. Pod-owner identity is the agent's *self-document*; AddressBook is the agent's *contact directory*. Different abstraction layers.

**Implications:**

- **Capability deps**: owner-identity *requires* AddressBook (for `vcard-individual-substrate` and `tmpl-vocabulary v1.1`) + wiki-memory (for `foaf-primarytopic-bridge`).
- **Capabilities provided**: `pod-owner-identity` (top-level), `webid-profile-shape`, `pod-owner-preferences-shape`, `webid-enrich-template`, `prefs-init-template`.
- **Spec grounding**: PodOwnerWebIDShape's MUSTs match Solid WebID Profile editor draft (`foaf:Agent`, `pim:preferencesFile`); operational MUSTs (`solid:oidcIssuer`, `pim:storage`, `solid:publicTypeIndex`) reflect what the Pod requires for the owner role specifically.
- **Severity model**: spec MUSTs as `sh:Violation` (block writes); enrichment SHOULDs as `sh:Warning` (advisory, don't block); rich-identity MAYs as `sh:Info`.
- **`tmpl:targetResource` predicate** (added to `tmpl:` vocab, bumping to v1.1) — first PATCH-flavor template support. `webid-enrich.ttl` is the first consumer.
- **`overlay:installsResourceMetaPatch`** — new manifest predicate parallel to `installsContainerMetaPatch`. Patches `.meta` of specific resources (not just containers). Used by owner-identity to add `dct:conformsTo` + `ldp:constrainedBy` to `/vault/profile/card.meta`.
- **Follow-the-nose discovery (A+C combined)**: the webid-enrich template body inlines `<wiki-page> a wiki:Person` alongside the `foaf:isPrimaryTopicOf` triple, so an LLM dereferencing the WebID recognizes the L3 agentic-memory record in a single round-trip.

**See also:** D14 (DID-WebID bridge via `alsoKnownAs`), D44 (storage description router), D70 (L1/L2/L3 stratification), D77/D78 (5-shape catalog + class-based targeting), D81 (predicate-level governance Model A), D83 (Pod-as-toolkit), D86 (PROF-based resource-kind), D87 (capabilities-only deps), D88 (tmpl: vocab).

**First consumer / implementation:** `overlays/owner-identity/` (manifest + 2 shapes + 2 templates + 5 capability descriptors + 1 resource `.meta` patch). Agent skills at `~/dev/git/LA3D/agents/solid-agent-skills/skills/{solid-addressbook,solid-wiki-memory-l3,solid-owner-identity}/`.

**Companion docs:**
- Design: `~/dev/git/LA3D/agents/solid-agent-skills/docs/superpowers/specs/2026-05-17-pod-owner-setup-skill-design.md`
- Implementation plan: `~/dev/git/LA3D/agents/solid-agent-skills/docs/superpowers/plans/2026-05-17-pod-owner-setup-skill.md`

### D90 — Agent↔human elicitation via `pim:preferencesFile`

**Status:** Ratified (2026-05-17). Confirmed by the first cold-session run: agent created `/vault/settings/prefs.ttl` from the prefs-init skeleton, walked the human through three required questions (fullName / orcid / wikiSlug) plus five optional (primaryAffiliationROR / membershipRole / membershipStart / email / foafImg), PATCHed each answer to prefs.ttl as elicited, and validated against `PodOwnerPreferencesShape` before proceeding. The `setupOwnerCompleted` boolean marker is in place; idempotent re-run testing pending in a follow-on cold session.

**Decision:** The per-Pod-owner preferences resource (`/vault/settings/prefs.ttl`, declared via `pim:preferencesFile` on the WebID per Solid WebID Profile §4 MUST) is the canonical agent↔human elicitation surface. The substrate ships `PodOwnerPreferencesShape` as the elicitation contract — required fact set + regex patterns drive the agent's one-question-at-a-time walk-through, with persistence after every answer.

**Rationale:** Spec-mandated (every conforming WebID profile MUST declare exactly one `pim:preferencesFile`), private (post-ACL: `acl:owner`-only), and per-Pod-owner. The natural home for owner-authored facts (name, ORCID, affiliation, slug preferences) that drive substrate-level setup. Avoids inventing a new vocabulary for what the spec already provides. The agent reads the shape's `sh:agentInstruction` to learn the walk-through protocol, then asks the human one fact at a time, persisting via PATCH after each answer.

**Implications:**

- **`prefs:` vocabulary** at `/vault/ontology/owner-prefs` (Pod-hosted per D84). 11 terms: 1 class (`PodOwnerPreferences`) + 10 properties (3 required: `fullName`, `orcid`, `wikiSlug`; 7 optional: affiliation/role/dates/email/avatar + `setupOwnerCompleted` marker).
- **Idempotence marker**: `prefs:setupOwnerCompleted true^^xsd:boolean` short-circuits re-runs of the SetupPodOwner procedure.
- **Authoritative self-declaration**: the prefs file holds the human's answers, not facts inferred from CLAUDE.md / project memory / other sources. The skill explicitly instructs agents not to substitute.
- **First-class extensibility**: `sh:closed false` — additional `prefs:*` predicates can be added without shape change (e.g., when future sprints add VC/DID elicitation steps).

**See also:** D7 (sh:agentInstruction), D52 (affordance descriptors — prefs.ttl is the elicitation analog), D88 (tmpl: vocab — prefs-init template uses it), D89.

### Authoritative skills (one per D-decision)

- `.claude/skills/solid-uri-conformance/` — D84 URI structure. Invoke before minting any IRI.
- `.claude/skills/solid-tls-deployment/` — D85 TLS deployment. Invoke when setting up HTTPS or debugging cert trust.
- `.claude/skills/solid-profiles-and-conneg/` — D86 PROF + conneg-by-profile. Invoke when designing profile descriptors or answering "what kind of resource is this?".
- D87 design doc: `docs/plans/2026-05-16-capabilities-only-overlay-deps.md`. Invoke when designing overlay deps or extending overlay machinery.
- D88 design doc + first consumer: `docs/plans/2026-05-16-agentic-addressbook-design.md` (AddressBook design, template+SHACL+feedback pattern), `docs/plans/2026-05-16-capabilities-only-overlay-deps.md`, `docs/superpowers/plans/2026-05-16-addressbook-substrate.md`. Invoke when adding write operations to an overlay or designing template-driven substrate pipelines.

Each skill is self-contained (no vault references), cites primary sources only (W3C / IETF / Solid Project), and is portable outside this repo.

## Phase 7 — Wiki-memory L3 search layer (D91, 2026-05-18)

### D91 — Wiki-Memory L3 Search Layer (OSLC Query 3.0 + grep-first, Solid-native)

**Status**: Ratified 2026-05-18 (Phase 7a shipped, commits b064a79..4905731 in cogitarelink-solid + b17be6f in solid-agent-skills).

**Note on numbering**: The vault assigns this decision as D87 (2026-05-17/18), but D87-D90 are already taken in the repo by the capabilities/templates/owner-identity/prefs sprint. This decision is numbered **D91** in the repo to avoid collision. The vault file will eventually be updated to reflect the canonical numbering; until then, vault references to vault-D87 = repo-D91.

**Decision**: Implement the wiki-memory L3 search layer as a CSS extension exposing **OSLC Query 3.0** semantics (OASIS Standard, 2021) on `/wiki/` containers, with **pure Node `RegExp`** as the Phase 1 engine behind a `SearchEngine` interface (WASM ripgrep, BM25 backends deferred as Phase 7b swap targets behind the same interface). Search is **Solid-protocol-native end-to-end**: standard HTTP + Solid-OIDC/DPoP, LDP-conformant Turtle response, Claude Code skills issue HTTP calls directly. **No MCP translation layer.** Promotes the deferred D16/D17/D18/D19 cluster ("OSLC Query + TRS for Pod Search") to Phase 7, sequenced after Sprint 2 (`pod-read`).

**Engine phases**:

| Phase | Engine | Discovery token |
|---|---|---|
| **7a** (Phase 1) | Pure Node `RegExp` (no external deps; sufficient at ~100-1000 page wiki-memory scale) | `?ext=search-grep` |
| **7b** | BM25 — MiniSearch (in-memory) OR SQLite FTS5 (persisted) | `?ext=search-bm25` |
| **7c** | Hybrid RRF fusion over 7a ∪ 7b | `?ext=search-hybrid&alpha=…` |
| **7d** (deferred) | ESPRESSO-pattern WebID-partitioned in-pod index resources | backend swap behind `?ext=search-bm25` |

**API contract** (stable across all phases):

```http
GET /vault/wiki/
Link: </vault/wiki/?ext=search-grep>; rel="http://open-services.net/ns/core#queryBase"; title="ripgrep"
Link: </vault/wiki/?ext=search-meta>; rel="http://open-services.net/ns/core#queryBase"; title="SPARQL over .meta"

GET /vault/wiki/?ext=search-grep&oslc.searchTerms=progressive+disclosure&oslc.where=vault:kind="concept"
→ LDP container with ldp:contains members + oslc:score per match (OSLC Query §6.4)
```

**Why grep-first**: three evidence sources — (1) Sen 2026 (`@sen-2026-grep-harnesses`): inline grep beats inline vector retrieval on LongMemEval for verbatim-span questions; (2) Letta MemFS production system uses grep over a git-backed markdown directory with no index; (3) Karpathy's 100-page personal wiki uses `qmd` (custom grep wrapper). At wiki-memory scale (~100-1000 pages), grep latency is sub-100ms.

**Why no MCP**: the Pod's HTTP surface (LDP + WAC + OSLC Query + Solid Notifications) is already the agent's interface contract. MCP would add a second protocol with zero capability gain for this deployment. Comunica becomes an in-process library import inside each skill.

**Capability discovery**: registered via D83 capability catalog at `/vault/meta/capabilities/` (overlay descriptor `wiki-search-substrate.ttl` + affordance descriptor `wiki-search-grep.ttl`). Pod speaks OSLC vocabulary in response (`oslc:score`, `oslc:totalCount`, `oslc:ResponseInfo`) for forward-compat but does NOT claim to be a fully-conformant OSLC ServiceProvider.

**Skill surface** (in `solid-agent-skills`, post-Sprint-3):
- `wiki-search` — picks dialect by question shape; issues HTTP GET to `?ext=search-*` endpoint
- `wiki-meta-query` — SPARQL over `.meta` via Comunica library
- `wiki-backlinks` — follows existing `Link: rel="backlinks"` header (D45)
- `wiki-read-page` — fetches body + `.meta` as paired structured response

**CSS extension shape**: HttpHandler component (pattern as in `MementoHttpHandler.ts`) intercepting container GETs with `?ext=search-grep` query param. `interface SearchEngine { search(body: string, pattern: SearchPattern): Match[] }` with `RegexpSearchEngine` as Phase 1. ~600-1200 LOC across 8-15 files.

**Refines**: D16 (OSLC Query — now ratified, not deferred), D18 (SQLite FTS5+sqlite-vec — engine choice for Phase 7b; deployment-location revised to WebID-partitioned in-pod resources per ESPRESSO pattern). D17 TRS superseded by D56 Solid Notifications for change feeds.

**Buildable spec**: `cogitarelink-solid/docs/plans/2026-05-17-wiki-search-design.md`

**Open questions filed as RQs**:
- RQ-Search-1: Score normalization formula for grep (`score = min(100, 10*match_count + 10*unique_terms/total_terms)` — validate empirically)
- RQ-Search-2: Should `?ext=search-grep` support `oslc.where` for combined text + structured filter? v1: post-filter via Comunica
- RQ-Search-3: Phase 7d WebID-partitioned index interaction with `MarkdownProjectionListener` on ACL change (deferred)
- RQ-Search-4: Should search response include `MarkdownProjectionListener`-emitted typed-edge triples as match context?
- RQ-Search-5: Cross-container search — per-container only in v1; pod-root search is Phase 5/multi-application concern

**See also**: D16 (OSLC Query), D17 (TRS — superseded by D56), D18 (SQLite FTS5+sqlite-vec, location revised), D19 (CSS extension pattern), D44 (storage description as router), D45 (CONSTRUCT view / `?ext=…` affordance pattern — search reuses), D55 (three-tier access), D58 (body affordances first-class), D71 (wiki-memory L3 dual-layer linking), D83 (Pod-as-toolkit capability catalog), D87-D90 (capabilities/templates/owner-identity sprint).

### D92 — Wiki-Search Walker Uses DataAccessor End-to-End

**Status**: Ratified 2026-05-18 (commit `2f2f28b` in cogitarelink-solid). Vault sync as D88 (vault sequence; vault-D88 = repo-D92).

**Note on numbering**: The vault assigns this decision as D88 (continuing the vault's own sequence after vault-D87 = repo-D91). The repo numbering is canonical for sequential D-references in code and commits going forward.

**Supersedes**: Provisional D91-walker-architecture ("HTTP self-request rewrite", commit `eb37bb7`) — retracted 2026-05-18 after a spike showed the recorded narrative bundled two independent fixes and credited the wrong one. The architectural soundness gap (credential forwarding to HTTP self-requests is impossible under Solid-OIDC DPoP binding) is documented in `FOLLOWUPS.md` and `docs/plans/2026-05-18-wiki-search-walker-redesign.md`.

**Decision**: The wiki-search walker uses `DataAccessor` for **all** Pod data access — container enumeration via `getChildren()`, document metadata via `getMetadata()`, document bodies via `getData()`. No `ResourceStore.getRepresentation()` calls anywhere in the walker. The `PermissionReader` gate remains the security boundary; the `Credentials` object propagated to the gate inherits the request's full auth context automatically.

**Why DataAccessor end-to-end (not the originally-planned hybrid)**: Path 1a originally specified `DataAccessor` for seed enumeration + `ResourceStore` for descendants. Integration testing during the sprint revealed two additional crash modes beyond the originally diagnosed re-entrant lock:

1. **Re-entrant lock on request target** (originally diagnosed) — `store.getRepresentation(target)` deadlocks because the outer request holds the target's lock.
2. **Container body drain hangs on subcontainers** (new finding) — fresh lock; `N3StreamWriter` (CSS's lazy container Turtle serializer) doesn't drain cleanly when consumed inside a handler.
3. **Document stream consumption hangs/crashes** (new finding) — `node:internal/streams/end-of-stream` uncaught exception with a callback-shape mismatch in `readable-stream`.

Root cause is a stream lifecycle bug in CSS's wrapping of `N3StreamWriter` / `Guarded<Readable>` — manifests whenever a handler tries to drain a stream rather than pipe it to a response. Not root-caused (CSS-internal). `DataAccessor.getData()` returns the raw file `Readable` and bypasses CSS's fragile stream wrapping entirely.

**Security model**: unchanged from the original Path 1a analysis. CSS v8 has no permission-aware store wrapper, so both `ResourceStore` and `DataAccessor` are privileged-by-design at the data layer. The `PermissionReader` gate is the security boundary either way. The trade-off properties Path 1a's analysis identified (per-agent inheritance, ACP conjunctive matching, federation readiness, future VC support) come from the `Credentials` object propagated to the gate, not from going through `ResourceStore`.

**Performance**: p95 latency improved from 26.7ms (HTTP self-request architecture) to **7.6ms** (DataAccessor end-to-end) on the existing perf-smoke corpus — 3.5× faster. The HTTP round-trip per resource was paying for the wrong architecture.

**Test status**: 77/77 unit tests pass (walker test mocks rewritten to DataAccessor shape); 13/13 non-skipped integration tests pass. Six `TestWacScenarios` integration tests remain stubbed pending an authenticated-client fixture shared with `test_addressbook_e2e.py` — deferred per behavior-before-security sequencing (agent credential storage / DPoP / VC delegation design is downstream of behavior eval).

**Files**:
- `css/extensions/wiki-search/src/walker.ts` — full rewrite
- `css/extensions/wiki-search/src/WikiSearchHttpHandler.ts` — dropped `ResourceStore` dep, added `DataAccessor` dep
- `css/extensions/wiki-search/tests/walker.test.ts` — mocks rewritten with fake DataAccessor
- `css/extensions/wiki-search/tests/WikiSearchHttpHandler.test.ts` — constructor positional args
- `css/config/wiki-search.json` — Components.js wiring (`dataAccessor` injected as `urn:solid-server:default:FileDataAccessor`)
- `docs/plans/2026-05-18-wiki-search-walker-redesign.md` — design note + implementation findings section

**See also**: D91 (wiki-memory search layer — D92 closes out the walker architecture decision left open after D91 ratified the API surface); `solid-identity-stack` skill (`references/dpop.md` documents why credential forwarding to HTTP self-requests is architecturally impossible under Solid-OIDC).

## Memory Structuring Sprint (D93, D94, K4, 2026-05-18)

### D93 — Wiki-Memory L3 Synthesis Page as Primary Agent Entry Point

**Status**: Ratified 2026-05-18 (Memory Structuring Sprint Phase A shipped). Vault sync as D89 (vault sequence; vault-D89 = repo-D93).

**Decision**: The wiki-memory L3 substrate exposes one well-known agent entry point at `/vault/wiki/index.md` (a regular resource, NOT the trailing-slash container URL — CSS rejects PUT on container URLs with the body ignored) as a dogfooded wiki-memory page. The page returns three representations: `text/markdown` body, `text/turtle` `.meta`, and rendered HTML with embedded JSON-LD in a `<script type="application/ld+json">` block.

Cross-references from every SHACL shape's `sh:agentInstruction`, the storage description's `wiki:profileDocument` predicate, the PROF descriptor at `/vault/meta/profiles/page` (`prof:hasResource` with `prof:role wikirole:overview`), and the inbox/event container `.meta` resources all point back to the synthesis (U-shape reinforcement). The synthesis carries a navigation principle near the top declaring three layered dereferencing primitives (resources, Link headers, vocabularies-as-Linked-Data) and a "follow your nose" instruction so blind agents can bootstrap the schema by dereferencing class IRIs.

Parallels the emerging entry-point pattern in `llms.txt` (Howard / fast.ai), A2A `/.well-known/agent.json` (Google), and NLWeb's schema.org-embedded discovery (Microsoft + Schema.org), but uses Solid-native vocabularies (LDP, AS2, SHACL, PROF, VoID, PROV-O, RFC 6906) throughout.

Serves two agent use cases simultaneously: skilled agents (using `solid-wiki-memory-l3` or per-action skills) and blind agents (generic web clients with only HTTP + RDF parsing).

**See also**: D44 (storage description as router), D52 (affordance descriptors), D58 (dual-layer linking), D70/D71 (L3 stratification), D75 (rendered HTML; K4 clarifies JSON-LD compatibility), D77/D78 (shape catalog + class-based targeting), D84/D86 (URI conformance + PROF), `docs/superpowers/specs/2026-05-18-memory-structuring-sprint-design.md`.

### D94 — `mem:` vocabulary: Action / Event taxonomy with proto-grounded parents

**Status**: Ratified 2026-05-18 (Memory Structuring Sprint Phase B shipped). Vault sync as D90.

**Decision**: The wiki-memory L3 memory-action vocabulary is published at `https://pod.vardeman.me/vault/ontology/mem` (hash-namespace per D84) with two top-level Classes — `mem:Action` (categories of agent action; not messages; standalone) and `mem:Event` (substrate-emitted analysis activities; subclass of `as:Activity`). Twelve subclasses follow.

**Refinement during the sprint** (over the original spec): renamed from `mem:Operation` to `mem:Action` to align with schema.org Action's proto-knowledge in LLM training data. The original spec also defined a third top-level category `mem:Announcement` with six past-tense subclasses (Crystallized, Superseded, etc.); the sprint **collapsed this category** in favor of the COAR Notify multi-typing pattern — agents post `as:Announce` activities multi-typed with the same `mem:*Action` class used in the PROV-O record. The vocabulary shrunk from 18 to 14 classes.

**Action subclasses** (six): `CrystallizeAction` (rdfs:subClassOf as:Move), `SupersedeAction` (schema:ReplaceAction), `MergeAction` (no clean proto parent), `DemoteAction` (as:Undo), `ArchiveAction` (as:Delete), `LinkAction` (as:Add).

**Event subclasses** (six): `BoundExceeded` (no proto parent), `ContradictionDetected` (as:Flag), `ConsolidationSuggested` (as:Offer), `ReflectionDue` (no proto parent), `OODQuerySignal` (no proto parent), `UnprocessableWrite` (as:Reject).

Proto-grounded subclass inheritance lets an LLM dereference any `mem:*` class and learn its semantics from the AS2 / schema.org parent the model already knows from pre-training. Where no clean proto-match exists (multi-source merge, Fano-bound, scheduling, ML OOD signals), the subclass inherits only from `mem:Action` or `mem:Event` — accept the inventiveness.

Memory actions are performed as direct LDP CRUD sequences (per Model B — LDN is NOT the primary write API, just the side channel for events). The action's type is recorded in the resulting resource's `.meta` via `prov:wasGeneratedBy`. After completing an action, the agent posts an `as:Announce` activity multi-typed with the same Action class to `/vault/wiki/.operations/`.

Events are emitted by the `MemTriggerListener` CSS extension on cross-resource analysis. v1 has the listener attached but most detectors stubbed pending substrate hook integration (per `FOLLOWUPS.md "Phase C.10 wiring scope + deferrals"`).

**FAIR enrichment**: every `mem:` term carries `rdfs:label`, `rdfs:isDefinedBy`, `rdfs:comment`, `skos:scopeNote`, `skos:example` (inline Turtle), and `rdfs:seeAlso`. The wiki: vocab was simultaneously FAIR-enriched and gained 5 new affordance-descriptor predicates (`wiki:action`, `wiki:precondition`, `wiki:postcondition`, `wiki:errorMode`, `wiki:procedure`) plus 7+ previously-orphaned storage-description terms (`wiki:L3Profile`, `wiki:typeIndex`, `wiki:shapeCatalog`, etc.).

Refines D74 (which named five `mem:*` triggers as a category) by enumerating the full Event set, adding the Action category, and collapsing the spec's planned Announcement category.

**See also**: D73 (two-stage commit; `CrystallizeAction` is the durable-promotion verb), D74 (the original `mem:*` trigger framing), D58 (dual-layer linking; .meta is where PROV-O lives), D81 (predicate-level governance; affects `LinkAction`), D17/D65 (MonitoringStore CDC; `MemTriggerListener` builds on this), D56 (Solid Notifications), AS2/PROV-O specifications. `docs/superpowers/specs/2026-05-18-memory-structuring-sprint-design.md`.

### K4 — JSON-LD `<script>` Tag in Rendered HTML is Not RDFa (D75 Clarification)

**Status**: K-note, 2026-05-18.

**Clarification**: D75 ("Rendered HTML Serves Humans; No RDFa Embedding") forbids RDFa attribute-tangled markup. Embedded JSON-LD `<script type="application/ld+json">` blocks are not RDFa — they're cleanly separable from HTML body markup, follow the schema.org / NLWeb / Google Knowledge Graph pattern, and serve agents who chose HTML as their representation. The `markdown-render` extension's emission of JSON-LD script tags (per the Memory Structuring Sprint Phase A; `JsonLdScriptInjector`) is therefore compatible with D75's framing.

The motivation for D75 (avoiding maintenance complexity from attribute-tangled triples interleaved with display markup) does not apply to script tags. The injected JSON-LD comes from the resource's `.meta` triples (filtered to subject = the resource IRI); the rendered HTML body remains RDFa-free.

**See also**: D75, this sprint's design doc.

## Substrate-behavior findings (Memory Structuring Sprint, 2026-05-18)

Discovered while running the Phase B + Phase C integration tests against live CSS. Worth recording as durable substrate constraints (RQ-CSS-* etc. may be filed against these in future):

1. **CSS returns HTTP 205** (Reset Content) for successful PUT-update and DELETE, not 204. Test assertions accept (200, 201, 204, 205).
2. **Memento returns HTTP 410 Gone** for deleted resources with prior Memento history — correct RFC 7089 tombstone semantics. Test assertions accept (404, 410) for "resource gone."
3. **N3 Patch rejects blank nodes in `solid:inserts` formulas** (HTTP 422 "An N3 Patch delete/insert formula can not contain blank nodes"). PROV-O activity nodes MUST use named fragment URIs (e.g., `<resource#act-{timestamp}>` or `<urn:uuid:...>`), NOT the `[a mem:Action]` blank-node syntax. The affordance descriptor `wiki:procedure` instructions imply blank-node patterns; agents performing actions must translate to named URIs. Skolemization is also a viable workaround for nested blank nodes in SHACL ValidationReports (see UnprocessableWriteDetector implementation).
4. **Memento version URIs are available immediately** after first PUT — the TimeMap at `{resource}?ext=timemap` returns a `memento:Memento` entry with a `?version=YYYYMMDDHHMMSS` URI usable for `prov:wasRevisionOf` from the next PUT.
5. **Storage description PATCH returns HTTP 405** ("Only GET requests can target the storage description"). The storage description is fully static via Components.js `void-description.json`; runtime PATCH is not supported. `apply.py` logs a warning and continues — overlay data remains discoverable via the static config + per-resource `.meta` patches.
6. **Components.js Override enforcement**: only ONE Override per instance is allowed at preprocess time. Multiple Overrides targeting the same `urn:solid-server:default:<Instance>` raise `ErrorResourcesContext: Found multiple Overrides targeting...`. Last-imported does NOT win; pre-flight rejection. Workaround: consolidate. Per K1 (pre-existing), some Override variants (`OverrideListInsertAt` vs empty list) have separate edge cases.

## Wiki-Memory L3 Shape Completion Sprint (D95–D100, 2026-05-19)

Vault sync: vault-D91 = repo-D95 … vault-D96 = repo-D100.

Design + plan: `docs/superpowers/specs/2026-05-19-l3-shape-completion-design.md` +
`docs/superpowers/plans/2026-05-19-l3-shape-completion-plan.md`.

Sprint tag: `wiki-l3-shape-completion-complete` (Phase H Task 30).

Test counts at close: ~94 TypeScript unit tests + ~53 Python local tests + 19–20 Phase G live-Pod integration tests green. Pre-existing test failures (`test_synthesis_page`, `test_mem_operations` DemoteAction) are Memory Structuring Sprint domain — out of scope for this sprint.

### D95 — Thing-as-top-class architecture (2026-05-19)

**Status**: Ratified 2026-05-19 (Wiki-Memory L3 Shape Completion Sprint).

`schema:Thing` is the L3 top class for the wiki-memory substrate. Every Thing has an IRI at the page's `<#this>` hash fragment; pages are 1-to-1 with Things; the two are bridged by `schema:mainEntity` (page → Thing) and `schema:mainEntityOfPage` (Thing → page). Wikilinks project as Thing-to-Thing edges via `#this` resolution. Body markdown wikilinks `[[Target]]{.class}` produce `<#this> <predicate> <target.md#this>`. Codifies the Wikidata-style identifier-vs-page separation precedent applied to all L3 Things (not just People as in D89/D90).

**Why `schema:Thing` not `wiki:Thing`**: schema.org `Thing` is saturated in LLM training data; minting `wiki:Thing` as a parallel root would add OOD surface with no benefit. `schema:Thing`'s `schema:name` / `schema:identifier` / `schema:sameAs` predicates are exactly the predicates needed for the Thing side of the two-subject model. Codifying the Wikidata pattern makes the model legible to agents that know neither this codebase nor wiki-memory L3.

**Implications**: Every typed wiki resource now has two subjects: `<>` (the page resource, `wiki:Page`) and `<#this>` (the Thing, `schema:Thing`). The `MarkdownProjectionListener` projects wikilinks to `<#this>` edges; the `PageShape` governs `<>` edges; per-type Thing-shapes govern `<#this>` edges.

**See also**: D89/D90 (owner-identity: first instance of `#this` pattern for people), D96 (Page+Thing governance split), D98 (shape catalog with PageShape + ThingShape).

### D96 — Page+Thing predicate-level governance split (2026-05-19)

**Status**: Ratified 2026-05-19.

Extends D81 Model A: the page resource `<>` and the Thing `<#this>` have disjoint governed-predicate sets. `PageShape` governs `<>` predicates (`dct:title`, `schema:mainEntity`, `wiki:maturity`, `dct:created/modified`, `prov:wasGeneratedBy`, `wiki:embeds`); Thing-shapes (per type) govern `<#this>` predicates (`schema:name`, `schema:mainEntityOfPage`, `schema:identifier`, `schema:sameAs`, type-specific edges, etc.). The `MarkdownProjectionListener`'s N3 Patch delete clause scopes wildcard patterns per subject; agent-owned predicates outside the governed set are preserved across body rewrites.

**Why disjoint sets are necessary**: without subject-scoped governance, a body rewrite that clears all `<>` predicates would also clear `<#this>` predicates (or vice versa), destroying whichever subject the listener does not own. Subject-scoped DELETE patterns make the governance contract explicit and testable.

**Implementation note**: the listener emits two N3 Patch envelopes per write (one `DELETE` + `INSERT` pair per subject). If the body declares no typed wikilinks, the `<#this>` envelope degenerates to a no-op `DELETE { } INSERT { }`.

**See also**: D81 (Model A, governed-predicate invariant), D95 (Thing-as-top-class — the architectural reason two subjects exist), D98 (shape catalog — PageShape and ThingShape both reference the governed sets in `sh:agentInstruction`).

### D97 — FAIR vocabulary metadata invariant (2026-05-19)

**Status**: Ratified 2026-05-19.

Every minted class, property, and shape carries: `rdfs:label`, `rdfs:comment`, `rdfs:isDefinedBy`, `dct:conformsTo`, `dct:created`, `dct:creator`. Ontology resources additionally carry `vann:preferredNamespacePrefix` and `vann:preferredNamespaceUri`. `sh:agentInstruction` is reserved for procedural prompt content (substrate-governance lists, wikilink hints, model-collapse defenses, extension pointers) — never for descriptive prose.

Reference precedent: `mem.ttl` from D94 (the Memory Structuring Sprint). Cross-batch test `test_fair_metadata_present.py` enforces the invariant.

**Exception**: `resource.shacl.ttl` (the D38 LDP RDFS/NR guard shape) is exempted as a pre-D97 artifact; retrofit pending — see FOLLOWUPS.md.

**Why this matters for agents**: `rdfs:label` + `rdfs:comment` are the first two triples an LLM agent sees when it dereferences a class or property IRI. Without them, the agent must infer semantics from the local name only — prone to hallucination at the vocabulary boundary. FAIR metadata converts the vocabulary from a namespace directory into a self-describing ontology.

**See also**: D84 (Pod-hosted vocabulary IRIs), D49 (dereferenceable vocabulary constraint), D94 (mem.ttl as the reference implementation), `test_fair_metadata_present.py` in `tests/`.

### D98 — L3 shape catalog: 8 SHACL NodeShapes (2026-05-19)

**Status**: Ratified 2026-05-19. **Supersedes D77.**

The wiki-memory L3 shape catalog comprises 8 SHACL NodeShapes (11 shape files total):

- `wiki:PageShape` (targets `wiki:Page`, subject `<>`) — page metadata: title, maturity, created/modified, mainEntity, embeds, wasGeneratedBy
- `wiki:ThingShape` (targets `schema:Thing`, abstract parent on `<#this>`) — common Thing predicates: name, identifier, sameAs, mainEntityOfPage, description
- `wiki:ConceptShape` (targets `skos:Concept`) — adds skos:prefLabel, skos:definition, skos:broader, skos:related, skos:inScheme
- `wiki:PersonShape` (targets `schema:Person`) — adds schema:givenName, schema:familyName, schema:email, owl:sameAs anchors, org:hasMembership
- `wiki:PlaceShape` (targets `schema:Place`) — adds schema:geo, schema:containedInPlace, schema:address
- `wiki:EventShape` (targets `schema:Event`; `sh:not [ sh:class mem:Event ]`) — adds schema:startDate, schema:endDate, schema:location, schema:organizer; disjoint from mem:Event
- `wiki:OrganizationShape` (targets `schema:Organization`) — adds schema:legalName, schema:address, org:hasMember, owl:sameAs
- `wiki:HowToShape` (targets `schema:HowTo`; `sh:not [ sh:class mem:Action ]`) — adds schema:step, sh:agentInstruction procedure body, wiki:precondition, wiki:postcondition; disjoint from mem:Action

Plus preserved `wiki:WorkingNoteShape` (D73 permissive, targets `wiki:WorkingNote`), preserved `resource.shacl.ttl` (D38 LDP guard, pre-D97 artifact), and new `template.shacl.ttl` (L4 exemplar per D100).

**Container layout updated**: `/wiki/{concepts,people,places,events,organizations,procedures,working}/` replaces D76's `/wiki/{pages,sources,people,procedures,working}/`. The Type Index maps each `schema:*` + `skos:Concept` class to its container.

**Supersedes D77**: D77's five-shape catalog (Page, Source, Person, Procedure, WorkingNote) is retired. `SourceShape` → `wiki:ConceptShape` (concept-first) — the scholarly source use case is served by `dct:identifier` on any Thing shape. `ProcedureShape` → `wiki:HowToShape` (schema.org grounded).

**See also**: D77 (superseded), D78 (class-based shape targeting — unchanged), D95 (Thing-as-top-class — architectural reason for PageShape + ThingShape split), D96 (governance split), D99 (belt-and-braces disjointness — enforced by EventShape + HowToShape `sh:not` clauses).

### D99 — Belt-and-braces disjointness enforcement (2026-05-19)

**Status**: Ratified 2026-05-19.

Cross-stratum disjointness between content shapes (e.g., `schema:Event`) and substrate signals (e.g., `mem:Event`) is enforced at three layers:

- **Layer 1 — OWL declaration** in `wiki.ttl`: `schema:Event owl:disjointWith mem:Event` and `schema:HowTo owl:disjointWith mem:Action`. Documentation; reasoners enforce.
- **Layer 2 — Shape-validator path constraint** (CSS extension config): `pathBasedClassConstraint` rejects `mem:*` PUTs to content paths (`/wiki/events/`, `/wiki/procedures/`) and `schema:*` PUTs to the operations inbox (`/wiki/.operations/`), returning a named-disjointness `sh:ValidationReport` body on HTTP 422. **Skips `.meta` resources** — the substrate-internal/agent-content distinction means `.meta` files may legitimately carry both `mem:*` and `schema:*` triples (e.g., `prov:wasGeneratedBy mem:CrystallizeAction` alongside `schema:mainEntity`).
- **Layer 3 — SHACL `sh:not` constraints** in `wiki:EventShape` and `wiki:HowToShape`: `sh:not [ sh:class mem:Event ]` and `sh:not [ sh:class mem:Action ]` respectively. Catches mixed-typing in the request body before it reaches the store.

Substrate-side symmetric constraints on `mem:Event` / `mem:Action` shapes (disallowing `schema:*` type co-occurrence on operations) deferred to the MemTriggerListener detector wiring sprint (next-plan #2).

**Why belt-and-braces**: the three layers catch disjointness violations at different points in the request lifecycle and for different failure modes (incorrect container target, mixed body typing, ontology reasoner queries). No single layer alone is sufficient for production; all three together are cheap and compositional.

**Path constraints skip `.meta` resources**: `.meta` files are substrate-internal and routinely carry mixed vocabularies (content provenance, substrate governance, PROF conformsTo, Memento timestamps). Applying content-stratum constraints to `.meta` would reject legitimate substrate writes. This distinction is a durable substrate-behavior finding (see substrate-behavior findings below).

**See also**: D74 (mem:* triggers — the substrate signals being kept separate), D94 (mem: vocabulary — the exact classes being guarded), D98 (EventShape + HowToShape carry the Layer 3 `sh:not` clauses), D38 (D38 LDP guard — structural companion).

### D100 — L4 extension contract (URI-independent substrate) (2026-05-19)

**Status**: Ratified 2026-05-19.

**Five-step extension procedure** for any L4 application built on the wiki-memory L3:

1. **Pick a schema.org parent class** (or `schema:Thing` as fallback).
2. **Mint a domain prefix** and declare it at a Pod-hosted ontology resource (per D84).
3. **Write a SHACL shape** — clone from `template.shacl.ttl`; set `sh:targetClass`; add governed predicates + `sh:agentInstruction`.
4. **Register class in Type Index** — `<class-IRI> → <container-URL>`.
5. **Package as an overlay** — manifest declares `overlay:requiresCapability wiki-l3` + all `overlay:installsShape`, `overlay:installsTemplate`, `overlay:installsContainerMetaPatch` entries.

**Substrate is URI-independent**: any container an overlay registers in the Type Index gets full substrate treatment — two-subject `.meta` projection (D95/D96), wikilink projection (D58), FAIR governance (D97), disjointness enforcement (D99) — without a `/wiki/` prefix requirement. The `MarkdownProjectionListener` resolves Thing class via the live Type Index (refresh-on-miss + `DEFAULT_WIKI_TYPE_INDEX` fallback). D78's class-based dispatch is the canonical "do I govern this?" oracle. The substrate is agnostic to container naming; it follows the Type Index, not path patterns.

**Artifacts shipped**:
- `template.shacl.ttl` — L4 exemplar shape with inline comments at every required field
- `/vault/meta/extending-l3.md` — worked example manual (typed `wiki:ExtensionGuide`) walkthrough using a fictional `biz:Equipment rdfs:subClassOf schema:Product` class
- Extension boilerplate in every L3 shape's `sh:agentInstruction` (pointer to the extension guide + 5-step summary)
- `overlay:installsHintMapping` manifest predicate — overlays register new class-hint → predicate mappings (e.g., `{.equipment}` → `biz:hasEquipment`) without patching the listener's hardcoded table

**Validation**: integration test `test_l4_extension_stub.py` with `biz:Equipment` fixture validates (a) L4 shape validates against L3 ThingShape `sh:node` chain; (b) apply.py installs and verify.py confirms; (c) a `biz:Equipment` page passes SHACL and produces correct `<#this>` `.meta` projection. Cold-agent interpretation of the extension contract is a **Rung 1.5 empirical eval task** (RQ-Discovery-1 family) — not a pre-merge gate for this sprint.

**See also**: D78 (class-based dispatch via Type Index), D83 (Pod-as-toolkit), D87 (capability-level overlay deps), D88 (tmpl: vocabulary), D95–D99 (the L3 invariants the extension inherits).

## MemTrigger detector wiring sprint (D101, 2026-05-21)

### D101 — MemTrigger detector wiring and substrate-signal delivery model (2026-05-21)

**Status**: Ratified 2026-05-21.

**Closes D74**: wires all four `mem:*` event detectors into the substrate, closing the
implementation gap left by the Memory Structuring Sprint (D93/D94). All four detectors
(`BoundExceededDetector`, `UnprocessableWriteDetector`, `ContradictionDetector`,
`ReflectionDueDetector`) produce `mem:*` AS2 activities archived to `/.events/`.

**Delivery model (A + C combined)**: Pattern A — agent harness queries `/.events/` after
each write for events targeting the just-written URI. Pattern C — harness (or external
follower agent) holds a Solid Notifications subscription against `/.events/` for streaming
delivery (the only natural channel for `mem:ReflectionDue`, which is timer-driven).
Pattern B (atomic in-response `Link` headers — synchronous detector firing pre-response +
MetadataWriter) is deferred to RQ-Atomic-Feedback-1.

**Two-hook DI pattern**: two abstract-class hook interfaces cross extension boundaries.
`IUnprocessableWriteHook` is injected into `ShaclValidator`; `IPostProjectionHook` is
injected into `MarkdownProjectionListener`. No-op defaults ship in the producer extensions
(`NoOpUnprocessableWriteHook` in shape-validator; `NoOpPostProjectionHook` in
markdown-projection). When mem-trigger is installed, `css/config/mem-trigger.json`
Overrides swap the real implementations in. Extension behavior in mem-trigger-free
environments is byte-identical to pre-D101.

**PendingEventsBuffer** (module-level singleton): `MemTriggerUnprocessableWriteHook`
fires inside `ShaclValidator.handle()` before `ResourceStore` is finalized (Components.js
construction order). The hook cannot hold a live `EventEmitter`. Workaround: it enqueues
Turtle strings into a module-level array; `MemTriggerListener.drainPendingEvents()` flushes
the buffer on startup and on every `'changed'` event. Drain is not gated by the startup
grace period — `mem:UnprocessableWrite` events reach `/.events/` even during pod-setup.

**Architectural deviations from spec** (all accepted):

1. **`fetch()` not `store.getRepresentation()` in `checkBound`** — spec called for in-process
   `ResourceStore` read. Integration exposed the 6s write-lock crash when `'changed'` fires
   while CSS holds a lock on the parent container. `fetch()` sidesteps the in-process lock.
   Same rationale as the D92 walker (HTTP self-request) applied to a single resource.

2. **`abstract class` for hook interfaces, not TypeScript `interface`** — componentsjs-generator
   emits an `AbstractClass` descriptor for TypeScript `interface` types; CSS DI refuses to
   instantiate `AbstractClass`. Declaring as `abstract class` yields a proper `Class` descriptor.
   No behavioral change; same pattern used by D95–D100 shape-completion sprint for
   `PathConstraintConfig`.

3. **`cito:` URIs for contradictory pairs, not `wiki#` URIs** — `wikilinkProjection` emits
   `cito:cites` / `cito:citesAsEvidence` for `{.supports}` wikilinks, not `wiki:supports`.
   Production v1 ships `contradictoryPairs: []` pending a reconciliation pass that enumerates
   actual projection-emitted IRIs. Contradiction logic is fully unit-tested with injected pairs.

4. **`mem:Event` multi-typing** — events must carry `a mem:BoundExceeded, as:Activity` (or
   `as:*` parent) to pass the shape-validator's operations-path constraint. Single `mem:*`
   typing is rejected. All detectors emit with dual typing.

**Test counts**: 44 mem-trigger Vitest unit + 31 shape-validator Vitest unit + 75
markdown-projection Vitest unit; 3/4 live-Pod integration tests passing.
`test_reflection_due_emits_event` remains `pytest.skip` pending test-mode config
activation (`css/config/mem-trigger-test.json` + `css/config/solid-config-test.json`).

**K1 alignment**: the two new hook Overrides in `mem-trigger.json` target `ShaclValidator`
and `MarkdownProjectionListener` — different instances from the `WorkerParallelInitializer`
Override that K1 governs. No conflict.

**See also**: D74 (memory-substrate triggers — the `mem:*` vocabulary and invariant list
this closes), D93/D94/K4 (Memory Structuring Sprint — detectors first appeared here as stubs),
D92 (wiki-search walker — same `fetch()` lock-avoidance rationale), RQ-Atomic-Feedback-1
(Pattern B deferred here), K1 (WorkerParallelInitializer Override ownership),
FOLLOWUPS.md Phase C.10 (closed 2026-05-21).

### MemTrigger sprint — substrate-behavior findings (2026-05-21)

1. **PendingEventsBuffer pattern** — hooks invoked before `ResourceStore` is ready must
   enqueue Turtle into a module-level buffer rather than calling `EventEmitter` directly.
   `MemTriggerListener` (an `Initializer`) drains the buffer on startup and on every
   `'changed'` event. Drain is unconditional — not gated by startup grace.

2. **`fetch()` not `store.getRepresentation()` for lock re-entrancy** — `'changed'` fires
   while CSS may still hold a write lock on the parent container (parent `ldp:contains`
   is updated as part of the same write transaction). `store.getRepresentation` on parent
   during that window hits the per-resource lock and causes the 6s
   `WrappedExpiringReadWriteLocker` crash. `fetch()` on the self-URL sidesteps the
   in-process lock.

3. **`mem:Event` multi-typing for path-constraint bypass** — `/.events/` resources need
   an `as:*` parent type alongside `mem:*` to satisfy the shape-validator operations-path
   constraint. Detectors that emit without `as:Activity` (or equivalent) produce events
   that are rejected by the path guard. Dual-typing is the fix.

4. **`cito:` URIs for `{.supports}` wikilink projection** — `wikilinkProjection`'s
   class-hint table maps `{.supports}` to `cito:cites`, not `wiki:supports`. Any
   detector or test that inspects contradiction pairs must use the IRI that the listener
   actually writes into `.meta`, not the design-time shorthand.

5. **15s startup grace + lazy Type Index load** — `handle()` defers Type Index read to
   first write after a 15s startup window, avoiding write-lock crashes during pod-setup
   bulk initialization. `checkBound` is gated; `drainPendingEvents` is not.

6. **`getLoggerFor` silenced in extension packages** — CSS `global-logger-factory` does
   not surface `info`/`warn` from extension packages at the default log level. Use
   `console.error` for debug-critical messages (emit failures, drain errors) to guarantee
   visibility in container output.

## Shape Completion Sprint — substrate-behavior findings (2026-05-19)

Durable substrate constraints surfaced during the Phase G integration tests. Complement the Memory Structuring Sprint findings recorded above.

1. **Path constraints skip `.meta` resources** — the shape-validator's `pathBasedClassConstraint` must be configured with a `.meta` exclusion pattern. `.meta` files are CSS-internal substrate artifacts that legitimately carry cross-stratum vocabulary (content PROV-O, Memento timestamps, PROF conformsTo). Any path-based content-class constraint that hits `.meta` will spuriously reject routine substrate writes. See D99 (Layer 2) for the canonical treatment.

2. **Live Type Index is the canonical dispatch oracle** — the `MarkdownProjectionListener` resolves the Thing class via the live Type Index at `/vault/settings/publicTypeIndex` (refresh-on-miss + hardcoded fallback). This means: (a) L4 overlays get full substrate treatment immediately upon Type Index registration without restarting CSS; (b) container rename without Type Index update silently breaks projection (no error, just no `<#this>` triples). D78 class-based dispatch is the governing decision; this finding is an implementation alignment note.

3. **FAIR metadata invariant — D38 `resource.shacl.ttl` exempted** — the cross-batch `test_fair_metadata_present.py` test explicitly exempts `resource.shacl.ttl` as a pre-D97 artifact. Future sessions: do not use `resource.shacl.ttl` as a style reference for new shape files; use any of the 8 D98 shapes instead. Retrofit is pending — see FOLLOWUPS.md.

## Rung 1.5 redesign (D102, 2026-05-23)

### D102 — Rung 1.5 reframed as L1/L2/L3 engineering evaluation (2026-05-23)

**Status**: Ratified 2026-05-23. Vault cross-reference: **vault-D97**.

**The reframe**: Rung 1.5 is no longer a claim-proof experiment ("Tier-2 Pod beats brute-force"). It is an engineering feedback loop for designing a good agentic memory Pod. The artifact is not a publication; it is a Pod design that demonstrably works.

**Stipulated (no longer under test)**:

- **Pod-as-substrate**: settled. Filesystem-baseline (B1 in the prior v2 matrix) is dropped — filesystem can't share or carry multiple agentic harnesses; comparing the chosen substrate to a non-option doesn't inform engineering.
- **Wiki-memory L3 as canonical memory profile**: stipulated good based on the three-tradition convergence (Karpathy/Ghumare/AKBP, ByteRover/xMemory/Hindsight, Hermes/Supermemory). The eight-shape catalog (D98) is settled.
- **Skills + structured memory both required**: back-of-the-envelope evidence in the vault `retrieve-workspace/iteration-1/` runs shows meaningful with-skill vs without-skill deltas on a non-trivial L3.

**Under test — the engineering questions, organized by L-layer**:

| Axis | Engineering question |
|---|---|
| L1 — Solid Pod | Do agents use Solid features (storage description, Link headers, Solid-OIDC, Memento, LDN) when appropriate? Conformance is W3C-tested; agentic utilization is not. |
| L2 — Memory substrate | Are the seven invariants (bounded branching, tiered retrieval, lifecycle, explicit + implicit signals, hybrid storage, separable procedural memory, OOD honesty) observable in agent behavior? The canonical L2 doc (`Memory Substrate vs Memory Profile.md`) explicitly defers operational details to "Rung 1.5+ evaluation." |
| L3 — Wiki-memory instance | Which specific L3 affordances do agents use vs ignore? Which are YAGNI? |
| L3 — Karpathy 3 ops | Do agents perform Ingest (with fan-out), Query-with-file-back, and Lint correctly? Does the wiki *compound*? |
| Multi-Pod | When 2+ Pods, does federation across L2-shared / L3-differing Pods work? |

**Methodology**:

- **Three measurement axes**: trajectory (self-logged `trajectory.jsonl`), outcome (skill-creator's native grader), round-trip consistency (paired create + retrieve verifies the compounding claim).
- **Behavior judge** separate from output grader — reads trajectories, emits assertions attributed to L-layer.
- **Round-trip consistency as diagnostic axis**: a creation task that passes outputs but fails its round-trip retrieval is direct evidence of a create-side / read-side affordance mismatch (substrate design failure, not agent failure).
- **B1/B2 split**: Phase B (creation) divides into B1 (Karpathy Ingest + Query-with-file-back, runnable now) and B2 (Karpathy Lint, gated on a Pod-side lint skill being built).
- **A → C → B1 → B2 → D sequencing**: Phase C (scale extension) runs *before* the B1/B2 split, so scale data informs how to design creation tasks.
- **Pilot first, then evolve**: B's subdivision is provisional; A and C will reshape it.

**Supersessions**:

- Supersedes the v2 eval matrix at `docs/plans/2026-05-15-rung-1-5-eval-matrix.md` and the session-handoff at `2026-05-15-rung-1-5-session-handoff.md`. Both retained as historical input.
- Resolves the original Rung 1.5 section's three-condition framing (B1 filesystem / B2 brute-force / T Pod-harness) in the active vault plan.

**Design doc** (the durable engineering artifact): `docs/plans/2026-05-23-rung-1.5-redesign-design.md`. This decision is the framing commitment; the design doc carries operational detail.

**Dependencies**:

- Phase B2 prerequisite: a Pod-side lint/audit/curator skill (analogous to vault `/audit` + `/curator` + `/review-note`). Not yet designed. Build trigger: A or C surfacing failure modes; not built prophylactically.
- Phase D prerequisite: a second Pod and likely a federation skill. Separate design exercise.

**See also**: D55 (three-tier access), D70 (L1/L2/L3 stratification), D73 (two-stage commit), D74 (mem:* triggers), D78 (class-based dispatch), D83 (Pod-as-toolkit), D87 (wiki-search), D98 (8-shape catalog), D101 (MemTrigger detector wiring), RQ-Substrate-1..4, RQ-Atomic-Feedback-1, RQ-Discovery-1, RQ-Hub-1.

## Skills bootstrap, affordance descriptors are the manual (D103, 2026-05-23)

### D103 — Skills bootstrap the navigation tool; affordance descriptors are the manual (2026-05-23)

**Status**: Ratified 2026-05-23. Vault cross-reference: **vault-D98**.

**The commitment**: skills under `solid-agent-skills/skills/` are minimal bootstrappers (~15-25 lines). They route the agent (when to reach for this affordance), name the tool to invoke, and **point at the canonical specification on the Pod itself** — the affordance descriptor at `/vault/meta/affordances/<name>.ttl`, whose `sh:agentInstruction` is the source of truth. Skills do not duplicate substrate content (response shapes, score formulas, WAC semantics, limitations) — those live in the descriptor.

The skill is the **map** that says "the manual is over there"; the affordance descriptor is the **manual**.

**Why** (Phase A pilot evidence, 2026-05-23):

- Cold-discovery worked — agents without the skill successfully navigated storage description → affordance catalog → `wiki-search-grep.ttl` → invocation, using only standard Solid/LDP/OSLC conventions and `sh:agentInstruction` on the descriptor. Positive datapoint for RQ-Discovery-1.
- Skill bloat created friction without saving cost — the original 70-line `wiki-search/SKILL.md` told agents to invoke `solid-pod wiki-search ...`. The CLI wasn't on subagent PATH (`npm link` had never been run); the skill provided no fallback. With-skill agents burned 2-3 tool calls discovering this. The skill's value was *negative* for that path because the skill diverged from the substrate's reality.
- Future skills compound the risk — with N skills, baking everything into each is N× context cost and N× drift surface.

**Substrate obligation** (the interface contract for the decision to hold):

- Every published affordance under `/vault/meta/affordances/` must carry an `sh:agentInstruction` with a concrete, copy-pasteable invocation example. If incomplete, the skill can't bootstrap.
- Capability descriptors at `/vault/meta/capabilities/` carry the broader framing (what L2 invariants the affordance serves).
- Substrate self-description must be HATEOAS-correct per D55 — every response carries Link headers pointing at the next thing the agent needs.

**Skill shape** (what the bootstrapper does include):

1. **Routing** — when to use; when to escalate
2. **Tool name + invocation summary** — CLI command, or curl + URL pattern
3. **Pointer** to the canonical descriptor at `/vault/meta/affordances/<name>.ttl`
4. **Environmental pre-flight** the substrate cannot communicate — TLS dev certs, CLI install requirements, local PATH gotchas

**Out of skill**: response schemas, score formulas, WAC semantics, limitations, decision IDs, history. Those live on the substrate or in design docs.

**First application**: `wiki-search/SKILL.md` refactored from ~70 lines to ~36 (commit `09acfd9` in solid-agent-skills). Phase A pilot iteration-2 will validate whether the bootstrapper form changes agent behavior.

**Scope**:

- Applies to all skills under `solid-agent-skills/skills/`. Existing skills (solid-addressbook, solid-wiki-memory-l3, solid-owner-identity, action skills, inbox skills) need audit and refactor before Phase B kickoff.
- Applies to future skills as Phase B+ surfaces ship.
- Does **not** apply to: substrate-side documentation (which should be richer), project design docs (which capture rationale), CLAUDE.md / README files (human-facing).

**Related fix shipped same day** (`a308d80` in solid-agent-skills): CLI installability — README documents the install (npm install + npm run build + npm link), and the `build` script now sets the exec bit on `dist/cli.js`. Without this, the bootstrapper-form skill's CLI pointer would fail in subagent environments. With it, `solid-pod` resolves on the standard `/opt/homebrew/bin` PATH which subagents inherit.

**See also**: D55 (HATEOAS three-tier access — Tier 1 spec, Tier 2 descriptors, Tier 3 skills), D70 (L1/L2/L3 stratification), D52 (affordance descriptor architecture), D83 (Pod-as-toolkit capability catalog), D87 (wiki-search Phase 7a), D102 (Rung 1.5 redesign — eval framing that surfaced this).

## Substrate is self-validating wiki-memory L3 content (D104, 2026-05-23)

### D104 — Substrate self-description IS wiki-memory L3 content; SHACL guardrails + agent construction (2026-05-23)

**Status**: Ratified 2026-05-23. Vault cross-reference: **vault-D99**.

**The commitment**: the Pod's self-description (storage description, affordance descriptors, capability descriptors, JSON-LD context, Type Index, shape catalog) IS wiki-memory L3 content. Same patterns that govern vault concept/source/person pages apply to substrate-side resources. There is no separate "substrate" data model — it is wiki-memory L3 applied to its own self-description.

**Two-layer architecture for substrate consistency**:

1. **SHACL = guardrails**. Substrate-resource shapes declare required predicates, cardinality, dereferenceability, vocabulary membership. Pure rules, deterministic, fast. Produce structured violation reports. Cannot construct content, cannot judge intent.

2. **Agent = construction**. The pod-curator agent reads violation reports and reasons about intent: composes prose, generates labels, decides between alternatives, fills in missing predicates. LLM reasoning. Expensive but intentful.

**Feedback loop**: agent constructs → SHACL validates → violation report → curator agent reasons → patched substrate (via D73 two-stage commit) → re-validate.

**One unified toolkit**: audit + curator + review work on both content-side (vault pages) and substrate-side (descriptors). The Phase B2 lint skill (task #10) collapses into the same build — it is all "agent reads SHACL violations and acts." Same skill body, different shape inputs.

**Substrate-shape additions** (extend D77/D98 shape catalog):

- `StorageDescriptionShape` — declares the catalogs, `rdfs:seeAlso` resolves, has entry-point `sh:agentInstruction`
- `AffordanceDescriptorShape` — requires label, comment, agentInstruction, prof:hasRole, dispatchPattern, conformsTo
- `AffordanceCatalogEntryShape` — labels + comments for narrowable discovery
- `CapabilityDescriptorShape` — parallel to AffordanceDescriptorShape
- `VocabularyDeclarationShape` — every `void:vocabulary` IRI must dereference

**Decision cascade**:

- D81 predicate-level governance applies to substrate predicates (the substrate-governed set extends)
- D73 two-stage commit applies to substrate edits (curator-proposed fixes go through `working/`)
- D74 `mem:*` triggers emit on substrate violations
- D98 (skill bootstrapper) closes the loop — skills point at substrate descriptors as canonical; this decision ensures the descriptors ARE canonical
- D87 wiki-search descriptor is the exemplary AffordanceDescriptor (all required fields present)

**Phase A pilot evidence**: the 2026-05-23 pilot (iter-1 + iter-2) surfaced 18 substrate failure modes documented in `docs/plans/2026-05-23-phase-a-pilot-report.md`. They partition cleanly across SHACL-catchable (e.g., stale `rdfs:seeAlso`, missing labels), agent-required (e.g., writing entry-point agentInstruction prose), and hybrid (SHACL detects, agent fills). The partition is structural, not accidental — SHACL alone is insufficient (no intent reasoning), agent alone is insufficient (no clean completeness check).

**Scope**:

- Applies to all advertised substrate IRIs in the Pod
- Future L4 overlays must publish corresponding substrate-resource shapes when adding new substrate types
- Does not apply to: agent-runtime content traversal (same mechanism, different shape inputs), build-time SW CI

**Next-session build** (option B per session-handoff doc, deferred):

SHACL shapes (start with 2 exemplary: StorageDescription + AffordanceDescriptor); `pod-audit.py` walker (Python + pyshacl + cross-resource checks); `pod-curator` skill body (proof-of-concept agentic resolver against the 2 shapes); immediate sweep of 4 highest-priority failure modes (stale `rdfs:seeAlso`, missing affordance catalog labels, missing storage-description entry-point agentInstruction, OSLC parameter compliance map). ~3-4 hours focused work.

**See also**: D55 (HATEOAS three-tier), D70 (L1/L2/L3 stratification), D73 (two-stage commit), D74 (`mem:*` triggers), D77 + D98 (shape catalog), D81 (predicate-level governance), D87 (wiki-search exemplary descriptor), D103 (skills bootstrap; substrate is the manual — this decision closes that loop), D102 (Rung 1.5 redesign — empirical grounding).

**Amendment (D111, 2026-06-05) — boundary note:** "substrate self-description IS wiki-memory L3 content" scopes to substrate resources serving *discovery/routing* (the storage description, affordance/capability catalogs, JSON-LD context, Type Index, shape catalog). **Infrastructure substrates** that provide data-layer services — the D111 identifier system at `/id/`, cf. Memento's version space — live at **Pod level outside L3**, with their own governance, and are NOT wiki-memory L3 content. Per D111 §11.

## Two-hierarchy commitment + Type-Index addressing (D105–D106, 2026-05-26)

Surfaced by a cold-agent probe: the wikilink resolver guessed a target's LDP container from the link's *role* (`{.source}`→`/wiki/sources/`), a layer violation that broke on D98's container rename/merge and would produce dangling links for any agent-extended type. Tracing it back exposed a missing principle.

D105: **Two-hierarchy commitment — RDFS-subsumption is the addressing/structure axis; SKOS-broader is the content/navigation axis; they are never substituted.** `rdfs:subClassOf` (class subsumption, TBox) governs which container (Type Index, D8), which SHACL shape, and which governed predicates apply; the substrate reasons over its closure for type/contract questions (the subclass-aware `ShapeValidationStore`). `skos:broader`/`narrower`/`related` (subject taxonomy, ABox among `skos:Concept` *instances*) organizes topics for navigation/meaning. SKOS deliberately is **not** `rdfs:subClassOf` — `broader` carries no instance subsumption (W3C SKOS Reference §4 non-commitment; Miles/Bechhofer rationale). We do **not** unify them via the SKOS↔OWL alignment. The bridge is one axiom (`wiki:Concept ⊑ skos:Concept`) + the Type Index. The transition is asymmetric: kit→vault is free (a `wiki:Concept` instance *is* a `skos:Concept`); vault→kit (topic link → addressable resource) must re-supply the class the topic link dropped — handled by lookup + a dangling-reference guardrail (D106). This is the principle the "VaultBook kit (RDFS/LDP affordances) vs vault (SKOS content organization)" split rests on, and it generalizes D70's L1/L2/L3 stratification.

D106: **Wikilink/edge addressing resolves the container from the target's class via the Type Index; extension types bridge SKOS↔domain via Pattern C + SKOS mapping (revises D76(c), sharpens D79).** A wikilink `[[Title]]{.role}` is a content-layer (SKOS) assertion: `.role` determines only the **predicate** (D36, `HINT_TO_PROJECTION`). The target's **container** is resolved from the target's **class via the Type Index** (D8/D78) — never from the role; no hardcoded role→container table (`HINT_TO_CONTAINER` is retired except where a role genuinely entails a type). Applications extend the type system agentically (D100 L4 contract): an extension class is declared **`rdfs:subClassOf skos:Concept`** (ESCO "Pattern C") when its instances are navigable topics — each instance is then both a `skos:Concept` (topic taxonomy) and a domain-typed individual (container/shape/properties) — and registers a Type Index entry. We do **not** use OWL punning (OWL-Full + tooling hazards; the Digital Europa Thesaurus experiment's caution). Cross-scheme / cross-application correspondence uses **`skos:exactMatch`/`broadMatch`**, never `owl:equivalentClass`/`rdfs:subClassOf` — non-entailing, loosely coupled (GeoNames/AGROVOC). Forward references whose target doesn't resolve are a first-class reconcilable state: emit the edge to the default content container (`/wiki/concepts/`), marked provisional, reconciled by the curator (`mem:StalenessDetected`/dangling-reference). The base-type role entailments (e.g. `.author`→Person) collapse into this general mechanism — Person is just a registered class the Type Index routes — rather than a special case. **Interim** (pre-resolver-rewrite): D98-correct `HINT_TO_CONTAINER` to the current containers (default content container `concepts/`; keep `author`→`people`) so links resolve to live containers; the Type-Index-driven resolver is the full fix.

**Prior art** (the KR best practices these decisions are grounded in — for a future agent following the reasoning):
- W3C, *Using OWL and SKOS* (Bechhofer & Miles, 2006): https://www.w3.org/2006/07/SWD/SKOS/skos-and-owl/master.html — the canonical bridging-pattern catalog.
- W3C, *SKOS Reference* §4 (non-commitment between `skos:Concept` and `owl:Class`): https://www.w3.org/TR/skos-reference/
- Miles, Bechhofer et al., *Key choices in the design of SKOS* (J. Web Semantics, 2013): https://www.sciencedirect.com/science/article/pii/S1570826813000176 — concept-vs-class rationale.
- Jupp & Bechhofer, *SKOS with OWL: Don't be Full-ish!* (OWLED 2008): https://ceur-ws.org/Vol-432/owled2008eu_submission_22.pdf — the OWL-Full trap + punning caveat.
- ESCO Ontology Model: https://ec.europa.eu/esco/lod/model — "Pattern C" (`rdfs:subClassOf skos:Concept`) at production scale; the model we already use (D98 `wiki:Source ⊑ skos:Concept`).
- GeoNames / AGROVOC — `skos:exactMatch`/`owl:equivalentClass` for cross-scheme alignment: https://www.geonames.org/ontology

**See also**: D8 (Type Index = class→container — the addressing bridge), D34 (SKOS foundation vocab), D36 (`{.class}`→predicate, kept), D70 (L1/L2/L3 = kit/vault split), D76 (revised: (a) D98 containers, (c) superseded by D106), D78 (class-based shape targeting), D79 (sharpened: the hardcoded hint table is fine for predicates, wrong for containers), D98 (`wiki:Source ⊑ skos:Concept`), D100 (L4 agentic class-extension contract).

### D107 — URI re-layering: three-bucket namespace partition + views-over-a-graph framing (resolves the URI slice of RQ-Substrate-4) (2026-05-28)

**Decision:** Partition the substrate's RDF terms into three buckets and re-frame the URI layout as **views over a contextualized graph** (Verborgh). **Bucket 1 (aggressive standard-predicate reuse — delete our parallels):** where a standard Solid/PIM/LDP predicate exists, use it and remove the `wiki:` duplicate — `wiki:typeIndex`→`solid:publicTypeIndex` (confirmed), preferences already `pim:preferencesFile`, `wiki:eventStream`→`ldp:inbox`/LDES (verify), `wiki:targetContainer` routing-use→Type Index `solid:instanceContainer` (partial). This is a **D48 "no dual parallel mechanisms" cleanup** of a self-inflicted violation (we minted parallels to standard predicates), and it *shrinks* the migration. **Bucket 2 (mint a substrate namespace, framed as proto-view vocabulary):** genuinely-general terms with no standard equivalent move out of `wiki:` into recommended `…/ontology/substrate#` (`sub:`, single ns by YAGNI; concern-split later if it grows, per the Solid `solid:`/`pim:`/`ldp:` precedent) — catalogs (`shapeCatalog`/`affordanceCatalog`/`contextDocument`/`contactCatalog`/…), routing/dispatch (`routesToClass`/`dispatchPattern`/`targetClass` = the primitive view-definition language), governance (`governs`/`projectsFromFrontmatter`), affordance-descriptor vocab (`Affordance`+subclasses/`constructQuery`/`selectQuery`). `wiki:contactCatalog`→`sub:contactCatalog` fixes the contamination smoking gun (AddressBook, a *second* app, was forced to reuse it). **Bucket 3 (`wiki:` keeps only L3 content):** content classes, `maturity`, procedure-step vocab, profile machinery; `/wiki/` re-framed in self-description as *"the wiki-memory document view"* (defuses the cold-probe MediaWiki misread). **Storage root:** keep `/vault` (grounded D35, never the misread segment); fix the *code* — derive the root from the storage description, stop hardcoding `${baseUrl}/vault`. **PROF:** promoted to view-identity + actionable out-of-band hint — keep `Link: rel="profile"` (RFC 6906), add `sh:agentInstruction` to each descriptor + an entry-point announcement; never `Content-Profile`; `?_profile=` *selection* deferred to the view layer.

**Provenance audit (FOLLOWUPS thread 2): almost nothing is hallucinated** — every URI segment traces to a decision/Solid convention. The debt is namespace *placement* + *naming*, not invented structure. **Verborgh grounding:** a pod is a hybrid contextualized graph (source of truth); documents are views; *"no view is more special than any other."* Our contamination *is* his "contacts conundrum," so aggressive Bucket-1 standard reuse is the data-level interoperability he argues for (caveat: use the Type Index as a *view-routing hint*, not the privileged hierarchy). **Validation:** agentic dual-view cold-probe eval (Probe A misread regression vs the 2026-05-26/27 baseline; Probe B dual-view usage; Probe C PROF with/without) on the Rung 1.5 axes, with **round-trip-across-views consistency** (author via document view → retrieve via graph view) as the diagnostic-most test; **tune the harness + on-Pod `sh:agentInstruction`, never the server.** New question **RQ-View-2** (below).

**Status:** Resolves the *URI/namespace* slice of RQ-Substrate-4; **does NOT close RQ-Substrate-4** — the deep contacts-conundrum solution (one entity, multiple writable views) is the deferred view layer. **Refines D35** (vault is a view-host workspace, not the privileged single hierarchy). **Scope:** URI re-layering only; view processor / conneg-by-profile selection / SAI registration / mint-on-miss deferred (spec §6). Full record: `docs/superpowers/specs/2026-05-28-rq-substrate-4-uri-relayering-decision.md`. Source brainstorm: `docs/superpowers/specs/2026-05-27-neurosymbolic-substrate-unification-design.md`. **See also:** D44/D48/D49 (storage-description router; the dual-mechanism anti-pattern), D84 (namespace-form migration precedent), D86 (PROF), D106 (Type-Index addressing), D81 (governed predicates).

### D108 — SKOS is the conceptual backbone; three-frame label model; dual-view enforcement (container=gate / class=dispatch); two enforcement audiences (2026-05-30)

**Decision:** (1) **SKOS is wiki-memory's conceptual backbone, for real** — `skos:broader`/`narrower`/`related` are the navigation/content axis (D105/D106); concepts ARE a SKOS concept scheme, pages/notes are memories that attach to it. (2) **Three node-kinds, three label frames:** `<>` Page → `dct:title`; `<#this>` Thing → `schema:name`; `<#this>` Concept → `skos:prefLabel` (+`altLabel`). `schema:name` (entity name, Thing-level) and `skos:prefLabel` (canonical term, ≤1/lang + alt/hidden, KOS-level) are **not redundant**. (3) **`prefLabel` is enforced on concepts (`minCount 1`) AND materialized** so SKOS-frame graph queries can label traversal results (today materialized **nowhere** → SKOS label queries return empty corpus-wide). (4) **Derive the inferable; reserve the guardrail for judgment:** DERIVE `rdfs:label` (apex — one "label of any node" query; also covers `schema:name` being *outside* the `rdfs:label` subproperty chain) + `schema:name`; RESERVE the write-time `422` for un-inferable judgment metadata — `skos:prefLabel` (**agent-authored via the write template, NOT silently substrate-derived** — silent derivation is *how the conceptual understanding got lost*), `dct:identifier` on `wiki:Source`, the right `skos:broader`. (5) **Enforcement architecture — container=gate / class=dispatch:** container/path declares which shapes apply + permissive-`working/`/strict-durable (D73) + per-view minimums + the **a-priori `Link: rel="constrainedBy"` discovery affordance** (the human-curatable rule layer handed to the agent *before* writing); `sh:targetClass` dispatches which shape fires on `<#this>`/`<>` within the gate, + `targetClassCheck` as the untyped/mistyped reject. **Load-bearing fix:** make projection **in-band/synchronous** so the validator validates the **projected `.meta` graph**, not the markdown body (today post-commit D58/D71, so the validator never sees the graph it must judge). Contacts/WebID stay as-is (RDF-body+`constrainedBy`); the class-targeted graph path **subsumes** the RDF-body case. (6) **Two enforcement audiences, both first-class:** the **runtime content agent** ← SHACL + `422` + `sh:agentInstruction` remediation; the **software-engineering/dev agent (Claude Code)** ← **tests/CI encoding the frame model + artifact-agreement contracts**, failing with meaningful messages when the substrate is rewritten without understanding. The shape's `sh:agentInstruction` is the **shared teaching artifact** across both audiences and all delivery channels.

**Root cause corrected (proven 2026-05-29/30):** wiki content shapes are deployed-but-inert — no `/vault/wiki/` container declares `ldp:constrainedBy`, so the upstream `ShaclValidator.canHandle` bails and `handleSafe` silently skips; even wired, it validates the markdown *body* (no RDF) not the projected `.meta` (which is auxiliary-exempt). Controlled write of a `prefLabel`-less concept → `201`. So D104's "self-validating substrate" held only for RDF-body substrates. **Meta-lesson:** the reconstruction cost to recover this frame model = the cost every cold agent pays and mostly fails to pay = *why the corpus drifted*. The conceptual model must be **canonical + cheap-to-acquire + single-sourced**, referenced from every channel (entry-point `sub:agentGuide`, shape `sh:agentInstruction`, skills, the 422 message, dev tests) — never re-explained differently per channel.

**Two-front program:** Front 1 (agentic harness — one legible, single-sourced conceptual model + correction protocol, delivered where agents look; brainstorm first) + Front 2 (substrate guardrails + dual-graph structure — in-band projection, container=gate/class=dispatch, `constrainedBy` on durable wiki containers, uniform `rdfs:label` + frame labels materialized, `prefLabel` enforced, dev-side tests). Coupled via the shared `agentInstruction`/correction artifact.

**Status:** Decision recorded; implementation = brainstorm → plan → build. **Gates RQ-View-2** (the cold-probe eval surfaced this mismatch; re-running before the structure is right measures a broken target — deterministic round-trip already green). **Refines D78** (class-targeting = dispatch, not enforcement key), **realizes D96** (Page/Thing enforcement intent without two-patch ceremony), **corrects D104**, **confirms D73** (permissive/strict is container-keyed), **builds on D98/D105/D106** (SKOS backbone), **honors D81**. Full record: `docs/superpowers/specs/2026-05-30-skos-backbone-dual-view-enforcement-decision.md`. New question **RQ-Enforce-1** (below).

## Substrate re-grounding — hybrid store + interop foundation (D109–D110, 2026-06-01)

### D109 — Substrate re-grounding: layer-partitioned co-equal authority over a hybrid store; two-tier coherence; foundational-ontology layer (2026-06-01)

**Umbrella decision.** Root cause: the wiki-memory substrate was built as the *document view with an RDF annotation bolted on*, not the **hybrid contextualized KG** (Verborgh) the design called for — one omission, four masks (RQ-Grammar-1 inexpressible literals; D108 inert shapes; `prefLabel` materialized nowhere; RQ-Substrate-4 contamination). The conceptual spine (SKOS backbone / three label frames / two hierarchies / owner partition — D95/96/105/106/108) is **sound**; the failure is *realization* in the graph. **Target = layer-partitioned co-equal authority over a hybrid store:** markdown = authoritative *authoring* surface for L3/wiki-memory (incl. prose the graph never holds); `.meta` graph = authoritative *queryable/interop* representation for L1–L2 (incl. substrate-derived + curator-added); overlap only on governed predicates; the **server-managed description resource** (`describedby`) projection is the bridge; L3 may reference the pod, the substrate does not depend on the markdown. Grounded in the Solid Protocol (non-RDF subject + server-managed description resource) + Application Interoperability (RDF as the shared agent-accessed substrate). **NOT "graph-canonical"** — the graph is canonical only for the queryable/interop view; authoring stays markdown-native (storage primacy must not dictate agent modality). Symmetric two-master/CRDT deferred to Scale-3 federation; no-clobber constraint = RQ-Listener-1 / D82. **Coherence = two-tier control loop + legibility:** Tier 0 legibility / **layered context-loading** (base vocabulary index loaded on startup; per-app ontologies loaded dynamically via interop `ApplicationRegistration`+`AccessNeedGroup`+`registeredShapeTree`); Tier 1 deterministic **admission floor** (SHACL+`422`, D108 Front-2); Tier 2 **agentic curation loop** (Karpathy Lint as a continuous process, pod-curator, `mem:*`). **Floor/loop decision rule:** *derive* the inferable (`rdfs:label`/`schema:name`); *floor* the locally-authorable judgment (`prefLabel`/`definition`/type/`identifier`); *loop* the graph-global judgment (`broader` placement/`exactMatch`/consolidation). **Foundational-ontology layer:** vocabularies partitioned + cached in `ontology/` (basis `ontology/README.md`) — ground / declare-by-reference / enumerate-defer; **`interop:` adopted as the agentic-app foundational vocabulary** (vocabulary now / Authorization-Agent runtime deferred / grant-half volatile / `st:`→SHACL bridge), correcting the earlier "SAI too heavy, don't use" dismissal; identity layer (`acl`/`acp`/VCDM/`sec`/`did`/`odrl`) enumerated-but-deferred (in-scope per shared-multi-user framing; auth is dev-allow-all). **Decomposition (each its own spec→plan→build):** A RQ-Grammar-1 (markdown write-view into the substrate graph) → B D108 Front-2 (admission floor) → C curation loop → D view layer (deferred, = D107 §6); cross-cutting D110 + the vocab cache. Re-run **RQ-View-2** after A+B land. Realizes D70, completes D58/D71, honors D81, builds on D95/96/105/106/108, **umbrella over D108**, resolves the deep slice of RQ-Substrate-4. Full record: `docs/superpowers/specs/2026-06-01-substrate-regrounding-design.md`.

### D110 (STUB) — re-base `cap:`/`overlay:` app-declaration on `interop:` (2026-06-02)

**Stub, not yet designed.** Our bespoke `cap:`/`overlay:` app-declaration terms (`cap:requires`, `overlay:providesCapability`, `/vault/meta/capabilities/`, overlay `manifest.ttl`) reinvent W3C Solid Application Interoperability (`interop:`, cached `ontology/interop.ttl` per D109 §5): overlay≈`Application`/`ApplicationRegistration`; `cap:requires`≈`AccessNeedGroup`/`AccessNeed`+`registeredShapeTree`; wiki containers≈`DataRegistration`. Re-base on `interop:` — **adopt the vocabulary only**, keep SHACL as the validation layer, do NOT build the Authorization-Agent runtime, avoid the volatile grant terms (CG #334). Open: the `registeredShapeTree`→SHACL bridge; migration of deployed triples + `pod_audit.py`/pod-curator tooling. Parent: D109 §5. Full record: `docs/superpowers/specs/2026-06-02-cap-overlay-interop-rebase-decision.md`.

## Identifier-scheme substrate (D111, 2026-06-05)

### D111 — Pod-level identifier-scheme (PID) substrate at `/id/`; fragment datatypes; derived catalog; suggestive typing (2026-06-05)

**Decision:** A **Pod-level persistent-identifier (PID) system** at `/id/`, **outside the storage root** (`/vault/`) — an *infrastructure substrate* like Memento's version space, not L3 content (see the D104 boundary amendment). Identifier types are **agent-affordance dispatch keys**: a typed identifier carries enough for an agent to know how to resolve it. **Datatype = a fragment on the catalog document:** a typed identifier literal is annotated with a custom datatype IRI that is a fragment on the scheme catalog (`"10.1234/x"^^<https://pod.vardeman.me/id/schemes/#doi>`) — the datatype IRI dereferences (minus fragment) to the catalog doc whose `<#doi>` topic IS the scheme record (ADMS/JRC precedent: datatype↔`schema:propertyID`). **Two regimes, formality declared not ambient:** (a) *protocol-enforced informal* identifiers (plain literals, no scheme) and (b) *catalog-described formal* identifiers (scheme-typed literals whose datatype names a registered scheme) — a resource declares which regime applies; the substrate does not infer formality from the value. **Derived catalog:** the `/id/schemes/` index is server-derived by `IdCatalogStore` (an `ldp:contains`-precedent derived container — the catalog index is computed from the seed records, agents write records not the index). **Suggestive typing:** a scheme's `idot:luiPattern` regex is **data** an agent reads (for resolution + Tier-2 curation), **NOT a floor `422` trigger** — the admission floor checks scheme-record *structure* (SchemeRecordShape), never validates instance identifier literals against the regex. **Composition via `dct:conformsTo`/`skos:exactMatch`, NEVER cross-subclass** (dxwg#808 lesson): a scheme record is triple-typed `idot:Namespace` (⊑ `dcat:Dataset`) + `skos:Concept` + `rdfs:Datatype`, aligned to `datacite:*` individuals by `skos:exactMatch`; providers are `idot:Resource` (⊑ `dcat:DataService`, `idot:urlPattern {$id}`); resolution-return semantics carried by minted role records (`/id/roles#landing-page` etc.) — `skos:Concept`s attached to providers via `dct:type`, with `skos:broader` to PROF canonical roles; PROF is lineage/grounding only, NO `prof:ResourceDescriptor`/`prof:Profile` machinery built (spec §10.6). **Curl-grade enforcement:** every constraint is HTTP-observable (PUT a malformed scheme record → `422`+ValidationReport; the floor + the derived index are testable with curl, no client library required).

**Implementation:** scheme records seeded by the `overlays/identifier-schemes/` overlay (the catalog + 8 scheme records — doi/orcid/ror/arxiv/citekey/did/did-oyd/solid-resource — + the resolution-result role scheme), applied FIRST by pod-setup. `css/extensions/id-catalog/` hosts `IdCatalogStore` (between Locking and Patching; the `.meta` rewrite carries the identifier-bearing `BasicRepresentation` so the floor's auxiliary exemption applies). `DEFAULT_LITERAL_BINDING` gained the `identifier` token so a typed identifier can be authored inline via a body span (`[10.1234/x]{.identifier^^ids:doi}`). The scheme-catalog `.meta` (`ldp:constrainedBy` → SchemeRecordShape) is delivered via `apply.py` block 8 at container creation (CSS only allows `constrainedBy` on an empty container). Confirmed idot v0.3 terms = `idot:luiPattern`/`idot:sampleID` (NOT the plan's `idRegexPattern`/`exampleIdentifier` — §9.1 blocking step caught it).

**Status:** **SHIPPED 2026-06-05** (live on the Pod; e2e 8/8 incl. the bootstrapped `how-identifiers-work` memory; `make audit` 0 ERROR / 1 known WARN; `make reset` reproducible — identifier-schemes seeded first). **Cold probes (§7.4) PASSED 3/3 same day** — resolve-with-shortcut-available, resolve-forced (round-tripped to the seeded memory), register-first-try-201-no-422s; 2 seed-data provider bugs found+fixed (doi conneg RA-scope, citekey OSLC syntax); report `docs/plans/2026-06-05-d111-cold-probe-report.md`. Closes the identifier-affordance brainstorm queued from the 2026-06-04 framing lock. **Reconciliations** (amendments appended to D104 / D87 / D84 below). Full record: spec `docs/superpowers/specs/2026-06-05-identifier-scheme-substrate-design.md`; plan `docs/superpowers/plans/2026-06-05-identifier-scheme-substrate.md`; prior art `docs/research/2026-06-04-identifier-affordances-prior-art.md`. **See also:** D104 (infrastructure-substrate boundary), D84 (fragment datatype = a canonical application of the hash rule; external vocab scope note), D49/D109 (declare-or-ground vocab policy — `idot:`/`datacite:` grounded), D108 (admission floor carries custom-datatype literals through the in-band path), D87 (`overlay:registersScheme` = resource registration), D86 (`Link rel="profile"` document-kind hints — the only operational PROF surface), D105/D106 (`skos:exactMatch` cross-scheme, never `owl:equivalentClass`).

## Curation protocol (D112, 2026-06-05)

### D112 — Tier-2 curation loop as Pod state + a transferable role (2026-06-05)

**Decision:** The D109 Tier-2 curation loop is implemented as **Pod state, not external tooling** — all curation equipment lives on the Pod and is discoverable cold. Five seams: (1) **Signals** — `mem:StalenessDetected` events + declared sweep-check types (provider-liveness, suggestive-typing) in the affordance descriptor; (2) **Ledger** — per-application `.operations/` container; each entry is an `<>`-subject LDN-form activity (`as:Announce + mem:RealignAction`, `schema:actionStatus` lifecycle: `PotentialActionStatus` → `CompletedActionStatus`/`FailedActionStatus`); (3) **Policy-as-data** — `mem:hasCurationNeed` on `interop:Application` so the application's own declaration signals curation-readiness; (4) **Read-path surfacing** — server-derived `mem:hasOpenAction` back-pointer on the curated resource via `OperationsIndexListener` + `Link: rel="mem:hasOpenAction"` header via `CurationLinkMetadataWriter`, so a primary agent reading a resource sees pending curation without querying `.operations/`; (5) **Curator-as-role** — any authorized agent can act as curator; the affordance descriptor at `/vault/meta/affordances/curation.ttl` IS the `prov:Plan` (equipped-agent assertion: every ledger write carries `prov:qualifiedAssociation/prov:hadPlan` with the Memento-pinned descriptor version).

**Equipped-agent assertion:** every curation ledger write carries `prov:qualifiedAssociation [ prov:agent <curator-webid>; prov:hadPlan <curation.ttl?version=…> ]` — Memento-pinning the descriptor version in the trace. The admission floor (D108 Front-2) gates undeclared writes via `CurationProposalShape` on `/id/.operations/`. PROV-O axioms verified + grounded into `ontology/prov.ttl`.

**Propose-only v1 (both lanes):** `mem:applyClass` declares the intended lane — `mem:DeriveClass` (infer-inferable; auto-apply safe) vs `mem:JudgmentClass` (judgment required; propose-only). V1 proposes in both lanes; graduation to auto-apply for derive-class gated on maturity score over trace history (clean-trace rate, reversal rate, plan stability). Signals defined; scorer deferred.

**Vertical slice:** identifier-schemes overlay is the first curated overlay. Two detector types exercised: (a) provider-liveness judgment-class (substitute each record's `idot:sampleID` into each `idot:urlPattern`, check declared `dcat:mediaType` — would have caught both D111 probe bugs); (b) property-value materialization derive-class (`schema:PropertyValue` projection, `propertyID` = scheme-record URL). `/id/.operations/` ledger floored by `CurationProposalShape`.

**External grounding:** FluxMem (arXiv:2605.28773) — PEMS maturity gating provides the closest precedent for the maturity-based auto-apply boundary; Stage II ablation supports the Tier-2 loop pattern; auto-apply posture inverted (ephemeral context edits vs durable substrate mutations — our propose-only v1 is the conservative direction FluxMem's ablation justifies).

**Resolves:** D111 FOLLOWUPS item 0(a) (provider-liveness detector candidate) + item 1 (PropertyValue materialization). Exercises RQ-Atomic-Feedback-1 (read-path surfacing = the in-band feedback variant). D109 sub-C. Spec: `docs/superpowers/specs/2026-06-05-d112-curation-protocol-design.md`.

**Status:** **BUILT 2026-06-05** on branch `d112-curation-protocol` (10/10 plan tasks; e2e green; `make audit` 0 ERROR / 1 known WARN; suite green Pod-up + Pod-down). **Cold probes NOT yet run** (curator probe + primary-agent probe, ensemble grading — spec §8 defines grading criteria). Cold probes are the validation gate — D112 is **not yet VALIDATED**. **See also:** D108 (admission floor that gates ledger writes), D101 (MemTrigger detector wiring), D111 (identifier-scheme substrate — first curated overlay), D109 (floor/loop rule: derive-inferable / floor-locally-authorable / loop-graph-global), PROV-O (D112 grounds axioms into `ontology/prov.ttl`).

## Open research questions

RQ-Affordance-1: descriptor format (declarative SHACL vs custom RDF vs hybrid)
RQ-Harness-1: fabric namespace minting at `https://cogitarelink.org/ns/fabric#` — blocks all `fabric:*` predicates
RQ-Memento-1: ACP fragmentation across time travel (when does D62 inheritance break?)
RQ-Memento-2: federated time travel — does Comunica propagate `Accept-Datetime` to every source?
RQ-Federation-1: cross-pod SPARQL federation works at all (untested; gate for RQ-Memento-2)
RQ-Eval-1/2/3: task suite design, sub-agent config, GEPA convergence
RQ-Eval-4 (2026-05-23, Phase A pilot): would extended-thinking blocks on eval subagents change any finding the behavior judge produces from trajectory text + tool calls alone? Subagents spawned via Claude Code's in-process Agent tool emit no `type: "thinking"` blocks (verified across 9 runs). The Phase A pilot judge attributed skill-shortcut vs cold-discovery behavior correctly from text-block content alone. Whether thinking-token visibility changes attributions on harder tasks (Phase B creation fan-out, B2 contradiction reconciliation, D cross-Pod identity) is unknown. Architectural reading: Claude Code's subagents are workhorse executors by design; the thinking layer sits in the parent orchestrator and in the post-hoc judge. Filed as research question, not build task. Revisit if Phase B/D produces behaviors the judge can't attribute from current signal.
RQ-App-1/2: multi-application composition mechanics; cross-application agent routing
RQ-View-1: algebraic flows as richer alternative to CONSTRUCT (Phase 3 territory)
RQ-View-2 (D107, 2026-05-28): do agents correctly select and use the document-view (GET `.md`) vs graph-view (SPARQL over `.meta`) of the *same* entity, and does the PROF out-of-band hint (`rel="profile"` + `sh:agentInstruction`) drive that selection? Validated by round-trip-across-views consistency (author via one view → retrieve via the other). Verborgh dual-view premise made into a pass/fail agent eval. Tune the harness + on-Pod instruction, never the server. **GATED BY D108** — the 2026-05-29 Probe-A repeats surfaced a conceptual-structure mismatch (wiki content shapes inert; `prefLabel` unenforced + unmaterialized; SKOS label queries empty); fix D108 before re-running the behavioral probes (deterministic round-trip already green).
RQ-Enforce-1 (D108, 2026-05-30): how to make markdown→`.meta` projection **in-band/synchronous** so the validator can validate the projected graph and return a `422`, without breaking the post-commit MonitoringStore architecture (D58/D71)? Options: project-then-validate inside `ShapeValidationStore`; a synchronous pre-commit transform; or a PassthroughStore that runs the projection pipeline + validates before delegating. The load-bearing fix for D108 Front-2. Resolve in Front-2 design.
RQ-Grammar-1 (2026-06-01, surfaced by RQ-View-2 re-eval): the inline `[[X]]{.class}` authoring grammar (D36) is **edge-only** — one predicate, resource-object — but RDFa/Sparna are RDF-complete on three axes (type→`rdf:type`, property→literal, rel/resource→resource-edge). The **literal-property axis does not exist inline**, and the frontmatter allowlist doesn't project `skos:prefLabel`/`altLabel`/`definition` either, so a cold agent **cannot author a shape-conformant concept inline** (both 2026-06-01 cold probes scored 3/5, forced to PATCH `.meta` violating the no-PATCH rule). This is an **expressivity gap UPSTREAM of D108 Front-2 enforcement** — a perfect 422 gate is moot if conformance is inexpressible. Framing locked: (1) the grammar must round-trip the full governed graph (type+literal+edge) into `.meta`; (2) RDFa-in-HTML rendering is OUT OF SCOPE (D75 stands for display; RDFa matters only as proof an annotation model *can* be RDF-complete — the invariant is the markdown→`.meta` round-trip, which never used RDFa). Fork: (A) enrich inline grammar toward Sparna/RDFa completeness; (B) complete the frontmatter literal/type surface, links stay edge-only; (C) hybrid. **Sequencing: brainstorm RQ-Grammar-1 → spec → implement → THEN D108 Front-2 → THEN RQ-View-2 re-eval.** Provenance + the Sparna `{.class}`=type vs our `{.class}`=predicate deviation: `docs/decisions/typed-wikilink-syntax-provenance.md`. See D36 (edge-only origin), D58/D71 (projection), D75 (no-RDFa-HTML), D108 (enforcement this gates).
RQ-ACP-1: per-triple ACP via query-rewriting (meccano 2016 pattern)
RQ-Spec-1: spec issue #715 — SPARQL Update returning to Solid Protocol
RQ-Pod-4: Comunica `.meta` traversal vs pre-built index (blocked by link-traversal `.meta` gap; confirmed in Phase 7 — workaround: explicit `default-graph-uri` parameters pointing at `.meta` URLs; materialized SPARQL index deferred to Rung 1.5+)
RQ-Pod-6: `.meta` richness vs query overhead — needs benchmarks with 100+ resources
RQ-Listener-1 (new): CSS `.meta` overwrite-order forces Model A's preserve-agent-triples behavior to read pre-write state from an alternate source. Solutions to evaluate: pre-write Memento read, agent-sidecar `.meta.agent`, or PassthroughStore interception.
RQ-Hub-1 (from spec): Is N=3 the right hub threshold? Eval question for Rung 1.5.
RQ-Discovery-1 (from spec): Does the 7-step first-arrival ritual scale to agents arriving on cold Pods? Eval question for Rung 1.5.
RQ-Affordance-2 (new, 2026-05-15 evening): Can an LLM agent reliably emit valid inline JSON-LD code blocks? Eval question for Rung 1.5. Hypothesis: yes for simple triple insertions; quality degrades for nested graphs or complex `@context` resolution.
RQ-Affordance-3 (new, 2026-05-15 evening): Should the listener project from JSON-LD code blocks back to body class-hint wikilinks when both express the same edge? Or preserve them as parallel-but-coexisting surfaces in the body? Affects whether the listener has a canonical form vs respects agent authoring choice.
RQ-Affordance-4 (new, 2026-05-15 evening): Does inline JSON-LD block extraction bypass D81 Model A's subject = current page invariant? JSON-LD `@graph` can express arbitrary subjects; this is the same reification problem D81 sidestepped. Mitigation candidates: (a) listener only extracts triples where `@id` matches resource URI; (b) listener extracts all but warns when subject ≠ resource; (c) accept arbitrary subjects and revisit D81 governance.
RQ-Substrate-2 (filed + RESOLVED 2026-05-16): GET on `/vault/.well-known/solid` returned 501 Not Implemented despite the Pod advertising this URL via Link rel="solid:storageDescription". Surfaced universally in Sprint 1 iteration-2 eval (all 6 agents hit it). **Root cause**: Phase 1's `css/config/pod-templates/base/.meta` wrote `<../> a pim:Storage` instead of `<>`. Against base `/vault/.meta`, `<../>` resolves to the server root, not `/vault/`, so CSS's StorageDescriptionHandler.canHandle() couldn't find `pim:Storage` on `/vault/` and threw `NotImplementedHttpError("Only supports descriptions of storage containers")`. Fix (substrate-cleanup-step-6): one-character template edit (`<../>` → `<>`) + add `cap:catalog` StaticStorageDescriber to `void-description.json` so D83's catalog pointer surfaces at `.well-known/solid` per D44. Note: README's `RQ-Substrate-1` is a different question (descriptor format L2/L3), no relation.

RQ-Substrate-3 (filed 2026-05-16, RESOLVED-BY D84): namespace mismatch between `css/config/void-description.json` (using `urn:example:wiki#`) and overlay-managed `.meta` (using `http://pod.vardeman.me:3000/vault/ontology/wiki#`). Root analysis: vocabulary IRIs baked deployment details (port, scheme) into class identifiers; per-app vocab was treated as a resource URL rather than a stable namespace identifier. Resolution: **D84** commits to HTTPS, port-less, hash-namespace, extension-less vocabulary IRIs hosted on the Pod itself (`https://pod.vardeman.me/vault/ontology/{wiki,capability,overlay}#`); per-app vocab lives on the Pod (Pod is namespace authority), cross-Pod shared profiles use w3id.org. Implementation in Phase 5j (skill + decisions land first; data-layer migration via volume wipe + regenerate happens during D85 TLS turn-up).
RQ-Search-1 (D91): Score normalization for grep. v1 formula: `score = min(100, 10 * match_count + 10 * unique_terms_matched / total_terms_in_query)`. Validate empirically in Phase 7a eval.
RQ-Search-2 (D91): Should `?ext=search-grep` support `oslc.where` for combined text + structured filter? v1: post-filter via Comunica over `.meta`.
RQ-Search-3 (D91): Phase 7d WebID-partitioned index interaction with `MarkdownProjectionListener` on ACL change. Deferred until Phase 7d is on the table.
RQ-Search-4 (D91): Should search response include `MarkdownProjectionListener`-emitted typed-edge triples as match context, or just text snippets? Richer context costs tokens but lets agents skip a follow-up `.meta` fetch.
RQ-Search-5 (D91): Cross-container search — per-container only in v1; pod-root search is a Phase 5/multi-application concern.

## References

Vault sources of truth:
- Decisions log: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`
- Plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md`
- Active plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Unified Externalization Prototype Plan.md`
- Memento vocab: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Memento Vocabulary Alignment.md`
- Phase 1 findings: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Solid Pod Phase 1 - Vertical Slice Findings.md`
- Infrastructure: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Self-Hosted Pod Infrastructure Design.md`

Design doc in this repo: `docs/plans/2026-04-01-pod-agentic-memory-structure-design.md`
