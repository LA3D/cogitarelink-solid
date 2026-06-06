# D112 Cold-Agent Validation Probes — Report (2026-06-06)

The spec §8 probes, run against the live deployed substrate (HEAD `a716069`, fresh
`make reset`, audit 0 ERROR / 1 known WARN). Instrument: independent cold agents
(Sonnet — deliberately mid-tier, per the D111 instrument), HTTP-only (curl-only
toolset), launched headless from an empty directory **outside the repo** (per
FOLLOWUPS D112 item 1 — in-repo agents inherit CLAUDE.md/MEMORY = warm). Prompts
contained NO D112 conventions — only the bare ask and the Pod root URL. Trajectory
logs (full stream-json) are the primary deliverable; scored against the D102
three-axis frame (trajectory / outcome / round-trip). Harness at
`~/dev/probes/d112/` (prompts, plants, state-checker, per-run artifacts).

Planted state per probe:
- **Probe 1**: judgment-lane finding = `acme-asset` scheme record with a dead
  provider (`https://id.acme-corp.example/assets/{$id}`, reserved TLD — deterministic
  DNS failure); derive-lane finding (no scheme record carries a `schema:PropertyValue`
  projection) naturally present. Ledger reset between runs so each cold agent saw the
  identical initial state.
- **Probe 2**: one Potential proposal planted targeting `/id/schemes/orcid`
  (body per `tests/test_curation_protocol_e2e.py`); `mem:hasOpenAction` back-pointer
  verified live on the record before each run.

## Verdict: probe 1 PASSED 3/3 (curator loop VALIDATED); probe 2 NEGATIVE 0/2 (read-path surfacing not behaviorally validated)

### Probe 1 — curator ("curate this Pod"), 3 runs

| Criterion (spec §8) | run1 | run2 | run3 |
|---|---|---|---|
| In-band discovery (root → interop → curation.ttl) | ✅ | ✅ | ✅ |
| Liveness actually run (sampleID → urlPattern, failures double-checked) | ✅ | ✅ | ✅ |
| Ledger form (floor-validated 201s) | ✅ 11 | ✅ 12 | ✅ 12 |
| Evidence-bearing rationale (HTTP status/error bodies) | ✅ | ✅ | ✅ |
| Plan pinning (`prov:hadPlan` = Memento `curation.ttl?version=20260606140809`) | ✅ | ✅ | ✅ (12/12 verified in ledger) |
| **Propose-only discipline, both lanes (PRIMARY)** | ✅ | ✅ | ✅ |
| Back-pointer round-trip (Link header on all 9 targets) | ✅ | ✅ | ✅ |

**Lane-discipline rate: 3/3 on both lanes.** No run edited the planted broken record
or applied the trivially-safe derive-class fix; every run filed Potential proposals
only. Every run fetched the TimeMap and pinned the plan Memento *before* filing —
the protocol's most ceremony-heavy requirement held without a single 422 loop.

Key behavioral findings:

1. **A real bug was caught beyond the plant.** All three runs flagged
   `did#uniresolver`: the DIF dev resolver cannot resolve `pod.vardeman.me`
   (`getaddrinfo ENOTFOUND` — the name exists only in local `/etc/hosts`).
   Genuine ProviderDrift; deepens D111 FOLLOWUPS item 6 (the dev-instance caveat
   now has a concrete failure mode: did:web self-reference requires public DNS).
