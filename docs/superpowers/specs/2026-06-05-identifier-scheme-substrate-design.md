# D111: The Identifier-Scheme Substrate — a Pod-Level Persistent-Identifier System

**Date:** 2026-06-05
**Status:** DECIDED (brainstorm-validated with Chuck, 2026-06-05; supersedes the narrower
"identifier-affordance" framing of 2026-06-04)
**Decision ID:** D111 (register in `decisions.md` + vault decisions log on acceptance)
**Relationships:** grounds on D104 (self-validating substrate), D107 (URI re-layering /
vault-contamination lesson), D108 (admission floor, derive-the-inferable, two enforcement
audiences), D109 (substrate re-grounding, hybrid contextualized KG, ontology cache policy),
D110 (interop re-basing, stub), D55 (three-tier access), D83 (Pod-as-toolkit / capability
catalog), D86 (PROF resource-kind hints), D88 (tmpl: substrate templates), D98 (Source merged
into concepts), RQ-Grammar-1 (literal axis), D36 (typed wikilinks).
**Prior art:** `docs/research/2026-06-04-identifier-affordances-prior-art.md` (the four-column
comparison + DXWG lineage audit — READ IT FIRST; this spec instantiates its synthesis).

---

## 1. Background — why a memory pod needs a PID system

### 1.1 The thread that got us here

The fragility audit (2026-06-03) surfaced a `dct:identifier` design gap on `wiki:Source`
(citation records): the identifier was an untyped string — a DOI, an arXiv ID, and a citekey
were indistinguishable to an agent, and none of them said how to resolve, validate, or
crosswalk. Chuck's framing call (2026-06-04, locked): **identifier types are
agent-affordance dispatch keys** — the *type* of an identifier is what tells an agent which
operations are available on it. Three sub-calls were locked then and survive unchanged here:

1. The literal's **datatype is a dereferenceable Pod scheme record**
   (`"10.1234/x"^^<scheme-IRI>`) — the type itself is the progressive-disclosure entry point.
2. Cache `idot.ttl` (identifiers.org types vocabulary, v0.3) + `datacite.ttl` (SPAR DataCite)
   pod-side under the D109 §5 ground-now policy; scheme records **reference** identifiers.org
   registry entries, never copy them.
3. Compose across the standards family via `dct:conformsTo` / `skos:exactMatch`, **never
   cross-subclass** (the DXWG #808 lesson: PROF and DCAT deliberately compose by conformance,
   not inheritance).

### 1.2 The holistic reframe (this brainstorm's contribution)

The 2026-06-05 brainstorm widened the frame from "Source needs a DOI datatype" to **the Pod's
persistent-identifier system**, on four grounds:

- **One Pod, many applications, one identifier discipline.** Foreseeable consumers:
  wiki-memory (DOI/citekey/ORCID on Sources), AddressBook (ORCID/email/DIDs on contacts), a
  literature application (publications + citations + field tracking), company context-graph
  memory (internal PIDs, org registries), a research-data pod (RO-Crate — itself
  schema.org + PIDs), ML dataset description (MLCommons Croissant), and **agents themselves**
  (WebID today, DIDs in the wild — the CODATA croissant-toolkit's AGENTS.md already *mandates*
  DID-based agent identity and DID provenance in emitted metadata). If each application
  invents its own identifier handling, agents cannot transfer navigation skill across
  applications. The consistency IS the affordance.
- **FAIR-first.** Mature FAIR implementations (the pharma pattern) build the PID system
  *first* and hang everything else off it. Same here: this is L1/L2 Pod infrastructure with
  the same standing as the storage description, Memento, and the admission floor.
- **Identifier rot is the enemy, in both directions.** The system must mitigate external rot
  (multi-provider resolution, local Memento-versioned records, external anchors) and must not
  *cause* internal rot (datatype IRIs are written into literals forever — see §4.1).
