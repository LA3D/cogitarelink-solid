# Ready-to-paste Templates

PROF Turtle templates and HTTP response shapes you can lift directly. All use the production form per [`deltas.md`](deltas.md) — HTTPS, port-less, hash-namespace, no extension.

---

## Template A — Declare a profile (with token, parent, label)

```turtle
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix prof: <http://www.w3.org/ns/dx/prof/> .
@prefix role: <http://www.w3.org/ns/dx/prof/role/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .

<https://pod.vardeman.me/vault/meta/profiles/concept>
  a prof:Profile ;
  rdfs:label "Wiki-Memory L3 — Concept page profile" ;
  rdfs:comment "Profile constraining wiki:Concept pages on this Pod." ;
  dct:publisher <https://orcid.org/0000-0003-4091-6059> ;
  prof:hasToken "wiki-concept"^^xsd:token ;
  prof:isProfileOf <https://pod.vardeman.me/vault/meta/profiles/page> ;
  prof:hasResource
    <https://pod.vardeman.me/vault/meta/profiles/concept/shape> ,
    <https://pod.vardeman.me/vault/meta/profiles/concept/context> ,
    <https://pod.vardeman.me/vault/meta/profiles/concept/vocab> .
```

---

## Template B — Profile chain (profile-of-profile-of-spec)

```turtle
# Root: Solid Protocol (a dct:Standard, NOT a profile)
<https://solidproject.org/TR/protocol>
  a dct:Standard ;
  rdfs:label "Solid Protocol v0.11.0" .

# Mid: wiki-memory page-as-unit profile (profiles the Solid Protocol)
<https://pod.vardeman.me/vault/meta/profiles/page>
  a prof:Profile ;
  prof:hasToken "wiki-page"^^xsd:token ;
  prof:isProfileOf <https://solidproject.org/TR/protocol> .

# Leaf: concept profile (profiles the page profile)
<https://pod.vardeman.me/vault/meta/profiles/concept>
  a prof:Profile ;
  prof:hasToken "wiki-concept"^^xsd:token ;
  prof:isProfileOf <https://pod.vardeman.me/vault/meta/profiles/page> ;
  # Emit the full ancestor chain EXPLICITLY (don't rely on reasoners — Issue 1078 at-risk)
  prof:isTransitiveProfileOf
    <https://pod.vardeman.me/vault/meta/profiles/page> ,
    <https://solidproject.org/TR/protocol> .
```

---

## Template C — ResourceDescriptors with varied roles

```turtle
<https://pod.vardeman.me/vault/meta/profiles/concept/shape>
  a prof:ResourceDescriptor ;
  rdfs:label "SHACL shape for wiki:Concept" ;
  dct:conformsTo <https://www.w3.org/TR/shacl/> ;
  dct:format "text/turtle" ;
  prof:hasRole role:validation ;
  prof:hasArtifact <https://pod.vardeman.me/vault/meta/shapes/concept.shacl.ttl> .

<https://pod.vardeman.me/vault/meta/profiles/concept/context>
  a prof:ResourceDescriptor ;
  rdfs:label "JSON-LD context for wiki:Concept" ;
  dct:format "application/ld+json" ;
  prof:hasRole role:schema ;
  prof:hasArtifact <https://pod.vardeman.me/vault/meta/context.jsonld> .

<https://pod.vardeman.me/vault/meta/profiles/concept/vocab>
  a prof:ResourceDescriptor ;
  rdfs:label "wiki vocabulary" ;
  dct:format "text/turtle" ;
  prof:hasRole role:vocabulary ;
  prof:hasArtifact <https://pod.vardeman.me/vault/ontology/wiki> .

<https://pod.vardeman.me/vault/meta/profiles/concept/spec>
  a prof:ResourceDescriptor ;
  rdfs:label "Wiki-Memory L3 specification" ;
  dct:format "text/html" ;
  prof:hasRole role:specification ;
  prof:hasArtifact <https://pod.vardeman.me/vault/docs/wiki-memory-l3> .

<https://pod.vardeman.me/vault/meta/profiles/concept/example>
  a prof:ResourceDescriptor ;
  rdfs:label "Worked example: a wiki:Concept page" ;
  dct:format "text/markdown" ;
  prof:hasRole role:example ;
  prof:hasArtifact <https://pod.vardeman.me/vault/wiki/pages/context-graphs> .

# CUSTOM ROLE — for D52 affordance descriptors that don't fit role:* registry
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wiki/role#> .

wikirole:affordance
  a prof:ResourceRole ;
  rdfs:label "affordance descriptor" ;
  skos:definition "Machine-actionable affordance descriptor (D52) — declares a substrate capability accessible to agents." .

<https://pod.vardeman.me/vault/meta/profiles/concept/affordance>
  a prof:ResourceDescriptor ;
  rdfs:label "Markdown-projection affordance for wiki:Concept" ;
  dct:format "text/turtle" ;
  prof:hasRole wikirole:affordance ;
  prof:hasArtifact <https://pod.vardeman.me/vault/meta/affordances/markdown-projection> .
```

