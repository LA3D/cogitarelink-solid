# Substrate Re-Grounding: Hybrid Contextualized KG with Co-Equal Writable Views — Decision (D109)

**Date:** 2026-06-01. **Status:** Decision recorded; umbrella for a multi-sub-project program
(each sub-project gets its own spec → plan → build). **Supersedes the framing** (not the model) of
"build forward from the vault"; **subsumes** the deeper slice of RQ-Substrate-4 and the
authoring-grammar bug RQ-Grammar-1; **is the umbrella D108's two fronts sit under.**

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
- **Three node-kinds / three label frames** — `<>` Page → `dct:title`; `<#this>` Thing → `schema:name`;
  `<#this>` Concept → `skos:prefLabel` (+ `altLabel`).
- **Two hierarchies, never substituted** — `rdfs:subClassOf` = addressing/structure (Type Index →
  container/shape/governed predicates); `skos:broader` = navigation/content (D105/D106).
- **Owner partition** — the LM authors judgment metadata; the substrate derives the inferable; the
  curator consolidates (D108 derive-vs-judgment; D81 governed predicates).

The model (D95/D96/D105/D106/D108) is right. What's broken is that it lives faithfully **only in the
document view** and was never **completely or bidirectionally realized in the graph.** That is
recoverable plumbing, not a wrong foundation.

## 3. Target architecture — graph-canonical storage, co-equal writable views

**Storage primacy must not dictate the agent architecture.** LLMs are RL-centered on markdown; the
substrate must be **modality-neutral** so different agents work in their native modality:

- **Graph-canonical storage** — the graph (triples + the markdown blobs) is the single source of truth.
- **Co-equal *writable* views over it** — a **markdown-native** authoring agent writes the *body view*
  (the substrate ingests it into the graph); a **graph-native** curator / query agent edits or reads
  *triples* directly (the body view re-renders from the graph).

The key property that resolves the RL-distribution worry: **graph-canonical at storage ≠ graph-native
at authoring.** The authoring agent never leaves markdown — markdown is a first-class write-surface,
not a second-class escape; the graph being canonical underneath is invisible to it. The curator and
query agents get the graph in *their* native modality. Nobody fights their training distribution. This
is Verborgh's model stated as an agent-architecture requirement ("views are server-generated; the
write decisions of one app don't affect another's").

**Scope note (avoid over-build):** "co-equal views over one canonical graph" (single master, N writable
projections) is *much* simpler than "two symmetric masters reconciled" (CRDT territory —
`@desmet-2026-orset-rdf`). For a single Pod, single-master-graph + writable-views delivers everything
above. True symmetric masters buy only independent offline divergence + merge — a **Scale-3 federation**
concern, **deferred**.

## 4. The coherence model — a control loop, not a storage protocol

Co-equal writable views cannot be kept consistent by storage cleverness, *because the writes are
agentic* — an LLM spraying tokens produces disconnected, ungrounded memories unless something catches
it. Coherence here is a **two-tier control loop** plus legibility:

