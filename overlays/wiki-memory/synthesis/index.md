---
type: wiki:Page
dct:title: "Wiki-Memory L3 — Profile Synthesis"
dct:conformsTo: <https://pod.vardeman.me/vault/meta/profiles/page>
wiki:profileDocument: <>
---

# Wiki-Memory L3 — Profile Synthesis

<!-- This page is the primary entry point for agents navigating this Pod's
     wiki-memory. It is itself a wiki-memory page; if you can read it, you
     can read every other page in this substrate. -->
<!-- ORIENTATION: the `wiki` path segment names the wiki-memory *profile* (an L3 reference
     profile layered on a general Solid/LDP substrate) — not a wiki application. This Pod
     is a standard LDP server; wiki-memory is one profile built on it. For the full
     addressing model, see [concepts/two-hierarchy-memory-addressing.md](/vault/wiki/concepts/two-hierarchy-memory-addressing.md). -->

## Overview

Wiki-memory L3 is a memory substrate built on Solid Protocol. This page is itself a wiki-memory page — if you can read it via standard Solid primitives, you can read every other page here.

**Navigation principle** — this is a Linked Data substrate. Three layered dereferencing primitives:

1. **Resources** — any URI in this Pod is dereferenceable via HTTP `GET`. Resources have multiple representations: ask for `Accept: text/markdown` for body prose, `Accept: text/turtle` for the RDF `.meta`, or `Accept: text/html` for rendered HTML (with embedded JSON-LD in a `<script>` block).

2. **Link headers** — every response carries `Link` headers naming related resources: `rel="describedby"` (the `.meta` sidecar), `rel="type"` (the LDP / class kind), `rel="profile"` (the PROF descriptor).

3. **Vocabularies are also Linked Data** — class and predicate IRIs are themselves dereferenceable. When you see `wiki:Concept` (a prefixed form of `https://pod.vardeman.me/vault/ontology/wiki#Concept`), strip the fragment and `GET https://pod.vardeman.me/vault/ontology/wiki` to receive the full vocabulary as RDF. Look for the `#Concept` fragment to learn what `Concept` means (`rdfs:label`, `rdfs:comment`, `rdfs:subClassOf`, `sh:agentInstruction`, etc.). The storage description at [`/vault/.well-known/solid`](/vault/.well-known/solid) lists every vocabulary in use as `void:vocabulary` triples — that's the substrate's complete vocabulary inventory.

Prefixes (`wiki:`, `mem:`, `dct:`, etc.) expand to full IRIs per the JSON-LD context at [`/vault/meta/context.jsonld`](/vault/meta/context.jsonld), or via `@prefix` declarations in any Turtle document.

**Follow your nose.**

### What you can do from here

