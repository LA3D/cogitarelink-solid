# Re-base `cap:`/`overlay:` app-declaration terms on `interop:` — Decision (D110, STUB)

**Date:** 2026-06-02. **Status:** DESIGNED + SCOPE-CORRECTED — realized in
`2026-06-02-interop-foundation-design.md`. **Parent:** D109 §5. **Grounding artifacts:**
`ontology/interop.ttl`, `ontology/shapetrees.ttl` (+ `ontology/README.md`).

> **Scope correction (2026-06-02, from grounding).** The mapping table below contains a **category
> error**: `cap:requires`/`overlay:providesCapability` declare a dependency on a **substrate feature
> implemented by a CSS extension**, NOT an `interop:AccessNeed` (an `acl:` access request for
> shape-typed data). interop does **not** model substrate features. The corrected rebase covers
> **only the data-declaration half** (overlay → `Application` + `AccessNeedGroup`/`AccessNeed`; typed
> containers → `DataRegistration` keyed by `registeredShapeTree` → `st:ShapeTree` → our SHACL); **the
> `cap:`/feature layer stays bespoke.** Shape Trees fit 1:1 (`st:shape` has an open range → points at
> our SHACL NodeShape; no deviation). See the realized design for the corrected model.

## Problem

Our bespoke `cap:` (capability) + `overlay:` (overlay / app-declaration) terms — `cap:requires`,
`overlay:providesCapability`, `cap:capability`, the `/vault/meta/capabilities/` catalog, and overlay
`manifest.ttl` as app-declaration — **reinvent machinery W3C Solid Application Interoperability
(`interop:`) already specifies.** This is the "mint-our-own-when-a-standard-exists" anti-pattern
(agentic-development rule: *don't reach for a new predicate when extending an existing one would work*).

## Direction (to design)

Re-base the agentic-app-declaration layer on `interop:` (adopt the **vocabulary**; do **not** build the
Authorization-Agent runtime — D109 §5):

| Ours (bespoke) | `interop:` |
|---|---|
| overlay + `manifest.ttl` | `Application` / `ApplicationRegistration` |
| `cap:requires` | `AccessNeedGroup` / `AccessNeed` + `registeredShapeTree` |
| `/vault/meta/capabilities/` catalog | a registry |
| wiki containers (`/concepts/` …) | `DataRegistration` (shape-governed typed data) |

Keep SHACL as the validation layer.

## Open

- **The `registeredShapeTree`→SHACL bridge** — wrap our shapes in thin Shape Trees vs. point
  `registeredShapeTree` at the shape catalog as a documented deviation (Shape Trees are frozen, 2021).
- **Migration** of deployed `cap:`/`overlay:` triples + the `pod_audit.py`/pod-curator tooling that
  reads them.
- **Term mapping** — which `interop:` terms map cleanly vs. need a documented deviation.
- **Avoid the grant/authorization terms** — volatile (CG-DRAFT relitigating, issue #334).

## Grounding

D109 (substrate re-grounding) §5; `ontology/interop.ttl` + `ontology/README.md`; the shared-multi-user
substrate framing; the agentic-development rule on not minting when a standard exists.
