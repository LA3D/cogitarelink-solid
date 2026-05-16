---
name: shacl-shapes
description: SHACL shape design for Pod content on this stack. sh:agentInstruction conventions (D7, D50). LDP RDFS/NR split for validation targeting (D38). Class-based targeting vs container-path targeting (D78). 5-shape catalog for wiki-memory L3 (D77).
when_to_use: When designing a new SHACL shape for a content type, picking sh:targetClass vs sh:targetNode, deciding sh:closed vs sh:closed false, writing sh:agentInstruction text, or contributing shapes upstream (D46).
---

# SHACL Shape Design

How to author SHACL shapes for this Pod's content. Captures the design discipline established by D7, D11, D38, D39, D50, and D58.

## When to invoke

You're designing a new resource type for the Pod (e.g., a new note category, a new query template, a new VC profile) and need a SHACL shape to (a) document the predicate vocabulary, (b) validate writes via `shape-validator`, and (c) give agents `sh:agentInstruction` for read-time navigation.

## Where shapes live

- `shapes/wiki-memory-l3/` — canonical shape files in Turtle (one shape per wiki-memory class). Uploaded to the Pod at `/vault/meta/shapes/<name>.shacl.ttl` by the wiki-memory overlay (`scripts/overlay/apply.py overlays/wiki-memory`). Post-substrate-cleanup the legacy `/vault/procedures/shapes/` path no longer exists.
- `css/extensions/shape-validator/` — the CSS extension that enforces validation at write time via `ldp:constrainedBy`.
- Container `.meta` sidecars reference shapes via `ldp:constrainedBy` so the validator knows which shape applies to which container's writes.

## The shape's three jobs

| Job | Mechanism | Audience |
|---|---|---|
| **Generation guide** | `sh:path` + `sh:datatype` + `sh:name` + `sh:description` per property | Vault importer + write-time agents |
| **Validation gate** | `sh:NodeShape` + `sh:targetClass` + `sh:minCount`/`maxCount` | `shape-validator` on `addResource`/`setRepresentation` |
| **Agent instruction** | `sh:intent` (short summary) + `sh:agentInstruction` (longer guidance) | Read-time agents discovering the container |

`sh:agentInstruction` is SHACL 1.2 §8.3. Use it to tell the agent: "what SPARQL query to issue here, what predicates to follow, what dct:type to expect."

## Validation discipline (D38)

The shape validates the **.meta sidecar** (the RDF resource), not the body of the resource. CSS distinguishes RDF Source from Non-RDF Source (NR); for a markdown note, the `.md` is the NR body and `.meta` is the RDF Source. The shape's `sh:targetClass` matches predicates that appear in `.meta`.

(D58 revises this: when an affordance descriptor declares body affordances, body wikilinks become first-class navigation too. The descriptor IS the materialization rule. But the shape still only validates `.meta`.)

## Shape pattern — single-resource shape

```turtle
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .

<#ConceptNoteShape> a sh:NodeShape ;
    sh:targetClass skos:Concept ;
    sh:intent "Validates concept notes imported from Obsidian vault" ;
    sh:agentInstruction """
Concept notes are the primary knowledge unit in this Pod.
Each represents a research concept. Query with:
  SELECT ?c ?label WHERE { ?c a skos:Concept ; skos:prefLabel ?label }
Related concepts linked via skos:related. Parent MOC via dct:isPartOf.
""" ;

    sh:property [
        sh:path skos:prefLabel ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:name "title" ;
        sh:description "Note title from frontmatter or filename"
    ] ;
    # ... more properties
.
```

Real example: `shapes/concept-note.ttl`. The pattern is one `sh:NodeShape` per resource type; properties listed as inline blank nodes with `sh:path` identifying the predicate.

## Vocabulary aliasing

`sh:path` carries the **canonical RDF predicate** the validator checks. The shape's `sh:name` is the short field name agents (and the importer's YAML frontmatter mapper) use:

| `sh:name` (frontmatter / DSL) | `sh:path` (RDF) |
|---|---|
| `title` | `skos:prefLabel` |
| `tags` | `dct:subject` |
| `related` | `skos:related` |
| `extends` | `vault:extends` |
| `source` | `dct:source` |

