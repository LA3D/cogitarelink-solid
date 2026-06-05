# D112 (proposed) — Curation protocol: the Tier-2 loop as Pod state + a transferable role

**Date**: 2026-06-05
**Status**: DESIGNED — approved in brainstorm; implementation plan next
**Decides**: D109 sub-project C (the agentic curation loop)
**Lineage**: D109 (floor/loop rule, Tier-2 framing) · D101 (mem-trigger detectors) ·
D104/vault-D99 (pod_audit walker + the pod-curator concept) · D108 (admission floor,
two-audiences) · D110 (interop as the agentic-app vocabulary) · D111 (probe-donated
detector candidates; IdCatalogStore derived-index precedent) · RQ-Listener-1
(`.operations/` ledger canonical form) · RQ-Atomic-Feedback-1 (in-band feedback,
read-path variant exercised here) · D82 (agent-enrichment rewrite constraint, inherited
not solved) · D87 (provide-reactively) · D103 (on-Pod descriptor as source of truth)

## 1. Problem and framing

Two questions opened this design: *how do we build a pod curator?* and *how do agents
that are primary readers/writers of the Pod get tool and context feedback?* Pulling on
them showed the FOLLOWUPS framing ("wire detectors → curator") was too small. The real
artifact is an **agentic architecture decision**: what belongs to the substrate fabric,
what belongs to agent/subagent procedure, and what is policy of a particular agentic
app.

The disentanglement:

- **Substrate fabric (L1/L2) — mechanism, never judgment.** Detect, record, expose:
  the D108 floor 422s structural violations; mem-trigger emits `mem:*` events as data;
  `mem:RealignAction` + `mem:rationale` + `.operations/` define the ledger format;
  affordance descriptors carry the curation procedure (`sh:agentInstruction`).
- **Skills — procedural memory for operating the fabric.** Thin bootstrappers per D103.
  Note: the `pod-curator` skill referenced since 2026-05-24 **no longer exists on disk**
  (never committed to `solid-agent-skills`; the `sync-curator-skill` Makefile target
  dangles). Per the structure-before-teaching deferral, v1 ships **no skill at all** —
  the on-Pod affordance descriptor is the teaching surface.
- **App layer (L3) — curation policy.** Which checks, thresholds, legal refactorings.
  Declared per overlay (§4), not baked into the substrate.

Three refinements over the original framing:

