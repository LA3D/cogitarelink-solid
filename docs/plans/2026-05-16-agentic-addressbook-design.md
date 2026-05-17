# Agentic AddressBook Design — Working Document

**Status:** Working design notes, not a ratified decision. Captures a 2026-05-16
brainstorm refining Threads 1 and 2 of the companion document
`2026-05-16-identity-and-provenance-design.md`.

**Companion docs:**
- `2026-05-16-identity-and-provenance-design.md` (Threads 1–4: person identity,
  organization identity, agent auth + provenance, ACL framework)
- `2026-05-16-agent-composition-and-provenance.md` (agent decomposition)

**Related decisions:** D44 (storage description router), D52 (affordance
descriptors), D55 (three-tier access), D58/D71/D81 (dual-layer linking,
predicate-level governance), D72 (compile-once), D73 (two-stage commit), D75
(rendered HTML drops RDFa), D76 (URI layout), D77/D78 (SHACL shape catalog),
D81 (predicate-level governance Model A), D83 (Pod-as-toolkit capability
catalog), D84 (URI conformance, Pod-as-namespace-authority).

---

## 1. The conceptual frame

### 1.1 Two memory substrates, two consumers

Wiki-memory L3 has dual-layer linking (D58/D71) as its architectural
commitment: markdown body at the token layer (LLM next-token reasoning) +
`.meta` triples at the data layer (SPARQL queries). For concepts, this is
sufficient — concept operations are mostly relational (find what extends, find
what cites). The `.meta` projection covers everything.

For *people*, the data-layer operations are no longer just relational. They
include real-world deterministic actions: send email, ORCID lookup, scheduling,
WebID dereference, ROR org lookup. These need vcard-shaped structured data
with validation, canonical-form anchors, and SHACL guardrails. vcard has three
decades of refinement (RFC 6350, vcard-rdf) precisely for this kind of
operational identity work; the wiki-memory L3 person predicate set does not
match it.

The split therefore:

| Substrate | Consumer | Format | Audience |
|---|---|---|---|
| **Narrative memory** (`/wiki/people/`) | LLM reasoning | Markdown body + `.meta` projection (existing pattern, D58/D71) | Agent's reasoning loop |
| **Operational identity** (`/contacts/`) | Deterministic agent tools | Structured Turtle, SHACL-validated, vcard-shaped | Agent's tool-calling layer |

Bridged by `foaf:primaryTopic` (and reciprocal lookup). Each substrate
optimizes for its consumer. Neither replaces the other.

### 1.2 Why this matters for agentic design

A traditional Solid app would build one substrate and project across it. The
agentic framing splits the substrate because the agent's *consumers* are
fundamentally different:

- **LLM reasoning** wants prose, narrative, lateral wikilinks, sectioned
  context. Optimizing for this means tolerating ambiguity and free-form
  enrichment.
- **Tool calls** want canonical-form values, schema-validated fields, single
  source of truth. Optimizing for this means strict shapes and refusing
  malformed input.

A unified substrate forces a compromise on both axes. Two substrates with an
explicit bridge let each be sharp for its purpose.

---

## 2. Three-layer identity separation

Identity in a Solid Pod decomposes into separate concerns that have been
implicit and should be explicit:

| Layer | Concern | Resource | Consumer | Owned by |
|---|---|---|---|---|
| **Auth / space allocation** | Who owns this Pod or sub-space; ACL applies to whom | CSS account config + WAC/ACR documents | Solid-OIDC; WAC/ACP | Solid Pod server (CSS) |
| **WebID** | Self-asserted identity for authentication; carries identity claims | `/profile/card#me` — `foaf:name`, `org:hasMembership`, `owl:sameAs <orcid>` | Solid-OIDC clients, federated Pods | Pod owner |
| **AddressBook entry** | Application-layer record of the user as a contact in their own network | `/contacts/Person/<uuid>/index.ttl#this` (`owl:sameAs` to WebID) | Agents performing operations | AddressBook skill |
| **Wiki page** (optional) | Narrative-memory page about the user | `/wiki/people/<slug>.md` (`foaf:primaryTopic` to AddressBook entry) | LLM reasoning | Wiki skill |

