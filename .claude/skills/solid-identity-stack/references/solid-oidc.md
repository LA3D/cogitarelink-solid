# Solid-OIDC

## Specs

- **Solid-OIDC** (TR, 2022-03-28 snapshot — most recent published)
  https://solidproject.org/TR/oidc
  https://solidproject.org/TR/2022/oidc-20220328
  Status: Public draft from the Solid CG Authentication Panel. Active.
- **OpenID Connect Core 1.0** (the OIDC base spec Solid-OIDC profiles)
  https://openid.net/specs/openid-connect-core-1_0.html
- **OAuth 2.0** (RFC 6749) — the underlying authorization framework
  https://www.rfc-editor.org/rfc/rfc6749
- **DPoP** (RFC 9449) — Solid-OIDC requires DPoP for token binding
  https://www.rfc-editor.org/rfc/rfc9449

## What it is

Solid-OIDC is a profile of OpenID Connect that uses a **WebID as the
subject identifier** instead of an issuer-local user ID. The IDP is
discovered from the WebID profile (`solid:oidcIssuer` triple), so any
Solid client can authenticate against any IDP a user has chosen — no
pre-registration of the IDP with the client.

Two further departures from vanilla OIDC matter:

1. **`client_id` is a dereferenceable HTTPS URL** pointing to an RDF/JSON-LD
   document describing the client app. No pre-registration; the IDP
   fetches and validates the client_id document at auth time.
2. **Access tokens are DPoP-bound.** Every API call carries a DPoP proof
   signed with the client's keypair. The token alone is insufficient —
   you also need the key. See [dpop.md](dpop.md).

## The flow (simplified)

```
1. Client knows a WebID (provided by user, or discovered).
2. Client dereferences WebID → reads <#me> solid:oidcIssuer <idp>.
3. Client redirects user-agent to <idp>/authorize?client_id=<URL>&...
4. IDP fetches client_id document, validates redirect URIs, key material.
5. User authenticates at IDP. IDP issues code → client exchanges for
   DPoP-bound access token + id_token.
6. Access token contains: webid (subject WebID), azp (client_id URL),
   cnf (DPoP key thumbprint).
7. Client calls Pod APIs with both Authorization: DPoP <token> AND a
   DPoP proof header signed with the bound keypair.
```

## Key claims in the access token

| Claim | Meaning |
|---|---|
| `webid` | The subject's WebID — the **user** |
| `azp` | Authorized party — the **client_id URL** (the app) |
| `cnf.jkt` | DPoP key thumbprint — per-instance binding |
| `iss` | The IDP that issued the token |
| `aud` | Intended audience (usually `solid` literal) |
| `exp` / `iat` | Standard JWT lifetime |

**This is the data the Pod sees on every request.** `webid` + `azp` +
`cnf.jkt` together tell the Pod "user W, via app C, with key K, made this
request." See [agent-identity.md](agent-identity.md) for what to do with it.

## Key snippets

Minimal `client_id` document for an app:

```turtle
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix oidc: <http://www.w3.org/ns/solid/oidc#> .

<>
    a solid:Client ;
    oidc:client_name "Claude Code" ;
    oidc:redirect_uris <https://claude.example/callback> ;
    oidc:grant_types "authorization_code", "refresh_token" ;
    oidc:scope "openid webid offline_access" ;
    oidc:token_endpoint_auth_method "none" .  # public client
```

JSON-LD form is also valid:

```json
{
  "@context": ["https://www.w3.org/ns/solid/oidc-context.jsonld"],
  "client_id": "https://pod.example/agents/claude-code",
  "client_name": "Claude Code",
  "redirect_uris": ["https://claude.example/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "scope": "openid webid offline_access",
  "token_endpoint_auth_method": "none"
}
```

## What you'll get wrong if you don't read the spec

- **`client_id` is a URL, not a string.** The IDP dereferences it. The
  document MUST be RDF (Turtle or JSON-LD). The `client_id` value in the
  document MUST match the URL it's served from.
- **`token_endpoint_auth_method: none`** marks the client as **public**
  (no client secret). Confidential clients exist but are uncommon in
  Solid — most agents are public clients relying on DPoP key possession
  for token binding.
- **The `webid` claim is the source of truth for "who is the user," not
  `sub`.** Vanilla OIDC uses `sub`; Solid-OIDC adds `webid` because `sub`
  is IDP-local.
- **The Pod validates the token but does NOT issue it.** The IDP issues;
  the Pod is a resource server. CSS can run a co-located IDP, but the two
  roles are distinct.
- **`solid:oidcIssuer` in the WebID profile is the discovery mechanism.**
  Without it, a client doesn't know where to authenticate.

## How this Pod uses it

- CSS v8 runs its own co-located IDP at `https://pod.vardeman.me/` (CSS
  default behavior, multi-user IDP).
- Currently no `client_id` documents have been minted. The design doc
  proposes `/agents/{claude-code,rlm-substrate,vault-importer}` as the
  next step.
- The Pod's WebID profile (`/profile/card#me`) declares
  `solid:oidcIssuer <https://pod.vardeman.me/>` — this is what makes
  authentication work.
- For client implementations on this Pod, see the
  `solid-integration-guide` skill (Inrupt SDK, solid-client-authn,
  Bashlib).

## Cross-references

- [webid.md](webid.md) — what the `webid` claim points to
- [dpop.md](dpop.md) — what binds the token to the client
- [agent-identity.md](agent-identity.md) — `client_id` documents as agent identifiers
- [acp.md](acp.md) — how the Pod uses `webid` (acp:agent) and `azp` (acp:client)
