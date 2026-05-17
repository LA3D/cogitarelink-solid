# Capabilities-Only Overlay Dependencies — D83 Completion

**Status:** Working design, not yet ratified into a D-numbered decision. Surfaced
during AddressBook substrate plan execution (2026-05-16) when the broken
`overlay:installedOverlay` tracking mechanism blocked overlay-to-overlay
dependency checking.

**Companion docs:**
- `docs/plans/2026-05-16-agentic-addressbook-design.md` (the consumer that
  forced this decision)
- `docs/superpowers/plans/2026-05-16-addressbook-substrate.md` (the plan
  that revealed the issue)

**Related decisions:** D44 (storage description router; explains why
`.well-known/solid` is static), D83 (Pod-as-toolkit, capability catalog), D84
(URI conformance).

---

## 1. The decision

**Capabilities are the only overlay dependency mechanism.** Overlay-to-overlay
coupling, overlay-to-extension coupling, and runtime capability discovery all
go through the capability catalog at `/vault/meta/capabilities/`. The
overlay-tracking predicates (`overlay:dependsOnOverlay`,
`overlay:installedOverlay`) are deprecated and removed from the overlay
machinery.

A new predicate `overlay:providesCapability` is added so overlays can advertise
the capabilities they make available to other overlays at install time. The
`overlay:requiresCapability` predicate already exists and stays; it's the
consumer side of the same contract.

---

## 2. Why the change

D83 (Pod-as-toolkit) already declared the capability catalog the substrate's
canonical dependency surface for applications-on-overlays. What was incomplete:
overlays themselves couldn't *provide* capabilities to other overlays — only
the substrate (CSS extensions) could. This left a vestigial mechanism
(`overlay:dependsOnOverlay`/`installedOverlay`) for overlay-to-overlay coupling
that turned out to be unworkable in the current deployment:

| Constraint | Implication |
|---|---|
| CSS returns 405 on PATCH to `.well-known/solid` | The storage description is static; `overlay:installedOverlay` triples in overlay storage-patches never land |
| `overlay:installedOverlay` lives in the storage description by design | Runtime overlay-install can't record itself |
| Workaround "put everything in void-description.json" requires CSS rebuild per overlay | Defeats the runtime-applicable overlay model |

The deferred decision flagged in `.claude/skills/solid-uri-conformance/references/deltas.md`
("Revisit if overlay needs runtime augmentation of the storage description")
is being resolved here: rather than work around the 405, we drop the mechanism
that needs the workaround.

Capability-based dependencies are strictly better for the coupled-app future:

1. **Atomic**: A capability is a single behavior. Overlays can split, merge,
   or refactor without breaking dependents as long as the capabilities they
   provide stay stable. Overlay-level dependencies break the moment a refactor
   touches structure.

2. **Substitutable**: Multiple overlays can provide the same capability. A
   future "vault-skim" overlay could provide `foaf-primarytopic-bridge`
   alongside or instead of wiki-memory. Consumers don't care which.

3. **Version-aware**: `cap:minVersion` is already in the model. Overlay-level
   dependencies would need a parallel version mechanism.

4. **Runtime-mutable**: `/vault/meta/capabilities/` is a normal LDP container.
   Overlays install by PUTting capability descriptors. No CSS-extension
   workarounds, no static-config rebuilds.

5. **Honest**: The dependency is on the artifact actually consumed — a
   predicate, a vocabulary, a behavior — not on the overlay wrapper that
   bundles it. Asking "what does AddressBook need?" returns "wiki vocabulary,
   SHACL validation, vcard schema, foaf:primaryTopic bridge convention" rather
   than the machinery-wrapper name "wiki-memory."

---

## 3. What this deprecates

