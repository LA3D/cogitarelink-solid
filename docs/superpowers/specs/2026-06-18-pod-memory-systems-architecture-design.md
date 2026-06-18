# Pod memory-systems architecture — operational data vs externalized memory

**Date:** 2026-06-18
**Status:** approved (brainstorm), pre-plan
**Relates to:** D58/D71 (dual-layer linking + `foaf:primaryTopic` bridge), D87/D88 (overlay/capability
substrate), D96 (Page/Thing split), D108 (admission floor), D109 (derive/floor/loop partition),
D112 (curation loop), D116 (provenance-scoped projection), D117 (shape-governance reconciliation —
the write contract this design re-scopes). Supersedes the framing in D117 that the agentic write
contract is uniform across all three lanes.
**Grounding:** Zhou et al. 2026, *Externalization in LLM Agents* (`@zhou-2026-externalization`, the
four-dimension memory taxonomy); Lee et al. 2026, *Meta-Harness* (`@lee-2026-meta-harness`, the
method half); Verborgh's dual-substrate / Shape-Trees arc (`docs/research/2026-06-12-solid-design-intent-harmonization.md`);
the `agentic-app-construction` skill (the narrative-vs-operational substrate lens).

## Why

D117 shipped the agentic write contract (`mem:rationale` MUST accompany every durable write) and
framed the goal as making it **uniform across all three lanes** (wiki, addressbook, id-schemes). The
RDF-native lanes (Tasks 7/9) were deferred. Pulling that thread surfaced a category error: **the
contract was being imposed on an application that isn't memory.**

AddressBook is a **traditional linked-data application** — the kind Shape Trees and Verborgh
envisioned: stateless views over shape-governed data, where the **shape (vcard) is the contract**.
`mem:rationale` is **memory-substrate vocabulary** (the L2 "explicit write + provenance" invariant,
surfaced in the wiki-memory L3 profile). Requiring it on a contact card imposes memory semantics on
data that isn't memory. SP2 already hard-required it (`contact-card.shacl.ttl` has
`mem:rationale sh:minCount 1`), so the conflation is deployed.

The fix is not to finish unifying the contract — it is to **stratify the Pod into operational data
and externalized memory**, give each its own write/retention policy, and connect them through an
explicit crosswalk. This design states that stratification and the policies that follow from it.

## The frame: two kinds of thing, memory in four dimensions

The Pod is a **general substrate** (D87) hosting two kinds of thing:

- **Operational substrate** — traditional linked data for the agent's *tool-calling* loop:
  canonical, schema-validated, deterministic. The vCard addressbook. Governed by domain shapes; **no
  memory contract**.
- **Externalized memory** — state across time for the agent's *reasoning* loop. Stratified by Zhou's
  four content dimensions, which matter **because each has different write / promotion / retention /
  retrieval policies** (collapsing them is the documented failure mode).

This is the `agentic-app-construction` narrative-vs-operational lens, now named with Zhou's taxonomy
and consistent with the project's own L2 invariants (tiered retrieval = per-dimension retrieval
policies; lifecycle metadata = write/promote/retrieve/compress/forget; separable procedural memory =
Zhou splitting *skills* out of memory — so the addressbook's affordances/templates are the *skills*
quadrant, not a memory dimension).

| Layer | Zhou dimension | Substrate on this Pod | Status | `mem:rationale`? |
|---|---|---|---|---|
| Operational | personalized — *canonical facts* | vCard addressbook (vcard shapes only) | exists | **no** (vcard is the contract; standard `prov:` is L1-fine) |
| Memory | personalized — *social graph* | relationship classification | net-new | only on judgment classifications |
| Memory | semantic | wiki person/concept notes (incl. `wiki/events/` = event-*concepts*) | exists | on materialized facts, as evidence |
| Memory | episodic | interaction store (emails, meetings, brainstorming) | **net-new** | **native** — the "why" *is* the precedent value |
| Memory | working | agent session | not persisted | — |

