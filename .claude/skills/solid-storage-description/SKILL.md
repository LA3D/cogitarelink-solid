---
name: solid-storage-description
description: Storage description as router (D44) replacing legacy `.well-known/void`. Agent affordance architecture guiding principle (D48). Vocabulary grounding via void:vocabulary declarations (D49).
when_to_use: When designing or debugging the storage description resource, adding affordance catalog entries, or answering questions about how agents discover this Pod's capabilities.
---

# Solid Storage Description

Storage Description Resource at the standard slot (`solid:storageDescription` Link header) is this Pod's primary discovery surface. Replaces the older `.well-known/void` pattern. Full design in [`references/design.md`](references/design.md).

## Quick reference

- **D44**: Storage Description Resource replaces `.well-known/void`. Router, not manifest — points to browseable catalog containers via `rdfs:seeAlso`
- **D48**: Agent affordance architecture as guiding principle. Anti-patterns: flat `.well-known/*` endpoints, embedded SPARQL literals, magic paths, dual parallel mechanisms
- **D49**: Vocabulary grounding — `void:vocabulary` declarations MUST be present, each MUST be dereferenceable (canonical source or D23 TBox cache)

## Implementation

`css/config/storage-description.json` — Components.js config wiring. Discoverable via `Link: <...>; rel="http://www.w3.org/ns/solid/terms#storageDescription"` on every resource.

## Related skills

- `solid-spec` — D44 divergence from upstream defaults
- `solid-affordance-descriptors` — affordance catalog reachable via storage description
- `solid-data-modelling` — vocabularies declared via `void:vocabulary`
- `solid-uri-conformance` — URI structure for the predicates the storage description carries (D84); PROF profile catalog also reachable via this surface (D86)
