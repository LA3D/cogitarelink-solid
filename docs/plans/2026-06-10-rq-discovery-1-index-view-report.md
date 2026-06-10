# RQ-Discovery-1 extension — index-view probe (cold-probe report)

**Date:** 2026-06-10. **Question:** does a pod-side **index view** (a definition-line listing
of a container's contents) actually help a cold agent locate one resource among many — enough
to justify building it (ViewAssembler + conneg)? **Mock-first**: measure the *artifact shape*
against a hand-written static index before committing any engine work. **Harness:**
`~/dev/probes/idxview/` (Sonnet, curl-only). **Gate:** the FOLLOWUPS 📐 item "measure pod-side
index views BEFORE designing/building them" + gates the profiles strip-back (D80 hub/breadcrumb
re-cut).

## TL;DR

**The definition-line index view earns its keep, decisively — build it.** A discoverable
definition-line index collapsed resource fetches **~20–30× (arm A mean ~18 → arm B mean ~0.7)**,
eliminated wrong-resource descents entirely (**arm A 9–29 → arm B 0**), was **read and used in
3/3** arm-B runs, and all 6 runs answered correctly. The mock proves the shape; the engine work
(ViewAssembler-derived index per container) is now justified by observed behavior, not assumption.

## Setup

A synthetic 30-concept corpus (agentic-memory/KR concepts) with **opaque slugs** `n01..n30`, so a
bare container listing reveals nothing about content. Two parallel containers differing ONLY by the
index:
- **Arm A — `/vault/probe-a/`:** 30 concepts, bare `ldp:contains` (today's baseline).
- **Arm B — `/vault/probe-b/`:** the same 30 concepts **+ a discoverable `index.md`** carrying one
  definition-line per concept (`- [nNN.md](nNN.md) — **Label**: one-line definition`). The index is
  a child resource, so it appears in the container listing — discovery via the normal listing, not
  handed in the prompt (per the 2026-06-10 design call).

**Task (identical both arms, container injected):** *"Exactly one concept note describes keeping a
durable, append-only record of operations written BEFORE they are applied, so state can be recovered
after a crash. Find it and report its URL."* The target (n09, **Write-Ahead Log**) is identifiable
only by its definition — the task never names "write-ahead log", and the slug is opaque, so the
agent must comprehend, not keyword-grep. The prompt notes "you are being observed for how many
requests you make" (so fetch count reflects deliberate navigation). Single content-laden index
format tested (definition-line — the predicted-strongest; prefLabel-only / type-grouped deferred).

## Results — raw-audited from the actual curl calls (D114 discipline)

| Run | curl calls | resource fetches | wrong-resource GETs | read index | correct |
|---|---|---|---|---|---|
| a-run1 | 7 | 15 | 14 | — | ✓ |
| a-run2 | 4 | 10 | 9 | — | ✓ |
| a-run3 | 9 | **30** (twice over) | 29 | — | ✓ |
| b-run1 | 3 | 1 | 0 | **yes** | ✓ |
| b-run2 | 2 | **0** | 0 | **yes** | ✓ |
| b-run3 | 3 | 1 | 0 | **yes** | ✓ |

("resource fetches" counts individual `nNN.md` GETs incl. those batched into shell loops within one
tool call — hence > curl-call count in arm A.)

## The mechanism (curl order)

- **Arm A (a-run3):** `HEAD probe-a/ → GET listing → GET .meta → for n in n01..n10 … n11..n20 …
  n21..n30 (all 30 bodies) → re-read all 30 again to confirm`. Opaque slugs force reading every
  note; the agent brute-forced the whole container (and double-checked). a-run2 stopped earlier (10)
  but still read 9 non-targets. **Arm A floor is "read until found," ceiling is the whole container.**
- **Arm B (b-run2):** `GET listing → GET index.md → DONE`. Read the definition-line index, matched
  the task to Write-Ahead Log, answered `n09` quoting the definition *from the index* — **zero
  concept-note GETs**, confident without even fetching n09. b-run1/b-run3 added a single confirm-GET
  of n09 (1 fetch). **The index turns locate-among-30 into one read + at most one confirm.**

## Findings

1. **The artifact shape works — definition-line index, discoverable as a child resource.** 3/3 arm-B
   agents discovered `index.md` in the listing, read it, and routed off the definitions. No agent
   ignored it to brute-force. The "measure before building" gate is satisfied: the shape is validated
   pre-engine.
2. **Magnitude is large and consistent.** ~20–30× fewer resource fetches, zero wrong descents,
   ~halved wall-clock (arm A ~60–100s/run vs arm B ~38–48s/run). The bare-`ldp:contains` baseline is
   genuinely costly the moment slugs are opaque (which real content-addressed / hashed slugs are).
3. **Definitions, not just labels, are what got read and quoted.** b-run2 answered *from the index's
   definition line* without opening the note. This is a datapoint for the format question: the
   one-line definition was sufficient to decide; the agent didn't need the note body. (Whether
   prefLabel-only would also suffice for a *comprehension* task like this one is the natural next
   variant — predicted weaker here, since the label "Write-Ahead Log" was never in the query.)

