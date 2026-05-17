# SOLID Pod Decisions Index

Always loaded. Concise index of all architectural decisions (D1-D91, K1-K3). Vault is canonical source:
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

D76: Wiki-memory L3 URI layout, slug algorithm, resolver, and attachment convention — the L3 reference profile commits to: (a) **five typed containers** `/wiki/{pages,sources,people,procedures,working}/` (one SHACL shape each per D77; flavor within a container distinguished by predicates not by sub-containers); (b) **slug algorithm with explicit S3a `@`-strip rule** (handles BibTeX citekey conventions without leaking `@` into URIs/RDF terms/JSON-LD contexts — prevents JSON-LD keyword collision, Pandoc citation ambiguity, RFC 3986 encoding inconsistency); (c) **class-hint resolver** — `{.class}` annotation determines target container (`{.source}`/`@`-prefix → `/wiki/sources/`, `{.author}` → `/wiki/people/`, etc.); (d) **attachment co-location** — non-markdown blobs (PDFs, images, Word docs) live alongside their describing wiki page in the same container, sharing slug stem; per-source folder is the promotion path for multi-attachment cases; (e) **embed prefix `!`** projects `vault:embeds` and triggers inline `<img>` rendering. URIs are absolute with `.md` suffix kept; rename ceremony and cross-pod federation deferred.

D77: Wiki-memory L3 SHACL shape catalog — five shapes, one per D76 container: `wiki:PageShape` (general wiki content, permissive), `wiki:SourceShape` (citation records with `dct:identifier` required), `wiki:PersonShape` (FOAF-based with `foaf:nick` aliases for cross-system linking), `wiki:ProcedureShape` (procedural memory with `sh:agentInstruction` carrying the procedure body), `wiki:WorkingMemoryShape` (permissive per D73). Each carries `sh:agentInstruction` per D50. Flavor-within-shape pattern: 12+ vault L4 note types collapse into 5 L3 shapes distinguished by `.meta` predicates (`vault:kind`, `vault:isMOC`, `vault:isOrganization`) rather than separate containers. The vault L4 specialization extends via shape subclassing without modifying the L3 baseline. Shape files at `shapes/wiki-memory-l3/{page,source,person,procedure,working}.shacl.ttl`.

## Phase 5f — Rung 1.4 implementation decisions (D78–D81, 2026-05-15)

D78: **Class-based shape targeting** — shapes target `rdf:type` (wiki:Concept, wiki:Source, wiki:Person, wiki:Procedure, wiki:WorkingNote) rather than container paths. REVISES D77. Solid Type Index does double duty for routing; SHACL `sh:targetClass` with `rdfs:subClassOf` inference gives automatic shape dispatch. L4 specialization via subclass. **Implementation note**: `sh:class` value-type constraints (e.g., "the target of dct:references must be a wiki:Source") cannot be enforced in per-resource validation because cross-resource targets aren't in the data graph. Shapes use `sh:nodeKind sh:IRI` only; cross-resource integrity belongs in whole-Pod SPARQL ASK checks (deferred to Rung 1.5).

D79: **Hybrid vocabulary stance + JSON-LD context discovery** — DCT/SKOS/CiTO/FOAF/PROV by default; mint `wiki:*` (Resource/Concept/Source/Person/Procedure/WorkingNote/Hub/maturity) only for genuine gaps. JSON-LD context document at `/meta/context.jsonld` is the canonical prefix→IRI registry and the agent's vocabulary discovery surface. REVISES D71. Closes RQ-Vocab-1 by deferring namespace minting via `urn:example:wiki#` placeholder. **Implementation note**: Listener uses hardcoded class-hint table in `wikilinkProjection.ts` rather than reading the JSON-LD context at runtime. Context-driven dispatch is functionally equivalent and deferred to Rung 1.5 (no behavior change, just refactor).

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

**Why hypothesis-not-decision**: AKBP (a primary source of the affordance framing) is itself unmeasured. The 0–6 affordance spectrum is useful *design vocabulary* but predicts no measurement outcome. Ratifying H-D82 without eval data would label speculation as commitment. **D77/D78/D81 are also v1 choices, not ratified decisions** — same epistemological status as H-D82; all tested in the Rung 1.5 eval matrix.

**Implementation gates** (ALL must hold before listener extension code lands):
1. **Rung 1.5 E1 must show affordances work** — if cold-start affordance discovery (E1: A1.1 vs A1.2 vs A1.3) shows the affordance architecture doesn't actually help agents navigate, the entire wiki-memory L3 direction is in doubt and H-D82.b is moot.
2. **Rung 1.5 E4 must support H-D82.a** — if body class-hints `{.class}` don't add value over frontmatter typing, then inline JSON-LD blocks (which build on the same in-band typing thesis) won't either.
3. **RQ-Listener-1 mitigation chosen and shipped** — agent triples must survive body rewrites.
4. **Rung 1.5 E5 (conditional) must show inline JSON-LD adds value** beyond class-hints. If not, ship class-hints as final, document the negative result.

See `docs/plans/2026-05-15-rung-1-5-eval-matrix.md` for the experiment-by-experiment specification, decision rules, and sequencing (Pilot → E3 gate → E1 → E2 → E4 → optionally E5). Total ~210 sub-agent runs via Claude Code skill-creator harness; no per-token billing (folded into existing subscription).

**See also**: [[Affordance Spectrum for Agentic Memory]] (foundational design vocabulary, also reframed as hypothesis-bearing); `docs/plans/2026-05-15-d82-listener-extension-plan.md` (implementation design, eval-gated); `docs/plans/2026-05-15-akbp-to-w3c-mapping.md` (vocabulary translation table, structurally correct; behavioral claims pending eval); `docs/plans/2026-05-15-rung-1-5-eval-matrix.md` (the eval matrix that tests this hypothesis along with D77/D78/D81 et al).

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
