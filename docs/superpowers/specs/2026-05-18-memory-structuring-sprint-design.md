# Memory Structuring Sprint — wiki-memory L3 substrate completion

**Status**: Approved design, ready for implementation plan
**Date**: 2026-05-18
**Branch**: main
**Decisions touched**: D17 (MonitoringStore), D44 (storage description as router), D49 (vocabulary declaration), D50 (sh:agentInstruction), D52 (affordance descriptors), D55 (three-tier access), D56 (Solid Notifications), D58 (dual-layer linking), D64 (tombstones), D65 (MonitoringStore CDC), D67 (additive Link/Vary headers), D70 (L1/L2/L3 stratification), D71 (wiki-memory as canonical L3), D72 (compile-once), D73 (two-stage commit), D74 (memory-substrate trigger vocabulary), D75 (rendered HTML serves humans, no RDFa), D76 (wiki-memory URI layout), D77 (shape catalog), D78 (class-based targeting), D79 (context document), D81 (predicate-level governance), D83 (Pod-as-toolkit), D84 (URI conformance), D86 (PROF + conneg), D87/D88 (capabilities + tmpl: vocab), D91 (wiki-search), D92 (DataAccessor walker)
**Sprint scope**: Phase A (synthesis layer) + Phase B (operations layer) + Phase C (notifications layer). Shape coverage for Concept/Source/Procedure/WorkingMemory/Page is **deferred to a follow-on sprint** ("Memory Structuring Sprint Phase 2 — Shape Completion") so this sprint stays architecture-first.
**Decisions to ratify**: D93 (wiki-memory L3 synthesis page as primary agent entry point), D94 (`mem:` vocabulary: Operation / Event / Announcement taxonomy), K-note (JSON-LD `<script>` tag in rendered HTML output is not RDFa and is compatible with D75)

## Context

The wiki-memory L3 reference profile, as it stands after Phase 5j + AddressBook + owner-identity + Phase 7a wiki-search, has the catalogs and shapes a substrate needs (D44 router → D49 vocabulary declaration → D52 affordance catalog → D77 shape catalog → D83 capability catalog → D84-86 PROF descriptors → D87 wiki-search affordance), but it lacks three things an agent reaching for it actually needs:

1. **A synthesis layer.** No single document tells an agent — skilled or blind — what wiki-memory L3 *is*, how to be productive in it, or how the catalogs compose. The catalogs are individually discoverable; their relationship is not.
2. **An operations layer.** Two-stage commit (D73) names `mem:Crystallize` as the durable-promotion verb but there's no surfaced taxonomy of operations, no RDF-typed action vocabulary, and no affordance descriptors for the operations agents are expected to perform.
3. **A notifications layer.** Memory-substrate triggers (D74) name five `mem:Event` types but neither the vocabulary nor the substrate machinery that emits them have been built. There's no LDN inbox for substrate-emitted analysis events and no announcement log for agent-emitted memory operations.

This sprint closes all three gaps as one coherent architecture. It explicitly leaves shape-content work (predicates, cardinalities, templates per type) for a follow-on sprint, because that's content authoring rather than substrate infrastructure and needs different review cadence.

## Two use cases this design must serve

The design is constrained by serving two qualitatively different agents simultaneously:

**Use case A — Skilled agent.** Claude Code (or any runtime) with the `solid-wiki-memory-l3` skill loaded. The skill encodes wiki-memory conventions; the agent uses pre-built primitives (the `solid-pod` CLI surface from D29). The substrate is the *authority* — if skill and substrate disagree, substrate wins — but the skill is a fast path.

**Use case B — Blind agent.** A generic web-capable client. Could be an LLM with only `curl` + RDF parsing. Could be a non-Claude agent runtime. Could even be a human reading the Pod with a browser. Has no wiki-memory-specific knowledge — only the layered web standards underneath (HTTP, RDF, Turtle, JSON-LD, Solid Protocol, LDP, SHACL, AS2, LDN, PROF, RFC 6906). Must bootstrap from the substrate's self-description.

The constraint that falls out: **the substrate's self-description must be complete enough that a blind agent can derive the skilled agent's behavior from the standards underneath.** The skill is a shortcut, not a prerequisite. This constraint is what makes wiki-memory L3 portable — if the synthesis works for a blind agent on one Pod, it works on any Pod, regardless of which agent runtime is talking to it.

## Architectural commitments

Five high-level commitments that shape every component below:

1. **Wiki-memory L3 is a layer, not an application.** Per D70/D71. Other applications (vault-import, future overlays, RLM agent substrate) layer *on top of* wiki-memory L3, treating it as their memory substrate. The synthesis describes the L3 profile; L2 invariants and L4 applications are separate concerns.

2. **Direct LDP for writes; LDN inbox for substrate-emitted events; Solid Notifications for fan-out.** Agents perform memory operations as standard LDP CRUD sequences (PUT, PATCH, DELETE). SHACL `ldp:constrainedBy` on each destination container enforces shape at write time. The LDN inbox is *only* for things the substrate emits that don't fit per-resource CRUD events. Solid Notifications WebhookChannel2023 handles fan-out to subscriber inboxes. This explicitly rejects the "LDN as primary write API" model (Model A in the brainstorming) in favor of "direct LDP + LDN as side-channel" (Model B).

3. **Everything is RDF-typed.** Operations, events, and announcements all have `rdf:type` classes in the `mem:` vocabulary. An agent reading any inbox entry, affordance descriptor, or PROV-O record can introspect what category of thing it's looking at via `rdfs:subClassOf` queries. This is the "small linked vocabulary built on a small subset of an ontology" pattern Chuck flagged as the linked-data discipline.

4. **One entry point, dogfooded as a wiki-memory page.** The wiki-memory L3 synthesis lives at the substrate root (`/vault/wiki/`) as a wiki-memory page itself — body markdown + `.meta` Turtle + embedded JSON-LD in rendered HTML. The synthesis follows the conventions it describes. Parallels the entry-point pattern emerging in `llms.txt` (Howard / fast.ai), A2A `/.well-known/agent.json` (Google), and NLWeb's schema.org-embedded discovery (Microsoft + Schema.org), but uses Solid-native vocabularies throughout.

