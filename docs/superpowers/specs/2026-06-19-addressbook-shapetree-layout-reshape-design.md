# AddressBook ShapeTree↔layout reshape — vcard-domain interop fidelity (memory-systems piece 1b)

**Date:** 2026-06-19
**Status:** approved (brainstorm), pre-plan
**Relates to:** the 2026-06-18 Pod memory-systems architecture spec (`docs/superpowers/specs/2026-06-18-pod-memory-systems-architecture-design.md`, piece 1 — this is its second half, the vcard-domain ShapeTree fix the de-conflation plan deferred); D108 (admission floor / `ldp:constrainedBy`); D109 (derive/floor/loop); D110 (interop adoption: SAI declaration vocab, runtime deferred); D117 (shape-governance reconciliation — ShapeTrees as source of truth, derive `constrainedBy`); D84 (hash-namespace URI conformance).
**Predecessor plan:** `docs/superpowers/plans/2026-06-18-addressbook-write-contract-deconflation.md` (de-conflation; shipped 2026-06-18/19). Its "Follow-on" section names this work.

## Why

The addressbook ShapeTree mis-describes its deployed layout. The tree
(`overlays/addressbook/shapetrees/addressbook.tree.ttl`) models `/vault/contacts/` as a flat
container holding contact + organization *resources* directly:

```turtle
abtree:ContactContainerTree a st:ShapeTree ; st:expectsType st:Container ;
    st:contains abtree:ContactResourceTree, abtree:OrganizationResourceTree .
```

The deployed reality is **four typed subcontainers** — `/vault/contacts/{Person,Organization,Group,Membership}/`
— each holding flat `.ttl` resources, and each subcontainer's `.meta` is already individually
`ldp:constrainedBy` its vcard shape (Person at creation-time; the other three via post-creation N3
patch). The tree also **omits Group and Membership entirely**, and the addressbook lane has **no
interop manager files** (wiki-memory has seven; addressbook has only a registry entry and an
application descriptor).

Consequences of the divergence: the tree is not an accurate interop declaration of the substrate;
`derive_constraints.py` lists `/vault/contacts/` (the root) in `DURABLE_CONTAINERS` but its writer is
wiki-only, so the addressbook `constrainedBy` values are hand-maintained — a second source of truth
that can drift from the tree; and the floor↔tree parity tests cover only the wiki lane.

This is a **pure vcard-domain interop-fidelity fix**. No memory contract rides on it (the de-conflation
removed `mem:rationale` from this lane — addressbook is operational linked data). The goal is to make
the ShapeTree the single source of truth for the addressbook lane, exactly as D117 made it for wiki.

## Scope decision (settled)

**Full unification**, not minimal tree-fidelity. The reshape makes the tree the single source of truth
across both lanes: reshape the tree to the real nested layout, derive each subcontainer's `.meta`
`constrainedBy` from the tree (replacing the hand-maintained patches), generate addressbook managers,
and bring the addressbook subcontainers under the wiki parity tests. The alternative (reshape the tree
+ a parity test that merely guards the hand-maintained patches) was rejected: it leaves two sources of
truth that the test only keeps honest, against the whole reconciliation's direction.

## Section 1 — The reshaped ShapeTree

Replace the flat tree with a **nested** tree mirroring the deployed layout. The root keeps the name
`ContactContainerTree` (semantics come from the `st:contains` triples, not the local name, so no
rename). It now contains four per-class **container** trees; each container tree contains one
**resource** tree carrying the vcard shape.

