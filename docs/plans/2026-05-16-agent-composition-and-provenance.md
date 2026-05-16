# Agent Composition and Provenance — A Solid-Native Working Document

> **Status: Work in Progress (2026-05-16)**
>
> This is a working design document, not a decision. It captures the
> conversation that surfaced "agent" as a layered concept rather than a
> monolith, and explores how that might be implemented on Solid primitives.
> Most open questions remain open by intent — they need user-story analysis
> and additional research before commitments.
>
> Decisions ratified out of this document will move into the project's
> decisions log (via `decision-lookup` skill) and the `solid-identity-stack`
> skill's reference files. Until then, treat everything here as candidate
> thinking.
>
> **Notation:** Throughout this document, `<ns>:` is a placeholder for a
> Pod-substrate vocabulary prefix that has not been chosen yet (candidates
> include `pa:`, `pact:`, others). The IRI base will be
> `https://pod.vardeman.me/ontology/agent#` per D84 (Pod-as-namespace-authority,
> hash namespace). Prefix decision deferred.

---

## Why this document exists

This is the companion to `2026-05-16-identity-and-provenance-design.md`
(the survey doc). That doc's Thread 3 names the problem — AI agents act
on the principal's behalf; the audit trail needs to capture who-on-whose-
behalf — and proposes Pod-local `client_id` documents at `/agents/<name>`
plus PROV-O materialization via a write-time listener.

When we tried to elaborate Thread 3, two things happened. First, the
underlying decomposition turned out to be load-bearing in ways that
deserve their own working space (composition as authorized scope, not
just a metadata field). Second, the KYA-OS / DIF "Know Your Agent" work
came into view, and clarifying what we're *not* doing relative to KYA
became important.

**This is not an implementation of KYA-OS.** KYA-OS is an emerging spec
from DIF (with a separate `open-kya/kya-standard` community effort) that
proposes a flat "agent passport" model. It has no Solid integration; the
delegation, attestation, and operational-constraint patterns it proposes
would be new infrastructure if adopted as-is.

What this document proposes is **a Solid-native design for agent
identity, composition, and delegation**, drawing on the broader DID/VC
methodology, anchored in PROV-O, and aligned where possible with Inrupt's
existing gConsent Access Grant VC structures. KYA-OS appears in the
reference landscape as one of several inputs — alongside PROV-O, DPV,
GNAP, ActivityPods — not as a dependency.

The substantive contribution beyond what's already in Solid is the
**composition layer**: the recognition that what a principal authorizes
is the specific assembly of harness + model + tools + skills, not the
abstract software identity.

---

## Why "agent" needs to be decomposed

KYA-OS, gConsent, and most off-the-shelf "agent identity" thinking treat
an agent as a single entity with one identifier. For Solid Pods used as
agentic memory substrates, that's wrong in interesting ways:

- **"Claude Code" is not one thing.** It's a harness, plus a model, plus a
  set of tools loaded, plus skills active, plus working directory context.
  Two sessions of "Claude Code" on the same laptop with different skills
  loaded behave differently. The principal authorized one composition;
  the other is a different artifact.

- **What a principal authorizes is the assembly, not the brand.** If
  Anthropic ships a new tool tomorrow and the harness picks it up, prior
  authorization shouldn't auto-extend. The agentic equivalent of OAuth
  incremental authorization: each new scope requires re-consent, and "what
  tools/skills the agent has" is a kind of scope.

- **Instances and classes diverge.** Two Claude Code instances on two
  laptops may have identical composition fingerprints but distinct DPoP
  keypairs. They're the same thing for authorization; different things
  for audit.

- **Ecosystems exist.** A single principal may run multiple agents
  (interactive harness on a laptop, autonomous research substrate on a
  server, scheduled CLI in CI, possibly federated peers). All write to
  the same Pod. Provenance must disambiguate.

The decomposition below names these distinctions explicitly.

---

## The five-layer decomposition

