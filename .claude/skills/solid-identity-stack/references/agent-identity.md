# AI Agent Identity and Provenance

## Specs and references

- **Solid Application Interoperability** (Authorization Agent, Application Registration)
  https://solid.github.io/data-interoperability-panel/specification/
- **PROV-O** (W3C Recommendation)
  https://www.w3.org/TR/prov-o/
- **Inrupt MCP-Solid integration**
  https://www.inrupt.com/blog/why-were-excited-about-solid-and-mcp
- **Inrupt Agentic Wallets**
  https://www.inrupt.com/wallets/agentic-wallets
- **OpenID Foundation — Identity Management for Agentic AI** (Oct 2025 whitepaper)
  https://openid.net/new-whitepaper-tackles-ai-agent-identity-challenges/
- **GNAP** (RFC 9635, Oct 2024) — Grant Negotiation and Authorization Protocol
  https://www.rfc-editor.org/rfc/rfc9635
  Status: IETF Proposed Standard. Designed for agent delegation, but no Solid CG adoption yet.

## What it is

When an AI agent (Claude Code, dspy.RLM-based agents, vault-importer CLI)
acts on a human user's behalf against a Solid Pod, two identity questions
arise:

1. **Authentication.** Does the agent impersonate the user's WebID, or
   does it have its own identity?
2. **Provenance.** When the agent writes a resource, can the audit trail
   record "agent X (instance) on behalf of user Y did this"?

The Solid-OIDC + DPoP stack already carries all the necessary identifiers
*in transit*. The gap is that no Solid spec mandates writing them into the
resource. This is the substrate's job to close.

## What's already in transit on every request

Solid-OIDC issues a DPoP-bound access token containing:

| Claim | Value | Meaning |
|---|---|---|
| `webid` | `https://pod.example/profile/card#me` | The user (subject) |
| `azp` | `https://pod.example/agents/claude-code` | The application (client_id URL) |
| `cnf.jkt` | `0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I` | DPoP key thumbprint (per-instance) |
| `iss` | `https://pod.example/` | The IDP |

The Pod sees all three on every request. **The data exists; the spec just
doesn't mandate writing it down.**

## Agent identity as `client_id` documents

A Solid-OIDC `client_id` is a dereferenceable HTTPS URL pointing to an
RDF/JSON-LD document describing the client (see [solid-oidc.md](solid-oidc.md)).
**That document is an agent identifier.** It can carry typing
(`foaf:Agent`, `as:Application`), capability declarations, publisher
information, etc.

The design-doc pattern: mint Pod-local client_id documents for each agent
class:

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
    schema:publisher <https://github.com/cvardeman/rlm> .

</agents/vault-importer>
    a foaf:Agent, as:Application ;
    foaf:name "vault-importer CLI" ;
    schema:isPartOf <https://github.com/.../cogitarelink-solid> .
```

These are agent-**class** identifiers. Per-instance binding is provided
"for free" by DPoP's `cnf.jkt` thumbprint — every Claude Code instance
generates its own keypair, so the Pod can distinguish instance A from
instance B without minting per-instance WebIDs.

## Provenance via PROV-O

The closing-the-audit-trail-gap pattern is a **`ProvenanceCommitListener`**
extension that mirrors the existing `MementoCommitListener` pattern: a
MonitoringStore CDC listener that materializes PROV-O triples into `.meta`
at write time.

Resource-level provenance (v1 — cheap, coarse):

```turtle
</wiki/people/jane-doe>
    prov:wasAttributedTo
        <https://pod.example/profile/card#me> ;        # the user (webid)
    prov:wasAssociatedWith
        <https://pod.example/agents/claude-code> ;     # the app (azp)
    prov:qualifiedAssociation [
        prov:agent <https://pod.example/agents/claude-code> ;
        prov:hadRole wikirole:delegatedAuthor ;
        prov:atTime "2026-05-16T..."^^xsd:dateTime ;
    ] ;
    dct:modified "2026-05-16T..."^^xsd:dateTime .
```

Triple-level provenance (RDF-star, deferred — heavier):

```turtle
<< </wiki/people/jane-doe> vcard:hasEmail <mailto:jane@nd.edu> >>
    prov:wasAttributedTo <https://pod.example/profile/card#me> ;
    prov:wasAssociatedWith <https://pod.example/agents/claude-code> ;
    prov:atTime "2026-05-16T..."^^xsd:dateTime .
