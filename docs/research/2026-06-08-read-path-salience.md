# Read-Path Salience — Why Delivered Governed Context Doesn't Change Agent Behavior (RQ-Salience-1)

**Status:** OPEN research thread. Framing + evidence + experiment matrix + one
recommended-but-undecided direction. NOT a spec — we may be framing the design wrong,
and want more agentic-behavior experiments before committing a fix.
**Opened:** 2026-06-08, out of the D114 eval (`docs/plans/2026-06-07-d114-eval-report.md`).
**Reload context:** this doc + the eval report + the trajectories at `~/dev/probes/d114/runs/`
+ decisions D112/D113/D114 + RQ-View-2 report. This is enough to resume cold.

> **Sibling thread (run FIRST):** RQ-Conneg-1 — *is the view layer over-built relative to pure
> Solid?* (`docs/research/2026-06-08-solid-view-mechanism-vs-profiles.md`). Its H0/H1 (do agents do
> plain content negotiation + `describedby` at all?) are upstream of the salience fix: a graph view
> selected by the standard `Accept` header rides a model prior where `?_profile=fused` is bespoke,
> so simplification and salience point the same way. Settle the conneg baseline before tuning signals here.

---

## 1. The problem in one paragraph

The substrate can now **deliver** governed context (an open curation action that flags a
statement stale) into an agent's representation, in-band, at every tier, content-type-
agnostic (D114, validated). It does **not** change agent behavior. In the D114 over-trust
probe the agent received `mem:hasOpenAction` directly in its `solid-pod read` output and
still answered the stale value with high confidence — because its attention was
**predicate-directed** ("find `skos:broader` → confirm it → done") and the open action is a
**sibling triple on the same subject**, structurally invisible to an attention scanning for
one predicate. The failure is not delivery and not "opaque pointer not followed." It is
**never-registered**: the signal was in context and the agent's attention never landed on
it. (Raw evidence: neither probe arm mentions `hasOpenAction`/open-action/realign/stale
anywhere — reasoning, trajectory, or answer.)

This is the read-path's remaining gap. D112 was "the signal never arrives" (Link header).
D114 fixed arrival. RQ-Salience-1 is **"the signal arrives but doesn't enter attention."**

## 2. Evidence (D114 eval, 2026-06-07)

Trap: concept body says `[[Progressive Disclosure]]{.broader}`; an open `mem:RealignAction`
declares that edge stale, authoritative broader = Hierarchical Retrieval. Body and `.meta`
agree (dual-layer projection); the correction lives only in the open action. Question
("what broader topic is this filed under?") carried no staleness cue. n=1/arm.

- **Arm 1 (Tier-3, curl+`solid-pod`):** ran `solid-pod read` (fused). Tool result
  **contained `mem:hasOpenAction`** (verified in raw trajectory). First reasoning turn:
  *"The concept has a `skos:broader` link to Progressive Disclosure. Let me fetch that
  resource to **confirm**."* Spent every later call confirming the label. Answer:
  "Progressive Disclosure, High confidence." Never registered the open action.
- **Arm 2 (curl floor):** used `curl -i` + a direct `.meta` fetch — the signal was in
  context twice over. *"The content has the answer… let me confirm."* Reasoned *"the `.meta`
  was modified today, so it is fresh"* — manufactured confidence. Same never-registered.
- **The follow-your-nose hook (the key datum):** Arm 1 **already traversed to the broader
  target** (`progressive-disclosure.md`) to confirm it. The agent's natural behavior is
  "traverse to the thing the edge points at." The signal was hung off the **source**
  concept, not on the **node the agent's own nose visited**.

Regression arms (write round-trip, curator loop) both PASSED — this is a "not sufficient,"
not a regression.

### 2.1 All three channels carry the signal in *bespoke* vocabulary (the wiring finding, 2026-06-08)

Inspecting the actual headers the floor agent received (`curl -i`), the open action is the
**one rel in the whole block that is a private full-IRI in our own pod namespace**:

```
rel="type" · rel="timemap"/"timegate" · rel="profile" · rel="describedby"   ← standard / IANA-registered, model has a prior
rel="…/solid#storageDescription"                                            ← recognized Solid term
rel="https://pod.vardeman.me/vault/ontology/mem#hasOpenAction"              ← OUR private IRI, no prior — reads as vendor noise
```

So the **same root cause appears in three places**, all app-private:

| Channel | How we wired it | Why the agent skips it |
|---|---|---|
| Body `.meta` triple | `mem:hasOpenAction` (sibling of `skos:broader`) | bespoke vocab + off the predicate path |
| Link header | `rel="…/mem#hasOpenAction"` | bespoke full-IRI rel — no training prior; reads as noise |
| (contrast) `describedby`/`profile`/`type`/`timemap` | standard rels | recognized — yet agents *still* didn't follow them, see §4 tension #6 |

