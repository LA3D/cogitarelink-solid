# Agentic Progressive-Disclosure Contract — design foundation (spine)

**Status:** FOUNDATION / SPINE — converged in the 2026-06-10 brainstorm. The model, the
contract, the declarative substrate it sits on, the hook rules, and the write-side invariant
are **settled**. **Build approaches are DEFERRED to the next session** (this is not yet a
buildable plan — see §10). This doc exists to bank the spine so it isn't lost and to fold in
the follow-ups it subsumes (§9).

**Amended 2026-06-10 (same day, post-review with Chuck; spine unchanged):** sanity-check
corrections (D82 named as a hard dependency, auth-gated provenance, derived-view
self-description in §7); two contract refinements (§3: disclosure-vs-operation split,
per-component consumption profiles); the §6.1 three-station quality partition (floor /
write-disposition / curation-loop, partitioned by decidability + the unrecoverability of
agent-only context); and the §12 hypothesis→behavioral-measurement map (two NEW queued probes:
the write-side E5b twin, the generalization probe against operation-shaped apps).

**Lineage:** continues RQ-Substrate-4 / D70 stratification; consumes the E5 (audit) + E7
(grounding) read-path results (`docs/research/2026-06-08-read-path-salience.md`) and the
RQ-Discovery-1 index-view result (`docs/plans/2026-06-10-rq-discovery-1-index-view-report.md`);
builds on the interop+ShapeTree foundation (`docs/superpowers/specs/2026-06-02-interop-foundation-design.md`,
D109/D110). Supersedes the framing of the 📐 "progressive disclosure + profiles reconciliation"
FOLLOWUPS section by absorbing it (§9).

---

## 1. Problem

A Solid Pod hosts **multiple agentic applications / memory systems** (wiki-memory, a
gBrain-style memory, AddressBook, identifier-schemes — already two live on this Pod), each with
its own access patterns, some composing with each other. A generic agent arriving cold must get
from "this is a Solid pod with LDP containers" all the way to "I understand how to *use* this
application's memory." Today that path is a **pile of hand-instantiated mocks** — a mocked index
view, a Layer-0 disposition literal, a prompt-injected disposition — with no consistent
construction. The design must make progressive disclosure a **uniform, derived process**, not
bespoke per-surface hacks, and it must be **application-agnostic** (the substrate provides the
disclosure machinery; each app uses it to expose its own access patterns — the RQ-Substrate-4
principle).

## 2. The regrounded model — disclosure across *building-block layers*

Progressive disclosure is **recursive across building-block layers**, not a property of one app:

```
 S    Substrate (Solid/LDP)      universal: storage description, .well-known/solid, LDP
                                  containers, Type Index, Memento, WAC                       [D70 L1]
 Ad   Application discovery       which agentic apps / memory systems live here, and what each
                                  is → interop:Application / RegistrySet / DataRegistration   [D109/D110]
 An   Application navigation      INSIDE a chosen app: its own access patterns → the app's
                                  ShapeTree topology + AccessNeed + st:Description            [D70 L3; D87/D88]
 Ax   Cross-application links     apps as components that connect → st:references/viaPredicate [deferred]
 R    Resource / governed detail  body + describedby .meta + grounding (vocab deref) +
                                  governance/ledger/audit, on the subject the agent reasons
                                  about (the D96 fix)                                          [E5/E7]
```

The same disclosure move — **orient (read the index/overview) → drill → ground unknowns → check
governance** — recurs at every layer. The **index-view + disposition-bundle are generic substrate
mechanisms reused at every layer**, not wiki-memory-specific.

## 3. The contract (option C) — one uniform disclosure shape per layer

Every building-block layer presents itself in **one uniform disclosure shape**:
`orientation + index + grounding-pointers + governance`. An application author who fills the
shape **automatically** gets an app the general navigation discipline can walk; the substrate
guarantees the agent's single discipline works at every layer and across apps. The two build
sides are the two halves of this one contract:

- **Construct (SP2)** — the pod *materializes* the disclosure shape at each layer.
- **Consume (SP1)** — the skill+tool harness *walks* the shape, layer by layer.

**Two refinements (review, 2026-06-10):**

