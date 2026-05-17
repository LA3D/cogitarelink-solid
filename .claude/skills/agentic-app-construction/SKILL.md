---
name: agentic-app-construction
description: How an agentic application is built on this Pod — substrate-vs-application split, the narrative-vs-operational substrate lens, the 7 artifacts that compose an agentic app, the bridge-predicate pattern for cross-substrate linking, the template+SHACL+feedback pipeline, and capability-based coupling. Reflects empirical learning from the AddressBook substrate sprint (2026-05-17). Distinct from `css-extension` (substrate-level TypeScript work) and `shacl-shapes` (shape design).
when_to_use: When designing or building a new agentic application on this Pod — a new overlay, a new substrate use case beyond what wiki-memory + AddressBook cover. Also when extending the Pod's substrate primitives (overlay machinery additions, new artifact classes). Invoke at the brainstorming stage of a new overlay design, before voting on architectural options. See D87 (capabilities-only deps) and D88 (tmpl: substrate templates) for the primitives this skill assumes.
---

# Agentic Application Construction

How agentic applications are built on this Pod, based on the AddressBook
substrate sprint (2026-05-17). The pattern is general: any agentic app that
hosts both LLM-reasoning context and deterministic tool-callable data will fit.

## What an agentic app IS on this Pod

Almost entirely Turtle. The AddressBook is 4 SHACL shapes + 5 templates + 8
affordance descriptors + 5 capability descriptors + 3 bootstrap files + 4
`.meta` patches + 1 manifest + 1 vocabulary. Zero lines of imperative code
define what an AddressBook *is*.

The code we write is *substrate machinery* — making patterns first-class so
the next overlay can express itself in Turtle. The shape-validator fix
(`ShaclErrorHandler`) benefits every shape on the Pod. The
`installsTemplate` predicate benefits every overlay that wants templates.
None of the code knows anything about contacts.

This means: building an agentic app on this Pod is mostly **metadata
authoring**. The substrate carries it.

## The narrative-vs-operational substrate lens

Most agentic apps have two consumers with conflicting needs:

| Consumer | Wants | Format on this Pod |
|---|---|---|
| **LLM reasoning loop** | Prose, narrative context, lateral wikilinks, sectioned structure for next-token coherence | Markdown body + `.meta` projection (wiki-memory L3) |
| **Agent tool-calling loop** | Canonical-form values, schema-validated fields, deterministic operations | Structured Turtle, SHACL-validated (e.g., AddressBook vcard cards) |

A unified substrate forces a compromise on both axes. Two substrates with an
explicit bridge let each be sharp for its purpose. The bridge is a single
predicate — `foaf:primaryTopic` for AddressBook↔wiki — that connects the two
information objects without subordinating one to the other.

When designing a new agentic app, ask first: which substrate is for the LLM's
reasoning, which is for the agent's tool-calling, what's the bridge predicate?
The architecture follows from the answer.

## The 7 artifacts of an agentic app

A typical overlay declares these, all in Turtle:

1. **Containers** — where typed resources live (`overlay:installsContainer`)
2. **Vocabulary** — the namespace + classes + predicates the app introduces
   (`overlay:declaresVocabulary`, hosted at `/vault/ontology/<name>` per D84)
3. **SHACL shapes** — validation contracts per type
   (`overlay:installsShape`); see `shacl-shapes` skill
4. **Templates** — front-loaded RDF skeletons paired with shapes (D88;
   `overlay:installsTemplate`)
5. **Affordance descriptors** — declarative SPARQL queries the agent invokes
   (D52; `overlay:installsAffordance`)
6. **Capability declarations** — what the overlay needs + provides
   (`overlay:requiresCapability`, `overlay:providesCapability`; see D87)
7. **Overlay manifest** — the install-time spec that ties it together

Deploy via `python -m scripts.overlay.apply overlays/<name> --target <pod-url>`.
The script is idempotent.

## The substrate pattern: template + SHACL + readable feedback

This is the core write pipeline. From D88:

```
Agent intent: "create X"
     │
     ▼
1. Fetch /vault/meta/templates/<x>-create.ttl     ← front-loaded context
   • Required fields + sh:agentInstruction guidance
   → Agent gets the shape upfront, fills correctly first try
     │
     ▼
2. PUT /vault/<container>/<slug>.ttl              ← single round-trip on happy path
     │
     ▼
3a. SHACL passes → 201. Done.
3b. SHACL fails  → 422 + text/turtle body with sh:ValidationReport
                   → Agent reads, corrects, retries
```

Templates eliminate ~90% of SHACL hits by giving the agent the right shape
upfront. The SHACL feedback extension (`css/extensions/shape-validator/`)
serializes the `ValidationReport` as Turtle in the 422 response so agents can
self-correct without opaque-error retry loops. Trajectory token cost: template
fetch (~200 tokens) + happy-path PUT (~50 tokens) vs error-loop trajectory
(1000s of tokens across multiple retries).

When adding write operations to a new overlay, the template + SHACL + readable
feedback triple is the default pattern — not an optimization.

## Capability-based coupling (D87)

The capability catalog at `/vault/meta/capabilities/` is the only mechanism
for overlay-to-overlay coupling. Overlays declare what they *need* via
`overlay:requiresCapability` (existing) and what they *provide* via
`overlay:providesCapability` (added in this sprint).

