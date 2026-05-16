# Identity and Provenance Design — Pre-ACL Working Document

**Status:** Working design notes, not a decision. Captures a Phase 5j close-out
discussion that surfaced four interconnected identity/provenance threads
load-bearing for the upcoming ACL turn-on.

**Date:** 2026-05-16

**Context:** Phase 5j shipped (URI conformance, TLS, PROF profile descriptors,
ProfileLinkMetadataWriter, wikirole scheme). Reviewing the close-out follow-ups
surfaced a `foaf:affiliation` frontmatter-mapping question (FOLLOWUPS line 100),
which unfolded into four interconnected design threads. Before deciding the
small-feature question, the larger architectural shape needs to be visible.

**Related decisions:** D14 (DID-WebID bridge via alsoKnownAs), D44 (storage
description router), D52/D55/D58 (affordance descriptors, three-tier access,
dual-layer linking), D70-D81 (wiki-memory L3 stratification), D83
(Pod-as-toolkit capability catalog), D84-D86 (URI conformance, TLS, PROF).

---

## The four threads

1. **Person identity vs role.** The Obsidian vault's `/people/` container
   conflates "social contact" and "bibliographic author" — different
   role-clusters over the same kind of entity. Fixing this requires deciding
   what a `wiki:Person` resource IS relative to a WebID profile.

2. **Organization identity.** Organizations can have WebIDs
   (`foaf:Agent` is the only spec-required type, not `foaf:Person`).
   Affiliation as a flat string (`vcard:organization-name "Notre Dame"`)
   forecloses graph queries; affiliation as a wikilink-to-Organization or a
   reified `org:Membership` opens them.

3. **Agent authentication and provenance materialization.** When an AI agent
   (Claude Code, dspy.RLM, vault-importer) writes to the Pod on the human's
   behalf, the request already carries user identity + app identity + per-instance
   key binding via Solid-OIDC + DPoP. No spec mandates writing this into
   `.meta`, but the substrate's MonitoringStore CDC pattern can close the gap.

4. **ACL framework choice (WAC vs ACP).** Threads 1-3 collapse onto this:
   WAC has no `acl:client` matcher and no VC support; ACP does. Before any
   ACL is turned on, choose the framework that can express the policies
   threads 1-3 imply.

These are not independent. The person/role distinction depends on what a
WebID profile actually IS; that depends on whether the agent acting at write
time is a person or an app-on-behalf-of-person; that depends on what the
ACL framework can express. Solving them piecemeal risks contradictory
choices.

---

## Thread 1 — Person identity vs role

### The problem (current state)

`~/Obsidian/obsidian/people/` munges two role-clusters:

- **Social contacts.** Densely populated, current. Email, phone, current
  affiliation, foaf:knows-relation-to-me, notes about last interactions.
  Typically have email, sometimes ORCID, sometimes WebID.
- **Bibliographic agents.** Sparse, often historical. Author/editor/translator
  of works cited. Identity fixed by what they wrote. Often have ORCID, rarely
  email, sometimes dead.

The overlap case (a colleague who also publishes) is the agentic-interesting
one — *both predicate clusters on the same identity*. The vault's
filesystem-driven "one slug per person" approach can't express role overlay
because filesystem layout has no role axis. RDF does.

### What the Solid ecosystem actually does

SolidOS contacts-pane (canonical app, TBL lineage, active 2026-05) uses
**vcard** as primary vocabulary:

```turtle
<#this> a vcard:Individual ;
    vcard:fn "Alice Smith" ;
    vcard:hasUID <urn:uuid:...> ;
    vcard:inAddressBook <#book> ;
    vcard:organization-name "Acme Inc" ;
    vcard:url [ a vcard:WebId ;          # SolidOS friendly amendment, not W3C
                vcard:value <https://alice.example/profile/card#me> ] .
```

Notable findings:

- **WebID linkage is not standardized.** SolidOS invented
  `vcard:WebId`/`vcard:Homepage`/`vcard:PublicId` as friendly-amendment
  subclasses of `vcard:URL`. `solid/vocab` issue #22 ("document use of FOAF
  and VCARD together") still open. No W3C/Solid CG normative answer.
