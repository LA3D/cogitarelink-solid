# View-Layer Cold-Agent Read-Path Probe — Report (2026-06-07)

The D113 view layer (`docs/superpowers/specs/2026-06-07-view-layer-design.md`)
shipped the A′ conditional `<!-- pod:notice -->` trailer to fix the negative
result D112 Probe-2 found: the `mem:hasOpenAction` Link header was emitted but
never reached cold curl agents (they `curl -s` body-only). This probe re-runs that
read-path question now that the open-action signal rides the markdown **body**.

- **Harness:** `~/dev/probes/viewlayer/` (reuses the D112 rig). Sonnet, curl-only
  (`--allowedTools "Bash(curl:*)"`), empty cwd outside all repos, full stream-json
  captured. Global `~/.claude/CLAUDE.md` loads (vault/style only — no Pod content).
- **Baseline to beat:** D112 Probe-2 = **0/2** (`docs/plans/2026-06-06-d112-cold-probe-report.md`).
- **Two arms** (the instrument decision — see "Why two arms"):
  - **Arm A — markdown** (the fix): open action on a wiki concept → trailer in the
    default GET body. 2 runs.
  - **Arm B — turtle** (coverage probe): faithful D112 Probe-2 replication on the
    RDF `/id/schemes/orcid` record, where the trailer cannot apply. 1 run.

## Verdict: Arm A PASSED 2/2 (trailer delivers the signal — RQ-Substrate-4 view-layer piece behaviorally validated); Arm B NEGATIVE 0/1 (confirms the fix is markdown-scoped — RDF resources are the next gap)

### Why two arms

The D112 Probe-2 target (`/id/schemes/orcid`) is `text/turtle`. The
`TrailerDecoratingStore` guard is `contentType === "text/markdown"` — you cannot
inject an HTML-comment trailer into Turtle. A literal re-run on the same target
would show the trailer absent for a reason that has nothing to do with whether the
body channel works. So the fix is tested where it applies (Arm A, markdown) and the
original RDF target is run as a separate **coverage probe** (Arm B) — a negative
there is a finding (the markdown-only scope), not a regression. This is the
framing-first / instrument-confounds-are-findings discipline from the harness memory.

### Arm A — markdown trailer (the fix), 2 runs

Planted: wiki concept `vl-probe-topic.md` ("Tiered Retrieval", conformant — passes
the floor) + one open `mem:RealignAction` (rationale = a renamed `skos:broader`
target). Task = "summarize this note." The task **never mentions curation**. Plant
asserted the trailer present in the body before each run.

| Criterion | run1 | run2 |
|---|---|---|
| 1 Ordinary task completes (faithful summary) | ✅ | ✅ |
| 2 **Notice enters context (PRIMARY, vs D112 0/2)** | ✅ | ✅ |
| 3 Dereferences the op activity (second fetch) | ✗ (unneeded) | ✗ (unneeded) |
| 4 Disposition (surfaces as caveat / acts) | ✅ "not authoritative — verify before relying" | ✅ "should not be treated as authoritative" |
| 5 No false write-back of the trailer | ✅ | ✅ |

Both runs summarized the note **and**, unprompted, surfaced the open action as a
caveat that the note's `skos:broader` link is stale and the record is not
authoritative until realigned. Criterion #3 is ✗ in a *good* way: the trailer
front-loads type + op IRI + **rationale** inline, so the agent had enough to act
without a second fetch.

### Arm B — turtle coverage probe (faithful D112 replication), 1 run

Planted: one open action on `/id/schemes/orcid` (RDF/Turtle); back-pointer Link
header confirmed live. Task = D112 Probe-2 verbatim (find ORCID providers + test
liveness).

| Criterion | run1 |
|---|---|
| 1 Ordinary task completes | ✅ providers found + liveness-tested |
| 2 Notices the open action | ✗ (expected — same as D112) |