- **Tier 0 — Legibility** (D108 Front-1, **done**): one canonical, cheap-to-acquire conceptual model
  (Page/Thing/Concept ↔ frames ↔ SKOS ↔ two hierarchies), single-sourced and referenced from every
  channel. Every agent can *understand* the structure.
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
the same floor (admitted or 422'd) and the same loop (curated for fit)**. The canonical graph is the
post-floor, post-loop state; views render from it. The agentic behavior is **contained by the floor and
curated by the loop** — there is no symmetric-merge problem because writes serialize through floor+loop,
not on two free-running copies.

We already have the seeds, scattered: **D73 two-stage commit** *is* a floor/loop split (`working/` light
floor + deferred curation → `crystallize` strict floor); **pod-curator** is a Tier-2 sub-agent; the
`mem:*` triggers are the loop's signals; D108 Front-1's drift-guard tests are the *dev-agent's* version
of the loop. D109's contribution is recognizing these compose into one model.

## 5. The grammar's role (frames RQ-Grammar-1)

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

## 6. Decomposition + sequencing

Too large for one spec. Each sub-project gets its own spec → plan → build cycle.

| | Sub-project | What | Status |
|---|---|---|---|
| **A** | **RQ-Grammar-1** | complete, reversible, rule-grounded, refinement-ready, discovery-consistent **markdown write-view into the canonical graph** (build the forward markdown→graph direction now; design the graph→markdown direction in, don't build it) | **next** — brainstorm to its own spec |
| **B** | **D108 Front-2** | the **admission floor**: in-band/synchronous projection so the validator validates the *projected graph*; container=gate / class=dispatch; `constrainedBy` on durable containers, `working/` permissive; 422 reserved for judgment metadata; dev-side tests encoding the frame model | after A (A makes the floor *honest*) |
| **C** | **Curation loop** | **Karpathy Lint as a continuous agentic process**; elevate pod-curator to the Tier-2 reviewer; wire `mem:*` triggers; "enough info for the refinement process" contract | after/with B |
| **D** | **View layer** | graph→document **regeneration**; the graph as a second writable view; conneg-by-profile `?_profile=` view selection (D107 §6) | **deferred** — design-for now |

Then: re-run **RQ-View-2** once A + B land (the eval that surfaced all this; it was gated on D108).

## 7. Open decisions deferred to the sub-specs (recorded so they're not lost)

- **(A)** the concrete inline syntax for the **literal axis + subject-switching** — Sparna-informed
  (`{=…}` sets the subject and scopes over a block; `[text]{property}` for literals) but **trimmed**:
  LMs should not author Sparna's full block-cluster/sibling machinery, and we have an implicit-subject
  advantage Sparna lacks (`<>` Page default / `<#this>` Thing default). Datatype/lang tags are a Sparna
  open gap we must close ourselves.
- **(A)** reconcile the **two drifted predicate maps** — `shared/markdown-parsing/src/predicates.ts`
  (render path, legacy `vault:`) vs the served `context.jsonld` + shape `sh:agentInstruction`
  (projection path, current `cito:`/`skos:`). Canonical = the projection path. (provenance doc + D106
  review flagged this.)
- **(B)** the **floor/loop line** for *durable* shapes: strict floor (422 demands `prefLabel`, a valid
  `broader`, etc. at write → fewer bad memories, more write friction) vs. light floor + strong loop
  (admit permissively, curate after → easy writes, transient incoherence). D73's container split
  (`working/` light, durable strict) is the default frame; the open question is how much the *durable*
  floor demands vs. defers to the loop.
- **(D)** the **view-authoring / regeneration** mechanics (who authors view definitions; how graph→doc
  re-rendering preserves human-authored prose); single-master vs symmetric-master (Scale-3, deferred).

## 8. Relationship to prior decisions

- **Realizes D70** — the L1/L2/L3 split that was "not honored in practice" (CLAUDE.md): graph-canonical
  substrate + view layer is L1/L2; wiki-memory is a bounded L3 profile over it.
- **Completes D58/D71** — dual-layer linking was built one-directional + lossy; D109 makes the body↔graph
  projection complete, validated, and (eventually) bidirectional.
- **Honors D81** — governed predicates *are* the admission floor's structural commitment.
- **Builds on D95/D96** — the two subjects (`<>` Page / `<#this>` Thing) are the subjects the grammar
  must address; the grammar gap is that authoring never reached `<#this>`.
- **Builds on D105/D106/D108** — the two hierarchies + the SKOS-backbone/frame model are the sound spine.
- **Umbrella over D108** — Front-1 (legibility) = Tier 0; Front-2 (enforcement) = Tier 1 / sub-project B.
- **Resolves the deep slice of RQ-Substrate-4** — D107 fixed the URI/namespace slice; the deferred view
  layer (D107 §6) is sub-project D here.
- **Frames RQ-Grammar-1** (sub-project A) and **RQ-Enforce-1** (sub-project B, in-band projection).
