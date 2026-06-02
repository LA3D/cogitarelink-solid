# DIDs — Decentralized Identifiers

## Specs

- **W3C DID Core 1.0** (Rec, 2022) — https://www.w3.org/TR/did-core/ — the data model. STABLE.
- **DID Method registry** — https://www.w3.org/TR/did-spec-registries/
- **did:webvh — "did:web + Verifiable History"** (DIF, v1.0; formerly did:tdw) —
  https://identity.foundation/didwebvh/v1.0/ — the current best-fit *web-hosted* DID method (see below).
- **Solid spec issue #217** — "Support DIDs in addition to WebIDs" —
  https://github.com/solid/specification/issues/217 — **DORMANT** (opened 2019, still "Consensus
  Phase," no real discussion or resolution).
- **Solid-OIDC issue #35** — "Generalize Solid-OIDC beyond WebID" —
  https://github.com/solid/solid-oidc/issues/35 — the actual locus for DID-as-identifier in Solid
  auth; also unresolved.

**Foundational ontology grounded** (ahead of the migration, so it is not missing when we start):
`ontology/did.ttl` (DID Core RDFS vocab, `did:` = `https://www.w3.org/ns/did#`) +
`ontology/did-v1.context.jsonld` (the DID-document JSON-LD context). Cached 2026-06-02; see
`ontology/README.md`.

## What it is

A **DID** is a globally unique identifier `did:<method>:<id>` resolving to a **DID document**
(verification methods / public keys, service endpoints, identifier metadata). Unlike WebIDs, some
methods need no hosting server; the identifier is rooted in cryptography or a verifiable log/ledger.

Methods relevant here:

| Method | Resolution | DNS / liveness | Use case |
|---|---|---|---|
| `did:key` | DID encodes the public key; no network resolution | none | ephemeral agent instances, fully self-sovereign; **no discovery / no service endpoints** |
| `did:web` | `did:web:domain` → `https://domain/.well-known/did.json` | **full DNS + server-liveness dependency** (same as a WebID); DNS-spoofing risk; **no key history, no portability** | legacy/simple; **does NOT solve the DNS problem — it relocates it** |
| **`did:webvh`** | like `did:web` (web-hosted) **+ a verifiable append-only log** | **discovery still uses DNS, but trust + continuity move to the log, not DNS**; supports **portability** across domains (SCID + log chain) | **preferred web-hosted DID** — keeps pods live/dereferenceable while decoupling trust + identity-continuity from DNS |
| `did:peer` | pairwise-established | none | P2P / privacy-sensitive edge cases |
| `did:ion`, `did:ethr`, … | ledger-backed | ledger | out of scope |

## The DNS / namespace tension (why this matters for us)

Our resource URIs are **pod-relative** (D84, pod-as-namespace-authority) — tied to the pod's DNS name
+ liveness. That is the right model for **resources** (LDP/Solid is HTTP/DNS-based; resources are
inherently pod-bound). But it bites at the **identity layer**: you do not want an agent's or the
owner's *identity* to die when a pod's DNS lapses or the domain changes.

`did:web` does **not** help — it carries the same DNS + liveness dependency (it is just
`https://domain/.well-known/did.json` under a `did:` prefix). **`did:webvh` is the standards-current
mitigation:** web-hosted (pods stay live + discoverable, consistent with D84), but **trust moves off
DNS onto a cryptographically verifiable log**, and the DID is **portable** across domains with a
verifiable lineage. So the split is: **pod-relative URIs for resources (keep); `did:webvh` for the
identity layer** (when the migration happens).

## The D14 DID-WebID bridge (upgraded to did:webvh)

Solid-OIDC still requires a **WebID HTTP URI** as the identifier (#217/#35 dormant), so the DID does
not *replace* the WebID — it is bridged to it via `owl:sameAs`/`alsoKnownAs` (D14). Prefer `did:webvh`
over `did:web` for the DID side:

```turtle
# Pod-local WebID (client_id document) — the Solid-OIDC identifier:
<https://pod.example/agents/claude-code>
    a foaf:Agent, as:Application ;
    foaf:name "Claude Code" ;
    owl:sameAs <did:webvh:{scid}:claude.ai:agents:claude-code> ;
    schema:alsoKnownAs <did:webvh:{scid}:claude.ai:agents:claude-code> .
```

(`{scid}` is the self-certifying ID that roots the verifiable log.) The same agent has two
identifiers: the **WebID** (pod-local, RDF-dereferenceable, Solid-OIDC `azp`) and the **`did:webvh`**
(web-hosted but DNS-trust-independent, portable, cryptographically verifiable, VC-native). Pods that
understand only WebIDs match the WebID side; DID-aware tools match the DID side. (DID Core defines
`alsoKnownAs`; the Solid WebID Profile endorses `owl:sameAs` for co-referent WebIDs.)

## What you'll get wrong if you don't read the spec

- **`did:web` does not solve DNS.** It is an HTTPS document under a `did:` prefix — same DNS +
  liveness dependency as a WebID, plus no key history / no portability. Use `did:webvh` for web
  hosting *without* DNS as the root of trust.
- **`did:webvh` ≠ `did:web`** — webvh adds the verifiable log + portability; that is the whole point
  for us.
- **DIDs are not HTTP URLs.** A `did:` is not dereferenceable by WebID-style HTTP GET; resolution is
  method-specific.
- **Solid-OIDC assumes WebIDs.** There is **no ratified DID-Solid integration** — #217 (2019) and
  Solid-OIDC #35 are dormant. The DID is bridged to a WebID, not a drop-in replacement.
- **The DID document is not the identity** — the DID is the identifier; the document is metadata.

## How this Pod uses it

- **Not currently in use** — the eventual destination, not the current implementation. But the
  **foundational ontology is now grounded** (`ontology/did.ttl` + `ontology/did-v1.context.jsonld`)
  so the future work does not start with a missing ontology.
- **D14 (WebID↔DID bridge)** is the documented pattern, **upgraded to `did:webvh`**. Implementation
  is part of D109 §5's **enumerated-but-deferred identity layer**; the **URI/DID migration is a
  separate, concerted, tested effort** — explicitly NOT done while the pod's basic operations are in
  flux.
- **`sec:` companion** (`https://w3id.org/security#`, verification methods / Data Integrity proofs —
  referenced by the DID context and shared with the VC layer) stays **enumerate-defer**; ground it
  when the VC/DID integration work starts.

## Cross-references

- [webid.md](webid.md) — the other side of the bridge
- [agent-identity.md](agent-identity.md) — why DIDs fit AI agents
- [vc.md](vc.md) — VCs bind to DIDs; the `sec:` companion lives here too
- D109 §5 (identity layer, enumerate-defer), D84 (pod-relative resource URIs), D14 (the bridge)
