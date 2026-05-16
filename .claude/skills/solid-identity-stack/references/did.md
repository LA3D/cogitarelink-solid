# DIDs — Decentralized Identifiers

## Specs

- **W3C DID Core 1.0** (Rec, 2022)
  https://www.w3.org/TR/did-core/
  Status: W3C Recommendation.
- **DID Method registry** — the catalog of `did:*` methods
  https://www.w3.org/TR/did-spec-registries/
- **Solid spec issue #217** — DID support in Solid (open, no consensus)
  https://github.com/solid/specification/issues/217

## What it is

A **DID** is a globally unique identifier of the form `did:<method>:<id>`
that resolves to a **DID document** describing the subject — verification
methods (public keys), service endpoints, and identifier metadata. Unlike
WebIDs, DIDs do not require a hosting server (some methods do, most don't);
the identifier is rooted in cryptography or a distributed ledger.

The relevant DID methods for this project:

| Method | Resolution | Use case |
|---|---|---|
| `did:key` | The DID itself encodes a public key. No network resolution. | Ephemeral agent instances, fully self-sovereign |
| `did:web` | DID document at a well-known URL on a domain. | Stable canonical identities for orgs and named agents |
| `did:peer` | Pairwise-established DIDs for connections. | Edge cases (P2P, privacy-sensitive) |
| `did:ion`, `did:ethr`, etc. | Various ledger-backed methods. | Out of scope for this project |

## Why DIDs matter for this Pod

DIDs are the natural identity for **AI agents and self-sovereign actors**
that don't fit the WebID-on-a-Pod model:

- An AI agent doesn't have a "home server" the way a human Pod owner does.
  DIDs work without one.
- Agent instances are ephemeral. DID Core has built-in key rotation
  semantics (DID document updates).
- Cross-Pod, cross-organization, cross-provider federation is the agentic
  use case. DIDs are designed for it.
- **Verifiable Credentials** (see [vc.md](vc.md)) bind much more naturally
  to DIDs than to WebIDs — the W3C VC ecosystem assumes DIDs throughout.

## The D14 DID-WebID bridge

This project's working pattern (decision D14) is to bridge WebIDs and DIDs
via `owl:sameAs` or `alsoKnownAs`:

```turtle
# The Pod-local WebID (client_id document):
<https://pod.example/agents/claude-code>
    a foaf:Agent, as:Application ;
    foaf:name "Claude Code" ;
    owl:sameAs <did:web:claude.ai:agents:claude-code> ;
    schema:alsoKnownAs <did:web:claude.ai:agents:claude-code> .
```

```json
// The DID document (did:web — fetched from https://claude.ai/agents/claude-code/did.json):
{
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:web:claude.ai:agents:claude-code",
  "verificationMethod": [{...}],
  "service": [
    {
      "id": "#solid-client-id",
      "type": "SolidClientIdentifier",
      "serviceEndpoint": "https://pod.example/agents/claude-code"
    }
  ],
  "alsoKnownAs": ["https://pod.example/agents/claude-code"]
}
```

The same agent has two identifiers:

- **WebID side** — Pod-local, dereferenceable as Turtle, usable in Solid-OIDC `azp`
- **DID side** — self-sovereign, dereferenceable as DID document, usable in W3C VC contexts, cryptographically verifiable

`owl:sameAs` (or `alsoKnownAs`) declares them equivalent. Pods that
understand only WebIDs match on the WebID side; tools that understand DIDs
match on the DID side. Federation works.

The Solid WebID Profile spec endorses `owl:sameAs` for "two WebIDs that
denote the same entity"; DID Core defines `alsoKnownAs` for DID → other
identifier linkage. Both spec languages support the bridge.

## Key snippets

A `did:key` identifier (encodes the public key directly, no resolution
needed):

```
did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSrouTVHy9tNCwBLBdoq
```

A `did:web` identifier (resolves to `https://example.com/.well-known/did.json`):

```
did:web:example.com
```

Or with a path:

```
did:web:example.com:users:alice
```
(resolves to `https://example.com/users/alice/did.json`)

## What you'll get wrong if you don't read the spec

- **DIDs are not URLs.** Some DID methods (did:web) resolve to URLs but
  the DID itself is not an HTTP IRI. WebID-style dereferencing does not
  work for DIDs in general.
- **DID resolution is method-specific.** `did:key` is resolved
  cryptographically; `did:web` via HTTP; `did:ion` via an IPFS+blockchain
  layer. Tooling must handle this per method.
- **No single DID method is universal.** Choose per use case: `did:key`
  for ephemeral agent keys, `did:web` for stable named entities.
- **The DID document is not the identity** any more than the WebID profile
  document is. The DID is the identifier; the document is metadata.
- **There is no ratified DID-Solid integration spec.** D14's bridge
  pattern is the project's working position, not a Solid CG decision.

## How this Pod uses it

- **Not currently in use.** This is the eventual destination, not the
  current implementation.
- **D14 (DID-WebID bridge)** is the documented pattern. Implementation
  deferred until federation use cases surface (Round 4 territory, or
  earlier if Claude Code needs to talk to multiple Pods).
- **For AI agents specifically:** each Pod-local client_id (e.g.,
  `/agents/claude-code`) is expected to eventually carry an
  `owl:sameAs <did:web:...>` linkage. Substrate-level support (PROV-O
  matching, ACP `acp:agent` matching across both sides) would need
  extensions.

## Cross-references

- [webid.md](webid.md) — the other side of the D14 bridge
- [agent-identity.md](agent-identity.md) — why DIDs fit AI agents
- [vc.md](vc.md) — VCs naturally bind to DIDs
