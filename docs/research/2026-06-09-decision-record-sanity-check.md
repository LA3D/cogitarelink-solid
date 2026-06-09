# Decision-Record Sanity Check Against the Behavioral Signal

**Status:** triage complete 2026-06-09. Input artifact for the read-path structure design
(the ▶ NEXT brainstorm). NOT a strip-back spec — dispositions here are recommendations;
each strip is its own spec per the RQ-Conneg-1 discipline ("do not pre-emptively rip out").
**Method:** every decision cluster in `decisions.md` (D1–D114, K1–K4, RQ-*) scored against
the cold-probe corpus. Verdicts cite probe outcomes, not design intent.

## 1. Evidence corpus

| Eval | Date | Report |
|---|---|---|
| Phase A pilot (cold discovery, skill bloat) | 2026-05-23 | `docs/plans/2026-05-23-phase-a-pilot-report.md` |
| Two-hierarchy cold probes (MediaWiki misread baseline) | 2026-05-26/27 | `docs/plans/2026-05-27-two-hierarchy-eval.md` |
| WoT-TD proto-knowledge alignment test | 2026-05-24 | auto-mem `standard_vocab_alignment_protoknowledge` |
| D111 identifier-scheme cold probes (3/3) | 2026-06-05 | `docs/plans/2026-06-05-d111-cold-probe-report.md` |
| D112 curation cold probes (curator 3/3; read-path 0/2) | 2026-06-06 | `docs/plans/2026-06-06-d112-cold-probe-report.md` |
| RQ-View-2 full re-eval (misread killed; token-layer finding) | 2026-06-07 | `docs/plans/2026-06-07-rq-view-2-report.md` |
| D114 eval (delivery ✓ / interpretation ✗; never-registered) | 2026-06-07 | `docs/plans/2026-06-07-d114-eval-report.md` |
| RQ-Conneg-1 H0 / H1 / E8 | 2026-06-09 | `docs/plans/2026-06-09-rq-conneg-1-*.md` |
| RQ-Salience-1 E1 / E5 / E5b / bootstrap + cut A | 2026-06-09 | `docs/plans/2026-06-09-rq-salience-1-*.md` |

The unified verdict those converge on: **delivery is solved; the view/conneg/tool layer is
not the over-trust fix; the lever is agent disposition (content-laden, immediately placed)
plus grounding.** Everything below is read against that.

## 2. KEEP — the validated core (the linked-data principles that earn their keep)

These are the affordances agents *demonstrably use*. This is the "core design and set of
linked data principles" to protect through the coming refactor.

1. **Follow-your-nose + `describedby` as the spine** (D48, D44, D31). H0: bare agents go
   HEAD-first, read Link rels, follow `rel="describedby"` to `.meta`, and request RDF with
   explicit `Accept: text/turtle` (q-values and all). `describedby` is the load-bearing
   *native* mechanism — agents prefer it cold over Accept-on-document. The single
   strongest behavioral validation in the corpus.

2. **Standard vocabulary / proto-knowledge grounding** (D79 hybrid stance, D94
   proto-grounded parents, D95 `schema:Thing`, D107 Bucket-1 aggressive reuse). Three
   independent confirmations: the WoT-TD subclass-alignment test; H0 agents reasoning
   about Link rels from known semantics; and the sharpest one — E8 directed-run2 read
   `schema:actionStatus PotentialActionStatus` and *correctly* weighed "proposed, not
   applied" against a dangling target. Standard vocab doesn't fix salience (E1), but once
   a signal is registered, model priors on standard terms drive *correct judgment*.

3. **Dual-layer linking + body→`.meta` projection** (D6, D57, D58, D71). RQ-View-2:
   agents consume the token layer — the Tier-1 arm answered a graph question from bodies
   alone, *because the projection guarantees the body carries the graph*. The projection
   is what makes token-layer consumption honest. This is the project's distinct
   architectural commitment and it survives contact with agents.

4. **Fused read as the governed-context delivery contract** (D114). Delivery validated
   substrate-wide, content-type-agnostic, every tier. `?_profile=fused` is aggregation,
   not selection — its one real job, and it does it.

5. **SHACL admission floor + `sh:agentInstruction` + teaching 422s** (D50, D88, D108,
   D109-B). D111 cold register: 201 first-try, zero 422s. D112 curator: floor taught
   (2×422 → corrected) and the agent *learned from the report*. RQ-View-2/D114 write
   arms: full-grammar authoring, first-try 201s. The floor works as both gate and teacher.

6. **Immediate Layer-0 `sh:agentInstruction`** (D44 entry-point literal + RQ-Salience-1
   cut A). Disposition in the `.well-known` literal: 3/3 efficacy vs 1/3 via pointer.
   Placement depth is load-bearing — the entry-point literal is the highest-leverage slot
   on the Pod.

