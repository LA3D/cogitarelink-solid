# RQ-Conneg-1 H1 — A-vs-B discriminator (cold-probe report)

**Date:** 2026-06-09. **Question:** of the over-trust failure, how much is **B (never-reached:
body answers the content question, agent never consults the graph)** vs **A (reached-but-missed:
agent reaches the graph but the predicate-scan skips the sibling `mem:hasOpenAction`)?**
**Harness:** `~/dev/probes/conneg-h1/` (D114 over-trust trap; Sonnet; curl-only; no `?_profile=` told).

## TL;DR

**A dominates, 4 of 5.** The dual-view *retrieval* is solved by pure Solid — agents reach the
authoritative `.meta` graph, **and `.meta` carries `hasOpenAction`** — yet none registered the
contestation. The remaining over-trust gap is **not** delivery and **not** conneg/view-side; it is
the **proto-knowledge/grounding gap** (RQ-Salience-1 tensions #4/#5), confirmed empirically.
**Delivery is solved; interpretation is the whole problem.**

## Setup

D114 trap: body broader = `[[Progressive Disclosure]]` (stale); open `mem:RealignAction` declares
that link stale, authoritative broader = Hierarchical Retrieval, in the curation ledger. Verified
ground truth: the realignment is reachable via the fused view, the `hasOpenAction` Link header,
**and the plain `.meta` graph** — `hasOpenAction` is a triple on the **page subject `<>`**, while
`skos:broader` is on the **concept subject `<#this>`** (different subjects, same Turtle doc).

Pure-Solid, curl-only, no `?_profile=` mentioned. Two arms = a currency-priming gradient:
**b (content)** — currency mentioned nowhere; **a (currency)** — "how confident is this current/
authoritative vs stale/superseded?" in the question. n=3 b, n=2 a.

## Results (raw-audited trajectories; assistant-text checked, not `report.md`)

| Run | Arm | Graph consulted | Registered contestation | Bucket |
|---|---|---|---|---|
| h1b-run1 | content | `.meta` | no | **A** |
| h1b-run2 | content | `.meta` + pd`.meta` | no | **A** |
| h1b-run3 | content | none (1 body GET) | no | **B** |
| h1a-run1 | currency | `.meta` + Memento timemap | no | **A** |
| h1a-run2 | currency | `.meta` + ld+json + timemap + sibling `.meta`s | no | **A** |

**A = 4, B = 1, caught = 0.** Zero agents mentioned `hasOpenAction`/realign/Hierarchical Retrieval
in their own reasoning or answer (assistant-text grep = 0 for content arm; arm-a "stale/superseded"
hits are the agents echoing the question while concluding the *opposite*).

## Findings

1. **The dominant failure is reached-but-missed (A), not never-reached (B).** Four of five agents
   fetched `.meta`, had `hasOpenAction` in their context, and answered the stale value. B happened
   once — the laziest run (single body GET). So for a tool-capable agent, "never looks at the graph"
   is the minority mode; "looks, but can't see the governance triple" is the rule.
2. **The currency cue did NOT help — it produced more diligent wrongness.** Both arm-a agents,
   explicitly asked "is this current/authoritative vs stale/superseded," did *more* graph work
   (Memento timemap to count versions; tried to resolve the broader target) and concluded
   **"high confidence this is current"** — confidently wrong. They reasoned about currency in the
   vocabulary they *have a prior for* (versions, dangling references) and never connected it to the
   `mem:hasOpenAction` triple sitting in the `.meta` they fetched. This is the RQ-Salience-1 E6
   ceiling test: a currency cue is not sufficient when the agent lacks the vocabulary to recognise
   the actual currency signal. Strong F2/F3 + proto-knowledge signal.
3. **Proto-knowledge hypothesis confirmed (Chuck, 2026-06-09).** Same mechanism as H0's contrast:
   agents follow `describedby` (standard rel, strong prior) but cannot interpret `mem:hasOpenAction`
   (bespoke IRI, no prior) **even when it is in their parsed context.** Doubly explained here:
   (a) bespoke predicate, no prior; (b) on a *different subject* (`<>` page) than the one a
   broader-question scan targets (`<#this>` concept).
4. **Delivery is solved; D114's "fused substrate-wide" was necessary but the native path already
   carries the signal.** `.meta` (the describedby target H0 proved agents take) contains
   `hasOpenAction`. So getting the signal *to* the agent is done. The gap is purely that the agent
   can't *use* it.

## Implications

- **RQ-Conneg-1:** H1 confirms the view layer is not where the over-trust fix lives — agents reach
  the graph fine via pure Solid (`describedby`→`.meta`), and the bespoke `?_profile=` selection was
  again never touched. The over-build verdict stands; the fix is elsewhere.
- **Hand-off to RQ-Salience-1 with a sharp, specific signal:** the lever is **grounding** — either
  express contestation in standard supersession vocab the model already knows
  (`owl:deprecated`/`dcterms:isReplacedBy`/`prov:invalidatedAtTime`/`schema:supersededBy`) so the
  prior fires, or load the `mem:` definition into context (layered context loading, D109/interop) so
  `hasOpenAction` becomes interpretable. The next experiment is RQ-Salience-1 E1 (standard vocab) and
  E7 (grounding), prioritised over any further delivery/view work.
- **Subject placement matters too:** even standard-vocab contestation should sit where a
  predicate-directed scan for the queried edge will hit it — on `<#this>` near `skos:broader`, or on
  the value node the agent's follow-your-nose visits (RQ-Salience-1 E2), not only on the `<>` page subject.

## Cross-cutting
- Sonnet; curl-only; `-v`/`-I` used by all (headers dumped) — not load-bearing (the verdict rests on
  `.meta` being fetched and the answer text, both independent of verbose mode). Global CLAUDE.md loads
  (no Pod content). Baseline consistency: D114 floor (n=1) was an A instance; H1 gives the ratio (4:1 A:B).
- Trap cleaned up after the runs.
