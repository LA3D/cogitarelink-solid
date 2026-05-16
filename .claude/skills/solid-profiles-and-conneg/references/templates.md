# PROF + Conneg — Templates

Paste-ready Turtle for declaring profiles, and the HTTP response shape conneg-by-profile expects. The example URIs use `https://pod.example.org/` — substitute your Pod host.

---

## Template A — Declare a profile (token, parent, label)

```turtle
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix prof: <http://www.w3.org/ns/dx/prof/> .
@prefix role: <http://www.w3.org/ns/dx/prof/role/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix wiki: <https://pod.example.org/ontology/wiki#> .

<https://pod.example.org/meta/profiles/concept>
  a prof:Profile ;
  rdfs:label "Wiki-Memory Concept page profile" ;
  rdfs:comment "Profile constraining wiki:Concept pages." ;
  dct:publisher <https://orcid.org/0000-0000-0000-0000> ;
  prof:hasToken "wiki-concept"^^xsd:token ;
  prof:isProfileOf <https://pod.example.org/meta/profiles/page> ;
  prof:hasResource
    <https://pod.example.org/meta/profiles/concept#shape> ,
    <https://pod.example.org/meta/profiles/concept#context> ,
    <https://pod.example.org/meta/profiles/concept#vocab> .
```

---

## Template B — Profile chain (profile-of-profile-of-spec)

Always emit `prof:isTransitiveProfileOf` explicitly. The PROF chain axiom is at-risk; pre-flatten so clients don't need a reasoner.

```turtle
# Root: Solid Protocol (a dct:Standard, not a profile)
<https://solidproject.org/TR/protocol>
  a dct:Standard ;
  rdfs:label "Solid Protocol v0.11.0" .

# Mid: page profile (profiles the Solid Protocol)
<https://pod.example.org/meta/profiles/page>
  a prof:Profile ;
  prof:hasToken "wiki-page"^^xsd:token ;
  prof:isProfileOf <https://solidproject.org/TR/protocol> .

# Leaf: concept profile (profiles the page profile)
<https://pod.example.org/meta/profiles/concept>
  a prof:Profile ;
  prof:hasToken "wiki-concept"^^xsd:token ;
  prof:isProfileOf <https://pod.example.org/meta/profiles/page> ;
  # Emit full ancestor chain EXPLICITLY (don't rely on reasoners — Issue 1078 at-risk)
  prof:isTransitiveProfileOf
    <https://pod.example.org/meta/profiles/page> ,
    <https://solidproject.org/TR/protocol> .
```

---

## Template C — ResourceDescriptors with varied roles

```turtle
<https://pod.example.org/meta/profiles/concept#shape>
  a prof:ResourceDescriptor ;
  rdfs:label "SHACL shape for wiki:Concept" ;
  dct:conformsTo <https://www.w3.org/TR/shacl/> ;  # what spec the artifact follows
  dct:format "text/turtle" ;
  prof:hasRole role:validation ;
  prof:hasArtifact <https://pod.example.org/meta/shapes/concept.shacl.ttl> .

<https://pod.example.org/meta/profiles/concept#context>
  a prof:ResourceDescriptor ;
  rdfs:label "JSON-LD context for wiki vocabulary" ;
  dct:format "application/ld+json" ;
  prof:hasRole role:schema ;
  prof:hasArtifact <https://pod.example.org/meta/context.jsonld> .

<https://pod.example.org/meta/profiles/concept#vocab>
  a prof:ResourceDescriptor ;
  rdfs:label "wiki vocabulary (Turtle)" ;
  dct:format "text/turtle" ;
  prof:hasRole role:vocabulary ;
  prof:hasArtifact <https://pod.example.org/ontology/wiki> .

<https://pod.example.org/meta/profiles/concept#spec>
  a prof:ResourceDescriptor ;
  rdfs:label "Human-readable specification" ;
  dct:format "text/html" ;
  prof:hasRole role:specification ;
  prof:hasArtifact <https://pod.example.org/docs/wiki-memory> .

<https://pod.example.org/meta/profiles/concept#example>
  a prof:ResourceDescriptor ;
  rdfs:label "Worked example concept page" ;
  dct:format "text/markdown" ;
  prof:hasRole role:example ;
  prof:hasArtifact <https://pod.example.org/wiki/pages/context-graphs> .
```