The agent did a thorough discovery sweep and fetched the orcid record with
`curl -s … -H "Accept: text/turtle"` — **body only, no `-I`/`-v` on that GET** — so
the Link header (the only signal on an RDF resource) was invisible. Exact
reproduction of the D112 0/2 mechanism.

## Raw-trajectory audit (ground truth vs self-reports)

Mined the actual `curl` tool calls from each `trajectory.jsonl` (never trusting the
narrative `report.md`):

- **Arm A run1:** one call — `curl -s -v …vl-probe-topic.md`. **run2:** one call —
  `curl -v …vl-probe-topic.md`. Both used `-v`, so both *also* received the Link
  header. **But the actionable content the agents quoted — the rationale string
  ("the `skos:broader` target … was renamed …") — exists only in the body
  trailer**; the Link header carries an opaque op IRI (exactly what D112's agents
  ignored). So the trailer is what carried the disposition-driving content. The `-v`
  is a confound for "body-only" purity but not for the result: the trailer is in the
  body regardless of curl flags, whereas the Link header appears only if the agent
  chooses `-I`/`-v` on that resource.
- **Arm B run1:** 16 calls; the decisive one is `curl -s …/id/schemes/orcid -H
  "Accept: text/turtle"` — no `-I`/`-v`. The agent *did* use `-I` on containers
  (`/vault/`, `/id/schemes/`) but not on the record, so it never saw the record's
  Link header. Confirms: on RDF resources the signal depends on a header fetch the
  agent doesn't reliably make.

## Artifact audit

- Escape hatch holds: `…vl-probe-topic.md?_profile=doc` returned the stored body
  byte-identical (no trailer) in both Arm-A snapshots — the pristine round-trip the
  write path depends on.
- No agent attempted to write the trailer back (the 422 marker guard never fired —
  a clean run).
- Pod `make audit` after the eval: **0 ERROR / 1 WARN (intentional D98 dup-container)
  / 1 INFO**. (An unrelated audit-script `ValueError: Invalid isoformat string:
  '[YYYY-MM-DD]'` prints but does not affect the 0-ERROR verdict — a placeholder
  date somewhere; tracked as a minor audit-script followup.)

## What this means

- **RQ-Atomic-Feedback-1, read-path variant — second live datapoint = POSITIVE for
  markdown.** D112 Probe-2 was the first (negative, Link-header channel). The A′
  trailer converts the *delivery* failure into a *salience* test, and cold agents
  pass it 2/2: the signal arrives in the body they already read, and they treat it
  as signal (caveat the user, don't silently rely). The body is the reliable
  agent-facing channel; the Link header is not.
- **RQ-Substrate-4 — view-layer piece behaviorally validated.** With the URI/namespace
  slice already validated (D107 / RQ-View-2 misread KILLED 2/2) and now the view
  layer's read-path delivery validated for the wiki-memory substrate, RQ-Substrate-4
  is **closeable**. (Closing it formally is a decisions.md edit — Chuck's call.)
- **The next gap = RDF resources.** Arm B shows scheme records, contacts, and other
  Turtle resources still rely on the Link header that curl agents miss. The trailer
  is structurally markdown-only. Candidate fixes (out of scope here, for the next
  brainstorm): fold the governed/open-action `.meta` into the served representation
  of RDF resources, or make the **graph/fused view the default** for RDF resources
  (an open-action triple in a served-by-default graph view would be in-band the way
  the trailer is for markdown). This is the RDF analogue of the A′ decision.

## Status changes

- View-layer cold probe: **Arm A PASSED 2/2 / Arm B NEGATIVE 0/1 (coverage gap, expected).**
- D113 §8 eval hook: **DISCHARGED.**
- RQ-Substrate-4: behaviorally validated end-to-end (URI slice + view layer);
  **closeable** pending a decisions.md edit.
- New FOLLOWUP: RDF-resource open-action surface (trailer is markdown-only) — the
  next read-path design question.
