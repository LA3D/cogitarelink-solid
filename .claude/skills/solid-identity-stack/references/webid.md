# WebID

## Specs

- **W3C WebID 1.0** (W3C Incubator Editor's Draft, 2014)
  https://www.w3.org/2005/Incubator/webid/spec/identity/
  Status: Unratified Incubator output. Foundational but never reached Rec.
- **Solid WebID Profile** (editor's draft, ongoing)
  https://solid.github.io/webid-profile/
  Status: Active editor's draft. The published `solidproject.org/TR/webid` URL 404s; the github.io editor's draft is the live spec.

## What it is

A **WebID** is an HTTP(S) IRI that, when dereferenced, returns an RDF document
declaring `<#me> a foaf:Agent` (or a subclass — Person/Organization/Group/
Service/Application). The IRI typically has a fragment identifier (`#me`,
`#it`) — the IRI *with* the fragment is the WebID; the document at the
fragment-less URL is the **WebID profile document**, just where it
dereferences.

The W3C WebID spec is explicit: *"A WebID is an HTTP URI which refers to an
Agent (Person, Organization, Group, Device, etc.)."* The Solid WebID
Profile spec requires exactly one `rdf:type` whose object is `foaf:Agent`.
**`foaf:Person` is NOT required** — orgs, groups, services, and apps are
all spec-legal WebID subjects.

## Key snippets

```turtle
# A person WebID:
<https://alice.example/profile/card#me>
    a foaf:Person, vcard:Individual ;
    foaf:name "Alice Smith" ;
    solid:oidcIssuer <https://idp.example/> ;
    pim:storage <https://alice.example/> ;
    owl:sameAs <https://orcid.org/0000-0002-...> .
```

```turtle
# An organization WebID:
<https://ci-compass.example/org#it>
    a foaf:Organization, as:Organization ;
    foaf:name "CI-Compass" ;
    solid:oidcIssuer <https://ci-compass.example/> ;
    owl:sameAs <https://ror.org/001zwgm84> .
```

```turtle
# An application WebID (used as Solid-OIDC client_id):
<https://pod.example/agents/claude-code>
    a foaf:Agent, as:Application ;
    foaf:name "Claude Code" ;
    schema:publisher <https://anthropic.com> ;
    schema:softwareVersion "1.x" .
```

## What you'll get wrong if you don't read the spec

- **The profile document is NOT the WebID.** The hash-fragment IRI is. The
  doc is just where it dereferences. `https://alice.example/profile/card`
  (the document) ≠ `https://alice.example/profile/card#me` (the WebID).
- **Multiple WebIDs per profile document is legal.** A single document can
  declare `<#me>`, `<#org>`, `<#agent-bot>` independently. CSS supports
  this via the account JSON API (many-to-many between accounts, WebIDs,
  and Pods). See [multi-webid-pod.md](multi-webid-pod.md).
- **`solid:oidcIssuer` is what makes a WebID OIDC-usable.** Without it,
  the WebID is a valid identifier but cannot authenticate. The Solid-OIDC
  flow discovers the IDP via this triple.
- **Identity bridging uses `owl:sameAs` or `alsoKnownAs`.** WebID ↔ ORCID,
  WebID ↔ DID, WebID ↔ another WebID. The Solid WebID Profile spec
  endorses `owl:sameAs` for "two WebIDs that denote the same entity."
  DID Core defines `alsoKnownAs` for the reverse direction (DID → other
  identifiers).
- **WebID Profile spec ≠ WebID 1.0 spec.** WebID 1.0 is the W3C Incubator
  spec (the agent identifier itself); Solid WebID Profile defines what
  must be in the profile *document* for Solid use (OIDC issuer, storage,
  trusted apps, etc.). Cite the right one.
- **The published spec URL on solidproject.org for WebID Profile 404s.**
  The editor's draft at https://solid.github.io/webid-profile/ is the
  live version.

## How this Pod uses it

- **Pod owner's WebID** lives at `https://pod.vardeman.me/profile/card#me`
  (CSS-minted minimal profile). The project's working position
  (design doc) is to enrich it with `foaf:name`, `org:hasMembership`,
  `owl:sameAs <orcid>`, ROR-linked affiliations.
- **Wiki person pages** (`/wiki/people/<slug>`) are NOT WebIDs in the
  authentication sense. They are *third-party notes* — Pod-owner-authored
  pages about a person. They link to the subject's WebID profile (when
  known) via `foaf:isPrimaryTopicOf`.
- **Agent WebIDs** for AI agents are minted at `/agents/{claude-code,
  rlm-substrate,vault-importer}` as Pod-local client_id documents — these
  are `foaf:Agent + as:Application`. See [agent-identity.md](agent-identity.md).
- **Organization WebIDs** are not yet minted on this Pod. ROR `owl:sameAs`
  is used as fallback identity when an org has no WebID. Working position:
  mint Pod-local org WebIDs only when an org actually federates a Pod.

## Cross-references

- [solid-oidc.md](solid-oidc.md) — how a WebID feeds the OIDC flow
- [multi-webid-pod.md](multi-webid-pod.md) — many WebIDs in one Pod
- [did.md](did.md) — the D14 DID-WebID bridge pattern
- [agent-identity.md](agent-identity.md) — WebIDs for AI agents and apps
