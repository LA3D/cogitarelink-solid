# Foundational Ontology Cache (`ontology/`)

This directory grounds the vocabularies the substrate is built on. It is the
**basis of our vocabulary cache** and the source for the **base vocabulary
index** in D109 §7 — the minimum conceptual context an agentic harness loads on
first arrival at the Pod, before per-application ontologies (wiki-memory,
AddressBook) are loaded dynamically.

See `docs/superpowers/specs/2026-06-01-substrate-regrounding-design.md` (D109)
for the architecture this cache serves.

## How a vocabulary is handled (three tiers)

- **Grounded** — cached here verbatim as a `.ttl` with a provenance header.
  Use when the vocab is foundational, we author SHACL / JSON-LD context against
  it, and/or it must load offline + into agent context.
- **Declared-by-reference** — named in the storage description's
  `void:vocabulary` (D49) as an external IRI, *not* cached. Use for stable,
  dereferenceable vocabs we only reference.
- **Enumerated-but-deferred** — named in D109 as in-scope but not yet grounded
  (the identity / auth / VC / DID layer). Cache when that work starts.

## Provenance convention (every cached external file)

A `#` header block, then the **verbatim** upstream vocab below it:

```
# <Name> — cached grounding artifact
# Source:    <namespace IRI>   (Turtle alt: <.ttl>)
# Retrieved: <YYYY-MM-DD>
# Namespace: <IRI>    prefix: <pfx>
# Status:    <maturity / volatility notes>
# Use:       <why we ground it / adoption policy>
# Note:      verbatim cache — do not edit term defs; re-pull from source.
```

**Do not hand-edit cached term definitions** — re-pull from source if upstream changes.

## The partitioned foundational stack

| Layer | Namespace | Role | Tier |
|---|---|---|---|
| **L1/L2 substrate** | `ldp:` | LDP containers, RDF/NonRDFSource | ground (planned) |
| | `solid:` (terms) | TypeIndex, `publicTypeIndex`, `oidcIssuer` | ground (planned) |
| | `pim:` (space) | `pim:Storage` (storage desc, D44) | declare |
| | `as:` (ActivityStreams 2) | `mem:*` trigger base (D74) | ground (planned) |
| | `notify:` | Solid Notifications Protocol (D74) | verify + ground |
| | `sh:` (SHACL) | the validation floor | ground (planned) |
| | `void:` / `dcat:` / `ni:` | storage desc, content integrity (D21) | declare |
| **Agentic-app interop** | `interop:` | app/agent/registration/access-need | **GROUNDED** |
| | `st:` (Shape Trees) | interop data binding (`registeredShapeTree`→`st:ShapeTree`); `st:shape`→our SHACL | **GROUNDED** `shapetrees.ttl` (ns IRI not dereferenceable) |
| **Identity / auth / VC / IDs** | `acl:` (WAC) | interop's `accessMode` target | enumerate-defer |
| | `acp:` (ACP) | preferred authz | enumerate-defer |
| | VCDM (`cred:`) | Verifiable Credentials (W3C Rec) | enumerate-defer |
| | `sec:` | Data Integrity proofs / DID verif. methods | enumerate-defer |
| | `did:` (DID Core, W3C Rec) | identity-layer agent/owner identifiers (D14 bridge) | **GROUNDED** `did.ttl` + `did-v1.context.jsonld` (prefer `did:webvh`; migration deferred) |
| | `odrl:` | fine-grained policy (KG permissions aspect) | note only |
| **Identifier schemes (D111)** | `idot:` (identifiers.org types) | scheme records: `idot:Namespace`/`Resource`/`urlPattern`/`luiPattern`/`sampleID` | **GROUNDED** `idot.ttl` (v0.3) |
| | `datacite:` (SPAR DataCite) | identifier-scheme individuals (`datacite:doi`, …) for `skos:exactMatch` | **GROUNDED** `datacite.ttl` |
| **Domain / L3** | skos, dct, schema, foaf, cito, vcard, org, td, oslc | content vocab | declare (cache SKOS/DC to fix drift) |
| | `prov:` (PROV-O) | provenance/curation (D112 hadPlan axioms) | **GROUNDED** `prov.ttl` |
| **Minted (ours)** | wiki, sub, mem, **overlay, cap** | L3 + substrate | ours — re-base overlay/cap on `interop:` (D110) |

The **grounded** set *is* the base vocabulary index the agentic harness loads on
startup (D109 §7). Per-application ontologies layer on top, loaded dynamically
when that application engages (interop `ApplicationRegistration` + `AccessNeedGroup`).

## Current contents

