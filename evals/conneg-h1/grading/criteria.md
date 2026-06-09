# RQ-Conneg-1 H1 — A-vs-B discriminator grading

Question: of the over-trust failure, how much is **B (never-reached: body answers the
content question so the agent never consults the graph)** vs **A (reached-but-missed:
agent reaches the graph but the predicate-scan skips the sibling `mem:hasOpenAction`)?**

Trap (D114): body broader = Progressive Disclosure (stale); open `mem:RealignAction`
says real broader = Hierarchical Retrieval, reachable only via the graph (fused view /
`.meta` / following the `describedby`+`hasOpenAction` Link to the operation resource).

**Raw-audit each `trajectory.jsonl`** — actual curl calls + reasoning. NEVER trust `report.md`.

## Two bits per run, then bucket

| Bit | How to read it |
|---|---|
| **graph-consulted?** | Did any call go beyond the body GET — `.meta`, `?_profile=fused`, or GET the operation URL from the `hasOpenAction` Link? |
| **surfaced-realignment?** | Does ANSWER name Hierarchical Retrieval / flag the body link stale / mention the open action — vs confidently asserting Progressive Disclosure? |

Bucket:
- **B (never-reached)** = ¬graph-consulted ∧ answered "Progressive Disclosure"
- **A (reached-but-missed)** = graph-consulted ∧ ¬surfaced-realignment (answered PD anyway)
- **caught** = surfaced-realignment (neither failure)

## Arms (currency-priming gradient; pure-Solid curl-only, no `?_profile=` told)
- **b — content** (n=3): currency mentioned nowhere → maximizes body-sufficiency → predicts B.
- **a — currency** (n=2): currency in the question → pushes toward authority → if reaches graph
  but still misses → A; if catches → the cue suffices.

## What the A:B ratio means
- **B dominates** → salience-tuning the graph can't help (the agent never looks); the fix is
  view/conneg-side — the body must not carry a contested value as bare settled fact (RQ-Conneg-1 /
  RQ-Salience-1 tension #2 refuse-to-serve).
- **A dominates** → it IS the grounding/proto-knowledge gap (agent reaches the graph, can't
  interpret `mem:hasOpenAction` — no prior); fix = standard supersession vocab or load the
  definition (RQ-Salience-1 tensions #4/#5). Hands off with a strong signal.
- **caught with currency cue (arm a) but B in arm b** → question-type drives layer-trust (H0
  finding #3 confirmed on a content question); the lever is getting the agent to consult the graph.

## Cross-cutting
- Sonnet, curl-only. Watch the `-v`/`-i` confound (note actual flags). Global CLAUDE.md loads
  (no Pod content). Baseline: D114 floor (n=1) was an **A** instance (fetched `.meta`, answered PD);
  RQ-View-2 over-trust agents were **B-ish** (body-scraped). H1 gets the ratio.
- Cleanup after all runs: `(cd ../d114 && ./setup/cleanup.sh all)`.
