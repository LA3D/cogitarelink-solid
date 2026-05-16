# URI Conformance — Authoritative Reference

Source material verbatim where possible. Citations link to original. This document is for *learning the standards*; for *what this Pod does*, see [`deltas.md`](deltas.md); for *paste-ready code*, see [`templates.md`](templates.md).

---

## 1. The Linked Data foundation (Berners-Lee 2006)

Four principles from [TBL's Linked Data design issue](https://www.w3.org/DesignIssues/LinkedData.html):

1. Use URIs as names for things.
2. Use HTTP URIs so people can look them up.
3. When someone looks up a URI, provide useful information using RDF standards.
4. Include links to other URIs so they can discover more things.

The operational gap is between (2) and (3): a URI can be HTTP-based without ever returning anything useful when dereferenced. This is the dereferenceability failure mode most ontology IRIs hit.

The W3C TAG resolved the core ambiguity in **httpRange-14** (2007): a URI for a non-information resource (a person, a concept) should return HTTP 303 redirecting to a document URI. A URI returning 200 directly is an information resource. Hash URIs sidestep this because the fragment never reaches the server.

**Sources**:
- Berners-Lee 2006, [Linked Data design issue](https://www.w3.org/DesignIssues/LinkedData.html)
- Sauermann & Cyganiak 2008, [Cool URIs for the Semantic Web](https://www.w3.org/TR/cooluris/) (W3C IG Note)
- Thalhammer et al. 2024, [Cool URIs for FAIR Knowledge Graphs](https://arxiv.org/abs/2407.09237)

---

## 2. Hash URIs vs slash URIs

### Hash (`http://example.org/vocab#Person`)

```
Client:  GET http://example.org/vocab     (fragment stripped by HTTP client)
         Accept: text/turtle
Server:  200 OK, [entire vocabulary]
Client:  extracts triples about #Person
```

- Fragment is client-side — server never sees it.
- One HTTP request retrieves multiple resources from the same document.
- Simpler: no special server config, no 303 redirects.
- Best for ontologies, small-to-medium stable vocabularies.

### Slash (`http://example.org/id/alice`)

```
Client:  GET http://example.org/id/alice
Server:  303 See Other → http://example.org/doc/alice
Client:  GET http://example.org/doc/alice
Server:  200 OK, [RDF about Alice]
```

- Each entity has its own URI; server can return different content per entity.
- Requires 303 redirects (httpRange-14 resolution).
- More HTTP round-trips, but enables per-resource access control.
- Best for large, evolving entity collections.

### What Solid does in practice

**Every official Solid vocabulary uses hash URIs.** This is the strongest practice-based signal in the ecosystem:

- `http://www.w3.org/ns/solid/terms#`
- `http://www.w3.org/ns/solid/oidc#`
- `http://www.w3.org/ns/auth/acl#`
- `http://www.w3.org/ns/ldp#`
- `http://www.w3.org/ns/pim/space#`

The [WebID 1.0 hash-URI rationale](https://www.w3.org/2005/Incubator/webid/wiki/WebID_Definition/hash2) makes the operational case verbatim:

> "Implementers are highly encouraged to use hash URIs for the WebID HTTP URI. Even though 303 redirects can be used instead, experience has shown that they can be difficult to deploy and can have an impact on performance."

This rationale generalizes from WebIDs to any Pod-hosted RDF — Pods don't readily issue 303 redirects, and CSS in particular has no straightforward 303 mechanism.

**For this Pod: hash, always.** No spec MUST, but every signal from the Solid ecosystem points the same way.

**Sources**:
- [W3C HashVsSlash wiki](https://www.w3.org/wiki/HashVsSlash)
- [Solid Vocabularies index](https://solid.github.io/vocab/) — verify all use `#`
- WebID 1.0 hash rationale (above)

---

## 3. Cool URI naming rules

Synthesized from `Cool URIs for FAIR KGs` (2024), Solid developer vocab guide, and TBL design issues. Each is a rule the skill enforces when reviewing a new IRI.

### Don't bake deployment details into the IRI

- **No port number.** `https://pod.vardeman.me/vault/ontology/wiki#Page`, not `https://pod.vardeman.me:3443/…#Page`. Port is a deployment detail; baking it in means migrating to port 443 breaks every triple.
- **No `http://` for vocabularies meant to outlive their first deployment.** Solid Protocol §3 mandates HTTPS. Vocab IRIs that survive a TLS migration are `https://` from day one.
- **No version in the base URI.** `…/vault/ontology/wiki#`, not `…/vault/ontology/v1/wiki#`. Versions belong in `owl:versionIRI` or `dct:hasVersion`, not in the namespace prefix.
- **No file extension in vocabulary IRI.** Solid's [vocab publishing guide](https://solidproject.solidcommunity.net/SPS/developers/vocabularies/publish/rdf.html) is explicit: "the resource identified by the IRI is not necessarily a single document." Vocab URI is `…/ontology/wiki`, served via content negotiation.

### Naming the resources

- **Mnemonic class names** — the Solid vocab guide says "short, memorable IRI are less error-prone." `wiki:Concept`, `wiki:Source`. **Not** `wiki:C7f4a3` or `wiki:0042`.
- **Opaque slugs for entity instances** when collisions are likely — but **mnemonic slugs are fine and preferred** when each entity has a natural human-readable name. `vault/wiki/pages/context-graphs` is good. The opaque-ID rule is for cases like Wikidata Q-numbers where mnemonic names cause rot (rename of an article = rename of every reference).
- **`@`-prefixed BibTeX citekeys must drop the `@`** in URIs and RDF terms (D76's S3a rule). JSON-LD treats `@`-prefixed terms as reserved keywords; Pandoc citation parsers misread them; RFC 3986 URI encoding is inconsistent. Strip on the way in.

### Trailing slash is load-bearing

Solid Protocol §3.1 — this is a MUST:

> "Paths ending with a slash denote a container resource."
> "If two URIs differ only in the trailing slash … then the other URI MUST NOT correspond to another resource."

Implication: a vocabulary at `/vault/ontology/wiki` (no trailing slash) and a container at `/vault/ontology/wiki/` cannot both exist. Pick one.

### URI normalization

[Solid spec issue #22](https://github.com/solid/specification/issues/22) flags URI normalization as **unresolved**. The Pod doesn't normalize for you. Always normalize before comparing:

- `http://` vs `https://` are distinct IRIs to the comparison engine.
- Trailing slash vs no trailing slash are distinct.
- Fragment vs no fragment are distinct.
- Case sensitivity: hostname is case-insensitive, path is case-sensitive.

The skill rule: write a tiny `normalizeIRI()` in any tool that compares IRIs, don't rely on the Pod.

**Sources**:
- [Cool URIs for FAIR KGs](https://arxiv.org/abs/2407.09237) — naming rules in §3
- [Solid vocab publishing guide](https://solidproject.solidcommunity.net/SPS/developers/vocabularies/publish/rdf.html)
- [Solid Protocol v0.11.0 §3.1](https://solidproject.org/TR/protocol#trailing-slash) — trailing slash MUST
- [Solid spec issue #22](https://github.com/solid/specification/issues/22) — URI normalization unresolved
- [TBL HTTPFilenameMapping](https://www.w3.org/DesignIssues/HTTPFilenameMapping.html) — extension-stripping pattern

---

## 4. The Pod-as-namespace-authority pattern

**The architectural commitment** of Solid is that an application's data, vocabulary, shapes, and affordances all live in the same Pod. The Pod IS the namespace authority for the application that lives on it.

**Is this in the spec?** No. **Is it forbidden?** Also no.

- Solid Protocol: silent on vocabulary hosting.
- Type Index spec: silent on whether class URIs may resolve in the same Pod (only says class URIs are opaque to the spec).
- Solid vocab publishing guide: recommends w3id.org for stable vocabularies — but this is for *general* vocabularies meant to be shared across many systems, not for per-Pod application vocabularies.

The closest architectural endorsement is TBL's [IcingOnTheCake](https://www.w3.org/DesignIssues/IcingOnTheCake.html) design issue: services around a live page are available at URIs made by adding small strings to the same URI. Per-app vocabulary as "icing" adjacent to the application URL fits this pattern.

**The trade-off you accept:**

- If the Pod URL changes (host migration, domain change), your vocabulary IRIs change too. Mitigated by HTTP 301/308 redirects from the old host.
- The vocabulary doesn't have w3id.org's institutional permanence guarantee.
- For widely-shared vocabularies, use w3id.org. For per-app vocab, use the Pod.

**The rule of thumb**:

- **App-local vocabulary** (will only ever be used inside this Pod's application) → Pod-hosted.
- **Cross-Pod profile** that other Pods will reference (e.g. `fabric:CoreProfile`, `wiki:WikiMemoryProfile` once stable) → w3id.org.

**Sources**:
- TBL [IcingOnTheCake](https://www.w3.org/DesignIssues/IcingOnTheCake.html)
- TBL [PodStuff](https://www.w3.org/DesignIssues/PodStuff.html) (silent on vocab specifically)
- [Solid Type Index spec](https://solid.github.io/type-indexes/)
- W3C [Permanent Identifier Community Group](https://github.com/perma-id/w3id.org) — when to use w3id

---

## 5. CSS vocabulary serving mechanics

CSS handles RDF as a first-class data format with internal content-negotiation pathfinding. This is what makes the no-extension pattern work.

### The conneg architecture

From Van Herwegen & Verborgh 2024, "The Community Solid Server":

> CSS uses a pathfinding algorithm that chains internal converters to transform between RDF serializations. It does not need a dedicated converter from Turtle to JSON-LD. Instead, there are converters: Turtle → internal Quad objects, and Quad objects → JSON-LD. The pathfinding algorithm finds and chains these automatically.

This means: store `wiki.ttl` (or any Turtle), and CSS will serve it as JSON-LD, N-Triples, RDF/XML, or any other RDF format on demand. No `.htaccess`, no multiple physical files, no Apache `mod_negotiation`.

### Storing a vocabulary on a Pod

```bash
# Upload Turtle to a no-extension path
curl -X PUT \
  -H "Content-Type: text/turtle" \
  -d @wiki.ttl \
  https://pod.example.org/vault/ontology/wiki

# Now fetch as Turtle (native)
curl -H "Accept: text/turtle" \
  https://pod.example.org/vault/ontology/wiki
# → 200 OK, text/turtle

# Or as JSON-LD (CSS auto-converts)
curl -H "Accept: application/ld+json" \
  https://pod.example.org/vault/ontology/wiki
# → 200 OK, application/ld+json
```

### What CSS does NOT do

- **Convert RDF to HTML.** No automatic ontology documentation rendering. For human-readable docs, host a separate HTML resource.
- **303 redirects from namespace URI to document.** CSS routes by exact URL. If your vocabulary IRI is `https://w3id.org/my-vocab#` but the file lives at `https://pod.example.org/ontology/myvocab`, clients dereferencing the w3id URI won't reach the Pod without a w3id.org redirect rule.
- **`owl:imports` resolution.** No automatic import following. Agents resolve imports against `/ontology/` container manually.

### Empirical conformance test (REQUIRED before committing)

CSS v8 alpha may or may not handle the extension-less PUT cleanly. The Solid docs don't explicitly promise it. Before committing the no-extension namespace pattern, run this test on the actual running Pod:

```bash
# 1. PUT extension-less Turtle
curl -X PUT \
  -H "Content-Type: text/turtle" \
  --data-binary "@prefix ex: <http://example.org/> . ex:Foo a ex:Bar ." \
  https://pod.example.org/vault/ontology/_test

# 2. GET back as Turtle
curl -H "Accept: text/turtle" \
  https://pod.example.org/vault/ontology/_test
# Expected: 200 OK, text/turtle, the triples back

# 3. GET back as JSON-LD (auto-conversion)
curl -H "Accept: application/ld+json" \
  https://pod.example.org/vault/ontology/_test
# Expected: 200 OK, application/ld+json, the same triples in JSON-LD

# 4. GET with hash fragment (client strips → same URL as #2)
curl -H "Accept: text/turtle" \
  "https://pod.example.org/vault/ontology/_test"
# Expected: same as #2 — fragment is client-side only

# 5. Clean up
curl -X DELETE https://pod.example.org/vault/ontology/_test
```

Results from this test go into `deltas.md` so future Claude doesn't repeat it. If the test fails, fall back: vocabulary file at `/vault/ontology/wiki.ttl` (with extension), namespace IRI is the truncated form `…/wiki#` and CSS users explicitly know they need to `.ttl`-suffix to actually fetch. This is a degraded D49 compliance — vocabulary isn't truly dereferenceable from the namespace IRI alone — but it's the workaround.

**Sources**:
- Van Herwegen & Verborgh 2024, [The Community Solid Server](https://joachimvh.github.io/community-server-article/)
- [CSS resource-store docs](https://communitysolidserver.github.io/CommunitySolidServer/7.x/architecture/features/protocol/resource-store/)
- [Solid Pod publishing guide](https://solidproject.solidcommunity.net/SPS/developers/vocabularies/publish/rdf.html)

---

## 6. W3C PROF — The Profiles Vocabulary

**Status**: W3C Working Group Note (18 Dec 2019), NOT a Recommendation. PROF §2 Conformance: only sections 7 (Conceptual Model), 8 (Vocabulary Specification), and 11 (Test Suite) are normative; everything else is informative.

**Namespace**: `prof: <http://www.w3.org/ns/dx/prof/>`

### Core classes (§8.3–§8.5)

- **`prof:Profile`** (§8.3) — subclass of `dct:Standard`. Verbatim: "A specification that constrains, extends, combines, or provides guidance or explanation about the usage of other specifications."
- **`prof:ResourceDescriptor`** (§8.4) — describes an aspect of a profile (a shape, a context, a spec doc, an example).
- **`prof:ResourceRole`** (§8.5) — subclass of `skos:Concept`. The role a resource plays in the profile.

### Core properties

| Property | Domain | Range | Meaning |
|---|---|---|---|
| `prof:hasResource` | `prof:Profile` | `prof:ResourceDescriptor` | Lists the artifacts in this profile |
| `prof:isProfileOf` | `prof:Profile` | `dct:Standard` | Direct parent specification |
| `prof:isTransitiveProfileOf` | `prof:Profile` | `dct:Standard` | Full ancestor chain — emit explicitly |
| `prof:hasToken` | `prof:Profile` | `xsd:token` | Short identifier for conneg (e.g., `"wiki-concept"`) |
| `prof:hasArtifact` | `prof:ResourceDescriptor` | (rdfs:Resource) | The downloadable file URL |
| `prof:hasRole` | `prof:ResourceDescriptor` | `skos:Concept` | One of the 8 standard roles or a minted custom |
| `prof:isInheritedFrom` | `prof:ResourceDescriptor` | `prof:Profile` | Lets a child re-expose an ancestor's descriptor |

### The transitivity axiom (§8.4.2) — flagged at-risk

PROF declares:

```turtle
dct:conformsTo owl:propertyChainAxiom ( prof:isProfileOf dct:conformsTo ) .
```

Verbatim: "if the thing conformed to is a profile of something else (indicated by `prof:isProfileOf`), then the conforming data resource will be inferred to be conformant to that other thing too."

**This axiom is marked "at risk" by PROF Issue 1078.** Don't depend on a reasoner applying it. Instead, **emit `prof:isTransitiveProfileOf` explicitly** for client convenience — pre-flatten the chain at write time.

### `dct:conformsTo` vs `prof:isProfileOf` vs `prof:isTransitiveProfileOf`

- `dct:conformsTo` — on **instance data**, declares conformance to a `dct:Standard` or `prof:Profile`.
- `prof:isProfileOf` — on a **`prof:Profile`**, points at the direct parent.
- `prof:isTransitiveProfileOf` — on a **`prof:Profile`**, exposes the full ancestor chain so clients don't traverse.

The pattern:

```
instance → dct:conformsTo → profile
profile  → prof:isProfileOf → base-spec
(reasoner infers) instance → dct:conformsTo → base-spec
```

### The role registry (§9) — 8 standard roles, extension permitted

Vocabulary: `role: <http://www.w3.org/ns/dx/prof/role/>`. **All 8 are flagged "at risk" by PROF Issue 1073** but extension is explicitly permitted.

| Role | Definition (verbatim) |
|---|---|
| `role:constraints` | "Descriptions of obligations, limitations or extensions that the profile defines" |
| `role:example` | "Sample instance data conforming to the profile" |
| `role:guidance` | "Documents, in human-readable form, how to use the profile" |
| `role:mapping` | "Describes conversions between two specifications" |
| `role:schema` | "Machine-readable structural descriptions of data defined by the profile" |
| `role:specification` | "Defining the profile in human-readable form" |
| `role:validation` | "Supplies instructions about how to verify conformance of data to the profile" |
| `role:vocabulary` | "Defines terms used in the profile specification" |

**Real-world custom role example**: GeoSPARQL 1.1 profile mints `role:repository` (pointing at GitHub) — not in §9. This is the de facto pattern when none of the 8 fit. This Pod's affordance descriptors (D52) don't cleanly fit any of the 8; minting `role:affordance` is reasonable.

### Worked example: GeoSPARQL 1.1 PROF profile

The complete profile at `https://github.com/opengeospatial/ogc-geosparql/blob/master/profile.ttl` uses the following roles:

- `role:vocabulary` ×4 (GML types, GeoSPARQL functions, spatial-aggregate functions, simple features)
- `role:specification` ×4 (JSON-LD context geo, JSON-LD context sf, requirements vocab, HTML+PDF spec)
- `role:schema` ×2 (geo.ttl ontology, geo.json)
- `role:validation` ×1 (SHACL validator)
- `role:example` ×1 (extended examples)
- `role:repository` ×1 (custom — GitHub)

**Sources**:
- [W3C PROF spec](https://www.w3.org/TR/dx-prof/)
- [PROF role registry](http://www.w3.org/ns/dx/prof/role/)
- [GeoSPARQL 1.1 profile.ttl](https://raw.githubusercontent.com/opengeospatial/ogc-geosparql/master/profile.ttl)

---

## 7. W3C Content Negotiation by Profile (Working Draft)

**Status**: W3C Working Draft (02 Oct 2023). Never advanced to Recommendation.

### The conceptual model (§6)

Two abstract operations:

- **List profiles** (§6.3.1): client asks "what profiles can this resource be returned in?" Server MUST NOT advertise profiles it cannot deliver.
- **Get resource by profile** (§6.3.2): client requests resource in a specific profile, by URI or by token.

**Profile vs serialization separation** (§5.1.1, verbatim): "the 'profile' parameter in the `Accept` and `Content-Type` headers should be seen to convey profiles that are specific to the Media Type, such as JSON-LD's 'expanded' or 'flattened'. In order to signal the use of Media Type-independent profiles, the http header fields `Accept-Profile` and `Link: <…>; rel='profile'` are to be used."

`Accept` selects bytes (Turtle vs JSON-LD). `Accept-Profile` selects meaning (SHACL-compact vs L3-default vs JSON-LD-flat).

### The four functional profiles (§7.1)

| Functional Profile | Mechanism |
|---|---|
| `http://www.w3.org/ns/dx/connegp/profile/http` | HTTP headers — `Accept-Profile` request, `Link: rel="profile"` response |
| `http://www.w3.org/ns/dx/connegp/profile/qsa` | Query string args: `_profile`, `_mediatype` |
| `http://www.w3.org/ns/dx/connegp/profile/qsa-alt` | Custom query keys; server advertises via Link headers |
| `http://www.w3.org/ns/dx/connegp/profile/rrd` | Resource Representation Description |

A server can implement one or several.

### HTTP headers profile (§7.2)

**Request** (`Accept-Profile`):

```
Accept-Profile: <urn:example:profile:x>;q=1.0, <urn:example:profile:y>;q=0.6
```

URIs MUST be in angle brackets. Multiple profiles allowed; q-values for preference.

**Response (§7.2.2, MUST):**

> "A server implementing content negotiation by profile MUST respond with an HTTP Response header containing a `Link` header with `rel="profile"` indicating the profile returned."

```http
HTTP/1.1 200 OK
Link: <https://example.org/wiki/profiles/concept>; rel="profile"
```

**Critical: do NOT use `Content-Profile`.** That header lives only in the expired IETF draft (Svensson/Verborgh 2017, expired 2019). The W3C WD explicitly chose `Link: rel="profile"` instead.

**List profiles** (§7.2.1, SHOULD): respond to `HEAD` or `GET` with multiple `Link` headers using `rel="canonical"` and `rel="alternate"`, each annotated with `type=` (media type) and `format=` (profile URI). The `format=` link parameter carries the **profile URI**, not the media type — this is the non-obvious detail most implementers miss.

### QSA profile (§7.3)

- `_profile=<token-or-uri>` — MUST be supported under QSA profile.
- `_mediatype=<media-type>` — SHOULD be supported.
- `_profile=alt` — SHOULD be supported. Reserved token for list-profiles. (Note: spec uses `alt`, not `alternates`.)

### No prescribed error responses

§6.3.2 says server SHOULD "attempt to reply with a profile that best matches"; example uses 303 See Other. **No MUST on 406, 415, or 300.** The expired IETF draft prescribed 406; the WD does not. Choose pragmatically.

**Sources**:
- [W3C Conneg-by-Profile WD](https://www.w3.org/TR/dx-prof-conneg/)

---

## 8. RFC 6906 — The `profile` Link Relation Type

**Status**: IETF Proposed Standard (March 2013). The only fully ratified piece of the profile stack.

§3 (verbatim):

> "A profile can be described as additional semantics that can be used to process a resource representation, such as constraints, conventions, extensions, or any other aspects that do not alter the basic media type semantics."

> "A profile MUST NOT change the semantics of the resource representation when processed without profile knowledge, so that clients both with and without knowledge of a profiled resource can safely use the same representation."

**Implication**: a `wiki:ConceptProfile` says "this is a wiki:Concept page with these properties," but the underlying Markdown body MUST still be valid Markdown that any client can read without knowing the profile. The profile adds *semantics*, not new bytes.

**Profile URIs**: "Profiles are identified by URI. However, as is the case with, for example, XML namespace URIs, the URI in this case only serves as an identifier." Best practice: "profile maintainers SHOULD consider to make the profile URI dereferenceable and provide useful documentation at that URI."

**Don't auto-dereference**: "Profile URIs are primarily intended to be used as identifiers, and thus clients SHOULD NOT indiscriminately access profile URIs." Important for an agent: seeing a `Link: rel="profile"` header doesn't license fetching that URI on every request.

**Sources**:
- [RFC 6906](https://datatracker.ietf.org/doc/html/rfc6906)

---

## 9. VoID and PROF — complementary, not redundant

[VoID](https://www.w3.org/TR/void/) (W3C WG Note) defines `void:vocabulary` (§4.3):

> "The void:vocabulary property can be used to list vocabularies used in a dataset."

VoID is silent on profiles. The relationship:

- `void:vocabulary` declares which RDF vocabularies the *dataset uses* (discoverability hint).
- `prof:isProfileOf` declares which specifications a *profile constrains or extends* (conformance statement).

Different levels. A Pod can legitimately publish both:

```turtle
# On storage description
<> void:vocabulary <https://pod.example.org/vault/ontology/wiki#> ,
                   <http://www.w3.org/2004/02/skos/core#> ,
                   <http://purl.org/dc/terms/> .

# On a profile
<wiki:WikiMemoryL3Profile> prof:isProfileOf <https://solidproject.org/TR/protocol> .
```

Complementary surfaces.

---

## 10. CAUTION — what's settled and what isn't

This is the box you read before citing anything as "the spec says."

| Document | Status | What you can claim |
|---|---|---|
| RFC 6906 (`Link: rel="profile"`) | IETF Proposed Standard | Use as ratified |
| Solid Protocol v0.11.0 | Solid Project Recommendation | Solid-internal authoritative |
| W3C PROF | WG Note (not Rec) | "Best-aligned standards work" — not "the spec mandates" |
| W3C Conneg-by-Profile | Working Draft | Same caveat |
| W3C VoID | WG Note | Same caveat |
| `draft-svensson-accept-profile-00` | **Expired Sept 2019** | **Do not implement.** `Content-Profile` lives nowhere live. |
| PROF `dct:conformsTo` chain axiom | At-risk (Issue 1078) | Emit `prof:isTransitiveProfileOf` explicitly |
| PROF role registry | At-risk (Issue 1073), extensible | Mint custom roles when needed (GeoSPARQL precedent) |
| Solid URI normalization (issue #22) | Unresolved | Normalize before compare |

---

## 11. Resource kind declaration — the pattern

The combined pattern from PROF + conneg-by-profile + RFC 6906:

### Class IRI vs Profile IRI

```turtle
# The OWL class (what kind of thing)
wiki:Concept a owl:Class ;
  rdfs:label "Wiki concept page" .

# The PROF profile (what shape/constraints/artifacts apply)
wiki:ConceptProfile a prof:Profile ;
  rdfs:label "Wiki-Memory L3 Concept profile" ;
  prof:hasToken "wiki-concept" ;
  prof:isProfileOf wiki:PageProfile ;
  prof:hasResource [ … ] .

# Instance data declares BOTH
</vault/wiki/pages/context-graphs>
  a wiki:Concept ;                       # what KIND
  dct:conformsTo wiki:ConceptProfile .   # what CONSTRAINTS
```

### SHACL shapes as artifacts (not profiles)

```turtle
wiki:ConceptProfile prof:hasResource [
  a prof:ResourceDescriptor ;
  prof:hasRole role:validation ;
  dct:conformsTo <https://www.w3.org/TR/shacl/> ;  # what spec the artifact follows
  dct:format "text/turtle" ;
  prof:hasArtifact </vault/meta/shapes/concept.shacl.ttl>
] .
```

The shape is the *artifact*; the profile is the *envelope*.

### Server response

```http
HTTP/1.1 200 OK
Content-Type: text/markdown
Link: </vault/profiles/concept>; rel="profile"
Link: <https://pod.example.org/vault/wiki/pages/context-graphs>;
       rel="canonical"; type="text/markdown";
       format="https://pod.example.org/vault/profiles/concept"
```

Agent reading just RFC 6906: gets the `Link: rel="profile"` and knows what kind of resource this is.
Agent reading conneg-by-profile: can request alternates via `_profile=alt` or `Accept-Profile`.

---

## 12. Persistence

The mechanisms available:

| Mechanism | When |
|---|---|
| `410 Gone` | Solid Protocol §3.2 — only spec mechanism for URI persistence |
| HTTP 301/308 | Standard answer when a Pod actually moves hosts |
| w3id.org | For cross-Pod vocabularies that need institutional permanence |
| PROF `prof:hasToken` | Stable short identifier independent of profile URI changes |

**For this Pod**: HTTPS by default (Solid spec mandates), don't bake port into IRIs, use w3id.org for vocabularies meant to outlive this Pod, accept that app-local vocabularies will move with the app.

---

## 13. Decision tree

```
Need to mint an IRI?

├── Is this a class/predicate for THIS app?
│   ├── Will it be referenced by other Pods?
│   │   YES → mint at w3id.org/cogitarelink/<vocab>#<Term>
│   │   NO  → mint at https://pod.vardeman.me/vault/ontology/<vocab>#<Term>
│   │
│   └── For Pod-local: vocab file at /vault/ontology/<vocab> (no extension)
│
├── Is this a profile (resource-kind hint)?
│   → SEPARATE IRI from the class
│   → Convention: <ClassName>Profile
│   → Profile descriptor at /vault/meta/profiles/<class-name>.ttl
│   → Emit prof:isTransitiveProfileOf explicitly (don't rely on reasoner)
│
├── Is this a SHACL shape?
│   → sh:targetClass uses the class IRI from above
│   → Shape file in /vault/meta/shapes/<name>.shacl.ttl
│   → Referenced FROM a prof:Profile via prof:hasResource + role:validation
│
├── Is this an entity instance (a page, person, event)?
│   → Pod-local slash path with mnemonic slug
│   → /vault/wiki/pages/<slug>
│   → Use D76's slug algorithm; @ prefixes stripped (S3a)
│
├── Is this an affordance descriptor (D52)?
│   → prof:ResourceDescriptor with role:affordance (custom role, mint it)
│   → /vault/meta/affordances/<name>.ttl
│
└── Always:
    ✓ HTTPS
    ✓ No port
    ✓ No file extension in vocab IRIs
    ✓ Mnemonic class names (not opaque IDs for classes)
    ✓ Trailing slash discipline (container vs resource)
    ✓ Hash namespace for vocabularies
```

---

## 14. Key sources

| Source | Type | Where |
|---|---|---|
| TBL, Linked Data design issue | W3C design note | https://www.w3.org/DesignIssues/LinkedData.html |
| Sauermann & Cyganiak, Cool URIs | W3C IG Note | https://www.w3.org/TR/cooluris/ |
| Solid Protocol v0.11.0 | Solid Rec | https://solidproject.org/TR/protocol |
| WebID 1.0 hash rationale | W3C XG | https://www.w3.org/2005/Incubator/webid/wiki/WebID_Definition/hash2 |
| Solid vocab publishing guide | Solid dev doc | https://solidproject.solidcommunity.net/SPS/developers/vocabularies/publish/rdf.html |
| Solid Vocabularies index | Reference | https://solid.github.io/vocab/ |
| Type Index spec | Solid spec | https://solid.github.io/type-indexes/ |
| RFC 6906 | IETF Proposed Standard | https://datatracker.ietf.org/doc/html/rfc6906 |
| W3C PROF | WG Note | https://www.w3.org/TR/dx-prof/ |
| W3C Conneg-by-Profile | Working Draft | https://www.w3.org/TR/dx-prof-conneg/ |
| W3C VoID | WG Note | https://www.w3.org/TR/void/ |
| GeoSPARQL 1.1 PROF profile | Real-world example | https://github.com/opengeospatial/ogc-geosparql/blob/master/profile.ttl |
| OGC SELFIE ER | OGC 20-067 | https://docs.ogc.org/per/20-067.html |
| Cool URIs for FAIR KGs | arXiv 2024 | https://arxiv.org/abs/2407.09237 |
| W3C HashVsSlash wiki | Reference | https://www.w3.org/wiki/HashVsSlash |
| TBL HTTPFilenameMapping | W3C design note | https://www.w3.org/DesignIssues/HTTPFilenameMapping.html |
| TBL IcingOnTheCake | W3C design note | https://www.w3.org/DesignIssues/IcingOnTheCake.html |
| van Herwegen & Verborgh 2024 | CSS paper | https://joachimvh.github.io/community-server-article/ |
| Solid spec issue #22 | URI normalization | https://github.com/solid/specification/issues/22 |
| PROF Issue 1078 | At-risk axiom | (linked from PROF spec) |
| PROF Issue 1073 | At-risk role registry | (linked from PROF spec) |
| Vault: Ontology Serving Patterns | Internal | `~/Obsidian/obsidian/03 - Resources/LD-SemanticWeb/Ontology Serving Patterns - From W3C to Solid Pods.md` |
| Vault: URI Dereferenceability | Internal | `~/Obsidian/obsidian/03 - Resources/LD-SemanticWeb/URI Dereferenceability and Persistence.md` |
