# RQ-Conneg-1 H0 — Do agents do plain content negotiation? (cold-probe report)

**Date:** 2026-06-09. **Question:** RQ-Conneg-1 §7 H0 — the foundational measurement.
**Harness:** `~/dev/probes/conneg-h0/` (Sonnet, curl-only, empty cwd, raw-trajectory audit).
**Doc:** `docs/research/2026-06-08-solid-view-mechanism-vs-profiles.md`.

## TL;DR

**H0 = YES — robustly.** Agents do content negotiation and competent Linked-Data
discovery. The pessimistic hypothesis (RQ-Conneg-1 reason #3: "agents can't conneg, so
conneg-by-profile is on sand") is **falsified at the conneg level**. The cracks, if any,
are higher up (`?_profile=` selection), not at the foundation.

## Instrument

Clean concept `h0-conneg.md` (no staleness trap). Question asks for two facts —
`dct:modified` and `dct:conformsTo` — that live **only** in the `<>`-page graph and are
**absent from the markdown body** (verified: 0 body mentions). This dodges the dual-layer
confound (RQ-View-2: agents answer graph questions from the body because the body carries
the projected graph). The only answer paths are: conneg (`Accept: text/turtle`/`ld+json`)
or follow `describedby`→`.meta`. Ground truth: `modified = 2026-06-09T12:09:53.641Z`,
`conformsTo = meta/profiles/page` (a W3C PROF profile bundling a SHACL shape).

Three arms = increasing cue: **a** bare, **b** "each note is also an RDF graph view",
**c** the `Accept`+`describedby` mechanics spelled out.

## Results (raw-audited from `trajectory.jsonl` — actual curl calls, not `report.md`)

| Arm | Conneg the **document**? | Follow `describedby`→`.meta`? | Facts | Conf. |
|---|---|---|---|---|
| a-run1 (bare) | no (`Accept: text/markdown`) | **yes** — HEAD→read `describedby`→`.meta` `Accept: text/turtle` | correct | high |
| a-run2 (bare) | no | **yes** — HEAD→`.meta` `Accept: text/turtle, ld+json;q=0.9` | correct | high |
| b-run1 (told-graph) | **yes** (`Accept: text/turtle` on doc) | yes | correct | high |
| c-run1 (told-conv) | **yes** (`Accept: text/turtle` on doc) | yes | correct | high |

Every arm: correct facts, high confidence, reached the authoritative graph. n=2 bare + n=1
each cue (bare was the surprising/foundational cell; cues are confirmatory).

## Findings

1. **Bare agents do Linked-Data discovery, not body-scraping.** Both bare runs went
   **HEAD-first** to read Link rels, then followed `rel="describedby"` to `.meta` and
   requested RDF with an explicit `Accept: text/turtle[, application/ld+json]` header. This
   is deliberate (the explicit RDF Accept on `.meta` is the tell — independent of the
   `-v`/`-I` header-dump confound; run2 even used q-values).
2. **`describedby` is the load-bearing native mechanism — not Accept-on-the-document.**
   Bare agents reach the full graph via `describedby`→`.meta`; they did **not** conneg the
   document itself for turtle. This is exactly the path RQ-Conneg-1 §4 identifies as
   authoritative and §8 says to keep.
3. **Media-type conneg of the document appears only with a cue.** Arms b/c (told a graph
   view exists / told the mechanics) flipped agents into `Accept: text/turtle` on the
   document. So Accept-on-resource conneg is a *capability they have but don't reach for
   cold* — they prefer the `describedby` route by default.
4. **PROF-as-resource-kind-hint earns its keep; conneg-by-profile is untouched.** Every
   agent discovered the profile via `dct:conformsTo` + `Link: rel="profile"`, dereferenced
   it, and correctly identified it as a W3C PROF `prof:Profile` bundling a SHACL shape. But
   **none used `?_profile=` or `Accept-Profile`** — the selection machinery. The parts that
   worked are the parts §8 keeps (describedby, media-type conneg, PROF as a *hint*); the
   bespoke selection layer was never reached.

## Confound notes (D114 discipline)

- `-v`/`-I` confound is present (all arms dumped headers) but **not load-bearing**: the
  conneg verdict rests on the explicit RDF `Accept` header sent to `.meta` (a deliberate
  act), and on the bare-vs-cued difference in Accept-on-document (a real behavioral delta),
  neither of which is an artifact of verbose mode.
- Global `~/.claude/CLAUDE.md` loads (vault/style, no Pod content). Sonnet, the
  D111/RQ-View-2/D114 instrument.
- Read-only probe; clean concept DELETEd after the runs.

## What this means for the ladder

- **H0 answered: agents conneg.** Reason #3 is dead — the floor is solid.
- **H1 (pure Solid vs PROF stack) is now strongly pre-favored:** agents natively use
  `describedby` + media-type conneg + dereference the PROF hint, and never touch
  `?_profile=`. The pure-Solid path *already* gave every agent the graph. H1 should confirm
  this on the dual-view/over-trust tasks (does removing `?_profile=` change anything? — §3
  expectation: no).
- **H2 (does conneg-by-profile add value?)** narrows to: is there ever a case an agent
  reaches for `?_profile=` selection that `Accept`+`describedby` couldn't serve? H0 found no
  such reach. Pending a genuine multi-same-media-type-projection need (§5 suggests we don't
  have one).

## Keep / shed (provisional, pending H1)

- **Keep (validated by behavior):** `.meta`/`describedby`; media-type conneg; PROF as a
  resource-kind *hint* (D86); fused-as-tool; Person cross-cutting view.
- **On the table to shed (H1 must confirm):** `?_profile=` per-resource conneg-by-profile +
  the `sub:View` doc/fused/graph descriptors as a *selection* mechanism — agents reached the
  graph without them.
