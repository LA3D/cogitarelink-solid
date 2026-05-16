# Phase 5j close-out — PROF profile link + wikirole scheme

**Status**: Approved design, ready for implementation plan
**Date**: 2026-05-16
**Branch**: main
**Decisions touched**: D44 (storage description router), D52/D58 (affordance descriptors), D78/D81 (predicate-level governance), D83 (Pod-as-toolkit), D84 (URI conformance), D86 (PROF + RFC 6906)
**Closes FOLLOWUPS**: items 1 (overlay PROF wiring) + 2 (`Link: rel="profile"` writer)

## Context

Phase 5j ratified D84/D85/D86 and committed six PROF profile descriptors at `overlays/wiki-memory/profiles/*.ttl`, but the overlay manifest schema doesn't yet know about profile installation, and CSS emits no `Link: rel="profile"` headers. This design closes those two follow-ups and, in the process, stands up a missing substrate-level vocabulary: a SKOS scheme of resource roles parallel to W3C's PROF role registry.

The design was reached by walking from authoritative sources (W3C PROF turtle, W3C role-registry turtle, RFC 6906) outward to Solid alignment (LDP, `.meta` as auxiliary, D44 storage-description-as-router, D83 Pod-as-toolkit), then refined through a layered-namespace analysis: LDP gives "here's a resource"; a substrate role/function layer answers "what kind of resource is this beyond LDP"; an overlay-specific layer answers "what does this resource do in this overlay's terms."

## Authoritative standards baseline

Verified against primary sources during brainstorming (see `.claude/skills/solid-profiles-and-conneg/references/spec.md`):

| Document | Status (verified 2026-05-16) | How we use it |
|---|---|---|
| RFC 6906 *The 'profile' Link Relation Type* | IETF **Informational** (March 2013); IANA-registered | The ratified mechanism for `Link: rel="profile"`. Authoritative. |
| W3C PROF — *The Profiles Vocabulary* | WG Note (18 Dec 2019); §7/§8/§11 normative | Envelope vocabulary (`prof:Profile`, `prof:ResourceDescriptor`, `prof:ResourceRole`, `prof:hasRole`, etc.) |
| W3C PROF role registry | SKOS ConceptScheme at `http://www.w3.org/ns/dx/prof/role/` | Reference pattern for minting our own role scheme |
| W3C Conneg-by-Profile | Working Draft (Oct 2023); never advanced | Used only for `Link: rel="profile"` response convention. Active conneg deferred. |
| `draft-svensson-profiled-representations-01` | **Expired 10 Sept 2021**; never adopted | **Never emit `Content-Profile`** — that header lives only here. |

`prof:ResourceRole rdfs:subClassOf skos:Concept` is the architectural seam that lets a Pod publish its own role registry without re-implementing PROF.

## Architecture — three layers of resource self-description

```
Layer 1 (LDP)                ldp:RDFSource / ldp:NonRDFSource + .meta auxiliary
Layer 2 (substrate kind)     PROF envelope + role vocabularies (W3C + ours)
Layer 3 (overlay role)       application-specific prof:ResourceRole instances
                              (wikirole:write-affordance, wikirole:version-affordance, …)
```

PROF machinery and role vocabularies are orthogonal axes within layer 2, not nested. We adopt PROF (the envelope) and publish our own SKOS role scheme as a sibling to W3C's, then refine into overlay-specific roles for affordances.

Discovery surface:

```
.well-known/solid (D44 router)
  ├── void:vocabulary <…/ontology/wiki>      # overlay terms (existing)
  ├── void:vocabulary <…/ontology/wikirole>  # overlay role registry (NEW)
  └── pointers to /vault/meta/profiles/*     # PROF descriptors (existing, unwired → wired here)
```

## Component 1 — Wikirole SKOS scheme

**Path**: `/vault/ontology/wikirole` (hash-namespace document, per D84)
**Source**: `overlays/wiki-memory/vocabulary/wikirole.ttl` (new; sibling of `wiki.ttl`)
**Conforms to**: `http://www.w3.org/TR/dx-prof/`

Five concept instances initially, mirroring W3C's role-registry pattern (each `owl:NamedIndividual, skos:Concept, prof:ResourceRole; skos:topConceptOf <…/wikirole>`):