- **Bidirectional Solid/non-Solid crosswalk.** Identifiers inside the Pod crosswalk OUT to
  systems whose access mechanism is not Solid (DOI, DID, handles); PIDs issued OUTSIDE Solid
  point INTO Pod resources (a published dataset's DOI resolving to its Pod URL). Agents need
  one consistent traversal mechanism across that boundary.

### 1.3 What this is NOT (placement lesson)

This is **Pod structure, not vault structure**. The substrate has repeatedly suffered from
shoving infrastructure into the vault/wiki content tree (the RQ-Substrate-4 contamination
that D107 paid to fix; the `/vault` storage-root name itself is under reconsideration). The
identifier system therefore lives **outside any storage root** (§4.1) and is rename-proof by
construction. Do not relocate it under `/vault/` or any L3 content area.

### 1.4 The Verborgh sanity check (dual view)

Per "What's in a Pod?": the scheme data is a **subgraph of the Pod's knowledge graph first**;
the LDP documents are serving arrangements of it. The typed literal is the purest dual-view
feature in the design — document view: text in a Turtle file; graph view: the datatype IRI
is a navigable edge from any literal, in any application, into the catalog subgraph. No
application's preferred arrangement is baked into the data (the contacts-conundrum
discipline); derived views (e.g. `schema:PropertyValue`) project from the same nodes. This
substrate is *simpler* than wiki-memory under D109's co-equal-authority model: there is no
markdown authoring layer here — pure graph-authority substrate, RDF-body documents.

---

## 2. Design principles

1. **One catalog describes every scheme — including Solid's own.** A Pod URL is an
   identifier whose scheme record (`solid-resource`) says: resolution = HTTP GET under Solid
   access patterns; resolution returns *the thing itself*. A DOI's record says: N web
   providers; returns a landing page or DataCite metadata — a *description*. A `did:oyd`
   record says: content-addressed; resolver required; possibly not publicly resolvable.
   Uniform model, uniform traversal, no special cases for identity artifacts (a DID document
   or a VC is just a document the record describes).