The Pod owner may have up to four resources concerning her: a CSS account, a
WebID profile, an AddressBook entry, and a wiki page. They reconcile via
`owl:sameAs` and `foaf:primaryTopic`. They serve four different consumers.

This separation matters because WebID profile and AddressBook entry are easily
conflated (both are "the person's record on this Pod") but belong to different
layers. The WebID is the agent's *self-asserted* identity (consumed by
authentication). The AddressBook entry is the application's *third-party
record* of the same agent (consumed by tools). SolidOS contacts-pane sometimes
treats them as one for the logged-in user; this design does not.

### 2.1 Onboarding flow bridges the layers

One-time setup at Pod initialization:

```
solid-pod setup-owner --webid <iri> --orcid <iri> --name "..."
                      [--ror <iri>] [--email <addr>]

  1. PATCH /profile/card → enrich with foaf:name, owl:sameAs <orcid>,
                            org:hasMembership </contacts/Membership/<uuid>>
  2. Mint UUIDv4 for owner's AddressBook entry
  3. PUT /contacts/Person/<uuid>/index.ttl with:
        vcard:fn, vcard:hasEmail, owl:sameAs </profile/card#me>,
        owl:sameAs <orcid>
  4. PATCH /contacts/people.ttl to include the owner
  5. (Optional) Stub /wiki/people/<slug>.md with foaf:primaryTopic to AddressBook entry
  6. Register /contacts/ in publicTypeIndex for vcard:AddressBook (if not already)
```

Lives in `solid-agent-skills` CLI or as a setup script in this repo. Not part
of the AddressBook skill's day-to-day; prerequisite infrastructure.

---

## 3. Container layout

SolidOS-compatible structure, registered in the public Type Index for
`vcard:AddressBook`:

```
/contacts/
  index.ttl#this                                  # vcard:AddressBook
                                                  # carries vcard:nameEmailIndex,
                                                  #   vcard:groupIndex, acl:owner
  people.ttl                                      # flat name→URI index
  groups.ttl                                      # group→URI index

  Person/
    7f3a1b8c-9d2e-4c5a-8f1b-2e6d4a8c0f9e/
      index.ttl#this                              # vcard:Individual + foaf:Person
    c4e5d6f7-...
    b2a1c3d4-...

  Organization/
    a8b9c1d2-3e4f-5a6b-7c8d-9e0f1a2b3c4d/
      index.ttl#this                              # vcard:Organization + foaf:Organization
    f5e4d3c2-...

  Group/
    nd-collaborators.ttl#this                     # vcard:Group (mnemonic slug)
    ci-compass-team.ttl#this

  Membership/
    9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d/
      index.ttl#this                              # org:Membership (reified, time-scoped)
```

Each container registered in storage description (`/.well-known/solid`) so cold
agents can discover them.

### 3.1 URI conformance posture for AddressBook

Documented delta to the "mnemonic over opaque for everything" project
commitment from `solid-uri-conformance` skill:

> **Person and Organization entities** in `/contacts/` use opaque `UUIDv4`
> slugs, not mnemonic name slugs. Rationale: name collision risk (CJK names,
> common Western names, marriage/transition renames) substantively exceeds
> rename-risk for vault notes. Display name and external canonical identifiers
> (ORCID, email, WebID, ROR) live in card data via `vcard:fn` and `owl:sameAs`,
> not in URI slugs.
>
> **Group entities** use mnemonic slugs. Groups are author-controlled, low
> volume, and collision risk is low (you control naming).
>
> **Wiki pages** about people retain mnemonic name slugs at `/wiki/people/` for
> the wikilink affordance. The bridge predicate `foaf:primaryTopic` connects
> each wiki page to the corresponding opaque card.
>
> Hash-fragment-for-agent vs document-URL-for-card is inherited from the wider
> linked-data convention (TBL Cool URIs, Sauermann/Cyganiak 2008,
> httpRange-14). SolidOS contacts-pane convention preserved (uses `#this` for
> the agent, document URL for the card).

