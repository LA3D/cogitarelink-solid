# URI Conformance — Templates

Paste-ready snippets for vocabulary publication. PROF profile descriptor templates live in the [`solid-profiles-and-conneg`](../../solid-profiles-and-conneg/references/templates.md) skill.

---

## Template A — Vocabulary file at extension-less path

The file lives at the path that matches the namespace IRI (minus the hash). For namespace `https://pod.example.org/ontology/wiki#`, the file is at `/ontology/wiki` — no `.ttl` extension.

```turtle
# PUT to https://pod.example.org/ontology/wiki
# Content-Type: text/turtle
@prefix wiki: <https://pod.example.org/ontology/wiki#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix dct:  <http://purl.org/dc/terms/> .

<https://pod.example.org/ontology/wiki>
  a owl:Ontology ;
  dct:title "wiki — application vocabulary" ;
  rdfs:label "wiki" ;
  owl:versionIRI <https://pod.example.org/ontology/wiki/v1> .

wiki:Page a owl:Class ;
  rdfs:label "Page" ;
  rdfs:comment "Base class for typed pages in this app." .

wiki:Concept a owl:Class ;
  rdfs:subClassOf wiki:Page ;
  rdfs:label "Concept" .
```

CSS auto-converts on fetch with any RDF Accept header:

```bash
curl -H "Accept: application/ld+json" https://pod.example.org/ontology/wiki
# → 200 OK, application/ld+json — same triples, JSON-LD serialization
```

Fragment dereferencing (client strips fragment automatically):

```bash
# Agent encounters wiki:Page in some .meta file, wants to learn what it means
curl -H "Accept: text/turtle" https://pod.example.org/ontology/wiki
# → full vocabulary document; agent extracts triples about wiki:Page
```

---

## Template B — Vocabulary entry in storage description

The storage description (`/.well-known/solid` or pointed at via `Link: <…>; rel="solid:storageDescription"`) declares which vocabularies the Pod uses, per [VoID §4.3](https://www.w3.org/TR/void/#vocabularies):

```turtle
<>
  void:vocabulary
    <http://www.w3.org/2004/02/skos/core#> ,         # external standard
    <http://purl.org/dc/terms/> ,                    # external standard
    <http://www.w3.org/ns/prov#> ,                   # external standard
    <https://pod.example.org/ontology/wiki#> ,       # app-local, Pod-hosted
    <https://pod.example.org/ontology/capability#> . # app-local, Pod-hosted
```

Every IRI listed MUST be dereferenceable per D49 — either externally (W3C/standard URLs) or on the Pod itself (for app-local).

---

## Template C — Relative IRIs in PATCHes to storage container

When you PATCH the storage container's `.meta`, prefer relative IRIs so the patch is portable across Pod URL changes:

```turtle
# PATCH /vault/.meta with Content-Type: text/n3
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix void:  <http://rdfs.org/ns/void#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .

<> a solid:InsertDeletePatch ;
  solid:inserts {
    <../>
      void:vocabulary <../ontology/wiki#> ;
      rdfs:seeAlso <../wiki/pages/> .
  } .
```

`<../>` resolves to the storage root; `<../ontology/wiki#>` resolves to the app vocabulary IRI. **Caveat**: CSS resolves and stores absolute IRIs at write time, so this portability is only at the *authoring* layer, not the stored data. A Pod migration still requires rewriting stored `.meta` files.

---

## Template D — Empirical conformance test (one-off)

Drop into a fresh shell to verify CSS handles extension-less Turtle correctly on your deployment:

```bash
POD="https://your-pod-host"

# Create test resource
cat > /tmp/_test.ttl <<'EOF'
@prefix ex: <http://example.org/test#> .
ex:Foo a ex:Bar ; ex:label "test" .
EOF

curl -X PUT -H "Content-Type: text/turtle" \
  --data-binary @/tmp/_test.ttl "$POD/_uri_test"
# Expected: 201 Created

# Verify content negotiation
curl -H "Accept: text/turtle"        "$POD/_uri_test" | head
curl -H "Accept: application/ld+json" "$POD/_uri_test" | head
curl -H "Accept: application/n-triples" "$POD/_uri_test" | head

# Clean up
curl -X DELETE "$POD/_uri_test"
```

All three GETs should return 200 with the correct Content-Type and a faithful serialization of the same triples. If any fail, document the limitation and fall back to extension-suffixed file paths.
