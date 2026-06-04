# Identifier Types as Agent Affordances — Prior-Art Research (2026-06-04)

Grounding input for the identifier-affordance brainstorm (the `dct:identifier` design thread that
emerged from the fragility audit + Chuck's affordance framing). Gathered live 2026-06-04; the
ontologydesignpatterns.org wiki was UNREACHABLE during research — the "Identifier" content ODP could
not be verified and is an open lookup, NOT established prior art. SPAR DataCite is the de-facto
community identifier pattern in the meantime.

## The four-column comparison (the punchline)

No single prior art spans the four affordance columns; the design is necessarily a layered synthesis.

| Prior art | (a) types the value | (b) per-scheme regex | (c) resolution templates | (d) meaning of resolved repr. |
|---|---|---|---|---|
| SPAR DataCite ontology | ✅ scheme = named URI individual + Identifier/Scheme subclass trees | ❌ | ❌ | ❌ |
| ADMS | ✅ scheme = DATATYPE of `skos:notation` + `schemeAgency` | ❌ | ❌ | ❌ |
| DataCite Metadata Schema | ✅ flat `identifierType` string | ❌ | ❌ | ❌ |
| schema.org `PropertyValue` | ✅ `propertyID` (string OR registry URL) + `value` | bridge via propertyID-as-URL | bridge | ❌ |
| **identifiers.org** | ✅ namespace prefix | ✅ **`idRegexPattern`** (only one) | ✅ **`urlPattern {$id}` + multi-provider + scores** (only one) | ❌ |
| **W3C PROF + conneg** | indirect | via `role:validation` artifact | ❌ | ✅ **only one** — `role:` descriptors + `Link rel="profile"` |
| ODP "Identifier" CP | **unverified — wiki unreachable** | — | — | — |

## 1. SPAR DataCite ontology (`http://purl.org/spar/datacite/`)

Reified-identifier pattern: `datacite:hasIdentifier` (inverse-functional) → `datacite:Identifier`
node carrying `literal:hasLiteralValue "…"` (literal-reification vocab,
`http://www.essepuntato.it/2010/06/literalreification/`) + `datacite:usesIdentifierScheme` → a
**scheme individual**. Class trees on BOTH sides encode what-kind-of-thing-is-identified:
`Identifier` → Resource/Agent(Personal|Organization|Funder)/Rights; `IdentifierScheme` mirrors.

Scheme individuals (dispatch table): resource — doi, ark, arxiv, bibcode, cstr, dblp-record, dnb,
ean13, eissn, handle, igsn, infouri, isbn, issn, istc, lissn, local-resource-identifier-scheme,
lsid, nihmsid, oci, oclc, pii, pmcid, pmid, purl, rrid, sici, spdx, upc, uri, url, urn, wikipedia,
opendoar; personal — orcid, acm, dblp, dia, gepris, gitlab, google-scholar, ieee, isni, jst,
local-personal-identifier-scheme, math-genealogy, national-insurance-number, nii, openid, repec,
research-gate, researcherid, social-security-number, viaf, zbmath; agent — github, lattes,
linkedin, twitter; organization — crossref, isni, local-organization-identifier-scheme, ror;
funder — fundref, local-funder-identifier-scheme; top-level — gnd, ivoid, loc, omid, scigraph,
spase, w3id, wikidata, openalex.

```turtle
:person-456  datacite:hasIdentifier  :orcid-id .
:orcid-id  a datacite:PersonalIdentifier ;
    literal:hasLiteralValue "0000-0002-5159-9717" ;
    datacite:usesIdentifierScheme datacite:orcid .
```

Right for dispatch: scheme is a first-class named individual; subclass trees = affordance-class
routing. Gotchas: verbose (node + 3 triples per id); extra literal-reification vocab; **no regex,
no resolution** — schemes are opaque markers.

## 2. ADMS (`http://www.w3.org/ns/adms#`)

UN/CEFACT identifier-node: `adms:identifier` → `adms:Identifier` with the value in
**`skos:notation` "…"^^<scheme-datatype>** — the spec explicitly says the content string is
"datatyped with the identifier scheme" (scheme = the literal's DATATYPE IRI — W3C precedent for the
datatype move). Plus `adms:schemeAgency` (bare literal) + `dcterms:creator` (agency Agent).
Gotchas: you must mint a datatype IRI per scheme; no regex/resolution; agency unlinked by default.

## 3. DataCite Metadata Schema (API-level flat typing)

`identifierType` restricted to "DOI" for the primary id; `relatedIdentifierType` enumeration (4.6):
ARK, arXiv, bibcode, CSTR, DOI, EAN13, EISSN, Handle, IGSN, ISBN, ISSN, ISTC, LISSN, LSID, PMID,
PURL, RRID, UPC, URL, URN, w3id (4.7 adds RAiD, SWHID). String keys, not URIs — easy to switch on,
collision-prone, no dereference.

## 4. identifiers.org / compact identifiers — the affordance-registry exemplar

Compact id = `prefix:LUI` (`pdb:2gc4` → `https://identifiers.org/pdb:2gc4`); provider-pinned form
`pdbe/pdb:2gc4`. Per-namespace registry entry (REST `https://registry.api.identifiers.org`) carries
THE operational affordances:
- **`idRegexPattern`** — validation regex for the LUI (gotcha: registry issue #99 — regex not always
  consistent with `sampleId`);
- **`sampleId`** — worked example;
- `namespaceEmbeddedInLui` flag;
- **`resources[]` (providers)**, each: **`urlPattern` with `{$id}`**, `providerCode`, official flag,
  recommendation score (highest wins unless pinned).
Resolution API `https://resolver.api.identifiers.org/{cid}`. Lineage: MIRIAM registry, harmonized
with N2T; Wimalaratne et al. 2018 (Sci Data) + 2021 cloud follow-up.

Right for dispatch: the purest identifier-type→affordance registry — validate + resolve from the
entry alone. Gotchas: centralized, life-sciences-curated; says nothing about what the resolved
representation MEANS.

## 5. schema.org identifier

`schema:identifier` range: Text | URL | **PropertyValue**. The typing pattern: `propertyID` (the
scheme key) + `value`. Per schemaorg#2549 (open, "work expected"): `propertyID` may be a prefixed
string ("datacite:doi"), a site-local string ("OCoLC"), or — recommended practice — **a registry
URL** (`https://registry.identifiers.org/registry/doi`), with optional `name`/`url`. The natural
bridge: propertyID points AT an identifiers.org-style affordance record. Gotcha: gloriously
underspecified — convention, not contract.

## 6. W3C PROF precision pass

- Status: PROF = WG **Note** (2019-12-18); conneg-by-profile = **WD** (2023-10-02); role list
  flagged at-risk (Issue 1073) **but extension explicitly encouraged**.
- Terms: `prof:Profile` ⊑ `dct:Standard`; `prof:ResourceDescriptor` ("defines an aspect of a
  Profile"); `prof:ResourceRole` ⊑ `skos:Concept`; `hasResource`/`hasRole`/`hasArtifact`/
  `isProfileOf`/`isTransitiveProfileOf`/`isInheritedFrom`.
- The 8 canonical roles (`http://www.w3.org/ns/dx/prof/role/`): constraints, example, guidance,
  mapping, schema, specification, validation, vocabulary.
- **Extending roles:** "communities are encouraged to create additional prof:ResourceRole
  instances" — mint as `skos:Concept` + relate via `skos:broader`/`narrower` to canonical roles.
- Conneg: request `Accept-Profile:`; response = `Link: <uri>; rel="profile"` (**NO
  Content-Profile** — matches the repo's standing rule); QSA `?_profile=` (+ `?_profile=alt`
  listing); token↔URI binding via a `Link …; rel="type"; token=…; anchor=…` declaration.
  RFC 6906 is the only IETF-ratified layer.

## Net synthesis direction (for the brainstorm)

Layered: **typing** via a scheme key on the value (ADMS-style datatype and/or schema.org
PropertyValue — and DataCite's individuals as the shared anchors via `skos:exactMatch`);
**operational affordances** (regex + resolution templates + providers) identifiers.org-style,
re-expressed in RDF on the Pod's own scheme records; **semantic affordances** (what resolution
returns: which SHACL, vocabulary, examples) via PROF ResourceDescriptors + `rel="profile"`.
The Pod-native move under consideration: mint each scheme record as a dereferenceable Pod resource
that serves all three layers at one IRI — and use THAT IRI as the literal's datatype, so
`"10.1234/x"^^<…/identifier-schemes/doi>` makes the type itself the progressive-disclosure entry
point. Open ODP lookup: check ontologydesignpatterns.org for an Identifier CP when reachable.
