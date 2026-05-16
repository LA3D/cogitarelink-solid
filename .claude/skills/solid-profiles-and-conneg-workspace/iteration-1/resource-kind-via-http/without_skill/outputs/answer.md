# Surfacing Solid resource kind over HTTP

You want HTTP clients to tell `Project` / `Task` / `Milestone` / `Person` apart
**without parsing the body or fetching the `.meta` sidecar**. There are three
standard mechanisms that compose well in a Solid/LDP setting; use them together
rather than choosing one.

## The three mechanisms

1. **`Link: <…>; rel="type"`** (RFC 8288 + Solid Protocol §3.1.5) — the
   primary, body-free way to declare an RDF `rdf:type` for the resource. Solid
   already uses this for `ldp:Resource`, `ldp:Container`, etc. Add one
   `Link rel="type"` per type IRI. Clients can read these from a `HEAD`.
2. **`Link: <…>; rel="describedby"`** — points at the `.meta` sidecar so
   clients that *do* want the full RDF know where to look. Already standard
   in CSS.
3. **`Link: <…>; rel="profile"`** + content-type `profile` parameter
   (RFC 6906 + RFC 7284) — declares the *application profile* the
   representation conforms to (your SHACL shape + JSON-LD context). This is
   what lets a client say "give me the Task profile" via `Accept` /
   `Accept-Profile` and lets the server answer with the matching JSON-LD
   context.

Optionally a custom `Link rel="http://www.w3.org/ns/ldp#constrainedBy"` pointing
at the SHACL shape (LDP §4.2.1.6) advertises the write-time constraints.

Do **not** invent an `X-Resource-Kind:` header — there is no need, and it
won't federate. RDF-typed `Link rel="type"` is the conformant equivalent and
agents already know how to read it.

## Vocabulary choice

Mint one IRI per kind in your project ontology, e.g.
`https://example.org/pm#Task`, and subclass an upper type so generic LDP
clients still understand the resource:

```turtle
@prefix pm:   <https://example.org/pm#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix prov: <http://www.w3.org/ns/prov#> .

pm:Task a rdfs:Class ;
  rdfs:subClassOf prov:Entity ;
  rdfs:label "Task" .
```

Publish a JSON-LD context per kind (`/contexts/task.jsonld`) and a SHACL shape
per kind (`/shapes/task.shacl.ttl`). Both are dereferenceable; the HTTP profile
URI is the shape (or a stable profile IRI that itself links to shape + context).

## Example: a Task resource

### `.meta` sidecar (Turtle)

```turtle
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix ldp:  <http://www.w3.org/ns/ldp#> .
@prefix pm:   <https://example.org/pm#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .

<>  a pm:Task , prov:Entity , ldp:RDFSource ;
    dct:title       "Wire up CSS extension for projection" ;
    dct:created     "2026-05-16T14:02:00Z"^^xsd:dateTime ;
    pm:status       pm:InProgress ;
    pm:assignee     </people/chuck#me> ;
    pm:partOf       </projects/solid-pm> ;
    pm:dueDate      "2026-05-20"^^xsd:date ;
    dct:conformsTo  <https://example.org/pm/profiles/task> ;
    sh:shape        <https://example.org/pm/shapes/task> .
```

Two things to notice:

- `a pm:Task` is the *authoritative* type assertion in RDF. The HTTP
  `Link rel="type"` headers below are a **projection** of these types into
  the HTTP layer.
- `dct:conformsTo` names the **profile** IRI; `sh:shape` (or
  `ldp:constrainedBy`) names the SHACL shape. Profile ≠ shape, but it's fine
  to make the shape's IRI the profile IRI for v1.

### HTTP response headers

For `GET /tasks/wire-up-css-extension` (or `HEAD`):

```http
HTTP/1.1 200 OK
Content-Type: text/markdown; profile="https://example.org/pm/profiles/task"
Link: <https://example.org/pm#Task>;       rel="type"
Link: <http://www.w3.org/ns/prov#Entity>;  rel="type"
Link: <http://www.w3.org/ns/ldp#Resource>; rel="type"
Link: <http://www.w3.org/ns/ldp#RDFSource>;rel="type"
Link: <wire-up-css-extension.meta>;        rel="describedby"
Link: <https://example.org/pm/profiles/task>; rel="profile"
Link: <https://example.org/pm/shapes/task>;   rel="http://www.w3.org/ns/ldp#constrainedBy"
Link: <https://example.org/pm/contexts/task.jsonld>; rel="http://www.w3.org/ns/json-ld#context"
Vary: Accept, Accept-Profile
Accept-Post: text/turtle, application/ld+json, text/markdown
ETag: "…"
```

