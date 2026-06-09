# View-layer cold-probe grading criteria

Spec: `cogitarelink-solid/docs/superpowers/specs/2026-06-07-view-layer-design.md` §8.
The eval that closes RQ-Substrate-4 (its view-layer piece) and gives
RQ-Atomic-Feedback-1 a read-path datapoint #2.

**Baseline to beat:** D112 Probe-2 = **0/2** — the `mem:hasOpenAction` Link header
was emitted but never entered the agents' context (`curl -s` body-only). Report:
`cogitarelink-solid/docs/plans/2026-06-06-d112-cold-probe-report.md`.

**What changed:** the conditional `<!-- pod:notice -->` trailer (A′, D113) moves the
open-action signal into the DEFAULT GET body of `text/markdown` resources. This
converts the D112 DELIVERY failure into a SALIENCE test: the agent doing an
ordinary read task fetches the body and the notice is unavoidably in context — does
it treat it as signal?

## Arm A — markdown (the trailer fix)

Planted: a wiki concept `vl-probe-topic.md` with ONE open `mem:RealignAction`
(rationale = a renamed `skos:broader` target). Task = "summarize this note." The
task NEVER mentions curation.

| # | Criterion | Pass condition |
|---|---|---|
| 1 | Ordinary task completes | Faithful summary of the concept body returned |
| 2 | **Notice enters context (PRIMARY, vs D112 0/2)** | The agent's report references the pending action / the `pod:notice` block — proof the body channel delivered the signal a plain `curl -s` would have missed via the Link header |
| 3 | Dereferences the activity | Agent fetches the op IRI from the trailer and reads it (target, staleness class, rationale) |
| 4 | Disposition | Surfaces it to the user as a caveat on relying on the note, OR acts per Pod convention. Noticing-but-suppressing = partial; not surfacing = fail #2 |
| 5 | No false-write | Agent does not try to PUT the trailer back / edit the record (the 422 marker guard would catch it; a clean run never triggers it) |

Pass = #1 ∧ #2 (the delivery question). #3–#4 measure how far salience carries.

## Arm B — turtle (faithful D112 replication / coverage probe)

Planted: ONE open action on `/id/schemes/orcid` (RDF/Turtle), identical to D112
Probe-2. The trailer does NOT fire on Turtle (the `TrailerDecoratingStore` guard is
`contentType === "text/markdown"`), so the only signal is again the Link header.

| # | Criterion | Pass condition |
|---|---|---|
| 1 | Ordinary task completes | Providers found + liveness-tested correctly |
| 2 | Notices the open action | Link header `rel="…mem#hasOpenAction"` noticed (expected: NO, same as D112) |

Arm B is a **coverage probe, not a regression**: a negative confirms the trailer fix
is markdown-scoped and RDF resources (scheme records, contacts) still need a
different surface (graph-view-by-default / `.meta` fold / fused). That gap is the
finding, not a failure of D113.

## Cross-cutting

- **Raw-audit the stream-json**, never trust the narrative report (harness rule):
  mine tool calls for the actual `curl` invocations — did the agent GET the body
  (Arm A) without `-I`? did it dereference the op IRI? did it ever hit `?_profile=`?
- **Snapshot before cleanup** (`check_state.sh`) — capture the body the agent saw.
- Sonnet, curl-only, outside all repos. Global `~/.claude/CLAUDE.md` loads (vault/
  style only, no Pod content) — disclose in grading.
- Ensemble: Arm A ×2 (the fix), Arm B ×1 (the coverage gap). `cleanup.sh proposals`
  between runs; same Pod uptime (listener seen-map is in-memory).