| Layer | What it is | Lifecycle | Example |
|---|---|---|---|
| **Principal** | The party bearing responsibility | Years | Charles — `https://pod.vardeman.me/profile/card#me` |
| **Agent class** | The published software identity | Versioned releases | "Claude Code" — `did:web:claude.ai:agents:claude-code` (eventually); `https://pod.vardeman.me/agents/claude-code` (today) |
| **Composition** | Harness + model + tool set + skill set + env — the specific assembly the principal authorized | Per-configuration | Claude Code v1.x + Opus 4.7 + {Read, Write, Bash, Skill, Agent} + {`solid-identity-stack`, `decision-lookup`, ...} + cwd `/Users/cvardema/dev/.../cogitarelink-solid` |
| **Instance** | The running process | Per-session, ephemeral | This session's DPoP keypair, thumbprint `jkt: 0ZcO...` |
| **Ecosystem** | The set of all instances acting for one principal across machines | Long-lived, fluid membership | All of Charles's agents — Claude Code on laptop, dspy.RLM on server, vault-importer in cron, future Hermes-style agents |

The decomposition maps onto PROV-O cleanly. **Crucially, composition is a
`prov:Plan`, not an `Agent`.** Plans prescribe how activities proceed;
agents bear responsibility. KYA-OS's collapse of these into a single
identifier is the conceptual error to avoid.

### Worked PROV-O example

```turtle
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix as:   <https://www.w3.org/ns/activitystreams#> .
@prefix ns:   <https://pod.vardeman.me/ontology/agent#> .  # prefix TBD

# A single write becomes a prov:Activity
<urn:uuid:write-abc-123> a prov:Activity ;
    prov:startedAtTime "2026-05-16T17:43:00Z"^^xsd:dateTime ;
    prov:generated </wiki/people/jane> ;
    prov:wasAssociatedWith
        <https://pod.vardeman.me/profile/card#me> ,    # principal
        <urn:uuid:session-xyz> ;                       # instance
    prov:hadPlan <urn:hash:composition-fp> ;           # composition
    prov:qualifiedAssociation [
        prov:agent <urn:uuid:session-xyz> ;
        prov:hadRole ns:delegatedWriter ;
        prov:atTime "2026-05-16T17:43:00Z"^^xsd:dateTime ;
    ] .

# The instance, identified by ephemeral keypair
<urn:uuid:session-xyz> a prov:SoftwareAgent ;
    prov:actedOnBehalfOf <https://pod.vardeman.me/profile/card#me> ;
    prov:wasInformedBy <https://pod.vardeman.me/agents/claude-code> ;
    prov:hadPlan <urn:hash:composition-fp> ;
    ns:dpopThumbprint "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I" ;
    ns:atLocation <urn:host:cv-macbook-2026> ;
    prov:startedAtTime "..."^^xsd:dateTime .

# The composition — a prov:Plan, NOT an Agent
<urn:hash:composition-fp> a prov:Plan, ns:Composition ;
    ns:harness <https://pod.vardeman.me/agents/claude-code> ;
    ns:harnessVersion "1.x" ;
    ns:model <https://anthropic.com/models/claude-opus-4-7> ;
    ns:toolSet ns:tool/Read, ns:tool/Write, ns:tool/Bash, ns:tool/Skill ;
    ns:skillSet <https://pod.vardeman.me/.claude/skills/solid-identity-stack>,
                <https://pod.vardeman.me/.claude/skills/decision-lookup> ;
    ns:environment <urn:env:cogitarelink-solid-repo> .

# The agent class
<https://pod.vardeman.me/agents/claude-code> a prov:SoftwareAgent, as:Application ;
    schema:publisher <https://anthropic.com> ;
    foaf:name "Claude Code" .

# The principal
<https://pod.vardeman.me/profile/card#me> a foaf:Person, prov:Person .
```

Queries this makes possible:
- "Who wrote this?" → trace `prov:wasAssociatedWith` to the principal
- "Which software wrote this?" → trace to agent class
- "Which model wrote this?" → `prov:hadPlan → ns:model`
- "Which session?" → instance
- "Was this written under a composition I'd authorized?" → check composition fingerprint against the active delegation grant

---

## What Solid already provides

