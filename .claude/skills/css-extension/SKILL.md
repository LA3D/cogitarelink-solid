---
name: css-extension
description: Scaffold a new Community Solid Server (CSS) v8 extension that loads via Components.js DI. Codifies the pattern used by markdown-projection, markdown-render, shape-validator, metadata-card, and memento extensions in this repo. Covers package.json lsd:* fields, tsconfig CommonJS settings, componentsjs-generator gotchas, Dockerfile symlink trick, Components.js wiring.
when_to_use: When building a new CSS extension — defining package.json lsd:* fields, tsconfig CommonJS settings, Components.js wiring, Dockerfile symlink trick. Also for debugging componentsjs-generator "Could not load class or interface" failures or constructor "ErrorResourcesContext: Detected more than one key value in collectEntries" errors.
---

# CSS Extension Scaffolding

How to scaffold a new Community Solid Server (CSS) v8 extension that loads via Components.js DI. Codifies the pattern used by `markdown-projection`, `markdown-render`, `shape-validator`, `metadata-card`, and `memento`.

## Usage

```
/css-extension <name>          # scaffold a new extension under css/extensions/<name>/
```

## What gets created

```
css/extensions/<name>/
  package.json          — lsd:* fields, build:ts + build:components scripts
  tsconfig.json         — CommonJS, ES2022, strict
  vitest.config.ts      — node env, tests/**/*.test.ts
  src/
    index.ts            — barrel exports
    <Class>.ts          — actual implementation
  tests/
    <thing>.test.ts     — vitest unit tests
```

Plus a build block in `css/Dockerfile` and Components.js wiring in `css/config/<name>.json` referenced from `css/config/solid-config.json`'s `import` array.

## package.json — the lsd:* fields that matter

```json
{
  "name": "<name>",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/<name>",
  "lsd:components": "dist/components/components.jsonld",
  "lsd:importPaths": {
    "https://linkedsoftwaredependencies.org/bundles/npm/<name>/^0.1.0/components/": "dist/components/",
    "https://linkedsoftwaredependencies.org/bundles/npm/<name>/^0.1.0/dist/": "dist/"
  },
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/<name>/^0.1.0/components/context.jsonld": "dist/components/context.jsonld"
  },
  "scripts": {
    "build": "npm run build:ts && npm run build:components",
    "build:ts": "tsc --skipLibCheck",
    "build:components": "componentsjs-generator -s src -c dist/components",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@solid/community-server": "*",
    "asynchronous-handlers": "*"
  },
  "devDependencies": {
    "@solid/community-server": "^8.0.0-alpha.3",
    "@types/node": "^22.0.0",
    "componentsjs-generator": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

`lsd:module` is the namespace IRI; `lsd:components` points to the generated metadata; `lsd:importPaths` maps URL prefixes to filesystem dirs. CSS resolves component @id references against these.

## tsconfig.json — keep it CJS

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

CSS itself loads extensions via CommonJS `require()`. ESM-targeted extensions need the dual-build dance (see `markdown-rdfa` for why and how). For new extensions, default to CJS.

## componentsjs-generator vs hand-written

**Default**: run `componentsjs-generator -s src -c dist/components` to generate `components.jsonld` and `context.jsonld` from your TypeScript classes. Works for normal class definitions.

**Hand-write the metadata** only when the generator can't introspect your code — e.g., `markdown-rdfa` uses dynamic `import()` calls that the generator's TypeScript parser can't resolve, so its `dist-cjs/components/*.jsonld` is committed to git. See its Dockerfile comment for the full why.

**componentsjs-generator gotchas**:
- It cannot resolve **re-exported type aliases**. If file A does `export type Foo = ...` and file B does `import type { Foo } from './A'; export type { Foo }`, the generator throws "Could not load class or interface Foo." Define each type alias in exactly one file and import it elsewhere without re-export.
- It introspects `peerDependencies` packages too; you may see "Ignoring invalid package" warnings about `@isaacs/ttlcache`, `bcryptjs`, etc. Those are harmless.

## Constructor argument shape

Components.js maps constructor parameters by position. Use **positional parameters**, not a single options-object:

```ts
// GOOD — Components.js can wire each param from the JSON-LD config
public constructor(gitDir: string, baseUrl: string) { ... }
```

```ts
// BAD — Components.js can't unpack the object; throws
//   "ErrorResourcesContext: Detected more than one key value in collectEntries"
public constructor(args: { gitDir: string; baseUrl: string }) { ... }
```

The error is misleading; if you see it, check that no constructor takes an options-object.

## The @solid/community-server symlink trick

When your extension `import`s classes from `@solid/community-server`, the Dockerfile must symlink the extension's `node_modules/@solid/community-server` to the host CSS install. Otherwise Node resolves to two separate class definitions and runtime `instanceof` / metadata predicates silently fail.

```dockerfile
COPY extensions/<name> /community-server/extensions/<name>
RUN cd extensions/<name> && npm install --ignore-scripts
RUN cd extensions/<name> && npm run build
RUN rm -rf /community-server/extensions/<name>/node_modules/@solid/community-server && \
    ln -sf /community-server /community-server/extensions/<name>/node_modules/@solid/community-server
RUN ln -sf /community-server/extensions/<name> /community-server/node_modules/<name>
```

The second symlink (`/community-server/node_modules/<name>`) is what makes `require('<name>')` resolve. The first (`@solid/community-server` inside the extension) is what makes class identity match.

The pattern is documented inline in `css/Dockerfile` lines 42-52 for `markdown-rdfa` — copy-paste with the name swap.

## Components.js wiring (css/config/<name>.json)

```json
{
  "@context": [
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
    "https://linkedsoftwaredependencies.org/bundles/npm/asynchronous-handlers/^1.0.0/components/context.jsonld",
    "https://linkedsoftwaredependencies.org/bundles/npm/<name>/^0.1.0/components/context.jsonld"
  ],
  "@graph": [
    {
      "@id": "urn:cogitarelink:<MyClass>",
      "@type": "<MyClass>",
      "gitDir": "/data",
      "baseUrl": { "@id": "urn:solid-server:default:variable:baseUrl" }
    }
  ]
}
```

Then add the file to `css/config/solid-config.json`'s `import` array.

## How to insert into CSS's handler/initializer chains

See `/components-override` for the Override patterns (InsertBefore, InsertAfter, InsertAt, full replacement) and the correct parameter @id format.

## Testing pattern

Pure-logic modules → vitest unit tests under `tests/*.test.ts`. CSS-bound shims (HttpHandler, Initializer, MetadataWriter) → pytest integration tests under `tests/pytest/` against the running stack. The boundary: anything that imports from `@solid/community-server` is integration-only because the unit harness can't easily mock CSS's class graph.

## Reference implementations in this repo

- `css/extensions/shape-validator/` — ResourceStore wrap via `PassthroughStore`; SHACL validation on write; uses componentsjs-generator
- `css/extensions/markdown-rdfa/` — RepresentationConverter; dynamic-import-driven; hand-written components.jsonld
- `css/extensions/metadata-card/` — fallback HTML view; no CSS deps
- `css/extensions/memento/` — HttpHandler + Initializer + MetadataWriter triad; canonical for the patterns above

## Related skills

- `/components-override` — wiring extensions into existing CSS chains
- `/metadata-writer` — extending the response-header pipeline
- `/monitoring-store` — subscribing to write events for change-data capture
- `/solid-spec` — Solid Protocol reference (vendored upstream)
