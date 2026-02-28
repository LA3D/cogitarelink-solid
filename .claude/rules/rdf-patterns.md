---
paths: ["**/*.ttl", "**/*.jsonld", "**/*.trig", "**/*.nq"]
---

# RDF Patterns

## Turtle Style
- One triple per line; blank node reuse for complex objects
- Prefix declarations at top; standard prefixes: rdf, rdfs, owl, xsd, dct, prov, skos, sh, void, prof, dcat, foaf, solid, ldp
- No semicolons on final triple of a subject block

## JSON-LD
- Use `@context` referencing shared context file, not inline
- Include `@type` on every object
- Prefer compact IRI form over full URIs

## Three-Layer Pod RDF Architecture (D10)

Content layer (not RDF): Markdown + YAML frontmatter — the document itself.

| Layer | What | Author | Format |
|---|---|---|---|
| A | LDP container structure (`ldp:contains`) | CSS (automatic) | Turtle |
| B | Resource metadata (type, frontmatter-derived predicates) | Vault importer | Turtle `.meta` sidecars |
| C | Navigation indexes (Type Index, JSON-LD, VoID) | Vault importer + adapter | Turtle / JSON-LD |

## Frontmatter → RDF Mapping (D7)

SHACL shape defines the mapping contract:
- `type: concept-note` → `skos:Concept`
- `created:` → `dcterms:created`
- `tags:` → `dcterms:subject`
- `related: [[Note]]` → `skos:related <pod-uri>`
- `up: [[MOC]]` → `dcterms:isPartOf <pod-uri>`
- `source: [[Paper]]` → `dcterms:source <pod-uri>`

## Provenance (D20)

Every `.meta` sidecar includes:
```turtle
<> prov:wasGeneratedBy [
    a prov:Activity ;
    prov:wasAssociatedWith <https://orcid.org/0000-0003-4091-6059> ;
    prov:used <file:///path/to/source.md> ;
    prov:startedAtTime "2026-02-28T..."^^xsd:dateTime
] ;
prov:wasDerivedFrom <file:///path/to/source.md> ;
prov:wasAttributedTo <https://orcid.org/0000-0003-4091-6059> .
```

## Content Integrity (D21)

Every `.meta` sidecar includes SHA-256 hash:
```turtle
<> ni:digestMultibase "z..."^^xsd:string .
```

## Named Graph Conventions (Oxigraph fabric metadata, D4)
- `/graph/catalog` — VoID descriptions of Pod content (DCAT)
- `/graph/crosswalks` — SSSOM wikilink → Pod URI mappings (D24)
- `/graph/mappings` — SSSOM vocabulary alignment (tags → SKOS, frontmatter → predicates)
- `/ontology/skos`, `/ontology/dc`, `/ontology/prov` — TBox cache (D23)

## VoID Service Description

```turtle
@prefix void: <http://rdfs.org/ns/void#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prof: <http://www.w3.org/ns/dx/prof/> .

<> a void:Dataset ;
    dct:title "Agentic Memory Research Vault Pod" ;
    dct:conformsTo <https://w3id.org/cogitarelink/fabric/CoreProfile> ;
    void:feature <feature/ldp-browse> ;
    void:vocabulary <http://www.w3.org/2004/02/skos/core#> ,
                    <http://purl.org/dc/terms/> ,
                    <http://www.w3.org/ns/prov#> .
```
