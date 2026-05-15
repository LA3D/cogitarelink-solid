# AKBP-to-W3C Vocabulary Mapping

**Surfaced**: 2026-05-15 evening (primary-source audit of wiki-memory L3 spec)
**Status**: Reference document — **structural translation table is correct**; behavioral claims about agent reliability with W3C vs `wiki:*` vocab are **hypothesis pending Rung 1.5 eval** (H-D82.c)
**Relates to**: H-D82 (hypothesis), D71, D77, D78, D79; [[Affordance Spectrum for Agentic Memory]] in vault; `2026-05-15-rung-1-5-eval-matrix.md`

---

## Status: what's evidence-bearing in this document and what isn't

**Structurally correct (no eval needed)**: the mapping table itself. AKBP's `claims.jsonl`/`entities.jsonl`/`relations.jsonl` constructs each have direct W3C equivalents in PROV-O, SKOS, DCT, CITO, FOAF, and schema.org. Anyone can verify this by reading the AKBP JSON Schemas alongside the W3C vocabulary specs.

**Behavioral hypothesis (eval required)**: the claim that *agents perform better authoring claims with W3C standard vocabulary than with `wiki:*` aliases* (or vice versa). This is H-D82.c in `decisions-index.md` Phase 5h. The W3C path has the structural advantage of composability with the broader linked-data ecosystem; the `wiki:*` path has the practical advantage of shorter, more memorable prefixes and a single-vocabulary context. Neither has been measured for LLM authoring reliability.

**Recommendation**: treat this document as a **reference translation table** that's safe to consult, but **do not commit to vocabulary substitutions in `/meta/context.jsonld` until Rung 1.5 eval supports H-D82.c**.

---

## Purpose

