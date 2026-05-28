# RQ-Substrate-4 URI Re-layering — Decision (D107)

**Date:** 2026-05-28
**Status:** Decision. Resolves the *URI/namespace* slice of RQ-Substrate-4. Produced
this session from the brainstorm spec `2026-05-27-neurosymbolic-substrate-unification-design.md`
(§6 step 1 / §7 Q1, Q2, Q6) after a URI-provenance audit and a Solid-standards +
Verborgh review with Chuck.
**Lineage:** RQ-Substrate-4 (vault-application contamination). Continues D84
(namespace-form migration), D35 (vault workspace), D44/D48/D49 (storage-description
router), D86 (PROF), D106 (Type-Index addressing).
**Refines:** D35 (vault is a view-host, not the privileged hierarchy).
**Supersedes (framing):** the "wiki kernel = agentic-memory kernel" framing flagged in
FOLLOWUPS contamination item 3.
**Scope note:** This decision covers the *URI re-layering only* (the scope Chuck set).
The full neurosymbolic build (view processor, conneg-by-profile *selection*, SAI
registration, mint-on-miss, curators) stays deferred to later plans per the spec §6.
**Does NOT close RQ-Substrate-4.** The deep solution to Verborgh's contacts conundrum
(one entity, multiple writable views) is the deferred view layer; this is the cleanup
that makes it possible.

---

## 1. Decision summary

Partition the substrate's RDF terms into **three buckets** and re-frame the URI layout
as **views over a contextualized graph** (Verborgh), keeping the standards-conformant
parts and deleting our parallel reinventions:

- **Bucket 1 — Standard-predicate reuse (delete our parallels).** Where a standard
  Solid/PIM/LDP predicate already exists, use it and remove the `wiki:` duplicate.
  This is a D48 "no dual parallel mechanisms" cleanup; it *shrinks* the migration.
- **Bucket 2 — Substrate namespace (mint, framed as proto-view vocabulary).** Terms
  that are genuinely substrate-general but have no standard equivalent move out of
  `wiki:` into a substrate namespace, designed as the on-ramp to the deferred view
  layer (spec §4.3), not as permanent plumbing.
- **Bucket 3 — `wiki:` keeps only wiki-memory L3 content.** Content classes, maturity
  scheme, procedure-step vocab. `/wiki/` is re-framed in self-description as *"the
  wiki-memory document view,"* which defuses the cold-probe "MediaWiki app" misread.
- **Storage root:** keep `/vault` (grounded in D35, never the misread segment); fix the
  *code* contamination — derive the storage root from the storage description, stop
  hardcoding `/vault`.
- **PROF:** keep and **promote** to the view-identity + out-of-band resource-kind hint;
  make `Link: rel="profile"` actionable via `sh:agentInstruction` on each descriptor +
  an entry-point announcement. `?_profile=` view *selection* deferred to the view layer.
- **Validation:** agentic dual-view cold-probe eval (below); tune the harness, never the
  server. New question **RQ-View-1**.

---

## 2. Problem and audit findings

RQ-Substrate-4: the substrate was grown *forward from the Obsidian vault* (PARA + SKOS +
wiki metadata) instead of *backward from LDP + dual document/graph views* (Verborgh), so
application concerns leaked into what should be a general substrate. Two independent
cold-agent probes (2026-05-26, 2026-05-27) made the identical misread: the `wiki` URL
segment → "a MediaWiki-style *application*," compounded by the `wiki:` namespace prefix
on storage-description properties.

**Provenance audit (FOLLOWUPS thread 2 — "is the layout hallucinated?"): almost nothing
is hallucinated.** Every URI segment traces to a decision or a Solid convention:

| Segment | Provenance | Verdict |
|---|---|---|
| `/vault` storage root | D35 (`pim:Workspace` in `pim:Storage`) | Grounded. Cold probe **never flagged `vault`** — only `wiki`. |
| `.well-known/solid` | D44/D9/D12/D15 | Standard Solid. |
| `/vault/settings/publicTypeIndex` | D8 + Solid `publicTypeIndex` convention | Standard Solid. |
| `/vault/ontology/{wiki,…}#` | D84 (RQ-Substrate-3 fix) | Grounded *form*; D84 never touched the substrate/profile *split*. |
| `/vault/meta/{context,shapes,affordances,…}` | D52/D79/D86 | Grounded. |
| `/vault/wiki/{7 containers}` | D70/D71/D76→D98 | Grounded as the L3 profile's layout. `wiki` segment is the misread trigger. |