- **Type Index registers `vcard:AddressBook`**, not `vcard:Individual`.
- **Affiliation is a flat literal.** `vcard:organization-name "..."` — no
  ROR, no organization resource, no time scope. Known modeling regression
  no one has fixed.
- **Self-claims vs third-party claims are conflated.** Only structural marker
  is `vcard:inAddressBook` ("this is an address-book entry, not a WebID
  profile"). No `prov:wasAttributedTo`, no named-graph segregation.
- **No successor pattern has displaced mashlib.** Demo repos exist but reuse
  the same vcard model.

### Three positions

**A. SolidOS-compatible, minimal divergence.**
`wiki:Person rdfs:subClassOf vcard:Individual`. WebID via SolidOS's
`vcard:url + vcard:WebId` indirection. Affiliation as literal. Win:
SolidOS reads our records. Lose: literal affiliation breaks graph queries —
the whole point of wiki-memory L3.

**B. wiki-memory L3 native, ignore SolidOS.**
`wiki:Person` is a wiki-page-about-a-person, not declared `vcard:Individual`.
WebID via `foaf:isPrimaryTopicOf <profile-doc>` or `owl:sameAs <#me>`.
Affiliation as wikilink to `/wiki/organizations/<slug>` (which `owl:sameAs`
ROR). Win: clean graph, dual-layer (D58/D71). Lose: SolidOS contacts pane
sees nothing.

**C. Bridge — wiki page is also a vcard projection.**
Page is `wiki:Person`; substrate also emits `a vcard:Individual` + minimal
vcard subset. Affiliation lives as a wikilink in wiki AND as
`vcard:organization-name` projected from the linked org's `rdfs:label`.
Win: both worlds. Lose: substrate maintains the projection (D72 compile-once).

### The role-overlay model (independent of position A/B/C)

Within any of A/B/C, the role distinction should be made explicit:

```turtle
</wiki/people/jane-doe>
    a foaf:Person ;                        # always
    [, a vcard:Individual] ;               # if position A or C
    vcard:fn "Jane Doe" ;
    vcard:url [ a wiki:OrcidId ;
                vcard:value <https://orcid.org/0000-0002-...> ] ;
    vcard:url [ a wiki:WebId ;
                vcard:value <https://jane.example/profile/card#me> ] ;

    # contact role predicates (only when populated)
    vcard:hasEmail <mailto:jane@nd.edu> ;
    org:hasMembership </wiki/memberships/jane-at-nd-2024-> ;

    # bibliographic role marker (only when authored anything)
    prov:hadRole bibo:Author ;

    # the WebID profile is the subject's self-document; this page is our notes
    foaf:isPrimaryTopicOf <https://jane.example/profile/card> .
```

Two SHACL shapes target the same resource via predicate-level governance (D81):

- `PersonContactShape` (`sh:targetClass vcard:Individual`) governs
  `vcard:*` and `org:*` predicates
- `PersonBibliographicShape` (conditional: subject has inverse `dct:creator`)
  governs `bibo:*`, `prov:hadRole`

Neither is `sh:closed`. A person can be just-an-author (no contact triples),
just-a-contact (no bibliographic triples), or both.

### Open questions for Thread 1

1. **Position A / B / C?** Strategic — does SolidOS-app readability matter?
2. **Does `wiki:Organization` join the shape catalog?** Load-bearing for
   graph-linked affiliation. Currently 6 shapes (resource/concept/source/
   person/procedure/working); adding Organization is a real choice.
3. **Time-scoped affiliation via `org:Membership` — yes/no?** Argues for
   yes because of historical authors ("Van de Sompel at LANL 2013-2015"
   ≠ "Van de Sompel at DANS 2020-"). Adds a second new shape
   (`wiki:Membership`) or accepts `org:Membership` as substrate-governed
   without wiki-prefix wrapper.
4. **Identifier indirection pattern.** Extend SolidOS's `vcard:url + typed-subclass`
   (mint `wiki:OrcidId rdfs:subClassOf vcard:URL`)? Or invent
   `wiki:identifier` with rdf:type discriminator? SolidOS-extension is
   probably right — zero cost, app-compat.
5. **Lifecycle and merge.** Same person from Zotero import + manual wikilink
   = two records. Reconcile by ORCID/WebID match, manual `owl:sameAs`, or
   fuzzy match. Substrate needs identifier-reconcile step.

---

## Thread 2 — Organization identity and the shared-Pod future

### Spec status

**WebIDs for organizations are spec-legal.** W3C WebID 1.0:
*"A WebID is an HTTP URI which refers to an Agent (Person, Organization,
Group, Device, etc.)."* Solid WebID Profile (editor's draft) requires exactly
one `rdf:type` whose object is `foaf:Agent`. Solid-OIDC is agent-type-agnostic
— an org WebID can authenticate if its profile declares a valid
`solid:oidcIssuer`.

