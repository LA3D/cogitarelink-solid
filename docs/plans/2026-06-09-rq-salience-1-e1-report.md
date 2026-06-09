# RQ-Salience-1 E1 — standard supersession vocab, node-level (cold-probe report)

**Date:** 2026-06-09. **Question:** does expressing the contestation in STANDARD vocab
(`dcterms:isReplacedBy`) — vs the bespoke `mem:hasOpenAction` that H1 showed agents miss
4:1 — make a bare agent surface it? **Harness:** `~/dev/probes/salience-e1/` (Sonnet, curl-only).

## TL;DR

**No — standard vocab did not fix it (0/3 surfaced the contestation).** The lever is not the
vocabulary *token*. Two compounding barriers, both placement/disposition not vocabulary:
(1) **reachability** — 2/3 never received the signal (the content question is answered upstream
of the target's graph); (2) **sibling-invisibility recurs** — the 1 agent that read the target's
`.meta` ignored `dc:isReplacedBy` exactly as H1 agents ignored `mem:hasOpenAction`, because it's a
*sibling* of the `prefLabel` it came for. Node-on-traversed-target placement does NOT escape the
sibling-scan miss.

## Setup (de-confounded vs the D114 trap)

Both broader targets resolve (no dangling-ref escape). Contestation expressed PURELY in standard
vocab, NO `mem:hasOpenAction`:
- `e1-spreading-activation.md` — body `[[Progressive Disclosure]]{.broader}`; `.meta` `skos:broader → progressive-disclosure#this` (stale, matches body).
- `progressive-disclosure.md` — exists; `.meta` carries `dcterms:isReplacedBy → hierarchical-retrieval#this` (the standard-vocab signal, node-level on the traversed target).
- `hierarchical-retrieval.md` — exists, resolves 200.

Bare content question ("what broader topic is SA filed under?"), curl-only. **Pass = surfaces that
PD is superseded/replaced by HR (does not assert PD as settled).** NOT "must answer HR". Baseline:
H1-b bespoke-sibling-bare (4/5 missed).

## Results (raw-audited; per-run check of whether the signal was *received*)

| Run | PD fetch | `isReplacedBy` in response? | Surfaced? | Bucket |
|---|---|---|---|---|
| e1-run1 | `progressive-disclosure.md` (body/markdown) | **no** (signal is `.meta`-only) | no | never-reached |
| e1-run2 | `progressive-disclosure.md.meta` | **yes** | **no** — read it for `prefLabel`, ignored the sibling | reached-but-missed |
| e1-run3 | (never fetched PD) | n/a | no | never-reached |

0/3 surfaced; agent-text contestation mentions = 0,0,0.

## Findings

1. **Standard vocab is not the lever, at this placement.** The single agent that received
   `dcterms:isReplacedBy` (run2) missed it the same way H1 agents missed `mem:hasOpenAction` — it
   was a sibling triple of the `prefLabel` the agent fetched the target for. Proto-knowledge helps
   an agent *follow* a known rel (`describedby`, H0); it does nothing for a triple the agent never
   *scans*, standard or not. **Vocabulary ≠ salience when the signal is a non-scanned sibling.**
2. **Node-on-traversed-target placement does NOT escape sibling-invisibility** — my pre-registered
   worry (tension #1) made flesh. The agent visits the target *for its label*; the supersession
   triple is a sibling of the label, so the same predicate-directed scan dodges it.
3. **Reachability is the bigger barrier (2/3).** A *content* question ("what's the broader?") is
   satisfied by the subject's own `skos:broader` edge + the target's label — the agent fetches the
   target's body (label) or skips it, and the target's `.meta` (where the signal lives) is off the
   required path. Echoes H1/E8: the answer is gettable without auditing, so no audit happens.

## Caveat

Only run2 actually tested "salience-when-reached" (n=1) — the others never received the signal
(~1/3 natural reach rate for the target's `.meta` on a content question). The "standard vocab missed
when reached" claim is n=1; firming it needs more runs that reach PD's `.meta`, or a reach-forcing
variant. The "0/3 at the bare-content level" claim is solid.

## Implication — redirect the lever

The next lever is NOT a different standard predicate. E1 says the problem is **placement + disposition**,
not vocabulary:
- **Placement on the required path, not a sibling.** A signal the agent must traverse *for the answer*
  (e.g. the `skos:broader` object itself), not a sibling of an incidental fetch. → an *applied* edge
  (graph asserts the corrected value) or a value-level contestation (tension #2 refuse-to-serve: don't
  serve a clean settled `skos:broader → PD`).
- **Disposition (E5).** E8's directed arm already flipped behavior 2/2 by telling the agent to audit
  governance. That remains the strongest observed lever; E1 makes it look like the *general* one.
- **E7 (grounding) still untested** — but E1 suggests grounding a *sibling* triple won't help either
  unless the agent is disposed to scan for it.

## Cross-cutting
- Sonnet, curl-only; `-v` used (headers dumped) — not load-bearing (verdict rests on which PD URL was
  fetched + whether the response bytes contained `isReplacedBy` + the answer text). Global CLAUDE.md
  loads (no Pod content). Concepts cleaned up after.
