# Verifiable Credentials — Credential Roadmap for cogitarelink-solid

**Status**: research-track design note. Not implementation-ready.
**Date**: 2026-05-18.
**Relation to other work**: presupposes
`docs/plans/2026-05-18-wiki-search-walker-redesign.md` (Path 1a). VC
support is an *extension* of the credential context Path 1a inherits;
no VC work blocks the walker redesign.

## Why this note exists

The wiki-search walker redesign analysis raised the question of how an
agentic Pod handles credentials more sophisticated than a WebID — VCs,
DIDs, scoped delegation, time-bound capabilities. The redesign's Path 1a
inherits *whatever* credentials CSS extracts from the request, so any
future credential dimension Just Works at the handler level. But the
extraction side has to be built.

This note captures the research backing the future build: what CSS v8
already has, what it's missing, what the standards-ecosystem looks like
in 2026, and what a pragmatic implementation path could look like. It is
intentionally not scoped to a sprint — VC work happens after Rung 1.5
evidence motivates it. The doc exists so the research isn't lost between
now and then.

## CSS v8 credential machinery state

The full pipeline for an incoming authenticated request:

```
Request arrives
  ↓
CredentialsExtractor chain (UnionCredentialsExtractor):
  • DPoPWebIdExtractor   → reads Authorization: DPoP, verifies,
                           produces { agent.webId, client.clientId, issuer.url }
  • BearerWebIdExtractor → same for Bearer tokens
  • PublicCredentialsExtractor → anonymous fallback
  ↓
Credentials object: { agent?, client?, issuer?, [key]: unknown }
  ↓
AuthorizingHttpHandler → PermissionReader chain (UnionPermissionReader):
  • AllStaticReader (dev mode — what we run today)
  • OwnerPermissionReader (Pod owner always allowed)
  • PolicyEngineReader → delegates to @solidlab/policy-engine
      • AcpPolicyEngine (ACP) or WacPolicyEngine (legacy WAC)
      • Has evaluateVc(vc, context) matcher — looks at context.vc[] array
  • PathBasedReader, AuxiliaryReader, ReadDeleteReader
  ↓
PermissionBasedAuthorizer decides allow/deny
  ↓
Handler runs (auth context propagated as Credentials param)
```

### What's wired up

- WebID, client_id, issuer extracted from DPoP/Bearer tokens
- ACP and WAC both supported via separate policy-engine implementations
- Policy engine **has** VC matcher support — `evaluateVc(vc, context) = context.vc.includes(vc)`
- `Credentials` type is extensible (`[key: string]: unknown` — designed
  for future extension)
- ACP config infrastructure exists (`config/ldp/authorization/acp.json`
  ships)

### What's scaffolded but not wired

- `@solidlab/policy-engine` is at **v0.0.2** — pre-1.0, signals
  research-quality
- ACP config's `AcpHeaderHandler` advertises only `acp:target`,
  `acp:agent`, `acp:client`, `acp:issuer` to clients — **`acp:vc` is not
  in the attribute list** even though the engine supports it
- **No `VerifiableCredentialExtractor` exists** — CSS can't extract VCs
  from incoming requests
- **No VC verification infrastructure** — even if a VC arrived in
  headers, no signature/expiry/revocation check
- Inrupt's `solid-client-access-grants-js` (their gConsent VC layer) is
  NOT in the dependency tree

CSS v8 has built the *matching* side of VC support but not the
*extraction* side. The matcher is just a string-set check
(`Array.includes`); the real cryptographic work would have to happen in a
custom extractor that populates `credentials.vc[]`. This is consistent
with policy-engine v0.0.2 being research-quality.

## The gConsent / Inrupt UMA flow

Inrupt's Access Grants (their VC-based access control product, sometimes
called gConsent) is the most-deployed VC-in-Solid pattern. It is **not**
"send a VC on every request" — it's UMA 2.0 token exchange with the VC
carried as a `claim_token`:

