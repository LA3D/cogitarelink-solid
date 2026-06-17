---
rationale: "Bootstrapped memory for the D111 identifier-scheme substrate — explains compact-id form and the /id/schemes/ catalog so a cold agent can register and resolve PIDs. Authored from the D111 cold-probe findings; dog-foods the compact-id convention."
title: How Identifiers Work
type: concept
created: 2026-06-05
identifier: citekey:how-identifiers-2026
---
# How Identifiers Work

[How identifiers work]{.prefLabel} — this Pod has one identifier discipline. An identifier is
[a string that names a thing plus the rule for resolving, validating, and crosswalking it]{.definition}.
There are two regimes. Read this before you write a Source, a contact, or anything that cites or
publishes — and before you go looking for a resolver you don't need.

## You already have an identifier (the informal regime)

Every resource in this Pod has a URL, and that URL **is** an identifier. It is enforced by the
HTTP protocol itself — there is nothing to look up, nothing to register, nothing to validate.
`GET https://pod.vardeman.me/vault/wiki/concepts/photosynthesis.md` resolves to the thing itself,
with full LDP/conneg/WAC/Memento affordances. A simple write never touches `/id/` and pays zero
cost for its existence. The Pod's own scheme record is `solid-resource`, and it documents this
regime — but you never have to read it to use a URL.

## Formal identifiers carry their dispatch in the datatype

A DOI, an ORCID, a citekey — these are *formal* identifiers: deliberately minted, maintained by
an institution or registry. In this Pod a formal identifier is a **typed literal**, and the
datatype IRI is the dispatch key:

```
"10.1234/x"^^<https://pod.vardeman.me/id/schemes/#doi>
```

The datatype is not decoration. GET it — HTTP drops the `#doi` fragment, so the request lands on
the catalog document `/id/schemes/`, and that one fetch hands you the whole scheme index. Any
typed literal you encounter is therefore self-teaching: you need no prior knowledge of the
catalog; the first typed identifier you meet is the route in.

## The resolution walk

Once you have a scheme's index entry, four hops take you to a working URL:

1. **Index entry → record.** Each `<#key>` in `/id/schemes/` carries `foaf:isPrimaryTopicOf`
   pointing at the rich record (e.g. `/id/schemes/doi`). GET it.
2. **Record → providers.** A record lists `idot:Resource` providers, each with an
   `idot:urlPattern` containing `{$id}` — substitute your literal's lexical form for `{$id}`.
3. **Pick by role.** Each provider's `dct:type` says what resolution *returns relative to the
   thing*: a landing page, a metadata record, a DID document, or — only for `solid-resource` —
   the resource itself. Choose the provider whose role and `dcat:mediaType` match what you need.
4. **Syntax is suggestive only.** `idot:luiPattern` is the scheme's regex; read it to recognise
   or sanity-check a string, but it is data for you and the curation loop, never a hard gate.

## Authoring a typed identifier

Two ways, both materialize a `dct:identifier` literal on `<#this>` carrying the scheme datatype:

- **Body span:** `[10.1234/x]{.identifier^^ids:doi}` — the inline grammar (see
  [[how-wiki-memory-works]]). The `ids:` prefix expands to `…/id/schemes/#`.
- **Frontmatter:** `identifier: doi:10.1234/x` — the identifiers.org compact form, which you
  already speak. This page dog-foods it: `identifier: citekey:how-identifiers-2026`.

A `did:` value keeps its full string (the prefix is part of the identifier). An unknown prefix is
never rejected — it projects as a plain literal and the Tier-2 curation loop flags it.

## Registering a new scheme

If you mint an identifier whose scheme isn't in the catalog, register the scheme — don't wedge an
untyped string into your content. PUT one Turtle record to `/id/schemes/<key>`, modeled on a
worked exemplar (`GET /id/schemes/doi` is the reference). A nonconformant record returns a `422`
with a `sh:ValidationReport`; read `sh:resultMessage`/`sh:resultPath`, correct, re-PUT — the same
correction protocol as any other write. The catalog index **derives itself** from your record the
moment it lands; never write the index by hand (a PATCH touching a derived entry is rejected).

## Crosswalks

One thing can carry several typed identifiers side by side — a published dataset's `<#this>` holds
its Pod URL (the IRI itself), its DOI, and its citekey at once. That is how you cross the
Solid/non-Solid boundary in either direction: outbound, literal → datatype → record → provider;
inbound, a DOI registered against the Pod URL lands on the resource whose `.meta` exposes every
other identifier. Scheme records anchor to the global registries via `skos:exactMatch` (e.g. the
`doi` record `skos:exactMatch datacite:doi`), so two Pods' `doi` schemes are provably the same.

## Try this (read-only)

1. `GET /id/schemes/` — the catalog: eight `<#key>` entries, each a scheme datatype.
2. `GET /id/schemes/#doi` — dereferencing a datatype IRI returns the same catalog (HTTP drops the
   fragment). This is what an agent holding a `^^…#doi` literal sees first.
3. `GET /id/schemes/doi` — the rich record: definition, `idot:luiPattern`, providers, the
   `datacite:doi` anchor.
4. Note `citekey`: its only provider is the Pod's own `?ext=search-grep` affordance — a local
   identifier resolves by querying this memory pod, not the web.
