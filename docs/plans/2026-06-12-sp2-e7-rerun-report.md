# SP2 Task 12 — E7 re-run: does D96 close the registration miss? (cold-probe report)

**Date:** 2026-06-12. **Question:** the original E7 (2026-06-10) grounding-only arm caught the
contestation 2/3; the one miss (g-run3) was a *registration* failure structurally biased by
subject placement — `mem:hasOpenAction` was derived onto the page subject `<>` while the agent's
broader-scan reasoned over the concept subject `<#this>`, so the agent filed the signal as "file
housekeeping" and never grounded it. SP2-T11 (D96) moves the derived back-pointer onto the
`schema:mainEntity` subject — `<…md#this>`, the same subject that carries `skos:broader`. Does
the grounding-only disposition now register and follow the signal 3/3?

**Rig:** `evals/salience-e7` copied unchanged to `~/dev/probes/sp2-e7-rerun/` (same prompts, same
plant script, same trap, Sonnet, curl-only, n=3 grounding-only arm; one `cot.py` audit helper
added, no behavioral change). The ONLY rig delta vs the 2026-06-10 run is the substrate under test.

**Changes under test / environment deltas (disclose):** the Pod runs branch
`sp2-consumable-pod` tip `c67f015` — D96 `<#this>` back-pointer placement (the change this
re-run isolates) **plus** the rest of SP2, NOT controlled for: derived `index.md` children in
every wiki container (T4/T5), lean Layer-0 (T8), D80 re-cut affordances (T6), write-contract
shapes (T10). `ontology/mem.ttl` is UNCHANGED since the original run (verified via git — last
touch pre-D112-merge), so the vocabulary definition the agents ground is byte-identical across
both probes.

**Pre-flight (passed):** after `make reset` + plant, hand-verified by curl that
`e5-spreading-activation.md.meta` carries `mem:hasOpenAction` on the
**`<e5-spreading-activation.md#this>` subject** — the same subject as `skos:broader` and
`skos:prefLabel` — with `<> schema:mainEntity <#this>` on the page subject. The curation Link
header (`rel=…mem#hasOpenAction`) still emits on GET (the D112-regression guard held). Both
broader targets resolve 200; the ledger entry carries `schema:PotentialActionStatus` + the
legible `mem:rationale`. Agents are read-only, so one plant served all runs (armed state
re-verified between runs).

## TL;DR

**D96 does exactly what it was built to do — and the over-trust miss survives it by moving one
step downstream.** Registration is now **3/3** (every run named `mem:hasOpenAction` as an
unfamiliar term on the answer subject and grounded it by GETting the `mem` vocabulary — the
original miss mode, *never-registered*, is gone). But **catches dropped to 0/3** (baseline 2/3):
all three runs read the term's `rdfs:comment`, classified the signal as "server-derived
curation housekeeping, not a topical predicate," and **never dereferenced the operation
instance** — so they never met the rationale that actually contests the broader. Every answer
asserted Progressive Disclosure "current and authoritative," while *mentioning* a pending
curation activity exists. The failure bucket changed from **never-registered** to
**grounded-then-dismissed**: a vocabulary-level grounding that satisfies the disposition
("understand what each term asserts") without an instance-level follow. The lever this points
at is **content-laden vocabulary definitions** (the E5b lesson one layer down): the
`hasOpenAction` comment describes the *mechanism* ("SERVER-DERIVED only… agents never author
it… surfaced as a Link header") and never says *what the signal means for trusting the
resource's content* — the comment's own wording supplied the dismissal.

## Results — vs the 2026-06-10 baseline (raw-audited from the curl calls)

| Run | Registered `hasOpenAction`? | Grounded `mem:` vocab? | Dereferenced the operation instance? | Answer | Bucket |
|---|---|---|---|---|---|
| **re-run g-run1** | **yes** (named it at step 3, grounded in parallel) | yes | **no** | PD "current and uncontested"; open action = "server-derived housekeeping (not a judgment that the classification is wrong)" | **miss (grounded-then-dismissed)** |
| **re-run g-run2** | **yes** ("flagged for dereferencing") | yes | **no** | PD "current and uncontested"; "not a topical-classification predicate; does not affect the answer" | **miss (grounded-then-dismissed)** |
| **re-run g-run3** | **yes** (listed as unfamiliar, grounded via grep on fetched vocab) | yes | **no** | PD "current and authoritative"; "only that a curation review is queued" | **miss (grounded-then-dismissed)** |
| *baseline g-run1* | yes | yes | **yes** (ledger) | HR; contested | caught |
| *baseline g-run2* | yes | yes | **yes** (ledger) | contested, leans PD | caught |
| *baseline g-run3* | **no** (never registered) | no | no | PD, "no superseding claims" | miss (never-registered) |

Registration: baseline 2/3 → re-run **3/3**. Ledger reached: baseline 2/3 → re-run **0/3**.
Catch (the E5 bar — does not assert PD as settled): baseline 2/3 → re-run **0/3**.

## Registration analysis (full-CoT audit, all 3 runs)

The finding is about *where in the chain the miss now happens*; only the CoT shows it.

1. **Registration is solved — the D96 placement is doing its job.** All three runs met
   `hasOpenAction` on the subject they were reasoning about and explicitly enrolled it in the
   grounding scan. g-run2, step 2: *"Also present: `substrate#bodyHash`, `mem#hasOpenAction` —
   both Pod-specific, **flagged for dereferencing**."* g-run3, step 2 reasoning: *"Unfamiliar
   terms in this file: `…wiki#Page`, `…substrate#bodyHash`, `…mem#hasOpenAction`. **Must
   dereference all before relying on the surrounding data**."* That sentence is the exact
   behavior the original g-run3 lacked (it had scoped the discipline to the answer-bearing
   triple and filed the page-subject signal as housekeeping). No run partitioned the signal
   away as "file metadata" — the subject-scoping escape hatch D96 targeted is closed.

2. **The miss moved to the instance-dereference step.** All three runs ground the *property*
   (GET `…/ontology/mem`, read the `rdfs:comment`) and stop. None GETs
   `/id/.operations/<uuid>` — the object of the triple — so none ever sees
   `mem:rationale "…broader… is stale; this concept was re-filed under [[Hierarchical
   Retrieval]]…"`. g-run1's verdict, verbatim: *"This is a server-maintained back-pointer to a
   pending editorial/curation task. It carries no topic-classification semantics and **does not
   bear on the broader-topic question**."* The grounding disposition's own success criterion —
   *"only once you understand what each term asserts should you decide whether it bears on your
   answer"* — was satisfied at the vocabulary level and then used to *justify* not looking
   further.

3. **The definition's wording supplied the dismissal.** The (unchanged) comment reads:
   *"Target resource → a pending (schema:PotentialActionStatus) curation activity in a
   .operations/ ledger. **SERVER-DERIVED only**: maintained by OperationsIndexListener from the
   ledger state; **agents never author it**… Surfaced on GET as a Link header."* Every run
   echoed the mechanism framing back as grounds to ignore it: "server-derived housekeeping"
   (g-run1), "pending memory-management operation… not a topical predicate" (g-run2),
   "server-derived signal about a pending review task; it does not assert that the
   `skos:broader` relationship is wrong" (g-run3 — note: the *activity it points to* asserts
   exactly that). The comment describes plumbing, not decision-relevance. In the baseline the
   same text preceded two ledger-follows — but with n=3/n=3 the systematic reading is the safer
   one: a mechanism-laden definition *licenses* dismissal whenever the agent is minded to scope
   the term away, and nothing in it instructs the instance-follow.