- **Disclosure vs operation.** The disclosure *shape* (orientation + grounding + governance) is
  universal, but the **index component is one kind of orientation**: navigation-shaped apps
  (wiki-memory) get item indexes; operation-shaped apps (addressbook = query, id-schemes =
  resolution/registration) get affordance/operation pointers. `st:Description` is where an app
  declares which it is. "One discipline" means one disclosure *entrypoint* + a declared per-app
  operation — NOT that every app is browsed like a wiki. All behavioral evidence to date is
  wiki-shaped (the E5/E7 trap, the index probe); the generalization probe in §12 tests this
  BEFORE SP2 commits to index-shaped machinery.
- **Per-component consumption profiles.** Orientation + index are consumed *naturally* by cold
  agents (index probe: a-run3 went looking for an index in the container `.meta` unprompted;
  3/3 read+used it when present). Governance + grounding are **disposition-gated** (E5b: 0/8
  below the content-laden threshold). So the contract's *routing* benefit is universal — floor
  tier included — but its *trust* benefit holds only for SP1/SP3-disposed agents. That is D55
  three-tier stated honestly: an author who fills the shape gets efficiency for everyone,
  safety only for the disposed.

## 4. The An layer is declarative — and already specced + deployed-but-inert

Per the lightweight decision (interop-foundation-design.md §"shapetrees.js is dead"): **Shape
Trees are used only as a declaration vocabulary** (emit `st:ShapeTree`/`st:Manager` triples;
resolve `st:shape` → dispatch to our existing SHACL). **No ShapeTree runtime.** An agentic
application *declares* its access patterns:

- `interop:Application` + `AccessNeedGroup`/`AccessNeed` (what it is; per-type access modes)
- ShapeTree topology (`st:contains` hierarchy; `st:shape`→SHACL; `st:expectsType`)
- `DataRegistration` (which containers hold its data) in a `RegistrySet` off the **owner WebID**
- agent-readable `st:Description`/`DescriptionSet` ("what this app/collection is for")
- *(deferred)* `st:references`/`st:viaPredicate` = the Ax cross-resource/cross-app edge topology

**Status:** the declaration layer is **LIVE but inert** — `/vault/meta/interop/` holds two
declared apps (`application` = wiki-memory, `id-schemes-application`), a `registry`, `managers/`;
`/vault/meta/shapetrees/wiki-memory.tree` exists. But the storage description doesn't lead an
agent to the RegistrySet, the owner WebID card has no `hasRegistrySet`, **nothing materializes
views from these declarations, and no skill consumes them.** The design **surfaces + materializes
+ consumes** what is already declared — it is not greenfield.

**Declare vs derive:** the app **declares** its structure + access patterns (interop + ShapeTree
— the irreducible part, done *as* building the app); the substrate **derives** the disclosure
views *from* those declarations via SPARQL. Both, partitioned.

## 5. Hook rules — partition by derivability (= D109 derive/floor/loop)

Two hook granularities, two sources, SHACL guardrails on both:

| Hook | Source | Guardrail | Mechanism |
|---|---|---|---|
| **Item entry** (per-resource: "`n09` — Write-Ahead Log: …") | **derive** from SHACL-governed resource metadata | the SHACL shape governing `prefLabel`/`definition` | SPARQL/ViewAssembler — never authored, can't drift |
| **Collection/app orientation** ("this app, its access pattern, what to audit") | **declare** in `st:Description`/`DescriptionSet` | a SHACL `DescriptionShape` requiring it | author-declared once, validated |

Deriving item entries **is** "construct consistently." Authoring them would create the very drift
the design kills (`mem:Materialization` staleness class). Collection orientation is design intent
— not in any resource — so it's declared and guardrailed.

## 6. The agentic write contract (L2 invariant) — the construct-side guarantee

**Spec floor is permissive:** LDP §5.2.3.12 makes a non-RDF resource's description resource
**MAY**-create (MUST-advertise via `describedby` only *if* it exists); the Solid Protocol makes
description resources **optional**; SAI governs access, not per-resource description existence. So
"every resource has a `.meta`" is **not** a spec requirement — it is a substrate invariant we add.

**Why we add it — the defining agentic-vs-Solid difference:** an *agent* that writes a resource
**always has the write-context** (why it made it, what task, what it concluded). Where Solid says
*MAY describe*, an agentic application says **MUST describe**.

**The partition is derivable-structure vs agent-only-context** (a Jupyter notebook is *parsable*
but not self-describing of its *circumstances*):
- **Derivable structure** — recoverable from content (prefLabel/definition; cell structure;
  nothing for a JPEG). Materialized.
