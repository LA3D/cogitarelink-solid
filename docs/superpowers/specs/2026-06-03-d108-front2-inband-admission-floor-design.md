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
   projects the markdown body → `.meta` graph, validates that graph, and only then commits — fixing
   both enforcement *and* materialization timing in one move. Supersedes the post-commit-only
   projection architecture for the validation/materialization path (D58/D71 listener is re-roled, not
   removed — see §6).
2. **Seam = a new in-band store in the `markdown-projection` extension; `shape-validator` restricted
   to RDF (Approach B).** Markdown-specific logic stays in the markdown extension, which already owns
   `projectionPipeline` / `MetaWriter` / `TypeIndexLoader` / `routingMap`. It depends on a *generic*
   "validate these quads against this shape" capability — never the reverse. `shape-validator` gains
   one principled change: skip non-RDF content-types, so a markdown container can carry
   `Link: rel="constrainedBy"` (the discovery affordance) without the body-validator trying to
   SHACL-check markdown and rejecting it.
3. **The conformance target is the `.meta` graph, regardless of write path.** The floor validates the
   *resulting* `.meta` graph against the container's shape whether the triples arrive by markdown
   projection **or** by a direct N3 PATCH to `.meta`. One conformance target, one shape
   (`ldp:constrainedBy` ≡ shape-tree `st:shape` ≡ `registeredShapeTree`'s shape), one floor. This is
   what keeps the interop/shape-tree declaration from being a lie to a Shape-Tree-aware (SAI) client.
4. **`sh:closed false` (D81) is load-bearing.** Validating any `.meta` graph against an open shape
   *passes* every agent-owned predicate ("agent owns everything else not in this list" —
   `ConceptShape`'s `sh:agentInstruction`) and *rejects only* violations of the governed backbone
   (missing `prefLabel`, an IRI-kind violation on `skos:broader`, an untyped/mistyped `<#this>`).
   Agent enrichment survives; the SKOS/citation backbone stays conformant. This is D81 finally
   *enforced* on the `.meta` path, not merely declared.
5. **Partial-state safety = the listener demoted to an idempotent backstop (option a).** The in-band
   store is the fast path (validate → commit body → write stamped `.meta` synchronously → return). The
   `MonitoringStore` listener stays alive but re-roled: it re-projects only when the `.meta` body-hash
   stamp is stale or missing, so `.meta` is **never silently missing** (eventually consistent on the
   rare I/O miss, synchronous in the common case, project-once on the success path). `replaceGoverned`
   only touches governed predicates, so the backstop never clobbers agent-owned triples (D81).
6. **Both write paths floored in B (no fast-follow gap).** Markdown projection *and* direct `.meta`
   PATCH are floored when B ships. Shipping a floor the shape-tree declaration over-promises on is the
   silent-inconsistency class `no-stubs-real-or-error` forbids.

## 3. Architecture

```
PUT/POST X.md  ─────────────┐         PATCH X.md.meta (N3) ──┐
                            ▼                                 ▼
                       PatchingStore ──(applies N3 patch, emits new .meta representation)──┐
                            ▼                                                               │
            ┌─► ProjectionEnforcementStore  ◄── NEW (markdown-projection). Governed-resource floor: ◄┘
            │        ▼                            • X.md body  → project(body) → .meta graph → validate → commit body + stamped .meta
            │   ShapeValidationStore   ◄── restricted to RDF content-types (skips markdown bodies).
            │        ▼                            Still validates RDF bodies (contacts/WebID) as today.
            │   Converting → MonitoringStore → backend
            │                    ▼
            └────────── MarkdownProjectionListener  ◄── DEMOTED: idempotent backstop (stamp check) + mem-trigger hook host
```

The `ProjectionEnforcementStore` owns one invariant: **a governed resource's `.meta` graph conforms
to its container's shape before that `.meta` is committed** — on whichever representation carries
`.meta` semantics:

- **Markdown body write** (`X.md`, non-RDF): `effective_meta = project(body)` via the pure pipeline;
  validate; on pass commit body + write stamped `.meta`; on fail throw `ShaclValidationError` (422),
  nothing commits.
- **Direct `.meta` write** (`X.md.meta`, already RDF — arrives post-`PatchingStore` for N3 PATCH, or
  a direct PUT): the incoming/post-patch representation *is* the candidate `.meta` graph; validate it
  directly (no projection); commit on pass, 422 on fail.

For **RDF bodies** (contacts/WebID) the enforcement store is a passthrough; `ShapeValidationStore`
validates the body as today (the body *is* the graph there — D108 §1.5).

## 4. Components

1. **`ProjectionEnforcementStore`** (new; `markdown-projection`; name TBD). Gate = the parent
   container's `ldp:constrainedBy` (reuse the `extractShapes` mechanism). Durable governed container →
   validate → commit / 422. `working/` → project + materialize but **no strict 422** (D73 permissive,
   container-keyed). Reuses `projectionPipeline`, `MetaWriter` (`replaceGoverned`), `TypeIndexLoader`,
   `routingMap` already in the extension.
2. **`shape-validator` RDF-only restriction** (small, principled). `ShaclValidator`/
   `ShapeValidationStore` skip non-RDF content-types so a markdown container can carry
   `constrainedBy`. Keep the existing container-`.meta` path-constraint exemption (it protects against
   LDP-type false-positives on the *container's own* `.meta` — a different mechanism; see the scope
   guard, §4.7).
3. **Shared validation core.** Extract "validate quads against the `constrainedBy` shape, throw
   `ShaclValidationError`" so the enforcement store calls it (dependency points
   markdown→generic-validation). Reuse `ShaclValidationError` + `ShaclErrorHandler` so the 422 +
   `text/turtle` `sh:ValidationReport` body is byte-identical on both paths. (This is also the seam
   the `shacl-engine` spike plugs into later — interop spec §7; out of scope here, Zazuko stays.)
4. **Projected-graph contract (container = gate, class = dispatch).** Validate `<>` against
   `PageShape` and `<#this>` against the class-dispatched shape (`ConceptShape`/`ThingShape`/… via
   `sh:targetClass` on `rdf:type` in the graph). `targetClassCheck` = the untyped/mistyped reject.
5. **Label materialization** (pipeline). Derive `rdfs:label` apex on every governed node from its
   frame label (`dct:title`/`schema:name`/`skos:prefLabel`); `schema:name` on Thing (already derived,
   RQ-Listener-1); `prefLabel` stays **agent-authored** via the shipped grammar and is now *actually
   enforced* by `ConceptShape minCount 1`. Derive the inferable; reserve the 422 for judgment metadata
   (D108 §1.4).
6. **Backstop stamp.** The enforcement store writes a body-hash stamp into `.meta`; the listener skips
   re-projection when the stamp matches the current body (project-once on success), re-projects only
   when stale/missing. Direct `.meta` edits don't change the body hash, so the backstop never clobbers
   a direct enrichment with a re-projection.
7. **Floor parity (interop consistency) — explicit component + test.** Each governed container's
   `ldp:constrainedBy` MUST name the *same* NodeShape its shape-tree `st:shape` /
   `registeredShapeTree` names. Single source; a parametric test asserts the agreement (the pattern
   `agentic-development.md` calls for on agreement contracts). **Scope guard:** the floor applies to a
   governed *resource's* `.meta` (the concept's graph), **not** the *container's own* `.meta`
   (`ldp:contains` listing + LDP types), which stays substrate-managed and outside the shape floor.
