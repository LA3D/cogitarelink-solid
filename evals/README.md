# Cold-probe eval rigs (portable)

> **Status:** research apparatus, not product. These rigs are the lab notebook for the
> RQ-* questions — co-located with the substrate to prevent drift (the substrate must
> never depend *on* `evals/`). The product conformance suite a forker runs is `tests/`.
> The eventual fork-facing artifact is a Pod-URL-*parameterized* agentic-affordance suite;
> these rigs hardcode `pod.vardeman.me` and are a step toward, not yet, that. (See the
> 2026-06-09 repo-design discussion.)

Rigs present:
- **d112** — curation-protocol probes (2026-06-06).
- **rqview2** — dual-view probes (2026-06-07).
- **d114** — read-path view-authority over-trust trap (2026-06-07); the planters/CLI shim
  reused by the conneg rigs below.
- **conneg-h0 / conneg-h1 / conneg-e8** — RQ-Conneg-1 + RQ-Salience-1 experiments (2026-06-09):
  H0 (do agents conneg?), H1 (over-trust A-vs-B discriminator), E8 (graph-navigation tool).
  Reports: `docs/plans/2026-06-09-rq-conneg-1-{h0,h1,e8-graph-tool}-report.md`.
- **salience-e1 / salience-e5 / salience-e5b / salience-bootstrap / salience-e7** — the
  RQ-Salience-1 disposition arc (2026-06-09/10): standard vocab, audit disposition,
  content-ladenness dose-response, pod-delivered bootstrap, grounding disposition.
  Reports: `docs/plans/2026-06-{09,10}-rq-salience-1-*-report.md`.
- **idxview** — RQ-Discovery-1 definition-line index probe (2026-06-10).
  Report: `docs/plans/2026-06-10-rq-discovery-1-index-view-report.md`.
- **skill-nav** — the SP1 gate: skill-delivered disposition vs prompt-injected gold (2026-06-10).
  Report: `docs/plans/2026-06-10-sp1-skill-nav-eval-report.md`.
- **generalization** — disclosure discipline against the operation-shaped addressbook app
  (2026-06-10/11). Report: `docs/plans/2026-06-10-generalization-probe-report.md`.
- **e5b-write** — write-side E5b twin: floor vs content-laden instruction vs write
  disposition, graded rationale quality (2026-06-11).
  Report: `docs/plans/2026-06-11-e5b-write-twin-report.md`.

**Cross-rig dependencies (copy together):** `conneg-h1` and `conneg-e8` reuse `d114`'s
over-trust trap (`../d114/setup/plant_overtrust.sh`); `conneg-e8` carries its own portable
`bin/solid-pod`. When copying out to run, take `d114` alongside `conneg-h1`/`conneg-e8`.

Scripts/prompts/grading only — run artifacts (trajectory.jsonl, agent reports, pod-state
snapshots, captured ledger bodies) are machine-local under `~/dev/probes/<rig>/runs/` on the
machine that ran them (gitignored); the committed reports in `docs/plans/` summarize them.

**To run on a new machine:** copy the eval dir somewhere OUTSIDE any repo
(in-repo cold agents inherit CLAUDE.md/MEMORY = warm), e.g.
`cp -R evals/rqview2 ~/dev/probes/`, then follow the per-eval README/criteria.
Requires: live Pod at HEAD (`make reset && make verify`), `claude` CLI,
mkcert CA installed. The Tier-3 arm additionally needs the solid-agent-skills
`dist/` built (shim resolves it via `$SOLID_AGENT_SKILLS` or the conventional
sibling path).

**Operational rules** (earned the hard way — full notes in the auto-memory
`cold-probe-harness-pattern` and the two reports):
- Launch probes via the harness background mode, never a nested shell `&`.
- Reset Pod state between ensemble runs; same-uptime only (in-memory seen-maps).
- ALWAYS raw-audit trajectory.jsonl against the self-reported trajectory.
- Capture Pod artifacts (check_state.sh) BEFORE cleanup.
