---
paths: ["**/*.ts", "**/*.js", "**/*.json"]
---

# TypeScript Patterns

## CSS Extension Architecture (D19)

Community Solid Server uses Components.js (JSON-LD dependency injection).
Extensions are **configuration-level** — no CSS fork required.

### Extension template

Follow the [hello-world-component](https://github.com/CommunitySolidServer/hello-world-component) pattern:

```
css/extensions/
  package.json        — Components.js component metadata + lsd:* fields
  tsconfig.json       — TypeScript config (strict, ESM)
  src/
    index.ts          — Re-export all handler classes
    VoidHandler.ts    — .well-known/void endpoint
    ShaclHandler.ts   — .well-known/shacl endpoint
  config/
    void.json         — Components.js wiring for VoidHandler
    shacl.json        — Components.js wiring for ShaclHandler
```

### Key CSS extension points
- `WaterfallHandler`: HTTP request routing — insert custom handlers before LdpHandler
- `RouterHandler`: Match routes by regex (`allowedPathNames: ["/\\.well-known/void"]`)
- `MonitoringStore`: Intercepts resource CRUD — emits AS.Create/Update/Delete events (D17)
- `StorageDescriptionHandler`: Reference pattern for `.well-known/` endpoints

### WaterfallHandler insertion (Components.js)

```json
{
  "@type": "Override",
  "overrideInstance": { "@id": "urn:solid-server:default:BaseHttpHandler" },
  "overrideSteps": [{
    "@type": "OverrideListInsertAfter",
    "overrideParameter": { "@id": "BaseHttpHandler:_handlers" },
    "overrideTarget": { "@id": "urn:solid-server:default:StorageDescriptionHandler" },
    "overrideValue": { "@id": "urn:cogitarelink:VoidHandler" }
  }]
}
```

### Reference implementations
- [shape-validator-component](https://github.com/CommunitySolidServer/shape-validator-component) — SHACL validation on Pod writes
- [predicate-cardinalities-component](https://github.com/CommunitySolidServer/predicate-cardinalities-component) — `.well-known/` with VoID vocabulary

## Comunica (D3, D13, D28)

SPARQL federation over Solid LDP resources.

Key packages:
- `@comunica/query-sparql` — core SPARQL engine
- `@comunica/query-sparql-solid` — Solid auth support
- `@comunica/query-sparql-link-traversal-solid` — link traversal (experimental)

CLI SPARQL endpoint:
```bash
npx @comunica/query-sparql-solid-http http://localhost:3000/ -p 8080 --lenient
```

Programmatic:
```typescript
import { QueryEngine } from '@comunica/query-sparql-solid';
const engine = new QueryEngine();
const bindings = await engine.queryBindings(query, {
  sources: ['http://localhost:3000/'],
  lenient: true,
});
```

## JavaScript RDF Ecosystem

| Package | Purpose | npm |
|---------|---------|-----|
| N3.js v2 | RDF parsing/serialization, in-memory store | `n3` |
| shacl-engine | Fast SHACL Core validation (no SHACL-AF) | `shacl-engine` |
| rdf-validate-shacl | SHACL validation (Zazuko) | `rdf-validate-shacl` |
| @inrupt/solid-client | Solid data access, WAC, ACP | `@inrupt/solid-client` |
| @inrupt/solid-client-authn-node | Solid-OIDC auth for Node.js | `@inrupt/solid-client-authn-node` |

## CSS Config Files

- Base configs at `@css:config/*.json` (imported, not copied)
- Override specific components by re-declaring their `@id`
- File backend: `@css:config/file.json`
- In-memory: `@css:config/default.json`

## Node.js Conventions

- CSS requires Node.js 18+ (recommend 20 LTS)
- TypeScript strict mode
- ESM modules (`"type": "module"` in package.json)
- CSS v7.x is latest stable
