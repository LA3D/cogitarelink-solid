---
name: solid-uri-conformance
description: URI structure and conformance for Solid Pod-hosted vocabularies. Hash-namespace, no-extension, HTTPS, port-less IRIs (D84). TLS deployment (D85). W3C PROF + RFC 6906 + conneg-by-profile for resource-kind hints (D86). Closes RQ-Substrate-3.
when_to_use: Use BEFORE minting any new IRI, predicate, class, profile, or shape. Also when authoring a SHACL shape, designing an affordance descriptor, writing storage description triples, debugging vocabulary dereferenceability, deciding hash vs slash, or answering "what kind of resource is this URL?". Read this skill before deciding `Pod-local namespace` vs `w3id.org` vs `external standard`.
---

# Solid URI Conformance

Authoritative reference for how this Pod mints and serves URIs. Built from Solid Project guidance, W3C TR Linked Data design issues, W3C PROF / conneg-by-profile, RFC 6906, and OGC SELFIE deployment patterns. Closes the URI confusion identified in RQ-Substrate-3.

## When to invoke

Invoke before any of these:

- Minting a new class, predicate, or namespace prefix
- Authoring a new SHACL shape (the `sh:targetClass` IRI must conform)
- Designing an affordance descriptor (D52)
- Writing storage description triples (D44, D49)
- Asking "what kind of resource is at this URL?" — that's a PROF profile question
- Deciding whether a vocabulary should live on this Pod or at w3id.org
- Debugging a 404 on a vocabulary fetch
- Reviewing IRI references in fixtures, tests, or migration scripts

## Reference material

Three reference docs, organized by audience:

| File | Purpose |
|---|---|
| [`references/spec.md`](references/spec.md) | Authoritative material verbatim — TBL principles, Cool URIs, hash vs slash, CSS conneg, PROF, conneg-by-profile, RFC 6906, with sources |
| [`references/deltas.md`](references/deltas.md) | This Pod's specific commitments (D84/D85/D86), known-wrong current state, open questions |
| [`references/templates.md`](references/templates.md) | 5 ready-to-paste PROF Turtle templates + the HTTP list-profiles response shape |

## Quick reference

### Five rules that catch most mistakes

1. **Vocabulary IRIs are HTTPS, no port, hash-namespace, no file extension.** `https://pod.vardeman.me/vault/ontology/wiki#Page`, not `http://pod.vardeman.me:3000/vault/ontology/wiki.ttl#Page` (every part of that bad form is wrong).
2. **The vocabulary file's URL path *is* the namespace prefix.** No virtual mapping. If namespace is `…/ontology/wiki#`, the file MUST live at `/vault/ontology/wiki` (no extension, `Content-Type: text/turtle`).
3. **Class IRIs and profile IRIs are different things.** `wiki:Concept` is the OWL class. `wiki:ConceptProfile` is the `prof:Profile`. Instance data declares both: `rdf:type wiki:Concept ; dct:conformsTo wiki:ConceptProfile`.
4. **SHACL shapes are artifacts inside a profile, not the profile itself.** `prof:hasResource → prof:ResourceDescriptor → prof:hasRole role:validation → prof:hasArtifact <shape-file>`.
5. **For *this Pod's* app vocabularies, host on the Pod itself.** For vocabularies meant to outlive this Pod and be shared across many Pods (e.g. `fabric:CoreProfile`), use `https://w3id.org/cogitarelink/…`. The Pod IS the namespace authority for its application; w3id.org is for cross-Pod permanence.

### Decision tree

```
Minting a new IRI?
├── For a class/predicate that lives in this app?
│   → Pod-local hash namespace: https://pod.vardeman.me/vault/ontology/<vocab>#<Term>
│   → Vocabulary file at: /vault/ontology/<vocab> (no extension)
│
├── For a profile (resource-kind declaration)?
│   → Separate IRI from the class: <ClassName>Profile pattern
│   → Profile descriptor at: /vault/meta/profiles/<class-name>.ttl
│
├── For an entity instance (a page, a person, an event)?
│   → Pod-local slash path with mnemonic slug: /vault/wiki/pages/context-graphs
│   → Mnemonic for readability; opaque suffix only if collision-prone
│
├── For a SHACL shape?
│   → Class IRI used in sh:targetClass = Pod-local hash namespace
│   → Shape file lives in /vault/meta/shapes/<name>.shacl.ttl
│   → Referenced FROM a prof:Profile via prof:hasResource (artifact pattern)
│
└── For a cross-Pod shared profile (e.g. fabric:WikiMemoryProfile)?
    → w3id.org: https://w3id.org/cogitarelink/<profile>
    → Submit redirect via perma-id/w3id.org PR
```

### Caution: the W3C profile stack is unsettled

- **PROF** (Profiles Vocabulary): W3C **Working Group Note**, not Recommendation. Sections 7/8/11 are normative; the rest is informative.
- **Conneg-by-profile**: W3C **Working Draft**. Never advanced to Rec.
- **RFC 6906** (`Link: rel="profile"`): IETF **Proposed Standard** — the only ratified piece.
- **`draft-svensson-accept-profile-00`**: **expired Sept 2019**, never adopted. **Do not emit `Content-Profile` headers** — that name only lives in the expired draft. The W3C WD uses `Link: rel="profile"` instead.
- **`dct:conformsTo` property chain axiom**: PROF Issue 1078 marks it "at risk." **Emit `prof:isTransitiveProfileOf` explicitly** rather than relying on a reasoner to apply the chain.
- **PROF role registry**: 8 standard roles, all "at risk" (Issue 1073), but extension is permitted. Mint custom roles only when none of the 8 fit.

We're building on a stack the W3C hasn't ratified. That's deliberate — it's the best-aligned standards work. The skill flags this honestly so future Claude doesn't cite WG Notes as if they were Recs.

## D-decisions in scope

- **D84** — URI conformance commitments (this skill is the authoritative reference)
- **D85** — TLS deployment (mkcert dev, Caddy+LE prod) — required for D84's HTTPS commitment
- **D86** — Profile-based resource kind declaration (PROF + RFC 6906)
- **Closes RQ-Substrate-3** — namespace mismatch between void-description.json and overlay-managed `.meta`

## Related skills

- `solid-spec` — Solid Protocol §3.1 (trailing slash MUST), §3.2 (URI persistence), HTTPS mandate
- `solid-data-modelling` — FAIR + vocabulary selection; this skill sharpens its URI advice
- `solid-storage-description` — D44/D48/D49 — where profile catalog gets advertised
- `solid-affordance-descriptors` — D52 — affordance descriptors are PROF ResourceDescriptors with `role:affordance` (custom role)
- `solid-wiki-memory-l3` — concrete application; profile IRIs live alongside class IRIs in `wiki:` namespace
- `metadata-writer` — `Link: rel="profile"` MetadataWriter follows the D67 MementoLinkMetadataWriter pattern
