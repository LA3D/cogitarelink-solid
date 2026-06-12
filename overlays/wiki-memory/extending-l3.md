---
type: wiki:ExtensionGuide
title: Extending Wiki-Memory L3 — Author's Manual
created: 2026-05-19
maturity: validated
keywords:
  - extension
  - shapes
  - SHACL
  - L4
  - schema.org
---

# Extending Wiki-Memory L3

This page documents how to extend the wiki-memory L3 substrate for a new domain. It is itself a wiki page in the substrate it describes — `<>` is the page resource, `<#this>` is the [[Extension Guide]]{.related} Thing.

## When to Extend

You should extend the L3 shape catalog when:

1. **You need a new Thing type** the L3 catalog doesn't cover. Examples: `biz:Client`, `biz:Equipment`, `vault:LiteratureNote`, `recipe:CookingRecipe`. If the new type fits as a subclass of an existing L3 Thing-shape's target class (`skos:Concept`, `schema:Person`, `schema:Place`, `schema:Event`, `schema:Organization`, `schema:HowTo`), extension is straightforward.

2. **You need new predicates on an existing Thing type.** Add an L4 shape targeting the same class with `sh:closed false`; both shapes apply via class-based dispatch (D78).

3. **You need new wikilink hints** for body-to-Thing edge projection. Declare via `overlay:installsHintMapping` in your overlay manifest.

Do NOT extend L3 when:

- A predicate from the existing vocabularies (schema.org / SKOS / FOAF / CITO / DCT / PROV) already covers what you need. Prefer using existing predicates.
- Your Thing genuinely doesn't fit schema.org's tree. Stop, write a brainstorming doc, and reconsider — most domains map to schema.org with subclassing.

## The Five-Step Procedure

### 1. Pick a schema.org parent class

