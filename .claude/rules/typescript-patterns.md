---
paths: ["**/*.ts", "**/*.js", "**/*.json"]
---

# TypeScript Patterns

## CSS Extension Architecture (D19)

Community Solid Server uses Components.js (JSON-LD dependency injection).
Extensions are **configuration-level** — no CSS fork required.

Key CSS extension points:
- `MonitoringStore`: intercepts resource create/update/delete events
- `WaterfallHandler`: intercepts HTTP requests matching conditions
- `RoutingResourceStore`: routes requests to different backends by path

## Components.js Config Pattern

```json
{
  "@context": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^7.0.0/components/context.jsonld",
  "import": [
    "css:config/file.json"
  ],
  "@graph": [
    {
      "comment": "Custom extension component",
      "@id": "urn:solid-server:default:SearchHandler",
      "@type": "WaterfallHandler"
    }
  ]
}
```

## CSS Config Files

- Base configs at `@css:config/*.json` (imported, not copied)
- Override specific components by re-declaring their `@id`
- File backend: `@css:config/file.json`
- In-memory: `@css:config/default.json`

## Phase 2b: OSLC Query Extension (D16, D19)

CSS extension for OSLC Query parameters on LDP container GET:
- Custom WaterfallHandler intercepts `oslc.*` query params
- SQLite FTS5 backend for `oslc.searchTerms`
- Property filter for `oslc.where`
- ~1200 LOC across 12-15 TypeScript files

## Node.js Conventions

- CSS requires Node.js 18+
- TypeScript strict mode
- ESM modules (`"type": "module"` in package.json)
- CSS v7.x is latest stable
