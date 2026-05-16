---
name: solid-identity-stack
description: The Solid identity, authentication, authorization, and provenance stack on a Solid Pod — WebID, Solid-OIDC, DPoP, WAC/ACP, Verifiable Credentials, DIDs, AI-agent identity, multi-WebID Pods, and PROV-O audit trails. Use this skill whenever the user mentions WebID, OIDC, DPoP, ACL, ACR, ACP, WAC, verifiable credentials, VCs, access grants, DIDs, decentralized identifiers, agent identity, app identity, audit trail, provenance, authentication, authorization, access control, or any aspect of who-can-do-what on a Pod. Also invoke when designing ACL policies, debugging Solid-OIDC client integration, working out how AI agents (Claude Code, dspy.RLM, vault-importer) should authenticate, or reasoning about cross-Pod federation. Even when the user doesn't say "identity stack" — questions like "can a Pod have multiple users?", "how does an app authenticate?", "how do we tag who wrote this?", or "should we use WAC or ACP?" all live here.
---

# Solid Identity Stack

A request to a Solid Pod traverses five layers, each governed by a different
spec. This skill gives you a rough working understanding of all five — plus
the cross-cutting concerns (VCs, DIDs, multi-WebID Pods, AI-agent identity,
provenance) — so you can reason about identity work on this Pod without
re-deriving from spec every time.

The skill is **reference, not prescription**. Reference files are short
summaries with spec URLs. When a question gets specific, fetch the linked
spec. The skill keeps you oriented; the specs are authoritative.

