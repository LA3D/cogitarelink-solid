# Rung 1.4 — Wiki-Memory L3 Implementation Design

**Date**: 2026-05-15
**Status**: Draft (brainstorm complete; awaiting writing-plans phase)
**Round 1 rung**: 1.4 (closes; gates Rung 1.5 evaluation)
**Spec input**: D70–D77 (revised by this spec — see "Decisions revised" below)
**Constraint**: Build against a clean Pod. `make reset`; skip `scripts/vault_import.py`. The 1243-note vault import is a separate downstream concern.

---

## 1. Architecture & scope

**Goal**: Close Round 1 Rung 1.4 by shipping the wiki-memory L3 reference profile end-to-end on a clean Pod, validated by a 4-note worked-example bundle that exercises Comunica link-traversal across all three primary containers.

**In scope**:

- 4-note golden-fixture bundle (markdown body + `.meta` Turtle, committed to repo)
- SHACL shape catalog at `shapes/wiki-memory-l3/` (6 shape files — see §3)
- `MarkdownProjectionListener` CSS extension projecting body wikilinks → `.meta` on write (D58 sharpened, D71)
- Renderer rename: `css/extensions/markdown-rdfa/` → `markdown-render/`; drop rehype-rdfa step; ship `wikilinks.css` (D75)
- Affordance catalog at storage description root publishing L3 contract (D52, closes Rung 1.4)
- JSON-LD context document as vocabulary discovery surface
- Comunica link-traversal target queries (MOC → concept → source → person)
- pytest integration tests covering the full round-trip + 7-step first-arrival ritual

**Out of scope** (deferred):

- Vault importer migration (separate spec once L3 reference works)
- `mem:Crystallize` operation and working-memory promotion (D73)
- `mem:*` trigger vocabulary delivery via LDN (D74)
- RQ-Pod-4 resolution of Comunica `.meta` traversal gap — spec falls back to explicit `-d` sources and documents the gap
- Formal RDF encoding of L2 invariants (Rung 1.5 evaluation concern)
- Rung 1.5 evaluation harness
- L4 vault specialization with `vault:*` subclasses

**Approach**: Golden-fixture test-driven development. Hand-written fixtures at `tests/fixtures/wiki-memory-l3/` are the truth function for the listener; SHACL shapes are the contract; the affordance catalog is the agent-facing self-description.

---

## 2. Bundle & golden fixtures

### Filesystem layout

```
tests/fixtures/wiki-memory-l3/
├── bodies/                                                # markdown as it sits in vault (copies)
│   ├── agentic-memory-systems-moc.md
│   ├── wiki-memory-l3-profile.md
│   ├── ghumare-llm-wiki-v2-extending-karpathy.md
│   └── karpathy-andrej.md
├── meta/                                                  # hand-written .meta Turtle — golden truth
│   ├── agentic-memory-systems-moc.md.meta
│   ├── wiki-memory-l3-profile.md.meta
│   ├── ghumare-llm-wiki-v2-extending-karpathy.md.meta
│   └── karpathy-andrej.md.meta
├── enriched/                                              # copies of .meta + an agent-added triple, for Model A tests
│   └── wiki-memory-l3-profile-enriched.md.meta
├── shape-stubs/                                           # minimal synthetic instances for shapes not in bundle
│   ├── procedure-stub.ttl                                 # for ProcedureShape lint-validation
│   └── working-note-stub.ttl                              # for WorkingNoteShape lint-validation
├── traversal-queries/
│   ├── 01-moc-to-source-titles.rq
│   ├── 02-concept-to-author-affiliation.rq
│   └── 03-source-creator-roundtrip.rq
└── README.md
```

### Bundle and target Pod URIs

