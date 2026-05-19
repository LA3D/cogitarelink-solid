# Wiki-Memory L3 Shape Completion — Design

**Date**: 2026-05-19
**Author**: Chuck Vardeman (with Claude)
**Status**: Design approved; awaiting implementation plan
**Supersedes**: D77 (5-shape catalog) — REVISED by D78, completed here
**Dependencies**: D70-D81, D87-D90, D93/D94 (Memory Structuring Sprint)
**Decisions to ratify on close**: D95-D100

---

## Goal

Complete the wiki-memory L3 SHACL shape catalog as the canonical agentic-memory substrate. Replace the skeletal 6-shape stub (126 lines of mostly-empty constraints) with a fully-realized 8-shape catalog (1 page-resource shape + 1 abstract Thing parent + 6 concrete Thing-type shapes) grounded in schema.org as top class, SKOS/FOAF/CITO/PROV/DCT as supporting vocabularies, and an explicit L4 extension contract so domain overlays (literature notes, business memory, recipe collections) plug in without modifying L3.

Out of scope: vault PARA flavors, literature/Zotero notes, vault import. These are L4 applications above L3.

---

## Framing

Three layers of stratification (D70 unchanged):

- **L1** — Pod substrate (LDP/WAC/SPARQL/Memento/Solid-OIDC/LDN/Notifications). Universal.
- **L2** — Memory substrate (seven invariants from D70; mem:* vocabulary for operations and triggers per D74/D94).
- **L3** — Memory profile (this sprint). Wiki-memory as canonical reference profile per D71.

Within L3, three layers of writing:

| Layer | What | Where it lives | Vocabulary |
|---|---|---|---|
| L3 content | Pages about Things | `/wiki/{concepts,people,places,events,organizations,procedures,working}/<slug>.md` + `.meta` | schema.org + SKOS + FOAF + CITO + DCT |
| L2 operations | PROV-O activity records of agent writes; COAR Notify announcements | Activities in content `.meta` as `urn:uuid:` subjects; announcements at `/wiki/.operations/` | mem:Action + PROV-O + as:Announce |
| L2 triggers | Substrate-emitted analysis signals | `/wiki/.events/<id>` delivered via Solid Notifications | mem:Event + AS2 |

This sprint scopes to **L3 content** only. L2 operations/triggers shipped in the Memory Structuring Sprint (D93/D94/K4).

---

## Architecture: Page + Thing pattern

Every L3 page resource encodes **two RDF subjects** in its `.meta` sidecar:

```
Resource on disk:  /wiki/concepts/context-graphs.md  +  .meta

RDF subjects:
  <>          a wiki:Page          ← page metadata (substrate-governed)
  <#this>     a skos:Concept       ← the Thing the page is about
                + schema:Thing       (inherited via subclass)
                + schema:DefinedTerm (parallel vocab alignment)
```

**Page resource `<>`** holds page metadata: title, maturity, created/modified, `schema:mainEntity` link to `<#this>`.

**Thing `<#this>`** holds substantive semantics: labels, typed cross-references, sameAs links to external registries.

Disjoint governed-predicate sets per subject; D81 Model A predicate-level governance applies cleanly to each.

### Wikilink resolution rule (the listener change)

Body markdown wikilinks `[[Target Page]]{.class}` project as RDF triples where:
- **Subject** = `<#this>` (the Thing this page is about — not the page resource)
- **Object** = `<target-page.md#this>` (the Thing the target page is about)
- **Predicate** = determined by `{.class}` hint

Wikilinks are typed edges **between Things**. Pages are container resources.

### `schema:Thing` as L3 top class

Why schema.org's Thing root rather than minting our own:
- LLMs know schema.org from pre-training; no learning overhead
- `schema:mainEntity` / `schema:mainEntityOfPage` is exactly the page↔Thing bridge predicate (Wikidata-style separation industrialized)
- Subclasses we need already exist: `schema:Person`, `schema:Place`, `schema:Event`, `schema:Organization`, `schema:HowTo`
- `schema:DefinedTerm` is schema.org's SKOS bridge (compatible with `skos:Concept` for concepts)
- `schema:identifier` + `schema:sameAs` + `schema:keywords` cover the cross-system linking and indexing surface

D78's class-based shape targeting + `rdfs:subClassOf` inference means: an instance of `biz:Equipment` (where `biz:Equipment rdfs:subClassOf schema:Product, schema:Thing`) is validated by both L3 ThingShape AND any L4 EquipmentShape the biz overlay installs. Extensibility falls out for free.

### Why 1-to-1 page-Thing