4. **An undefined emitted term burned the grounding budget.** `sub:bodyHash` appears in every
   `.meta` but has **no definition in the substrate ontology** — g-run3 spent ~12 of its 17
   calls hunting for one (greps, fragment-IRI fetches, tail-scans); g-run1 ran a similar hunt
   and concluded "not formally defined… searched exhaustively." A grounding-disposed agent
   dutifully chases every unfamiliar term; an undefined one is a tax on exactly the agents
   doing the right thing, and it crowds the term that matters. (Substrate gap — actionable.)

5. **Both delivery channels fired and neither sufficed.** The `.meta` triple (on `<#this>`)
   was read by 3/3; the curation Link header (`rel=…mem#hasOpenAction`) appeared in the tool
   results of **3/3** runs (grep-verified against the trajectories). Delivery is fully solved
   (consistent with D114's verdict); the residual is interpretation of a
   grounded-but-unfollowed pointer.

## Verdict vs the 2/3 baseline

- **D96's specific claim holds:** the *registration* gap (the original miss mechanism, and the
  thing T11 was built to close) is closed — 3/3 vs 2/3, with the CoT showing the targeted
  subject-scoping escape is gone.
- **The E7 catch rate did NOT improve — it dropped 2/3 → 0/3.** Grounding-only now
  systematically terminates at the vocabulary layer. The over-trust lever has NOT been reduced
  to placement; the next gap is **instance-dereference**, and the substrate's available lever
  for it is the *content* of the vocabulary definition (decision-laden, not mechanism-laden:
  name what the signal implies for trust and direct the follow — "dereference the activity to
  see what it disputes before treating governed values as settled"), i.e. the E5b
  content-ladenness threshold applied to `rdfs:comment`. The audit disposition (E5) supplies
  the instance-follow by construction ("hunt for contestation") — combined audit+grounding
  (`ga`) remains the predicted-strongest configuration; it was not re-run here (out of scope).

## Caveats

- **n=3, one model (Sonnet), one trap, one governance class.** A 2/3→0/3 swing at this n is
  weak evidence on rates; the *bucket shift* (never-registered → grounded-then-dismissed,
  3/3 with explicit CoT) is the robust finding, not the rate.
- **Environment deltas beyond D96 are uncontrolled** (derived index children, lean Layer-0,
  D80 re-cut, write-contract shapes — all live). None of them plausibly *causes*
  vocabulary-level stopping, but the comparison to the 2026-06-10 baseline is not a clean
  A/B on placement alone.
- The grounding-arm prompt is the original E7 text; per the original report's caveat, an
  L4.5-style "enumerate and *follow*" variant might behave differently — untested.
- Rig hygiene note (same as original): agents grep their own persisted curl outputs despite
  `--allowedTools "Bash(curl:*)"`; the Pod GETs still happened, validity unaffected.
- Run artifacts: `~/dev/probes/sp2-e7-rerun/runs/` (machine-local, gitignored convention);
  Pod trap state snapshotted to `runs/pod-state/` before cleanup.

## Actionable

1. **Make `mem:hasOpenAction`'s `rdfs:comment` decision-laden** (supply-side, cheap): state
   that the pending activity may contest the resource's governed content and that consumers
   should dereference it before treating governed values as current. Re-run g-arm to measure.
2. **Define `sub:bodyHash` in the substrate ontology** (it is emitted on every `.meta` and is
   currently undefined — a grounding-budget tax surfaced by 2/3 runs).
3. The disposition-bundle (pod-navigate) already carries audit+ground combined — this re-run
   reinforces that grounding-only is not a sufficient lever and the bundle should stay paired.