| Vault source note | Pod URI | `rdf:type` | SHACL shape |
|---|---|---|---|
| `03 - Resources/Agentic Memory Systems/Agentic Memory Systems MOC.md` | `/wiki/pages/agentic-memory-systems-moc.md` | `wiki:Concept` (derived `wiki:Hub` when threshold met) | ConceptShape |
| `03 - Resources/Agentic Memory Systems/Core Concepts/Wiki-Memory L3 Profile.md` | `/wiki/pages/wiki-memory-l3-profile.md` | `wiki:Concept` | ConceptShape |
| `03 - Resources/Agentic Memory Systems/External Resources/Ghumare - LLM Wiki v2 Extending Karpathy.md` | `/wiki/sources/ghumare-llm-wiki-v2-extending-karpathy.md` | `wiki:Source` | SourceShape |
| `03 - Resources/People/karpathy-andrej.md` | `/wiki/people/karpathy-andrej.md` | `wiki:Person` | PersonShape |

This bundle's selection forces three spec ambiguities to resolution:

1. **External-resource shape mapping**: external-resources go in `/wiki/sources/` under SourceShape, distinguished from `@`-citekey literature by `dct:identifier` (URL vs citekey). One class, one shape.
2. **MOC role encoding**: not its own class; an MOC is a `wiki:Concept` that the substrate derives `wiki:Hub` for via threshold (see §3).
3. **S3a `@`-strip rule** (D76): exercised by any `[[@citekey]]` wikilink in the concept's body.

### Vocabulary

Hybrid: standards by default (DCT/SKOS/CiTO/FOAF/PROV), mint `wiki:*` only for genuine gaps (3 mints total). Closes RQ-Vocab-1 by deferring namespace minting via `urn:example:wiki#` placeholder.

| Agent need | Predicate (in `.meta`) |
|---|---|
| Title | `dct:title` (required) |
| Created / modified | `dct:created` / `dct:modified` (required, `xsd:dateTime`) |
| Identifier | `dct:identifier` (required) |
| Navigational parent (concept → MOC) | `skos:broader` |
| Subject(s) this page is about | `dct:subject` |
| Cites a source | `dct:references` |
| Author/creator (sources) | `dct:creator` |
| Contributor (concepts) | `dct:contributor` |
| Extends an earlier idea | `cito:extends` |
| Provides evidence for | `cito:agreesWith` |
| Disagrees with | `cito:disagreesWith` |
| Lateral connection (default) | `skos:related` |
| Provenance | `prov:wasGeneratedBy` (substrate-stamped) |
| Page maturity | `wiki:maturity` (values: `draft`, `validated`, `core`) |
| Embedded blob | `dct:hasPart` |
| Person aliases | `foaf:nick` |

**Class hierarchy** (the L3 ontology — three minted concepts):

```turtle
@prefix wiki: <urn:example:wiki#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

wiki:Resource    a rdfs:Class .                          # LDP-carrier abstraction
wiki:Concept     rdfs:subClassOf wiki:Resource .
wiki:Source      rdfs:subClassOf wiki:Resource .
wiki:Person      rdfs:subClassOf wiki:Resource .
wiki:Procedure   rdfs:subClassOf wiki:Resource .
wiki:WorkingNote rdfs:subClassOf wiki:Resource .

wiki:Hub         a rdfs:Class .                          # derived; substrate emits via Comunica CONSTRUCT
wiki:maturity    a rdf:Property .
```

L4 specialization (vault types) extends via `rdfs:subClassOf wiki:Concept`, etc. — out of scope for this spec.

---

## 3. Shape catalog structure

**Six shape files** at `cogitarelink-solid/shapes/wiki-memory-l3/`:

```
shapes/wiki-memory-l3/
├── resource.shacl.ttl    # ResourceShape — sh:targetClass wiki:Resource (baseline)
├── concept.shacl.ttl     # ConceptShape — sh:targetClass wiki:Concept
├── source.shacl.ttl      # SourceShape — sh:targetClass wiki:Source
├── person.shacl.ttl      # PersonShape — sh:targetClass wiki:Person
├── procedure.shacl.ttl   # ProcedureShape — sh:targetClass wiki:Procedure
├── working.shacl.ttl     # WorkingNoteShape — permissive baseline (D73 two-stage commit)
└── README.md
```

SHACL `sh:targetClass` with `rdfs:subClassOf` inference means a `wiki:Concept` instance is validated against ResourceShape AND ConceptShape automatically.

### ResourceShape (the baseline)