7. **Type-Index addressing + the two-hierarchy commitment** (D8, D78, D100, D105/D106).
   Container resolution from the target's class held across all write probes; the
   `rdfs:subClassOf`-vs-`skos:broader` split never confused an agent; the L4 contract
   (D100) and D111 both rode it.

8. **Two-subject Page/Thing model + governance split** (D95/D96, D81 Model A). Cold
   agents author against it without being told; the grammar (D109-A) made it expressible
   and the write round-trips went green.

9. **URI conformance + namespace re-layering** (D84, D107). The MediaWiki misread —
   2/2 in the 2026-05-26/27 baseline — was killed 2/2 in RQ-View-2. Naming and
   self-description framing measurably change cold-agent interpretation.

10. **Identifier-scheme substrate** (D111). 3/3 cold: register first-try, resolve
    round-tripped, fragment datatypes consumed. Curl-grade enforcement held.

11. **Curation loop as Pod state** (D112 seams 1/2/3/5). Curator probes 3/3: in-band
    discovery, real liveness checks, Memento-pinned conformant proposals, propose-only
    discipline on both lanes. And E8 shows the ledger's *semantics* (proposed vs applied)
    are consumed correctly once an agent gets there. Seam 4 is the exception — see §4.

12. **Two-stage commit / propose-only** (D73, D112). Propose-discipline held 3/3; the
    `working/`→durable and `PotentialActionStatus`→`CompletedActionStatus` lifecycles are
    exactly the applied-vs-proposed distinction E8 proved agents reason over.

13. **Three-tier access + skills-as-bootstrappers + two-layer docs** (D55, D103, D69).
    Strengthened, not just confirmed: the floor stayed functional in every probe
    (degraded but honest), and the RQ-Salience-1 consumption leak makes the Tier-3
    skill/MCP channel *load-bearing* — it is the only channel that can install the
    disposition the Pod can only make consumable. D69's Layer-2 is no longer just
    "builder docs"; it's the disposition installer.

14. **Memento substrate** (D61–D68, K1). Conformance solid; first real *agentic* use
    observed — D112 curators Memento-pin descriptor versions in proposals. Agent-initiated
    TimeGate negotiation remains untested (§5), but the substrate earned a consumer.

15. **Media-type conneg, CSS-native** (RQ-Conneg-1). Works; agents use it when cued and
    have the capability cold. No bespoke machinery needed on top.

## 3. QUALIFIED — direction right, cut wrong

- **D33 "agent-first, self-describing Pod; no `.claude/` injection."** The strong reading
  is falsified by the bootstrap test: self-description is necessary but **cannot install
  the disposition** — cold agents handed a resource URL don't bootstrap (0/3). D33 stands
  for runtime navigation (H0 proves agents walk the self-description); D69's two-layer
  split is the corrected form, and the skill/MCP channel is a co-equal delivery surface,
  not a cheat. The coming MCP-design decision should formally amend D33's scope.

- **D93 synthesis page as primary entry point.** Direction validated (entry-point pattern,
  llms.txt lineage) but the cut is wrong two ways: agents handed a resource URL never
  visit it, and the rich U-shape reinforcement is in tension with the "less text" lesson
  — the thing that worked 3/3 was a *lean* immediate literal, not a rich page one hop
  away. Re-cut under D109 Tier-0 minimum-index / layered-context-loading.

- **D49 vocabulary grounding.** Keep as FAIR policy, but do not expect behavioral effect
  on salience: E1 showed vocabulary (even standard) doesn't rescue a confirm-mode agent;
  grounding helps only a *disposed* agent. E7 (load `mem:` definitions) is the clean
  untested cell if the structure design wants the data.

- **D54 / L2 invariant "tiered, progressive retrieval."** Validated for navigation and
  writing; **inverted for disposition delivery** — every pointer level loses agents
  (agentGuide pointer 1/3 vs immediate literal 3/3). Progressive disclosure is right for
  *content*; wrong for *the rules of engagement*, which must be Layer-0-immediate.

- **D74/D101 `mem:*` signals.** Emission wired and conformant; the only consumption
  channel tested end-to-end (read-path) needed two redesigns (D112 Probe-2 negative →
  D114 fused delivery → disposition still required). Treat the trigger taxonomy as
  validated *vocabulary*, unvalidated *delivery* — delivery patterns A (post-write query)
  and C (notifications subscription) have zero behavioral datapoints.

## 4. CONTRADICTED / over-built — strip-back candidates (each needs its own spec)

- **Conneg-by-profile selection** (`?_profile=` as selection, `Accept-Profile`) — D86's
  aspiration, D113's build. Never reached by any agent across H0/H1/E8 ("reason #3"
  falsified the other way: agents *can* conneg; they still never touch profile
  selection). H2 likely moot. **Keep:** `?_profile=fused` (aggregation), `Link:
  rel="profile"` + PROF descriptors *as hints* — H0 agents dereferenced the profile and
  correctly identified the SHACL artifact, so the hint earns its keep cheaply. **Shed
  when the strip-back spec lands:** the selection machinery, `?_profile=alt`
  introspection (unconsulted), view-descriptor PROF ceremony beyond what `fused` needs.

