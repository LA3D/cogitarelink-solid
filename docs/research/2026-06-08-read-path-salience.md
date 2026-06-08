# Read-Path Salience — Why Delivered Governed Context Doesn't Change Agent Behavior (RQ-Salience-1)

**Status:** OPEN research thread. Framing + evidence + experiment matrix + one
recommended-but-undecided direction. NOT a spec — we may be framing the design wrong,
and want more agentic-behavior experiments before committing a fix.
**Opened:** 2026-06-08, out of the D114 eval (`docs/plans/2026-06-07-d114-eval-report.md`).
**Reload context:** this doc + the eval report + the trajectories at `~/dev/probes/d114/runs/`
+ decisions D112/D113/D114 + RQ-View-2 report. This is enough to resume cold.

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
   a cheap, general lever independent of the positioning question.

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

Notes: E5/E6 calibrate whether the failure is substrate (F1) or agent (F2). E6 with a cue is
the *ceiling* — if agents still over-trust *with* a "is it current?" cue, that's a strong F2/F3
signal. Keep n≥2 per cell; raw-audit reasoning; watch the `-v` confound.

## 8. Prior art to pull (before/while experimenting)

- **Standard supersession/deprecation vocab:** `owl:deprecated`; `dcterms:isReplacedBy`/
  `replaces`; `prov:wasRevisionOf`/`prov:invalidatedAtTime`/`prov:wasInvalidatedBy`;
  `schema:supersededBy`. Which do current models actually recognize + act on? (E1.)
- **Statement-level annotation:** RDF 1.2 / RDF-star quoted triples; classic reification;
  singleton properties; named-graph-per-statement. Follow-ability + tooling reality.
- **Verborgh, *What's in a Pod?*** — contextualized statements (policy/provenance/trust per
  triple) is exactly the hybrid-KG frame; staleness is another such context.
- **Vault (agentic-memory) notes:** LLM-Wiki-v2 "confirmed by 3 sources, confidence 0.9";
  Dense-Mem evidence→claim→fact; conflict/contradiction handling; `@dedecker-2025-blank-node-context`.
  The field is converging on confidence/provenance-bearing edges — relevant to F3.
- **This repo:** D109 derive/floor/loop (the curation source); D112 (the ledger); the
  withdrawn D113 trailer (the token-layer-salience datapoint we may have over-killed);
  the D114 view-authority contract (the unconsulted teach-the-convention artifact).

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
