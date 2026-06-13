# PSP enrichment round-trip probe (PSP-T7) — report

**Date:** 2026-06-13 · **Branch:** `prov-scoped-projection` · **Rig:** `evals/proj-enrich/`
**Model:** Haiku (mechanism-validation probe — deterministic substrate behavior, NOT a
disposition measurement; per the model-selection policy in `evals/README.md`). **n=2.**

## What it validates

The provenance-scoped-projection (PSP) **enrichment round-trip**: a cold agent's OWN `.meta`
annotation survives a subsequent body rewrite + re-projection. This is the D82-dissolution
behavior of the PSP build — the `MarkdownProjectionListener` re-derives only the predicates it
governs (provenance-scoped) and leaves agent-authored triples intact, instead of clobbering the
whole `.meta` graph on every body write. Observed end-to-end by a cold agent over plain HTTP.

## Design

One run = a cold Haiku agent (curl-only, `Bash(curl:*),Write`), slim ROUTE/ANSWER/PROVENANCE
prompt, told to: (1) read `photosynthesis.md` + its `.meta` via `describedby`; (2) PATCH the
`.meta` (`text/n3` `solid:InsertDeletePatch`) inserting ONE triple on the `#this` entity under a
self-minted `https://example.org/probe#` predicate, dated today; (3) rewrite the body definition
sentence (prefLabel intact) and PUT it back; (4) re-GET `.meta` and report survival. The runner
snapshots `meta-before.ttl` / `meta-after.ttl` / `body-after.md` per run as raw-audit ground
truth. The probe mutates live state; `make reset` restores it afterward. No reset between run1 and
run2 (by design — same-uptime; run1's triple is visible as run2's baseline, see below).

## Per-run results (curl ground truth, not agent narration)

| Run | PATCH landed? | own triple | survived re-projection? | bodyHash changed (proj fired)? | agent verdict | agree w/ curl? | verdict |
|-----|---------------|-----------|--------------------------|--------------------------------|---------------|----------------|---------|
| run1 | yes (205) | `probe#annotatedOn "2026-06-13"^^xsd:date` | **yes** — present in `meta-after.ttl` | yes (`7404b2…`→`0f3855…`) | "YES, survived" | **agree** | **PASS** |
| run2 | yes (205) | `probe#reviewedOn "2026-06-13"^^xsd:date` | **yes** — present in `meta-after.ttl` | yes (`0f3855…`→`84b97b…`) | "persisted unchanged" | **agree** | **PASS** |

run2 baseline carried run1's `annotatedOn` (no inter-run reset); run2's OWN minted triple is
`reviewedOn`. Both probe triples survived run2's body PUT. In both runs the re-derived SKOS
triples + updated `bodyHash`/`projectorVersion`/`dc:modified` coexist with the agent's
annotation on `#this` — the projection is genuinely predicate-scoped, not a wholesale rewrite.

## Mechanism verdict

**SURVIVED 2/2.** The PSP enrichment round-trip holds: an agent-authored `.meta` triple
survives a body re-projection. The `bodyHash` change in both runs proves the projection listener
actually fired on the body PUT (it was not a no-op), and the probe triple persisted anyway —
this is the D82-dissolution behavior observed by a cold agent. Mechanism validated.

## Haiku capability note

Haiku formed the `solid:InsertDeletePatch` in **both** runs without escalation. The path was not
frictionless but recovered cleanly:
- run1 first sent raw N3 triples (no patch wrapper) → **422**; the agent read the error, switched
  to the `solid:InsertDeletePatch` wrapper → **205**. The floor taught the syntax, the agent
  learned it in one step.
- The curl leading-`@` footgun (a `-d` body starting with `@prefix` is read as a filename, exit 26;
  and the markdown body's `# ...` line triggers curl's path-validation guard) hit both runs. Both
  recovered using `--data-raw` (PATCH) and `--data-binary @file` via a `Write`-composed scratch
  file (PUT) — exactly the e5b-write lesson the rig's `Write`-allowed sandbox anticipates.

No INCONCLUSIVE runs, no sonnet fallback needed.

## Raw-audit finding (agent narration vs curl truth)

**They agreed in both runs.** Each agent narrated "annotation survived" and its quoted
before/after triples matched the independently-captured `meta-after.ttl`. run2's agent even
inferred the mechanism correctly in PROVENANCE ("body rewrites … do not overwrite the .meta file
… preserves user-added annotations independently"). No narration/ground-truth divergence to flag.

## Cost

`$0.26` total across 2 runs (run1 `$0.14`, run2 `$0.12`; Haiku). Cache-read-dominated; output
6–7k tokens/run on the slim template.

## Caveats

- **n=2, Haiku, mechanism-not-disposition.** This is a deterministic-substrate check, not a
  behavioral/disposition measurement — Sonnet (the comparison instrument) is deliberately not used.
- No inter-run Pod reset (same-uptime ensemble rule); run2's baseline inherited run1's triple. This
  does not weaken the verdict — run2's OWN minted triple (`reviewedOn`) independently survived.
- The probe mutated `photosynthesis.md`'s body/definition; restored via `make reset` (+ seed wait).
- `.meta`'s `skos:definition` was NOT re-derived to match the new body sentence (definition
  projection is a separate concern from this probe; the probe only tests agent-annotation survival).
