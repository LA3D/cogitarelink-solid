---
title: How Wiki-Memory Works
type: Concept
---
# How Wiki-Memory Works

[How Wiki-Memory Works]{.prefLabel} — this Pod's memory is a **SKOS concept scheme**. Concepts
are the backbone; notes/pages are memories that attach to concepts via typed edges. Read this
before writing.

## The model in 30 seconds

Every wiki page has TWO subjects in its `.meta`, and each gets a different label property:

| Node frame | Subject | Label property | Shape | What it is |
|---|---|---|---|---|
| page | `<>` | `dct:title` | PageShape | the document/record |
| thing | `<#this>` | `schema:name` | ThingShape | the entity (person, org, place) |
| concept | `<#this>` | `skos:prefLabel` | ConceptShape | a SKOS unit of meaning |

`schema:name` and `skos:prefLabel` are NOT redundant: a concept's `<#this>` carries both — the
entity name (Thing-level) AND its canonical term (Concept-level, one per language, with
`skos:altLabel` synonyms).

## Judging a value before you trust it (the read path)

The surface value of a memory can be **out of date**. A concept's stated edge — its
`skos:broader`, a label, a fact — may be under active revision or already superseded, and the
body or `.meta` you read first may not yet reflect that. **Do not simply report the first value
you find as authoritative.** Before you trust a value, hunt for governance signals attached to
the resource:

- The resource's `.meta` (and its `Link` headers) may carry **`mem:hasOpenAction`**, pointing to
  an open curation record under `/id/.operations/` — a **`mem:RealignAction`** (status
  `schema:PotentialActionStatus`) whose `mem:rationale` states the current value is stale and
  names the replacement. If one exists, the value is **contested**: report it as such (with the
  proposed correction), not as settled fact.
- No open action attached = the all-clear. An open action present = surface the contestation in
  your answer.

This is the read-path counterpart of the write-side `422` contract: the substrate flags when a
value is governed or contested; your job is to look before you trust.

## SKOS is the conceptual backbone

`skos:broader`/`narrower`/`related` are the real navigation axis (D105/D106), not decoration.
Concepts form the scheme; you navigate meaning by traversing them. That is why a concept MUST
have a `skos:prefLabel` — it is the term SKOS navigation labels results with.

## The write recipe

Write a markdown body + frontmatter. `type: Concept` (or Person, Organization, …) sets the
`<#this>` class; a body wikilink tagged with a `{.broader}`-style hint projects to a typed edge (the
hint after the dot — here `broader` — picks the predicate; the container of the target is resolved from
the target's class via the Type Index — D106). The substrate projects your body into the `.meta`
graph view.

## The validation contract

Per D81, the substrate governs a declared set of predicates; you own the rest.
- **Derived for you** (do not hand-write): `rdfs:label`, `schema:name`, page/thing plumbing.
- **You must supply** (judgment — not inferable): `skos:prefLabel` on a concept; `dct:identifier`
  on a Source (a DOI/arXiv id — see [[how-identifiers-work]] for how to type and resolve it); the
  right `skos:broader`.
- A write that omits required judgment metadata is rejected (see correction protocol).

## The correction protocol

If a write violates a shape you get an HTTP `422` with a SHACL `sh:ValidationReport`. Read the
`sh:resultMessage` + `sh:resultPath` — they name the missing/invalid predicate — fix the body or
`.meta`, and re-write. Example: omitting `skos:prefLabel` on a concept yields a report with
`sh:resultPath skos:prefLabel ; sh:resultMessage "Less than 1 value"`. Fix: add a `prefLabel`.

## Worked example (read-only — try this)

1. GET the document view: `GET /vault/wiki/concepts/photosynthesis.md` — the markdown body.
2. GET the graph view: `GET /vault/wiki/concepts/photosynthesis.md.meta` — observe on
   `<photosynthesis.md#this>`: `a skos:Concept`, `schema:name`, **`skos:prefLabel`**,
   `skos:broader <biology.md#this>`. Two subjects; three label values across them (`dct:title`
   on the page; `schema:name` + `skos:prefLabel` on the concept).
3. Find the model through the spine: `GET /vault/meta/shapes/concept.shacl.ttl` — observe
   `sub:frameRole "concept" ; sub:governsSubject "<#this>" ; sub:labelProperty skos:prefLabel`.
   The shape both *enforces* and *describes* the concept frame.
4. Follow the SKOS hop: `GET /vault/wiki/concepts/biology.md.meta` — the broader concept, itself
   carrying `skos:prefLabel`, so navigation results are labelable in-frame.

Now you have the pattern: write the body, supply `prefLabel` for concepts, let the substrate
project the rest, and correct against the `422` if you miss a required field.
