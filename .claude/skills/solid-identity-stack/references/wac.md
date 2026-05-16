# WAC — Web Access Control

## Specs

- **Web Access Control** (Solid CG, editor's draft)
  https://solid.github.io/web-access-control-spec/
  Status: Editor's draft, the historical default in Solid. Being superseded by
  ACP for new work.

## What it is

WAC is an RDF-based access-control model where each resource MAY have a
companion **`.acl`** resource declaring `acl:Authorization` triples.
Each authorization names:

- **An agent** (`acl:agent`, `acl:agentClass`, `acl:agentGroup`)
- **A resource scope** (`acl:accessTo`, `acl:default`)
- **A set of modes** (`acl:mode`) — `Read`, `Write`, `Append`, `Control`
- Optionally an origin (`acl:origin`) for browser-based clients

Authorizations are **additive** — any matching authorization grants its
modes; there's no deny rule. ACLs inherit via `acl:default` on a
container (the container's default ACL applies to its children unless they
have their own).

## Key snippets

Minimal "owner only" `.acl`:

```turtle
@prefix acl: <http://www.w3.org/ns/auth/acl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<#owner>
    a acl:Authorization ;
    acl:agent <https://pod.example/profile/card#me> ;
    acl:accessTo <./> ;
    acl:default <./> ;
    acl:mode acl:Read, acl:Write, acl:Control .
```

Public read with owner control:

```turtle
<#public>
    a acl:Authorization ;
    acl:agentClass foaf:Agent ;       # everyone, including unauthenticated
    acl:accessTo <./> ;
    acl:default <./> ;
    acl:mode acl:Read .

<#owner>
    a acl:Authorization ;
    acl:agent <https://pod.example/profile/card#me> ;
    acl:accessTo <./> ;
    acl:default <./> ;
    acl:mode acl:Read, acl:Write, acl:Control .
```

Restrict by browser origin:

```turtle
<#trusted-app>
    a acl:Authorization ;
    acl:agent <https://pod.example/profile/card#me> ;
    acl:origin <https://trusted-app.example> ;
    acl:accessTo <./> ;
    acl:mode acl:Read, acl:Write .
```

## What you'll get wrong if you don't read the spec

- **Authorizations are additive only.** No deny rule. To "remove" access,
  remove the authorization, don't try to add a deny.
- **`acl:default` on a container applies to descendants** until overridden.
  Putting an ACL on a deep child overrides the inherited default for that
  resource only.
- **`acl:accessTo` is for the resource itself; `acl:default` is for
  descendants of a container.** A common bug: setting only `acl:accessTo`
  on a container's ACL grants access to the container resource but not its
  contents.
- **`acl:origin` is a web origin string, not a client identifier.** It's
  the value of the `Origin:` header. CLI agents have no origin — WAC
  cannot distinguish "the user via a CLI tool" from "the user via a
  browser" for any matching purpose.
- **`acl:agentClass foaf:Agent` means "everyone, anonymously included."**
  `acl:agentClass acl:AuthenticatedAgent` means "anyone who has logged in."
- **`acl:Control` is its own permission.** A user with `Read+Write` cannot
  modify the `.acl` resource itself; that requires `Control`.

## Why WAC is being superseded by ACP

WAC's expressiveness has known limits:

| Need | WAC | ACP |
|---|---|---|
| Match a user WebID | `acl:agent` | `acp:agent` |
| Match an app (client_id document) | ❌ — only `acl:origin` (web origin, browser-only) | `acp:client` |
| Match a Verifiable Credential | ❌ | `acp:vc` |
| Match by token issuer | ❌ | `acp:issuer` |
| Match conjunctively (user AND app AND VC) | partial via `acl:origin` workaround | native |

For an agentic Pod where AI agents (no browser origin) are first-class
clients, WAC cannot express the policies we need. ACP can.

## How this Pod uses it

- **Currently the default.** CSS v8 default config is WAC. The Pod has no
  ACL policies enabled — `dev-allow-all` is in effect for development.
- **Working position:** migrate to ACP before turning on any ACL policy.
  Cost is low now (no policies depend on WAC); cost grows if WAC policies
  accumulate first.
- See `solid-servers` skill for CSS config patterns. The switch from WAC
  to ACP is a `solid-config.json` import change (auth module exclusivity).

## Cross-references

- [acp.md](acp.md) — the more capable successor
- [agent-identity.md](agent-identity.md) — why `acl:origin` is insufficient for AI agents
