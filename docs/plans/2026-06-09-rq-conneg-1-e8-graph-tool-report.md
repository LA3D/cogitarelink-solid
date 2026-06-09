# E8 — Does the graph-navigation tool change over-trust? (cold-probe report)

**Date:** 2026-06-09. **Question (Chuck):** the probes so far only let agents *read the graph
document* (GET `.meta`). We also have graph-*navigation* tools (`solid-pod sparql` / `invoke`).
If agents had those, would over-trust change? What does the tool give in graph-view vs document?
**Harness:** `~/dev/probes/conneg-e8/` (D114 over-trust trap; Sonnet; tools = curl + `solid-pod` CLI).
Sits across RQ-Conneg-1 and RQ-Salience-1 (E5 disposition / E8 tool channel).

## TL;DR

**The graph tool does NOT fix over-trust on its own — it's a disposition gap, not a capability gap.**
Free-CLI agents (2/2) used `sparql`/`wiki-search`/`read` only to *re-confirm* the body value and
missed the contestation. Directed agents (2/2) — told to "check operation history" — both *found*
the open `RealignAction`, and then **split on a legitimate judgment call**. Same lever as E1/E7:
agents won't audit governance cold; once pointed at it, they do.

## Arms (curl + `solid-pod` CLI; over-trust trap; content question; n=2 each)
- **free** — given the CLI, told only "`solid-pod --help` to discover it." Disposition test.
- **directed** — same, plus: "before answering, use the tool to retrieve the resource's operation
  history and weigh whether the value is current." Capability test.

## Results (raw-audited trajectories)

| Run | Used graph nav | Reached the open action | Answer | Bucket |
|---|---|---|---|---|
| free-run1 | `sparql` (FILTER 'progressive'), `wiki-search`, `read` | no | Progressive Disclosure | **missed** |
| free-run2 | `read`, `wiki-search` | no | Progressive Disclosure | **missed** |
| directed-run1 | `read`, `links` → curl operation | **yes** | **Hierarchical Retrieval** | **caught + corrected** |
| directed-run2 | `read`, `links` → curl operation, timemap, versions | **yes** | Progressive Disclosure | **registered, defensibly discounted** |

Contestation mentions in agent *reasoning text*: free = 0, 0; directed = 8, 11.

## Findings

1. **Free arm: graph navigation is used to confirm, not to audit (2/2 missed).** free-run1 even ran
   a `solid-pod sparql` — but `FILTER(CONTAINS(...,'progressive'))`, i.e. searching to *confirm* the
   body value, not to check currency. The tool makes the agent more *precise*, not more *curious*.
   This is the predicted "predicate/keyword-directed query projects the sibling away" — same root as H1.
2. **Directed arm: the directive flips disposition; both then follow the `hasOpenAction` link (2/2).**
   What carried the signal was NOT an affordance — it was `solid-pod read`/`links` exposing the
   `mem#hasOpenAction` reference, which the agent (now looking for history) followed to the
   `/id/.operations/` resource and read. The *same* `hasOpenAction` they ignored in H1 (as a Link
   header / `.meta` triple) became followable once the task disposed them to look for history.
3. **Once registered, interpretation is a real judgment call — and the agents split, defensibly.**
   - directed-run1 → Hierarchical Retrieval, "high confidence it's the intended current broader,"
     caveat that the body edit is pending.
   - directed-run2 → Progressive Disclosure, *with reasons*: the action is `PotentialActionStatus`
     (proposed, not applied); Hierarchical Retrieval **404s** (the target doesn't exist); the
     operation says "treat the graph as authoritative" and the graph still asserts PD across all
     versions. **This is not a salience failure — it's a correct-ish reading** that a proposed
     realignment to a non-existent concept is weak grounds to override the asserted value.
   - Implication: surfacing the contestation is *necessary but not sufficient* — the **semantics of
     the surfaced signal** (proposed vs applied; target exists vs dangling) drive the decision. The
     trap conflates "proposed" with "binding"; a diligent agent rightly weighs that.

## Answer to Chuck's question

- **Graph-view vs graph-document, for this question:** no extra information — the contestation is
  single-resource; `sparql` over `.meta` returns the same triples (free agents proved it by querying
  to re-confirm PD). The decisive content lived in a *different* resource (the `.operations/` log) —
  genuinely "wider information" — but agents only traversed there when *directed to look for history*.
- **Would the tool change over-trust?** Not by presence. Only by *disposition*: a task/grounding that
  makes the agent audit governance before trusting a value. That is the same conclusion as H1 →
  E1/E7: the lever is grounding/disposition, not the view layer or the tool surface.

## Substrate / tooling gaps surfaced (file to FOLLOWUPS)
- **`memory-history` affordance is not guessable.** Both agents guessed `operation-history` and got
  HTTP 500; the real name is `memory-history`. The substrate-authored "check history" query is the
  right E8 mechanism but is undiscoverable by name.
- **`solid-pod invoke` resolves a malformed descriptor URL** for an unknown affordance:
  `<resource>/meta/affordances/<name>.ttl` (note the `<resource>/meta` path) → 500 rather than a
  clean 404 / catalog lookup. Possible CLI bug worth a look before relying on `invoke` in probes.

## Cross-cutting
- Sonnet; curl + `solid-pod` (PATH-injected shim, TLS pre-wired). Trap cleaned up after runs.
- Baseline: D114 Tier-3 (n=1) used `read`, missed — consistent with the free arm here.
