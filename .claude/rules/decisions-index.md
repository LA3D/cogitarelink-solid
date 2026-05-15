# SOLID Pod Decisions Index

Always loaded. Concise index of all architectural decisions (D1-D81, K1-K3). Vault is canonical source:
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
| `solid-wiki-memory-l3` | D70-D81, K2-K3, RQ-Listener-1 (L3 reference profile) |

CSS-builder skills (no D-cluster but referenced by many decisions): `css-extension`, `components-override`, `metadata-writer`, `monitoring-store`, `comunica-sources`, `shacl-shapes`.

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

Forced by cross-system pattern research (Hermes/Supermemory provider interfaces; ByteRover/MemGPT/xMemory/Hindsight benchmark systems; Karpathy/Ghumare/AKBP/agentmemory wiki-memory). Three independent traditions converge on the same substrate; the layer stratification names what each was groping at.

D70: L1/L2/L3 substrate stratification — **L1** = Pod substrate (LDP/WAC/SPARQL/Memento/`.well-known/`/Solid-OIDC/LDN/Notifications Protocol — universal). **L2** = Memory substrate (seven invariants: bounded branching with typed containment, tiered/progressive retrieval, lifecycle metadata as first-class, explicit write + implicit signals, hybrid blob+graph storage, separable procedural memory, OOD honesty). **L3** = Memory profile (specific edge vocabulary + container layout + consolidation policy). Multiple L3 profiles can coexist on one Pod, scoped via Type Index + SHACL shape catalog + per-container affordance descriptors. The vault PARA+SKOS arrangement is one L3 specialization sitting on top of [[Wiki-Memory L3 Profile|wiki-memory L3]].

D71: Wiki-memory as canonical L3 reference profile — built from first principles on W3C web standards (not copied from Karpathy/AKBP). Page-as-unit; **dual-layer linking** is the architectural commitment: markdown wikilinks at the token layer + RDF predicates in `.meta` at the data layer, unified by D58's body-affordance projection. The convergence with Karpathy/Ghumare/AKBP/agentmemory/Supermemory/ByteRover is empirical evidence for the design, not its source — the W3C stack happens to align because the standards were designed for the same distributed-knowledge problem.

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

## References

Vault sources of truth:
- Decisions log: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`
- Plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md`
- Active plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Unified Externalization Prototype Plan.md`
- Memento vocab: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Memento Vocabulary Alignment.md`
- Phase 1 findings: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Solid Pod Phase 1 - Vertical Slice Findings.md`
- Infrastructure: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Self-Hosted Pod Infrastructure Design.md`

Design doc in this repo: `docs/plans/2026-04-01-pod-agentic-memory-structure-design.md`