- `solid-pod-profile.ttl` — ours (PROF `SolidPodProfile`, D12).
- `vault-ontology.ttl` — ours (vault KG vocabulary).
- `interop.ttl` — cached 2026-06-02, W3C Solid Application Interoperability
  vocabulary (569 triples, rdflib-validated). **Adopted as the agentic-app
  foundational vocabulary: vocabulary now; Authorization-Agent runtime + full
  grant flow deferred; grant-half is volatile (CG-DRAFT relitigating, issue
  #334); `st:` Shape-Tree coupling bridged to our SHACL.** Corrects the earlier
  "SAI is too heavy, don't use it" dismissal, which conflated the immature
  *runtime* with the foundational *vocabulary*. Re-bases bespoke
  `cap:`/`overlay:` app-declaration terms (proposed D110).

- `shapetrees.ttl` — cached 2026-06-02 (143 triples, rdflib-valid); W3C Solid CG Shape Trees
  vocab (`st:`). **Grounded because the namespace IRI is not dereferenceable** (shapetrees.org
  unreachable) yet it is REQUIRED to operate interop's data binding (`interop:registeredShapeTree
  → st:ShapeTree`). `st:shape` is shape-language-agnostic → points at our SHACL NodeShapes;
  `st:focusNode` → the resource's `<#this>`; `st:contains` → container hierarchy. Upstream
  namespace drift documented in the file header (interop.ttl's `shapetree#` singular vs the
  ontology's `shapetrees#` plural — we use the plural).

- `did.ttl` — cached 2026-06-02; DID Core RDFS vocab (`did:`, W3C Rec) + `did-v1.context.jsonld`
  (the DID-document JSON-LD context). **Grounded ahead of the deferred URI/DID migration** so the
  identity-layer ontology isn't missing later; for web-hosted DIDs prefer **`did:webvh`** (did:web +
  verifiable history — trust off DNS). DID↔Solid integration deferred (Solid #217/#35 dormant). See
  `solid-identity-stack` did.md + D109 §5. `sec:` companion (verification methods) stays enumerate-defer.

- `idot.ttl` — cached 2026-06-05, identifiers.org types vocabulary **v0.3** (160 triples,
  rdflib-validated). **Grounded for D111** (identifier-scheme substrate): scheme records are
  `idot:Namespace` (⊑ `dcat:Dataset`) + providers `idot:Resource` (⊑ `dcat:DataService`,
  `idot:urlPattern`). Confirmed namespace = `http://identifiers.org/idot/` (the IRI the vocab
  declares; `owl:versionIRI <http://identifiers.org/0.3>`). Live source = identifiers-org/ontop
  (`biomodels.net/vocab/idot.rdf` is 403/dormant). **v0.3 term names differ from the D111 plan's
  guesses**: the ID-regex pattern is `idot:luiPattern` (not `idRegexPattern`) and the example
  identifier is `idot:sampleID` (not `exampleIdentifier`) — the cache is the source of truth.
- `prov.ttl` — cached 2026-06-05, W3C PROV-O (Provenance Ontology, W3C Rec 2013-04-30,
  1146 triples, rdflib-validated). **Grounded for D112**: the curation-protocol spec
  requires every curation proposal to carry `prov:qualifiedAssociation [ prov:hadPlan <plan> ]`;
  the `hadPlan` and `qualifiedAssociation` domain/range axioms are normative dependencies.
  Namespace `http://www.w3.org/ns/prov#`; prefix `prov:`.

- `datacite.ttl` — cached 2026-06-05, SPAR DataCite ontology (OWL 2 DL, 936 triples,
  rdflib-validated; tracks DataCite Metadata Schema 4.7). **Grounded for D111**: provides the
  identifier-scheme individuals (e.g. `datacite:doi` at `<http://purl.org/spar/datacite/doi>`)
  that scheme records reference via `skos:exactMatch`. Term/class namespace =
  `http://purl.org/spar/datacite#`; scheme individuals live under the slash form
  `http://purl.org/spar/datacite/`.

## Drift to reconcile

CLAUDE.md describes `ontology/` as holding "cached ontology stubs (SKOS, DC,
PROV-O)" — PROV-O is now **grounded** (`prov.ttl`, 2026-06-05). SKOS and DC
remain declared-by-reference; cache them to fix offline SHACL dev + complete
the base index.

## Connections

- **D109** — substrate re-grounding; foundational-ontology layer + §7 base vocabulary index.
- **D110** (proposed) — re-base `cap:`/`overlay:` on `interop:`.
- **D49** — `void:vocabulary` declarations in the storage description.
- **D107** — `sub:` namespace + `solid:publicTypeIndex` reuse.
- **D14** — WebID↔DID bridge (the identity layer the `enumerate-defer` tier serves).
