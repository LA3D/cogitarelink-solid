# URI Conformance — Standards Reference

Operational reference for URI structure decisions. Primary sources cited inline; this document is self-contained (no project-internal references required to use it).

---

## 1. The Linked Data foundation

Berners-Lee's four principles ([Linked Data design issue](https://www.w3.org/DesignIssues/LinkedData.html), 2006):

1. Use URIs as names for things.
2. Use HTTP URIs so people can look them up.
3. When someone looks up a URI, provide useful information using RDF standards.
4. Include links to other URIs so they can discover more things.

Most ontology failures live in the gap between (2) and (3): an HTTP URI that returns nothing useful when dereferenced. **httpRange-14** (W3C TAG resolution, 2007) settled the core ambiguity — a URI for a non-information resource (a person, a concept) should return HTTP 303 redirecting to a document URI. A URI returning 200 directly is an information resource.

**Hash URIs sidestep httpRange-14** because the fragment is client-side; the server never sees it and returns the full vocabulary document on every dereference. Slash URIs require 303 redirects, which most Pod servers cannot easily issue.

Authoritative for the rest of this document: [Sauermann & Cyganiak, *Cool URIs for the Semantic Web* (W3C IG Note, 2008)](https://www.w3.org/TR/cooluris/).

---

## 2. Hash URIs vs slash URIs

### Hash (`http://example.org/vocab#Person`)

```
Client:  GET http://example.org/vocab     (fragment stripped client-side)
         Accept: text/turtle
Server:  200 OK, [entire vocabulary]
Client:  extracts triples about #Person
```

- One HTTP request, multiple resources in one document.
- No server-side 303 logic needed.
- Best for ontologies and small-to-medium stable vocabularies.

### Slash (`http://example.org/id/alice`)

```
Client:  GET http://example.org/id/alice
Server:  303 See Other → http://example.org/doc/alice
Client:  GET http://example.org/doc/alice → RDF about Alice
```

- Per-resource server-side control.
- Requires 303 redirect configuration.
- Best for large, evolving entity collections.

### What Solid does in practice

**Every official Solid vocabulary uses hash URIs** ([Solid vocabularies index](https://solid.github.io/vocab/)):

- `http://www.w3.org/ns/solid/terms#`
- `http://www.w3.org/ns/solid/oidc#`
- `http://www.w3.org/ns/auth/acl#`
- `http://www.w3.org/ns/ldp#`
- `http://www.w3.org/ns/pim/space#`

The [WebID 1.0 hash-URI rationale](https://www.w3.org/2005/Incubator/webid/wiki/WebID_Definition/hash2) gives the operational case verbatim:

> "Implementers are highly encouraged to use hash URIs for the WebID HTTP URI. Even though 303 redirects can be used instead, experience has shown that they can be difficult to deploy and can have an impact on performance."

This rationale is scoped to WebIDs but generalizes: Pods don't readily issue 303 redirects, and CSS in particular has no built-in 303 mechanism. **For a Solid-hosted vocabulary: hash, always.** No spec MUST, but every signal from the ecosystem points the same way.

---

## 3. Cool URI naming rules

### Don't bake deployment details into the IRI

- **No port number.** Port is a deployment detail; baking it in means migrating to a different port breaks every triple that uses that predicate.
- **No `http://` for vocabularies meant to outlive their first deployment.** [Solid Protocol §3](https://solidproject.org/TR/protocol) mandates HTTPS: "HTTPS is required; HTTP → HTTPS redirect if both schemes are exposed." Vocabulary IRIs are `https://` from day one.
- **No version in the base URI.** `…/ontology/wiki#`, not `…/ontology/v1/wiki#`. Versions belong in `owl:versionIRI` or `dct:hasVersion`, not in the namespace prefix.
- **No file extension in vocabulary IRI.** The [Solid vocab publishing guide](https://solidproject.solidcommunity.net/SPS/developers/vocabularies/publish/rdf.html) is explicit: "the resource identified by the IRI is not necessarily a single document." Vocab URI is `…/ontology/wiki`, served via content negotiation.

### Naming the resources

- **Mnemonic class names** — the Solid vocab guide: "short, memorable IRI are less error-prone." `wiki:Concept`, `wiki:Source`. Reserve opaque accession IDs (Wikidata Q-numbers, OBO `GO:0003700`) for entity collections where rename risk is high.
- **Strip BibTeX `@` prefixes** in URIs — JSON-LD treats `@`-prefixed terms as reserved keywords; some processors will reject `@`-prefixed values silently. Convert `@author2024` → `author2024` on the way into the URI.

### Trailing slash is load-bearing

[Solid Protocol §3.1](https://solidproject.org/TR/protocol#trailing-slash) (MUST):

> "Paths ending with a slash denote a container resource."
> "If two URIs differ only in the trailing slash … then the other URI MUST NOT correspond to another resource."

A vocabulary at `/ontology/wiki` (no trailing slash) and a container at `/ontology/wiki/` cannot both exist. Pick one.

### URI normalization

[Solid spec issue #22](https://github.com/solid/specification/issues/22) flags URI normalization as **unresolved**. The Pod does not normalize for you. Always normalize before comparing:

- `http://` vs `https://` are distinct IRIs.
- Trailing slash vs no trailing slash are distinct.
- Fragment vs no fragment are distinct.
- Case sensitivity: hostname is case-insensitive (per [RFC 3986 §3.2.2](https://www.rfc-editor.org/rfc/rfc3986#section-3.2.2)), path is case-sensitive.

Write a tiny `normalizeIRI()` in any tool that compares IRIs. Don't rely on the Pod.

---

## 4. The Pod-as-namespace-authority pattern

**The architectural premise of Solid** is that an application's data, vocabulary, shapes, and affordances all live in the same Pod. The Pod IS the namespace authority for the application that lives on it.

**Is this in the spec?** No. **Is it forbidden?** Also no.

- Solid Protocol: silent on vocabulary hosting.
- [Solid Type Index spec](https://solid.github.io/type-indexes/): silent on whether class URIs may resolve in the same Pod.
- [Solid vocab publishing guide](https://solidproject.solidcommunity.net/SPS/developers/vocabularies/publish/rdf.html): recommends w3id.org for stable vocabularies — but this is for *general* vocabularies meant to be shared, not per-Pod app vocabularies.

The closest architectural endorsement is TBL's [IcingOnTheCake](https://www.w3.org/DesignIssues/IcingOnTheCake.html): services around a live resource are available at URIs made by adding small strings to the same URI. Per-app vocabulary as "icing" adjacent to the application URL fits this pattern.

### Trade-off

If the Pod URL changes (host migration, domain change), vocabulary IRIs change too. Mitigated by HTTP 301/308 redirects from the old host; the bog-standard answer for "I moved my Pod." For institutional permanence guarantees, use w3id.org.

### When to mint where

- **App-local vocabulary** (will only ever be used inside this Pod's application) → Pod-hosted.
- **Cross-Pod shared profile** (will be referenced by other Pods, e.g. `fabric:CoreProfile`, federation contracts) → [w3id.org](https://github.com/perma-id/w3id.org).

The "per-Pod app vocabulary on the Pod itself" choice is the natural fit for Solid's decentralized architecture. Deploying a thousand Pods would require a thousand w3id redirects under the alternative reading — which defeats the point.

---

## 5. CSS vocabulary serving mechanics

The [Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer) handles RDF as a first-class data format with internal content-negotiation pathfinding. This is what makes the extension-less pattern work.

### The conneg architecture

From Van Herwegen & Verborgh 2024, [*The Community Solid Server: Supporting research & development in an evolving ecosystem*](https://joachimvh.github.io/community-server-article/):

> CSS uses a pathfinding algorithm that chains internal converters to transform between RDF serializations. It does not need a dedicated converter from Turtle to JSON-LD. Instead, there are converters: Turtle → internal Quad objects, and Quad objects → JSON-LD. The pathfinding algorithm finds and chains these automatically.

Store Turtle (or any RDF format), serve any other RDF format on demand. No `.htaccess`, no multiple physical files.

### Storing a vocabulary on a Pod

```bash
# Upload Turtle to a no-extension path
curl -X PUT \
  -H "Content-Type: text/turtle" \
  -d @wiki.ttl \
  https://pod.example.org/ontology/wiki

# Now fetch as Turtle (native)
curl -H "Accept: text/turtle" \
  https://pod.example.org/ontology/wiki
# → 200 OK, text/turtle

# Or as JSON-LD (CSS auto-converts)
curl -H "Accept: application/ld+json" \
  https://pod.example.org/ontology/wiki
# → 200 OK, application/ld+json
```

### What CSS does NOT do

- **Convert RDF to HTML.** No automatic ontology documentation rendering. For human-readable docs, host a separate HTML resource.
- **303 redirects from namespace URI to document.** CSS routes by exact URL. If the vocabulary IRI is `https://w3id.org/my-vocab#` but the file lives at `https://pod.example.org/ontology/myvocab`, clients dereferencing the w3id URI won't reach the Pod without a w3id.org redirect rule.
- **`owl:imports` resolution.** No automatic import following.

### Empirical conformance test

CSS v8.0.0-alpha.3 was tested directly (2026-05-16): PUT extension-less Turtle, GET back as Turtle / JSON-LD / N-Triples all returned 200 with correct auto-converted serializations. Run the same test on your CSS version before committing to the pattern:

```bash
# 1. PUT extension-less Turtle
curl -X PUT -H "Content-Type: text/turtle" \
  --data-binary '@prefix ex: <http://example.org/> . ex:Foo a ex:Bar .' \
  https://pod.example.org/_uri_test

# 2. GET back as Turtle
curl -H "Accept: text/turtle" https://pod.example.org/_uri_test
# → 200, Turtle returned

# 3. GET back as JSON-LD (auto-conneg)
curl -H "Accept: application/ld+json" https://pod.example.org/_uri_test
# → 200, JSON-LD

# 4. Clean up
curl -X DELETE https://pod.example.org/_uri_test
```

If your CSS version fails this test, fall back: vocabulary file at `/ontology/wiki.ttl` (with extension), namespace IRI is the truncated form `…/wiki#`, and document the partial dereferenceability limitation.

---

## 6. Persistence

The mechanisms available, ordered by reliability:

| Mechanism | Spec | When |
|---|---|---|
| HTTPS, port-less, mnemonic IRIs | [Cool URIs](https://www.w3.org/TR/cooluris/) | Day one — prevents the most common rot |
| HTTP 410 Gone | [Solid Protocol §3.2](https://solidproject.org/TR/protocol#resource-persistence) | Resource intentionally retired, not moved |
| HTTP 301/308 redirects | RFC 9110 | Pod actually moves hosts |
| w3id.org indirection | [perma-id/w3id.org](https://github.com/perma-id/w3id.org) | Cross-Pod shared vocabularies; institutional permanence |

Solid Protocol mentions only 410 normatively. 301/308 are standard HTTP and require no Solid-specific support.

---

## 7. Sources

| Source | Type | URL |
|---|---|---|
| Berners-Lee, Linked Data design issue | W3C design note | https://www.w3.org/DesignIssues/LinkedData.html |
| Sauermann & Cyganiak, Cool URIs | W3C IG Note (2008) | https://www.w3.org/TR/cooluris/ |
| Berners-Lee, IcingOnTheCake | W3C design note | https://www.w3.org/DesignIssues/IcingOnTheCake.html |
| Solid Protocol v0.11.0 | Solid Recommendation | https://solidproject.org/TR/protocol |
| WebID 1.0 hash rationale | W3C Incubator | https://www.w3.org/2005/Incubator/webid/wiki/WebID_Definition/hash2 |
| Solid vocab publishing guide | Solid developer doc | https://solidproject.solidcommunity.net/SPS/developers/vocabularies/publish/rdf.html |
| Solid Type Index spec | Solid spec | https://solid.github.io/type-indexes/ |
| Solid Vocabularies index | Reference | https://solid.github.io/vocab/ |
| Solid spec issue #22 (URI normalization) | Open issue | https://github.com/solid/specification/issues/22 |
| van Herwegen & Verborgh 2024 | CSS architecture paper | https://joachimvh.github.io/community-server-article/ |
| W3C HashVsSlash wiki | Reference | https://www.w3.org/wiki/HashVsSlash |
| W3C Permanent ID CG (w3id.org) | Identifier registry | https://github.com/perma-id/w3id.org |
| Thalhammer et al. 2024, Cool URIs for FAIR KGs | arXiv | https://arxiv.org/abs/2407.09237 |
