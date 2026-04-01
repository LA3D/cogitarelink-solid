# Pod as Agentic Memory System — Structure Design

**Date**: 2026-04-01
**Status**: Design (research-oriented, not final architecture)
**Context**: Brainstorming session on vault-to-pod mapping, memory partitions, and Solid primitives

## Problem

The Obsidian vault works as an agentic memory system: typed notes with YAML frontmatter, a SKOS+RDFS knowledge graph (19K triples, 1,591 typed notes), Breadcrumbs relationships, and agent behavioral guidance in `.claude/rules/` and `.claude/skills/`. The question is how to replicate this in a distributed Solid pod — not as a file mirror, but as a web-native agentic memory substrate.

Two independent concerns must both be addressed:

1. **Conceptual structure** — the knowledge graph that lets agents navigate between concepts, literature, theories, and projects at a semantic level. The vault KG at `pod.vardeman.me/vault/ontology#` already provides this.
2. **Storage structure** — the LDP container hierarchy that Solid provides, which determines browsability, access control boundaries, and HTTP-level navigation.

These are different axes. The container hierarchy can only express one organizational view; other views come from RDF metadata.

## Key Insight: `.meta` Sidecars as Native Metadata Layer

In the vault, YAML frontmatter is a workaround — metadata embedded inside documents because the filesystem has no metadata layer. The `vault-to-jsonld.py` pipeline extracts frontmatter into RDF as a build step.

Solid eliminates this workaround. Every resource has a `.meta` description resource (an RDF document) accessible via `Link: rel="describedby"`. Key properties:

- **Arbitrary RDF**: The Solid Protocol places no constraints on what triples a `.meta` file may contain
- **PATCH-only**: Created via N3 Patch or SPARQL Update, not PUT
- **Invisible in listings**: `.meta` files are filtered from `ldp:contains`
- **Comunica follows them**: The Solid link traversal config includes `links-describedby.json` — Comunica automatically fetches `.meta` files and includes their triples in SPARQL query results
- **Any resource type**: Not just markdown — images, PDFs, data files, SPARQL templates can all have rich metadata
- **Container-level metadata**: A container's `.meta` can describe the collection itself

This means:

| Vault (filesystem) | Pod (Solid) |
|---|---|
| Content + metadata mixed (markdown + YAML) | Content and metadata separated (`.md` + `.meta`) |
| KG is a derived artifact (build step) | `.meta` files ARE the knowledge graph (live, queryable) |
| Limited to YAML expressiveness | Full RDF (typed relations, provenance chains, reification) |
| Only markdown files participate in KG | Any resource can have rich metadata |
| Adding a relationship = editing the markdown file | Adding a relationship = PATCHing `.meta` (content untouched) |

## Design Decisions

### D29: PARA as container structure, memory partitions as metadata overlay

The PARA system (Projects, Areas, Resources, Archive) provides the container hierarchy — the human-organizational view. Memory partitions (Symbolic, Procedural, Judge, Task State, Decision Traces, Index/Catalog) are expressed in RDF metadata within `.meta` sidecars, queryable via Comunica SPARQL.

**Rationale**: PARA and memory partitions are orthogonal classification axes of the same content. The container hierarchy can only express one. PARA is chosen for containers because it's proven (the vault uses it), human-navigable, and maps naturally to LDP. Memory partitions are chosen for metadata because they're agent-oriented and benefit from RDF expressiveness (partition membership, retrieval hints, validation signals).

The Type Index bridges both views — it routes by RDF class (e.g., `skos:Concept` → `/vault/resources/concepts/`) regardless of which organizational lens the agent uses.

### D30: `.meta` as source of truth for metadata

In the pod, `.meta` sidecars are the authoritative metadata store. YAML frontmatter in imported markdown files is decomposed into `.meta` triples by the vault importer. The markdown retains minimal frontmatter (title, type) for human readability when browsing raw files.

**Rationale**: The primary interface to the pod is agentic. Agents interact via SPARQL/LDP, not by parsing YAML. `.meta` supports richer metadata than YAML (provenance chains, qualified relationships, confidence levels) and can be updated independently of content.

### D31: Model 1 — one-way vault → pod import (research phase)

The Obsidian vault remains the authoring environment. The vault importer decomposes frontmatter into `.meta` and uploads content + metadata to the pod. Changes do not round-trip back.

**Rationale**: The vault's patterns are proven; the pod is experimental. Model 1 lets us test agent navigation over the pod without risking the vault's integrity. The research trajectory is Model 1 → experiments → Model 2 (pod-native, decoupled from vault).

### D32: Agent-first, self-describing pod