```turtle
wiki:ResourceShape
    a sh:NodeShape ;
    sh:targetClass wiki:Resource ;
    sh:property [
        sh:path dct:title ;
        sh:datatype xsd:string ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path dct:created ;
        sh:datatype xsd:dateTime ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path dct:modified ;
        sh:datatype xsd:dateTime ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path dct:identifier ;
        sh:minCount 1 ; sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path wiki:maturity ;
        sh:in ( "draft" "validated" "core" ) ;
        sh:maxCount 1 ;
    ] ;
    sh:agentInstruction "Every wiki resource carries title, created, modified, identifier. Maturity is optional; substrate may promote draft → validated when /review-note passes." .
```

### ConceptShape (specialization)

```turtle
wiki:ConceptShape
    a sh:NodeShape ;
    sh:targetClass wiki:Concept ;
    sh:property [ sh:path skos:broader ;     sh:nodeKind sh:IRI ; sh:class wiki:Resource ; ] ;
    sh:property [ sh:path dct:references ;   sh:nodeKind sh:IRI ; sh:class wiki:Source ; ] ;
    sh:property [ sh:path dct:contributor ;  sh:nodeKind sh:IRI ; sh:class wiki:Person ; ] ;
    sh:property [ sh:path cito:extends ;     sh:nodeKind sh:IRI ; sh:class wiki:Concept ; ] ;
    sh:agentInstruction
        "Concept pages carry: skos:broader to navigational parent, dct:references to Sources cited, dct:contributor to People involved, cito:extends to predecessor Concepts. Substrate writes these predicates by projecting body wikilinks; agent extends with any predicates outside the governed set." .
```

Sibling shapes (Source, Person, Procedure, WorkingNote) follow the same pattern.

### Hub status: virtual via Comunica SPARQL view

Per D72 (compile-once for what the agent reads, not over-compile derived state):

```sparql
CONSTRUCT { ?hub a wiki:Hub . }
WHERE {
    SELECT ?hub (COUNT(DISTINCT ?child) AS ?n) WHERE {
        ?child skos:broader ?hub .
        ?hub a wiki:Resource .
    } GROUP BY ?hub HAVING (?n >= 3)
}
```

Lives at `/meta/affordances/hub-view` (see §6) as a discoverable `wiki:DerivedClassAffordance`. Agent invocation pattern: **on-demand** for v1 — when agent needs hub info, runs the CONSTRUCT. No materialization, no push, no D74 trigger. Materialize-then-push patterns become Rung 1.5+ optimizations once eval shows latency matters.

Breadcrumb is the recursive sibling — CONSTRUCT walking `skos:broader` chain from a starting page to root (no parent). Same affordance pattern.

---

## 4. MarkdownProjectionListener (D58 sharpened, D71)

**Pattern**: MonitoringStore listener on CSS `'changed'` event for resources under `/wiki/*` — same slot as `MementoCommitListener` (D65). Synchronous with the write; knows WebID + identifier + activity type; no separate process.

### File layout

```
css/extensions/markdown-projection/
├── package.json
├── components/
│   └── markdown-projection.json     # Components.js wiring (D19 Override pattern)
├── src/
│   ├── MarkdownProjectionListener.ts # Main listener (mirrors MementoCommitListener)
│   ├── projectionPipeline.ts         # Body+frontmatter → Turtle, pure function
│   ├── frontmatterProjection.ts      # YAML lifecycle fields → triples
│   ├── wikilinkProjection.ts         # Body wikilinks → triples (uses shared modules)
│   ├── governedPredicates.ts         # Per-shape governed-predicate sets (Model A)
│   └── metaWriter.ts                 # Atomic read-merge-write under file lock
└── test/
    └── projectionPipeline.test.ts
```

Reuses three modules from the renamed `markdown-render/` (§5): `wikilinks.ts`, `predicates.ts`, `resolver.ts`. Both extensions import from `css/extensions/shared/markdown-parsing/`.

### Ownership model: Model A — predicate-level governance

The SHACL shape **declares which predicates the substrate governs**. The listener owns triples whose predicate is in the governed set AND subject is the current resource. Everything else is the agent's domain.

On every body write the listener:

1. Computes projected triples from body + frontmatter
2. `DELETE FROM .meta WHERE subject = <this-resource> AND predicate IN governed-set`
3. `INSERT` projected triples
4. Leaves everything else alone