**Registration model (corrected during implementation, 2026-06-19):** the original draft assumed the
registry was untouched. That was wrong — nesting introduces four new `st:Container` trees, and the
audit's `interop:registration-coverage` requires a `DataRegistration` per container tree. The
SAI-consistent fix (Chuck's call): a `DataRegistration` registers a *data-bearing* container, so the
single root registration `reg:contacts` is replaced by four leaf registrations
(`reg:contacts-{person,organization,group,membership}` → the four leaf `*ContainerTree`s), exactly
parallel to the wiki lane (one registration + one manager per leaf container) and to the four managers
built here. The structural grouping root (which `st:contains` only container trees, no resource tree)
is **exempt**: `pod_audit.py`'s coverage check is narrowed to container trees that directly
`st:contains` a resource tree, which leaves the wiki and id-schemes lanes unchanged and makes the
audit correct for any future nested tree. So `registry.ttl`, `pod_audit.py`, and the interop tests
ARE edited (the draft's "no registry edit" no longer holds).

```turtle
@prefix st:      <http://www.w3.org/ns/shapetrees#> .
@prefix abtree:  <https://pod.vardeman.me/vault/meta/shapetrees/addressbook.tree#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dcterms: <http://purl.org/dc/terms/> .

# root: contacts/ holds four typed subcontainers (no contact resources directly)
abtree:ContactContainerTree a st:ShapeTree ; st:expectsType st:Container ;
    rdfs:label "AddressBook root container tree" ;
    rdfs:comment "Governs /vault/contacts/ — holds the four typed subcontainers; no vcard resources live directly here." ;
    st:contains abtree:PersonContainerTree, abtree:OrganizationContainerTree,
                abtree:GroupContainerTree, abtree:MembershipContainerTree .

# one container tree per subcontainer
abtree:PersonContainerTree a st:ShapeTree ; st:expectsType st:Container ;
    rdfs:label "Person subcontainer tree" ;
    rdfs:comment "Governs /vault/contacts/Person/ — holds vcard:Individual contact cards." ;
    st:contains abtree:ContactResourceTree .
abtree:OrganizationContainerTree a st:ShapeTree ; st:expectsType st:Container ;
    rdfs:label "Organization subcontainer tree" ;
    rdfs:comment "Governs /vault/contacts/Organization/ — holds vcard:Organization cards." ;
    st:contains abtree:OrganizationResourceTree .
abtree:GroupContainerTree a st:ShapeTree ; st:expectsType st:Container ;        # NEW
    rdfs:label "Group subcontainer tree" ;
    rdfs:comment "Governs /vault/contacts/Group/ — holds vcard:Group records." ;
    st:contains abtree:GroupResourceTree .
abtree:MembershipContainerTree a st:ShapeTree ; st:expectsType st:Container ;   # NEW
    rdfs:label "Membership subcontainer tree" ;
    rdfs:comment "Governs /vault/contacts/Membership/ — holds group-membership records." ;
    st:contains abtree:MembershipResourceTree .

# resource trees carry the vcard shape (deployed SHACL NodeShape IRIs, catalog-resident)
abtree:ContactResourceTree a st:ShapeTree ; st:expectsType st:Resource ;
    rdfs:comment "A vcard:Individual contact card." ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/contact-card.shacl.ttl#ContactCardShape> .
abtree:OrganizationResourceTree a st:ShapeTree ; st:expectsType st:Resource ;
    rdfs:comment "A vcard:Organization card." ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/organization-card.shacl.ttl#OrganizationCardShape> .
abtree:GroupResourceTree a st:ShapeTree ; st:expectsType st:Resource ;          # NEW
    rdfs:comment "A vcard:Group record." ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/group.shacl.ttl#GroupShape> .          # exact fragment confirmed in plan
abtree:MembershipResourceTree a st:ShapeTree ; st:expectsType st:Resource ;     # NEW
    rdfs:comment "A group-membership record." ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/membership.shacl.ttl#MembershipShape> . # exact fragment confirmed in plan
```

Documentation lives in **formal annotation triples** (`rdfs:label`/`rdfs:comment`), not inline `#`
comments — the substrate reserializes (`.meta` round-trips, audit parse-and-reemit, JSON-LD conneg),
which strips lexical comments. (The `#` markers above mark *new nodes* for the reader of this spec; the
real file uses triples only.) The exact `GroupShape`/`MembershipShape` fragment names are confirmed
against the deployed catalog in the plan, not assumed.

Structural consequence: the constrained containers move from the root `/vault/contacts/` to the four
leaf subcontainers. The root governs only *which subcontainers may exist*; it carries no vcard shape.

## Section 2 — Full unification: derive constraints + managers from the tree

**2a. `derive_constraints.py` — `DURABLE_CONTAINERS` 1 entry → 4.** Replace the single
`/vault/contacts/` → `ContactContainerTree` entry with the four leaf subcontainers, each mapped to its
own container tree:

| Container | Container tree | Derived `constrainedBy` |
|---|---|---|
| `/vault/contacts/Person/` | `PersonContainerTree` | `contact-card.shacl.ttl` |
| `/vault/contacts/Organization/` | `OrganizationContainerTree` | `organization-card.shacl.ttl` |
| `/vault/contacts/Group/` | `GroupContainerTree` | `group.shacl.ttl` |
| `/vault/contacts/Membership/` | `MembershipContainerTree` | `membership.shacl.ttl` |

The root `/vault/contacts/` drops out of the constrained set. No write contract anywhere — addressbook
stays out of `CONTRACT_BEARING` (the de-conflation already set this). The existing `derive_constrainedby`
logic (walk container tree → `st:contains` → resource tree → `st:shape`) works unchanged per entry.

**2b. The writer generalizes; the deploy mechanism stays put (the CSS wrinkle).** Today the writer
rewrites only wiki `.meta`. Extend it to regenerate the four addressbook deploy source files —
`overlays/addressbook/containers/{person,organization,group,membership}-container-meta.ttl` — writing
their `ldp:constrainedBy` *from the tree*. `apply.py` keeps deploying them exactly as now: Person at
creation-time (block 8, so the marie-curie bridge can bootstrap into a constrained container); the
other three as post-creation N3 patches (block 11, because CSS H400-blocks re-constraining a non-empty
container). **Content derived from the tree; deploy ordering unchanged** — that is what makes the tree
the single source without fighting CSS's emergent constraints.

**2c. `gen_managers.py` becomes overlay-parameterized** (extend, don't duplicate). Today it is wiki-only
and writes seven managers to `overlays/wiki-memory/interop/managers/`. Add an addressbook config block so
it emits four managers to `overlays/addressbook/interop/managers/` — one per subcontainer
(`<> a st:Manager ; st:hasAssignment <#a1> . <#a1> st:assigns <its container tree> ; st:manages <subcontainer-url> .`).
This is what `test_interop_foundation`'s one-manager-per-container check needs to cover addressbook like
wiki. It touches the addressbook manifest (manager install entries) and the apply.py manager-deploy path
wiki already uses.

**2d. Parity test** modeled on `test_floor_parity`: add the four subcontainers (parametrize the wiki-only
`GOVERNED` fixture, or a sibling test) asserting per-subcontainer
`deployed .meta constrainedBy == manager → containerTree → st:contains → st:shape`.
`test_interop_foundation`'s "every shape defined / no dangling trees" extends for free once the
Group/Membership resource trees and the four managers exist (update its expected-shape set to include
`GroupShape`/`MembershipShape`).

## Components and interfaces

- **ShapeTree** (`addressbook.tree.ttl`) — declarative interop description. Interface: `st:contains` /
  `st:shape` graph reachable from `ContactContainerTree`. Consumed by `derive_constraints.py`,
  `gen_managers.py` (indirectly via the container→tree map), the parity tests, and (inert) the SAI
  registry. Depends on: the deployed vcard shape IRIs.
- **`derive_constraints.py`** — `derive_constrainedby(overlay_dir, container_url) -> set[str]` (unchanged
  signature; four new addressbook keys) + the writer (generalized to emit the four addressbook
  `*-container-meta.ttl` files). Depends on: the tree, the `DURABLE_CONTAINERS` map.
- **`gen_managers.py`** — emits `st:Manager` auxiliaries per (overlay, container, container-tree). Depends
  on: the per-overlay container→tree config.
- **`apply.py`** — deploy, unchanged mechanism; consumes the derived `*-container-meta.ttl` and the new
  manager files (manifest install entries).
- **Parity tests** — verify the tree ↔ deployed `.meta` ↔ managers agree.

## Testing

Offline: tree + shapes parse; `derive_constrainedby` returns the right shape set for each of the four
subcontainers; the manager generator emits four well-formed managers. Live gate: `make reset && make
verify` (0 ERROR / 1 intentional D98 WARN) — the derived `.meta` deploys, the marie-curie bridge still
bootstraps, the four subcontainers are each `constrainedBy` their vcard shape; the new parity test and
the extended `test_interop_foundation` pass; full pytest suite green (known `test_timemap` flake passes
in isolation); `make test-js` green.

## Risks — verified in the plan, not assumed

1. **Exact Group/Membership shape fragment IRIs** — confirm `group.shacl.ttl#GroupShape` /
   `membership.shacl.ttl#MembershipShape` against the deployed catalog before wiring `st:shape`.
2. **Stale root `contacts/` constraint** — the old `DURABLE_CONTAINERS` pointed the *root* at
   `{contact-card, organization-card}`; reality constrains the subcontainers. Confirm the deployed
   `/vault/contacts/` `.meta` carries no stale `constrainedBy` after the move; remove it if present.
3. **Bootstrap ordering** — Person's creation-time constraint must still precede the marie-curie bridge
   seed (the reason it is block 8, not block 11). The reshape must not reorder this.
4. **Manager deploy path** — confirm apply.py's existing manager-deploy mechanism (used by wiki) accepts
   the addressbook manager install entries, or extend it minimally if it is wiki-pathed.
5. **Adversarial cross-batch review at close** — tree ↔ derived `.meta` ↔ managers ↔ registry must agree
   as a *set* (each batch is internally consistent; cross-batch mismatch is the documented failure mode —
   see `.claude/rules/agentic-development.md`).

## Out of scope (YAGNI)

- **id-schemes classification** (operational reference vs memory) — a separate decision; gates whether its
  `mem:rationale` stays and whether its own tree↔layout divergence is reshaped. Not touched here.
- **The crosswalk** — bridge predicate (`foaf:primaryTopic` vs `schema:sameAs`) + tier-jump breadcrumb
  (memory-systems piece 2). Not touched.
- **Any memory contract** — `mem:rationale` stays removed from this lane; standard `prov:` provenance is
  unaffected and not part of this work.
- **WAC / security profile** — deferred identity work.
- **Relationship classification, episodic store, judgment promotion** — memory-systems pieces 3-5.
