# Cold-probe eval rigs (portable)

The harnesses that ran the D112 curation-protocol probes (2026-06-06) and the
RQ-View-2 dual-view probes (2026-06-07). Scripts/prompts/grading only — run
artifacts (trajectory.jsonl, agent reports, pod-state snapshots, captured
ledger bodies) are machine-local under `~/dev/probes/{d112,rqview2}/runs/` on
the machine that ran them; the committed reports in `docs/plans/` summarize
them.

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