5. **U-shape reinforcement.** The synthesis is referenced at every substrate self-description touch-point — every SHACL shape's `sh:agentInstruction`, every affordance's `dct:description`, every inbox container's `.meta` — so any path through the substrate eventually loops back to the synthesis. For skilled agents this is context reinforcement; for blind agents this is gravity (every path leads back to the bootstrap).

## Layered discovery channels

A blind agent has multiple, layered self-description channels — these aren't competitors, they stack. From most generic to most project-specific:

| Channel | What it gives a blind agent | Grounding |
|---|---|---|
| HTTP + RFC 6906 `Link: rel="profile"` | "this resource conforms to this profile IRI" | IETF Informational |
| VoID `void:vocabulary` in storage description (D49) | "vocabularies in use, dereferenceable" | W3C Recommendation |
| Solid storage description (D44) | "this is a Pod; here are its catalogs" | Solid Protocol v0.11.0 |
| PROF profile descriptors (D84–D86) | "wiki-memory L3 conforms to these profiles; here are the artifacts" | W3C PROF (WG Note); RFC 6906 |
| SHACL shape catalog with `sh:agentInstruction` (D50) | "for resources of class X, do these things" | SHACL 1.2 §8 |
| Embedded JSON-LD in rendered HTML | structured discovery for clients that only do GET on HTML | `<script type="application/ld+json">` (schema.org pattern) |
| `wiki:affordanceCatalog` (D52) | "the substrate offers these operations" | Project-defined |
| `wiki:capabilityCatalog` (D83) | "these capabilities are installed" | Project-defined |
| Synthesis document (this sprint, Phase A) | "here's how the pieces compose into a coherent memory" | Project-defined |

An agent stops descending the moment it has enough to act. A capable blind LLM might bootstrap from just the storage description + shape agent-instructions. A less capable one needs the synthesis prose. The synthesis isn't a *replacement* for the catalogs — it's an *index* over them that optimizes the bootstrap pathway.

---

## Phase A — Synthesis layer

The wiki-memory L3 synthesis is the wiki-memory's own self-description, surfaced at the substrate root as the primary agent entry point.

### A.1 — Synthesis resource

**URI**: `/vault/wiki/` (the substrate root container)
**Representations**:
- `text/markdown` — body prose synthesis (the human-and-LLM-readable narrative)
- `text/turtle` — `.meta` triples (the agent-readable structural description)
- `text/html` — rendered HTML with embedded JSON-LD `<script>` block (the lowest-friction blind-agent surface)

The `text/markdown` and `text/turtle` representations follow the existing wiki-memory L3 conventions for pages (D71 page-as-unit; D76 URI layout; D58/D71 dual-layer linking). The synthesis is itself a wiki-memory page, satisfying the dogfooding constraint: if a blind agent can read this synthesis, it has proved it can read wiki-memory L3 pages.

**Body markdown sections** (content authored per HR-5 review checkpoint below):
- Overview: what wiki-memory L3 is, its L1/L2/L3 layering position
- Container layout: pages, sources, people, procedures, working — what each holds
- Type taxonomy: 5-shape catalog (D77), how class-based targeting works (D78)
- Conventions: dual-layer linking (D58/D71), two-stage commit (D73), predicate-level governance (D81)
- Affordances available: links into `/meta/affordances/` with one-line descriptions per affordance
- Operations: link into the operation taxonomy (Phase B) with the Operation classes enumerated
- Events and announcements: links into `/wiki/.events/` and `/wiki/.operations/` (Phase C) describing each Event subclass
- Cross-session orientation: how to read the operations log to learn what changed since prior session
- Pointers: storage description, shape catalog, capability catalog, type index, profile descriptors

**`.meta` triples** include:
- `dct:conformsTo </meta/profiles/wiki-memory-l3>` — declares this is the L3 profile document
- `dct:hasPart` pointing to each major substrate component (catalogs, containers, vocabularies)
- `wiki:profileDocument` (NEW predicate, added to wiki-vocabulary) — back-reference convention so other resources can point at *this* document
- `wiki:bootstrapResource` (NEW predicate) — links to the smallest set of resources a blind agent should fetch (storage description, shape catalog, affordance catalog, type index, this synthesis)

### A.2 — Embedded JSON-LD in rendered HTML

The `markdown-render` extension currently emits HTML for the `text/html` representation per D75 (rendered HTML serves humans; no RDFa embedding). This sprint extends `markdown-render` to also emit a JSON-LD `<script type="application/ld+json">` block in the rendered HTML, carrying the resource's `.meta` triples (or a curated subset).

