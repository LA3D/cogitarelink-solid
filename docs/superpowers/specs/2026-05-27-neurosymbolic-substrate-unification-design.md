# Neurosymbolic Substrate Unification — Design

**Date:** 2026-05-27
**Status:** Brainstorm output. **Refinement input for the next session**, not an
implementation plan. The decision record (D-number) this resolves to is itself an
*output* of the next step — see RQ-Substrate-4. No code is prescribed here; the next
session turns this into "what do we actually build."
**Lineage:** RQ-Substrate-4 (vault-application contamination). Continues the
2026-05-26 two-hierarchy work and the 2026-05-27 cold-probe eval
(`docs/plans/2026-05-27-two-hierarchy-eval.md`).
**Skill:** produced via `superpowers:brainstorming`.

---

## 1. The problem we started with

The presenting problem was **URI consistency** (RQ-Substrate-4): the `/vault/wiki/`
path carries application bias. Two independent cold-agent probes (2026-05-26,
2026-05-27) made the identical misread — `wiki` → "a MediaWiki-style *application*" —
and the `wiki:` vocabulary prefix on storage-description properties compounded it. The
substrate was grown *forward from the Obsidian vault* (PARA + SKOS + wiki metadata)
instead of *backward from LDP fundamentals + dual document/graph views* (Verborgh), so
application concerns leaked downward into what should be a general substrate.

## 2. What we discovered along the way

The substrate had already **solved bits and pieces of the real problem — and lost track
that it had.** The fragments exist; nothing names them as one system:

- Class-keyed routing (Type Index, D78/D106) is a lightweight **Data Registry**.
- The 8-shape SHACL catalog (D98) + LDP RDFS/NR split (D38) + container `.meta` +
  `ldp:constrainedBy` + the Page `<>` / Thing `<#this>` focus split (D96) together
  reimplement a **shape tree** (`st:shape` / `st:expectsType` / `st:contains` /
  `st:Manager`+`st:focusNode`) — in *live* W3C pieces, not the frozen shape-tree spec.
- Bridge predicates (`foaf:primaryTopic`; `routesToClass`, D105/D106) are
  `st:references viaPredicate`.
- The markdown-projection listener (D58/D71) is already **a materialized view**
  (token-layer body → data-layer `.meta`).
- PROF + wikirole + `sh:agentInstruction` (D86) are the `st:Description` /
  purpose-description slot.
- pod-curator + `pod_audit.py` (2026-05-24) + MemTrigger detectors (D101) +
  `mem:RealignAction` are a **periodic self-curator**.
- The template + SHACL-422-with-`ValidationReport` loop is **symbolic feedback to a
  neural author**.
- Predicate-level governance (D81 Model A) is **the neuro/symbolic boundary**.

So this is a **refinement step**: unify the scattered solved pieces into one coherent
system, name the layers, and only then decide the residual code.

## 3. Reframe

Not "de-bias `/vault/wiki/`" but: **what are the consistent layering principles for
multiple linked agentic applications on a shared, potentially multi-user Pod** —
grounded in Verborgh's dual document/graph view, aimed at *agentic* (not classical web)
applications, whose memory is task-scoped yet linked (a meeting note → the person's
contact card → the relationship/context memory = three views of one entity).

**Correction recorded this session:** the Pod is a **shared, potentially multi-user**
substrate (a deployer/owner responsible for the Pod; multiple agentic applications;
shared across agents *and* the users those agents act for). NOT single-owner;
`dev-allow-all` is a dev convenience. SAI's Authorization-Agent / multi-social-agent
machinery is therefore **in scope (future)**, not out of scope.
(Auto-memory: `shared-multiuser-substrate`.)

## 4. The unified architecture

### 4.1 Layered map