8. **Structural corrections** (the cold-probe substrate gaps + the projector bug — prerequisites/
   accuracy fixes that this work depends on, *not* teaching; teaching is deferred per the
   structure-before-teaching reorder):
   - (a) Backfill `sub:shape` + a minimal `sh:agentInstruction` on the `concepts`/`places`/`events`/
     `organizations` container `.meta` (only `people`/`procedures`/`working` have them today). Needed
     anyway to wire `constrainedBy`/floor-parity; `concepts` is the SKOS backbone.
   - (b) Add the literal axis (`skos:prefLabel`/`altLabel`/`definition`) to `markdown-projection.ttl`'s
     `sub:governs` + a `sub:projectsFromBody` describing the three grammar axes (the descriptor
     currently *under-declares* what the shipped grammar projects).
   - (c) The projector **skips wikilinks/spans inside code spans**, so a doc can *show*
     `` `[text]{.prefLabel}` `` without projecting it (the real fix for the dangling-`broader` bug
     minimally patched at `f8aaeaf`).

## 5. Data flow (the cases that matter)

| Write | Path | Floor behavior |
|---|---|---|
| Markdown → durable governed container | enforcement store | project → validate → 422 *or* (commit body + synchronous stamped `.meta`) → 201/204 with `.meta` already materialized |
| Markdown → `working/` | enforcement store | project + materialize, **no strict 422** (D73) |
| Direct N3 PATCH → governed resource `.meta` | PatchingStore → enforcement store | validate the post-patch `.meta` graph; `sh:closed false` passes agent-owned predicates, rejects governed-backbone violations |
| Direct write → container's own `.meta` | (exempt) | substrate-managed; outside the shape floor (scope guard) |
| RDF body (contacts/WebID) | passthrough → ShapeValidationStore | validated as today (body *is* the graph) |
| Backstop | post-commit listener | stamp stale/missing → re-project + write `.meta`; stamp match → skip |

## 6. Error handling