| Role IRI | Definition | Consumer |
|---|---|---|
| `wikirole:affordance` | Artifact declaring a substrate capability (predicates governed, capability required, classes operated on) — parent of the four below. | Generic; reference target for sub-roles |
| `wikirole:write-affordance` | An affordance invoked at write time (MonitoringStore listener, projection). | `markdown-projection.ttl` |
| `wikirole:version-affordance` | An affordance providing temporal access (Memento). | `memento.ttl` |
| `wikirole:derived-class-affordance` | An affordance computing a derived class view (hub view, type rollup). | `hub-view.ttl` |
| `wikirole:derived-navigation-affordance` | An affordance computing derived navigation structure (breadcrumbs, link maps). | `breadcrumb-view.ttl` |

Frame:

```turtle
@prefix : <https://pod.vardeman.me/vault/ontology/wikirole#> .
@prefix prof: <http://www.w3.org/ns/dx/prof/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .

<https://pod.vardeman.me/vault/ontology/wikirole>
    a skos:ConceptScheme , owl:Ontology ;
    dct:title "Wiki-Memory L3 — Resource Roles" ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    skos:definition "Resource roles specific to wiki-memory L3, supplementing the W3C PROF role registry with substrate-specific kinds (affordance refinements, capability descriptors)." .

# concept instances follow…
```

## Component 2 — Substrate `dct:conformsTo` declarations

One predicate added per resource. Body for RDF resources; `.meta` for non-RDF. Multi-valued where natural.

| Resource | Body or .meta | Conforms to |
|---|---|---|
| `/vault/meta/shapes/{page,source,person,procedure,working}.shacl.ttl` (5 files) | body | `https://www.w3.org/TR/shacl/` |
| `/vault/ontology/wiki` | body | `http://www.w3.org/2000/01/rdf-schema` (RDFS, since wiki.ttl uses `rdfs:Class` / `rdfs:subClassOf`) |
| `/vault/ontology/wikirole` (NEW) | body | `http://www.w3.org/TR/dx-prof/` |
| `/vault/meta/profiles/{page,concept,source,person,procedure,working}` (6 files) | body | `http://www.w3.org/TR/dx-prof/` |
| `/vault/meta/context.jsonld` | .meta | `https://www.w3.org/TR/json-ld11/` |
| `/vault/meta/affordances/{markdown-projection,memento,hub-view,breadcrumb-view}.ttl` (4 files) | body | `http://www.w3.org/TR/dx-prof/` |

Content-level: each imported wiki-memory L3 resource (concept page, source, person, procedure, working note) gets a `dct:conformsTo` triple in its `.meta` pointing at the relevant `wiki:*Profile`. This is what gives Rung 1.5 a measurable per-resource profile signal. The vault importer is the natural place to emit it; for already-imported content, a one-off backfill script suffices.

## Component 3 — Framing-1.5 additive PROF typing on affordances

Each affordance descriptor body gains three triples; existing typing and predicates are preserved.

Before (current `markdown-projection.ttl`):
```turtle
<> a wiki:WriteAffordance ;
    wiki:requiresCapability …  ;
    wiki:governs …  ;
    wiki:projectsFromFrontmatter …  .
```

After:
```turtle
<> a wiki:WriteAffordance ,
       prof:ResourceDescriptor ;                              # NEW
    prof:hasRole wikirole:write-affordance ;                  # NEW
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;          # NEW
    wiki:requiresCapability …  ;
    wiki:governs …  ;
    wiki:projectsFromFrontmatter …  .
```

Role mapping per file:

| File | Existing class | Added `prof:hasRole` |
|---|---|---|
| `markdown-projection.ttl` | `wiki:WriteAffordance` | `wikirole:write-affordance` |
| `memento.ttl` | `wiki:VersionAffordance` | `wikirole:version-affordance` |
| `hub-view.ttl` | `wiki:DerivedClassAffordance` | `wikirole:derived-class-affordance` |
| `breadcrumb-view.ttl` | `wiki:DerivedNavigationAffordance` | `wikirole:derived-navigation-affordance` |

Rationale: makes the wikirole scheme have real consumers from day one without breaking existing `wiki:*Affordance` consumers. The Framing-2 refactor (drop `wiki:*Affordance` classes entirely, keep only PROF typing) becomes a clean follow-up decision, not part of this round.

## Component 4 — `ProfileLinkMetadataWriter`

New CSS extension at `css/extensions/profile-link/`, mirroring `css/extensions/memento/`'s structure.

