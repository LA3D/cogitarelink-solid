# D111 Cold-Agent Validation Probes — Report (2026-06-05)

The spec §7.4 probes, run same-day against the live deployed substrate (HEAD `c6cea53` + the
bootstrap memory). Instrument: three independent cold subagents (Sonnet — a deliberately
mid-tier agent; legibility must not require a frontier model), HTTP-only (curl), forbidden
from reading any repo files or docs. Their prompts contained NO D111 conventions — only a
task and either a typed literal (probes 1a/1b) or the pod root URL (probe 2). Trajectory
logs were the primary deliverable; scored against the D102 three-axis frame (trajectory /
outcome / round-trip).

## Verdict: 3/3 trajectories correct; 2 seed-data bugs found and fixed

| Probe | Task | Trajectory | Outcome |
|---|---|---|---|
| 1a | Resolve `"10.1038/sdata.2018.29"^^<…#doi>` → machine-readable metadata | ✅ Dereferenced the datatype FIRST (before any training-knowledge shortcut), walked catalog → record → providers, applied the declared conneg provider | ✅ correct title + year (via fallback, see Bug 1) |
| 1b | Resolve `"how-identifiers-2026"^^<…#citekey>` → the resource | ✅ Subject 404 → storage description → **the entry-point `sh:agentInstruction` sentence explicitly steered it** → catalog → record → wiki-search provider → resolved | ✅ round-tripped to the seeded `how-identifiers-work.md` — the memory teaching identifiers was found *through* the identifier system |
| 2 | Register a new scheme (`acme-asset`), starting from the pod root only | ✅ Root → storage description (`sub:identifierSchemeCatalog` — "could not have guessed `/id/`") → `constrainedBy` → shape → exemplar (`GET /id/schemes/doi`, as the `sh:agentInstruction` directs) → roles → conformant PUT | ✅ **201 on the first attempt, zero 422s**; derived catalog entry verified by the agent itself |

## Key behavioral findings

1. **The catalog is consulted even when shortcuts exist.** Probe 1a could have jumped
   straight to doi.org from training knowledge; it dereferenced the datatype first. The
   datatype-as-dispatch design behaves as intended for a mid-tier agent.
2. **The in-band teaching chain is load-bearing, link by link.** Probe 1b used the
   entry-point instruction literal (added the same day); probe 2 explicitly credited the
   shape's `sh:agentInstruction` ("GET /id/schemes/doi for a worked exemplar") with avoiding
   the `#this` fragment trap (spec §10 hazard 1) — the registration that the design predicted
   would need a 422 correction loop succeeded first-try because the contract was advertised
   well enough to read *before* writing.
3. **Self-reports cleanly separated pod-taught from prior knowledge** — the substrate's
   conventions (catalog location, record structure, provider patterns, the fragment rule)
   were all learned from the pod; only generic HTTP/RDF semantics came from training.
4. **Recovery channels worked when data was wrong** (both bugs below): the OSLC 400's
   error body taught probe 1b the correct query syntax; probe 1a fell back on conneg
   knowledge. Errors-as-teaching held up.

## Seed-data bugs found (both fixed same day)

- **Bug 1 — `doi` record:** the conneg provider declared only
  `application/vnd.datacite.datacite+json`, which doi.org serves **only for
  DataCite-registered DOIs** — Crossref DOIs (the majority, including our own sampleID)
  return "No acceptable resource available". Fix: added a registration-agency-independent
  `<#doi-org-csl>` provider (`application/vnd.citationstyles.csl+json`, verified live) and a
  `skos:note` scoping the DataCite provider.
- **Bug 2 — `citekey` record:** the provider `urlPattern` said `?ext=search-grep&q={$id}`,
  but the live wiki-search affordance requires OSLC Query syntax. Fix: pattern corrected to
  `?ext=search-grep&oslc.searchTerms=%22{$id}%22` (verified live: resolves to the seeded
  page).

Both bugs are exactly the class the probes exist to catch: records that were plausible,
shape-conformant, *and wrong about the world*. SHACL validates structure; only resolution
attempts validate providers. (Follow-up consideration for the Tier-2 curation loop: a
provider liveness check — substitute each record's `sampleID` into each `urlPattern` and
verify the declared media type comes back.)

## Open observations (not bugs)

- Probe 2's record used a placeholder provider URL (`acme.example.com`) — the shape cannot
  and should not validate provider reachability; the curation loop could flag dead providers.
- Probe residue (`acme-asset` record) was deleted post-probe; derived entry confirmed gone.
- RQ-Discovery-1 gains a positive datapoint: the cold-arrival ritual (root → storage
  description → catalog) carried all three probes with zero out-of-band help.
