# Profiles and Conneg — Standards Reference

Self-contained reference: PROF + Conneg-by-Profile + RFC 6906. Primary sources cited inline; this document doesn't depend on any project-internal context.

## Contents

1. [PROF — Profiles Vocabulary](#1-prof--profiles-vocabulary)
2. [Conneg-by-Profile (W3C WD)](#2-conneg-by-profile-w3c-wd)
3. [RFC 6906 — the `profile` Link Relation](#3-rfc-6906--the-profile-link-relation)
4. [The pattern: class IRI ≠ profile IRI](#4-the-pattern-class-iri--profile-iri)
5. [Worked example: GeoSPARQL 1.1](#5-worked-example-geosparql-11)
6. [Caveats — what's at risk](#6-caveats--whats-at-risk)
7. [Sources](#7-sources)

---

## 1. PROF — Profiles Vocabulary

**Status**: [W3C Working Group Note](https://www.w3.org/TR/dx-prof/), 18 Dec 2019. §2 Conformance: sections 7 (Conceptual Model), 8 (Vocabulary Specification), and 11 (Test Suite) are normative; everything else is informative.

**Namespace**: `prof: <http://www.w3.org/ns/dx/prof/>`

### Core classes (§8.3–§8.5)

| Class | Definition (verbatim) |
|---|---|
| `prof:Profile` (§8.3) | "A specification that constrains, extends, combines, or provides guidance or explanation about the usage of other specifications." Subclass of `dct:Standard`. |
| `prof:ResourceDescriptor` (§8.4) | "A resource that defines an aspect — a particular part or feature — of a Profile." |
| `prof:ResourceRole` (§8.5) | "A role that an profile resource, described by a Resource Descriptor, plays." Subclass of `skos:Concept`. |

### Core properties

| Property | Domain | Range | Use |
|---|---|---|---|
| `prof:hasResource` (§8.3.1) | `prof:Profile` | `prof:ResourceDescriptor` | Lists the artifacts in this profile |
| `prof:isProfileOf` (§8.3.2) | `prof:Profile` | `dct:Standard` | Direct parent specification |
| `prof:isTransitiveProfileOf` (§8.3.3) | `prof:Profile` | `dct:Standard` | Full ancestor chain — emit explicitly |
| `prof:hasToken` (§8.3.4) | `prof:Profile` | `xsd:token` | Short identifier for conneg (e.g., `"wiki-concept"`) |
| `prof:hasArtifact` (§8.4.1) | `prof:ResourceDescriptor` | (rdfs:Resource) | The downloadable file URL |
| `prof:hasRole` (§8.4.4) | `prof:ResourceDescriptor` | `skos:Concept` | One of the 8 standard roles or a minted custom |
| `prof:isInheritedFrom` (§8.4.5) | `prof:ResourceDescriptor` | `prof:Profile` | Lets a child re-expose an ancestor's descriptor |

PROF imposes no SHACL/OWL cardinality constraints on its own properties — these are documentation conventions, not validation rules.

### The transitivity axiom (§8.4.2) — at risk

PROF declares this property chain:

```turtle
dct:conformsTo owl:propertyChainAxiom ( prof:isProfileOf dct:conformsTo ) .
```

Meaning: "if the thing conformed to is a profile of something else (indicated by `prof:isProfileOf`), then the conforming data resource will be inferred to be conformant to that other thing too."

**Flagged at-risk by [PROF Issue 1078](https://github.com/w3c/dxwg/issues/1078).** Most implementations don't apply it; treating it as load-bearing will produce surprising gaps. Mitigation: emit `prof:isTransitiveProfileOf` explicitly on every profile that has ancestors. Pre-flatten the chain at write time; clients don't need a reasoner.

### `dct:conformsTo` vs `prof:isProfileOf` vs `prof:isTransitiveProfileOf`

Three predicates that look similar; they're not interchangeable:

- **`dct:conformsTo`** — on **instance data**, declares conformance to a `dct:Standard` or `prof:Profile`.
- **`prof:isProfileOf`** — on a **`prof:Profile`**, points at the direct parent specification.
- **`prof:isTransitiveProfileOf`** — on a **`prof:Profile`**, exposes the full ancestor chain so clients don't traverse.

```
                      pattern
                    ──────────────
        instance data → dct:conformsTo → profile
        profile        → prof:isProfileOf → base-spec
        (reasoner WOULD infer) instance → dct:conformsTo → base-spec
        (we emit explicitly)   profile → prof:isTransitiveProfileOf → base-spec
```

### The token (§8.3.4)

`prof:hasToken` carries a short `xsd:token` "for use in circumstances where its URI cannot be used, such as API arguments or in content negotiation." This is what lets `_profile=dcat-ap` work in QSA conneg without spelling the full URI. Real examples in the wild: `"dcat-ap"`, `"profx"`, `"ePubDC"`, `"iso19115-ga"`.

### The role registry (§9) — 8 standard roles, extension permitted

Vocabulary: `role: <http://www.w3.org/ns/dx/prof/role/>`. All 8 flagged at-risk by [PROF Issue 1073](https://github.com/w3c/dxwg/issues/1073) but extension is explicitly permitted per §8.5.

| Role | Definition (verbatim from §9) |
|---|---|
| `role:constraints` | "Descriptions of obligations, limitations or extensions that the profile defines" |
| `role:example` | "Sample instance data conforming to the profile" |
| `role:guidance` | "Documents, in human-readable form, how to use the profile" |
| `role:mapping` | "Describes conversions between two specifications" |
| `role:schema` | "Machine-readable structural descriptions of data defined by the profile" |
| `role:specification` | "Defining the profile in human-readable form" |
| `role:validation` | "Supplies instructions about how to verify conformance of data to the profile" |
| `role:vocabulary` | "Defines terms used in the profile specification" |

**Custom roles** are fine. GeoSPARQL 1.1's profile uses `role:repository` (pointing at GitHub) — not in §9, no controversy. Document the new role with `skos:definition`.

---

## 2. Conneg-by-Profile (W3C WD)

**Status**: [W3C Working Draft](https://www.w3.org/TR/dx-prof-conneg/), 02 Oct 2023. Never advanced to Recommendation.

### Conceptual model (§6)

Two abstract operations:

- **List profiles** (§6.3.1) — client asks "what profiles can this resource be returned in?" Server **MUST NOT** advertise profiles it cannot deliver.
- **Get resource by profile** (§6.3.2) — client requests a resource in a specific profile, by URI or by token.

The spec's key framing (§5.1.1, verbatim):

> "the 'profile' parameter in the `Accept` and `Content-Type` headers should be seen to convey profiles that are specific to the Media Type, such as JSON-LD's 'expanded' or 'flattened'. In order to signal the use of Media Type-independent profiles, the http header fields `Accept-Profile` and `Link: <…>; rel='profile'` are to be used."

**`Accept` selects bytes (Turtle vs JSON-LD). `Accept-Profile` selects meaning (which shape, which constraints, which schema).**

### Four functional profiles (§7.1)

A server can implement one or several:

| Functional Profile | Mechanism |
|---|---|
| `…/connegp/profile/http` | HTTP headers — `Accept-Profile` request, `Link: rel="profile"` response |
| `…/connegp/profile/qsa` | Query string args: `_profile`, `_mediatype` |
| `…/connegp/profile/qsa-alt` | Custom query keys; server advertises via Link headers |
| `…/connegp/profile/rrd` | Resource Representation Description |

### HTTP headers profile (§7.2)

**Request** — `Accept-Profile`:

```
Accept-Profile: <urn:example:profile:x>;q=1.0, <urn:example:profile:y>;q=0.6
```

URIs MUST be in angle brackets. Multiple profiles allowed; q-values express preference.

**Server response (§7.2.2, MUST):**

> "A server implementing content negotiation by profile MUST respond with an HTTP Response header containing a `Link` header with `rel="profile"` indicating the profile returned."

```http
HTTP/1.1 200 OK
Content-Type: text/markdown
Link: <https://example.org/profiles/concept>; rel="profile"
```

**Critical: do NOT emit `Content-Profile`.** That header lives only in the expired IETF draft [`draft-svensson-profiled-representations-01`](https://datatracker.ietf.org/doc/draft-svensson-profiled-representations/01/) (Svensson/Verborgh/Van de Sompel, expired 10 Sept 2021; no successor adopted). The W3C WD explicitly chose `Link: rel="profile"` instead.

### List profiles (§7.2.1, SHOULD)

Respond to `HEAD` or `GET` with multiple `Link` headers using `rel="canonical"` and `rel="alternate"`, each annotated with `type=` (media type) and `format=` (profile URI):

```http
Link: <https://example.org/resource/a>;
        rel="canonical"; type="text/turtle";
        format="https://example.org/profiles/x",
      <https://example.org/resource/a>;
        rel="alternate"; type="text/turtle";
        format="https://example.org/profiles/y"
```

**The `format=` Link parameter carries the profile URI, not a media type.** This is the non-obvious detail that trips up implementers.

### QSA profile (§7.3)

- `_profile=<token-or-uri>` — **MUST** be supported under QSA profile.
- `_mediatype=<media-type>` — **SHOULD** be supported.
- `_profile=alt` — **SHOULD** be supported. **Reserved token for list-profiles**. (Note: spec uses `alt`, not `alternates`.)

### Error responses

§6.3.2 says server SHOULD "attempt to reply with a profile that best matches"; example uses 303 See Other. **No MUST on 406, 415, or 300.** The expired IETF draft prescribed 406; the WD does not. Choose pragmatically.

---

## 3. RFC 6906 — the `profile` Link Relation

**Status**: [IETF Informational](https://www.rfc-editor.org/info/rfc6906), March 2013. The only IETF-published piece of the stack (Informational, not a Standards-Track Proposed Standard — but the `profile` link relation is registered with IANA and is the canonical mechanism in use).

§3 (verbatim):

> "A profile can be described as additional semantics that can be used to process a resource representation, such as constraints, conventions, extensions, or any other aspects that do not alter the basic media type semantics."

> "A profile MUST NOT change the semantics of the resource representation when processed without profile knowledge, so that clients both with and without knowledge of a profiled resource can safely use the same representation."

**Implication**: `wiki:ConceptProfile` adds semantics ("this is a wiki:Concept page with these constraints"), but the underlying Markdown body MUST still be valid Markdown that any client can read without knowing the profile. The profile is *additional* meaning, not new bytes.

**Profile URIs are identifiers, not auto-dereference targets.** RFC 6906: "Profile URIs are primarily intended to be used as identifiers, and thus clients SHOULD NOT indiscriminately access profile URIs." Seeing a `Link: rel="profile"` header doesn't license fetching that URI on every request.

---

## 4. The pattern: class IRI ≠ profile IRI

**Profiles are their own resources, not classes.** PROF §8.3: `prof:Profile rdfs:subClassOf dct:Standard`. An RDF class (`wiki:Concept`, an `owl:Class`) can't be a `prof:Profile`. Conflating them prevents the profile from cleanly declaring `prof:hasResource` and `prof:isProfileOf`.

```turtle
# The OWL class — what KIND of thing
wiki:Concept a owl:Class ;
  rdfs:label "Wiki concept page" .

# The PROF profile — what constraints/artifacts apply
wiki:ConceptProfile a prof:Profile ;
  rdfs:label "Wiki-Memory L3 Concept profile" ;
  prof:hasToken "wiki-concept" ;
  prof:isProfileOf wiki:PageProfile ;
  prof:hasResource [ … ] .

# Instance data declares BOTH
</vault/wiki/pages/context-graphs>
  a wiki:Concept ;
  dct:conformsTo wiki:ConceptProfile .
```

**SHACL shapes are artifacts inside the profile**, not the profile itself. All real-world PROF profiles wire shapes through `prof:hasResource → prof:ResourceDescriptor → role:validation → prof:hasArtifact <shape-file>`.

---

## 5. Worked example: GeoSPARQL 1.1

The [GeoSPARQL 1.1 profile.ttl](https://raw.githubusercontent.com/opengeospatial/ogc-geosparql/master/profile.ttl) is the most complete production PROF artifact in the wild. 181 lines. Roles used:

- `role:vocabulary` ×4 (GML types, GeoSPARQL functions, spatial-aggregate functions, simple features)
- `role:specification` ×4 (JSON-LD context geo, JSON-LD context sf, requirements vocab, HTML+PDF spec)
- `role:schema` ×2 (geo.ttl ontology, geo.json)
- `role:validation` ×1 (SHACL validator)
- `role:example` ×1 (extended examples)
- `role:repository` ×1 (**custom — minted because none of the 8 fit**)

GeoSPARQL declares itself at the *root* of its profile hierarchy (no `prof:isProfileOf`). PROF §8.3.2 explicitly permits this. Use this pattern for the top profile in your own application.

---

## 6. Caveats — what's at risk

Brief recap of the things that need defensive coding:

- **`dct:conformsTo` property chain axiom** (§8.4.2): at-risk per Issue 1078. Emit `prof:isTransitiveProfileOf` explicitly.
- **Role registry**: 8 standard roles at-risk per Issue 1073, but the spec permits extension. Mint custom roles when needed; document with `skos:definition`.
- **`Content-Profile` header**: defined only in [expired IETF draft `draft-svensson-profiled-representations-01`](https://datatracker.ietf.org/doc/draft-svensson-profiled-representations/01/) (expired 10 Sept 2021; never adopted as a WG document). The W3C WD explicitly chose `Link: rel="profile"` instead. Don't emit it.
- **`alt` vs `alternates`**: spec-reserved QSA token is `alt`. Some implementers write `alternates` from intuition; that's not in the spec.
- **PROF Working Group Note status**: PROF is not a Recommendation. Cite as "best-aligned standards work," not "the W3C mandates."
- **Conneg-by-Profile WD status**: same — WD, not REC.

---

## 7. Sources

| Source | Type | URL |
|---|---|---|
| W3C PROF (Profiles Vocabulary) | WG Note | https://www.w3.org/TR/dx-prof/ |
| PROF role registry | Reference | http://www.w3.org/ns/dx/prof/role/ |
| W3C Conneg-by-Profile | Working Draft | https://www.w3.org/TR/dx-prof-conneg/ |
| RFC 6906 (`profile` Link relation) | IETF Informational | https://www.rfc-editor.org/info/rfc6906 |
| draft-svensson-profiled-representations-01 (expired) | IETF expired draft (10 Sept 2021) | https://datatracker.ietf.org/doc/draft-svensson-profiled-representations/01/ |
| PROF Issue 1078 (chain at-risk) | GitHub | https://github.com/w3c/dxwg/issues/1078 |
| PROF Issue 1073 (roles at-risk) | GitHub | https://github.com/w3c/dxwg/issues/1073 |
| GeoSPARQL 1.1 profile.ttl | Worked example | https://raw.githubusercontent.com/opengeospatial/ogc-geosparql/master/profile.ttl |
| OGC SELFIE Engineering Report | OGC 20-067 | https://docs.ogc.org/per/20-067.html |