**Practice is thin.** Inrupt's WebID Service bootstraps every profile as
`a foaf:Agent` and leaves the type tower to the holder. ActivityPods
cross-pollinates AS2 with FOAF in one profile (their examples are Person-typed
but the model trivially extends to `as:Organization`/`as:Service`/`as:Application`).
No canonical deployed institutional/lab org WebID found in public search.

### The richer affiliation model

Instead of `vcard:organization-name "Notre Dame"` (flat literal) or
`foaf:affiliation <https://ror.org/00mkhxb43>` (registry IRI), the richest form:

```turtle
</wiki/organizations/nd>
    a foaf:Organization, vcard:Organization ;
    vcard:fn "University of Notre Dame" ;
    foaf:isPrimaryTopicOf <https://nd.example/profile/card> ;  # if ND had a pod
    owl:sameAs <https://ror.org/00mkhxb43> .                    # ROR as fallback
```

ROR is the registry identifier. WebID (if it exists) is the dereferenceable
agent identity. They coexist as `owl:sameAs` peers. The wiki page is a third
thing — our notes about the organization. Same pattern as people.

Time-scoped membership via W3C ORG ontology:

```turtle
</wiki/memberships/herbert-at-lanl-2013-2015>
    a org:Membership ;
    org:member </wiki/people/herbert-van-de-sompel> ;
    org:organization </wiki/organizations/lanl> ;
    org:memberDuring [ time:hasBeginning [ time:inXSDDate "2013-01-01"^^xsd:date ] ;
                       time:hasEnd       [ time:inXSDDate "2015-06-30"^^xsd:date ] ] ;
    org:role bibo:Author .
```

Now "where was Van de Sompel when he wrote this paper?" is a SPARQL query,
not a literal lookup.

### Multi-user CSS, and one Pod hosting multiple WebIDs

Two distinct deployment shapes worth understanding:

**Subdomain isolation (solidcommunity.net pattern).** CSS in subdomain mode
(`util/identifiers/subdomain.json` import). Each registered user gets their
own Pod at `https://alice.solidcommunity.net/` with WebID at `…/profile/card#me`.
One IDP issues tokens for all users (single OP). solidcommunity.net's "~50
users" are 50 isolated Pods, not one shared Pod.

**Shared Pod, multiple WebIDs (the more interesting pattern for organizations).**
First-class CSS feature via the account JSON API
(`controls.account.webId`, `controls.account.pod` — both many-to-many).
One account can own many pods. One account can link many WebIDs. One pod
can host many WebID profile documents.

A lab Pod could legitimately host:

```
/org#it           — the lab's organization WebID (foaf:Organization)
/people/alice#me  — Alice's personal WebID
/people/bob#me    — Bob's personal WebID
/people/carol#me  — Carol's personal WebID
```

Each profile dereferences as a normal WebID. Each can declare its own
`solid:oidcIssuer`. ACL is per-resource so members control their subtrees.
**Caveat:** pod-root ACL is single-owner. No "co-equal admins" primitive.
The natural answer is **the org WebID owns the pod**, with per-member
subtree control delegated via `acl:Control`.

No canonical deployed reference exists for this pattern — it's in spec
and tooling but not in the literature as common practice. Green field.

