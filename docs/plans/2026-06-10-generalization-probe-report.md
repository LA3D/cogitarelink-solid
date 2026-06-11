# Generalization probe — does the disclosure discipline reach operation-shaped apps?

**Date:** 2026-06-10 · **Rig:** `evals/generalization/` (run from `~/dev/probes/generalization/`) ·
**Model:** Sonnet · **App:** addressbook (`/vault/contacts/`, query-shaped) ·
**Spec:** `2026-06-10-agentic-progressive-disclosure-contract-design.md` §3/§11/§12 ·
**Lineage:** sibling of the SP1 skill-nav eval; gates SP2.

---

> ## ⚠ UPDATE 2026-06-11 — tooling fixed, probe RE-RUN: execution DOES generalize
>
> The first run (below) concluded "execution does not generalize (0/7)" — but that was **confounded
> by a tool bug + a missing feature + stale data**, not agent behavior (the skill-cli agents diagnosed
> the gaps themselves in-flight). All three were fixed and the probe re-run on 2026-06-11. **Corrected
> headline: the discipline, the dispositions, AND execution all generalize once the tooling works.**
>
> **Fixes** (solid-agent-skills `sp1-exec-fixes`; cogitarelink-solid overlay):
> - **Gap 2 — BUG, FIXED** (`35bf6f6`): `sparql` container discovery was RDFSource-blind (appended
>   `.meta` to every member → silent-empty over native-RDF containers). Now content-type-driven
>   (`discoverQuerySources`: RDF body vs `.meta`).
> - **Gap 1 — missing FEATURE, ADDED** (`19f5a75` + `0dc4ecd`): `invoke --param name=value` runs
>   `$param`-scoped affordances (+ default-source split: parameter affordances query the container).
> - **Gap 3 — stale DATA, FIXED** (`2ed7b3b`): 6 addressbook descriptors re-pointed from the abandoned
>   `Person/*/index.ttl` to the deployed flat `Person/*.ttl`.
>
> **Post-fix re-run (skill arms × 3 each, fresh Pod, re-planted):**
>
> | Arm | used declared query | brute-force | correct | audit fired |
> |---|---|---|---|---|
> | skill-cli ×3 | **3/3** (`sparql`/`invoke` now execute) | **1/6** (was 6/6) | 3/3 | 3/3 |
> | skill-curl ×3 | 0/3 (curl can't run Comunica SPARQL — a genuine tier boundary, not a bug) | 6/6 | 3/3 | 3/3 |
>
> **Corrected verdict:** with the CLI tier working, skill-cli agents **execute the declared affordance
> in ~1 query** and stop enumerating (brute-force 6/6 → ~1/6, just reading the matched card to confirm).
> Trajectories: discover affordance → read descriptor (now accurate) → `invoke --param` / `sparql`
> → match → audit `.meta`. The curl arm still enumerates because executing a SPARQL affordance requires
> Comunica (a CLI/MCP capability) — confirming the **consumption-channel ordering**: the CLI/MCP tier is
> load-bearing for *executing* operation-shaped access patterns, not merely discovering them. Routing +
> dispositions generalize in both arms (unchanged). The original sections below are retained as the
> bug-discovery record; the three "gaps" are now FIXED (see §"three execution gaps").

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
| skill-cli ×3 | ✓ 3/3 | ✓ 3/3 | **3/3 discovered, 3/3 diagnosed the gaps in-flight** | graceful fallback per the affordance's own instruction | ✓ 3/3 |

(All 7 answered correctly. **The findings below come from reading the full in-flight reasoning —
the assistant `text` blocks per step — not the audit booleans or the ANSWER sections, both of which
mislead here** (one skill-curl "wrong answer" was a flush-timing false-negative; the skill-curl
"affordance mentions" were in the *final report* answering the prompt's question, not in-flight
engagement; the `brute-force 6/6` counter fires for the CLI arm because its per-card *fallback*
reads every card). Reading the trajectories corrected two earlier mis-captures and surfaced the
disposition-generalization finding — see Behavioral observations.)

## What each arm did

- **bare-curl:** went to `/contacts/`, GET-looped all six cards, matched the ORCID. No orientation
  depth, no audit step. Correct, plain brute-force.
- **skill-curl (pod-navigate, curl):** invoked the skill, oriented (read the storage description —
  run2 explicitly *saw both* the `contactCatalog` and the `/wiki/people/` store and chose contacts
  deliberately), then enumerated the six cards. **In-flight, no curl run ever engaged the affordance
  catalog** — via raw curl the declared affordance is effectively invisible to a "find-by-ORCID"
  workflow; the agent goes straight to listing `Person/` and reading cards. (Not "considered and
  rejected" — never surfaced.) **Corpus-size confound also applies:** at n=6 enumeration is cheap, so
  this arm cannot isolate "can't reach the affordance" from "the affordance is off the curl path."
- **skill-cli (pod-navigate + CLI):** the informative arm, and the agents were *competent* — this was
  deliberate discover→diagnose→graceful-fallback, not blind brute-force. All three oriented, routed
  to `/contacts/`, ran `solid-pod affordances` → **discovered `contact-find-by-orcid`**, tried to
  execute it, and **diagnosed both execution gaps in their own words in-flight** (quotes in Behavioral
  observations), then fell back to the per-card enumeration the affordance's own `sh:agentInstruction`
  names as the fallback. The agents' reasoning is what *exposed* the gaps I then reproduced.

## Behavioral observations (from reading the in-flight reasoning)

The trajectory-level reasoning told a richer and partly different story than the metrics:

- **★ The audit disposition (Disposition 1) generalized to a no-trap operation task — all 6 skill
  runs, curl AND CLI.** After finding the ORCID match, every skill run paused to check the card's
  `.meta` for governance signals *before* reporting, e.g. skill-cli-run1: *"Per the pod-navigate
  skill's audit discipline (Disposition 1), I must check the card's `.meta` for governance signals
  before reporting as authoritative"* → read it → found only standard LDP metadata → reported.
  **bare-curl did not** — it answered straight from the card. The disposition transferred well
  beyond the wiki/over-trust context it was tuned on, to a contacts lookup with no contestation
  present. This is stronger evidence that the dispositions generalize than the routing metric, and
  no audit boolean surfaced it.
- **The skill-cli agents diagnosed both execution gaps themselves, in-flight** (independently, all
  three runs): on gap 1 — *"The affordance needs the ORCID parameter, and the sources list seems
  odd"*; on gap 2 — *"SPARQL is hitting `.meta` files, not the actual Turtle bodies"* /
  *"SPARQL is only scanning metadata files, not resource bodies."* They then fell back per the
  affordance's own guidance. The limit was the tooling, not the agent's competence — the agents'
  own words are what located the gaps reproduced below.
- **Via raw curl, the affordance is off the path.** No skill-curl run looked at `/meta/affordances/`
  while working; a "find-by-ORCID" task routed straight to `Person/`-enumeration. The CLI's
  `affordances` command is the **discovery surface** that makes the operation-shaped access pattern
  visible — so the CLI's load-bearing role is discovery, not only execution.
- **Orientation disambiguated the two-person-store correctly, for the right reason.** skill-curl-run2
  read the storage description, *saw both* `contactCatalog` (`/contacts/`) and the people wiki
  (`/wiki/people/`), and chose contacts deliberately — the routing isn't luck, it's the disclosure
  orientation working.

## The three execution gaps (reproduced deterministically, not agent misreads) — ALL FIXED 2026-06-11

> **All three are now FIXED** (see the UPDATE banner at the top). Triage: Gap 2 = a genuine code bug
> (`35bf6f6`); Gap 1 = a missing feature, now built (`19f5a75`); Gap 3 = stale data, now corrected
> (`2ed7b3b`). The post-fix re-run confirms the affordance executes end-to-end. Original analysis:

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

**The discipline AND the dispositions generalize. Execution did not — until the tooling was fixed
(2026-06-11); post-fix it does. See the UPDATE banner.** (The bullets below describe the FIRST run,
pre-fix; the execution bullet is superseded by the re-run.)

- **The dispositions generalize** ✓✓ — the strongest result, visible only in the reasoning: all 6
  skill runs applied the audit disposition (check `.meta` governance before trusting) on a no-trap
  operation task; bare-curl did not. The skill's behaviour transfers beyond the wiki/over-trust
  context it was tuned on.
- **Routing generalizes** ✓ — 7/7 reached the right store; skill agents oriented via the storage
  description and disambiguated the two-person-store deliberately (run2 saw both, chose contacts).
- **Affordance discovery is CLI-gated** ✓ — skill-cli agents found `contact-find-by-orcid` via the
  `affordances` command and *correctly diagnosed* why it wouldn't execute; skill-curl agents never
  surfaced the affordance at all (it is off the raw-curl path, compounded by the n=6 corpus
  confound). So the CLI's load-bearing role is the **discovery surface** (`affordances`), not merely
  execution — a refinement of the pre-registered "curl flails / CLI succeeds" lever.
- **Affordance execution — pre-fix did NOT generalize (0/7); POST-FIX it DOES (skill-cli 3/3).**
  The three gaps blocked it on the first run (agent-confirmed in-flight); the agents were competent,
  the tooling was the limit. After fixing the bug + feature + data and re-running, skill-cli agents
  execute the declared query in ~1 shot (brute-force 6/6 → 1/6). The residual curl limitation is a
  genuine tier boundary (Comunica = CLI/MCP capability), not a defect. **See the UPDATE banner.**

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
- **One general skill is still the right call (fork b), reinforced by the trajectories** — not only
  did the *navigation* discipline (orient → route → discover the declared pattern) hold across app
  kinds, the *dispositions* transferred too (the audit step fired on a no-trap contacts lookup in all
  6 skill runs). The skill's content generalizes; what differs is the *execution* the declared
  pattern needs, which belongs in the tool/MCP tier (SP3), not in per-app skills.

## Cross-cutting / limitations

- **Corpus-size confound (curl arm):** n=6 makes brute-force rational, so skill-curl's
  no-affordance-discovery result is not clean evidence that curl *can't* reach the affordance — only
  that it *won't* when enumeration is cheap. The CLI-arm finding (discovery happens; execution is
  blocked) is corpus-independent and reproduced deterministically, so the verdict does not rest on the
  confound. An optional scale re-run (≥30 contacts) would sharpen the curl-arm discovery question.
- **Model/harness:** Sonnet, curl + `Skill` (+ Tier-3 `solid-pod` shim for the CLI arm), run from
  `~/dev/probes/generalization/` (out-of-repo). Artifacts in `runs/` (gitignored); seeded contacts
  disposable (cleared on next `make reset`). Rig at `evals/generalization/` (`e1d95b9`).
