---
name: solid-uri-conformance
description: URI conformance for Solid Pod-hosted vocabularies. Hash-namespace, extension-less file paths, HTTPS, port-less, mnemonic class names, Pod-as-namespace-authority. Use BEFORE minting any IRI, predicate, class, profile, or shape. Also when authoring a SHACL shape, deciding hash vs slash, debugging vocabulary dereferenceability, or choosing between Pod-hosted vs w3id.org for a new vocabulary. Even when the user doesn't say "URI" or "namespace," invoke this skill any time a new RDF identifier is being created.
---

# Solid URI Conformance

How to mint and serve URIs on a Solid Pod so that vocabulary IRIs are dereferenceable, stable across deployment changes, and consistent with the de facto conventions of the Solid ecosystem. Companion skills: [`solid-tls-deployment`](../solid-tls-deployment/SKILL.md) for the HTTPS layer, [`solid-profiles-and-conneg`](../solid-profiles-and-conneg/SKILL.md) for resource-kind hints.

## Five rules that catch most mistakes

1. **Vocabulary IRIs are HTTPS, no port, hash-namespace, no file extension.** `https://pod.example.org/ontology/wiki#Page`, not `http://pod.example.org:3000/ontology/wiki.ttl#Page`. Every part of the bad form encodes deployment state into a class identifier.

2. **The vocabulary file's URL path *is* the namespace prefix.** No virtual mapping. If the namespace is `…/ontology/wiki#`, the file MUST live at `/ontology/wiki` (no extension), served with `Content-Type: text/turtle`. CSS handles RDF content-negotiation automatically.

3. **For app-local vocabularies, host on the Pod itself.** The Pod is the namespace authority for its own application. Use `https://w3id.org/<org>/<vocab>` only for vocabularies meant to be shared across many Pods — minting a w3id redirect for every per-app vocabulary defeats the point of Solid's decentralized architecture.

4. **Mnemonic class names** (`wiki:Concept`, not `wiki:C7f4a3`), **opaque or mnemonic entity slugs** depending on rename risk. The Solid vocab publishing guide recommends "short, memorable IRI are less error-prone." Opaque IDs only matter when entity rename is likely (e.g., Wikidata Q-numbers).

5. **Trailing slash is load-bearing** (Solid Protocol §3.1, MUST). `/wiki` (document) and `/wiki/` (container) cannot coexist at the same stem. Pick one.

## Decision tree

```
Minting a new IRI?

├── For a class/predicate that lives in THIS app?
│   ├── Will it be referenced by other Pods? (cross-Pod shared profile)
│   │   YES → w3id.org/<org>/<vocab>#<Term>
│   │   NO  → https://<pod-host>/<path>/ontology/<vocab>#<Term>
│   │
│   └── Vocabulary FILE at: /<path>/ontology/<vocab>  (no extension; PUT with Content-Type: text/turtle)
│
├── For an entity instance (a page, a person, an event)?
│   → https://<pod-host>/<path>/<container>/<slug>
│   → Mnemonic slug for natural-name entities; opaque only if rename risk
│
├── For a profile (resource-kind hint)?
│   → SEPARATE IRI from the class (see `solid-profiles-and-conneg`)
│
└── Always:
    ✓ HTTPS
    ✓ No port in vocabulary IRI
    ✓ No file extension in vocabulary IRI
    ✓ Mnemonic class names
    ✓ Hash namespace for vocabularies
    ✓ Trailing slash discipline (container vs resource)
```

## Reference material

| File | Read when |
|---|---|
| [`references/spec.md`](references/spec.md) | You want the standards rationale — TBL Linked Data principles, Cool URIs, hash vs slash, CSS content-negotiation mechanics, URI normalization |
| [`references/deltas.md`](references/deltas.md) | You're working on the cogitarelink-solid project and need to know this Pod's specific commitments (the vocabularies it hosts, the file paths, w3id.org migration policy) |
| [`references/templates.md`](references/templates.md) | You need a paste-ready Turtle template for a vocabulary file or storage description |

## Empirical conformance test result

CSS v8 alpha was directly tested for extension-less Turtle serving (2026-05-16). `PUT /vault/_test` with `Content-Type: text/turtle` succeeded; `GET` with `Accept: text/turtle`, `application/ld+json`, `application/n-triples` all returned 200 OK with the correct serialization auto-converted from the stored Turtle. This validates rule 2 ("URL path *is* the namespace prefix") on the actual deployment target.

## Related skills

- `solid-tls-deployment` — HTTPS layer required by rule 1 (Solid Protocol §3 mandates HTTPS)
- `solid-profiles-and-conneg` — PROF + RFC 6906 resource-kind hints; profile IRIs follow the same conformance rules as class IRIs
- `solid-spec` — Solid Protocol §3.1 trailing-slash MUST, §3.2 persistence (HTTP 410)
- `solid-data-modelling` — vocabulary selection (when to mint new vs reuse standard)
- `solid-storage-description` — how the storage description advertises the vocabularies it declares (D44/D49)