```
┌──────────┐                          ┌──────────────────┐                 ┌─────────────────┐
│ Client   │                          │ Pod (RS)         │                 │ UMA AS          │
└─────┬────┘                          └────────┬─────────┘                 └────────┬────────┘
      │                                        │                                    │
      │ ① GET /wiki/sources/private/note.md    │                                    │
      ├───────────────────────────────────────►│                                    │
      │                                        │                                    │
      │ ② 401 Unauthorized                     │                                    │
      │    WWW-Authenticate: UMA               │                                    │
      │      realm="solid"                     │                                    │
      │      as_uri="https://uma.example/"     │                                    │
      │      ticket="abc123"                   │                                    │
      │◄───────────────────────────────────────┤                                    │
      │                                        │                                    │
      │ ③ GET /.well-known/uma2-configuration                                       │
      ├──────────────────────────────────────────────────────────────────────────► │
      │ ◄─── token_endpoint, jwks_uri ─────────────────────────────────────────────┤
      │                                                                             │
      │ ④ POST <token_endpoint>                                                     │
      │    Content-Type: application/x-www-form-urlencoded                          │
      │    Authorization: DPoP <solid-oidc-access-token>   ← proves WebID           │
      │    DPoP: <proof-for-this-request>                                           │
      │                                                                             │
      │    grant_type=urn:ietf:params:oauth:grant-type:uma-ticket                   │
      │    ticket=abc123                                                            │
      │    claim_token=<base64(VP{verifiableCredential:[<access-grant>]})>          │
      │    claim_token_format=https://www.w3.org/TR/vc-data-model/#json-ld          │
      ├──────────────────────────────────────────────────────────────────────────►│
      │                                                                             │
      │                                       ┌─────────────────────────────────┐  │
      │                                       │ AS validates:                   │  │
      │                                       │  • DPoP-bound OIDC token        │  │
      │                                       │    → WebID of requester         │  │
      │                                       │  • VC signature (issuer key)    │  │
      │                                       │  • VC validity window           │  │
      │                                       │  • VC status (revocation)       │  │
      │                                       │  • VC.subject == requester WebID│  │
      │                                       │  • VC.scope ⊇ requested access  │  │
      │                                       └─────────────────────────────────┘  │
      │                                                                             │
      │ ⑤ 200 OK { access_token: "<uma-bound>", token_type: "Bearer" }              │
      │◄────────────────────────────────────────────────────────────────────────────┤
      │                                        │                                    │
      │ ⑥ GET /wiki/sources/private/note.md    │                                    │
      │    Authorization: Bearer <uma-token>   │                                    │
      ├───────────────────────────────────────►│                                    │
      │                                        │ Pod validates UMA token            │
      │                                        │ against AS (introspection or       │
      │                                        │ signed JWT with AS jwks)           │
      │ ⑦ 200 OK <markdown body>               │                                    │
      │◄───────────────────────────────────────┤                                    │
```

### Key design properties

1. **The VC is never sent to the Pod directly.** It goes to the UMA AS
   once, gets exchanged for a short-lived access token, and the access
   token is what the Pod sees. The VC stays in the client's wallet.

2. **Three trust anchors:**
   - OIDC issuer — proves *who* the WebID is (DPoP-bound)
   - VC issuer — asserts *what* the WebID is allowed to do
   - UMA AS — combines both into a capability token

3. **Revocation is real.** Access Grant VCs include `credentialStatus`
   (W3C Bitstring Status List). The AS checks it at exchange time.
   Short-lived tokens mean revocations propagate within token TTL.

4. **VC.subject must match the requester WebID.** Prevents cross-agent
   replay. UMA solves holder binding via the OIDC subject identifier, not
   via a VP nonce.

5. **ACP `acp:vc` matchers fire indirectly.** The Pod doesn't see the VC.
   But the UMA AS encodes the VC IDs into the token's claims (typically
   `permissions[]` or `vc[]`). The Pod's CredentialsExtractor reads
   those claims, populates `credentials.vc[]`, and `evaluateVc` matches.

### What Inrupt ESS implements

| Component | ESS ships | CSS v8 ships |
|---|---|---|
| Pod RS returns `WWW-Authenticate: UMA` on 401 | ✅ | ❌ |
| Pod RS validates UMA Bearer tokens | ✅ | ❌ |
| Standalone UMA AS service | ✅ (`uma.<ess-domain>`) | ❌ |
| Access Grant VC issuer service | ✅ (`vc.<ess-domain>/issue`) | ❌ |
| `/verify` endpoint (VC verification API) | ✅ | ❌ |
| `/derive` endpoint (Pod resource lookup → which grants apply) | ✅ | ❌ |
| `/status` endpoint (revocation status list) | ✅ | ❌ |
| Owner approval UI (review access requests) | ✅ | ❌ |
| Client library | ✅ `@inrupt/solid-client-access-grants-js` | ❌ |

