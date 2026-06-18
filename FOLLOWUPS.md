# Follow-ups

Things to come back to. Open items only; closed items move to commit history and decisions-index.

## ▶▶ RESUME — shape-governance reconciliation (branch `shape-governance-reconciliation`, 2026-06-18)

Spec `docs/superpowers/specs/2026-06-17-shape-governance-reconciliation-design.md`; plan
`docs/superpowers/plans/2026-06-17-shape-governance-reconciliation.md` (12 tasks). **The wiki lane is
BUILT + LIVE-VALIDATED** (e2e `tests/test_write_contract_e2e.py` green; `make reset` 0 ERROR): ShapeTrees =
source of truth → `scripts/overlay/derive_constraints.py` derives `constrainedBy` → injects
`sub:WriteContractShape` (`shapes/substrate/write-contract.shacl.ttl`, `foaf:Document` → `mem:rationale`) →
projection emits `<> a foaf:Document` → `rationale:` frontmatter lands on `<>` = where the contract targets
(the markdown-lane subject bug is gone by construction). **Tasks DONE: 1–6, 8, 10** (12 commits, unpushed).
The `mem:` vocab moved wholesale to substrate `ontology/mem.ttl`. Path B chosen for governed-predicates
(agreement test, not codegen — agentic reasons; see the 🧱 entry below).

**▶ REMAINING (in priority order for the next session):**
1. **Task 12 — fixture sweep (~57 red, the bulk).** The changes ripple through integration/unit test
   expectations; the failures are **fixture-expectation updates, NOT regressions** (the feature is
   live-validated). Three categories: (a) tests hard-coding the old `overlays/wiki-memory/ontology/mem.ttl`
   path → now `ontology/mem.ttl`; (b) `test_floor_parity.py` resolves constrainedBy shapes only under
   `overlays/wiki-memory/shapes/` → `write-contract.shacl.ttl` is in `shapes/substrate/`; (c) integration
   tests (`test_two_subject_projection_e2e`, `test_admission_floor_integration`, `test_wiki_memory_l3_listener_integration`,
   `test_projection_subtraction`, view/index/mem-operations e2e, …) asserting exact projected `.meta` → now
   carry an extra `<> a foaf:Document` triple + the injected `constrainedBy`. **Caution: triage each as
   update-expectation vs real-regression — don't wave through.** The 9 `test_wiki_search_e2e` ERRORs may be a
   separate setup/index issue — check independently.
