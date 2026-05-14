# /metadata-writer

How CSS's response-header pipeline works and how to extend it composably. The critical mechanic: `addHeader` accumulates, `setHeader` overwrites — design around that.

## When to invoke

You're emitting a custom HTTP response header (`Link: rel="..."`, `Vary`, `Memento-Datetime`, custom auxiliary headers) and need it to coexist with whatever CSS itself emits for the same header name.

## The pipeline

CSS composes a `ParallelHandler` of MetadataWriter instances at `urn:solid-server:default:MetadataWriter`, defined in `config/ldp/metadata-writer/default.json`. Default handlers (CSS v8.0.0-alpha.3):

- `MetadataWriter_AllowAccept` — `Accept-Patch`, `Accept-Post`, `Accept-Put`, `Allow`
- `MetadataWriter_ContentType` — `Content-Type`
- `MetadataWriter_Cookie` — auth cookies
- `MetadataWriter_LinkRel` — `Link` headers from metadata predicates (extensible via `linkRelMap`)
- `MetadataWriter_LinkRelMetadata` — Link headers from `<aux>.meta` resources
- `MetadataWriter_Mapped` — arbitrary RDF predicates → header names
- `MetadataWriter_Modified` — `Last-Modified`, `ETag`
- `MetadataWriter_Range` — `Accept-Ranges`, `Content-Range`
- `MetadataWriter_StorageDescription` — `Link: rel="storageDescription"`
- `MetadataWriter_WwwAuth` — `WWW-Authenticate`

Each writer reads `RepresentationMetadata` predicates and emits one or more headers via `addHeader(response, name, value)` from `@solid/community-server`'s `HeaderUtil`. `addHeader` concatenates with existing values.

## The composition rule

Two writers writing to the **same header name** both contribute if both use `addHeader`. If either uses raw `response.setHeader(name, value)`, the last writer wins and prior values are overwritten.

| Operation | Behavior |
|---|---|
| `addHeader(res, "Link", "<a>; rel=foo")` then `addHeader(res, "Link", "<b>; rel=bar")` | `Link: <a>; rel=foo, <b>; rel=bar` (both kept) |
| `res.setHeader("Link", "<a>...")` then `res.setHeader("Link", "<b>...")` | `Link: <b>...` (first lost) |
| `addHeader(res, "Link", "<a>...")` then `res.setHeader("Link", "<b>...")` | `Link: <b>...` (first lost) |

**Rule**: always use `addHeader` from `@solid/community-server`. Reserve raw `response.setHeader` for cases where you really want overwrite semantics (`Content-Type`, `Location`, status-specific headers).

## Authoring a new MetadataWriter

Extend the abstract base:

```ts
import { MetadataWriter, type MetadataWriterInput, addHeader } from "@solid/community-server";

export class MyHeaderWriter extends MetadataWriter {
  public async handle(input: MetadataWriterInput): Promise<void> {
    const id = input.metadata.identifier?.value;
    if (!id) return;
    // Read predicates from input.metadata, decide what to emit
    addHeader(input.response, "X-Custom", "value");
  }
}
```

`MetadataWriterInput` is `{ response: HttpResponse, metadata: RepresentationMetadata }`. `metadata.identifier` is the target resource URL; `metadata.get(predicate)` / `metadata.getAll(predicate)` pull RDF terms.

## Wiring into the chain

Use `/components-override` against `urn:solid-server:default:MetadataWriter`. Example from `memento.json`:

```json
{
  "@id": "urn:cogitarelink:MementoLinkMetadataWriter",
  "@type": "MementoLinkMetadataWriter",
  "baseUrl": { "@id": "urn:solid-server:default:variable:baseUrl" }
},
{
  "@type": "Override",
  "overrideInstance": { "@id": "urn:solid-server:default:MetadataWriter" },
  "overrideSteps": [{
    "@type": "OverrideListInsertAfter",
    "overrideParameter": { "@id": "ah:dist/ParallelHandler.jsonld#ParallelHandler_handlers" },
    "overrideTarget": { "@id": "urn:solid-server:default:MetadataWriter_LinkRel" },
    "overrideValue": { "@id": "urn:cogitarelink:MementoLinkMetadataWriter" }
  }]
}
```

The `ParallelHandler` runs all writers concurrently (their `handle()` calls are awaited together). Order within `handlers` doesn't affect correctness if writers don't depend on each other; it does affect debugging readability.

## Two patterns we use in this codebase

### Pattern 1: Subclass `LinkRelMetadataWriter` extension via `linkRelMap`

The default `LinkRelMetadataWriter` reads predicates from RepresentationMetadata and maps them to Link rels via a runtime-configured `linkRelMap`. To add a new predicate-to-rel mapping, override the instance:

```json
{
  "@type": "Override",
  "overrideInstance": { "@id": "urn:solid-server:default:MetadataWriter_LinkRel" },
  "overrideParameters": {
    "@type": "LinkRelMetadataWriter",
    "linkRelMap": [
      { "LinkRelMetadataWriter:_linkRelMap_key": "<predicate-iri>",
        "LinkRelMetadataWriter:_linkRelMap_value": "<rel-string>" }
    ]
  }
}
```

Used in `css/config/solid-config.json` for `ldp:constrainedBy → rel="http://www.w3.org/ns/ldp#constrainedBy"`. The catch: this approach requires you to actually inject the corresponding RDF predicate into RepresentationMetadata somewhere — usually via a `ConstantMetadataWriter` or a metadata-injection handler that runs before serialization.

### Pattern 2: Standalone MetadataWriter that always emits

When the header should ALWAYS appear for matching resources (regardless of injected metadata), write a dedicated MetadataWriter. Example: `MementoLinkMetadataWriter` (`css/extensions/memento/src/MementoLinkMetadataWriter.ts`) always advertises `rel="timemap"` and `rel="timegate"` plus `Vary: accept-datetime` on every response whose target is under the Pod's `baseUrl`, regardless of whether the metadata graph carries any predicates about it. This is the RFC 7089 §4.1.1 advertisement pattern (D67).

The trade-off: less data-driven (won't reflect changes in the metadata graph), but simpler — you don't need a metadata-injector + a linkRelMap entry, just one writer.

## Common pitfalls

1. **Bypassing the pipeline by writing directly to `response.setHeader`** in a HttpHandler. Anything written before CSS's MetadataWriter pass may be overwritten; anything written after may be lost if the response has already flushed. Prefer returning a `ResponseDescription` (from an OperationHttpHandler) or contributing via a MetadataWriter.

2. **Forgetting that `MetadataWriterInput.metadata` may be `undefined`** for error responses. Check before reading.

3. **Conditional emission**: don't emit unconditionally if the target isn't a regular resource. Filter on `metadata.identifier?.value` being a real Pod URL (use `isUnderBaseUrl` from `css/extensions/memento/src/uri.ts` or a similar helper).

## Reference implementations in this repo

- `css/extensions/memento/src/MementoLinkMetadataWriter.ts` — always-on Memento advertisement (D67)
- `css/config/solid-config.json` — `LinkRelMetadataWriter` override for `ldp:constrainedBy`

## Related skills

- `/components-override` — Override syntax for wiring writers into the chain
- `/css-extension` — scaffolding the extension that contains the writer
- `/solid-spec` — protocol context for which headers belong on which response classes
