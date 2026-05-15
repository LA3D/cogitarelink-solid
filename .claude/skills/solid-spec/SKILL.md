---
name: solid-spec
description: Solid Protocol, WebID Profile, Solid-OIDC, ACP, and WAC specifications. References upstream content synced from solid/solid-llm-skills, with project-specific deltas where this Pod diverges (storage description per D44, RDFa drop per D75, alsoKnownAs DID-WebID bridge per D14).
when_to_use: When answering questions about Solid Protocol semantics, authentication flow, access control, or when implementing a Solid-conformant resource. Also when comparing this Pod's behavior against upstream Solid defaults.
license: MIT OR Apache-2.0
upstream:
  repo: solid/solid-llm-skills
  path: solid/spec.md
  sha: 9a1cab179346cd098d4f6e7fd8c8a611f86fe127
  date: 2026-05-14
---

# Solid Spec

Upstream Solid Protocol reference (verbatim): [`references/spec.md`](references/spec.md)

Project-specific deltas — D44 storage description, D75 RDFa drop, D14 DID-WebID bridge: [`references/deltas.md`](references/deltas.md)

## When to read which

| Question | Read |
|---|---|
| WebID profile structure, Solid-OIDC token flow, ACP matchers, WAC modes | `references/spec.md` |
| How this Pod diverges from defaults | `references/deltas.md` |
| Specific decision (D1-D81) | `.claude/rules/decisions-index.md` → this skill or a sibling |

## Related skills

- `solid-storage-description` — D44 storage description (replaces `.well-known/void`)
- `solid-memento` — RFC 7089 + tombstones (D61-D68)
- `solid-affordance-descriptors` — body-affordance harness (D52, D55, D58)
- `solid-wiki-memory-l3` — wiki-memory L3 reference profile (D70-D81)