- **Agent-only context** — purpose, circumstances/rationale, provenance (which agent, when, what
  task). No derivation recovers it; the agentic app carries it for **every** resource.

**The invariant:** every agent write of any resource (RDF, parsable, or binary) produces a
governed `.meta` carrying: (a) derived structural hooks where content allows, (b) agent-declared
purpose/description (the disclosure hook), (c) circumstances/rationale of creation, (d) provenance
— the writing agent's identity (**derive** from auth at write time, per the D112 `prov:agent`
gap) + the activity. Enforced by the D108 admission floor, **extended to NonRDFSource**.

**Hard dependencies (build-order facts, named here so the approaches session sequences them):**

- **D82 no-clobber.** For markdown resources the projection pipeline REWRITES `.meta` on body
  change and agent-authored enrichment does NOT survive (`test_agent_enrichment_survives_body_rewrite`
  is strict-xfail; D112 gated wiki-memory rollout on exactly this). The agent-only-context half
  of this contract requires the D82 `.meta.agent` sidecar (or equivalent no-clobber) for the
  projection-rewritten content class. Turtle-body substrates (`/id/`, contacts) sidestep it.
- **Auth.** Deriving `prov:agent` requires an authenticated WebID; the Pod runs dev-allow-all,
  so the identity component activates with the security profile (same trigger as the D112
  maturity scorer) — it is part of the contract's *design*, not of SP2's buildable surface.

**Scope (lean — confirm in approaches):** the contract attaches at **crystallization** (D73
preserved: `working/` stays low-ceremony, carrying only the derivable parts); full enforcement
on durable containers. Otherwise the contract re-introduces the write ceremony D73 removed.

### 6.1 Quality, not just presence — three stations by decidability

The floor can enforce *presence*; it cannot judge whether "Created this resource" is a vacuous
rationale — and D112's probes showed agents satisfy shapes minimally (35/35 omitted optional
`prov:agent`), so a bare MUST yields boilerplate. The governing asymmetry: **agent-only context
is unrecoverable after the write.** It exists only in the writing agent's context window; a
curator can *detect* vacuity later but cannot *reconstruct* what should have been recorded —
nobody can. Quality therefore has exactly one capture point (write time), and enforcement
partitions into three stations:

