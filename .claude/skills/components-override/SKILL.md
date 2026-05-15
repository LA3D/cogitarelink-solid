---
name: components-override
description: Components.js Override patterns for CSS v8 — InsertBefore, InsertAfter, InsertAt, full replacement. Parameter @id format. Workaround for OverrideListInsertAt against empty list (K1).
when_to_use: When inserting a custom handler into an existing CSS WaterfallHandler, ParallelHandler, or initializer chain without forking CSS. Also when overrideParameters error messages are confusing or InsertAt fails against an empty target list.
---

# Components.js Override Patterns

How to insert a new component into an existing CSS Components.js chain (handler waterfall, metadata writer ParallelHandler, init sequence, etc.) without forking CSS itself. The Override mechanism lives in `componentsjs/lib/preprocess/overridesteps/`.

## Usage

```
/components-override <target>
```

Examples: `/components-override BaseHttpHandler`, `/components-override MetadataWriter`, `/components-override WorkerParallelInitializer`.

## Two override modes

| Mode | When | Risk |
|---|---|---|
| **`overrideParameters`** (full replacement) | The parameter is small / well-known and you want the entire shape | Silently drops upstream additions on future CSS bumps |
| **`overrideSteps`** (list mutation) | Inserting into a chain — preferred for handler/initializer lists | Anchored to a target node; survives upstream additions |

## overrideParameters — replace the whole parameter value

```json
{
  "@type": "Override",
  "overrideInstance": { "@id": "urn:solid-server:default:WorkerParallelInitializer" },
  "overrideParameters": {
    "@type": "ParallelHandler",
    "handlers": [
      { "@id": "urn:cogitarelink:MementoCommitListener" }
    ]
  }
}
```

Use this when the target's parameter has nothing useful to preserve (empty list, default value, or you actively want to replace).

## overrideSteps — surgically mutate

Four step types, all under `componentsjs/lib/preprocess/overridesteps/`:

| Step | What | Required fields |
|---|---|---|
| `OverrideListInsertBefore` | Insert before a referenced list element | `overrideParameter`, `overrideTarget` (the anchor), `overrideValue` |
| `OverrideListInsertAfter` | Insert after a referenced list element | same |
| `OverrideListInsertAt` | Insert at numeric index (negative counts from back; `-0` means end) | `overrideParameter`, `overrideTarget` (literal index), `overrideValue` |
| `OverrideListRemove` | Remove element from list | `overrideParameter`, `overrideTarget` |
| `OverrideMapEntry` | Add/replace a map entry | `overrideParameter`, `overrideTarget`, `overrideValue` |

Example (used by `memento.json` to insert MementoHttpHandler before LdpHandler):

```json
{
  "@type": "Override",
  "overrideInstance": { "@id": "urn:solid-server:default:BaseHttpHandler" },
  "overrideSteps": [{
    "@type": "OverrideListInsertBefore",
    "overrideParameter": { "@id": "css:dist/util/handlers/StatusWaterfallHandler.jsonld#StatusWaterfallHandler_handlers" },
    "overrideTarget": { "@id": "urn:solid-server:default:LdpHandler" },
    "overrideValue": { "@id": "urn:cogitarelink:MementoHttpHandler" }
  }]
}
```

## The parameter @id — this is the part that trips people up

The `overrideParameter` IRI is the **full parameter @id from the target class's jsonld definition**, NOT the instance @id with a `:_param` suffix.

To find it: look at the class's `.jsonld` definition under `node_modules/@solid/community-server/dist/...` or `node_modules/asynchronous-handlers/dist/...`. The `parameters` array lists each parameter with its full @id.

Patterns we've used in this codebase:

| Target class | Parameter | @id |
|---|---|---|
| `StatusWaterfallHandler` (e.g., `BaseHttpHandler`, `OperationHandler`) | `handlers` | `css:dist/util/handlers/StatusWaterfallHandler.jsonld#StatusWaterfallHandler_handlers` |
| `WaterfallHandler` (asynchronous-handlers base) | `handlers` | `ah:dist/WaterfallHandler.jsonld#WaterfallHandler_handlers` |
| `ParallelHandler` (e.g., `MetadataWriter`, `WorkerParallelInitializer`) | `handlers` | `ah:dist/ParallelHandler.jsonld#ParallelHandler_handlers` |
| `SequenceHandler` | `handlers` | `ah:dist/SequenceHandler.jsonld#SequenceHandler_handlers` |
| `LinkRelMetadataWriter` | `linkRelMap` | `css:dist/http/output/metadata/LinkRelMetadataWriter.jsonld#LinkRelMetadataWriter_linkRelMap` |

The `css:` prefix resolves to `https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/` (or whatever's in the `@context` declarations).
The `ah:` prefix resolves to `https://linkedsoftwaredependencies.org/bundles/npm/asynchronous-handlers/^1.0.0/`.

## Constructor argument shape

Components.js binds constructor parameters **positionally**, mapping each JSON-LD top-level field to one constructor argument by **declaration order** (after generation by `componentsjs-generator`). Two failure modes:

1. **Options-object constructor** — `constructor(args: { foo, bar })` — Components.js can't unpack the object, throws `ErrorResourcesContext: Detected more than one key value in collectEntries`. Always use individual positional parameters.
2. **Re-exported type alias** — `export type X` in file A, `export type { X }` in file B — `componentsjs-generator` errors with `Could not load class or interface X`. Define each type in exactly one file.

## K1 — known limitation: OverrideListInsertAt against empty list

**Status**: worked around, not fixed.

Components.js v8.0.0-alpha.3 reproducibly throws `Detected more than one key value in collectEntries` when an `OverrideListInsertAt` step targets a parameter whose list is empty (specifically `urn:solid-server:default:WorkerParallelInitializer.handlers` which has zero entries in `config/app/init/default.json`). The same step shape works fine when the list has ≥1 entry to anchor against.

**Workaround**: use `overrideParameters` (full replacement) when targeting an empty list:

```json
{
  "@type": "Override",
  "overrideInstance": { "@id": "urn:solid-server:default:WorkerParallelInitializer" },
  "overrideParameters": {
    "@type": "ParallelHandler",
    "handlers": [
      { "@id": "urn:cogitarelink:MementoCommitListener" }
    ]
  }
}
```

Risk: silently drops upstream additions to that list on future CSS bumps. Documented in `css/config/memento.json`. Revisit when the upstream list has entries to anchor on, or file a componentsjs issue.

## Debugging a failed override

CSS prints `Could not create the server` on startup with a Components.js stack trace. Common causes:

1. **Wrong parameter @id** — check the class's `.jsonld` parameters list.
2. **Target not found** — `OverrideListInsertBefore` / `InsertAfter` throws if the target IRI isn't in the list. Verify the target was loaded (some configs are version-gated).
3. **Constructor shape mismatch** — see "Constructor argument shape" above.
4. **K1** — empty list + InsertAt.

## Composition order

Override steps run **after** instance construction. You can stack multiple overrides on the same instance:

```json
{
  "@type": "Override",
  "overrideInstance": { "@id": "urn:solid-server:default:MetadataWriter" },
  "overrideSteps": [
    { "@type": "OverrideListInsertAfter", ... },
    { "@type": "OverrideListInsertBefore", ... }
  ]
}
```

Steps execute in array order; later steps see the mutations of earlier ones.

## Related skills

- `/css-extension` — scaffolding a new extension before wiring it
- `/metadata-writer` — extending the response pipeline (uses Override on `MetadataWriter`)
- `/monitoring-store` — D17 CDC integration (uses Override on `WorkerParallelInitializer`)
