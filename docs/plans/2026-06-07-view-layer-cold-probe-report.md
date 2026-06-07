# View-Layer Cold-Agent Read-Path Probe — Report (2026-06-07)

> **Corrected after raw-trajectory audit (2026-06-07, same day).** The first pass
> of this report claimed "Arm A PASSED 2/2 — the trailer delivers." Reading the
> actual `trajectory.jsonl` files (not the agents' self-reports) showed both Arm-A
> agents used `curl -v`, so both *also* saw the `mem:hasOpenAction` Link header —
> the runs do **not** isolate the body trailer as the delivery mechanism. The
> honest findings, and the architecture decision they led to, are below.

The D113 view layer (`docs/superpowers/specs/2026-06-07-view-layer-design.md`)
shipped the A′ conditional `<!-- pod:notice -->` trailer to fix D112 Probe-2: the
`mem:hasOpenAction` Link header was emitted but cold curl agents read body-only and
missed it. This probe re-ran that read-path question.

- **Harness:** `~/dev/probes/viewlayer/` (reuses the D112 rig). Sonnet, curl-only,
  empty cwd outside all repos, full stream-json captured.
- **Baseline:** D112 Probe-2 = 0/2 (`docs/plans/2026-06-06-d112-cold-probe-report.md`).
- **Two arms:** A = markdown (trailer applies), 2 runs; B = Turtle `/id/schemes/orcid`
  (faithful D112 replication, trailer cannot apply), 1 run.

## Verdict (corrected)

**The probe did not cleanly validate the trailer, and the raw audit + a follow-up
tool-tier check reframed the whole question.** The defensible conclusions:

1. **Governed-context delivery is a tool-tier property, and it works.** The CLI
   fused read (`solid-pod read`) surfaces `mem:hasOpenAction` on the Turtle
   `/id/schemes/orcid` record — content-type-agnostic — because it fetches the
   `.meta` sidecar and merges it. This is the channel RQ-View-2 proved tool-equipped
   agents actually use (fused `read`, never `sparql`, never headers).
2. **The curl floor is degraded-by-design and behaved exactly so.** The Arm-B floor
   agent followed its nose competently to the record and did the task; it never saw
   the open action because its pattern is `-s` (body) on resources, and governed
   context lives in `.meta`/headers, not the body.
3. **The markdown trailer is not demonstrated to deliver anything the header
   didn't,** and under the architecture decision below it is redundant.

### Architecture decision (Chuck, 2026-06-07)

**curl is a degraded floor — a follow-your-nose channel, not a governed-context
channel. Metadata lives in the `.meta` layer. The fused-read tier (CLI / planned
Pod MCP) is the delivery contract for governed context.** Consequences:

- Governed context (open actions, staleness, provenance) is NOT guaranteed at the
  curl floor. The floor's in-band signposts are the standard, content-type-agnostic
  ones already emitted: `Link rel="…hasOpenAction"` + `describedby`. An agent that
  inspects them follows its nose to the `.meta`; one that doesn't is degraded by
  design.
- The substrate's governed-context contract is the **fused read** — resource +
  `.meta`, merged, content-type-agnostic — delivered through the tool the agent
  actually uses.
- The A′ markdown trailer smears a rendering of `.meta` into the content body, which
  contradicts "metadata lives in `.meta`," is unproven as a delivery channel, and
  duplicates the fused read. It is a candidate for removal/demotion (see "What we do
  about it").

## Raw-trajectory audit (ground truth, not self-reports)

### Arm A — markdown, 2 runs

| | run1 | run2 |
|---|---|---|
| curl invocation | `curl -s -v …` | `curl -v …` |
| calls total | 1 | 1 |
| saw Link header (`-v`) | **yes** | **yes** |
| saw body trailer | yes | yes |
| dereferenced op IRI / `.meta` | no | no |
| noticed + caveated the open action | yes | yes |

Both noticed the open action and surfaced it unprompted as a "not authoritative —
verify first" caveat — a real positive for *salience once the signal is in front of
the agent*. But the `-v` means the header was in front of them too, so this is **not**
a test of the trailer-as-sole-channel. The trailer's only isolated contribution was
the inline rationale text (the header carries just the opaque op IRI). Each agent
acted off the single `-v` response without a second fetch. **The clean test — plain
`curl -s` on markdown, header invisible, trailer the only channel — was never run.**

### Arm B — Turtle `/id/schemes/orcid`, 1 run

Discovery path (genuine follow-your-nose): root → `resources/` → `meta/` →
`capabilities/` → `routing.jsonld` → `wiki/concepts/` → read
`how-identifiers-work.md` (which named the `/id/schemes/` catalog) → one path fumble
(`/vault/id/schemes/` → `NotFoundHttpError`) → self-corrected to root `/id/schemes/`
→ orcid record → tested the provider (live 200). Task completed correctly.

Call pattern: **`-I` on containers, `-s` (body only) on resource records.** Never
inspected the orcid record's headers; never followed `describedby`. The open action
was therefore invisible — the floor behaving exactly as the architecture decision
says it should: content follow-your-nose works; governed context requires the tool
tier or an explicit header/`describedby` follow.

### Tool-tier check (the decisive follow-up)

```
solid-pod read /id/schemes/orcid  →  "mem#hasOpenAction": { "@id": ".../id/.operations/…" }
```

The fused read surfaces the open action on the RDF record. Server-side `?_profile=
graph` and `?_profile=fused` did **not** (the view layer is `/vault`-scoped — the
`/id/` substrate has no `?_profile=` coverage). So today only the CLI's own sidecar
merge delivers it on RDF; the server views need to be brought up to the same
content-type-agnostic, substrate-wide behavior.

## What this means for the research questions

- **RQ-Atomic-Feedback-1 (read-path):** the delivery contract is the fused-read
  tier, and it works (CLI proven). The curl floor is not a governed-context channel
  by design. The trailer is not a validated delivery mechanism.
- **RQ-Substrate-4:** the URI/namespace slice is validated (RQ-View-2). The
  view-layer "read-path" piece is **not** closed the way the first draft claimed —
  what's validated is that the *tool-tier fused read* delivers governed context;
  the server-side view layer still has gaps (see below). Do **not** mark
  RQ-Substrate-4 closed yet.

## What we do about it (open — to scope next)

1. **De-scope/relocate the trailer.** Either remove `TrailerDecoratingStore`
   entirely (rely on `Link rel` + `describedby` as the floor signposts + fused read
   as the contract), or demote it to a *pure pointer* ("this resource has governed
   context — follow `describedby`") rather than a rendering of the rationale. Keep
   the 422 marker guard only if the trailer survives in some form.
2. **Make the server fused/graph view substrate-wide + content-type-agnostic** so
   `?_profile=fused` on any resource (incl. `/id/`) matches what the CLI read does.
   This is the real "view layer" — one declared projection, delivered through the
   server view, the CLI, and the MCP (spec §3.1's three execution contexts, which we
   only half-built).
3. **Fix the eval to test the deployed tier.** Add a CLI/MCP (Tier-3) arm, like
   RQ-View-2, instead of curl-only. That is the tier the governed-context contract
   lives at.

## Status

- Cold probe: **inconclusive on the trailer** (Arm A `-v`-confounded; Arm B = floor
  as designed). Tool-tier fused read **confirmed** as the working governed-context
  channel.
- Architecture decision recorded: curl = degraded floor; metadata in `.meta`; fused
  read = contract.
- D113 §8 eval hook: run, but it changed the question rather than closing it.
- RQ-Substrate-4: **still open** (view-layer server-side gaps remain).
- Follow-ups: trailer disposition; substrate-wide content-type-agnostic fused view;
  Tier-3 eval arm.
