# Vocabulary Namespace and Hosting Plan for Your Citation App

Short version: **do not** put your vocabulary under your personal Pod URL, and **do** use `w3id.org` (or an equivalent permanent-identifier service) as the namespace IRI. Host the actual Turtle file wherever you like — GitHub Pages is fine — and let `w3id.org` redirect to it. Your Pod is for *instance data*; your vocabulary is *terminology* and should outlive any individual Pod, account, or hosting choice.

Here is the concrete plan.

---

## 1. Pick the namespace IRI

Use a `w3id.org` path under a community you control (you'll need to open a PR against `https://github.com/perma-id/w3id.org` to register a new path, which is a one-time, ~1 day turnaround).

```
https://w3id.org/acme/cite#
```

Notes on why:

- **Hash namespace (`#`)** rather than slash. For a small, tightly-coupled vocabulary (a few dozen terms) the hash form is the standard choice — one HTTP request fetches every term definition, and fragment dereferencing is trivial for clients.
- **`w3id.org`** is a community-run permanent identifier service operated by the W3C Permanent Identifier Community Group. It does nothing but issue 303/302 redirects. If you move hosting (GitHub Pages → Netlify → your own server), you update one line in the `w3id.org` config and every consumer keeps working. This is exactly the "cool URI" property Berners-Lee asks for, and it is the de facto standard for new vocabularies in the Linked Data community (e.g. `w3id.org/dpv`, `w3id.org/arco`, `w3id.org/oa`).
- **Do not** use `https://pods.acme.org/alice/vocab#`. Pod URLs are bound to an identity, an account lifecycle, and a server deployment. They are the right place for *Alice's citation records*, not for the schema those records conform to. If Alice leaves, gets a new Pod, or your server changes domains, every reference to your classes breaks.
- **Do not** mint a fresh `acme.org`-only URI either, unless you genuinely own `acme.org` and are committed to serving content negotiation there forever. `w3id.org` removes that burden.

Use a short, memorable prefix in your Turtle: `cite:` for `https://w3id.org/acme/cite#`.

---

## 2. Decide where the file actually lives

Pick any static-hosting target. GitHub Pages is the path of least resistance:

```
Repo:   github.com/acme-org/cite-vocab
File:   docs/cite.ttl  (and docs/cite.html for humans, optional)
Served: https://acme-org.github.io/cite-vocab/cite.ttl
```

Then your `w3id.org` PR adds a `.htaccess` snippet roughly like:

```apache
RewriteRule ^acme/cite$    https://acme-org.github.io/cite-vocab/cite.ttl  [R=302,L]
RewriteRule ^acme/cite/$   https://acme-org.github.io/cite-vocab/cite.ttl  [R=302,L]
RewriteRule ^acme/cite\#.* https://acme-org.github.io/cite-vocab/cite.ttl  [R=302,L]
```

(In practice the community group has a couple of template patterns — copy one and adapt.)

Once that ships, `curl -L -H "Accept: text/turtle" https://w3id.org/acme/cite` returns your vocabulary. That URL is now the single thing every Pod, every SHACL shape, every JSON-LD context in your ecosystem references.

If you want content negotiation later (Turtle for machines, HTML for humans), serve both and let the redirect target be content-negotiated. Not required for v1.

---

## 3. Reuse before you mint

Before you write `cite:Author` and `cite:Journal`, check the existing universe — these classes almost certainly already exist and your app gets free interop if you reuse them:

| You want    | Use this instead (probably)                          |
|-------------|------------------------------------------------------|
| Citation    | `cito:Citation` (CiTO, https://sparontologies.github.io/cito/current/cito.html) |
| Author      | `foaf:Person` or `schema:Person`                     |
| Venue       | `bibo:Conference` / `schema:Event` / `fabio:Conference` |
| Journal     | `bibo:Journal` or `fabio:Journal`                    |
| `cites`     | `cito:cites` (or one of its 40+ subproperties — `cito:extends`, `cito:refutes`, etc.) |
| `affiliatedWith` | `schema:affiliation` or `org:memberOf`          |

Honestly, for a citation manager, **CiTO + FaBiO + FOAF gets you 90% of the model for free**, with the bonus that other Solid apps, Zotero, OpenCitations, Wikidata, and CrossRef already speak that vocabulary. Mint your own terms only for app-specific concepts that don't have a good existing match (e.g. a status enum, a custom workflow predicate, a UI-specific category).

So a realistic `cite:` vocabulary is small — maybe a half-dozen genuinely-novel terms, plus a JSON-LD context that aliases the W3C/SPAR terms under your shorter prefix.

---

## 4. Example Turtle (`cite.ttl`)

This is what you upload. It assumes you reuse SPAR where possible and only mint a handful of `cite:`-namespaced terms.

```turtle
@prefix cite:    <https://w3id.org/acme/cite#> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:     <http://purl.org/dc/terms/> .
@prefix vann:    <http://purl.org/vocab/vann/> .
@prefix voaf:    <http://purl.org/vocommons/voaf#> .
@prefix foaf:    <http://xmlns.com/foaf/0.1/> .
@prefix schema:  <http://schema.org/> .
@prefix cito:    <http://purl.org/spar/cito/> .
@prefix fabio:   <http://purl.org/spar/fabio/> .
@prefix bibo:    <http://purl.org/ontology/bibo/> .
@prefix skos:    <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

#################################################################
# Ontology metadata
#################################################################

<https://w3id.org/acme/cite> a owl:Ontology, voaf:Vocabulary ;
    dct:title           "Acme Citation Vocabulary"@en ;
    dct:description     "Lightweight vocabulary for the Acme citation manager. Reuses SPAR (CiTO, FaBiO, BiBO), FOAF, and schema.org wherever possible; mints terms only for app-specific concepts."@en ;
    dct:creator         <https://pods.acme.org/alice/profile/card#me> ;
    dct:issued          "2026-05-16"^^xsd:date ;
    dct:license         <https://creativecommons.org/licenses/by/4.0/> ;
    owl:versionIRI      <https://w3id.org/acme/cite/0.1.0> ;
    owl:versionInfo     "0.1.0" ;
    vann:preferredNamespacePrefix  "cite" ;
    vann:preferredNamespaceUri     "https://w3id.org/acme/cite#" ;
    rdfs:seeAlso        <http://purl.org/spar/cito>,
                        <http://purl.org/spar/fabio>,
                        <http://purl.org/ontology/bibo/> .

#################################################################
# Classes (mostly aliases to SPAR/FOAF/schema — keeps your data
# interoperable with the rest of the bibliographic web)
#################################################################

cite:Citation a owl:Class ;
    rdfs:label       "Citation"@en ;
    rdfs:comment     "A citation event: one work referring to another. Equivalent to cito:Citation."@en ;
    rdfs:subClassOf  cito:Citation ;
    rdfs:isDefinedBy <https://w3id.org/acme/cite> .

cite:Author a owl:Class ;
    rdfs:label       "Author"@en ;
    rdfs:comment     "A person who authored a cited or citing work. A foaf:Person who stands in a dct:creator relation to a fabio:Expression."@en ;
    rdfs:subClassOf  foaf:Person ;
    rdfs:isDefinedBy <https://w3id.org/acme/cite> .

cite:Venue a owl:Class ;
    rdfs:label       "Venue"@en ;
    rdfs:comment     "A publication venue — conference, workshop, journal, book series, or repository."@en ;
    rdfs:subClassOf  fabio:PublicationVenue ;
    rdfs:isDefinedBy <https://w3id.org/acme/cite> .

cite:Journal a owl:Class ;
    rdfs:label       "Journal"@en ;
    rdfs:comment     "A scholarly journal."@en ;
    rdfs:subClassOf  cite:Venue, fabio:Journal, bibo:Journal ;
    rdfs:isDefinedBy <https://w3id.org/acme/cite> .

#################################################################
# Properties
#################################################################

cite:cites a owl:ObjectProperty ;
    rdfs:label              "cites"@en ;
    rdfs:comment            "Asserts that the subject work cites the object work. Use cito:cites and its subproperties for finer-grained citation intent (extends, refutes, agreesWith, ...)."@en ;
    rdfs:subPropertyOf      cito:cites ;
    rdfs:domain             fabio:Expression ;
    rdfs:range              fabio:Expression ;
    rdfs:isDefinedBy        <https://w3id.org/acme/cite> .

cite:affiliatedWith a owl:ObjectProperty ;
    rdfs:label              "affiliated with"@en ;
    rdfs:comment            "Affiliation of an Author with an Organization at the time of authorship."@en ;
    rdfs:subPropertyOf      schema:affiliation ;
    rdfs:domain             cite:Author ;
    rdfs:range              foaf:Organization ;
    rdfs:isDefinedBy        <https://w3id.org/acme/cite> .
```

A few details to call out:

- **Every term has `rdfs:isDefinedBy`** pointing back at the ontology IRI. This is what lets a SPARQL/OWL client follow its nose from a single term back to the full vocabulary document.
- **Every term is `rdfs:subClassOf` / `rdfs:subPropertyOf` something from a stable, widely-used vocabulary.** This is the single highest-leverage move you can make: your data is now queryable by any SPARQL engine that knows SPAR/FOAF/schema.org, with zero extra effort on the consumer's side.
- **`owl:versionIRI`** distinguishes "the latest cite vocab" from "the 0.1.0 snapshot." When you make a breaking change later, the snapshot URL still resolves.
- **`vann:preferredNamespacePrefix`** lets tooling (Protégé, LOV, etc.) auto-pick a sensible prefix.
- **License** matters. CC-BY 4.0 is the conventional choice; pick whatever, but pick *something*.

---

## 5. How this connects back to the Pod

In Alice's Pod at `https://pods.acme.org/alice/citations/`, her instance data references the vocabulary by IRI:

```turtle
@prefix cite: <https://w3id.org/acme/cite#> .
@prefix dct:  <http://purl.org/dc/terms/> .

<smith2023.ttl#it>
    a cite:Citation ;
    dct:creator <#alice> ;
    cite:cites <https://doi.org/10.1234/foo> .
```

Anyone — another Solid app, a SPARQL federation, an LLM agent doing follow-your-nose discovery — can resolve `https://w3id.org/acme/cite#Citation`, get the Turtle file, and immediately know that `cite:Citation` is a `cito:Citation` and that `cite:cites` is a `cito:cites`. Your data instantly federates with OpenCitations, the entire SPAR-using bibliographic web, and any future tooling that speaks CiTO.

If you'd hosted the vocabulary at `https://pods.acme.org/alice/vocab#`, none of that works the moment Alice's Pod is unreachable, and no one outside your app would ever consider it stable enough to depend on.

---

## TL;DR action list

1. Open a PR at `github.com/perma-id/w3id.org` registering `/acme/cite` → your hosting URL.
2. Create `github.com/acme-org/cite-vocab`, drop the Turtle above into `docs/cite.ttl`, enable GitHub Pages.
3. Use `https://w3id.org/acme/cite#` as your namespace everywhere — in Pod data, in JSON-LD contexts, in SHACL shapes, in app code.
4. Reuse CiTO/FaBiO/BiBO/FOAF/schema.org aggressively; mint `cite:` terms only where you genuinely need to.
5. Tag releases (`0.1.0`, `0.2.0`) and use `owl:versionIRI` so breaking changes are addressable.

Your Pod stores data. `w3id.org` stores meaning. Keep them separate and both jobs get easier.
