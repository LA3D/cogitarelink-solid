# RQ-Grammar-1: the Markdown Write-View into the Substrate Graph (sub-project A)

**Date:** 2026-06-02. **Status:** Design (brainstormed, pending implementation plan).
**Parent:** D109 sub-project A. **Builds on:** the interop foundation
(`2026-06-02-interop-foundation-design.md`) — that layer is the source of truth for this grammar's
*vocabulary boundary*. **Frames:** RQ-Enforce-1 (in-band projection, handed to sub-project B).
**Provenance/lineage:** `docs/decisions/typed-wikilink-syntax-provenance.md` (D36, Sparna).

## 1. Problem (the expressivity gap)

A cold agent **cannot author a conformant concept inline.** The inline grammar (D36,
`[[Target]]{.class}`) is **edge-only**: it expresses a single predicate with a *resource* object,
and it repurposed Sparna's leading-`.` (which means *type*) to mean *edge predicate*. It has **no
literal axis** (so `skos:prefLabel`/`altLabel`/`definition`/`dct:identifier` — literals on `<#this>`
— are unexpressible) and **no subject switch**. The frontmatter allowlist never grew to cover the
shapes. RQ-View-2 (2026-06-01) confirmed it: agents found `prefLabel` required, found no inline way
to supply it, and were forced to PATCH `.meta` — violating the substrate's own no-PATCH rule. This
is an **expressivity gap upstream of the D108 enforcement gap**: "derive prefLabel for them" would
paper over a missing grammar axis.

**Framing locked (D109 §6, not re-litigated):** the grammar must **round-trip the full governed
graph** (type + literal-properties + resource-edges) into `.meta`. RDFa-in-HTML is **out of scope**
(it mattered only as proof that an annotation-on-markup model can be RDF-complete; the invariant is
the markdown→`.meta` projection, which never went through RDFa). The carrier is the inline typed
wikilink / Sparna-style span — **not** DOT-LD `::rel` blocks, **not** JSON-LD islands (those stay
*reference* round-trip targets, not the implemented carrier).

## 2. The two-layer split (settled)

- **Grammar primitive (vocabulary-neutral):** a structural convention for expressing the RDF axes —
  type, literal, resource-edge, subject — in markdown. Names no application vocabulary. An agent
  learns it once and it transfers across every application/KOS; it is what we'd **fine-tune** on.
- **Per-application binding (L3):** the token→predicate/class map + the SHACL shapes + the KOS.
  wiki-memory + SKOS is the first/reference binding. **The binding *is* the interop foundation's
  `AccessNeed → registeredShapeTree → st:shape → SHACL` set** — that is the published, closed
  admission vocabulary the floor enforces.

This is D70's L1/L2/L3 stratification finally honored *in the grammar itself*: neutral mechanism,
per-app-closed vocabulary.

## 3. The grammar — structural axes (vocabulary-neutral)

**The one rule an agent learns:** *bracket-shape carries the object kind; the attribute carries the
predicate; the subject defaults by frame and can be switched.*

