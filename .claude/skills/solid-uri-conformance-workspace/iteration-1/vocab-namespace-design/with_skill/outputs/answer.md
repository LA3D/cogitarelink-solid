# Citation vocabulary — concrete plan

## TL;DR

- **Namespace IRI**: `https://pods.acme.org/alice/ontology/citation#`
- **File location**: `https://pods.acme.org/alice/ontology/citation` (no `.ttl` extension)
- **Content-Type on PUT**: `text/turtle` — CSS will content-negotiate on GET
- **Do NOT use w3id.org** for this. It's an app-local vocabulary for Alice's citation app — the Pod is the namespace authority. w3id is for vocabularies shared across many Pods.

That's it. Skip the rest of this doc if you trust the recommendation; everything below is justification + paste-ready Turtle.

## Why this shape

Five rules apply here:

1. **HTTPS, no port, hash-namespace, no file extension.** `https://pods.acme.org/alice/ontology/citation#Citation`, not `https://pods.acme.org/alice/ontology/citation.ttl#Citation`. A `.ttl` extension encodes serialization-format state into the class identifier — the class `Citation` is not "the Turtle thing"; it's the class. Hash namespace means one HTTP fetch dereferences the whole vocabulary; the client strips `#Citation` before the request.

2. **The vocabulary file's URL path *is* the namespace prefix.** For namespace `…/ontology/citation#`, the file MUST live at `/ontology/citation` (extension-less). No virtual mapping, no rewrites. CSS handles content negotiation automatically — empirically verified on CSS v8 alpha (2026-05-16): PUT Turtle, GET with `Accept: application/ld+json` or `application/n-triples` returns the same triples in the requested serialization.

3. **Pod-host the vocabulary, not w3id.org.** w3id.org's value is durable redirects that survive organizational changes for vocabularies *shared across many Pods*. Your citation vocabulary lives in your app — it's an app-local namespace. Minting a w3id redirect for it adds an external single point of failure (and a bureaucratic step) for zero benefit. If, three years from now, a second institution wants to reuse the vocabulary verbatim, *then* promote it: register `w3id.org/acme/citation` redirecting to whichever Pod hosts the canonical file. That's the Solid-aligned migration path.

4. **Mnemonic class names.** `cite:Citation`, `cite:Author`, `cite:Venue`, `cite:Journal` — short, memorable, less error-prone than opaque IDs. Opaque slugs (`cite:C7f4a3`) only buy you anything when entity rename is a real risk; for class identifiers it's pure cost.

5. **Trailing slash discipline.** `/ontology/citation` is the document; if you ever add a container of versioned vocabulary files, it would be `/ontology/citation/`. Pick one stem per use.

## Before you mint anything — reuse what exists

Citation management is a well-traveled domain. **Don't invent classes for things that already have W3C-grade vocabularies.** Concrete reuse for your four classes + two predicates:

| Your candidate | Reuse instead | Why |
|---|---|---|
| `cite:Citation` | Mint as your own. There's no clean standard for "a citation record as an entity." | OK to mint. |
| `cite:Author` | `foaf:Person` (or `schema:Person`) as the *type*; use `dct:creator` / `dct:contributor` as the *predicate* linking citation → person. | "Author" is a role, not a class. A person is a person. |
| `cite:Venue` | `schema:PublicationEvent` or `bibo:Conference` (Bibliographic Ontology) | These are stable. |
| `cite:Journal` | `bibo:Journal` or `schema:Periodical` | Same. |
| `cite:cites` | **`cito:cites`** from CiTO (Citation Typing Ontology). Reuse this. CiTO has 40+ subproperties (`cito:extends`, `cito:disagreesWith`, `cito:usesMethodIn`) — they're the bibliographic community standard. | This is the single best decision you can make. |
| `cite:affiliatedWith` | `org:memberOf` (W3C Org ontology) or `schema:affiliation` | Pre-existing. |