- **Validation failure (pre-commit):** 422 + `text/turtle` `sh:ValidationReport` +
  `sh:agentInstruction` remediation — *the* teaching signal (D108 §1.6). Nothing commits.
- **`.meta` write failure (post-body-commit, rare I/O):** logged; the listener backstop reconciles;
  `.meta` never silently missing.
- **Untyped/mistyped `<#this>`:** `targetClassCheck` reject (422).

## 7. Testing — the two audiences (D108 §1.6 / §5) + the new contracts

- **Runtime agent (integration):** `prefLabel`-less concept → 422 with `sh:ValidationReport`; valid
  concept → 201 with synchronously conformant `.meta` (zero post-commit poll); `working/` accepts;
  RDF-body path unchanged.
- **Direct-PATCH floor (integration):** an N3 PATCH that drops `prefLabel` → 422; a PATCH adding an
  agent-owned (non-governed) predicate → accepted (open shape); a PATCH malforming `skos:broader` →
  422.
- **Floor parity (parametric):** for every governed container, `ldp:constrainedBy` names the same
  NodeShape as its `registeredShapeTree`'s `st:shape`.
- **Backstop:** simulated in-band `.meta`-write failure → listener reconciles; stamp match → no
  redundant re-projection.
- **Dev agent (unit/CI):** encode the frame model (Page/Thing/Concept ↔ `<>`/`<#this>` ↔ label
  frames) + the artifact-agreement contracts, failing with *meaningful* messages if a future agent
  rewrites the substrate without the model — extend Front-1's `tests/test_frame_model_agreement.py`.

## 8. Scope / sequencing

Two workstreams the plan will phase:
1. **Structural corrections (§4.8 a–c)** — low-risk, independent; land *first* (they wire the
   `constrainedBy` + floor-parity the store depends on, and the code-span fix unblocks teaching docs).
2. **In-band enforcement core (§4.1–4.7)** — the store + RDF-only restriction + shared validation +
   materialization + both-path floor + backstop + tests.

**Out of scope** (deferred, named, not silent): the full **view layer** — one entity, multiple
*writable* views (D107 §6 / interop §4 `st:references`/`viaPredicate` edge topology). This spec
builds the single document→graph enforcement the view layer later generalizes. The **SAI grant/
authorization runtime** stays openly deferred (auth = dev-allow-all); flooring the `.meta` now makes
the interop *declaration* honest, which is what a future SAI client will rely on.

## 9. Open decisions (for the plan / sub-specs)

- **Chain position of the enforcement store vs `PatchingStore`.** It must sit *below* `PatchingStore`
  so a direct N3 `.meta` PATCH is floored on its post-patch representation; confirm against the live
  decorator order (Explore mapped: `PatchingStore → ShapeValidationStore → Converting →
  MonitoringStore`). Confirm POST (slug)/PUT/PATCH all route through it.
- **No self-re-entry / no deadlock** when the enforcement store writes the `.meta` it just validated
  (the write goes *down* the chain below the store; verify it doesn't re-trigger the floor).
- **`TypeIndexLoader` warmth.** Projection needs `typeIndex` + `routingMap`; a cold/slow fetch blocks
  the response. Pre-warm or inject lazily (reuse the listener's loader).
- **Stamp representation** — where the body-hash lives in `.meta` and how the listener reads it
  cheaply.
- **Build split.** The listener loads compiled ESM `dist/`; the new store is CommonJS (`src-cjs`).
  Wire the pure pipeline import the same way `listener.ts` does (`runtimeImport`), and keep
  `build:esm` in the Dockerfile (the deploy-gap fix shipped 2026-06-02).
- **`shacl-engine` spike** stays out of this spec (Zazuko remains default); the shared validation core
  (§4.3) is the seam it would plug into.

## 10. Relationship to prior decisions

- **Realizes D108 Front-2** and **resolves RQ-Enforce-1** (the in-band store is the "PassthroughStore
  that projects-then-validates before delegating" option, generalized to be path-agnostic over the
  `.meta` graph).
- **Enforces the interop foundation's floor-parity** (`registeredShapeTree`/`st:shape` ≡
  `ldp:constrainedBy`) — makes the Shape-Trees-over-SHACL declaration honest.
- **Enforces D81** (predicate-level governance) on the `.meta` path via `sh:closed false`.
- **Confirms D73** (permissive `working/` / strict durable — container-keyed).
- **Re-roles, does not remove, the D58/D71 listener** (idempotent backstop + mem-trigger host).
- **Builds on D98/D105/D106** (SKOS backbone; two-hierarchy addressing/navigation) and sub-project A
  (the grammar that makes inline authoring of the governed graph possible — the floor is only
  *honest* because conformant authoring is now expressible).
- **Gates RQ-View-2** full behavioral re-eval (with enforcement).