The Zettelkasten atomic-note principle separates identifier from content, but writes at insight-paragraph granularity. Karpathy's wiki uses topic-page granularity with no identifier separation. This sprint picks **Karpathy's unit size with Zettelkasten's identifier discipline**: one comprehensive page per Thing, but the Thing identifier is durable via `<#this>` fragment, surviving any rename via slug stability (D76).

Yu's wiki-page-as-folders-in-disguise critique applies partially; the vault's typed-edge approach (typed wikilinks projecting to typed predicates) is the third-path mitigation. Model collapse risk from iterative LLM compilation is defended structurally via Memento + D73 two-stage commit + explicit `cito:disagreesWith` rather than prose harmonization.

---

## Shape catalog (8 shapes)

| Shape | Targets | Subject in `.meta` | Role |
|---|---|---|---|
| `wiki:PageShape` | `wiki:Page` | `<>` | Page metadata (title, maturity, mainEntity link) |
| `wiki:ThingShape` | `schema:Thing` | `<#this>` | Common Thing predicates (name, sameAs, identifier) — abstract parent |
| `wiki:ConceptShape` | `skos:Concept` | `<#this>` | Abstract ideas, theories |
| `wiki:PersonShape` | `schema:Person` | `<#this>` | People |
| `wiki:PlaceShape` | `schema:Place` | `<#this>` | Places |
| `wiki:EventShape` | `schema:Event` | `<#this>` | Real-world events the agent has memory of |
| `wiki:OrganizationShape` | `schema:Organization` | `<#this>` | Organizations |
| `wiki:HowToShape` | `schema:HowTo` | `<#this>` | Procedures, recipes, how-tos |

Plus preserved permissive shape:

| Shape | Targets | Role |
|---|---|---|
| `wiki:WorkingNoteShape` | `wiki:WorkingNote` (parent of all Thing types) | D73 two-stage commit drafting tier |

All shapes `sh:closed false` (D81 Model A: substrate governs declared predicates, agent owns rest).

### File layout

```
overlays/wiki-memory/shapes/
├── page.shacl.ttl            (refactored — page-resource shape on <>)
├── thing.shacl.ttl           (NEW — abstract ThingShape parent)
├── concept.shacl.ttl         (NEW — absorbs concept predicates from old PageShape)
├── person.shacl.ttl          (refactored — targets schema:Person)
├── place.shacl.ttl           (NEW)
├── event.shacl.ttl           (NEW)
├── organization.shacl.ttl    (NEW)
├── howto.shacl.ttl           (renamed from procedure.shacl.ttl)
├── working.shacl.ttl         (refactored — permissive umbrella)
├── resource.shacl.ttl        (preserved — LDP RDFS/NRS guard from D38)
└── template.shacl.ttl        (NEW — clonable L4 exemplar)
```

Retired: `source.shacl.ttl` (deferred to L4 literature overlay).

### Container layout changes

Current (D76): `/wiki/{pages, sources, people, procedures, working}/`

New: `/wiki/{concepts, people, places, events, organizations, procedures, working}/`

Plus substrate-only (unchanged): `/wiki/.events/`, `/wiki/.operations/`.

---

## Common predicate sets

### `wiki:PageShape` (targets `wiki:Page`, subject `<>`)

| Predicate | Cardinality | Notes |
|---|---|---|
| `dct:title` | `sh:minCount 1` | Page title (often mirrors `schema:name`) |
| `schema:mainEntity` | `sh:exactly 1` | Required. Points at the Thing `<#this>`. 1-to-1 commitment lives here. |
| `wiki:maturity` | `sh:in (wiki:draft wiki:validated wiki:core)` | Page maturity. |
| `dct:created` | `sh:minCount 1` | Substrate-set on write. |
| `dct:modified` | optional | Substrate-set on update. |
| `prov:wasGeneratedBy` | repeatable | PROV-O activity records of `mem:Action` operations. |

### `wiki:ThingShape` (targets `schema:Thing`, subject `<#this>`)

| Predicate | Cardinality | Notes |
|---|---|---|
| `schema:name` | `sh:minCount 1` | Required (for `skos:Concept` use `skos:prefLabel` additionally). |
| `schema:mainEntityOfPage` | `sh:minCount 1` | Required. Points back to page `<>`. Substrate-set. |
| `schema:identifier` | optional | External registry IDs (DOI, ORCID, ROR). |
| `schema:sameAs` | optional | `owl:sameAs`-style links (Wikidata, schema.org type). |
| `schema:description` | optional | Short prose; complements markdown body. |
| `schema:image` | optional | Reference to attached image per D76. |
| `schema:keywords` | repeatable | Keywords for Phase 7b BM25 indexing. Agent-owned. |
| `schema:dateCreated` | optional | Thing's creation date (substrate-set on first write; mirrors `dct:created`). |

---

## Per-Thing predicate sets

### `wiki:ConceptShape` — targets `skos:Concept`

