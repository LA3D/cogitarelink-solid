# Verifiable Credentials in Solid

## Specs

- **W3C Verifiable Credentials Data Model** (Rec, 2022)
  https://www.w3.org/TR/vc-data-model/
  Status: W3C Recommendation. The foundation.
- **Inrupt Access Requests / Access Grants** (production VC integration in ESS)
  https://docs.inrupt.com/security/authorization/access-requests-grants
  Status: Production at Inrupt; not part of any Solid CG spec.
- **ACP `acp:vc` matcher** (built into ACP itself)
  https://solid.github.io/authorization-panel/acp-specification/ — search "vc"
- **Solid Application Interoperability** (different "Access Grant" — NOT VC-based)
  https://solid.github.io/data-interoperability-panel/specification/

## What it is

A **Verifiable Credential (VC)** is a tamper-evident set of claims about
a subject, signed by an **issuer**, that can be presented to a **verifier**
without contacting the issuer. The W3C VC Data Model is generic and
identity-system-agnostic.

In the Solid ecosystem, VCs surface in **three distinct ways** that are
easy to confuse:

1. **Inrupt's gConsent Access Grants** — production VC integration in
   Inrupt ESS. A VC of type `SolidAccessGrant` representing "grantor
   consents to give grantee access to resource X for mode Y."
2. **ACP `acp:vc` matcher** — built into the ACP spec; lets policies say
   "permit access when the requester presents a VC of type T." Framework
   for VC-gated access regardless of which VC vocab is used.
3. **Solid Application Interoperability "Access Grant"** — a name
   collision with #1. The Interop spec defines an Access Grant as a
   plain LDP resource in an Authorization Registry, NOT a VC.

CSS does not ship VC support out of the box. Adding VCs to a CSS Pod
requires ACP (for `acp:vc` matching) plus a VC verifier extension.

## The Inrupt gConsent VC oddity

A `SolidAccessGrant` VC looks like this:

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://schema.inrupt.com/credentials/v1.jsonld",
    "https://vc.inrupt.com/credentials/v1"
  ],
  "type": ["VerifiableCredential", "SolidAccessGrant"],
  "issuer": "https://vc.inrupt.com/",
  "credentialSubject": {
    "id": "<grantor WebID>",
    "providedConsent": {
      "mode": ["Read"],
      "forPersonalData": "<resource URL>",
      "hasStatus": "ConsentStatusExplicitlyGiven",
      "isProvidedTo": "<grantee WebID>"
    }
  },
  "credentialStatus": { ... },
  "proof": { ... }
}
```

**Oddity:** `credentialSubject.id` is the **grantor**, not the grantee.
The grantee lives at `providedConsent.isProvidedTo`. This is gConsent
semantics — the credential is *about* the grantor's consent. No `holder`
field is required; the grantee presents the VC at request time.

This means a naive read of "subject = who the credential is about" gives
the wrong answer for who's authorized.

## The "Access Grant" name collision

| Concept | What it is | Where it lives |
|---|---|---|
| Inrupt Access Grant | A `SolidAccessGrant` VC | Inrupt ESS production |
| Apps Interop Access Grant | A plain LDP resource in an Authorization Registry | Solid Apps Interop spec (draft) |

Both are called "Access Grant" in their respective ecosystems. They are
structurally unrelated. When the term comes up, ask which one.

## Key snippets

ACP policy gated by VC type:

```turtle
<#research-collaborator-matcher>
    a acp:Matcher ;
    acp:vc <https://example.org/credentials/ResearchCollaborator> .

<#research-collaborator-policy>
    a acp:Policy ;
    acp:allow acl:Read ;
    acp:allOf <#research-collaborator-matcher> .
```

## What you'll get wrong if you don't read the spec

- **CSS doesn't ship VC support.** You need ACP plus a verifier extension.
  Inrupt ESS does ship it but is a different server.
- **W3C VC `credentialSubject.id` is the subject of the claims.** In
  Inrupt's gConsent vocab, the subject is the *grantor*. Don't assume
  "subject = grantee" — read which vocab is being used.
- **VCs require cryptographic verification.** The `proof` block carries
  a signature; the verifier needs the issuer's public key. The Solid
  community does not have a canonical key-discovery mechanism for VC
  issuers — this is a real interop friction point.
- **Apps Interop "Access Grants" are NOT VCs.** They are LDP resources.
  Different model, different lifecycle, different verification story.
- **Revocation matters.** A VC may carry `credentialStatus` pointing to
  a status list the issuer maintains. Verifiers MUST check status; a
  presented VC may have been revoked.

## How this Pod uses it

- **Not currently in use.** No VC integration. ACP not yet enabled. CSS
  default WAC has no VC support.
- **Deferred to Rung 1.3** (per project plan) — VC-aware operation gating
  for sensitive operations like tombstone deletion. The architecture
  needed (ACP + a verifier extension) is documented in the design doc.
- **Open question:** adopt Inrupt's gConsent vocab (interop benefit, weird
  grantor-subject semantics) or mint our own SolidAccessGrant-shaped VCs
  with cleaner semantics (no interop, cleaner model). Either way, the ACP
  matcher infrastructure is the same.

## Cross-references

- [acp.md](acp.md) — the framework that consumes VCs via `acp:vc` matcher
- [did.md](did.md) — VCs are most naturally issued and verified against DIDs
- The W3C VC + DID ecosystem is co-evolving; treat them as a pair when
  designing federation