### 3.2 Slug algorithm

```
Person, Organization, Membership:  UUIDv4 (random)
Group:                              kebab-case mnemonic
```

No collision possible at the URI layer for Person/Organization/Membership.
Display name (`vcard:fn`) and external anchors (`owl:sameAs <orcid>`,
`vcard:hasEmail`) carry the meaningful identity.

### 3.3 Cross-pod identity reconciliation

Each Pod mints its own UUIDs (different cards are different information
objects). Reconciliation is via the `owl:sameAs` network, with ORCID as the
canonical anchor where available:

```turtle
# Pod A's card about Chuck
</contacts/Person/7f3a.../index.ttl#this>
    owl:sameAs <https://orcid.org/0000-0003-4091-6059> ,
               <https://pod.vardeman.me/profile/card#me> ,
               <https://chuck.solidcommunity.net/profile/card#me> .

# Pod B's card about Chuck (different UUID)
</contacts/Person/9c8d.../index.ttl#this>
    owl:sameAs <https://orcid.org/0000-0003-4091-6059> ,
               <https://chuck.solidcommunity.net/profile/card#me> .
```

ORCID functions as the canonical join key. SPARQL across pods chains through
it. No central authority required.

---

## 4. The substrate-pattern: template + SHACL + readable feedback

Three substrate artifacts work as a pipeline, each reducing the cost of the
next:

```
Agent intent: "create contact for Wang Wei"
     │
     ▼
1. Fetch /meta/templates/contact-create.ttl    ← front-loaded structured context
   Required fields, optional fields, value patterns
   Per-field guidance via sh:agentInstruction
   → Agent gets the shape upfront, fills correctly first try
     │
     ▼
2. PUT /contacts/Person/<uuid>/index.ttl       ← single round-trip on happy path
     │
     ▼
3a. SHACL passes → 201 Created. Done.
3b. SHACL fails  → 422 with sh:ValidationReport ← agent-readable backstop
                   { sh:focusNode, sh:resultPath,
                     sh:resultMessage, sh:value }
                   → Agent reads, corrects, retries
```

Templates eliminate most SHACL hits by giving the agent the right shape
upfront. SHACL catches the residual (typos, novel inputs, edge cases). The
validation report flows back as a readable Turtle/JSON-LD document so the agent
can self-correct.

**Trajectory token cost**: template fetch (~200 tokens) + happy-path PUT
(~50 tokens), vs error-loop trajectory of 1000s of tokens across multiple
retries when only SHACL is present.

### 4.1 The minimum-metadata invariant

`ContactCardShape` enforces the operational floor — what every card needs to
be useful for any deterministic agent operation:

```turtle
# /meta/shapes/contact-card.ttl
:ContactCardShape a sh:NodeShape ;
    sh:targetClass vcard:Individual ;

    sh:property [
        sh:path vcard:fn ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Contact must have exactly one vcard:fn (display name)." ;
    ] ;

    sh:property [
        sh:path vcard:inAddressBook ;
        sh:minCount 1 ;
        sh:hasValue </contacts/index.ttl#this> ;
        sh:message "Contact must declare vcard:inAddressBook </contacts/index.ttl#this>." ;
    ] ;

    sh:or (
        [ sh:property [ sh:path owl:sameAs ;       sh:minCount 1 ; sh:nodeKind sh:IRI ] ]
        [ sh:property [ sh:path vcard:hasEmail ;   sh:minCount 1 ] ]
        [ sh:property [ sh:path vcard:hasTelephone ; sh:minCount 1 ] ]
    ) ;
    sh:message """
      Contact must have at least one external anchor: owl:sameAs (ORCID,
      WebID, wikidata), vcard:hasEmail, or vcard:hasTelephone. Without an
      anchor, no deterministic agent operation can act on this contact.
    """ .
```

That is the floor: `vcard:fn` + `vcard:inAddressBook` + at least one anchor. A
bare-name card is rejected because no consumer can act on it.