ESS's UMA AS source is closed; their client library and docs are public.
Implementing the same flow against CSS requires building the entire
server-side, or adopting an open-source AS.

## SolidLab UMA AS

[SolidLabResearch/user-managed-access](https://github.com/SolidLabResearch/user-managed-access)
is a real, working, MIT-licensed, actively developed (most recent commit
2026-04-28) implementation of UMA 2.0 designed specifically for CSS. Two
packages:

- **`@solidlab/uma`** — the UMA AS itself: token endpoint, ticketing,
  claim handling, policy enforcement
- **`@solidlab/uma-css`** — the CSS-side wedge (3 files:
  `UmaClient.ts`, `ResourceRegistrar.ts`, `ScopeUtil.ts`)

The CSS instance emits `WWW-Authenticate: UMA` with `as_uri` + `ticket`,
validates incoming UMA tokens against the AS's JWKS via `jose`. UMA
tokens carry `permissions[]` claims (resource_id + scopes).

### What SolidLab UMA does NOT do

Inspected `packages/uma/src/credentials/Formats.ts`:

```typescript
export const JWT          = 'urn:solidlab:uma:claims:formats:jwt';
export const UNSECURE     = 'urn:solidlab:uma:claims:formats:webid';
export const OIDC         = 'http://openid.net/specs/openid-connect-core-1_0.html#IDToken';
export const ACCESS_TOKEN = 'urn:ietf:params:oauth:token-type:access_token';
```

**No `https://www.w3.org/TR/vc-data-model/#json-ld` format.** The
Inrupt-style flow where the claim_token IS a Verifiable Presentation is
not supported. Verifiers in `packages/uma/src/credentials/verify/`:
`IriVerifier`, `JwtVerifier`, `OidcVerifier`, `TypedVerifier`,
`UnsecureVerifier`. No `VcVerifier`.

**No VC-aware authorizer either.** Shipped authorizers:
`WebIdAuthorizer`, `OdrlAuthorizer`, `SimpleOdrlAuthorizer`,
`NamespacedAuthorizer`, `AllAuthorizer`, `NoneAuthorizer`. The research
focus is ODRL (Open Digital Rights Language) policy expression with an
N3-based Eye reasoner — a different theoretical approach than VC
capabilities.

Their `Requirements.md` mentions VC validation in their auditing
frontend, and there's a `demo/trust-envelope-use-case` branch that may
have VC-adjacent work. Worth investigating before committing.

## TypeScript VC library landscape (2026)

| Library | Strengths | Weaknesses | Fit |
|---|---|---|---|
| [@digitalbazaar/vc](https://github.com/digitalbazaar/vc) | Reference impl. JSON-LD + Data Integrity proofs. Stable. Used by Veres, DCC. | JSON-LD only. Suite/loader plumbing has learning curve. | ✅ Strongest core. |
| [@digitalcredentials/vc](https://www.npmjs.com/package/@digitalcredentials/vc) | Fork by Digital Credentials Consortium (MIT, Stanford). Same API. | Same shape. | Equivalent — pick by community. |
| [Veramo](https://veramo.io/) | Full SSI framework: keys, DIDs, VC issue+verify, plugins. Active. | Large surface, opinionated agent model, big dep footprint. | ⚠️ Overkill for an extractor. |
| [Sphereon SSI SDK](https://github.com/Sphereon-Opensource/SSI-SDK) | Built on Veramo. Strong on OID4VCI/OID4VP/SD-JWT-VC. EUDI-aligned. | Inherits Veramo footprint + more. | ⚠️ Future SD-JWT-VC fit. |
| [did-jwt-vc](https://www.npmjs.com/package/did-jwt-vc) / [did-jwt](https://github.com/decentralized-identity/did-jwt) | Lightweight. JWT-VC only. DIF-maintained. | JWT-VC only. Lower-level. | ✅ If we go JWT-VC. |
| [@inrupt/solid-client-access-grants-js](https://github.com/inrupt/solid-client-access-grants-js) | Solid-native, understands Pods. | Assumes Inrupt ESS authorization server. | ❌ Won't run against non-ESS. Study the data model. |
| [did-resolver](https://github.com/decentralized-identity/did-resolver) | DIF standard. Plug in method-specific drivers. | Each method needs its own resolver package. | ✅ Standard choice. |

### Recommended library stack

JSON-LD track aligns with our RDF-native Pod:

- `@digitalbazaar/vc` for the verification primitive
- `@digitalbazaar/ed25519-signature-2020` (and `2018` if needed)
- `@digitalbazaar/data-integrity` for W3C Data Integrity 2.0 path when
  standards stabilize
- `did-resolver` + `web-did-resolver` + `key-did-resolver` for issuer
  DID resolution
- `@digitalbazaar/vc-bitstring-status-list` for revocation checks
- A small custom JSON-LD loader for our Pod's vocabularies (so contexts
  hosted on our Pod resolve without network round-trips)

Why JSON-LD over JWT-VC:

1. Our Pod is JSON-LD/RDF native (`/vault/meta/context.jsonld`, `.meta`
   files). Same parsing stack.
2. ACP `acp:vc` is content-agnostic (matches by VC ID URL), but JSON-LD
   VCs integrate cleanly into our RDF infrastructure if we ever want to
   store them in `.meta`.
3. JWT-VC has a future via SD-JWT-VC for selective disclosure, which we
   might want — but that's a Phase-N feature.
4. W3C VC Data Model 2.0 (Recommendation, 15 May 2025) is JSON-LD first;
   JOSE/COSE securing is a layer on top.

## Three routes forward

### Route B — Build UMA from scratch (rejected)

Multi-week build for AS service + VC issuer + verifier + status service
+ approval UI. SolidLab has done the hard work; we should not duplicate.

### Route C — Direct VC presentation (v1 prototype)

Client sends VC in custom header on every request:

```
Authorization: DPoP <solid-oidc-token>
VC-Presentation: <base64(VP)>
```

A custom `VerifiableCredentialExtractor` (sketched below) verifies the
VP inline, populates `credentials.vc[]`. Per-request verification cost,
no revocation cache, no AS service to run. Best for **first contact**
with VCs — self-contained CSS extension, ~150-200 LOC plus tests.

#### Extractor sketch

```typescript
import { CredentialsExtractor, type Credentials } from "@solid/community-server";
import type { HttpRequest } from "@solid/community-server";
import { BadRequestHttpError, NotImplementedHttpError } from "@solid/community-server";
import { verifyCredential } from "@digitalbazaar/vc";
import { Ed25519Signature2020 } from "@digitalbazaar/ed25519-signature-2020";
import { Resolver } from "did-resolver";
import * as webDidResolver from "web-did-resolver";

export class VerifiableCredentialExtractor extends CredentialsExtractor {
  private readonly didResolver = new Resolver({ ...webDidResolver.getResolver() });
  private readonly suite = new Ed25519Signature2020();

  async canHandle({ headers }: HttpRequest): Promise<void> {
    if (!headers["vc-presentation"]) {
      throw new NotImplementedHttpError("No VC-Presentation header");
    }
  }

  async handle(request: HttpRequest): Promise<Credentials> {
    const vp = parsePresentation(request.headers["vc-presentation"] as string);
    await this.verifyHolderBinding(vp, request);

    const verifiedVcIds: string[] = [];
    for (const vc of vp.verifiableCredential ?? []) {
      const result = await verifyCredential({
        credential: vc,
        documentLoader: this.buildDocumentLoader(),
        suite: this.suite,
      });
      if (!result.verified) {
        throw new BadRequestHttpError(`VC verification failed: ${result.error?.message}`);
      }
      const now = Date.now();
      if (vc.validUntil && Date.parse(vc.validUntil) < now) {
        throw new BadRequestHttpError("VC expired");
      }
      if (vc.validFrom && Date.parse(vc.validFrom) > now) {
        throw new BadRequestHttpError("VC not yet valid");
      }
      if (vc.credentialStatus) {
        const status = await this.checkStatus(vc.credentialStatus);
        if (status.revoked) throw new BadRequestHttpError("VC revoked");
      }
      verifiedVcIds.push(vc.id);
    }
    return { vc: verifiedVcIds };
  }
}
```

Wired into the extractor chain via Components.js override, inserted after
`DPoPWebIdExtractor` in the `UnionCredentialsExtractor`. The merged
`Credentials` then has `{ agent, client, issuer, vc[] }` — and the
policy engine's `evaluateVc` does the matching.

#### Holder binding gap (Route C)

Route C's `verifyHolderBinding` is the hardest part. A VP needs to be
cryptographically bound to *this* request to prevent replay. Options:

- VP-JWT with `nonce` + `aud` (client must mint a fresh VP per request
  with the Pod URL as `aud` and a server-provided nonce — requires the
  Pod to issue nonces upstream)
- SD-JWT-VC Key Binding JWT (`kb-jwt`) — binds the VP to the holder's
  DPoP key implicitly
- Custom: bind to DPoP-proof `jti` (research-level, non-standard)

None of these are free. The simplest first-contact prototype could skip
holder binding entirely (accept replay risk) and add it after we have
working semantics.

### Route A' — SolidLab UMA + custom VcVerifier + VcAuthorizer (v2 destination)

Stand up `@solidlab/uma` + `@solidlab/uma-css`, then contribute new VC
support to the AS:

1. **`VcVerifier.ts`** in `packages/uma/src/credentials/verify/` — new
   file. Recognizes claim_token_format
   `https://www.w3.org/TR/vc-data-model/#json-ld`, parses VP envelope,
   verifies each VC inside via `@digitalbazaar/vc`, returns a typed
   `ClaimSet`. ~150 LOC.

2. **`Formats.ts`** — add the VC JSON-LD format constant. ~1 LOC.

3. **`VcAuthorizer.ts`** — or extend the existing `WebIdAuthorizer` to
   also accept VC-derived claims. Decides allow/deny based on which
   verified VCs are in the claim set + local policy. ~100 LOC.

4. **Register both via Components.js** in their config. ~30 LOC.

5. **Demo script** mimicking the Inrupt flow against the SolidLab AS.
   ~100 LOC.

Total: ~400 LOC of new TypeScript + thousands inherited from SolidLab.
Realistic one-week sprint to a working W3C-VC-as-UMA-claim_token
prototype. Contributable upstream — extends SolidLab's framework into
the W3C VC space.

### Comparison

| Property | Route C | Route A' |
|---|---|---|
| Effort | ~150-200 LOC | ~400 new + adopt SolidLab UMA stack |
| Per-request crypto cost | High (verify on every request) | Low (verify once, cache token) |
| Revocation freshness | Per-request check | Bounded by token TTL |
| AS service required | No | Yes (SolidLab UMA) |
| VC stays in wallet | No (sent on every request) | Yes (sent once to AS) |
| Holder binding | Hard (manual design) | Inherited from UMA + DPoP-bound OIDC |
| Standards compliance | Non-standard (custom header) | UMA 2.0 + W3C VC Data Model 2.0 |
| Production-ready | Prototype only | Production-shaped |
| Contributes upstream | No | Yes, to SolidLab |

**Recommendation**: Route C for first contact (experiment with VC
semantics, prove the policy engine matching works end-to-end), then
Route A' for production work.

## Open research questions

These are the parts library purchase won't solve:

### How a client obtains a VC in the first place

OID4VCI (OpenID for Verifiable Credential Issuance) handles this for
the OAuth/OIDC ecosystem; for Solid, there's no standard. Inrupt has
their own flow (gConsent issuance); it's tied to ESS. We'd need to
either:
- Build our own VC issuer service (Pod owner approves access request →
  signs Access Grant VC)
- Adopt OID4VCI (ecosystem alignment but heavy)
- Skip issuance entirely and use pre-existing VCs from external issuers
  (e.g., university-issued credentials)

### How a Pod expresses what VCs it accepts

ACP says you can match `acp:vc <id>`. It doesn't say *how* the Pod
advertises that it has policies referencing that VC, or how a client
discovers what VCs would unlock access. Our capability catalog pattern
(D83) at `/vault/meta/capabilities/` could host this affordance, but
it's bespoke. UMA's `WWW-Authenticate: UMA` ticket flow handles
discovery implicitly via the AS.

### Trust establishment

"I verified the signature" doesn't equal "I trust the issuer."
Production deployments use trust frameworks (eIDAS, EUDI wallet,
Hyperledger Aries governance, etc.); we have none. For an agentic Pod
where Pod owners issue their own Access Grants, the trust framework
might collapse to "trust VCs issued by this Pod's owner." For
cross-Pod federation, this gets harder.

### Wallet UX for agents

A human user holds VCs in a wallet (browser extension, mobile app). An
agent (Claude Code, dspy.RLM, future autonomous workers) needs an
equivalent — a credential store with DPoP-bound key, or a delegation
token mechanism. This is the agent-identity work tracked in
`.claude/skills/solid-identity-stack/references/agent-identity.md` and
D14 (alsoKnownAs DID-WebID bridge).

Open questions: should agents have DIDs? VCs? Both? How does a
human-issued delegation propagate to a spawned subagent?

## Implementation triggers

This roadmap is not on the current sprint plan. It activates when one
or more of these signals fire:

- **Rung 1.5 evaluation surfaces a multi-agent threat model** that
  requires more than WebID + client_id distinction (e.g., scoped
  delegation, time-bound capabilities, cross-Pod federation).
- **A specific use case demands VC-gated access** — e.g., "only an
  agent with the `WikiResearcher` VC may read `/wiki/sources/draft/`",
  or a cross-institution data-sharing scenario.
- **Solid community standardizes** a VC-claim-token flow for UMA AS
  beyond Inrupt's proprietary implementation — at which point Route A'
  becomes a contribution rather than a one-off.
- **SolidLab's `demo/trust-envelope-use-case` branch** matures into a
  shippable VC story; we adopt it rather than build our own.

When implementation triggers, the next step is a *spec* in
`docs/superpowers/specs/` capturing the concrete sprint scope, followed
by a plan in `docs/superpowers/plans/`. This document remains a
reference for the research backing those decisions.

## Related

- `docs/plans/2026-05-18-wiki-search-walker-redesign.md` — the
  immediate work that positions us for VC by inheriting auth context
- `.claude/skills/solid-identity-stack/references/dpop.md` — Solid-OIDC
  + DPoP, the foundation VCs build on
- `.claude/skills/solid-identity-stack/references/vc.md` — short
  upstream-derived VC reference
- `.claude/skills/solid-identity-stack/references/agent-identity.md` —
  the agent-identity question VCs partially answer
- D14 (alsoKnownAs DID-WebID bridge) — relates to agent identity
- D87 / D88 — capability catalog and template vocabulary; potential
  hosts for VC discovery affordances

## Sources

- [W3C VC Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
  (Recommendation, 15 May 2025)
- [W3C VC Overview](https://www.w3.org/TR/vc-overview/)
- [Securing VCs using JOSE and COSE](https://www.w3.org/TR/vc-jose-cose/)
- [SD-JWT-VC draft](https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-03.html)
- [@digitalbazaar/vc](https://github.com/digitalbazaar/vc)
- [@digitalcredentials/vc fork](https://www.npmjs.com/package/@digitalcredentials/vc)
- [Veramo](https://veramo.io/)
- [Sphereon SSI SDK](https://github.com/Sphereon-Opensource/SSI-SDK)
- [did-resolver (DIF)](https://github.com/decentralized-identity/did-resolver)
- [SolidLabResearch/user-managed-access](https://github.com/SolidLabResearch/user-managed-access)
- [SolidLab UMA getting-started doc](https://github.com/SolidLabResearch/user-managed-access/blob/main/documentation/getting-started.md)
- [Inrupt Access Grants client library](https://github.com/inrupt/solid-client-access-grants-js)
- [Inrupt ESS /verify endpoint docs](https://docs.inrupt.com/ess/latest/services/service-access-grant/service-access-grant-verifier.md)
- [Inrupt ESS UMA service docs](https://docs.inrupt.com/ess/latest/services/service-uma)
- [UMA 2.0 Grant for OAuth 2.0 (Kantara)](https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html)
- [UMA 2.0 Federated Authorization (Kantara)](https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-federated-authz-2.0.html)
- [A4DS spec (SolidLab's UMA additions)](https://spec.knows.idlab.ugent.be/A4DS/L1/latest/)