- **D113 trailer + `?_profile=doc/graph`** — already removed by D114. Done; recorded here
  for completeness. The salience instinct behind the trailer (token-layer, linear
  attention) was *partially right* — E5b's content-laden preamble is the legitimate heir.

- **D114 move 3, view-authority contract as on-Pod PROF artifact.** Deployed,
  unconsulted in every run (agents go straight to the resource URL). Functionally
  superseded by the cut-A disposition literal — same job, the slot that works. Fold its
  content into the lean Layer-0; retire the separate artifact.

- **D112 seam 4 as built** (Link-header read-path surfacing). 0/2 to curl agents
  (D112 Probe 2); the header channel never opened. Survives only as: fused-read carriage
  (D114, delivery ✓) + disposition (E5, interpretation ✓). The
  `CurationLinkMetadataWriter` header is harmless floor signage — keep emitting, stop
  expecting behavior from it.

- **Seeded `skos:narrower` inverses** (RQ-View-2 finding). Seed-only, not derived —
  violates the D109 derive-rule and is already stale. Either derive or drop from seeds;
  seeded exemplars also teach phantom affordances (same report) — seed-data minimalism is
  the lesson.

- Already-superseded items confirmed dead by the signal: role→container map (D76c→D106),
  RDFa (D37→D75), dual parallel index mechanisms (D9→D44). No action; the supersessions
  were correct.

## 5. UNTESTED — do not mistake for validated

The L1-utilization axis (D102) is still mostly unmeasured. Nothing here is contradicted;
nothing here is confirmed either:

- `mem:*` event **consumption** via delivery patterns A/C; Solid Notifications (D56);
  LDN inbox multiplexing (D26).
- Agent-initiated Memento time-travel (TimeGate/`Accept-Datetime` negotiation) —
  RQ-Memento-2, RQ-Federation-1.
- Multi-Pod federation (D13, Rung 1.5 Phase D); Oxigraph backend (D43); search phases
  7b–7d (D91); RQ-Pod-6 scale.
- Identity/VC stack (D25, D62, D64 layers 2–3, D89/D90 beyond the one 2026-05-17 cold
  session) — still behavior-before-security by design.
- H-D82 inline JSON-LD — still a hypothesis; its gates (Phase A ✓, B1 pending,
  RQ-Listener-1 pending) are intact. The corpus's token-layer finding (agents read
  bodies) mildly *raises* its prior; do not promote without the eval.
- Derived navigation classes / hub views (D80); RQ-Hub-1.
- D110 interop re-base — stub, untouched by any probe.
- E7 (vocabulary grounding cell) — unrun.

## 6. GAPS — what the signal demands that no decision record covers

1. **Disposition as a first-class substrate artifact.** Cut A landed the audit-disposition
   as a literal in `void-description.json` — it works (3/3) but is ad hoc: no decision
   says what the disposition slot *is*, what content contract it carries (E5b: must be
   content-laden, L4 — name the failure mode, direct the hunt), or how apps extend it.
   This is the D-number the structure design should mint.

2. **The consume-first channel** (skill-baked / MCP-gateway / bootstrap). The pod makes
   the disposition consumable; it can't install it. Chuck flagged MCP design + pod
   refactor as the dependent build. This decision also carries the D33 scope amendment
   (§3).

3. **Lean Layer-0 re-cut.** D109's Tier-0 layered-context-loading now has empirical
   teeth: orientation + routing + disposition in the immediate literal; defer the RDF
   catalog machinery. No decision yet specifies the minimum-index content.

4. **Applied-vs-proposed surfacing.** E8's new finding: the semantics of the surfaced
   signal (`PotentialActionStatus` vs applied; target resolves vs 404s) drive the
   decision, and a diligent agent *defensibly* keeps a contested value when the
   realignment is merely proposed. The curation read-path needs to state what a proposed
   action *licenses* — and our traps must stop conflating "proposed" with "binding."

5. **Profile-stack strip-back spec** (§4 first bullet) — its own spec, preserving the
   fused merge, after the structure design settles what Layer-0 looks like.

## 7. Net reading

The decision base is in better shape than a 114-decision pile suggests: the supersession
chain has been doing its job (everything the probes killed was already marked or quickly
amended), and the behavioral signal *converges on the project's founding bets* —
follow-your-nose, standard vocab, dual-layer projection, SHACL-as-teacher, type-indexed
addressing. What the signal removes is one imported layer (profile *selection*) and one
assumption (that self-description alone can govern agent behavior). The corrective is
already named: lean Layer-0 + consume-first channel + disposition artifact. Those three
gaps in §6 are the structure-design brainstorm's agenda.
