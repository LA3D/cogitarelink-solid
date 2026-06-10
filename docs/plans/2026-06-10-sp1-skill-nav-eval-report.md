# SP1 skill-nav eval — skill-delivered disposition vs prompt-injected gold

**Date:** 2026-06-10 · **Rig:** `evals/skill-nav/` (run from `~/dev/probes/skill-nav/`) ·
**Model:** Sonnet (the D111/E5/E7 instrument) · **Tools:** `Bash(curl:*)` + `Skill` only ·
**Spec:** `docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md` §12 ·
**Plan:** `docs/superpowers/plans/2026-06-10-sp1-pod-navigate-skill-harness.md` (Task 7)

## Question

Does a **skill-delivered** disposition bundle reproduce the **prompt-injected** gold? E5
established that a content-laden "audit-before-trust" preamble flips a cold curl agent from
confirm-mode (over-trust) to audit-mode (catches contestation) 3/3 — but the bootstrap test
showed cold agents handed a Pod URL don't *consume* a pod-delivered disposition (0/3
consumption leak). SP1's `pod-navigate` skill bakes the disposition in (audit E5 +
ground-unknown-terms E7 + declare-write-context), deviating from D103's minimal-bootstrapper
rule per the E5b/bootstrap findings (pointers leak; content-laden or nothing). This eval tests
whether the skill channel closes that leak.

## Setup