---

## Template D — Instance data declaring conformance

```turtle
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .

<https://pod.vardeman.me/vault/wiki/pages/context-graphs>
  a wiki:Concept ;                                                # what KIND
  dct:conformsTo <https://pod.vardeman.me/vault/meta/profiles/concept> .  # what CONSTRAINTS

# Via the PROF §8.4.2 property chain (at-risk Issue 1078), a reasoner would infer:
#   dct:conformsTo <…/page> ,
#                  <https://solidproject.org/TR/protocol>
# Don't rely on this. If clients need the chain, emit it explicitly OR query the
# profile itself (which DOES include prof:isTransitiveProfileOf per Template B).
```

---

## Template E — HTTP list-profiles response (per conneg-by-profile §7.2.1)

A `HEAD` or `GET` on a resource with `Accept-Profile` set, or a plain `GET` with `_profile=alt`, should return Link headers listing each available profile × media-type combination. The `format=` parameter carries the **profile URI** — this is the non-obvious detail.

```http
HTTP/1.1 200 OK
Content-Type: text/markdown
Link: <https://pod.vardeman.me/vault/meta/profiles/concept>; rel="profile"
Link: <https://pod.vardeman.me/vault/wiki/pages/context-graphs>;
        rel="canonical"; type="text/markdown";
        format="https://pod.vardeman.me/vault/meta/profiles/concept",
      <https://pod.vardeman.me/vault/wiki/pages/context-graphs>;
        rel="alternate"; type="text/turtle";
        format="https://pod.vardeman.me/vault/meta/profiles/concept",
      <https://pod.vardeman.me/vault/wiki/pages/context-graphs?_profile=wiki-page>;
        rel="alternate"; type="text/markdown";
        format="https://pod.vardeman.me/vault/meta/profiles/page"
```

The single `rel="profile"` Link advertises the *default* profile served. The multiple `rel="canonical"`/`rel="alternate"` Links advertise the **catalog** of profile × media-type combinations available.

---

## Template F — Vocabulary file at extension-less path

The vocabulary file lives at the path that matches the namespace IRI (minus the hash). For namespace `https://pod.vardeman.me/vault/ontology/wiki#`, the file is at `/vault/ontology/wiki` — no `.ttl` extension.

```turtle
# File: PUT to https://pod.vardeman.me/vault/ontology/wiki
# Content-Type: text/turtle
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix dct:  <http://purl.org/dc/terms/> .

<https://pod.vardeman.me/vault/ontology/wiki>
  a owl:Ontology ;
  dct:title "wiki — wiki-memory L3 application vocabulary" ;
  rdfs:label "wiki" ;
  owl:versionIRI <https://pod.vardeman.me/vault/ontology/wiki/v1> .

wiki:Page a owl:Class ;
  rdfs:label "Page" ;
  rdfs:comment "A wiki-memory page; base class for Concept, Source, Person, Procedure, WorkingNote." .

wiki:Concept a owl:Class ;
  rdfs:subClassOf wiki:Page ;
  rdfs:label "Concept" ;
  rdfs:comment "A page representing a concept, theory, method, or finding." .

# ... etc
```

CSS auto-converts when fetched with `Accept: application/ld+json`:

```bash
curl -H "Accept: application/ld+json" https://pod.vardeman.me/vault/ontology/wiki
# → 200 OK, application/ld+json — same triples, different serialization
```

Fragment dereferencing:

```bash
# Agent encounters wiki:Page in an .meta file
# Strips fragment → fetches the vocabulary document
curl -H "Accept: text/turtle" https://pod.vardeman.me/vault/ontology/wiki
# → 200 OK with full vocabulary; agent extracts triples about wiki:Page
```

---

## Template G — Storage description advertising profile catalog

```turtle
# Added to the storage container's .meta or via overlay storage-patch:
<>
  rdfs:seeAlso <https://pod.vardeman.me/vault/meta/profiles/> .

# OR a typed predicate from the wiki vocabulary:
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
<>
  wiki:profileCatalog <https://pod.vardeman.me/vault/meta/profiles/> .
```

The profile catalog container is browseable via LDP `ldp:contains`; each contained `.ttl` is a `prof:Profile` declaration following Template A or B.