```

The two granularities are nested choices. Resource-level is probably
enough for Rung 1.5 eval; triple-level only if eval surfaces a need.

**Important ordering constraint:** Memento snapshots `.meta` on commit.
Provenance triples MUST be in `.meta` before Memento snapshots, or the
snapshot loses them. Either two listeners ordered correctly, or one
combined listener.

## How this subsumes RQ-Listener-1

RQ-Listener-1 is about distinguishing substrate-authored triples from
agent-authored triples in `.meta` after `FileDataAccessor.writeMetadataFile()`
overwrites it before the MonitoringStore event fires. Path-D (RDF-star
reification) was one proposed mitigation.

**PROV-O at resource level is the lighter answer to the same question.**
Every write carries a `prov:wasAssociatedWith` tag, so substrate vs agent
vs Claude-Code-on-behalf-of-user is *queryable* without RDF-star tooling
debt. Path-D may not be needed at all.

If triple-level granularity becomes load-bearing later, the RDF-star
exploration in `docs/plans/2026-05-15-rdf-star-provenance-exploration.md`
still applies. But resource-level PROV-O should be tried first.

## Connection to other identity-stack pieces

- **ACP `acp:client` matcher** consumes the `client_id` URL — so an ACP
  policy can say "only Claude Code may write to /wiki/working/." See
  [acp.md](acp.md).
- **Capability declarations** in the agent's client_id document
  (`wiki:capability cap:write-graph`) connect to D83's Pod-as-toolkit
  capability catalog. Either the agent profile is canonical (and ACP
  matches on capability) or ACP is canonical (and the agent profile is
  documentation). Open question.
- **DIDs** become relevant when agents need to authenticate to multiple
  Pods without re-registering as different client_ids on each. The D14
  bridge pattern means `</agents/claude-code> owl:sameAs <did:web:...>`.
  See [did.md](did.md).
- **VCs** become relevant when agent actions are gated by time-limited or
  delegated credentials (Inrupt's "Agentic Wallets" pattern). See
  [vc.md](vc.md).

## Where the broader ecosystem is

The Inrupt MCP-Solid prototype wraps Pod access in MCP tool calls and
pitches "Agentic Wallets" as Pod-scoped, least-privilege stores backing
LLM agents. Their delegation primitive is time-limited Access Grants
(see [vc.md](vc.md)).

The OpenID Foundation's October 2025 whitepaper ("Identity Management for
Agentic AI") declares an "autonomy inflection point" but defers concrete
delegation mechanisms — the agentic-identity space is unsettled.

GNAP (RFC 9635) is technically a better fit for agent delegation than
OAuth — key-bound, just-in-time, no pre-registration — but has zero Solid
CG adoption as of this writing. Watch the space; don't build on it yet.

MCP-I (community draft) and vendor schemes (WSO2 Agent ID, Ping) are
competing for the agent-identity slot. None interoperate with Solid yet.

## What you'll get wrong if you don't read the design doc

- **Provenance is the substrate's job, not the protocol's.** No Solid spec
  mandates writing the request agent into `.meta`. The Pod has the data;
  the substrate has to write it. The `ProvenanceCommitListener` pattern
  is the answer.
- **`client_id` documents ARE agent identifiers.** They are WebIDs in the
  broad `foaf:Agent` sense. Don't think of them as merely app metadata.
- **Per-instance vs per-class identity.** `azp` is per-class (all Claude
  Code instances share the URL); `cnf.jkt` is per-instance. Pick the
  granularity provenance needs.
- **The agent profile isn't published by Anthropic or anyone upstream.**
  We mint and maintain it ourselves at `/agents/claude-code`. Document it
  as a substrate-owned namespace.

## How this Pod uses it

- **`/agents/` namespace not yet minted.** Design doc proposes it. Stub
  client_id documents are the next deliverable when ACL turn-on begins.
- **No `ProvenanceCommitListener` yet.** Mirrors Memento's pattern; small
  CSS extension, high value. Lands when audit trail becomes load-bearing
  (which is around the time ACP turns on).
- **DID bridge for agents:** future. Round 4 federation, or earlier if
  the use case surfaces.
- **VC integration:** Rung 1.3 deferral (see [vc.md](vc.md)).

## Cross-references

- [solid-oidc.md](solid-oidc.md) — the auth flow that establishes agent identity
- [dpop.md](dpop.md) — per-instance binding via key thumbprint
- [acp.md](acp.md) — how policies match on agent identity
- [did.md](did.md) — self-sovereign agent identity, the eventual destination
- [vc.md](vc.md) — VC-based delegation patterns
- Project design doc: `docs/plans/2026-05-16-identity-and-provenance-design.md`
