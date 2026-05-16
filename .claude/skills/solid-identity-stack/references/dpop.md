# DPoP — Demonstrating Proof-of-Possession

## Specs

- **RFC 9449** — OAuth 2.0 Demonstrating Proof of Possession (DPoP)
  Published 2023-09
  https://www.rfc-editor.org/rfc/rfc9449
  Status: IETF Proposed Standard. Required by Solid-OIDC.

## What it is

DPoP binds an OAuth 2.0 access token to a **client-held keypair** so that
the bearer of the token alone cannot use it. Every API request carries:

1. The access token (in `Authorization: DPoP <token>` header)
2. A short-lived **DPoP proof JWT** in the `DPoP` header, signed by the
   client's keypair, attesting to the method+URL+nonce of this specific
   request

The token's `cnf` (confirmation) claim contains `jkt` — the thumbprint of
the client's public key. The resource server (Pod) verifies that the DPoP
proof's signature matches that thumbprint.

**Why it matters for Solid:** classic bearer tokens are stealable. DPoP
makes a stolen token useless without also stealing the (typically
non-exportable) keypair. For AI agents — especially CLI agents and
ephemeral instances — this also gives **per-instance identity** for free:
every Claude Code instance generates its own keypair, so the Pod can
distinguish instance A's writes from instance B's via `jkt` without
minting separate client_ids.

## Key snippets

Access token with DPoP binding (decoded):

```json
{
  "webid": "https://pod.example/profile/card#me",
  "azp":   "https://pod.example/agents/claude-code",
  "cnf":   { "jkt": "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I" },
  "iss":   "https://pod.example/",
  "exp":   1726234567,
  "iat":   1726231967,
  "aud":   "solid"
}
```

DPoP proof JWT (decoded, sent in `DPoP` header):

```json
// JWT header:
{
  "typ": "dpop+jwt",
  "alg": "ES256",
  "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." }
}
// JWT payload:
{
  "jti": "e1j3v_-...",          // unique per proof
  "htm": "PATCH",                // HTTP method
  "htu": "https://pod.example/wiki/people/jane",  // HTTP URL
  "iat": 1726232000,
  "ath": "fUHyO2r..."            // hash of access token (when bound)
}
```

The resource server verifies:
- DPoP proof signature using `jwk` from the header
- Thumbprint of `jwk` matches `cnf.jkt` in the access token
- `htm` and `htu` match the actual request
- `iat` is recent (typically within 60 seconds)
- `jti` hasn't been seen before (replay protection)

## What you'll get wrong if you don't read the spec

- **DPoP proofs are one-shot.** Each request needs a freshly minted proof.
  Caching them is incorrect (replay protection via `jti`).
- **The key thumbprint format is RFC 7638 (JWK Thumbprint).** SHA-256 over
  the canonical-form JSON of the public key, base64url-encoded. Don't
  invent your own.
- **`ath` (access token hash) is mandatory when a token is presented.** A
  DPoP proof without `ath` is only valid for token endpoints, not resource
  endpoints. This is a frequent client bug.
- **Server clocks matter.** DPoP enforces `iat` freshness. Clock skew >
  ~60s typically breaks the flow.
- **DPoP is per-token, not per-session.** Renewing a token via refresh
  token may or may not preserve the keypair — implementations vary. Read
  the client library docs.

## Why DPoP matters for AI agent identity

The DPoP `cnf.jkt` claim is the **only per-instance identifier** in the
Solid-OIDC stack. `webid` is per-user; `azp` is per-application-class;
`jkt` is per-keypair, which means per-instance.

For provenance, this means:

```turtle
# Resource-level provenance:
</wiki/people/jane>
    prov:wasAttributedTo <https://pod.example/profile/card#me> ;     # user (webid)
    prov:wasAssociatedWith <https://pod.example/agents/claude-code> ; # app (azp)
    prov:qualifiedAssociation [
        prov:agent <https://pod.example/agents/claude-code> ;
        prov:hadRole wikirole:delegatedAuthor ;
        prov:atTime "2026-05-16T..."^^xsd:dateTime ;
        # optional: per-instance identifier
        wiki:dpopThumbprint "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I" ;
    ] .
```

Per-instance binding is useful when an audit trail needs to distinguish
"Claude Code session A" from "Claude Code session B" (e.g., "this write
came from the session that ran the vault import vs a later interactive
session"). For most uses, resource-level `prov:wasAttributedTo` +
`prov:wasAssociatedWith` is enough.

## How this Pod uses it

- CSS v8 ships DPoP support out of the box (Solid-OIDC default).
- No code currently reads `cnf.jkt` for provenance. The design doc
  proposes a `ProvenanceCommitListener` that captures it from request
  context at write time.
- For client integration, see `solid-integration-guide` skill —
  `@inrupt/solid-client-authn-node` handles DPoP automatically.

## Cross-references

- [solid-oidc.md](solid-oidc.md) — the auth flow DPoP is part of
- [agent-identity.md](agent-identity.md) — DPoP as per-instance agent identifier