Two compounding facts from the trajectories: (a) in a focused/confirm task agents **barely
engage Link headers at all** — the floor agent had this whole block and went straight to body
content; (b) when an agent *does* enumerate headers (the D113 `-v` "describe this resource"
task), it parsed `hasOpenAction` only because the rel string literally spells "hasOpenAction"
in English — not as a known rel — and still needed the body trailer's rationale to act.

## 3. The reframe (what the evidence points at)

Stop saying "annotate the triple" — it smuggles in two couplings (our `mem:` vocab + the
assumption that agents inspect statement-level annotations, which they don't). The evidence
points elsewhere:

**Put the contestation, in standard vocabulary, on the path the agent's own follow-your-nose
traversal already visits; and have the substrate not serve a contested value as a bare,
settled fact.**

Two separable commitments fall out, and they map cleanly onto Chuck's coupling worry:

- **Source of judgment = app-specific, stays so.** The wiki-memory curation ledger,
  `mem:RealignAction`, the open-action machinery — these decide *that* something is stale.
  Coupling here is fine; it's the L3 profile's job.
- **Surfaced signal = standard, general, on-path.** What an agent perceives must be
  expressible in vocabulary the model already knows (so general training fires) and
  positioned where a predicate-directed reader cannot miss it (so follow-your-nose actually
  triggers). No `mem:` literacy required to perceive "this is contested."

## 4. The tensions (the actual design problem)

1. **Node-level vs statement-level.** The contestation is about the **edge** ("*this
   concept's* broader is stale"), not about Progressive Disclosure globally (it may be a
   fine concept, wrong parent here).
   - *Node-level* (mark PD with `owl:deprecated`/`isReplacedBy`): maximally follow-your-nose,
     standard, zero coupling — but **semantically wrong** (defames PD everywhere).
   - *Statement-level* (mark the edge): semantically right — but RDF gives a predicate-
     directed agent **no natural path** to a statement's annotation (reification/RDF-star is
     unfollowable + uneven tooling).
   This gap — *semantically-correct-but-unfollowable* vs *followable-but-wrong* — is the crux.
2. **Flag vs refuse-to-serve.** Is the substrate's obligation to *flag* the contested fact
   (keep asserting the current value + add a standard contestation signal) or to *not assert
   it as settled at all* (so a naive reader simply cannot extract a clean confident value —
   e.g. omit the bare triple, or serve both candidate values)? This is a question about what
   kind of honesty the substrate has. Open.
3. **Data-layer vs token-layer salience.** RDF triples have no reading order or salience — a
   sibling/qualifier triple is dodgeable. Markdown (linear, top-to-bottom) intercepts
   attention — a ⚠ inline is unmissable. The withdrawn D113 trailer worked in its probe
   *because* it exploited token-layer linear attention. The general principle must not couple
   to markdown, but must respect that **modality determines salience**: a signal in the
   representation modality the agent reads linearly is perceived; a triple in a graph blob is
   not. (Possibly: the fix differs per content-type — token-layer position for markdown,
   value-level contestation for RDF.)
