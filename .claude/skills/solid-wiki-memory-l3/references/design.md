# solid-wiki-memory-l3 — Design reference

Canonical L3 memory profile for this Pod. Sourced verbatim from D70-D81 + K2-K3 in `.claude/rules/decisions-index.md` (Phase 5d-5g).

## Phase 5d — Memory substrate stratification

### D70 — L1/L2/L3 substrate stratification

L1/L2/L3 substrate stratification — **L1** = Pod substrate (LDP/WAC/SPARQL/Memento/`.well-known/`/Solid-OIDC/LDN/Notifications Protocol — universal). **L2** = Memory substrate (seven invariants: bounded branching with typed containment, tiered/progressive retrieval, lifecycle metadata as first-class, explicit write + implicit signals, hybrid blob+graph storage, separable procedural memory, OOD honesty). **L3** = Memory profile (specific edge vocabulary + container layout + consolidation policy). Multiple L3 profiles can coexist on one Pod, scoped via Type Index + SHACL shape catalog + per-container affordance descriptors. The vault PARA+SKOS arrangement is one L3 specialization sitting on top of wiki-memory L3.

### D71 — Wiki-memory as canonical L3 reference profile

Wiki-memory as canonical L3 reference profile — built from first principles on W3C web standards (not copied from Karpathy/AKBP). Page-as-unit; **dual-layer linking via body→`.meta` projection** is our distinct architectural commitment: markdown wikilinks at the token layer + RDF predicates in `.meta` at the data layer, unified by D58's projection. AKBP — the most concrete implementation in the lineage we cite — took the **opposite** direction: parallel surfaces with no body→graph projection. Body markdown stays plain prose; typed edges live in `graph/relations.jsonl`; agent writes to the graph via structured API (`akbp.remember`). Concept-level convergence with Karpathy/Ghumare/AKBP/agentmemory/Supermemory/ByteRover exists at the pattern layer (page-as-unit, typed edges, lifecycle, two-stage commit) but **does not extend to syntax, vocabulary, or projection mechanism** — those are our committed choices. **FURTHER REVISED by D82** (affordance spectrum + inline JSON-LD as second body affordance). See `Wiki-Memory L3 Profile.md` for full operational-vs-concept attribution audit.

### D72 — Compile-once principle

Compile-once principle as substrate guarantee — the substrate maintains compiled, cross-referenced state (`.meta` triples projected from body; Type Index updated on resource creation; SHACL shape catalog cached); agents don't re-derive at query time. Karpathy's "stop re-deriving, start compiling" framing applied as L2 contract. Already true in practice via the importer pipeline; D72 elevates it to a stated substrate guarantee.

### D73 — Two-stage commit for memory writes

Two-stage commit for memory writes — `working-memory/` container accepts low-ceremony body-only writes with permissive SHACL shape (cribbed from AKBP's `remember`); `mem:Crystallize` operation validates against strict L3 profile shape and promotes to durable container (cribbed from AKBP's `crystallize`). Solves the Mattia83it critique on Ghumare's gist ("event-driven auto-ingest corrupts wikis when LLMs hallucinate") without abandoning the low-ceremony ergonomics agents need.

### D74 — Memory-substrate trigger vocabulary

Memory-substrate trigger vocabulary — `mem:*` AS2 extension delivered via LDN inbox (durable) and Solid Notifications Protocol (real-time): `mem:ConsolidationSuggested`, `mem:BoundExceeded`, `mem:ContradictionDetected`, `mem:ReflectionDue`, `mem:OODQuerySignal`. Each subclasses `as:Announce` / `as:Offer` and carries a SHACL shape. Substrate emits when SHACL rules flip (via MonitoringStore listener — same pattern as Memento commit listener). Agent dispatches by `rdf:type` to skill family. Agent identity has its own WebID + separate inbox, distinct from user inbox. Extends D26 (LDN multiplexing) with the memory-substrate vocabulary; closes the implicit-signals half of D70 invariant #4.

## Phase 5e — Wiki-memory L3 spec