| Predicate | Cardinality | Notes |
|---|---|---|
| `skos:prefLabel` | `sh:minCount 1` | Required (mirrors `schema:name`). |
| `skos:altLabel` | repeatable | Cross-system aliases. |
| `skos:definition` | optional | Formal definition. |
| `skos:broader` | repeatable | Parent concepts. |
| `skos:narrower` | repeatable | Child concepts. |
| `skos:related` | repeatable | Lateral edges. |
| `skos:exactMatch` / `skos:closeMatch` | repeatable | Cross-scheme matching. |
| `cito:extends` / `cito:agreesWith` / `cito:disagreesWith` / `cito:cites` | repeatable | Citation-typed edges. |

### `wiki:PersonShape` — targets `schema:Person`

| Predicate | Cardinality | Notes |
|---|---|---|
| `schema:givenName` | optional | |
| `schema:familyName` | optional | |
| `schema:email` | repeatable | |
| `schema:affiliation` | repeatable | → `schema:Organization`. |
| `foaf:nick` | repeatable | Cross-system aliases. |
| `org:hasMembership` | repeatable | Time-scoped affiliation per W3C ORG. |

Identifier discipline: ORCID/WebID in `schema:identifier` (literal); dereferenceable URI in `schema:sameAs`. Matches AddressBook patterns.

### `wiki:PlaceShape` — targets `schema:Place`

| Predicate | Cardinality | Notes |
|---|---|---|
| `schema:address` | optional | Text or `schema:PostalAddress`. |
| `schema:geo` | optional | `schema:GeoCoordinates`. |
| `schema:latitude` / `schema:longitude` | optional | Flat alternative to `schema:geo`. |
| `schema:containedInPlace` | optional | Parent place. |
| `schema:containsPlace` | repeatable | Child places. |

### `wiki:EventShape` — targets `schema:Event`

| Predicate | Cardinality | Notes |
|---|---|---|
| `schema:startDate` | optional | `xsd:dateTime` or `xsd:date`. |
| `schema:endDate` | optional | |
| `schema:location` | optional | → `schema:Place`. |
| `schema:attendee` | repeatable | → `schema:Person`. |
| `schema:organizer` | repeatable | → `schema:Person` or `schema:Organization`. |
| `schema:about` | repeatable | → any `schema:Thing`. |
| `schema:superEvent` / `schema:subEvent` | repeatable | Event hierarchy. |
| `sh:not [ sh:class mem:Event ]` | constraint | Disjointness with substrate signals. |
| `sh:not [ sh:class mem:Action ]` | constraint | Disjointness with substrate operations. |

### `wiki:OrganizationShape` — targets `schema:Organization`

| Predicate | Cardinality | Notes |
|---|---|---|
| `schema:legalName` | optional | |
| `schema:parentOrganization` | optional | → Organization. |
| `schema:subOrganization` | repeatable | |
| `schema:member` | repeatable | → `schema:Person`. |
| `schema:foundingDate` / `schema:dissolutionDate` | optional | |

Identifier discipline: ROR IRI in `schema:identifier`; `schema:sameAs <https://ror.org/...>` for dereferenceability.

### `wiki:HowToShape` — targets `schema:HowTo`

| Predicate | Cardinality | Notes |
|---|---|---|
| `schema:step` | repeatable | `schema:HowToStep` or `schema:Text`. Optional — markdown body is canonical. |
| `schema:tool` | repeatable | Tools required. |
| `schema:supply` | repeatable | Supplies/resources required. |
| `schema:totalTime` | optional | `xsd:duration`. |
| `sh:not [ sh:class mem:Action ]` | constraint | Disjointness with substrate operations. |

Procedure body lives in markdown body, not in `sh:agentInstruction` (corrects K3-style anti-pattern from old PageShape).

---

## Wikilink class-hint table

Existing hints preserved + new hints for the expanded catalog:

| Hint | Subject | Predicate |
|---|---|---|
| `{.related}` | THING | `skos:related` |
| `{.broader}` | THING | `skos:broader` |
| `{.narrower}` | THING | `skos:narrower` |
| `{.extends}` | THING | `cito:extends` |
| `{.supports}` | THING | `cito:agreesWith` |
| `{.criticizes}` | THING | `cito:disagreesWith` |
| `{.cites}` | THING | `cito:cites` |
| `{.source}` | THING | `dct:source` |
| `{.author}` | THING | `dct:contributor` (K3) |
| `{.affiliation}` | THING | `schema:affiliation` |
| `{.location}` | THING | `schema:location` |
| `{.attendee}` | THING | `schema:attendee` |
| `{.organizer}` | THING | `schema:organizer` |
| `{.about}` | THING | `schema:about` |
| `{.member}` | THING | `schema:member` |
| `{.tool}` | THING | `schema:tool` |
| `{.supply}` | THING | `schema:supply` |
| `{.step}` | THING | `schema:step` |
| `{.parent}` | THING | context-sensitive: `schema:parentOrganization` if source is `schema:Organization`, else `skos:broader` |
| `{.embed}` (with `!` prefix) | PAGE | `wiki:embeds` |