| Predicate | Status | Replacement |
|---|---|---|
| `overlay:dependsOnOverlay` | Deprecated, removed from apply.py | `overlay:requiresCapability` |
| `overlay:installedOverlay` | Deprecated, removed from apply.py | `overlay:providesCapability` (declares what an overlay installs into the catalog) |
| Per-overlay `storage-patch.ttl` recording `installedOverlay` | Deprecated, files retained as dead code (clean up next pass) | None — storage description entries that overlays do need go into `css/config/void-description.json` |

`check_overlay_dependencies()` in `scripts/overlay/apply.py` is removed in
full. `check_capabilities()` stays unchanged — it already does the right
thing.

---

## 4. The new predicate: `overlay:providesCapability`

Added to the overlay vocabulary at `/vault/ontology/overlay#`:

```turtle
overlay:providesCapability
    a rdf:Property ;
    rdfs:label "provides capability" ;
    rdfs:comment """
      An overlay provides a capability when installed. apply.py iterates this
      predicate during install and PUTs each referenced capability descriptor
      to /vault/meta/capabilities/. Other overlays declare overlay:requiresCapability
      against the same descriptor IRI.

      Each entry is a blank node with cap:capability (the descriptor IRI),
      cap:version (the version this install provides), and optional
      cap:descriptor (path to the descriptor file in the overlay directory).
    """ ;
    rdfs:domain overlay:Overlay .
```

apply.py iterates `manifest.provides` and PUTs each descriptor:

```python
# In apply_overlay, after artifact uploads:
for cap in manifest.provides:
    descriptor_path = overlay_dir / cap.descriptor
    descriptor_body = descriptor_path.read_text()
    catalog_url = pod_url + "meta/capabilities/" + cap.descriptor.name
    put_file(client, catalog_url, descriptor_body, "text/turtle")
```

Future overlays declare their dependencies via the same `requiresCapability`
mechanism that wiki-memory already uses:

```turtle
<overlay#addressbook>
    overlay:requiresCapability
        [ cap:requires <.../meta/capabilities/wiki-vocabulary.ttl> ;
          cap:minVersion "1.0" ] ,
        [ cap:requires <.../meta/capabilities/foaf-primarytopic-bridge.ttl> ;
          cap:minVersion "1.0" ] ;

    overlay:providesCapability
        [ cap:capability <.../meta/capabilities/vcard-individual-substrate.ttl> ;
          cap:version "1.0" ;
          cap:descriptor "capabilities/vcard-individual-substrate.ttl" ] ,
        [ cap:capability <.../meta/capabilities/external-anchor-tracking.ttl> ;
          cap:version "1.0" ;
          cap:descriptor "capabilities/external-anchor-tracking.ttl" ] .
```

---

## 5. Static storage description, intentional

The storage description (`.well-known/solid`) stays static, served from
`css/config/void-description.json`. This is the documented CSS limitation,
acknowledged and embraced rather than worked around.

What goes in `void-description.json`:

- Pod-level metadata (`dct:conformsTo`, `void:vocabulary` for top-level
  vocabularies)
- Substrate-level catalog discovery entries (`wiki:contextDocument`,
  `wiki:shapeCatalog`, `wiki:affordanceCatalog`, `wiki:typeIndex`,
  `wiki:contactCatalog`, `wiki:templateCatalog`, `cap:catalog`)
- `rdfs:seeAlso` for top-level containers
- `prof:hasResource` for PROF profile descriptors

What does NOT go there:
- Per-overlay tracking (covered by capability catalog now)
- Anything that changes at runtime

Editing `void-description.json` requires `make reset` to take effect. This is
acceptable because the entries are stable substrate-discovery affordances, not
runtime-application state.

---

## 6. Migration

Single migration cycle, fits in the AddressBook substrate plan execution:

1. **Refactor `scripts/overlay/apply.py`**:
   - Delete `check_overlay_dependencies()` function entirely
   - Remove the call to it from `apply_overlay()`
   - Add `providesCapability` iteration after artifact uploads
   - Update `scripts/overlay/common.py` `Manifest` dataclass: add
     `provides: list[CapabilityProvision]`; parse `overlay:providesCapability`
     blank nodes

