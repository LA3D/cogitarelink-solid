# D108 Front-2 — In-Band Admission Floor + Synchronous Materialization (D109 sub-project B)

**Date:** 2026-06-03. **Status:** Design (brainstormed, approved; pending implementation plan).
**Parent:** D109 substrate re-grounding, sub-project **B** (the admission floor). **Realizes:**
D108 Front-2 (`docs/superpowers/specs/2026-05-30-skos-backbone-dual-view-enforcement-decision.md`).
**Resolves:** RQ-Enforce-1. **Builds on:** sub-project A (RQ-Grammar-1 grammar, shipped 2026-06-02)
and the interop foundation (`docs/superpowers/specs/2026-06-02-interop-foundation-design.md`).
**Gates:** RQ-View-2 full re-eval (must land before the behavioral probe can fairly re-run).

---

## 1. Problem (recap, proven)

The wiki-memory L3 markdown corpus is **unvalidated at write time**. The only pre-commit validator
(`ShapeValidationStore`) sees the incoming markdown **body**, but the RDF it must judge lives in the
projected **`.meta`**, which is produced **post-commit, asynchronously** by the `MonitoringStore`
listener (D58/D71). So:

1. **No enforcement.** A `prefLabel`-less concept commits `201`; `ConceptShape` is violated and
   accepted. Every content shape is deployed, cataloged, advertised — and inert for markdown.
2. **No synchronous materialization.** `.meta` is written after the response returns, so a read
   immediately after a write sees no `.meta` (the D106 sparse-frontier symptom); `prefLabel` is
   materialized nowhere, so SKOS-frame label queries return an empty corpus.
3. **The interop declaration is unenforced.** The deployed Shape-Trees-over-SHACL layer
   (`interop:DataRegistration → interop:registeredShapeTree → st:ShapeTree → st:shape → wiki:*Shape`)
   declares that each governed container's resources conform to a SHACL NodeShape whose governed
   subjects (`<>` Page, `<#this>` Thing/Concept) live in the `.meta`. Nothing makes that true. The
   interop spec itself names D108 Front-2 as the floor that makes the declaration honest (§3 row 5,
   §8 floor-parity, §10).

The conceptual model (SKOS backbone; three label frames; two hierarchies; D81 predicate governance)
is sound. The failure is *realization in the graph*.

## 2. Decisions (the locked keystones)

1. **Projection moves in-band — project once, pre-commit (Approach 2).** A synchronous store step
   produces the candidate `.meta` graph, validates it, and only then commits — fixing both enforcement
   *and* materialization timing in one move. Supersedes the post-commit-only projection architecture
   for the validation/materialization path (the D58/D71 listener is re-roled, not removed — §2.5/§5.7).
