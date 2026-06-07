# RQ-View-2 Cold-Probe Eval — Report (2026-06-07)

The D107 §5 / RQ-View-2 behavioral validation, run against the live substrate
(HEAD `0928c4c` deploy, floor + grammar both live — the D108/D109-A gates this
eval waited for). Instrument: cold Sonnet agents, headless, empty cwd outside the
repo, bare ask + Pod URL only; same rig as the D112 probes (2026-06-06), harness
at `~/dev/probes/rqview2/`. Baseline to beat: the 2026-05-26/27 probes
(`docs/plans/2026-05-27-two-hierarchy-eval.md`) — 2/2 agents misread
`/vault/wiki/` as "a MediaWiki-style wiki *application*."

Three arms (the third added mid-session on Chuck's instrument critique — see
"Instrument note" below):

| Arm | Tool surface | Task | Runs |
|---|---|---|---|
| V-A | curl only (Tier 1) | "store a concept note about cellular respiration" | 2 |
| V-B | curl only (Tier 1) | dual-view read: prose Q + graph-relations Q | 1 |
| V-C | curl + `solid-pod` CLI shim (Tier 3) | identical questions to V-B | 1 |

V-B/V-C fixture: an `ecology` concept planted under Biology so the sibling
question has a real answer not stated in any single `.md` body.

## Verdict

- **Probe A (misread regression): PASSED 2/2** — neither V-A run produced any
  MediaWiki/application misread. The D107 reframe + entry-point framing killed
  the contamination the eval existed to measure. **RQ-Substrate-4's behavioral
  validation is DONE** (the view layer, D107 §6, remains the open deep fix).
- **Round-trip-across-views (crown jewel): write side GREEN 2/2** — both V-A
  agents authored markdown with the full grammar (`[X]{.prefLabel}` literal
  axis + `[[Biology]]{.broader}`; run 1 added an unprompted `{.related}` edge),
  got **first-try 201s (zero 422 loops, zero PATCH fallbacks)**, and — unprompted —
  verified their own writes by fetching the projected `.meta`. The RQ-Grammar-1
  expressivity gap that forced 3/5 PATCH-fallback scores on 2026-06-01 is
  **behaviorally closed**.
- **Probe B (dual-view selection): answered, with the session's central finding**
  (below). Outcomes correct/complete in both read arms.
- **Probe C (PROF): moot as specced** — no `rel="profile"` header is emitted on
  wiki notes (verified); `rel="describedby"` is the dual-view affordance actually
  present, and no run followed it.

## The central finding: what "the graph view" is to an agent

**Tier 1 (curl): the body IS the graph.** The V-B agent answered the
graph-relations question completely (Biology parent + both siblings) in 8
requests — **all markdown bodies, zero `.meta` fetches, `describedby` never
followed**. Because dual-layer linking (D58/D71) puts the same edges in the body
as typed wikilinks, per-document Turtle offers a curl agent nothing the body
doesn't already carry more cheaply. It also dodged a stale-data trap unprompted:
saw Biology's body assert only `[[Photosynthesis]]{.narrower}`, reasoned "to find
*all* siblings I must check every other concept file," and swept the container.

**Instrument note (Chuck, mid-session): curl arms never tested the graph view —
only its per-resource projection.** The graph view as designed is the *queryable
union* (client-side Comunica, D3/D29); `.md.meta` is one node's shadow. The
economics were rigged: with curl, graph-read = N+1 Turtle fetches vs N+1 denser
markdown fetches. Hence arm V-C.

**Tier 3 (CLI): the fused view wins; SPARQL still unused.** The V-C agent
discovered the CLI from `--help` alone (7 of 12 commands were `solid-pod`),
located content via `search`/`wiki-search`, and consumed concepts via
**`solid-pod read` — which returns body + `.meta` sidecar fused in one
response**. Its answers cite actual graph triples (`skos:broader →
biology.md#this`) — the only run that grounded answers in RDF. But it **never
ran `sparql`**, with Comunica one subcommand away: at 7 documents, composing a
query loses to tool-assisted navigation.