Mapping each layer to what's standard-in-Solid (or directly proposed
within it) vs what we'd be inventing:

| Layer | Solid-native answer | Status |
|---|---|---|
| **Principal** | WebID + Solid-OIDC `webid` claim | ✓ Standard, works today |
| **Agent class** | client_id document as `foaf:Agent + as:Application` | ✓ Standard, just mint them |
| **Composition** | *nothing* | ✗ **Genuinely novel work** |
| **Instance** | DPoP `cnf.jkt` thumbprint (RFC 9449) | ✓ Standard, works today |
| **Ecosystem** | Implicit via WebID matching across `acp:agent` policies | ✓ Standard, works today |

**The composition layer is the only place where we'd be inventing.**
Everything else is Solid-native or trivially derivable from Solid
mechanisms.

For delegation specifically, Solid already has two proposed answers
(Inrupt's gConsent Access Grants and Apps Interop's non-VC Access
Grants), plus ACP's `acp:vc` matcher infrastructure. We don't have to
invent delegation — we have to choose and extend.

---

## User stories driving the design

These are the anchor. The technical bits below are responses to needs
that surface in concrete scenarios. **More stories needed — this is a
starting set.**

### Story 1 — Claude Code in this repo (interactive, high-trust, dev workflow)

Charles is sitting at his laptop in `~/dev/git/LA3D/agents/cogitarelink-solid/`,
running Claude Code via Claude Desktop. He wants Claude Code to be able
to read and write any file in this repo, push commits, run tests, and
read/write to the Pod for design-doc-related work. He trusts the
composition because he chose it (he selected the skills, the harness is
managed by Anthropic, he's in front of the laptop).

**What this implies:**
- Authorization scope: broad ("anything in this project, plus the Pod")
- Lifetime: long-lived (per-laptop, per-project — not per-session)
- Composition fingerprint: matters less here because trust is high; but
  if the harness picks up an unknown tool, that's a signal worth flagging
- Workflow: probably one-time approval per project setup, stored in
  `.claude/` or equivalent

**Open question for this story:** what does "approval stored in `.claude/`"
look like? Is it a gConsent VC the user signed once, persisted locally?
A bookmark file referencing a longer-lived grant on the Pod? A simple
declarative ACR entry in the Pod's config?

### Story 2 — dspy.RLM autonomous research agent (server, scoped, semi-autonomous)

The RLM substrate is running on a server somewhere, executing research
tasks. It needs to read references, write hypothesis notes to a
designated working container, and read/write to its working memory area.
It should not be able to delete arbitrary resources, write to
`/wiki/published/`, or talk to the network beyond a fixed allowlist.
Charles isn't watching it run; trust comes from constraints, not
supervision.

**What this implies:**
- Authorization scope: narrow ("read /wiki/sources/, write /wiki/working/rlm/")
- Lifetime: time-boxed (per research-task, hours to days)
- Composition fingerprint: matters a lot — if the RLM substrate picks up
  a new tool, authorization should fail closed
- Operational fuses: rate limit (writes/hour), permitted egress domains,
  permitted time-of-day potentially
- Workflow: per-task delegation grant, possibly issued by Charles via a
  CLI when he launches the task

**Open question for this story:** is the RLM agent a per-task delegation
(new VC per research session) or a long-lived authorization with
per-task narrow scoping? Tradeoffs in usability vs revocation
granularity.

### Story 3 — vault-importer CLI cron job (scheduled, narrow, headless)

A cron job runs `vault_import.py` weekly. It reads from `~/Obsidian/obsidian/`
and writes to specific Pod containers. Headless, no human in the loop at
run time. Trust comes from the script being committed to the repo and
the schedule being explicit.

**What this implies:**
- Authorization scope: very narrow ("write only to /vault/wiki/pages/,
  /vault/wiki/concepts/, etc., never delete")
- Lifetime: long-lived but renewable (annual? until script changes?)
- Composition fingerprint: matters — if the script changes substantively,
  authorization should require re-grant
- Operational fuses: rate limit (1000 writes/hour cap), no egress beyond
  the Pod itself, time-of-day permitted only during scheduled run windows
- Workflow: one-time grant when the cron is set up, with the VC stored
  in the CI environment securely

**Open question for this story:** for headless agents, the principal
can't be in the loop at run time. The VC must be issued in advance and
travel with the agent. How does the VC's `expirationDate` interact with
the principal's expectation of "this should keep running indefinitely
until I revoke"? Auto-renewing grants?

### Story 4 — Hypothetical Hermes-style autonomous agent

Charles spins up an autonomous Hermes-style agent that's supposed to,
say, monitor citation flows and propose new wiki pages when a paper
clusters with existing work. Lower trust than dspy.RLM (less battle-
tested), runs unattended, has potentially adversarial failure modes
(e.g., proposing pages that misrepresent sources).

**What this implies:**
- Authorization scope: extremely narrow ("read /wiki/sources/, propose
  drafts to /vault/wiki/working/hermes-proposals/" — but never publish)
- Lifetime: short, possibly per-run with manual re-issue
- Composition fingerprint: critical — tools should be minimal (no
  network access, no general write)
- Operational fuses: rate limit (10 writes/hour), strict egress allowlist,
  required human review before any working-memory promotion
- Workflow: explicit grant per launch, with a verbose review step

**Open question for this story:** how does the substrate enforce
"propose drafts but never publish"? Resource-scope ACL gets us part of
the way (only `/vault/wiki/working/hermes-proposals/`), but the
working→published promotion is a separate workflow that needs its own
authorization gate. Two-stage commit (D73) is relevant here.

### Story 5 — Federated collaborator agent (cross-Pod, partial trust)

A collaborator (Bob) runs an agent that wants to read public sections of
Charles's Pod (e.g., `/vault/wiki/public/`) for a joint research project.
Bob's agent is hosted on Bob's infrastructure, has Bob's WebID. Charles
trusts Bob, doesn't necessarily trust the agent.

**What this implies:**
- Authorization scope: very narrow ("read /vault/wiki/public/", nothing
  else)
- Lifetime: time-boxed (project duration)
- Composition fingerprint: less critical because trust is via Bob's
  authority, not via Charles's vetting of Bob's stack
- Operational fuses: rate limit per courtesy
- Workflow: delegation chain — Bob signs the request, Charles signs the
  grant; Bob's agent presents both

**Open question for this story:** does Charles trust Bob (and inherit
Bob's authorization of his own agent), or does Charles need to verify
Bob's agent's composition directly? Two different trust models with
different operational implications.

### Story 6 — Sub-agent spawning (process composition)

This Claude Code session spawns a research subagent (the `Agent` tool).
The subagent does some work, returns a result. The subagent's writes
to the Pod (if any) should be attributable.

**What this implies:**
- Same instance from the Pod's perspective (same DPoP keypair, same
  process — assuming the subagent isn't a separate process)
- Sub-activity granularity in provenance (`prov:wasInformedBy
  <subagent-task-id>`)
- No new authorization needed — operates under the parent's grant
- Workflow: implicit, captured automatically in PROV-O sub-activities

**Open question for this story:** when sub-agents call out to external
APIs (web fetch, MCP servers), should those calls also accrue provenance?
At what granularity?

### What's surfaced by walking these stories

Cross-cutting concerns surfacing across the user stories:

1. **Workflow heterogeneity.** Authorization for Story 1 (one-time, broad,
   per-project) looks nothing like Story 4 (per-launch, narrow, verbose
   review). The same VC infrastructure has to support both ends of the
   spectrum.
2. **Composition fingerprinting matters more for low-trust scenarios.**
   For Story 1 it's nice-to-have; for Story 4 it's load-bearing security.
3. **Lifetime ranges across orders of magnitude.** Per-launch (Story 4),
   per-session (any), per-task (Story 2), per-project (Story 1, 5),
   indefinite-until-revoked (Story 3). Renewal semantics matter.
4. **Operational fuses are mostly about low-trust scenarios.** For high-
   trust scenarios they're courtesy rate-limiting; for low-trust they're
   real security boundaries.
5. **The "Authorization Agent" concept differs per story.** For Story 1
   it could be an extension to Claude Code; for Story 4 it's a deliberate
   CLI step Charles takes; for Story 5 it's a cross-Pod negotiation.

These cross-cuts inform what kind of Authorization Agent we need to
design.

---

## The composition layer — the novel piece

A composition manifest is a self-reported declaration of what the agent
*is* at this moment:

```turtle
<urn:hash:composition-fp-abc123> a prov:Plan, ns:Composition ;
    ns:harness <https://pod.vardeman.me/agents/claude-code> ;
    ns:harnessVersion "1.x" ;
    ns:model <https://anthropic.com/models/claude-opus-4-7> ;
    ns:toolSet ns:tool/Read, ns:tool/Write, ns:tool/Bash, ns:tool/Skill,
               ns:tool/Agent, ns:tool/WebFetch ;
    ns:skillSet
        <https://pod.vardeman.me/.claude/skills/solid-identity-stack>,
        <https://pod.vardeman.me/.claude/skills/decision-lookup>,
        <https://pod.vardeman.me/.claude/skills/components-override> ;
    ns:environment <urn:env:cogitarelink-solid-repo> ;
    ns:fingerprintAlgorithm <urn:algo:sha256-rdf-canonical> ;
    prov:wasAttributedTo <https://pod.vardeman.me/agents/claude-code> .
```

The hash is computed over the canonicalized RDF of the manifest (e.g., URDNA2015).
That hash IS the composition identifier — it changes deterministically when
any field changes.

**Two transport options for the manifest** (open question):

- **Per-request signed header.** Agent sends `Pod-Agent-Composition: <signed
  manifest JSON-LD>` on every request. Fresh, no persistence overhead, no
  TOCTOU window between manifest update and authorization check.
- **Persisted at `/agents/<name>/composition/<hash>`.** LDP resource, agent
  references it by URL in requests. Queryable, cacheable, reusable across
  requests. Adds persistence overhead and a small TOCTOU surface.

For high-trust low-frequency cases, persisted is cleaner. For autonomous
agents in low-trust mode, per-request signed is more defensive. Probably
support both. Defer the decision.

---

## Solid-native delegation via Inrupt's gConsent

We commit to **gConsent VC alignment** as the baseline delegation format,
extending it with `<ns>:` fields rather than minting a parallel VC type.
This preserves interop with Inrupt's existing VC verifier ecosystem and
keeps us inside the W3C VC + Solid Apps Interop ecosystem.

### The base gConsent grant (unchanged)

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://schema.inrupt.com/credentials/v1.jsonld",
    "https://vc.inrupt.com/credentials/v1"
  ],
  "type": ["VerifiableCredential", "SolidAccessGrant"],
  "issuer": "<Authorization Agent URL>",
  "issuanceDate": "2026-05-16T...",
  "expirationDate": "2026-05-23T...",
  "credentialSubject": {
    "id": "<grantor WebID>",
    "providedConsent": {
      "mode":            ["Read", "Write"],
      "forPersonalData": "<resource URL>",
      "hasStatus":       "ConsentStatusExplicitlyGiven",
      "isProvidedTo":    "<grantee WebID>"
    }
  },
  "credentialStatus": { ... },
  "proof": { ... }
}
```

Note the gConsent quirk: `credentialSubject.id` is the grantor (Charles),
not the grantee. The grantee lives at `isProvidedTo`. Unintuitive but
inherited from gConsent semantics; we live with it.

### The flow on this Pod

1. **Agent needs access** — Claude Code (in any story above) wants to
   write to a resource.
2. **Access Request VC** sent to an **Authorization Agent** (see open
   questions below — this is the biggest unresolved piece).
3. **Principal reviews and grants** — workflow varies by story.
4. **Authorization Agent issues a `SolidAccessGrant` VC**, signed by the
   AA's issuer key.
5. **Agent receives the grant** and includes it in subsequent requests
   to the Pod (header or presentation endpoint).
6. **Pod-side verifier** (a new CSS extension) validates:
   - VC signature valid, issuer trusted
   - Not revoked (StatusList2021)
   - Grantor owns the resource
   - Grantee matches the OIDC `azp` claim
   - Mode + resource match the request
   - **(Extended)** Composition fingerprint matches if `<ns>:requiresCompositionHash`
     is present
   - **(Extended)** Operational fuses respected if `<ns>:operationalLimits`
     present
7. **ACP `acp:vc` matcher** fires; policy allows the operation.
8. **PROV-O materialization** in `.meta` records principal, class,
   composition, instance.

---

## Candidate extensions (analysis, not commitment)

Three KYA-OS-inspired ideas, expressed as additive fields in
`credentialSubject.providedConsent`. Existing gConsent verifiers ignore
unknown fields; our verifier enforces them.

### Extension 1 — Composition binding

```json
"providedConsent": {
  "mode": ["Read", "Write"],
  "forPersonalData": "<resource URL>",
  "isProvidedTo": "<grantee WebID>",
  "<ns>:requiresCompositionHash": "urn:hash:sha256:abc123..."
}
```

Verifier semantics: agent must present a composition manifest whose hash
matches. If the harness picks up a new tool, the manifest hash changes,
the grant fails closed.

### Extension 2 — Operational fuses

```json
"providedConsent": {
  ...,
  "<ns>:operationalLimits": {
    "<ns>:maxWritesPerHour":      100,
    "<ns>:permittedEgressDomains": ["pod.vardeman.me", "github.com"],
    "<ns>:permittedTimeOfDay":     "06:00-22:00",
    "<ns>:maxBytesPerRequest":    1000000
  }
}
```

Verifier semantics: enforced at substrate's request-rate / routing
middleware. Sub-question of whether fuses live on grants (per-VC) or on
agent profiles (per-class baseline). Probably both — profile gives
defaults, grant tightens.

### Extension 3 — Purpose binding (DPV alignment)

W3C [Data Privacy Vocabulary](https://w3c.github.io/dpv/dpv/) is Rec-track,
GDPR-aligned. Aligning the grant with DPV:

```json
"providedConsent": {
  ...,
  "dpv:hasPurpose":   "dpv:AcademicResearch",
  "dpv:hasProcessing": ["dpv:Collect", "dpv:Analyse"]
}
```

DPV is the right vocabulary for purpose; doesn't have to land in v1.

---

## What we're not taking from KYA

For completeness:

- **TEE attestation (SGX/MRENCLAVE).** Different trust model. We trust the
  agent class (Anthropic) and the composition fingerprint; we don't need
  to verify what silicon it ran on.
- **Ricardian contracts and disputeResolution.** Legal-recourse territory,
  irrelevant for personal/lab memory.
- **`SolvencyCredential`, `InsuranceCredential`, `AuditCredential` evidence.**
  E-commerce trust signals, not memory primitives.
- **KYA vocabulary direct adoption (`kya:` prefix).** We'd be tracking
  their spec. They have no Solid integration. We coin our own substrate
  vocab.
- **KYA Manifest-as-VerifiablePresentation as the agent profile format.**
  Heavier than what we need. Pod-local client_id documents are sufficient
  for our use case; if we later want cryptographic verifiability we can
  wrap them as VPs.

We watch the DIF KYA-OS work; we don't depend on it.

---

## The Authorization Agent — the biggest open question

Across all the user stories, the role of "Authorization Agent" recurs but
its shape isn't fixed. Candidate models:

**Model A — Pod-local AA.** A CSS extension that mounts at
`/.well-known/auth-agent` or similar, accepts Access Requests, prompts the
principal (via some UI), issues grants signed by a Pod-key. Pros:
self-contained, no external dependency, principal controls issuance.
Cons: needs a UI; principal must be online; doesn't federate cleanly.

**Model B — Inrupt's hosted AA at `https://vc.inrupt.com/`.** Use the
existing production service. Pros: works today, federation-ready (other
Inrupt-aware Pods accept its grants). Cons: vendor dependency, Inrupt-
issued grants would carry Inrupt's issuer URL rather than Charles's.

**Model C — Self-hosted AA via an Inrupt-compatible implementation.** Run
the Inrupt VC issuer software (if open source) or a compatible
implementation, on this Pod or alongside it. Pros: no vendor lock-in,
issuer URL is under principal's control, interop with Inrupt-aware Pods.
Cons: operational complexity, maintenance burden.

**Model D — Hybrid: Pod-local for personal use, Inrupt for federation.**
Same Pod issues grants for its own agents (Stories 1-4) but federates
delegations involving external parties via Inrupt's AA (Story 5).
Complex but matches the user-story heterogeneity.

The Authorization Agent design is downstream of these workflow questions:

- **How does the principal authorize?** UI? CLI? Config file? Standing
  policy that auto-approves matching requests? Different stories want
  different mechanisms.
- **Where does the grant live between issuance and use?** With the agent
  (presented per request)? With the AA (looked up by reference)? In an
  Authorization Registry (Apps Interop pattern)?
- **How is revocation triggered?** Manual via UI? Automatic on
  composition change? Time-based?
- **How does the AA verify the principal's identity at the moment of
  grant?** Solid-OIDC login? Local presence (filesystem-based attestation)?
  Multi-factor?

**This is the single largest unresolved area. Most other open questions
collapse into Authorization Agent design choices.**

---

## Consolidated open questions

Q1. **Prefix.** `pa:`, `pact:`, `actor:`, something else? Pod root IRI is
fixed (`https://pod.vardeman.me/ontology/agent#`); prefix string deferred.

Q2. **Composition manifest transport.** Per-request signed header vs
persisted LDP resource at `/agents/<name>/composition/<hash>`. Probably
support both; choose default.

Q3. **Composition mutability mid-session.** Three approaches:
   - Snapshot at session start, lock it
   - Re-fingerprint on every relevant change; record transitions as
     `prov:Activity` of type `<ns>:CompositionChanged`
   - Track cumulative composition (union of all tools/skills used)
   Each has different security properties; choice depends on what
   threats we're modeling.

Q4. **Composition fingerprint contents.** Harness + version + model +
toolSet + skillSet seem required. Environment (cwd, OS, language)
borderline. Loaded MCP servers — yes. Conversation context — no.

Q5. **Authorization Agent model.** A / B / C / D from the previous
section. The big one.

Q6. **Grant lifetime defaults per story.** Story 1 (per-project, months),
Story 2 (per-task, hours-days), Story 3 (per-cron-cycle, weeks-months),
Story 4 (per-launch), Story 5 (per-project). Default values to ship
with?

Q7. **Operational fuse semantics.** On the grant (per-VC) vs on the
agent profile (per-class baseline). Probably both, with grant tightening
profile defaults.

Q8. **Composition fingerprint algorithm.** URDNA2015 + SHA-256? Some
JSON-LD-specific canonicalization? Pick a stable, implementable algo.

Q9. **Verifier extension architecture.** Mirrors `MementoCommitListener`
in structure (CSS extension, MonitoringStore CDC pattern). What's the
order vs. ACP — verifier runs first as pre-authz, then ACP as authz?
Or both compose into a single matcher chain?

Q10. **Class versioning.** Is `https://pod.vardeman.me/agents/claude-code`
one stable URL across all Claude Code versions, or do we mint
`/agents/claude-code/v1`, `/agents/claude-code/v2`? My read: stable URL
for class; version goes in composition. Confirm.

Q11. **Sub-agent attribution granularity.** Sub-activities under the
parent activity, or distinct activities with `prov:wasInformedBy`?
Practical question for the `ProvenanceCommitListener` implementation.

Q12. **Long-lived ecosystem readability.** If the principal looks back
in 5 years, can they reconstruct which agent wrote what? Argues for
materializing class + composition IRIs in `prov:wasAssociatedWith`, not
just instance-ephemeral identifiers.

Q13. **Headless agent renewal.** Stories 3 and 4 have agents that run
without a human in the loop. How do their grants renew without re-issue?
Auto-renewal with rolling expiration? Long-lived grants with revocation
as the only off-switch?

Q14. **DPV adoption for purpose binding.** Yes, no, defer? Probably
defer to a follow-on round.

Q15. **More user stories.** The starting set has six; almost certainly
incomplete. Notable missing: federated agents writing to our Pod (vs
reading), multi-principal agents (one agent acting for multiple
principals), shared-Pod scenarios (org Pod with agents acting on behalf
of multiple members).

---

## Cross-references

- **Companion design doc:** `2026-05-16-identity-and-provenance-design.md`
  — the survey doc. Thread 3 of that doc points here for depth.
- **Relevant decisions:**
  - **D14** — DID-WebID bridge via `alsoKnownAs`/`owl:sameAs`. Applies to
    the agent class (eventual) and the instance (via DPoP key thumbprint
    bridged to a DID method).
  - **D70** — L1/L2/L3 stratification. This document's vocabulary is L1
    (Pod substrate), not L3 (wiki-memory).
  - **D73** — Two-stage commit (`mem:Crystallize`). Relevant for Story 4
    (working→published promotion as a separate authorization gate).
  - **D74** — Memory-substrate triggers (`mem:*` AS2 vocab). Parallel
    concern at the substrate level; the new agent vocabulary is a sibling.
  - **D81** — Predicate-level governance (Model A). Provenance triples
    are governed; agent extensions are not.
  - **D83** — Pod-as-toolkit capability catalog. Composition manifests
    reference capabilities from this catalog.
  - **D84** — URI conformance, Pod-as-namespace-authority. The new vocab
    follows the hash-namespace, extension-less, port-less pattern.
- **Relevant skills:**
  - **`solid-identity-stack`** — the reference skill covering the broader
    auth/identity stack. This document goes deeper on the agent-decomposition
    slice.
  - **`decision-lookup`** — for any D-numbered ratification that emerges
    from this document.
- **Relevant existing extensions:**
  - **`MementoCommitListener`** — pattern reference for the eventual
    `ProvenanceCommitListener`.
  - **`MarkdownProjectionListener`** — same pattern, different write-time
    hook.

---

## References (external)

- W3C PROV-O — https://www.w3.org/TR/prov-o/
- W3C VC Data Model v2.0 — https://www.w3.org/TR/vc-data-model-2.0/
- W3C DPV (Data Privacy Vocabulary) — https://w3c.github.io/dpv/dpv/
- W3C DID Core — https://www.w3.org/TR/did-core/
- DPoP (RFC 9449) — https://www.rfc-editor.org/rfc/rfc9449
- GNAP (RFC 9635) — https://www.rfc-editor.org/rfc/rfc9635
- Solid-OIDC — https://solidproject.org/TR/oidc
- ACP — https://solid.github.io/authorization-panel/acp-specification/
- Solid Application Interoperability — https://solid.github.io/data-interoperability-panel/specification/
- Inrupt Access Grants — https://docs.inrupt.com/security/authorization/access-requests-grants
- `solid-client-access-grants-js` — https://github.com/inrupt/solid-client-access-grants-js
- DIF Trusted AI Agents WG (KYA-OS, awareness only) — https://identity.foundation/working-groups/trusted-agents.html
- DIF KYA-OS announcement — https://blog.identity.foundation/kya-os/
- `open-kya/kya-standard` (parallel community effort, awareness only) — https://github.com/open-kya/kya-standard
- ActivityPods (Solid + AS2 cross-pollination) — https://activitypods.org/specs/solid
- W3C RDF Dataset Canonicalization (URDNA2015) — https://www.w3.org/TR/rdf-canon/

---

## Working notes — not for ratification

- The "agent ecosystem" concept needs more thought. Walking Story 5
  (federated collaborator) raised the multi-principal question; that's
  underspecified.
- The relationship to D83 (Pod-as-toolkit) is interesting: compositions
  declare which capabilities from the catalog they exercise. Could become
  the formal interface between this doc's work and D83's work.
- The "Authorization Agent" being the biggest open question argues for
  a focused mini-doc on AA design once we've done more user-story research.
  That mini-doc could be the next iteration of this thread.
- Headless agent renewal (Story 3, 4) keeps surfacing as a real friction
  point. Worth more attention.