L4 overlays extend via overlay manifest predicate `overlay:installsHintMapping` (new, added in this sprint).

---

## Publication hook (L4 literature-note path)

The L4 literature-note system (Zettelkasten-style atomic notes per source, CITO/DCTERMS edges, external article references) plugs in via four hooks defined in L3:

1. **CITO predicates accept any `schema:Thing` target.** ConceptShape's `cito:extends`/`agreesWith`/`disagreesWith`/`cites` are domain-unconstrained at L3. L4 LiteratureNoteShape targets `schema:ScholarlyArticle rdfs:subClassOf schema:CreativeWork rdfs:subClassOf schema:Thing` — concept pages cite literature notes via the same predicates without shape changes.

2. **Attachment co-location via `schema:associatedMedia`** (D76). A literature note page at `/wiki/literature/foo.md` co-locates the PDF at `/wiki/literature/foo.pdf` as an LDP non-RDF resource. The Thing `<#this>` carries `schema:associatedMedia </wiki/literature/foo.pdf>`. PDF stays binary; metadata stays in `.meta`.

3. **DCTERMS predicates land on L4, not L3.** `dct:creator`, `dct:date`, `dct:identifier`, `dct:publisher`, `dct:bibliographicCitation` are L4 LiteratureNoteShape's governed set. L3's DCTERMS footprint (`dct:title`, `dct:created/modified`, `dct:source`, `dct:contributor`) doesn't conflict.

4. **Worked example in `extending-l3.md`.** Literature-note overlay is one of the two canonical L4 examples in the extension manual.

Treating CIDOC-CRM/FRBRoo as compatible-but-deferred: `schema:ScholarlyArticle` and `frbroo:F22_Self-Contained_Expression` can co-class the same Thing if a future use case demands FRBRoo's heavier bibliographic modeling.

---

## Agent-instruction text pattern + FAIR metadata

### FAIR metadata properties (every shape, class, property)

| Property | Role |
|---|---|
| `rdfs:label` | Short human-readable name |
| `rdfs:comment` | Descriptive prose for humans and tooling |
| `skos:definition` | Formal definition (minted classes) |
| `skos:scopeNote` | Usage guidance (when to/not to use) |
| `rdfs:isDefinedBy` | Vocabulary IRI |
| `rdfs:seeAlso` | Related references |
| `dct:conformsTo` | Spec the shape conforms to |
| `dct:created` / `dct:modified` | Provenance timestamps |
| `dct:creator` / `dct:contributor` | Authoring agents |
| `vann:preferredNamespacePrefix` | Canonical short prefix for the vocabulary (on the ontology resource) |
| `vann:preferredNamespaceUri` | Canonical namespace URI (on the ontology resource) |
| `sh:agentInstruction` | **Procedural prompt content only** — substrate-governance, hints, defenses, extension pointer |

Descriptive prose stays in `rdfs:label`/`rdfs:comment`/`skos:definition`. `sh:agentInstruction` is reserved for what to do, not what something is. Codifies D97.

### `sh:agentInstruction` template

```
[Substrate-governed predicates]   Comma-separated list (D81 Model A)
[Wikilink hints]                  Hints that project to this shape's predicates
[Model-collapse defense]          Preserve specifics, flag conflicts (where applicable)
[Disjointness note]               Cross-namespace category separation (Event, HowTo)
[Extension pointer]               Closing line referencing /vault/meta/extending-l3.md
```

### Minted classes in `ontology/wiki.ttl`

This sprint mints:

- `wiki:Page` — page-resource class for `<>`
- `wiki:WorkingNote rdfs:subClassOf wiki:Page` — permissive D73 drafting class
- `wiki:ExtensionGuide rdfs:subClassOf schema:HowTo` — class for L4 extension manuals
- `wiki:maturity` (property) + `wiki:MaturityLevel` (class) + `wiki:draft/validated/core` (instances)
- `wiki:embeds` (property) — preserved from existing usage

Each carries full FAIR metadata. Vocabulary-level declarations on the ontology resource itself:

