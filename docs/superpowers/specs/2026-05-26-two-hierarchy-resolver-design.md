# Two-Hierarchy Wikilink Resolver — Design

**Date:** 2026-05-26
**Branch:** `rq-listener-1-provenance`
**Status:** Design (brainstorming output; pre-implementation-plan)
**Decisions in force:** D105 (two-hierarchy commitment), D106 (Type-Index addressing),
D36 (`{.class}`→predicate), D81 Model A (subject-invariant), D8/D78 (Type Index =
class→container), D98 (8-shape catalog), D100 (L4 extension contract), D55 (three-tier
access), D104 (self-describing substrate + curator).

---

## 1. Problem

A body wikilink `[[Title]]{.hint}` projects to an RDF edge in the page's `.meta`
sidecar (D58/D71 dual-layer linking). Two questions must be answered when projecting:

1. **What predicate?** — Settled. The `.hint` *is* the edge type (D36). The vault
   methodology (`Linked Data Affordances in Markdown.md`, `Affordance Spectrum for
   Agentic Memory.md`) is explicit and canonical: the class hint denotes the **edge
   type (RDF predicate)**, never the target's type. `HINT_TO_PROJECTION` maps hints to
   `dct:`/`schema:`/`cito:`/`skos:` predicates.
2. **What container does the target IRI live in?** — *This is the open problem.* The
   interim fix (`07217fe`) retired the broken `pages`/`sources` role→container map and
   defaults everything to `concepts/` (plus `author`→`people`). Links resolve to live
   containers, but the routing is not yet class-driven, so a target whose true class
   routes to a non-default container (a Place, an Organization, an Event) gets a
   wrong/dead object IRI.

The interim `HINT_TO_CONTAINER` is a layer violation: it routes the *container*
(an addressing/RDFS concern, D105) off the *hint* (a content/SKOS concern). D106
commits to resolving the container from the target's **class via the Type Index**,
never from the role.

### The methodology constraint that shapes everything

Because the hint is predicate-only, the projector **cannot** know that bare
`[[Notre Dame]]` is an Organization — and per the methodology it must not pretend to.
The target's true class is the target resource's own concern (set when *it* is
authored with its own type), not the linking page's (D81 subject-invariant). This is
the same category error resolved in RQ-Listener-1: a page must not assert facts about
another resource.

---

## 2. Decision

Resolve the container from the **range-class entailed by the predicate**, routed
through the **live Type Index** — not from the hint, and not by a write-time existence
probe.

```
hint ──HINT_TO_PROJECTION──▶ predicate ──range entailment──▶ class ──Type Index──▶ container
 (D36, content/SKOS)         (unchanged)   (RDFS, D105)        (D8/D78, addressing)
```

- `schema:affiliation` → `schema:Organization` → `organizations/`
- `schema:location` → `schema:Place` → `places/`
- `dct:contributor` (author) → Person → `people/`
- `dct:source`, `skos:related`, `skos:broader`, `cito:extends`, `cito:agreesWith`,
  `cito:disagreesWith`, `cito:cites` → broadly `skos:Concept` → `concepts/`
  (`wiki:Source ⊑ skos:Concept` per D98)

The entailment is grounded in the predicate's **`rdfs:range`**, not in overloading the
hint with a class. The hint keeps its canonical predicate-only meaning.

### Approaches rejected

- **Hint carries the class** (`[[Notre Dame]]{.organization}`). Rejected: `.organization`
  is not an edge type; this overloads the hint against the methodology.
- **Projection-time existence probe.** Rejected for the write path: the projector would
  fetch each target to read its `rdf:type`, reintroducing the re-entrant-lock hazard
  (D92) and write-time I/O. Authoritative cross-container resolution is *reconciliation*
  (§5), not projection.

---

## 3. Component — Resolver mechanism

**File:** `css/extensions/markdown-projection/src/wikilinkProjection.ts` (pure) +
`src-cjs/listener.ts` (holds the live Type Index via `TypeIndexLoader`).

- Replace `HINT_TO_CONTAINER` with a small `PREDICATE_TO_CLASS` map covering only the
  built-in predicates whose range entails a routable class. Predicates with a broad
  `skos:Concept` range entail nothing specific → default `concepts/`.
- `class → container` resolves through the **live Type Index**. The listener already
  loads it and injects `typeIndex` into the pure pipeline; inject the resolved target
  container the same way. `projectWikilink`/`projectionPipeline.run` stay **pure** — no
  network, no store access. The only "lookup" is the in-memory Type Index map.
- `author`→`people` survives only because `dct:contributor`'s range genuinely entails
  Person — it collapses into the general mechanism rather than remaining a special case.

### Purity boundary

The Type-Index read belongs in the **listener** (which has `TypeIndexLoader`), not the
pipeline. Pure unit tests run the pipeline with an injected fixture map and no live
index. This mirrors the existing `typeIndex` threading.

---

## 4. Component — Extensibility

A closed hardcoded `PREDICATE_TO_CLASS` breaks where multiple ontologies define the
same concept ("a person" = `foaf:Person`, `schema:Person`, `dct` Agent, `prov:Agent`).
Routing must **not** key on the specific class IRI.

