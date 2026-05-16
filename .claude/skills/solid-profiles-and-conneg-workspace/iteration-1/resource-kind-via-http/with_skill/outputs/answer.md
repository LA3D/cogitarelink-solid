# Resource kind over HTTP for a project-management Pod

## The design pattern in one line

Use the **W3C Profile stack**: declare a `prof:Profile` per resource flavor, point instance data at it via `dct:conformsTo`, and advertise the profile per response with **`Link: <…>; rel="profile"`** (RFC 6906). SHACL shape and JSON-LD context are **artifacts inside the profile**, not the profile itself.

## Why not just rely on `rdf:type`?

`rdf:type` lives inside the body (or `.meta` sidecar). A plain HTTP client that does a `HEAD` — or a GET that hasn't yet parsed RDF — can't see it. RFC 6906 gives you the missing affordance: a header-level hint that says "this representation conforms to *this* profile," which is a stable URI that names the kind, links to the SHACL shape, and links to the JSON-LD context.

Three rules from the skill:

1. **Class IRI ≠ Profile IRI.** `pm:Task` is an `owl:Class`; `pm:TaskProfile` (at `/meta/profiles/task`) is a `prof:Profile`. Instance data declares **both**.
2. **SHACL shapes and JSON-LD contexts are artifacts**, wired via `prof:ResourceDescriptor` with `prof:hasRole role:validation` / `role:schema`.
3. **Emit `prof:isTransitiveProfileOf` explicitly.** PROF §8.4.2's `dct:conformsTo` chain axiom is flagged at-risk (Issue 1078) — don't make clients run a reasoner.

## Caveats on standards status

- **RFC 6906 `Link: rel="profile"`** is IETF Proposed Standard — authoritative.
- **W3C PROF** is a Dec 2019 WG Note (not REC). §7/§8/§11 are normative within the Note.
- **W3C Conneg-by-Profile** is a Working Draft (Oct 2023); patterns are stable but never reached REC.
- **Do NOT use** the expired `draft-svensson-accept-profile-00` (`Content-Profile` header). Use `Link: rel="profile"` instead.

---

## Profile catalog layout for your four flavors

```
/meta/profiles/
  project          (pm:ProjectProfile)
  task             (pm:TaskProfile)
  milestone        (pm:MilestoneProfile)
  person           (pm:PersonProfile)
```

Each is a `prof:Profile` carrying its SHACL shape (validation), JSON-LD context (schema), vocabulary doc, and optional examples/spec.

---

## Example Turtle — the Task case

Substitute `https://pm.example.org/` with your Pod host. `pm:` is your project-management vocabulary.

### 1. The profile descriptor at `/meta/profiles/task`

```turtle
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix prof:   <http://www.w3.org/ns/dx/prof/> .
@prefix role:   <http://www.w3.org/ns/dx/prof/role/> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
@prefix pm:     <https://pm.example.org/ontology/pm#> .

<https://pm.example.org/meta/profiles/task>
  a prof:Profile ;
  rdfs:label "Project-Management Task profile" ;
  rdfs:comment "Profile constraining pm:Task resources: SHACL shape, JSON-LD context, vocabulary." ;
  dct:publisher <https://orcid.org/0000-0003-4091-6059> ;
  prof:hasToken "pm-task"^^xsd:token ;

  # Parent profile (if Task profiles a generic 'workitem' profile, chain it).
  # Always pre-flatten transitivity — don't rely on the at-risk §8.4.2 axiom.
  prof:isProfileOf            <https://pm.example.org/meta/profiles/workitem> ;
  prof:isTransitiveProfileOf  <https://pm.example.org/meta/profiles/workitem> ,
                              <https://solidproject.org/TR/protocol> ;

  prof:hasResource
    <https://pm.example.org/meta/profiles/task#shape> ,
    <https://pm.example.org/meta/profiles/task#context> ,
    <https://pm.example.org/meta/profiles/task#vocab> ,
    <https://pm.example.org/meta/profiles/task#spec> ,
    <https://pm.example.org/meta/profiles/task#example> .

# SHACL shape — validation
<https://pm.example.org/meta/profiles/task#shape>
  a prof:ResourceDescriptor ;
  rdfs:label "SHACL shape for pm:Task" ;
  dct:conformsTo <https://www.w3.org/TR/shacl/> ;
  dct:format "text/turtle" ;
  prof:hasRole role:validation ;
  prof:hasArtifact <https://pm.example.org/meta/shapes/task.shacl.ttl> .

# JSON-LD context — schema (machine-readable structure)
<https://pm.example.org/meta/profiles/task#context>
  a prof:ResourceDescriptor ;
  rdfs:label "JSON-LD context for pm:Task" ;
  dct:format "application/ld+json" ;
  prof:hasRole role:schema ;
  prof:hasArtifact <https://pm.example.org/meta/contexts/task.jsonld> .

# Vocabulary doc
<https://pm.example.org/meta/profiles/task#vocab>
  a prof:ResourceDescriptor ;
  rdfs:label "pm vocabulary (Turtle)" ;
  dct:format "text/turtle" ;
  prof:hasRole role:vocabulary ;
  prof:hasArtifact <https://pm.example.org/ontology/pm> .

# Human-readable spec
<https://pm.example.org/meta/profiles/task#spec>
  a prof:ResourceDescriptor ;
  rdfs:label "Task profile specification (HTML)" ;
  dct:format "text/html" ;
  prof:hasRole role:specification ;
  prof:hasArtifact <https://pm.example.org/docs/pm/task> .

# Worked example
<https://pm.example.org/meta/profiles/task#example>
  a prof:ResourceDescriptor ;
  rdfs:label "Example Task resource" ;
  dct:format "text/markdown" ;
  prof:hasRole role:example ;
  prof:hasArtifact <https://pm.example.org/tasks/2026-05-16-write-docs> .
```