```turtle
<https://pod.vardeman.me/vault/ontology/wiki>
    a owl:Ontology ;
    rdfs:label "Wiki-memory L3 vocabulary" ;
    rdfs:comment "Substrate-minted classes and properties for the wiki-memory L3 reference profile. Composes with schema.org, SKOS, FOAF, CITO, PROV, DCT; mints wiki:* only for genuine gaps per D79." ;
    vann:preferredNamespacePrefix "wiki" ;
    vann:preferredNamespaceUri "https://pod.vardeman.me/vault/ontology/wiki#" ;
    dct:conformsTo <https://www.w3.org/TR/owl2-overview/> ;
    dct:created "2026-05-19"^^xsd:date ;
    dct:creator <https://orcid.org/0000-0003-4091-6059> ;
    rdfs:seeAlso </vault/meta/extending-l3.md> .
```

`vann:preferredNamespacePrefix` and `vann:preferredNamespaceUri` are the VANN vocabulary-annotation conventions for declaring the canonical short prefix and namespace URI. Agents (and tooling like ontology browsers) read these to know "the canonical prefix for this vocabulary is `wiki:`" without having to infer from filenames. Pattern repeated on any vocabulary file (`ontology/mem.ttl` already follows this; sprint adds it consistently to `wiki.ttl`).

Per-class FAIR metadata (each minted class):

```turtle
wiki:Page
    a owl:Class ;
    rdfs:label "Wiki Page" ;
    rdfs:isDefinedBy <https://pod.vardeman.me/vault/ontology/wiki> ;
    rdfs:comment "An information resource (markdown body + .meta sidecar) in the wiki-memory L3 substrate. Each wiki:Page describes exactly one Thing via schema:mainEntity. The Thing IRI is the page's <#this> fragment." ;
    skos:definition "The page-resource side of the dual-layer L3 architecture (D71 sharpened). Pages are information resources; the Things they describe are the queryable entities." ;
    skos:scopeNote "1-to-1 with the Thing it describes (per L3 commitment). For an L4 system needing multiple pages per Thing, use mem:SupersedeAction to chain versions rather than allowing parallel pages." ;
    rdfs:seeAlso </vault/meta/extending-l3.md> ;
    dct:created "2026-05-19"^^xsd:date ;
    dct:creator <https://orcid.org/0000-0003-4091-6059> .
```

### `template.shacl.ttl` — L4 extension exemplar

Heavily commented, clonable file at `overlays/wiki-memory/shapes/template.shacl.ttl`:

```turtle
@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix wiki:   <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix schema: <https://schema.org/> .
@prefix dct:    <http://purl.org/dc/terms/> .
# Add your domain prefix below:
@prefix YOURPFX: <https://YOUR.DOMAIN.example/ns/> .

<> dct:conformsTo <https://www.w3.org/TR/shacl/> .

# === MODIFY: Replace YourThing with your subclass name ===
YOURPFX:YourThingShape a sh:NodeShape ;
    rdfs:label "[YOUR SHAPE NAME]" ;
    rdfs:comment "[ONE-PARAGRAPH DESCRIPTION]" ;
    skos:scopeNote "[WHEN to use; when NOT to use]" ;
    rdfs:isDefinedBy <[YOUR VOCABULARY IRI]> ;
    rdfs:seeAlso </vault/meta/extending-l3.md> ;
    dct:conformsTo <https://www.w3.org/TR/shacl/> ;
    dct:created "[YYYY-MM-DD]"^^xsd:date ;
    dct:creator <[YOUR ORCID OR WEBID]> ;

    # === MODIFY: Target your subclass (must rdfs:subClassOf schema:Thing) ===
    sh:targetClass YOURPFX:YourThing ;
    sh:closed false ;
    sh:agentInstruction "[SUBSTRATE GOVERNANCE list]. [WIKILINK HINTS if applicable]. [DEFENSES if applicable]. To extend, subclass [class] and add your shape. See </vault/meta/extending-l3.md>." ;

    sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
        rdfs:label "Name" ;
    ] ;
    # MODIFY: add domain-specific property shapes
.
```

### `/vault/meta/extending-l3.md` — extension manual

Wiki page (eats own dog food: `<>` typed `wiki:Page`, `<#this>` typed `wiki:ExtensionGuide`). Structure:

1. **When to extend** — symptom checklist
2. **The five-step procedure** — subclass → mint prefix → write shape → register Type Index → package overlay
3. **Worked example: business overlay** — biz:Equipment, full manifest, apply.py invocation
4. **Worked example: literature-note overlay** — schema:ScholarlyArticle, DCTERMS+CITO predicates, PDF co-location
5. **Vocabulary minting policy** — schema.org parent first; mint for gaps; never collide with `mem:*`
6. **Common pitfalls** — relative IRI resolution, blank nodes in `solid:inserts`, container constraints
7. **Discovery chain** — how agents find this page (storage description → `wiki:extensionGuide` → here)

---

## MarkdownProjectionListener changes

Three concrete changes to `css/extensions/markdown-projection/wikilinkProjection.ts`:

### Change 1: Subject routing in hint table

