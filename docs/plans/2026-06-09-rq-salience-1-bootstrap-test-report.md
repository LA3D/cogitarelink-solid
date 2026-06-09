# Bootstrap-delivered disposition test (cold-probe report)

**Date:** 2026-06-09. **Question:** E5 proved a *prompt*-delivered audit disposition flips over-trust.
Can the **pod** deliver it instead — via the bootstrap surface a cold agent reads — so the
"bootstrapped" cold-agent use case works without a skill or MCP? **Change tested:** added a
content-laden read-path audit section (name the failure mode + hunt for `mem:hasOpenAction`/
`RealignAction`) to the existing `sub:agentGuide` (`how-wiki-memory-works.md`) that `.well-known`
already advertises. Reversible live PUT, no architecture change. **Harness:** `~/dev/probes/salience-bootstrap/`.

## TL;DR

**Content works end-to-end when consumed (1/1 that read the guide caught it) — but the consumption
chain leaks badly.** Two leaks: (1) cold agents handed a resource URL **don't bootstrap at all**
(0/3 touched `.well-known`); (2) even *told* to read the self-description, only 1/3 followed the
`sub:agentGuide` pointer to the prose guide where the disposition lives. The bootstrap channel is
**necessary but insufficient** for cold agents; the disposition is one pointer too deep.

## Arms (de-confounded over-trust trap; curl-only; same instrument as E5/H1)

| Arm | Prompt | Result |
|---|---|---|
| **consumption** (n=3) | generic ("here's the pod, answer X") — does it bootstrap cold? | **0/3** fetched `.well-known`; went straight to the resource URL; **missed 3/3** |
| **efficacy** (n=3) | "orient yourself: read the pod's self-description + any agent guide first" | all 3 fetched `.well-known`; **only 1/3 chased `sub:agentGuide` → caught**; 2/3 stopped at `.well-known` and missed |

Anchors: H1 (no disposition → miss 4/5); E5 (prompt-delivered disposition → catch 3/3).

## The mechanism (chain-of-thought)

- **efficacy-run3 (caught) — the proof the content works pod-side:** read `.well-known` → concept →
  `.meta` (confirmed `skos:broader → PD`) → fetched the agentGuide → *"the `.meta` confirms PD, **but
  I notice the agent guide says to check for open `mem:hasOpenAction` links before trusting a value**.
  The concept's headers showed one… I must fetch it."* → followed the operation → caught. It had
  **already seen** the `hasOpenAction` Link header and would have ignored it (confirm-mode, like H1);
  reading the guide flipped it to audit-mode and it went back for the link. **This is the E5 mechanism,
  delivered by the pod.**
- **efficacy-run1/run2 (missed):** read `.well-known`, absorbed the *structural* orientation ("SKOS
  backbone, `skos:broader` is the navigation axis"), then went straight to the concept and confirmed
  `skos:broader → PD`. They **did not fetch the agentGuide** — the disposition lives one pointer past
  `.well-known`, and the `.well-known` `sh:agentInstruction` literal they *did* read carries only
  *write*-path guidance, nothing for the read path. Structural orientation got absorbed into confirm-mode.
- **consumption-run1-3 (missed):** went straight to the named resource URL; never read `.well-known`
  at all. Given a direct resource, cold agents don't perform the bootstrap ritual.

## Findings → design implications

1. **Pod-delivered disposition is viable in principle** (efficacy-run3) — the content placed in the
   agentGuide produced the exact E5 audit behavior. So this is a *delivery/consumption* problem, not a
   content problem.
2. **Placement depth matters: Layer-0-immediate > Layer-1-pointer.** The disposition was in the
   agentGuide (one hop past `.well-known`); 2/3 nudged agents read `.well-known` but didn't chase the
   pointer. The `.well-known` `sh:agentInstruction` *literal* (immediate, no follow) is the right home
   — and it currently lacks read-path disposition. **Cheap next cut:** move the audit disposition into
   that literal (Components.js `void-description` config edit + `make reset`) and re-run efficacy — does
   immediate placement raise the 1/3 follow-rate?
3. **The consumption leak is structural and motivates the other two channels.** Cold agents handed a
   resource URL don't bootstrap (0/3). The bootstrap channel cannot be *relied on* for them. This is
   exactly why use cases 1 (skilled: disposition baked in, no bootstrap needed) and 2 (MCP: gateway
   injects it) exist. **The pod's Layer-0 should be the source of truth the skill/MCP derive from, not
   the sole delivery path.**

## What this says about the minimum-index question

The minimum set's *disposition* component (M4) only lands via bootstrap if it's in the **immediate**
Layer-0 surface (`.well-known` `agentInstruction` literal), not behind a pointer — and even then,
only for agents that bootstrap at all. The structural/ontology orientation (M1/M2/M3) *was* consumed
(agents read `.well-known` and used "SKOS backbone, broader is the axis") but got absorbed into
confirm-mode without the disposition. So: **orientation is consumed and insufficient; disposition is
the load-bearing, hardest-to-deliver piece** — consistent with the whole H1→E5b arc.

## Caveats
- n=3/arm, Sonnet, one trap. Reversible: agentGuide restored to original; trap + op deleted. The
  validated augmented guide content is saved at `~/dev/probes/salience-bootstrap/setup/agentguide-augmented.md`
  for baking into the overlay if we proceed.