**Net-new finding (grounded 2026-06-18):** the episodic *interaction* dimension does not exist today.
`wiki/events/` governs `schema:Event` knowledge-*concepts*, not interaction records; `.operations/`
is a substrate operation-provenance ledger (`as:Announce` + `mem:*Action`) — episodic *about the
Pod's own writes*, not about agent/user interactions. `.operations/` is the **structural template**
(append-only `as:Activity` + provenance) for the new episodic store, not a thing to retrofit.

## The crosswalk — couplings between dimensions

Memory dimensions and the operational tier are joined, not merged. Two coupling mechanisms:

1. **Bridge predicate.** Information objects about the same person in different substrates (vCard,
   person-note, interaction records) declare a shared referent. wiki-memory already declares a
   `foaf:primaryTopic` bridge *capability* (`foaf-primarytopic-bridge.ttl`), but the one live
   wiki→contact link (`marie-curie.md.meta`) uses `schema:sameAs`. **Open item — reconcile to one
   predicate** (see Open Questions).
2. **Tier-jump breadcrumb.** A lightweight pointer on the canonical/operational tier signalling
   "richer memory exists here." This is a **retrieval coupling, not a write contract**: it lets a
   canonical-fact lookup ("Bob's email") stop at the vCard and pay nothing, while a context-bearing
   query follows the breadcrumb into the memory dimensions. The breadcrumb is the reconsidered
   "agentic breadcrumb" — a one-triple legibility signal, distinct from the `mem:rationale` write
   contract we removed from the vCard.

The breadcrumb exists **only when memory exists**: the default contact is just a vCard, with no
breadcrumb and no memory entry. Memory (and its breadcrumb) materialize when there is context worth
keeping — keeping the common case cheap and the memory layer sparse and meaningful.

## Classification + promotion — the settled policy

Relationship classification (friend / coworker / collaborator / acquaintance) is **personalized
memory**, and how it is produced is the same `derive/floor/loop` partition (D109) the rest of the
substrate uses. The classification fork and the episodic→semantic/personalized promotion fork are
**the same line, seen from two sides**:

- **Structural / countable** (coworker, collaborator, frequent-contact) — derivable from episodes +
  org data → **derive-on-read**. An affordance/SPARQL computes "people I've co-worked with ≥ N
  times" on demand. No materialized triple, no drift, no curation cost. Always current.
- **Judgment** (friend, mentor, trusted-advisor) — not derivable by counting → **materialize-on-
  consolidation**. A consolidation step writes the fact onto the person-note carrying **evidence**
  (`prov:wasDerivedFrom` the justifying episodes) + **`mem:rationale`**, and the materialized fact is
  guarded by the **curation/realignment loop (D112)** because it can drift from the episodes.

Consequences:

- **`mem:rationale` lives only on the memory dimensions** — episodic interaction records (native; the
  why is the precedent) and judgment-promotion facts (as evidence). It is **never** on the vCard.
  Standard `prov:` provenance (who/when, L1, Solid-standard) may sit on any agent-written resource,
  including a contact — that is a different thing from the memory rationale contract.
- **Agentic guidance** (the instruction to *structure* a person into a category, and to capture the
  why) attaches at the judgment/classification step — `sh:agentInstruction` on the relevant memory
  shapes/affordances — and nowhere on the operational tier.
- The two query modes are served by construction: "Bob's email" → vCard (recognition-retrieval, no
  memory touched); "which collaborators should I invite to X?" → derive-on-read structural query
  and/or follow the breadcrumb into materialized judgment context.

## What this does to the original Tasks 7-9 (D117)

The deferred RDF-native unification is **re-scoped, not resumed**:

- **De-conflate addressbook:** remove the `mem:rationale` `sh:property` from the vcard shapes
  (`contact-card`, `organization-card`, `group`, `membership`); do **not** inject
  `sub:WriteContractShape` into `/vault/contacts/`. AddressBook is governed by vcard domain shapes,
  full stop. The ShapeTree↔layout reconciliation (the tree mis-describes the subcontainer layout and
  omits Group/Membership) then becomes a **purely vcard-domain interop fix** with no contract overlay
  riding on it.
- **id-schemes:** classify it (operational reference infrastructure vs memory) before deciding
  whether its `mem:rationale` stays — a separate call (Open Questions).
- The D117 "uniform write contract across all three lanes" framing is corrected: the contract is a
  **memory-substrate invariant**, not Pod-wide. (The D117 deferral was fortunate — it kept the
  conflation from spreading past what SP2 had already done.)

## Scope / decomposition

This is an **architecture spec**, not a single implementation plan. It decomposes into separate
plans, each spec → plan → implement on its own:

1. **AddressBook de-conflation + vcard-domain ShapeTree↔layout fix** — the original Tasks 7-9,
   correctly scoped. Buildable now, low risk.
2. **The crosswalk** — bridge-predicate reconciliation + the tier-jump breadcrumb.
3. **Episodic interaction substrate** — net-new, modeled on the `.operations/` ledger pattern.
4. **Classification scheme + derive-on-read affordances** — the SKOS relationship scheme + the
   structural-relation queries.
5. **Judgment-promotion + curation machinery** — the materialize-on-consolidation path. **Research-
   flavored:** Zhou gives structure, not method; this wants cold probes (does an agent promote with
   good evidence? does the curation loop keep materialized judgments honest?), consistent with the
   project's eval-as-engineering-feedback posture. Meta-Harness is the north-star for *later*
   optimizing these policies via an outer loop over the Pod's own execution traces (`.operations/` +
   Memento), not a blueprint for v0.

## Open questions (resolve in the per-piece plans)

- **Bridge predicate:** `foaf:primaryTopic` (the declared capability) vs `schema:sameAs` (the
  realized usage). Pick one and make the other a deprecation. `foaf:primaryTopic` is the documented
  convention and reads correctly (the page/card/record are *about* the agent); `schema:sameAs`
  asserts identity between the information objects, which is arguably wrong (a wiki note is not the
  same thing as a vcard card). Lean: `foaf:primaryTopic`, but settle it in the crosswalk plan.
- **Breadcrumb form + direction:** which predicate carries the tier-jump signal, and whether it is
  forward (vCard → memory), backward (memory → vCard), or both. The cheap-lookup path needs the
  forward signal to be one lightweight triple.
- **id-schemes classification:** operational reference data (→ drop `mem:rationale`, like
  addressbook) or part of the agent's memory (→ keep it; registering a scheme is a curation act). The
  D111 cold probes were built around it having the contract; do not fold it in silently.

## Out of scope (YAGNI)

- The **working** dimension as a persisted Pod substrate — it is the agent's live session; no
  on-Pod store. (Revisit only if cross-session working-state handoff becomes a requirement.)
- **Skills** externalization (Zhou's second quadrant) — already covered by the affordance/template
  machinery (D52/D88); not re-opened here.
- **Meta-Harness-style outer-loop optimization** of the memory policies — named as the eventual
  direction; v0 policies are hand-designed and probe-validated first.
- A **WAC/security profile** for the personalized + episodic dimensions — they are the most
  privacy-sensitive tiers (Zhou: personalized memory is privacy-constrained), and the security
  profile is where access control for them lands, but that remains the separately-deferred identity
  work, not this design.
```
operational (vCard) ──breadcrumb──▶ memory
   personalized            personalized (classification): structural=derive-on-read
   canonical facts                                          judgment=materialize+evidence+rationale
        │                  semantic (person/concept notes) ◀──promote(evidence)──┐
        └──foaf:primaryTopic──────────┘                                          │
                                       episodic (interaction store, net-new) ────┘
                                          native mem:rationale; .operations/ pattern
```