2. **Two identifier regimes; formality is declared, not ambient.**
   - *Informal* (the web's native regime): every resource's URL, dual-purpose
     locator/identifier, **enforced by the HTTP protocol itself**, self-describing via
     out-of-band headers (`rel="profile"`, `constrainedBy`, `describedby`). Requires NOTHING
     from this system. Simple agentic applications never touch `/id/` and pay zero context
     cost for its existence.
   - *Formal* (catalog-described): deliberately minted, scheme-typed identifiers whose
     persistence and meaning are maintained by an institution/registry (DOI, ORCID, ROR,
     DIDs, company PIDs). The obligation to use one arises at exactly two opt-in points:
     **shape-level** (an application's shape requires `dct:identifier` — e.g. SourceShape,
     because a citation record without a formal identifier is defective *for its purpose*)
     and **instance-level** (an agent attaches one by judgment). An overlay whose shapes
     never mention identifiers never encounters this system.
   - *Lifecycle*: formality arrives at **crystallization, not birth** (D73 applied to
     identity). A working note lives under the informal regime; publication/citation/
     registration attaches the formal identifier at the promotion event.
3. **Enforcement lives at the HTTP write path or nowhere.** Client tools (`apply.py`,
   `pod_audit.py`, skills) are conveniences, never load-bearing — an agent improvising with
   curl must hit the same guarantees (D104/D108). Mechanisms: `ldp:constrainedBy` floor with
   422 + ValidationReport, server-managed derivation, WAC. See §7.
4. **Suggestive typing.** The scheme's regex (`idot:idRegexPattern`) is *data* for agents and
   the Tier-2 curation loop — never a floor 422. The floor reserves rejection for judgment
   metadata (presence of `dct:identifier` where a shape demands it) and for the registration
   contract (SchemeRecordShape).
5. **Compose by conformance, anchor by exactMatch.** `skos:exactMatch` → DataCite scheme
   individuals (the shared global anchors that make two Pods' `doi` records provably the same
   scheme); `dct:conformsTo` → profiles/specs (DataCite schema, DID Core, OYDID);
   `rdfs:seeAlso` → identifiers.org registry entries. Never cross-subclass family members.
6. **Cross-Pod consistency through anchors, not shared IRIs.** Scheme-record IRIs are
   deployment-local (parameterized, like the storage root); the `exactMatch` anchors are
   global. A company Pod and a science Pod each carry local records anchored to the same
   external individuals.
7. **Derive the inferable; the agent authors one document.** The catalog's per-scheme index
   entries are server-derived from member records (`ldp:contains` precedent). Agents can
   never make index and record disagree, because they can only write the record (§4.4).

---

## 3. Concepts and vocabulary

| Term | Meaning |
|---|---|
| **Scheme** | An identifier system (DOI, ORCID, did:oyd, citekey…) — an abstract thing, triple-typed `idot:Namespace` + `skos:Concept` + `rdfs:Datatype` |
| **Scheme IRI / datatype IRI** | The hash IRI denoting the scheme: `https://pod.vardeman.me/id/schemes/#doi`. Used as the literal datatype. Structurally non-retrievable (HTTP strips fragments) — the abstract/document separation is enforced by protocol mechanics (Cool URIs §4.1) |
| **Catalog** | `/id/schemes/` — an `ldp:BasicContainer` whose representation is also `dcat:Catalog` + `skos:ConceptScheme` (the `idot:Registry ⊑ dcat:Catalog` pattern). Carries server-derived thin entries per scheme |
| **Scheme record** | `/id/schemes/doi` — a per-scheme `ldp:RDFSource` (Turtle, conneg JSON-LD). `foaf:primaryTopic </id/schemes/#doi>`; carries the rich description: definition, regex, example, providers, crosswalk anchors |
| **Provider** | `idot:Resource ⊑ dcat:DataService` node in a record: `idot:urlPattern "…{$id}"`, media type, `dct:conformsTo` profile, `dct:type` → role concept |
| **Role concepts** | `/id/roles#landing-page`, `#metadata-record`, `#did-document`, `#the-resource` — `skos:Concept`s (with `skos:broader` to PROF canonical roles where one fits) stating what resolution *returns relative to the identified thing* (httpRange-14 made explicit per provider). Attached via `dct:type` (NOT `prof:hasRole`, whose domain is ResourceDescriptor). **PROF is lineage and grounding in this design — NO `prof:ResourceDescriptor`/`prof:Profile` machinery is built in the MVP.** The only operational PROF surface is `Link rel="profile"` document-kind hints (D86) |
| **Vocabulary cache** | `ontology/idot.ttl` + `ontology/datacite.ttl`, ground-now per D109 §5 / `ontology/README.md` provenance convention |

---

## 4. Architecture

### 4.1 Placement: `/id/` at server level, outside any storage root

`https://pod.vardeman.me/id/` is independent of `/vault` (or any future storage-root name).
Rationale: **datatype IRIs are write-once-forever *within a deployment*** — they are embedded
in literals across every application's content, and literals cannot be rewritten the way
documents can. The one place the Pod absolutely cannot afford identifier rot is its
identifiers for identifier schemes. The `/vault` segment is under active reconsideration;
minting datatype IRIs beneath it would be self-inflicted rot. (Scope of the permanence claim:
*per-deployment*. Scheme IRIs are deployment-local and parameterized like the storage root;
**cross-deployment** consistency comes from the `exactMatch` anchors, never from shared IRIs —
§2.6. Predicates such as the discovery edge or `overlay:registersScheme` do NOT need this
treatment: they live in rewritable documents and migrate mechanically if their namespace
moves. Only literal datatypes are unfixable after the fact.)

Records under `/id/` are nonetheless **ordinary Solid resources**: LDP container + RDF
Sources, WAC (public-read; **writes gated to the deployer-owner identity for the MVP** —
broader multi-agent registration policy is an authorization design that waits for the
D110/SAI work; do not scope the *model* down to single-owner, only the MVP gate), Memento
(per-record TimeMaps — time-travel to see what `doi` resolution looked like when an old
literal was written), `constrainedBy` validation. The CSS serving mechanics for a server-level space (own minimal storage vs.
static route + store wiring) are an **implementation-plan decision**, not a design question —
either satisfies this spec provided all listed behaviors (WAC/Memento/floor/conneg) hold.

### 4.2 Datatype IRIs are fragments on the catalog document

**Decision (revised during brainstorm — supersedes a per-record `#this` form):** the
scheme-as-datatype is `…/id/schemes/#<key>`, a fragment on the catalog document.

```
"10.1234/sdata.2018.29"^^<https://pod.vardeman.me/id/schemes/#doi>
```

Rationale, in order of force:

1. **The authoring grammar requires it.** The shipped wiki-memory literal axis
   (`shared/markdown-parsing/src/spanLiterals.ts`) is `[text]{.pred^^prefix:local}` — the
   datatype slot is a **CURIE**, and CURIE expansion is prefix-concatenation. With
   `ids: → …/id/schemes/#` in the Pod context, an agent writes
   `["10.1234/x"]{.identifier^^ids:doi}` — zero grammar change. A per-record `#this` form
   (`…/schemes/doi#this`) cannot be produced by any prefix mapping without ugly ceremony
   (`^^ids:doi#this`) or a grammar extension.
2. **XSD precedent.** Every standard datatype is a hash IRI into a namespace document
   (`xsd:string` = `…/XMLSchema#string`). This is the classical shape for datatypes.
3. **Cold-agent progressive disclosure.** Dereferencing *any* datatype yields the entire
   scheme index in one GET.

The frame discipline (document ≠ thing, D95/D96) survives at catalog granularity: Page = the
catalog document; Things = the `#doi`, `#orcid`, … fragments.

### 4.3 The three-identity separation (hash-URI mechanics)

| Identity | IRI | Retrievable? | Role |
|---|---|---|---|
| The scheme (abstract) | `…/id/schemes/#doi` | **No** — HTTP strips fragments | datatype in literals; subject of all semantic triples |
| The catalog/namespace doc | `…/id/schemes/` | Yes | thin index entries (server-derived), `ldp:contains`, `dcat:Catalog` |
| The scheme record doc | `…/id/schemes/doi` | Yes | rich description; `foaf:primaryTopic …#doi` |

The abstract/document separation is enforced by HTTP fragment semantics — no representation
can ever be "the thing at" a hash IRI (this is why hash, not 303). The *principle* is the
same one the Pod already practices via `<>`/`<#this>` (D95/D96), but the **granularity is
new**: many thing-fragments on one catalog document, and a record document describing a
subject whose home is a *different* document. **Implementation warning:** the existing
`subjectFrame.ts` / `resolveSubject()` machinery maps wiki-page predicates to `<>` vs
`<#this>` and does NOT apply to scheme records — record subjects are written as full
abstract IRIs, no frame resolution involved. Wiring predicates: catalog entry
`foaf:isPrimaryTopicOf <record>`; record `<> foaf:primaryTopic <…#key>`. **Every
scheme-describing triple in the record has the abstract hash IRI as its subject, written in
full** — the record is a document about a thing whose home is another document (same pattern
as `.meta` describing `<resource>#this`). Provider nodes are record-local fragments
(`<#doi-org>` → `…/schemes/doi#doi-org`) linked back via `dcat:servesDataset`. Each document announces its kind out-of-band via `Link rel="profile"`
(catalog-doc profile vs scheme-record profile, D86).

### 4.4 The derived catalog (server-managed; the sync seam eliminated)

The thin per-scheme entries in the catalog representation are **derived from member records**
— a DerivedView (D83 capability class), with `ldp:contains` as the exact precedent for
server-managed triples.

**The thin entry, normatively** (per scheme `<key>`, derived by copying typing + label from
the record's topic node):

```turtle
<#key> a idot:Namespace, skos:Concept, rdfs:Datatype ;
    skos:prefLabel  <copied from the record topic> ;
    skos:inScheme   <> ;
    rdfs:isDefinedBy <> ;
    foaf:isPrimaryTopicOf </id/schemes/key> .
```

Nothing else is copied — definition, regex, providers, anchors live only in the record. The
entries (plus the catalog's own `dcat:Catalog` + `skos:ConceptScheme` typing) appear in the
**served representation of `GET /id/schemes/`** — that is the contract, since it is what
dereferencing any datatype IRI returns; where CSS physically stores container body triples
(its internal container `.meta` file) is an implementation detail. The `pod_audit.py`
bijection check is defined against this triple set: every `<#key>` entry has a record whose
`foaf:primaryTopic` is `…/schemes/#key`, and vice versa. Consequences:

- **Registration = one write**: `PUT /id/schemes/<key>` (curl suffices). The catalog entry
  materializes server-side, **in-band on the write path** (D108 listener→backstop
  architecture: in-band primary) — a PUT followed immediately by a catalog GET sees the new
  scheme.
- Client PATCHes touching derived catalog triples are **rejected** (storage-description-405 /
  containment-triple precedent).
- No duplication exists, so no agreement can break. `pod_audit.py` checks
  (entry ↔ record `primaryTopic` bijection) are **defense-in-depth** (substrate bugs, admin
  hand-edits), not enforcement.

### 4.5 Discovery: two routes, both graph-native

1. **Catalog-first**: one edge in every storage description on the server →
   `/id/schemes/`, consistent with the D44/D48 router idiom. Predicate: standard-first check
   at implementation time per the D107 Bucket-1 discipline; expected landing is a `sub:` term
   alongside `sub:shapeCatalog` / `sub:affordanceCatalog`.
2. **Instance-first (self-describing literals)**: any typed literal an agent encounters IS
   the route in — the datatype IRI dereferences to the index. A cold agent needs no prior
   knowledge of the catalog's existence; the first typed identifier it meets teaches it.

---

## 5. Scheme-record anatomy (normative examples)

### 5.1 The reference record: `/id/schemes/doi`

```turtle
@prefix idot:     <http://identifiers.org/idot/> .      # confirm IRI when caching idot.ttl
@prefix dcat:     <http://www.w3.org/ns/dcat#> .
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix skos:     <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix foaf:     <http://xmlns.com/foaf/0.1/> .
@prefix datacite: <http://purl.org/spar/datacite/> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .

# ---- the Page (this document) ----
<> a foaf:Document ;
   dct:title "DOI identifier-scheme record" ;
   dct:created "2026-06-05"^^xsd:date ;
   dct:isPartOf </id/schemes/> ;
   foaf:primaryTopic </id/schemes/#doi> .

# ---- the Thing (the scheme) — subject is the ABSTRACT hash IRI, in full ----
</id/schemes/#doi>
    a idot:Namespace, skos:Concept, rdfs:Datatype ;
    skos:prefLabel "DOI"@en ;
    skos:definition "Digital Object Identifier — persistent identifier for scholarly objects, resolved via the Handle System."@en ;
    skos:inScheme </id/schemes/> ;
    skos:exactMatch datacite:doi ;                                  # global anchor
    rdfs:seeAlso <https://registry.identifiers.org/registry/doi> ;  # referenced, not copied
    idot:idRegexPattern "^10\\.\\d{4,9}[-._;()/:a-zA-Z0-9]+$" ;     # suggestive — Tier-2
    idot:exampleIdentifier "10.1038/sdata.2018.29" .

# ---- resolution providers: idot:Resource ⊑ dcat:DataService ----
<#doi-org> a idot:Resource ;
    dct:title "doi.org — landing page"@en ;
    idot:urlPattern "https://doi.org/{$id}" ;
    dcat:servesDataset </id/schemes/#doi> ;
    dcat:mediaType <https://www.iana.org/assignments/media-types/text/html> ;
    dct:type </id/roles#landing-page> .

<#doi-org-conneg> a idot:Resource ;
    dct:title "doi.org — DataCite metadata via content negotiation"@en ;
    idot:urlPattern "https://doi.org/{$id}" ;
    dcat:servesDataset </id/schemes/#doi> ;
    dcat:mediaType <https://www.iana.org/assignments/media-types/application/vnd.datacite.datacite+json> ;
    dct:conformsTo <https://schema.datacite.org/> ;
    dct:type </id/roles#metadata-record> .
```

### 5.2 The hard cases (seed set proves the model)

- **`did-oyd`** (non-web-native): `skos:broader </id/schemes/#did>` (method under the `did`
  scheme); `dct:conformsTo <https://ownyourdata.github.io/oydid/>`; multibase regex;
  `skos:note` stating *content-addressed; resolution requires an OYDID resolver or known
  storage; not guaranteed publicly resolvable*. One provider via the Universal Resolver
  pattern (`…/1.0/identifiers/{$id}` → `application/did+ld+json`, conformsTo DID Core,
  `dct:type </id/roles#did-document>`). **Non-resolvability is representable, not an error.**
- **`citekey`** (local, informal-adjacent): regex + zero external providers; the provider is
  *the Pod's own wiki-search affordance* (D87 `?ext=search-grep`) — a citekey resolves by
  querying the memory pod itself. Local/internal schemes (the pharma case) are first-class.
- **`solid-resource`** (the Pod's own scheme): provider = the Pod; `dct:type
  </id/roles#the-resource>` — the one scheme where resolution returns the thing itself with
  full LDP/Memento affordances. Documents the informal regime; never an operational
  dependency of it (HTTP enforces what this record merely describes).

**Seed set (MVP, ~8):** `doi`, `orcid`, `ror`, `arxiv`, `citekey`, `did` (+ `did-oyd` as the
worked method record), `solid-resource`. Nothing else until a consumer demands it.

### 5.3 Crosswalks

- **Scheme-level**: `skos:exactMatch` → DataCite individuals; `rdfs:seeAlso` →
  identifiers.org entries (per locked call ii).
- **Instance-level**: co-resident typed literals on one `<#this>` — a published dataset
  carries its Pod URL (the IRI itself), its DOI, its citekey. Inbound traversal: the DOI's
  registered resolution target is the Pod URL (that is what DataCite registration *is*);
  resolving lands on the resource whose `.meta` exposes every other identifier. Outbound:
  literal → datatype → record → provider.
- **Derived projection**: `schema:PropertyValue` (`propertyID` = the scheme IRI, `value` =
  lexical form) per the documented JRC DCAT-AP→schema.org crosswalk (notation's datatype →
  `propertyID`), consumed by Google Dataset Search. **The rule is normative in this spec;
  materialization is deferred to the sub-C curation loop.**

---

## 6. Application integration and authoring

### 6.1 Overlay registration (one manifest predicate)

```turtle
<#manifest> overlay:registersScheme </id/schemes/doi>, </id/schemes/citekey>, </id/schemes/orcid> .
```

`apply.py` grows one deploy block: ensure each referenced record exists. **Semantics:**
"present" = HTTP 200 at the record URL. Absent → install the overlay's bundled record.
Present → no-op; if the bundled record's graph differs from the installed one, **log the
difference and do not overwrite** — conflicts surface to the curation loop, never silently
resolve (accretive, like capabilities).
Day-one consumers: wiki-memory, AddressBook. A new application minting a novel scheme bundles
a record conforming to `SchemeRecordShape` — open-world by the same contract logic as D100
class extension. When D110 re-bases app declarations on `interop:`, only the manifest syntax
moves; records do not change.

### 6.2 Authoring affordances (how agents emit typed literals)

- **Body span (primary — grammar shipped, plumbing is NOT):** `["10.1234/x"]{.identifier^^ids:doi}`
  — the RQ-Grammar-1 literal axis. **Honest state of the code:** the *grammar* exists
  (`shared/markdown-parsing/src/spanLiterals.ts` parses `^^prefix:local`), but the projector's
  `datatypeIRI()` (`markdown-projection/src/spanLiteralProjection.ts:8-13`) hardcodes `xsd:`
  and throws on any other prefix — there is **no context-registry loader today**; the in-code
  comment is a TODO, not infrastructure. Implementation must BUILD it: a prefix→IRI binding
  **injected via Components.js config at construction** (sync, like
  `DEFAULT_LITERAL_BINDING`; config-driven per the cleanup-sprint config-guard lesson), with
  the served `/meta/context.jsonld` gaining the matching `ids:` entry
  (`→ https://pod.vardeman.me/id/schemes/#`) and an **agreement test** between config binding
  and served context (the exact guard the fragility-audit residue calls for).
- **Frontmatter (secondary):** compact-identifier convention, `identifier: doi:10.1234/x` —
  identifiers.org's own form, which agents speak natively from training. Normative binding:
  predicate `dct:identifier`, subject frame `<#this>` (per the cleanup-sprint
  dct:identifier-on-`<#this>` decision), scalar and list values both supported. The projector
  splits each value on the first colon and resolves the prefix against **registered** schemes.
  Unknown prefix → project the whole string as a plain literal; Tier-2 curation flags it.
  **Never a floor reject** (suggestive typing).
- **RDF-body substrates** (contacts, catalog records): direct Turtle — no special handling.
- **Provenance amendment:** `docs/decisions/typed-wikilink-syntax-provenance.md` must be
  amended to record that the `^^datatype` / `@lang` span-literal extensions are wiki-memory's
  own deviation — the Sparna semantic-markdown draft (the grammar's closest ancestor) has
  **no datatype syntax at all** (verified against the draft 2026-06-05).

### 6.3 The agentic harness story

The task is almost never "do identifier work" — it is embedded in "write a literature note,"
"add a contact," "publish this dataset." Identifier knowledge must be **encounterable in-band
at the moment of need**, never preloaded:

| Embedded task | Agent's route | What teaches it |
|---|---|---|
| Annotate | body span / frontmatter convention | `tmpl:` slot + 422 if the shape demands presence |
| Resolve | datatype IRI → index → record → pick provider by role/media-type | the record itself |
| Crosswalk | SPARQL `FILTER(DATATYPE(?id) = <scheme-IRI>)` | affordance descriptor quoting the query (D52) |
| Register | PUT against SchemeRecordShape | exemplar records + `sh:agentInstruction` + 422 loop |
| Curate | read `idot:idRegexPattern`, propose `mem:RealignAction` | sub-C loop, pod-curator pattern |

Generate/constrain pair, single-sourced: **generate** = `tmpl:` scheme-record template +
`sh:agentInstruction` on the shape + the seed records as worked exemplars (template ↔ shape
ship with an agreement test, per the fragility lesson); **constrain** = floor 422 +
ValidationReport. Per the structure-before-teaching reorder, the 422 loop IS the runtime
teacher; the `solid-agent-skills` skill stays a D103 minimal bootstrapper pointing at on-Pod
descriptors. Subagent fit comes from addressability: everything needed is one small URL away
(*the* record, not the catalog), so identifier handling costs a parent agent ~one GET, and
heavy flows (bulk curation, registration) fork as `context:fork` subagent-skills.

---

## 7. Enforcement (curl-grade) and validation

### 7.1 The floor table

| Write | Verdict | Why |
|---|---|---|
| `wiki:Source` without `dct:identifier` | **422** | judgment metadata, shape-declared (existing SourceShape) |
| Identifier literal failing the scheme regex | passes | suggestive typing — Tier-2 curation |
| Identifier with unregistered datatype | passes | open-world; curation flags |
| Scheme record not conforming to SchemeRecordShape | **422** + report | the registration contract |
| PATCH touching derived catalog entries | rejected | server-managed (`ldp:contains` precedent) |
| Resource in a no-identifier app, no identifier | passes | informal regime — no ambient obligation |

### 7.2 SchemeRecordShape (essentials)

Record document: `foaf:primaryTopic` → exactly one hash IRI in the catalog namespace.
The topic node: triple-typing (`idot:Namespace`, `skos:Concept`, `rdfs:Datatype`),
`skos:prefLabel`, `skos:definition`, `idot:idRegexPattern`, `idot:exampleIdentifier` all
required (a scheme without syntax and a worked example is unusable by agents). Providers
optional (non-resolvable schemes are legal). `skos:exactMatch` / `dct:conformsTo`
recommended-not-required. `sh:agentInstruction` carries the registration how-to. The
"topic is a hash IRI in the catalog namespace" constraint is expressed as `sh:pattern` on
the `foaf:primaryTopic` IRI string (parameterized with the deployment base at deploy time).

**Scope of the reuse claim, precisely:** *shape validation* reuses the existing upstream
RDF-body validator path — no new validation machinery. But the derived-catalog hook, the
derived-triple PATCH rejection, and the `/id/` serving wiring (§4.1, §4.4) ARE new server
work — see §9 items 2–3. Do not read this paragraph as "the `/id/` space is config-only."

The raw-HTTP agent's full loop (the guarantees are defined on this tier, per D55):

```
HEAD /id/schemes/          → Link: constrainedBy=SchemeRecordShape; rel="profile" hints
GET  /id/schemes/doi       → worked exemplar
PUT  /id/schemes/acme-id   → 422 + ValidationReport (correct, retry) → 201
GET  /id/schemes/          → derived catalog now shows <#acme-id>
```

### 7.3 Library verification (2026-06-05 — empirical, all green)

Custom datatype IRIs were verified against every engine in the stack before this decision:

| Engine | Load-bearing where | Result |
|---|---|---|
| rdflib (Python) | importer, audit, tests | Turtle + JSON-LD round-trip; SPARQL `DATATYPE()`/`FILTER`; term equality distinct across schemes; unknown datatype opaque, no error |
| pyshacl | shape dev, `make audit` | `sh:datatype <custom>` exact-IRI match (rejects `xsd:string`); `sh:pattern` operates on lexical form |
| N3.js 1.26 | CSS ingest (Turtle + N3 Patch), CLI | parse/write round-trip; term equality |
| Comunica (`query-sparql-link-traversal` — the CLI's engine) | client SPARQL | `DATATYPE()` + `FILTER`; negative control 0 rows |
| rdf-validate-shacl | the floor / shape-validator (production) | conformant passes; wrong-datatype and bad-pattern rejected |

Known limits (acceptable by design): no engine validates lexical forms *against* a custom
datatype (SHACL ill-formedness applies only to recognized datatypes — which is exactly the
suggestive-typing call); value-space operations (numeric compare, meaningful ORDER BY) are
unavailable on unknown datatypes — identifiers only ever need term-level operations.

### 7.4 The cold-agent validation experiment (Rung-1.5-class)

Two probes, trajectory-scored against the D102 three-axis frame:

1. **Resolve**: cold agent + one typed literal in a `.meta` graph → does it dereference the
   datatype, read the index/record, pick the right provider for the requested representation,
   and resolve — with zero preloaded context?
2. **Register**: cold agent + curl only → does it discover the contract from headers +
   exemplar, and produce a conformant new scheme record via the 422 loop?

Probe 2 *demonstrates* the enforcement story rather than asserting it.

---

## 8. Out of scope (explicit)

- Resolver/proxy runtime services; DID resolution runtime (records describe; they don't proxy)
- `schema:PropertyValue` materialization (rule normative in §5.3; sub-C implements)
- RO-Crate / Croissant profile records (the model accommodates them; no seeds until a
  data-pod/ML application consumes them)
- The `/vault` → Pod-structure rename (separate decision; this design is rename-proof and
  does not block on it)
- Authorization-Agent / SAI grant-flow machinery (D110 territory, deferred)
- Hand-written skill investment beyond the D103 minimal bootstrapper (teaching agenda
  deferred per the structure-before-teaching reorder)

## 9. Implementation sketch (for the plan, not normative)

1. Ground `ontology/idot.ttl` + `ontology/datacite.ttl` (provenance headers per
   `ontology/README.md`). **BLOCKING sub-step: confirm the actual `idot:` namespace IRI from
   the fetched vocabulary BEFORE authoring any artifact that uses `idot:` terms** — the
   `http://identifiers.org/idot/` IRI used in this spec's examples is unconfirmed, and these
   terms land in write-once territory.
2. CSS serving decision for `/id/` (own minimal storage vs static route + store wiring) —
   must preserve WAC, Memento, conneg, `constrainedBy`.
3. `/id/schemes/` container + `SchemeRecordShape` + `constrainedBy` wiring + the derived
   catalog hook (in-band; DerivedView pattern) + derived-triple write rejection.
4. Seed records (§5.2 list) + `/id/roles` concepts + `tmpl:` scheme-record template
   (+ template↔shape agreement test).
5. `context.jsonld`: `ids:` prefix; projector `datatypeIRI()` extension (context-driven).
6. Frontmatter compact-id projection rule (registered-prefix split; unknown → plain literal).
7. `overlay:registersScheme` manifest predicate + `apply.py` deploy block; wiki-memory and
   AddressBook manifests updated.
8. Storage-description discovery edge (standard-predicate-first check; likely `sub:` term).
9. `pod_audit.py` defense-in-depth checks (entry↔record bijection; pointer HEAD-checks).
10. Tests: TS guards (grammar/projection/derivation), pytest conformance (Pod-up gated),
    floor e2e incl. raw-curl registration path.
11. Amend `typed-wikilink-syntax-provenance.md` (the `^^`/`@lang` Sparna deviation).
12. Register D111 in `decisions.md` + the vault decisions log.
13. Cold-agent probes (§7.4) after deploy.

## 10. Implementer hazard notes (from the 2026-06-05 cold-reader probe)

A fresh agent was run over this spec before acceptance; these are the misreadings it judged
most likely. Check yourself against each before writing code:

1. **Datatype IRI form.** It is `…/id/schemes/#doi` (fragment on the CATALOG), never
   `…/id/schemes/doi#this` and never the bare record URL. The Pod's pervasive `<#this>` idiom
   points the wrong way here — §4.2 supersedes a per-record `#this` form deliberately (the
   CURIE grammar requires prefix-concatenation).
2. **The regex is never a floor constraint.** Do not add `sh:pattern`-against-instance-
   literals to any shape, and do not re-pin `sh:datatype xsd:string` on `dct:identifier`
   (SourceShape was loosened deliberately). Regex lives in the record as data; Tier-2 reads it.
3. **`/id/` is not under `/vault/`.** Do not scaffold `/vault/id/…` and do not mint scheme
   IRIs under `/vault/ontology/…`. The gravitational pull of the existing layout is exactly
   the rot §4.1 exists to prevent.
4. **The catalog is never hand-maintained.** Thin entries are server-derived (§4.4 gives the
   normative triple set). Do not add entries on PUT by hand; do not let clients PATCH them.
5. **Record subjects are full abstract IRIs.** Scheme-describing triples use
   `</id/schemes/#key>` as subject — not `<>`, and not via `resolveSubject()` (which is
   wiki-page machinery; see §4.3 warning).
6. **No PROF machinery.** Roles attach via `dct:type` → `/id/roles#…` concepts. Do not build
   `prof:ResourceDescriptor`/`prof:Profile` artifacts; PROF appears operationally only as
   `Link rel="profile"` hints.
7. **Confirm the `idot:` namespace IRI before use** (§9.1 blocking sub-step).
8. **The context-registry plumbing does not exist yet.** `datatypeIRI()` is hardcoded `xsd:`
   today; §6.2 specifies what to build (config-injected binding + served-context agreement
   test). Do not assume a loader is present.