`scripts/lib/rdf_gen.py` walks the shape at runtime to drive the mapping. Adding a new field requires only an extra `sh:property` block; no code change.

## Cardinality

- `sh:minCount 1` / `sh:maxCount 1` — required single-valued (label, type)
- `sh:minCount 0` (default) / no `sh:maxCount` — zero-or-more (most edge fields)
- Explicit `sh:maxCount 1` matters when the validator needs to reject duplicates

For `prov:wasGeneratedBy` and other provenance properties, leave `sh:maxCount` unset — a resource can be re-derived multiple ways.

## sh:agentInstruction — write it for the agent, not for yourself

The most useful agentInstruction strings:
1. **Name the query** the agent should issue against this container
2. **Identify the discriminating predicate** (`a skos:Concept` vs `a vault:LiteratureNote`)
3. **Point at neighboring containers** for related types
4. **Document the navigation expectation** (e.g., "Follow `dct:isPartOf` to reach the MOC")

Bad: "This is a concept note container." (no actionable guidance)
Good: "SELECT ?c ?label WHERE { ?c a skos:Concept ; skos:prefLabel ?label }. Follow skos:related for connections. Use dct:subject for tag filtering."

## Container .meta — declaring the shape

To enforce a shape on writes to a container, add `ldp:constrainedBy` in the container's `.meta`:

```turtle
<> a ldp:Container, ldp:BasicContainer ;
   ldp:constrainedBy <http://pod.example/vault/meta/shapes/page.shacl.ttl> ;
   sh:agentInstruction "..." .
```

The `shape-validator` extension reads this on every write to a child resource and validates against the shape. Without `ldp:constrainedBy`, writes are unconstrained.

## Avoiding agent vocabulary hallucination (D50)

When designing a new shape, **only use predicates that exist in published vocabularies**. The vault decisions log (D49) requires `void:vocabulary` declarations in the storage description for every RDF vocab used. If you find yourself wanting `void:shape` or `void:constructTemplate` — STOP. Those don't exist. Check the vocabulary's actual term list (e.g., `https://www.w3.org/TR/void/#voids`) before using a predicate.

Patterns that have caused this in past sessions:
- Inventing predicates that "sound right" (the LLM's tendency to extrapolate from common Linked Data style)
- Using `vault:agentGuidance` instead of `sh:agentInstruction` — `vault:` is local and unminted; SHACL 1.2 already has the predicate

When in doubt, search the vocabulary's actual jsonld or `.ttl`. Or fall back to `dct:description` (Dublin Core has everything).

## Shape catalog evolution (D46)

Domain-neutral shapes (e.g., for a generic LDP container with constrained writes) should move upstream to `solid/shapes` when stable. Pod-specific shapes (e.g., our vault-imported concept-note) stay local in `shapes/`. The boundary: does the shape mention `vault:` predicates or other locally-minted vocab? Local. Pure SHACL + Dublin Core / SKOS / FOAF? Upstreamable.

## Tooling

- **Authoring**: any Turtle editor. Validate with `pyshacl` from `~/uvws/.venv/bin/python -c "from pyshacl import validate"`.
- **Validating a resource against the shape locally**: see `tests/pytest/test_pod_structure.py` for the pattern.
- **Validating at write time**: handled by `shape-validator` extension; no manual setup needed.

## Reference implementations

- `shapes/concept-note.ttl` — single-resource pattern with full vocabulary aliasing
- `css/extensions/shape-validator/src/storage/ShapeValidationStore.ts` — runtime validation pattern (the wrap-store)
- `css/extensions/shape-validator/src/storage/validators/ShaclValidator.ts` — actual SHACL invocation via `rdf-validate-shacl`

## Related decisions

- D7: frontmatter → RDF via SHACL shape
- D11: shared SHACL shapes (revised by D46 to "domain-neutral upstream, vault-specific local")
- D38: LDP RDFS/NR split — shape validates `.meta`, never body
- D39: shape file IS the documentation
- D46: shape catalog organization
- D50: shapes as guardrails against agent vocabulary hallucination
- D58: body affordances first-class when descriptor declared (Rung 1.4)

## Related skills

- `/css-extension` — building shape-validator-style write-time validators
- `/solid-spec` — vendored SHACL primer + data-modelling guide
- `/components-override` — wiring a custom validator into the resource store chain
