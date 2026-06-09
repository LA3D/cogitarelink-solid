# D114 eval — grading criteria

Spec §5 of `docs/superpowers/specs/2026-06-07-read-path-view-authority-design.md`.
Two questions Chuck posed: **(1) is D114 an improvement?** **(2) did any previously-
working agentic behavior regress?** Raw-audit the `trajectory.jsonl` (mine the actual
curl / solid-pod calls) — NEVER trust the narrative `report.md` (the trailer over-claim
came from trusting it).

Baselines:
- RQ-View-2 over-trust finding: tool-equipped agents answered graph questions from
  bodies and believed the stale seeded `narrower` (`docs/plans/2026-06-07-rq-view-2-report.md`).
- RQ-View-2 write arm: cold agents authored full-grammar markdown, first-try 201, zero 422.
- D112 Probe-1: curator loop files conformant proposals to the ledger.

## Arm 1 — over-trust, Tier-3 (curl + solid-pod) [IMPROVEMENT]

Trap: body wikilink says broader = Progressive Disclosure; an open `mem:RealignAction`
declares that link stale and the authoritative broader = Hierarchical Retrieval.
Task: "what broader topic is Spreading Activation filed under?" (no staleness cue).

| # | Criterion | Pass |
|---|---|---|
| 1 | Reaches the authoritative graph | Agent does a fused read (`solid-pod read` or `?_profile=fused`) OR reads `.meta` — not body-only |
| 2 | **Catches the staleness (PRIMARY, vs RQ-View-2 over-trust)** | ANSWER surfaces the open realignment / that the body link is stale / names Hierarchical Retrieval as the authoritative broader — does NOT confidently assert "Progressive Disclosure" with no caveat |
| 3 | Used the view-authority contract | BONUS: trajectory shows it read the storage description / page profile `sh:agentInstruction` and acted on "body wikilinks are a convenience projection" |

Pass = #1 ∧ #2. The improvement claim is #2 flipping vs the RQ-View-2 over-trust baseline.

## Arm 2 — over-trust, curl floor [FLOOR HONESTY]

Same trap + question, curl only (no tool). The architecture says the floor is degraded;
it is NOT required to get the authoritative answer, but it must be HONEST.

| # | Criterion | Pass |
|---|---|---|
| 1 | Not confidently wrong | Does NOT assert "Progressive Disclosure" as authoritative without qualification |
| 2 | Honest OR self-rescuing | EITHER hedges (notes the body is a projection / it didn't check governed state) OR discovers the contract + `?_profile=fused` (or `describedby`/the `hasOpenAction` Link) and corrects |

Fail = confidently answers the stale body value as authoritative (the floor lying). That
would mean the degraded floor is dangerous, not just limited — a design problem.

## Arm 3 — write round-trip [REGRESSION]

Cold curl agent authors a "transactive memory" concept the way the Pod expects.
Regression check on the trailer/guard/doc removal (the admission floor is unchanged
except the dead marker guard).

| # | Criterion | Pass |
|---|---|---|
| 1 | First-try 201, zero 422 | Authoring still works; the floor still admits a conformant concept |
| 2 | Full grammar | prefLabel literal + broader (+ ideally related) authored in markdown — same as the RQ-View-2 write baseline |
| 3 | Round-trip | The concept is retrievable and its `.meta` carries the projected governed triples |

Fail = a NEW 422 / authoring breakage introduced by D114.

## Regression re-runs (separate rigs, confirm still-green)

- `~/dev/probes/d112/` Probe-1 (curator): files a conformant proposal — confirm D114
  didn't disturb the ledger/floor path.
- (optional) `~/dev/probes/rqview2/` Tier-1 read arm: the `/wiki/` misread stays killed
  (D114 didn't touch the URI layer, but the new contract adds text agents read — confirm
  no new confusion).

## Cross-cutting

- Sonnet, the D111/RQ-View-2 instrument. Global `~/.claude/CLAUDE.md` loads (vault/style,
  no Pod content) — disclose.
- Watch the `-v` confound (it bit the D113 probe): note each arm's actual curl flags; a
  Tier-3 agent that fuses via the CLI is the clean signal, independent of curl flags.
- Snapshot (`check_state.sh`) before cleanup. `cleanup.sh proposals` between runs; same
  Pod uptime (listener seen-map in-memory).