- **Browse content by class** (`wiki:Concept`, `wiki:Page` / `wiki:MOC`, `schema:Person`, `schema:HowTo`, `wiki:WorkingNote`) — see [Container layout](#container-layout) below, or fetch the [Type Index](/vault/settings/publicTypeIndex) for class → container routing.
- **Search by text** — `GET /vault/wiki/?ext=search-grep&oslc.searchTerms=...` (OSLC Query 3.0). Returns scored matches across all wiki pages.
- **Find what references a resource** — `GET /vault/wiki/<resource>?ext=backlinks`.
- **Read a resource** — `GET /vault/wiki/<class>/<slug>.md` for body markdown; append `.meta` for the typed-edge RDF.
- **Write or modify content** — six memory operations (Crystallize, Supersede, Merge, Demote, Archive, Link), each with an affordance descriptor at `/vault/meta/affordances/<operation>`. See [Operations](#operations).
- **Catch up on recent activity** — [`/vault/wiki/.operations/`](/vault/wiki/.operations/) (agent announcements) and [`/vault/wiki/.events/`](/vault/wiki/.events/) (substrate analysis signals). See [Cross-session orientation](#cross-session-orientation).

### Architectural position

Three-layer stack: **L1** Solid Protocol (LDP, WAC, `.well-known/`); **L2** memory-substrate invariants (bounded branching, tiered retrieval, lifecycle metadata, separable procedural memory, hybrid blob+graph storage, OOD honesty); **L3** wiki-memory — the canonical reference profile, layered on by other applications.

### Two client tracks

- **Skilled agent** — loads `solid-wiki-memory-l3` and per-operation skills. Uses primitives directly. Faster, fewer tokens.
- **Blind agent** — HTTP + RDF parsing only (`curl`-equivalent). Bootstraps from this page + the catalogs it points at. More tokens, but no prerequisites.

## Container layout

Wiki-memory content lives in class-specific containers under `/vault/wiki/`:

| Container | Holds | Default class |
|---|---|---|
| [`/vault/wiki/concepts/`](/vault/wiki/concepts/) | Concept notes — theories, definitions, models; also citation/literature notes (papers, books, talks) typed as `skos:Concept` with `cito:*` citation predicates | `skos:Concept` (governed by `concept.shacl.ttl`) |
| [`/vault/wiki/people/`](/vault/wiki/people/) | Person notes — authors, collaborators | `schema:Person` |
| [`/vault/wiki/places/`](/vault/wiki/places/) | Place notes — institutions, locations | `schema:Place` |
| [`/vault/wiki/events/`](/vault/wiki/events/) | Event notes — conferences, talks, meetings | `schema:Event` |
| [`/vault/wiki/organizations/`](/vault/wiki/organizations/) | Organization notes — groups, institutions | `schema:Organization` |
| [`/vault/wiki/procedures/`](/vault/wiki/procedures/) | How-to notes — methods, workflows, recipes | `schema:HowTo` (governed by `howto.shacl.ttl`) |
| [`/vault/wiki/working/`](/vault/wiki/working/) | Working-memory notes — drafts under permissive constraint | `wiki:WorkingNote` |

Two reserved sibling containers carry the notification machinery (see [Events and announcements](#events-and-announcements)):

| Container | Holds |
|---|---|
| [`/vault/wiki/.operations/`](/vault/wiki/.operations/) | Agent-emitted action announcements (`as:Announce` multi-typed with `mem:*Action`) |
| [`/vault/wiki/.events/`](/vault/wiki/.events/) | Substrate-emitted analysis events (`mem:Event` subclasses) |

To enumerate a container: `GET <container-url>` with `Accept: text/turtle`. The response is an LDP `BasicContainer` with `ldp:contains` triples listing each child resource. To find which container a class lives in: dereference the [Type Index](/vault/settings/publicTypeIndex) — it maps class → container for every governed class.

## Type taxonomy

Eight SHACL NodeShapes govern the content classes in wiki-memory L3 (11 shape files total). The shape catalog is at [`/vault/meta/shapes/`](/vault/meta/shapes/); each shape is an LDP resource carrying the `sh:NodeShape` for one class.

| Shape | Class | Purpose |
|---|---|---|
| [`resource.shacl.ttl`](/vault/meta/shapes/resource.shacl.ttl) | `wiki:Resource` | Abstract root — defines invariants every wiki resource carries (rdf:type, dct:title, etc.) |
| [`page.shacl.ttl`](/vault/meta/shapes/page.shacl.ttl) | `wiki:Page` (and `wiki:MOC` via subClassOf) | Pages: narrative content and page-level metadata |
| [`concept.shacl.ttl`](/vault/meta/shapes/concept.shacl.ttl) | `skos:Concept` | Concepts + citations: theories, definitions, literature notes; carries `cito:*` citation predicates |
| [`person.shacl.ttl`](/vault/meta/shapes/person.shacl.ttl) | `schema:Person` | People: authors, collaborators |
| [`place.shacl.ttl`](/vault/meta/shapes/place.shacl.ttl) | `schema:Place` | Places: institutions, locations |
| [`event.shacl.ttl`](/vault/meta/shapes/event.shacl.ttl) | `schema:Event` | Events: conferences, talks, meetings |
| [`organization.shacl.ttl`](/vault/meta/shapes/organization.shacl.ttl) | `schema:Organization` | Organizations: groups, institutions |
| [`howto.shacl.ttl`](/vault/meta/shapes/howto.shacl.ttl) | `schema:HowTo` | How-tos: ordered workflows, methods, recipes |
| [`working.shacl.ttl`](/vault/meta/shapes/working.shacl.ttl) | `wiki:WorkingNote` | Working memory: permissive (drafts before crystallization) |

**Class-based targeting** (D78): shapes target `rdf:type` via `sh:targetClass`, not URL path. The Type Index at [`/vault/settings/publicTypeIndex`](/vault/settings/publicTypeIndex) does the routing — given a class IRI, it returns the canonical container URL. To find all resources of class X, look up X in the Type Index, then `GET` the listed container.

Each shape's `sh:agentInstruction` (per D50) carries procedural guidance — read the shape before authoring a new resource of that class.

## Conventions

Three substrate conventions every agent should internalize.

### Dual-layer linking

Every wiki-memory resource has two linked surfaces: **body markdown** and **`.meta` RDF**. The body uses Obsidian-style wikilinks (`[[Target]]` and class-hint variants `[[Target]]{.concept}`); the `.meta` uses typed RDF predicates (`wiki:extends`, `wiki:supports`, `cito:cites`, etc.). The `markdown-projection` substrate behavior (see [Affordances](#affordances-available)) projects body wikilinks into `.meta` triples at write time. As an agent, you can author at either layer or both; the substrate keeps them consistent.

### Two-stage commit

Wiki-memory has two write tiers:

1. **Working memory** (`/vault/wiki/working/`) — permissive SHACL, fast iteration. Use for drafts.
2. **Durable memory** (class-specific containers) — strict SHACL, validated at PUT. Use for crystallized content.

The transition between them is the `mem:CrystallizeAction` (see [Operations](#operations)) — fetch from working, PUT to the destination class container, DELETE the source. The substrate captures both events via Memento.

### Predicate-level governance

Each SHACL shape declares which RDF predicates the substrate **governs** (via `wiki:governs` properties on the shape). The substrate owns those predicates: it validates them, may project them from body content, and refuses external changes that violate them. **All other predicates the agent owns** — write them via standard PATCH to `.meta`. The dividing line is per-shape; check the shape's `wiki:governs` list before patching.

## Affordances available

Substrate behaviors registered at [`/vault/meta/affordances/`](/vault/meta/affordances/). Each affordance is a `prof:ResourceDescriptor` describing what the behavior does, its preconditions, and its invocation pattern.

| Affordance | Invocation | Purpose |
|---|---|---|
| [`markdown-projection`](/vault/meta/affordances/markdown-projection) | passive (on PUT to working) | Projects body wikilinks → `.meta` typed predicates |
| [`hub-view`](/vault/meta/affordances/hub-view) | `GET /vault/wiki/?ext=hub-view` | Returns curated hub list ordered by inbound link count |
| [`breadcrumb-view`](/vault/meta/affordances/breadcrumb-view) | `GET /vault/wiki/<resource>?ext=breadcrumbs` | Returns the resource's ancestor chain via `dct:isPartOf` |
| [`memento`](/vault/meta/affordances/memento) | `Accept-Datetime` header | RFC 7089 time-travel; returns the resource as of a given instant |
| [`wiki-search-grep`](/vault/meta/affordances/wiki-search-grep) | `GET /vault/wiki/?ext=search-grep&oslc.searchTerms=...` | Recursive literal substring search across all wiki pages |
| [`crystallize`](/vault/meta/affordances/crystallize) | agent-performed (see [Operations](#operations)) | Promote a working note to durable storage |
| [`supersede`](/vault/meta/affordances/supersede) | agent-performed | Replace a durable resource with a refined version |
| [`merge`](/vault/meta/affordances/merge) | agent-performed | Combine N durable resources into one |
| [`demote`](/vault/meta/affordances/demote) | agent-performed | Move a durable resource back to working memory |
| [`archive`](/vault/meta/affordances/archive) | agent-performed | Soft-delete via tombstone |
| [`link`](/vault/meta/affordances/link) | agent-performed | Add a typed cross-reference edge to a resource's `.meta` |

Dereference any affordance URL to read its full descriptor — precondition, postcondition, error mode, procedure steps, governed predicates.

## Operations

The substrate defines six memory operations as RDF classes in the [`mem:`](/vault/ontology/mem) vocabulary. Each is a category of agent action, performed as a sequence of direct LDP operations.

| Action | Class | What it does | Proto-grounded parent |
|---|---|---|---|
| Crystallize | `mem:CrystallizeAction` | Working → durable; SHACL validates the destination shape | `as:Move` |
| Supersede | `mem:SupersedeAction` | Replace a durable resource (prior version captured by Memento) | `schema:ReplaceAction` |
| Merge | `mem:MergeAction` | Combine N durable resources into one (`prov:wasDerivedFrom` records inputs) | — |
| Demote | `mem:DemoteAction` | Durable → working for reconsideration | `as:Undo` |
| Archive | `mem:ArchiveAction` | Tombstone the resource; preserved but inactive | `as:Delete` |
| Link | `mem:LinkAction` | Add a typed edge to a resource's `.meta` (substrate-governed predicates only) | `as:Add` |

**Recording the action**: after performing an action, write `prov:wasGeneratedBy [ a mem:<XAction> ; ... ]` into the resulting resource's `.meta`. This is the substrate's source of truth for what kind of action produced each resource.

**Announcing the action**: post an `as:Announce` activity to [`/vault/wiki/.operations/`](/vault/wiki/.operations/), **multi-typed with the same Action class** (COAR Notify pattern). Example:

```turtle
[] a as:Announce, mem:CrystallizeAction ;
   as:actor    <agent-webid> ;
   as:object   <durable-resource> ;
   prov:wasDerivedFrom <working-source> ;
   as:published "..."^^xsd:dateTime .
```

The substrate fans this out to subscribers via Solid Notifications. See [Events and announcements](#events-and-announcements). No separate past-tense class is needed; the Action class is reused for both the PROV-O record and the announcement activity.

For full procedures, dereference each action's affordance descriptor (e.g., [`/vault/meta/affordances/crystallize`](/vault/meta/affordances/crystallize)) — it carries the exact LDP procedure, error mode, and pre/post conditions.

## Events and announcements

Two append-only containers carry the substrate's notification machinery.

### Operations log

[`/vault/wiki/.operations/`](/vault/wiki/.operations/) — agent-emitted announcements of completed actions. Each entry is an AS2 `as:Announce` activity **multi-typed with a `mem:*Action` class** (COAR Notify pattern) — `[as:Announce, mem:CrystallizeAction]`, `[as:Announce, mem:SupersedeAction]`, and so on for Merge/Demote/Archive/Link. The same Action class appears in the resulting resource's `prov:wasGeneratedBy` PROV-O record, so the substrate's source of truth and the agent's announcement reference the same type. Entries are append-only by convention; older entries are not edited.

Reading the operations log is the canonical way to learn what's happened in the wiki-memory across sessions — see [Cross-session orientation](#cross-session-orientation).

### Substrate events

[`/vault/wiki/.events/`](/vault/wiki/.events/) — substrate-emitted analysis events. Each entry is an AS2 `as:Activity` with one or more `mem:Event` subclass types:

| Event class | Emitted when |
|---|---|
| `mem:UnprocessableWrite` | A SHACL-validated write was rejected; carries `sh:ValidationReport` in `as:context` |
| `mem:BoundExceeded` | A container's `ldp:contains` count crossed 12 (Fano branching bound) |
| `mem:ContradictionDetected` | Two resources express conflicting typed-edge claims |
| `mem:ConsolidationSuggested` | Multiple resources cluster around a topic without a curated hub |
| `mem:ReflectionDue` | Periodic signal that the substrate hasn't been linted recently |
| `mem:OODQuerySignal` | A wiki-search query returned zero or low-quality results |

### Subscribing

Both containers integrate with Solid Notifications. To subscribe via Webhook:

```http
POST /.notifications/WebhookChannel2023/
Content-Type: application/ld+json

{
  "@context": "https://www.w3.org/ns/solid/notifications/v1",
  "type": "WebhookChannel2023",
  "topic": "https://pod.vardeman.me/vault/wiki/.operations/",
  "sendTo": "<your-callback-url>"
}
```

Repeat for `/vault/wiki/.events/`. The substrate fan-outs each new entry to subscribed callbacks. For real-time within a session, prefer `StreamingHTTPChannel2023`.

**Polling alternative**: agents that aren't continuously running can poll the containers on next wake. `GET <container-url>` returns `ldp:contains` ordered by creation time; the agent filters by `as:published` to find recent activity.

## Cross-session orientation

Wiki-memory agents are typically stateless across sessions. On wake, the canonical "what happened" workflow:

1. **`GET /vault/wiki/.operations/`** with `Accept: text/turtle`. Returns the LDP container with `ldp:contains` listing every announcement.
2. **Filter by recency**: read each entry's `as:published` timestamp; consider the last N hours / since-last-session.
3. **Dispatch by type**: for each recent entry, read its `rdf:type` array. Entries carry both `as:Announce` (it's an announcement) and a `mem:*Action` class (what was announced). Group by the Action class.
4. **Drill in selectively**: for entries that affect resources you care about, follow `as:object` (the affected resource) and `prov:wasDerivedFrom` (sources) to read the new state.

Optionally: `GET /vault/wiki/.events/` to learn what the substrate flagged (BoundExceeded, ContradictionDetected, etc.). Events represent substrate-detected conditions the substrate thinks an agent should address.

The operations log is what makes this substrate **navigable across sessions without state**. Treat it like `git log --oneline --since="<interval>"` — chronological, semantic, cheap to consume.

## Pointers

| Resource | Purpose |
|---|---|
| [`/vault/.well-known/solid`](/vault/.well-known/solid) | Storage description; lists all vocabularies and catalogs |
| [`/vault/meta/shapes/`](/vault/meta/shapes/) | SHACL shape catalog (one per class) |
| [`/vault/meta/affordances/`](/vault/meta/affordances/) | Affordance descriptors (substrate behaviors) |
| [`/vault/meta/capabilities/`](/vault/meta/capabilities/) | Capability catalog (installed overlay capabilities) |
| [`/vault/meta/profiles/`](/vault/meta/profiles/) | PROF profile descriptors (kind-hints per resource) |
| [`/vault/meta/context.jsonld`](/vault/meta/context.jsonld) | Canonical prefix → IRI mapping |
| [`/vault/settings/publicTypeIndex`](/vault/settings/publicTypeIndex) | Class → container routing |
| [`/vault/ontology/wiki`](/vault/ontology/wiki) | The `wiki:` vocabulary |
| [`/vault/ontology/mem`](/vault/ontology/mem) | The `mem:` operation/event/announcement vocabulary |
| [`/vault/ontology/wikirole`](/vault/ontology/wikirole) | The `wikirole:` SKOS scheme for substrate roles |
| [`/vault/wiki/.operations/`](/vault/wiki/.operations/) | Agent operation announcement log |
| [`/vault/wiki/.events/`](/vault/wiki/.events/) | Substrate-emitted analysis events |