2. **Two layered responsibilities, not one app-coupled store (Approach B, re-layered — see §3).**
   A **general admission floor** ("validate a governed resource's `.meta` graph against its container's
   shape, in-band; reject 422 or commit") consumes a **pluggable body projector** ("this body
   content-type + this binding → `.meta` graph"). The floor contains *no* markdown/SKOS/wiki
   knowledge; `markdown-projection` provides one projector (markdown + the wiki binding), injected via
   Components.js DI. `shape-validator` gains one principled change: skip non-RDF content-types, so a
   markdown container can carry `Link: rel="constrainedBy"` (the discovery affordance) without a
   body-validator trying to SHACL-check markdown and rejecting it.
3. **The conformance target is the `.meta` graph, regardless of write path.** The floor validates the
   *resulting* `.meta` graph against the container's shape whether the triples arrive by body
   projection **or** by a direct N3 PATCH to `.meta` **or** as a native RDF body. One conformance
   target, one shape (`ldp:constrainedBy` ≡ shape-tree `st:shape` ≡ `registeredShapeTree`'s shape),
   one floor. This keeps the interop/shape-tree declaration from being a lie to a Shape-Tree-aware
   (SAI) client.
4. **`sh:closed false` (D81) is load-bearing.** Validating any `.meta` graph against an open shape
   *passes* every agent-owned predicate ("agent owns everything else not in this list" —
   `ConceptShape`'s `sh:agentInstruction`) and *rejects only* violations of the governed backbone
   (missing `prefLabel`, an IRI-kind violation on `skos:broader`, an untyped/mistyped `<#this>`).
   Agent enrichment survives; the governed backbone stays conformant. D81 finally *enforced* on the
   `.meta` path, not merely declared.
5. **Partial-state safety = the listener demoted to an idempotent backstop (option a).** The in-band
   path is the fast path (validate → commit body → write stamped `.meta` synchronously → return). The
   `MonitoringStore` listener stays alive but re-roled: it re-projects only when the `.meta`
   body-hash stamp is stale or missing, so `.meta` is **never silently missing** (eventually
   consistent on the rare I/O miss, synchronous in the common case, project-once on the success path).
   `replaceGoverned` only touches governed predicates, so the backstop never clobbers agent-owned
   triples (D81).
6. **Both write paths floored in B (no fast-follow gap).** Body projection *and* direct `.meta` PATCH
   are floored when B ships. Shipping a floor the shape-tree declaration over-promises on is the
   silent-inconsistency class `no-stubs-real-or-error` forbids.

## 3. Layering & reuse (the general floor vs the wiki profile)

This Pod is built in tiers, and the floor must live at the tier where *any* agentic application can
reuse it — not inside the wiki application. The risk this section closes is exactly RQ-Substrate-4 /
D109: the wiki profile (L3) leaking *down* into the substrate (L1/L2).

| Tier | "…amenable to agentic applications" | What this design places here |
|---|---|---|
| **L1 — Pod substrate** | the Pod itself | the **admission-floor mechanism** (validate a governed resource's `.meta` graph against its container's `constrainedBy` shape, in-band, path-agnostic) + the `BodyProjector` seam — alongside LDP, Type Index, storage description, interop registration |
| **L2 — Memory substrate** | the memory system | the governed-metadata/lifecycle/label-frame invariants the floor *enforces* (the seven invariants) |
| **L3 — Memory profile** | wiki-memory, one memory type | the 8 SHACL shapes + SKOS backbone + the **wiki projection binding** (`[text]{.prefLabel}`→`skos:`, the wikilink hint→predicate map) + the markdown body format |

**What is general (no wiki/SKOS/markdown knowledge):** the admission floor; path-agnostic
`.meta`-graph validation; container = gate / class = dispatch; floor parity; the backstop/stamp;
`rdfs:label` apex materialization; `sh:closed false` predicate-level governance.

**What is profile-specific (L3, swappable):** the projection **binding** (which `.pred`/`.role` maps
to which predicate), the 8 shapes, the SKOS backbone + three label frames, the markdown body format.

**The seam:** a small `BodyProjector` interface — `(identifier, representation) → Quad[]` keyed by
content-type. `markdown-projection` registers one for `text/markdown`, already parameterized by
binding (`projectionPipeline.run(... literalBinding = DEFAULT_LITERAL_BINDING ...)`,
`projectSpanLiterals(body, subject, binding)`), so a *different* markdown-using memory type reuses the
projection mechanism with its own binding + shapes. The floor depends on the **interface**, never on
`markdown-projection` concretely (dependency inversion via DI) — so the general floor never imports
wiki code.

**This layering is already real, not hypothetical — two consumers exist today:**
- **wiki-memory** — markdown bodies → projected `.meta`, floored *with* the markdown projector.
- **AddressBook** — vCard, native RDF bodies, floored *with no projector* (the body *is* the graph).

A future task-tracker or dataset-catalog memory would do one or the other. **YAGNI guard:** wire
exactly **one** projector now (markdown); **no** speculative projector registry with zero consumers
(the `providesCapability` over-provisioning lesson). Grow the projector set reactively when a real
second projecting app appears.

## 4. Architecture

```
PUT/POST X.md  ─────────────┐         PATCH X.md.meta (N3) ──┐         PUT contacts/…  (RDF body)
                            ▼                                 ▼                  │
                       PatchingStore ──(applies N3 patch, emits new .meta rep)──┐│
                            ▼                                                    ▼▼
            ┌─► AdmissionFloorStore  ◄── GENERAL (L1/L2). For a governed-container write, obtain the
            │        ▼                    candidate .meta graph and validate it against constrainedBy:
            │        │                      • body w/ registered BodyProjector → project(body)
            │        │                      • direct .meta PATCH/PUT (already RDF) → the post-patch graph
            │        │                      • RDF body, no projector → the body IS the graph
            │        │                    pass → commit body + stamped .meta ;  fail → 422 (nothing commits)
            │        ▼
            │   ShapeValidationStore   ◄── restricted to RDF content-types (skips markdown bodies)
            │        ▼
            │   Converting → MonitoringStore → backend
            │                    ▼
            └────────── MarkdownProjectionListener  ◄── DEMOTED: idempotent backstop (stamp) + mem-trigger host
```

```
BodyProjector (interface, general)         MarkdownBodyProjector (markdown-projection, L3)
  project(identifier, representation)  ◄────  text/markdown → projectionPipeline.run(body, binding,
    : Quad[]                                    typeIndex, routingMap) → Quad[]   (binding = wiki L3)
        ▲ injected via Components.js DI
        └── AdmissionFloorStore consumes the interface, never the concrete markdown class
```

The `AdmissionFloorStore` owns one invariant: **a governed resource's `.meta` graph conforms to its
container's shape before that `.meta` is committed** — on whichever representation carries `.meta`
semantics, with the candidate graph produced by the registered projector (or the RDF body directly).
For RDF bodies with no projector the floor may delegate to `ShapeValidationStore` (the body *is* the
graph there — D108 §1.5), keeping the contacts/WebID path exactly as today.

## 5. Components

1. **`AdmissionFloorStore`** (general; L1/L2; home TBD — new extension vs generalized `shape-validator`,
   see §10). Gate = the parent container's `ldp:constrainedBy` (reuse the `extractShapes` mechanism).
   Obtain candidate graph (projector / RDF body / post-patch `.meta`) → validate → durable container:
   commit + stamped `.meta` or 422; `working/`: materialize but **no strict 422** (D73 permissive,
   container-keyed). Contains no markdown/SKOS/wiki symbols.
2. **`BodyProjector` interface + `MarkdownBodyProjector`** (interface general; impl in
   `markdown-projection`, L3). The impl wraps the existing pure `projectionPipeline` + the wiki binding
   + `MetaWriter` (`replaceGoverned`) + `TypeIndexLoader` + `routingMap`. Registered for `text/markdown`
   and injected into the floor. RDF-body apps register no projector.
3. **`shape-validator` RDF-only restriction** (small, principled). `ShaclValidator` skips non-RDF
   content-types so a markdown container can carry `constrainedBy`. Keep the existing container-`.meta`
   path-constraint exemption (it protects against LDP-type false-positives on the *container's own*
   `.meta` — a different mechanism; see the scope guard, §5.8).
4. **Shared validation core.** Extract "validate quads against the `constrainedBy` shape, throw
   `ShaclValidationError`" so the floor calls it. Reuse `ShaclValidationError` + `ShaclErrorHandler`
   so the 422 + `text/turtle` `sh:ValidationReport` body is byte-identical across paths. (Also the
   seam the future `shacl-engine` spike plugs into — interop §7; out of scope here, Zazuko stays.)
5. **Projected-graph contract (container = gate, class = dispatch).** Validate `<>` against `PageShape`
   and `<#this>` against the class-dispatched shape (`ConceptShape`/`ThingShape`/… via `sh:targetClass`
   on `rdf:type`). `targetClassCheck` = the untyped/mistyped reject.
6. **Label materialization** (in the projector / pipeline, L3 default; the *apex* rule is general).
   Derive `rdfs:label` apex on every governed node from its frame label
   (`dct:title`/`schema:name`/`skos:prefLabel`); `schema:name` on Thing (already derived,
   RQ-Listener-1); `prefLabel` stays **agent-authored** via the grammar and is now *enforced* by
   `ConceptShape minCount 1`. Derive the inferable; reserve the 422 for judgment metadata (D108 §1.4).
7. **Backstop stamp.** The floor writes a body-hash stamp into `.meta`; the listener skips
   re-projection when the stamp matches the current body (project-once on success), re-projects only
   when stale/missing. Direct `.meta` edits don't change the body hash, so the backstop never clobbers
   a direct enrichment with a re-projection.
8. **Floor parity (interop consistency) — explicit component + test.** Each governed container's
   `ldp:constrainedBy` MUST name the *same* NodeShape its shape-tree `st:shape` /
   `registeredShapeTree` names. Single source; a parametric test asserts the agreement. **Scope guard:**
   the floor applies to a governed *resource's* `.meta` (the concept's graph), **not** the *container's
   own* `.meta` (`ldp:contains` listing + LDP types), which stays substrate-managed and outside the
   shape floor.
9. **Structural corrections** (cold-probe substrate gaps + the projector bug — prerequisites/accuracy
   fixes this work depends on, *not* teaching; teaching is deferred per the structure-before-teaching
   reorder). These are L3-profile fixes:
   - (a) Backfill `sub:shape` + a minimal `sh:agentInstruction` on the `concepts`/`places`/`events`/
     `organizations` container `.meta` (only `people`/`procedures`/`working` have them today). Needed
     to wire `constrainedBy`/floor-parity; `concepts` is the SKOS backbone.
   - (b) Add the literal axis (`skos:prefLabel`/`altLabel`/`definition`) to `markdown-projection.ttl`'s
     `sub:governs` + a `sub:projectsFromBody` describing the three grammar axes (the descriptor
     under-declares what the shipped grammar projects).
   - (c) The projector **skips wikilinks/spans inside code spans**, so a doc can *show*
     `` `[text]{.prefLabel}` `` without projecting it (the real fix for the dangling-`broader` bug
     minimally patched at `f8aaeaf`).

## 6. Data flow (the cases that matter)

| Write | Path | Floor behavior |
|---|---|---|
| Markdown → durable governed container | projector → floor | project → validate → 422 *or* (commit body + synchronous stamped `.meta`) → 201/204 with `.meta` already materialized |
| Markdown → `working/` | projector → floor | project + materialize, **no strict 422** (D73) |
| Direct N3 PATCH → governed resource `.meta` | PatchingStore → floor | validate the post-patch `.meta` graph; `sh:closed false` passes agent-owned predicates, rejects backbone violations |
| Direct write → container's own `.meta` | (exempt) | substrate-managed; outside the shape floor (scope guard) |
| RDF body (contacts/WebID) | floor (no projector) → ShapeValidationStore | body *is* the graph; validated as today |
| Backstop | post-commit listener | stamp stale/missing → re-project + write `.meta`; stamp match → skip |

## 7. Error handling

- **Validation failure (pre-commit):** 422 + `text/turtle` `sh:ValidationReport` +
  `sh:agentInstruction` remediation — *the* teaching signal (D108 §1.6). Nothing commits.
- **`.meta` write failure (post-body-commit, rare I/O):** logged; the listener backstop reconciles;
  `.meta` never silently missing.
- **Untyped/mistyped `<#this>`:** `targetClassCheck` reject (422).

## 8. Testing — two audiences (D108 §1.6 / §5) + layering + the new contracts

- **Runtime agent (integration):** `prefLabel`-less concept → 422 with `sh:ValidationReport`; valid
  concept → 201 with synchronously conformant `.meta` (zero post-commit poll); `working/` accepts;
  RDF-body (contacts) path unchanged.
- **Direct-PATCH floor (integration):** an N3 PATCH dropping `prefLabel` → 422; a PATCH adding an
  agent-owned (non-governed) predicate → accepted (open shape); a PATCH malforming `skos:broader` → 422.
- **Layering / reuse (the anti-contamination test):** the `AdmissionFloorStore` module imports no
  markdown/SKOS/wiki symbols (a structural test — grep/import guard); the AddressBook RDF-body write
  is floored *through the general floor* with no markdown projector registered. Proves the floor is
  application-general.
- **Floor parity (parametric):** for every governed container, `ldp:constrainedBy` names the same
  NodeShape as its `registeredShapeTree`'s `st:shape`.
- **Backstop:** simulated in-band `.meta`-write failure → listener reconciles; stamp match → no
  redundant re-projection.
- **Dev agent (unit/CI):** encode the frame model (Page/Thing/Concept ↔ `<>`/`<#this>` ↔ label
  frames) + the artifact-agreement contracts, failing with *meaningful* messages if a future agent
  rewrites the substrate without the model — extend Front-1's `tests/test_frame_model_agreement.py`.

## 9. Scope / sequencing

Phased in the plan:
1. **Structural corrections (§5.9 a–c)** — low-risk, independent; land *first* (they wire the
   `constrainedBy` + floor-parity the floor depends on, and the code-span fix unblocks teaching docs).
2. **The general admission floor + the `BodyProjector` seam (§5.1–5.5, 5.7–5.8)** — the L1/L2 floor,
   the interface + markdown projector impl, RDF-only restriction, shared validation, materialization,
   both-path floor, backstop, layering test.

**Out of scope** (deferred, named, not silent): the full **view layer** — one entity, multiple
*writable* views (D107 §6 / interop §4 `st:references`/`viaPredicate`). This spec builds the single
document→graph enforcement the view layer later generalizes. The **SAI grant/authorization runtime**
stays openly deferred (auth = dev-allow-all); flooring the `.meta` now makes the interop *declaration*
honest, which a future SAI client relies on. The **second `BodyProjector`** (a non-wiki projecting
app) is not built — only the seam that admits it.

## 10. Open decisions (for the plan / sub-specs)

- **Home of the `AdmissionFloorStore`** — a new general extension (`admission-floor`) vs generalizing
  the existing `shape-validator` (which already owns RDF-body validation + `constrainedBy`). DI of the
  projector keeps the dependency direction clean either way; pick the home that minimizes new
  packaging without re-coupling.
- **`BodyProjector` interface shape** — `(identifier, representation) → Quad[]`; how content-type
  selection + DI registration are wired in Components.js; how the floor obtains `MetaWriter`/stamp
  (general utility vs projector-provided).
- **Chain position vs `PatchingStore`** — the floor must sit *below* `PatchingStore` so a direct N3
  `.meta` PATCH is floored on its post-patch representation (Explore mapped `PatchingStore →
  ShapeValidationStore → Converting → MonitoringStore`). Confirm POST/PUT/PATCH all route through it.
- **No self-re-entry / no deadlock** when the floor writes the `.meta` it just validated (the write
  goes *down* the chain below the floor; verify it doesn't re-trigger the floor).
- **`TypeIndexLoader` warmth** — projection needs `typeIndex` + `routingMap`; pre-warm or inject
  lazily (reuse the listener's loader).
- **Build split** — the listener loads compiled ESM `dist/`; new stores are CommonJS (`src-cjs`). Wire
  the pure pipeline import as `listener.ts` does (`runtimeImport`); keep `build:esm` in the Dockerfile.
- **Residual binding hardcode** — ~5 `skos:`/`wiki:` strings still sit in `projectionPipeline.ts`
  rather than in the handed binding; move them into the binding so the projection mechanism is fully
  profile-neutral (small L3 cleanup, supports reuse).
- **`shacl-engine` spike** stays out of this spec (Zazuko default); the shared validation core (§5.4)
  is its seam.

## 11. Relationship to prior decisions

- **Realizes D108 Front-2** and **resolves RQ-Enforce-1** (the in-band floor is the "PassthroughStore
  that projects-then-validates before delegating" option, generalized to be path-agnostic over the
  `.meta` graph and split from the projector).
- **Honors D70 stratification + closes part of RQ-Substrate-4** — the floor is placed at L1/L2 with the
  wiki projection isolated at L3 behind the `BodyProjector` seam; AddressBook (RDF bodies) is the
  existing second consumer proving the floor is application-general.
- **Enforces the interop foundation's floor-parity** (`registeredShapeTree`/`st:shape` ≡
  `ldp:constrainedBy`) — makes the Shape-Trees-over-SHACL declaration honest.
- **Enforces D81** (predicate-level governance) on the `.meta` path via `sh:closed false`.
- **Confirms D73** (permissive `working/` / strict durable — container-keyed).
- **Re-roles, does not remove, the D58/D71 listener** (idempotent backstop + mem-trigger host).
- **Builds on D98/D105/D106** (SKOS backbone; two-hierarchy addressing/navigation) and sub-project A
  (the grammar that makes inline authoring of the governed graph possible — the floor is only *honest*
  because conformant authoring is now expressible).
- **Gates RQ-View-2** full behavioral re-eval (with enforcement).