**Implication for working memory**: "names of people you've heard of but have
no anchor for yet" do not belong in the AddressBook. They belong in working
memory (D73). Promotion from working memory to AddressBook requires finding at
least one anchor. This is a feature — the AddressBook is operationally
trustworthy because every entry meets the floor.

### 4.2 The template paired with the shape

```turtle
# /meta/templates/contact-create.ttl
@prefix tmpl: <https://pod.vardeman.me/vault/ontology/template#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .

</meta/templates/contact-create>
    a tmpl:Template ;
    tmpl:validatesAgainst </meta/shapes/contact-card.ttl#ContactCardShape> ;
    tmpl:operation       "PUT" ;
    tmpl:targetContainer </contacts/Person/> ;
    tmpl:slugAlgorithm   "uuid4" ;

    sh:agentInstruction """
      To create a Person contact:
        1. Generate UUIDv4 for slug
        2. PUT /contacts/Person/<uuid>/index.ttl with the body below
        3. On 201: PATCH /contacts/people.ttl to add the name→URI index entry
        4. On 422: read the SHACL report, fix the cited fields, retry

      Minimum to satisfy SHACL: vcard:fn + vcard:inAddressBook + one anchor.
      Prefer owl:sameAs <orcid> when known — ORCID is the canonical cross-pod
      anchor. Fall back to vcard:hasEmail when ORCID isn't available.
    """ ;

    tmpl:templateBody """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix org:   <http://www.w3.org/ns/org#> .
@prefix dct:   <http://purl.org/dc/terms/> .

# Card document (information object)
<>  a vcard:VCard, foaf:PersonalProfileDocument ;
    foaf:primaryTopic <#this> ;
    dct:creator </profile/card#me> ;
    dct:created  \"<<ISO_DATETIME>>\"^^xsd:dateTime .

# The agent (what the card is about)
<#this>
    a vcard:Individual, foaf:Person ;
    vcard:fn               \"<<FULL_NAME>>\" ;                # REQUIRED
    vcard:inAddressBook    </contacts/index.ttl#this> ;       # REQUIRED

    # AT LEAST ONE of the following — required for operational utility
    owl:sameAs             <https://orcid.org/<<ORCID>>> ;    # preferred
    vcard:hasEmail         <mailto:<<EMAIL>>> ;               # or this
    # vcard:hasTelephone   <tel:<<PHONE>>> ;                  # or this

    # OPTIONAL — add when known
    # vcard:role           \"<<ROLE>>\" ;
    # org:hasMembership    </contacts/Membership/<<MEMBERSHIP_UUID>>/index.ttl#this> ;
    # owl:sameAs           <https://<<HOST>>/profile/card#me> .
""" .
```

### 4.3 Templates are a generalization beyond AddressBook

Template + SHACL + readable feedback is the **agentic-application substrate
pattern**. Any container with a primary write operation deserves the triple.
Wiki-memory L3 could pick it up (template for `wiki:Page`, `wiki:Source`).
Capability catalog could pick it up. This argues for promoting `tmpl:Template`
to first-class substrate vocabulary alongside `wiki:` and `cap:`. D87
candidate territory; defer ratification until we ship one and see eval
results.

### 4.4 SHACL feedback requirement on CSS

For 4.x to work end-to-end, **SHACL validation reports must flow back as
agent-readable response bodies**. Default CSS may return 4xx with text/plain;
this design requires `application/ld+json` or `text/turtle` containing the
`sh:ValidationReport`.

Worth verifying on the actual deployment. If CSS doesn't, this is the smallest
possible extension — a write handler wrapper that runs SHACL pre-write and
returns 422 + Turtle report on failure. Probably already exists (shape-validator
extension); confirm. If not, build once, applies to every shape.

---

## 5. Substrate artifacts

