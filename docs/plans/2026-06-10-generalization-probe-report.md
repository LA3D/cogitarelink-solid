# Generalization probe — does the disclosure discipline reach operation-shaped apps?

**Date:** 2026-06-10 · **Rig:** `evals/generalization/` (run from `~/dev/probes/generalization/`) ·
**Model:** Sonnet · **App:** addressbook (`/vault/contacts/`, query-shaped) ·
**Spec:** `2026-06-10-agentic-progressive-disclosure-contract-design.md` §3/§11/§12 ·
**Lineage:** sibling of the SP1 skill-nav eval; gates SP2.

## Question

Every prior behavioral result is **navigation-shaped** (wiki E5/E7 traps, the idxview index).
Does the one general `pod-navigate` discipline generalize to an **operation-shaped** app —
where the right move is not "browse an index" but "discover the declared affordance and run
it" — or does each app kind need its own thin skill? (spec §11)

## Setup

- **Task:** "Which person has ORCID `https://orcid.org/0000-0001-0000-0005`?" Six synthetic
  vCard contacts seeded into `/vault/contacts/Person/` (`owl:sameAs` an ORCID); the
  name↔ORCID mapping exists only in the Pod (no training-set guess). `contact-find-by-orcid`
  (`SELECT ?person WHERE { ?person owl:sameAs $orcid }`) is the declared access pattern;
  brute-force = GET all six and match. Answer = Claude Shannon.
- **Arms (7 runs):** `bare-curl` n=1 · `skill-curl` n=3 (pod-navigate, curl only) ·
  `skill-cli` n=3 (pod-navigate + the `solid-pod` CLI via a Tier-3 PATH shim).

## Results

| Arm | skill | right store | discovered affordance | used declared pattern | answer correct |
|---|---|---|---|---|---|
| bare-curl | — | ✓ | no | brute-force | ✓ |
| skill-curl ×3 | ✓ 3/3 | ✓ 3/3 | **0/3** | brute-force 3/3 | ✓ 3/3 |
| skill-cli ×3 | ✓ 3/3 | ✓ 3/3 | **2–3/3** (`affordances`→`contact-find-by-orcid`) | tried affordance 3/3, **all fell back to per-card** | ✓ 3/3 |

(All 7 answered correctly — read from the ANSWER sections; one skill-curl audit boolean was a
timing false-negative, corrected on re-read. The `brute-force 6/6` counter fires for the CLI
arm too because the per-card fallback reads every card.)

## What each arm did

- **bare-curl:** went to `/contacts/`, GET-looped all six cards, matched the ORCID. Correct, brute-force.
- **skill-curl (pod-navigate, curl):** invoked the skill, oriented (`.well-known/solid`), routed
  to `/contacts/` (one run also checked `/wiki/people/`), then **brute-forced the six cards** —
  never fetched the affordance catalog. Two runs *mentioned* the affordance/SPARQL option in
  reasoning but chose enumeration (6 cards is cheap). **Corpus-size confound:** at n=6, brute-force
  is the rational choice, so this arm does not isolate "can't reach the affordance" from "won't bother."
- **skill-cli (pod-navigate + CLI):** the informative arm. Agents oriented, routed to `/contacts/`,
  ran `solid-pod affordances` → **discovered `contact-find-by-orcid`** (2/3 read the descriptor),
  then tried to execute it — and **could not**, for three concrete reasons (below). All fell back
  to the per-card enumeration the affordance's own `sh:agentInstruction` names as the fallback, and
  got the right answer.

## The three execution gaps (reproduced deterministically, not agent misreads)

The disclosure *discipline* generalized — agents discovered the right store and the declared
affordance. But the operation-shaped affordance is **not executable** with the current substrate +
tooling:

1. **`invoke` cannot run a parameterized affordance.** `contact-find-by-orcid` declares a
   `$orcid` parameter ("the affordance engine substitutes it as an IRI"); `solid-pod invoke` only
   substitutes `%RESOURCE%` (it is resource-scoped, D52 Tier-2). `invoke <contacts/> contact-find-by-orcid`
   returns empty. The addressbook's query affordances are all `$param`-scoped (`$orcid`/`$org`/`$email`),
   so none are invoke-executable today.