2. **Task 11 — agentic probe** of the multiple-`st:shape` wiki path (spec's one unverified mechanism): a cold
   agent crystallizes a wiki concept and the write validates against the unioned Page+Thing+leaf+contract set
   first try. Rig in `evals/` (model on `evals/proj-enrich/`); report to `docs/plans/`.
3. **Tasks 7/9 — RDF-native lanes** — see the 🔵 entry below.

## 🧱 Runtime-derived governed-predicate partition (the real target — shape-governance reconciliation, 2026-06-18)

`governedPredicates.ts` is a hand-maintained static map. Task 5 of the reconciliation chose **Path B**
(keep the hand file + an agreement test that every durable shape's required `sh:path` is governed on the
right subject — `tests/test_governed_predicates_agreement.py`) over codegen, on the **agentic** argument:
codegen would split the agent-facing teaching (the shapes' `sh:agentInstruction`, which agents read) from
the agent-invisible behavior file, risking taught≠enforced — and governance is *silent* (no 422), so agents
can't self-correct, and a curator agent can't make a shape change take effect without a human re-running a
generator. **Real fix:** derive the governed set at RUNTIME from the deployed shapes the floor already loads
— single source (taught == enforced by construction), no static file, no second generator, immediately
curator-evolvable. Cost: shape-parsing on the projection path (the static map exists for speed). Do this
when the projection path is next touched; until then the agreement test is the guardrail.

## 🔵 RDF-native lanes: ShapeTree↔container-layout reconciliation (shape-governance reconciliation, 2026-06-18)

The ShapeTree→`constrainedBy` derivation + the write contract shipped for the **wiki lane** (validated live).
The RDF-native lanes (addressbook, id-schemes) are deferred: their ShapeTrees diverge from the deployed
container layout — addressbook constrains `/vault/contacts/{Person,Organization}/` *subcontainers* while its
tree manages `/vault/contacts/`; id-schemes lives outside `/vault` (`/id/schemes/`, `/id/scheme-record.shacl.ttl`).
`scripts/overlay/derive_constraints.py` already derives their shape sets correctly (`DURABLE_CONTAINERS`),
but writing their `.meta` + de-duplicating their per-app `mem:rationale` (Tasks 7/9) needs a decision on how
to reconcile each tree with its real layout (reshape the tree to manage subcontainers? normalize id-schemes
onto `/vault/meta/shapes/`?). The apps function today on their existing (duplicated) contract.

## ▶▶ ACTIVE — agentic progressive-disclosure contract (SP1 + SP2 SHIPPED; 2026-06-12)

**Spec (spine, settled):** `docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md`.
**STATUS 2026-06-12: SP2 EXECUTED — all 14 tasks, GATE MET** (4/4 both-correct, audit disposition 4/4,
declared-pattern 3/4 w/ a documented harness-load de-confound — run3's miss was a rig-inflicted HTTP/2
crash + `--param` discoverability, run4 sequential re-run clean; gate report
`docs/plans/2026-06-12-sp2-e2e-walk-report.md`). Plan: `docs/superpowers/plans/2026-06-12-sp2-consumable-pod.md`
(branch `sp2-consumable-pod`). **Probe results (T12):** **E7 re-run** — the registration bucket is FIXED
3/3 (D96 `<#this>` placement closed the never-registered miss) but catch dropped to 0/3 — the failure
MOVED downstream to grounded-then-dismissed (agents read the vocabulary definition and stop before the
instance dereference); **NEW LEVER = decision-laden `mem:` rdfs:comments** (E5b applied to the vocabulary:
put the "dereference the open action before trusting" rule in the comment grounding agents already read;
report `docs/plans/2026-06-12-sp2-e7-rerun-report.md`). **In-situ index probe** — 0/6 runs consulted
`index.md` at n=5 descriptive slugs → **the index's payoff regime is BOUNDED** (opaque-slug/many-member
containers; index = the curl-tier orientation channel, the query tier bypasses it for declared
affordances/SPARQL); format A/B moot in situ, re-cut on the mock corpus
(report `docs/plans/2026-06-12-sp2-index-insitu-report.md`). **▶ NEXT = the `🧷 NAMED FOLLOW-ONS` list
below**; suggested order: (1) the decision-laden `mem:` vocabulary pass (the E7 lever), (2) the sibling
CLI pass — pod-navigate tier-table `--param` line + the 6 sharp edges from the gate report §5 —, then
(3) the push decision (both repos ahead/unpushed — Chuck's call). The checklist below is the SP1
history (all `[x]`); other live items are in `🧭 Generalization`, `📐`, `🧪`, `⚙` sections.

- [x] **SP2-T5 residue (surfaced during T8 verification 2026-06-12): `IndexViewListener` drops member
  events that arrive while a regeneration is in flight** — the `deriving` guard is GLOBAL
  (`if (this.deriving) return;`), so a member write landing inside another container's index write
  window is silently swallowed and that index stays stale until the NEXT member event. Manifests as
  the order/timing flake in `tests/test_index_views.py::test_delete_refreshes_index` (fails ~2/3
  under back-to-back write/delete sequences, passes in isolation). Fix shape: replace the global
  flag with self-write filtering in `memberContainer` (index.md/index.md.meta already excluded —
  the flag may be redundant) or queue-don't-drop. `css/extensions/view-layer/src/IndexViewListener.ts:102`.
  **FIXED 2026-06-12 (SP2-T5b):** flag WAS redundant — deleted; member events always enqueue on the per-container chain (unit T11 reproduces the drop; integration file 5×3/3 post-fix).
- [x] **Chuck reviewed the foundation spec 2026-06-10 (same day) — spine confirmed; spec AMENDED
  post-review.** Sanity check verified the factual claims (live-but-inert interop layer; E7/index-view
  report fidelity; storage description + WebID card confirmed unsurfaced by live GET). Amendments
  (spec header lists them): **D82 named a hard dependency** of the write contract (§6 — agent `.meta`
  enrichment doesn't survive projection rewrites); `prov:agent` derivation auth-gated (security
  profile); derived views self-describing w/ derivation provenance (§7); disclosure-vs-operation split
  + per-component consumption profiles (§3); **§6.1 three-station quality partition** (floor =
  machine-decidable + teaching 422s / **write disposition = the only quality capture point** — agent-only
  context is unrecoverable post-write / curation loop = trust-annotation + GEPA eval-signal +
  derivable-repair ONLY; curator is a role, NOT a quality gate, not necessarily a subagent); **§12
  hypothesis→behavioral-measurement map** (Chuck: agentically measure the agentic behavior — each
  mechanism lands WITH its cold probe, not just green tests).
- [x] **Build approaches SETTLED 2026-06-10 (same-day planning session, Chuck confirmed all four):**
  (a) on-write listener-refreshed static `index.md` child + derivation provenance in its `.meta`;
  (b) ONE general navigation skill (`pod-navigate`) consuming `st:Description` (per-app thin skills only
  if the generalization probe demands); (c) hand-written v0 seeded from proven E5/E7/E5b content,
  GEPA/eval-loop later; (d) definition-line default, prefLabel-only as probe arm. SP1 plan WRITTEN:
  `docs/superpowers/plans/2026-06-10-sp1-pod-navigate-skill-harness.md` (9 tasks, eval-gated; scope =
  SP1 only — SP2 plan follows the generalization probe + SP1 results).
- [x] **SP1 EXECUTED 2026-06-10 (subagent-driven-development) — GATE PASSED, all 9 tasks done.**
  Branch `sp1-pod-navigate` (solid-agent-skills): `validate` (SHACL pre-flight — landed the
  **shacl-engine 1.1.0 spike**, decision B; rdf-validate-shacl dropped, experimental 1.2 deferred) +
  `invoke` resource-scoped fix (3 E8 defects closed) + `affordances` lister + `pod-navigate` skill
  (3 baked-in dispositions, D103 deviation). Eval rig `evals/skill-nav/` + report
  `docs/plans/2026-06-10-sp1-skill-nav-eval-report.md` → cogitarelink-solid main. **Gate MET: skill
  arm 3/3 catch, trigger 3/3** (pod-navigate fired tool-call #1 unprompted; followed `hasOpenAction`
  to the ledger + grounded `mem:` vocab + read applied-vs-proposed correctly). Bare arm clean miss =
  skill is the causal variable. Closes the E5 bootstrap consumption leak (0/3 pod-delivered → 3/3
  skill-delivered). **▶ NEXT: the two queued probes before SP2 — generalization probe (operation-shaped
  apps: addressbook/id-schemes) + write-side E5b twin (Disposition 3 carried but not exercised by the
  read-path trap) — then the SP2 plan.**
- **SP1 build residue (small, non-urgent):** (a) `solid-agent-skills/src/lib/http.ts` uses dynamic
  `import('n3')` in `discoverMetaSources`/`listContainerResources` — inconsistent with the module-wide
  static `import N3 from 'n3'`; hoist when http.ts is next touched. (b) `invoke`'s default source set is
  wiki-memory-`.operations/`-scoped (documented in-code) — extending `invoke` to addressbook/id-schemes
  affordances requires `--source` until a per-app default is derived from `st:Description`. (c) `affordances`
  test covers happy-path only (no `--pod`/error-path case); add when the command is next touched. (d) the
  pinned legacy-suite baseline (`tests/KNOWN-FAILURES.md`) dropped from 7→5 deterministic (invoke ×2 closed
  by Task 2); the residual 5 (search/shapes×2/e2e Step2/Step5) stay parked under the skill-suite rebuild agenda.
- [ ] **Cheap empirical feed-ins** (can fold into the approaches as they need settling, not run speculatively):
  the **D96 subject-placement fix** (derive `mem:hasOpenAction` onto `<#this>`; re-run E7 `evals/salience-e7`
  to confirm it closes the g-run3 miss — tight loop); **format A/B** (`evals/idxview`, add a prefLabel-only arm);
  ~~write-side E5b twin~~ **RUN 2026-06-11** (see the ACTIVE banner; optional de-confounding follow-up arm:
  same rig, task domain far from the provenance vocabulary — e.g. addressbook lookup-then-note — tests whether
  arm A's high floor survives without the grounding/topic confounds); ~~generalization probe~~ **RUN
  2026-06-10/11** (see the 🧭 section below).
- [ ] **SP2 execution checklist** lives in the 📐 section below (profiles/roles strip-back, D80 re-cut,
  index-view build, interop surfacing) + the ⚙ interop-foundation gaps — all FOLD-IN items of the spec §9.
- **Build order (locked):** SP1 skill+tool harness FIRST (optimization substrate; skill-creator/GEPA against
  the cold-agent eval) → SP2 surface+materialize the declared interop+ShapeTree layer → SP3 MCP gateway LATER
  (a packaging on top — MCPs clog context + are hard to optimize, Chuck 2026-06-10).
- **SP1 baseline PINNED 2026-06-10** (`solid-agent-skills/tests/KNOWN-FAILURES.md`, committed on branch
  `sp1-pod-navigate`). The `solid-agent-skills` legacy suite has **7 deterministic + 4 flaky** pre-existing
  failures (post-D107 command/e2e drift), confirmed across 3 fresh-Pod runs. **SP1 gate = "new tests green +
  no failure outside the pinned lists,"** NOT "whole suite green" (never true). 2 of the 7 (`invoke`) close on
  Task 2; the 5 residual (`search`, `shapes`×2, e2e Step2/Step5) are parked under that repo's skill-suite
  mid-rebuild agenda (`docs/research/2026-06-03-pod-skill-acquisition.md`) — fixed when the rebuild reaches each
  command or retired, NOT speculatively. The `shapes` failures' root cause is substrate-side (template-placeholder
  catalog file — see the D108-review item below).

## 🧷 NAMED FOLLOW-ONS (post-SP2, 2026-06-12)

One line each; details in the gate/probe reports (`docs/plans/2026-06-12-sp2-*.md`) + the SP2 plan.

- [x] **Provenance-scoped projection replacement — EXECUTED 2026-06-13 (D116; branch `prov-scoped-projection`,
  PSP-T1–T8):** subtraction-based re-projection (`.meta − f(old body) ∪ f(new body)`); floor keeps
  enforcement, strip + F7 special case deleted. **D82 DISSOLVED** (sidecar unbuilt, xfail flipped to a
  normal passing test). Result: floor path exact (pre-commit snapshot) / listener Memento-backstop +
  degraded pair-shadow with curation signal / version stamp (`sub:projectorVersion`) + migration sweep.
  Knob §7 settled = version-stamp+sweep. Probe PASS 2/2 (`evals/proj-enrich/`, Haiku, $0.26). Spec +
  plan + probe report cited in D116. Ungates (a) below.
  **Post-merge review-followups DONE (`psp-review-followups`, 2026-06-13):** migration-sweep
  outcome classification (rebaselined/skipped/rejected/error; exits nonzero only on transport error,
  surfaces shape-rejections for human review); listener `bodyHash` constant de-duplicated (imports
  `STAMP_PRED`); live floor old-version re-baseline test added. **Residue (low-severity, deferred):**
  (psp-1) the floor does NOT protect its own `sub:projectorVersion`/`sub:bodyHash` stamps against an
  agent N3 PATCH to `.meta` — an agent can mangle the version stamp, forcing degraded re-baseline on
  the next write (safe fallback: degraded + curation signal, no data loss; but stamps are meant to be
  substrate-internal — fold the stamp predicates into the floor's governed/protected set when the
  write-contract work touches `.meta` PATCH validation). (psp-2) curation-signal push/drain gate
  asymmetry: floor pushes on content-type `text/markdown`, listener drains on `.md` extension — a
  `text/markdown` write to a non-`.md` URL delays (never loses) the signal until the next `.md` write
  or restart; near-unreachable (the Pod binds the two). (psp-3) `gitRead` `maxBuffer` 64 MiB → a body
  over 64 MiB rejects (caught → degraded), never wrong-subtracts; unreachable for wiki bodies. (psp-4)
  the markdown-projection `dist-cjs/*.jsonld` is hand-edited + committed (the Dockerfile skips
  componentsjs-generator for this extension) — overwritten if the generator is ever run; same K1 drift
  class as the existing stampPredicate precedent. Deployment re-verified end-to-end on a fresh image
  (gitDir wired, floor exact subtraction live).

- [x] **(k) stale `sub:viewAuthority` vocab prose — CLOSED (PSP-T4):** `rdfs:comment` re-cut off the
  retired storage-description pointer.
- [ ] **(j) `test_index_views::test_concept_write_refreshes_index_with_provenance` is load-timing-sensitive**:
  fails occasionally under full-suite back-to-back write load, deterministic-green in isolation (4×) —
  same class as the timemap flake; widen the settle poll or serialize the file if it recurs.

- [ ] **(a) Markdown-lane write contract — GATE LIFTED, NOW SCHEDULABLE** (was gated on D82; D82 dissolved
  by D116 2026-06-13): agent `.meta` enrichment now survives projection rewrites by construction
  (provenance-scoped subtraction), so `mem:rationale` CAN be required on wiki lanes at crystallization
  (D73 preserved). Turtle lanes already shipped (T10/T10b). **Not built — this is the natural next build.**
- [ ] **(b) `prov:agent` derivation — GATED ON the security profile** (Chuck 2026-06-12): deriving the
  authenticated WebID at write time is meaningless under dev-allow-all; lands with auth.
- [ ] **(c) Sibling-repo pass (`solid-agent-skills`):** un-pin the 2 `shapes` KNOWN-FAILURES (root cause
  was the template-placeholder catalog file, relocated by SP2-T3) + add the `invoke --param` line to the
  pod-navigate tier table + the 6 CLI sharp edges from the gate report §5.5 (parameterless-`$param`
  silent-empty, bare-IRI param error hint, multi-source HTTP/2 crash under load, no sub-container
  recursion in source discovery, extensionless descriptor GET 404).
- [ ] **(d) Decision-laden `mem:` vocabulary comments** — the E7 re-run lever: move the decision rule
  ("an open RealignAction means dereference it before trusting the governed value") into the
  `rdfs:comment`s grounding agents already read (E5b applied to the vocabulary).
- [ ] **(e) Index-legibility-as-index** — the in-situ lever: a type hint on the container listing
  (nothing marks `index.md` as the index; at descriptive-slug scale agents never opened it).
- [ ] **(f) Optional de-confounded write-twin arm** — re-run `evals/e5b-write/` with a task domain far
  from the provenance vocabulary (tests whether arm A's high floor survives without the grounding/topic
  confounds).
- [ ] **(g) `ViewSpaceHttpHandler` 404-throw twin bug** — filed by T7 (see the NB on the FIXED
  `?_profile=fused` 404 item in the 🔧 section): `handle` still THROWS `NotFoundHttpError` (unknown
  view-space / unknown person slug) → latent 500; fix with the same MementoHttpHandler idiom when
  next touched.
- [x] **(h) `sub:bodyHash` undefined in the substrate ontology — CLOSED (PSP-T4):** defined in `sub:`
  (alongside the new `sub:projectorVersion`); agents no longer burn grounding budget dereferencing it to
  nothing.
- [ ] **(i) Organization/Group/Membership lanes carry the write contract but ZERO seeds** (T10b note):
  the shapes + templates require `mem:rationale` but no seed dog-foods them; seed when addressbook
  is next touched.

## 🧭 Generalization probe (2026-06-10) — 3 tooling gaps FOUND + FIXED + RE-RUN 2026-06-11

Report `docs/plans/2026-06-10-generalization-probe-report.md` (amended w/ the post-fix re-run); rig
`evals/generalization/` (`e1d95b9`). **First run verdict ("execution does NOT generalize, 0/7") was
CONFOUNDED by broken tooling, not agent behavior** (the skill-cli agents diagnosed the gaps in-flight).
The three gaps were triaged (bug / feature / data), fixed, and the probe re-run. **Corrected verdict:
discipline + dispositions + execution ALL generalize once the tooling works** (post-fix skill-cli 3/3
execute the declared query, brute-force 6/6→1/6, 3/3 correct, audit still fires). The curl arm still
enumerates — a genuine tier boundary (Comunica = CLI/MCP capability), NOT a defect.

- [x] **(1) `invoke` parameterized affordances — was a MISSING FEATURE, now BUILT** (`19f5a75` + `0dc4ecd`).
  `invoke --param name=value` substitutes `$name` (word-boundary, value verbatim) + a default-source split
  (`%RESOURCE%` affordances keep the `.operations/` default; `$param` affordances default to
  `discoverQuerySources(container)`). `contact-find-by-orcid --param orcid=<iri>` returns the right person.
- [x] **(2) `sparql` RDFSource-blind discovery — was a genuine CODE BUG, now FIXED** (`35bf6f6`).
  `discoverMetaSources` appended `.meta` to every member (silent-empty over native-RDF containers like
  contacts / `/id/`). Renamed `discoverQuerySources`; content-type-driven (RDF media type → query the body;
  markdown/non-RDF → `.meta`). Affected every native-RDF container, not just this probe.
- [x] **(3) stale affordance descriptors — was DATA drift, now FIXED** (`2ed7b3b`). 6 addressbook descriptors
  re-pointed from `Person/*/index.ttl` (abandoned per-container layout) to deployed flat `Person/*.ttl`.

**Triage rule learned:** of three "the affordance won't execute" symptoms, one was a real code bug
(silent-wrong-results), one a missing feature, one stale data — distinguish before "fixing." **Fork b
still confirmed** (one general skill). **Residual non-blocking:** invoke's `discoverQuerySources` default
does N parallel HEADs (fine at small scale; watch at SP2 scale); optional scale re-run (≥30 contacts) to
de-confound the curl-arm discovery question (n=6 made brute-force rational — the curl arm can't execute
SPARQL regardless, so this only sharpens the discovery sub-question).

## 📐 Progressive disclosure + profiles reconciliation (2026-06-10)

> **FOLDED INTO the agentic progressive-disclosure contract spec (2026-06-10):**
> `docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md` (spine /
> foundation; build approaches deferred). The profiles/roles strip-back, the D80 re-cut, and the
> index-view BUILD are now §9 "FOLD IN" of that spec — do them as ONE view-layer rework, not
> separately. The items below remain here as the detailed checklist the spec's SP2 will execute.

- [x] **★ Measure pod-side index views BEFORE building them — RUN 2026-06-10: definition-line
  index earns its keep decisively; BUILD it.** Report `docs/plans/2026-06-10-rq-discovery-1-index-view-report.md`;
  rig `evals/idxview/` (harness `~/dev/probes/idxview/`). Mock-first, 30 opaque-slug concepts, arm A
  bare `ldp:contains` vs arm B + discoverable definition-line `index.md`; locate-among-30 (target n09
  Write-Ahead Log, paraphrased so the agent must comprehend). **Result (n=3/arm, all 6 correct):**
  resource fetches ~18 (A, range 10–30) → ~0.7 (B, range 0–1) = ~20–30×; wrong-resource GETs 9–29 (A)
  → **0** (B); index read+used **3/3** (B); wall-clock ~halved. Arm A brute-forces every note (opaque
  slugs); arm B reads the index and routes (b-run2 answered from the index definition with ZERO note
  GETs). **Gate satisfied — shape validated pre-engine.** Open calls folded into the build (below):
  (i) delivery/discovery mechanism (this probe favors a discoverable named `index.md` child over
  conneg, consistent with H0 — `?_profile=` never reached); (ii) cheap format A/B (prefLabel-only vs
  definition-line — only the rich format was tested; definition line was what got read+quoted);
  (iii) the deferred root-level/cross-container + `/llms.txt` arm C + the wrong-CONTAINER-descent
  metric (this probe was single-container, so only wrong-resource descents were measured).
- [x] **Profiles strip-back spec — fix what the profiles implementation surfaced** (Chuck,
  2026-06-10). Inputs: RQ-Conneg-1 verdict (H0/H1/E8), sanity check §4, deployed-web
  principle, D86 provenance (DXWG/SELFIE lineage — Chuck's extension; the *selection* half
  served a configured-client class that didn't arrive, the *hint* half is validated). Its own
  spec — do NOT rip out ad hoc; preserve the fused merge. Scope:
  (a) **KEEP**: `Link: rel="profile"` + `dct:conformsTo` + PROF descriptors *as hints*
  (H0-validated, nearly free) and `?_profile=fused` (aggregation — its one real job);
  (b) **REMOVE/DEMOTE**: the `?_profile=` *selection* aspiration; `?_profile=alt`
  introspection (unconsulted in every probe); view-authority-as-PROF-artifact (D114 move 3 —
  fold its content into the lean Layer-0 literal);
  (c) **DECIDE explicitly**: the configured-client question — selection machinery earns
  maintenance only if non-LLM interop partners (DCAT harvester / OGC-style consumers) are
  expected on this Pod; an audience decision, not a correctness one;
  (d) **RE-CUT D80**: hub-view/breadcrumb-view from invocable affordances (dead surface —
  agents never run handed CONSTRUCTs) to ViewAssembler-served views per the PD audit;
  (e) reconcile D86/D113 decision text with status annotations (part of the distillation pass).
  **Gate CLEARED 2026-06-10 — the index-view probe ran (definition-line index validated, BUILD it).**
  The D80 re-cut (d) now has a measured target: hub-view/breadcrumb-view → ViewAssembler-served
  definition-line index views (read off the listing), not handed CONSTRUCTs. Do the strip-back +
  index-view build as one view-layer rework.
  **✅ EXECUTED 2026-06-12 as SP2-T6/T7/T8/T9** (plan `docs/superpowers/plans/2026-06-12-sp2-consumable-pod.md`):
  T6 = the D80 re-cut (hub-view/breadcrumb-view → served index views); T7 = `alt` token dropped +
  ViewHttpHandler 404 fix + fused-graph cleanup; T8 = lean Layer-0 re-cut (Cut-A literal byte-identical)
  + PROF hint completeness; T9 = D86/D80/D113 decision-text reconciliation + D115. The index-view BUILD
  itself = SP2-T4/T5 (derived `sub:ContainerIndex` `index.md` per container w/ derivation provenance).

## 🔧 Code↔decision conformance review findings (2026-06-10) — ALL FIXED same day

Full report: `docs/research/2026-06-10-code-decision-conformance-review.md`; fixes in commits
`ed0925e`..`160b7cd`. Closed items, recorded here briefly because two findings were re-diagnosed:

- [x] **configGuard "Invalid predicate IRI: baseUrl" — root-caused: STALE LOCAL BUILDS, not a
  guard divergence.** The failing instance was profile-link's `CurationLinkMetadataWriter`
  (configured *inside* memento.json — the per-file attribution misled); profile-link's generated
  `context.jsonld` predated its D112-T8 `baseUrl` param. The guard was RIGHT all along; live boot
  worked because the container builds fresh. Rebuild fixed it; the markdown-render dist was also
  stale (caught by the new guard).
- [x] **Staleness guard added to `make test-js`** — fails loudly per-extension when non-test
  `src/*.ts` is newer than the newest dist `.js`/`.jsonld`, with the rebuild command (same
  no-auto-fix stance as the node_modules check). Verified: trips on touch, 12/12 PASS fresh.
- [x] Batched fixes: (a) biology exemplar's `{.narrower}` body link + projected inverse removed
  (broader-on-child stays — exemplar now models the derive-rule); (b) governed-set source of
  truth ANNOTATED in D81 — the agreement chain already existed (TS maps → maps.json → descriptor
  `sub:governs` → `test_markdown_projection_descriptor.py`); residual = SHACL `agentInstruction`
  prose lists are hand-synced; (c) D107 bootstrap parameterization done (`pod_setup.py
  --storage-root`; apply.py derives view containers from manifest; manifest view/page entries →
  relative IRIs, verified resolving against `https://example.org`); (d) dead
  `buildTwoSubjectPatch` removed (+D95/D96 mechanism annotation); (e) D23 RE-DIAGNOSED — the
  ontology cache IS deployed (`pod_setup.upload_ontology` + compose mount); residual = cache-copy
  *discoverability* (no canonical-IRI→cache link) + non-`.ttl` files not uploaded → folded into
  the Layer-0/index-view structure design.
- [ ] **Residuals (small, non-urgent):** SHACL `sh:agentInstruction` governed-list prose ↔
  `maps.json` agreement test (prose is hand-synced today); vocabulary-IRI constants
  (`pod.vardeman.me` namespace bases in TS) → config injection if a fork ever needs it;
  remaining absolute IRIs in manifests beyond the view/page entries (capability pointers etc.) —
  normalize during the Layer-0 re-cut. NOTE for next `make reset`: deployed seed for biology.md
  changed (narrower removed) — fresh-volume rebuild picks it up automatically.

## 🧪 RQ-Conneg-1 + RQ-Salience-1 experiments (2026-06-09) — RUN; disposition is the lever

Reports in `docs/plans/2026-06-09-rq-{conneg-1-{h0,h1,e8-graph-tool},salience-1-{e1,e5,e5b,bootstrap-test}}-report.md`;
living docs `docs/research/2026-06-08-{solid-view-mechanism-vs-profiles,read-path-salience}.md`. Harnesses ported
to `evals/` (portable templates; run from a copy outside any repo): `conneg-h0/h1/e8`, `salience-e1/e5/e5b/bootstrap`
(salience-e5b + salience-bootstrap reuse the salience-e5 trap; bootstrap also carries `setup/agentguide-{original,augmented}.md`).

- [x] **H0 — agents DO conneg, robustly.** Bare agents go HEAD-first → follow `describedby`→`.meta` →
  request RDF; reason about Link rels by *known semantics*. `describedby` is the load-bearing native
  mechanism; Accept-on-document appears only with a cue; PROF-as-hint used, `?_profile=` selection never.
  Reason #3 falsified — the conneg floor is solid.
- [x] **H1 — over-trust is reached-but-missed (A), not never-reached (B), 4:1.** Four of five fetched
  `.meta` (which carries `hasOpenAction`) and answered the stale value; currency cue did NOT help.
  Proto-knowledge gap confirmed (Chuck): `describedby` followed / `mem:hasOpenAction` invisible.
- [x] **E8 — graph-navigation tool does NOT fix it; disposition does.** Free-CLI agents (2/2) used
  `sparql`/`read` to *confirm* the body value; directed agents (2/2, "check operation history") followed
  the `hasOpenAction` link and split — 1 corrected to Hierarchical Retrieval, 1 **defensibly kept PD**
  (the `RealignAction` is `PotentialActionStatus`/proposed + the target 404s). NEW: surfacing ≠ acting —
  the signal's *applied-vs-proposed* semantics drive the decision; the trap conflates them.
- [x] **RQ-Salience-1 ANSWERED — over-trust = agent DISPOSITION (confirm-mode), not delivery/vocab/view.**
  **E1** standard vocab NOT the lever (0/3; agents in confirm-mode from step 1; non-scanned sibling missed
  regardless of vocab). **E5** content-laden "audit-before-trust" preamble flips it 3/3 (overcomes the
  proto-knowledge gap — a disposed agent follows the bespoke link *because it's auditing*). **E5b** the
  disposition must be CONTENT-LADEN — sharp L3→L4 threshold; generic diligence fails 0/8 (absorbed into
  confirm-mode). **Bootstrap test** pod-delivered content works when consumed but consumption leaks
  (cold agents don't bootstrap 0/3; agentGuide pointer too deep 1/3). **Cut A** disposition in the
  immediate `.well-known` `sh:agentInstruction` literal (`void-description.json`, committed) → efficacy 3/3.
  **NET: content ✓ · placement ✓ (immediate Layer-0 ≫ pointer) · consumption ✗ (cold agents don't bootstrap → skill/MCP).**
- [ ] **▶ NEXT — design the read-path memory STRUCTURE** (brainstorming track open; `superpowers:brainstorming`).
  Two coupled halves the experiments established (gbrain-informed, `garrytan/gbrain`): **(a) Pod Layer-0** =
  lean self-description leading with orientation + routing index + the disposition literal (defer the RDF
  catalog machinery — the "less text" lesson; D109 layered-context-loading / minimum-index); **(b) agent-side
  consume-first disposition** delivered by skill (baked in) / **MCP gateway** (forces consumption + foregrounds
  governance — the fix for the 0/3 consumption leak) / bootstrap (weakest). The pod makes the disposition
  *consumable*; it can't *install* it. Chuck flagged **MCP design + pod refactor** as the dependent build.
  Open sub-threads from E5b: emphasis-vs-content not fully isolated (terse-but-specific L3.5); does the
  disposition need the failure-mode *taxonomy* or does "hunt for any contestation signal" generalize.
- [x] **E7 (grounding) — RUN 2026-06-10: grounding is a SECOND independent lever; Chuck's challenge
  sustained.** Report `docs/plans/2026-06-10-rq-salience-1-e7-report.md`; salience doc §8.1.1; harness
  `~/dev/probes/salience-e7/` (Sonnet, curl-only, same de-confounded E5 trap; arms `g` grounding-only /
  `ga` grounding+audit). **Grounding-only caught 2/3; combined 1/1 (gold).** Disposition-gated, not
  capability-gated — install "ground unknown terms" and 3/4 dereference `mem:` (plain GET). DIFFERENT
  mechanism from E5 audit (dereference-the-unknown-term, not hunt-for-contestation); raw curl order shows
  grounding `mem:hasOpenAction` *causes* the ledger follow. **The 1 miss = the registration gap** (E1/E5b):
  g-run3 never registered `hasOpenAction` as unknown-to-ground, answered from known `skos:broader` in 3
  calls. Audit supplies registration that grounding lacks → combined = gold. Grounding also *refines* the
  proposed-vs-applied read (g-run2 used the grounded def to correctly discount a `PotentialActionStatus`
  action as pending-review). **E7 CLOSED on supply** (substrate already makes `mem:` groundable: class-
  extension floor + D84 conneg, Turtle+JSON-LD); **open on consumption = the skill/MCP channel, shared
  with E5.** Pre-flight passed clean (no metadata fix needed; E5 trap is the clean cell — no 404 wrinkle).
  **▶ Feeds the structure design: the agent-side disposition bundle carries BOTH audit (E5) + grounding
  (E7); MCP gateway force-consumes both. Pod-side grounding channels (D111 data-deref pattern + unbuilt
  SAI loading chain D109/D110) get built inside the structure design with the MCP gateway as consumer —
  do NOT build D110 pre-emptively (Chuck, 2026-06-10).**
- [x] **RQ-Conneg-1 over-build verdict — provisionally CONFIRMED; H2 likely moot.** Pure Solid
  (`describedby` + media-type conneg + PROF-as-hint) suffices; `?_profile=` selection never reached across
  H0/H1/E8. Don't pre-emptively strip (D114 validated); a strip-back is its own spec — **now queued as the
  profiles strip-back item in the 📐 section above (2026-06-10)**.

### ✅ Sibling-repo bug (`solid-agent-skills`) — `solid-pod invoke` — FIXED 2026-06-10 (SP1 Task 2, commit `446c8d9`)

**FIXED** on branch `sp1-pod-navigate` (all 3 defects): arg 1 is now the RESOURCE url (catalog
discovered via its `storageDescription` Link, or `--pod`); descriptor predicates matched by localName
(`sub:`/`wiki:` both work); `%RESOURCE%` substituted before execution. Verified live (a spec-review
subagent seeded a real `.operations/` record and confirmed `memory-history` returns correct bindings).
D52 Tier-2 restored for resource-scoped affordances. Historical defect record below:

Surfaced by E8. **D52's "machine-actionable affordance" (Tier-2 access) is currently broken for the
post-D107 resource-scoped affordance class** (`memory-history`, `breadcrumb-view`, …). Three compounding
defects in `solid-agent-skills/src/commands/invoke.ts`:
1. **Arg-contract mismatch** (`invoke.ts:31-32`): arg 1 is treated as the Pod *root* (builds
   `<arg1>/meta/affordances/<name>.ttl`); agents pass the *resource* URL (as for `read`/`sparql`) → 500.
2. **Namespace drift**: matches only `wiki:selectQuery`/`constructQuery`; post-D107 affordances use
   `sub:selectQuery` → "no query found" even when fetched.
3. **No `%RESOURCE%` substitution**: query templates (`… as:object <%RESOURCE%> …`) are run verbatim → match nothing.
Fix = redesign to `invoke <resource-url> <affordance>`: discover catalog via storage description (or `--pod`),
match by predicate localName, substitute `%RESOURCE%`. ~30-50 LOC + test + `dist` rebuild (~1hr). **Held**:
sibling repo is push-paused (7 ahead) and its skill-acquisition research questions investing in hand-written CLI;
NOT on the RQ-Salience-1 critical path (E8's working channel was follow-the-link, not invoke). Fix when CLI is next touched.
- [x] **Affordance names not discoverable — FIXED 2026-06-10 (SP1 Task 3, commit `edc8257`).**
  Added `solid-pod affordances <url>` (lists the catalog by name from any resource URL via
  storageDescription discovery) AND `invoke`'s 404 now returns an `available` list. Both shipped.

## 🔭 D113 view layer (2026-06-07) — MERGED to main + read-path eval DISCHARGED

Merged to main 2026-06-07 (merge commit `9dd3d92`; 41/41 unit + 12/12 live e2e; `make audit` 0 ERROR). Push = Chuck's call.

- [x] **View-layer cold probe — D112 Probe-2 read-path re-run. RUN 2026-06-07; INCONCLUSIVE on the trailer, reframed the architecture** (report `docs/plans/2026-06-07-view-layer-cold-probe-report.md`, corrected after raw-trajectory audit). Both Arm-A agents used `curl -v` → saw the Link header too, so the runs don't isolate the trailer; the clean `curl -s`-only test was never run. Arm-B = floor behaving as designed (follow-your-nose for content; governed context invisible because metadata is in `.meta`). **CLI fused read confirmed as the working governed-context channel on RDF.** Architecture decision (Chuck): curl = degraded floor; metadata in `.meta`; fused read (CLI/MCP) = contract.
- [x] **Demote or remove `TrailerDecoratingStore`** (DONE — removed entirely by D114, 2026-06-07). The A′ markdown trailer + 422 marker guard + `?_profile=doc` / `?_profile=graph` views all removed. `?_profile=fused` is now substrate-wide + content-type-agnostic (D114, 2026-06-07); `?_profile=graph` dropped as redundant with `describedby`.
- [x] **Make the server fused/graph view substrate-wide + content-type-agnostic.** DONE (D114, 2026-06-07) — `?_profile=fused` is now substrate-wide + content-type-agnostic; `?_profile=graph` was dropped as redundant with `describedby`.
- [x] **`mem:` IRI re-declaration now has a 3rd site.** DONE (D114, 2026-06-07) — the trailer (the 3rd site) is removed; `mem:hasOpenAction` is now only in `ops-index/src/parseProposal.ts` and `profile-link/src/CurationLinkMetadataWriter.ts`.
- [x] **Eval tested the wrong tier → D114 eval RUN 2026-06-07** (report `docs/plans/2026-06-07-d114-eval-report.md`; harness `~/dev/probes/d114/`). Tier-3 + floor over-trust arms + write/curator regression arms. Result: **delivery improved, over-trust NOT fixed, no regression** (see below).
- [x] **★★ RQ-Conneg-1 — is the view layer over-built vs pure Solid? RUN 2026-06-09** (reports
  `docs/plans/2026-06-09-rq-conneg-1-{h0,h1,e8-graph-tool}-report.md`; verdict in the 🧪 section above).
  H0: agents conneg robustly, `describedby` load-bearing, PROF-as-hint used, `?_profile=` selection never
  reached. H2 likely moot. Over-build verdict provisionally CONFIRMED → strip-back queued in the 📐 section
  (2026-06-10), gated after the index-view probe.
- [ ] **★ RQ-Salience-1 — read-path salience (the live RQ-Substrate-4 read-path gap), now an OPEN RESEARCH THREAD.** Framing + evidence + experiment matrix (E1–E6) + Claude's not-yet-decided lean: **`docs/research/2026-06-08-read-path-salience.md`** (registered RQ-Salience-1 in decisions.md). D114 eval: the fused read DELIVERS `mem:hasOpenAction` into context but agents are predicate-directed and **never register** the sibling triple (not opaque-pointer-not-followed — never-seen). Reframe: put contestation in STANDARD vocab on the node the agent's own traversal already visits; app-specific source vs standard surfaced signal; tensions (node vs statement / flag vs refuse-to-serve / data- vs token-layer salience) UNDECIDED; meta-question (substrate-honesty vs agent-disposition vs mis-modeled) open. **Chuck: run more agentic-behavior experiments before deciding the fix** (reuse `~/dev/probes/d114/`). RQ-Substrate-4 read-path stays OPEN under this.
- [x] **D114 regression check PASS (2026-06-07).** Write round-trip: 201, zero 422, grammar→`.meta`, fused renders. Curator loop (d112 Probe-1 re-run): conformant proposal 201, floor taught (2×422→corrected), propose-only held, acme untouched. No previously-working behavior regressed by the trailer/guard/doc removal.
- [ ] **`OperationsIndexListener` does not retract the `mem:hasOpenAction` back-pointer on op DELETE** (only derives on POST); a deleted op leaves a dangling back-pointer to a now-404 op until `make reset`. Orthogonal to the view layer (the fused view faithfully reflects `.meta`).
- [x] **`?_profile=fused` (and the markdown path) on a MISSING base resource surfaces the thrown `NotFoundHttpError` as HTTP 500, not 404** — FIXED (SP2-T7, 2026-06-12): the handler writes the 404 itself (MementoHttpHandler idiom; mechanism = `HandlerServerConfigurator`'s blanket 500 catch — the error→HTTP converter lives inside `ParsingHttpHandler`, bypassed by sibling waterfall handlers). NB: `ViewSpaceHttpHandler.handle` still THROWS `NotFoundHttpError` (unknown view-space / unknown person slug) → same latent 500; fix with the same idiom when next touched.
- [x] **RDF `?_profile=fused` output includes the CSS `ResponseMetadata` named-graph** — FIXED (SP2-T7, 2026-06-12): fused union filters quads in the `SOLID_META.ResponseMetadata` graph.
- [ ] **WIKI_CLASS_TO_PROFILE covers only 5 classes.** `Place`/`Event`/`Organization` fall through to the `page` profile even though dedicated class profiles exist. Extend the mapping if full per-class PROF hints are wanted on every GET.
- [x] **Fused/graph Turtle serialization uses full IRIs (no prefixes).** FIXED (SP2-T7, 2026-06-12): `ViewAssembler.serializeTurtle` defaults to a skos/schema/dct/prov/mem/sub/ldp/xsd prefix map (caller-overridable); covers the fused fenced block, fused RDF union, and the /vault/views/ people cards.
- [ ] **`OperationHandler` list snapshot in `view-layer.json` must be mirrored on a CSS version bump.** The handler is injected by position into the LdpHandler chain via Components.js Override. Same K1 tradeoff as AdmissionFloor — document which CSS version was current (v8.x at 2026-06-07) so a future bump knows to recheck the chain.

## 🔁 D112 curation protocol (2026-06-05, MERGED + pushed) — cold probes RUN 2026-06-06: curator loop VALIDATED; read-path NEGATIVE

Built on branch `d112-curation-protocol` (10/10 plan tasks); e2e green; audit 0 ERROR / 1 known WARN;
suite green Pod-up + Pod-down. **Cold probes run 2026-06-06** (report
`docs/plans/2026-06-06-d112-cold-probe-report.md`; harness + per-run artifacts `~/dev/probes/d112/`).

1. ✅ **Curator probe PASSED 3/3 (ensemble) — the curator loop is VALIDATED.** All runs: in-band
   discovery → liveness → Memento-pinned conformant proposals (floor 201s; plain-POST-UUID and
   POST+Slug naming paths; raw-verified ZERO PUT/PATCH/DELETE across all runs) → propose-only on
   BOTH lanes (3/3 lane-discipline) → back-pointers derived. Raw-trajectory audit (report §):
   `.well-known/solid` bypassed 4/5 runs (discovery rode container browsing + interop + bootstrap
   memory — D44 router not load-bearing for mid-tier agents); one passing curator made ZERO
   header-inspecting requests in 95 calls (body channel carries the in-band teaching).
   All runs also caught a REAL bug: `did#uniresolver` can't resolve `pod.vardeman.me` (the name is
   local-/etc/hosts-only — did:web self-reference needs public DNS; deepens D111 item 6). Judgment
   variance observed (doi-conneg 406: 1 run declined per the record's `skos:note`, 2 flagged) —
   absorbed by propose-only as designed.
1b. **▶ Primary-agent probe NEGATIVE 0/2 — read-path surfacing needs a design response.** The
   `mem:hasOpenAction` Link header was emitted correctly but NEVER entered the agents' context: both
   fetched the record with `curl -s` (body-only) — a DELIVERY-channel failure, not salience
   (RQ-Atomic-Feedback-1 read-path, first live datapoint). Three response candidates in the report:
   (a) teach "read Link headers on every fetch" via entry-point instruction; (b) surface the open
   action in the representation body/`.meta` (D58-style; collides with the RQ-Listener-1 no-clobber
   concerns); (c) declare the back-pointer curator-facing only and close the read-path variant as
   "deferred signals win". Brainstorm before building.
2. **Delete-event back-pointer removal relies on in-memory seen-map.** The `OperationsIndexListener`
   tracks which resources it has annotated in-memory. A restart between a Create event (adds the
   `mem:hasOpenAction` back-pointer) and a Delete event (removes it) leaves a dangling pointer on the
   resource `.meta`. By-design v1; revisit with persistence or a sweep-repair pass.
3. **wiki-memory rollout gated on D82 — UNGATED 2026-06-13 (D116).** The `mem:hasOpenAction`
   back-pointer pattern needed agent `.meta` enrichment to survive body rewrites; provenance-scoped
   projection (D116) makes it survive by construction (D82 dissolved, sidecar unbuilt). Full
   wiki-memory rollout no longer waits.
4. **Maturity scorer NOT built — and BLOCKED by ledger anonymity (probe artifact audit 2026-06-06).**
   Ledger signals are defined (clean-trace rate, reversal rate, plan-version stability) but the
   scorer is per-agent and the ledger is anonymous: 35/35 agent-authored probe proposals omitted
   `prov:agent` (shape only requires the `hadPlan` path; cold agents satisfy shapes minimally;
   captured bodies at `~/dev/probes/d112/captured-proposals/`, 37/37 pyshacl-conform). Fix per the
   D108 floor rule: identity is judgment-free + server-knowable under auth → DERIVE (stamp the
   authenticated WebID at write time), not 422. Activates with the security profile (same trigger
   as the `/id/` write gate, D111 item 3).
5. **Agreement test for duplicated IRI constants.** `MEM_HAS_OPEN_ACTION` and `POTENTIAL`
   (`schema:PotentialActionStatus`) are defined in both `ops-index/src/parseProposal.ts` and
   `profile-link/src/CurationLinkMetadataWriter.ts`. A cross-extension agreement test (modeled on
   `test_substrate_mirror_consistency.py`) should verify both against `mem.ttl`.
6. **id-schemes `interop:Application` not in SAI registry chain.** The identifier-schemes interop
   app is discoverable via LDP container listing of `/vault/meta/interop/` but has no shapetree
   declaration and is not in the SAI `RegistrySet` chain. Provide-reactively (D87 discipline) —
   generalize when app #3 declares needs.
7. **`ldp:inbox` advertisement deferred.** Advertising `/id/.operations/` as `ldp:inbox` waits
   until an LDN notification consumer exists.
8. **`rdfs:isDefinedBy` migration sweep.** Pre-existing wiki shapes carry `rdfs:isDefinedBy`
   pointing at vocab docs that don't declare them. D112's `<#CurationProposalShape>` form (shape IRI
   = hash on the shapes file that declares it) is the D84-conformant pattern; consider a migration
   sweep for the pre-existing shapes.
9. **ops-index logger 'attached' message not visible in CSS logs.** Log-level config issue; cosmetic
   — no runtime impact.

## 🆔 D111 identifier-scheme substrate (2026-06-05, MERGED to main) — SHIPPED + VALIDATED; residue list

Live on the Pod; e2e 8/8 (incl. the bootstrapped `how-identifiers-work` memory); **cold probes
PASSED 3/3** (report `docs/plans/2026-06-05-d111-cold-probe-report.md` — 2 seed-data provider bugs
found+fixed same day); `make audit` 0 ERROR / 1 known WARN; `make reset` reproducible
(identifier-schemes seeded FIRST). Open follow-ups:

0. **Probe-donated sub-C detector candidates (first citizens for the curation-loop brainstorm):**
   (a) ✅ provider liveness — **→ resolved by D112** (implemented as `mem:JudgmentClass` detector in
   the identifier-schemes curation affordance); substitute each record's `idot:sampleID` into each
   `idot:urlPattern`, verify the declared `dcat:mediaType` comes back (would have caught BOTH probe bugs);
   (b) suggestive-typing sweep — typed identifier literals vs their scheme's `luiPattern`.
   Lesson: SHACL validates structure; only resolution attempts validate providers.

1. ✅ **PropertyValue materialization rule → sub-C curation loop. → resolved by D112** (implemented as
   `mem:DeriveClass` detector; `schema:PropertyValue` projection, `propertyID` = scheme-record URL).
2. **RO-Crate / Croissant profile records (unseeded).** The model accommodates dataset-packaging
   profiles (RO-Crate, Croissant) as scheme/profile records; not seeded — add when a real consumer
   needs them (provide-reactively, D87 discipline).
3. **WAC write-gate for `/id/`.** `/id/` is currently world-writable under dev-allow-all. The write
   gate (only the deployer/curator registers schemes) activates with the security profile — not a
   bug today, a deferred hardening tied to auth turn-on.
4. **IdCatalogStore internal `.meta` write bypasses Locking.** The derived-index rewrite writes
   `this.source` below the Locking layer (single-writer assumption holds today). Revisit at
   multi-agent WAC — concurrent scheme registrations could race the derived index.
5. **`Link: rel="profile"` document-kind hints need `dct:conformsTo` in `.meta`.** For the catalog
   and scheme-record documents to advertise their kind via `rel="profile"`, the profile-link writer
   needs `dct:conformsTo` in their `.meta` (same pattern as D86). Not yet wired for `/id/` docs.
6. **uniresolver provider = the DIF dev instance (no SLA).** The DID scheme records point resolution
   at the DIF universal-resolver dev instance; no uptime guarantee. Swap for a self-hosted or
   SLA-backed resolver if `/id/` resolution becomes load-bearing.
7. **DOI scheme record follows Crossref regex guidance** (`^10\.…`). SICI-style angle-bracket DOIs
   are deliberately NOT matched by the `idot:luiPattern` — documented limitation, not a bug.

## ⚙ Cleanup sprint (2026-06-04, branch `cleanup-sprint`) — SHIPPED; residue list

Closed: **the Components.js config guard** (offline JSON-LD parse with the boot parser + @type→descriptor
resolution — the 3×-recurrence `Invalid predicate IRI` class is dead; proven by historical-bug replay);
**`dct:identifier` unified on `<#this>`** (derived slug killed — the URI is the identifier; frontmatter
citekey re-pointed; governed on Source; SourceShape datatype loosened for future scheme-typed literals);
**multi-`constrainedBy` merged-shape dispatch** (SourceShape fires live — D108 §1.5 complete; parity =
set-equality vs the shapetree; upstream one-shape guard lifted); **short-form `type:` tokens resolve the
Thing class** + `wiki:maturity` emits the IRI the shape declares; **`audit_type_index`** (caught real
stale-registration residue on first run; severities D100-corrected: same-origin-outside-root=WARN,
off-origin=ERROR); **`make test-js`** (643 TS guard tests in the default loop); **post-projection hook
restored on the in-band path** (ContradictionDetector hears floor writes; config guard validated the
wiring offline — first dogfood); **test suite honestly green** both Pod-up (0 failed/0 errors) and
Pod-down (0 ConnectErrors, gated skips); L4-test teardown; memento de-flake (async-commit poll).

Residue (deliberate, tracked):
1. **Dup-container WARN** — `wiki/concepts/` hosts both `skos:Concept` and `wiki:Source` (intentional,
   D98). Resolve only if/when Source gets a dedicated container under future D108 SKOS work.
2. **mem-trigger detectors**: ContradictionDetector + BoundExceeded live; `ReflectionDue`/
   `UnprocessableWrite` remain unwired v1 stubs (fields ready, call-sites absent).
3. **Test cleanup-discipline pass** — several live tests still leave `drain-*`/`test-*` writes (the L4
   test now cleans up; sweep the rest with autouse teardown so long sessions don't bloat the dev Pod).
4. **Pod-template `resources/` residue** — `test_no_para_residue` runtime-skips while the reset template
   seeds the empty PARA-era container; fix the template, the test then enforces.
5. `make test-js` suppresses stderr on failure (print-on-fail would help debugging); minor.
6. `test_agent_enrichment_survives_body_rewrite` — xfail FLIPPED 2026-06-13 (D116); now a normal
   expected-pass (provenance-scoped projection; the floor snapshots `.meta` pre-commit, the actual root
   cause was CSS's writeMetadataFile clobber, not the sidecar's absence).

## 🔬 Agentic-fragility audit (2026-06-03) — ✅ REMEDIATED 2026-06-04 (branch `fragility-remediation`)

**R1–R6 implemented across 11 commits** (R-T1..R-T8 + final-review fixes + boot fix); final
cross-batch review APPROVED-with-followups; deployed via `make reset`; live e2e 7/7; audit 0 ERROR;
**dual-view identity verified live** (render href ≡ projected `.meta` edge for the same wikilink).
Also: remark-AST projection parsing (maskCodeSpans retired), live-Type-Index-wins merge, frame
partition derived from governance, agreement tests + `maps.json` sidecar over every mirror (two
reconciled divergences: CURIE prefixes, the Python importer's pre-D70 `vault:` classes), Graph-based
Python patches (injection class closed), one conftest layer, WAC real-shape tests. **Still-deferred
residue:**
- **`dct:identifier` Page/Thing split (design decision):** the pipeline derives `dct:identifier` on
  `<>` while an authored `{.identifier}` span lands on `<#this>`; both ungoverned, non-leaking.
  Decide: unify the subject + whether to govern it.
- `pathConstraint.ts` agent-message prose still says `</vault/ontology/wiki>` (cosmetic literal).
- **Add a config-term↔context-mapping agreement test** — the `Invalid predicate IRI` boot class
  recurred this sprint (markdown-render `storagePath`) even after Task 10 documented it; third
  occurrence earns the structural guard (parse each config block's terms against the owning
  extension's components context).
- mem-trigger's `ContradictionDetector`/`UnprocessableWriteDetector` get `eventsContainer` threading
  when wired (fields exist; call-sites don't yet).

### (historical) the original R1/R2 items — ALL FIXED 2026-06-04; details for the record:

1. ✅ **Render↔projection URL identity split — FIXED (R-T2).** Single URL minter `targetUrlFor`
   (`shared/markdown-parsing/src/wikiUrl.ts`); `HardcodedResolver` is now a thin adapter; the
   projection mints through the same function (richer live-index routing overlaid on the shared
   defaults). The stale `/vault/resources/concepts/` path is gone from source. Agreement locked by
   `markdown-projection/test/renderProjectionAgreement.test.ts` (13 golden vectors, real pipeline).
   Render config `podBase` is now `variable:baseUrl` + `storagePath` (no literal).
2. ✅ **Live Type Index overruled — FIXED (R-T1, commit `efed9a2`).** Merge flipped to
   `{...defaultIndex, ...live}`; deterministic per-container parse.
3. ✅ **`subjectFrame` ↔ `PAGE_GOVERNED_PREDICATES` `identifier` divergence — FIXED (R-T2).** The
   page/thing partition is now DERIVED from `PAGE_GOVERNED_PREDICATES` via the token→IRI binding
   (`subjectFrame.ts`); `identifier`→`dct:identifier` is not page-governed (it's the Source shape's
   `<#this>` property), so the token frames to `<#this>`. Agreement test in `subjectFrame.test.ts`.
4. **wiki-search WAC gate mock-masked** — the real CSS-v8 `IdentifierMap` permission branch (the
   "a bug here is a data leak" path) has zero test coverage; `handle()` never exercised.
5. **f-string N3/SPARQL patch builders in Python** (`common.n3_patch_inserts` callers,
   `ldp_client.patch_meta`, `backfill_conformsTo`'s second dialect) — Turtle-injection class;
   unify on the Graph→nt path `apply.py` already uses for the hard patches.

R3 (agreement-test sweep over the ~9 unguarded mirrors — `CURIE_PREFIXES`↔served-context still
diverged; the page-frame split + render≡projection minter are now guarded by R-T2), R4 (D107
completion sweep: render `podBase`→`variable:baseUrl` and `DEFAULT_WIKI_TYPE_INDEX` keys DONE in
R-T1/R-T2; wiki-search `WIKI_PREFIX` + `mem-trigger.json` literal IRIs still OPEN), R5 (unify
projection parsing on the render AST — retires the maskCodeSpans gap class — still OPEN), R6
(hygiene batch — the listener frontmatter `^type:` regex→pipeline `splitFrontmatter` DONE in R-T2;
rest still OPEN) — see the report.

## ⚙ D108 Front-2 SHIPPED (2026-06-03, branch `d108-front2-admission-floor`) — final-review follow-ups

The in-band admission floor is live (12-task plan complete; e2e 7/7; audit 0 ERROR / 0 WARN; final
cross-batch review APPROVED-with-followups). Spec: `docs/superpowers/specs/2026-06-03-d108-front2-inband-admission-floor-design.md`.
Non-blocking items from the final adversarial review:

1. ✅ **Listener-backstop governed-set bug — FIXED (R-T2).** Both `listener.ts` and
   `markdownBodyProjector.ts` now resolve the governed set via the single helper
   `resolveGovernedFromQuads(quads, <#this>)` (`src/resolveGoverned.ts`) — keyed off the `<#this>`
   rdf:type, not `detectClass`'s first (`wiki:Page`). The concept skos/cito axis is governed on both
   paths. Unit test: `test/listenerGovernedSet.test.ts` asserts the listener-path governed set for a
   concept body includes `skos:prefLabel`.
2. **Descriptor `sub:governs` ↔ `governedPredicates.ts` drift.** `markdown-projection.ttl` lists
   predicates not in the runtime governed set (`dct:references/subject/creator`, …) and omits some
   that are (`skos:narrower/exactMatch/closeMatch`, `schema:name/description`, …). Not a runtime
   contract violation (the descriptor is agent-facing declaration), but no test asserts agreement —
   add a parametric descriptor↔governedPredicates test or reconcile the lists.
3. **`sub:bodyHash` is deliberately NOT in `sub:governs`** — it's substrate-internal (the backstop
   stamp; passed to `replaceGoverned` at runtime so it's cleanly replaced) and intentionally not
   advertised as agent-relevant. Recorded so a future audit doesn't flag the stamp as "ungoverned."
4. **`make audit` rdflib traceback noise** from template placeholder IRIs (`[YOUR VOCABULARY IRI]`,
   `[YYYY-MM-DD]`) in the extension-guide template — pre-existing, non-fatal (0 ERROR), cosmetic.
   **NOT purely cosmetic (re-scoped 2026-06-10, SP1 pre-flight):** the same `<[YOUR VOCABULARY IRI]>`
   placeholder sits in the *served* shape catalog and makes the `solid-agent-skills` `shapes` command throw
   an N3 parse error (3 of the pinned KNOWN-FAILURES), and would trip a cold agent's `pod-navigate` `validate`
   path the same way. **Small real fix candidate at the SP2 catalog re-cut:** relocate the template out of the
   served catalog so the catalog parses clean for agents + tools.
5. **Hand-edited `dist-cjs/*.jsonld` for markdown-projection (PSP-T5, `gitDir` param)** — `listener.jsonld`
   + `components/context.jsonld` carry the new `gitDir` parameter by hand-edit; they would be OVERWRITTEN
   if `componentsjs-generator` is ever re-run on this extension. Latent drift point of the same class as the
   existing `stampPredicate`→config precedent (and the K1 CSS-version-bump notes): the generated artifact
   and the source-of-truth can silently diverge. Low risk (the generator is not in the build path), recorded
   so a future regen knows to re-apply.

Anti-fragility review (Chuck's three lenses: hardcodes / RDF-model bypass / fragile regex) fixed four
items pre-merge (`4ca0751`: stampPredicate→config, `isContainerIdentifier`, shared `RDF_CONTENT_TYPES`,
de-duped `fsPathFromUrl`); the deferable findings:

5. **`isPermissive('/working/')` is empirically redundant** — pyshacl confirms `working.shacl.ttl`
   conforms trivially for drafts (targets `wiki:WorkingNote`; zero focus nodes for a draft Concept;
   only optional properties), so the D73 permissive policy is ALREADY carried by the data model via
   `constrainedBy`. The substring check also over-matches any path containing `/working/`. Fix when
   touched: delete it (trusting the shape) or replace with a `sub:permissive` container-meta marker —
   data-driven either way.
6. **`test_floor_parity.py` filename-equality hop** — the constrainedBy→NodeShape link is matched by
   shape FILENAME, not by dereferencing the constrainedBy doc and reading its `sh:NodeShape` IRI.
   Loud-fail (not silent) if a shape moves files, but the ~10-line RDF-resolving version is cleaner.
7. **`maskCodeSpans` gaps: indented (4-space) code blocks and fences inside blockquotes are NOT
   masked** (4+-backtick fences also). Render/projection asymmetry: the render path (remark AST)
   handles all of these natively. Durable direction: hoist the projection parsers
   (wikilinks/spanLiterals) onto the same remark/micromark AST the render path uses, eliminating the
   regex/AST divergence class. Until then the gaps are narrow (teaching docs use fenced blocks).
8. ✅ **`listener ⇄ markdownBodyProjector` circular import — FIXED (R-T2).** `trimSlash` +
   `fsPathFromUrl` hoisted to `src-cjs/fsPaths.ts`; both modules import from there (`listener.ts`
   re-exports for back-compat callers). No behavior change.

**Unblocked by this ship:** D109 sub-C (curation loop) and the **RQ-View-2 FULL re-eval** (the floor
+ grammar are both live; per the 2026-06-03 reorder, in-band *teaching* (deferred skill-over-build
agenda / Knob 1) follows once the structure has settled — the 422+ValidationReport is itself the
runtime teaching signal in the meantime).

## 🔍 Cold-probe findings (n=3, 2026-06-02) — STATUS 2026-06-05: the STRUCTURAL halves shipped (container `sub:shape`+`sh:agentInstruction` backfill, descriptor literal axis + `sub:projectsFromBody`, projector code-span skip — all in the Front-2 sprint Phase 1; querying/graph-view eval folds into RQ-View-2). The in-band TEACHING quick-win + Knob 1 remain DEFERRED per the structure-before-teaching reorder. Historical record:

Three independent cold-probe agents (HTTP-only, no repo/skills/hints) interpreting the live pod.
**Strong positives:** all three read it as **agentic memory** ("an agent's durable externalized
memory," "agentic memory pod" — the **"memory pod"** framing lands unprompted); all three accurately
reconstructed the structure (discovery chain → catalogs/Type-Index/shapes, dual-layer markdown+`.meta`,
two-subject `<>`/`<#this>`, two-stage commit, SHACL 422). Two gaps to act on:

1. **★ The grammar is undiscoverable in-band (highest value; do BEFORE D108 Front-2 enforcement).**
   All three found `skos:prefLabel` is *required* on a concept but **NONE discovered the
   `[text]{.prefLabel}` literal-axis grammar** — they guessed frontmatter key / `.meta` PATCH /
   wikilink hint. The grammar SHIPPED + works (G10), but the **Tier-0 teaching surface was never
   updated**: the storage `sh:agentInstruction`, the `markdown-projection` affordance descriptor
   (`sub:projectsFromFrontmatter` lists `type/created/…` but NOT the literal axis), and
   `how-wiki-memory-works.md` don't teach *how* to author `prefLabel`/`definition` inline. No point
   enforcing the floor before agents can learn to satisfy it. **Quick win = teach it IN-BAND (not a
   skill):** add the literal/edge/type axes + required-fields-per-shape to those three surfaces.
   Sub-requirement: the projector must **skip wikilinks/spans inside code spans** so a teaching doc can
   SHOW `[text]{.prefLabel}` examples without projecting them (this is the root of the dangling-broader
   bug — fixed minimally at `f8aaeaf`, proper fix folds in here).
2. **URI opacity (the deeper RQ-Substrate-4 frame).** All three still hit the `/vault/wiki/` "false
   friend" — first read it as "a MediaWiki app," then self-corrected via the orientation note. The
   misread is *killed at comprehension* but the **URI segment is still friction**. Reframe (Chuck): a
   URI path should be **OPAQUE** — semantics are defined by the `.meta`/representation, NOT by path
   tokens; agents *reading* `wiki`/`vault` as semantic tokens is the bug (they should treat the path as
   an opaque identifier and take meaning from the RDF). Fix space (NOT now): communicate/treat paths as
   opaque + lean on metadata for semantics, and/or rename toward the **"memory pod"** framing (retire
   "vault"/"wiki" as semantic segments). Continues the deferred RQ-Substrate-4 view-layer / storage-root work.
3. **Bridge affordances need design.** All three noted two person stores — `/vault/contacts/` (vCard)
   vs `/vault/wiki/people/` (schema:Person notes) — plus `bridge-card-to-wiki.ttl`, but the relationship
   (dedup? federation? when to use which?) wasn't legible from a read. Needs a design pass.

Also: the `pod-discover` skill (solid-agent-skills) was **drifted** (pre-D107/D98) — **RESYNCED
2026-06-03** against the live chain (`sub:` pointers not `wiki:`; 7 containers; 8 mostly-standard-vocab
classes — `skos:Concept`/`schema:{Person,Place,Event,Organization,HowTo}` + `wiki:{Source,WorkingNote}`;
Type Index migrated + working; 20 affordances / 18 shapes; `sub:agentGuide`). **Two substrate gaps
surfaced during the resync** (both feed the in-band teaching quick-win above):
- (a) **The `concepts`/`places`/`events`/`organizations` containers carry NO class-level
  `sh:agentInstruction` or `sub:shape` pointer** in their `.meta` — only `people`/`procedures`/`working`
  do. The SKOS-backbone container (`concepts`) is the single most important one, and it's missing its
  instruction. A cold agent landing on `/wiki/concepts/` gets no container-level write hint; it must
  reach the shape via the Type Index. Backfill these container instructions.
- (b) **`markdown-projection.ttl`'s `sub:governs` omits the literal axis** (`skos:prefLabel`,
  `skos:altLabel`, `skos:definition`) that the shipped RQ-Grammar-1 projector now writes. So the
  affordance descriptor *under-declares* what the substrate governs AND never teaches the literal
  `[text]{.prefLabel}` syntax — exactly the discoverability hole the cold probe found. Add the literal
  axis to `sub:governs` + a `sub:projectsFromBody` (or equivalent) description of the three grammar axes.

**Graph-view dimension (the *second* view — verified live 2026-06-02 via the `solid-pod sparql`
Comunica CLI).** The cold probes tested only the **document view** (GET + reading `.meta` as *text*);
the **graph view** (SPARQL over the RDF) is a different mode, and the pod hosts **no SPARQL endpoint**
(D3/D29) — a GET-only agent can't use it; it must bring Comunica and point at `.meta` sources. Live
cross-resource query over `/wiki/concepts/`: (a) **it works** — the CLI's container `.meta`
auto-discovery handles the RQ-Pod-4 describedby-skip (`metaSources=4`, cross-resource results); (b)
**the SKOS backbone is HOLEY** — `photosynthesis`/`biology` (hand-authored gold exemplars) carry
`skos:prefLabel`, but `how-wiki-memory-works` (and likely other doc-concepts) have only `schema:name`
→ SKOS-label queries return PARTIAL results. The graph view is the lens that reveals what the document
view hides; the holes are the downstream cost of (grammar untaught) + (no enforcement floor). **Three
adds:** (i) the eval must test **both views** — a **graph-view cold probe** equipping an agent with the
Comunica CLI + a KG-navigation task (does it discover/use the graph view, or just GET?); (ii) the
in-band teaching must cover **querying** (the pod is a queryable graph; the container-auto-discovery /
explicit-`.meta`-source pattern) as well as authoring; (iii) backfill missing `prefLabel`s on deployed
doc-concepts (or let the enforcement floor + grammar-teaching prevent the recurrence).

**Access-tier framing (Chuck 2026-06-02 — TWO parts of universality; CLI-first).** The graph view is
NOT a standard SPARQL endpoint — querying a pod uses Comunica-specific algorithms (link-traversal +
the RQ-Pod-4 explicit-`.meta`-source pattern), available only in the Comunica framework. The answer is
*not* "embed Comunica in every agent" — it is two tiers, **learn-then-universalize**:
- **Tier 1 — CLI tools + skills (NOW; the dev-time eval instrument, NOT a throwaway baseline).** The
  agentic harnesses that matter for us — Claude Code, OpenAI Codex CLI, Gemini CLI — all run
  command-line tools and carry skills. Dispatching SDK agents from the CLI, equipped with the
  solid-agent-skills + `solid-pod sparql`, is how we (a) **eval at development time what a *good* pod
  memory structure is** and (b) verify an agent can **consistently answer questions from its memory**.
  This is where we LEARN the KR/structure — run the graph-view eval HERE, now.
- **Tier 2 — MCP (LATER; the second universality).** Wrap the now-understood query capability behind a
  **Comunica-Solid MCP** (one has been built) to reach harnesses that DON'T have CLI/skills access and
  aren't wrapped by the skills protocol for propagating procedural knowledge + tools. Build the MCP
  *after* the Tier-1 eval tells us what to expose.
Re-tiers D55: HTTP/LDP = universal authoring; **CLI+skills = dev-time KR eval + consistent agent
access**; MCP = broadest runtime querying (follow-on). Depends on de-drifting `pod-discover` first —
it is the Tier-1 access layer the eval rides on.

## ⚙ Interop foundation — deferred-runtime gaps (D109 sub-A+B final review, 2026-06-02)

The interop foundation (Application / AccessNeeds / RegistrySet / DataRegistrations /
ShapeTrees-over-SHACL; branch `d109-grammar-interop-specs`) is **vocabulary-now / runtime-deferred**
(D109 §5). Two consistency gaps are deliberate but will resurface when the SAI runtime lands:
> **The SAI runtime has now landed as a target** — surfacing + materializing + consuming this
> declared-but-inert layer is the core of the agentic progressive-disclosure contract spec
> (`docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md`, §4/§9).
> Both gaps below are FOLD-IN items there (SP2 surfacing).
- **`interop:hasRegistrySet` is asserted in the registry doc, not the WebID card.** A real SAI client
  discovers the RegistrySet by following `hasRegistrySet` from the *dereferenced WebID*; it won't find
  it there. `pod_audit` passes only because it merges card+registry before querying. Fix when the
  runtime matters: seed the `hasRegistrySet` triple into `/vault/profile/card` (owner-identity overlay).
- **Shape Trees namespace drift:** we use plural `http://www.w3.org/ns/shapetrees#` (the actual
  ontology) consistently, but SAI's cached `interop.ttl` declares `registeredShapeTree`'s range as
  singular `…/ns/shapetree#`. A strict interop range check would mismatch. Documented in
  `ontology/shapetrees.ttl` header; revisit at D110 / SAI-runtime time.

RESOLVED in the same branch: the **build:esm deploy gap** — the Dockerfile now runs `build:esm`, so the
ESM projection pipeline `dist/` (which the listener loads at runtime) is rebuilt from source instead of
shipping a stale COPY'd local build (commit `569a78c`). Sharpens the older "stop tracking compiled
dist drift" code-review follow-up below.

## ⚙ Infrastructure note — replace Zazuko `rdf-validate-shacl` with `shacl-engine` (CLIENT spike LANDED 2026-06-10; server migration still open)

> **SPIKE LANDED 2026-06-10 (SP1 Task 1, decision B with Chuck).** The new `solid-pod validate`
> CLI pre-flight tool uses **`shacl-engine@1.1.0`** (stable) + `rdf-ext@2.6.0` — the first use of
> shacl-engine in the codebase, deliberately placed on the new, isolated CLI surface as the
> lowest-risk spike. It de-risks the server migration: the rdf-ext-v2/clownface friction that
> motivated this note is real (rdf-validate-shacl@0.6 needed a fragile internal-path import with
> modern rdf-ext); shacl-engine pairs cleanly (`new Validator(shapes, { factory: rdf })`). Result
> mapping reaches grapoi internals (`r.focusNode.term.value`, `r.path[0].predicates[0].value`) —
> works for SHACL-core, verified against a battery of path types. **Experimental SHACL-1.2 branch
> DEFERRED** per the stable-first stance (revisit for the coverage features once v1 proves out).
> **STILL OPEN: the SERVER floor migration** — `css/extensions/shape-validator/` still runs Zazuko
> `rdf-validate-shacl@0.6`. True CLI↔floor validator parity (the pre-flight's design rationale)
> wants the server migrated too; the CLI spike is the evidence it's clean. Original note follows:

Recorded 2026-06-02 while fresh, at Chuck's request. **Chuck is leaning toward replacing the current
SHACL validator** — `rdf-validate-shacl@^0.6.0` (Zazuko, wrapped by `shape-validation-component`'s
`ShaclValidator`, `css/extensions/shape-validator/`) — **with `rdf-ext/shacl-engine`** as a forward
operation, not merely a spike. Rationale: shacl-engine is a *fast RDF/JS* engine that is
**factory-agnostic** (pass N3's factory/dataset — the rdf-ext-vs-Solid conflict fear is largely
unfounded), and its **experimental** branch brings **SHACL 1.2 + SPARQL-based node expressions +
coverage** (the subgraph of triples a shape covers) — features that look important for agentic
systems (coverage → grammar-term 422 hints + the round-trip oracle; RQ-Grammar-1). **Watch-item:**
the experimental branch pulls `@comunica/query-sparql-rdfjs-lite` + `@traqula/*` (SPARQL 1.2) —
measure the CSS-image footprint. **Now:** spiking behind the existing pluggable `ShaclValidator` seam
(`ShapeValidationStore` takes a `validator`), stable v1.1.0 first, Zazuko kept as fallback (interop
foundation spec §7 has the full assessment). **Future op:** promote to the default validator once the
spike proves the footprint and the 1.2/coverage features earn their keep. Don't lose this — flagged
explicitly.

## D109: substrate re-grounding (umbrella; decided 2026-06-01) — sub-A ✅ (2026-06-02) + sub-B ✅ (2026-06-03/04, floor LIVE); next-in-sequence = C curation → RQ-View-2 full re-eval (after the queued identifier-affordance brainstorm — see `.claude/memory/MEMORY.md`)

**Decision recorded** (`### D109` in decisions.md; full record `docs/superpowers/specs/2026-06-01-substrate-regrounding-design.md`). Pulling RQ-Grammar-1 to its root surfaced **one omission wearing four masks** (RQ-Grammar-1 inexpressible literals / D108 inert shapes / `prefLabel` materialized nowhere / RQ-Substrate-4 contamination): the substrate was built as the **document view with an RDF annotation bolted on**, not the **hybrid contextualized KG** (Verborgh) the design called for. The conceptual spine (SKOS / three frames / two hierarchies / owner partition) is **sound**; the failure is *realization in the graph*.

**Two threads this covers (both must stay covered):** (1) markdown↔graph **synchronization** (vault-as-application) → §3/§4/§6 + **sub-project A / RQ-Grammar-1**; (2) **global-graph construction via correct foundational+application ontologies loaded by progressive disclosure** → §4 Tier-0 + §5 foundational-ontology layer + **D110**. Thread 2 is partly shipped (`interop:` + DID Core grounded); remainder = ground-now cache backlog + D110.

- **Target (§3): layer-partitioned co-equal authority over a hybrid store** — markdown = authoritative *authoring* surface for L3/wiki-memory (incl. prose); `.meta` graph = authoritative *queryable/interop* representation for L1–L2 (incl. substrate-derived + curator-added); overlap only on governed predicates; **server-managed description-resource (`describedby`) projection** bridges; L3 references the pod, not vice versa. **NOT "graph-canonical"** (authoring stays markdown-native — storage primacy must not dictate agent modality). Symmetric/CRDT → Scale-3; no-clobber = RQ-Listener-1/D82.
- **Coherence (§4):** Tier-0 legibility/**layered context-loading** + Tier-1 SHACL **admission floor** (`422`, D108 Front-2) + Tier-2 **agentic curation loop** (Karpathy Lint continuous, pod-curator, `mem:*`). Floor/loop rule: *derive* inferable / *floor* locally-authorable judgment / *loop* graph-global judgment.
- **Foundational-ontology layer (§5):** `ontology/` cache (basis `ontology/README.md`); **`interop:` adopted as the agentic-app vocabulary** (vocabulary now / Authorization-Agent runtime deferred / `st:`→SHACL) — corrects the "SAI too heavy, don't use" dismissal; identity layer (`acl`/`acp`/VCDM/`sec`/`did`/`odrl`) enumerated-but-deferred (in-scope, auth is dev-allow-all). Re-base `cap:`/`overlay:`→`interop:` = **D110** (stub).
- **Decomposition (each its own spec→plan→build):** **A** RQ-Grammar-1 (markdown write-view into the substrate graph) → **B** D108 Front-2 (admission floor) → **C** curation loop → **D** view layer (deferred, = D107 §6). Cross-cutting: **D110** + populate the ground-now vocab cache (`ldp`/`solid`/`as`/`pim`/`notify`/`sh` + SKOS/DC/PROV). **Re-run RQ-View-2 after A+B.**

**▶ NEXT SESSION (development): brainstorm sub-project A — RQ-Grammar-1.** The actual grammar design, framed by D109 as *"the complete, reversible, rule-grounded markdown write-view into the substrate graph."* Open syntax decisions are in D109 §8 (Sparna-informed `{=…}` subject-scoping + an inline literal axis, *trimmed*; exploit our implicit `<>`/`<#this>` default; close the datatype/lang gap; reconcile the two drifted predicate maps — render-path `predicates.ts` vs projection-path `context.jsonld`). **Framing is locked** (D109 §3–§6); run the brainstorm→spec→plan→implement cycle for A. Artifacts in place: D109 spec, `ontology/interop.ttl` + README, D110 stub. Branch `d109-substrate-regrounding` (committed, **not pushed**). Auto-mems: `foundational-ontology-cache`, `skos-backbone-enforcement-architecture`, `authoring-grammar-expressivity-gap`.

## D108: SKOS backbone + dual-view enforcement — ✅ BOTH FRONTS SHIPPED (Front-1 2026-06-01; Front-2 = the admission floor, LIVE 2026-06-03, multi-shape dispatch 2026-06-04). Historical record:

**Decision recorded** (`### D108` in decisions.md; full record `docs/superpowers/specs/2026-05-30-skos-backbone-dual-view-enforcement-decision.md`). Pulling the `skos:prefLabel`-not-enforced thread (RQ-View-2 Probe-A repeats, 2026-05-29) unravelled a **proven root cause: the entire wiki-memory L3 content corpus is unvalidated at write time** (no `/vault/wiki/` container declares `ldp:constrainedBy`; the upstream validator validates the markdown *body* not the projected `.meta`; `.meta` is auxiliary-exempt; projection is post-commit). Controlled write of a `prefLabel`-less concept → `201`. D104 "self-validating substrate" held only for the RDF-body substrates (contacts/WebID).

**What was decided** (see D108): SKOS is the real conceptual backbone (concepts = scheme, notes attach); three label frames (`<>`→`dct:title`, `<#this>` Thing→`schema:name`, `<#this>` Concept→`skos:prefLabel`); `prefLabel` **enforced + materialized** (today materialized nowhere → SKOS label queries empty corpus-wide); **derive the inferable** (`rdfs:label` apex + `schema:name`) but **reserve the 422 for judgment metadata** (`prefLabel` agent-authored via template — NOT silently derived; `dct:identifier` on Source); **container=gate / class=dispatch** enforcement with **in-band synchronous projection** as the load-bearing fix; **two enforcement audiences** — runtime agent (SHACL+422+`sh:agentInstruction`) AND dev agent (tests/CI encoding the frame model, failing with meaningful messages when the substrate is rewritten without understanding).

**Two-front program:**
- **Front 1 — agentic harness: ✅ COMPLETE (2026-06-01, branch `d108-front1-conceptual-model`, 13 commits, live-verified, audit 0/0).** Built: `sub:` frame-spine vocab (`frameRole`/`governsSubject`/`labelProperty`) + Page/Thing/Concept shape annotations; hand-authored gold exemplars (photosynthesis + biology broader-target + marie-curie thing); canonical narrative `how-wiki-memory-works.md` + read-only worked example; narrative↔spine drift-guard agreement test (the dev-agent guardrail, adversarially verified to fire both directions); overlay `installsPage` wiring + `sub:agentGuide` repoint; entry-point literal `sh:agentInstruction` served at `.well-known/solid` (**Phase B — config-only, NOT a custom TS extension**: verified live that `StaticStorageDescriber` emits a literal for an N-Triples-quoted value, so the recorded "IRIs-only" belief was false; orig Tasks 10-11 dropped). New test file `tests/test_frame_model_agreement.py` (16 passing). Plan: `docs/superpowers/plans/2026-05-30-front1-conceptual-model-artifact.md`.
- **Front 2 — substrate guardrails + dual-graph structure (NOT STARTED; now gated by the grammar fix below):** in-band projection (RQ-Enforce-1); container=gate/class=dispatch; `constrainedBy` on durable wiki containers, `working/` permissive (D73); uniform `rdfs:label` + frame labels materialized; `prefLabel` enforced; dev-side tests encoding the frame model + agreement contracts.

### ⚠ NEW (2026-06-01) — RQ-View-2 RAN + surfaced an authoring-grammar expressivity bug (RQ-Grammar-1)

**RQ-View-2 result (n=2 cold probes, 2026-06-01, against the Front-1-complete live Pod):** the
`wiki`→MediaWiki **misread is killed** (the D107/Front-1 comprehension goal — achieved; one agent
cited the Phase-B entry-point literal as where it learned the SKOS model). BUT both probes scored
**3/5 (DOWN from the n=3 baseline 4/5)** — and the drop is *diagnostic, not regression*: a more
legible substrate let the agents **see** a defect the baseline agents never noticed. Both
independently (n=2 consistent): discovered `skos:prefLabel` is required, found NO inline mechanism
to supply it, and were **forced to PATCH `.meta` directly — violating the substrate's own no-PATCH
rule.** Also hit: `type: Source`/`Organization` short-forms mis-projecting; `{.affiliation}` on a
Concept "felt semantically questionable"; the documented 422 correction contract doesn't fire.
(Probe concepts were cleaned up post-run.)

**Root cause = RQ-Grammar-1 (authoring-grammar expressivity bug, upstream of D108 Front-2 enforcement):**
Traced via the typed-wikilink provenance work (Sparna *Semantic Markdown Spec*,
<https://hackmd.io/@sparna/semantic-markdown-draft>; doc `docs/decisions/typed-wikilink-syntax-provenance.md`).
RDFa (which Sparna targets) is RDF-complete on **three axes**: `typeof`→`rdf:type`, `property`→predicate-with-**literal**,
`rel`/`resource`→predicate-with-**resource**. **Our inline `[[X]]{.class}` grammar collapsed to ONE
axis: a single predicate, resource-object only** (object-property edges between resources). The
type axis is handled (poorly) only by the frontmatter `type:` key; the **literal-property axis does
not exist inline at all** — so `skos:prefLabel`/`skos:altLabel`/`skos:definition` (literals on
`<#this>`) are **unexpressible** by any wikilink, and the frontmatter allowlist
(`type`/`created`/`modified`/`maturity`/`aliases`/`identifier`/`citekey`) doesn't project them
either. Net: **{link-grammar ∪ frontmatter-allowlist} does NOT cover what the shapes require**, so a
cold agent *cannot author a conformant concept inline* even with a perfect 422 gate. This is an
**expressivity gap upstream of the enforcement gap** — "derive prefLabel for them" would paper over
a missing grammar axis rather than restore it. NB: this is *accreted*, not one agent's regression —
D36 was born edge-only ("typed wikilinks → predicates"); the type/literal axes were never built
inline; frontmatter was a partial stopgap that never grew to cover the shapes.

**Framing locked for the brainstorm (do NOT re-litigate in passing):**
1. The markdown authoring grammar must be expressive enough to **round-trip the full governed graph**
   the shapes require (type + literal-properties + resource-edges) into `.meta`.
2. **RDFa-in-HTML rendering is OUT OF SCOPE / a red herring.** RDFa matters here ONLY as *proof* that
   an annotation-on-markup model can be RDF-complete (it round-trips losslessly to Turtle). D75
   ("no RDFa in served HTML; humans get CSS classes") was right *about HTML display* but got tangled
   with "the authoring grammar only needs links" (wrong). The invariant is the markdown→`.meta`
   projection round-trip — which never went through RDFa anyway.

**The fork to brainstorm (Chuck leans A or C, undecided — needs the brainstorm's framing to choose):**
- **(A)** Enrich the inline grammar toward Sparna/RDFa completeness — add a literal-property axis and
  a type axis (a span/attribute form for literals, distinct from the wikilink edge form).
- **(B)** Keep wikilinks edge-only; make frontmatter the literal/type surface but *complete* it
  (project `prefLabel`/`altLabel`/`definition`; fix `type:` short-forms). [Chuck's lean: NOT B alone.]
- **(C)** Hybrid, anchored on "grammar must round-trip the governed predicates."

**Sequencing (revised — this is the dev-process answer):**
`RQ-Grammar-1 brainstorm → spec → implement grammar fix → then D108 Front-2 enforcement → then
RQ-View-2 RE-EVAL.` Front-2's "supply the required metadata" contract is only *honest* once the
grammar can express it; and re-evaluating before both land would measure a substrate where
conformant authoring is still impossible. Recommended cadence: **finish/merge the Front-1 branch
first** (clean shippable checkpoint — Front 1 is complete + green), **then open the RQ-Grammar-1
brainstorm as its own focused session** (framing above is locked; A/C decided there, not now).

**RQ-Enforce-1 (open, D108 Front-2):** how to make projection in-band/synchronous without breaking
the post-commit MonitoringStore architecture (D58/D71). See decisions.md.

Subsumes/relocates the earlier "unrelated issues" list from the Probe-A analysis: `prefLabel` (→ now
RQ-Grammar-1: make it *expressible* inline, then enforce); `dct:identifier` on `<#this>` for
`wiki:Source` (→ same — a literal-on-`<#this>` the grammar can't carry); `type:` short-form
mis-projection (→ RQ-Grammar-1 type-axis); the POST-vs-`.md` projection footgun (→ Front-2 write
semantics); two-stage-commit discovery clarity (→ Front-1, shipped). The `{.affiliation}`-resolve-check
stays a skill-layer (resolve-before-assert) item.

**Provenance doc drift caveat:** `docs/decisions/typed-wikilink-syntax-provenance.md` (uncommitted)
documents the Sparna lineage + the D36 deviation. It currently still describes a render-path "RDFa
`property` CURIE" — that is STALE (D75 dropped RDFa from HTML; render path emits CSS classes via
`rehype-wikilink-classes.ts`). Also the hint→predicate map has drifted: `shared/markdown-parsing/src/predicates.ts`
(render path) still uses legacy `vault:` predicates; the canonical/current map is the served JSON-LD
context (`/vault/meta/context.jsonld`) + shape `sh:agentInstruction` (projection path) using `cito:`/`skos:`.
Reconcile the doc + the two maps as part of the RQ-Grammar-1 work.

## ⚠ RQ-Substrate-4 — vault-application contamination of the general substrate (raised 2026-05-26)

> **IMPLEMENTATION UPDATE 2026-05-28 — URI/namespace slice SHIPPED (D107), Phases 1–4 deployed, audit 0 ERROR.**
> The `sub:` re-layering is **merged to `main`** (2026-05-28, commit `02f9b58`; the `rq-listener-1-provenance` branch was fast-forward-merged and the local label deleted; NOT pushed — `origin/main` still at `8364cee`): Bucket-1 standard-predicate
> reuse (`wiki:typeIndex`→`solid:publicTypeIndex`), Bucket-2 35-term migration to `sub:` (`https://pod.vardeman.me/vault/ontology/substrate#`),
> `/wiki/` reframed as "the wiki-memory document view" in served self-description (agentGuide + synthesis + PROF
> descriptors), `/vault` storage-root parameterized (no source hardcode), PROF promoted to actionable out-of-band
> hint (`rel="profile"` + `sh:agentInstruction` on every descriptor). Round-trip-across-views test passes. The 4
> contamination couplings below are RESOLVED by D107's buckets. **STILL OPEN (do NOT mark RQ closed):** (a) the
> **cold-probe eval (RQ-View-2 / Probes A/B/C)** — the behavioral validation that the reframe actually kills the
> `wiki`→MediaWiki misread — is the teed-up next step (design in D107 §5 + decisions.md RQ-View-2; deterministic
> round-trip already green). (b) The deep contacts-conundrum fix (one entity, multiple writable views) = the
> deferred VIEW LAYER (D107 §6 / spec §4.3). **New pre-existing items surfaced during the migration (NOT
> migration-caused), see "Pre-existing test/build debt" at bottom.**
>
> **Status: OPEN research question, not a decision.** The eventual decision record is an *output* of
> this RQ (we don't yet know the target structure), so there is deliberately **no D-entry** in
> decisions.md yet. Tracked as **RQ-Substrate-4** in `.claude/memory/MEMORY.md` (loads every session)
> + auto-memory. **The 2026-05-26 self-description work (Tasks 11–13) is a MITIGATION, NOT THE FIX —
> do NOT mark this resolved until the substrate is actually re-layered.** Claude Code's bias toward
> solving the immediate problem means this WILL get re-papered unless deliberately resurfaced; that is
> the whole reason this is recorded redundantly.
>
> **Empirical evidence (cold-agent probe, 2026-05-26):** a clean HTTP-only agent, no repo/hints, given
> only the Pod URL + a realistic store-a-concept task, reached confidence **3.5/5**. Its **Confusion #1**
> (verbatim): the `wiki` URL segment "initially read to me as an application or tool name — 'this is a
> wiki tool, like MediaWiki' ... created a brief framing error I had to correct." It self-corrected via
> the existing self-description and never flagged `vault` itself. Every item on its own "what would make
> this 5/5" list was a **self-description** improvement, not a URI change — which is why mitigation is a
> reasonable *interim* but the URI bias is the real, deferred problem. (Other probe confusions #4/#5/#6/#8
> are two-hierarchy/projection comprehension gaps that the dogfood note + agentInstruction address; #3 is
> the concepts/sources container-merge asymmetry from D98.)


**Concern (Chuck):** The substrate was evolved *forward from the Obsidian vault* (PARA + SKOS + wiki
metadata) rather than *backward from fundamental Solid/LDP capabilities*. The Obsidian vault is just
**one** linked-data application that could sit on a Pod-as-substrate; we have conflated *wiki-application*
concerns (originally the vault's metadata structure) with what should be **general-purpose agentic
linked-data practices** independent of the app. The principled construction is: L1 LDP capabilities
(resources, containers, `.meta`, Type Index, storage description) → L2 memory-substrate invariants →
**dual knowledge-graph views** (document views *and* queryable graph views over the same objects — the
Verborgh/LDP read-write + query stance) → and only THEN application profiles like wiki-memory. We grew it
the other way, so vault/wiki concepts leaked downward. This is the project's own D70 L1/L2/L3 split not
being honored in practice ("wiki-memory L3 is *one* application" — CLAUDE.md — but it's coded as if it
were the substrate). See vault note `Memory Substrate vs Memory Profile`.

**Specific contaminations to unwind (not all introduced this session; several pre-existing):**
1. **`/vault` storage name is application-suggestive AND now hardcoded in the loaders.** The 2026-05-26
   showstopper fix hardcodes `${baseUrl}/vault` in both `loadRoutingMap` and the `TypeIndexLoader`
   instantiation (listener.ts). Principled fix: **derive the storage root from a standard Solid mechanism**
   (the storage description / `pim:Storage` / the resource's own container hierarchy), not a hardcoded
   `/vault` literal. The URI `/vault/wiki/concepts/X` also makes an LM agent "read too much into the URI"
   (vault → wiki → concept); a neutral storage root + profile sub-paths would carry less application bias.
2. **`wiki:routesToClass` + `/vault/meta/routing.jsonld` express a GENERAL routing mechanism in L3 `wiki:`
   clothing.** Predicate→class→container addressing is an L1/L2-general concept; it's minted in the `wiki:`
   namespace and deployed by the wiki-memory overlay. Candidate: promote to a substrate-level namespace.
3. **The "minimum opinionated agentic-memory kernel" (Option B, endorsed 2026-05-26) is wiki-flavored.**
   `DEFAULT_WIKI_TYPE_INDEX` + the bootstrap routing entailments were framed as "the minimum structure that
   makes any Pod usable as agentic memory" — but they encode the wiki-memory **L3 profile's** 8-container
   layout. A truly general kernel would be application-neutral (LDP + Type Index + metadata + dual views);
   the wiki layout should be ONE profile's defaults, not the substrate kernel.
4. **`.md` / markdown-wikilink coupling is L3-specific** (markdown-projection gates on `.md`). Fine *as an
   L3 profile extension*, but it should be understood as profile-level, not substrate-level.

**How worried about the 2026-05-26 Type Index fix specifically?** Low, for the fix itself — it moves
*toward* generality (it makes the listener read the **live, standard Solid Type Index** instead of always
using a hardcoded wiki layout; the live index is the application-neutral mechanism). It did NOT create the
contamination and only marginally deepened it via the `/vault` hardcode (item 1, easily refactored). The
kernel/merge is a *fallback* contained in the L3 markdown-projection extension. So: the **code** is sound
and refinable; the **framing** ("wiki kernel = agentic-memory kernel") is the thing to revisit. Not a
code-rot emergency; a deliberate re-layering exercise.

**Direction when picked up:** re-derive the L1/L2 substrate working backward from LDP + dual-view (document
+ queryable graph) first principles; demote wiki-memory to a clearly-bounded L3 profile; neutralize the
storage root; decide which minted terms (`routesToClass`, etc.) belong at substrate level vs profile level.
Precedent: D84 already did one namespace migration, so a storage-root migration is feasible but non-trivial.
This is decision-level work (likely a new D-number + possible supersession of the "kernel" framing).

### Resolution DONE 2026-05-28 → D107 (URI/namespace slice)

**The URI/namespace slice of RQ-Substrate-4 is now resolved as D107** (`docs/superpowers/specs/2026-05-28-rq-substrate-4-uri-relayering-decision.md`):
three-bucket partition (Bucket 1 aggressive standard-predicate reuse — delete `wiki:`
parallels like `wiki:typeIndex`→`solid:publicTypeIndex`; Bucket 2 mint `sub:` substrate
namespace, framed as proto-view vocabulary; Bucket 3 `wiki:` keeps only L3 content, `/wiki/`
re-framed as "the wiki-memory document view"); keep `/vault` (derive, don't hardcode);
PROF promoted to actionable out-of-band view-identity hint; validation = dual-view cold-probe
eval + round-trip-across-views (RQ-View-2). Grounded in Solid vocab-by-concern + Verborgh's
hybrid-graph/views model (the contamination *is* his contacts conundrum). **STILL OPEN:**
D107 does NOT close RQ-Substrate-4 — the deep contacts-conundrum fix (one entity, multiple
writable views) is the deferred view layer (spec §6 step 5). Implementation plan is the next
artifact (`docs/superpowers/plans/`). The four contamination couplings below are addressed by
D107's buckets; keep them here until the plan ships and `make reset`/`make audit` verify green.

### Brainstorm DONE 2026-05-27 → resolution next session

The structural-design brainstorm below was completed 2026-05-27. Output:
**`docs/superpowers/specs/2026-05-27-neurosymbolic-substrate-unification-design.md`** — a unified
neurosymbolic architecture that absorbs all three threads below plus the deeper findings (shared
multi-user substrate; SAI registration vocabulary over live Type-Index+SHACL; views as declarative
projections via conneg-by-profile; context-canonical write-back dissolving the lens problem; the
neuro/symbolic partition = D81 governed predicates; identity anchored in WebID/AddressBook with
mint-first + hard-key-unify; two-curator model; RQ-Identity-1). The key meta-finding: **we had
already solved bits and pieces of the consistency problem and lost track that we had** — the spec is a
unification + inventory (§5 built/partial/missing), not greenfield. **Next session = resolution**:
turn that spec into the re-layering plan + the RQ-Substrate-4 decision record (start at the spec's
§6 sequencing + §7 open questions). The three original threads (now folded into the spec):

This is NOT a code task — it is a **structural-design brainstorm** (use `superpowers:brainstorming`)
that should produce the re-layering design + the decision record RQ-Substrate-4 resolves to. Three
intertwined threads to think through together, plus fresh evidence:

1. **Linked-data URI structure.** The `/vault/wiki/` path is application-biased. *New evidence:* a
   second independent cold-agent probe (2026-05-27, see `docs/plans/2026-05-27-two-hierarchy-eval.md`)
   **again** misread `wiki` as a wiki *application* ("MediaWiki mounted at /wiki/"); the `wiki:`
   vocabulary prefix on storage-description properties compounded it. The self-description mitigation
   only helped by luck (the agent stumbled on the dogfood note; it never followed `wiki:agentGuide`
   nor read index.md). Conceptual framing must live at the storage-description ENTRY POINT, not a
   buried note. Target: neutral storage root, profile-bounded sub-paths.

2. **URI structure provenance — possibly HALLUCINATED.** Chuck's concern (2026-05-27): the URI layout
   (`/vault/wiki/{8 containers}`, `/meta/` split, etc.) was evolved forward-from-the-vault and may
   contain segments that were **invented along the way without a principled grounding** rather than
   derived from a decision/spec. **Do a provenance audit:** for each URI-structure choice, trace it to
   a D-decision or a spec, or flag it as accreted/hallucinated and re-derive it from first principles
   (LDP + the storage description + Type Index). Don't assume the current layout is intentional.

3. **PROF profiles ontology — deployed but NOT used by the agent.** D86 shipped PROF
   (`prof:ResourceDescriptor`, `SolidPodProfile`, the profile-link extension emitting
   `Link: rel="profile"`, the wikirole scheme). But in the cold probe the agent SAW the `rel="profile"`
   headers (`CoreProfile`, `SolidPodProfile`) and **dismissed them** ("names I didn't recognize …
   weren't needed"). So PROF is paying deployment cost while delivering no agent value — the agent
   orients via Type Index + shapes + the dogfood note instead. **Open question:** what is PROF's
   proper role? Is it the right primary resource-kind / "what schema is this?" affordance that we've
   under-wired, or is it redundant with the Type Index + SHACL and should be trimmed? This needs to be
   resolved as part of the re-layering — the agent's actual self-description path (storage description
   → catalogs → Type Index → shapes) should be designed deliberately, with PROF either promoted to a
   first-class consumed affordance or demoted.

**Deliverable:** a structural brainstorm spanning (1)+(2)+(3) grounded in the dual document/graph-view
framing (Verborgh) → a re-layering spec → the decision record. See `solid-profiles-and-conneg` +
`solid-uri-conformance` + `solid-storage-description` skills for the relevant standards.

## Code-review follow-ups (2026-05-27 — D106 sprint final review)

Two items from the final branch review (opus); the blocker (I1, stale committed `dist-cjs`
re-encoding the `/vault` bug) was FIXED in-sprint by recompiling. Remaining:

- **Stop tracking compiled `dist-cjs/*.js` (or add a build-drift guard).** The committed
  `dist-cjs/listener.js` had silently drifted from `src-cjs/listener.ts` — it still carried the
  pre-fix `new TypeIndexLoader(this.baseUrl)` because the artifact wasn't recompiled after the
  `8fd2649` fix. Runtime was saved only because `css/Dockerfile` rebuilds from source, but a
  committed artifact that contradicts its source IS the silent-failure class. Durable fix: gitignore
  the compiled outputs under `dist-cjs/` (keep the hand-written `*.jsonld` Components.js metadata +
  `package.json` tracked — they're NOT regenerated), OR add a `make check-dist` / pre-push hook that
  fails when `git diff --exit-code dist-cjs/` is non-empty after `npm run build`. Same observability
  theme as the Docker stamp.
- **`pod_audit.PUBLISHED_RANGE` is a hand-maintained mirror — drift-prone.** The predicate→class
  entailment is now single-source at runtime (the live `routing.jsonld`; `--check-routing` reads it,
  no Python mirror of the *map*). But `PUBLISHED_RANGE` (the published-range agreement check) is still
  hand-maintained, AND the TS `BOOTSTRAP_PREDICATE_TO_CLASS` kernel + `routing.jsonld` are hand-mirrors
  of each other. Adding a 4th entailed predicate means editing 3 files in lockstep
  (`wikilinkProjection.ts`, `overlays/wiki-memory/routing.jsonld`, `pod_audit.py`). Currently all three
  agree (verified in review). Consider deriving the kernel from `routing.jsonld` at build, or a test
  that cross-checks the three. Folds naturally into the RQ-Substrate-4 re-layering.

## ~~mem-operation in-resource provenance collides with the projection listener (RQ-Listener-1)~~ — RESOLVED 2026-05-26 (by collapse)

**Resolved** (merged to `main` 2026-05-28, commit `02f9b58`; reviewed + APPROVED in the 2026-05-28 session). The resolution arrived in two
passes — and the second corrected the first:

1. *(2026-05-25, since reverted)* A "derive-from-log" mechanism: the projector re-derived
   `<resource> prov:wasGeneratedBy <announcement>` from the `.operations/` log on each write.
2. *(2026-05-26, shipped)* **Collapsed.** A cold-discovery probe (a fresh agent, HTTP-only, no hints,
   asked to crystallize + record provenance) showed the derived edge was **over-design**: the agent
   completed the whole task using only the `.operations/` log, and the edge never even fired because the
   Pod's own `crystallize.ttl` prescribes announce-**last** while derivation needed announce-first. So the
   derived-edge machinery was removed.

**The actual design** (sufficient, validated by the probe): operation provenance is **canonical in
`/vault/wiki/.operations/`** — a `<>`-subject `[as:Announce, mem:*Action, prov:Activity]` with
`as:object <target>` (required, canonical link). The resource `.meta` does **not** carry the operation;
agents reconstruct history by querying the log for `as:object = <resource>` (the **`memory-history`
affordance**, op log + Memento). Kept from pass 1: the **PROV category-error fix** (the projector no longer
stamps `<resource> prov:wasGeneratedBy <affordance>`; the audit stamp lives on the `<resource>.meta`
document subject) and the `mem.ttl` `as:object` tightening. The 6 action affordance descriptors were made
consistent (drop the in-resource `prov:wasGeneratedBy` PATCH guidance + the blank-node examples; `.operations/`
is the sole provenance channel), resolving the contradiction the probe caught.

Also fixed (probe finding): crystallized concepts **failed `ThingShape`** because the projector never
synthesized `schema:name` on `<#this>` — now derived from the title (frontmatter title > H1 > slug).

Verified live (`make reset`): audit 0 ERROR, 6/6 `test_mem_operations.py` pass (assert `.operations/`
provenance), a crystallized concept now carries `schema:name` on `<#this>`.

**Still open / deferred:**
- **Review nit (2026-05-28):** `prov:wasGeneratedBy` is in `PAGE_GOVERNED_PREDICATES` (governed on subject `<>`) but the projector now emits the audit stamp on subject `<>.meta`. It's correct (the governance entry guards against agents stamping the resource, which `mem.ttl` forbids; the `.meta` stamp is re-emitted each write), but add a one-line comment in `governedPredicates.ts` explaining the subject split so a future reader doesn't read it as collapse leftover.
- **Read-path A/B (the over-design revisit trigger):** if a concrete high-frequency genesis-lookup
  workload ever appears, re-evaluate a denormalized in-resource genesis edge via an A/B trajectory eval
  (with a real workload, not synthetic). Until then, YAGNI — the log + `memory-history` is the design.
- **Destination-class inference (probe gap):** a working note declares only `wiki:WorkingNote`, not its
  intended durable class — the crystallize agent must infer it from content. Consider a
  `wiki:intendedClass` hint on working notes. Low priority.
- **Broad agent-extension** (arbitrary non-governed triples surviving body rewrites —
  `test_agent_enrichment_survives_body_rewrite`) stays deferred to the `.meta.agent` sidecar / D82.

**Note:** the earlier "silently red" framing of the 6 tests was inaccurate — they were already green via an
`.operations/`-only workaround (commit `eac80f9`); the final design keeps `.operations/`-canonical
assertions (no longer a workaround — it *is* the design).


## ~~NEXT SESSION — D106 real fix + pod-embed + comprehension re-probe~~ — DONE / SUPERSEDED (shipped on the branch, merged to main 2026-05-28)

> **All three items shipped and are in `main`:** (1) D106 full-arm Type-Index-driven container routing via `routing.jsonld` (commits `a4560c0`/`4c052eb`/`22e9405`/`0554e28`/`f35a6de`/`cb25021`); (2) two-hierarchy/dual-view self-description embedding (`4381a80` + D107 Phase 3.1) — closed the audit WARN; (3) comprehension re-probe ran 2026-05-27 (`docs/plans/2026-05-27-two-hierarchy-eval.md`). The dogfood note was crystallized to `/wiki/concepts/two-hierarchy-memory-addressing.md` (the `sub:agentGuide` target). Integration question resolved: both efforts (RQ-Listener-1 + D105/D106) merged as one to `main`. **The post-D107 behavioral re-probe is now RQ-View-2** (see decisions.md). Historical detail retained below for trace.

Decisions **D105** (two-hierarchy: RDFS-subsumption = addressing axis / SKOS-broader = navigation
axis, never substituted) and **D106** (wikilink role → predicate; container → target class via Type
Index, not role; extension types via ESCO Pattern C `rdfs:subClassOf skos:Concept` + `skos:exactMatch`,
no punning) are **recorded** (repo `decisions.md` D105/D106 + D76(a)/(c) revised + D79 sharpened; vault
D100/D101; project MEMORY key-pattern; auto-memory `two_hierarchy_addressing`). The **interim** resolver
fix shipped (`07217fe`): retired the stale role→container map, default = content container `concepts/`,
kept `author`→people; the 2 long-failing D98 fixtures are green. Three things remain:

**1. Real fix (D106 full arm) — resolve container from the target's CLASS via the Type Index.**
- File: `css/extensions/markdown-projection/src/wikilinkProjection.ts` (+ the listener which already holds
  the live Type Index via `TypeIndexLoader`). Today `targetContainer()` falls back to the base/default
  container; the real version resolves the target by looking up its class via the Type Index (the
  listener has it) and routing class→container. `.role` stays predicate-only (`HINT_TO_PROJECTION`).
- **Forward-reference guardrail:** when the target doesn't resolve (not yet created — normal in a wiki),
  emit the edge to the default content container marked **provisional**, and signal it as a
  dangling/reconcilable state via the existing `mem:StalenessDetected`/dangling-reference machinery so the
  pod-curator reconciles when the target is created. `.embed` ALWAYS looks up (never role-guess).
- Retire `HINT_TO_CONTAINER` except genuine role→type entailments (`author`). Keep the interim behavior as
  the fallback when no Type Index is available (pure-pipeline unit tests run without a live index).
- Note: the pipeline (`projectionPipeline.run`) is pure and has no store access; the Type-Index lookup
  belongs in the LISTENER (`src-cjs/listener.ts`, which has `TypeIndexLoader`) — inject the resolved
  target container into the pipeline, mirroring how `typeIndex` is already injected. Keep `run()` pure.

**2. Embed the two-hierarchy explanation in the Pod self-description (for cold agents).**
- Add agent-facing guidance so a cold agent learns the model from the Pod itself: RDFS-subsumption =
  addressing (Type Index → container/shape), SKOS-broader = navigation; wikilink role → predicate,
  container → target class via Type Index; extension types via Pattern C; dangling refs reconcilable.
- Surface it where a cold agent looks: the storage-description entry-point `sh:agentInstruction` (the lone
  audit WARN is that it's missing — this doubles as that fix) and/or a dedicated doc resource (e.g.
  `/vault/meta/two-hierarchy.md` or extend `/vault/wiki/index.md`). Carry machine-followable
  `dct:references` to the canonical sources (W3C *Using OWL and SKOS*
  https://www.w3.org/2006/07/SWD/SKOS/skos-and-owl/master.html ; ESCO model https://ec.europa.eu/esco/lod/model)
  so the agent can dereference the prior art, not just read prose.
- The dogfood note (below) is the content exemplar to crystallize into `/wiki/concepts/`.

**3. Comprehension re-probe + deploy.**
- `make reset` first — the live Pod is behind the branch: it does NOT yet have the mem.ttl subclass-example
  fix (`3a1c376`), the interim resolver fix (`07217fe`), or step-2's embedded guidance. Reset deploys all.
- Then run a cold agent on a task that exercises the two-hierarchy distinction (create a concept that cites
  a source + links a person; ask it to navigate `broader` vs reason about `subClassOf`/container) and assess
  whether it uses RDFS-addressing vs SKOS-navigation correctly and resolves containers via the Type Index.
  Honest comprehension check (same protocol as the 2026-05-26 cold probes — HTTP-only, no hints, no repo).

**Integration (overdue):** the branch carries TWO efforts — the RQ-Listener-1 collapse AND the D105/D106
two-hierarchy/wikilink work (~20 commits). Consider splitting into two PRs by concern before merge. Nothing
is pushed. Full reasoning trail: decisions D105/D106 + the superseded design doc
`docs/superpowers/specs/2026-05-25-mem-operation-provenance-derivation-design.md`.

**Dogfood note:** a wiki-memory-format vault note documenting the two-hierarchy KR pattern lives at
`~/Obsidian/obsidian/03 - Resources/Agentic Memory Systems/Two-Hierarchy Memory Addressing.md` — a
"memory about how the memory works." Crystallize it into the Pod as the first dogfood content (and the
content exemplar for step 2).

## Shape-validator TBox bundle sync pattern (added 2026-05-23)

`css/extensions/shape-validator/data/{mem,as-subclass-axioms}.ttl` are bundled copies
of the canonical files at `overlays/wiki-memory/ontology/`. Bundling is structurally
required: the Dockerfile COPYs only `extensions/shape-validator` into the image;
`overlays/` is applied at runtime over HTTP and is never present inside the container.

- **Sync**: `make sync-validator-tbox` copies canonical → bundle.
- **Guard**: `make check-validator-tbox` fails if bundle has drifted. Wired as a
  prerequisite of `make test` so drift is caught in every local test run. Run `make
  sync-validator-tbox` before committing any change to the canonical ontology files.

### getClosure() TOCTOU note

`ShapeValidationStore.getClosure()` uses a lazy-init pattern (`if (!this.subClassClosure)`).
Under concurrent first-writes — two requests hitting the store before the cache is warm —
both will build an identical Map in parallel and the second assignment will overwrite the
first with an equivalent value. This is benign under CSS's default single-threaded async
model: Node.js event-loop interleaving cannot split between the `if (!this.subClassClosure)`
check and the `this.subClassClosure = ...` assignment (no `await` in between). It would
become a real TOCTOU only if CSS ever moves to Worker threads with shared state. If that
ever applies, fix by caching a `Promise<Map<string, string[]>>` instead of the Map itself
so concurrent callers await the same in-flight build.

---

## Pod-audit: ClassExtensionShape inference caveat (2026-05-23)

ClassExtensionShape must be validated with `inference="none"`. RDFS entailment adds
`rdfs:subClassOf rdfs:Resource` to every `rdfs:Class`, which trivially satisfies the
`sh:minCount 1` rooting check and makes rootless classes like `wiki:Bad` appear
conforming. The test harness and the `sh:agentInstruction` both document this
requirement. If pod-audit ever runs shape validation with inference enabled, it MUST
explicitly set `inference="none"` for this shape.

---

## Substrate audit + curator — option-B unified build (partially shipped 2026-05-23)

**Status (updated 2026-05-23)**: the *architecture* shipped earlier (commit `5ce2b27`) — `wiki:ClassExtensionShape` meta-shape, subclass-aware path-constraint validation, `mem:StalenessDetected`/`mem:RealignAction`/`mem:rationale` vocabulary, the realignment trace exemplar in `.operations/`, D98 migration. **`pod-audit` now shipped too**: `scripts/pod_audit.py` walker + `StorageDescriptionShape` + `AffordanceDescriptorShape`/`SearchAffordanceShape` (`shapes/substrate/`) + `make audit`. GET storage-description → SHACL-validate (`inference="none"`) → HEAD-check catalog pointers + `rdfs:seeAlso` → walk affordance catalog → validate each entry. Emits JSON (curator queue) / markdown; non-zero exit on ERROR. Validated against the live Pod.

**Baseline audit (the curator's first work queue, 11 WARN / 0 ERROR):** (a) storage description lacks an entry-point `sh:agentInstruction` (the D104 seed prose is ready in §"Component 4" below); (b) two stale `rdfs:seeAlso` 404s — `wiki/pages/` + `wiki/sources/` — these come from the **static** `css/config/void-description.json` (the overlay `storage-patch.ttl` already carries the correct 8-shape list; the static config was never migrated, so the live doc has both old and new); (c) **8 addressbook affordance descriptors** (`contact-find-by-*`, `org-find-by-*`, `bridge-card-to-wiki`) are typed `wiki:Affordance` only — no `prof:ResourceDescriptor`, so they escape the descriptor contract (no role/label/conformsTo/installedBy). Descriptor typing is inconsistent across overlays; the walker enforces the governing type via catalog `ldp:contains` membership rather than relying on SHACL targeting alone.

**Design note (ground-truth precedence):** the AffordanceDescriptorShape did NOT follow this file's earlier proposed strict spec (`wiki:dispatchPattern` cardinality 1 + 100-char `sh:agentInstruction` on the base). The live catalog showed only `SearchAffordance` carries a dispatch pattern; the 6 write affordances use `dct:description` + `wiki:procedure`. The base shape requires only the universal predicates (`prof:hasRole`, `rdfs:label`, `dct:conformsTo`, `wiki:installedBy`, + intent-prose via `sh:or`); dispatch constraints are scoped to a `SearchAffordance`-targeted sub-shape.

**`pod-curator` skill shipped (2026-05-24, solid-agent-skills commit `6ac07d8`)**: D103 bootstrapper + `references/playbook.md`, validated across 3 eval iterations against the live Pod. Clean (de-contaminated) delta 100% vs 61% with-skill vs without. Trajectory-grounded finding: the skill's uncontaminated contribution is the proposal **form** — `mem:RealignAction` + `stalenessClass` + `rationale` + `FalsePositive` on every run (4/4 with-skill vs 0/4 without); the self-describing substrate supplies the *findings* to either arm. (Methodology note: iter-1/2 leaked the `curator-proposals/` path into both prompts, inflating the routing assertion; iter-3 removed it. Don't put substrate paths/vocab in eval prompts.)

**Remaining**: (1) more substrate shapes — capability descriptors, per-catalog-entry label/comment, vocab declarations, JSON-LD context, Type Index; (2) **sweep the 11 baseline WARNs** (fix `void-description.json` stale `seeAlso`, add entry-point `agentInstruction`, bring the 8 addressbook descriptors under the contract) — the curator eval already produced applyable proposals for most; (3) wire `make audit` into `make reset` + CI (deferred — keep manual until the sweep clears ERRORs); (4) pilot iter-3; (5) run pod-curator description optimization (`skills/pod-curator/evals/trigger-eval.json` staged). The curator's staleness loop is specified in the vault method-note `Stale-Memory Discovery and Realignment` + auto-mem `stale_memory_realignment`. Decision ratified as **D104 / vault-D99**. Pilot report §5 has the original task breakdown. NOTE: `ClassExtensionShape` validation (not yet wired into pod-audit) MUST use `inference="none"` — see the caveat above.

### Sweep applied (2026-05-24) — 11 WARN → 1 WARN, 0 ERROR

The Component-4 sweep landed (this repo): stale `rdfs:seeAlso` (pages/sources) and `prof:hasResource` (source dropped, procedure→howto) fixed in `void-description.json`; 8 addressbook descriptors retyped `wiki:QueryAffordance , prof:ResourceDescriptor` with role/label/conformsTo/installedBy; `wikirole:query-affordance` + the missing `wikirole:search-affordance` defined; catalog `dc:description` realigned D77→D98. **WoT alignment**: `wiki:Affordance rdfs:subClassOf td:InteractionAffordance`, `wiki:QueryAffordance ⊑ td:ActionAffordance` (https://www.w3.org/2019/wot/td#), `td:` prefix in context. Two findings from doing it:

- **Storage-description PATCH is 405 (GET-only) → the overlay `storage-patch.ttl` is inert for `.well-known/solid`.** `css/config/void-description.json` (static StaticStorageDescriber) is the *only* source that surfaces there. `seeAlso` must live in the static config, NOT the overlay (initially mis-moved to the overlay, which silently dropped seeAlso entirely; corrected). The overlay's seeAlso/conformsTo inserts have never reached the storage description — candidate to clean up or repurpose to a custom StorageDescriber.
- **`StaticStorageDescriber` emits only NamedNodes (IRIs), not literals** (`Predicate needs to be a named node`; values become IRIs). So the entry-point `sh:agentInstruction` (a string literal) can't be added via the static config — this is the lone remaining audit WARN (Warning-severity by design). FIX: a tiny custom StorageDescriber that yields a literal `sh:agentInstruction` quad on the storage subject, or expose the prose via a different discoverable surface. Until then the agentInstruction lives in the `StorageDescriptionShape`'s own `sh:agentInstruction` (read by the curator), not on the live storage description.

### pod-curator → Pattern B subagent-skill + triggering-eval correction (2026-05-24)

pod-curator restructured to a Claude Code **`context: fork` subagent-skill** (solid-agent-skills
`0b8168f`): a curation run generates large throwaway context (audit JSON, descriptor reads,
SHACL, proposals) that belongs in an isolated fork, not the orchestrator's context. Made
discoverable via `solid-agent-skills/.claude/skills/pod-curator -> ../../skills/pod-curator`.
Full mechanics in auto-mem `claude_code_skill_subagent_mechanics`. Key points:

- **The description-optimization eval was measuring the wrong surface.** skill-creator's
  `run_eval` installs the description into `.claude/commands/` (a *user-invoked* slash command,
  never auto-triggered), not `.claude/skills/` (auto-triggerable). So recall floored at 0 for
  EVERY description — wording was never the variable. Don't re-run the optimizer against that
  mechanism; the `description-opt/` artifacts were deleted as misleading. To measure triggering:
  install under `.claude/skills/`, run `claude -p`, detect the `Skill` tool_use.
- **`context: fork` IS honored in headless `claude -p`** (v2.1.150), confirmed by a subagent
  trajectory written at `~/.claude/projects/<slug>/<session_id>/subagents/agent-*.jsonl`.
  (claude-code-guide + GitHub #17283 claimed otherwise — empirically wrong/stale.) stream-json
  does NOT expose the fork via `parent_tool_use_id`; **detect via the trajectory artifact**.
- **Self-containment (2026-05-24, solid-agent-skills `d914f2f` + this repo `4bd6ff1`):** trajectory
  analysis of forked curator runs found a sandbox-reachability wall — a fork is confined to the
  invoking session's repo, so it could not run `pod_audit.py` in cogitarelink-solid (TLS friction
  was a red herring; the real blocker was cross-repo exec being auto-denied headless). Fixed by
  **bundling the tool into the skill**: `pod_audit.py` got PEP 723 inline deps
  (`httpx`/`rdflib`/`pyshacl`) + mkcert-CA auto-detect (`resolve_ca()`), and is copied into
  `skills/pod-curator/scripts/` (+ `shapes/substrate/`); the skill runs `uv run
  ${CLAUDE_SKILL_DIR}/scripts/pod_audit.py`. No venv, no `SSL_CERT_FILE`, no sibling repo. Canonical
  stays here; `make sync-curator-skill` pushes copies (drift-prone like the shape-validator TBox
  bundle — re-sync after editing `pod_audit.py`/`shapes/substrate/`). VERIFIED: a no-`--add-dir`
  fork ran the bundled tool, touched cogitarelink-solid zero times, completed audit→classify→
  `mem:RealignAction` proposal→two-stage commit. (No Claude Code declared-dependency mechanism
  exists; PEP 723 + `uv run` is the idiomatic answer.) Eventual clean option: extract pod-audit as
  a pip/uv-installable package both repos depend on, instead of a synced copy.
- **Still open:** the trigger-eval (`skills/pod-curator/evals/trigger-eval.json`) is now *valid
  to run* via the corrected mechanism (install under `.claude/skills/`, `claude -p`, detect
  Skill tool_use + the subagent trajectory). Not yet re-run. Also: the skill-creator harness
  bug (uses `.claude/commands/`) is worth reporting upstream; and its `run_loop` auto-improver
  crashes on opus-4-7 (`thinking.type.enabled` unsupported — needs `thinking.type.adaptive`).

### Concrete bugs/gaps surfaced by the pod-curator eval — CLOSED (2026-05-24)

All four are resolved (see commit history):

- ~~**`pod_audit.py` cross-check gaps**~~ — FIXED (`cogitarelink-solid` `4b434b9`). The walker now HEAD-checks `prof:hasResource` targets (WARN on non-resolving) and verifies `prof:hasRole` targets under the wikirole namespace are `skos:inScheme` the scheme (WARN on dangling roles). Bundle re-synced.
- ~~**Dangling `wikirole:search-affordance`**~~ — already fixed by the substrate sweep (`ec9921f`); `:search-affordance` + `:query-affordance` defined in `wikirole.ttl`, confirmed deployed (3 hits in `/vault/ontology/wikirole`).
- ~~**`solid-pod invoke` broken for ALL affordances**~~ — FIXED (`solid-agent-skills` `273b29a`). Dropped the `:3000` from `WIKI_NS` (port-less per D84) and repointed default `.meta`-source discovery `wiki/pages/` → `wiki/concepts/` (D98). Verified live: `hub-view` extracts construct, `contact-find-by-name` extracts select (both previously errored).
- ~~**Stale D77 catalog `dc:description`**~~ — already realigned by the sweep; the deployed storage description shows current `prof:hasResource` (page/concept/person/howto/working) and `rdfs:seeAlso` (8-shape containers), no stale source/procedure pointers.

## Pre-existing test_phase5j_close drift (surfaced 2026-05-23, NOT this sprint)

5 failures in `tests/test_phase5j_close.py`, all older count-drift (themselves stale-test instances): `test_wikirole_scheme_has_five_role_concepts` (wikirole now has 9 `prof:ResourceRole`, test expects 5 — Memory Structuring Sprint expanded it); `test_overlay_helpers_extract_role_scheme_and_profiles` + `test_manifest_declares_role_scheme_and_six_profiles` (manifest declares 10 profiles, tests expect 6); `test_wiki_vocab_declares_conformsTo_rdfs` (`wiki.ttl` missing `dct:conformsTo rdfs`). These predate this sprint and are out of its scope; fix by realigning the test expectations to current counts (a small realignment task in the same spirit as the D77→D98 cleanup). Also: `scripts/backfill_conformsTo.py` still references `/vault/wiki/pages/` + `/sources/` (one-off utility, low priority).

**Architecture** (per D104): the Pod's self-description IS wiki-memory L3 content. SHACL shapes provide guardrails; an agentic curator provides construction. They feed each other through a violation-report → reasoning → patched-substrate loop. **One unified toolkit** (audit + curator + review) works on both content-side (vault pages) and substrate-side (descriptors). The Phase B2 lint skill collapses into the substrate-curator; build once.

**Estimated**: ~3-4 hours focused next-session work.

### Component 1 — Substrate-resource SHACL shapes

Start with two exemplars:

**`shapes/substrate/storage-description.shacl.ttl`** (StorageDescriptionShape):

- Targets: `wiki:L3StorageDescription` (mint this class if not present) or `pim:Storage` via filter
- Required predicates: `wiki:affordanceCatalog`, `wiki:typeIndex`, `wiki:contextDocument`, `wiki:shapeCatalog`, `wiki:profileDocument` (cardinality 1 each); `dct:conformsTo` (≥1)
- `rdfs:seeAlso` constraint: targets must resolve. Either custom pyshacl extension (HTTP HEAD per target) OR post-validation cross-check in the walker
- `sh:agentInstruction` required (cardinality 1, non-empty, ≥100 chars)
- All `void:vocabulary` IRIs must be dereferenceable (cross-check)

**`shapes/substrate/affordance-descriptor.shacl.ttl`** (AffordanceDescriptorShape):

- Targets: `wiki:SearchAffordance`, `wiki:DerivedClassAffordance`, etc., via `sh:targetClass`. Or use `prof:ResourceDescriptor` as a parent and rely on `rdfs:subClassOf` inference
- Required predicates: `rdfs:label` (xsd:string, cardinality 1, min length 3); `rdfs:comment` (cardinality 1, min length 20); `sh:agentInstruction` (cardinality 1, min length 100); `prof:hasRole` (cardinality 1, must be in wikirole concept scheme); `wiki:dispatchPattern` (cardinality 1, regex `^\?ext=[a-z-]+$`); `wiki:targetContainer` (IRI); `dct:conformsTo` (≥1)
- `prof:hasRole` membership: cross-check against `/vault/ontology/wikirole`

Defer (write when Phase B+ surfaces need):

- `CapabilityDescriptorShape` (similar structure; targets `cap:Capability` subclasses)
- `AffordanceCatalogEntryShape` (per-LDP-entry label/comment requirements)
- `VocabularyDeclarationShape` (per `void:vocabulary` IRI)
- `JSONLDContextShape` (the `/meta/context.jsonld`)
- `TypeIndexShape` (the `/settings/publicTypeIndex`)

### Component 2 — `pod-audit` walker

`scripts/pod_audit.py`. Python + pyshacl + httpx. CLI usage:

```bash
~/uvws/.venv/bin/python scripts/pod_audit.py [POD_URL] [--shapes-dir shapes/substrate/] [--out-format json|markdown]
```

Behavior:

1. GET `<POD>/vault/.well-known/solid` (Accept: text/turtle)
2. Parse as RDF graph; locate the `pim:Storage` subject
3. Validate against `StorageDescriptionShape` via pyshacl
4. Cross-check: HEAD each declared catalog IRI (affordance/capability/context/type-index/shape); report 4xx/5xx
5. HEAD each `rdfs:seeAlso` target; report 404s as ERROR
6. GET affordance catalog; for each `ldp:contains` entry:
   - GET the entry
   - Validate against `AffordanceDescriptorShape`
   - Cross-check: dispatch pattern matches a CSS extension handler (parse `css/config/*.json` to confirm)
7. Emit structured findings (severity: ERROR / WARN / INFO; location: IRI; constraint: shape predicate or cross-check name; remediation: short hint)

Output: JSON (machine-consumable, for the curator agent) + Markdown (human-readable). Non-zero exit on any ERROR.

Hooks:

- `Makefile`: `make audit` target invokes pod_audit.py against the running Pod
- `make reset` chains `make audit` after `pod-setup`; ERROR findings fail the reset
- CI (GitHub Actions or equivalent) runs `make reset` + `make audit` on every PR

### Component 3 — `pod-curator` skill (proof-of-concept)

Location: `solid-agent-skills/skills/pod-curator/SKILL.md`. Bootstrapper-form per D103 (~25-40 lines):

- **When to use**: after `pod-audit` produces ≥1 ERROR or WARN; or in response to a `mem:*` substrate event
- **Tool**: `solid-pod` CLI for substrate edits via N3 Patch; `pod-audit` for re-validation
- **Pointer**: the substrate's SHACL shapes at `<pod>/meta/shapes/substrate/` are the canonical contract; the audit report (JSON) is the work queue
- **Two-stage commit (D73)**: all curator proposals go to `/vault/working/curator-proposals/<timestamp>/`, NOT directly to the affected resource. Crystallize step requires human or higher-trust agent review
- **Per-violation playbook**: 
  - "Missing required predicate" + reconstructible from context → auto-propose
  - "Stale reference (rdfs:seeAlso 404)" → propose update (read overlay manifests for new path) or removal
  - "Missing intent-bearing prose" → compose by reading descriptor purpose + sibling examples
  - Anything else → flag for review with diagnostic context

Skill body refers to a long-form playbook at `solid-agent-skills/skills/pod-curator/playbook.md` (similar to how vault skills have references/ subdirs).

### Component 4 — Immediate sweep (post-audit)

After Components 1-3 land, run `pod-audit` against the live Pod and fix the highest-priority findings:

- **Fix stale `rdfs:seeAlso`**: storage description currently lists `<../wiki/pages/>, <../wiki/sources/>, <../wiki/people/>, <../wiki/procedures/>, <../wiki/working/>`. After D98 8-shape, only `people/`, `procedures/`, `working/` exist; `pages/` → `concepts/`; `sources/` merged into `concepts/`. **Fix path**: either remove `rdfs:seeAlso` entirely (Type Index already lists containers — preferred), or update to the 8-shape list (`concepts/, people/, places/, organizations/, events/, procedures/, working/`).
- **Add labels + comments to affordance catalog entries**: each `.ttl` file in `/vault/meta/affordances/` needs `.meta` predicates `rdfs:label` + `rdfs:comment`. Patch via N3 Patch to each entry's `.meta`. Curator agent can generate from descriptor content; first pass can be hand-curated.
- **Add entry-point `sh:agentInstruction` to storage description**: compose prose. Suggested seed: *"Agents arriving at this Pod should first dereference `wiki:affordanceCatalog` to enumerate capabilities. Each capability lives at the named affordance descriptor; the descriptor's `sh:agentInstruction` is the canonical wire form. For taxonomic navigation (class → container routing), see `wiki:typeIndex`. For prefix → IRI resolution, see `wiki:contextDocument`. For SHACL shapes governing content, see `wiki:shapeCatalog`. The wiki-memory L3 profile this Pod conforms to is at `wiki:profileDocument`."*
- **Document OSLC parameter compliance map**: for each affordance accepting OSLC parameters (currently just `wiki-search-grep.ttl`), declare `wiki:supportedParameters` (or similar predicate; design during this build) listing supported + 501-returning parameters. Generate from CSS handler code introspection.

### Component 5 — Re-run Phase A pilot iter-3

After Components 1-4 land, run iter-3 with **per-condition assertions**:

- **With-skill** assertions: tests skill-usage efficiency. "Agent invoked `solid-pod wiki-search` without burning tool calls on bootstrap"; "agent did NOT redundantly fetch the affordance catalog (skill provided enough info)"; "outcome correct."
- **Without-skill** assertions: tests cold-discovery. Same as iter-1/iter-2 (followed storage description → catalog → descriptor → invocation; used OSLC quoting; outcome correct).
- **Both**: outcome correctness (count + URLs).

Compare iter-3 against iter-1 + iter-2 via `generate_review.py --previous-workspace iteration-2`. The substrate sweep should ALSO improve without-skill efficiency (no 404s on stale `rdfs:seeAlso`, better narrowable catalog labels).

### Component 6 (optional, time-permitting) — Skill audit pass

If Components 1-5 finish with time to spare, audit the other skills in `solid-agent-skills/skills/` for D103 conformance:

- `pod-discover/SKILL.md` (most relevant — cold-start orientation)
- `solid-addressbook/SKILL.md`, `solid-wiki-memory-l3/SKILL.md`, `solid-owner-identity/SKILL.md`
- Action skills (crystallize, demote, archive, supersede, merge, link)
- Inbox skills (inbox-list, inbox-read, inbox-subscribe)

For each: is the skill ≤25 lines? Does it point at the canonical substrate descriptor? Does it duplicate substrate content? Refactor as needed.

### Dependencies + risks

- **pyshacl HTTP-resolve constraint**: pyshacl doesn't natively dereference IRIs as part of validation. Either subclass the validator OR post-process with a separate walker that does the cross-checks. Latter is simpler.
- **wikirole concept scheme**: shape constraint `prof:hasRole` membership requires the wikirole scheme at `/vault/ontology/wikirole` to be loadable + complete. Verify before relying on the constraint.
- **Two-stage commit for substrate**: the `/vault/working/curator-proposals/` container doesn't exist yet. Create it during Component 3 work, with permissive shape per D73 working/ semantics.
- **N3 Patch on `.meta`**: confirmed working from prior sprints (e.g., AddressBook overlay's `installsResourceMetaPatch`). Use the same pattern.

### Subsumes earlier task #10 (Pod-side lint/audit/curator skill)

Task #10 from the Rung 1.5 redesign session (filed as a Phase B2 prerequisite) collapses into this unified build. The pod-curator skill body (Component 3) IS the Phase B2 lint skill — same shape inputs, same reasoning loop, different work-queue source (audit report vs runtime `mem:*` event). Build once, apply to both.

---

## Pod-hosted memory-structure UI for transparency (2026-05-22)

The Pod runs on `localhost` (127.0.0.1 via `/etc/hosts`), so externally-hosted Solid apps (Penny, SolidOS at solidcommunity.net) only browse it via the user's own browser. Workable for read-only inspection, but not robust for end-users who need to see the substrate's memory structure (wikilinks, shapes, events, affordances, type-index, Memento history) at a glance.

**The actual need**: a substrate-aware UI served BY the Pod, same-origin, no CORS / OIDC redirect dance. Not just a generic LDP file browser — a transparency surface for:

- Dual-layer linking (wikilinks in body, projected predicates in `.meta`) rendered together
- Shape conformance per resource (which shape governs, current SHACL state)
- `/vault/wiki/.events/` substrate-signal stream (live via Solid Notifications subscription)
- Affordance catalog at `/vault/meta/affordances/` (what agents can do here)
- Type Index browsing (class → container routing)
- Memento history (time-travel queries with TimeMap rendering)

**Architectural sketch** (not yet a design):

- New CSS extension `memory-browser` serving static assets + a JSON API at `/vault/_ui/`
- Probably React/Preact + solid-client + N3.js (same stack as Penny)
- Or simpler: vanilla HTML + the existing JSON-LD context (`/vault/meta/context.jsonld`) for self-description
- Same-origin → no CORS, no OIDC popup, works with any browser without `mkcert -install`

**Why this matters beyond UX**: Rung 1.5 eval will need to observe agent behavior. A transparency surface that shows "what the agent saw, what it changed, what the substrate signalled" is useful for eval analysis even if not used by end-users.

**Trigger to start this**: post-Rung-1.5, OR when an end-user / demo needs human-readable Pod browsing as a primary affordance. Until then, the CLI (`solid-pod` in solid-agent-skills) and curl-based debugging cover developer needs.

Cross-refs: D75 (we explicitly traded the default container-browser HTML for clean markdown rendering — this would be the deliberate re-introduction of UI, scoped to substrate concerns).

## resource.shacl.ttl FAIR metadata retrofit (post-D97, 2026-05-19)

The D38 LDP RDFS/NRSource guard shape at `overlays/wiki-memory/shapes/resource.shacl.ttl` predates D97 and lacks the FAIR metadata properties (`rdfs:label`, `rdfs:comment`, `rdfs:isDefinedBy`, `dct:conformsTo`, `dct:created`, `dct:creator`) the rest of the L3 catalog now carries.

Exempted from `test_fair_metadata_present.py` (test fix in commit TBD) since the spec preserves it as-is per Phase B migration plan ("Preserved as-is. D38 invariant unchanged; not part of L3 content model"). Worth retrofitting as a future cleanup pass to make the L3 catalog uniformly FAIR-conformant.

Effort: ~10 minutes (just add the 6 properties).

## Shape catalog reconciliation (2026-05-18) — pyshacl fixture rebaseline

The shape-catalog reconciliation commit deleted the legacy `shapes/wiki-memory-l3/`
directory and re-pointed `tests/test_wiki_memory_l3_shapes.py` at the canonical
`overlays/wiki-memory/shapes/`. The four `test_bundle_fixture_validates` cases are
now `xfail` (strict) because the canonical shapes have tighter constraints than
the Rung-1.4-vintage fixtures.

Known fixture violations against canonical shapes:

- `karpathy-andrej.md.meta` — canonical `PersonShape` requires `foaf:name`
  (minCount 1); fixture has only `dct:title` + `foaf:nick`.
- Other bundle fixtures share the same combined-graph failure mode; need to
  re-validate each against canonical shapes individually to enumerate the
  delta.

This is part of **Shape Completion sprint** scope, not a standalone fix:
the sprint will retighten/finalize the shapes (page, source, person,
procedure, working) and add a Concept-specific shape, then rebaseline
fixtures to match. Once fixtures pass, remove the `@pytest.mark.xfail`
decorator and `strict=True` will catch any subsequent regression.

## ~~Phase C.10 — MemTrigger v1 wiring (Memory Structuring Sprint, 2026-05-18)~~

**Closed 2026-05-21** by MemTrigger detector wiring sprint (D101).
See `docs/superpowers/specs/2026-05-20-mem-trigger-detector-wiring-design.md`
and `docs/superpowers/plans/2026-05-20-mem-trigger-detector-wiring.md`.

All four detectors wired:
- BoundExceeded — real checkBound implementation via fetch() (D92 lock pattern)
- UnprocessableWrite — IUnprocessableWriteHook injected into ShaclValidator
- ContradictionDetected — IPostProjectionHook invoked by MarkdownProjectionListener
- ReflectionDue — setInterval timer in handle(); integration test deferred

Three of four mem_events integration tests passing on live Pod;
test_reflection_due_emits_event remains pytest.skip pending test-mode
config activation (artifact exists at `css/config/mem-trigger-test.json`
+ `css/config/solid-config-test.json`; activation pattern documented in
mem-trigger README).

### K1 consolidation note

`mem-trigger.json` now holds the WorkerParallelInitializer Override
listing all three listeners. Components.js rejected the configuration
when two files (markdown-projection.json + mem-trigger.json) both declared
Overrides on the same instance — "Found multiple Overrides targeting" is
a hard preprocessing error, not resolved by import order. Future memory
substrate listeners must be added to mem-trigger.json's handlers list.

## Phase 7a wiki-search — shipped (2026-05-18)

D87 ratified. Wiki-search CSS extension + Link MetadataWriter + capability
+ affordance descriptors + consumer CLI + Claude skill all shipped. Pod
returns OSLC Query 3.0 responses with WAC-filtered, AND-filtered,
score-sorted, paginated matches over recursive `/vault/wiki/` walks.
p95 latency: 26.7ms (D87 ceiling 500ms — 18.7× headroom).

Key commits (cogitarelink-solid):
- Implementation plan: `b064a79`
- Scaffold + interfaces: `d41f40c`, `5332c1a`
- Pure-Node engine + parsers + helpers: `1eafdab`, `7c1c054`, `821cf5b`,
  `0bd4bc3`, `fbb4e44`, `57abce4`
- Walker (recursive BFS + WAC subtree-omission): `c694407`, `5e9c6c1`
- Handler + Components.js + Dockerfile: `6cbccb1`
- Link MetadataWriter (Tier-1 discovery): `a014967`
- Capability + affordance descriptors: `7c68fca`
- E2E integration tests: `eb37bb7`
- Perf smoke (p95 26.7ms): `4905731`

Sibling repo (solid-agent-skills):
- Consumer CLI + Claude skill: `b17be6f`

### Architectural deviations from plan

- [x] ~~**D91 — Walker uses HTTP self-requests, not in-process ResourceStore.**~~
  **Provisional D91 retracted on 2026-05-18 spike.** The recorded narrative
  bundled two independent fixes ("HTTP-self-request rewrite" + `isReadAllowed`
  permission-shape fix) and credited the wrong one for resolving the original
  test failures. The actual root cause is re-entrant lock on the *request
  target itself* — not a general ResourceStore problem. Header forwarding
  to fix the anonymous-content leak is **architecturally impossible** under
  Solid-OIDC (DPoP proofs are bound to htm/htu/jti and one-shot; the server
  cannot mint replacement proofs without the client's private key).
  Replaced by Path 1a (DataAccessor for seed enumeration, ResourceStore for
  descendants). See `docs/plans/2026-05-18-wiki-search-walker-redesign.md`
  for the full reproduced failure mode, CSS architecture probes, multi-agent
  threat model, and revised recommendation. D92 ratification follows
  implementation sprint.

- [x] ~~**Wiki-search walker Path 1a redesign sprint.**~~ **Shipped 2026-05-18,
  commit `2f2f28b`.** Ratified as **D92** in
  `.claude/skills/decision-lookup/decisions.md`; synced to vault as D88
  (`SOLID-Pod-Decisions.md`). Implementation found two crash modes beyond
  the originally diagnosed re-entrant lock — both rooted in CSS's
  `N3StreamWriter` / `Guarded<Readable>` stream wrapping rather than in
  locking — so the final architecture uses `DataAccessor` for **all** Pod
  data access (`getChildren()` for container enumeration, `getMetadata()`
  for content-type checks, `getData()` for document bodies). No
  `ResourceStore.getRepresentation()` calls in the walker. p95 latency
  improved 3.5× (26.7ms → 7.6ms). 77/77 unit + 13/13 non-skipped
  integration tests pass. Findings recorded in
  `docs/plans/2026-05-18-wiki-search-walker-redesign.md` "Implementation
  findings" section.

- [ ] **WAC scenario integration tests un-stubbed.** Six tests in
  `tests/integration/test_wiki_search_e2e.py::TestWacScenarios` remain
  stubbed pending an authenticated-client fixture shared with
  `test_addressbook_e2e.py`. **Deferred under the behavior-before-security
  sequencing principle**: agent credential storage (DPoP key management,
  agent-vs-human WebID, VC delegation, refresh semantics) is its own
  design exercise downstream of Rung 1.5 (or equivalent) eval evidence
  about how agents actually traverse the substrate. Don't lock in a
  fixture shape until the credential model is designed; don't design the
  credential model until behavior is observed. See project MEMORY
  `behavior_before_security.md`.

- [ ] **VC credential extension (future research-track).** CSS v8 has
  the `@solidlab/policy-engine` VC matcher (`evaluateVc`) and ACP support,
  but **no `VerifiableCredentialExtractor`** ships out of the box.
  Roadmap in `docs/plans/2026-05-18-vc-credential-roadmap.md` covers:
  CSS v8 credential machinery state, the Inrupt UMA + Access Grants flow
  (gConsent), the SolidLab UMA AS landscape (real, MIT-licensed, but no
  W3C VC claim_token support yet), TypeScript VC library survey
  (`@digitalbazaar/vc` recommended core), and three routes — B rejected
  (build from scratch), C as v1 prototype (custom header + inline
  verifier, ~150 LOC), A' as v2 destination (SolidLab UMA + custom
  `VcVerifier` + `VcAuthorizer`, ~400 LOC contribution upstream).
  Not scoped to a sprint. Implementation triggers documented in the
  roadmap; typically Rung 1.5 eval evidence or a concrete use case
  requiring VC-gated access.

### Deferred to Phase 7b/c/d (out of scope for 7a)

- [ ] **Engine swap to BM25 or ripgrep** (Phase 7b). Decision criterion: if
  Rung 1.5 eval shows literal-witness recall < 90% on representative tasks,
  or p95 latency regresses past 500ms.
- [ ] **`oslc.where` structured filter** (RQ-Search-2). Either post-filter via
  Comunica over `.meta`, or push the structured filter into a pre-scan step.
  Defer until eval shows a real workload.
- [ ] **Hybrid RRF orchestrator** (Phase 7c). ~200 LOC; combines literal + BM25.
- [ ] **WebID-partitioned in-pod index** (Phase 7d, ESPRESSO pattern).
- [ ] **`_profile=alt` introspection** for the search response (low-priority).

### Deferred from Phase 7a implementation

- [ ] **WAC scenario integration tests** — see the dedicated entry above
  under "Architectural deviations from plan". Deferred under
  behavior-before-security; not blocked by Path 1a (Path 1a is shipped),
  blocked by the agent credential-model design exercise.
- [ ] **Score formula tuning** (RQ-Search-1). v1 baseline is density + log
  dampening; tune against Rung 1.5 eval evidence.
- [ ] **Whether to embed `.meta` triples in search responses** (RQ-Search-4).
  Phase 1 omits; revisit if Rung 1.5 shows agents repeatedly fetching `.meta`
  after a search hit.
- [ ] **Snapshot tokens for transactional pagination consistency**. Phase 1
  documents "stable-within-instant only"; revisit only if Rung 1.5 shows
  pagination drift hurts.

## Phase 5j (2026-05-16) — URI conformance close-out

### Deferred from D86 implementation

- [x] **PROF descriptor installation via overlay machinery.** Closed by Phase 5j close-out (2026-05-16) — see new section below for follow-ups.
  ~~5 descriptors written at `overlays/wiki-memory/profiles/{page,concept,source,person,procedure,working}.ttl` but the overlay manifest schema doesn't yet have `installsProfile` (parallel to `installsShape`, `installsAffordance`). To install:~~
  ~~1. Add `overlay:installsProfile` predicate to `css/config/pod-templates/base/ontology/overlay.ttl`~~
  ~~2. Parse it in `scripts/overlay/common.py` (mirror `shape_urls`/`affordance_urls`)~~
  ~~3. Add upload loop in `scripts/overlay/apply.py` step 3.5 (after affordances)~~
  ~~4. Update `overlays/wiki-memory/manifest.ttl` with the 5 profile URLs~~
  ~~\~15 LOC change. Files are committed; just unwired.~~

- [x] **`Link: rel="profile"` MetadataWriter CSS extension** (D86). Closed by Phase 5j close-out (2026-05-16) — see new section below for follow-ups.
  ~~Mirrors the `MementoLinkMetadataWriter` pattern at `css/extensions/memento/src/MementoLinkMetadataWriter.ts` (~30 LOC). Need:~~
  ~~1. New extension at `css/extensions/profile-link/` with package.json (lsd:* fields, `@cogitarelink/profile-link`), tsconfig.json, src/, dist/~~
  ~~2. `ProfileLinkMetadataWriter.ts`: path-based dispatch (`/vault/wiki/pages/*` → `wiki:PageProfile`, etc.) — use `addHeader` so Link composes with existing MementoLink + describedby headers~~
  ~~3. Components.js config that inserts the writer into the MetadataWriter ParallelHandler after `MetadataWriter_LinkRel`~~
  ~~4. Add `@cogitarelink/profile-link` to solid-config.json @context array and imports~~
  ~~5. Update Dockerfile with the symlink trick (per `css-extension` skill)~~
  ~~6. Tests: assert Link header presence on every resource GET~~
  ~~Design fully specified in `.claude/skills/solid-uri-conformance/SKILL.md` + `templates.md` Template E.~~

- [x] **`_profile=alt` introspection view.** — DONE (D113, branch `view-layer`). `ViewHttpHandler` intercepts `?_profile=alt` and returns the profile listing (all negotiable profiles for the resource). `Link: rel="profile"` emitted for all 6 class profiles + 4 view profiles (doc/fused/graph/people tokens).

- [ ] **CSS storage description PATCH gate.**
  Surfaced during overlay apply: CSS returns `405 MethodNotAllowedHttpError "Only GET requests can target the storage description."` Overlay's storage-patch.ttl couldn't be applied at runtime — the wiki:* L3 pointers in `.well-known/solid` come exclusively from `css/config/void-description.json` (static StaticStorageDescriber). Decision: either (a) keep all storage description triples in static config (current state, works); (b) override CSS to allow PATCH on storage description; (c) move L3 pointers entirely into overlay-patched `/vault/.meta`. Currently working as-is; revisit if RQ-Substrate-3 successor surfaces.

### Closed by Phase 5j

- [x] **RQ-Substrate-3** — namespace mismatch resolved by D84 commitments (https, port-less, hash-namespace, extension-less). All 55+ source files migrated; volume wiped; Pod regenerated with new IRIs. Verified end-to-end.
- [x] **PROF descriptor installation via overlay machinery** — done via `overlay:installsProfile` + `overlay:installsRoleScheme` predicates in manifest + apply.py upload step. Wikirole SKOS scheme at `/vault/ontology/wikirole`.
- [x] **`Link: rel="profile"` MetadataWriter CSS extension** — done via `css/extensions/profile-link/` + Components.js wiring consolidated into memento.json. Emits one `Link: rel="profile"` per `dct:conformsTo` value in `.meta`. 32 integration tests green.

## Phase 5j close-out (2026-05-16) — Deferred follow-ups

### Architectural — schedule per Rung 1.5 evidence

- [ ] **Framing-2 refactor: drop wiki:*Affordance classes for pure PROF typing.**
  Affordances currently carry BOTH `a wiki:WriteAffordance` AND
  `a prof:ResourceDescriptor; prof:hasRole wikirole:*` (Framing 1.5
  additive, shipped in Phase 5j close-out). Pure-PROF refactor would
  retire the `wiki:*Affordance` classes from `wiki.ttl`, update any
  SHACL shapes or queries that target those classes, and possibly
  enrich the wikirole vocabulary further if eval shows agents reading
  those roles. Decision criterion: Rung 1.5 evidence of whether agents
  branch on `prof:hasRole` vs `rdf:type wiki:*Affordance`.

### Code findings to clean up

- [ ] **css/config/profile-link.json may be deletable.** Task 16 consolidated
  the profile-link Override into memento.json (Components.js forbids
  multiple Override declarations against the same component instance).
  If profile-link.json no longer carries any non-redundant config, delete
  it and remove the import from solid-config.json. Verify CSS still starts
  cleanly after deletion.

- [ ] **Apply.py body-triple vs .meta divergence.** Plan Tasks 6/7 added
  `dct:conformsTo` to RDF resource bodies for self-documentation, but
  CSS only reads `.meta` sidecar triples into `RepresentationMetadata`.
  Apply.py compensates by PATCHing `.meta` on every apply (Task 17 fix,
  idempotent). Long-term cleaner: either (a) drop the body declarations
  since they're redundant for header emission, or (b) build a
  MetadataReader that surfaces body `dct:conformsTo` into
  `RepresentationMetadata` for RDF resources. Defer decision until more
  body-vs-.meta patterns accumulate.

- [ ] **DCT vocabulary helper for the codebase.** CSS's `DC` export is a
  3-term subset (description/modified/title) and does not include
  conformsTo, references, hasPart, etc. `ProfileLinkMetadataWriter`
  inlined the named-node URI directly. If more DCT-using extensions are
  added, consider publishing a shared `vocab/dct.ts` helper or a
  project-wide constant module.

### Confirmation of close-out

- [x] **PROF descriptor installation via overlay machinery** — done via
  `overlay:installsProfile` + apply.py upload step.
- [x] **`Link: rel="profile"` MetadataWriter CSS extension** — done via
  `css/extensions/profile-link/` + Components.js wiring in memento.json.

## AddressBook substrate sprint (2026-05-17)

D87 + D88 ratified. Substrate shipped + agent-discoverable. Cross-batch
adversarial review surfaced these items. None are blockers; trim or address
as need arises.

### Future trims (do when justified, not now)

- [ ] **9 capability descriptors with no consumers** (`/vault/meta/capabilities/`):
  5 AddressBook-provided (vcard-individual-substrate, vcard-organization-substrate,
  external-anchor-tracking, contact-discovery, tmpl-vocabulary) + 1 wiki-memory
  (wiki-page-as-unit). All are speculative — built for hypothetical future
  overlays that don't exist yet. Cost-to-carry is ~50 lines of Turtle. Trim
  when a third overlay materializes and we can see which caps actually get
  consumed vs which were YAGNI violations. Cross-batch review identified;
  see `0f1295f..be26866` for sprint commits.

### Coverage gaps (next plan or backlog)

- [ ] **`verify.py` doesn't check bootstrap content, TypeIndex registrations,
  or container `.meta` patches landed correctly.** After `apply_overlay()` runs,
  verify only checks artifacts (containers, shapes, affordances, vocabularies,
  capabilities, templates). Missing: people.ttl/groups.ttl/index.ttl exist,
  TypeIndex contains the registration, container .meta has `ldp:constrainedBy`.
  Add when the next overlay's verify needs them.

- [ ] **`find-by-orcid` affordance not exercised end-to-end** via
  `solid-pod invoke`. E2E test falls back to direct GET+parse because the
  CLI isn't on PATH in the test runner. Add a proper affordance-invocation
  integration test when the AddressBook skill plan lands (the skill needs to
  exercise affordances anyway, so this work folds into that plan).

- [ ] **`org-find-by-ror` SPARQL test is too weak** — checks `owl:sameAs`
  in query text but doesn't verify `vcard:Organization` type-filtering.
  Could quietly accept a Person ORCID match. Two-line test strengthening.

### Cross-batch design lessons (captured for future plans)

- [ ] **Template-to-SHACL agreement tests are non-optional**: the
  AddressBook sprint's `vcard:inAddressBook` IRI bug — templates said
  `</vault/contacts/index.ttl#this>` but SHACL `sh:hasValue` resolved to
  `<https://pod.vardeman.me/contacts/index.ttl#this>` (server-root, not
  vault-root, due to CSS relative-IRI resolution quirk) — would have
  silently broken every agent following the template. Caught by the
  cross-batch review and the new parametric test in
  `tests/test_addressbook_templates.py::test_template_substituted_body_conforms_to_shape`.
  Any overlay that adds templates MUST add the equivalent agreement test.
  Consider hoisting this test pattern to a reusable test helper if a second
  overlay ships templates.

### AddressBook-specific deferred design choices

- [ ] **Person flat-file layout** (`/vault/contacts/Person/<uuid>.ttl` instead
  of design's `/vault/contacts/Person/<uuid>/index.ttl#this`): CSS
  shape-validator rejects sub-container creation within a constrained
  container, blocking the per-Person container approach intended for
  attachment co-location. Two options when attachment use-cases surface:
  (a) add a separate `Photo/` (or per-attachment-type) container with its
  own SHACL constraint; (b) drop `ldp:constrainedBy` on `Person/` and
  validate via a write-handler hook on individual cards instead.

- [ ] **SHACL relative-IRI resolution quirk on Pod**: shape uses
  `sh:hasValue </contacts/index.ttl#this>` which CSS resolves relative to
  server root, not vault root. Sprint resolved this by switching both
  shape and template to absolute IRIs (`<https://pod.vardeman.me/vault/...>`).
  Worth grepping all SHACL shapes in `overlays/*/shapes/` for relative IRI
  patterns and converting to absolute where the resolution would surprise
  agents. Defer until a second overlay shape uses `sh:hasValue` with a
  relative IRI.

- [ ] **Pod owner contact card** — no `/vault/profile/card#me`-linked
  AddressBook entry exists. Addressed by the next plan's `solid-pod
  setup-owner` CLI flow (would mint UUID, PUT card, add `owl:sameAs
  </vault/profile/card#me>`, PATCH people.ttl). Defer to that plan.

### Wiki URI scheme rethink (informed by Swartz)

- [ ] **Revisit wiki entity URIs in light of Aaron Swartz, *A Programmable
  Web: An Unfinished Work* (Synthesis Lectures on the Semantic Web, 2013,
  ed. Hendler).** The AddressBook substrate adopted opaque `UUIDv4` slugs
  for Person/Organization (class-by-class exception to "mnemonic over
  opaque for everything" per `solid-uri-conformance/references/deltas.md`).
  Swartz's positions on URI design (hash-vs-slash pragmatism, Wikipedia
  URLs as a good model, avoiding technical-leakage in URLs, JSON-LD over
  RDF/XML) deserve a careful read before extending the per-class-opacity
  pattern to other wiki entity classes. Specifically: which wiki:Resource
  subclasses have collision/rename risk substantively higher than the
  current name-slug assumption (where wikilink affordance is the design
  centerpiece)? Most likely candidates: none today; the wiki was designed
  for name-slug stability and the Pod-owner controls naming. But the
  question of when to mint opaque slugs for instances (vs vocabularies,
  covered by D84) is open.

  Action when picked up:
  1. Re-fetch Swartz's book (likely CC-licensed; check Hendler's site or
     archive.org) and read Chapter 4-5 specifically on URI design
  2. Synthesize the project's deltas (URI conformance skill), Swartz's
     positions, and the Cool URIs guidance into a single design-doc-level
     URI design principles reference
  3. Per-entity-class opacity audit (where is `UUIDv4` justified beyond
     Person/Org? Where does mnemonic-by-default still hold?)

  Surfaced during the AddressBook design conversation (2026-05-16); flagged
  again at sprint close-out (2026-05-17).

### Confirmation of close-out

- [x] AddressBook substrate shipped — see MEMORY.md ship entry
- [x] D87 + D88 ratified — see `decisions.md`
- [x] 38 commits pushed to origin/main (33dd1d9..be26866)
- [x] Template-to-SHACL agreement test pattern added (commit `04e26ef`)
- [x] Pre-push cleanups (consolidated TypeIndex mechanism, dead code, stale comments)

## Rung 1.4 close (2026-05-15)

### Critical — deferred to Rung 1.5 eval

- [ ] **RQ-Listener-1: Model A preservation across CSS .meta overwrite**.
  `test_agent_enrichment_survives_body_rewrite` xfailed with diagnosis. Mitigation paths:
  - Paths (A) Memento-history read, (B) `.meta.agent` sidecar, (C) PassthroughStore wrap analyzed in `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md`.
  - Path (D) RDF-star triple-level provenance + reification shim explored in `docs/plans/2026-05-15-rdf-star-provenance-exploration.md` — **candidate, not committed**. Avoids the `.meta.agent` sidecar entirely by partitioning substrate vs agent triples via `prov:wasGeneratedBy` annotations on quoted triples. Tooling probe: N3.js ready, CSS conneg ready with overrides, rdflib lacks RDF-star (hard blocker for Python clients) — ~50 LOC reification shim closes that gap by serving classical `rdf:Statement` reification to non-star clients. Decision criteria documented; promotes to D82 only when Rung 1.5 eval evidence justifies.
  Decision criterion (general): if Rung 1.5 eval surfaces real agent-extension use cases (agents PATCHing `.meta` outside the governed set), pick between paths (B) and (D) based on whether per-triple provenance is load-bearing for RLM behavior. If eval shows agents never extend, reframe the xfail as documentation.

### Small — fix when needed

- [x] ~~**WIKI_NS central constant**.~~ **Closed by Phase 5j (D84)**: all `urn:example:wiki#` and port-baked refs migrated to `https://pod.vardeman.me/vault/ontology/wiki#`. If the Pod hostname ever changes, the substitution remains sed-replaceable — but the IRI is now Pod-namespace-authority style, not placeholder. The "central constant" idea no longer applies (predicate IRIs reflect deployment intent, not a future TBD mint).

- [ ] **`foaf:affiliation` frontmatter mapping**.
  PersonShape allows `foaf:affiliation`, `governedPredicates` includes it, but `frontmatterProjection.ts` has no `affiliation:` key. Agents can't set affiliation via body+frontmatter today. Two-line fix when an eval task needs affiliation traversal.

### Documented elsewhere (cross-references)

- **RQ-Pod-4** — Comunica `.meta` traversal gap, workaround documented at `docs/plans/2026-05-15-rq-pod-4-workaround-notes.md`. Decision point: Rung 1.5+ if explicit-source pattern becomes a bottleneck.
- **K2 (triple-hyphen slugs)** — `slug()` doesn't collapse consecutive hyphens. Accepted for v1 in `decisions-index.md`; refinement is post-spike.
- **K3 (`.author` → `dct:contributor`)** — class-hint dispatch can't differentiate concept-contributor from source-creator. Distinct `.creator` class hint is a Rung 1.5+ option.
- **Task 42 (context-driven listener dispatch)** — `wikilinkProjection.ts` uses hardcoded class-hint table instead of reading `/meta/context.jsonld` at runtime. Functionally equivalent; deferred to Rung 1.5 cleanup per D79.

## Owner-identity sprint (2026-05-17)

- **T4 PodOwnerPreferencesShape — sh:targetClass deviation from plan.** The plan specified `sh:targetNode </vault/settings/prefs.ttl#owner>`, but the shape uses `sh:targetClass prefs:PodOwnerPreferences` instead. Class-based targeting matches every other shape in the repo (compare `contact-card.shacl.ttl`) and is resilient to a future change in the prefs resource path. The test data and the prefs-init template (T6) both declare `a prefs:PodOwnerPreferences` on the subject, so the targeting catches the production case. No action needed — captured for the sprint reflection.

- **TLS dev-cert: solid-pod CLI should detect SELF_SIGNED_CERT_IN_CHAIN and either auto-resolve mkcert root CA or emit a clear remediation hint.** T30 cold-session surfaced an agent reaching for `NODE_TLS_REJECT_UNAUTHORIZED=0` (disables verification globally) instead of `NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem` (the D85 correct fix). The mkcert root CA exists at `$(mkcert -CAROOT)/rootCA.pem`, the Pod's cert is correctly signed by it — only documentation + UX of the failure mode were broken. Skill docs were updated to surface the right env var (`solid-agent-skills/skills/solid-{owner-identity,addressbook,wiki-memory-l3}/SKILL.md` Pre-flight section, commit `d430c24`). The deeper fix: `solid-agent-skills/src/lib/http.ts` should (option a) catch Node's `SELF_SIGNED_CERT_IN_CHAIN` error code and rewrite it as `"TLS verification failed against system trust store. If using a mkcert dev cert, run: export NODE_EXTRA_CA_CERTS=\"$(mkcert -CAROOT)/rootCA.pem\""`; or (option b) probe for `$(mkcert -CAROOT)/rootCA.pem` at startup and prepend it to `NODE_EXTRA_CA_CERTS` automatically when the user hasn't set it — zero-config dev ergonomics, no effect on prod since the file doesn't exist there. Picking up post-Rung-1.5.

- **`tmpl:targetResource` `rdfs:comment` over-constrains** (T6 code review). The vocab entry says *"Used for PATCH templates..."* but `prefs-init.ttl` proves PUT-on-fixed-IRI is equally valid. Broaden to: *"The specific resource a filled template is applied to, for templates that target a known IRI rather than minting a slug under a container. Works with both PUT (creating at a fixed path) and PATCH (modifying an existing resource)."* Lives in `overlays/addressbook/vocabulary/template.ttl`. Pick up next time the AddressBook vocab is touched; bumps `cap:tmpl-vocabulary` to v1.2.

- **`tmpl:Template` XOR invariant unenforced by SHACL** (T1 code review). The vocab `rdfs:comment` says exactly one of `tmpl:targetContainer` / `tmpl:targetResource` must be present, but this is documentation-only. Per-template tests in T6 (`assert not container` for prefs-init) and T7 (`assert not container` for webid-enrich) cover the immediate risk for this sprint's templates. A `TemplateShape` `sh:NodeShape` with `sh:xone` over the two predicates would enforce substrate-wide and surface in any future template's ValidationReport. Low-priority — current discipline is two assertions in test files.

## Path constraint primary-topic-only rdf:type extraction (post-Bug-E)

Bug E (2026-05-19) fixed a false positive where container `.meta`
PATCHes were rejected because `rdf:type` was extracted from ALL
subjects in the body. The current fix skips path constraint
checks entirely for `.meta` resources (Option 1).

The cleaner long-term fix is Option 2: restrict `rdf:type`
extraction to the primary-topic subject (the resource IRI or its
hash fragment). This would let the substrate enforce path
constraints on `.meta` content with precision, in case an L4 use
case demands it.

Effort: ~30 min in checkPathConstraint + new unit tests.

## Pre-existing test/build debt (surfaced during the D107 migration, 2026-05-28 — NOT migration-caused)

- **`test_wiki_memory_l3_discovery.py::test_wiki_containers_exist`** asserts the pre-D98 container names `pages`/`sources` (404 — D98 renamed `pages`→`concepts`, merged `sources`). Stale test; update to the D98 7-container set. Confirmed pre-existing (the rename predates this work; the test only surfaced because it's a live-Pod integration test rarely run green).
- **`test_synthesis_page.py::test_all_wiki_memory_shape_agent_instructions_reference_synthesis`** fails: `overlays/wiki-memory/shapes/howto.shacl.ttl`'s `sh:agentInstruction` does not reference the synthesis URL (`/vault/wiki/index.md`). Pre-existing coverage gap (howto shape untouched by D107). Either add the synthesis ref to the howto shape, or relax the test's "every shape" requirement.
- **`build:esm` is broken** in `css/extensions/markdown-projection`: `npm run build` = `build:esm && build:cjs`, and `build:esm` (default `tsconfig.json`, `moduleResolution: NodeNext`) cannot resolve `src-cjs/listener.ts`'s deep `@solid/community-server/dist/*` imports (TS2307) + an extension-less relative import (TS2835). The ESM output (`dist/`) is gitignored and **unused by CSS** (loader uses `dist-cjs` per `package.json` main/require/lsd:components). D107 Phase 3 worked around it by pointing the Dockerfile at `npm run build:cjs` (commit `90e2c9d`). Proper fix: either repair `build:esm` (add `.js` extensions + fix deep-import resolution) or drop the unused ESM build from the `build` script. Low priority (output unused), but `npm run build` failing locally is a footgun.

**D107 residual (optional, from final review 2026-05-28):** the substrate audit-shape *node identifiers* in `shapes/substrate/` are still `wiki:`-named (`wiki:StorageDescriptionShape`, `wiki:AffordanceDescriptorShape`, `wiki:SearchAffordanceShape`) though they're substrate-level shapes targeting `sub:`/`prof:` classes correctly. Renaming the shape IDs to `sub:` wasn't in D107 scope (they're internal identifiers, not governed predicates or served vocabulary) — slight residual of the same contamination class. Low-value rename-churn; do only if touching those files anyway. Also pending: refresh the upstream-skill delta docs that still name moved predicates (`solid-storage-description`, `solid-data-modelling`, `solid-affordance-descriptors`, `shacl-shapes` — they reference `wiki:typeIndex`/`wiki:shapeCatalog`/etc.).

## Pre-existing (earlier rungs)

- **RQ-Harness-1** — fabric namespace minting at `https://cogitarelink.org/ns/fabric#` — blocks all `fabric:*` predicates past prototype.
- **RQ-Eval-1/2/3** — task suite design, sub-agent config, GEPA convergence (Rung 1.5 work).
- **RQ-Memento-1/2**, **RQ-Federation-1** — see `decisions-index.md`.

## 🔭 RQ-View-2 eval residue (2026-06-07) — eval ANSWERED; substrate findings to action

Report `docs/plans/2026-06-07-rq-view-2-report.md`; harness + raw trajectories `~/dev/probes/rqview2/`.
Misread killed 2/2; write round-trip green 2/2; agents consume the token/representation layer
(fused body+meta view wins; SPARQL unused at 7-doc scale).

1. **Inverse `skos:narrower` is seed-only, not derived.** Confirmed 2× deterministically: a new
   concept's `{.broader}` projection does NOT add `narrower` to the target's `.meta`. Per the D109
   derive/floor/loop rule this is a DERIVE (mechanically inferable). The seeded
   `biology.md.meta` narrower edge (and the hand-written `[[Photosynthesis]]{.narrower}` in
   biology.md's body) are now stale/misleading. Fix either in the projection listener (derive
   inverse on write + on delete) or declare it a curation-loop detector (graph-global pair
   consistency) — decide in the read-path/view brainstorm.
2. **Seeded exemplars teach phantom affordances.** A D112 probe agent inferred "inverse maintained
   by substrate" from seeded data. Seed/exemplar content is a teaching channel — needs the same
   curation discipline as descriptors (candidate curation-loop detector: seed-implied behaviors
   vs declared affordances).
3. **PROF not delivered on wiki notes** — no `rel="profile"` Link header on `.md` responses
   (D86/D107 promoted PROF as the out-of-band hint; it isn't being emitted on content). Either
   wire the profile-link writer for wiki pages or drop Probe-C/PROF-on-content from the design.
   Note `rel="describedby"` IS present and went unused by every curl agent (0/4 runs).
4. **Probe-harness nit:** `setup/cleanup.sh` scripts (both rigs) die under `set -e` when a slug
   doesn't exist (`[ ... ] && del` returns 1) — pad with `|| true` before reuse.