**The real debt is namespace *placement* and *naming*, not invented structure** — and a
**self-inflicted D48 violation**: we minted parallel `wiki:` predicates where standard
Solid predicates already exist (`wiki:typeIndex` vs `solid:publicTypeIndex`). The
smoking gun: a *second* app (AddressBook) is forced to reuse `wiki:contactCatalog` — a
general slot wearing L3 clothing.

The `wiki:` vocabulary enumeration confirmed the *majority* of `wiki:` terms are
general-substrate mechanism (catalogs, routing, governance, affordance-descriptor vocab),
not wiki-memory content.

---

## 3. Standards grounding

Two sources the brainstorm spec under-weighted; both were reviewed this session.

### 3.1 Solid partitions vocabulary by concern

Official Solid vocabularies are split by concern, never monolithic: `solid:` (terms#,
incl. Type-Index registration), `pim:` (space#, storage/preferences/config), `ldp:`
(containers/membership), `acl:`/`acp:` (access), `as:` (activities). This is the *axis*
Bucket 2 should follow, and it means several `wiki:` pointers have standard homes:

- Type Index discovery is **`solid:publicTypeIndex`/`solid:privateTypeIndex`** → Type
  Index doc → `solid:TypeRegistration` (`solid:forClass` + `solid:instanceContainer`/
  `solid:instance`). `wiki:typeIndex` reinvents this.
- Preferences: `pim:preferencesFile` (already used, D90). Storage: `pim:storage`.
- For substrate slots with **no** standard predicate, D44's pattern is `rdfs:seeAlso` →
  browseable catalog container; typed pointers are an optional enrichment.

### 3.2 Verborgh — a pod is a hybrid contextualized graph; documents are views

(*Let's talk about pods*, 2022.) The pod is a **hybrid contextualized knowledge graph**
(the source of truth); document hierarchies are **views** derived from it, and *"no view
is more special than any other."* Apps inventing per-app document organizations that
others can't reuse is the core failure — *"each Solid app is designing its own Web API …
puts meaning in the document organization that is not captured anywhere else."*

**Our contamination is a verbatim instance of his "contacts conundrum"** (`wiki:contactCatalog`
reused by AddressBook = two apps needing different views over the same `schema:Person`).
Therefore **reusing standard predicates (aggressive Bucket 1) is precisely the data-level
interoperability Verborgh argues for** — not a conflict.

**The one caveat:** Verborgh is mildly critical of the Type Index itself (*"solutions like
Type Indexes continue this conflation [of context and permissions]"*). Resolution: use
`solid:publicTypeIndex` + the Type Index as a **view-routing hint**, not as the privileged
single hierarchy. The source of truth is the contextualized graph (`.meta` + bodies, per
D57/D71 which already cite Verborgh's "hybrid contextualized KG"). This keeps us both
standards-idiomatic and Verborgh-aligned, and sets up the deferred view layer as the
proper endpoint where the contacts conundrum is actually solved.

---

## 4. The decision in detail

### 4.1 Bucket 1 — standard-predicate reuse (aggressive)

Per Chuck: be aggressive — use the underlying system wherever it doesn't conflict with
the dual-view model. Members, by confidence:

| `wiki:` term | Standard replacement | Confidence | Notes |
|---|---|---|---|
| `wiki:typeIndex` | `solid:publicTypeIndex` | **Confirmed** | Standard discovery. See §4.1.1 on the entry-point nuance. |
| (preferences) | `pim:preferencesFile` | **Confirmed** | Already used (D90); no `wiki:` term to delete. |
| `wiki:eventStream` | `ldp:inbox` (LDN) or LDES `tree:` | **Verify in plan** | Reconcile with the `.operations/` `as:Announce` design (D106/RQ-Listener-1) before deleting. |
| `wiki:targetContainer` | Type Index `solid:instanceContainer` *(routing use only)* | **Partial** | The *predicate→class→container routing* use is covered by Type Index (D106). The *affordance-dispatch* use in descriptors is a separate concern — treat case-by-case, do not blanket-delete. |

**4.1.1 Entry-point nuance.** The Type Index is conventionally linked from the **WebID
profile**, but our chosen agent entry point is the **storage description**. Decision:
advertise the Type Index from the storage description using the **standard predicate**
`solid:publicTypeIndex` (keep our entry point; drop our predicate). The WebID profile
SHOULD also carry `solid:publicTypeIndex` for ecosystem clients — confirm in the plan.

### 4.2 Bucket 2 — substrate namespace, framed as proto-view vocabulary

Terms that are genuinely substrate-general with **no** standard equivalent move out of
`wiki:`:

- **Discovery/catalog slots:** `shapeCatalog`, `affordanceCatalog`, `capabilityCatalog`,
  `contextDocument`, `templateCatalog`, `contactCatalog`, `profileDocument`,
  `bootstrapResource`, `agentGuide`, `extensionGuide`. (Verborgh: view/shape definitions
  *"organized in browsable repositories"* — these catalogs *are* those repositories.)
- **Routing/dispatch:** `routesToClass`, `dispatchPattern`, `targetClass` (and the
  routing use of `targetContainer`). These are the **primitive view-definition language**
  Verborgh calls for (URL-space → graph mapping) — the spec §4.3 view layer is their
  destiny.
- **Governance/projection:** `governs`, `projectsFromFrontmatter`, `classHintTable`,
  `installedBy`, `shape`, `requiresCapability`.
- **Affordance-descriptor vocab:** `Affordance` + subclasses, `constructQuery`,
  `selectQuery`, `queryParameter`, `parameter`, `required`, `deriveClass`, `threshold`.

**Recommended namespace (confirm at plan time):** a single
`https://pod.vardeman.me/vault/ontology/substrate#` (prefix `sub:`), per
duplicate-three-times-before-extracting (agentic-development.md). If it grows, concern-split
following the Solid precedent (`…/disco#`, `…/route#`, `…/afford#`). Recorded as the
default; the alternative (concern-split now) is more standards-idiomatic but multiplies
files and migration surface.

**`AddressBook`:** `wiki:contactCatalog` → `sub:contactCatalog` (the contamination's
smoking gun, fixed).

### 4.3 Bucket 3 — `wiki:` keeps only wiki-memory L3 content

Stays in `wiki:` (`https://pod.vardeman.me/vault/ontology/wiki#`): `Resource`, `Page`,
`Concept`, `Source`, `Person`, `Procedure`, `WorkingNote`, `MOC`, `Hub`; `maturity` +
`draft`/`validated`/`core`; the procedure-step vocab (`action`, `precondition`,
`postcondition`, `errorMode`, `procedure`, `step`); `WikiMemoryProfile`, `L3Profile`,
`conformsTo` (profile-conformance machinery — keep with wiki-memory as the L3 profile it
describes).

**`/wiki/` container:** keep the path (grounded D70/D71/D76→D98; renaming is over-reach
since `vault` wasn't the misread segment and a rename has high blast radius). Instead,
**re-frame it in self-description as "the wiki-memory document *view*"** — the entry-point
agentInstruction states the dual-view model so `/wiki/` reads as one view over the graph,
not a MediaWiki app.

### 4.4 Storage root — keep `/vault`, derive don't hardcode

`/vault` is grounded (D35 `pim:Workspace`) and was never the misread segment, so it is
**not renamed**. Fix the *code* contamination (FOLLOWUPS item 1): derive the storage root
from the storage description / `pim:Storage` / container hierarchy instead of the
hardcoded `${baseUrl}/vault` literal in `loadRoutingMap` and the `TypeIndexLoader`
instantiation. **Refines D35:** `/vault` is a view-host workspace, not the privileged
single hierarchy (Verborgh).

### 4.5 PROF — view-identity + actionable out-of-band hint

PROF (D86) is **promoted**, not trimmed: in the dual-view model it is the view's
identity/description slot and the out-of-band resource-kind hint.

- **Keep emitting `Link: rel="profile"`** (RFC 6906 — the only IETF-published piece; it
  conveys processing semantics without changing the media type = the out-of-band hint).
- **Make it actionable (in scope):** each PROF descriptor carries an `sh:agentInstruction`
  — e.g. *"You're reading the wiki-memory Concept document view of this entity; its graph
  view is the `.meta` at `<…>`; shape `<…>`; query the graph via SPARQL over `.meta`;
  canonical node `<#this>`."* (D86 deployed the descriptors; they lack the actionable hint
  — that is why the cold probe dismissed the bare IRI.)
- **Announce at the entry point (in scope):** the storage description states once that
  resources carry `rel="profile"` and that dereferencing it tells the agent the resource
  kind and its views.
- **NEVER emit `Content-Profile`** (expired draft — standards-stack caveat).
- **Deferred:** `?_profile=` conneg-by-profile *selection* between graph-view and
  document-view = the view-layer plan (spec §6 step 5).

---

## 5. Validation — agentic dual-view cold-probe eval

Eval-as-engineering-feedback (precedent: the RQ-Listener-1 collapse, where a cold probe
killed an over-build before merge). Two prior probes (2026-05-26/27) both misread `wiki`
→ **baseline to beat**. The instrument is the cold HTTP-only agent (no repo, no hints).

- **Probe A — misread regression (before/after).** Pod URL + store-a-concept task. Does
  it still read `wiki` as a MediaWiki app? Target: the view-reframe + entry-point framing
  kills the misread.
- **Probe B — dual-view usage.** A task needing *both* views: "read concept X" (document
  view: GET `.md`) **and** "find every concept citing source Y" (graph view: SPARQL over
  `.meta`). Does the agent discover the graph view, pick the right view per sub-task, and
  use the PROF hint?
- **Probe C — PROF delivery (with/without).** PROF-with-`sh:agentInstruction`-and-entry-point
  vs the current bare-IRI PROF (skill-creator harness pattern). Does the agent follow
  `rel="profile"` and does following it improve view selection? This *empirically resolves*
  whether PROF earns its keep.

**Rung 1.5 axes:** trajectory (found/used each view + the hint; context cost), outcome
(task correctness), and the diagnostic-most —

**Round-trip consistency *across views* (crown jewel).** Author an entity via the document
view (write `.md`), retrieve it via the graph view (SPARQL over `.meta`), and vice-versa.
Failure = the dual-view model is broken. This operationalizes Verborgh's "same statement,
two views" as pass/fail and exercises D71's body→`.meta` projection.

**Fine-tuning rule (spec §6 method):** on probe failure, **tune the harness** — the
authoring/reading skill + on-Pod `sh:agentInstruction` + PROF hint wording — and re-probe.
**Do not push intelligence into deterministic server routing.** Server stays dumb and
standards-conformant; neural behavior is engineered and measured.

**New research question** (RQ-View-1 already exists — algebraic flows; this is RQ-View-2):
> **RQ-View-2:** do agents correctly select and use the document-view vs graph-view of the
> same entity, and does the PROF out-of-band hint drive that selection? Validated by
> round-trip-across-views consistency.

---

## 6. Scope boundary (deferred to later plans)

- View processor CSS extension + `?_profile=` conneg-by-profile *selection* (spec §6 step 5).
- Declarative view definitions (CONSTRUCT/SHACL + PROF identity) beyond the existing
  projection listener (spec §4.3).
- SAI Application Registration + Access Needs (`interop:`) (spec §6 step 7).
- Mint-on-miss + `resolve-entity` affordance + RQ-Identity-1 (spec §6 step 2–4).
- Bucket-2 concern-split (only if `substrate#` grows).

---

## 7. Consequences / migration blast radius (plan supplies detail)

- **Code:** `wikilinkProjection.ts` (`BOOTSTRAP_PREDICATE_TO_CLASS`), `routingLoader.ts`,
  `routing.jsonld`, `pod_audit.py` (`PUBLISHED_RANGE`) — the three hand-mirrors flagged in
  the D106 review move together; namespace changes touch all three. Storage-root derive
  removes the `/vault` hardcode (FOLLOWUPS item 1).
- **Vocab files:** mint `substrate.ttl`; migrate ~40 terms out of `wiki.ttl`; update
  `context.jsonld`, `void-description.json` (the catalog `StaticStorageDescriber` keys),
  every shape's `sh:agentInstruction`, affordance + capability descriptors, manifests.
- **Reproducibility:** verify via `make reset` (fresh volume), never `make up`; `make audit`
  must stay 0 ERROR. The audit's storage-description/affordance shapes encode the old
  predicate names — update in lockstep.
- **D84 precedent:** one namespace migration already done (RQ-Substrate-3); this is
  feasible but non-trivial. Data-layer migration via volume wipe + regenerate (the D84/D85
  pattern).

---

## 8. References

- Verborgh, *Let's talk about pods* (2022) — pod as hybrid contextualized graph; documents
  as views; contacts conundrum; Type Index critique.
- Solid: vocab-by-concern (`solid:`/`pim:`/`ldp:`); Type Index spec (`solid:publicTypeIndex`,
  `solid:TypeRegistration`); RFC 6906 (`Link: rel="profile"`); W3C Conneg-by-Profile (WD);
  PROF (WG Note).
- Internal: brainstorm spec `2026-05-27-neurosymbolic-substrate-unification-design.md`
  (§4.3 views, §6 sequencing, §7 open questions); D35, D44/D48/D49, D52, D57, D70/D71,
  D76→D98, D79, D81, D84, D86, D90, D106; FOLLOWUPS "RQ-Substrate-4"; auto-memory
  `substrate-vault-contamination`, `shared-multiuser-substrate`.