| Layer | Role | Namespaces / mechanisms |
|---|---|---|
| **L0 — Pod substrate** | Solid specs; we conform, mint nothing | LDP, WAC/ACP, Solid-OIDC, storage description; `ldp: acl: acp: pim: solid: interop:` |
| **L1 — Shared knowledge graph / data registry** | Verborgh source-of-truth graph; **one home per type**, cross-app linked | Type Index + SHACL (our live shape-tree equivalent); core ontologies `schema/skos/foaf/prov/mem:` |
| **L2 — Agentic applications (registered)** | each app = a registration record: access-needs + shapes + affordances + capabilities + app-scoped private/working memory | SAI vocabulary (`interop:` data model) over our overlay/capability machinery |
| **L3 — Building blocks / micro-apps** | reusable bundles an agent composes (identity block, provenance block, citation block) | capability catalog (D87) as the seed |

The contamination unwinds because **shared linked data routes by class (L1), not by an
app subtree**; an app's URI space (L2) holds only its private/working memory. The
"Person in `/wiki/people/` *and* `/contacts/`" fragmentation (cold-probe Confusion #3,
= Verborgh's breaking-document example) collapses into one L1 entity with multiple
views.

### 4.2 Registration, grounded in SAI

"Registering an application in a Pod" is already specified. SAI (Draft CG Report, Sept
2025) gives: **Data Registry / Data Registration** (keyed by type), **Application
Registration + Application Profile** (`interop:hasAccessNeedGroup`), **Access Needs**
(types + access modes an app needs), Social-Agent vs Application-Agent, and the
**Authorization Agent** (multi-user consent/delegation).

Adoption stance: **borrow SAI's data model as the registration vocabulary; substitute
our live Type-Index + SHACL for the frozen shape-tree typing layer** (shape-trees spec
last commit 2021, shapetrees.org down). `janeirodigital/sai-js` is the living TS impl
(releases Feb 2026; has an `authorization-agent` package + active `sai-css` CSS
integration) — so the multi-user machinery is buildable on our stack when needed.
Caveat: small single-org community; Inrupt ESS uses a competing VC-Access-Grants/UMA
model — adopting CG-SAI is picking a side (and we run CSS, the CG side).

### 4.3 Views as declarative projections

Established theory (OBDA / semantic-layer-SSOT / C-OWL microtheories /
CONSTRUCT-as-view) converges: a **consistent base + declarative view-projections to a
target signature**. The "customer means different things to sales vs marketing vs AP"
example is the canonical case; for us, **different agents ≡ different departments** —
each needs a view fit to its purpose.

A **view** = `{ target signature/vocabulary, a CONSTRUCT/SHACL projection over the
base, a PROF description, a realization mode (materialized | virtual), a
progressive-disclosure / traversal hint }`.

- **PROF** = the view's identity/description (`st:Description` slot).
- **CONSTRUCT / SHACL** = the view's definition (how it is produced).
- **conneg-by-profile** (`Accept-Profile` / QSA `?_profile=`, `?_profile=alt` =
  List-Profiles) = the view's selection/delivery (W3C WD, Oct 2023). `?_profile=` is
  the same query-affordance idiom we already use for `?ext=search-grep`.
- **Ontological views and application views are one mechanism** at different target
  signatures — not two systems.
- For LLM agents, a view is a **context-window-shaped, purpose-specific projection
  pulled through a tool, disclosed progressively, that declares its onward links.**
- **Materialized by default** for the agent read-path (cheap, re-derivable; we already
  do this in the projection listener); **virtual as the escape hatch** for views too
  dynamic/numerous to maintain.

### 4.4 Write-back: context-canonical authoring (A ∧ B)

Agents **author memory in their own view** — write-back is essential and not deferred.
The lens/view-update problem (`put : S×V → S`, hard because views are lossy) bites
*only if the base is canonical and views are derived*. So we partition:

- **B (context-canonical):** the agent's authored content is **source**, stored
  verbatim + provenance-tagged in its own context. Writing in your own view is trivial
  (no inversion). This is Verborgh's "contextualized" graph + microtheories + what our
  `.meta`/operations-log substrate already does.
- The **base / SSOT is an emergent, curator-maintained integration** over contexts;
  cross-context consistency = shared IRIs + reconciliation, not lens inversion.
- **Residual lenses** appear only when a consumer edits a *derived* view it did not
  author. Rule from the lens laws (operationalized by `SPARQL_edit`): **a view is
  writable iff its `get` admits a well-behaved `put`** — i.e. its defining query is
  restricted enough that the update is unambiguous. **Lossy/analytical views are
  read-only.** Writability is a declared, checkable property of a view.
- Provenance (PROV-O; RGPROV/DRed re-derivation) makes materialized integrations
  **re-derivable, hence sanity-checkable** — answering the materialized-fragility worry.

### 4.5 The neuro/symbolic partition (the spine)

A-vs-B is not a global switch; it is the **neuro/symbolic boundary**, and we already
have its mechanism: **D81 governed predicates.**

| Symbolic spine (A-canonical, governed) | Neural content (B-context-canonical, ungoverned) |
|---|---|
| identity (WebID/Pod-ID/`sameAs`), type system, SHACL shapes, roles, access, provenance, bridge vocabulary | narrative, interpretation, working memory, hypotheses |
| must be verifiable; agent cannot invent | asserted-in-context; defeasible; provenance-tagged |
| small, load-bearing | large, flexible |

This is **Neuro[Symbolic]** in Kautz's taxonomy (a neural engine invoking formal tools)
— the same shape as the Claude Code harness. The substrate is to its agents what
git/tests/compiler/SHACL are to me: symbolic guardrails made legible at authoring time.

**Identity is the privileged anchor** (everything else presupposes stable entity
identity). Solid gives the framework: WebID for Pod users/acting agents; AddressBook /
Pod-minted identifier for referenced non-user entities; `owl:sameAs`/`alsoKnownAs` to
external anchors (ORCID/ROR/WebID). A referenced entity is never left floating.

### 4.6 The two curators

| Role | Vault analog | Pod analog (built / partial / missing) |
|---|---|---|
| **In-workflow review sub-agent** — part of the authoring skill; checks structure, suggests interlinks + quality on the just-written memory | `/encode → /review-note` MUST-fire gate | SHACL-422 feedback (built, symbolic half); neural review half = **missing** |
| **Periodic self-curator(s)** — sweep the Pod for drift, contradiction, fragmentation, stale, orphans | `/audit`, `/curator analyze` | pod-curator + `pod_audit.py` + MemTrigger detectors + `mem:RealignAction` (**partial, real**) |

The neural→symbolic discipline: any curator judgment ("likely the same person") must be
**committed symbolically** — mint/link a `sameAs` with provenance + a confidence /
`needs-review` flag. The guess becomes an inspectable, revisable fact.

### 4.7 Identity binding: mint-first + tunable harness

- **Substrate guarantees resolvability** (FAIR-F/A): a wikilink mints a resolvable stub
  on miss (Pod IRI + `rdf:type` + label + provenance + `needs-review`). Safe and
  reversible. **Auto-unify only on a hard external anchor** (`sameAs` WebID/ORCID/ROR) —
  equality that cannot false-merge. Never merges on soft labels.
- **Reconciliation is neural and staged**, not a write-time block. The
  false-split/false-merge asymmetry favors mint-first: minting (split) is reversible by
  a merge; a false merge is the painful, hard-to-undo op — so give the dumb substrate
  the safe op and the smart curator the risky one. (Measurement order follows: ship
  mint-first; you cannot safely ship match-first without first knowing the false-merge
  rate.)
- **The behavioral lever is the tunable harness, not server matching.** The vault is the
  working exemplar: author the memory first → search-to-interlink via tools
  (Retrieval-Expansion Protocol) → if the target is missing, procedures create the
  hierarchy (route-to-MOC + bounded-branching ≤12) → `/review-note` gate. The vault's
  empirically low false-link rate is the prior that a *tuned* authoring procedure
  converges. Port that procedure into the Pod authoring skill + on-Pod
  `sh:agentInstruction` (D103/D58), measure, re-tune.
- Two error types to keep distinct: **duplicates / false splits** (mint-first's accepted
  cost; curator merges) vs **false links** (wrong interlinks; kept low by the
  search-before-link procedure).

**RQ-Identity-1 (new):** *does authoring-time entity-discovery (a tunable harness
procedure + `resolve-entity` affordance), not substrate match policy, drive identifier
reuse and round-trip consistency?* Arms: `{mint-always, mint+hard-key-unify}` ×
`{no affordance, resolve-entity affordance}`. Measures map to Rung 1.5's three axes —
trajectory (reuse attempts, context cost), outcome (duplicate rate, mergeability,
false-merge ≈ 0 under the hard-key invariant), and **round-trip consistency** (paired
author→retrieve; the diagnostic-most axis). Primary measure: TBD next session —
candidate is round-trip consistency net of curator cost.

## 5. Inventory — what is already built vs missing

| Unified component | Status | Where |
|---|---|---|
| L1 type-keyed routing (Data Registry, lite) | built | Type Index, D78/D106 |
| Shape-tree-equivalent typing | built | SHACL 8-shape catalog D98; D38; D96 |
| Bridge predicates (`st:references`) | built | `foaf:primaryTopic`; D105/D106 |
| Materialized view (token→data) | built | MarkdownProjectionListener D58/D71 |
| Purpose-description slot (`st:Description`) | built, under-wired | PROF + wikirole D86 (agent ignores `rel="profile"` — fix delivery) |
| Symbolic feedback to neural author | built | template + SHACL-422 `ValidationReport` |
| Neuro/symbolic boundary | built | D81 governed predicates |
| Periodic self-curator | partial | pod-curator + `pod_audit.py` + MemTrigger D101 + `mem:RealignAction` |
| Storage-description router | built | D44/D48/D49 |
| Two-stage commit (working→Crystallize) | built | D73 |
| Provenance | partial | `.operations/` log, `as:Announce`/`as:object`; PROV-O on triples = partial |
| Identity anchor | partial | WebID owner D89/D90; AddressBook `schema:Person` D87; `sameAs` external anchors |
| Conneg-by-profile view selection | **missing** | needs a view-processor CSS extension |
| Declarative view definitions (CONSTRUCT/SHACL + PROF identity) | **missing** | the view layer proper |
| Application Registration + Access Needs | **missing** | SAI `interop:` records; overlays are install-time Python today |
| In-workflow review sub-agent | **missing** | port the vault `/review-note` pattern |
| `resolve-entity` discovery affordance + mint-on-miss stub | **missing** | extend projection listener + an affordance |
| Authorization Agent (multi-user) | future | `sai-js` `authorization-agent` + `sai-css` when the multi-user use case lands |
| Neutral storage root (the original URI fix) | **open decision** | supersede D35 `/vault` workspace; namespace split of `wiki:` general terms |

## 6. How we approach the build — the neurosymbolic method

The build approach mirrors the architecture: **stabilize the symbolic spine first
(mostly reconciliation of existing pieces), then engineer the neural layer with
symbolic scaffolding and measure, then wire the curators.** The substrate is a *harness
for agents*; we build it the way a good harness is built — deterministic guardrails the
neural component cannot violate, plus tunable procedure the neural component follows,
plus verifiable feedback that catches drift.

Proposed sequencing (to be refined into a plan next session):

1. **Name and reconcile the spine (symbolic, mostly built).** Declare the L0–L3
   layering; mark which predicates/classes are governed (the spine) vs free; confirm
   identity invariants (resolvability + hard-key-only auto-unify). Mostly documentation +
   small alignment, since the pieces exist. This is also where the **storage-root /
   namespace decision** lands (the original URI fix): neutral root, `wiki:` general
   terms (`routesToClass`, catalogs) promoted to a substrate namespace, `wiki-memory`
   demoted to a bounded L3 profile.
2. **Mint-on-miss + resolvability (symbolic, deterministic).** Extend the projection
   listener to mint provenance-tagged stubs; hard-key auto-unify only.
3. **Port the vault authoring procedure (neural, tunable).** Authoring skill +
   on-Pod `sh:agentInstruction`: author → search-to-interlink → hierarchy-on-miss →
   review gate. Tune against the vault's false-link bar.
4. **Measure (eval-as-engineering-feedback).** RQ-Identity-1 probe; round-trip
   consistency as the diagnostic. Re-tune the skill, not the substrate. (Precedent: the
   RQ-Listener-1 collapse, where a cold-probe killed an over-design before merge.)
5. **View layer (the new build).** Declarative view definitions + a view-processor CSS
   extension exposing conneg-by-profile (`?_profile=`, List-Profiles); materialized
   default, virtual escape hatch; read-only first, writable views gated by the
   well-behaved-`put` rule.
6. **Curators.** In-workflow review sub-agent (port `/review-note`); harden the periodic
   self-curator (pod-curator + audit + MemTrigger) into the maintenance loop for
   materialized integrations.
7. **Application Registration + multi-user (later).** SAI `interop:` records; the
   Authorization Agent when a concrete multi-user/federation use case (Rung 1.5 Phase D)
   lands.

Guiding rule: **the substrate stays dumb and safe; intelligence goes in the tunable
harness and the curator agents; verifiable checks bound both.** Engineer neural
behavior, measure it, iterate — do not push judgment into deterministic server code.

## 7. Open questions for next session

1. **Storage-root / namespace** — concrete neutral layout; supersede D35; which minted
   terms move to a substrate namespace vs stay profile-level (the 4 FOLLOWUPS couplings).
2. **A∧B boundary placement** — exact governed-predicate set that constitutes the spine.
3. **RQ-Identity-1 primary measure** — round-trip-consistency-net-of-curator-cost vs
   trajectory cost.
4. **SAI vocabulary depth** — use `interop:` directly (signals SAI-alignment, future
   Authorization-Agent interop) vs keep `overlay:`/`cap:` with documented lineage.
5. **View processor scope for v1** — materialized-only vs include virtual; read-only vs
   include constrained writable views.
6. **PROF delivery fix** — promote to a consumed affordance (entry-point
   `sh:agentInstruction`, type-level view menu) vs trim as redundant with Type Index +
   SHACL. (Cold probe: agent ignores `rel="profile"`.)
7. **Identity-stub minimum viable shape** and where the `resolve-entity` affordance lives.

## 8. References

- Verborgh, *Let's talk about pods* (2022); *Shaping Linked Data apps* (2019);
  *What's in a Pod?* (QuWeDa 2022).
- Solid Application Interoperability (Draft CG Report, Sept 2025); `janeirodigital/sai-js`.
- Shape Trees spec + vocabulary (frozen 2021).
- W3C Content Negotiation by Profile (WD, Oct 2023); Profiles Vocabulary PROF (WG Note).
- OBDA: Calvanese/Corcho/Xiao (Ontop); semantic-layer / SSOT (dbt, AtScale).
- C-OWL / microtheories (Bouquet, Serafini; Guha). Computing Views of OWL (WWW'21).
- Lenses: Pierce & Schmitt; *Axiomatic Basis for Bidirectional Programming*. `SPARQL_edit`
  (ISWC'23); RGPROV/DRed RDF view maintenance.
- Kautz, *Neurosymbolic AI: The 3rd Wave* (2020) — Neuro[Symbolic].
- FAIR principles. Internal: D35, D38, D44/D48/D49, D52, D55, D58/D71, D70, D73, D78,
  D81, D86, D87/D88, D89/D90, D96, D97, D98, D100, D101, D103, D105/D106; auto-memory
  `shared-multiuser-substrate`, `substrate-vault-contamination`.
