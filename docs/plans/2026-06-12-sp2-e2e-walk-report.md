# SP2 Gate (T13) — End-to-End Contract Walk Report

**Date:** 2026-06-12 · **Branch:** `sp2-consumable-pod` (live Pod fresh `make reset` with all SP2 changes) · **Rig:** `evals/e2e-walk/` (run from `~/dev/probes/e2e-walk/`) · **Model:** sonnet, headless `claude -p`, cold workdir.

**Gate question:** can a cold agent carrying ONLY the SP1 `pod-navigate` skill walk the SP2-materialized disclosure contract end to end — orient (Layer-0) → route the wiki leg via the derived index → audit governance before judging currency → route the addressbook leg per its operation-shaped consumption hint (declared affordance, not enumeration) — and answer one task spanning both apps?

## 1. Design

ONE neutral two-question task (no disposition content in the prompt — the skill carries it):

1. *"What broader topic is the concept 'Photosynthesis' filed under — and is that filing current, or contested/superseded?"* Ground truth: `skos:broader → biology.md#this` in `photosynthesis.md.meta`; **no** open action anywhere (`/id/.operations/` and `/vault/wiki/.operations/` empty) — **"Biology, current"** is correct, and the audit disposition fires on a clean cell (the E5-trap mechanism with no trap planted).
2. *"Which person has ORCID `https://orcid.org/0000-0001-0000-0005`? Give their formatted name."* Ground truth: **Claude Shannon** — one of 6 synthetic vCard contacts planted by `setup/plant_e2e.sh`; the name↔ORCID mapping exists only in the Pod. The declared access pattern is the `contact-find-by-orcid` affordance (`SELECT ?person WHERE { ?person owl:sameAs $orcid }`), advertised operation-shaped by the addressbook's `st:Description`.

**Adaptation from the plan's nominal task:** the planned Q1 target ("How wiki memory works") carries no `skos:broader` on the live pod — only `skos:related` — so Q1 moved to Photosynthesis, the one deployed concept with a broader edge. Photosynthesis→Biology is training-guessable; the evidential weight therefore sits on (a) route shape (index vs enumeration, mined from tool calls), (b) the currency judgment (requires the governance check), and (c) Q2 (synthetic, non-guessable).

**Arms (4 runs):** `bare` n=1 — no skill, `curl` only (control; cheap confirmation the skill is causal). `skill` n=3 — `pod-navigate` installed in the workdir's `.claude/skills/` + the `solid-pod` CLI shim on PATH (Tier-3; `allowedTools "Bash(curl:*),Bash(solid-pod:*),Skill"`), mirroring the generalization rig's skill-cli arm. Both legs are read-only, so runs executed concurrently without state contamination.

