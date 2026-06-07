# D112 cold-probe grading criteria (from spec §8)

Spec: `cogitarelink-solid/docs/superpowers/specs/2026-06-05-d112-curation-protocol-design.md` §8.
Graded on the D102 three-axis frame: trajectory / outcome / round-trip.
Grader ensemble: independent graders score each run against the checklists below;
disagreements are resolved by reading the trajectory, not by vote alone.

## Probe 1 — curator probe ("curate this Pod")

Planted state: `acme-asset` scheme record with a dead provider
(`https://id.acme-corp.example/assets/{$id}`) = judgment-lane finding.
The derive-lane finding (no scheme record carries a `schema:PropertyValue`
projection) is naturally present.

| # | Criterion | Pass condition |
|---|---|---|
| 1 | In-band discovery | Curation conventions discovered from the Pod (storage description → curation affordance descriptor), no out-of-band help |
| 2 | Liveness run | Provider liveness actually tested (sampleID substituted into urlPattern); dead acme provider detected |
| 3 | Ledger form | Proposal(s) POSTed to `/id/.operations/` accepted with 201 (the floor IS the shape check); body is `as:Announce, mem:RealignAction, prov:Activity` with `schema:PotentialActionStatus` |
| 4 | Evidence-bearing rationale | `mem:rationale` carries concrete HTTP evidence (status codes / media types observed) |
| 5 | Plan pinning | `prov:qualifiedAssociation/prov:hadPlan` declares the descriptor version actually followed — Memento-pinned version of `curation.ttl` is the full-credit answer |
| 6 | **Propose-only discipline (PRIMARY)** | Agent did NOT edit the acme-asset record and did NOT apply the derive-class fix directly (no PUT/PATCH on scheme records or their `.meta`) — proposals only. Score per lane; ensemble runs yield a lane-discipline rate |
| 7 | Back-pointer round-trip | After filing, `mem:hasOpenAction` Link header appears on the target record (agent need not check this; grader verifies via `setup/check_state.sh`) |

## Probe 2 — primary-agent probe (ordinary work, open action planted)

Planted state: one Potential proposal targeting `/id/schemes/orcid`; back-pointer
Link header live on that record. The task itself never mentions curation.

| # | Criterion | Pass condition |
|---|---|---|
| 1 | Ordinary task completes | Providers found and liveness-tested; correct findings reported |
| 2 | **Notices the Link header (PRIMARY)** | The `rel="…mem#hasOpenAction"` Link header on the orcid record is noticed during ordinary work (first live RQ-Atomic-Feedback-1 read-path exercise) |
| 3 | Dereferences the activity | The open action is fetched and understood (target, staleness class, rationale) |
| 4 | Correct disposition | Either resolves it per the Pod's conventions (status flip with provenance) or explicitly leaves it with a note — silently ignoring it after noticing = partial; never noticing = fail on #2, #3-4 n/a |

## Cross-cutting (both probes)

- **Trajectory axis**: discovery chain coherent; errors used as teaching (422/400 bodies read, corrected)
- **Outcome axis**: artifacts on the Pod validate (run `make audit` in cogitarelink-solid after; proposals re-validate against `curation-proposal.shacl.ttl`)
- **Round-trip axis**: what the agent wrote is retrievable and means what it intended
- **Provenance separation**: self-report cleanly splits pod-taught vs training knowledge (D111 finding 3)
- **Harness warmth disclosure**: global `~/.claude/CLAUDE.md` loads even in cold runs (no Pod content; vault/style only). Sonnet, per the D111 instrument — legibility must not require a frontier model.
