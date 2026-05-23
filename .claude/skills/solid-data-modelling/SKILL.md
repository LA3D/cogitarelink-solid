---
name: solid-data-modelling
description: Vocabularies (SKOS, FOAF, DCT, PROV, CITO), SHACL conventions, Type Index, FAIR data principles. References upstream content with project-specific deltas — SKOS for end-user content (D34, novel for Solid), shapes contributed upstream when domain-neutral (D46), 8-shape catalog for wiki-memory L3 (D98, supersedes D77), class-based targeting (D78).
when_to_use: When designing a SHACL shape for this Pod, picking a vocabulary, registering a class in Type Index, or deciding which shapes belong upstream vs local.
license: MIT OR Apache-2.0
upstream:
  repo: solid/solid-llm-skills
  path: solid/data-modelling.md
  sha: 9a1cab179346cd098d4f6e7fd8c8a611f86fe127
  date: 2026-05-14
---

# Solid Data Modelling

Upstream reference (FAIR, vocabularies, SHACL, Type Index): [`references/spec.md`](references/spec.md)

Project-specific deltas — D34, D46, D77, D78: [`references/deltas.md`](references/deltas.md)

## When to read which

| Question | Read |
|---|---|
| What vocabularies exist, what SHACL is for, Type Index basics | `references/spec.md` |
| This Pod's SKOS approach, shape catalog, class-based targeting | `references/deltas.md` |
| Specific decision (D34, D46, D77, D78) | `.claude/rules/decisions-index.md` |

## Related skills

- `solid-uri-conformance` — URI structure for vocabulary IRIs (hash, no port, no extension)
- `solid-profiles-and-conneg` — PROF + RFC 6906 resource-kind hints; SHACL shapes as profile artifacts
- `solid-wiki-memory-l3` — 8-shape SHACL catalog (D98; class-based targeting D78)
- `shacl-shapes` — shape design conventions in this repo
- `solid-spec` — Type Index registration and discovery patterns