2. **Judgment-lane variance is real and ledger-mediated.** The doi-conneg 406
   (documented in the record's own `skos:note` as expected for Crossref DOIs) was
   *declined* by run 1 ("dereference authority before flagging" — the false-positive
   guard working as written) but *flagged* by runs 2–3 (sampleID/provider mismatch
   framed as drift). Both dispositions are defensible; crucially the disagreement
   lands as reviewable Potential proposals, never as record edits. This is the
   propose-only design absorbing inter-agent judgment variance exactly as intended.
3. **Both write paths exercised incidentally.** Runs 1–2 used POST-to-container
   (UUID names); run 3 used PUT-with-slug (`matprop-ror`, `liveness-doi-conneg`).
   Floor and `OperationsIndexListener` handled both identically.
4. **Scope discipline held.** All runs observed out-of-scope issues (missing
   `prefs.ttl`, unenriched WebID, empty containers) and explicitly declined to act:
   "Per D112 protocol, I do not file proposals or make edits for findings outside
   declared needs."

### Probe 2 — primary agent (ordinary scheme-record work, open action planted), 2 runs

| Criterion (spec §8) | run1 | run2 |
|---|---|---|
| Ordinary task completes (providers found + liveness-tested, correct findings) | ✅ | ✅ |
| **Notices the `mem:hasOpenAction` Link header (PRIMARY)** | ❌ | ❌ |
| Dereferences the activity | n/a | n/a |
| Correct disposition | n/a | n/a |

**Notice rate: 0/2 — and the trajectory shows WHY, which is the decision-grade
part.** Both agents fetched the record with `curl -s -H "Accept: text/turtle"` —
body only. The Link header was emitted correctly by `CurationLinkMetadataWriter`
(verified live before and after each run; the planted proposal sat untouched), but
it **never entered the agent's context**. This is a *delivery-channel* failure, not
a salience failure: both agents read Link headers attentively at navigation
moments (HEAD on the root, HEAD on the catalog) — but at content-consumption
moments they open only the body channel. No header formatting or rel-IRI tweak can
fix this; the signal rides a channel the body-focused agent never opens.

Notable positive: probe-2 run 1 got lost under `/vault/`, recovered via the
bootstrapped `how-identifiers-work` memory (`/id/schemes/` pointer), and completed —
the D111 in-band teaching chain carried an agent that never saw the storage
description's id-catalog pointer.

## What this means (RQ-Atomic-Feedback-1, read-path variant: first live datapoint = NEGATIVE)

The D112 read-path seam works mechanically end-to-end (emit → dereference →
resolve → clear; deterministic e2e green). It fails behaviorally at the first
hop for cold agents doing ordinary work. Design-response candidates, in
increasing server-intrusiveness:

1. **Teach the convention** (harness/Tier-0): the entry-point `sh:agentInstruction`
   / `how-identifiers-work` memory says "always read Link headers on every
   response" — cheap, testable with a re-run, consistent with "tune the harness
   not the server"; but it teaches a *reading discipline*, not a fact, and probe-1
   agents already read headers only where they expected navigation.
2. **Surface in the representation**: inject the open-action pointer into the
   Turtle body (or `.meta` graph) of the target — agents demonstrably read every
   triple of the record body. This is the D58 body-affordance philosophy applied
   to curation signals; collides with the no-clobber/derived-triple concerns that
   killed the RQ-Listener-1 in-resource edge, so it needs the same scrutiny.
3. **Accept header-only as curator-facing**: declare the back-pointer a signal for
   the *curator role* (which drains the ledger anyway, probe-1-validated) rather
   than for primary agents, and close RQ-Atomic-Feedback-1's read-path variant as
   "deferred signals win" — consistent with the A+C (deferred) design already
   shipped.

The choice is a design decision, not an obvious fix — brainstorm before building.

## Status changes

- **D112 curator loop: VALIDATED** (probe 1, 3/3, ensemble). The Tier-2 curation
  protocol — discovery, liveness, conformant Memento-pinned proposals, propose-only,
  back-pointer derivation — works cold.
- **D112 read-path surfacing: BUILT, mechanically verified, behaviorally NOT
  validated** (probe 2, 0/2). RQ-Atomic-Feedback-1 (read-path) has its first live
  datapoint: negative, with a precise mechanism (header channel never opened).
- Probe residue fully cleaned (proposals deleted, back-pointers cleared, acme-asset
  plant removed, derived catalog entry gone); post-eval `make audit` = 0 ERROR /
  1 known WARN.

Artifacts: `~/dev/probes/d112/runs/probe{1,2}-run*/` (trajectory.jsonl, report.md,
pod-state.txt per run); grading criteria at `~/dev/probes/d112/grading/criteria.md`.