AKBP ([rohitg00/akbp](https://github.com/rohitg00/akbp)) is a JSON-Schema-defined protocol for portable agent knowledge bases. The 2026-05-15 audit (`gh api repos/rohitg00/akbp/contents/schemas`) revealed that AKBP's custom JSONL schemas **all have direct W3C correspondences**. Their 12-predicate relation enum, 15-entity-type enum, 7-state claim lifecycle, evidence array, audit log, and knowledge-base card are *poorly-typed semantic web* — they reinvent what DC/SKOS/CITO/PROV/schema.org already standardize.

This document records the precise mapping. It is a **reference for vocabulary substitution decisions** that may be made if Rung 1.5 eval supports H-D82.c.

---

## Schema-level mappings

### Claim (AKBP `claims.jsonl`)

**AKBP shape** (from `schemas/claim.schema.json`):

```json
{
  "id": "claim_obsidian_needs_memory_contract",
  "text": "Obsidian remains the human-readable vault while AKBP provides...",
  "type": "decision",
  "status": "stable",
  "confidence": 0.86,
  "evidence": ["raw/sources/obsidian-memory-note.md"],
  "entities": ["obsidian-vault", "agent-memory"],
  "supersedes": [],
  "superseded_by": null,
  "scope": "project",
  "created_at": "...",
  "updated_at": "..."
}
```

**W3C equivalent** (Turtle, expanded):

```turtle
@prefix prov:  <http://www.w3.org/ns/prov#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix cred:  <https://www.w3.org/ns/credentials#> .
@prefix wiki:  <urn:example:wiki#> .
@prefix lc:    <urn:example:wiki/lifecycle#> .

<claim_obsidian_needs_memory_contract>
    a prov:Statement, wiki:Decision ;
    rdf:value "Obsidian remains the human-readable vault while AKBP provides..." ;
    wiki:status lc:Stable ;          # SKOS concept in the lifecycle scheme
    cred:credibility 0.86 ;          # or wiki:confidence
    prov:wasDerivedFrom <raw/sources/obsidian-memory-note.md> ;
    dct:subject <obsidian-vault>, <agent-memory> ;
    dct:replaces ()  ;               # AKBP supersedes
    dct:isReplacedBy ()  ;           # AKBP superseded_by — null in this case omitted
    dct:audience wiki:Project ;       # AKBP scope
    dct:created "..."^^xsd:dateTime ;
    dct:modified "..."^^xsd:dateTime .
```

**Field-by-field**:

| AKBP field | W3C predicate | Notes |
|---|---|---|
| `id` | resource URI (subject) | |
| `text` | `rdf:value` or `dct:description` | |
| `type` enum | `rdf:type` to subclass of `prov:Statement` | `fact`/`decision`/`preference`/`workflow`/`observation`/`question`/`warning` map to subclasses |
| `status` enum | `dct:status` or custom predicate to SKOS concept scheme | `working`/`actionable`/`stable`/`contested`/`superseded`/`archived`/`redacted` — SKOS concept scheme is the standard pattern |
| `confidence` (0–1) | `cred:credibility` (W3C Credentials CG) or mint `wiki:confidence` | No single W3C predicate is universally adopted; cred:credibility is the closest standard |
| `evidence[]` | `prov:wasDerivedFrom` (multiple) | Each evidence pointer is a source URI |
| `entities[]` | `dct:subject` (multiple) | What the claim is about |
| `supersedes[]` | `dct:replaces` (multiple) | DC-Terms predicate, exact semantic |
| `superseded_by` | `dct:isReplacedBy` | DC-Terms predicate, exact semantic |
| `scope` enum | `dct:audience` to a SKOS concept | `private`/`project`/`team`/`public` |
| `created_at` / `updated_at` | `dct:created` / `dct:modified` | DC-Terms timestamps |

---

### Entity (AKBP `entities.jsonl`)

**AKBP shape**:

```json
{
  "id": "obsidian-vault",
  "name": "Obsidian vault",
  "type": "tool",
  "aliases": [],
  "description": "",
  "page": "wiki/entities/obsidian-vault.md"
}
```

**W3C equivalent**:

```turtle
<obsidian-vault>
    a schema:SoftwareApplication ;   # AKBP "tool" → schema:SoftwareApplication
    rdfs:label "Obsidian vault" ;
    skos:altLabel "" ;                # aliases
    dct:description "" ;
    foaf:page <wiki/entities/obsidian-vault.md> .
```

**Type enum mappings** (AKBP entity type → W3C class):

| AKBP type | W3C class |
|---|---|
| `person` | `foaf:Person`, `schema:Person` |
| `project` | `schema:Project`, `doap:Project` |
| `repo` | `schema:SoftwareSourceCode`, `doap:Repository` |
| `company` | `schema:Organization`, `foaf:Organization` |
| `concept` | `skos:Concept` |
| `decision` | `prov:Statement` subclass (e.g., `wiki:Decision`) |
| `workflow` | `schema:HowTo`, `p-plan:Plan` |
| `file` | `schema:DigitalDocument`, `nfo:FileDataObject` |
| `api` | `schema:WebAPI`, `hydra:ApiDocumentation` |
| `incident` | `schema:Event` subclass |
| `source` | `dct:BibliographicResource`, `prov:Entity` |
| `agent` | `prov:Agent`, `foaf:Agent` |
| `tool` | `schema:SoftwareApplication`, `doap:Project` |
| `team` | `foaf:Group`, `schema:Organization` |
| `system` | `schema:SoftwareApplication` or `prov:Entity` |

The mappings are mostly trivial. The 15 enum entries are reinventions of the FOAF/schema.org/SKOS/PROV-O class hierarchies.

---

### Relation (AKBP `graph/relations.jsonl`)

**AKBP shape**:

```json
{
  "id": "rel_001",
  "source": "obsidian-vault",
  "relation": "uses",
  "target": "agent-memory",
  "confidence": 0.9,
  "evidence": ["..."]
}
```

**W3C equivalent** — a Turtle triple, plus optional reification or RDF-star for confidence/evidence:

```turtle
<obsidian-vault> wiki:uses <agent-memory> .

# Optional RDF-star annotation for confidence + evidence
<< <obsidian-vault> wiki:uses <agent-memory> >>
    cred:credibility 0.9 ;
    prov:wasDerivedFrom <evidence-source-uri> .
```

**Relation enum mappings** (AKBP `relation` enum → W3C predicate):

| AKBP predicate | W3C equivalent | Source vocabulary |
|---|---|---|
| `uses` | `dct:requires`, `schema:utilizesResource` | DC-Terms / schema.org |
| `depends_on` | `dct:requires`, `cito:usesAsRecommendedReading` | DC-Terms / CiTO |
| `contradicts` | `cito:disagreesWith`, `prov:wasInvalidatedBy` | CiTO / PROV-O |
| `supersedes` | `dct:replaces`, `prov:wasRevisionOf` | DC-Terms / PROV-O |
| `supports` | `cito:agreesWith`, `cito:citesAsEvidence` | CiTO |
| `caused_by` | `prov:wasInfluencedBy`, `schema:cause` | PROV-O / schema.org |
| `owned_by` | `dct:rightsHolder`, `schema:owns` | DC-Terms / schema.org |
| `derived_from` | `prov:wasDerivedFrom`, `dct:source` | PROV-O / DC-Terms |
| `similar_to` | `skos:related`, `skos:relatedMatch` | SKOS |
| `blocks` | `prov:hadActivity` (with role) | PROV-O (no direct match; needs reification) |
| `implements` | `schema:about`, custom predicate | schema.org / mint |
| `references` | `dct:references`, `cito:cites` | DC-Terms / CiTO |

**All 12 of AKBP's relation types have W3C equivalents.** None required novel invention. The cleanest mappings come from CiTO (Citation Typing Ontology) which already has the citation-semantics predicates (`agreesWith`, `disagreesWith`, `citesAsEvidence`, etc.) AKBP was groping toward.

---

### Evidence (AKBP `evidence` references)

**AKBP shape**:

```json
{
  "id": "ev_001",
  "source_id": "src_001",
  "source_type": "file",
  "locator": "raw/sources/note.md",
  "quote": "...",
  "hash": "sha256:...",
  "created_at": "..."
}
```

**W3C equivalent**:

```turtle
<ev_001>
    a prov:Quotation, prov:Entity ;
    prov:hadPrimarySource <src_001> ;
    prov:wasQuotedFrom <src_001> ;
    dct:format "text/markdown" ;
    prov:atLocation <raw/sources/note.md> ;
    rdf:value "..." ;
    spdx:checksum [ spdx:algorithm "SHA-256" ; spdx:value "..." ] ;
    dct:created "..."^^xsd:dateTime .
```

**Note**: `prov:Quotation` + `prov:wasQuotedFrom` is the W3C primitive that solves the **context fencing / recursive memory pollution** failure mode Supermemory identified. AKBP's `evidence` is structurally a `prov:Quotation`. The W3C convention is in place; nobody has adopted it yet.

---

### Audit log (AKBP `.akbp/audit.log.jsonl`)

**AKBP shape**:

```json
{
  "id": "evt_001",
  "event": "remember",
  "actor": "agent://...",
  "created_at": "...",
  "object_ids": ["claim_001"],
  "dry_run": false,
  "reversible": true,
  "data": {...}
}
```

**W3C equivalent** — this is **literally PROV-O**:

```turtle
<evt_001>
    a prov:Activity ;
    rdfs:label "remember" ;
    prov:wasAssociatedWith <agent://...> ;
    prov:startedAtTime "..."^^xsd:dateTime ;
    prov:used <claim_001> ;
    prov:generated <claim_001> .
    # dry_run, reversible — custom predicates if needed
```

**PROV-O is exactly what AKBP's audit log is reinventing.** AKBP-as-PROV-O is the closest one-to-one mapping in the audit; every field has a direct PROV-O equivalent.

---

### Knowledge-base card (AKBP `akbp.json`)

**AKBP shape**:

```json
{
  "schema_version": "0.1-draft",
  "name": "obsidian-vault-example",
  "description": "...",
  "root": ".",
  "artifacts": {
    "wiki": "wiki/",
    "claims": "claims/claims.jsonl",
    "entities": "graph/entities.jsonl",
    "relations": "graph/relations.jsonl",
    "sources": "raw/sources/",
    "audit": ".akbp/audit.log.jsonl"
  },
  "capabilities": {...},
  "retrieval": ["keyword"],
  "transports": ["cli", "jsonl-stdio"],
  "privacy": {...}
}
```

**W3C equivalent** — this is a **storage description resource** per Solid Protocol §4.1, with optional VoID/DCAT vocabulary:

```turtle
<#card>
    a solid:Storage, void:Dataset ;
    dct:title "obsidian-vault-example" ;
    dct:description "..." ;
    solid:storageLocation <./> ;
    rdfs:seeAlso <wiki/>, <claims/>, <graph/>, <raw/sources/>, <.akbp/audit.log.jsonl> ;
    dcat:distribution [
        dcat:mediaType "text/markdown" ;
        dcat:accessURL <wiki/>
    ] ;
    void:vocabulary <http://purl.org/dc/terms/>, <http://www.w3.org/ns/prov#>, ... ;
    solid:capability solid:Read, solid:Write, solid:Append .
```

This is what D44 (storage description as router) already specifies for the cogitarelink-solid Pod.

---

## Reusable patterns from AKBP (worth adopting)

Not everything in AKBP is reinvention. The *spec* — what to record, even if the format is sub-optimal — encodes good ideas:

| AKBP idea | Worth adopting | How |
|---|---|---|
| **Claim as atomic unit** with evidence + confidence + lifecycle | Yes | `prov:Statement` with `cred:credibility` + `prov:wasDerivedFrom` + SKOS lifecycle |
| **Evidence pointers required** on durable claims | Yes | SHACL shape requires `prov:wasDerivedFrom` for `wiki:DurableClaim` |
| **7-state lifecycle** (working/actionable/stable/contested/superseded/archived/redacted) | Possibly | SKOS concept scheme; map to D77 `wiki:WorkingMemoryShape` lifecycle |
| **Two-stage commit** `remember` → `crystallize` | Already adopted | D73 `mem:Crystallize` |
| **Audit log of operations** | Yes | PROV-O activities; emit via D74 LDN inbox |
| **Knowledge-base card** declaring capabilities | Already adopted | D44 storage description |
| **5 compliance levels** as substrate maturity | Yes | Map onto current decisions: L0=plain markdown Pod, L1=+SHACL, L2=+Memento, L3=+LDN trigger vocab, L4=+ACP, L5=+federation |
| **Export/import as portability** | Yes | LDP container as zip / Memento timemap export |
| **Privacy scope on every claim** (private/project/team/public) | Yes | ACP — already in the architecture; add `dct:audience` predicate on claims for explicit declaration |
| **`source_type` enum** for evidence | Yes — but use schema.org / PROV vocabulary | `schema:DigitalDocument`/`schema:VideoObject`/etc. instead of AKBP's enum |

---

## What AKBP got architecturally wrong

For completeness — the things to *not* import:

1. **Custom JSONL transport** instead of RDF/JSON-LD. JSONL is fine for sequential append, but Turtle is better for SPARQL queryability and JSON-LD is better for agent reading. AKBP picked JSONL because it felt cheaper; for an agent that already understands RDF (Claude does), JSON-LD is *cheaper*.

2. **Closed enum for relation type**. The 12-predicate enum forces every edge into one of those 12 buckets even when CITO/PROV/schema.org has a more precise predicate. The enum prevents extension. W3C predicates are open and composable.

3. **Body markdown deliberately unconnected to graph**. AKBP's body markdown has no typed wikilinks; all typed edges live in `relations.jsonl`. This forecloses the level-2 affordance (cheap navigation hints in body) and forces the agent to always use the structured API. The cogitarelink-solid choice (body→`.meta` projection via D58) is the higher-value architectural commitment.

4. **No SHACL**. AKBP validates via JSON Schema, which lacks the cross-resource constraints SHACL provides. SHACL shapes (per D77/D78) are strictly more expressive than JSON Schema for graph-shaped data.

5. **No Memento / standardized versioning**. AKBP uses git for versioning, which works but doesn't expose time-travel queries via standard URIs. The cogitarelink-solid Memento implementation (D61–D68) gives RFC 7089 time-gates and time-maps that AKBP can't replicate without inventing its own URI scheme.

6. **No LDN / Notifications Protocol**. AKBP has no trigger vocabulary for substrate-to-agent signaling. The D74 `mem:*` AS2 extension on LDN inbox + Notifications Protocol fills this gap with standardized transport.

---

## Implications for H-D82 (hypothesis, eval pending)

H-D82.c hypothesizes that W3C vocabulary reuse is no worse for agent reliability than minted `wiki:*` aliases. **If supported by Rung 1.5 eval**, the substitutions below would land in `/meta/context.jsonld`. **If refuted**, the existing `wiki:*` mints (D77/D78/D79) stay.

Candidate substitutions (pending eval):

- `wiki:confidence` → `cred:credibility` (W3C Credentials CG vocabulary). *Risk*: cred:credibility may be too domain-specific; might need to mint `wiki:confidence` with documented reason. **Untested.**
- `wiki:supersedes` → `dct:isReplacedBy` (DC-Terms, ratified). Direct semantic match. **Behavioral question untested.**
- `wiki:contradicts` → `cito:disagreesWith` or `prov:wasInvalidatedBy`. CiTO for citation-shaped claims, PROV-O for activity-shaped invalidations. **Untested whether agents pick the right one consistently.**
- `wiki:WorkingMemory` lifecycle status enum → SKOS concept scheme over `dct:status`. **Untested.**
- `wiki:Concept` / `wiki:Source` / `wiki:Person` / `wiki:Procedure` — keep these as wiki-memory-specific subclasses regardless of eval outcome (they identify the L3 profile; no W3C equivalent).
- `wiki:maturity` (draft/validated/core, ported from ByteRover) — likely mint since AKBP/W3C don't have an exact equivalent; SKOS concept scheme over `dct:status` is the standard pattern.

**Hypothesized reduction**: if H-D82.c holds, ~40% of the `wiki:*` predicate space planned in D77/D78 becomes unnecessary. **This claim is untested.** Conservative move: keep all `wiki:*` mints until eval data justifies dropping them.

---

## What we genuinely know from this audit (no eval needed)

These claims survive without measurement because they're structural/factual:

1. **AKBP's schemas have direct W3C equivalents.** Verifiable by reading the JSON Schemas alongside the W3C vocab specs. AKBP is a JSONL-flavored restatement of the W3C stack.
2. **AKBP is unmeasured.** Their repo has no published benchmarks. Their commercial / protocol bet is design-level, not result-level.
3. **The 12-predicate relation enum is a closed subset of what DC/SKOS/CITO/PROV/schema.org offer.** AKBP couldn't extend their vocabulary without forking the spec; standard W3C vocab is open.
4. **AKBP's body markdown is plain prose.** Their architecture is parallel surfaces, not body-projection. (This is a structural design difference, not a measurement.)
5. **`prov:Quotation` exists.** Supermemory's "context fencing" failure mode has a W3C primitive for marking recalled-vs-asserted content; nobody has adopted the convention. This is a real gap in the agent-memory ecosystem.

**What we don't know without measurement**:
- Whether agents author W3C JSON-LD as reliably as they author AKBP JSONL
- Whether SPARQL queries against W3C-vocab `.meta` outperform agent queries against AKBP JSONL
- Whether the composability claim ("W3C is composable across systems") translates to actual cross-system agent task improvements
- Whether vocabulary length / mnemonic factors matter for LLM authoring reliability

---

## References

- AKBP repo: <https://github.com/rohitg00/akbp>
- AKBP SPEC.md: <https://github.com/rohitg00/akbp/blob/main/SPEC.md>
- AKBP schemas: <https://github.com/rohitg00/akbp/tree/main/schemas>
- W3C Credentials CG: <https://www.w3.org/community/credentials/>
- DC-Terms: <http://purl.org/dc/terms/>
- PROV-O: <http://www.w3.org/ns/prov#>
- CiTO (Citation Typing Ontology): <http://purl.org/spar/cito/>
- SKOS: <http://www.w3.org/2004/02/skos/core#>
- FOAF: <http://xmlns.com/foaf/0.1/>
- schema.org: <https://schema.org/>
- Solid Protocol §4.1 (Storage Description): <https://solidproject.org/TR/protocol>
- [[Affordance Spectrum for Agentic Memory]] — vault concept note (foundational framing)
- [[Memory Substrate vs Memory Profile]] — vault concept note (L1/L2/L3 stratification)
- [[Wiki-Memory L3 Profile]] — vault concept note (canonical L3 we're building)