### What this implies for the wiki-memory L3 deployment shape

Three architectural shifts:

1. **Organizations become first-class WebID-bearing agents, not just labels.**
   Affiliation becomes a relation between two agents (person, organization)
   each with their own identity claims. ROR is `owl:sameAs`, not the primary IRI.

2. **The "Pod owner" can be an organization, with humans as member-WebIDs.**
   A CI-Compass shared Pod could literally have `/org#it` as the org WebID
   (owns the pod), with `/people/{charles,ewa,...}#me` as member WebIDs.
   Wiki-memory L3 deployed in this Pod would naturally be lab memory, not
   just personal memory. Multi-author wiki page with `acl:Control` per-subtree.
   Doesn't have to choose between personal and institutional — same shape
   at different scales.

3. **Pod owner's WebID and the wiki-page-about-the-Pod-owner are explicitly
   different.** Clean predicate:
   ```turtle
   </wiki/people/charles>                  # wiki page (Pod-owner-authored note)
       foaf:isPrimaryTopicOf <https://pod.vardeman.me/profile/card> .

   <https://pod.vardeman.me/profile/card#me>   # the WebID (self-claims)
       a foaf:Person, vcard:Individual ;
       foaf:name "Charles Vardeman" ;
       org:hasMembership </wiki/memberships/cv-at-nd> ;
       owl:sameAs <https://orcid.org/0000-0003-4091-6059> .
   ```

   Affiliation lives canonically on the WebID profile (subject's self-claim).
   Wiki page may carry third-party notes about the same affiliation,
   reified separately if we ever need to distinguish.

### Open questions for Thread 2

1. **Should the Pod owner's `/profile/card` carry richer triples?** Currently
   CSS-minted minimal. If "WebID profile = self-claims, wiki page = notes"
   is the rule, the profile should carry `foaf:name`, `org:hasMembership`,
   `owl:sameAs <orcid>`, identity claims for ROR/Notre Dame/CI-Compass.
2. **For non-Solid people (authors, historical figures), mint Pod-local
   WebIDs?** I.e., create `/wiki/people/herbert-vds#me` as a placeholder
   WebID we control, `owl:sameAs` canonical-when-known. Or keep them as
   bare `wiki:Person` URIs without #me-style WebID-shaped identifier.
3. **For organizations (Notre Dame, CI-Compass, LANL), mint Pod-local
   WebIDs?** Probably no for now — ROR `owl:sameAs` is enough; mint only
   when an org actually federates a Pod.
4. **Does the wiki-memory L3 model anticipate the lab-Pod / org-Pod future?**
   If yes, predicate-level governance (D81) should accommodate per-member
   ACL subtrees and an org-WebID-owner pattern even in single-user deployment.
   Cheap design choice now; expensive retrofit later.
5. **AS2 inbox/outbox on the org WebID — yes/no?** ActivityPods's pattern is
   interesting for an agentic memory substrate that wants to receive
   structured messages. Round 4 territory.

---

## Thread 3 — Agent authentication and provenance materialization

### What Solid-OIDC + DPoP already does

When Claude Code (or any client app) talks to the Pod on the human's behalf,
the request already carries three pieces of identity:

- Access token's `webid` claim = **user WebID**
- Access token's `azp` (authorized party) claim = **client app identifier**
- DPoP `cnf` claim binds the token to the client's per-instance keypair
  thumbprint (RFC 9449)

The client_id is itself a dereferenceable RDF/JSON-LD document describing
the app — *that document IS an agent identity*. Pod sees:

```
webid:    https://pod.vardeman.me/profile/card#me      (Charles)
azp:      https://pod.vardeman.me/agents/claude-code   (the app)
dpop_jkt: <thumbprint of this Claude Code instance's keypair>
```

All three are present at request time. **The data exists; the spec just
doesn't mandate writing it down.**

### The audit-trail gap and how the substrate closes it

No Solid spec says "stamp the requesting agent into `.meta`." But this
project has:

1. The data (Solid-OIDC + DPoP request context, surfaced by CSS internals)
2. The hook pattern (MonitoringStore CDC, used by `MementoCommitListener`
   and `MarkdownProjectionListener`)
3. A clean vocabulary (PROV-O)

A `ProvenanceCommitListener` extension would do at write time:

```turtle
</wiki/people/jane-doe> a wiki:Person ;
    vcard:fn "Jane Doe" ;
    ... .

# In .meta:
</wiki/people/jane-doe>
    prov:wasAttributedTo
        <https://pod.vardeman.me/profile/card#me> ;       # Charles
    prov:wasAssociatedWith
        <https://pod.vardeman.me/agents/claude-code> ;    # Claude Code app
    prov:qualifiedAssociation [
        prov:agent <https://pod.vardeman.me/agents/claude-code> ;
        prov:hadRole wikirole:delegatedAuthor ;
        prov:atTime "2026-05-16T..."^^xsd:dateTime ;
    ] ;
    dct:modified "2026-05-16T..."^^xsd:dateTime .
```

This **subsumes RQ-Listener-1**. Path-D (RDF-star reification) was about
distinguishing substrate-authored triples from agent-authored triples. PROV-O
at resource level is the lighter answer to the same question: every write
has a `prov:wasAssociatedWith` tag, so substrate vs agent vs
Claude-Code-on-behalf-of-Charles is queryable without RDF-star tooling debt.
Path-D may not be needed at all.

### Three classes of agent identity to mint

Pod-local client_id documents — these become the substrate's *registered
agent classes*:

```turtle
</agents/claude-code>
    a foaf:Agent, as:Application ;
    foaf:name "Claude Code" ;
    schema:softwareVersion "1.x" ;
    schema:publisher <https://anthropic.com> ;
    solid:oidcIssuer <https://pod.vardeman.me/> ;
    wiki:capability cap:read-graph, cap:write-graph, cap:patch-meta .

</agents/rlm-substrate>
    a foaf:Agent, as:Application ;
    foaf:name "dspy.RLM agent substrate" ;
    ... .

</agents/vault-importer>
    a foaf:Agent, as:Application ;
    foaf:name "vault-importer CLI" ;
    schema:isPartOf <https://github.com/cvardeman/.../cogitarelink-solid> ;
    ... .
```

These ARE WebIDs in the broad `foaf:Agent` sense. They're agent-*class*
identifiers, not per-instance. DPoP gives per-instance binding via key
thumbprint at request time, captured in PROV-O as `prov:qualifiedAssociation`
when per-instance audit matters.

### Verifiable Credentials — landscape and deferral

Two parallel things called "Access Grant" in the ecosystem:

1. **Inrupt's gConsent Access Grants** (production, VC-based). `SolidAccessGrant`
   VC type with one oddity: `credentialSubject.id` is the **grantor**, not
   the grantee. Grantee at `providedConsent.isProvidedTo`. Only Inrupt ESS
   ships this — CSS doesn't.
2. **Solid Apps Interop "Access Grant"** (spec-track, not VC-based). Native
   LDP resources in an Authorization Registry. Different beast despite the
   name collision.

**ACP has a first-class `acp:vc` matcher; WAC does not.** Quoting the spec:
*"In a Matcher, vc attributes define a set of types of Verifiable Credentials,
at least one of which MUST match the Context."*

For Rung 1.3 (VC-aware operation gating for tombstone deletion etc.), the
choice is between:
- adopting Inrupt's gConsent vocab (interop benefit, weird grantor-subject
  semantics)