No named graphs, no RDF-star, no per-triple `prov:wasGeneratedBy` reification. Predicate identity does the work.

SHACL shapes stay `sh:closed false`. Agent additions tolerated outside the governed set. Substrate governs only what it claims to govern. Each shape file documents its governed set via an `sh:agentInstruction` line.

**Governed set for ConceptShape**:

```
rdf:type, dct:title, dct:identifier, dct:created, dct:modified,
dct:references, dct:subject, dct:contributor, dct:creator,
skos:broader, skos:related, cito:extends, cito:agreesWith, cito:disagreesWith,
wiki:maturity, prov:wasGeneratedBy
```

Other shapes' governed sets follow the same pattern with type-appropriate predicates.

### Recognized frontmatter fields

The listener parses YAML frontmatter at the top of every body. Only these fields project to `.meta`; everything else is ignored:

| Frontmatter | Projected triple |
|---|---|
| `type:` | `rdf:type wiki:Concept` (or whichever subclass) |
| `created:` | `dct:created "..."^^xsd:dateTime` |
| `modified:` | `dct:modified "..."^^xsd:dateTime` |
| `maturity:` | `wiki:maturity "draft"` |
| `aliases:` (list) | `foaf:nick "..."` per entry (Person only) |
| `identifier:` or `citekey:` | `dct:identifier "..."` (Source only) |

The vault's Breadcrumbs edge fields (`up:`, `concept:`, `source:`, `author:`, `extends:`, `supports:`, `criticizes:`) are **dropped from frontmatter projection**. Those relationships move to body as typed wikilinks. This is the architectural change behind the fresh-Pod constraint.

### Wikilink dispatch (context-driven)

The class-hint → predicate table lives in the JSON-LD context document (§6), not in code. The listener reads the context to resolve hints to predicates. Adding a new hint is a context edit, not a code change.

Default mappings (in the v1 context):

| Body syntax | Projected predicate |
|---|---|
| `[[Title]]` (bare) | `skos:related` |
| `[[Title]]{.broader}` | `skos:broader` |
| `[[Title]]{.subject}` | `dct:subject` |
| `[[Title]]{.source}` or `[[@citekey]]` | `dct:references` (target = `wiki:Source`) |
| `[[Title]]{.author}` | `dct:contributor` |
| `[[Title]]{.extends}` | `cito:extends` |
| `[[Title]]{.supports}` | `cito:agreesWith` |
| `[[Title]]{.criticizes}` | `cito:disagreesWith` |
| `![[image.png]]` | `dct:hasPart` |

### Slug resolution (D76)

The wikilink `[[Title]]` resolves to a target URI:

- Class hint determines container: `.source` or `@`-prefix → `/wiki/sources/`; `.author` → `/wiki/people/`; otherwise same container as source page
- Slug from title via existing algorithm + S3a (`@` strip)
- Target URI is absolute path with `.md` suffix retained

Ambiguous wikilinks default to same-container; the agent uses class hints to cross container boundaries.

### Listener skeleton

```typescript
export class MarkdownProjectionListener {
    constructor(
        private readonly store: MonitoringStore,
        private readonly metaWriter: MetaWriter,
        private readonly projection: ProjectionPipeline,
        private readonly logger: Logger,
    ) {
        this.store.on('changed', this.onChanged.bind(this));
    }

    private async onChanged(event: ChangedEvent): Promise<void> {
        if (!this.isWikiResource(event.identifier)) return;
        if (event.activityType === AS.Delete) return;     // Memento + CSS handle deletes

        const body = await this.store.getRepresentation(event.identifier);
        if (!isMarkdown(body)) return;

        const projectedTriples = await this.projection.run(event.identifier, body);
        await this.metaWriter.replaceGoverned(
            event.identifier,
            projectedTriples,
            this.projection.governedPredicates(event.identifier),
        );
    }
}
```

### Atomicity

`fs.open(O_CREAT | O_EXCL)` on `<resource>.meta.lock` — mirrors D68 (`.git/memento.lock`). Stale-lock recovery via mtime check. Concurrent body PUTs to the same resource serialize on the lock; last-writer-wins on body content, no torn `.meta`.