**Unified statement (joins the D112 trajectory audit):** LLM agents live in the
token/representation layer. The standalone graph view earns consumption only
(a) as a write receipt — both V-A agents checked their projection — and (b) when
a tool fuses it with the body. Headers and unfused per-document Turtle are
machinery channels. **The winning affordance is the FUSED representation**
(body + governed triples in one response) — nobody designed for it explicitly,
but `solid-pod read` provides it and the agent preferred it immediately. SPARQL's
value is scale-conditional and remains unmeasured (needs a corpus where walking
hurts — RQ-Pod-6's 100+ benchmark; an argument for Phase C vault import).

## Substrate findings (all new)

1. **Inverse `narrower` edges are seed-only, not derived.** Confirmed twice
   deterministically: neither the agent-authored cellular-respiration nor the
   planted ecology produced `skos:narrower` on Biology's graph. Per the D109
   derive/floor/loop rule this is squarely a **derive** (mechanically inferable
   from `broader`), and its absence already made the seeded
   `biology.md.meta` narrower assertion stale/misleading (lists 1 child of 3).
   The body-side `[[Photosynthesis]]{.narrower}` hand-written in biology.md is
   equally stale. Graph-global drift of exactly the class the D112 curation loop
   (validated yesterday) exists to catch — or the projection should derive it.
2. **Seeded exemplars teach phantom affordances.** The D112 probe agent inferred
   "inverse maintained by substrate" from seeded data; the substrate doesn't do
   it. Legibility hazard: agents read what the Pod *contains* as what the Pod
   *does*. Exemplar/seed data is a teaching channel and needs the same curation
   discipline as descriptors.
3. **PROF is not delivered on wiki content** (no `rel="profile"` on `.md`
   responses) — Probe C's "does PROF drive view selection" cannot even be asked
   until it is; meanwhile `describedby` is present and went unused by every
   curl agent.

## Behavioral findings (Chuck's session asks)

- **Instruction-following: strong when in-band and body-resident.** Both authors
  learned the grammar from the container's `ldp:constrainedBy` → shape
  `sh:agentInstruction` → exemplar chain and followed it exactly — output
  *better* than the exemplar. The two enforcement audiences (D108) both held:
  the floor never had to fire.
- **Follow-the-nose: strong.** Stale-assertion distrust (V-B), `--help`-driven
  tool acquisition (V-C), `/vault/id/` 404 → domain-root recovery via the
  bootstrap memory pointer (V-C run, probe-2 run 1 yesterday).
- **Discovery redundancy carried every run** — storage description fetched in
  0/4 runs (now 1/9 across two days); container browsing + type index +
  in-band docs did the work.

## Status changes

- **RQ-View-2: ANSWERED.** Misread killed (2/2 vs baseline 0/2); write-side
  round-trip green; view-selection question answered with the channel-economics
  finding (body/fused-view dominance, SPARQL scale-conditional). The PROF
  sub-question is reframed: deliver `rel="profile"` first or drop it.
- **RQ-Substrate-4: behavioral validation complete.** Remaining open piece is
  only the deferred VIEW LAYER (D107 §6) — and this eval's fused-view finding is
  direct design input for it: the view worth building is body+governed-graph
  fused, not more separate views.
- **Read-path brainstorm input (with the D112 probe results):** put agent-facing
  signals in the representation agents actually consume — the body or the fused
  view. An open-action triple in the fused `read` response would have been seen;
  the Link header was not.
- Probe residue cleaned (cellular-respiration ×2, ecology fixture); post-eval
  audit 0 ERROR / 1 known WARN.

Artifacts: `~/dev/probes/rqview2/runs/{probe1-run1,probe1-run2,probe2-run1,probe3-run1}/`
(trajectory.jsonl, report.md, pod-state.txt); grading at
`~/dev/probes/rqview2/grading/criteria.md`. Raw-trajectory audits performed on
all four runs (self-reports verified faithful; tool-call/channel counts above
come from the raw streams, not the narratives).