If the client requests `Accept: application/ld+json` the server responds with
the same `profile` parameter on the JSON-LD `Content-Type` and the matching
context:

```http
Content-Type: application/ld+json; profile="https://example.org/pm/profiles/task"
Link: <https://example.org/pm/contexts/task.jsonld>; rel="http://www.w3.org/ns/json-ld#context"
```

### What each header buys you

| Header | Body-free signal it carries |
|---|---|
| `Link rel="type" <pm:Task>` | the resource *is* a Task in RDF terms |
| `Link rel="type" <prov:Entity>` | generic agents that don't know `pm:` can still treat it as a PROV entity |
| `Link rel="type" <ldp:RDFSource>` | LDP clients know how to PATCH/PUT it |
| `Link rel="describedby"` | where the `.meta` sidecar lives |
| `Link rel="profile"` + `Content-Type ;profile=` | which SHACL/JSON-LD profile the bytes conform to (RFC 6906/7284) |
| `Link rel="…ldp#constrainedBy"` | which SHACL shape governs writes |
| `Link rel="…json-ld#context"` | JSON-LD context to interpret the body (relevant when Accept negotiates JSON-LD) |
| `Vary: Accept, Accept-Profile` | caching correctness when content/profile-negotiated |

### Profile-based content negotiation (optional, very useful)

If you want clients to ask for a specific kind/profile explicitly, support
`Accept-Profile` (RFC 7284):

```http
GET /tasks/wire-up-css-extension
Accept: application/ld+json
Accept-Profile: <https://example.org/pm/profiles/task>
```

Server answers with `Content-Profile: <…>` echoing the profile actually
served. This is the cleanest way to let a generic Solid client say "I want
the Task framing of this thing," and it's the same pattern DCAT-AP, the
DXWG profile-guidance work, and most modern RDF servers have settled on.

## Why this design rather than alternatives

- **Don't put kind only in `.meta`.** It works but forces a second HTTP round
  trip for *every* listing — agents browsing a container can't filter without
  fetching N sidecars. `Link rel="type"` lets a single `HEAD` answer "is this
  a Task?" cheaply.
- **Don't use a custom header.** `X-Resource-Kind: Task` is non-standard, no
  cache or proxy understands it, and other Solid clients won't look at it.
  `Link rel="type"` is the RDF-native equivalent and is already how Solid
  declares LDP types — extend the pattern, don't invent a parallel one.
- **Don't conflate "type" and "profile".** `pm:Task` is *what the thing is*;
  the profile is *which serialization+constraints the bytes conform to*. A
  single Task could be served against multiple profiles (e.g. a "minimal" and
  a "full" profile). Keeping them on separate `Link` relations preserves that
  flexibility and is what RFC 6906 was designed for.
- **Subclass an upper type.** `pm:Task ⊑ prov:Entity` (or `schema:Action`,
  pick one) means generic agents that don't know your `pm:` ontology still
  get something useful from the `Link rel="type"` chain. This is the same
  reason CSS emits both `ldp:Resource` and `ldp:RDFSource`.

## Implementation sketch for CSS

In CSS, write-time hooks that emit headers are `MetadataWriter`s composed via
a `ParallelHandler`. Add a `ResourceKindMetadataWriter` that reads `rdf:type`
triples from the resource's `.meta`, emits one `Link rel="type"` per type,
plus a `Link rel="profile"` derived from `dct:conformsTo`, plus the
`Content-Type ;profile=` parameter. Compose it alongside the existing
`LinkRelMetadataWriter` (which already handles `describedby`) — `addHeader`
accumulates, so the writers don't collide.

The shape lookup (`ldp:constrainedBy`) comes from a small Type-Index-like
table keyed on `rdf:type` → shape IRI, so the writer doesn't have to parse
the shape file itself.

## Summary

- Declare kind in `.meta` with `rdf:type pm:Task` (authoritative).
- Project that into HTTP via `Link rel="type"` for each type IRI in the
  subclass chain.
- Add `Link rel="profile"` + `Content-Type ;profile=` (RFC 6906) so clients
  can negotiate by profile and discover the JSON-LD context.
- Add `Link rel="…ldp#constrainedBy"` for the SHACL shape (LDP §4.2.1.6).
- Keep `Link rel="describedby"` for the `.meta` sidecar.
- Support `Accept-Profile` / `Content-Profile` (RFC 7284) for explicit
  profile-based conneg.
- Don't invent custom `X-*` headers.

A `HEAD` request now answers "what kind of resource is this and what does it
conform to?" with zero body bytes — which is exactly what you asked for.
