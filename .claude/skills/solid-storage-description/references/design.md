# solid-storage-description — Design reference

Storage description as agent-discovery router. Sourced from D44, D48, D49 in `.claude/rules/decisions-index.md` (Phase 3).

## D44 — Storage Description Resource replaces `.well-known/void`

Storage Description Resource replaces `.well-known/void` — spec-mandated slot via `solid:storageDescription` Link header. Router, not manifest — points to browseable catalog containers via `rdfs:seeAlso`.

**Why a router, not a manifest**:
- Spec-mandated slot exists; using it costs nothing
- Manifest pattern (everything inline) breaks "follow-your-nose" navigation as soon as the manifest grows
- Containers-over-manifests pattern (D48 anti-pattern list) — pointing at `rdfs:seeAlso` browseable catalogs lets each affordance, vocabulary, shape live at its own LDP-discoverable URI

## D48 — Agent affordance architecture

Agent affordance architecture (guiding principle) — every Pod concern is a linked-data resource with URI + typed `.meta` + Link headers. Follow-your-nose, progressive disclosure, standard-slot extension, containers over manifests.

**Anti-patterns to avoid**:
- Flat `.well-known/*` endpoints (use the spec-mandated slot, point at containers)
- Embedded SPARQL literals (treat queries as resources, not strings)
- Magic paths (every URI must be discoverable from the storage description chain)
- Dual parallel mechanisms (one canonical discovery path per concern)

## D49 — Vocabulary grounding via `void:vocabulary` declarations

Vocabulary grounding via `void:vocabulary` declarations — storage description MUST declare every RDF vocab used; each MUST be dereferenceable (canonical source or D23 TBox cache).

**Why**: An agent reading `.meta` triples uses predicate IRIs like `dct:created`. The agent needs to know:
1. Which vocabulary that IRI belongs to (`http://purl.org/dc/terms/`)
2. Where to dereference that vocabulary if it doesn't already know it

D49 closes this discovery loop by requiring the storage description to enumerate vocabularies. The TBox cache (D23) holds the canonical vocab Turtle/JSON-LD so agents work offline.

## How the chain works

```
GET / (root resource)
  → Link: <...>; rel="solid:storageDescription"
  ↓
GET /.well-known/solid (or wherever the storage description lives)
  → void:vocabulary <http://www.w3.org/2004/02/skos/core#>
  → void:vocabulary <http://purl.org/dc/terms/>
  → ...
  → rdfs:seeAlso </meta/affordances/>
  → rdfs:seeAlso </meta/shapes/>
  → rdfs:seeAlso </types> (Solid Type Index)
  ↓
GET /meta/affordances/
  → ldp:contains <markdown-projection>, <hub-view>, ...
  ↓
GET /meta/affordances/markdown-projection
  → typed affordance descriptor with sh:agentInstruction
```

Every step is standard LDP + Solid Protocol. No invented endpoints.

## Authoritative artifacts

- CSS Components.js wiring: `css/config/storage-description.json` (when integrated; currently in development)
- Vocabulary declarations: storage description's `void:vocabulary` set + TBox cache at `/ontology/`
- Affordance catalog: `/meta/affordances/` (root of D52 descriptor space)