1. **Three audiences, not two**: the curator agent, the primary read/write agents, and
   the dev agent (tests/CI/eval — D108's second enforcement audience).
2. **Curator is a role, not a component.** This is a shared, multi-agent substrate
   (multi-user correction, 2026-06): no privileged curator process can be assumed.
   All curation state lives in the Pod — signals, ledger, policy — so *any authorized
   agent* (an interactive session, a scheduled headless run, eventually an LDN
   subscriber) can assume the role from in-band information alone. Invocation modes
   (write-adjacent review, scheduled sweep, manual drain) are deployment choices that
   compose on top of the protocol; they are not the architecture.
3. **Two curation scopes, principled split**: an **L2 substrate scope** maintains the
   seven invariants across all registrations (bounded branching is L2 — the Fano
   bound), while **L3 app scopes** enforce app policy within their own registrations
   (topic refactoring = wiki-memory; provider liveness = identifier-schemes). This
   spec names both; the slice builds only an L3 instance.

Vault prior art (the Obsidian triad) maps directly and served as the reference:
`/review-note` = write-adjacent resource-scoped review; `/audit` = deterministic
structural sweep (`pod_audit.py` is already this); `/curator` = judgment proposals
harvested from observations recorded *in the substrate* (`curator_status:` frontmatter
≙ the read-path back-pointer of §5).

## 2. Decision

Specify the curation loop as a **protocol in Pod state** with five seams, and build
one vertical slice end-to-end (approach C of the brainstorm: pure Pod-state protocol
plus exactly one server seam for read-path surfacing).

| Seam | What | Realized by |
|---|---|---|
| Signals | write-time `mem:*` events + sweep checks with no write-time trigger | mem-trigger (exists) + declared sweep checks (§4) |
| Ledger | proposals and traces as `as:Announce` + `mem:RealignAction` activities | `.operations/` per app (RQ-Listener-1 form, exists) + `schema:actionStatus` lifecycle (§3) |
| Policy-as-data | overlays declare their curation needs | `mem:hasCurationNeed` on the overlay's `interop:Application` (§4) |
| Read-path surfacing | open actions visible where agents already work | server-derived `mem:hasOpenAction` back-pointer + `Link` header (§5) |
| Curator-as-role | any authorized agent assumes the role in-band | affordance descriptor at `/vault/meta/affordances/curation.ttl` (§6) |

Within the loop, **v1 is propose-only for both lanes** — every action files a
Potential proposal; a separate resolving act applies it. `mem:applyClass` declares
each need's *intended* lane; graduation of derive-class needs to auto-apply is earned
through a maturity score over trace history, not granted by design (§7).

**Vertical slice**: identifier-schemes becomes the first curated overlay, with one
curation need per lane — provider liveness (judgment) and PropertyValue
materialization (derive). Dog-foods D111 the way D111 dog-fooded the grammar, and the
slice's targets (`/id/` Turtle resources) sidestep the D82 markdown-rewrite constraint
(§10).

## 3. Vocabulary additions (mem.ttl — small)

The existing vocabulary carries most of the protocol: `mem:RealignAction ⊑
schema:ReplaceAction`, required `mem:rationale`, `mem:stalenessClass` with 7 classes
including `mem:FalsePositive` (non-repairs recorded), and the worked ledger exemplar
(`overlays/wiki-memory/examples/realign-2026-05-23.ttl`). Additions:

- **Action lifecycle** by standard reuse (D107 Bucket-1 discipline): `schema:actionStatus`
  with `schema:PotentialActionStatus` (proposed), `schema:CompletedActionStatus`
  (applied), `schema:FailedActionStatus` (rejected/withdrawn). Natural fit —
  RealignAction is already a `schema:ReplaceAction` subclass. No minted status terms.
- **Provenance-of-procedure** by PROV-O reuse (axioms verified against the live
  ontology, 2026-06-05): every ledger activity carries
  `prov:qualifiedAssociation [ a prov:Association ; prov:agent <actor> ; prov:hadPlan <plan> ]`.
  Domain/range conformance: `qualifiedAssociation` domain `prov:Activity` ✓ (proposals
  are Activities), `hadPlan` domain `prov:Association` / range `prov:Plan` ✓ — PROV-O
  places "no prescriptive requirement on the nature of plans, their representation",
  so the curation affordance descriptor qualifies and self-asserts `a prov:Plan`. The
  plan reference is **Memento-pinned** (the descriptor version the agent followed);
  the trace also asserts `<memento> a prov:Plan ; prov:specializationOf <descriptor>`
  so the ledger validates under the audit's `inference="none"`. Actors are typed
  `prov:SoftwareAgent`. Rationale: identity says *who*; the plan says *equipped with
  what* — a curation judgment is only auditable against the procedure version it
  claims to have followed. PROV-O graduates from the ground-now backlog into
  `ontology/` (this decision relies on its axioms normatively).
- **`mem:hasOpenAction`** — target resource → pending operation. Server-derived only
  (§5); agents never author it. Domain: any resource; range: a ledger activity.
- **`mem:CurationNeed`** (class), **`mem:hasCurationNeed`** (domain
  `interop:Application`), **`mem:applyClass`** (range: **`mem:DeriveClass`** |
  **`mem:JudgmentClass`**), **`mem:ledger`** (the app's `.operations/` container).
  The check procedure itself rides on `sh:agentInstruction` (existing term; on-Pod
  source of truth per D103). Keep the node minimal — no cadence, no scheduler hints
  (YAGNI; invocation is a deployment concern).
- **`mem:ProviderDrift`** — new `mem:StalenessClass`: a declared provider no longer
  resolves as declared (the class of both 2026-06-05 probe-caught bugs).

## 4. Policy-as-data: identifier-schemes is the first curated overlay

identifier-schemes gains `overlays/identifier-schemes/interop/application.ttl`
(template: wiki-memory's), declaring the application, its access needs over the `/id/`
registration, and **two curation needs**:

- **provider-liveness** (`mem:applyClass mem:JudgmentClass`): for each scheme record,
  substitute `idot:sampleID` into each provider's `idot:urlPattern` and verify the
  declared `dcat:mediaType` comes back. Would have caught both D111 probe bugs.
  The `sh:agentInstruction` encodes the false-positive discipline: record the HTTP
  evidence (status, content-type, date) in `mem:rationale`; a transient failure is not
  a dead provider; on irrecoverable conflict file the proposal, never patch the record
  directly.
- **propertyvalue-materialization** (`mem:applyClass mem:DeriveClass`): the
  `schema:PropertyValue` projection (propertyID = scheme-record URL) from D111
  FOLLOWUPS item 1 — deterministic from the graph. Files a Potential proposal in v1
  like everything else (propose-only, §7); its DeriveClass declaration marks it
  first in line for graduation.

The suggestive-typing sweep (typed literals vs `luiPattern`) stays a declared-later
candidate — provide-reactively (D87): declared when the slice proves the protocol.

**Ledger placement**: **`/id/.operations/`** — per-application, the same pattern as
`/vault/wiki/.operations/` (RQ-Listener-1: operation provenance canonical in the app's
operations log). Each `mem:CurationNeed` points at its ledger via `mem:ledger`. The
future L2 substrate-curator scope gets a substrate-level ledger when it is built —
named here, not created.

**Identifier structure** (verified against LDN, SAI, and RQ-Listener-1, 2026-06-05):
one activity per ledger resource, **`<>`-subject**, delivered by POST; the server
assigns the URL (`201 + Location`, the LDN sender/receiver pattern — LDN's own example
payload uses the null relative IRI). This matches RQ-Listener-1's reviewed convention;
the `urn:uuid:` subjects in the 2026-05-23 exemplar were an artifact of bundling four
activities in one example document, not a convention. Consequence for §5: the
back-pointer and Link header target a *dereferenceable* proposal URL. `.operations/`
is structurally an LDN inbox (LDP container receiving POSTed AS2 payloads);
advertising it via `ldp:inbox` is deferred until a notification consumer exists (D87
provide-reactively).

Proposal form (floor-validated by a small shape, §8):

```turtle
# POSTed to /id/.operations/ → 201 + Location; <> resolves to the assigned URL
<> a as:Announce , mem:RealignAction , prov:Activity ;
    as:actor <agent> ;
    as:target </id/.operations/> ;
    as:object </id/schemes/doi> ;            # the resource needing curation
    schema:actionStatus schema:PotentialActionStatus ;
    mem:stalenessClass mem:ProviderDrift ;
    mem:rationale "GET https://doi.org/… Accept: application/vnd.… → 406 (2026-06-05T…). Provider no longer serves the declared media type." ;
    prov:used <https://doi.org/10.5555/12345678> ;          # the dereferenced provider URL (the evidence)
    prov:wasDerivedFrom </id/schemes/doi> ;                  # the record carrying the stale claim
    prov:wasAssociatedWith <agent> ;
    prov:qualifiedAssociation [
        a prov:Association ;
        prov:agent <agent> ;
        prov:hadPlan <plan-memento> ] ;                      # the procedure version followed (floor-required)
    as:published "…"^^xsd:dateTime .

<agent> a prov:SoftwareAgent .
# <plan-memento> = the Memento of /vault/meta/affordances/curation.ttl current at run time:
<plan-memento> a prov:Plan ;
    prov:specializationOf </vault/meta/affordances/curation.ttl> .
# Auxiliary subjects in the same resource — LDN permits multiple subjects per notification.
```

## 5. Read-path surfacing — the one server seam (two derive-class parts)

The vault works because feedback is encountered where agents work. The Pod equivalent:

1. **`OperationsIndexListener`** (MonitoringStore CDC; precedents:
   `MementoCommitListener`, `MarkdownProjectionListener`, and this morning's
   `IdCatalogStore`): when an activity lands in a ledger container — identified in v1
   by the `.operations/` path convention; registry-driven discovery via `mem:ledger`
   deferred — with `schema:PotentialActionStatus` and `as:object <target>`, write
   `<target> mem:hasOpenAction <activity>` into the target's `.meta`; when the status
   flips to Completed/Failed (or the activity is deleted), remove it. The back-pointer
   is **server-derived** because it is inferable from the graph — the floor/loop rule
   assigns inferable state to the server, and derivation is what makes the pointer
   independent of agent discipline.
2. **`CurationLinkMetadataWriter`** (clone of `ProfileLinkMetadataWriter`, ~40 LOC):
   on GET, for each `mem:hasOpenAction` value in the response metadata, emit
   `Link: <activity-url>; rel="https://pod.vardeman.me/vault/ontology/mem#hasOpenAction"`
   (RFC 8288 extension relation = the predicate IRI), additive via `addHeader`.

A primary agent touching a resource with open curation work sees it in the HTTP
response — whether or not it reads `.meta`. Because proposals are `<>`-subject
resources (§4), the Link target is GET-able: notice → dereference → read the proposal
is one hop. This is the read-path variant of RQ-Atomic-Feedback-1 and the Pod-native
`curator_status:` frontmatter.

**CSS-behavior verification battery (plan Batch 1, per agentic-development.md):**
`.meta` content reaching `RepresentationMetadata` for MetadataWriters (profile-link
proves the pattern); internal `.meta` writes from a listener (IdCatalogStore proves it
— including the known Locking-bypass caveat, D111 FOLLOWUPS item 4, inherited here);
floor behavior on `.operations/` POSTs (container needs `constrainedBy` admission of
the proposal shape).

## 6. The curator role and discovery

**No skill ships** (structure-before-teaching, same posture as D111 — the cold probes
test in-band discovery, not skill quality). But the role is not equipment-free:
**assuming the role means loading the plan and declaring it**. Every ledger write
carries `prov:hadPlan` pointing at the Memento-pinned descriptor version the agent
followed; the floor 422s undeclared writes. The equipment lives on the Pod (the
descriptor, Memento-versioned), not in a skill bundle that can evaporate the way
pod-curator did. The role is assumable entirely in-band:

```
storage description → application registry → mem:hasCurationNeed
                    → /vault/meta/affordances/curation.ttl (sh:agentInstruction)
```

The descriptor's procedure, in outline: (1) drain `.events/` (write-time signals from
mem-trigger); (2) run each declared sweep check; (3) every finding → a Potential
proposal with rationale + evidence + `prov:hadPlan` — **propose-only, both lanes**
(§7); (4) never apply, even when the fix looks trivially safe — graduation is pending
trace evidence; (5) dereference the authority before flagging (the false-positive
guard already in `mem:StalenessDetected`'s scope note); (6) withdrawn flags are
recorded as `mem:FalsePositive` + `schema:FailedActionStatus`, not deleted.

Resolution of a Potential proposal is a separate act by any authorized agent (or the
deployer): execute the repair, flip `schema:actionStatus`, the listener clears the
back-pointer.

Cleanup: remove the dangling `sync-curator-skill` Makefile target. `pod_audit.py`
remains the deterministic substrate audit — it feeds the curator (its findings are
candidate `mem:StalenessDetected` signals); it is not the curator.

## 7. Auto-apply boundary — propose-only in v1, graduation by measured maturity

`mem:applyClass` declares each need's **intended lane** at deploy time. The
classification is policy data, never run-time curator discretion — the agent
exercises judgment *within* a lane (is this provider dead?), never *about* lanes
(may I apply this?):

| Lane | Test | v1 instances |
|---|---|---|
| `mem:DeriveClass` | recomputable from the graph; idempotent; no information destroyed | PropertyValue materialization |
| `mem:JudgmentClass` | requires judgment, destroys or reinterprets information, or asserts facts about the world | provider liveness findings |

**v1 behavior is propose-only for BOTH lanes.** What an agent actually does when
attached to this loop is an open empirical question; predictions don't belong in the
protocol. Every action — including derive-class — files a Potential proposal; a
separate resolving act applies it. The curator procedure has exactly one behavior,
which is simpler to build and strictest by default. Cost: one approval step on
deterministic work — trivial at 8 scheme records, and if it grates at 100, that
friction is itself the evidence graduation wants.

**Graduation to auto-apply is earned per need, by a maturity score over its trace
history** (the PEMS pattern — see external grounding below). The signals, all
computable from the ledger as designed:

- **clean-trace rate** — resolved executions that matched the proposal body exactly;
- **reversal rate** — proposals later `schema:FailedActionStatus` / `mem:FalsePositive`;
- **plan stability** — Memento-pinned `prov:hadPlan` version churn across runs (a
  free consequence of §3's equipment requirement).

v1 defines the signals and ensures the traces carry them; **the scorer is not
built** — it arrives when there is trace data to score. Until a need graduates,
the strictest posture holds.

The middle class observed in brainstorm (mechanical-but-destructive, e.g. apply a
supersession) is modeled as judgment-class with a trivially-executable action body —
no third lane until a real instance demands one.

**External grounding** — *Rethinking Memory as Continuously Evolving Connectivity*
(FluxMem; Zhejiang Univ./Alibaba; arXiv:2605.28773,
https://arxiv.org/html/2605.28773v1; read 2026-06-05 — pending vault literature note
→ Agentic Memory Systems MOC):

- **(a)** PEMS ("Procedure Evolution Maturity Score": source-episode success rate +
  conciseness + version-to-version stability, consolidate on convergence) is the
  published precedent for graduation-by-measured-maturity.
- **(b)** Its Stage II ablation — feedback-driven connectivity refinement was the
  single most critical component (95.06 → 85.32 LMJ on LoCoMo without it) — is
  benchmark evidence for the Tier-2 loop thesis (Karpathy Lint as a continuous
  control loop); its under-/over-connection failure modes are this substrate's
  orphans and hub-flooding.
- **(c)** Its auto-apply posture transfers *inverted*: FluxMem refines ephemeral
  per-task context subgraphs, recoverable by construction; our curation edits are
  durable mutations of a shared substrate — same loop, higher blast radius per
  write, hence propose-first.
- **(d)** Its three-layer graph maps onto this substrate: V_sem ≈ concepts/sources,
  V_epi ≈ the `.operations/` ledger, V_proc ≈ affordance descriptors; its
  E_distill (episodes → skills) is what the `hadPlan`-linked trace corpus enables
  here (§11).

## 8. Eval — Rung 1.5 B2 (Lint), graded like D111 §7.4

**Cold probes** (tune the harness, not the server):

1. **Curator probe**: a cold agent, given only the Pod URL and the ask "curate this
   Pod", must discover the curation needs in-band, run provider liveness, and file a
   conformant Potential proposal. Graded: ledger form validates against the proposal
   shape; rationale carries HTTP evidence; `prov:hadPlan` declares the Memento-pinned
   descriptor version actually followed; **propose-only discipline holds for both
   lanes** — the probe plants one finding per lane, and whether a cold agent
   refrains from "helpfully" applying the trivially-safe derive-class fix is a
   primary behavioral measurement (ensemble-runnable — repeat across cold agents
   for a lane-discipline rate, per the agentic-ensembles intent); the back-pointer
   appears on the target.
2. **Primary-agent probe**: a cold agent doing ordinary scheme-record work (read a
   record, register a scheme) against a Pod with an open action planted. Graded: does
   it notice the `Link` header, dereference the activity, and either resolve it or
   correctly leave it with a note. First live exercise of RQ-Atomic-Feedback-1
   (read-path variant).

**Deterministic layer**: e2e for listener derive/remove on status transitions; header
emission; floor acceptance/rejection on `.operations/` writes (well-formed proposal →
201, malformed → 422, **plan-undeclared → 422** — the shape requires the
`prov:qualifiedAssociation/prov:hadPlan` path); vocab validity (rdflib parse + audit);
proposal SHACL shape;
no new mirrors expected — status IRIs shared between listener and tests via one
constants module.

## 9. Explicitly out of scope (YAGNI)

LDN push and any subscriber process; any scheduler; hub-split/topic-refactoring
actions (RQ-Hub-1); wiki-memory curation needs (follow-on — inherits the D82
constraint, §10); the suggestive-typing sweep (declared-later); a rebuilt pod-curator
skill; curator WebID/WAC identity (activates with the security profile, like the
`/id/` write gate — D111 FOLLOWUPS item 3); the L2 substrate-curator build (named in
§1, not built).

## 10. Hazards and constraints (documented, not all solved)

- **D82 inheritance**: agent-side `.meta` enrichment does not survive markdown body
  rewrites (strict-xfail in the suite). `mem:hasOpenAction` is server-derived and
  re-derivable, so the listener can restore it after a projection rewrite — but that
  restore path is NOT built in v1; the slice targets `/id/` Turtle resources where no
  projection rewrite exists. Wiki-memory rollout requires either the D82 sidecar or
  the listener's restore-on-rewrite. → FOLLOWUPS on ship.
- **Locking bypass**: the listener writes `.meta` below the Locking layer (same as
  IdCatalogStore — D111 FOLLOWUPS item 4). Single-writer assumption holds today;
  revisit at multi-agent WAC.
- **Concurrent curators**: two agents assuming the role simultaneously could file
  duplicate proposals. Tolerated in v1 (duplicates are visible, resolvable, and
  recorded); a claim convention is deferred until it actually happens.
- **Equipment vs identity**: procedural grounding is declared and floor-required
  (`prov:hadPlan`, Memento-pinned) — but *identity* stays self-asserted until
  WebID/the security profile. The trace proves which plan was claimed, not who
  claimed it; the future interop grant flow scopes `.operations/` write access to
  registered curation-capable applications (equipped-agent authorization).
- **Liveness false positives**: transient provider failures. Mitigated by the
  evidence-in-rationale requirement and the FalsePositive discipline; not retried
  automatically (no scheduler).
- **`.events/` growth**: drained events are not deleted in v1 (append-only signal
  log); revisit if volume becomes a problem.

## 11. What this resolves and feeds

- Closes D111 FOLLOWUPS item 0(a) (provider-liveness detector) and item 1
  (PropertyValue materialization assigned to the loop).
- Exercises RQ-Atomic-Feedback-1 in its read-path form (probe 2).
- D109 sub-C done → the standing sequence proceeds: **RQ-View-2 full re-eval** (now
  also able to probe curation-feedback reactions) → D view layer.
- The L2 substrate-curator scope and wiki-memory's curation needs are the named
  follow-ons.
- The `hadPlan`-linked trace corpus is, by construction, a (procedure-version,
  outcome) dataset — exactly what descriptor consolidation needs when the deferred
  teaching/skill-acquisition agenda un-defers (FluxMem Stage III is the published
  precedent for inducing improved procedures from episode clusters). Collected
  passively from day one; no scope now.