- **Routing key = class → container via the Type Index** (already L4-extensible, D100).
  Multiple person-classes all route to `people/` through their Type Index registrations
  + `skos:exactMatch` correspondence (D106 cross-scheme rule; never `owl:equivalentClass`).
- **Predicate → expected-class extends via declared ranges.** An L4 extension's new
  predicate declares its `rdfs:range` in the extension's vocab; the §6 sanity-check
  confirms that range-class is Type-Index-registered. The projector's built-in map stays
  small (common predicates); extensions contribute their own range→class, validated at
  audit time rather than enumerated in TypeScript.

So the entailment set is **open** at the Type-Index + range-declaration layer, closed
only for the built-in common predicates.

---

## 5. Component — Forward references & reconciliation

A wikilink whose target does not resolve to a live resource (normal in a wiki; also any
target actually living in a non-default container the projector couldn't predict) is:

1. emitted to its best-effort container (the entailed class's container, else
   `concepts/`),
2. marked **provisional**, and
3. flagged via the existing `mem:StalenessDetected` / dangling-reference machinery.

The **pod-curator** does authoritative cross-container resolution asynchronously — it
already walks the Pod and owns this loop. The costly I/O lives there, off the write path.

---

## 6. Component — Range sanity-check

A validation step runnable in CI and by the curator, checking `PREDICATE_TO_CLASS` (and
any extension-contributed range→class) for consistency:

- **Type Index coverage (ERROR):** every entailed class must be Type-Index-registered;
  otherwise class→container cannot route.
- **Published-range agreement (WARN-with-rationale):** each entailment is checked against
  the predicate's published `rdfs:range` (schema.org/dct). Agreement passes; a deliberate
  narrowing (e.g. picking Person for the `schema:attendee` Person∪Organization union)
  emits WARN-with-rationale, not ERROR — narrowing a union for routing is allowed but must
  be visible.
- **Drift guard:** the projector's built-in map vs the self-described entailment (§8)
  must agree — mirrors the existing `check-validator-tbox` drift-guard pattern.

**`attendee`/`organizer` union decision:** these range over Person∪Organization. Default
behavior: **fall through to `concepts/`** (no narrowing) unless the eval shows a concrete
need to narrow to Person. Recorded as WARN, not silently picked.

---

## 7. Component — The epistemic boundary & guardrail architecture

The deeper risk is not the projector — it is the agent reading memory via progressive
disclosure and **entailing the target's class from the predicate's range without
resolving the target**, then propagating that ungrounded type into new memory.

Three things an agent can know from `[[Notre Dame]]{.affiliation}`, with different
grounding:

1. **The edge** — grounded by the token itself (it *is* the hint's meaning). Safe to
   read shallowly.
2. **The target IRI** — resolved/guaranteed by the substrate. Safe.
3. **The target's class** — *a hypothesis until the target is resolved.* RDFS range is
   only a sound entailment if the data is consistent; the author may have misused the
   edge, the range may be a union, or the target may not exist yet.

**Guardrail principle:** the edge is grounded; the target's type is a hypothesis until
resolved. The predicate's range is the substrate's *addressing expectation* and the
agent's *prefetch hint* — never a fact about the target. Authoritative class comes only
from the target's own `<#this> a …`. (This is the L2 OOD-honesty invariant and the D81
subject-invariant.)

### Guardrails are a function of the access tier (D55)

Instructions are probabilistic (nonzero ignore-rate); deterministic tool guardrails are
what catch the leak — and a deterministic guardrail can only exist where we own the tool
that mediates access. Compare Claude Code's Edit tool refusing to run without a prior
Read. Defense in depth, mapped to where each line can act:

| Line | Tier | Mechanism | Strength |
|---|---|---|---|
| **Surface** | brute-force / curl + all | `wiki:expectedClass` on the edge statement (non-asserting, D81-safe) + epistemic prose | floor; cannot enforce |
| **Enforce** | skill / CLI | `resolve-before-assert` (read-before-edit analog); reads return grounding-tagged edges; writes block on unresolved target-type claims; auto-prefetch makes the right path the cheap path | deterministic |
| **Reconcile** | curator (async) | §6 range sanity-check detects edge-vs-target-type divergence as a staleness/dangling finding | backstop |

The curl tier **cannot** be fully guardrailed — and that is intentional per D55 (lower
tiers stay functional, guarantees increase with tool adoption). We make curl
safe-by-surfacing and honest about its limits, make the skill tier safe-by-enforcement,
and treat the gap between them as a measured quantity (§9).

### Scope boundary

This spec delivers the **Surface** line (data-layer `wiki:expectedClass` + self-description
§8) and the **Reconcile** line (§6 curator check). The **Enforce** line — skill-layer
`resolve-before-assert` in `solid-agent-skills` — is a **follow-on spec**, gated on the
§9 eval quantifying the need. We do not build skill enforcement before the eval shows
agents token-entail.

**`wiki:expectedClass` is built in this spec (Tier-2 surfacing), not deferred.** It
annotates the edge statement (owned by the current page — D81-safe), surfacing the
routing expectation while signposting "confirm by resolving." It never writes
`<target> a Class`.

---

## 8. Component — Agentic self-description

Embed the model where a cold agent looks, so it is learnable from the Pod itself:

- **Storage-description entry-point `sh:agentInstruction`** — also closes the lone
  remaining audit WARN. States: the wikilink form (`[[Title]]{.hint}`, hint = edge
  type/predicate); container comes from the predicate's range-class via the Type Index,
  not the hint; the target's type is a hypothesis until `<target#this>` is resolved;
  dangling refs are reconcilable.
  **Implementation constraint:** `StaticStorageDescriber` emits only NamedNodes (IRIs),
  not string literals (audit-sweep finding, FOLLOWUPS 2026-05-24). A literal
  `sh:agentInstruction` therefore requires a tiny custom StorageDescriber yielding the
  literal quad on the storage subject (≈ the MementoLink writer pattern), or surfacing
  the prose via the dogfood doc + a `wiki:` pointer instead. Pick during the plan.
- **Dogfood doc resource** — crystallize the vault note `Two-Hierarchy Memory Addressing`
  into `/wiki/concepts/`, carrying machine-followable `dct:references` to W3C *Using OWL
  and SKOS* (https://www.w3.org/2006/07/SWD/SKOS/skos-and-owl/master.html) and the ESCO
  model (https://ec.europa.eu/esco/lod/model), so the agent can dereference the prior art.

---

## 9. Component — Cold comprehension eval (acceptance gate)

After deploy (`make reset`), run a cold HTTP-only agent (no hints, no repo) on a task
that exercises the two-hierarchy distinction **and traps the failure mode of §7**.

- **Task:** create a concept that cites a source, links a person, sits under a `broader`
  topic, and includes at least one **trap link** — a `{.affiliation}` edge (or a genuine
  `{.attendee}` union) pointing at a target whose *actual authored class* violates the
  range expectation.
- **Measurements (three axes per D102):**
  - *Form:* did the agent write the correct wikilink form (hint = edge type)?
  - *Addressing vs navigation:* did it reason about `broader`-navigation vs
    `subClassOf`/container-addressing correctly, resolving containers via the Type Index?
  - *Grounding (the trap):* on the trap link, a **grounded** agent resolves the target
    and reports its real class; a **token-entailing** agent reports the range-expected
    class. The divergence *is* the measurement of the §7 failure mode.
- **Cross-tier delta:** run the trap at both the **curl tier** (surfacing only) and the
  **skill tier** once enforcement exists (follow-on). The safety delta —
  "tool-mediated access reduces ungrounded-entailment errors by X%" — is a headline
  Rung 1.5 result and tells us whether skill enforcement was necessary.

We learn from the gaps and iterate (same protocol as the 2026-05-26 cold probes).

---

## 10. Testing

- **Unit (pure pipeline):** `PREDICATE_TO_CLASS` routing (each entailed class → correct
  container via an injected Type Index fixture); default `concepts/` fallback; `author`
  via range; provisional/dangling emission for unresolved targets; `wiki:expectedClass`
  edge annotation present and non-asserting (no `<target> a Class` quad); pipeline purity
  (no I/O).
- **Sanity-check (§6) as a test:** Type-Index-coverage ERROR cases; published-range
  agreement WARN cases; drift guard between projector map and self-described entailment.
- **Integration (`make reset`):** an authored concept with `affiliation`/`location`/
  `author`/`source`/`related`/`broader` links lands the correct object IRIs; a forward
  reference emits provisional + `mem:StalenessDetected`; storage-description carries the
  entry-point `sh:agentInstruction` (audit WARN clears); the dogfood doc resolves with
  its `dct:references`.

---

## 11. Out of scope (follow-on / deferred)

- **Skill-layer `resolve-before-assert` enforcement** → follow-on spec in
  `solid-agent-skills`, gated on §9 eval evidence.
- **Runtime TBox-driven dispatch** (reading ranges/context at write time) — kept
  hardcoded-+-drift-checked per D79; revisit only if extensibility pressure demands it.
- **Narrowing `attendee`/`organizer` unions to Person** — only if the eval shows need.
- **Branch PR split** (RQ-Listener-1 collapse vs two-hierarchy work) — integration
  hygiene, tracked separately in FOLLOWUPS.

---

## 12. References

- Methodology: vault `Linked Data Affordances in Markdown.md`, `Wiki-Memory L3 Profile.md`,
  `Affordance Spectrum for Agentic Memory.md`, `Memory Substrate vs Memory Profile.md`.
- Decisions: D105/D106 (`.claude/skills/decision-lookup/decisions.md`), D36, D81, D8/D78,
  D98, D100, D55, D104.
- Prior interim fix: commit `07217fe`. FOLLOWUPS "NEXT SESSION — D106 real fix".
- External prior art for self-description `dct:references`: W3C *Using OWL and SKOS*;
  ESCO LOD model (ESCO "Pattern C": extension class `rdfs:subClassOf skos:Concept`).
