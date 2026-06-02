# Substrate Re-Grounding: Hybrid Contextualized KG with Co-Equal Writable Views — Decision (D109)

**Date:** 2026-06-01 (rev. 2026-06-02). **Status:** Decision recorded; umbrella for a
multi-sub-project program (each sub-project gets its own spec → plan → build). **Supersedes the
framing** (not the model) of "build forward from the vault"; **subsumes** the deeper slice of
RQ-Substrate-4 and the authoring-grammar bug RQ-Grammar-1; **is the umbrella D108's two fronts sit
under.**

Origin: pulling the RQ-Grammar-1 thread (a cold agent cannot author a conformant concept inline,
RQ-View-2 2026-06-01) to its root cause — and finding it is the *same* root cause as D108's inert
shapes, the un-materialized `prefLabel`, and RQ-Substrate-4's contamination. This doc names the one
omission, states the target architecture, and decomposes the fix so the conceptual model is
**canonical and cheap-to-acquire**, not reconstructed-with-effort each session (D108 meta-lesson).

---

## 1. What we got wrong — one omission, four masks

The design of record (`Hybrid Contextualized KG as Agent Memory Substrate`,
`Memory Substrate vs Memory Profile`, `Wiki-Memory L3 Profile` — vault) is explicit: the substrate is
a **hybrid contextualized knowledge graph** (Verborgh 2022) — markdown documents *and* RDF statements
as **co-equal, first-class** citizens, neither destructively derived from the other; "the agent writes
typed wikilinks, the substrate generates Turtle; the graph doesn't constrain the prose, the prose feeds
the graph." Views (LDP document view, SPARQL graph view) are projections; **no view is more special.**

**What we actually built is the document view with an RDF annotation bolted on — and called it the
substrate.** The hybrid-KG *character* — the thing that makes the document-view and the graph-view
cohere over one substrate — was never built. So the graph is simultaneously **incomplete,
unconstrained, unqueryable, and one-directional**, and every "separate bug" is that one omission
surfacing at a different layer:

| Symptom (looked like its own bug) | = the graph was never co-equal |
|---|---|
| **RQ-Grammar-1** — can't author `prefLabel`/`definition` inline; forced to PATCH `.meta` | the *writable view* (markdown) can't express the full graph → the agent hand-writes the data layer, the exact thing the dual-layer commitment forbids |
| **D108** — content shapes deployed but **inert**; validator sees the markdown body, not the projected graph | nothing *constrains* the graph, because the graph isn't a first-class thing being validated |
| **`prefLabel` materialized nowhere → SKOS label queries empty** | the *queryable view* is half a graph |
| **RQ-Substrate-4** — `/vault/wiki/` app-bias; view layer deferred (D107 §6) | we grew it forward-from-the-vault (one L3 app) instead of backward from L1+L2+the hybrid-KG character — "built for a view, not the substrate" |