```
css/extensions/profile-link/
  package.json         lsd:* fields, "@cogitarelink/profile-link"
  tsconfig.json
  src/
    index.ts            re-export
    ProfileLinkMetadataWriter.ts   ~25 LOC
    uri.ts              isUnderBaseUrl (or shared helper if extracted)
  dist/                componentsjs-generated metadata + compiled JS
  config/profile-link.json   Components.js wiring
```

Writer logic (path-agnostic, overlay-agnostic):

```typescript
import { MetadataWriter, type MetadataWriterInput, addHeader } from "@solid/community-server";
import { DCT } from "@solid/community-server";
import { isUnderBaseUrl } from "./uri";

export class ProfileLinkMetadataWriter extends MetadataWriter {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async handle(input: MetadataWriterInput): Promise<void> {
    const id = input.metadata.identifier?.value;
    if (!id || !isUnderBaseUrl(id, this.baseUrl)) return;

    const profiles = input.metadata.getAll(DCT.terms.conformsTo);
    for (const profile of profiles) {
      addHeader(input.response, "Link", `<${profile.value}>; rel="profile"`);
    }
  }
}
```

Components.js wiring inserts this writer into the MetadataWriter ParallelHandler after `MetadataWriter_LinkRel` so it composes additively with existing Link headers (Memento's timegate/timemap + describedby). Dockerfile gets the standard symlink trick per the `css-extension` skill.

`solid-config.json` updates: add `@cogitarelink/profile-link` to the `@context` array and import the wiring JSON.

## Component 5 — Overlay schema additions and apply.py wiring

New predicates in `css/config/pod-templates/base/ontology/overlay.ttl`:

```turtle
overlay:installsProfile      a rdf:Property ;
    rdfs:label "Pod URL of a PROF profile descriptor this overlay uploads" ;
    rdfs:isDefinedBy <> .

overlay:installsRoleScheme   a rdf:Property ;
    rdfs:label "Pod URL of a SKOS role-concept scheme this overlay publishes" ;
    rdfs:isDefinedBy <> .
```

Manifest updates at `overlays/wiki-memory/manifest.ttl`:

```turtle
overlay:installsRoleScheme
    </vault/ontology/wikirole> ;

overlay:installsProfile
    </vault/meta/profiles/page> ,
    </vault/meta/profiles/concept> ,
    </vault/meta/profiles/source> ,
    </vault/meta/profiles/person> ,
    </vault/meta/profiles/procedure> ,
    </vault/meta/profiles/working> ;
```

`scripts/overlay/common.py` learns `role_scheme_urls(manifest)` and `profile_urls(manifest)` helpers, mirroring the existing `shape_urls` / `affordance_urls` patterns (~10 LOC each).

`scripts/overlay/apply.py` upload sequence becomes:

1. Vocabulary (existing) — wiki vocabulary at `/vault/ontology/wiki`
2. **Role scheme (NEW)** — wikirole scheme at `/vault/ontology/wikirole`
3. Containers (existing)
4. Shapes (existing)
5. Affordances (existing) — now references wikirole IRIs minted in step 2
6. **Profiles (NEW)** — six PROF descriptors
7. Type registrations (existing)
8. Storage description patch (existing)

Order matters because step 5 (affordances) now references `wikirole:*` IRIs minted in step 2, and step 6 (profiles) references shapes/contexts/vocabulary URIs uploaded in earlier steps.

## Component 6 — Storage description discovery

`css/config/void-description.json` gains:

```jsonc
{
  "void:vocabulary": [
    "https://pod.vardeman.me/vault/ontology/wiki",
    "https://pod.vardeman.me/vault/ontology/wikirole"  // NEW
  ],
  "prof:hasResource": [
    // six PROF profile descriptor URIs
    "https://pod.vardeman.me/vault/meta/profiles/page",
    "https://pod.vardeman.me/vault/meta/profiles/concept",
    "https://pod.vardeman.me/vault/meta/profiles/source",
    "https://pod.vardeman.me/vault/meta/profiles/person",
    "https://pod.vardeman.me/vault/meta/profiles/procedure",
    "https://pod.vardeman.me/vault/meta/profiles/working"
  ]
}
```

(Exact JSON-LD shape verified during implementation; `prof:hasResource` may need to be replaced with a different pointer property depending on how CSS's StaticStorageDescriber composes the `.well-known/solid` document.)

## Testing strategy

| Test | Asserts | Location |
|---|---|---|
| Unit — writer reads multi-valued `dct:conformsTo` | One `Link: rel="profile"` per value | `css/extensions/profile-link/test/profile-link.test.ts` |
| Unit — writer composes with MementoLink | Same response carries both `rel="profile"` and `rel="timegate"` | same |
| Unit — writer skips non-pod-resources | No header when identifier is outside baseUrl | same |
| Integration — GET a SHACL shape | `Link: <https://www.w3.org/TR/shacl/>; rel="profile"` present | `tests/test_phase5j_close.py` |
| Integration — GET a wiki:Concept page | Both `wiki:ConceptProfile` AND Solid Protocol URI present in Link header | same |
| Integration — GET an affordance descriptor | PROF spec URI present | same |
| Integration — GET `/.well-known/solid` | Lists wiki + wikirole vocabularies + six profile descriptor URIs | same |
| Integration — dereference `/vault/ontology/wikirole` | Returns SKOS scheme with 5 `prof:ResourceRole` instances | same |
| Vault import smoke test | Importer adds `dct:conformsTo wiki:ConceptProfile` to imported concept page `.meta` | `tests/test_vault_import.py` extended |

## Out of scope (this round)

Explicitly deferred and tracked in `FOLLOWUPS.md`:

- `_profile=alt` introspection view (defer until eval shows a use case)
- Conneg-by-profile request handling (responding to `Accept-Profile`, redirecting on profile mismatch) — Link emission only
- Framing-2 refactor: drop `wiki:*Affordance` classes in favor of pure PROF typing — clean follow-up enabled by this round
- PROF profile descriptors enriched with `prof:hasResource` pointing at affordances — possible enrichment, not necessary for the architecture
- CSS storage description PATCH gate (existing follow-up item, unrelated to this design)

## Open implementation question

**CSS metadata-availability spike**: Confirm whether `MetadataWriterInput.metadata.getAll(DCT.terms.conformsTo)` returns triples from the resource body (for RDF resources) and/or from `.meta` (for non-RDF resources) by the time MetadataWriters run.

- For RDF resources where body carries `dct:conformsTo`: likely already populated (CSS parses RDF responses into RepresentationMetadata).
- For non-RDF resources where `dct:conformsTo` lives only in `.meta` (Markdown pages, JSON-LD context): may need a `MetadataReader` injected upstream, or the writer doing its own store lookup.

Resolved by reading CSS source in the implementation plan's first task. Two fallback paths if needed:

1. Inject a `MetadataReader` upstream that always loads `.meta` for the resource before MetadataWriters run.
2. Writer does its own store lookup via `metadataController.handleSafely({identifier, …})`.

Either is ~15 LOC. Not a design blocker.

## Acceptance criteria

Round is complete when:

- [ ] `/vault/ontology/wikirole` resolves and returns the SKOS scheme with 5 role concepts
- [ ] `.well-known/solid` lists both wiki + wikirole vocabularies + six profile descriptor URIs
- [ ] GET on any substrate resource (shape, vocab, profile, affordance, context) returns `Link: rel="profile"` with the appropriate W3C target
- [ ] GET on a wiki content resource returns `Link: rel="profile"` with the relevant `wiki:*Profile` URI
- [ ] All affordance descriptors carry both `wiki:*Affordance` typing AND `prof:ResourceDescriptor` typing + `prof:hasRole` + `dct:conformsTo`
- [ ] Integration test suite passes
- [ ] `overlay apply` rebuilds the Pod cleanly with the new schema additions

## References

- `.claude/skills/solid-profiles-and-conneg/SKILL.md` and `references/spec.md` — authoritative summary of PROF + conneg-by-profile + RFC 6906
- `.claude/skills/solid-uri-conformance/SKILL.md` — IRI form for profile / role-scheme namespaces (D84)
- `.claude/skills/css-extension/SKILL.md` — extension scaffold pattern
- `.claude/skills/metadata-writer/SKILL.md` — addHeader composition
- `css/extensions/memento/src/MementoLinkMetadataWriter.ts` — 31-LOC reference pattern
- `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md` — D44, D52, D58, D78, D81, D83, D84, D86
- `FOLLOWUPS.md` — closes items 1 and 2 of "Phase 5j (2026-05-16) — URI conformance close-out"
