# Is the View Layer Over-Built? Pure Solid Content Negotiation vs the PROF / Conneg-by-Profile Stack (RQ-Conneg-1)

**Status:** OPEN step-back. **H0 DONE 2026-06-09 — agents DO conneg, robustly** (report:
`docs/plans/2026-06-09-rq-conneg-1-h0-report.md`; results logged in §7 below). H1 next.
Hypothesis: the dual-view machinery we layered on (PROF profiles,
conneg-by-profile `?_profile=`, `Link rel="profile"`, `sub:View`) is **over-built relative to
what pure Solid + Verborgh's "What's in a Pod" actually call for**, and may be earning nothing
with real agents. H0 (foundational) is now tested; H1/H2 remain. Document completely; decide empirically.
**Reload context:** this doc + the D114 eval report + RQ-Salience-1 (`2026-06-08-read-path-salience.md`,
sibling — do not subordinate this to it) + decisions D86/D107/D113/D114 + the Solid Protocol.

---

## 1. The claim

We may have reached for a W3C DXWG stack (PROF + conneg-by-profile + custom Link rels +
`sub:View`) when **pure HTTP/Solid mechanisms — media-type content negotiation + the
`describedby` description resource — already provide the document-vs-graph dual view**, more
simply and via mechanisms the model has stronger training priors for. Three independent
strands point the same way: (a) Verborgh's paper, (b) the D114 eval behavior, (c) live probing
of what CSS already does natively.

## 2. Verborgh uses none of it (primary source, verified 2026-06-08)

From the full text of *What's in a Pod?* (solidlabresearch.github.io/WhatsInAPod):

- A view = **"view definition"** (*"how public-facing pod URLs correspond to triples or
  documents from the underlying hybrid knowledge graph"*) + **"view application"** (materializing
  it). Different views = **different URLs** over one graph.
- Writing: *"graph-centric writing can happen by posting triples or documents directly to the
  graph, since it is the responsibility of views to expose all written information in the correct
  place within APIs."*
- **Explicitly absent:** PROF / Profiles Vocabulary, conneg-by-profile, `Accept-Profile`, `Link
  rel="profile"`, Link headers for view selection, and even media-type content negotiation. The
  paper abstracts transport away and **defers the concrete mechanism to future work**.

So the entire PROF/conneg-by-profile apparatus is **our import**, not Verborgh's. His mechanism
is just *URL ↔ graph-selection mappings*.

## 3. The eval says agents ignore the imported machinery

Across the D114 over-trust probes (`docs/plans/2026-06-07-d114-eval-report.md`), agents consulted
**none** of: the PROF profiles, `?_profile=` (unprompted), `Link rel="profile"`, or the
view-authority contract. What they used: plain `GET` of the body, the fused merge (tool), and
follow-your-nose to linked resources. The conneg-by-profile layer is machinery real agents skip.

## 4. What CSS *already* does natively (live-tested 2026-06-08)

On `biology.md` (a wiki concept):

| Request | Returns | Notes |
|---|---|---|
| `GET …/biology.md` (default `Accept`) | the markdown body | document view |
| `GET …/biology.md` `Accept: text/turtle` | **the `<>` page-level graph** as Turtle (dct:title, `schema:mainEntity <#this>`, `conformsTo`, bodyHash, format, label, modified) | **format conneg WORKS** — but page-level only (10 lines) |
| `GET …/biology.md` `Accept: application/ld+json` | the same graph as JSON-LD | format conneg, standard media type |
| `GET …/biology.md.meta` (`describedby` target) | **the FULL governed graph** incl. `<#this>` Thing triples (prefLabel, broader, governed context) | 22 lines; this is the authoritative graph |

**The precise, load-bearing nuance:** content negotiation on the resource gives you *a* graph
(the `<>` page-level description) but **not THE governed graph**. The substantive `<#this>`
triples that matter for over-trust (broader, prefLabel, `hasOpenAction`) are in the **`.meta`
resource, reached via `describedby`** — a second URL, exactly Verborgh's "different views =
different URLs." So:

- **Document view** = `GET resource` (markdown). Pure Solid.
- **Graph view (page-level)** = `GET resource` `Accept: text/turtle`. Pure HTTP conneg, native,
  model-prior-friendly — but partial.
- **Graph view (full/authoritative)** = `GET resource.meta` via `describedby`. Pure Solid
  auxiliary/description resource.