## Caveats / what this does NOT settle

- **n=3/arm, Sonnet, one task, one corpus, one index format (definition-line).** The format
  comparison (prefLabel-only vs definition-line vs type-grouped) is not yet run — this validates the
  richest format only. A prefLabel-only arm would test the lean end of the cost/benefit.
- **Discovery was lightly stressed.** The index was named `index.md` — a strong convention agents
  read on sight. A *derived* view served via conneg or a non-conventional name (the real ViewAssembler
  delivery) might not be discovered as reliably; H0/conneg findings suggest agents don't reach
  `?_profile=` selection. The discoverability mechanism for the real view is still an open call
  (sibling `index.md` vs `describedby`-style link vs conneg) — this probe only shows that *when read*,
  the definition-line shape routes well, and that a conventionally-named child IS read 3/3.
- **Single-container task — no pod-root → which-container routing.** The "wrong-container descents"
  metric from the original spec wasn't exercised (the task pointed at one container). The multi-level
  case (a root-level index routing across containers, and the derived `/llms.txt` arm C) is a separate
  measurement, deferred.
- **The mock index is static + hand-written.** Production needs it *derived and maintained*
  (ViewAssembler over `ldp:contains` + each child's `skos:definition`/`prefLabel`). This probe
  validates the shape, not the derivation pipeline.
- Corpus is disposable (`/vault/probe-{a,b}/`, cleared on next `make reset`).

## Trajectory observations (full-reasoning audit — interesting agentic behavior)

Reading the reasoning, not just the fetch counts, surfaced three things that shape the build:

1. **Demand-pull: an agent without an index reaches for one.** a-run3 (arm A) reasoned, *before*
   brute-forcing: *"The container has 30 notes… all small markdown files. **Let me check the `.meta`
   resource first to see if there's an index**, then fetch notes in parallel batches."* It checked
   `/probe-a/.meta` hoping for an overview, found none, and fell back to reading all 30. This is the
   strongest validation in the run: the index view fills a need agents *actively feel and look for*,
   not just one we hypothesized. (It also tells us *where* an agent reaches — the container's `.meta` /
   description resource is a natural place to advertise or carry the index pointer.)
2. **Discovery is SIZE-driven, not just name-driven.** b-run1 found the index via byte size, not the
   filename: *"There's an `index.md` with **4081 bytes — much larger than the individual notes. That's
   likely a table of contents.**"* Agents read `posix:size` in the container listing and infer
   "overview" from a resource that is conspicuously larger than its siblings. **Implication for format
   A/B:** a lean prefLabel-only index may not trip this size heuristic as strongly as a definition-line
   index — the richer format is *doubly* favored (more routing signal AND more discoverable). And for
   delivery: a derived index that is visibly larger than its siblings gets read even without a perfect
   name.
3. **Verification of the index varied (mild, non-biting over-trust).** b-run1/b-run3 confirmed the
   index's claim with a single GET of n09; **b-run2 trusted the index outright** (0 confirm GETs,
   answered from the definition line). The index was accurate so it didn't bite — but it is the same
   over-trust shape as RQ-Salience-1: a derived view is taken as authoritative without checking the
   source. Worth noting that a *stale* derived index would be believed by ~1/3 of agents. (Argues for
   the index being genuinely derived/fresh, and for carrying its own provenance/derivation marker.)
4. **Arm-A cost is target-position-dependent; "exactly one" inflates it.** a-run2 batched n01–n10,
   hit n09 in the first batch, and stopped (lucky — 10 fetches); a-run3 read all 30 (twice) because
   the task's "exactly one" wording drove it to verify uniqueness. The bare baseline's cost ranges from
   target-position to full-container-plus-reverify; the index makes uniqueness checkable in one read.

## Implication / next

**Build the per-container definition-line index view** (ViewAssembler-derived, media-type conneg per
the PD audit §4) — the shape is validated. Open design calls to fold into that build: (a) the
**delivery/discovery** mechanism (conventional `index.md` child vs `describedby`/Link vs conneg —
this probe favors a discoverable named resource over conneg, consistent with H0); (b) a cheap
**format A/B** (prefLabel-only vs definition-line) to find the leanest hook that still routes; (c) the
**root-level / cross-container** and **`/llms.txt`** arms (the deferred arm C + wrong-container metric).
This result also informs the **D80 re-cut** in the profiles strip-back: hub-view/breadcrumb-view should
become ViewAssembler-served index views (read off the listing) rather than handed CONSTRUCT affordances
(which agents never invoke).