## The stack at a glance

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 5 — Provenance (who, on whose behalf, when)           │
│   PROV-O materialized into .meta via MonitoringStore hook   │
│   See: references/agent-identity.md                          │
├─────────────────────────────────────────────────────────────┤
│ Layer 4 — Authorization (what this agent may do)            │
│   ACP (preferred) or WAC (legacy CSS default)               │
│   See: references/acp.md, references/wac.md                  │
├─────────────────────────────────────────────────────────────┤
│ Layer 3 — Token binding (this request really is from them)  │
│   DPoP (RFC 9449) — per-keypair cnf claim                    │
│   See: references/dpop.md                                    │
├─────────────────────────────────────────────────────────────┤
│ Layer 2 — Authentication (subject proves it's them)          │
│   Solid-OIDC — DPoP-bound tokens, webid + azp claims        │
│   See: references/solid-oidc.md                              │
├─────────────────────────────────────────────────────────────┤
│ Layer 1 — Identity (who is the subject)                     │
│   WebID — HTTP IRI → RDF profile declaring foaf:Agent        │
│   See: references/webid.md                                   │
└─────────────────────────────────────────────────────────────┘
```

Cross-cutting concerns layered onto the stack:

- **Verifiable Credentials** — VC-gated access via `acp:vc` matchers, or
  Inrupt's gConsent Access Grants. → [references/vc.md](references/vc.md)
- **Decentralized Identifiers (DIDs)** — self-sovereign identity for AI
  agents, bridged to WebIDs via `alsoKnownAs`. → [references/did.md](references/did.md)
- **AI-agent identity** — Claude Code, dspy.RLM, vault-importer as
  `foaf:Agent` client_id documents; per-instance binding via DPoP
  thumbprint; provenance via PROV-O. → [references/agent-identity.md](references/agent-identity.md)
- **Multi-WebID Pods** — one Pod hosting multiple agent identities (lab Pod,
  org Pod, family Pod). → [references/multi-webid-pod.md](references/multi-webid-pod.md)

## How to use this skill

You're not expected to read all of this up front. The pattern is:

1. The diagram above plus the routing table below should be enough to
   orient you on any identity question.
2. When you need depth on a specific layer or concern, open the relevant
   reference file.
3. When the reference file isn't enough, fetch the spec URLs it cites.
4. Project-specific positions (decisions, current state, divergences from
   upstream) live in the reference files marked "How this Pod uses it" and
   in the active design doc.

## Routing table — common questions

| Question | Read |
|---|---|
| What IS a WebID? How does it differ from the profile document? | [webid.md](references/webid.md) |
| Can a WebID identify an organization, not a person? | [webid.md](references/webid.md), [multi-webid-pod.md](references/multi-webid-pod.md) |
| How does a client (browser, CLI, AI agent) authenticate? | [solid-oidc.md](references/solid-oidc.md) |
| What's a `client_id` document? Why does it matter for AI agents? | [solid-oidc.md](references/solid-oidc.md), [agent-identity.md](references/agent-identity.md) |
| How does the Pod know a request actually came from the authenticated agent? | [dpop.md](references/dpop.md) |
| What's `cnf`, `jkt`, `azp`? | [solid-oidc.md](references/solid-oidc.md), [dpop.md](references/dpop.md) |
| Should we use WAC or ACP? | [wac.md](references/wac.md), [acp.md](references/acp.md) — TL;DR: ACP if any agent/app/VC matching is needed |
| How do we say "Claude Code, but only when acting for Charles, may write"? | [acp.md](references/acp.md), [agent-identity.md](references/agent-identity.md) |
| How are Verifiable Credentials integrated? | [vc.md](references/vc.md) |
| Why are there two unrelated things called "Access Grant"? | [vc.md](references/vc.md) (Inrupt gConsent vs Apps Interop name collision) |
| Should AI agents have DIDs or WebIDs? | [did.md](references/did.md), [agent-identity.md](references/agent-identity.md) |
| Can a Pod host multiple WebIDs? (lab Pod with member identities) | [multi-webid-pod.md](references/multi-webid-pod.md) |
| How do we tag who wrote a resource? (audit trail) | [agent-identity.md](references/agent-identity.md) |
| What's the project's current position on all of this? | [Design doc](#project-position) below |

## Project position

This Pod's working position on the identity stack is captured in:

**`docs/plans/2026-05-16-identity-and-provenance-design.md`**

That document is a *working* design doc — not yet ratified into D-numbered
decisions. As parts ratify, they migrate into the project's decisions log
(see `decision-lookup` skill) and the reference files here pick up
"see D-N" pointers. Until then, the design doc is the authoritative
project position.

Key positions currently captured:

- **Person identity vs role** — separate the bibliographic-author role from
  the social-contact role; same identity, multiple shapes. Open question
  on `wiki:Person` ↔ `vcard:Individual` relation.
- **Organization identity** — WebIDs are spec-legal for orgs; ROR as
  `owl:sameAs` fallback; time-scoped affiliation via `org:Membership`.
- **Agent authentication and provenance** — Pod-local client_id documents
  at `/agents/{claude-code,rlm-substrate,vault-importer}`; PROV-O
  materialization via a `ProvenanceCommitListener` (mirrors
  `MementoCommitListener`); resource-level provenance for v1.
- **ACL framework** — ACP over WAC, recommended before any ACL turn-on.
- **DIDs as eventual destination** — self-sovereign agent identity bridged
  via D14 (`alsoKnownAs`) when federation matters.

These are working positions, subject to refinement.

## When this skill triggers

Invoke this skill for any of:

- Authentication / authorization / access control on the Pod
- Designing ACL or ACR (access control resource) policies
- Implementing or debugging Solid-OIDC client integration
- Working with `@inrupt/solid-client-authn-*`, `solid-client-access-grants-js`,
  or any Solid auth library
- Reasoning about AI agent identity (Claude Code, dspy.RLM, vault-importer)
- Provenance, audit trail, or "who did this write?" questions
- Cross-Pod federation, multi-WebID Pods, lab Pods, org Pods
- Verifiable Credentials work (W3C VC, Inrupt gConsent)
- DID integration questions
- Anything that touches `.acl` or `.acr` resources

Adjacent skills that may also apply:

- **`solid-spec`** — Solid Protocol semantics generally (this skill drills
  deeper on the identity slice)
- **`solid-integration-guide`** — Inrupt SDK, solid-client-authn, etc. (use
  alongside this skill when implementing clients)
- **`solid-servers`** — CSS configuration patterns (relevant for
  ACP-vs-WAC config switch)
- **`decision-lookup`** — D14 (DID-WebID bridge) and any future
  D-numbered ratifications of identity-stack positions

## Versioning

Spec versions cited in reference files are pinned at the time of writing.
Specs evolve; refresh when working on identity-stack code. The
`solid-spec-documents` skill is the canonical URL index with version pins
across the broader Solid spec ecosystem.
