---
name: solid-servers
description: Community Solid Server (CSS), Pivot, public servers, Docker, CLI. References upstream content with project-specific deltas — this stack uses CSS v8 alpha (D1, D28) with custom extensions (memento, markdown-projection, markdown-render, metadata-card, shape-validator).
when_to_use: When working with the CSS stack — config overrides, Docker setup, CLI invocation. Also when comparing public servers (solidcommunity.net, solidweb.org, start.inrupt.com) against this Pod's stack.
license: MIT OR Apache-2.0
upstream:
  repo: solid/solid-llm-skills
  path: solid/servers.md
  sha: 9a1cab179346cd098d4f6e7fd8c8a611f86fe127
  date: 2026-05-14
---

# Solid Servers

Upstream reference (CSS + Pivot + public servers + Docker + CLI): [`references/spec.md`](references/spec.md)

Project-specific deltas — D1 architecture, D28 CSS v8 alpha: [`references/deltas.md`](references/deltas.md)

## When to read which

| Question | Read |
|---|---|
| CSS CLI flags, Docker setup, public server URLs | `references/spec.md` |
| This stack's CSS extensions and config layout | `references/deltas.md` |
| Specific decision (D1, D28) | `.claude/rules/decisions-index.md` |

## Related skills

- `solid-spec` — Solid Protocol specs the servers implement
- `css-extension` — how to author a CSS extension in this repo
- `components-override` — Components.js wiring patterns
- `monitoring-store` — CDC pattern used by memento + markdown-projection
- `metadata-writer` — response header composition (Link/Vary headers)