The design *predicted this*. The concept note's "What's Still Hard" (2026-04) names exactly the three
deep problems we are now standing on: **the view-authoring problem** (who writes views — open), **the
storage-redundancy vs view-materialization tradeoff** ("both authoritative, linked by IRI identity,
with a consistency protocol… is more infrastructure than the vault currently has"), and **the LLM
placement problem**. This is the design being honest about where the hard part would be — and us
reaching it.

## 2. The conceptual structure is sound — the failure is realization, not model

This is why the worry should not be "the model is wrong." The conceptual spine is correct and already
single-sourced (D108 Front-1):

- **SKOS backbone** — concepts are a SKOS concept scheme; pages/notes are memories that attach to it.
- **Three node-kinds, three label frames** — `<>` Page → `dct:title`; `<#this>` Thing → `schema:name`;
  `<#this>` Concept → `skos:prefLabel` (+ `altLabel`).
- **Two hierarchies, never substituted** — `rdfs:subClassOf` = addressing/structure (Type Index →
  container/shape/governed predicates); `skos:broader` = navigation/content (D105/D106).
- **Owner partition** — the LM authors judgment metadata; the substrate derives the inferable; the
  curator consolidates (D108 derive-vs-judgment; D81 governed predicates).

The model (D95/D96/D105/D106/D108) is right. What's broken is that it lives faithfully **only in the
document view** and was never **completely or bidirectionally realized in the graph.** That is
recoverable plumbing, not a wrong foundation.

## 3. Target architecture — layer-partitioned co-equal authority over a hybrid store

**There is no single global canonical store.** The substrate is a hybrid store (Verborgh's "documents
*and* triples, co-equal") with **layer-partitioned authority** — each representation is authoritative
for its own concern, bridged by the projection:

- **Markdown = the authoritative *authoring* surface for L3 / wiki-memory** — the write-source for
  governed content *and* the sole home of prose the graph never holds. (Solid Protocol: the markdown is
  the *subject resource*.)
- **The `.meta` graph = the authoritative *queryable / interoperable* representation for L1–L2 / the
  Solid pod** — holds the projected governed content *plus* substrate-derived (`rdfs:label`,
  materialized `prefLabel`, provenance) and curator-added (`broader`) triples the markdown never holds.
  (Application-Interop: RDF is the shared, shape-governed, agent-accessed substrate.)
- **They overlap only on the governed predicates** the markdown expresses; the **server-managed
  description resource** (the `describedby` auxiliary) is the bridge — i.e., the projection. Solid says
  the *server* manages `.meta`, which is exactly "the substrate generates Turtle from the markdown."
- **Directionality:** L3 / wiki-memory may reference the pod/graph; the L1–L2 substrate does **not**
  depend on the markdown.

**Why partition rather than pick one canonical store:** storage primacy must not dictate the agent
architecture. LLMs are RL-centered on markdown, so a **markdown-native** authoring agent writes the body
(never leaving markdown — a first-class write-surface, not a second-class escape), while a
**graph-native** curator / query agent reads and edits triples in *its* native modality. Neither fights
its training distribution because the substrate is **modality-neutral** (Verborgh: "no view is more
special; views are server-generated; one app's writes don't affect another's"). This is the asymmetry
that made *"graph-canonical"* the wrong word: the graph is the canonical *queryable/interop*
representation, but that does **not** make authoring graph-native — the author still writes markdown.

- Both views are **independently writable** (protocol-legal: PATCH the description resource; PUT the
  body) **without competing for the same truth** — each layer owns a different aspect. Consistency over
  the governed overlap is *our* policy (the §4 floor + loop + the D81 governed-predicate partition);
  Solid deliberately doesn't define it.
- **The one hazard this forces:** the projection must own only the governed (markdown-expressed) subset
  and **not clobber** graph-layer-authoritative triples (curator `broader`, substrate provenance) on
  body rewrites — i.e., RQ-Listener-1 / the deferred `.meta.agent` sidecar (D82).
- **Symmetric two-master replication** (CRDT — `@desmet-2026-orset-rdf`) is a *different axis*
  (independent offline divergence + merge) and stays deferred to **Scale-3 federation**.

## 4. The coherence model — a control loop, not a storage protocol

Co-equal writable views cannot be kept consistent by storage cleverness, *because the writes are
agentic* — an LLM spraying tokens produces disconnected, ungrounded memories unless something catches
it. Coherence here is a **two-tier control loop** plus legibility:

- **Tier 0 — Legibility / layered context-loading** (D108 Front-1 shipped the single-sourced model; the
  loading architecture is new here): the conceptual model must not just be single-sourced but **loaded
  into the agent's context, layered and dynamic** — mirroring an agent's own startup (CLAUDE.md +
  memory index + skills index → progressive disclosure). The **base vocabulary index** (the grounded
  foundational ontologies, §5) is the *enforced minimum context* the harness pulls on first arrival,
  anchored at the storage-description entry point (D108 Front-1's served `agentInstruction`) and
  navigable from there. **Per-application ontologies load dynamically** when an app engages (wiki-memory
  → its shapes/vocab; AddressBook → its own) via interop `ApplicationRegistration` + `AccessNeedGroup` +
  `registeredShapeTree`. Delivered via skills now (the pod-discover bootstrap, D103), MCP eventually.
  This is L2 invariant #2 (tiered retrieval) + #6 (procedural memory) applied to the *vocabulary itself*.
- **Tier 1 — the deterministic admission floor** (rules / "minimum graph commitment"): SHACL shapes +
  the minimum structural commitments every memory must satisfy to be admitted (subject frames, required
  labels, type dispatch, bounded branching, governed predicates). This is the **write-time 422**
  (D108 Front-2). Not agentic, not optional — it is the grounding that makes these *not* open-ended
  graphs. It rejects/constrains structurally.
- **Tier 2 — the agentic curation loop** (judgment SHACL can't make): above the floor, *semantic*
  coherence — is this note connected? does it fit? does it contradict? should it consolidate? — is
  maintained by curation/review sub-agents that read the note, inspect the graph neighborhood, and
  assess fit. This is **Karpathy's Lint elevated from a periodic chore to a continuous control loop**,
  fired by `mem:*` triggers (`ConsolidationSuggested`, `BoundExceeded`, `ContradictionDetected`).
  SHACL verifies *well-formed*; only an agent verifies *well-placed*.

**How consistency actually holds:** every write — markdown-view edit or graph edit — **funnels through
the same floor (admitted or 422'd) and the same loop (curated for fit)**. The substrate graph is the
post-floor, post-loop queryable state; the document view stays consistent with it via the projection. The agentic behavior is **contained by the floor and
curated by the loop** — there is no symmetric-merge problem because writes serialize through floor+loop,
not on two free-running copies.

We already have the seeds, scattered: **D73 two-stage commit** *is* a floor/loop split (`working/` light
floor + deferred curation → `crystallize` strict floor); **pod-curator** is a Tier-2 sub-agent; the
`mem:*` triggers are the loop's signals; D108 Front-1's drift-guard tests are the *dev-agent's* version
of the loop. D109's contribution is recognizing these compose into one model.

## 5. Foundational ontology layer — interop adoption + the vocabulary cache

The substrate's vocabularies are partitioned and cached as grounding artifacts (`ontology/`, basis:
`ontology/README.md`). Three tiers: **ground** (cache verbatim + provenance header — the always-loaded
base), **declare-by-reference** (`void:vocabulary` IRI, D49), **enumerate-but-defer** (in-scope, not
yet grounded).

**`interop:` (W3C Solid Application Interoperability) is adopted as the foundational vocabulary for the
agentic-app layer** — it is the only Solid-native vocabulary for *apps-as-agents declaring the
shapes/data they need and receiving scoped access to shared graph data* (Type Index = routing only;
WAC/ACP = access only). **Adopt the vocabulary now; defer the runtime** (Authorization-Agent service +
full grant flow — demo-ware, CSS-unsupported, grant-half volatile per CG #334); bridge its `st:`
Shape-Tree coupling to our SHACL. This directly supplies §3 (overlays are `interop:Application`s; wiki
containers are `interop:DataRegistration`s over the shared graph) and §4-Tier-0 (per-app context
loading = `ApplicationRegistration` + `AccessNeedGroup` + `registeredShapeTree`). Our bespoke
`cap:`/`overlay:` app-declaration terms reinvent interop and are re-based on it (**D110**). This
corrects the earlier "SAI too heavy, don't use it" dismissal, which conflated the immature *runtime*
with the foundational *vocabulary*.

**The identity layer interop sits on is enumerated-but-deferred:** `acl:`/`acp:` (interop's `accessMode`
target), VCDM/`sec:` (the VC + Data-Integrity stack), `odrl:` (policy). The **DID Core vocabulary is grounded now** (`ontology/did.ttl` + context) ahead of the deferred URI/DID migration so it isn't missing later — prefer `did:webvh` (trust off DNS) bridged to WebID (D14); resources stay pod-relative (D84).
In-scope per the shared-multi-user substrate framing (not single-owner); deferred because auth is
dev-allow-all. D109 names them so the interop adoption doesn't silently assume an auth plane that
doesn't exist.

**The grounded set is the base vocabulary index** that §4-Tier-0's layered context-loading delivers on
startup. Cache drift to reconcile: CLAUDE.md claims SKOS/DC/PROV-O are cached here; they are not
(`interop.ttl` is the first grounded external vocab).

## 6. The grammar's role (frames RQ-Grammar-1)

The markdown write-view serves **three agents**, and the middle one is why completeness matters most:

1. **authoring** agent — writes it (wants markdown, its native modality);
2. **refinement** agent — reviews fit; needs the note to *carry enough* to assess connectedness (the
   `prefLabel`, `definition`, the `broader`/`related` edges, the type). If the grammar can't express
   those, the refiner works **blind**;
3. **discovery** agent — retrieves it; needs the projected graph *complete + materialized* (e.g.
   `prefLabel` materialized so SKOS-label traversal returns labels) so retrieval works.

So RQ-Grammar-1's job is: **make the markdown view a complete, reversible, rule-grounded rendering of
the governed subgraph — rich enough to feed the refinement loop and consistent enough for discovery.**
"Rule-grounded by construction" (it can only express what maps to the governed graph; validated in-band
by the floor) is precisely what stops the LLM "creating memories all over the place that don't connect."

## 7. Decomposition + sequencing

Too large for one spec. Each sub-project gets its own spec → plan → build cycle.

| | Sub-project | What | Status |
|---|---|---|---|
| **A** | **RQ-Grammar-1** | complete, reversible, rule-grounded, refinement-ready, discovery-consistent **markdown write-view into the substrate graph** (build the forward markdown→graph direction now; design the graph→markdown direction in, don't build it) | **next** — brainstorm to its own spec |
| **B** | **D108 Front-2** | the **admission floor**: in-band/synchronous projection so the validator validates the *projected graph*; container=gate / class=dispatch; `constrainedBy` on durable containers, `working/` permissive; 422 reserved for judgment metadata; dev-side tests encoding the frame model | after A (A makes the floor *honest*) |
| **C** | **Curation loop** | **Karpathy Lint as a continuous agentic process**; elevate pod-curator to the Tier-2 reviewer; wire `mem:*` triggers; "enough info for the refinement process" contract | after/with B |
| **D** | **View layer** | graph→document **regeneration**; the graph as a second writable view; conneg-by-profile `?_profile=` view selection (D107 §6) | **deferred** — design-for now |
| **(cross-cutting)** | **D110 — interop re-base** | re-base `cap:`/`overlay:` app-declaration on `interop:` (§5); foundational-vocabulary cache (`ontology/`) populated to the ground-now tier | opened (stub) |

Then: re-run **RQ-View-2** once A + B land (the eval that surfaced all this; it was gated on D108).

## 8. Open decisions deferred to the sub-specs (recorded so they're not lost)

- **(A)** the concrete inline syntax for the **literal axis + subject-switching** — Sparna-informed
  (`{=…}` sets the subject and scopes over a block; `[text]{property}` for literals) but **trimmed**:
  LMs should not author Sparna's full block-cluster/sibling machinery, and we have an implicit-subject
  advantage Sparna lacks (`<>` Page default / `<#this>` Thing default). Datatype/lang tags are a Sparna
  open gap we must close ourselves.
- **(A)** reconcile the **two drifted predicate maps** — `shared/markdown-parsing/src/predicates.ts`
  (render path, legacy `vault:`) vs the served `context.jsonld` + shape `sh:agentInstruction`
  (projection path, current `cito:`/`skos:`). Canonical = the projection path. (provenance doc + D106
  review flagged this.)
- **(B)** the **floor/loop line** for *durable* shapes. **Decision rule (locked):** *derive* the
  inferable (`rdfs:label`, `schema:name`); *floor* (422) the locally-authorable judgment the author can
  supply without global graph knowledge (`prefLabel`, `definition`, type, `dct:identifier`); *loop*
  (curate after) the graph-global judgment the author can't have at write time (`broader`/`narrower`
  placement, `exactMatch`, consolidation, contradiction). D73's container split (`working/` light,
  durable strict) is the frame. Remaining open: per-predicate edge cases (is *one* `broader`
  required-but-provisional? is `definition` floored or encouraged?) — want shape work + write-friction
  data.
- **(D)** the **view-authoring / regeneration** mechanics (who authors view definitions; how graph→doc
  re-rendering preserves human-authored prose); single-master vs symmetric-master (Scale-3, deferred).
- **(D110)** the `registeredShapeTree`→SHACL bridge; migration of deployed `cap:`/`overlay:` triples +
  the audit/curator tooling that reads them; which `interop:` terms map cleanly vs. need a documented
  deviation; avoid the volatile grant/authorization terms (CG #334).

## 9. Relationship to prior decisions

- **Realizes D70** — the L1/L2/L3 split that was "not honored in practice" (CLAUDE.md): the hybrid store +
  layer-partitioned authority + view layer is L1/L2; wiki-memory is a bounded L3 profile over it.
- **Completes D58/D71** — dual-layer linking was built one-directional + lossy; D109 makes the body↔graph
  projection complete, validated, and (eventually) bidirectional.
- **Honors D81** — governed predicates *are* the admission floor's structural commitment, and the
  layer-partition's no-clobber subset.
- **Builds on D95/D96** — the two subjects (`<>` Page / `<#this>` Thing) are the subjects the grammar
  must address; the grammar gap is that authoring never reached `<#this>`.
- **Builds on D105/D106/D108** — the two hierarchies + the SKOS-backbone/frame model are the sound spine.
- **Umbrella over D108** — Front-1 (legibility) = Tier 0; Front-2 (enforcement) = Tier 1 / sub-project B.
- **Resolves the deep slice of RQ-Substrate-4** — D107 fixed the URI/namespace slice; the deferred view
  layer (D107 §6) is sub-project D here.
- **Grounds the agentic-app layer in `interop:`** (W3C Solid Application Interoperability, §5) —
  adopt-vocabulary / defer-runtime; re-bases `cap:`/`overlay:` (**D110**). Solid-grounded §3: the
  layer-partitioned authority is the Solid Protocol's server-managed *description resource*
  (`describedby`) + the Application-Interop *shared-graph / apps-as-agents* model; the no-clobber
  constraint is RQ-Listener-1 / D82.
- **Frames RQ-Grammar-1** (sub-project A) and **RQ-Enforce-1** (sub-project B, in-band projection).
