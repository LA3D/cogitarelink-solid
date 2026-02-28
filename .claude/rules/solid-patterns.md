---
paths: ["**/*.py", "**/*.ts"]
---

# Solid Protocol Patterns

## LDP Operations (HTTP)

Solid Pods are LDP servers. All operations are standard HTTP:

```python
# Read container (GET → Turtle with ldp:contains)
GET /vault/concepts/ Accept: text/turtle

# Read resource
GET /vault/concepts/context-graphs Accept: text/turtle

# Create resource (POST to container + Slug header)
POST /vault/concepts/ Content-Type: text/turtle Slug: new-concept

# Create container (POST with Link: ldp:BasicContainer)
POST /vault/ Content-Type: text/turtle
Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"
Slug: concepts

# Update resource metadata (PATCH with SPARQL Update)
PATCH /vault/concepts/context-graphs.meta
Content-Type: application/sparql-update

# Delete resource
DELETE /vault/concepts/context-graphs
```

## .well-known/ Protocol (D12, same as fabric)

Four endpoints for self-description:
- `/.well-known/void` — VoID dataset description (CSS extension, Phase 2)
- `/.well-known/shacl` — SHACL shapes for Pod content (CSS extension, Phase 2)
- `/.well-known/sparql-examples` — behavioral SPARQL templates (CSS extension, Phase 2)
- `/.well-known/solid` — Solid server metadata (CSS-native)

## CSS .meta Sidecars

CSS stores per-resource metadata in `.meta` companion files:
- `GET /vault/concepts/context-graphs.meta` → Turtle metadata
- Created automatically by CSS for container metadata
- Vault importer writes Layer B metadata here (D10)

## WAC (Web Access Control) — Phase 1

Simple ACL model:
```turtle
# .acl file on container
@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner> a acl:Authorization ;
    acl:agent <https://localhost:3000/profile/card#me> ;
    acl:accessTo </vault/concepts/> ;
    acl:default </vault/concepts/> ;
    acl:mode acl:Read, acl:Write, acl:Control .
```

## Solid Type Index (D8)

Machine-actionable navigation — maps RDF class to container:
```turtle
@prefix solid: <http://www.w3.org/ns/solid/terms#> .

<#concepts> a solid:TypeRegistration ;
    solid:forClass skos:Concept ;
    solid:instanceContainer </vault/concepts/> .

<#projects> a solid:TypeRegistration ;
    solid:forClass <http://example.org/Project> ;
    solid:instanceContainer </vault/projects/> .
```

## WebID Profile (D14)

Agent's WebID includes DID bridge:
```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .

<#me> a foaf:Agent ;
    foaf:name "cogitarelink-solid agent" ;
    solid:oidcIssuer <https://localhost:3000/> ;
    owl:sameAs <did:webvh:{scid}:{domain}> .
```

## Maturity Landscape

| Spec | Status | Notes |
|---|---|---|
| LDP 1.0 | W3C Rec (2015) | Stable foundation |
| Solid Protocol | CG-DRAFT 0.11 | Stable for prototyping |
| WAC | CG-DRAFT 1.0 | Phase 1 auth |
| ACP | v0.9 | Phase 3: `acp:vc` matchers |
| Shape Trees | Editor's Draft | Phase 2: container validation |
| Type Index | Editor's Draft | Phase 1: coarse discovery |