2. **Update overlay vocabulary**:
   - Edit `css/config/pod-templates/base/ontology/overlay.ttl`
   - Add `overlay:providesCapability` predicate definition
   - Mark `overlay:dependsOnOverlay` and `overlay:installedOverlay` as
     `owl:deprecated true`

3. **Update `wiki-memory` overlay**:
   - Add `overlay:providesCapability` entries to manifest
   - Create capability descriptors under `overlays/wiki-memory/capabilities/`
     for at minimum: `wiki-vocabulary`, `foaf-primarytopic-bridge`,
     `wiki-type-index-registration`, `wiki-page-as-unit`
   - Re-apply: `python scripts/overlay/apply.py overlays/wiki-memory --target https://pod.vardeman.me/vault/`

4. **Update `wiki-memory`'s `storage-patch.ttl`**: remove the
   `overlay:installedOverlay` line (the rest of the patch is also unusable per
   §5, but removing piecemeal is fine — clean up the whole file in a follow-up).

5. **`make reset`** once after `void-description.json` updates land for the
   AddressBook substrate's storage-description entries.

---

## 7. Open questions

- **Capability descriptor schema**: capability catalog descriptors today use a
  loose convention (`cap:Capability` with `cap:version`, etc.). Should this be
  formalized into a SHACL shape? Probably yes, once a third overlay provides a
  capability — wait for empirical evidence of the right shape.

- **Capability provenance**: when a capability is installed, should the
  descriptor record which overlay installed it (`prov:wasAttributedTo
  <overlay-iri>`)? Useful for "who installed this and where can I find the
  overlay source," but adds substrate-machinery complexity. Defer until needed.

- **Capability deprecation/removal**: if an overlay is removed, do its
  provided capabilities get removed from the catalog? Today there's no
  `remove_overlay` flow; when there is, this question becomes load-bearing.

- **Cross-Pod capability federation**: a future use case — Pod A's AddressBook
  declares it requires `vcard-individual-substrate v1.0`; Pod B happens to
  provide that. Should there be a discovery mechanism for cross-Pod capability
  matching? Round 4 territory.

---

## 8. Cleanup deferred to follow-up

- Delete all per-overlay `storage-patch.ttl` files (dead code after §5)
- Drop `overlay:dependsOnOverlay` and `overlay:installedOverlay` from the
  overlay vocabulary entirely (after a deprecation cycle — for now, marked
  deprecated)

---

## 9. References

- D83 (Pod-as-toolkit): `.claude/skills/decision-lookup/decisions.md`
- URI conformance deltas (the deferred-decision note): `.claude/skills/solid-uri-conformance/references/deltas.md` lines 49-50
- D44 (storage description router): explains why `.well-known/solid` is static
- AddressBook substrate plan: `docs/superpowers/plans/2026-05-16-addressbook-substrate.md`
- AddressBook design doc: `docs/plans/2026-05-16-agentic-addressbook-design.md`

---

## 10. D-numbered ratification

When ratified, this becomes a D-number (D87 or later — depends on whether
`tmpl:` vocabulary ratifies first). Decision text:

> **D-N — Capabilities-only overlay dependencies.** The capability catalog at
> `/vault/meta/capabilities/` is the only overlay dependency mechanism.
> `overlay:dependsOnOverlay` and `overlay:installedOverlay` are deprecated and
> removed from apply.py. Overlays declare `overlay:providesCapability` to add
> capability descriptors to the catalog at install time; consumers use
> `overlay:requiresCapability` as before. Storage description stays static in
> `css/config/void-description.json` (CSS 405-on-PATCH limitation
> acknowledged). Completes D83 (Pod-as-toolkit) for overlay-to-overlay
> coupling and resolves the deferred-decision flag in URI conformance deltas.
