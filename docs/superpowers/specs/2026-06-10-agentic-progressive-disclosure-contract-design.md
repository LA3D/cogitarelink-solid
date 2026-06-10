# Agentic Progressive-Disclosure Contract — design foundation (spine)

**Status:** FOUNDATION / SPINE — converged in the 2026-06-10 brainstorm. The model, the
contract, the declarative substrate it sits on, the hook rules, and the write-side invariant
are **settled**. **Build approaches are DEFERRED to the next session** (this is not yet a
buildable plan — see §10). This doc exists to bank the spine so it isn't lost and to fold in
the follow-ups it subsumes (§9).

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

## 8. Build decomposition

- **SP1 — read-path skill + tool harness (FIRST; the optimization substrate).** Package the
  proven disposition bundle — audit-before-trust (E5) + ground-unknown-terms (E7), content-laden
  per the E5b/E7 thresholds — plus the recursive disclosure-navigation discipline (orient → drill
  → ground → audit; recurse into the chosen app), as a **skill** (in `solid-agent-skills`) with
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
- How much of the **collection orientation** can be *derived* from the ShapeTree topology
  (`st:contains` + `st:shape` + the AccessNeed) rather than authored, narrowing what the author
  must declare?
- Cross-app (**Ax**) — when does `st:references`/`st:viaPredicate` get built (currently deferred),
  and is it derived from the governed typed-edge graph or separately declared?
- The **configured-client** decision in the profiles strip-back (keep selection machinery for
  non-LLM interop partners, or drop it) — an audience question, not a correctness one.
