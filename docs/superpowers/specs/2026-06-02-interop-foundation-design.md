# Interop Foundation: the App-Definition + Extension Layer (realizes D110, corrected scope)

**Date:** 2026-06-02. **Status:** Design (brainstormed, pending implementation plan).
**Parent:** D109 §5 (foundational-ontology layer); D109 sub-project decomposition (cross-cutting
foundation that sub-project A's binding sits on). **Realizes + corrects:** the D110 stub
(`2026-06-02-cap-overlay-interop-rebase-decision.md`). **Grounding artifacts:**
`ontology/interop.ttl`, `ontology/shapetrees.ttl` (both cached + rdflib-valid).

> **Why this is its own spec, ahead of the grammar (A):** the grammar's "published binding =
> vocabulary boundary" (its admission set + escalation seam) sits *on* the app-definition layer.
> We re-aimed the brainstorm here because building the grammar's binding on the bespoke
> `cap:`/`overlay:` surface — itself a *forward-from-the-vault* artifact — risked repeating the
> RQ-Substrate-4 contamination D109 exists to fix. Grounding-first (read the as-built machinery +
> the interop & Shape-Trees specs) was the antidote to building on a hallucinated construct.

## 1. What grounding established (the verification we owed)

We modelled the bespoke extension surface against the interop data-model and found **one clean
mapping, one category error, and zero real impedance:**

- **Maps cleanly (the data-declaration axis):** wiki containers ≈ `interop:DataRegistration`;
  `installsTypeRegistration` (class→container via Type Index) ≈ DataRegistration keyed by
  `registeredShapeTree`; `installsShape` + `sh:targetClass` ≈ the shape referenced by an
  `AccessNeed`'s `registeredShapeTree`; overlay-as-declared-bundle ≈ `interop:Application` +
  `AccessNeedGroup`. **The grammar's binding sits on this axis** → building on it is sound.
- **Category error caught (corrects the D110 stub):** the stub claimed `cap:requires` ≈
  `AccessNeedGroup`/`AccessNeed`. **Wrong.** `cap:requires`/`overlay:providesCapability` declare a
  dependency on a **substrate feature implemented by a CSS extension** (`cap:ContentProjection`,
  `DerivedView`, `TimeTravel`; `cap:implementedBy`). `interop:AccessNeed` declares an **`acl:`
  access request for shape-typed data**. Orthogonal axes. **interop does not model substrate
  features at all.** → **The `cap:`/feature layer stays bespoke; only the data-declaration half is
  rebased.**
- **No impedance (Shape Trees fit 1:1):** `st:shape` has an **open range** (shape-language-agnostic)
  → it points at our SHACL NodeShape with **no deviation**. `st:contains` = our container hierarchy;
  `st:expectsType` = Container vs the `.md` Resource; `st:focusNode` = our `<#this>` Thing subject;
  `st:Manager`/`st:Assignment` = container governance (coexists with `ldp:constrainedBy`);
  `st:references`/`st:viaPredicate` = our typed-edge graph (deferred — see §4).

## 2. Scope (MVP, real, no stubs)

**In scope** — the *stable* interop data-model half, implemented as real, queryable RDF the agent
can discover and the floor can enforce, **plus** the Shape-Trees-over-SHACL binding:
`Application` · `AccessNeedGroup`/`AccessNeed` · `DataRegistry`/`DataRegistration` ·
`registeredShapeTree` → `st:ShapeTree` → our SHACL · `st:Manager`/`st:Assignment` · a minimal
`RegistrySet` off the owner WebID.

**Out of scope, honestly absent (no-stubs — these *error / are openly missing*, never faked):** the
**grant/authorization runtime** (`AccessAuthorization`, `DataAuthorization`, `AccessGrant`,
`DataGrant`, `AuthorizationAgent`, the redirect/consent flow — CG #334 volatile). Auth is
**dev-allow-all, openly**. VCs/DIDs are enumerate-deferred (`ontology/` tier). The interop
*vocabulary* is non-stub here precisely because the declaration + discovery + shape-governance it
describes **is** implemented (the floor is real, sub-project B) and the grant half is openly absent.

**Stays bespoke (not rebased):** the `cap:`/`overlay:providesCapability` feature layer + the
`/vault/meta/capabilities/` catalog — a legitimate substrate-feature registry interop doesn't model.

## 3. Target architecture

| # | Component | Concrete shape |
|---|---|---|
| 1 | **Application** | wiki-memory = `interop:Application` (`interop:applicationName`, `applicationDescription`) → `interop:hasAccessNeedGroup` → one `AccessNeedGroup` |
| 2 | **Access needs** | one `interop:AccessNeed` per governed type (Concept, Person, Place, Organization, Event, Procedure, Source, WorkingNote): `interop:accessMode` (`acl:Read`/`acl:Write`/…) + `interop:registeredShapeTree` → that type's ShapeTree; `interop:accessNecessity` |
| 3 | **ShapeTrees over SHACL** | per type, in a Pod-hosted tree doc (e.g. `/vault/meta/shapetrees/wiki-memory`): `:XResourceTree a st:ShapeTree ; st:expectsType st:Resource ; st:shape <…/shapes/X.shacl#XShape>` and `:XContainerTree a st:ShapeTree ; st:expectsType st:Container ; st:contains :XResourceTree` |
| 4 | **Data registrations** | per container: `interop:DataRegistration ; interop:registeredShapeTree :XContainerTree ; interop:registeredBy <owner-WebID> ; interop:registeredWith <wiki-app>`, inside one `interop:DataRegistry` within a `interop:RegistrySet` linked from the **owner WebID** (`interop:hasRegistrySet`, D89/D90) |
| 5 | **Manager (container governance)** | each governed container's `.shapetree` auxiliary: `<> a st:Manager ; st:hasAssignment [ st:assigns :XContainerTree ; st:manages <container> ; st:focusNode <…#this> ; st:shape <…#XShape> ]`. Coexists with the `ldp:constrainedBy` floor (D108 Front-2) — both reference the same SHACL NodeShape |
| 6 | **Extension surface** | re-expresses the bespoke D100 contract in interop terms: adding a type = new `AccessNeed` + ShapeTree (`st:shape`→new SHACL, rooted per ClassExtensionShape) + `DataRegistration` + Type Index entry. The `cap:` feature layer is untouched |
| 7 | **Discovery** | the storage description advertises the Application/RegistrySet entry point (static config, since storage-description PATCH is 405 — D86 lesson); progressive disclosure (Tier-0) loads the grounded base vocab index (`interop:`, `st:`) on arrival |

**Namespace caveat (grounded):** `interop.ttl` (2020) declares its `registeredShapeTree` range using
`st: <…/shapetree#>` (singular); the actual ontology is `…/shapetrees#` (plural, `ontology/shapetrees.ttl`).
We use the **plural** (actually-defined) namespace for our ShapeTree instances. Documented in the
cache header.

## 4. Deliberately deferred within the foundation (additive — graphs grow)

- **`st:references`/`st:viaPredicate` edge topology.** Shape Trees can declare the cross-resource
  link graph (a Concept references a Person `st:viaPredicate dct:contributor`). This maps *exactly*
  to the grammar's resource-edge axis — but re-declaring governed edges there would create a **second
  source to keep in sync with SHACL** (the same drift trap as the two predicate maps). **MVP: SHACL
  (pointed at by `st:shape`) is the single source of governed predicates;** `st:references` is a
  clean future layer if a navigation consumer ever needs it.
- **Full registry semantics** (multi-`DataRegistry`, reciprocal `SocialAgentRegistration`,
  multi-app). MVP is one app, one registry.
- **The grant runtime** (§2). Deferred, openly absent.

## 5. Deployment

Extend `scripts/overlay/apply.py` + `common.py` with installers for the new artifact classes —
**discovered-through-use** (agentic-dev rule), not anticipated: an `interop:Application` doc +
`AccessNeedGroup`/`AccessNeed`s; the ShapeTree tree doc; `DataRegistration`s + the minimal
`RegistrySet`/`DataRegistry`; the per-container `.shapetree` Manager auxiliary. New manifest
predicates land when the existing structured predicates can't carry them. `make reset` must
reproduce the deployed foundation; `make audit` extends to validate it (the registration graph
resolves; every `registeredShapeTree` resolves to a ShapeTree whose `st:shape` is a deployed SHACL
NodeShape).

## 6. The seam to the grammar (sub-project A)

A's **published binding = vocabulary boundary** is exactly the Application's
`AccessNeed → registeredShapeTree → st:ShapeTree → st:shape → SHACL NodeShape` set. The grammar's
floor admits only assertions whose types/predicates that set governs; the **escalation seam**
(an unbound or TBox/KR-vocab term) routes to this layer's **extension surface** (§3.6) — a *real*
target (no-stubs). The grammar spec depends on this spec for the binding's source of truth.

## 7. Library assessment (done 2026-06-02 — feeds the plan)

- **`shapetrees.js`** (<https://github.com/shapetrees/shapetrees.js>): **dead** — last commit
  2021-05-11; deps `n3@^1.7.0` (we're on N3 v2), `@types/shexj` (**ShEx-assuming**), node12/TS4
  toolchain. **Do not adopt.** And we don't need a ShapeTree *runtime*: we use Shape Trees only as a
  **declaration vocabulary** (emit `st:ShapeTree`/`st:Manager` triples; resolve `st:shape` →
  dispatch to SHACL). So "rewrite what we need" collapses to *emit + read a handful of `st:` triples
  with N3 v2* on our own stack — the cached `shapetrees.ttl` + the spec snippets are the data-model
  guide. **No dependency.**
- **`shacl-engine`** (<https://github.com/rdf-ext/shacl-engine>): **actively maintained** (MIT;
  experimental commit 2026-05-25; v1.1.0 tagged). It is a **fast RDF/JS** engine whose constructor
  takes an RDF/JS `DatasetCore` + a `factory` — so it is **factory-agnostic** (pass N3's): the
  rdf-ext-vs-Solid conflict fear is **largely unfounded** (it interoperates at the RDF/JS interface,
  the same layer CSS/N3/`@rdfjs/types` already speak). Genuinely agentic-useful: SHACL **1.2** +
  SPARQL-based **node expressions** + **coverage** (the subgraph of triples a shape covers — directly
  useful for grammar-term 422 hints and the round-trip oracle). **Watch-item:** the *experimental*
  branch pulls `@comunica/query-sparql-rdfjs-lite` + `@traqula/*` (SPARQL 1.2) — a non-trivial
  footprint to measure in the CSS image (npm nesting should avoid hard conflicts with Solid's own
  Comunica usage, but bundle/maintenance cost is real). **Plan:** spike behind the **existing
  pluggable `ShaclValidator` seam** (`ShapeValidationStore` already takes a `validator`); try
  **stable v1.1.0** first, reach for *experimental* only if we need 1.2 node-expressions/coverage;
  **keep the current `rdf-validate-shacl@^0.6.0` (Zazuko) as the fallback** until the spike proves
  the footprint acceptable. Not a design change — a plan-phase evaluation with a fallback.

## 8. Testing

- **Registration graph resolves:** owner WebID → RegistrySet → DataRegistry → DataRegistration; every
  `registeredShapeTree` dereferences to a `st:ShapeTree`.
- **ShapeTree↔SHACL agreement:** each ShapeTree's `st:shape` is a **deployed** SHACL NodeShape; its
  `st:expectsType` matches the container/resource kind; the Manager's `st:shape` agrees.
- **Floor parity:** a write rejected by `ldp:constrainedBy` is the same shape the
  `registeredShapeTree` names (no divergence between the interop declaration and the enforced shape).
- **No-stub:** the grant-runtime surfaces are absent and any attempt to use them errors (not a silent
  accept); the bespoke `cap:` layer is untouched and still green under `make audit`.

## 9. Open decisions (for the plan / sub-specs)

- The exact Pod paths for the Application doc, the ShapeTree tree doc, and the RegistrySet/DataRegistry
  (proposal: under `/vault/meta/` + the owner WebID profile; confirm against D107 URI layering).
- Whether the Manager `.shapetree` auxiliary is **emitted at deploy** (static) or also reconciled at
  runtime; MVP = static at deploy.
- Library decision (§7) — resolve before the plan.

## 10. Relationship to prior decisions

- **Realizes D109 §5** (interop adopted as the agentic-app foundational vocabulary; vocabulary now /
  runtime deferred) and **corrects + realizes D110** (the cap/overlay→interop rebase — scope
  narrowed to the data-declaration half; `cap:` feature layer explicitly retained as bespoke).
- **Re-expresses D100** (the L4 class-extension contract) on the interop extension surface; keeps
  SHACL as validation (D108 Front-2 is the floor that makes the interop declaration enforceable).
- **Honors the shared-multi-user-substrate framing** (the RegistrySet/Application model is the
  multi-app coordination layer — MVP is single-app, but the structure is the standard one).
- **Builds on** D89/D90 (owner identity = the `SocialAgent` the RegistrySet hangs off), D84 (Pod-hosted
  hash namespaces), D107 (`sub:`/URI layering).
