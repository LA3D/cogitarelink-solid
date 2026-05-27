# Two-Hierarchy Resolver — Cold-Agent Comprehension Eval

**Dates:** baseline 2026-05-26, re-probe 2026-05-27. Branch `rq-listener-1-provenance`.
**Protocol:** fresh general-purpose agent (sonnet), HTTP-only (`curl -sk`), given ONLY the Pod
base URL + a realistic task (store a "Retrieval-Augmented Generation" concept that cites a paper,
is affiliated with an organization, and is broader-related to "Language Models"). No repo, no
hints, no leakage from the design conversation. Asked to narrate confusion, especially about URI
path segments, and rate confidence 1–5. Re-probe ran against the post-mitigation Pod (image
`4381a80`: dogfood note + `wiki:agentGuide` entry-point pointer + index.md clarification deployed).

## Headline

The `wiki` URL segment is a **real, reproducible** orientation hazard. **Two independent cold
agents made the identical misread** — `/vault/wiki/` → "a MediaWiki-style wiki *application*."
The self-description *content* resolves it when read, but **delivery is fragile**: the re-probe
agent found the clarifying note essentially by luck.

## Baseline (pre-mitigation) — confidence 3.5/5

- **Confusion #1:** `wiki` read as an application; "a brief framing error I had to correct."
  Self-corrected via existing self-description.
- Every "what would make this 5/5" suggestion was a self-description improvement, not a URI change.

## Re-probe (post-mitigation) — confidence 3/5 (flat / within noise)

- **Confusion #1 RECURRED:** "my immediate read was: this is a MediaWiki-style wiki application
  mounted at `/wiki/`. Nothing in the URL itself contradicts that interpretation." The `wiki:`
  prefix on storage-description properties (`wiki:shapeCatalog` etc.) *reinforced* the misread.
- **What fixed it:** the agent explicitly cited the deployed dogfood note —
  `/wiki/concepts/two-hierarchy-memory-addressing.md` — sentence "the `wiki` path segment names
  the wiki-memory profile … not a wiki application." So the **content works when read.**
- **Delivery failure (the key finding):** the agent found that note because it was "the only file
  in the concepts container," NOT via the `wiki:agentGuide` entry-point pointer (never followed)
  or the index.md clarification (the Task-11 subagent placed it as an HTML *comment*; the agent
  never dereferenced `/wiki/index.md` at all). Quote: *"only if you happen to dereference that
  specific resource early … An agent that happened to look at another container first would not
  have found that explanation."*
- Its own remedy: *"a single one-page arrival guide at `/.well-known/solid` or the Pod root … the
  storage description has all the mechanical routing information but none of the conceptual framing
  about what `wiki` means."*

### Other confusions (inform the dogfood note + future profile work)
- **#2** `wiki:Source` and `skos:Concept` share `/wiki/concepts/` — counter-intuitive; needs the
  `source.shacl.ttl` agentInstruction to trust the Type Index (D98 merge).
- **#3 (new, significant):** two organization substrates — `/wiki/organizations/` (narrative) vs
  `/contacts/` (vCard). Not distinguishable from the URLs; required reading the `wiki:Person`
  scope note. A genuine forking point.
- **#4** frontmatter projects to the Page `<>`, but some required predicates (e.g. `dct:identifier`
  for `wiki:Source`) belong on the Thing `<#this>` → needed a post-PUT PATCH. The "what projects
  where" rules aren't in one place.
- **#5 (grounding signal):** used `{.affiliation}` on a Concept→Org; "worked syntactically but
  felt semantically questionable" — and the agent did NOT resolve the target to check; it accepted
  the substrate's silent permission. A mild token-entailment datapoint (see below).

## Conclusions

1. **RQ-Substrate-4 is confirmed and reproducible.** Two cold agents independently misread `wiki`
   as an application; the `wiki:` *vocabulary* prefix compounds it. This is empirical support for
   the deliberate re-layering (neutral storage root; `wiki` demoted to a clearly-bounded profile),
   not just a hypothesis.
2. **Self-description mitigation is partial and delivery-fragile.** Content resolves the confusion
   *when read*, but neither `wiki:agentGuide` nor an index.md comment reliably surfaced it. The
   reliable surface is the storage description itself — which would need a literal
   `sh:agentInstruction` (a custom StorageDescriber; `StaticStorageDescriber` emits IRIs only).
   Cheap delivery fixes exist but they remain a band-aid over the URI bias.
3. **Grounding-trap eval still pending.** This round focused on URI comprehension (per the 2026-05-26
   redirect). The original §9 trap test (an `{.affiliation}` edge whose target's *actual* class
   contradicts the predicate's range, to measure resolve-vs-token-entail) was NOT run. Confusion #5
   is a mild token-entailment datapoint suggesting the skill-layer `resolve-before-assert`
   enforcement (the deferred `solid-agent-skills` follow-on spec) is likely warranted — but the
   focused trap eval should be run before committing to it.

## Recommendation

Treat the content-mitigation as shipped-but-weak; do NOT gold-plate it. The re-probe's value is as
**evidence that prioritizes RQ-Substrate-4** (the real fix) and that the eventual re-layering should
deliver conceptual framing at the storage-description entry point, not buried in a content note.
Cross-ref: `FOLLOWUPS.md` → "RQ-Substrate-4"; `.claude/memory/MEMORY.md` RQ list.
