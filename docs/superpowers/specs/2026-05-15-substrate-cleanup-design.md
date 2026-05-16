# Substrate cleanup + agentic-app architecture re-statement

**Status**: Design — approved 2026-05-15, pending implementation
**Date**: 2026-05-15
**Architect**: Chuck Vardeman
**Design assistant**: Claude Opus 4.7 (1M context)
**Trigger**: Sprint 1 of the pod-discover skill eval surfaced three substrate inconsistencies that turned out to be one architectural problem.
**Related decisions**: D44, D48, D49, D51, D52, D55, D70, D71, D77, D78, D79, D81 (this design reframes / sharpens several; introduces proposed D83)
**Related plans**: `docs/plans/2026-05-15-rung-1-5-eval-matrix.md` (downstream consumer of cleaned-up substrate)

---

## Summary

This design fixes three substrate issues surfaced by the Sprint 1 pod-discover eval — PARA legacy in the base Pod template, shape files at the wrong path, and Comunica running as a docker service — and uses the cleanup as the occasion to re-state the substrate architecture for the agentic-app era. The reframe formalizes the Pod as a **self-describing toolkit** with three discoverable layers: L1 Solid baseline, a substrate capability catalog of generic primitives, and installed applications as composable overlays. Wiki-memory becomes the canonical first overlay rather than something baked into the base template; PARA becomes a specialization overlay on top of wiki-memory; future applications (calendar, todo, contacts) plug in through the same overlay mechanism.

The tactical fix takes ~4-6 hours of substrate engineering across five commits, each validated by integration tests. The architectural re-statement ships as documentation only (no premature refactoring of the existing CSS extensions) but establishes a roadmap of seven generic substrate primitives and a capability catalog skeleton that overlays can declare requirements against. After the cleanup, Sprint 1's eval is re-run against the clean substrate to measure whether agent navigation actually improved.

---

## Background

### What surfaced Sprint 1's findings

Sprint 1 ran a skill-creator-style with-skill vs without-skill eval of a freshly-rebuilt `pod-discover` skill against the live A1.3 Pod. Both arms scored 9/9 on programmatic assertions, but the *without-skill* arm consistently found things the *with-skill* arm missed:

- A **parallel container hierarchy** under `/vault/resources/*` (PARA-era) coexisting with `/vault/wiki/*` (L3-era), both reachable, neither cross-referenced.
- The **only actual SHACL shape file** on the Pod, sitting at `/vault/procedures/shapes/concept-note.ttl` — not advertised by storage description, type index, or any `wiki:shape` predicate. Meanwhile container `.meta` files cited shape URLs that returned 404.
- **Comunica running as a separate HTTP service** on port 8080 (via `docker-compose`), with affordance descriptors pointing at `</sparql>` (which resolved to port 3000 where CSS doesn't host SPARQL).
- Top-level containers (`areas/`, `archive/`, `ontology/`, `procedures/`, `profile/`) and the WebID at `/vault/profile/card` — substrate residue not surfaced anywhere in the L3 self-description chain.

### The deeper pattern

All three issues are expressions of one problem: **PARA-era infrastructure (Phase 1-2) was never stripped when the wiki-memory L3 substrate landed (D70-D81 in Phase 5d-5g)**. Rung 1.4 added L3 *on top* without subtracting PARA. The pod template still creates PARA containers; pod_setup uploads shapes to the PARA-era path (`/vault/procedures/shapes/`); the Type Index template still registers Phase 2 PARA types; the Comunica sidecar still runs because no one stopped to ask whether it should.

### Why this is the right occasion to also re-state the architecture

The user's framing crystallized this: *"I want SOLID to be a substrate for agentic applications beyond just the wiki application. So how do we do the agentic wiki memory application that is using the SOLID principles, but also support other agentic applications that may be using the SOLID pod as a substrate?"*

Patching the three issues without articulating the underlying model would invite the same drift to recur. So the cleanup ships with an architectural commitment that formalizes:

- L1 = standard Solid Protocol
- A **capability catalog** of generic substrate primitives the Pod offers
- Applications as **peers above L1**, installable as overlays, declaring their capability requirements

This makes future agentic applications (whether the project writes them or an LLM agent generates them on the fly) a known architectural extension point rather than a one-off hack.

### What about the agentic-app era specifically

The original Solid imagined apps that knew their schema at compile time, authenticated as the user, read/wrote known containers, and were the size of a webapp. LLM-based agents discover schema at runtime, build structure on demand, need declarative descriptions of substrate behavior (because they can't read source code; only documents they can fetch), and are one prompt large.

For LLM-agent consumers, the Pod needs to be a **self-describing toolkit**: discoverable primitives, discoverable apps, discoverable structure, all expressed as RDF resources the agent can fetch and reason about. Whatever's not in the Pod's self-description doesn't exist to the agent. That's the architectural commitment underneath the cleanup.

---

## Section 1 — Architectural framing

### Three discoverable layers on every Pod

```
L1 — Solid Protocol baseline
    LDP containers, WAC/ACP, Type Index, storage description,
    Memento, LDN, Solid Notifications, Solid-OIDC.
    Universal. The substrate any agent assumes.

Pod capabilities — generic substrate primitives this Pod offers
    Content Projection · Derived View · Time Travel · Two-Stage Commit ·
    Trigger Emission · Validation Hook · Reference Catalog.
    Each primitive: a CSS extension implementing the behavior +
    a capability descriptor at /meta/capabilities/<name>.ttl
    declaring "this Pod has this primitive at this version,
    consuming this descriptor format."

Installed applications — composable peers above L1
    wiki-memory, calendar, todo, contacts, ...
    Each application: a bundle of containers + shapes + affordance
    descriptors + Type Index entries + vocabulary declarations,
    advertising itself via dct:conformsTo + rdfs:seeAlso on the
    storage description. Configures capabilities via descriptors.
```

### How the layers compose

An overlay (`overlays/<app-name>/`) installs an application. Each application:

- **Declares** what it needs from L1 (containers, Type Index entries, vocabulary registrations).
- **Configures** capabilities the Pod offers (e.g., wiki-memory configures the Content Projection capability for `text/markdown` with its specific class-hint table).
- **Declares dependencies** in its manifest: "requires `cap:content-projection >= 1.0` and `cap:memento >= 1.0`; degrades gracefully without `cap:trigger-emission`."

Wiki-memory is the **canonical first application** — it ships pre-installed in the base Pod (via `make reset` running `apply_overlay.py overlays/wiki-memory`). PARA is a **specialization-overlay** on top of wiki-memory. Future apps (calendar, todo, contacts) are peer overlays using the same mechanism.

### What a generic agent does on arrival

```
1. GET <pod-root> → Link header → storage description
2. GET storage description → list of dct:conformsTo (apps installed),
                              cap:catalog (primitives offered),
                              rdfs:seeAlso (container roots),
                              void:vocabulary (vocabularies in play)
3. GET /meta/capabilities/ → enumerate primitives this Pod offers
4. For each installed app, GET its dct:conformsTo profile →
   prof:hasResource entries pointing at shapes, examples, vocabulary
5. Reason about whether this Pod can serve the agent's task
```

Skills bridge the gap from raw RDF self-description to agent navigation patterns. They teach an agent how to read this chain efficiently and what to do with what it finds.

### The architectural commitment

> The Pod is a **self-describing toolkit**, not a database. Generic substrate primitives are installable as CSS extensions and discoverable as RDF resources. Applications are installable as overlays and discoverable as RDF resources. Whatever isn't in the Pod's self-description doesn't exist to the agent — including the Pod's own capabilities.

---

## Section 2 — Substrate cleanup

### What gets stripped from `css/config/pod-templates/base/`

```
base/archive/           → delete
base/areas/             → delete
base/projects/          → delete
base/procedures/        → delete entire tree (queries/, shapes/)
base/resources/         → delete entire tree
base/settings/publicTypeIndex$.ttl.hbs   → delete (overlay installs Type Index entries)
base/meta/affordances/  → delete contents (move to overlay)
base/meta/context.jsonld → delete (move to overlay)
base/wiki/              → delete entire tree (move to overlay)
```

`pod_setup.py` loses its shape-upload step — shape upload moves to the wiki-memory overlay's apply script.

### What stays in the base template (L1 only)

```
base/
├── .meta              # Pod-level metadata (minimal storage description scaffolding)
├── profile/card$.ttl.hbs   # WebID
├── settings/publicTypeIndex$.ttl.hbs   # emits empty TypeIndex (overlays populate)
├── ontology/          # TBox cache of W3C standard vocabularies (substrate-level)
├── meta/              # empty container; overlays populate
└── wac/               # WAC access control templates
```

The TBox cache at `/vault/ontology/` stays at **substrate level**, holding SKOS, DCT, PROV, CITO, FOAF stubs that any overlay can rely on. App-specific vocabularies (`wiki:`, future `cal:`) ship with their respective overlays.

### Shape files: rename, move, align

Repo `shapes/wiki-memory-l3/*.shacl.ttl` → `overlays/wiki-memory/shapes/*.shacl.ttl`. The existing `concept.shacl.ttl` in the repo gets **renamed to `page.shacl.ttl`** because the subclass model (Section 4) makes `wiki:Page` the base class and the base shape applies to all subclasses via `rdfs:subClassOf` inference. Container `.meta` files in the wiki-memory overlay reference the correct filename:

```turtle
# Before (broken pointer in current pod template, file doesn't exist):
<../../meta/shapes/page.shacl.ttl>

# After (in overlay, file exists and targets sh:targetClass wiki:Page):
<../../meta/shapes/page.shacl.ttl>
```

Container path stays `/wiki/pages/` (D76). Class `wiki:Page` is the base; `wiki:Concept`, `wiki:MOC` etc. are subclasses (see Section 4). The base shape file is `page.shacl.ttl`; subclass-specific extension shapes (a future `concept.shacl.ttl` adding `wiki:Concept`-only constraints) are out of scope for this cleanup. Shapes get uploaded to `/vault/meta/shapes/` by the overlay's apply script.

### Comunica docker service removed

```yaml
# docker-compose.yml — delete entire stanza:
comunica:
  image: node:20-slim
  ports: ["8080:8080"]
  ...
```

The `comunica/` directory in cogitarelink-solid (`comunica/package.json` + `comunica/config.json`) gets deleted. Affordance descriptors (`hub-view.ttl`, `breadcrumb-view.ttl`) drop `wiki:invokedAt </sparql>` and add `wiki:requiresCapability cap:DerivedView` instead.

### What stays in the CSS image

```
css/extensions/markdown-projection/   ← stays (Content Projection primitive, markdown adapter)
css/extensions/markdown-render/       ← stays (HTML rendering)
css/extensions/memento/               ← stays (Time-Travel primitive)
```

These don't move — they're CSS extensions, not data. They get **re-labeled in their README** as "implementation of the [primitive] capability" so the architectural intent is documented at the code level. No refactor in this cleanup.

### What a freshly-`make reset`-ed Pod looks like (post-cleanup, pre-overlay)

```
GET /vault/                  → empty pim:Storage with Link to storage description
GET /vault/.well-known/solid → storage description with cap:catalog pointer,
                                no app catalog pointers, no rdfs:seeAlso to wiki containers,
                                no wiki:typeIndex content
GET /vault/settings/publicTypeIndex → empty TypeIndex resource
GET /vault/meta/             → empty container
GET /vault/meta/capabilities/ → capability catalog with primitives the Pod offers
GET /vault/ontology/         → TBox cache of standard W3C vocabularies
GET /vault/profile/card      → WebID
```

A bare L1 Pod with the capability catalog populated but no apps. Running `apply_overlay.py overlays/wiki-memory` then produces the Rung 1.4-equivalent Pod.

---

## Section 3 — Overlay machinery

### Directory layout

```
cogitarelink-solid/
├── overlays/
│   ├── wiki-memory/                  ← The canonical first app overlay
│   │   ├── manifest.ttl              ← Overlay contract
│   │   ├── vocabulary/wiki.ttl       ← RDFS+SHACL class hierarchy
│   │   ├── shapes/                   ← SHACL shape files
│   │   ├── containers/               ← Mirrors target Pod layout; `.meta` per container
│   │   ├── affordances/              ← Substrate-behavior descriptors
│   │   ├── context-fragment.jsonld   ← Prefixes + aliases to merge into Pod's context
│   │   └── storage-patch.ttl         ← N3 Patch to add this overlay's catalog entries
│   ├── para/                          ← Future: PARA L4 overlay
│   └── ...                            ← Future overlays
└── scripts/overlay/
    ├── apply.py                      ← Idempotent install
    ├── remove.py                     ← Uninstall (deactivate + delete; --keep-data for deactivate-only)
    └── verify.py                     ← Sanity-check installed overlay matches its manifest
```

### Manifest format (the contract)

```turtle
@prefix overlay: <https://pod.vardeman.me:3000/vault/ontology/overlay#> .
@prefix cap:     <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix wiki:    <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix dct:     <http://purl.org/dc/terms/> .
@prefix solid:   <http://www.w3.org/ns/solid/terms#> .

<#wiki-memory>
    a overlay:Overlay ;
    overlay:name "wiki-memory" ;
    overlay:version "1.0" ;
    dct:conformsTo wiki:WikiMemoryProfile ;
    overlay:declaresVocabulary [
        overlay:namespace wiki: ;
        overlay:document <vocabulary/wiki.ttl> ;
        overlay:hostedAt </vault/ontology/wiki.ttl> ] ;
    overlay:requiresCapability
        [ cap:requires <.../markdown-content-projection> ; cap:minVersion "1.0" ] ,
        [ cap:requires <.../time-travel> ; cap:minVersion "1.0" ] ;
    overlay:optionalCapability
        [ cap:requires <.../derived-view> ; cap:minVersion "1.0" ;
          overlay:degradesTo "hub-view + breadcrumb-view advisory only" ] ;
    overlay:installsContainer </vault/wiki/>, ... ;
    overlay:installsShape    </vault/meta/shapes/page.shacl.ttl>, ... ;
    overlay:installsAffordance </vault/meta/affordances/markdown-projection.ttl>, ... ;
    overlay:installsTypeRegistration
        [ solid:forClass wiki:Page  ; solid:instanceContainer </vault/wiki/pages/> ] , ... .
```

The manifest **is** the authoritative declaration of what the overlay installs. Apply walks it and PUTs the artifacts. Remove walks it and DELETEs them. Verify walks it and confirms each artifact still exists with expected content.

### Apply algorithm

```python
def apply_overlay(overlay_dir: Path, pod_url: str):
    manifest = parse_manifest(overlay_dir / "manifest.ttl")

    # 1. Preflight: check overlay dependencies are installed
    for dep in manifest.depends_on_overlays:
        if not is_overlay_installed(pod_url, dep):
            abort(f"Overlay requires {dep} but it's not installed")

    # 2. Verify capabilities exist at required versions
    pod_capabilities = fetch_capability_catalog(pod_url)
    for required in manifest.required_capabilities:
        if not pod_capabilities.has(required.iri, required.min_version):
            abort(f"Pod missing capability: {required}")

    # 3. Upload vocabulary documents (Category 3, Path X — Pod-local hosting)
    for vocab in manifest.vocabularies:
        put_file(pod_url + vocab.hosted_at, overlay_dir / vocab.document, "text/turtle")

    # 4-7. Upload shapes, affordances, containers, vocab docs
    for shape_url in manifest.installs_shapes:    put_shape(...)
    for aff_url in manifest.installs_affordances: put_affordance(...)
    for container_url in manifest.installs_containers: ensure_container(...)

    # 8. Merge JSON-LD context fragment (PATCH-merge, not overwrite)
    merge_jsonld_context(pod_url + "/vault/meta/context.jsonld",
                         overlay_dir / "context-fragment.jsonld",
                         overlay_iri=manifest.iri)

    # 9. PATCH Type Index — add registrations
    n3_patch_inserts(pod_url + "/vault/settings/publicTypeIndex",
                     manifest.type_registrations_as_triples())

    # 10. PATCH storage description — add conformsTo, rdfs:seeAlso, void:vocabulary
    n3_patch_inserts(pod_url + "/vault/.well-known/solid",
                     load_patch(overlay_dir / "storage-patch.ttl"))
```

All operations idempotent: PUT (creates or overwrites), N3 Patch with `solid:inserts` (inserting existing triple is no-op).

### Remove algorithm — two modes

**Deactivate** (`remove.py --keep-data`): removes app infrastructure (descriptors, shapes, vocab, Type Index entries, storage description entries) but leaves containers and user data intact. Default safe mode.

**Uninstall** (`remove.py`): same as Deactivate, plus DELETE containers (with confirmation prompt — destructive).

### Composability — how multiple overlays merge

Shared substrate resources (storage description, Type Index, JSON-LD context) get **PATCHed with inserts**, not overwritten with PUTs. Each overlay contributes triples; the resource accumulates them. Each overlay's manifest acts as its **bill of triples** — when remove fires, it knows exactly which triples to delete via `wiki:installedBy <overlay-iri>` provenance tagging.

```
After applying wiki-memory:
  /vault/.well-known/solid has wiki:WikiMemoryProfile + wiki containers

After also applying calendar:
  /vault/.well-known/solid has both profiles + both sets of containers
```

### Where the scripts live

In `cogitarelink-solid/scripts/overlay/` — Python (matches the project's client-tool stance). Implementation uses `httpx` + `rdflib`. ~300 lines total for apply.py + remove.py + verify.py.

### Bootstrap: how `make reset` uses this

```makefile
reset:
    docker compose down -v
    docker compose up -d
    docker compose run --rm pod-setup python /scripts/wait_for_pod.py
    docker compose run --rm pod-setup python /scripts/overlay/apply.py \
        /overlays/wiki-memory --target http://pod.vardeman.me:3000/vault/
```

---

## Section 4 — The wiki-memory overlay (concrete contents)

### Vocabulary document — `overlays/wiki-memory/vocabulary/wiki.ttl`

Hosted at `/vault/ontology/wiki.ttl`. Uses the **subclass model**: `wiki:Page` is the base class for page-style content; `wiki:Concept`, `wiki:MOC` are subclasses. PARA L4 (future) extends with `vault:TheoryNote rdfs:subClassOf wiki:Concept`, etc.

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

# Abstract root
wiki:Resource a rdfs:Class ;
    rdfs:label "Wiki resource" ;
    rdfs:isDefinedBy <> .

# Per-container base classes
wiki:Page         rdfs:subClassOf wiki:Resource ;
    rdfs:label "Wiki page" ;
    rdfs:comment "General wiki content. Lives in /wiki/pages/." ;
    rdfs:isDefinedBy <> .

wiki:Source       rdfs:subClassOf wiki:Resource ;
    rdfs:comment "Citation record. Lives in /wiki/sources/." ;
    rdfs:isDefinedBy <> .

wiki:Person       rdfs:subClassOf wiki:Resource, foaf:Person ;
    rdfs:comment "Person record. Lives in /wiki/people/." ;
    rdfs:isDefinedBy <> .

wiki:Procedure    rdfs:subClassOf wiki:Resource ;
    rdfs:comment "Procedural memory. Lives in /wiki/procedures/." ;
    rdfs:isDefinedBy <> .

wiki:WorkingNote  rdfs:subClassOf wiki:Resource ;
    rdfs:comment "Permissive scratchpad. Lives in /wiki/working/." ;
    rdfs:isDefinedBy <> .

# wiki:Page subclasses (kinds of pages — D76's "general wiki content" intent)
wiki:Concept      rdfs:subClassOf wiki:Page, skos:Concept ;
    rdfs:comment "Conceptual knowledge unit. Most common page kind." ;
    rdfs:isDefinedBy <> .

wiki:MOC          rdfs:subClassOf wiki:Page ;
    rdfs:comment "Navigational hub page that organizes other pages." ;
    rdfs:isDefinedBy <> .

# Derived class (substrate-computed via hub-view affordance)
wiki:Hub          rdfs:subClassOf wiki:Resource ;
    rdfs:comment "A wiki:Resource with ≥3 incoming skos:broader. Derived; never asserted directly." ;
    rdfs:isDefinedBy <> .

# Lifecycle predicate
wiki:maturity a rdf:Property ;
    rdfs:domain wiki:Resource ;
    rdfs:range skos:Concept ;
    rdfs:isDefinedBy <> .

wiki:draft     a skos:Concept ; skos:prefLabel "draft" .
wiki:validated a skos:Concept ; skos:prefLabel "validated" .
wiki:core      a skos:Concept ; skos:prefLabel "core" .

# The application profile
wiki:WikiMemoryProfile a dct:Standard ;
    rdfs:label "Wiki-memory application profile v1.0" ;
    dct:hasVersion "1.0" ;
    rdfs:isDefinedBy <> .
```

GET on `https://pod.vardeman.me:3000/vault/ontology/wiki#Concept` returns this document with the `#Concept` fragment. Linked data discipline done right.

### Shape file — `overlays/wiki-memory/shapes/page.shacl.ttl`

Targets `wiki:Page` — applies to all subclasses via SHACL's `rdfs:subClassOf` inference.

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

wiki:PageShape a sh:NodeShape ;
    sh:targetClass wiki:Page ;
    sh:closed false ;
    sh:agentInstruction "Wiki page. Required: dct:title. Common: skos:broader (parent), skos:related (lateral). For typed citations to sources, use cito:extends, cito:agreesWith, cito:disagreesWith. The substrate governs dct:title, dct:identifier, dct:created, dct:modified, skos:broader, skos:related, cito:* via the markdown-projection affordance (D81 Model A) — edit body+frontmatter, don't PATCH .meta directly for these." ;
    sh:property [
        sh:path dct:title ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
    ] ;
    sh:property [
        sh:path skos:broader ;
        sh:nodeKind sh:IRI ;
    ] ;
    sh:property [
        sh:path wiki:maturity ;
        sh:in ( wiki:draft wiki:validated wiki:core ) ;
        sh:maxCount 1 ;
    ] .
```

Subclasses can ship additional shapes targeting `wiki:Concept`, `wiki:MOC`, etc. with stricter constraints.

### Container `.meta` — `overlays/wiki-memory/containers/wiki/pages/.meta`

```turtle
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .

<> dct:title "Wiki Pages" ;
   solid:forClass wiki:Page ;
   wiki:shape </vault/meta/shapes/page.shacl.ttl> ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "General wiki content. Instances declare rdf:type — wiki:Page or a subclass (wiki:Concept, wiki:MOC, future vault:TheoryNote, etc.). Use dct:title (required), skos:broader (parent), skos:related (lateral)." .
```

`solid:forClass` mirrors Type Index for redundant discoverability. `wiki:installedBy` is the provenance tag enabling composability (Section 3).

### Affordance descriptor — `hub-view.ttl`

Drops `wiki:invokedAt </sparql>`; declares the capability requirement instead.

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix cap:  <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<> a wiki:DerivedClassAffordance ;
   rdfs:label "Hub derivation" ;
   wiki:deriveClass wiki:Hub ;
   wiki:targetClass wiki:Resource ;
   wiki:requiresCapability cap:DerivedView ;
   wiki:threshold 3 ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "A wiki:Resource becomes a wiki:Hub when ≥3 distinct wiki:Resource instances point at it via skos:broader. Run the CONSTRUCT below in your own SPARQL engine (Comunica recommended), with this Pod's wiki containers as data sources. The Pod does not host a SPARQL endpoint." ;
   wiki:constructQuery """
       PREFIX wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#>
       PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
       CONSTRUCT { ?hub a wiki:Hub . }
       WHERE {
           SELECT ?hub (COUNT(DISTINCT ?child) AS ?n)
           WHERE { ?child skos:broader ?hub . ?hub a wiki:Resource . }
           GROUP BY ?hub HAVING (?n >= 3)
       }
   """ .
```

### Manifest — `overlays/wiki-memory/manifest.ttl`

```turtle
@prefix overlay: <https://pod.vardeman.me:3000/vault/ontology/overlay#> .
@prefix cap:     <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix wiki:    <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix dct:     <http://purl.org/dc/terms/> .
@prefix solid:   <http://www.w3.org/ns/solid/terms#> .

<#wiki-memory>
    a overlay:Overlay ;
    overlay:name "wiki-memory" ;
    overlay:version "1.0" ;
    dct:conformsTo wiki:WikiMemoryProfile ;

    overlay:declaresVocabulary [
        overlay:namespace wiki: ;
        overlay:document <vocabulary/wiki.ttl> ;
        overlay:hostedAt </vault/ontology/wiki.ttl>
    ] ;

    overlay:requiresCapability
        [ cap:requires <https://pod.vardeman.me:3000/vault/meta/capabilities/markdown-content-projection> ;
          cap:minVersion "1.0" ;
          cap:contentType "text/markdown" ] ,
        [ cap:requires <https://pod.vardeman.me:3000/vault/meta/capabilities/time-travel> ;
          cap:minVersion "1.0" ] ;

    overlay:optionalCapability
        [ cap:requires <https://pod.vardeman.me:3000/vault/meta/capabilities/derived-view> ;
          cap:minVersion "1.0" ;
          overlay:degradesTo "hub-view + breadcrumb-view advisory; agent must bring SPARQL engine" ] ;

    overlay:installsContainer
        </vault/wiki/>, </vault/wiki/pages/>, </vault/wiki/sources/>,
        </vault/wiki/people/>, </vault/wiki/procedures/>, </vault/wiki/working/> ;

    overlay:installsShape
        </vault/meta/shapes/page.shacl.ttl>, </vault/meta/shapes/source.shacl.ttl>,
        </vault/meta/shapes/person.shacl.ttl>, </vault/meta/shapes/procedure.shacl.ttl>,
        </vault/meta/shapes/working.shacl.ttl> ;

    overlay:installsAffordance
        </vault/meta/affordances/markdown-projection.ttl>,
        </vault/meta/affordances/hub-view.ttl>,
        </vault/meta/affordances/breadcrumb-view.ttl>,
        </vault/meta/affordances/memento.ttl> ;

    overlay:installsTypeRegistration
        [ solid:forClass wiki:Page       ; solid:instanceContainer </vault/wiki/pages/> ] ,
        [ solid:forClass wiki:Source     ; solid:instanceContainer </vault/wiki/sources/> ] ,
        [ solid:forClass wiki:Person     ; solid:instanceContainer </vault/wiki/people/> ] ,
        [ solid:forClass wiki:Procedure  ; solid:instanceContainer </vault/wiki/procedures/> ] ,
        [ solid:forClass wiki:WorkingNote; solid:instanceContainer </vault/wiki/working/> ] .
```

### JSON-LD context fragment — `context-fragment.jsonld`

Merged into `/vault/meta/context.jsonld` at apply time:

```json
{
  "@context": {
    "wiki": "https://pod.vardeman.me:3000/vault/ontology/wiki#",
    "Page": "wiki:Page", "Concept": "wiki:Concept", "MOC": "wiki:MOC",
    "Source": "wiki:Source", "Person": "wiki:Person",
    "Procedure": "wiki:Procedure", "WorkingNote": "wiki:WorkingNote",
    "Hub": "wiki:Hub", "maturity": "wiki:maturity"
  }
}
```

### Storage description patch — `storage-patch.ttl`

```turtle
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix void:  <http://rdfs.org/ns/void#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .

<> a solid:InsertDeletePatch ;
   solid:inserts {
       <../>
           dct:conformsTo wiki:WikiMemoryProfile ;
           void:vocabulary <https://pod.vardeman.me:3000/vault/ontology/wiki#> ;
           rdfs:seeAlso <../wiki/pages/>, <../wiki/sources/>, <../wiki/people/>,
                        <../wiki/procedures/>, <../wiki/working/> .
   } .
```

---

## Section 5 — Capability catalog skeleton

### The capability vocabulary

Pod-local Category 3 vocabulary at `/vault/ontology/capability.ttl`, served from the L1 base template:

```turtle
@prefix cap:  <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Root
cap:Capability a rdfs:Class ;
    rdfs:comment "Generic substrate primitive offered by this Pod. Implemented by a CSS extension; configured by overlay-supplied descriptors." ;
    rdfs:isDefinedBy <> .

# Seven primitives (architectural commitment; not all implemented yet)
cap:ContentProjection a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:comment "On write, parse body of registered content-type, project triples into resource's .meta (D81)." .
cap:DerivedView a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:comment "Run CONSTRUCT/SELECT declared in affordance descriptor; return materialized triples on demand." .
cap:TimeTravel a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:comment "Per-resource versioning via RFC 7089 Memento." .
cap:TwoStageCommit a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:comment "Permissive working container + strict durable container; shape-gated promotion (D73)." .
cap:TriggerEmission a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:comment "Emit AS2 notifications when SHACL rules flip on writes (D74)." .
cap:ValidationHook a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:comment "SHACL validate at write time; gate writes by class or container." .
cap:ReferenceCatalog a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:comment "Substrate-maintained cache of cross-resource references (backlinks, citations)." .

# Predicates used in capability descriptors
cap:version           a rdf:Property .
cap:implementedBy     a rdf:Property .
cap:configurationShape a rdf:Property .
cap:contentType       a rdf:Property .

# Predicates overlays use to declare requirements
cap:requires a rdf:Property ;
    rdfs:comment "Overlay declares it cannot install without this capability at minVersion." .
cap:optional a rdf:Property ;
    rdfs:comment "Overlay degrades gracefully without this capability." .
cap:minVersion a rdf:Property .
```

The base L1 template hosts this vocabulary because **the overlay machinery itself depends on it**.

### The catalog container

LDP container at `/vault/meta/capabilities/`. Ships empty in the L1 base template. The CSS image's startup populates it based on which extensions are loaded — the catalog reflects compile-time reality, not aspirational declarations.

### Three capability descriptors shipped in this cleanup

#### `/vault/meta/capabilities/markdown-content-projection.ttl`

```turtle
@prefix cap:   <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .

<> a cap:ContentProjection ;
   rdfs:label "Markdown content projection" ;
   cap:version "1.0" ;
   cap:contentType "text/markdown" ;
   cap:implementedBy <css/extensions/markdown-projection> ;
   cap:configurationShape wiki:WriteAffordance ;
   dct:description "On write of text/markdown body, parse frontmatter + body wikilinks, project triples into resource's .meta per the wiki:WriteAffordance descriptor governing that container. Implements D58/D71/D81." ;
   sh:agentInstruction "An overlay configures this primitive by installing a wiki:WriteAffordance descriptor in /vault/meta/affordances/ with wiki:governs predicates and wiki:projectsFromFrontmatter keys. The substrate fires this primitive on every write to a container whose .meta points at such a descriptor." .
```

#### `/vault/meta/capabilities/time-travel.ttl`

Declares the existing Memento implementation. Implementation at `css/extensions/memento/`.

#### `/vault/meta/capabilities/derived-view.ttl`

Declares the Pod *publishes* derived-view descriptors (hub-view, breadcrumb-view) that agents can consume with their own SPARQL engines. **Does NOT claim the Pod runs SPARQL.**

### Five primitives unimplemented (no descriptors yet)

- `cap:TwoStageCommit` — D73 deferred
- `cap:TriggerEmission` — D74 deferred
- `cap:ValidationHook` — not started
- `cap:ReferenceCatalog` — not started
- `cap:ContentProjection` for non-markdown content types — deferred to those apps

The vocabulary declares all seven classes; the catalog lists only what's actually implemented. Honest separation between architectural commitment and shipped reality.

### Storage description advertises the catalog

```turtle
<../> ... ;
      cap:catalog </vault/meta/capabilities/> ;
      ... .
```

### How an overlay references it

From wiki-memory's manifest (Section 4):

```turtle
overlay:requiresCapability
    [ cap:requires <https://pod.vardeman.me:3000/vault/meta/capabilities/markdown-content-projection> ;
      cap:minVersion "1.0" ] , ... .
```

`apply.py` resolves each `cap:requires` IRI against the live catalog. Required missing → abort. Optional missing → log + continue.

---

## Section 6 — Comunica wiring in solid-agent-skills

### Library dependency

Added to `solid-agent-skills/package.json`:

```json
{
  "dependencies": {
    "@comunica/query-sparql-link-traversal": "^0.8.0",
    "@comunica/types": "^4.0.0"
  },
  "overrides": {
    "@traqula/parser-sparql-1-2": "^1.0.0",
    "@traqula/algebra-sparql-1-2": "^1.0.0",
    "@traqula/rules-sparql-1-1": "^1.0.0",
    "@traqula/core": "^1.0.0"
  }
}
```

The traqula version-pin from the deleted `cogitarelink-solid/comunica/package.json` moves here.

### CLI shape — `solid-pod sparql`

```typescript
import { QueryEngine } from '@comunica/query-sparql-link-traversal';

export async function sparqlCommand(podUrl: string, query: string, opts: {
  source?: string[];
  defaultGraphUri?: string[];          // RQ-Pod-4 workaround
  outputFormat?: 'json' | 'turtle' | 'table';
  acceptDatetime?: string;             // Memento integration
}) {
  const engine = new QueryEngine();
  const sources = opts.source ?? await discoverSourcesFromStorageDescription(podUrl);
  return engine.query(query, { sources, ... });
}
```

Key behaviors:
- **Auto-discovers sources** from storage description's `rdfs:seeAlso` when no `--source` given
- **RQ-Pod-4 workaround** baked in via `--default-graph-uri`
- **Memento integration** via `--accept-datetime`
- **Output formats**: JSON / Turtle / human-readable table

### CLI shape — `solid-pod invoke` (affordance handler)

```bash
solid-pod invoke <pod-url> <affordance-name>
```

Fetches `/vault/meta/affordances/<name>.ttl`, extracts the `wiki:constructQuery`, invokes via embedded Comunica. Same flags as `sparql` for sources / default graph URIs / accept-datetime. This is the "machine-actionable affordance" promise of D52 made concrete at CLI level.

### Sub-agent installation options

Three viable options for sub-agents in evals:

1. **Global install** — `npm install -g @la3d/solid-agent-skills` → `solid-pod` on `$PATH`.
2. **Workspace-local** — `npm install --prefix ./solid-agent-skills-tool @la3d/solid-agent-skills` → `npx solid-pod ...`.
3. **Direct Comunica via `npx`** — `npx @comunica/query-sparql-link-traversal ...`. Bypasses the convenience layer; used for bare-agent baselines.

Sprint 3 (`pod-query` skill) uses 1 or 2 for the with-skill arm; 3 for the without-skill baseline. That contrast becomes an assertion dimension.

### Deletions resulting from Section 6

- `cogitarelink-solid/comunica/` directory: deleted
- `cogitarelink-solid/docker-compose.yml`: `comunica:` service stanza deleted
- `solid-agent-skills/CLAUDE.md` CLI Commands table: `solid-pod sparql` row updated

### What's NOT in scope

- Solid-OIDC token flow (dev pod allow-all stays for now)
- Query caching
- Cross-Pod federation orchestration (Round 4)

---

## Section 7 — PARA as a future overlay (the seam)

### PARA's position in the architecture

PARA is a **specialization-overlay** on top of wiki-memory. Not a peer application. Concretely:

- **Vocabulary**: `vault:` namespace declares classes that subclass wiki:* types. Lives at `/vault/ontology/vault-para.ttl` once installed (Pod-local, Category 3, same pattern as `wiki.ttl`).
- **Containers**: PARA's organizational folders (`/vault/areas/`, `/vault/projects/`, `/vault/archive/`, `/vault/resources/{theories,literature,methods}/`) are PARA's own URI space — separate from `/vault/wiki/*`.
- **Class composition (hybrid model)**: a PARA literature note lives in `/vault/resources/literature/some-paper.md`, has class `vault:LiteratureNote rdfs:subClassOf wiki:Source`, validates against both `wiki:SourceShape` (inherited) and `vault:LiteratureNoteShape`.

### Vocabulary skeleton (what would live at `/vault/ontology/vault-para.ttl`)

```turtle
@prefix vault: <https://pod.vardeman.me:3000/vault/ontology/vault-para#> .
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .

# PARA category classes (organizational)
vault:Area          rdfs:subClassOf wiki:MOC ; rdfs:label "PARA Area of Focus" .
vault:Project       rdfs:subClassOf wiki:Page ; rdfs:label "PARA Project" .
vault:ArchiveItem   rdfs:subClassOf wiki:Page ; rdfs:label "PARA Archived item" .

# PARA content-type classes (semantic)
vault:TheoryNote    rdfs:subClassOf wiki:Concept ; rdfs:label "Theory note" .
vault:MethodNote    rdfs:subClassOf wiki:Concept ; rdfs:label "Method note" .
vault:LiteratureNote rdfs:subClassOf wiki:Source ;
    rdfs:comment "A literature note IS a wiki:Source, organized under the Resources PARA category." ;
    rdfs:label "Literature note" .
vault:DailyNote     rdfs:subClassOf wiki:Page ; rdfs:label "Daily note" .

# Cross-cutting PARA category tag
vault:paraCategory a rdf:Property ;
    rdfs:domain wiki:Resource ;
    rdfs:range skos:Concept .
```

### Manifest dependency on wiki-memory

```turtle
<#para>
    a overlay:Overlay ;
    overlay:dependsOnOverlay <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
    ...
```

`apply.py` checks `overlay:dependsOnOverlay` against installed overlays. Refuses to install PARA if wiki-memory isn't present. ~10 lines of apply.py extension.

### Vault import = content load operation (separate concern)

Three-step user flow for getting vault content onto the Pod:

1. `make reset` → wiki-memory installed by default
2. `apply.py overlays/para` → PARA structure installed
3. `import_vault.py ~/Obsidian/obsidian --target ...` → content load

Step 3 is **content**, not structure. Different operation, different script. Assumes PARA overlay is present before running.

### Cross-overlay subclass-aware queries

Because `vault:LiteratureNote rdfs:subClassOf wiki:Source` is in PARA's vocabulary (which the Pod hosts), SPARQL queries that reference `wiki:Source` get vault literature notes for free via Comunica's subclass reasoning:

```sparql
SELECT ?x WHERE { ?x a wiki:Source }
# Returns: instances in /vault/wiki/sources/ + /vault/resources/literature/
```

### What this section commits to vs defers

**Committed**:
- Overlay machinery supports `overlay:dependsOnOverlay`
- Wiki-memory's subclass model leaves room for PARA's extensions
- PARA strip leaves no residue conflicting with future PARA overlay

**Deferred**:
- PARA overlay's actual files — write when vault import is needed
- `import_vault.py` rewrite — same time
- PARA-specific shapes (`theory-note.shacl.ttl` extending `concept.shacl.ttl`, etc.)

---

## Section 8 — Architectural appendix

### The seven generic primitives

| Primitive | Capability IRI | Status | Descriptor format consumed | Implementation |
|---|---|---|---|---|
| **Content Projection** | `cap:ContentProjection` | Shipped (markdown only) | `wiki:WriteAffordance` | `css/extensions/markdown-projection/`. Generic refactor deferred. |
| **Derived View** | `cap:DerivedView` | Shipped (descriptor publication only; agent runs it) | `wiki:DerivedClassAffordance` / `wiki:DerivedNavigationAffordance` | Substrate publishes; agents bring SPARQL engine. No server-side execution. |
| **Time Travel** | `cap:TimeTravel` | Shipped (RFC 7089) | None — operates on every resource | `css/extensions/memento/`. |
| **Two-Stage Commit** | `cap:TwoStageCommit` | Deferred (D73) | Future: `wiki:CrystallizeAffordance` | Not implemented. |
| **Trigger Emission** | `cap:TriggerEmission` | Deferred (D74) | Future: `wiki:TriggerAffordance` | Not implemented. |
| **Validation Hook** | `cap:ValidationHook` | Not started | Future: `wiki:ValidationAffordance` | Shapes advisory; no server enforcement. |
| **Reference Catalog** | `cap:ReferenceCatalog` | Not started | Future: `wiki:BacklinkAffordance` | Backlinks computed at query time today. |

This cleanup ships descriptors for the first three. The seven slots are reserved in the capability vocabulary so adding them later doesn't require namespace changes.

### The "Pod as self-describing toolkit" commitment formalized

Seven architectural invariants (proposed as D83):

1. **L1 = standard Solid Protocol**. Use W3C-standard mechanisms wherever they exist; invent only where they don't.
2. **The Pod's capabilities are themselves RDF resources**, discoverable via the capability catalog.
3. **Applications are overlays** — installable, composable, removable bundles of (containers + shapes + descriptors + vocabulary + Type Index entries + optional CSS extension), declaring required capabilities and their own profile IRI.
4. **Structure is data; behavior is code.** Overlays install structure (declarative, removable, composable). CSS extensions provide behavior (compiled, restart-required). The capability catalog is the contract between the two.
5. **Pod-defined vocabularies are dereferenceable on the Pod itself.** Category 3 vocabularies live at `/vault/ontology/<vocab>.ttl`. Class IRIs resolve to documents the Pod hosts.
6. **Agents bring their own SPARQL.** The Pod publishes derived-view descriptors; agents execute them. No SPARQL endpoint hosted.
7. **Skills bridge the gap** between substrate self-description and agent action patterns. Generic agents using only L1 mechanisms must still succeed (potentially slower / more verbose); skills are accelerants, not gatekeepers.

### Deferred work

**Substrate-level**:
- Generic Content Projection refactor (deferred until second content type ships)
- Two-Stage Commit primitive (D73)
- Trigger Emission (D74)
- Validation Hook
- Reference Catalog

**Application-level**:
- PARA overlay (Section 7 documents seam; implementation when needed)
- Calendar / Todo / Contacts overlays (future agentic applications)
- Vault import script rewrite

**Agent-tooling**:
- Solid-OIDC integration in CLI
- `pod-query` skill (Sprint 3)

### Near-term testing observation: "straight wiki-memory import"

Test wiki-memory at scale with vault content **before** writing the PARA overlay, using wiki:* base classes directly rather than `vault:*` subclasses:

- Vault concept notes → `wiki:Concept` (no `vault:TheoryNote` subclass yet)
- Vault literature notes → `wiki:Source` (no `vault:LiteratureNote` yet)
- Vault MOCs → `wiki:MOC`
- Vault daily notes → `wiki:Page`

Implementable as a stripped-down `import_vault.py --target-overlay wiki-memory`. Useful for:
- Validating markdown-projection at scale (~1200 vault notes vs current empty Pod)
- Stress-testing capability catalog discovery
- Generating realistic test fixtures for Sprint 3
- Surfacing scale issues before PARA's complexity layers on

### Open research questions

- **RQ-Discovery-1**: does the cleaned-up discovery chain measurably help cold-start agents vs the Phase-2-residue substrate?
- **RQ-Capability-1**: do agents reason correctly about `cap:requires` clauses? Do they degrade gracefully?
- **RQ-Overlay-1**: is the manifest format authorable by an agent? Could Claude Code generate a valid overlay manifest from a prompt? (The agentic-app vision depends on yes.)
- **RQ-Vocab-1** (existing): when should Pod-local vocabularies migrate to w3id.org? What's the cost of not migrating?
- **RQ-Subclass-1** (new): how robust is SHACL subclass-reasoning across the wiki-memory → PARA hierarchy under Comunica?

### Reconciliation with existing decisions log

- **D70 reframed**: "L2 = memory substrate (invariants)" becomes "L2 is occupied by applications, of which memory is one type." Non-memory applications live at the same layer with different invariants.
- **D71 unchanged**: wiki-memory is still the canonical first application; dual-layer body+meta architecture stays.
- **D77 superseded by subclass model** (Section 4): shapes are class-targeted with `rdfs:subClassOf` reasoning. Container layout (5 containers) stays.
- **D78 sharpened**: class-based shape targeting applies up the subclass chain.
- **D79 strengthened**: hybrid vocab stance + dereferenceable class IRIs via Pod-local hosting (Path X), with Path Y (w3id.org) as future migration.
- **New decision proposed: D83 — Pod as self-describing toolkit (capability catalog).**

---

## Section 9 — Validation plan + re-running Sprint 1

### Section-by-section acceptance criteria

| Section | Acceptance check |
|---|---|
| 2 — Substrate cleanup | `make reset` produces Pod with only L1 scaffolding; no `/wiki/*`, no `/resources/*`, no `/projects/*`, empty Type Index, empty `/meta/affordances/`; no `comunica` docker service |
| 3 — Overlay machinery | `apply.py overlays/wiki-memory` runs idempotently (twice produces no errors, no diff) |
| 4 — Wiki-memory overlay | After apply, Pod matches Rung 1.4 (5 containers, 4 affordances, JSON-LD context, vocab at `/vault/ontology/wiki.ttl`, Type Index with wiki:* registrations); class IRIs dereference |
| 5 — Capability catalog | `/vault/meta/capabilities/` lists `markdown-content-projection`, `time-travel`, `derived-view`; storage description has `cap:catalog` Link |
| 6 — Comunica wiring | `solid-pod sparql` works without external endpoint; `solid-pod invoke` returns CONSTRUCT output |
| 7 — PARA seam | `overlay:dependsOnOverlay` check enforced; unit-tested |
| 8 — Architectural appendix | D83 in `decisions-index.md`; D70/D77/D78 cross-references updated |

### Pod-state regression tests

Codified as `pytest` at `tests/integration/test_substrate_cleanup.py`:

```python
def test_no_para_residue(pod_url):
    """After cleanup, PARA containers should 404."""
    for path in ["/resources/", "/areas/", "/projects/", "/archive/",
                 "/procedures/", "/resources/concepts/"]:
        assert httpx.head(pod_url + path).status_code == 404

def test_storage_description_announces_capabilities(pod_url):
    g = Graph().parse(pod_url + ".well-known/solid", format="turtle")
    assert (None, CAP.catalog, URIRef(pod_url + "meta/capabilities/")) in g

def test_capability_catalog_lists_three_primitives(pod_url):
    catalog = httpx.get(pod_url + "meta/capabilities/",
                       headers={"Accept": "text/turtle"}).text
    for descriptor in ["markdown-content-projection", "time-travel", "derived-view"]:
        assert descriptor in catalog

def test_wiki_vocabulary_dereferenceable(pod_url):
    r = httpx.get(pod_url + "ontology/wiki.ttl",
                  headers={"Accept": "text/turtle"})
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle")
    wiki_ns = "https://pod.vardeman.me:3000/vault/ontology/wiki#"
    assert (URIRef(wiki_ns + "Concept"), RDFS.subClassOf,
            URIRef(wiki_ns + "Page")) in g

def test_shape_files_resolve(pod_url):
    for shape in ["page", "source", "person", "procedure", "working"]:
        assert httpx.head(pod_url + f"meta/shapes/{shape}.shacl.ttl").status_code == 200

def test_no_sparql_endpoint_claimed(pod_url):
    hub = httpx.get(pod_url + "meta/affordances/hub-view.ttl").text
    assert "wiki:invokedAt" not in hub
    assert "cap:requires" in hub or "wiki:requiresCapability" in hub

def test_no_comunica_service(pod_url):
    with pytest.raises(httpx.ConnectError):
        httpx.get("http://pod.vardeman.me:8080/sparql", timeout=2)

def test_apply_overlay_is_idempotent(pod_url, tmp_path):
    run_apply("overlays/wiki-memory", pod_url)
    state_1 = snapshot_pod(pod_url)
    run_apply("overlays/wiki-memory", pod_url)
    state_2 = snapshot_pod(pod_url)
    assert state_1 == state_2
```

~150 lines total, two hours to write.

### Re-run Sprint 1: iteration-2 of pod-discover eval

Same task as iteration-1 ("discover what resource types this Pod supports"), same N=3 per arm, same workspace structure but at `iteration-2/`. Expectations relative to iteration-1:

| Expectation | Iteration-1 | Iteration-2 expected |
|---|---|---|
| Bare agents find parallel hierarchies | Yes (`/resources/*`) | No (PARA stripped) |
| Bare agents find orphaned shape file at `/procedures/shapes/` | Yes | No |
| Both arms identify Type Index drift | Yes | No — Type Index now consistent with `wiki:*` |
| Both arms identify empty shape catalog | Yes | No — populated with 5 shape files |
| Affordance descriptors reference Pod's `/sparql` | Yes (broken) | No — `cap:requires` instead |
| with-skill vs without-skill wall-clock delta | -28% | Smaller delta (cleaner substrate; less for skill to compensate for) |
| Tool-call count delta | -45% | Smaller delta |

**The prediction**: the skill's measured value-add *shrinks* after cleanup. Good outcome — substrate is doing more of the work. Skills become valuable for what the substrate can't self-document.

If the delta does NOT shrink: either the cleanup didn't remove as much friction as expected, or skills add value beyond just-substrate-fluency. Either is informative.

### New assertions added for iteration-2

```python
def check_recognized_capability_catalog(response):
    return "/meta/capabilities/" in response and ("cap:" in response or "capability" in response.lower())

def check_class_iri_resolved(response, transcript):
    return ("ontology/wiki" in transcript and "wiki#Concept" in response) or "Pod hosts" in response

def check_no_phase_2_residue_reported(response):
    bad = ["/resources/concepts/", "/resources/literature/", "/procedures/shapes/"]
    return not any(b in response for b in bad)
```

### Update pod-discover skill for iteration-2

Based on Sprint 1 iteration-1 analyst notes:
- Loosen "don't guess paths" to "follow Link headers, `rdfs:seeAlso`, AND `ldp:contains` from previously-fetched resources"
- Add step listing top-level containers via `ldp:contains`
- Add step to GET `/meta/capabilities/`
- Remove "Known substrate gaps" section (cleanup fixes both)
- Add instruction on dereferencing class IRIs

~30 minutes of skill editing.

### Commit/tag strategy

Five commits, each green on regression tests:

1. **`Strip PARA legacy from base template`** — Section 2 deletions only. Tag: `substrate-cleanup-step-1-strip`.
2. **`Add overlay machinery + capability vocabulary`** — Sections 3 + 5 scaffolding. Tag: `substrate-cleanup-step-2-machinery`.
3. **`Add wiki-memory overlay`** — Section 4 in full. Tag: `substrate-cleanup-step-3-wiki-memory`.
4. **`Remove Comunica docker service, add solid-agent-skills CLI`** — Section 6, cross-repo. Tag: `substrate-cleanup-step-4-comunica`.
5. **`Update decisions log with D83 + architectural cross-refs`** — Section 8. Tag: `substrate-cleanup-complete`.

### Definition of done

1. All integration tests pass against a freshly-`make reset`-ed Pod.
2. `make reset` produces a working Rung 1.4-equivalent Pod (substrate + wiki-memory overlay).
3. `apply.py overlays/wiki-memory` is idempotent.
4. `remove.py --keep-data overlays/wiki-memory` returns Pod to bare L1; running apply again restores Rung 1.4 state.
5. Sprint 1 iteration-2 eval runs and produces a benchmark.json comparable to iteration-1 in the eval viewer.
6. Decisions log updated with D83 + cross-references; this design doc committed.

### Validation timing

Suggested sequence (each step gates the next):

1. **Cleanup steps 1-4** with regression tests passing → substrate is in clean state
2. **Sprint 1 iteration-2 eval** → confirms cleanup improved obvious things; tests the same question as iteration-1 but against cleaner substrate
3. **Rung 1.5 Pilot** (`docs/plans/2026-05-15-rung-1-5-eval-matrix.md`) → uses the cleaned-up substrate for the arm-config comparisons (A1.1, A1.2, A1.3)
4. **"Straight wiki-memory" vault content scale test** → loads ~1200 vault notes through markdown-projection; surfaces scale issues
5. **PARA overlay design + implementation** → only when vault content needs PARA-specific subtypes/organization

---

## References

### Decisions log
- D44: Storage Description Resource replaces `.well-known/void`
- D48: Agent affordance architecture as guiding principle
- D49: Vocabulary grounding via `void:vocabulary`
- D51: Pod as general-purpose substrate for agentic applications
- D52: Affordance harness — per-content-type descriptors
- D55: HATEOAS three-tier access
- D58: Body affordances first-class when descriptor-declared
- D70: L1/L2/L3 substrate stratification (REFRAMED here)
- D71: Wiki-memory as canonical L3 reference profile
- D77: Wiki-memory L3 SHACL shape catalog (SUPERSEDED by subclass model in Section 4)
- D78: Class-based shape targeting (SHARPENED here for subclass reasoning)
- D79: Hybrid vocabulary + JSON-LD context discovery (STRENGTHENED by Pod-local Category 3 hosting)
- D81: Predicate-level governance (Model A)
- **D83 (proposed)**: Pod as self-describing toolkit (capability catalog)

### Plans
- `docs/plans/2026-05-15-rung-1-5-eval-matrix.md` — downstream consumer; Rung 1.5 eval matrix runs against cleaned-up substrate
- `docs/plans/2026-05-15-rung-1-5-session-handoff.md` — context for the eval run

### Sprint 1 artifacts
- `~/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-1/`
- `~/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-1/analyst-notes.md` — Sprint 1 findings that triggered this design

### External
- Solid Protocol v0.11.0 — https://solidproject.org/TR/protocol
- LDP — https://www.w3.org/TR/ldp/
- SHACL 1.2 — https://www.w3.org/TR/shacl12-core/
- RFC 7089 (Memento) — https://datatracker.ietf.org/doc/html/rfc7089
- W3ID — https://w3id.org/
- Comunica — https://comunica.dev/
- PROF (Profile Vocabulary) — https://www.w3.org/TR/dx-prof/

---

*End of design.*