### 2. Instance data — `/tasks/2026-05-16-write-docs.meta`

Declares **both** kind (`rdf:type`) and constraints (`dct:conformsTo`):

```turtle
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix pm:   <https://pm.example.org/ontology/pm#> .

<https://pm.example.org/tasks/2026-05-16-write-docs>
  a pm:Task ;
  dct:conformsTo <https://pm.example.org/meta/profiles/task> ;
  pm:assignee    <https://pm.example.org/people/cvardeman> ;
  pm:project     <https://pm.example.org/projects/solid-pod> ;
  pm:status      "in-progress" ;
  pm:dueDate     "2026-05-20"^^xsd:date .
```

### 3. Storage description — advertise the catalog

So agents arriving cold can discover that profiles exist:

```turtle
# In /vault/.well-known/solid (or wherever your storage description lives)
<>
  rdfs:seeAlso       <https://pm.example.org/meta/profiles/> ;
  pm:profileCatalog  <https://pm.example.org/meta/profiles/> .
```

---

## HTTP response headers the server must emit

For `GET /tasks/2026-05-16-write-docs`:

```http
HTTP/1.1 200 OK
Content-Type: text/markdown
Link: <https://pm.example.org/meta/profiles/task>; rel="profile"
Link: <https://pm.example.org/tasks/2026-05-16-write-docs.meta>; rel="describedby"
Link: <https://pm.example.org/meta/shapes/task.shacl.ttl>; rel="http://www.w3.org/ns/ldp#constrainedBy"
Link: <https://pm.example.org/meta/profiles/task>; rel="type"
Vary: Accept, Accept-Profile
```

Key points:

- **`Link: …; rel="profile"`** — the load-bearing header per RFC 6906. This is what a client uses to learn "this is a Task" without parsing the body.
- **`Link: …; rel="describedby"`** — Solid's standard pointer to the `.meta` sidecar.
- **`Link: …; rel="http://www.w3.org/ns/ldp#constrainedBy"`** — LDP's standard pointer to the SHACL shape governing writes.
- **`Vary: Accept-Profile`** — required when the server can return different representations per profile (conneg-by-profile).
- **Do NOT emit `Content-Profile:`** — that header lives only in the expired Svensson draft.

### Catalog response (`GET /tasks/2026-05-16-write-docs?_profile=alt`)

Per conneg-by-profile §7.2.1, advertise what profile × media-type combinations are available. The non-obvious detail is that the `format=` Link parameter carries the **profile URI**, not the media type:

```http
HTTP/1.1 200 OK
Content-Type: text/markdown
Link: <https://pm.example.org/meta/profiles/task>; rel="profile"
Link: <https://pm.example.org/tasks/2026-05-16-write-docs>;
        rel="canonical"; type="text/markdown";
        format="https://pm.example.org/meta/profiles/task",
      <https://pm.example.org/tasks/2026-05-16-write-docs>;
        rel="alternate"; type="text/turtle";
        format="https://pm.example.org/meta/profiles/task",
      <https://pm.example.org/tasks/2026-05-16-write-docs?_profile=pm-workitem>;
        rel="alternate"; type="application/ld+json";
        format="https://pm.example.org/meta/profiles/workitem"
Vary: Accept, Accept-Profile
```

The reserved token is `alt` (NOT `alternates` — common mistake).

### Client-side profile request

A client can ask for a specific profile two ways (server MUST accept both per §7.3):

```http
GET /tasks/2026-05-16-write-docs HTTP/1.1
Accept: application/ld+json
Accept-Profile: <https://pm.example.org/meta/profiles/task>
```

Or via QSA, using either the token or the full URI:

```
GET /tasks/2026-05-16-write-docs?_profile=pm-task&_mediatype=application/ld+json
```

When the server honors `Accept-Profile`, conneg-by-profile §7.2.2 requires it to echo the served profile back in `Link: rel="profile"`.

---

## Implementation note for CSS

In Community Solid Server, add a `MetadataWriter` (compose with the existing `MetadataWriter_LinkRel`, don't replace — use `addHeader` so Link entries accumulate). Pattern is identical to the `MementoLinkMetadataWriter` shipped in `css/extensions/memento/` (D67). Read `dct:conformsTo` from the resource's `.meta`, emit `Link: <…>; rel="profile"` and the `Vary: Accept-Profile` header. The `metadata-writer` builder skill in this repo has the recipe.

---

## Summary

| Concern | Where it lives |
|---|---|
| What KIND of thing this is | `rdf:type pm:Task` in `.meta` body |
| What CONSTRAINTS apply | `dct:conformsTo </meta/profiles/task>` in `.meta` body |
| HTTP-level kind hint | `Link: </meta/profiles/task>; rel="profile"` response header |
| SHACL shape pointer | `prof:hasResource` with `role:validation` inside the profile (also surfaced as LDP `constrainedBy` Link header) |
| JSON-LD context pointer | `prof:hasResource` with `role:schema` inside the profile |
| Discovery from cold | Storage description → `rdfs:seeAlso` + typed `pm:profileCatalog` predicate → `/meta/profiles/` LDP container |
| Alternate representations | `Vary: Accept-Profile` + `?_profile=alt` catalog response |

Profile URI is the stable handle. The class IRI tells agents *what it is*; the profile IRI tells them *which artifacts govern it*. Headers carry both pieces so clients never have to parse the body to find out.
