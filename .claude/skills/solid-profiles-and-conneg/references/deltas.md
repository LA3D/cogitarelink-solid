# PROF + Conneg — Project Deltas (cogitarelink-solid)

This Pod's specific profile catalog. Read when working *in this repo* and you need to know which profile IRIs are minted and where their descriptors live.

---

## The 5 wiki-memory L3 profiles

Hosted on this Pod at `https://pod.vardeman.me/vault/meta/profiles/`:

| Class IRI | Profile IRI | Token |
|---|---|---|
| `wiki:Page` (base) | `https://pod.vardeman.me/vault/meta/profiles/page` | `wiki-page` |
| `wiki:Concept` | `https://pod.vardeman.me/vault/meta/profiles/concept` | `wiki-concept` |
| `wiki:Source` | `https://pod.vardeman.me/vault/meta/profiles/source` | `wiki-source` |
| `wiki:Person` | `https://pod.vardeman.me/vault/meta/profiles/person` | `wiki-person` |
| `wiki:Procedure` | `https://pod.vardeman.me/vault/meta/profiles/procedure` | `wiki-procedure` |
| `wiki:WorkingNote` | `https://pod.vardeman.me/vault/meta/profiles/working` | `wiki-working` |

Profile chain:

```
        Solid Protocol  (dct:Standard)
              ↑
        wiki:PageProfile  (root profile)
              ↑
   ┌──────────┼──────────┬───────────────┬───────────────┐
   │          │          │               │               │
  concept   source     person       procedure         working
```

Each non-root profile emits `prof:isTransitiveProfileOf` explicitly (page + Solid Protocol) so clients don't need to walk the chain.

## Files

The 5 PROF Turtle files live in the wiki-memory overlay:

```
overlays/wiki-memory/profiles/
├── page.ttl
├── concept.ttl
├── source.ttl
├── person.ttl
├── procedure.ttl
└── working.ttl
```

Currently **committed but not auto-installed**. The overlay machinery doesn't yet have an `installsProfile` predicate parallel to `installsShape` / `installsAffordance`. Two open items in `FOLLOWUPS.md`:

1. Add `overlay:installsProfile` to the overlay schema + parse it in `scripts/overlay/common.py` + upload it in `scripts/overlay/apply.py` (~15 LOC).
2. Build a `Link: rel="profile"` MetadataWriter CSS extension at `css/extensions/profile-link/` that emits the profile Link header per resource GET (~30 LOC, mirrors `MementoLinkMetadataWriter`).

Until those land, the profile descriptors exist as designed Turtle in the overlay directory but aren't served by the Pod and the Link header isn't emitted.

## Custom roles minted

When the 8 standard PROF roles don't fit, this project mints custom roles in the wiki vocabulary namespace:

- `wikirole:affordance` — for affordance descriptors (D52). Used in profile ResourceDescriptors that point at `/vault/meta/affordances/*.ttl`. Standard roles are too generic; `role:constraints` is closest but doesn't capture the machine-actionable, agent-facing semantic.

## Conventions used

- Profile descriptor IRIs use **fragment identifiers** (`#shape`, `#context`, `#vocab`) for the ResourceDescriptors. Each profile is a single Turtle document; fragments distinguish the descriptors within it.
- Every profile carries `prof:hasToken` for QSA conneg. Tokens are mnemonic and prefixed with `wiki-`.
- `dct:publisher` points to the ORCID of the author for attribution.

## What's deferred

- The `Link: rel="profile"` MetadataWriter (D86 implementation).
- `_profile=alt` introspection view.
- Overlay machinery to auto-install profile descriptors.

All tracked in `FOLLOWUPS.md` under "Phase 5j close-out."

## Related project skills

- `solid-uri-conformance` — the IRI form profile descriptors take
- `solid-wiki-memory-l3` — the class hierarchy these profiles cover
- `solid-storage-description` — where the profile catalog gets advertised (D44)
- `solid-affordance-descriptors` — uses the `wikirole:affordance` custom role
- `metadata-writer` — pattern for the deferred Link-rel-profile MetadataWriter extension