- **Fused** = body ⊕ full graph. This is **aggregation, not view *selection*** — and it's the one
  thing neither plain conneg nor describedby gives in a single request. (`?_profile=fused`'s only
  real job is the one-request merge; `?_profile=graph` is pure redundancy with `Accept: text/turtle`
  / describedby, which is why D114 already dropped it.)

**Agent-behavior datum (mixed):** in the eval, the floor agent *did* use `Accept: text/turtle`
when listing a **container** and *did* fetch the `.meta` — but default-`GET`'d the document
resource. So agents conneg when they *expect* RDF (containers, `.meta`) and default-GET
documents. Whether they'd conneg a document resource to get its graph is **untested** — and is
H0 below.

## 5. What does conneg-by-profile actually buy over plain conneg + describedby? (the walkthrough)

The steelman for PROF/conneg-by-profile: it selects between **multiple alternative projections of
the same resource at the same media type** — e.g. "the full graph" vs "a summary graph" vs "the
DCAT-AP profile" — which `Accept` (media type) cannot distinguish. That is a real capability **when
you have multiple same-media-type projections.**

But our actual views are: **document (markdown) and graph (turtle/.meta)** — already distinguished
by media type + a separate URL. We do **not** have multiple competing turtle projections of one
resource. So for the dual view we actually ship, **conneg-by-profile distinguishes nothing that
`Accept` + `describedby` don't already distinguish.** The only `?_profile=` that does real work is
`fused` — and that's an *aggregation convenience*, not a profile selection; it could be a media
type, a tool behavior, or a `?ext=` affordance just as well.

Provisional conclusion (to test, not assume): **for our two views, the PROF/conneg-by-profile layer
is redundant with pure Solid; its cost is bespoke surface (`?_profile=` tokens, PROF descriptors,
custom Link rels) that agents ignore and that couples us.**

## 6. Three reasons conneg-by-profile might be "failing" (Chuck, 2026-06-08)

If we keep it, we must distinguish *why* it's unused — they have very different fixes:

1. **Bad instructions.** We never tell agents, in-context, that `?_profile=` exists or when to use
   it (the view-authority contract is unconsulted). Maybe it works fine and is just undiscovered.
2. **We're implementing it wrong.** Possible bugs in our conneg-by-profile (token handling,
   `Accept-Profile` parsing, the descriptors). Needs a correctness audit before behavioral claims.
3. **Agents can't do conneg-by-profile because they can't do plain conneg.** The foundational
   hypothesis: **if agents don't reliably do media-type content negotiation, they certainly won't
   do the more elaborate negotiation-by-profile.** Conneg-by-profile is built *on top of* conneg;
   if the floor is shaky, the upper storey can't stand. The eval's mixed signal (conneg for
   containers, default-GET for documents) makes this live.

## 7. The experiment ladder (H0 → H1 → H2) — run in order

Reuse `~/dev/probes/d114/`. Raw-audit reasoning (the D114 lesson), n≥2/cell, watch the `-v` confound.