### D75 — Rendered HTML serves humans; no RDFa embedding

Rendered HTML serves humans; no RDFa embedding (REVISES D37) — keep the remark/rehype pipeline for converting markdown to HTML for browser viewing, but drop the rehype-rdfa step. Rendered HTML carries semantic CSS classes only (`<a class="wikilink wikilink-{type}">`), no `property="vault:concept"` or other RDFa attributes. The data layer is exclusively `.meta` Turtle, projected from the same body by the `MarkdownProjectionListener` (D58 sharpened). RDFa would be a redundant third surface nobody reads — LLM agents read raw markdown, SPARQL agents query `.meta`, humans use Obsidian/IDE/browser-rendered HTML. The Obsidian Preview model is the reference. Implies a rename: `css/extensions/markdown-rdfa/` → `markdown-render/`.

### D76 — URI layout, slug algorithm, resolver, and attachment convention

Wiki-memory L3 URI layout, slug algorithm, resolver, and attachment convention — the L3 reference profile commits to: (a) **five typed containers** `/wiki/{pages,sources,people,procedures,working}/` (one SHACL shape each per D77; flavor within a container distinguished by predicates not by sub-containers); (b) **slug algorithm with explicit S3a `@`-strip rule** (handles BibTeX citekey conventions without leaking `@` into URIs/RDF terms/JSON-LD contexts — prevents JSON-LD keyword collision, Pandoc citation ambiguity, RFC 3986 encoding inconsistency); (c) **class-hint resolver** — `{.class}` annotation determines target container (`{.source}`/`@`-prefix → `/wiki/sources/`, `{.author}` → `/wiki/people/`, etc.); (d) **attachment co-location** — non-markdown blobs (PDFs, images, Word docs) live alongside their describing wiki page in the same container, sharing slug stem; per-source folder is the promotion path for multi-attachment cases; (e) **embed prefix `!`** projects `vault:embeds` and triggers inline `<img>` rendering. URIs are absolute with `.md` suffix kept; rename ceremony and cross-pod federation deferred.

### D77 — SHACL shape catalog (5 shapes)

Wiki-memory L3 SHACL shape catalog — five shapes, one per D76 container: `wiki:PageShape` (general wiki content, permissive), `wiki:SourceShape` (citation records with `dct:identifier` required), `wiki:PersonShape` (FOAF-based with `foaf:nick` aliases for cross-system linking), `wiki:ProcedureShape` (procedural memory with `sh:agentInstruction` carrying the procedure body), `wiki:WorkingNoteShape` (permissive per D73). Each carries `sh:agentInstruction` per D50. Flavor-within-shape pattern: 12+ vault L4 note types collapse into 5 L3 shapes distinguished by `.meta` predicates (`vault:kind`, `vault:isMOC`, `vault:isOrganization`) rather than separate containers. The vault L4 specialization extends via shape subclassing without modifying the L3 baseline. Shape files at `overlays/wiki-memory/shapes/{page,source,person,procedure,working}.shacl.ttl`.

## Phase 5f — Rung 1.4 implementation decisions

### D78 — Class-based shape targeting

Class-based shape targeting — shapes target `rdf:type` (wiki:Concept, wiki:Source, wiki:Person, wiki:Procedure, wiki:WorkingNote) rather than container paths. REVISES D77. Solid Type Index does double duty for routing; SHACL `sh:targetClass` with `rdfs:subClassOf` inference gives automatic shape dispatch. L4 specialization via subclass. **Implementation note**: `sh:class` value-type constraints (e.g., "the target of dct:references must be a wiki:Source") cannot be enforced in per-resource validation because cross-resource targets aren't in the data graph. Shapes use `sh:nodeKind sh:IRI` only; cross-resource integrity belongs in whole-Pod SPARQL ASK checks (deferred to Rung 1.5).

### D79 — Hybrid vocabulary stance + JSON-LD context discovery