- minting our own SolidAccessGrant-shaped VCs (no interop, cleaner model)

Either way, the ACP matcher infrastructure is the same. Defer until Rung 1.3.

### Open questions for Thread 3

1. **Per-agent-class registry: who maintains it?** Anthropic doesn't publish
   a canonical Claude Code agent profile. We mint and maintain `/agents/*`
   ourselves. That's fine for v1; document it as a substrate-owned namespace.
2. **PROV-O granularity.** Resource-level (per `.meta`) is cheap, coarse —
   "this resource was touched by Claude Code at some point." Triple-level
   (per-edit) is rich, heavy (RDF-star path-D). Resource-level probably
   enough for Rung 1.5; triple-level only if eval surfaces need.
3. **Order: Provenance vs Memento snapshot.** Memento snapshots `.meta`
   on commit. Provenance must be in `.meta` *before* Memento snapshots it.
   Two listeners ordered correctly, or one combined listener.
4. **Capabilities declared on agent profile.** Connects to D83 (capability
   catalog). Agent declares `wiki:capability cap:write-graph`; substrate
   can refuse writes from agents that haven't declared the capability.
   ACP can also do this via matchers. Two places to enforce — pick one.

---

## Thread 4 — ACL framework choice

The three threads above all push toward ACP over WAC:

| Capability needed | WAC | ACP |
|---|---|---|
| User identity matcher | `acl:agent` | `acp:agent` |
| App identity matcher | `acl:origin` (web origin only) | `acp:client` (full client_id URI) |
| VC-gated access | not supported | `acp:vc` first-class matcher |
| Conjunctive evaluation (user AND app) | requires `acl:origin` workaround | native |
| Issuer-based matching (e.g., "any agent issued by Inrupt IDP") | not supported | `acp:issuer` |
| Public access | `acl:agentClass foaf:Agent` | `acp:agent acp:PublicAgent` |

**WAC's `acl:origin` is too coarse for CLI agents** — Claude Code has no
browser origin string. ACP's `acp:client` resolves the OIDC client_id URI,
which is exactly the agent profile we'd mint at `/agents/claude-code`.

CSS supports both. Switching means swapping the auth module in
`solid-config.json` (auth module exclusivity, per CSS_v8_config_patterns
memory). Cost: one config change + recreating any existing `.acl` as `.acr`.
Currently nothing depends on WAC (no ACLs turned on yet), so cost is
near-zero. Cost of switching later, after policies depend on WAC, would be
substantially higher.

### Open questions for Thread 4

1. **Switch to ACP before any ACL turn-on?** Recommend yes — cost is lowest
   now, before any policies are written.
2. **First policy to write?** Three plausible starters:
   - "Pod owner has full access, public has none" (minimal viable ACL)
   - "Pod owner full access, registered agents (`/agents/*`) have
     declared-capability access" (capability-aware from day 1)
   - "Pod owner full access, public read for `/wiki/public/`, members read
     elsewhere" (anticipates multi-WebID Pod from Thread 2)
3. **ACR template for new resources.** CSS supports default ACRs at the
   container level. Wiki-memory L3 containers
   (`/wiki/{pages,sources,people,procedures,working}/`) each want different
   defaults — `procedures/` more restricted than `pages/` likely.

---

## The destination — self-sovereign agent identity

The threads above stop at Pod-local client_id documents. Those work for
single-Pod deployment. They don't work for the federated future where
Claude Code talks to multiple Pods (mine + a collaborator's + an
institutional one) without re-registering as a different agent at each.

**DIDs (W3C DID Core)** are the natural answer. A `did:key:...` for an agent
instance is self-sovereign, doesn't depend on any single Pod, can be
cryptographically rotated. `did:web:...` for a published agent (Claude Code
v1.x as an Anthropic-controlled identity) gives a stable canonical
identifier.

D14 (DID-WebID bridge via `alsoKnownAs`) already names this pattern. Under
that decision, a Pod-local client_id document like `/agents/claude-code`
becomes the WebID-side projection of a DID-side canonical identity:

```turtle
</agents/claude-code>
    a foaf:Agent, as:Application ;
    foaf:name "Claude Code" ;
    owl:sameAs <did:web:claude.ai:agents:claude-code> ;
    alsoKnownAs <did:web:claude.ai:agents:claude-code> .

# The DID document (resolved via did:web):
<did:web:claude.ai:agents:claude-code>
    a as:Application ;
    foaf:name "Claude Code" ;
    schema:publisher <https://anthropic.com> ;
    # cryptographic verification methods, service endpoints, etc.
    ... .
```

An agent presenting credentials at *any* Pod can be matched against either
the WebID-side identifier (if the Pod has registered them) or the DID-side
identifier (if the Pod accepts DID-based matchers). ACP doesn't yet have a
`acp:did` matcher — that's a substrate extension we'd write.