`HINT_TO_PREDICATE: Record<string, NamedNode>` becomes `HINT_TO_PROJECTION: Record<string, { subject: 'PAGE' | 'THING'; predicate: NamedNode }>`. All Thing-to-Thing edges have `subject: 'THING'`; embed and page-level metadata stay `'PAGE'`.

### Change 2: Target IRI is target Thing, not target page

```ts
function resolveTargetIRI(pageURL: NamedNode): NamedNode {
  return DataFactory.namedNode(pageURL.value + '#this');
}
```

### Change 3: Substrate-emitted invariants

Three triples on every write:

```turtle
<>      schema:mainEntity         <#this> .
<#this> schema:mainEntityOfPage   <>      .
<#this> a                         <Thing-class-from-Type-Index> .
```

Thing class derived from container path (reverse-lookup Type Index) with frontmatter `type:` override.

### N3 Patch scoping change (D81 Model A correctness)

Delete clause scopes per subject:

```turtle
<> a solid:InsertDeletePatch ;
   solid:deletes {
     # Page-governed predicates from <>
     <> dct:title ?old1 . <> wiki:maturity ?old2 . <> schema:mainEntity ?old3 .
     # Thing-governed predicates from <#this>
     <#this> a ?cls . <#this> schema:name ?old4 . <#this> schema:mainEntityOfPage ?old5 .
     <#this> skos:prefLabel ?old6 . # ... full governed predicate list per subject
   } ;
   solid:inserts {
     # New projection
   } .
```

Wildcards `?old*` delete-by-pattern only existing governed predicates without touching agent-owned ones.

### Context-sensitive `{.parent}` resolution

Reads source page's `<#this> a rdf:type`. Routes to `schema:parentOrganization` if Organization; else `skos:broader`.

### Estimated size

- `wikilinkProjection.ts`: ~80 LOC modified
- New `resolveThingClass()` helper: ~30 LOC
- N3 Patch builder: ~40 LOC modified
- Unit tests: ~200 LOC new
- Integration tests: ~150 LOC new

Total: ~500 LOC.

### What doesn't change

- Body parser (`unified` + `remark-wiki-link`)
- Class-hint syntax (`[[Page]]{.class}`)
- Pandoc attribute extraction
- N3 Patch HTTP request path
- MonitoringStore CDC subscription
- RQ-Listener-1 (CSS overwrite race) — same diagnosis, same mitigation paths

---

## Disjointness enforcement (belt-and-braces)

### Layer 1: OWL declaration in vocabulary

In `ontology/wiki.ttl`:

```turtle
schema:Event owl:disjointWith mem:Event .
schema:HowTo owl:disjointWith mem:Action .
```

Documents the constraint; reasoners pick it up; not auto-enforced without reasoning.

### Layer 2: Location enforcement via shape-validator

New config `pathBasedClassConstraint` on the shape-validator extension:

```
/wiki/.events/*       → accepts only mem:Event-typed Things (substrate-only writes)
/wiki/.operations/*   → accepts only as:Activity (announcement) Things
/wiki/events/*        → rejects mem:Event-typed Things
/wiki/working/*       → accepts any wiki:WorkingNote (permissive umbrella)
```

On violation, 422 with named-disjointness `sh:ValidationReport` body referencing the vocabulary.

### Layer 3: SHACL `sh:not` constraint

Each content shape declares forbidden classes:

```turtle
wiki:EventShape sh:not [
    sh:class mem:Event ;
    sh:message "schema:Event (content) is disjoint with mem:Event (substrate signal). See </vault/ontology/wiki>." ;
] .

wiki:HowToShape sh:not [
    sh:class mem:Action ;
    sh:message "schema:HowTo (content) is disjoint with mem:Action (substrate operation). See </vault/ontology/wiki>." ;
] .
```

Symmetric `mem:Event`/`mem:Action` shape constraints ship in next-plan #2 (MemTriggerListener detector wiring).

### Failure modes caught

| Failure mode | Caught by |
|---|---|
| mem:Event PUT to `/wiki/events/foo.md` | Layer 2 (path constraint) → 422 |
| Multi-type `<#this> a schema:Event, mem:Event` | Layer 3 (sh:not) → 422 |
| Agent reads vocab to understand relationship | Layer 1 (owl:disjointWith) |
| OWL+SHACL reasoning toolchain | All three layers |
| Substrate PUT mem:Event to `/wiki/.events/` | Layers pass; WAC blocks non-substrate |

---

## Migration plan

The reference Pod is a **DevPod**; nothing critical stored. Migration is a hard rebuild rather than per-resource read-modify-write.

### Order of operations within the sprint