| Artifact | Path | Purpose |
|---|---|---|
| AddressBook root | `/contacts/index.ttl` | vcard:AddressBook with indexes + owner |
| Name→URI index | `/contacts/people.ttl` | Flat lookup by name, email |
| Group→URI index | `/contacts/groups.ttl` | Group enumeration |
| Person container | `/contacts/Person/` | UUIDv4-slugged cards |
| Organization container | `/contacts/Organization/` | UUIDv4-slugged org cards |
| Group container | `/contacts/Group/` | Mnemonic-slugged group files |
| Membership container | `/contacts/Membership/` | Reified time-scoped memberships |
| SHACL shapes | `/meta/shapes/contact-*.ttl` | Validation guardrails |
| Templates | `/meta/templates/contact-*.ttl` | Front-loaded write context |
| Affordances (read) | `/meta/affordances/contact-find-*.ttl` | Declarative SPARQL for read patterns |
| TypeIndex registration | `/settings/publicTypeIndex` | `solid:forClass vcard:AddressBook` |
| Storage description | `/.well-known/solid` | Advertises `wiki:contactCatalog`, `wiki:templateCatalog` |

### 5.1 SHACL shapes (full catalog)

- `ContactCardShape` (vcard:Individual; the floor invariant from §4.1)
- `OrganizationCardShape` (vcard:Organization; analogous, anchor is
  `owl:sameAs <ror>` preferred)
- `GroupShape` (vcard:Group; minimum: `vcard:fn` + at least one
  `vcard:hasMember`)
- `MembershipShape` (org:Membership; minimum: `org:member` + `org:organization`
  + `org:memberDuring`)