### Composability with `MementoCommitListener`

Both subscribe to the `MonitoringStore` event stream independently. Memento commits body to git; projection writes `.meta`. Order doesn't matter. If both fire, git has the body version and `.meta` has the projection corresponding to that body.

---

## 5. Renderer rename + RDFa drop (D75)

Rename `css/extensions/markdown-rdfa/` → `css/extensions/markdown-render/`:

- Update package name, Components.js config references
- Drop `rehype-rdfa` from the rehype pipeline
- Add `rehype-wikilink-classes` plugin emitting `<a class="wikilink wikilink-{class-hint}">`
- Ship default `wikilinks.css` for browser viewing
- Move shared parsing modules (`wikilinks.ts`, `predicates.ts`, `resolver.ts`) to `css/extensions/shared/markdown-parsing/` for both extensions

Test impact: existing assertions on RDFa attributes get replaced with class-attribute assertions; structure of the test files unchanged.

No external dependents on RDFa-annotated HTML detected (D75 reasoning: nobody consumes the RDFa attributes in practice).

---

## 6. Affordance descriptor + JSON-LD context + agent discovery

### Storage description root (D44)

Every resource carries `Link: <...>; rel="solid:storageDescription"`. The root is extended:

```turtle
<> a solid:StorageDescription ;
    void:vocabulary wiki:, dct:, skos:, cito:, foaf:, prov: ;
    wiki:contextDocument </meta/context.jsonld> ;
    wiki:shapeCatalog </meta/shapes/> ;
    wiki:affordanceCatalog </meta/affordances/> ;
    wiki:typeIndex </settings/publicTypeIndex> ;
    wiki:conformsTo wiki:L3Profile ;
    rdfs:seeAlso </wiki/pages/>, </wiki/sources/>, </wiki/people/>,
                 </wiki/procedures/>, </wiki/working/> .
```

### JSON-LD context document

At `</meta/context.jsonld>`. Single source of truth for prefix → URI bindings; read by the listener for class-hint resolution; read by agents for vocabulary discovery.

```jsonld
{
  "@context": {
    "wiki":  "urn:example:wiki#",
    "dct":   "http://purl.org/dc/terms/",
    "skos":  "http://www.w3.org/2004/02/skos/core#",
    "cito":  "http://purl.org/spar/cito/",
    "foaf":  "http://xmlns.com/foaf/0.1/",
    "prov":  "http://www.w3.org/ns/prov#",
    "ldp":   "http://www.w3.org/ns/ldp#",

    "title":      "dct:title",
    "subject":    "dct:subject",
    "references": "dct:references",
    "broader":    "skos:broader",
    "related":    "skos:related",
    "contributor":"dct:contributor",
    "creator":    "dct:creator",
    "extends":    "cito:extends",
    "supports":   "cito:agreesWith",
    "criticizes": "cito:disagreesWith",

    "Concept":    "wiki:Concept",
    "Source":     "wiki:Source",
    "Person":     "wiki:Person",
    "Hub":        "wiki:Hub",
    "maturity":   "wiki:maturity"
  }
}
```

### Affordance catalog (D52)

LDP container at `</meta/affordances/>`:

| Affordance | Path | Type | Declares |
|---|---|---|---|
| Markdown projection | `/meta/affordances/markdown-projection` | `wiki:WriteAffordance` | governed-predicate set per shape; recognized frontmatter fields; class-hint dispatch |
| Memento (Rung 1.1 shipped) | `/meta/affordances/memento` | `wiki:VersionAffordance` | RFC 7089 conformance, TimeMap convention (D61) |
| Hub view | `/meta/affordances/hub-view` | `wiki:DerivedClassAffordance` | CONSTRUCT query (§3), threshold N=3 |
| Breadcrumb view | `/meta/affordances/breadcrumb-view` | `wiki:DerivedNavigationAffordance` | CONSTRUCT walking `skos:broader` chain |

The projection affordance is agent-facing:

