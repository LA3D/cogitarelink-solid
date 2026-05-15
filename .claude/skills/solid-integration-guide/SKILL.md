---
name: solid-integration-guide
description: @inrupt/solid-client, solid-client-authn, LDO, N3.js, Bashlib — client-side libraries for talking to Solid Pods. References upstream content with project-specific deltas — solid-agent-skills CLI (D29, sibling repo), DID-WebID bridge (D14), N3.js RDF-star tooling state from 2026-05-15 probe.
when_to_use: When writing TypeScript or JavaScript that talks to this Pod, choosing between client libraries (Inrupt SDK vs LDO vs Bashlib), implementing authentication, or working with N3.js to parse/serialize Turtle.
license: MIT OR Apache-2.0
upstream:
  repo: solid/solid-llm-skills
  path: solid/integration-guide.md
  sha: 9a1cab179346cd098d4f6e7fd8c8a611f86fe127
  date: 2026-05-14
---

# Solid Integration Guide

Upstream reference (Inrupt SDK, authn, LDO, N3.js, Bashlib): [`references/spec.md`](references/spec.md)

Project-specific deltas — D29 sibling CLI, D14 DID-WebID, N3.js RDF-star tooling: [`references/deltas.md`](references/deltas.md)

## When to read which

| Question | Read |
|---|---|
| Library API usage, authn flow, N3.js DataFactory | `references/spec.md` |
| Sibling CLI tooling, DID bridge, RDF-star status | `references/deltas.md` |

## Related skills

- `solid-spec` — Solid Protocol the libraries implement
- `comunica-sources` — Comunica explicit-source SPARQL patterns for `.meta` content
- `solid-servers` — server-side stack the clients connect to