4. **Standard vocab vs bespoke (Chuck's "use model priors").** Hypothesis worth testing
   directly: do agents respond to standard supersession/deprecation vocab
   (`owl:deprecated`, `dcterms:isReplacedBy`, `prov:wasRevisionOf`/`prov:invalidatedAtTime`,
   `schema:supersededBy`) because their training already carries the semantics — where they
   ignore a bespoke `mem:hasOpenAction`? If yes, "send higher signals via standard vocab" is
   a cheap, general lever independent of the positioning question. **But standard vocab is
   only ONE route to grounding — see tension #5.**
5. **Grounding: pretraining prior vs in-context definition (Chuck, 2026-06-08).** A bespoke
   IRI like `mem:hasOpenAction` is *dereferenceable* (you can GET the ontology) but the agent
   has **no basis to know it is an affordance** — something to act on — unless its definition
   is in context. Two routes to grounding, not one:
   - **(5a) Standard vocab** — the definition is already in pretraining (tension #4). Cheap,
     general, zero load.
   - **(5b) Bespoke vocab + load the definition into context** — keep `mem:` terms but ensure
     the agent has the relevant ontology/affordance descriptor in its context window so it
     knows `hasOpenAction` is an actionable governed-context flag. This is **layered context
     loading** (D109: base vocabulary index on startup; per-app ontologies loaded dynamically
     via the interop `ApplicationRegistration`/`AccessNeedGroup`/`registeredShapeTree` path).
     The eval agents had **no** vocab definitions loaded — so they had no basis to interpret
     `hasOpenAction` even where it was in context. Untested whether loading it flips behavior.
   Implication: "use standard vocab" and "load the bespoke ontology" are *alternatives* for
   the grounding problem; they can also combine. Either way, **an ungrounded bespoke signal is
   uninterpretable by construction** — which is the deepest read of why all three channels failed.
6. **Perception channel × tool design × RL distribution (Chuck, 2026-06-08).** Headers are a
   structurally weak channel for reasons *upstream of vocabulary*: (a) a raw `curl` tool
   returns headers as undifferentiated text the agent must opt to read; (b) the model's own
   native fetch tools surface HTTP differently than curl does; (c) **plausibly the model is
   RL-trained over curl actions in a distribution where headers are rarely load-bearing**, so
   it is not reinforced to attend to them (hypothesis, hedged — header usage in the wild is
   not zero, and this is hard to verify from our side). Consequence: **you probably cannot make
   the header channel land with a stock curl tool, regardless of how standard the rel is.** The
   fix is tool-side — a curl-*wrapping* tool (or the D114 CLI/MCP contract tool) that
   **foregrounds** governed context rather than returning raw merged data. Note the CLI fused
   read already *did* put `hasOpenAction` in the agent's output and the agent still missed it
   (sibling triple in a JSON blob) — so "foreground" means *actively surface/highlight the
   governed flag*, not merely include it. This ties directly to the D114 tool-tier decision
   (curl = degraded floor; CLI/MCP = contract): the contract tool's job is to make governed
   context **perceptually unmissable**, not just present. Corollary: the **Link-header channel
   for governed context is likely a dead end** — D112 found it doesn't arrive; we now understand
   the structural why (tool + RL distribution + bespoke rel). Stop leaning on it; the body/
   fused/tool channel is where attention lives.

## 5. The meta-question — are we framing this wrong? (keep open)

Three framings, not mutually exclusive; we have not decided which is load-bearing:

- **(F1) Substrate-honesty problem.** The substrate is asserting a value it knows is
  contested as bare fact. Fix = the substrate stops lying (refuse-to-serve / co-located
  standard contestation). Locus: the served representation.
- **(F2) Agent-disposition problem.** A well-behaved agent should not assert any value as
  authoritative without a cheap status check; the substrate already emits standard hypermedia
  links; the gap is general epistemic hygiene we should cultivate (skill/instruction/learned
  procedure), not a substrate feature. Locus: the agent.
- **(F3) Mis-modeled.** Maybe per-resource "open action on a statement" is the wrong model
  for "this is stale," and a different primitive (versioned statements, contested-value sets,
  confidence-bearing edges per the LLM-Wiki-v2 / Dense-Mem direction) would dissolve it.
  Locus: the data model.

The experiments below are partly designed to discriminate F1 vs F2 vs F3.

## 6. Recommended direction (Claude's lean — SUGGESTION, NOT DECIDED)

If forced to pick today, lean **F1 + standard-vocab + on-path**, content-type-aware:

> When a governed statement is under open revision, the **fused view does not emit it as a
> bare triple**. It emits it with a **standard** co-located contestation — the model-known
> vocabulary, not `mem:` — and positions it so the agent's existing traversal hits it: for
> RDF, attach standard status to the **value node the edge points at *in the context of this
> resource*** (the agent already fetches that target to confirm) and/or serve the competing
> value so no single confident answer exists; for markdown, a ⚠ on the line the agent reads.
> The curation ledger stays the app-specific source; the surfaced signal is standard +
> on-path.

Why this lean: it rides the one behavior the eval actually observed (the agent traverses to
the target to confirm), it uses Chuck's "model priors" lever (standard vocab), and it keeps
the coupling on the source side only. **Why it's not decided:** it doesn't cleanly resolve
tension #1 (the node the agent visits is the *global* target, but the contestation is
*edge-local* — putting status on the global PD node is the semantically-wrong option). The
honest unknown is whether an *edge-local, on-the-traversed-path, standard-vocab* signal even
exists in RDF without reification, or whether the markdown/token layer is the only place
linear-attention salience is achievable — which would argue we *under-killed* the trailer
and should bring back a **standard, content-type-aware, value-level** version of it. That is
exactly what the experiments are for.

**Two updates to the lean from the 2026-06-08 channel/grounding/tool findings:**
- The grounding axis (tension #5) gives a *second* route I had collapsed: we may not need
  standard vocab at all if we **load the bespoke vocab definition into the agent's context**
  (layered context loading, D109/interop). Standard-vocab and load-the-ontology are
  alternatives; the lean should test both, not assume standard-vocab is the only grounding.
- The perception/tool axis (tension #6) says the *channel* matters as much as the vocab: the
  **tool that delivers the read must foreground governed context**, because raw curl (and
  probably the model's RL distribution) won't surface it — and even the CLI's merged-JSON
  fused read didn't, because "present in a blob" ≠ "foregrounded." So the lean now includes a
  **tool-side commitment**: the D114 CLI/MCP contract tool should actively surface governed
  flags (a "⚠ governed status" section), not just merge triples. **Abandon the Link-header
  channel for governed context.**

## 7. Experiment matrix (run before deciding)

Reuse `~/dev/probes/d114/` (Tier-3 + floor over-trust arms). Each cell = the same over-trust
trap with the signal expressed differently; measure whether the agent's answer reflects the
contestation (and trace *why* via the reasoning, not just tool calls — the D114 lesson).

| # | Variable | Variant A | Variant B | Discriminates |
|---|---|---|---|---|
| E1 | Signal vocabulary | `mem:hasOpenAction` (current) | `dcterms:isReplacedBy` / `owl:deprecated` / `prov:invalidatedAtTime` on the value | tension #4 (model priors) |
| E2 | Signal position | sibling on source subject (current) | on the broader **target** node the agent confirms | §2 follow-your-nose hook |
| E3 | Flag vs refuse | bare triple + flag | omit bare triple / serve both candidate values | tension #2 |
| E4 | Modality | RDF graph-blob signal | markdown ⚠ on the read line (content-type-aware) | tension #3 |
| E5 | Disposition | no contract on path | contract injected into the agent's task framing | F1 vs F2 |
| E6 | Question shape | "what is the broader?" (current) | "what is the broader, and is it current?" | how much cue is needed; baselines the ceiling |
| E7 | **Grounding** | no vocab definition in context (current) | bespoke `mem:` kept, but its ontology/affordance-descriptor loaded into the agent's context | tension #5 (prior vs in-context definition) — does grounding alone flip behavior without changing vocab? |
| E8 | **Tool / perception channel** | raw `curl` / merged-JSON `solid-pod read` (current) | a curl-wrapping / CLI tool that **foregrounds** governed flags (a "⚠ governed status" section), not just merges | tension #6 (perception × tool × RL distribution) — is the fix tool-side? |

Notes: E5/E6 calibrate whether the failure is substrate (F1) or agent (F2). E6 with a cue is
the *ceiling* — if agents still over-trust *with* a "is it current?" cue, that's a strong F2/F3
signal. **E7 and E8 are the 2026-06-08 additions and may be the highest-leverage cells:** E7
tests whether ungroundedness (not vocabulary or position) is the root — keep `mem:` but load
its definition; E8 tests whether the channel/tool is the root — same signal, a tool that
foregrounds it. If E7 or E8 flips behavior alone, the fix is cheaper and more general than any
representation-side reshaping. Also add a **Link-header-vs-body** control (same signal, header
only vs body/tool-output) to confirm the header channel is dead. Keep n≥2 per cell; raw-audit
reasoning; watch the `-v` confound.

### Early results (2026-06-09, from RQ-Conneg-1 H1 + E8; reports in `docs/plans/2026-06-09-*`)

- **E5 (disposition) — strongly supported.** Over the D114 trap: agents *not* told to check governance
  (H1 n=5; E8 free n=2) **never registered** the open action (H1 4/5 fetched `.meta` — which carries
  `hasOpenAction` — and answered the stale value; the 5th never left the body). Agents *told to* "check
  operation history" (E8 directed n=2) **2/2 registered it** by following the `hasOpenAction` link to the
  `.operations/` resource. The gap between blind over-trust and informed judgment is *entirely whether the
  agent audits governance* — which it will not do cold. **F2 (agent-disposition) is real and load-bearing.**
- **E6 ceiling (currency cue) — did NOT help (H1 arm a, n=2).** Agents explicitly asked "is this
  current/authoritative vs stale/superseded?" did *more* graph work (Memento timemap, target resolution)
  and concluded "high confidence current" — they reasoned about currency in vocab they have a prior for
  (versions, dangling refs) and never connected it to `mem:hasOpenAction` in the `.meta` they fetched.
  A cue is not enough without the vocabulary to recognise the signal — **F2/proto-knowledge.**
- **E8 (tool channel) — graph navigation ≠ fix; disposition is.** Naive `sparql`/`read`/`wiki-search`
  is used to *confirm* the body value, not audit it (one agent `sparql`-FILTERed for 'progressive'). The
  `hasOpenAction` link that was inert as a Link header / `.meta` triple in H1 became *followable* once the
  task disposed the agent to look for history. So "foreground via tool" works through **disposition**, not
  through a richer merge.
- **NEW insight — surfacing is necessary but not sufficient; the *signal's semantics* decide (F1/F3).**
  The two directed agents who both registered the contestation **split**: one corrected to Hierarchical
  Retrieval; one **defensibly kept Progressive Disclosure** because the `RealignAction` is
  `schema:PotentialActionStatus` (*proposed, not applied*) and the proposed target **404s**. That is a
  reasonable reading — a proposed realignment to a non-existent concept is weak grounds to override an
  asserted value. **Implication:** "flag vs refuse-to-serve" (tension #2) interacts with *applied vs
  proposed* — a realignment we want treated as binding should be either applied (graph says HR, no
  contestation to surface) or carry stronger status than "potential." The D114 trap conflates
  proposed-with-binding; future salience experiments must separate "is the contestation *perceived*?"
  from "is the contestation *authoritative enough to act on*?" — different questions.
- **Substrate gaps (→ FOLLOWUPS):** `memory-history` affordance not guessable (agents tried
  `operation-history`→HTTP 500); `solid-pod invoke` builds a malformed descriptor URL for unknown affordances.
- **Net next:** E1 (standard supersession vocab) + E7 (load the `mem:` definition) remain the primary
  grounding levers; **add E5-as-design** — the disposition "audit governance before trusting a value" may
  be the highest-leverage, most general fix (skill/instruction/learned procedure), independent of vocab.

### E1 RESULT (2026-06-09; report `docs/plans/2026-06-09-rq-salience-1-e1-report.md`; harness `~/dev/probes/salience-e1`)

**Standard supersession vocab did NOT fix it — 0/3.** De-confounded trap (both broader targets
resolve; contestation = `dcterms:isReplacedBy → HR` on the traversed target PD, node-level, NO
`mem:hasOpenAction`). Bare content question. Findings:
- **Vocabulary is not the lever.** The 1 agent that received the signal (read PD's `.meta`) missed
  `dcterms:isReplacedBy` exactly as H1 agents missed `mem:hasOpenAction` — it was a **sibling of the
  `prefLabel` it came for**. Standard-vs-bespoke doesn't matter for a triple the agent never *scans*.
  Proto-knowledge helps an agent *follow* a known rel (`describedby`); it does nothing for a non-scanned sibling.
- **Node-on-traversed-target placement does NOT escape sibling-invisibility** (tension #1 made flesh):
  the agent visits the target *for its label*; the signal is a sibling of the label.
- **Reachability is the bigger barrier (2/3 never received it):** a content question is satisfied by the
  subject's own `skos:broader` edge + the target's label, so the target's `.meta` is off the required path.
- **Caveat:** only n=1 actually tested salience-when-reached (~1/3 natural reach rate); the 0/3-at-bare-content
  claim is solid, the missed-when-reached claim is n=1.
- **Chain-of-thought audit (D114 discipline):** run2 is *never-registered* (not dismissed) — *"the RDF
  metadata confirms the answer via `skos:broader`. Let me verify PD for completeness"* → fetched PD.meta →
  done; `isReplacedBy` was in the bytes, never in the reasoning. **Cross-cutting: all 3 are in CONFIRM-MODE
  from step 1** — each decides the answer from SA's body/edge on the first response, then frames every later
  fetch as "verify/confirm/for completeness." An agent in confirm-mode does not audit siblings. Direct CoT
  evidence that the lever is **disposition** (break confirm-mode → audit-mode), not vocabulary or sibling-placement.
- **Redirect:** the lever is **disposition (E5)** first — E8's directed arm already flipped behavior 2/2, and
  E1's CoT shows confirm-mode is the root — and secondarily **placement-on-the-required-path** (the scanned
  `skos:broader` value itself / token-layer body / value-level refuse-to-serve, tension #2), since E1 also showed
  agents stay shallow on content questions. A different standard predicate is NOT the next move; E7 (grounding)
  won't help a *sibling* an agent in confirm-mode never scans.

### E5 RESULT (2026-06-09; report `docs/plans/2026-06-09-rq-salience-1-e5-report.md`; harness `~/dev/probes/salience-e5`) — DISPOSITION IS THE LEVER

**3/3 caught it** (vs H1's 4/5 *missed* with the IDENTICAL signal — same `mem:RealignAction` open action,
same curl-only tools; the ONLY change was a Pod-agnostic "audit-before-trust" preamble, no `mem:` literacy).
- **Mechanism flip in the CoT:** where E1 agents were in *confirm-mode* from step 1, all 3 E5 agents are in
  *audit-mode* from step 1 ("check governance/provenance **before reporting**") → they fetch the operation
  record and read the rationale.
- **Disposition overcomes the proto-knowledge gap (key):** run2 explicitly registered the bespoke link that
  was invisible in H1 — *"a `hasOpenAction` link I must inspect"*. An auditing agent investigates an unknown
  link; it does NOT need standard vocab (E1) or a loaded definition (E7). **Updates the H0/H1 framing:
  ungroundedness only bites a *confirming* agent.**
- **Disposed agents handle proposed-vs-applied themselves:** run2 surfaced the contestation AND flagged it
  `PotentialActionStatus`/pending — the E8 "surfacing ≠ acting" worry resolves in the agent's own judgment.
- **Settles F1/F2/F3 toward F2 (agent-disposition):** the fix is substrate-light + general, not a
  representation reshaping. **Caveats:** n=3/Sonnet/one trap; preamble is fairly explicit (→ E5b strength
  gradient); and **where the disposition lives durably** (system prompt / skill / learned procedure /
  substrate-delivered-and-actually-consumed) is the productionization question = the skill-acquisition agenda.

### E5b RESULT (2026-06-09; report `docs/plans/2026-06-09-rq-salience-1-e5b-report.md`; harness `~/dev/probes/salience-e5b`) — disposition must be CONTENT-LADEN

Strength gradient on the same trap/tools, only the preamble varies. **Sharp threshold L3→L4; generic
diligence does NOT work:**
- **L0 (none) miss 2/2 · L2 ("authoritative not first") miss 3/3 · L3 ("check full metadata + linked
  records; complete picture not first value") miss 3/3 · L4 (full E5: names staleness/supersession,
  hunt for contestation) caught 3/3.** 0/8 of L0–L3 even reached the operation record.
- **Mechanism (CoT):** L2/L3 agents *fetched SA's `.meta`* (hasOpenAction in the bytes) and stayed in
  confirm-mode — *"the `.meta` has skos:broader → progressive-disclosure; let me confirm the prefLabel."*
  **"Check the metadata/linked records" was absorbed into confirm-mode** (check = confirm the value
  already found); the `hasOpenAction` link never registered because they weren't *hunting for contestation*.
- **Finding:** the lever is not *any* disposition. It must (a) **name the failure mode** (surface values
  can be stale/superseded by governance/revision records) and (b) **direct the audit at contestation
  evidence**. Procedural diligence / anti-first-value emphasis (L3 even said "not the first value") fails;
  the *semantic content* (supersession is a thing to hunt for) is load-bearing — not emphasis or length.
- **Open:** emphasis-vs-content not fully isolated (terse-but-specific L3.5 would confirm); does the agent
  need the failure-mode *taxonomy* (supersession/low-confidence/provenance-dispute) or does "hunt for any
  contestation signal" generalize? Still Pod-agnostic. **Productionization upshot:** the durable disposition
  is content-laden (name what can go wrong), more than a "double-check" habit, less than Pod-specific
  literacy — a teachable/transferable procedure = the skill-acquisition target.

### Bootstrap-delivery test (2026-06-09; report `docs/plans/2026-06-09-rq-salience-1-bootstrap-test-report.md`; harness `~/dev/probes/salience-bootstrap`)

Can the POD deliver the disposition (vs the prompt, E5)? Added the audit disposition to the existing
`sub:agentGuide` (`how-wiki-memory-works.md`) and tested the "bootstrapped" cold-agent use case.
**Content works when consumed; consumption chain leaks.**
- **Consumption (generic prompt) 0/3 even fetched `.well-known`** — cold agents handed a resource URL
  don't perform the bootstrap ritual. The bootstrap channel is not self-triggering.
- **Efficacy (told "read the self-description first") 1/3 caught.** All 3 read `.well-known`; only 1
  chased the `sub:agentGuide` pointer to the prose disposition. efficacy-run3 (caught) is the proof
  the pod-delivered content works: it had *already seen* the `hasOpenAction` Link header, read the
  guide, *"the guide says check for open `mem:hasOpenAction` before trusting — the headers showed one,
  I must fetch it"* → caught. Same E5 mechanism, pod-delivered. The 2 misses read `.well-known`,
  absorbed the structural orientation into confirm-mode, and never chased the agentGuide pointer.
- **Design implications:** (1) **placement depth: Layer-0-immediate (`.well-known` `sh:agentInstruction`
  literal) > Layer-1-pointer (agentGuide)** — the literal currently has only write-path guidance; cheap
  next cut = put the audit disposition in the literal (Components.js config + `make reset`), re-run
  efficacy. (2) **The consumption leak is structural** → the bootstrap channel is necessary-but-insufficient
  for cold agents; this is why the **skill** (disposition baked in) and **MCP** (gateway injects it)
  channels exist. Pod Layer-0 = source of truth the skill/MCP derive from, not the sole delivery path.
- **Minimum-index upshot:** orientation (M1/M2/M3) IS consumed but insufficient (absorbed into
  confirm-mode); **disposition (M4) is the load-bearing, hardest-to-deliver piece**, and only lands via
  bootstrap if immediate + for agents that bootstrap at all.
- **Cut A — immediate-literal placement (same day):** moved the disposition into the `.well-known`
  `sh:agentInstruction` literal (no pointer-follow; `void-description.json` + reset). Efficacy **3/3
  caught** (vs the agentGuide pointer's 1/3). **Placement depth is load-bearing: immediate Layer-0 ≫
  Layer-1 pointer.** Does NOT fix the consumption leak (still the efficacy arm — cold agents handed a URL
  still don't bootstrap; that needs skill/MCP). **Net: content ✓ (E5), placement ✓ (cut A), consumption ✗
  (skill/MCP).** The literal edit is committed as the first concrete read-path bootstrap piece.

## 8. Prior art to pull (before/while experimenting)

- **Standard supersession/deprecation vocab:** `owl:deprecated`; `dcterms:isReplacedBy`/
  `replaces`; `prov:wasRevisionOf`/`prov:invalidatedAtTime`/`prov:wasInvalidatedBy`;
  `schema:supersededBy`. Which do current models actually recognize + act on? (E1.)
- **Statement-level annotation:** RDF 1.2 / RDF-star quoted triples; classic reification;
  singleton properties; named-graph-per-statement. Follow-ability + tooling reality.
- **Link relations (the wiring finding):** RFC 8288 (Web Linking — extension relation types
  are full IRIs, exactly our `mem#hasOpenAction` case, and carry no agreed semantics); the
  IANA Link Relations registry (which short tokens models actually have a prior for); RFC 5829
  (`predecessor-version`/`successor-version`/`version-history` — registered, model-known,
  candidate standard carriers for "this has a pending revision"). Plus: is the header channel
  worth keeping at all given §4 #6? (Likely no for governed context.)
- **Grounding / in-context vocab loading (tension #5):** D109 layered context loading (base
  vocabulary index on startup + per-app ontologies via interop registration); the
  affordance-descriptor architecture (`solid-affordance-descriptors`, D52/D55) — descriptors
  exist precisely to *tell the agent what an affordance is*; open question is whether they
  reach context. SHACL `sh:agentInstruction` as the in-context definition carrier.
- **Tool / perception (tension #6):** the D114 tool-tier decision (curl floor vs CLI/MCP
  contract); `solid-agent-skills` `solid-pod` CLI (the wrap point); the planned Pod MCP
  (`jeswr/solid-mcp` seed) — where a "foreground governed context" behavior would live.
- **Verborgh, *What's in a Pod?*** — contextualized statements (policy/provenance/trust per
  triple) is exactly the hybrid-KG frame; staleness is another such context.
- **Vault (agentic-memory) notes:** LLM-Wiki-v2 "confirmed by 3 sources, confidence 0.9";
  Dense-Mem evidence→claim→fact; conflict/contradiction handling; `@dedecker-2025-blank-node-context`.
  The field is converging on confidence/provenance-bearing edges — relevant to F3.
- **This repo:** D109 derive/floor/loop (the curation source); D112 (the ledger); the
  withdrawn D113 trailer (the token-layer-salience datapoint we may have over-killed);
  the D114 view-authority contract (the unconsulted teach-the-convention artifact).

## 8.1 Vocabulary-dereference base rate + the E7 reframe (2026-06-10, Chuck's challenge)

Trajectory sweep across all ~40 runs on disk: **zero vocabulary dereferences by any
over-trust-eval agent** — no agent ever fetched `mem:` (available, would have 200'd), none
ever fetched the broken `fabric:` w3id IRIs, none WebFetched any external vocab. The only
schema-touching behavior in the corpus is the D112 curator (browsed `/vault/ontology/`,
learned the `mem:` expansion from in-band `@prefix` lines) and one viewlayer probe. Two
consequences, the second correcting the first reading:

1. **The negative results are unconfounded** — vocab availability played no role in E1/H1/D114;
   and no failed dereference ever influenced a trajectory.
2. **The first-draft conclusion ("dereferenceability is FAIR hygiene, not a behavioral
   lever") was WRONG — Chuck's challenge sustained.** It conflated capability-absence
   (`?_profile=`: pattern not in the repertoire; deployed-web principle applies) with
   **disposition-absence** (vocab dereference: plain GET, fully in-repertoire; only the
   *trigger* is missing — "unknown term → ground it"). Disposition gaps are installable
   (E5, 3/3). And for **agent-minted L4 vocabularies there are no model priors by
   construction** — dereference or an in-band equivalent is the *only* semantics channel;
   H1's proto-knowledge gap is exactly an ungrounded-application-term failure. The
   substrate's write side already treats this as a guardrail (class-extension shape floors
   `rdfs:label`+`rdfs:comment`+rooting into a prior-rich parent); the read side has no
   counterpart disposition.

**E7 UPGRADED accordingly:** not "load the `mem:` definition into context" but **install a
grounding disposition** — "before trusting or acting on a term you don't recognize,
dereference it and read its `rdfs:comment`/`sh:agentInstruction`" — content-laden per the
E5b L4 threshold, delivered in the cut-A slot, measured on the same over-trust trap. Predicted
interaction: grounding alone may still miss (the term must first *register* — E1's lesson);
grounding + audit-disposition is the natural combined arm.

**Three supply-side channels, all in-house:** (a) the grounding disposition (above);
(b) the **D111 pattern generalized** — design IRIs so data-dereference delivers schema
(fragment datatypes on self-describing catalog docs; hash namespaces make GET-the-data ≈
GET-the-schema; cold probes passed 3/3 on a bespoke vocabulary this way); (c) the **SAI
layered-context-loading chain** (D109 Tier-0: `ApplicationRegistration` + `AccessNeedGroup`
+ `registeredShapeTree` → load the app's ontology on crossing into its data) — named in
D109, unbuilt (D110 stub), nothing surfaced to agents; it is the pod-side app-vocabulary
grounding channel and a first-class requirement of the structure design, not a deferred
rebase. Interop-commensurability status: partially not commensurate, by omission.

### 8.1.1 E7 RESULT (2026-06-10) — grounding is a second, independent lever; Chuck's challenge sustained

Run: report `docs/plans/2026-06-10-rq-salience-1-e7-report.md`; harness `~/dev/probes/salience-e7/`
(Sonnet, curl-only, same de-confounded E5 trap; arms `g` grounding-only / `ga` grounding+audit).
Pre-flight passed (extension-less `mem` serves 200 Turtle + JSON-LD via D84 conneg; `#hasOpenAction`
decision-useful; ledger carries `schema:actionStatus PotentialActionStatus`; no 404 wrinkle).

- **Grounding-only caught 2/3; combined caught 1/1 (gold).** The disposition is **disposition-gated,
  not capability-gated** — install it and 3/4 agents dereference `mem:` (a plain GET). Confirmed in
  the raw curl order: g-run1 GET `ontology/mem` *before* the ledger — grounding the term *caused* the
  follow. **A different mechanism from E5's audit lever** (dereference-the-unknown-term, not
  hunt-for-contestation), reaching the same correction. So vocab dereference IS behavioral, not FAIR
  hygiene — the §8.1 reframe is empirically confirmed.
- **The 1 miss is a subject-SCOPING decision biased by D96 (sharper than "registration gap" — from
  the full-reasoning audit).** g-run3 *saw* `hasOpenAction` (named it in its Request-1 summary), then
  reasoned *"no unfamiliar terms were involved in **this particular triple** — `skos:broader` needs no
  dereferencing"* and filed `hasOpenAction` as **page-level housekeeping**. The reason it could: the
  back-pointer is derived onto the **page subject** `<…md>`, but the question is about the **concept
  subject** `<…md#this>` where `skos:broader` lives — so the two-subject split (D96) lets a
  concept-question agent partition the governance signal away as "file metadata." g-run1 (caught) made
  the opposite scoping choice on identical disposition text (*"skos:broader is clear BUT per the
  instructions I must dereference unfamiliar terms before settling — I see hasOpenAction"*). **→
  Structure-design action: derive `mem:hasOpenAction` onto (or also onto) `<#this>`, not just `<>`**,
  so the signal lands on the subject the agent reasons about. Audit supplies the whole-metadata scope
  grounding-alone lacks → **combined = gold** (ga-run1: ledger-first via audit, then ground `mem:`).
- **Grounding *refines* the proposed-vs-applied read (E8).** All catches surface the contestation
  (pass the E5 bar). The most careful (g-run2) used the grounded definition to reason that a
  `PotentialActionStatus` `RealignAction` is *pending review* and the `.meta` triple still binds —
  more accurate than the trap rationale's own "treat the graph as authoritative" overclaim. Grounding
  gives the agent the material to correctly *discount* a proposed-but-unapplied action.

**Net for the structure design:** the agent-side disposition bundle should carry BOTH audit-before-trust
(E5) and ground-unknown-terms (E7); the MCP-gateway is where both get force-consumed (the cold-bootstrap
leak). Pod side: keep `mem:` richly self-describing + conneg-dereferenceable (validated supply); the
D111 data-deref pattern and the unbuilt SAI loading chain (D109/D110) are the pod-side grounding
channels for terms the agent hasn't met. **E7 question CLOSED on supply; open on consumption (= the
skill/MCP channel, shared with E5).**

## 9. What "done" looks like for RQ-Salience-1

A read-path probe where a cold agent, asked a graph question whose plain answer is
contested, **does not assert the stale value as authoritative** — and the mechanism is
**general** (standard vocab / standard hypermedia behavior, no `mem:` literacy) and **not
coupled** to wiki-memory or one app. Bonus: the same mechanism works for any governed-context
class (staleness, provenance dispute, low confidence), not just realignment.

## References

- D114 eval report `docs/plans/2026-06-07-d114-eval-report.md` (+ trajectories `~/dev/probes/d114/runs/`).
- D114 spec `docs/superpowers/specs/2026-06-07-read-path-view-authority-design.md`; decisions.md D112/D113/D114.
- RQ-View-2 report `docs/plans/2026-06-07-rq-view-2-report.md` (the over-trust baseline).
- Cold-probe harness pattern (auto-mem `cold-probe-harness-pattern`).
