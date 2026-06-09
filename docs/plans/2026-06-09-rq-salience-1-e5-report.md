# RQ-Salience-1 E5 — disposition (cold-probe report)

**Date:** 2026-06-09. **Question:** does a Pod-agnostic *disposition* preamble (break confirm-mode →
audit-mode) make a curl agent surface the contestation, where H1 — **identical signal, no preamble** —
missed it 4:1? **Harness:** `~/dev/probes/salience-e5/` (Sonnet, curl-only).

## TL;DR

**Yes — 3/3 caught it.** A general "audit-before-trust" instruction (no `mem:`/`hasOpenAction`
literacy) flipped behavior completely vs the H1 baseline. **Disposition is the lever** — and it's
substrate-light (a prompt-level instruction), Pod-agnostic, and overcomes *both* the reachability
barrier (agents now fetch the operation record) *and* the proto-knowledge/salience barrier (they
register and follow the bespoke `hasOpenAction` because they're auditing, not confirming).

## Setup (apples-to-apples with H1)

Identical to the de-confounded D114 trap — REAL substrate signal (`mem:RealignAction` open action +
derived `mem:hasOpenAction`), both broader targets resolve, curl-only. **The ONLY change vs H1 is the
prompt:** a Pod-agnostic preamble — *"the surface value may be out of date… do NOT simply confirm the
first value… actively check the resource's full metadata and any linked governance, revision, or
operation records for signals that the value is contested, stale, or replaced."* No `mem:` terms.
Pass = surfaces the contestation (does not assert PD as settled).

## Results — 3/3 caught (raw-audited incl. full chain-of-thought)

| Run | Disposition from step 1? | Reached the operation record? | Answer | Bucket |
|---|---|---|---|---|
| e5-run1 | yes (*"check governance/provenance signals before reporting"*) | yes (.meta → operation) | PD "contested and superseded"; authoritative = Hierarchical Retrieval | **caught** |
| e5-run2 | yes | yes — *"the response shows a `hasOpenAction` link I must inspect"* | "CONTESTED / PENDING SUPERSESSION"; HR intended but realignment incomplete | **caught (gold standard)** |
| e5-run3 | yes (*"check… any governance/provenance metadata"*) | yes | Hierarchical Retrieval per governance record; body/graph stale | **caught** |

## Findings

1. **Disposition is sufficient — and it's the mechanism flip, in the chain-of-thought.** Where E1
   showed all agents in *confirm-mode* from step 1 ("that's the answer, let me verify"), all three E5
   agents are in *audit-mode* from step 1 ("check governance/provenance **before reporting**"). The
   single prompt change moved them from confirming to auditing, and auditing is what makes them fetch
   the operation record and read the rationale.
2. **Disposition overcomes the proto-knowledge gap (the key result).** run2 *explicitly registered the
   `mem:hasOpenAction` link* — the exact bespoke signal that was invisible in H1 (*"a `hasOpenAction`
   link I must inspect"*). An agent in audit-mode doesn't need a prior for `mem:hasOpenAction`; it sees
   an unfamiliar link, inspects it because it's auditing, and the operation's rationale is legible
   English. So the fix does NOT require standard vocab OR loading the definition — disposition alone
   bridges it. (Updates the H0/H1 proto-knowledge framing: ungroundedness only bites a *confirming*
   agent; an *auditing* agent investigates the unknown link.)
3. **A disposed agent handles proposed-vs-applied correctly on its own.** run2: surfaced the
   contestation AND noted the `RealignAction` is `PotentialActionStatus`/pending, incomplete on both
   sides. The E8 worry (surfacing ≠ acting) is handled by the agent's own judgment once it's auditing —
   we don't need to resolve the status semantics in the substrate for the agent to give an honest answer.

## Caveats / what this does NOT settle

- **n=3, one model (Sonnet), one trap.**
- **The preamble is fairly strong/explicit** ("do NOT simply confirm… actively check… for signals that
  the value is contested, stale, or replaced"). It nearly tells the agent what it will find. A *minimal*
  nudge might not flip as cleanly → a **disposition-strength gradient** is the natural follow-up (E5b:
  weakest instruction that still works).
- **Where the disposition lives is the productionization question.** This was a prompt instruction. For
  the real system it must live somewhere durable and reliably-read: agent system prompt / a skill /
  a learned procedure (GEPA-gskill, per the skill-acquisition research) / substrate-delivered guidance
  the agent actually consumes (the D114 view-authority contract was *unconsulted* — delivery ≠ consumption).

## Implication

E5 confirms the E1 redirect: **the lever is disposition (F2), not representation.** The over-trust fix
is substrate-light — install an audit-before-trust disposition — and general (Pod-agnostic, no `mem:`
literacy, overcomes proto-knowledge). Next: (a) E5b strength-gradient (how minimal a nudge works);
(b) the "where does the disposition live" question — which is exactly the skill-acquisition agenda.

## Cross-cutting
- Sonnet, curl-only; `-v` used (not load-bearing — verdict rests on reaching the operation + answer +
  CoT). Global CLAUDE.md loads (no Pod content). Minor: all 3 first guessed an `e5-`-prefixed target
  name (404) then found the unprefixed concept — naming confound, didn't block. Concepts cleaned up after.