Walk down [schema.org's Thing tree](https://schema.org/Thing) until you find the closest parent. Use that as the `rdfs:subClassOf` parent of your new class.

| Domain you're modeling | schema.org parent (typical) |
|---|---|
| Customer / client | `schema:Customer` (which is `schema:Person`) |
| Product / equipment | `schema:Product` |
| Order / transaction | `schema:Order` |
| Part / component | `schema:IndividualProduct` or `schema:Product` |
| Specification / standard | `schema:Intangible` or `schema:DefinedTerm` |
| Literature / paper | `schema:ScholarlyArticle` (which is `schema:CreativeWork`) |
| Recipe | `schema:Recipe` (which is `schema:HowTo`) |

If nothing fits, fall back to `schema:Thing` directly.

### 2. Mint a domain prefix

Choose a short prefix (3–5 chars) unique to your domain. Mint the namespace at a URI you control. For local development, the Pod's vault is fine: `https://pod.vardeman.me/vault/ontology/<your-domain>#`.

Vocabulary policy:
- Use schema.org parent classes where they fit (D79).
- Mint your own only for genuine domain gaps.
- **Never collide with the `mem:` namespace** — that's reserved for substrate operations (D74/D94).

### 3. Write the SHACL shape

Copy `template.shacl.ttl` from `/vault/meta/templates/shape-template.shacl.ttl` and modify the MODIFY markers. Required edits:

- `@prefix YOURPFX:` → your domain prefix and URI
- `YOURPFX:YourThingShape` → your shape name
- `sh:targetClass YOURPFX:YourThing` → your Thing class
- `rdfs:label`, `rdfs:comment`, `skos:scopeNote`, `dct:creator` — FAIR metadata
- `sh:agentInstruction` — substrate-governance list, wikilink hints if applicable, extension pointer
- Property shapes for your domain predicates

### 4. Register the class in Type Index

Add an entry to your overlay's manifest:

```turtle
overlay:installsTypeIndexEntry
    [ solid:forClass YOURPFX:YourThing ;
      solid:instanceContainer </your-domain/things/> ] ;
```

Apply.py installs the entry to the Pod's `/vault/settings/publicTypeIndex` at deploy time.

### 5. Package as overlay declaring `cap:requires wiki-l3`

Structure your overlay directory:

```
overlays/your-domain/
├── manifest.ttl
├── vocabulary/your-domain.ttl
├── shapes/your-thing.shacl.ttl
└── (optional: extending-your-domain.md, templates/, capabilities/, etc.)
```

Manifest declares dependency on wiki-l3:

```turtle
<#your-overlay> a overlay:Overlay ;
    overlay:name "your-domain" ;
    overlay:requiresCapability
        [ cap:requires <https://pod.vardeman.me/vault/meta/capabilities/wiki-vocabulary.ttl> ;
          cap:minVersion "1.0" ] ;
    overlay:installsShape [ overlay:document "shapes/your-thing.shacl.ttl" ;
                            overlay:hostedAt "/vault/meta/shapes/your-thing.shacl.ttl" ] ;
    overlay:installsContainer </your-domain/things/> ;
    overlay:installsTypeIndexEntry [ ... ] ;
    overlay:installsVocabulary [ overlay:document "vocabulary/your-domain.ttl" ;
                                  overlay:hostedAt "/vault/ontology/your-domain" ] ;
    overlay:providesCapability [ overlay:document "capabilities/your-domain-substrate.ttl" ;
                                  overlay:hostedAt "/vault/meta/capabilities/your-domain-substrate.ttl" ] .
```

Apply.py installs the overlay on top of wiki-memory L3:

```bash
~/uvws/.venv/bin/python -m scripts.overlay.apply overlays/your-domain --target https://pod.vardeman.me/vault
```

## Worked Example 1: Business overlay (`biz:`)

Imagine you're modeling a small-business memory: clients, equipment, orders, parts. Here's how the overlay slots above L3.

### `overlays/acme-biz/vocabulary/biz.ttl`

```turtle
@prefix biz:    <https://pod.vardeman.me/vault/ontology/biz#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <https://schema.org/> .
@prefix owl:    <http://www.w3.org/2002/07/owl#> .
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix vann:   <http://purl.org/vocab/vann/> .

<https://pod.vardeman.me/vault/ontology/biz>
    a owl:Ontology ;
    rdfs:label "ACME Business Memory vocabulary" ;
    vann:preferredNamespacePrefix "biz" ;
    vann:preferredNamespaceUri "https://pod.vardeman.me/vault/ontology/biz#" ;
    dct:created "2026-05-19"^^<http://www.w3.org/2001/XMLSchema#date> .

biz:Client      rdfs:subClassOf schema:Customer , schema:Thing .
biz:Equipment   rdfs:subClassOf schema:Product , schema:Thing .
biz:Order       rdfs:subClassOf schema:Order , schema:Thing .
biz:Part        rdfs:subClassOf schema:IndividualProduct , schema:Thing .
biz:Specification rdfs:subClassOf schema:DefinedTerm , schema:Thing .
```

### `overlays/acme-biz/shapes/equipment.shacl.ttl`

```turtle
@prefix biz:    <https://pod.vardeman.me/vault/ontology/biz#> .
@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix schema: <https://schema.org/> .
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .

biz:EquipmentShape a sh:NodeShape ;
    rdfs:label "Business Equipment Shape" ;
    rdfs:comment "Governs pages about equipment items installed at client sites." ;
    rdfs:isDefinedBy <https://pod.vardeman.me/vault/ontology/biz> ;
    dct:conformsTo <https://www.w3.org/TR/shacl/> ;
    dct:created "2026-05-19"^^xsd:date ;

    sh:targetClass biz:Equipment ;
    sh:closed false ;
    sh:agentInstruction "Substrate governs: schema:name, biz:serialNumber, biz:installedAt, biz:specification. Use {.installedAt} → biz:installedAt for client site links. To extend (e.g., biz:MedicalEquipment), subclass biz:Equipment and add your shape. See </vault/meta/extending-l3.md>." ;

    sh:property [ sh:path biz:serialNumber ; sh:minCount 1 ; sh:datatype xsd:string ; rdfs:label "Serial number" ] ;
    sh:property [ sh:path biz:installedAt ; sh:nodeKind sh:IRI ; rdfs:label "Installed at (→ biz:Client)" ] ;
    sh:property [ sh:path biz:specification ; sh:nodeKind sh:IRI ; rdfs:label "Specification (→ biz:Specification)" ] .
```

### Page content

A page at `/biz/equipment/serial-12345.md` would have body:

```markdown
---
title: HP LaserJet at Acme Hospital
type: biz:Equipment
maturity: validated
---

# HP LaserJet at Acme Hospital

Installed at [[Acme Hospital]]{.installedAt} on 2026-04-12. Conforms to
[[Print Server Spec v2]]{.about}. Maintained by [[Jane Doe]]{.author}.
```

The projection produces (in `.meta`):

```turtle
<> a wiki:Page ;
   dct:title "HP LaserJet at Acme Hospital" ;
   schema:mainEntity <#this> ;
   wiki:maturity wiki:validated .

<#this> a schema:Thing, biz:Equipment ;
        schema:name "HP LaserJet at Acme Hospital" ;
        schema:mainEntityOfPage <> ;
        biz:installedAt </biz/clients/acme-hospital.md#this> ;
        schema:about </biz/specs/print-server-spec-v2.md#this> ;
        dct:contributor </biz/people/jane-doe.md#this> .
```

## Worked Example 2: Literature-note overlay (`vault:`)

Zettelkasten-style atomic literature notes for academic papers. Uses CITO + DCTERMS.

### `overlays/vault-literature/vocabulary/vault.ttl`

```turtle
@prefix vault:  <https://pod.vardeman.me/vault/ontology/vault#> .
@prefix schema: <https://schema.org/> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .

vault:LiteratureNote rdfs:subClassOf schema:ScholarlyArticle , schema:Thing .
```

### `overlays/vault-literature/shapes/literature.shacl.ttl`

```turtle
@prefix vault:  <https://pod.vardeman.me/vault/ontology/vault#> .
@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix schema: <https://schema.org/> .
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix cito:   <http://purl.org/spar/cito/> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .

vault:LiteratureNoteShape a sh:NodeShape ;
    rdfs:label "Vault Literature Note Shape" ;
    sh:targetClass vault:LiteratureNote ;
    sh:closed false ;
    sh:agentInstruction "Substrate governs: dct:creator, dct:date, dct:identifier, dct:publisher, dct:bibliographicCitation, schema:associatedMedia. Use schema:associatedMedia to reference the PDF co-located in the same container. CITO citation edges (cito:cites, etc.) project from concept pages pointing here." ;

    sh:property [ sh:path dct:creator ; rdfs:label "Author / creator" ] ;
    sh:property [ sh:path dct:date ; rdfs:label "Publication date" ] ;
    sh:property [ sh:path dct:identifier ; rdfs:label "DOI or citekey" ] ;
    sh:property [ sh:path schema:associatedMedia ; sh:nodeKind sh:IRI ; rdfs:label "Associated PDF (co-located)" ] .
```

### PDF attachment co-location

Page at `/wiki/literature/karpathy-2026-wiki.md` carries notes; the PDF lives alongside at `/wiki/literature/karpathy-2026-wiki.pdf` as an LDP non-RDF resource. The page's `.meta` declares:

```turtle
<#this> a schema:Thing, vault:LiteratureNote ;
        schema:name "Karpathy 2026 Wiki" ;
        schema:associatedMedia </wiki/literature/karpathy-2026-wiki.pdf> ;
        dct:creator <https://orcid.org/0000-0001-...> ;
        dct:identifier "10.0000/foo.bar" .
```

Concept pages cite this literature note via existing L3 hints — no L4-specific projection needed:

```markdown
The notion of agent-maintained wikis [[Karpathy 2026 Wiki]]{.cites} extends the
Vannevar Bush Memex.
```

## Vocabulary Minting Policy

Before minting a class or predicate:

1. **Check schema.org first.** Walk the Thing tree; pick the closest parent.
2. **Check SKOS, FOAF, CITO, DCT, PROV.** These cover the common cross-cutting vocab.
3. **Check the `wiki:` namespace.** Page lifecycle (`wiki:maturity`, `wiki:Page`) lives here.
4. **Only then mint your own.** Use a domain-specific prefix; never collide with `mem:`.
5. **Document via FAIR metadata.** Every minted term gets `rdfs:label` + `rdfs:comment` + `rdfs:isDefinedBy`. The vocabulary file itself gets `vann:preferredNamespacePrefix` and `vann:preferredNamespaceUri`.

## Common Pitfalls

- **Relative IRI resolution in `sh:hasValue`** — CSS resolves relative IRIs against server root, not vault root. Use absolute IRIs in shape constraints when targets aren't in the same `.meta`.
- **Blank nodes in `solid:inserts`** — N3 Patch rejects them. Use `urn:uuid:` fragment subjects for activity records.
- **Container constraints validation order** — CSS validates container `constrainedBy` before resource SHACL. Sub-container creation under a constrained container is rejected by `validateNoContainersCreated`.
- **Storage description PATCH** — returns 405. Use static Components.js config; runtime PATCH not supported.
- **Components.js Overrides** — only one Override per instance at preprocess time. Multiple Overrides raise `ErrorResourcesContext`.

## Discovery Chain

How agents find this manual cold:

```
GET /vault/                                         (Pod root)
  → Link: <.../.well-known/solid>; rel="solid:storageDescription"
  ↓
GET /vault/.well-known/solid
  → sub:extensionGuide </vault/meta/extending-l3.md>  (NEW in D100)
  → sub:shapeCatalog   </vault/meta/shapes/>
  → sub:contextDocument </vault/meta/context.jsonld>
  → solid:publicTypeIndex </vault/settings/publicTypeIndex>
  → sub:affordanceCatalog </vault/meta/affordances/>
  ↓
GET /vault/meta/extending-l3.md
  → this page
```

The storage description advertises `sub:extensionGuide` so agents arriving cold can dereference and read the manual without prior knowledge.

## See Also

- [[Wiki Memory L3 Profile]]{.related} — the substrate this extends
- [[Template SHACL Shape]]{.related} — `/vault/meta/templates/shape-template.shacl.ttl`
- [[Memory Operations Vocabulary]]{.related} — `/vault/ontology/mem`
- D98, D99, D100 in `SOLID-Pod-Decisions.md`