2. **`sparql` container auto-discovery targets `.meta` sidecars, not RDFSource bodies.**
   Reproduced: `sparql <…/contacts/Person/> "…owl:sameAs <target>"` → `results: []`,
   `metaSources: 7` (it pointed Comunica at the seven `.meta` sidecars, empty for native-Turtle
   contacts). With explicit `--source <card-body>` the same query returns the person. The
   container-discovery was built for the wiki **dual-layer** model (data in `.meta`); the addressbook
   is **native RDFSource** (data IS the body), so discovery misses it.
3. **The affordance descriptor's declared sources are stale.** Its `sh:agentInstruction` says
   *"Sources: all /vault/contacts/Person/\*/index.ttl files"* — the abandoned per-Person-**container**
   layout. The deployed layout is flat (`Person/<name>.ttl`, forced by CSS's sub-container
   constraint during the AddressBook sprint). The descriptor never followed the layout change.

## Verdict

**The disclosure discipline generalizes; the execution tier does not (yet).**

- **Routing generalizes** ✓ — 7/7 reached the right store; skill agents oriented via the storage
  description; the two-person-store confusion did not dominate (1 run peeked at `/wiki/people/`).
- **Affordance discovery generalizes with the CLI** ✓ — skill-cli agents found `contact-find-by-orcid`
  via `affordances`; skill-curl agents did not (corpus-size + SPARQL affordances are hard to use via
  curl alone). So the **CLI tier is load-bearing for *discovering and attempting* operation-shaped
  access patterns** — the pre-registered "curl flails / CLI succeeds" lever, partially borne out
  (CLI reaches discovery; curl does not).
- **Affordance execution does NOT generalize** ✗ — 0/7 executed the affordance as a single query;
  the three gaps above block it. Agents recovered via per-card enumeration (the affordance's own
  fallback), correct at n=6 but non-scaling.

This is the value of running the probe **before** SP2 commits to index-shaped machinery: it shows
the index/disclosure layer is necessary but not sufficient for operation-shaped apps — those need a
working **execution tier**.

## Implications for SP2 / SP3

- **SP2 must build the operation-shaped execution tier**, not just index materialization:
  (a) a **parameterized `invoke`** (pass affordance parameters, e.g. `--param orcid=<iri>`, distinct
  from `%RESOURCE%`); (b) **RDFSource-aware `sparql` sources** (when a container holds native
  RDFSources, enumerate `ldp:contains` → use the member *bodies* as sources, not just `.meta`); and
  (c) repair the stale `contact-find-by-orcid` source declaration (flat `Person/*.ttl`). All three
  are in `solid-agent-skills` (CLI) + the addressbook overlay (descriptor) — FOLLOWUPS-tracked.
- **`st:Description` per-app declaration** earns its keep: the index component is wiki-specific; an
  operation-shaped app should declare "discover affordance → invoke with params," and the affordance
  should carry an accurate, executable source set — confirming the §3 disclosure-vs-operation split.
- **One general skill is still the right call (fork b)** — the *navigation* discipline (orient →
  route → discover the declared pattern) held across app kinds. What differs is the *execution* the
  declared pattern needs, which belongs in the tool/MCP tier (SP3), not in per-app skills.

## Cross-cutting / limitations

- **Corpus-size confound (curl arm):** n=6 makes brute-force rational, so skill-curl's
  no-affordance-discovery result is not clean evidence that curl *can't* reach the affordance — only
  that it *won't* when enumeration is cheap. The CLI-arm finding (discovery happens; execution is
  blocked) is corpus-independent and reproduced deterministically, so the verdict does not rest on the
  confound. An optional scale re-run (≥30 contacts) would sharpen the curl-arm discovery question.
- **Model/harness:** Sonnet, curl + `Skill` (+ Tier-3 `solid-pod` shim for the CLI arm), run from
  `~/dev/probes/generalization/` (out-of-repo). Artifacts in `runs/` (gitignored); seeded contacts
  disposable (cleared on next `make reset`). Rig at `evals/generalization/` (`e1d95b9`).