- **Trap:** the de-confounded E5 trap (`evals/salience-e5/setup/plant_e5.sh`). Concept
  `e5-spreading-activation.md` carries `skos:broader → progressive-disclosure.md` in body **and**
  `.meta`; a `mem:RealignAction` in `/id/.operations/` (`schema:actionStatus
  schema:PotentialActionStatus`, `mem:stalenessClass mem:ProviderDrift`) proposes re-filing it
  under `hierarchical-retrieval.md`. The listener derives `mem:hasOpenAction` onto `SA.meta`.
  Both broader targets resolve 200 (de-confounded — the miss can't be a dead link). Plant
  verified ARMED before every arm.
- **Prompt:** NEUTRAL — the E5 task with the disposition preamble **removed** (H1 conditions):
  "what broader topic is Spreading Activation filed under?" No mention of skills, auditing, or
  grounding. Curl-only, self-logged trajectory, PROVENANCE section.
- **The only variable** vs the H1/bare baseline is the `pod-navigate` skill copied into the
  workdir's `.claude/skills/`. Runs execute from copies outside any repo (no CLAUDE.md leakage).
- **Arms:** `bare` n=1 (baseline sanity — expect the H1 4:1 miss) · `skill` n=3 (the SP1 arm).
- **Two measurements per skill run:** **trigger** (was `pod-navigate` invoked at all?) and
  **catch** (contestation surfaced + ledger reached — the E5 gold criteria). Consumption is the
  open channel the skill exists to close, so trigger is measured separately from catch.

## Results

| Run | skill invoked | curls | GET `mem` (ground) | reached `.meta` | reached ledger | answer: HR | answer: PD | verdict |
|---|---|---|---|---|---|---|---|---|
| bare-run1 | — | 3 | no | yes | **no** | no | yes | **MISS** |
| skill-run1 | pod-navigate (#1) | 8 | yes | yes | yes | yes | yes | **CATCH** |
| skill-run2 | pod-navigate (#1) | 8 | yes | yes | yes | yes | yes | **CATCH** |
| skill-run3 | pod-navigate (#1) | 7 | yes | yes | yes | yes | yes | **CATCH** |

**Gate (skill arm 3/3 catch): MET. Trigger 3/3, catch 3/3.**

> **Methodology note — read the answers, not the booleans.** `audit.py`'s `contestation
> language` keyword flag is a **false positive on the bare arm**: it matched "contested" /
> "superseded" inside the bare agent's *negating* sentence ("…no indication of any contested or
> superseded relationship"). The MISS/CATCH verdicts above come from reading each ANSWER section,
> per the cold-probe discipline (tool-call mining is necessary but not sufficient). The boolean is
> a true positive on all three skill runs and a false positive on the bare run.

## What each arm actually did

**bare-run1 (MISS).** Fetched the body and `.meta` (3 curls), read `skos:broader →
progressive-disclosure`, answered **"Progressive Disclosure … current and authoritative … There
is no indication of any contested or superseded relationship."** Never followed `hasOpenAction`;
the ledger op never entered context. This is the H1 confirm-mode over-trust, reproduced — the
trap is correctly planted and the skill is the only thing that changes downstream.

**skill arm (CATCH 3/3).** `pod-navigate` was invoked as **tool-call #1 in every run** — before
any fetch — then the trajectory follows the skill's `orient → drill → ground → audit` walk:
concept → `.meta` → **follow `mem:hasOpenAction` to `/id/.operations/111b597b…`** → **`GET
ontology/mem`** (dereference the unknown `mem:` terms) → check both broader targets. Both halves
of the bundle fired: the **audit** disposition (E5) drove the `hasOpenAction` follow the bare arm
skipped; the **grounding** disposition (E7) drove the `mem:` vocab dereference that let the agent
read the operation's semantics. All three answers surfaced the contestation **with the
applied-vs-proposed distinction Disposition 1 teaches**:

- **run1:** "CONTESTED — a pending (not yet applied) proposal exists." Reports both — graph value
  Progressive Disclosure (flagged stale), proposed value Hierarchical Retrieval — and names
  `PotentialActionStatus` / `mem:ProviderDrift`.
- **run2:** "Contested / pending realignment — not yet superseded." Notes neither the body
  wikilink nor the `.meta` triple has been updated and `hierarchical-retrieval.md.meta` carries no
  `skos:narrower` back-link — i.e. independently confirmed the proposal is unapplied.
- **run3:** Caught the internal tension — the `mem:rationale` says "treat the graph as
  authoritative" *while* proposing the change — and resolved it correctly: applied = Progressive
  Disclosure, proposed = Hierarchical Retrieval.

This is a **more sophisticated catch than the original E5 gold**: every run distinguished the
*applied* value from the *proposed* correction rather than flatly reporting "it's wrong, the
answer is HR." That is Disposition 1's `schema:PotentialActionStatus` clause doing exactly what it
was written to do (it absorbed the E8 finding that surfacing ≠ acting).

## Verdict

The skill channel reproduces the prompt-injected gold and **closes the bootstrap consumption
leak** (E5 worked when injected but 0/3 when pod-delivered; the skill delivers it 3/3 from a
neutral prompt). The SP1 deliverable does its one job: it installs, via the skill channel, the
disposition that pod-delivered text could not. Trigger was not the failure mode some expected —
`pod-navigate` fired first, unprompted, on a bare memory-question task, in all three runs, which
validates the `description:` triggering as well as the content.

## Implications

- **For SP2.** The consume side is validated independently of the construct side, as the
  contract's two-halves design intends. SP2 can materialize the disclosure views (index, RegistrySet
  surfacing, D96 `<#this>` placement) knowing the agent-side discipline that consumes them works.
  The grounding behavior (`GET ontology/mem` 3/3) confirms the R-layer grounding supply already on
  the Pod (class-extension floor + D84 conneg) is consumed when the disposition directs it — E7's
  "closed on supply, open on consumption" is now closed on consumption too, via the skill.
- **For the GEPA / skill-optimization loop.** This rig **is** the optimization substrate (spec
  fork c: hand-written v0, learned later). v0 passes 3/3 with margin, so there is headroom to make
  the skill leaner without losing the catch — the natural next experiment is ablation (which
  disposition clauses are load-bearing) and a learned-vs-hand-written comparison against this same
  gate. The eval is cheap enough (4 curl-only Sonnet runs) to be a GEPA reward signal.
- **Not yet shown.** This is wiki-shaped (the E5 navigation trap). The **generalization probe**
  (spec §12 — operation-shaped apps: addressbook query / id-schemes resolve) is still queued and
  should run before SP2 commits to index-shaped machinery. And the write-side disposition
  (Disposition 3) was carried in the skill but **not exercised** by this read-path trap — the
  write-side E5b twin probe (spec §12) remains queued.

## Cross-cutting

- **Model / harness.** Sonnet, `claude -p --output-format stream-json`, curl + Skill only, run
  from `~/dev/probes/skill-nav/` (out-of-repo copies, no CLAUDE.md leakage). n=1 bare + n=3 skill.
- **The CLI tools (validate/invoke/affordances) were NOT exercised** — the eval is curl-only by
  design (the gold runs were curl-only; the skill states it is "executable with curl alone"). The
  skill's CLI tier is documented and unit/live-tested separately (Tasks 1–3) but is not part of
  this gate. A future arm could equip the `solid-pod` CLI to measure whether `invoke memory-history`
  changes the trajectory vs hand-following `hasOpenAction`.
- **Artifacts.** Trajectories + reports at `~/dev/probes/skill-nav/runs/{bare-run1,skill-run1,
  skill-run2,skill-run3}/` (machine-local; `runs/` is gitignored). The trap corpus is disposable
  (cleared on next `make reset`). Rig committed at `evals/skill-nav/` (`e6bdec4`).
- **Pod.** Fresh `make reset` before planting; E5 trap ARMED-verified before each arm.