| Station | When | Catches | Mechanism |
|---|---|---|---|
| **SHACL floor** (server, synchronous) | write | everything machine-decidable: presence, datatype, minLength, anti-boilerplate `sh:not` patterns | D108 422 + ValidationReport + **content-laden** `sh:agentInstruction` — the E5b lesson applied to the write side: name the failure mode ("record the task that triggered this write, what you concluded, and why — a future agent audits this before trusting the resource; do not restate the title"). The floor demonstrably *teaches* (D112: 2×422 → corrected). Shapes are **per-app** (`st:shape`→SHACL, the An layer); the validation-report channel is uniform substrate machinery. |
| **Write disposition** (agent-side, SP1) | write | semantic quality — the ONLY station that can | the construct-side twin of audit (E5) + grounding (E7) in the SP1 bundle: declare why / what task / what was concluded, *before* POST. Carries SHACL as a **pre-flight tool** (validate locally against the app's published shapes, iterate, then write) — same shapes, two deliveries; the server gate stays the floor-tier guarantee. |
| **Curation loop** (asynchronous) | later | vacuity *rate*; drift in derivables | three jobs, none of which is repairing agent-only context: (a) **trust annotation** — flag weak-context resources so the read-path audit disposition discounts them (the consume side prices in write quality; L2 OOD-honesty operating between the contract's two halves); (b) **eval signal** — graded rationale quality is the GEPA/skill-optimization reward for the write skill; (c) **repair for derivable structure only**, where re-derivation is possible. |

The curator stays a **role** (D112: Pod state — ledger, detectors, propose-only), not a quality
gate and not necessarily a separate subagent. Keep the anti-boilerplate SHACL **shallow** until
the curation loop's sampling shows the actual vacuity rate: the threat model is
cooperative-but-lazy (D112's minimal-satisfaction finding), not adversarial — don't build the
deep SPARQL-constraint ladder pre-emptively. How much quality the floor's report buys vs the
disposition is an empirical question → the write-side E5b twin probe (§12).

**Loop closure:** this agent-authored context/provenance layer is the **same channel** the
read-path dispositions consume — "circumstances" is `mem:rationale`'s general form; "which
agent/when" is the missing `prov:agent`/`prov:wasGeneratedBy`. **The write contract (construct)
and the audit-before-trust + ground-unknown-terms dispositions (consume, E5/E7) are two halves of
one agent-authored provenance/context layer:** the `.meta` that makes a resource *disclosable*
(the hook) is what makes it *auditable* (the provenance).

## 7. Consistency = SPARQL-materialized from one declared source

Every disclosure view (the Ad app-index, the An collection indexes) is **SPARQL-materialized**
from the **single declared source** — the interop+ShapeTree graph + the governed `.meta`s — via
the ViewAssembler declared-query engine (D113). No layer is hand-mocked; none can drift from the
declarations. This is the operational meaning of "construct progressive disclosure consistently."
(The shacl-engine experimental branch — SPARQL node expressions + coverage — is a candidate engine
upgrade; see the FOLLOWUPS infra note.)

**Derived views are themselves self-describing.** Each materialized index/view carries its own
derivation provenance (source, query, when) — the substrate's own writes obey the §6 write
contract. Load-bearing, not cosmetic: the index probe showed ~1/3 of agents trust a derived
index outright (b-run2: zero confirmation GETs), so a stale materialization would be *believed*;
the `OperationsIndexListener` retraction bug is a live instance of the stale-derivation class.
The derivation marker is what the read-path audit disposition checks on a view.

## 8. Build decomposition

- **SP1 — read+write-path skill + tool harness (FIRST; the optimization substrate).** Package the
  proven disposition bundle — audit-before-trust (E5) + ground-unknown-terms (E7) +
  **declare-write-context (the §6.1 write disposition — the construct-side twin)**, content-laden
  per the E5b/E7 thresholds — plus the recursive disclosure-navigation discipline (orient → drill
  → ground → audit; recurse into the chosen app) and **SHACL pre-flight as a tool** (validate
  against the app's shapes before POST), as a **skill** (in `solid-agent-skills`) with
  the tools it needs. Eval: does a *skill-delivered* disposition reproduce the prompt-injected
  gold result? Optimized against the cold-agent eval (skill-creator / GEPA loop, Claude Code as
  executor). **Consumption-channel ordering (Chuck, 2026-06-10): skill+tool harness first; the MCP
  gateway is a later packaging on top — MCPs clog context and are hard to optimize.**
- **SP2 — the consumable pod (surface + materialize the declared layer).** Surface the entry
  point (storage description → RegistrySet; fix the owner WebID `hasRegistrySet`); materialize the
  Ad + An disclosure views via SPARQL/ViewAssembler from the interop+ShapeTree declarations; the
  D96 subject-placement fix; the agentic write contract enforcement (floor extended to
  NonRDFSource); lean Layer-0; **the profiles/roles strip-back + D80 re-cut folded in (§9).**
- **SP3 — the MCP gateway (LATER).** A packaging of the proven skill+tool layer for harnesses
  without skill access. Not designed here.

## 9. Follow-ups this spec FOLDS IN or AFFECTS

**FOLD IN — this spec subsumes these; do them as part of this view/disclosure rework, not
separately (one view-layer rework, not two):**

- **Profiles/roles strip-back** (📐 FOLLOWUPS, 2026-06-10) — KEEP `Link: rel="profile"` +
  `dct:conformsTo` + PROF descriptors *as hints* (H0-validated) + `?_profile=fused` (aggregation);
  REMOVE/DEMOTE the `?_profile=` *selection* aspiration, `?_profile=alt` introspection,
  view-authority-as-PROF-artifact (fold its content into lean Layer-0); DECIDE the configured-client
  question (selection machinery earns maintenance only if non-LLM interop partners arrive);
  **reconcile the W3C profiles + roles** (`prof:hasRole`/wikirole) with the interop+ShapeTree model
  — PROF stays a disclosure *hint*; per-type access *roles* live in `interop:AccessNeed`, not a
  parallel bespoke scheme; reconcile D86/D113 decision text. *(Chuck flagged the profiles/roles
  correction explicitly as part of this spec.)*
- **D80 re-cut** — hub-view/breadcrumb-view from handed CONSTRUCT affordances (dead surface) →
  ViewAssembler-served definition-line index views (SP2 materialization).
- **Index-view BUILD** — the validated definition-line index → SP2 An-collection materialization.
- **D96 subject-placement** — derive `mem:hasOpenAction` onto `<#this>` (not just `<>`) so the
  governance signal lands on the subject the agent reasons about (from the E7 trajectory audit).
- **Interop surfacing fixes** — seed `interop:hasRegistrySet` into the owner WebID card (not just
  the registry doc); the id-schemes `interop:Application` is not in the RegistrySet chain (Ad
  surfacing); Shape Trees namespace drift (plural `…/shapetrees#` vs interop.ttl's singular).
- **PROF hint quality** — `WIKI_CLASS_TO_PROFILE` covers only 5 classes (extend);
  `Link: rel="profile"` needs `dct:conformsTo` in `.meta` for `/id/` docs; fused-view Turtle uses
  full IRIs (add prefixes for cold-agent readability).
- **Provenance derivation** — derive the authenticated WebID at write time (D112 `prov:agent`
  gap) = part of the agentic write contract (§6).

**AFFECTS — these inform or are informed by this spec, but stay where they are:**
- **D82 `.meta.agent` sidecar / no-clobber** — promoted from "deferred broad case" to a **named
  hard dependency** of the §6 write contract for projection-rewritten resources (see §6).
- D111 data-deref / fragment-datatype pattern = an R-layer grounding supply channel (E7).
- The `pod-discover` skill + skill-acquisition (GEPA-gskill) research agenda = the SP1 consume side.
- `/llms.txt` + root-level/cross-container index + wrong-container-descent metric = deferred Ad-layer
  materialization arm.
- Format A/B (prefLabel-only vs definition-line) = SP2 hook-format experiment (the index-view
  trajectory audit found discovery is size-driven, favoring the richer format).
- `?_profile=fused` on missing base → 500; ResponseMetadata named-graph noise = materialization-quality
  bugs to clean during SP2.

**NOT folded (adjacent):** the `solid-pod invoke` sibling-repo bug (held); `ldp:inbox`; the
`OperationsIndexListener` retraction bug; OperationHandler snapshot-on-CSS-bump; security/WAC
write-gate items.

## 10. DEFERRED to next session — build approaches (the real forks)

> **APPROACHES SETTLED + SP1 BUILT + EVAL PASSED 2026-06-10** (plan
> `docs/superpowers/plans/2026-06-10-sp1-pod-navigate-skill-harness.md`; eval report
> `docs/plans/2026-06-10-sp1-skill-nav-eval-report.md`): all four forks locked with Chuck —
> (a) on-write listener-refreshed static `index.md` child + derivation provenance (probe: discovery
> is name+size-driven, conneg never reached) [SP2]; (b) ONE general `pod-navigate` skill consuming
> `st:Description`, per-app thin skills only if the generalization probe demands; (c) hand-written
> v0 seeded from the proven E5/E7/E5b content, GEPA/eval-loop later (the skill-nav rig IS that
> substrate); (d) definition-line default, prefLabel-only as a probe arm [SP2]. **SP1 shipped on
> branch `sp1-pod-navigate` (solid-agent-skills): `validate` (shacl-engine 1.1.0 spike — decision B,
> experimental 1.2 deferred) + `invoke` resource-scoped fix + `affordances` lister + the
> `pod-navigate` skill (3 baked-in dispositions; D103 deviation recorded).** Gate MET: skill arm
> **3/3 catch**, trigger 3/3 (pod-navigate fired tool-call #1, unprompted) — the skill channel
> closes the E5 bootstrap consumption leak (0/3 pod-delivered → 3/3 skill-delivered). **SP2 plan
> follows the generalization probe + these SP1 results.**
>
> **UPDATE 2026-06-11: the generalization probe RAN** (`docs/plans/2026-06-10-generalization-probe-report.md`)
> — discipline + dispositions + execution all generalize once tooling works; it found + we FIXED 3 tooling
> gaps (1 code bug + 1 feature + 1 stale descriptor), so SP2 inherits working operation-shaped execution.
> **ONE probe still queued before the SP2 plan: the write-side E5b twin** (Disposition 3 was carried in the
> SP1 skill but not exercised by the read-path trap).

Not decided here:
- **View materialization where/when** — on-write listener-refreshed static index resource vs
  on-demand ViewAssembler conneg vs cached-derived; how the index is discovered (the probe favors a
  conventionally-named, size-conspicuous child resource over conneg, consistent with H0).
- **Navigation skill shape** — one general app-agnostic disclosure-navigation skill vs a general
  skill + thin per-app access-pattern skills bootstrapped from each app's `st:Description`.
- **Hand-written vs learned** — the skill-acquisition fork (hand-authored skill vs GEPA-gskill
  learned procedure against the cold-agent eval).
- **Format A/B** — prefLabel-only vs definition-line item hooks.
- **The profiles/roles strip-back details** — the exact KEEP/REMOVE cut and the roles→AccessNeed
  reconciliation.

## 11. Open questions

- Does the **general navigation discipline** truly generalize across application *kinds*
  (wiki-memory's SKOS-broader navigation vs a gBrain-style memory vs addressbook query), or does
  each app need a thin declared "how to navigate me" beyond `st:Description`?
  **→ promoted to a queued generalization probe (§12) — run before SP2 commits to index-shaped
  machinery.** The §3 disclosure-vs-operation refinement is the working hypothesis.
- **Write-contract scope at `working/`** — the §6 lean (attach at crystallization; drafts carry
  derivable parts only) preserves D73 low-ceremony; confirm in the approaches session.
- How much of the **collection orientation** can be *derived* from the ShapeTree topology
  (`st:contains` + `st:shape` + the AccessNeed) rather than authored, narrowing what the author
  must declare?
- Cross-app (**Ax**) — when does `st:references`/`st:viaPredicate` get built (currently deferred),
  and is it derived from the governed typed-edge graph or separately declared?
- The **configured-client** decision in the profiles strip-back (keep selection machinery for
  non-LLM interop partners, or drop it) — an audience question, not a correctness one.

## 12. Hypothesis → behavioral measurement (agentic eval, not just tests)

Every mechanism in this spec encodes a hypothesis about **agent behavior**. Unit/integration
tests verify the substrate; they do not verify the hypothesis — a mechanism is not "done" at
green tests, it is done when its cold probe shows the behavior (eval-as-engineering-feedback;
the `evals/` rig pattern). The map:

| Hypothesis | Probe | Status |
|---|---|---|
| Definition-line index routes cold agents | RQ-Discovery-1, `evals/idxview` | ✅ RUN (20–30× fetch reduction; build gate cleared) |
| Audit + grounding dispositions fix over-trust | E5/E5b/E7, `evals/salience-*` | ✅ RUN (E5 3/3; E7 2/3; combined gold) |
| D96 `<#this>` placement closes the registration miss | re-run E7 after the fix | queued (cheap feed-in) |
| Format A/B — leanest hook that still routes | `evals/idxview` + prefLabel-only arm | queued (cheap feed-in) |
| **Write quality: how much does the floor's report buy vs the disposition?** (§6.1) | **write-side E5b twin** — arms: (A) presence-only floor; (B) + content-laden ValidationReport `sh:agentInstruction`; (C) + write disposition in the harness. Grade the resulting rationales (vacuous / restates-title / genuine context). | **NEW — queued (cheap feed-in)** |
| **The disclosure discipline generalizes beyond wiki-shaped apps** (§3) | index-view-style rig against the live **addressbook** app (operation-shaped: ORCID lookup); + wrong-container-descent metric | **✅ RUN 2026-06-10/11** (`docs/plans/2026-06-10-generalization-probe-report.md`): discipline + dispositions + execution all generalize once tooling works; found+FIXED 3 tooling gaps (bug/feature/data); curl arm = genuine CLI/MCP tier boundary (not a defect) |
| Skill-delivered disposition reproduces prompt-injected gold | the SP1 eval itself (skill-creator / GEPA loop, cold-agent harness) | = SP1's own gate |
| The full contract walk works cold, multi-app | end-to-end: cold agent + SP1 skill on the SP2-materialized pod; task spans Ad→An→R across two apps | after SP1+SP2 |
| Write-context quality in the wild | curation-loop sampling (continuous; doubles as the GEPA reward signal, §6.1c) | with SP2 floor extension |

Levels, in order: deterministic conformance (`make test`, floor 422s, agreement tests) →
per-mechanism cold probes (above) → the end-to-end contract walk → continuous curation-loop
measurement in operation. SP1 and SP2 each land WITH their probes, not before them.