- **H0 — Do agents do plain content negotiation at all?** Ask a graph question; observe whether the
  agent reaches for `Accept: text/turtle` / `application/ld+json` on the resource, follows
  `describedby`, or just default-GETs the body. *This is the foundational measurement — if H0 is
  "no," the whole conneg-by-profile edifice is on sand (reason #3).* Variants: bare task; task that
  says "this Pod serves an RDF graph view of each note"; task with the agent told `describedby`/Accept
  conventions in-context.
  - **✅ RESULT 2026-06-09 (n=2 bare + n=1 each cue; report `docs/plans/2026-06-09-rq-conneg-1-h0-report.md`):
    YES, robustly — reason #3 is FALSIFIED.** Instrument used a graph-only question (`dct:modified` +
    `dct:conformsTo`, both absent from the body) to dodge the dual-layer confound. All 4 cold agents
    reached the authoritative graph and answered correctly, high confidence. Mechanism findings:
    (1) **bare agents go HEAD-first → follow `describedby`→`.meta` → request RDF with explicit
    `Accept: text/turtle`** — deliberate Linked-Data discovery, not body-scraping; (2) **`describedby`
    is the load-bearing native mechanism** (bare agents reach the graph via it, *not* by conneg'ing the
    document); (3) **Accept-on-the-document conneg appears only when cued** (arms b/c) — a capability
    they have but don't reach for cold; (4) **PROF-as-a-hint earns its keep** (every agent dereferenced
    `conformsTo`/`rel=profile` and IDed the SHACL-bundling profile) **but `?_profile=`/`Accept-Profile`
    selection was NEVER reached** — the exact bespoke layer this RQ suspects. Pre-favors §10's strip
    criterion; H1 must confirm on the dual-view/over-trust task.
  - **Behavioral observations (full-trajectory read, all 4 runs — the real yield, beyond pass/fail):**
    The universal arc was identical: (i) **HEAD the resource first** as a deliberate cheap-metadata-then-follow
    strategy (*"a HEAD request gives HTTP-layer metadata cheaply… but I need the RDF layer for the
    authoritative typed timestamp"*); (ii) **read the Link rels and reason about them by known semantics**,
    not string-match (*"the `rel="describedby"` link points to a `.meta` resource that typically carries RDF
    metadata"*; RFC 6892/8288 cited in provenance); (iii) follow `describedby`→`.meta`, `Accept: text/turtle`;
    (iv) dereference the `conformsTo`/`profile` target to characterize it. Four findings that matter:
    1. **Agents act on standard Link rels because they have a *prior for the rel's meaning*.** Direct,
       live contrast with the D114 salience failure: `mem:hasOpenAction` was a bespoke full-IRI rel with NO
       prior → read as noise, skipped; `describedby` is grounded → planned-around and followed. Same agent,
       same channel, opposite outcome, explained by whether the vocab is in pretraining. **Empirical evidence
       for RQ-Salience-1 tensions #4/#5 (standard-vocab / grounding).**
    2. **Agents distinguish HTTP-layer from RDF-layer authority and prefer the authoritative layer** — got
       `Last-Modified` from the header but went to `.meta` for the "typed, authoritative" `dc:modified`. So in
       D114 the agent *did* reach `.meta`; the gap was never reach-authority, it was the predicate-scan not
       landing on the sibling contestation triple. **H0 isolates the salience gap to attention-landing.**
    3. **The body-check is deliberate falsification**, not an answer attempt (*"checked whether the body
       carries shape declarations. It does not"*). Asymmetry: for a *metadata* question agents treat the body
       as non-authoritative; for a *content* question (broader topic) the body carries the projected wikilink
       (→ RQ-View-2 body-scraping). **Which layer the agent trusts depends on question type** — a real H1 variable.
    4. **The cue moved the *first* RDF fetch, not discovery competence.** Bare: HEAD→`.meta`. Cue-b: HEAD→conneg
       the *document* for turtle first, then `.meta`. So `describedby`-following is robust cue-free;
       document-conneg is the cue-sensitive add-on. `?_profile=`/`Accept-Profile` never surfaced in any reasoning step.
    - **Bridge to RQ-Salience-1:** the dual-view *retrieval* is essentially solved by pure Solid; H1's real
      target becomes — with the over-trust trap back — *having reached `.meta` via `describedby`, does the agent
      register a sibling `hasOpenAction` it has no prior for?* H0 predicts NO (findings 1+2), which argues the
      salience fix is **vocabulary grounding** (standard supersession terms, or loading the `mem:` definition),
      not more delivery machinery.
- **H1 — Does pure Solid (conneg + describedby) solve the dual view as well as the PROF stack?**
  Same over-trust/dual-view tasks, but strip the agent to pure-Solid affordances (no `?_profile=`
  mentioned). Compare behavior to the D114 runs that had the PROF stack available. Does removing the
  bespoke layer change anything? (Expectation from §3: no — agents ignored it anyway.)
  - **✅ RESULT 2026-06-09 — reframed to the A-vs-B discriminator** (report
    `docs/plans/2026-06-09-rq-conneg-1-h1-report.md`; H0 had pre-answered the literal "strip
    `?_profile=`" question — agents never used it). Over-trust trap, pure-Solid curl-only, currency-
    priming gradient (arm b content / arm a currency-in-question), n=5. **A (reached-but-missed)
    dominates 4:1 over B (never-reached); 0 caught.** Four of five fetched `.meta` — **which carries
    `hasOpenAction`** — and answered the stale "Progressive Disclosure"; the one B was the laziest run
    (single body GET). **The currency cue did NOT help** — both arm-a agents did *more* graph work
    (Memento timemap, target-resolution) and concluded "high confidence current," confidently wrong:
    they reasoned about currency in vocab they have a prior for (versions, dangling refs) and never
    connected it to the `mem:hasOpenAction` triple in the `.meta` they fetched. **Proto-knowledge
    hypothesis CONFIRMED** (Chuck): `describedby` followed (standard, prior) / `mem:hasOpenAction`
    invisible (bespoke, no prior) — even in parsed context, and doubly so because it sits on the `<>`
    page subject not the `<#this>` concept subject a broader-scan targets. **Verdict: delivery is
    solved (D114); the over-trust fix is NOT view/conneg-side — it is grounding.** Hands to
    RQ-Salience-1 E1 (standard supersession vocab) + E7 (load the `mem:` definition), prioritised
    over further delivery/view work.
  - **E8 graph-tool follow-up ✅ 2026-06-09** (Chuck's question — do graph-*navigation* tools, not just
    document-read, change it? report `docs/plans/2026-06-09-rq-conneg-1-e8-graph-tool-report.md`):
    **No, not by presence — disposition.** Free-CLI agents (2/2) used `sparql`/`wiki-search`/`read`
    only to *re-confirm* the body value (one even `sparql`-FILTERed for 'progressive' — searching to
    confirm, not audit) and missed it. Directed agents ("check operation history first") 2/2 *followed
    the `hasOpenAction` link* (the one they ignored in H1) to the `.operations/` resource — then SPLIT:
    one corrected to Hierarchical Retrieval, one **defensibly kept PD** (the action is
    `PotentialActionStatus`/proposed + HR 404s). Confirms: the over-trust fix is NOT view/conneg/tool-
    surface; it's disposition/grounding. For single-resource contestation the graph tool adds no info
    over the document. Substrate gaps found: `memory-history` affordance not guessable (agents tried
    `operation-history`→500); `solid-pod invoke` resolves a malformed descriptor URL on unknown affordances.
- **H2 — Does conneg-by-profile add value once H0/H1 are understood?** Only meaningful if H0 shows
  agents *can* conneg. Then test: (a) with good in-context instructions for `?_profile=`; (b) after a
  correctness audit of our implementation; (c) against a case that genuinely needs multiple
  same-media-type projections (which we may not even have — if not, that's the answer). Distinguishes
  reasons #1/#2/#3.

Cross-link: H0/H1 also feed RQ-Salience-1 — a graph view selected by the standard `Accept` header
rides a model prior where `?_profile=fused` is a bespoke token; the simplification and the salience
fix point the same way.

## 8. What we keep regardless of the outcome

- The `.meta` / `describedby` description resource (Solid Protocol native).
- Media-type content negotiation (HTTP native).
- The **fused read as a tool/client behavior** (Verborgh's "view tailored to the use case"; the CLI
  already does it; the *one-request merge* is a genuine convenience).
- The **cross-cutting Person view** (`/vault/views/people/`) — this is Verborgh's *actual*
  contribution (one entity, multiple URLs) and is NOT what conneg-by-profile is for. It stays.

## 9. What would be on the table to shed (only if H1 confirms)

`?_profile=` per-resource conneg-by-profile; the PROF view descriptors (`sub:View` doc/fused/graph);
`Link rel="profile"` beyond native `describedby`; the view-authority contract *as a PROF artifact*
(its content may move to wherever RQ-Salience-1 lands; the PROF packaging may go). **Do not pre-emptively
rip out** — D114 is validated/no-regression, and `?_profile=fused` is the current contract surface; a
strip-back is its own spec after the experiments, and must preserve the fused-merge convenience under
*some* affordance (media type, `?ext=`, or tool).

## 10. Decision criteria

Strip the PROF/conneg-by-profile layer if: H1 shows pure Solid (conneg + describedby + fused-as-tool)
gives agents the dual view at least as well, AND the walkthrough (§5) confirms we have no genuine
multi-same-media-type-projection need. Keep/repair it if: H2 shows it adds real, agent-usable value
once well-instructed and correct — i.e. reason #1 or #2, not #3.

## References

- Verborgh et al., *What's in a Pod?* — solidlabresearch.github.io/WhatsInAPod ; paper
  ruben.verborgh.org/publications/dedecker_quweda_2022/ ; CEUR Vol-3279 paper6.
- Solid Protocol: content negotiation (server honors `Accept`, MUST support `text/turtle` +
  `application/ld+json`); auxiliary / description resources (`Link rel="describedby"`).
- This repo: D86 (PROF resource-kind hints — the original import), D107 (view layer / conneg-by-profile),
  D113 (the built view layer), D114 (fused = contract; `?_profile=graph` dropped as redundant — the first
  crack in the over-build), the D114 eval report, RQ-View-2.
- RQ-Salience-1 (`docs/research/2026-06-08-read-path-salience.md`) — sibling thread; H0/H1 feed it.
- Caveat: RQ-Pod-4 — Comunica link-traversal does **not** follow `describedby` on non-RDF resources;
  any "pure describedby-follow" client path must enumerate `.meta` explicitly (relevant to H1 tooling).