An agent arriving at the pod's WebID URL should be able to discover the full memory architecture by following Solid's standard discovery protocol, without prior knowledge. The pod describes its own structure using resources within itself.

**Discovery path**:
1. WebID profile → `pim:storage`, Type Index, workspace pointers
2. `.well-known/void` → dataset catalog (what's here, what vocabularies, what features)
3. `.well-known/shacl` → shapes with agent guidance (what's valid, how to create)
4. Type Index → class-to-container routing (where to find instances of each type)
5. Comunica SPARQL → conceptual navigation (how things connect)
6. LDP resources → content + `.meta` metadata

### D33: SKOS as foundation vocabulary for pod content

First known use of SKOS (`skos:Concept`, `skos:ConceptScheme`, `skos:broader`/`skos:narrower`/`skos:related`) for end-user content in a Solid pod. SKOS is present in Solid infrastructure (namespaces, Shape Trees spec, Interop Panel spec) but has not been used for pod data.

**Rationale**: The vault KG already uses SKOS successfully. SKOS provides concept hierarchy, taxonomy, and labeling features that generic vocabularies (Schema.org, SIOC) lack. The vault ontology at `pod.vardeman.me/vault/ontology#` extends SKOS with domain-specific edge types.

### D34: `pim:Workspace` for the vault workspace

The vault is represented as a `pim:Workspace` within the pod's `pim:Storage`. This allows the pod to host multiple workspaces (e.g., a knowledge workspace, a personal data workspace, an agent state workspace) with distinct access policies.

**Open question**: Whether `pim:SharedWorkspace` or a custom subclass is appropriate. Whether multiple workspaces should be used from the start or deferred.

## Pod Container Structure

```
pod.vardeman.me/
├── profile/card              # WebID — discovery entry point
│                             #   pim:storage → /
│                             #   solid:publicTypeIndex → /settings/publicTypeIndex
│                             #   pim:workspace → /vault/
│
├── settings/
│   ├── publicTypeIndex       # solid:TypeIndex — routes RDF class → container
│   └── privateTypeIndex      # Private type registrations
│
├── vault/                    # pim:Workspace — the knowledge workspace
│   ├── .meta                 # Container metadata: pim:Workspace type, description
│   ├── projects/             # PARA: P — active, time-bound efforts
│   │   └── {project}.md      # Each with .meta sidecar
│   ├── areas/                # PARA: A — ongoing responsibilities (8 areas)
│   │   └── {area}.md
│   ├── resources/            # PARA: R — knowledge organized by topic
│   │   ├── concepts/         # skos:Concept instances
│   │   ├── theories/         # vault:TheoryNote instances
│   │   ├── literature/       # vault:LiteratureNote instances
│   │   ├── methods/          # vault:MethodNote instances
│   │   ├── people/           # vault:Person, vault:AuthorNote instances
│   │   └── external/         # vault:ExternalResource instances
│   └── archive/              # PARA: Archive — inactive items
│
├── procedures/               # Agent behavioral memory (not PARA)
│   ├── shapes/               # SHACL shapes (validation + agent guidance)
│   ├── queries/              # SPARQL templates (D22, behavioral examples)
│   └── guidance/             # Agent navigation rules, discovery hints
│
├── ontology/                 # Self-describing vocabulary
│   ├── vault-ontology.ttl    # SKOS+RDFS type taxonomy + edge vocabulary
│   ├── vault-context.jsonld  # JSON-LD @context for the vault namespace
│   └── solid-pod-profile.ttl # PROF SolidPodProfile
│
└── .well-known/
    ├── solid                 # Storage description (CSS default)
    ├── void                  # VoID dataset catalog
    └── shacl                 # SHACL shape discovery endpoint
```

## Type Index

The public Type Index routes agents from RDF class to container:

```turtle
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix vault: <https://pod.vardeman.me/vault/ontology#> .

<> a solid:TypeIndex, solid:ListedDocument .

<#concepts> a solid:TypeRegistration ;
    solid:forClass skos:Concept ;
    solid:instanceContainer </vault/resources/concepts/> .

<#theories> a solid:TypeRegistration ;
    solid:forClass vault:TheoryNote ;
    solid:instanceContainer </vault/resources/theories/> .

<#literature> a solid:TypeRegistration ;
    solid:forClass vault:LiteratureNote ;
    solid:instanceContainer </vault/resources/literature/> .

<#projects> a solid:TypeRegistration ;
    solid:forClass vault:Project ;
    solid:instanceContainer </vault/projects/> .

<#areas> a solid:TypeRegistration ;
    solid:forClass vault:Area ;
    solid:instanceContainer </vault/areas/> .

<#shapes> a solid:TypeRegistration ;
    solid:forClass <http://www.w3.org/ns/shacl#NodeShape> ;
    solid:instanceContainer </procedures/shapes/> .

<#queries> a solid:TypeRegistration ;
    solid:forClass <http://www.w3.org/ns/shacl#SPARQLExecutable> ;
    solid:instanceContainer </procedures/queries/> .
```

## `.meta` Sidecar Content

A typical `.meta` for a concept note:

```turtle
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix vault: <https://pod.vardeman.me/vault/ontology#> .
@prefix prov:  <http://www.w3.org/ns/prov#> .
@prefix ni:    <http://www.w3.org/2021/ni#> .

<context-graphs.md>
    # Type and identity
    a skos:Concept ;
    dct:title "Context Graphs" ;
    dct:created "2026-02-26"^^xsd:date ;

    # Vault relationships (from frontmatter edges)
    vault:up </vault/resources/concepts/> ;
    vault:area </vault/areas/research-scholarship.md> ;
    vault:extends <progressive-disclosure.md> ;
    vault:source </vault/resources/literature/zhang-2025-rlm.md> ;
    skos:related <knowledge-fabrics.md> ;

    # Tags as subjects
    dct:subject "knowledge-representation", "agents" ;

    # Memory partition membership
    vault:memoryPartition vault:SymbolicMemory ;

    # Shape conformance
    dct:conformsTo </procedures/shapes/concept-note> ;

    # Provenance (D20)
    prov:wasGeneratedBy [
        a prov:Activity ;
        prov:wasAssociatedWith <https://orcid.org/0000-0003-4091-6059> ;
        prov:used <file:///Users/cvardema/Obsidian/obsidian/03%20-%20Resources/Agentic%20Memory%20Systems/Context%20Graphs.md> ;
        prov:startedAtTime "2026-04-01T12:00:00Z"^^xsd:dateTime
    ] ;
    prov:wasDerivedFrom <file:///Users/cvardema/Obsidian/obsidian/03%20-%20Resources/Agentic%20Memory%20Systems/Context%20Graphs.md> ;
    prov:wasAttributedTo <https://orcid.org/0000-0003-4091-6059> ;

    # Content integrity (D21)
    ni:digestMultibase "zQmYtNm..." .
```

## Mapping to Memory Partitions

Memory partitions (from the Memory Partitions theory note) map to pod structures:

| Partition | Content | Pod location | Retrieval |
|---|---|---|---|
| **Symbolic** (work products) | Concepts, theories, literature, the ontology | `/vault/resources/`, `/ontology/` | Comunica SPARQL over `.meta` graph |
| **Procedural** (strategies) | SHACL shapes, SPARQL templates, agent rules | `/procedures/` | Type Index → container browse |
| **Index/Catalog** | Type Index, VoID, MOC-equivalent containers | `/settings/`, `.well-known/` | Standard Solid discovery |
| **Task State** | Projects, plans, active tasks | `/vault/projects/` | Container browse + status queries |
| **Decision Traces** | Provenance in `.meta`, decision log resources | `.meta` sidecars + dedicated resources | PROV-O queries via Comunica |
| **Judge** (evaluation) | Not yet in vault — future research | TBD | TBD |

Partition membership is declared in `.meta` via `vault:memoryPartition`. An agent can query:

```sparql
SELECT ?resource ?title WHERE {
    ?resource vault:memoryPartition vault:ProceduralMemory ;
              dct:title ?title .
}
```

## Mapping to KAG Three-Layer Architecture

The Structure-First Memory Architecture identifies KAG's three-layer hierarchy as the best-performing pattern:

| KAG Layer | Pod equivalent | Content |
|---|---|---|
| **KG_cs** (Conceptual Schema) | Vault ontology + SHACL shapes | What types exist, how they relate, what's valid |
| **KG_fr** (Factual Relations) | `.meta` sidecar triples | Actual relationships between resources |
| **RC** (Raw Chunks) | Markdown content (`.md` files) | The documents themselves |

All three layers are queryable:
- KG_cs: fetch `/ontology/vault-ontology.ttl` and `/procedures/shapes/`
- KG_fr: Comunica SPARQL traverses `.meta` files via `describedby` links
- RC: HTTP GET on the `.md` resource

## Self-Referential Property

The pod describes its own memory architecture using resources within itself. An agent can:

1. Discover the pod's ontology (what types and relationships exist) by fetching `/ontology/vault-ontology.ttl`
2. Discover the SHACL shapes (what's valid, how to create content) via `.well-known/shacl`
3. Discover the memory partition structure by querying `vault:memoryPartition` triples
4. Discover agent guidance by reading `vault:retrievalHint` annotations in `.meta`
5. Discover the conceptual structure by running SPARQL queries over the `.meta` graph

The theory of how the memory system works (Memory Partitions, Structure-First Architecture) is itself stored as concept/theory notes in `/vault/resources/theories/` — queryable through the same mechanisms.

## Vault Import Decomposition

The vault importer's job changes from "copy files" to "decompose and enrich":

1. **Parse** markdown file (frontmatter + body + wikilinks)
2. **Decompose** frontmatter into `.meta` triples using SHACL shape as mapping contract
3. **Resolve** wikilinks to pod URIs (title → slug → container path)
4. **Enrich** with metadata not in frontmatter:
   - `vault:memoryPartition` (inferred from note type)
   - `dct:conformsTo` (shape reference)
   - `prov:*` provenance chain
   - `ni:digestMultibase` content hash
5. **Strip** frontmatter from markdown (or retain minimal title/type for human readability)
6. **PUT** markdown content to pod
7. **PATCH** `.meta` with generated triples
8. **Validate** `.meta` against SHACL shape

## Research Questions

This design is explicitly experimental. The following questions guide the research:

### RQ-Pod-1: Container structure vs metadata for agent navigation

Can agents discover and navigate memory partitions from VoID + ontology metadata alone? Or do partitions need to be reflected in the container layout (Approach A from brainstorming)?

**Test**: Compare agent task completion when partitions are metadata-only vs container-reflected.

### RQ-Pod-2: PARA-as-containers viability

Does the PARA container hierarchy work for agent navigation, or do agents perform better with type-driven containers?

**Test**: Measure navigation efficiency (requests to reach target resource) under PARA layout vs flat-by-type layout.

### RQ-Pod-3: Agent discovery path effectiveness

What is the minimum discovery path for an agent to become productive with an unknown pod?

**Test**: Time-to-first-useful-query for agents given only the WebID URL. Vary what the pod publishes (VoID only, VoID+SHACL, VoID+SHACL+SPARQL-examples).

### RQ-Pod-4: Comunica `.meta` traversal performance

How does Comunica link traversal over `.meta` files compare to querying a pre-built knowledge graph (the vault KG)?

**Test**: Run the vault's standard SPARQL queries against both the pod (via Comunica) and the pre-built `vault-graph-full.ttl` (via Jena ARQ). Compare latency and completeness.

### RQ-Pod-5: Procedural memory expression

Where should agent behavioral guidance live — in `.well-known/` endpoints, in `/procedures/` resources, in SHACL `sh:description` annotations, or some combination?

**Test**: Vary where guidance is served; measure agent conformance to pod conventions.

### RQ-Pod-6: `.meta` richness vs overhead

What is the right level of metadata in `.meta` sidecars? Minimal (type + title + relationships) vs rich (provenance, integrity, partition membership, retrieval hints, shape conformance)?

**Test**: Measure Comunica query performance and agent task quality as `.meta` richness increases.

## Relationship to Existing Decisions

| Decision | Status | Update |
|---|---|---|
| D10 (Three-layer Pod RDF) | **Extended** | Layer B (`.meta`) now carries memory partition membership, not just frontmatter-derived predicates |
| D7 (Frontmatter → RDF via SHACL) | **Refined** | Frontmatter is decomposed into `.meta`; `.meta` is source of truth, not YAML |
| D9 (Dual-index pattern) | **Confirmed** | Type Index + VoID + SHACL form the discovery stack |
| D19 (CSS extensions) | **Confirmed** | `.well-known/void`, `.well-known/shacl` serve discovery |
| D20 (PROV-O provenance) | **Confirmed** | Lives in `.meta` sidecars as designed |
| D22 (SPARQL examples) | **Extended** | Part of procedural memory partition; served from `/procedures/queries/` |
| New: D29 | PARA containers + partition metadata | See above |
| New: D30 | `.meta` as metadata source of truth | See above |
| New: D31 | Model 1 (vault → pod, one-way) | See above |
| New: D32 | Agent-first, self-describing pod | See above |
| New: D33 | SKOS as foundation vocabulary | See above |
| New: D34 | `pim:Workspace` for vault workspace | See above |

## Non-Goals (for now)

- Bidirectional vault ↔ pod sync (Model 3)
- Pod-native authoring without Obsidian (Model 2 — future research)
- Access control beyond basic public/private (VC lifecycle is Phase 3)
- Multi-pod federation (requires cogitarelink-fabric integration)
- Full vault import (MVP is ~20 Agentic Memory Systems notes)