**What you actually need to mint**: probably just `cite:Citation` (your app's record-of-a-citation entity) and maybe a few app-specific predicates that don't have CiTO equivalents. Everything else is reuse.

This is exactly the hybrid stance the Pod-as-substrate work commits to (D79): standard vocabularies for everything that has one; mint locally only for genuine gaps.

## Paste-ready Turtle for the vocabulary file

```turtle
# PUT https://pods.acme.org/alice/ontology/citation
# Content-Type: text/turtle

@prefix cite: <https://pods.acme.org/alice/ontology/citation#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix bibo: <http://purl.org/ontology/bibo/> .
@prefix cito: <http://purl.org/spar/cito/> .
@prefix org:  <http://www.w3.org/ns/org#> .

<https://pods.acme.org/alice/ontology/citation>
  a owl:Ontology ;
  dct:title "Acme Citation Vocabulary" ;
  dct:description
    "Application vocabulary for Alice's citation management app. Reuses FOAF, BIBO, CiTO, DCT, Org where possible; mints only the citation-record class and a small set of app-specific predicates." ;
  rdfs:label "citation" ;
  dct:creator <https://pods.acme.org/alice/profile/card#me> ;
  owl:versionIRI <https://pods.acme.org/alice/ontology/citation/v1> ;
  owl:imports
    <http://purl.org/dc/terms/> ,
    <http://xmlns.com/foaf/0.1/> ,
    <http://purl.org/ontology/bibo/> ,
    <http://purl.org/spar/cito/> .

# -- Classes ----------------------------------------------------------------

cite:Citation a owl:Class ;
  rdfs:label "Citation" ;
  rdfs:comment
    "A citation record in Alice's library: the act/instance of citing a referenced work, distinct from the work itself and from the bibliographic resource. Use bibo:Document subclasses for the cited works." .

# Author, Venue, Journal are NOT minted — reuse:
#   Author  → foaf:Person   (linked via dct:creator / dct:contributor)
#   Venue   → bibo:Conference / schema:PublicationEvent
#   Journal → bibo:Journal

# -- Predicates -------------------------------------------------------------

# cites → reuse cito:cites directly. Do not mint cite:cites.

cite:affiliatedWith a owl:ObjectProperty ;
  rdfs:label "affiliated with" ;
  rdfs:comment
    "Convenience predicate linking a foaf:Person to an org:Organization in this app. Equivalent to org:memberOf; ships as an alias for ergonomic frontmatter." ;
  rdfs:domain foaf:Person ;
  rdfs:range  org:Organization ;
  owl:equivalentProperty org:memberOf .

cite:hasCitedWork a owl:ObjectProperty ;
  rdfs:label "has cited work" ;
  rdfs:comment
    "Links a cite:Citation to the bibo:Document it references. Separates the citation record from the cited document so multiple citations of the same work are first-class." ;
  rdfs:domain cite:Citation ;
  rdfs:range  bibo:Document .

cite:inLibrary a owl:ObjectProperty ;
  rdfs:label "in library" ;
  rdfs:comment "Links a cite:Citation to the user's library container." ;
  rdfs:domain cite:Citation .
```

## Storage description entry

After PUTting the vocabulary file, declare it in the Pod's storage description so agents can discover it (D49):

```turtle
# PATCH /alice/.meta  (or wherever your storage description lives)
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix void:  <http://rdfs.org/ns/void#> .

<> a solid:InsertDeletePatch ;
  solid:inserts {
    <../>
      void:vocabulary
        <../ontology/citation#> ,                       # app-local, Pod-hosted
        <http://purl.org/dc/terms/> ,                   # external standard
        <http://xmlns.com/foaf/0.1/> ,                  # external standard
        <http://purl.org/ontology/bibo/> ,              # external standard
        <http://purl.org/spar/cito/> ,                  # external standard
        <http://www.w3.org/ns/org#> .                   # external standard
  } .
```

Every IRI in `void:vocabulary` must dereference. The external ones are hosted by W3C / SPAR / FOAF; yours is hosted by the Pod itself at `/alice/ontology/citation`.

## Verification — run this after PUT

```bash
POD="https://pods.acme.org"

# After PUTting the vocabulary file:
curl -H "Accept: text/turtle"          "$POD/alice/ontology/citation" | head -20
curl -H "Accept: application/ld+json"  "$POD/alice/ontology/citation" | head -20

# Fragment dereferencing — an agent that encounters cite:Citation in some .meta
# strips the fragment and fetches the document:
curl -H "Accept: text/turtle" "$POD/alice/ontology/citation" \
  | grep -A 3 "cite:Citation"
```

All three GETs return 200 with the requested Content-Type. CSS does the format conversion from the stored Turtle.

## When to escalate to w3id.org

Promote the vocabulary to `https://w3id.org/acme/citation#` only when:

- A second organization commits to using the vocabulary in their own Pod, AND
- The vocabulary's class/predicate set has stabilized (no rename churn in 6+ months), AND
- You've coordinated a redirect target (e.g., a GitHub-hosted `.ttl` mirror).

Until then, the Pod-hosted form is the right shape. It's HTTPS-stable, dereferenceable, and aligned with Solid's decentralized authority model — the Pod *is* the namespace authority for its own application.