1. **Vocabulary** — Update `ontology/wiki.ttl` with new classes, `owl:disjointWith`, FAIR metadata. Update `/meta/context.jsonld`.
2. **Shapes** — Author new files; refactor existing; retire `source.shacl.ttl`.
3. **Manifest** — Update `overlays/wiki-memory/manifest.ttl` shape list. Add `overlay:installsHintMapping` predicate.
4. **Listener** — Implement two-subject projection (Section: MarkdownProjectionListener changes). Unit tests pass.
5. **Shape-validator** — Add path-based constraint config (Layer 2 disjointness). Integration tests pass.
6. **`make reset` + `apply.py`** — Hard rebuild reference Pod. Owner-identity + AddressBook overlays re-apply on top.
7. **Extension manual** — Author `/vault/meta/extending-l3.md`. Verify discoverability via storage description.
8. **Decision ratification** — Author D95-D100 in `SOLID-Pod-Decisions.md`; update MEMORY.md.

### Container layout changes

```
Old: /wiki/{pages, sources, people, procedures, working}/
New: /wiki/{concepts, people, places, events, organizations, procedures, working}/
```

Old `pages/` → `concepts/` (where most content was concept-shaped). Old `sources/` retires (deferred to L4 literature overlay).

### Type Index updates

Apply.py installs registrations for: `skos:Concept` → `/wiki/concepts/`, `schema:Person` → `/wiki/people/`, `schema:Place` → `/wiki/places/`, `schema:Event` → `/wiki/events/`, `schema:Organization` → `/wiki/organizations/`, `schema:HowTo` → `/wiki/procedures/`. Retires `wiki:Source` and `wiki:Page` registrations (Page is the resource class, not Thing class; not Type-Index-routable).

---

## Test plan

### Three test layers

**Layer 1 — Unit tests (TDD)**
- `wikilinkProjection.test.ts` — Hint table dispatch: ~50 cases
- `n3PatchBuilder.test.ts` — Two-subject scoping: ~15 cases
- `typeIndexLookup.test.ts` — Container → Thing class: ~10 cases
- `shapeValidatorPathConstraint.test.ts` — Path constraint dispatch: ~12 cases

**Layer 2 — Integration tests (live Pod)**
- `test_markdown_projection_e2e.py` — Two-subject `.meta` per Thing type (6 happy paths)
- `test_thing_mainentity_invariant.py` — Substrate-emitted mainEntity triples
- `test_wikilink_thing_resolution.py` — Wikilinks → Thing-to-Thing edges
- `test_disjointness_path.py` — Layer 2 disjointness
- `test_disjointness_shacl.py` — Layer 3 disjointness
- `test_disjointness_legitimate.py` — No false positives
- `test_l4_extension_overlay.py` — Stub biz overlay applies + validates
- `test_extending_l3_dereferenceable.py` — Manual page accessible
- `test_fair_metadata_present.py` — All shapes have required RDFS/SKOS/DCT props
- `test_template_shape_clonability.py` — Template clones without errors

**Layer 3 — Cross-batch consistency**
- `test_shape_vs_hint_table_agreement.py` — No orphan hints/predicates
- `test_typeindex_vs_containers.py` — Type Index ↔ containers in agreement
- `test_vocab_vs_shape_agreement.py` — No dangling class references
- `test_extending_l3_examples_apply.py` — Manual's worked examples actually work
- `test_owl_disjointwith_enforced.py` — owl:disjointWith ↔ sh:not agreement

### Acceptance criteria

**Functional**
- [ ] `make reset && apply.py overlays/wiki-memory --target <pod>` produces clean Pod with 11 shapes installed
- [ ] All Layer 1/2/3 tests pass (~110 cases)
- [ ] `apply.py` idempotent

**Discoverability**
- [ ] Storage description advertises new `wiki:extensionGuide`
- [ ] `/vault/meta/shapes/` lists all 11 shape files
- [ ] `/vault/meta/extending-l3.md` dereferences
- [ ] `void:vocabulary` includes schema.org and CITO

**FAIR metadata**
- [ ] Every shape has label/comment/isDefinedBy/conformsTo/created/creator
- [ ] Every minted class has same + definition/scopeNote
- [ ] Automated lint: `sh:agentInstruction` text contains no descriptive prose

**Extensibility**
- [ ] Stub L4 overlay applies + validates biz:Equipment
- [ ] Template clones via string replacement
- [ ] Manual worked examples extract and apply

**Performance**
- [ ] PUT-to-projection round-trip < 200ms p95
- [ ] Wiki-search p95 < 500ms (no regression)

**Disjointness**
- [ ] 422 with named message for path violation
- [ ] 422 with `sh:not` violation for multi-typing
- [ ] No false positive at legitimate paths

---

## Out-of-scope (deferred to other sprints)