**Gate criteria (from the SP2 plan):** skill arm 3/3 answer BOTH correctly, with the walk shape visible: wiki leg routed via index/Type-Index (not brute-force enumeration), addressbook leg executes the declared affordance (CLI `invoke` or the descriptor's SPARQL — NOT member enumeration), ≥1 disposition firing where applicable. Bare arm: record what it misses.

## 2. Pre-flight (every leg walked by hand before any run)

| Leg | Result |
|---|---|
| Orient | `GET /vault/` → `Link rel=storageDescription` → `/vault/.well-known/solid` carries the lean Layer-0 `sh:agentInstruction` (index routing, governed-graph authority, audit-before-trust, typed-identifier dispatch, write contract) + `sub:contactCatalog → /vault/contacts/`. PASS |
| Wiki index | `/vault/wiki/concepts/index.md` = derived definition-line index (typed `sub:ContainerIndex`, derivation provenance in its `.meta`); lists Photosynthesis. PASS |
| Concept `.meta` | `<#this> skos:broader <biology.md#this>`; no `mem:hasOpenAction`; ops ledgers empty. Clean cell. PASS |
| `st:Description` | `/vault/meta/interop/addressbook-application` carries the operation-shaped consumption hint ("do not enumerate members … invoke contact-find-by-orcid --param orcid=<iri>"). PASS |
| Interop surfacing | `interop:hasRegistrySet` lives on the **WebID card's `.meta`** (`card.meta`), not the card body — the governed-graph channel (card → `describedby` → `.meta` → registry → app), consistent with the Pod's own authority contract. Storage description carries no interop pointer (registries off Layer-0 by design). |
| Fixture plant | **The old generalization plant 422s on the SP2 pod** — `ContactCardShape` now requires `mem:rationale` (MinCount 1) with a teaching message ("record the task that triggered this write, what you concluded, and why…"). The SP2 write contract is live at the floor. Plant adapted to carry `mem:rationale` → 6/6 `201`. |
| CLI | `solid-agent-skills` dist stale → `npm run build`. `solid-pod affordances <contacts-url>` lists `contact-find-by-orcid`; `solid-pod invoke …/contacts/Person/ contact-find-by-orcid --param "orcid=<https://orcid.org/0000-0001-0000-0005>"` → `gen-claude-shannon.ttl#this`. PASS. Sharp edge: the un-bracketed IRI form fails (`Unknown prefix: https`); the descriptor's `agentInstruction` documents the angle-bracketed form. |

## 3. Per-run analysis

All four trajectories raw-audited (`audit.py` tool-call mining) AND full-CoT read (every assistant text block).

### bare-run1 (control, curl only) — both answers right, walk shape WRONG on every contract leg

18 tool calls. Q1 "Biology, current" / Q2 "Claude Shannon" — both correct. But:

- **Never oriented.** Zero fetches of `/.well-known/solid`; navigated by container-listing intuition from the root.
- **Addressbook leg = full member enumeration.** Fetched all 6 `gen-*.ttl` + `marie-curie.ttl`, then asserted in its ANSWER: *"There is no declared SPARQL endpoint, no declared query mechanism in the Pod's capability catalog"* — **false, and it never fetched the affordance catalog.** A confident negative claim about Pod capabilities without checking the Pod's declared capability surface: the precise miss the disclosure contract exists to prevent.
- **Currency check from training priors, not the Pod's contract.** It checked `owl:deprecated` / `skos:historyNote` / `skos:changeNote` — standard-vocab guesses — and never learned the Pod's actual governance channel (`mem:hasOpenAction` → operations ledger). On this clean cell the conclusion is right; on an E5-style trap cell this method misses (that is the measured H1 4:1 mechanism).
- **Index used as verification, not routing**: `concepts/index.md` fetched last (step 12), after both answers were already in hand.

### skill-run1 — PASS (18 tool calls)

`pod-navigate` invoked as tool-call #0, unprompted. CoT: *"I'll navigate the Pod systematically following orient → drill → ground → audit."*

- **Orient:** `solid-pod affordances` on the root (call #1 — spotted `contact-find-by-orcid` before touching either store) + read `/.well-known/solid`: *"governance signals live in resource `.meta` under `mem:hasOpenAction`; open `mem:RealignAction` with `schema:PotentialActionStatus` means contested, not yet applied."* The Pod-taught vocabulary registered before any data was read.
- **Wiki leg:** routed via the declared `wiki-search` affordance → fused `read` of photosynthesis.md → `skos:broader → biology`. Zero sibling enumeration (0/4 other concepts fetched).
- **Audit on a clean cell:** three independent checks before declaring "current" — `.meta` body (no `mem:hasOpenAction`), `.meta` Link headers, and `solid-pod invoke … memory-history` (*"Belt-and-suspenders; the `.meta` showed nothing but the operations log is the canonical source for RealignActions"*) → "CURRENT / AUTHORITATIVE — no contestation found", with the evidence enumerated.
- **Addressbook leg:** first container-scoped `sparql` over `/vault/contacts/` came back **silently empty** (source discovery does not recurse into the `Person/` sub-container); the agent read the affordance descriptor, followed its `sh:agentInstruction` (*"use Comunica link-traversal with the Person container as entry point"*), re-ran the descriptor's SPARQL scoped to `Person/` → `gen-claude-shannon.ttl#this` / `"Claude Shannon"`. One card fetched — as confirmation of the query result, not enumeration.
- ANSWER attributes the route explicitly: *"Via the Pod's declared `contact-find-by-orcid` affordance mechanism."*

### skill-run2 — PASS (18 tool calls + 1 background-output Read)

Skill invoked first. Orient: fused `read` of the root + storage description (CoT: *"The agent guide says to use SPARQL for cross-resource queries"* — the Layer-0 instruction registered and DROVE the strategy).

- **Wiki leg:** SPARQL over `wiki/concepts/` for the Photosynthesis concept + its `skos:broader` — zero sibling enumeration (0/4).
- **Audit:** *"Now I must audit the `.meta` for governance signals (per the skill's disposition)"* — checked `photosynthesis.md.meta`, `wiki/.operations/` (empty), AND `biology.md.meta` (the broader target's own governance — the only run to audit both ends of the edge) → "CURRENT and authoritative. Checked three governance layers."
- **Addressbook leg:** first vCard-guess SPARQL came back empty → read ONE card (`gen-ada-lovelace.ttl`) to learn the modeling (*"ORCIDs are stored as `owl:sameAs` URIs"*) → targeted SPARQL `?person owl:sameAs <…0005> ; vcard:fn ?fn` over `Person/` → Claude Shannon. The descriptor's exact query shape, rediscovered from the data and executed via the query tier — ANSWER: *"SPARQL query mechanism (not one-by-one reading)."* It never read the affordance catalog/descriptor (the one consumption miss), but the access pattern is the declared one, not enumeration (1/6 card read = schema discovery, not scan).

### skill-run3 — PASS with a qualified execution leg (27 tool calls)

Skill invoked first; same orient shape as run1 (`affordances` call #1 → storage description read; CoT registers the contract: *"Key governance rule: always check `.meta` for `mem:hasOpenAction` pointing to a `mem:RealignAction` before reporting a value"*).

- **Wiki leg:** routed via `wiki-search` → fused read → broader=Biology. 1/4 sibling fetched (biology.md — the broader TARGET, to confirm the parent, not enumeration).
- **Audit:** three channels checked before "current and authoritative" (.meta in full, Link headers, raw-Turtle grep for `mem:has*`) — disposition fired on the clean cell, with the checks enumerated in the ANSWER.
- **Addressbook leg: discovered + ATTEMPTED the declared affordance four ways, all blocked by tooling, then fell back to enumeration.** (1) `invoke` with a JSON heredoc → rejected by the harness sandbox ("expansion obfuscation" — a probe-environment artifact, not the CLI); (2) `invoke --args '{json}'` → `error: unknown option '--args'` (the real flag is `--param name=value`; see Substrate findings); (3) Person/-scoped `sparql` → **transient crash** `ERR_HTTP2_STREAM_ERROR (NGHTTP2_PROTOCOL_ERROR)` + `MaxListenersExceededWarning` — the IDENTICAL query shape succeeded in run1, and three concurrent eval agents were hammering the Pod over h2 at the time; (4) `read …/affordances/contact-find-by-orcid` (extensionless) → 404. After four failures it read all 7 cards (grep-filtered) — and its ANSWER attributes the route honestly: *"By reading records one by one. The `contact-find-by-orcid` declared affordance was available but could not be invoked…"*
- Both answers correct.

### skill-run4 — PASS (17 tool calls; documented sequential de-confound of run3's execution leg)

Added because run3's declared-pattern failure chain was dominated by a transient HTTP/2 crash under the rig's own 3-concurrent-agent load — a rig confound, not agent behavior (documented here, not silently re-rolled; run3 stands as-run). Run4 executed alone.

- Skill invoked first (CoT: *"I'll invoke the `pod-navigate` skill before doing anything else, since this task is exactly what that skill covers"*). Orient identical to run1: `affordances` (call #1, spots `contact-find-by-orcid` immediately) + storage description.
- **Wiki leg:** `wiki-search` → fused read → broader=Biology; audited BOTH `.meta`s (photosynthesis + biology) → *"Filing is CURRENT and authoritative … no pending proposals, no stale markers."* 1/4 sibling fetched (biology.md, the broader target).
- **Addressbook leg:** parameterless `invoke` returned the raw query with `$orcid` visible — the agent read it as a teaching response (*"The affordance expects `$orcid` as a parameter"*) — then ran the descriptor's SPARQL via `sparql` scoped to `Person/` → Claude Shannon, 1/6 card read to confirm `vcard:fn`. ANSWER: *"Located by: declared SPARQL query mechanism … Not found by reading records one by one."* (A positional-JSON `invoke` attempt also failed — `--param` still undiscovered; the query tier carried it.)
- Bonus grounding signal: PROVENANCE explicitly flags `mem:rationale` as *"a Pod-minted provenance term"* and reports what it asserts.

### Per-run table

| Run | Q1 (broader + currency) | Q2 | Wiki route | Addressbook route | Dispositions fired | Calls |
|---|---|---|---|---|---|---|
| bare-run1 | Biology, "current" — via training-prior predicates only | Claude Shannon | container listing → direct GETs; index.md post-hoc only | **enumeration 6/6** + false claim "no declared query mechanism" | none (confirm-mode; never oriented) | 18 |
| skill-run1 | Biology, CURRENT — 3-channel audit (.meta, Link headers, memory-history) | Claude Shannon | `wiki-search` affordance; 0/4 enum | descriptor read → **descriptor's SPARQL per its instruction**; 1/6 confirm | audit ✓; Layer-0 vocabulary grounded pre-data | 18 |
| skill-run2 | Biology, CURRENT — 3-channel audit incl. broader target's `.meta` | Claude Shannon | concept SPARQL; 0/4 enum | 1-card schema discovery → **equivalent owl:sameAs SPARQL** (descriptor unread) | audit ✓ | 18 |
| skill-run3 | Biology, CURRENT — 3-channel audit | Claude Shannon | `wiki-search`; 1/4 (broader target) | affordance discovered, 4 blocked attempts (sandbox/`--args`/h2 crash/404) → **enumeration fallback, honestly attributed** | audit ✓ | 27 |
| skill-run4 | Biology, CURRENT — both `.meta`s audited | Claude Shannon | `wiki-search`; 1/4 (broader target) | parameterless invoke taught `$orcid` → **descriptor's SPARQL**; 1/6 confirm | audit ✓; grounding flagged `mem:rationale` as Pod-minted | 17 |

## 4. Gate verdict

**GATE MET** (with one qualified leg and a one-line skill fix queued).

| Criterion | Result |
|---|---|
| Skill runs answer BOTH questions correctly | **4/4** (criterion asked 3/3) |
| Wiki leg routed, not brute-force enumerated | **4/4** — though via the declared query channels (`wiki-search`/SPARQL), not the materialized `index.md` (see finding 3: the criterion's letter named the index; its intent — no enumeration — was met by a stronger channel available at this tier) |
| Addressbook leg executes the declared affordance / descriptor's SPARQL, not member enumeration | **3/4** — runs 1, 2, 4. Run3's miss is tooling-confounded (transient h2 crash under rig-inflicted concurrent load + `--param` discoverability), is honestly attributed in its own answer, and the sequential de-confound (run4) executed cleanly. Among unconfounded runs the criterion is 3/3. |
| ≥1 disposition firing where applicable | **4/4** — audit-before-trust fired on the clean cell in every skill run (2-3 explicit governance channels checked before "current"); run4 additionally grounded `mem:rationale` as a Pod-minted term |
| Bare arm misses recorded | ✓ — both answers right but every contract leg wrong: no orient, 6/6 enumeration, a confident FALSE capability claim, training-prior-only currency check |

The skill is the causal variable for the contract walk: identical Pod, identical task — the bare agent gets the answers and misses the contract; the skill agents walk it. The one mechanical residue is `invoke --param` discoverability (skill tier table omits it; two agents guessed wrong syntax and recovered via the query tier) — queue the one-line skill edit in solid-agent-skills.

## 5. Substrate findings

1. **The SP2 write contract is live and teaching (pre-flight).** The prior generalization fixture 422s on the SP2 pod: `ContactCardShape` now requires `mem:rationale` (MinCount 1) and the violation message instructs exactly what to record ("the task that triggered this write, what you concluded, and why … a future agent audits this context before trusting it"). Fixture plants are now subject to the same floor as agents — rigs must carry rationale.
2. **The Layer-0 instruction is consumed and load-bearing at the skill tier.** All 3 skill runs read `/.well-known/solid` early and the CoT shows it driving strategy: run2 — *"The agent guide says to use SPARQL for cross-resource queries"*; run1/run3 quote the `mem:hasOpenAction`/`mem:RealignAction` governance semantics from it before touching data. The bare run never fetched it. (E5 bootstrap-leak history: this consumption is skill-induced, not spontaneous.)
3. **The derived `index.md` was bypassed by the query tier.** 0/3 skill runs routed via the SP2-materialized index — they used `wiki-search` (×2) or concept-SPARQL (×1), all non-enumerating. The index remains the curl-tier orientation channel (the idxview probe's 20-30× win was measured curl-only); when the CLI is present, agents prefer declared query affordances. The bare-curl control ALSO skipped it for routing (used it only as post-hoc verification) — index consumption appears confined to the cold curl agent who has no better channel. Gate-criterion wording ("routed via index/Type-Index") didn't anticipate a stronger channel satisfying its intent.
4. **The interop/`st:Description` layer was never consumed (0/4 runs).** The An-layer surfacing chain exists (WebID card `.meta` → `hasRegistrySet` → registry → app → `st:Description` consumption hint), but no agent traversed it; the **affordance catalog (D52) did the operation-shaped routing work** (run1: `solid-pod affordances` was tool-call #1 and spotted `contact-find-by-orcid` before either store was touched). SP2's declarations are correct but, at this tier, redundant with the catalog — the st:Description's `--param` example is exactly what run3 needed and never saw. Consider echoing the consumption hint into the affordance catalog/descriptors, or having `pod-navigate` name the registry chain explicitly.
5. **CLI sharp edges surfaced (sibling repo, fix on next touch):**
   - `invoke --param` is documented in `--help` and the st:Description but NOT in the skill's tier table (`invoke <resource-url> <name>`) nor the descriptor's instruction in CLI form — run3 guessed `--args '{json}'` and a JSON heredoc, both failed, and never tried `--help`. One-line skill fix.
   - Parameterless `invoke` of a `$param` affordance runs the query with `$orcid` unsubstituted (silent empty / parse error downstream) instead of erroring "missing required --param".
   - A bare (un-angle-bracketed) IRI param value fails as `Unknown prefix: https` — verbatim-SPARQL semantics are documented but the error doesn't hint at the fix.
   - Under concurrent load, multi-source `sparql` over 7 sources emitted `MaxListenersExceededWarning` in two runs and died fatally once with `ERR_HTTP2_STREAM_ERROR` (run3; identical query succeeded in run1 and run2 when load was lower).
   - Container-scoped `sparql` source discovery does not recurse into sub-containers: `/vault/contacts/`-scoped queries are silent-empty for data living in `Person/` (run1 recovered by reading the affordance descriptor, which names the Person container as entry point).
   - Extensionless GET of a catalog descriptor (`…/affordances/contact-find-by-orcid`) 404s; members are `.ttl`-suffixed.

## 6. Caveats

- **Q1's broader edge is training-guessable** (Photosynthesis→Biology). Mitigation: the gate reads route shape and the currency judgment from trajectories, not the answer string; every run's PROVENANCE section attributes the edge to the Pod resources it fetched; Q2 is synthetic and non-guessable.
- **Concurrency confound, self-inflicted:** the 3 skill runs executed concurrently against one Pod (read-only, so no state contamination — but the load produced the HTTP/2 crash that pushed run3 off the declared pattern). skill-run4 was added as a documented sequential de-confound, not a silent re-roll; run3 is reported as-run.
- **Clean-cell currency can't distinguish lucky-confirm from audit in the ANSWER alone** — "current" is also what a non-auditing agent says. The disposition evidence is in the trajectories: every skill run ran 2-3 explicit governance checks (`.meta`, Link headers, `.operations/`/`memory-history`, the broader target's `.meta`) BEFORE judging, and named the channels in its answer; the bare run checked only training-prior predicates (`owl:deprecated`, `skos:historyNote`).
- **n is small** (4 skill runs, 1 bare), per the established probe economics; the bare arm is a sanity control, not a powered comparison.
- Workdirs are cold (no repo CLAUDE.md) but the global `~/.claude/CLAUDE.md` loads as always (no Pod content; standard rig disclosure).
- The `gen-*` slugs and the fixture rationale text disclose plantedness; the bare run even cited the rationale. No effect on the measured behaviors.
- `pod-navigate` mentions index routing only implicitly ("Look for an index or overview resource"); the Pod's Layer-0 instruction names it explicitly. Neither was needed at the query tier (finding 3).