| Axis | Form | Projects to |
|---|---|---|
| **resource-edge** | `[[Target]]{.pred}` (existing) | `<subject> {pred} <resolved-Target-URI>` |
| **literal** (new) | `[text]{.pred}` (single bracket = literal object; Pandoc bracketed span) | `<subject> {pred} "text"` |
| **datatype / lang** (new) | `[text]{.pred@en}` / `[text]{.pred^^xsd:date}` | typed/lang literal (closes Sparna's open gap; `MetaWriter.serializeObject` already serializes these) |
| **type** | inline ABox typing of the subject | `<subject> rdf:type <class>` (see §4) |
| **subject** | implicit default; explicit switch between `<>` and `<#this>` | see §5 |

**Backward-compat decision:** keep `.` meaning **edge predicate** on a wikilink (`[[X]]{.source}` →
`dct:source`) — a wikilink *is* an edge, so this adaptation is apt and avoids migrating deployed
content. Sparna is the **completeness guide** (which axes must exist), **not** the literal token
spec. The literal axis uses single-bracket spans; the disambiguation is bracket-count
(`[[ ]]`=resource, `[ ]`=literal), not a leading-`.` overload.

## 4. The type axis — ABox inline / TBox gated (vocabulary-provenance governance)

Type is the special edge whose predicate is `rdf:type` and whose object is a class. It **forks on
what is asserted**, and the governing variable is **where the vocabulary comes from**:

- **Reference** an existing resource → always free (linking).
- **Instantiate** a new entity of a **published** type (a new `[[Marie Curie]]{.author}` typed
  `schema:Person`) → allowed; the type must be drawn from the application's published vocabulary (its
  shapes + the global terms those shapes import); the entity inherits the primal substrate structure;
  forward references are provisional + reconciled by the curation loop (D106 guardrail / sub-project C).
- **Instance (ABox) typing** (`<#this> a :Concept`, a domain class) → ordinary memory data → the
  normal floor.
- **Ontological (TBox) assertion** — typing something as `owl:Class`/`rdfs:Class`/`rdf:Property`, or
  using schema predicates (`rdfs:subClassOf`, `rdfs:subPropertyOf`, `rdfs:domain/range`,
  `owl:equivalentClass`, `owl:sameAs`) — **edits the schema.** Recognized via the **foundational
  ontology cache** (D109 §5 — the KR-construct registry: RDF/RDFS/OWL + schema-level SKOS) and
  **routed to the extension surface** (the interop foundation §3.6 / D100 ClassExtensionShape).
  Per no-stubs: a recognized-but-unhandled TBox assertion **rejects with a pointer** to the extension
  contract — never a silent pass.

**The closed-admission posture:** the published binding admits only types/predicates from
{application-defined ∪ global-the-app-imports}; new *vocabulary* is the gated extension path, never
free inline authoring. The grammar can *express* any structure; **the floor (per-binding) closes the
admissible set.**

## 5. The subject axis — thing vs. document (httpRange-14 / hash-URI)

- **`<#this>` = the thing in the world** (concept/person/place), a non-information resource named by a
  hash URI; **`<>` = the document about it**, whose markdown/HTML/Turtle are the *representations*.
  This is the standard hash-URI realization of httpRange-14 (no 303 dance).