```turtle
<> a wiki:WriteAffordance ;
    rdfs:label "Markdown projection listener" ;
    wiki:governs (
        rdf:type dct:title dct:identifier dct:created dct:modified
        dct:references dct:subject dct:contributor dct:creator
        skos:broader skos:related cito:extends cito:agreesWith cito:disagreesWith
        wiki:maturity prov:wasGeneratedBy
    ) ;
    wiki:projectsFromFrontmatter ( "type" "created" "modified" "maturity" "aliases" "identifier" "citekey" ) ;
    wiki:classHintTable </meta/context.jsonld#@context> ;
    sh:agentInstruction
        "Substrate writes the predicates listed in wiki:governs. To express any of those, edit the body+frontmatter; do not PATCH .meta directly. Other predicates are agent-extensible." .
```

### Agent's first-arrival ritual

1. `GET` any resource → `Link rel="solid:storageDescription"`
2. `GET` storage description → context, shapes, affordances, type index pointers
3. `GET /meta/context.jsonld` → vocab loaded (prefixes + terms)
4. `GET /meta/affordances/` → list of capabilities
5. `GET /meta/affordances/markdown-projection` → know what substrate manages
6. `GET /meta/shapes/` → list shapes; load whichever needed
7. `GET /settings/publicTypeIndex` → class → container routing

Seven dereferences. No prior vocabulary or shape knowledge required.

### Comunica integration

Storage description's `rdfs:seeAlso` to the five containers makes wiki resources reachable from a Comunica link-traversal query starting at the Pod root.

The RQ-Pod-4 gap (Comunica skips `describedby` on non-RDF resources) still applies for `.meta` traversal. Traversal tests fall back to explicit `-d` sources or direct SPARQL against `/sparql`. Same accommodation as Rung 1.1.

### L2 conformance declaration

`wiki:conformsTo wiki:L3Profile` is the only L2 invariant assertion this spec makes. The L3 profile is defined as "the Pod that ships these affordances + shapes + context together"; conformance implicitly delivers the seven L2 invariants. Formal RDF encoding of invariants is a Rung 1.5 concern.

---

## 7. Testing strategy

### Layer 1 — Unit tests (vitest, `css/extensions/markdown-projection/test/`)

- `projectionPipeline.run(body, frontmatter)` → graph-equal to fixture `.meta` for each bundle resource
- Idempotence: same input twice → byte-identical output
- Predicate ownership (Model A): non-governed triple persists across body rewrite; governed predicates refresh
- Class-hint dispatch: each entry in JSON-LD context's term mapping → correct predicate emitted
- S3a `@`-strip slug: `[[@karpathy-2026-llm-wiki]]` → `karpathy-2026-llm-wiki` in `/wiki/sources/`

### Layer 2 — SHACL validation (pytest + pyshacl)

- Each fixture `.meta` validates against its shape (ResourceShape + entity shape via subclass inference)
- Negative: omit required predicate → validation fails
- Constraint enforcement: `wiki:maturity` outside allowed set fails

### Layer 3 — Integration against running Pod (pytest, requires `make reset`)

- Round-trip: PUT body → GET `.meta` → graph-equal to fixture
- Cross-listener composability: PUT body fires both projection AND memento; git log shows body commit, `.meta` shows projection, no interference
- Concurrency: simultaneous PUTs serialize on lock; one final state, no torn triples
- Enrichment survives body rewrite: PUT body → PATCH `.meta` with non-governed triple → PUT body again → non-governed triple persists

### Layer 4 — Affordance discovery (pytest, 7-step ritual)

- From arbitrary resource URL → complete 7-step traversal
- Each affordance descriptor parses; declared predicates accessible
- `wiki:HubView` CONSTRUCT executes; 0 results on 4-note bundle (threshold N=3 not met — meaningful negative test)
- `wiki:BreadcrumbView` CONSTRUCT from Wiki-Memory L3 Profile returns `[L3 Profile → MOC]`

### Layer 5 — Comunica link-traversal target queries

- Q1 (MOC → source titles): start from MOC URL, follow `skos:broader` inbound → `dct:references` outbound → titles
- Q2 (concept → author affiliation): start from concept, follow `dct:contributor` → affiliation
- Q3 (bidirectional citation chain): source → concepts citing it AND its author