### Custom role example

When the 8 standard roles don't fit, mint one. Document it with `skos:definition`:

```turtle
@prefix wikirole: <https://pod.example.org/ontology/wiki/role#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

wikirole:affordance
  a prof:ResourceRole ;
  rdfs:label "affordance descriptor" ;
  skos:definition "Machine-actionable affordance descriptor declaring a substrate capability accessible to agents." .

<https://pod.example.org/meta/profiles/concept#affordance>
  a prof:ResourceDescriptor ;
  rdfs:label "Markdown-projection affordance" ;
  dct:format "text/turtle" ;
  prof:hasRole wikirole:affordance ;
  prof:hasArtifact <https://pod.example.org/meta/affordances/markdown-projection> .
```

---

## Template D — Instance data declaring conformance

Instance data declares **both** kind (`rdf:type`) and constraints (`dct:conformsTo`):

```turtle
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix wiki: <https://pod.example.org/ontology/wiki#> .

<https://pod.example.org/wiki/pages/context-graphs>
  a wiki:Concept ;                                                        # what KIND
  dct:conformsTo <https://pod.example.org/meta/profiles/concept> .        # what CONSTRAINTS

# Via PROF §8.4.2 property chain (at-risk Issue 1078), a reasoner WOULD infer:
#   dct:conformsTo <…/profiles/page> , <https://solidproject.org/TR/protocol>
# Don't rely on this. If clients need the chain, they can fetch the profile —
# Template B's prof:isTransitiveProfileOf gives them everything without reasoning.
```

---

## Template E — HTTP list-profiles response (conneg-by-profile §7.2.1)

Server response to `HEAD` or `GET` (with `Accept-Profile` set, or with `?_profile=alt`). The `format=` Link parameter carries the **profile URI** — this is the non-obvious detail:

```http
HTTP/1.1 200 OK
Content-Type: text/markdown
Link: <https://pod.example.org/meta/profiles/concept>; rel="profile"
Link: <https://pod.example.org/wiki/pages/context-graphs>;
        rel="canonical"; type="text/markdown";
        format="https://pod.example.org/meta/profiles/concept",
      <https://pod.example.org/wiki/pages/context-graphs>;
        rel="alternate"; type="text/turtle";
        format="https://pod.example.org/meta/profiles/concept",
      <https://pod.example.org/wiki/pages/context-graphs?_profile=wiki-page>;
        rel="alternate"; type="text/markdown";
        format="https://pod.example.org/meta/profiles/page"
```

The single `rel="profile"` Link advertises the **default profile** served for this representation. The multiple `rel="canonical"`/`rel="alternate"` Links advertise the **catalog** of profile × media-type combinations available.

---

## Template F — Profile catalog discovery from storage description

Tell agents where the profile catalog lives. Two patterns work together — use both:

```turtle
# In the storage container's .meta, or via overlay storage-patch
<>
  rdfs:seeAlso <https://pod.example.org/meta/profiles/> ;  # generic LDP-crawlable
  wiki:profileCatalog <https://pod.example.org/meta/profiles/> .  # typed, for fast discovery
```

The `rdfs:seeAlso` works for any LDP-aware agent doing follow-your-nose. The typed `wiki:profileCatalog` predicate (defined in your app vocabulary) gives agents a direct, named pointer.

---

## Template G — Server: request resource in a specific profile

What an agent emits when it wants the resource interpreted by a specific profile. The server should respond with `Link: <…>; rel="profile"` per conneg-by-profile §7.2.2 MUST.

### Via HTTP headers

```http
GET /wiki/pages/context-graphs HTTP/1.1
Host: pod.example.org
Accept: application/ld+json
Accept-Profile: <https://pod.example.org/meta/profiles/concept>
```

### Via QSA

```
GET /wiki/pages/context-graphs?_profile=wiki-concept&_mediatype=application/ld+json
```

Token from `prof:hasToken` ("wiki-concept") OR full profile URI. Both must be accepted per §7.3.

### List-profiles introspection

```
GET /wiki/pages/context-graphs?_profile=alt
```

Server returns the Link-header catalog from Template E.

**Note**: the reserved token is `alt`, NOT `alternates`. Some implementers intuitively write `alternates`; that's not in the spec.