- **Defaults by frame** (D95/D96/D108): content predicates → `<#this>`; document metadata → `<>`.
- **Explicit switch** between `<>` and `<#this>` for the minority case. **Arbitrary third-party
  subjects are rejected** (no DOT-LD `::rel`; D81 restricts subjects to the page's own two).
- **Identity invariant for the view layer (sub-project D):** the thing's URI is the **home page's**
  `<#this>`; other views reference it, never re-mint. (The entanglement of identity with location is
  the seam handed to D.)

## 6. Projection architecture

- New **`spanLiteralProjection`** module alongside `frontmatterProjection` + `wikilinkProjection`,
  feeding the existing **pure** `projectionPipeline.run(body) → Quad[]` (no store access — the
  invariant that lets it run both in-band for validation and post-commit for writing).
- The pipeline emits the projected `.meta` graph; `MetaWriter.replaceGoverned` writes governed
  predicates (Model A, D81). Datatype/lang already serialize (`serializeObject`).
- **In-band validation is sub-project B's job** (RQ-Enforce-1): run the pure pipeline on the
  *incoming* body inside the validator → SHACL-validate the projected graph (focus `<#this>` vs the
  ShapeTree's `st:shape`) → 422 pre-commit. A keeps the pipeline pure + complete so B can call it;
  the post-commit `.meta` writer is untouched.

## 7. The five hard requirements

1. **Projectable in-band** — the pure pipeline produces the full governed graph from the incoming
   body (so the floor can validate it pre-commit).
2. **Round-trippable** — markdown→`.meta` is reversible *by design*; the graph→markdown direction is
   **designed-in, not built** (sub-project D). Per no-stubs: the reverse capability is **absent and
   erroring**, not present and faking. A deterministic round-trip check (project → regenerate →
   compare) is a correctness oracle for ambiguity/loss.
3. **Bidirectionally bindable** — the binding carries predicate→token as well as token→predicate, so
   the floor's 422 names the fix in **grammar terms** ("add `[<label>]{.prefLabel}`"), not graph terms.
4. **Published binding = vocabulary boundary** — the floor admits only what the binding governs;
   unbound terms reject (no silent pass). The binding's source of truth is the interop foundation's
   `AccessNeed/ShapeTree/SHACL` set.
5. **No stubs** — recognized-but-unhandled axes error; the escalation seam points at a *real*
   extension surface; deferred capabilities are openly absent.

## 8. Predicate-map reconciliation

The hint→predicate map exists in two drifted places: `shared/markdown-parsing/src/predicates.ts`
(render path, legacy `vault:`) and the projection path (`governedPredicates.ts` + served
`context.jsonld` + shape `sh:agentInstruction`, current `cito:`/`skos:`). **Canonical = the
projection path**, now sourced from the binding (the ShapeTree/SHACL). Since D75 dropped RDFa from
the render path, the legacy `predicates.ts` map is **retired or repointed** at the canonical binding
— removing the second source (anti-drift).

## 9. Coherence surfaces (recap; A's responsibility is to be *checkable* by all three)

- **Tier-0 teach** — progressive disclosure loads the grammar spec + the per-app binding + shapes
  (with `sh:agentInstruction`); the grounded base vocab index (`interop:`, `st:`, KR set) on arrival.
- **Tier-1 floor** — in-band SHACL 422 with grammar-term hints (**sub-project B**).
- **Tier-2 curation** — semantic fit, missing links, dedup, contradiction (**sub-project C**).

A builds none of these; A makes the grammar **projectable-in-band, bidirectionally-bindable, and
round-trippable** so the three surfaces *can* act on it.

## 10. Testing

- Each axis projects correctly (resource-edge, literal, datatype/lang, type, subject switch).
- A conformant concept is **authorable inline with zero `.meta` PATCH** (the RQ-View-2 regression
  target).
- Round-trip oracle (project → regenerate → compare) flags lossy/ambiguous annotations.
- Binding-as-boundary: an unbound predicate/type rejects; a TBox assertion routes to the extension
  contract (not silent).
- Pipeline purity guard (no store access) — so it remains callable in-band.
- Predicate-map single-source guard (the two maps don't reappear).

## 11. Open decisions (for the plan)

- Exact span/attribute syntax edge cases: multi-predicate on one span; alias + type
  (`[[Note|disp]]{.pred}`); escaping inside `[ ]`.
- The explicit subject-switch token (a span/attribute form scoping to `<>` vs `<#this>` — Sparna's
  `{=…}` informs this but is trimmed; exploit our implicit defaults).
- Whether `definition` is floored (422) or encouraged; whether *one* `broader` is
  required-but-provisional (D109 §8 — wants shape-work + write-friction data; coordinate with B).
- Library choice for in-band SHACL (`shacl-engine@experimental`) — resolved in the interop spec §7,
  shared with B.

## 12. Relationship to prior decisions

- **Completes D58/D71** (dual-layer linking — was one-directional + lossy; now the body↔graph
  projection is complete + validated, reverse designed-in).
- **Builds on D36** (typed wikilinks — keeps the edge form, adds the missing axes), **D95/D96** (the
  `<>`/`<#this>` subjects the grammar addresses), **D105/D106** (two hierarchies), **D81** (governed
  predicates = the admission floor's structural commitment), **D108** (the SKOS frame model = the
  reference binding).
- **Depends on** the interop foundation spec for the binding's source of truth + the extension seam.