| Item | Why deferred | Goes to |
|---|---|---|
| `vault:LiteratureNoteShape` | L4 specialization | L4 literature-note sprint |
| `vault:Person` / `vault:Project` / PARA shapes | L4 vault flavor | L4 vault overlay sprint |
| Source/CreativeWork shape | Deferred per scoping | Same L4 literature sprint |
| `mem:Event` / `mem:Action` SHACL shapes | Substrate plumbing | Next-plan #2 |
| MemTrigger detector hook integration | Wiring | Next-plan #2 |
| Vault import via new shapes | Separate sprint | Vault-import sprint |
| RQ-Listener-1 mitigation | Pre-existing | Post-Rung-1.5 decision |
| Phase 7b BM25 indexer | Requires indexer | Phase 7b sprint |
| Multi-page-per-Thing semantics | 1-to-1 commitment for v1 | Future review |
| Structured `schema:PostalAddress` / `schema:GeoCoordinates` | Flat literals for v1 | L4 if needed |

---

## Open questions

| Question | Resolution path |
|---|---|
| **RQ-Wiki-2**: Backlinks performance at 10k+ resources | Rung 1.5 eval |
| **RQ-Discovery-1**: 7-step (now 8-step) first-arrival ritual cold-start | Rung 1.5 eval |
| **RQ-Hub-1**: N=3 hub threshold | Unchanged |
| **RQ-Listener-1**: CSS .meta overwrite race | Same three mitigation paths post-sprint |
| **New**: Two-subject pattern + Comunica link-traversal interaction | Verify in integration tests; RQ-Pod-4 workaround unchanged |
| **New**: Cold-agent discoverability of `extending-l3.md` | Storage description advertises; acceptance test covers mechanical accessibility |
| **New**: Cold-agent interpretation of the L4 extension contract | **Rung 1.5 eval task** — exposing a cold agent to the L3 catalog and observing whether it can compose a valid L4 overlay (subclass + shape + Type Index + manifest) without external help. Sprint cannot validate this; only the artifacts. The test is empirical, not pre-merge |

---

## Decisions to ratify

- **D95** — Thing-as-top-class architecture (schema:Thing root + hash-fragment Thing IRIs + 1-to-1 Page+Thing).
- **D96** — Page+Thing predicate-level governance split (extends D81 Model A).
- **D97** — FAIR vocabulary metadata invariant (descriptive prose in RDFS/SKOS/DCT; `sh:agentInstruction` reserved for procedural content).
- **D98** — L3 shape catalog (8 shapes: PageShape + ThingShape + 6 Thing-shapes targeting Concept/Person/Place/Event/Organization/HowTo). Plus preserved permissive `wiki:WorkingNoteShape` (D73), preserved `resource.shacl.ttl` (D38 LDP guard), and new `template.shacl.ttl` exemplar — 11 shape files total. Supersedes D77.
- **D99** — Belt-and-braces disjointness (OWL + location + SHACL).
- **D100** — L4 extension contract (subclass → mint prefix → write shape → register Type Index → package overlay).

---

## Dependencies on prior decisions

D70/D71 stratification, D72 compile-once, D73 two-stage commit, D74 mem:* triggers, D76 URI/slug/attachment, D78 class-based shape targeting, D79 hybrid vocab + JSON-LD context, D81 Model A governance, D84 URI conformance, D87 capabilities-only deps, D88 tmpl: vocab, D93/D94 synthesis page + mem:* operations vocab.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Schema.org open-world looseness vs SHACL `sh:closed false` | Low | Compatible — substrate governs declared predicates only per D81 |
| L4 extension fails for cold agent without help | Medium | Acceptance test covers stub L4 overlay applying mechanically; **the open question of whether a cold agent reading the catalog can actually compose a valid L4 overlay without external help is a Rung 1.5 eval task, not a pre-merge gate.** Sprint ships the artifacts (template + manual + boilerplate); cold-agent interpretation is empirically measured separately |
| Type Index dispatch single-point-of-failure | Low | Declarative; cross-batch test verifies registration completeness |
| SHACL `sh:not` conflicts with `sh:and`-composed shape later | Low | Per-shape, not transitive; L4 can override |
| Hard rebuild loses unexpected artifact | Low | DevPod, no critical state; documented in MEMORY |

---

## Estimated sprint size

- ~500 LOC listener + tests
- ~600 LOC shape files (11 shapes × ~55 LOC including FAIR metadata)
- ~200 LOC vocabulary file (`ontology/wiki.ttl` updates)
- ~150 LOC apply.py extension (`installsHintMapping`)
- ~300 LOC integration tests
- ~400 LOC `/vault/meta/extending-l3.md` markdown
- ~50 LOC shape-validator config
- Total: ~2200 LOC across one batch
- Single TDD sprint, executable in subagent-driven-development mode
