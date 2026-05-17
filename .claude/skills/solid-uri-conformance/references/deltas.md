# URI Conformance — Project Deltas (cogitarelink-solid)

This Pod's specific commitments under [`spec.md`](spec.md). Read this when you're working *in this repo* and need to know what vocabularies live where. The general guidance in `spec.md` is portable; this file is not.

---

## App-local vocabularies hosted on this Pod

| Namespace | IRI | File path |
|---|---|---|
| wiki-memory L3 application | `https://pod.vardeman.me/vault/ontology/wiki#` | `/vault/ontology/wiki` |
| Capability catalog (D83) | `https://pod.vardeman.me/vault/ontology/capability#` | `/vault/ontology/capability` |
| Overlay machinery | `https://pod.vardeman.me/vault/ontology/overlay#` | `/vault/ontology/overlay` |

All HTTPS, port-less, hash-namespace, extension-less. PUT each with `Content-Type: text/turtle`. CSS auto-handles RDF conneg (Turtle ↔ JSON-LD ↔ N-Triples).

## Cross-Pod shared profiles at w3id.org

Not hosted on this Pod. These are minted at `w3id.org/cogitarelink/` because they're referenced across multiple Pods in the fabric:

- `https://w3id.org/cogitarelink/fabric#CoreProfile`
- `https://w3id.org/cogitarelink/fabric#SolidPodProfile`

**Rule for new vocabularies in this project**: per-app vocab → Pod-hosted; cross-Pod profile → w3id.org. Don't mint w3id redirects for vocabularies that only this Pod will ever use.

## Naming choices specific to this project

- **Slug algorithm** (D76 S3a): drop leading `@` from BibTeX citekeys (`@author2024` → `author2024`) to avoid JSON-LD keyword collision.
- **Mnemonic over opaque** for everything: vault notes have stable human-readable titles; rename risk is low.
- **Person and Organization entities in /vault/contacts/** use opaque UUIDv4
  slugs, not mnemonic. Documented exception to "mnemonic over opaque for
  everything" — name collision risk (CJK, common Western names,
  marriage/transition renames) substantively exceeds vault notes. Display
  name and external anchors (ORCID, ROR, email, WebID) live in card data via
  vcard:fn and owl:sameAs, not in URI slugs. Wiki pages about people
  (/vault/wiki/people/) retain mnemonic slugs for wikilink affordance,
  bridged to opaque cards via foaf:primaryTopic. See
  `docs/plans/2026-05-16-agentic-addressbook-design.md` §3.1.
- **Group entities in /vault/contacts/Group/** use mnemonic kebab-case slugs.
  Author-controlled, low volume, low collision risk.
- **Person card filename is flat**, not container-as-resource: `/vault/contacts/Person/<uuid>.ttl#this`
  rather than `/vault/contacts/Person/<uuid>/index.ttl#this`. Implementation
  deviation from the design discovered in Batch 11/12 of the substrate plan:
  shape-validator rejects sub-container creation within constrained
  containers, so the per-Person container approach (intended for attachment
  co-location) is blocked. Attachment use-cases need a separate design pass.

## Empirical CSS conformance test result

CSS v8.0.0-alpha.3 was tested against this Pod (2026-05-16):

| Operation | Result |
|---|---|
| `PUT /vault/_test` with `Content-Type: text/turtle`, no extension in URL | 201 Created |
| `GET` + `Accept: text/turtle` | 200 OK, Turtle returned verbatim |
| `GET` + `Accept: application/ld+json` | 200 OK, auto-converted JSON-LD |
| `GET` + `Accept: application/n-triples` | 200 OK, auto-converted N-Triples |

Rule 2 ("URL path *is* the namespace prefix") is confirmed working on this deployment. Re-run the test before changing CSS versions.

## Migration history

Phase 5j (commits `c963cf2..4abde5e`, 2026-05-16) migrated this Pod from `urn:example:wiki#` + `http://pod.vardeman.me:3000/vault/ontology/...#` to the table above. 55+ source files changed, 158 string substitutions, one `css-data` volume wipe + regenerate. Full record in git log and `decisions-index.md` D84/Phase 5j. Don't repeat the migration; do refer back if a new place is accidentally introduced.

## Open questions

- **CSS storage description PATCH gate**: CSS returns `405 MethodNotAllowedHttpError` on PATCH to `.well-known/solid`. Current workaround: keep all storage description triples in static `css/config/void-description.json`. Revisit if overlay needs runtime augmentation of the storage description.
- **w3id.org mint for `fabric:WikiMemoryProfile`**: deferred until the L3 profile stabilizes enough to be referenced from other Pods. Currently nominally lives under `wiki:` on this Pod.

## Related project skills

- `solid-tls-deployment` — TLS setup on this Pod (mkcert dev, Caddy+LE prod)
- `solid-profiles-and-conneg` — PROF descriptors and resource-kind hints
- `solid-wiki-memory-l3` — the wiki vocabulary's class hierarchy and shape catalog
- `solid-storage-description` — how the storage description advertises the vocabularies above
