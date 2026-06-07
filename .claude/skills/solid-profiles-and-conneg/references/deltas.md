# PROF + Conneg — Project Deltas (cogitarelink-solid)

This Pod's specific profile catalog. Read when working *in this repo* and you need to know which profile IRIs are minted and where their descriptors live.

---

## The 6 wiki-memory L3 class profiles + 4 view profiles

**Class profiles** — hosted at `https://pod.vardeman.me/vault/meta/profiles/`; auto-installed by `overlay:installsProfile` (D113, branch `view-layer`):

| Class IRI | Profile IRI | Token |
|---|---|---|
| `wiki:Page` (base) | `https://pod.vardeman.me/vault/meta/profiles/page` | `wiki-page` |
| `wiki:Concept` | `https://pod.vardeman.me/vault/meta/profiles/concept` | `wiki-concept` |
| `wiki:Source` | `https://pod.vardeman.me/vault/meta/profiles/source` | `wiki-source` |
| `wiki:Person` | `https://pod.vardeman.me/vault/meta/profiles/person` | `wiki-person` |
| `wiki:Procedure` | `https://pod.vardeman.me/vault/meta/profiles/procedure` | `wiki-procedure` |
| `wiki:WorkingNote` | `https://pod.vardeman.me/vault/meta/profiles/working` | `wiki-working` |

**View profiles** — hosted at `https://pod.vardeman.me/vault/meta/views/`; auto-installed by `overlay:installsView` (D113, branch `view-layer`). Selected via `?_profile={token}`:

| View | Profile IRI | Token | Writable |
|---|---|---|---|
| Document (default) | `https://pod.vardeman.me/vault/meta/views/document` | `doc` | yes |
| Fused (body+graph) | `https://pod.vardeman.me/vault/meta/views/fused` | `fused` | no |
| Graph-only Turtle | `https://pod.vardeman.me/vault/meta/views/graph` | `graph` | no |
| Person cross-cutting | `https://pod.vardeman.me/vault/meta/views/people` | `people` | no |

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

**Now auto-installed** (D113, branch `view-layer`). The overlay machinery gained `overlay:installsProfile` + `overlay:installsView` + `overlay:installsViewArtifact` predicates parsed in `scripts/overlay/common.py` and applied in `scripts/overlay/apply.py`. The `Link: rel="profile"` MetadataWriter (`css/extensions/profile-link/ProfileLinkMetadataWriter`) was already built in Phase 5j; the missing piece was `dct:conformsTo` landing in resource `.meta` — now derived on write by the projection pipeline. `?_profile=alt` introspection is live (D113 FOLLOWUPS item closed).

## Custom roles minted

When the 8 standard PROF roles don't fit, this project mints custom roles in the wiki vocabulary namespace:

- `wikirole:affordance` — for affordance descriptors (D52). Used in profile ResourceDescriptors that point at `/vault/meta/affordances/*.ttl`. Standard roles are too generic; `role:constraints` is closest but doesn't capture the machine-actionable, agent-facing semantic.

## Conventions used

- Profile descriptor IRIs use **fragment identifiers** (`#shape`, `#context`, `#vocab`) for the ResourceDescriptors. Each profile is a single Turtle document; fragments distinguish the descriptors within it.
- Every profile carries `prof:hasToken` for QSA conneg. Tokens are mnemonic and prefixed with `wiki-`.
- `dct:publisher` points to the ORCID of the author for attribution.

## What's deferred (post-D113)

- **PROF not yet emitted on wiki content pages.** `rel="profile"` is emitted when `dct:conformsTo` is in `.meta`; wiki `.md` resources don't yet get `dct:conformsTo` derived by the projection pipeline (only the class-profile-bearing containers/resources do). Wire when Probe-C/PROF-on-content is a design target.
- **`WIKI_CLASS_TO_PROFILE` covers only 5 classes.** `Place`/`Event`/`Organization` fall through to the `page` profile; extend if full per-class PROF hints are wanted. Tracked in D113 FOLLOWUPS.
- View layer cold probe re-run (D112 Probe-2 re-run against the trailer channel) — the eval that closes RQ-Substrate-4. Tracked in D113 FOLLOWUPS.

All open items tracked in `FOLLOWUPS.md` under "D113 view layer."

## Related project skills

- `solid-uri-conformance` — the IRI form profile descriptors take
- `solid-wiki-memory-l3` — the class hierarchy these profiles cover
- `solid-storage-description` — where the profile catalog gets advertised (D44)
- `solid-affordance-descriptors` — uses the `wikirole:affordance` custom role
- `metadata-writer` — pattern for the deferred Link-rel-profile MetadataWriter extension
