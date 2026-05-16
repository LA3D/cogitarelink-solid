# ACP — Access Control Policy

## Specs

- **ACP Specification** (Solid CG Authorization Panel)
  https://solid.github.io/authorization-panel/acp-specification/
  Status: Editor's draft, active. The preferred access-control framework
  for Solid going forward.
- Solid Protocol references both WAC and ACP; servers MAY implement either
  or both.

## What it is

ACP replaces WAC's single-resource `.acl` model with a richer **Policy /
AccessControl / Matcher** decomposition stored in **`.acr`** (Access
Control Resource) files:

- **Policies** declare what modes are allowed when their conditions are met
- **AccessControls** apply policies to resources
- **Matchers** describe the conditions — match an agent, a client, a VC,
  an issuer, or any combination

Matchers are first-class composable objects. They support **conjunctive
evaluation** within a single matcher (all fields must match) and
**disjunctive evaluation** across multiple matchers on a single
AccessControl (any match suffices), giving expressive policies that WAC
cannot represent.

## Matcher types

| Matcher field | Matches | WAC equivalent |
|---|---|---|
| `acp:agent` | A user WebID | `acl:agent` |
| `acp:client` | A `client_id` URL (the app) | none (only `acl:origin`) |
| `acp:issuer` | The OIDC token issuer | none |
| `acp:vc` | A type of Verifiable Credential | none |
| `acp:PublicAgent` (built-in) | Anyone, including unauthenticated | `acl:agentClass foaf:Agent` |
| `acp:AuthenticatedAgent` (built-in) | Anyone authenticated | `acl:agentClass acl:AuthenticatedAgent` |
| `acp:CreatorAgent` (built-in) | The agent that created the resource | none |

## Key snippets

Owner-only ACR:

```turtle
@prefix acp: <http://www.w3.org/ns/solid/acp#> .
@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner-policy>
    a acp:Policy ;
    acp:allow acl:Read, acl:Write, acl:Control ;
    acp:allOf <#owner-matcher> .

<#owner-matcher>
    a acp:Matcher ;
    acp:agent <https://pod.example/profile/card#me> .

<#access-control>
    a acp:AccessControl ;
    acp:apply <#owner-policy> .

<>
    a acp:AccessControlResource ;
    acp:resource <./> ;
    acp:accessControl <#access-control> .
```

"Owner via Claude Code only" (the agentic policy WAC can't express):

```turtle
<#owner-via-claude-code-matcher>
    a acp:Matcher ;
    acp:agent  <https://pod.example/profile/card#me> ;       # the user
    acp:client <https://pod.example/agents/claude-code> .    # the app
# Within one Matcher, all named fields must match (conjunctive).

<#owner-via-claude-code-policy>
    a acp:Policy ;
    acp:allow acl:Read, acl:Write ;
    acp:allOf <#owner-via-claude-code-matcher> .
```

VC-gated access:

```turtle
<#vc-matcher>
    a acp:Matcher ;
    acp:vc <http://www.w3.org/ns/solid/vc#SolidAccessGrant> .

<#vc-policy>
    a acp:Policy ;
    acp:allow acl:Read ;
    acp:allOf <#vc-matcher> .
```

Quoting the ACP spec on `acp:vc`:
*"In a Matcher, vc attributes define a set of types of Verifiable
Credentials (VC), at least one of which MUST match the Context for the
Matcher to be satisfied."*

## What you'll get wrong if you don't read the spec

- **`acp:allOf` vs `acp:anyOf`.** A Policy with `acp:allOf` requires every
  listed matcher to be satisfied (logical AND across matchers); `acp:anyOf`
  requires any one (logical OR). Within a *single matcher*, all named fields
  are AND'd.
- **`acp:deny` exists.** ACP supports negative policies (unlike WAC's
  additive-only model). Denies override allows. Use sparingly.
- **ACR files are `.acr`, not `.acl`.** Server enforces whichever framework
  is configured; mixing them does not work.
- **`acp:CreatorAgent` matches the agent that created the resource,** which
  is useful for "users can edit their own writes" but requires the server
  to track creator (`prov:wasAttributedTo` or equivalent metadata).
- **`acp:client` matches the OIDC `azp` claim** — the client_id URL. For
  this to be useful, you need client_id documents minted (see
  [agent-identity.md](agent-identity.md)).
- **Default policies on containers cascade via `acp:apply` on a child ACR
  with `acp:memberAccessControl`.** Inheritance is more explicit than WAC's
  `acl:default` — read the spec for the cascade rules.

## Why ACP for this Pod

The design doc's working position is **ACP over WAC** because:

1. AI agents have no browser origin; ACP's `acp:client` is the only way
   to express "permit Claude Code, but not arbitrary apps."
2. VC integration (Rung 1.3+) requires `acp:vc` — WAC has no equivalent.
3. Conjunctive matching (user AND app, optionally AND VC) is native in
   ACP, contorted in WAC.
4. Switch cost is lowest before any policy is written. Migrating WAC
   policies later is expensive.

## How this Pod uses it

- **Not yet active.** Current CSS config is WAC default. Migration
  proposed in the design doc as the first step before ACL turn-on.
- **CSS config:** swapping WAC → ACP is changing the auth module import in
  `css/config/solid-config.json`. CSS ships both; they're mutually
  exclusive imports. See `solid-servers` skill.
- **First policy to write (open question):** minimal owner-only,
  capability-aware (per registered agent), or multi-member-anticipating
  (lab Pod future).

## Cross-references

- [wac.md](wac.md) — the legacy framework being superseded
- [vc.md](vc.md) — how Verifiable Credentials integrate via `acp:vc`
- [agent-identity.md](agent-identity.md) — `acp:client` and Pod-local agent registry
- [solid-oidc.md](solid-oidc.md) — `webid` and `azp` claims feed `acp:agent` and `acp:client`
