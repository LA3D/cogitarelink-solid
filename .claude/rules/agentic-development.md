---
paths: ["overlays/**", "scripts/overlay/**", "shapes/**/*.ttl", "css/extensions/shape-validator/**", "docs/superpowers/plans/**"]
---

# Agentic Development Discipline

Process patterns earned during the AddressBook substrate sprint (2026-05-17).
Auto-loads when editing overlay artifacts, substrate machinery, SHACL shapes,
the shape-validator extension, or implementation plans. See the
`agentic-app-construction` skill for the architectural lenses; this rule is
about *how* to work.

## Framing first, then vote

Before answering a multiple-choice design question, check whether the framing
is locked. Symptom of a missing framing: you can't pick between options
because the trade-offs all sound reasonable. If "I don't have enough
information to vote" is the honest answer, back up and find the missing
framing rather than push for a decision.

**Why:** Forced votes on poorly-framed questions produce worse designs than
extra framing iterations. Three times in the AddressBook brainstorm, the user
escaped vote-shaped questions because the framing wasn't right — each escape
was correct. (See `docs/plans/2026-05-16-agentic-addressbook-design.md`'s
"narrative-vs-operational substrate" section for the framing that finally
unlocked the design.)

**How to apply:** When proposing 2-4 options to a user and they hesitate,
don't push for an answer. Ask what's unclear. The clarifying question they
ask usually reveals the missing framing.

## Cross-batch review is its own category

Per-batch tests verify internal consistency. They cannot catch mismatches
across batches — e.g., a template that references a SHACL shape constraint
the shape doesn't actually enforce, or a vocabulary predicate name that
diverges from how the predicate is later used.

**Why:** The AddressBook sprint's `vcard:inAddressBook` IRI bug shipped
through 4 per-batch reviews because each batch was self-consistent. Caught
only by an adversarial cross-batch review at sprint close.

**How to apply:** At the end of any multi-batch implementation, dispatch an
explicit adversarial reviewer with cross-batch consistency framed as the
primary lens (not "is each batch correct" — already covered). Also: for
artifact classes that have agreement contracts (templates ↔ shapes, vocab ↔
parser, capability declarations ↔ consumers), add a parametric test that
verifies the agreement. See
`tests/test_addressbook_templates.py::test_template_substituted_body_conforms_to_shape`
for the reference pattern.

## Substrate additions are discovered through use, not anticipated

Adding a new overlay almost always surfaces a missing primitive in
`scripts/overlay/apply.py` or `common.py`. Don't try to anticipate which
ones in advance; budget Batch-N time to add them when they surface.

**Why:** The AddressBook sprint added 5 overlay-machinery predicates
(`installsTemplate`, `installsContainerMetaPatch`, `installsBootstrapContent`,
`providesCapability`, originally `installsTypeIndexPatch`) — each discovered
when the existing machinery didn't quite fit. None were predictable in
advance.

**How to apply:** When implementing an overlay-deploy step that fails because
apply.py doesn't recognize a manifest predicate, add the predicate + parsing
+ deploy block, then continue. Don't escalate as a planning bug. The
substrate stabilizes through use, not through speculation.

## Provide capabilities reactively, not anticipatorily

When declaring `overlay:providesCapability`, only declare descriptors that a
real consumer (another overlay, the AddressBook skill, an eval target)
actually consumes. The capability catalog needs to exist for the system to
work; specific descriptors should be earned.

**Why:** The AddressBook sprint over-provided 5 capabilities with zero
consumers (vcard-individual-substrate, vcard-organization-substrate,
external-anchor-tracking, contact-discovery, tmpl-vocabulary). All
speculative. ~50 lines of Turtle that document things nothing depends on.
Caught in cross-batch review; documented in FOLLOWUPS as future-trim.

**How to apply:** When tempted to declare `providesCapability` for "future
flexibility," don't. Wait until overlay #2 actually requires it, then add the
descriptor + manifest entry together. Same pattern for any abstraction:
duplicate three times before extracting.

## Verify CSS behavior before building anything that depends on it

CSS has emergent constraints that aren't documented in spec (e.g.,
`validateNoContainersCreated` blocks sub-container creation within
constrained containers; relative IRI resolution in `sh:hasValue` uses
server root not vault root; storage description PATCH returns 405). These
surface as surprises mid-implementation.

**Why:** The AddressBook sprint's per-Person container layout (design said
`Person/<uuid>/index.ttl`) was blocked by CSS's sub-container constraint,
discovered at Batch 12 and worked around with a flat-file layout.
Earlier verification (a wider Batch 1) would have caught this before the
design crystallized.

**How to apply:** When starting substrate work, the Batch 1 verification
should be a *battery* of CSS-behavior checks: what writes succeed silently,
what gets validated, what response formats come back across error classes,
what container operations are allowed in different parent constraints. Cheap
to run; saves Batch-N rework.

## Don't reach for a new predicate when extending an existing one would work

When the deploy machinery needs a new behavior, ask: is the existing
mechanism one field away from working? If yes, extend it. Adding a new
predicate path that does roughly the same thing as an existing one is a
maintenance trap.

**Why:** The AddressBook sprint shipped `installsTypeIndexPatch` (raw N3
patch fallback) when extending `TypeRegistration` with an optional
`instance: URIRef` field was 10 LOC less. Consolidated in pre-push cleanup.

**How to apply:** When adding overlay-machinery support, first read the
existing parser to see if the existing structured predicate covers the
shape with a small extension. Only add a new predicate when the structured
path genuinely can't carry the new use case.

## Run apply.py as a module

`scripts/overlay/apply.py` uses relative imports (`from .common import ...`).
Running it as a script (`python scripts/overlay/apply.py ...`) fails with
"attempted relative import with no known parent package." Use the module
form:

```bash
~/uvws/.venv/bin/python -m scripts.overlay.apply overlays/<name> --target <pod-url>
```

**Why:** Standard Python behavior; relative imports require package context.

**How to apply:** Always invoke overlay apply/verify via `-m`. Same for any
script in `scripts/overlay/` using package-relative imports.

## Set TLS env for HTTPS Pod work

Python httpx doesn't read macOS Keychain (D85 / TLS deployment skill). Pod
calls fail with `CERTIFICATE_VERIFY_FAILED` unless `SSL_CERT_FILE` is set.

**Why:** mkcert-issued certs are in the macOS trust store; Python uses
certifi by default.

**How to apply:** Before any session that calls the live Pod from Python,
`export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem`. Or use `verify=False`
in httpx for tests (acceptable for the local mkcert dev deployment, not for
production).

---

**Related:** `python-patterns.md` for Python style; `rdf-patterns.md` for
Turtle conventions; the `agentic-app-construction` skill for architectural
lenses.
