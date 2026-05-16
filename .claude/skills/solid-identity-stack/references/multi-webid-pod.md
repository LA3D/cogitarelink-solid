# Multiple WebIDs per Pod

## Specs and references

- **Solid WebID Profile** (editor's draft) — explicitly endorses multiple WebIDs per profile document
  https://solid.github.io/webid-profile/
- **CSS Account JSON API** — the many-to-many account/WebID/Pod surface
  https://communitysolidserver.github.io/CommunitySolidServer/latest/usage/account/json-api/
- **CSS Identity Provider documentation**
  https://communitysolidserver.github.io/CommunitySolidServer/latest/usage/identity-provider/
- **Forum: subdomain vs subpath identifier modes**
  https://forum.solidproject.org/t/webid-in-sub-folder-instead-of-sub-domain-pod-server-settings/2532
- **Forum: relationship between Pods and WebIDs**
  https://forum.solidproject.org/t/relationship-between-pods-and-webids/5872
- **Inrupt Pod Spaces upgrade** — separates identity host from storage host
  https://www.inrupt.com/blog/pod-spaces-upgrade

## What it is

A Pod is just LDP storage. A WebID is just an HTTP IRI that dereferences
to a profile document. Nothing in the spec stack requires a 1:1 mapping
between Pods and WebIDs. CSS exposes the **account / WebID / Pod
relationships as many-to-many** via its account JSON API.

Practical consequences:

- One account can own many Pods
- One account can link many WebIDs
- One Pod can host many WebID profile documents

This enables several deployment shapes worth understanding.

## Shape 1 — Subdomain isolation (solidcommunity.net pattern)

CSS in **subdomain mode** (`util/identifiers/subdomain.json` import). Each
registered user gets their own Pod at `https://alice.solidcommunity.net/`
with WebID at `…/profile/card#me`. One IDP issues tokens for all users
(single OP). Registration auto-mints a WebID inside each new Pod.

**solidcommunity.net's "~50 users" is 50 isolated Pods.** Not one shared
Pod with 50 WebIDs. Each user has full control of their root.

## Shape 2 — Subpath isolation

Same idea, different identifier strategy: Pods at `https://example.com/alice/`,
`https://example.com/bob/`. Default CSS mode. CORS and agent-autonomy
arguments slightly favor subdomain mode for public deployments; subpath
is fine for single-org deployments.

## Shape 3 — Shared Pod, multiple WebIDs (the interesting case for orgs)

A single Pod hosting multiple WebID profile documents:

```
/org#it           — the lab's organization WebID (foaf:Organization)
/people/alice#me  — Alice's personal WebID
/people/bob#me    — Bob's personal WebID
/people/carol#me  — Carol's personal WebID
/agents/...       — AI agent client_ids
```

Each profile dereferences as a normal WebID. Each can declare its own
`solid:oidcIssuer`. ACL is per-resource so members control their subtrees.
This is the **lab Pod** or **org Pod** or **family Pod** pattern.

**The ACL caveat:** pod-root ACL is single-owner. There's no "co-equal
admins" primitive. The natural pattern: **the org WebID owns the pod**,
with per-member subtree control delegated via `acl:Control` (WAC) or
equivalent ACP policies.

No canonical deployed reference for this pattern was findable in public
research. It's in spec and tooling but not yet common practice. **Green
field for design.**

## Key snippets

A profile document with both a person WebID and an org WebID:

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<#me>
    a foaf:Person ;
    foaf:name "Charles Vardeman" ;
    solid:oidcIssuer <https://pod.vardeman.me/> .

<#it>
    a foaf:Organization, as:Organization ;
    foaf:name "Lab name" ;
    solid:oidcIssuer <https://pod.vardeman.me/> .
```

Account API: linking multiple WebIDs to one account:

```http
POST /idp/account/webid HTTP/1.1
Content-Type: application/json

{ "webId": "https://pod.example/people/alice#me" }
```

The CSS docs describe `controls.account.webId` (GET/POST/DELETE) and
`controls.account.pod` (GET/POST) — both surfaces are many-to-many.

## ActivityPods cross-pollination

ActivityPods extends the multi-WebID pattern by adding ActivityStreams 2
(AS2) actor types to the profile, enabling fediverse-style interaction:

```turtle
<#me>
    a foaf:Person, as:Person ;
    as:inbox <https://pod.example/me/inbox> ;
    as:outbox <https://pod.example/me/outbox> ;
    solid:oidcIssuer <https://idp.example/> .
```

The same pattern extends to `as:Organization`, `as:Service`, `as:Application`
— so an org WebID could be both a Solid identity and a fediverse actor.
Round 4 territory; flagged for future consideration.

## What you'll get wrong if you don't read the docs

- **Subdomain vs subpath is a CSS config switch.** `util/identifiers/subdomain.json`
  vs the default subpath import. Flip it and everything below changes.
  Migrating an existing Pod between modes is non-trivial.
- **Pod root ACL is single-owner.** The shared-Pod-multiple-WebIDs pattern
  needs an "owner agent" (often the org WebID) that delegates per-subtree
  control. There's no "two admins co-own this Pod" primitive.
- **WebIDs and Pods are decoupled by spec.** A user can have a WebID at
  one host and a Pod at another — Inrupt's Pod Spaces explicitly splits
  `id.inrupt.com/alice` (WebID) from `storage.inrupt.com/alice/` (Pod).
  Solid-OIDC discovers the issuer from the WebID; the Pod URL is just
  another resource pointer in the profile.
- **Auto-minted WebIDs are minimal.** CSS-default WebID profiles carry
  basic OIDC config and storage pointer; nothing more. Enrichment
  (foaf:name, org:hasMembership, owl:sameAs) is on the Pod owner.

## How this Pod uses it

- **Currently single-user.** One WebID at `/profile/card#me`. CSS in
  default subpath mode.
- **Working position (design doc):** anticipate the lab-Pod / org-Pod
  future even in single-user deployment. Predicate-level governance
  (D81) and ACP-over-WAC choice keep the door open.
- **No org WebID minted.** Could be added later (e.g., a CI-Compass lab
  WebID at `/org#it`) if the Pod evolves into shared infrastructure.
- **No `/agents/` WebIDs minted yet.** Design doc proposes them as the
  next step before ACL turn-on. See [agent-identity.md](agent-identity.md).

## Cross-references

- [webid.md](webid.md) — what each WebID profile is
- [agent-identity.md](agent-identity.md) — agent WebIDs as a third class
  alongside person and org
- [acp.md](acp.md) — per-member ACR templates for shared-Pod patterns
- Project design doc Thread 2 — organization identity and the shared-Pod future
