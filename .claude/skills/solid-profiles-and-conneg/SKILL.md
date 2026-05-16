---
name: solid-profiles-and-conneg
description: Resource-kind hints for Solid Pod resources via W3C PROF (Profiles Vocabulary) + RFC 6906 (Link rel=profile) + W3C Content Negotiation by Profile. Use when answering "what kind of resource is at this URL?", designing a profile descriptor, authoring SHACL shapes as profile artifacts, emitting Link rel=profile headers, deciding between class IRI and profile IRI, or implementing _profile= content negotiation. Also invoke whenever someone mentions PROF, prof:Profile, conneg-by-profile, Accept-Profile, or asks about telling an agent the schema/shape of a resource via HTTP.
---

# Solid Profiles and Conneg

How to tell an agent what *kind* of resource it's looking at — beyond `rdf:type` — using the W3C Profile stack. A Solid Pod hosts many kinds of resources (wiki pages, sources, persons, procedures, working memory) that share a media type but differ in shape, vocabulary, and constraints. PROF + RFC 6906 + conneg-by-profile let an agent discover this without parsing the body.

Companion skills: [`solid-uri-conformance`](../solid-uri-conformance/SKILL.md) for the IRI form profile descriptors take; [`solid-storage-description`](../solid-storage-description/SKILL.md) for where profile catalogs are advertised.

## Caution — what's settled and what isn't

The standards stack here is partly ratified, partly draft, partly expired. Cite honestly:

| Document | Status | Stance |
|---|---|---|
| RFC 6906 (`Link: rel="profile"`) | IETF Proposed Standard | **Authoritative.** Use as-is. |
| W3C PROF (Profiles Vocabulary) | WG Note (Dec 2019) | Best-aligned vocabulary; §7/§8/§11 normative, rest informative. |
| W3C Conneg-by-Profile | Working Draft (Oct 2023) | Never advanced to REC. Patterns are stable in practice. |
| `draft-svensson-accept-profile-00` (IETF) | **Expired Sept 2019** | **DO NOT use.** `Content-Profile` header lives only here; the W3C WD uses `Link: rel="profile"` instead. |
| PROF `dct:conformsTo` chain axiom (§8.4.2) | Marked at-risk (Issue 1078) | Emit `prof:isTransitiveProfileOf` explicitly. Don't rely on reasoners. |
| PROF role registry (8 entries) | Marked at-risk (Issue 1073) but extensible | Mint custom roles when none of the 8 fit (GeoSPARQL did this with `role:repository`). |

Net: the stack is the right tool but not all of it is ratified. Use PROF and conneg-by-profile knowing they're WG Note / WD; rely on RFC 6906 as the ratified anchor; avoid the expired IETF draft entirely.

## Three rules

1. **Class IRI ≠ Profile IRI.** `wiki:Concept` is an `owl:Class`. `wiki:ConceptProfile` is a `prof:Profile`. Instance data declares **both**:
   ```turtle
   </vault/wiki/pages/context-graphs>
     a wiki:Concept ;
     dct:conformsTo </vault/meta/profiles/concept> .
   ```
   The class says what kind of thing this is; the profile says which constraints, vocabulary, and validation artifacts apply.

2. **SHACL shapes are artifacts INSIDE profiles**, not profiles themselves. Wire shapes through `prof:ResourceDescriptor`:
   ```turtle
   <…/profiles/concept>
     prof:hasResource [
       a prof:ResourceDescriptor ;
       prof:hasRole role:validation ;
       dct:conformsTo <https://www.w3.org/TR/shacl/> ;
       prof:hasArtifact <…/shapes/concept.shacl.ttl>
     ] .
   ```
   The shape isn't the profile — it's one of the profile's artifacts. Other artifacts: JSON-LD contexts (`role:schema`), vocabulary documents (`role:vocabulary`), human-readable specs (`role:specification`), worked examples (`role:example`), guidance docs (`role:guidance`).

3. **Always emit `prof:isTransitiveProfileOf` explicitly.** PROF defines a `dct:conformsTo` property chain (§8.4.2) that would let a reasoner infer ancestors. But this axiom is flagged at-risk (Issue 1078) and most implementations don't apply it. Pre-flatten the chain at write time:
   ```turtle
   <…/profiles/concept>
     prof:isProfileOf <…/profiles/page> ;
     prof:isTransitiveProfileOf <…/profiles/page> , <https://solidproject.org/TR/protocol> .
   ```
   Clients don't need a reasoner to walk the chain.

## Pattern at a glance

```
                  CLASS                           PROFILE
            (rdf:type, OWL class)        (prof:Profile, dct:Standard)
                    |                              |
                    v                              v
            wiki:Concept                  wiki:ConceptProfile
                                                   |
                                  prof:hasResource +
                          [hasRole validation → SHACL shape] +
                          [hasRole schema     → JSON-LD context] +
                          [hasRole vocabulary → vocabulary doc] +
                          [hasRole specification → spec doc]
                                                   |
                          prof:isProfileOf → wiki:PageProfile
                                          → Solid Protocol
```

Instance data declares both pieces. HTTP responses advertise the profile via `Link: rel="profile"`. Conneg-by-profile lets clients ask for alternate views.

## Standard roles (PROF §9)

8 roles in the registry at `http://www.w3.org/ns/dx/prof/role/`. All flagged at-risk but extension is permitted.

| Role | Use for |
|---|---|
| `role:constraints` | Descriptions of obligations / extensions the profile defines |
| `role:example` | Sample instance data |
| `role:guidance` | Human-readable how-to-use docs |
| `role:mapping` | Conversions to/from another spec |
| `role:schema` | Machine-readable structural descriptions (typically JSON-LD context) |
| `role:specification` | Profile definition in human-readable form |
| `role:validation` | Conformance verification rules (typically SHACL shape) |
| `role:vocabulary` | Vocabulary the profile uses |

Custom roles are fine — GeoSPARQL ships `role:repository` (pointing at GitHub), no controversy. Document the new role with `skos:definition` so other agents understand.

## Reference material

| File | Read when |
|---|---|
| [`references/spec.md`](references/spec.md) | You want the PROF / conneg-by-profile / RFC 6906 deep dive — full class/property inventory, the HTTP exchange, transitivity axiom, role registry details |
| [`references/templates.md`](references/templates.md) | You need paste-ready Turtle for declaring a profile, profile chain, ResourceDescriptors, or the HTTP list-profiles response shape |
| [`references/deltas.md`](references/deltas.md) | You're working in cogitarelink-solid and need to know which 5 profiles ship in the wiki-memory L3 overlay |

## Related skills

- `solid-uri-conformance` — profile IRIs follow the same hash/extension/HTTPS rules as class IRIs
- `solid-storage-description` — where the profile catalog is advertised (D44)
- `solid-affordance-descriptors` — affordance descriptors are PROF ResourceDescriptors with a custom `wikirole:affordance` role
- `solid-data-modelling` — SHACL shape design (the shapes that become profile artifacts)
- `metadata-writer` — for building a `Link: rel="profile"` MetadataWriter CSS extension