Key practice: **provide capabilities reactively, not anticipatorily**. The
AddressBook over-implemented this by declaring 5 provided capabilities with
zero consumers. The catalog needs to exist for the system to work; specific
descriptors should be earned by a real consumer materializing. When overlay
#2 needs `external-anchor-tracking`, that's when AddressBook should declare
it. Until then, anticipated descriptors are YAGNI debt.

## Cross-substrate bridges via `foaf:primaryTopic`

When two substrates host different information objects about the same agent
(e.g., a wiki page + a vcard card about Jarek), they bridge via:

```turtle
</vault/wiki/people/jarek-nabrzyski.md>
    foaf:primaryTopic </vault/contacts/Person/<uuid>.ttl#this> .
```

The wiki page is *about* the agent; the card is *about* the agent; they share
the same primaryTopic. Different substrates, different consumers, same
referent. The convention is provided as a capability
(`foaf-primarytopic-bridge` by wiki-memory) so downstream overlays can declare
they depend on it.

For external identity (the same agent across pods), use `owl:sameAs` to
shared canonical anchors (ORCID for people, ROR for organizations, WebID for
Solid-OIDC). The `external-anchor-tracking` capability documents this
convention.

## The discovery chain (what a cold agent sees)

```
GET /vault/.well-known/solid       (storage description — static config)
  → wiki:shapeCatalog → /vault/meta/shapes/
  → wiki:affordanceCatalog → /vault/meta/affordances/
  → wiki:templateCatalog → /vault/meta/templates/
  → wiki:contactCatalog → /vault/contacts/
  → wiki:typeIndex → /vault/settings/publicTypeIndex
  → cap:catalog → /vault/meta/capabilities/
  ↓
GET /vault/settings/publicTypeIndex
  → vcard:AddressBook → /vault/contacts/index.ttl#this
  → (other registered types)
  ↓
For write operations: fetch /vault/meta/templates/<x>-create.ttl
For read operations: invoke /vault/meta/affordances/<query>.ttl
For validation: parse /vault/meta/shapes/<shape>.shacl.ttl
For capability checks: GET /vault/meta/capabilities/<cap>.ttl
```

Storage description entries advertise the catalogs; everything else is
discoverable from those. When adding a new overlay, add the catalog discovery
entry to `css/config/void-description.json` (storage description is static
per CSS 405-on-PATCH limitation — see D87).

## Substrate machinery evolves through use

The AddressBook sprint added 5 overlay-machinery predicates
(`installsTemplate`, `installsContainerMetaPatch`, `installsBootstrapContent`,
`providesCapability`, originally `installsTypeIndexPatch`). Each surfaced as
the existing machinery didn't quite fit, not from advance planning.

Implication for new overlay work: budget Batch-N time for substrate-machinery
additions. The overlay you're shipping will often reveal a primitive missing
from `scripts/overlay/apply.py` and `common.py`. Don't try to anticipate
these in advance — let them surface, fix them in place, mark the next overlay
easier.

If the second overlay you ship needs zero new substrate additions, the
substrate is approaching stability. The fifth overlay's marginal cost is the
real test.

## Pitfalls observed in the AddressBook sprint

- **Anticipating consumers for provided capabilities.** YAGNI; provide
  reactively (see above).
- **Building parallel mechanisms when extension would suffice.** The
  `installsTypeIndexPatch` raw-patch fallback was added when extending
  `TypeRegistration` with an optional `instance` field was ~10 LOC less.
  Consolidated in cleanup, but the lesson: when reaching for a new
  predicate, ask "is the existing one one field away from working?"
- **Missing CSS-behavior verification at Batch 1.** The Batch 1 SHACL
  feedback test happened to surface the missing-ValidationReport gap, but it
  was scoped narrowly. Wider Batch-1 verification (test what CSS gates, what
  it doesn't, what response formats come back across error classes) would
  have surfaced the `validateNoContainersCreated` constraint that blocked
  the per-Person container layout.
- **Template-to-shape agreement bugs are invisible to per-batch review.**
  Template + shape + test all internally consistent within their batches.
  The cross-substrate mismatch only surfaced at the cross-batch review.
  Pattern: write a parametric test that substitutes template placeholders
  with realistic values and validates against the declared shape. This is
  cheap and catches a real class of bug. See
  `tests/test_addressbook_templates.py::test_template_substituted_body_conforms_to_shape`
  for the reference implementation.

## What to read next

- D87 (`capability catalog as only overlay coupling`) — decision rationale
  in `.claude/skills/decision-lookup/decisions.md`
- D88 (`tmpl: substrate template vocabulary`) — same
- `docs/plans/2026-05-16-agentic-addressbook-design.md` — the AddressBook
  design that proved the pattern
- `docs/plans/2026-05-16-capabilities-only-overlay-deps.md` — the D87
  substrate-machinery design
- `docs/superpowers/plans/2026-05-16-addressbook-substrate.md` — the
  implementation plan, as a reference for the level of detail an overlay
  build plan needs

## Related skills

- `css-extension` — when the substrate-machinery additions require new
  TypeScript code (CSS extension layer)
- `shacl-shapes` — shape design conventions
- `components-override` — Components.js wiring patterns when registering a
  new ErrorHandler or other DI component
- `decision-lookup` — for full text of D87, D88, and adjacent decisions
- `solid-uri-conformance` — when minting new IRIs (vocabularies, instances)