Hybrid vocabulary stance + JSON-LD context discovery — DCT/SKOS/CiTO/FOAF/PROV by default; mint `wiki:*` (Resource/Concept/Source/Person/Procedure/WorkingNote/Hub/maturity) only for genuine gaps. JSON-LD context document at `/meta/context.jsonld` is the canonical prefix→IRI registry and the agent's vocabulary discovery surface. REVISES D71. Closes RQ-Vocab-1 by deferring namespace minting via `https://pod.vardeman.me/vault/ontology/wiki#` placeholder. **Implementation note**: Listener uses hardcoded class-hint table in `wikilinkProjection.ts` rather than reading the JSON-LD context at runtime. Context-driven dispatch is functionally equivalent and deferred to Rung 1.5 (no behavior change, just refactor).

### D80 — Substrate-derived navigation classes

Substrate-derived navigation classes — `wiki:Hub` and breadcrumb chains are computed by Comunica CONSTRUCT views (D45 pattern), declared as `wiki:DerivedClassAffordance` / `wiki:DerivedNavigationAffordance` in the affordance catalog. Agent invocation pattern: on-demand for v1 — when agent needs hub info, runs the CONSTRUCT against `/sparql`. No materialization, no push, no D74 trigger. Materialize-then-push deferred to Rung 1.5+ once eval shows latency matters. REVISES D77's `vault:isMOC` predicate.

### D81 — Predicate-level governance (Model A)

Predicate-level governance (Model A) — SHACL shape declares which predicates the substrate governs. Listener owns triples where (subject = this resource) AND (predicate ∈ governed-set); agent owns everything else. On body write: DELETE governed-predicates, INSERT projection, leave non-governed alone. Sidesteps reification (no named graphs, no RDF-star, no per-triple prov tags). SHACL shapes stay `sh:closed false`; each shape documents its governed set via `sh:agentInstruction`. **Known limitation (RQ-Listener-1)**: CSS `FileDataAccessor.writeMetadataFile()` overwrites the `.meta` file completely on every resource PUT, before the MonitoringStore event fires. So agent enrichment via direct PATCH to `.meta` is lost when the body is rewritten. Mitigation paths for Rung 1.5: (a) read pre-write `.meta` state from Memento/git history before projection; (b) separate `.meta.agent` sidecar that CSS never touches; (c) intercept the PUT at the store layer (PassthroughStore pattern) so projection runs before CSS clears .meta. Unit tests validate Model A logic; integration test marked xfail with this diagnosis.

## Known limitations

### K2 — Slug algorithm doesn't collapse consecutive hyphens

`slug()` algorithm does not collapse consecutive hyphens. "Ghumare - LLM Wiki v2 Extending Karpathy" produces `ghumare---llm-wiki-v2-extending-karpathy` (triple-hyphen) because " - " (space-hyphen-space) maps each space to `-` independently. Trade-off accepted for v1; collapsing consecutive hyphens is a future refinement.

### K3 — `.author` class hint projects to `dct:contributor`

`.author` class hint projects to `dct:contributor` (not `dct:creator`) in `wikilinkProjection.ts` HINT_TO_PREDICATE. SourceShape allows `dct:creator` (substrate-governed) but the listener never emits it from `.author` class hints. Result: the Phase 1 Ghumare fixture's `dct:creator` was changed to `dct:contributor` to match listener emission. Subsequent SPARQL queries for source authorship must use `dct:contributor`. Rung 1.5 may introduce a distinct `.creator` class hint for sources.

## Authoritative artifacts

- Implementation specs (Rung 1.4 close): `docs/superpowers/specs/2026-05-15-rung-1-4-wiki-memory-l3-implementation-design.md`
- RQ-Listener-1 mitigation analysis: `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md`
- RDF-star candidate D82: `docs/plans/2026-05-15-rdf-star-provenance-exploration.md`
- RQ-Pod-4 workaround notes: `docs/plans/2026-05-15-rq-pod-4-workaround-notes.md`
- SHACL shapes: `overlays/wiki-memory/shapes/`
- MarkdownProjectionListener: `css/extensions/markdown-projection/`