**This is where the design probably eventually wants to land.** It's not
where it has to start. Pod-local client_id documents are correct for v1;
the DID bridge is additive when federation matters.

**Why DIDs are particularly right for AI agents:**

- An AI agent doesn't have a "home server" the way a human does. The DID
  doesn't need a hosting Pod; `did:key` lives in cryptographic key material,
  `did:web` lives in a static document at a well-known URL.
- AI agent instances are ephemeral. DID rotation is built into the spec
  (key rotation via DID document update). WebID-style "this document is
  the identity" doesn't handle rotation cleanly.
- Cross-Pod, cross-organization, cross-provider federation is the agentic
  use case. DIDs are designed for it; WebIDs are designed for the
  single-Pod-per-person assumption.
- Verifiable Credentials (Thread 3 deferred) bind much more naturally to
  DIDs than to WebIDs — the W3C VC ecosystem assumes DIDs throughout.

The implication: **everywhere we'd write a WebID for an agent today, we
should expect to eventually write a DID alongside it via `alsoKnownAs` or
`owl:sameAs`**. The infrastructure (D14, the client_id document pattern,
PROV-O at resource level) is already compatible.

---

## Cross-thread synthesis

Now that all four threads are visible:

1. **The original `foaf:affiliation` question (FOLLOWUPS 100) reframes.**
   Affiliation is not a property of the wiki page about a person; it's a
   property of the person's WebID profile, projected (if anywhere) into
   the wiki page via reverse-traversal. There may be no `affiliation:`
   frontmatter mapping at all — instead, the wiki page references the
   person's WebID via `foaf:isPrimaryTopicOf`, and affiliation queries
   dereference through to the WebID profile.

2. **The shape catalog probably grows.** Likely additions:
   - `wiki:Organization` (organization-as-page, ROR-linked, with optional
     WebID via `foaf:isPrimaryTopicOf`)
   - `wiki:Membership` or accept `org:Membership` as substrate-governed —
     for time-scoped affiliation
   - Possibly `PersonBibliographicShape` (conditional, sh:targetClass
     foaf:Person + inverse dct:creator)

3. **`/agents/{claude-code,rlm-substrate,vault-importer}` is a new
   container.** Not currently in the storage description. Substrate
   reserves the namespace; documents are minimal client_id profiles.
   They are *foaf:Agents*, parallel to people and organizations.

4. **Provenance materialization is a new extension.** `ProvenanceCommitListener`
   mirrors `MementoCommitListener`. Closes the audit-trail gap, subsumes
   RQ-Listener-1. Ordering vs Memento snapshot matters.

5. **ACP migration before ACLs.** Strategic. Cost lowest now.

6. **DID bridge is the eventual destination.** Pod-local client_ids are
   v1; `alsoKnownAs <did:web:...>` is v2 when federation matters.

---

## Sequencing recommendation (not a decision)

**Before ACL turn-on:**

1. Migrate CSS config from WAC to ACP. Single config change. Verify
   integration tests still pass (currently none exercise ACL — all
   `dev-allow-all`).
2. Mint stub `/agents/{claude-code,rlm-substrate,vault-importer}`
   client_id documents. Minimal — name, type, version. Can enrich later.
3. Decide first ACP policy. Minimal viable: "owner full access, public
   none." Adds capability-aware later when registered agents start
   writing.
4. Decide person-modeling position (A / B / C). This may be brainstorming-
   skill territory.

**During Rung 1.5 prep:**

5. Stand up `ProvenanceCommitListener` extension. Mirrors Memento pattern;
   one new extension, one new test suite. High value (audit trail, RQ-Listener-1
   mitigation). Eval can then read provenance triples directly.
6. If needed by eval: add `wiki:Organization` shape, populate stub
   organizations (Notre Dame, CI-Compass, LANL).
7. Confirm `foaf:affiliation` frontmatter mapping is *not* needed (per
   reframe — affiliation lives on WebID profile, not wiki page).

**Deferred to Round 3+:**