This is the schema.org / NLWeb pattern and is **not RDFa** (which D75 forbids). JSON-LD `<script>` tags are cleanly separable from HTML body markup and don't introduce the attribute-tangling problems that motivated D75's RDFa rejection. We ratify this as a K-note (a clarification of D75's intent, not a reversal) rather than a new D-decision, because D75's "rendered HTML serves humans" framing remains correct — embedded JSON-LD serves *agents* who chose HTML as their representation, and is an additive enhancement.

The script-tag content is curated to include:
- Resource type (`@type` from `rdf:type` triples)
- Conformance declarations (`dct:conformsTo`)
- Key navigational predicates (`wiki:profileDocument`, `wiki:bootstrapResource`, `rdfs:seeAlso`, `dct:hasPart`)
- For the synthesis page specifically: a full structural map of the substrate

Other wiki-memory pages get a smaller, per-page subset. A blind agent doing `GET /vault/wiki/concepts/foo.md` with `Accept: text/html` sees the rendered concept page + a JSON-LD script tag describing the concept's typed edges.

### A.3 — Strengthened PROF descriptor

The PROF descriptor at `/vault/meta/profiles/wiki-memory-l3` (already shipped per Phase 5j) gets strengthened with:
- `prof:hasResource` pointing at the synthesis page as `prof:role wikirole:overview` (a new wikirole concept)
- `prof:hasResource` pointing at the operation taxonomy file as `prof:role wikirole:operation-vocabulary`
- `prof:hasResource` pointing at the announcement log container as `prof:role wikirole:operation-log`
- `prof:hasResource` pointing at the substrate event inbox as `prof:role wikirole:event-stream`

The wikirole SKOS scheme (Phase 5j) gets four new concepts: `wikirole:overview`, `wikirole:operation-vocabulary`, `wikirole:operation-log`, `wikirole:event-stream`.

### A.4 — Storage description integration

`/vault/.well-known/solid` (per D44) gets:
- A new pointer `wiki:profileDocument </vault/wiki/>` so the synthesis is discoverable at the router level
- An updated `dct:description` referencing the synthesis as the primary entry point

The synthesis IRI (`/vault/wiki/`) is the smallest, most-stable IRI any agent needs to remember to find everything else. From here, every other resource is reachable in ≤3 hops.

### A.5 — Cross-references back to synthesis (U-shape reinforcement)

Every substrate self-description resource gains a back-reference to the synthesis:

- **Each SHACL shape's `sh:agentInstruction`** ends with: "See `</vault/wiki/>` for the full L3 profile and inter-shape conventions."
- **Each affordance descriptor's `dct:description`** includes a `dct:isPartOf </vault/wiki/>` link.
- **Each container's `.meta`** (operations log, events inbox) includes `dct:isPartOf </vault/wiki/>`.
- **The capability catalog** at `/vault/meta/capabilities/` references the synthesis as its "profile context."

This means updating *existing* artifacts (shape `.ttl` files, affordance descriptor files, container `.meta` patches in `overlays/wiki-memory/manifest.ttl`), not just adding new ones. The implementation plan must enumerate these touches.

---

## Phase B — Operations layer

The operations layer defines the verb taxonomy agents use when mutating memory, plus the affordance descriptors and skill primitives that surface those verbs to skilled and blind agents alike.

### B.1 — The `mem:` Operation vocabulary

Lives at `https://pod.vardeman.me/vault/ontology/mem` (hash-namespace per D84). Class hierarchy:

```turtle
@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix as:   <https://www.w3.org/ns/activitystreams#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .

# ---- Operation classes (referenced by affordance descriptors + PROV-O) ----
# These are CATEGORIES of agent action, not messages.
# An agent performs an operation as a sequence of LDP CRUD ops.
# The operation's TYPE is recorded in the resulting resource's .meta via
# prov:wasGeneratedBy [a mem:CrystallizeOperation; ...].

mem:Operation
    a owl:Class ;
    rdfs:label "Memory operation" ;
    rdfs:comment "A category of agent action on wiki-memory L3. Performed as a sequence of standard LDP operations; not transmitted as a message." .

mem:CrystallizeOperation rdfs:subClassOf mem:Operation .
mem:SupersedeOperation   rdfs:subClassOf mem:Operation .
mem:MergeOperation       rdfs:subClassOf mem:Operation .
mem:DemoteOperation      rdfs:subClassOf mem:Operation .
mem:ArchiveOperation     rdfs:subClassOf mem:Operation .
mem:LinkOperation        rdfs:subClassOf mem:Operation .

# ---- Event classes (substrate-emitted; appear in /wiki/.events/) ----
mem:Event
    a owl:Class ;
    rdfs:subClassOf as:Activity ;
    rdfs:label "Substrate analysis event" ;
    rdfs:comment "An event emitted by the wiki-memory substrate from cross-resource analysis or scheduled inspection; arrives in agents' subscriber inboxes via Solid Notifications fan-out." .

mem:BoundExceeded         rdfs:subClassOf mem:Event .
mem:ContradictionDetected rdfs:subClassOf mem:Event .
mem:ConsolidationSuggested rdfs:subClassOf mem:Event .
mem:ReflectionDue         rdfs:subClassOf mem:Event .
mem:OODQuerySignal        rdfs:subClassOf mem:Event .
mem:UnprocessableWrite    rdfs:subClassOf mem:Event .

# ---- Announcement classes (agent-emitted; appear in /wiki/.operations/) ----
mem:Announcement
    a owl:Class ;
    rdfs:subClassOf as:Activity ;
    rdfs:label "Memory operation announcement" ;
    rdfs:comment "A past-tense activity an agent posts to the operations log after completing a memory operation. Informational; not a command. The corresponding operation is in mem:Operation." .

mem:Crystallized rdfs:subClassOf mem:Announcement .
mem:Superseded   rdfs:subClassOf mem:Announcement .
mem:Merged       rdfs:subClassOf mem:Announcement .
mem:Demoted      rdfs:subClassOf mem:Announcement .
mem:Archived     rdfs:subClassOf mem:Announcement .
mem:Linked       rdfs:subClassOf mem:Announcement .
```

The asymmetry (Operations are *not* `as:Activity`; Events and Announcements are) is intentional: Operations are categories of action referenced in affordance descriptors and PROV-O provenance, not messages. Events and Announcements ARE messages.

### B.2 — Per-operation LDP procedure

Each operation has a defined LDP procedure. The procedure is documented in the affordance descriptor and implemented by the operation's skill in `solid-agent-skills`. **All procedures are subject to HR-3 (per-operation LDP procedure review).**

Sketch per operation:

- **Crystallize** (working → durable). Agent does: `GET /wiki/working/{slug}.md` → optional client-side SHACL validation → `PUT /wiki/{class-container}/{slug}.md` (destination class determined by Type Index D78; SHACL validates server-side via `ldp:constrainedBy`) → on 201 success, `DELETE /wiki/working/{slug}.md`. Memento listener captures both events. PROV-O on destination: `prov:wasGeneratedBy [a mem:CrystallizeOperation; prov:wasAssociatedWith <agent-webid>; prov:atTime ...]; prov:wasDerivedFrom </wiki/working/{slug}.md>`.

- **Supersede** (replace existing durable with refined version). Agent does: `GET /wiki/{class}/{slug}.md` (existing) → compose refined version → `PUT /wiki/{class}/{slug}.md` (Memento snapshots prior). PROV-O on the updated resource: `prov:wasGeneratedBy [a mem:SupersedeOperation; ...]; prov:wasRevisionOf <prior-memento-uri>`.

- **Merge** (combine N → 1). Agent does: `GET` each source → compose merged version → `PUT /wiki/{class}/{merged-slug}.md` (new URL or reuse one of the inputs) → `DELETE` the unused sources. PROV-O on merged: `prov:wasDerivedFrom` lists all inputs; `prov:wasGeneratedBy [a mem:MergeOperation; ...]`.

- **Demote** (durable → working, for reconsideration). Agent does: `GET /wiki/{class}/{slug}.md` → `PUT /wiki/working/{slug}.md` (Memento captures the durable version before the source-side change) → `DELETE /wiki/{class}/{slug}.md`. PROV-O on the working note: `prov:wasGeneratedBy [a mem:DemoteOperation; ...]; prov:wasDerivedFrom <durable-memento>`.

- **Archive** (durable → tombstone). Reuses D64 tombstone pattern. Agent does: `PATCH /wiki/{class}/{slug}.md.meta` adding tombstone triples. No deletion (D64 soft-delete). PROV-O records `mem:ArchiveOperation`.

- **Link** (typed cross-reference). Agent does: `PATCH /wiki/{class}/{slug}.md.meta` adding typed-edge predicates per D58/D81 governance. Subject is the resource; predicate is one of the substrate-governed edges (e.g., `wiki:extends`, `wiki:supports`, `cito:cites`).

**Memento interaction is uniform**: the existing memento listener (`MementoCommitListener`, D65-D68) captures snapshots on every `as:Update`/`as:Delete` it observes. Operations that involve PUT+DELETE pairs (Crystallize, Demote, Merge) get implicit snapshots of both endpoints. Operations that only PUT (Supersede) get the prior snapshot automatically. No new memento wiring is required for this sprint, but per-operation tests should verify the snapshot behavior.

### B.3 — Affordance descriptors per operation

Each operation gets an affordance descriptor at `/vault/meta/affordances/{operation-name}.ttl`. Example for Crystallize:

```turtle
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix dct:  <http://purl.org/dc/terms/> .

</vault/meta/affordances/crystallize#this>
    a wiki:Affordance ;
    wiki:operation mem:CrystallizeOperation ;
    dct:title "Crystallize a working note to durable storage." ;
    dct:description "Promotes a working note from /vault/wiki/working/ to its class-appropriate durable container (per Type Index D78), validating against the destination class's SHACL shape. See </vault/wiki/> for the full L3 profile." ;
    dct:isPartOf </vault/wiki/> ;            # U-shape back-reference
    wiki:precondition "Source resource exists at /vault/wiki/working/{slug}.md and conforms to the working SHACL shape" ;
    wiki:postcondition "Resource appears at /vault/wiki/{class-container}/{slug}.md, conforms to that class's SHACL shape, source has been deleted, Memento has captured both events, PROV-O records the CrystallizeOperation" ;
    wiki:errorMode "If destination SHACL rejects, 422 returned with sh:ValidationReport body; agent retries with corrected resource" ;
    wiki:procedure ( "GET /vault/wiki/working/{slug}.md"
                     "PUT /vault/wiki/{class-container}/{slug}.md"
                     "DELETE /vault/wiki/working/{slug}.md"
                     "POST mem:Crystallized announcement to /vault/wiki/.operations/" ) .
```

The affordance descriptor IS the contract the skilled and blind agent both rely on: skilled agents have skills that wrap the procedure; blind agents read the procedure and execute it themselves via `curl`-equivalent operations.

Affordance descriptors are subject to **HR-4 (affordance description and procedure review)**.

### B.4 — Operation skills in `solid-agent-skills`

Six new skills, one per operation, in the sibling `solid-agent-skills` repository. Each skill:
- Is invokable as a tool (e.g., `solid-pod crystallize <working-url>`)
- Implements the LDP procedure from the affordance descriptor
- POSTs the corresponding announcement to `/vault/wiki/.operations/` as its final step (Option 3 from brainstorming: skill-emits-announcement)
- Returns structured success/failure to the calling agent

The announcement-emission pattern is the substrate's contract: any agent using the official skill gets clean operation logs for free. Agents that bypass the skill (or interact with the substrate via raw LDP) are responsible for emitting their own announcements if they want the log to be complete.

---

## Phase C — Notifications layer

### C.1 — Two append-only containers

**`/vault/wiki/.operations/`** — agent announcement log.
- LDP `BasicContainer`
- Advertises `ldp:inbox` on `/vault/wiki/`
- WAC: write-permitted to anyone who has write on the wiki-memory (Chuck, Chris, agents authenticated as them); read-permitted to everyone with read on the substrate
- Append-only by convention (no POST-update; new file per announcement)
- File naming convention: `{ISO8601-timestamp}-{uuid}.ttl` (sortable)
- GC: **none in v1**. The log is durable. Time-based pruning is a follow-on decision; we surface it as an open question (RQ-Log-1).

**`/vault/wiki/.events/`** — substrate-emitted analysis events.
- LDP `BasicContainer`
- WAC: write-permitted *only* to the substrate (an internal write that bypasses the normal WAC pipeline OR is owned by a substrate WebID — see "Details to pin"); read-permitted to subscribers
- Append-only
- Same file naming convention
- GC: substrate-controlled; events may be pruned after they've been processed by subscribers (RQ-Event-1)

Both containers' `.meta` resources include `dct:isPartOf </vault/wiki/>` per the U-shape pattern, plus `rdfs:comment` describing their purpose.

### C.2 — Solid Notifications subscription pattern

CSS v8 ships `WebhookChannel2023`, `WebSocketChannel2023`, and `StreamingHTTPChannel2023` channels (already enabled via `css:config/http/notifications/all.json` in our `dev-allow-all` config). Agents subscribe via the standard Solid Notifications subscription endpoint at `/.notifications/`.

For polling agents (the dominant pattern given Claude Code's intermittent lifecycle), the recommended subscription is **WebhookChannel2023** with the callback URL being the subscriber's own `/inbox/` on their own Pod. The substrate POSTs notifications to that URL when:
- A new resource appears in `/vault/wiki/.operations/` (someone announced an operation)
- A new resource appears in `/vault/wiki/.events/` (substrate detected something)
- A wiki-memory page is created/updated/deleted (per-resource CRUD, fired by CSS's existing notification machinery)

The subscriber's agent polls its own inbox on next wake-up.

For an agent that *is* running and wants real-time updates within the session, `StreamingHTTPChannel2023` is preferred over `WebSocketChannel2023` because it's HTTP-native and doesn't require WebSocket framing. This is a session-local subscription that's torn down when the session ends.

Subscription registration details are subject to **HR-2 (subscription flow review)**.

### C.3 — MemTriggerListener (CSS extension)

A new CSS extension at `css/extensions/mem-trigger/` that watches the wiki-memory via MonitoringStore CDC (pattern from D65 / `MementoCommitListener`) and emits `mem:Event` activities to `/vault/wiki/.events/` based on cross-resource analysis.

The detection logic per Event class is non-trivial. **Each detector is subject to HR-6 (event-detection algorithm review).** Sketches:

- **`mem:BoundExceeded`** — When a container's `ldp:contains` count exceeds 12 (xMemory Fano bound, per D70/D71). Detection: container `.meta` change triggers a child-count check. Trigger: when count crosses 12 going up. Emission rate: at most once per container per 24h to avoid flapping.

- **`mem:ContradictionDetected`** — When two resources have conflicting typed edges (e.g., A `wiki:supports` B and A `wiki:criticizes` B). Detection: substrate maintains a small inverted index of `(subject, predicate-pair)` for predicate pairs known to conflict; check on every `.meta` change. Implementation cost is real; v1 may ship with a *limited* detector (a hand-picked list of contradicting predicate pairs) and broaden later.

- **`mem:ConsolidationSuggested`** — When N resources cluster around a topic that doesn't have a hub page. Detection: requires running the hub-view affordance periodically and checking which topic clusters have no curated hub page. Implementation cost is high; v1 may defer the actual detector and emit only via manual trigger (a substrate admin endpoint), with full automation deferred to a follow-on.

- **`mem:ReflectionDue`** — Time-based: emit periodically (e.g., daily) when no `mem:ReflectionDue` event has been emitted in the last interval AND there's been substrate activity. Implementation: simple timer + activity check. Lowest implementation cost.

- **`mem:OODQuerySignal`** — When wiki-search (D87/D91) returns zero or low-quality results for a user query. Detection: requires integration with the wiki-search extension to capture queries + result counts. Implementation cost: medium. v1 may ship with logging only (collect signals; don't emit Event yet) and ratify the emission rule in a follow-on after we see actual query data.

- **`mem:UnprocessableWrite`** — When a SHACL-validated write is rejected. Detection: hook the `ShapeValidationStore` (existing) to emit on rejection. Implementation: thin; the shape-validator already produces a `sh:ValidationReport`; the extension wraps it in an AS2 `mem:UnprocessableWrite` activity and POSTs to `/wiki/.events/`. **This is the easiest detector to ship and provides the most immediate agent value.**

**Phased implementation within Phase C**:
- **C.3.a** (must ship): `UnprocessableWrite`, `ReflectionDue`, `BoundExceeded` — the three with cleanest detection logic
- **C.3.b** (should ship): `ContradictionDetected` with a hand-picked predicate-pair list
- **C.3.c** (may defer): `ConsolidationSuggested`, `OODQuerySignal` — log-only in v1; emission deferred to follow-on after observation of actual data

### C.4 — Three-actor convention for activities

Activities in `/vault/wiki/.operations/` and `/vault/wiki/.events/` follow the COAR Notify three-actor pattern:

- `as:actor` — the responsible party. For agent announcements, the human/agent WebID. For substrate-emitted events, a stable substrate identity IRI (`<urn:substrate:mem-trigger-listener>` in v1; can be promoted to a real WebID later when agent identity work lands per behavior-before-security).
- `prov:wasAssociatedWith` (or `as:origin`) — the runtime that performed the operation (e.g., `<urn:agent:claude-code>`, the listener's IRI itself).
- `as:target` — the substrate inbox URL the activity was posted to.

This split is the standard COAR pattern for separating "who is responsible" from "what software ran it," and it gives us clean audit trails when an agent acts on behalf of a user.

### C.5 — Multi-user fan-out

The shared wiki-memory case (Chuck and Chris on Chuck's Pod with WAC-granted access to Chris) works via standard Solid Notifications fan-out:

- Chuck subscribes via `/.notifications/` with callback URL `<chuck-pod>/inbox/`
- Chris subscribes the same way to `<chris-pod>/inbox/`
- When the substrate POSTs an event to `/vault/wiki/.events/`, CSS's existing notification subsystem fires fan-out to both subscribers
- Subscribers' Pods receive the webhook POST, append the activity to their `/inbox/`
- Each user's agent polls their own `/inbox/` on next wake

No special multi-user wiring on the substrate side — CSS's Solid Notifications handles subscriber registry, fan-out, retry, channel format. WAC on the events container controls which events each subscriber is entitled to receive (subscription is per-resource; CSS already considers this).

---

## Details to pin

The brainstorming surfaced six items that are decided in principle but need concrete commitment in the implementation plan. Locking them here:

1. **Inbox advertisement.** `ldp:inbox` triples added to:
   - `/vault/wiki/.meta` advertising `</vault/wiki/.operations/>` as the wiki-memory's operations log
   - `/vault/wiki/.meta` advertising `</vault/wiki/.events/>` (using a sibling predicate, `wiki:eventStream`, since `ldp:inbox` strictly refers to a single inbox — events are a separate stream)
   - Each user's WebID profile advertises their own `/inbox/` as the subscriber inbox (existing convention)

2. **WAC config.**
   - `/vault/wiki/.operations/` — `acl:Read` to anyone with read on `/vault/wiki/`; `acl:Append` (NOT full Write) to anyone with write on `/vault/wiki/`. Append-only enforcement is via WAC, not application logic.
   - `/vault/wiki/.events/` — `acl:Read` to anyone with read on `/vault/wiki/`; external `acl:Append` denied (substrate-only writes). The MemTriggerListener writes via the in-process `ResourceStore` (privileged-by-design at the data layer; bypasses WAC the same way internal CSS components do), so no substrate WebID needs to be provisioned for this sprint. Under `dev-allow-all` the external Append-deny is informational; under real auth (post-Rung-1.5, per behavior-before-security) it becomes enforced.

3. **Channel choice.** `WebhookChannel2023` for polling agents (the default); `StreamingHTTPChannel2023` for session-local real-time. `WebSocketChannel2023` available but not the default. Documented in the synthesis page.

4. **Subscription registration flow.** Agents register via standard Solid Notifications subscription endpoint at `/.notifications/`. The agent skill `inbox-subscribe` in `solid-agent-skills` wraps the registration; documented in the synthesis. Subscription scope: the agent subscribes to `/vault/wiki/.operations/`, `/vault/wiki/.events/`, and (optionally) `/vault/wiki/` itself for per-resource CRUD events.

5. **GC / retention.** No GC in v1.
   - `.operations/` is the wiki-memory's chronological log; treated as durable.
   - `.events/` is substrate-emitted; the substrate may prune events after a configurable interval (default 30 days). Implementation as a future Phase D follow-on; v1 ships append-only-forever.
   - **RQ-Log-1**: Should the operations log have any pruning? Defer until size becomes an issue (likely thousands of operations before this is a real concern).
   - **RQ-Event-1**: Should the events container have application-level pruning, or only Memento-based archival of pruned entries?

6. **Three-actor commitment.** All activities in `.operations/` and `.events/` MUST carry `as:actor`, `prov:wasAssociatedWith`, and `as:target`. The operation skills enforce this; the MemTriggerListener enforces this for substrate-emitted events. SHACL shapes for `mem:Announcement` and `mem:Event` validate the three-actor pattern.

---

## Human-review checkpoints

Six review checkpoints where Chuck (or other domain authors) sign off on prose, naming, or constraint choices before the corresponding artifact is burned into RDF. The implementation plan sequences these so each checkpoint completes before its dependent work begins.

- **HR-1 — Vocabulary class names.** Review and approve the names of `mem:Operation`, `mem:Event`, `mem:Announcement` and all subclass names listed in §B.1. Names are public IRIs; renaming after publication is expensive. **Owner**: Chuck. **When**: before `/vault/ontology/mem` is published.

- **HR-2 — Subscription registration flow.** Review the agent-side `inbox-subscribe` skill's interaction with `/.notifications/`. Confirm channel choice (Webhook vs StreamingHTTP defaults), subscription scope, and the documented registration sequence. **Owner**: Chuck. **When**: before Phase C extension implementation.

- **HR-3 — Per-operation LDP procedure.** Review each operation's LDP sequence (§B.2): Crystallize, Supersede, Merge, Demote, Archive, Link. Confirm Memento interaction expectations, conflict-handling, URL-naming conventions for derived resources. **Owner**: Chuck. **When**: before the operation skills are implemented.

- **HR-4 — Affordance descriptor descriptions.** Review each affordance descriptor's `dct:title`, `dct:description`, `wiki:precondition`, `wiki:postcondition`, `wiki:errorMode`, and procedure step strings. These are agent-facing prose that blind agents will read directly. **Owner**: Chuck. **When**: in parallel with HR-3 (descriptions reference the procedure).

- **HR-5 — Synthesis page prose.** Review the body markdown of `/vault/wiki/` itself. This is the wiki-memory's primary self-description; every blind agent will read it. The structure is specified in §A.1; the prose is human authorship. **Owner**: Chuck (possibly with co-authors as the wiki-memory matures). **When**: in parallel with Phase A implementation; the page can ship with placeholder prose and be refined.

- **HR-6 — Event-detection algorithms.** Review the detection logic for each `mem:Event` class (§C.3). Confirm thresholds (e.g., bound = 12), flapping protection (24h rate-limit), v1 scope reductions (which detectors ship full vs limited vs deferred). **Owner**: Chuck. **When**: before MemTriggerListener implementation.

---

## Decisions to ratify

This sprint adds two D-decisions and one K-note:

- **D93 — Wiki-memory L3 synthesis page as primary agent entry point.** Commits to the synthesis layer architecture: one entry point at the substrate root, dogfooded as a wiki-memory page, with embedded JSON-LD in rendered HTML. Cross-references the emerging entry-point pattern in `llms.txt` / A2A / NLWeb. Decision text drafted in the sprint and ratified at the end of Phase A.

- **D94 — `mem:` vocabulary: Operation / Event / Announcement taxonomy.** Commits to the three-category split, the class hierarchy, and the asymmetry that Operations are not `as:Activity` (categories of action) while Events and Announcements are (messages). Refines D74 by enumerating the full Event class set and adding the Operation and Announcement categories. Ratified at the end of Phase B.

- **K-note: JSON-LD `<script>` tag in rendered HTML is not RDFa; compatible with D75.** Clarifies that D75's RDFa rejection does not extend to embedded JSON-LD script tags, which are the schema.org / NLWeb pattern and are cleanly separable from HTML body markup. Filed alongside the `markdown-render` enhancement that adds the embedding.

Vault sync of D93/D94 follows the dual-numbering pattern: vault gets D89/D90 (continuing vault sequence after vault-D88 = repo-D92), with cross-reference to repo D93/D94.

---

## Test plan

Phase-aligned tests, each with concrete success criteria.

**Phase A — Synthesis layer tests**:
- A blind agent (Claude with only `curl` available, no skills loaded) is given the URL `https://pod.vardeman.me/vault/` and asked "what is wiki-memory L3 and how do I navigate it?" The agent should produce a coherent description of the substrate within a token budget of ~10,000 tokens, citing specific resources it fetched.
- A skilled agent doing the same task should produce the same quality of answer in ~2,000 tokens.
- The synthesis page, when fetched with `Accept: text/html`, returns rendered HTML containing a `<script type="application/ld+json">` block whose contents are valid JSON-LD with a `@context` and an `@id` matching the page URL.
- Every SHACL shape in the catalog, when fetched, contains a `sh:agentInstruction` that references `</vault/wiki/>` in its prose.

**Phase B — Operations layer tests**:
- A skilled agent invokes `solid-pod crystallize </wiki/working/foo.md>`. The result: `</wiki/concepts/foo.md>` exists with conforming SHACL shape, `</wiki/working/foo.md>` is gone, Memento has the working version at a `/foo.md?datetime=...` URL, the durable resource's `.meta` carries `prov:wasGeneratedBy [a mem:CrystallizeOperation; ...]`, and `</wiki/.operations/>` has a new entry with `rdf:type [as:Activity, mem:Crystallized]`.
- A blind agent fetches `</meta/affordances/crystallize>`, reads the procedure, and executes the same workflow via raw `curl`. Same end state. Higher token cost.
- Each operation has a similar end-to-end test.
- SHACL rejection: an agent attempts `crystallize` on a working note that doesn't conform to the destination class shape. The PUT returns 422 with `sh:ValidationReport` body. The operation skill catches this, surfaces the report to the agent, and does NOT delete the source.

**Phase C — Notifications layer tests**:
- An agent subscribes to `/wiki/.operations/` via `/.notifications/`. A second agent performs a Crystallize. The first agent's webhook URL receives a POST with the `mem:Crystallized` activity.
- The MemTriggerListener emits `mem:BoundExceeded` when a container's ldp:contains count crosses 12. Verified by writing 13 resources into a test container and observing a new entry in `/wiki/.events/` with `rdf:type mem:BoundExceeded`.
- The MemTriggerListener emits `mem:UnprocessableWrite` when a SHACL-rejected write occurs. Verified by attempting a malformed write and observing the event.
- Cross-session continuity: agent A cold-starts, performs 3 operations across 10 minutes. Agent B cold-starts an hour later, fetches `/wiki/.operations/` ordered by timestamp, and produces a summary of the last hour's operations.

**Integration tests**:
- Full Phase A+B+C round trip: blind agent reads synthesis → finds operations taxonomy → fetches crystallize affordance → performs crystallize → observes its own announcement in the operations log. Demonstrates the substrate is self-describing end-to-end.

---

## Open research questions

New RQs filed by this sprint:

- **RQ-Log-1**: Operations log retention. Should `/vault/wiki/.operations/` have time-based pruning, or remain durable indefinitely? Defer until operational data exists.
- **RQ-Event-1**: Events container retention. Substrate-pruning + Memento archival, vs. permanent retention? Likely 30-day retention with Memento archival; ratify in follow-on.
- **RQ-Synth-1**: Synthesis page generation. Should the body markdown be hand-authored only, or partially generated from the structural metadata (catalogs, shapes, affordances)? Generated content would auto-update as substrate changes; hand-authored content has human voice. Hybrid likely best — sections generated, prose hand-authored.
- **RQ-Synth-2**: U-shape reinforcement frequency. How often during a long agent session should the synthesis be re-fetched to refresh context? Eval question for Rung 1.5+.
- **RQ-Event-2**: ContradictionDetected detector breadth. v1 ships with a hand-picked predicate-pair list. What's the right way to grow the list — community curation, eval-driven, or substrate-side learning?
- **RQ-Bootstrap-1**: Blind-agent bootstrap token budget. How efficiently can the synthesis layer convey the substrate to a blind LLM? Rung 1.5 eval question.

Existing RQs this sprint touches:
- **RQ-Listener-1**: CSS `.meta` overwrite-order — relevant if any operation modifies `.meta` and we hit the pre-write read problem (D81 Model A). Mitigation: operations that modify `.meta` use PATCH (additive) wherever possible, never PUT.
- **RQ-Discovery-1** (from D55): Does the 7-step first-arrival ritual scale? The synthesis layer is *the* answer to this question; Rung 1.5 will measure.
- **RQ-Affordance-2/3/4** (H-D82): Inline JSON-LD code blocks in body. The JSON-LD `<script>` tag in rendered HTML is a different mechanism (it's substrate-emitted from `.meta`, not agent-authored body content). H-D82 is unaffected.

---

## Out of scope / deferred

Explicitly punted; not part of this sprint:

- **Shape coverage for Concept/Source/Procedure/WorkingMemory/Page** — moved to a follow-on "Memory Structuring Sprint Phase 2 — Shape Completion." That sprint adds full predicates, cardinalities, templates, per-shape affordances, and agent instructions per shape class. Depends on this sprint's substrate being in place.
- **MOC convention** (curated hub pages) — deferred until Rung 1.5 eval shows agents struggle to navigate without curated hubs vs. doing fine with search + typed edges.
- **Wiki URI structure rethink** — flagged by Chuck; revisit before any larger refactoring.
- **L2 substrate documentation** (memory substrate invariants separable from L3) — future work; would parallel this sprint's L3 documentation at a higher abstraction level.
- **WAC scenario un-stubbing** (Phase 7a closeout) — behavior-before-security; agent credential model is downstream of eval evidence.
- **A2A / inter-application coordination** — out of scope; wiki-memory is one application; cross-application coordination is a separate concern.
- **VC credential extension** — research track per `docs/plans/2026-05-18-vc-credential-roadmap.md`.
- **Phase 7b/c/d** wiki-search work (engine swap, hybrid RRF, in-pod indexes) — deferred pending Rung 1.5 evidence.
- **Substrate pruning of `.events/`** — Phase D follow-on.
- **`ConsolidationSuggested` and `OODQuerySignal` full detectors** — log-only in v1; full emission deferred until observed data justifies emission rules.

---

## References

### Primary specifications

- **W3C Linked Data Notifications** (Rec, 2017) — <https://www.w3.org/TR/ldn/>
- **Solid Notifications Protocol** — <https://solidproject.org/TR/notifications-protocol>
- **W3C Activity Streams 2.0 Core** (Rec) — <https://www.w3.org/TR/activitystreams-core/>
- **W3C Activity Streams 2.0 Vocabulary** (Rec) — <https://www.w3.org/TR/activitystreams-vocabulary/>
- **W3C PROV-O** (Rec) — <https://www.w3.org/TR/prov-o/>
- **W3C SHACL** + **SHACL 1.2** drafts; `sh:agentInstruction` per §8 of SHACL 1.2
- **RFC 6906** *The 'profile' Link Relation Type* (Informational, March 2013)
- **W3C PROF — The Profiles Vocabulary** (WG Note, 18 Dec 2019)
- **Solid Protocol v0.11.0** — <https://solidproject.org/TR/protocol>
- **OASIS OSLC Query 3.0** (relevant for wiki-search D87/D91 integration)

### Working LDN deployments and conventions

- **dokieli** (Sarven Capadisli, canonical LDN producer/consumer for distributed annotations) — <https://github.com/dokieli/dokieli>
- **COAR Notify** specification (scholarly publishing LDN profile; multi-typing + three-actor patterns adopted) — <https://coar-notify.net/specification/1.0.0/>
- **CSS Solid Notifications** documentation — <https://communitysolidserver.github.io/CommunitySolidServer/latest/usage/notifications/>
- **Event Notifications work** (Ghent / IDLab) — Code4Lib article 17823 (production COAR Notify deployment)
- **SolidOS activitystreams-pane** (inbox UI; partial AS2 rendering) — <https://github.com/SolidOS/activitystreams-pane>

### Entry-point patterns (parallel conventions)

- **llms.txt** (Jeremy Howard, fast.ai) — <https://llmstxt.org/>
- **A2A (Agent-to-Agent) protocol** (Google) — `/.well-known/agent.json` agent discovery
- **NLWeb** (Microsoft + Schema.org) — embedded schema.org JSON-LD + `/ask` endpoint
- **Schema.org JSON-LD `<script>` tag** convention — <https://schema.org/docs/gs.html#schemaorg_expected>

### Wiki-memory and agentic-memory system implementations surveyed

(Drawn from the pre-brainstorming survey; informs verb taxonomy and lifecycle design)

- **Karpathy LLM Wiki** — Ingest / Query / Lint operations; ~100-page personal wiki
- **LLM Wiki v2** (Rohit Ghumare gist) — supersession, forgetting, consolidation, crystallization
- **Letta MemFS** (Letta-AI; formerly MemGPT) — <https://github.com/letta-ai/letta>; bash-tool memory operations over git-backed markdown
- **AKBP** (Rohit Ghumare; Agentic Knowledge Base Protocol) — <https://github.com/rohitg00/akbp>; Remember / Crystallize / Verify / Validate verbs
- **ByteRover** — Nguyen 2026; ADD/UPDATE/UPSERT/MERGE/DELETE; importance scoring; tiered retrieval
- **MemGPT** (Packer et al., arXiv:2310.08560) — Store / Retrieve / Summarize / Evict / Archive
- **Mem0** — <https://github.com/mem0ai/mem0>; LLM-driven extraction + ADD/UPDATE/DELETE/NOOP
- **A-MEM** (arXiv:2502.12110) — add_note / read / search_agentic / update / delete + link generation + memory evolution
- **ReasoningBank** (arXiv:2509.25140) — three-phase Memory Retrieval / Construction / Consolidation
- **Cognee** — <https://github.com/topoteretes/cognee>; four-verb API (remember / recall / forget / improve)
- **Zep** — <https://github.com/getzep/zep>; graph.add / thread.add_messages / graph.search + implicit fact extraction
- **Supermemory** — production memory-as-a-service; remember / search / merge / contradict; "never just appends"

### Project decisions and design history

Decisions touched by this sprint, with grouping:

- **Substrate foundation**: D44 (storage description as router), D49 (vocabulary declaration), D70 (L1/L2/L3 stratification), D71 (wiki-memory as canonical L3 reference profile), D72 (compile-once principle), D83 (Pod-as-toolkit)
- **Discovery and metadata**: D52 (affordance descriptors), D77 (shape catalog), D78 (class-based targeting), D79 (context document), D81 (predicate-level governance), D84 (URI conformance), D86 (PROF + RFC 6906)
- **Notifications and CDC**: D17 (MonitoringStore), D56 (Solid Notifications), D65 (MonitoringStore CDC), D67 (additive Link/Vary headers)
- **Memory two-stage**: D73 (two-stage commit), D74 (mem:* substrate triggers)
- **Markdown rendering**: D58 (dual-layer linking), D75 (rendered HTML serves humans, no RDFa)
- **Search and walker**: D87/D91 (wiki-search), D92 (DataAccessor walker)
- **Related**: D50 (sh:agentInstruction), D55 (three-tier access), D64 (tombstones)

Sprint-internal references:
- Pre-brainstorming research: `docs/plans/2026-05-18-wiki-search-walker-redesign.md` (related; D92 context)
- AddressBook substrate (template pattern reused for affordance descriptors): `docs/plans/2026-05-16-agentic-addressbook-design.md`
- Capabilities-only overlay deps (capability catalog pattern): `docs/plans/2026-05-16-capabilities-only-overlay-deps.md`
- PROF + profile-link wiring: `docs/superpowers/specs/2026-05-16-prof-profile-link-and-role-scheme-design.md`
- Owner-identity overlay (substrate layering pattern): `docs/superpowers/specs/2026-05-17-pod-owner-setup-skill-design.md`

### Vault context (Chuck's research vault)

- `03 - Resources/Agentic Memory Systems/Agentic Memory Systems MOC.md` — research hub
- `03 - Resources/Agentic Memory Systems/External Resources/EXTERNAL-INDEX.md` — system surveys
- `03 - Resources/Literature/LITERATURE-INDEX.md` — paper notes
- `01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md` — phase plan
- `01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md` — canonical decisions log (vault numbering)
- `01 - Projects/SOLID Pod Integration/Unified Externalization Prototype Plan.md` — active plan