All `sh:closed false` (extensible per D81's predicate-level governance Model A).
Each carries `sh:agentInstruction` per D50.

### 5.2 Affordance descriptors (read patterns)

| Affordance | SPARQL pattern |
|---|---|
| `contact-find-by-name` | `?p vcard:fn ?fn . FILTER(CONTAINS(LCASE(?fn), $name))` against `/contacts/people.ttl` |
| `contact-find-by-orcid` | `?p owl:sameAs <$orcid>` against `/contacts/` cards |
| `contact-find-by-email` | `?p vcard:hasEmail <mailto:$email>` |
| `contact-find-by-affiliation` | `?p org:hasMembership/org:organization $org` |
| `contact-find-by-group` | `?g vcard:hasMember ?p . FILTER(?g = $group)` |
| `org-find-by-name` | analogous over Organization cards |
| `org-find-by-ror` | `?o owl:sameAs <$ror>` |
| `bridge-card-to-wiki` | inverse `foaf:primaryTopic` lookup over `/wiki/.meta` |

Each carries embedded SPARQL via `wiki:selectQuery` (per D52), executed by the
agent via `solid-pod invoke`.

### 5.3 Templates (write patterns)

- `contact-create.ttl` (§4.2)
- `contact-update.ttl` — N3 Patch shell for adding triples to an existing card
- `org-create.ttl` — analogous to contact-create, vcard:Organization variant
- `group-create.ttl` — minimal vcard:Group
- `membership-create.ttl` — reified org:Membership with time scope

Each `tmpl:validatesAgainst` its corresponding SHACL shape.

---

## 6. Access patterns

The agent's actual tool palette is the existing `solid-agent-skills` CLI. No
custom AddressBook-specific CLI commands. The skill teaches the agent which
generic Pod operation backs each access pattern.

### 6.1 Read patterns (skill teaches; affordance descriptors execute)

| Pattern | Pod operation |
|---|---|
| Find Person by name | `solid-pod invoke /vault/meta/affordances/contact-find-by-name.ttl --name "..."` |
| Find Person by ORCID | `solid-pod invoke /vault/meta/affordances/contact-find-by-orcid.ttl --orcid "..."` |
| Find Person by email | `solid-pod invoke ... contact-find-by-email --email "..."` |
| Find Person by affiliation | `solid-pod invoke ... contact-find-by-affiliation --org "..."` |
| Find Person by group | `solid-pod invoke ... contact-find-by-group --group "..."` |
| List all Persons | `solid-pod read /contacts/people.ttl` |
| Get Person card | `solid-pod read /contacts/Person/<uuid>/index.ttl` |
| Find Organization by name | `solid-pod invoke ... org-find-by-name --name "..."` |
| Find Organization by ROR | `solid-pod invoke ... org-find-by-ror --ror "..."` |
| Resolve bridge (card to wiki) | `solid-pod invoke ... bridge-card-to-wiki --card "..."` |

### 6.2 Write patterns (skill teaches; templates inform; SHACL validates)

| Pattern | Pod operation | Skill teaches |
|---|---|---|
| Create Person | `solid-pod create` + `solid-pod patch` | Fetch contact-create template, generate UUIDv4, PUT card, PATCH people.ttl |
| Update Person (add claim) | `solid-pod patch` | N3 Patch — add `owl:sameAs <orcid>`, `vcard:hasEmail`, role, membership |
| Create Organization | `solid-pod create` + `solid-pod patch` | Fetch org-create template, mint UUIDv4, PUT, PATCH groups.ttl if grouped |
| Create Membership | `solid-pod create` | PUT reified `org:Membership` with `org:member`, `org:organization`, `org:memberDuring` |
| Add to Group | `solid-pod patch` | N3 Patch to `/contacts/Group/<slug>.ttl` adding `vcard:hasMember <card-uri>` |
| Link card to wiki page | `solid-pod patch` | (Wiki skill's job — adds `foaf:primaryTopic` in wiki frontmatter) |

---

## 7. Skill composition

Two skills, distinct schemas, explicit bridge:

```
.claude/skills/
├── solid-wiki-memory-l3/         (existing — refined to name the bridge)
│   └── SKILL.md
│     • /wiki/people/<slug>.md is a wiki:Person page (prose + frontmatter)
│     • MUST carry foaf:primaryTopic to a /contacts/Person/<uuid> card
│     • If no card exists yet: invoke addressbook skill's contact-create FIRST,
│       then create the wiki page with the resulting UUID in frontmatter
│     • Wikilink resolution: [[jarek-nabrzyski]] → /wiki/people/jarek-nabrzyski.md
│
└── solid-addressbook/             (new)
    └── SKILL.md
      • /contacts/ is a vcard:AddressBook (SolidOS-compatible layout)
      • Schema: vcard:Individual + foaf:Person, UUIDv4 slug, hash #this
      • Read patterns: contact-find-by-{name,orcid,email,affiliation,group}
      • Write patterns: contact-create, contact-update, org-create, membership-create
      • Always include vcard:fn; owl:sameAs <orcid> when available
      • Cross-pod identity: owl:sameAs network, ORCID is canonical anchor
      • Bridge to wiki page is the wiki skill's concern — name it but don't traverse
        unless explicitly needed for tool input
```

Each skill names the bridge predicate (`foaf:primaryTopic`) so the agent knows
the relationship exists. Each instructs the agent to invoke the *other*
skill's tools when crossing the boundary.

**Boundary contract** (working position; refined by eval):

- Wiki skill owns: wiki page creation, prose content, frontmatter wikilinks,
  `foaf:primaryTopic` declaration in wiki frontmatter
- AddressBook skill owns: card creation, vcard schema, UUID generation,
  external anchor management, SHACL validation handling, name/orcid/email
  lookups
- Both reference the bridge predicate but neither auto-projects
- Agent reasons about which surface to write to based on whether the change is
  an *operational claim* (→ card) or a *narrative note* (→ wiki)

**This boundary is a v1 working position, not a final commitment.** The eval
methodology (§9) is designed to surface whether agents can navigate the
boundary or whether a third coordinator skill is warranted.

---

## 8. Two-stage commit boundary

D73 (two-stage commit) gives the substrate a place for low-ceremony writes
that haven't earned promotion to durable storage. For the AddressBook, this
means:

- **Working memory** (`/wiki/working/`) holds "names of people you've heard of"
  before they have anchors. A reading-pass agent might note "the author was
  someone named Wang Wei" without yet finding her ORCID.
- **Promotion to AddressBook** requires meeting the SHACL minimum:
  `vcard:fn` + `vcard:inAddressBook` + at least one anchor.
- Promotion is an explicit operation (`mem:Crystallize`) the agent performs
  once enrichment has produced an anchor.

This makes the AddressBook's operational-trustworthiness property hold by
construction. Every card in `/contacts/` has at least one actionable handle.

---

## 9. Eval methodology

**Methodology**: skill-creator harness with Claude Code as consumer, with-skill
vs without-skill against the live Pod (per `solid-agent-skills` CLAUDE.md).

**Tier-1 operations to evaluate** (Rung 1.5):

1. Cold-start arrival → discover AddressBook via TypeIndex + affordance catalog
2. Create new Person contact (with ORCID + email known)
3. Create new Person contact (with only name + email known)
4. Find Person by name → disambiguate three Wang Weis correctly via affiliation
5. Find Person by ORCID → reconcile cross-pod identity
6. Update existing Person to add ORCID anchor
7. Bridge traversal: given a wiki page, find the card; given a card, find the
   wiki page
8. Send email to a Person (consume `vcard:hasEmail`) — measures end-to-end
   composition with another tool

**Eval outputs**:

- Without-skill: brute-force discovery via spec; measure success rate, retries,
  token cost per operation
- With-skill: same operations; measure lift
- Compare: where does the skill help most? Where is the substrate already
  agent-discoverable enough that the skill is over-engineering?

**Bridge-mechanism comparison** (deferred sub-eval): once basic operations
work, eval two candidate bridge patterns against each other:

- Candidate A: bridge declared only via `foaf:primaryTopic` in wiki frontmatter
- Candidate B: bridge declared in both directions (frontmatter on wiki side,
  triple in card `.meta` on AddressBook side)

Measure which is more discoverable to the agent and which has lower
maintenance cost.

---

## 10. Open questions

### 10.1 Skill-boundary precise contract

The §7 boundary contract is a working position. Open until eval results:

- Should there be a third coordinator skill (`people-identity` or similar)
  that names the bridge and tells the agent which skill to load when?
- Should the bridge predicate (`foaf:primaryTopic`) be a `tmpl:Template`-style
  generalized substrate-level concern, or stay specific to wiki↔addressbook?
- If institutional/lab-Pod scenarios (Thread 2 in companion doc) become real,
  AddressBook is reusable without wiki. Does the current contract accommodate?

### 10.2 Write-affordance descriptors vs templates-only

Templates carry write-pattern context. Should there also be
`/meta/affordances/contact-create.ttl` (affordance-style declarative writes)?
Argument for: discoverable to a cold agent that doesn't know to look in
`/meta/templates/`. Argument against: feels less natural than HTTP+SHACL+
templates; introduces a fourth artifact type.

### 10.3 `tmpl:` vocabulary ratification

`tmpl:Template`, `tmpl:validatesAgainst`, `tmpl:templateBody`,
`tmpl:slugAlgorithm`, `tmpl:operation`, `tmpl:targetContainer` — these need a
real namespace and shape definitions. Candidate D87. Wait until we ship one
template-driven write path and see the eval before ratification.

### 10.4 SHACL violation report on CSS

Verify that the deployed CSS returns SHACL violation reports as
agent-readable response bodies (Turtle or JSON-LD). If not, build a small
write-handler wrapper. Should be checked before §4 work begins, since the
template-feedback loop depends on it.

### 10.5 ProvenanceCommitListener integration

From the companion doc Thread 3: `ProvenanceCommitListener` stamps
`prov:wasAttributedTo` on every commit. AddressBook writes should be
provenance-stamped from day one. Confirm ordering vs Memento snapshot listener.

### 10.6 ACP migration before ACL turn-on

From the companion doc Thread 4: switch from WAC to ACP before any ACL
policies land. AddressBook ACL design (who can read which cards, who can
add new contacts) depends on ACP matchers. Resolve at companion-doc level.

---

## 11. Related questions surfaced (not in scope for this doc)

These came up during the brainstorm and deserve their own treatment later:

### 11.1 Wiki URI scheme rethink

The AddressBook adopts opaque UUIDv4 slugs for Person and Organization,
documented as a class-by-class exception to "mnemonic over opaque for
everything." The exercise raised whether other entity classes in
wiki-memory L3 deserve similar per-class scrutiny.

**Reference material to ground the rethink:**

- Aaron Swartz, *A Programmable Web: An Unfinished Work* (Synthesis Lectures
  on the Semantic Web, 2013, ed. Hendler) — pragmatic-web URI design
  positions, particularly on hash-vs-slash and the trade-off between human
  legibility and identifier stability. Re-fetch and ground before the rethink.
- TBL, *Cool URIs Don't Change* (1998), and Sauermann/Cyganiak, *Cool URIs
  for the Semantic Web* (2008) — the canonical position on stable opaque
  identifiers.
- The httpRange-14 / TAG-issue-14 discussion — the document-vs-resource split
  the AddressBook design adopts via `#this` hash fragments. Worth being
  explicit about for all entity classes.

**What a wiki URI rethink would consider**: which entity classes have rename
risk or collision risk substantively higher than the current vault notes
assumption, and whether opaque slugs are warranted there.

### 11.2 URI design principles reference document

Worth synthesizing the project's deltas (URI conformance skill), Swartz's
positions, and the Cool URIs guidance into a single project-level guide for
future URI-minting decisions. Companion to `solid-uri-conformance` skill,
operating at one level higher.

---

## 12. References

**Standards and specs:**
- W3C WebID 1.0: https://www.w3.org/2005/Incubator/webid/spec/identity/
- Solid WebID Profile (editor's draft): https://solid.github.io/webid-profile/
- Solid-OIDC: https://solidproject.org/TR/oidc
- W3C VCARD-RDF: https://www.w3.org/TR/vcard-rdf/
- RFC 6350 (vCard 4.0): https://www.rfc-editor.org/rfc/rfc6350
- W3C ORG Ontology: https://www.w3.org/TR/vocab-org/
- W3C SHACL: https://www.w3.org/TR/shacl/
- W3C PROF (Profiles Vocabulary): https://www.w3.org/TR/dx-prof/
- Solid Notifications Protocol: https://solidproject.org/TR/notifications-protocol

**Linked-data principles:**
- TBL, *Cool URIs Don't Change* (1998): https://www.w3.org/Provider/Style/URI
- Sauermann & Cyganiak, *Cool URIs for the Semantic Web* (2008):
  https://www.w3.org/TR/cooluris/
- TAG httpRange-14: https://www.w3.org/2001/tag/issues.html#httpRange-14
- Aaron Swartz, *A Programmable Web: An Unfinished Work* (2013, ed. Hendler) —
  Synthesis Lectures on the Semantic Web

**Implementations:**
- SolidOS contacts-pane: https://github.com/SolidOS/contacts-pane
- Inrupt @inrupt/solid-client: https://docs.inrupt.com/developer-tools/javascript/client-libraries/
- CSS Components.js: https://github.com/CommunitySolidServer/CommunitySolidServer

**Project artifacts:**
- Companion: `docs/plans/2026-05-16-identity-and-provenance-design.md`
- Companion: `docs/plans/2026-05-16-agent-composition-and-provenance.md`
- URI conformance skill: `.claude/skills/solid-uri-conformance/`
- Wiki-memory L3 skill: `.claude/skills/solid-wiki-memory-l3/`
- Identity-stack skill: `.claude/skills/solid-identity-stack/`
- Decision index: `.claude/skills/decision-lookup/decisions.md`

---

## 13. Next step

Once this design is approved, the implementation plan covers:

1. Build out `/meta/shapes/contact-*.ttl` (4 shapes)
2. Build out `/meta/templates/contact-*.ttl` (5 templates)
3. Build out `/meta/affordances/contact-*.ttl` (8+ read affordances)
4. Verify CSS SHACL feedback path; build wrapper extension if needed
5. Write `solid-pod setup-owner` flow (`solid-agent-skills` CLI)
6. Initial AddressBook bootstrap (PUT `/contacts/index.ttl`, register in TypeIndex)
7. Draft `solid-addressbook` SKILL.md and `solid-wiki-memory-l3` SKILL.md refinements
8. Run Rung 1.5 eval (§9) using skill-creator harness

Hand off to `writing-plans` skill after approval.