8. VC integration (Rung 1.3 plan — operation-gating, tombstone deletion).
9. DID bridge for agent identities (when federation use case surfaces).
10. AS2 inbox/outbox on org WebID (Round 4 territory).
11. Triple-level provenance via RDF-star (only if Rung 1.5 eval needs it).

---

## Open questions consolidated

Tracking across all four threads:

**Thread 1 — Person identity:**
- Q1.1 Position A/B/C for `wiki:Person` ↔ `vcard:Individual` relation?
- Q1.2 Does `wiki:Organization` join the shape catalog?
- Q1.3 Time-scoped affiliation via `org:Membership` — yes/no?
- Q1.4 Identifier indirection: extend SolidOS pattern or invent?
- Q1.5 Lifecycle and merge strategy.

**Thread 2 — Organization identity:**
- Q2.1 Should Pod owner's `/profile/card` carry richer triples?
- Q2.2 Mint Pod-local WebIDs for non-Solid people?
- Q2.3 Mint Pod-local WebIDs for organizations?
- Q2.4 Anticipate lab-Pod / org-Pod future in current design?
- Q2.5 AS2 inbox/outbox on org WebID?

**Thread 3 — Agent auth + provenance:**
- Q3.1 Who maintains `/agents/*` registry (substrate-owned namespace)?
- Q3.2 Resource-level vs triple-level provenance granularity?
- Q3.3 Provenance listener ordering vs Memento snapshot.
- Q3.4 Capability enforcement: agent-profile-declared vs ACP-matcher-enforced?

**Thread 4 — ACL framework:**
- Q4.1 Switch to ACP before any ACL turn-on?
- Q4.2 First policy to write — minimal owner-only, capability-aware, or
  multi-member-anticipating?
- Q4.3 Default ACR templates per wiki-memory L3 container?

**Cross-thread:**
- X.1 Does the original `foaf:affiliation` frontmatter mapping go away
  entirely (per reframe)?
- X.2 Shape catalog growth: how many new shapes (Organization, Membership,
  PersonBibliographic) before Rung 1.5 freezes?
- X.3 When does the DID bridge become load-bearing (Round 4? Earlier if
  Claude Code needs to talk to multiple Pods)?

---

## References

- W3C WebID 1.0: https://www.w3.org/2005/Incubator/webid/spec/identity/
- Solid WebID Profile (editor's draft): https://solid.github.io/webid-profile/
- Solid-OIDC: https://solidproject.org/TR/oidc
- ACP: https://solid.github.io/authorization-panel/acp-specification/
- WAC: https://solid.github.io/web-access-control-spec/
- Solid Application Interoperability: https://solid.github.io/data-interoperability-panel/specification/
- W3C DID Core: https://www.w3.org/TR/did-core/
- W3C VC Data Model: https://www.w3.org/TR/vc-data-model/
- PROV-O: https://www.w3.org/TR/prov-o/
- W3C ORG Ontology: https://www.w3.org/TR/vocab-org/
- W3C VCARD-RDF: https://www.w3.org/TR/vcard-rdf/
- DPoP (RFC 9449): https://www.rfc-editor.org/rfc/rfc9449
- GNAP (RFC 9635): https://www.rfc-editor.org/rfc/rfc9635
- SolidOS contacts-pane: https://github.com/SolidOS/contacts-pane
- Inrupt Access Grants: https://docs.inrupt.com/security/authorization/access-requests-grants
- ActivityPods Solid spec: https://activitypods.org/specs/solid
- CSS Account JSON API: https://communitysolidserver.github.io/CommunitySolidServer/latest/usage/account/json-api/
- Inrupt MCP-Solid: https://www.inrupt.com/blog/why-were-excited-about-solid-and-mcp
- OpenID AI Agent Identity (Oct 2025): https://openid.net/new-whitepaper-tackles-ai-agent-identity-challenges/

---

**Next step:** discuss the destination (self-sovereign agent identity), then
pick the closest sub-decision to lift into a real D-numbered ratification.
The most likely v1 ratifications: ACP-over-WAC choice, person-modeling
position, and the agent-class registry (`/agents/*`).