Each query has expected result fixtures. Failures categorized as (a) projection missed, (b) shape rejected, (c) Comunica traversal gap (RQ-Pod-4). (a)/(b) are fix-and-move-on; (c) gets workaround note and explicit-source fallback.

### Layer 6 — Negative tests for L3 invariants

- `wiki:Concept` without `dct:title` → write rejected (4xx via ShapeValidationStore wiring)
- `wiki:Source` without `dct:identifier` → rejected
- `[[Target]]{.author}` where target isn't `wiki:Person` → shape violation at validation

### Out of test scope

- Vault importer migration
- `mem:Crystallize` operation
- D74 trigger vocabulary
- L4 specialization with vault subclasses

### Pass criteria for Rung 1.4 close

- All 4 bundle fixtures round-trip at graph-equality (body+frontmatter → listener → `.meta` matches hand-written fixture)
- All 3 target queries return expected results (or document RQ-Pod-4 workaround with explicit `-d` sources)
- ResourceShape, ConceptShape, SourceShape, PersonShape validate their bundle fixtures (these 4 are exercised by the bundle)
- ProcedureShape and WorkingNoteShape lint-validate against minimal synthetic instances (no bundle traversal participation; shapes shipped but not stress-tested until D73 `mem:Crystallize` spec)
- 7-step first-arrival ritual completes from any resource URL
- Concurrency + composability + enrichment-survives (UC5) tests pass

That's the green light for Rung 1.5 evaluation.

---

## Decisions revised by this spec

| Prior decision | Revision in this spec | New decision number (proposed) |
|---|---|---|
| D77 shape count: 5 | 6 (added ResourceShape baseline) | — (refinement) |
| D77 shape targeting: container path | `rdf:type` class | D78 (class-based shape targeting) |
| D71 vocabulary: vault-derived edge fields | Standards-first (DCT/SKOS/CiTO/FOAF/PROV) + minimal `wiki:` mints + JSON-LD context discovery | D79 (hybrid vocabulary stance) |
| D76 `vault:embeds` | `dct:hasPart` | — (refinement of D76) |
| D77 `vault:isMOC` predicate | Substrate-derived `wiki:Hub` via Comunica SPARQL view | D80 (substrate-derived navigation classes) |
| Open (D58 sharpening) | Model A predicate-level governance: SHACL shape declares governed set; listener owns governed predicates, agent extends with anything else | D81 (predicate-level governance) |

Decision numbering deferred to spec acceptance.

## Open research questions raised

- **RQ-Vocab-1** (closed in spec): `wiki:*` namespace minting deferred via `urn:example:wiki#` placeholder; revisit at Rung 1.5 once eval shows the design holds
- **RQ-Pod-4** (unchanged): Comunica `.meta` traversal gap — accommodated via explicit `-d` sources in target queries
- **RQ-Affordance-1** (partially closed): descriptor format = D52 LDP resources with typed `.meta`; details for non-write affordances (e.g., aggregation, summarization) deferred
- **RQ-Hub-1** (new): is N=3 the right hub threshold? Eval question for Rung 1.5
- **RQ-Discovery-1** (new): does the 7-step first-arrival ritual scale to agents arriving on cold Pods? Eval question for Rung 1.5

---

## Implementation sequencing (preview for writing-plans)

This spec is approach B (golden-fixture TDD). The implementation plan that follows will sequence the work roughly as:

1. Write golden fixtures (bodies + `.meta` Turtle + traversal queries) — establishes truth function
2. Write 6 SHACL shape files; validate fixtures against them
3. Rename `markdown-rdfa/` → `markdown-render/`; drop rehype-rdfa; ship `wikilinks.css`
4. Move shared parsing modules to `shared/markdown-parsing/`
5. Build `MarkdownProjectionListener` extension; iterate until fixture round-trips pass
6. Write JSON-LD context document; wire listener to read it for class-hint resolution
7. Extend storage description root with new pointers
8. Build affordance catalog: projection + memento (relink) + hub view + breadcrumb view
9. Wire Comunica integration; run target queries; document any RQ-Pod-4 workarounds
10. Integration test pass; Rung 1.4 close

Writing-plans skill will decompose each step into reviewable PR-sized increments.
