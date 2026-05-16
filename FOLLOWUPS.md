# Follow-ups

Things to come back to. Open items only; closed items move to commit history and decisions-index.

## Phase 5j (2026-05-16) — URI conformance close-out

### Deferred from D86 implementation

- [x] **PROF descriptor installation via overlay machinery.** Closed by Phase 5j close-out (2026-05-16) — see new section below for follow-ups.
  ~~5 descriptors written at `overlays/wiki-memory/profiles/{page,concept,source,person,procedure,working}.ttl` but the overlay manifest schema doesn't yet have `installsProfile` (parallel to `installsShape`, `installsAffordance`). To install:~~
  ~~1. Add `overlay:installsProfile` predicate to `css/config/pod-templates/base/ontology/overlay.ttl`~~
  ~~2. Parse it in `scripts/overlay/common.py` (mirror `shape_urls`/`affordance_urls`)~~
  ~~3. Add upload loop in `scripts/overlay/apply.py` step 3.5 (after affordances)~~
  ~~4. Update `overlays/wiki-memory/manifest.ttl` with the 5 profile URLs~~
  ~~\~15 LOC change. Files are committed; just unwired.~~

- [x] **`Link: rel="profile"` MetadataWriter CSS extension** (D86). Closed by Phase 5j close-out (2026-05-16) — see new section below for follow-ups.
  ~~Mirrors the `MementoLinkMetadataWriter` pattern at `css/extensions/memento/src/MementoLinkMetadataWriter.ts` (~30 LOC). Need:~~
  ~~1. New extension at `css/extensions/profile-link/` with package.json (lsd:* fields, `@cogitarelink/profile-link`), tsconfig.json, src/, dist/~~
  ~~2. `ProfileLinkMetadataWriter.ts`: path-based dispatch (`/vault/wiki/pages/*` → `wiki:PageProfile`, etc.) — use `addHeader` so Link composes with existing MementoLink + describedby headers~~
  ~~3. Components.js config that inserts the writer into the MetadataWriter ParallelHandler after `MetadataWriter_LinkRel`~~
  ~~4. Add `@cogitarelink/profile-link` to solid-config.json @context array and imports~~
  ~~5. Update Dockerfile with the symlink trick (per `css-extension` skill)~~
  ~~6. Tests: assert Link header presence on every resource GET~~
  ~~Design fully specified in `.claude/skills/solid-uri-conformance/SKILL.md` + `templates.md` Template E.~~

- [ ] **`_profile=alt` introspection view.**
  Reserved spec token (NOT `alternates` — see PROF research finding). Lists all profile × media-type combos for a resource. Part of the ProfileLinkMetadataWriter extension or a separate handler. Defer until Pod-bound agent eval shows a use case.

- [ ] **CSS storage description PATCH gate.**
  Surfaced during overlay apply: CSS returns `405 MethodNotAllowedHttpError "Only GET requests can target the storage description."` Overlay's storage-patch.ttl couldn't be applied at runtime — the wiki:* L3 pointers in `.well-known/solid` come exclusively from `css/config/void-description.json` (static StaticStorageDescriber). Decision: either (a) keep all storage description triples in static config (current state, works); (b) override CSS to allow PATCH on storage description; (c) move L3 pointers entirely into overlay-patched `/vault/.meta`. Currently working as-is; revisit if RQ-Substrate-3 successor surfaces.

### Closed by Phase 5j

- [x] **RQ-Substrate-3** — namespace mismatch resolved by D84 commitments (https, port-less, hash-namespace, extension-less). All 55+ source files migrated; volume wiped; Pod regenerated with new IRIs. Verified end-to-end.
- [x] **PROF descriptor installation via overlay machinery** — done via `overlay:installsProfile` + `overlay:installsRoleScheme` predicates in manifest + apply.py upload step. Wikirole SKOS scheme at `/vault/ontology/wikirole`.
- [x] **`Link: rel="profile"` MetadataWriter CSS extension** — done via `css/extensions/profile-link/` + Components.js wiring consolidated into memento.json. Emits one `Link: rel="profile"` per `dct:conformsTo` value in `.meta`. 32 integration tests green.

## Phase 5j close-out (2026-05-16) — Deferred follow-ups

### Architectural — schedule per Rung 1.5 evidence

- [ ] **Framing-2 refactor: drop wiki:*Affordance classes for pure PROF typing.**
  Affordances currently carry BOTH `a wiki:WriteAffordance` AND
  `a prof:ResourceDescriptor; prof:hasRole wikirole:*` (Framing 1.5
  additive, shipped in Phase 5j close-out). Pure-PROF refactor would
  retire the `wiki:*Affordance` classes from `wiki.ttl`, update any
  SHACL shapes or queries that target those classes, and possibly
  enrich the wikirole vocabulary further if eval shows agents reading
  those roles. Decision criterion: Rung 1.5 evidence of whether agents
  branch on `prof:hasRole` vs `rdf:type wiki:*Affordance`.

### Code findings to clean up

- [ ] **css/config/profile-link.json may be deletable.** Task 16 consolidated
  the profile-link Override into memento.json (Components.js forbids
  multiple Override declarations against the same component instance).
  If profile-link.json no longer carries any non-redundant config, delete
  it and remove the import from solid-config.json. Verify CSS still starts
  cleanly after deletion.

- [ ] **Apply.py body-triple vs .meta divergence.** Plan Tasks 6/7 added
  `dct:conformsTo` to RDF resource bodies for self-documentation, but
  CSS only reads `.meta` sidecar triples into `RepresentationMetadata`.
  Apply.py compensates by PATCHing `.meta` on every apply (Task 17 fix,
  idempotent). Long-term cleaner: either (a) drop the body declarations
  since they're redundant for header emission, or (b) build a
  MetadataReader that surfaces body `dct:conformsTo` into
  `RepresentationMetadata` for RDF resources. Defer decision until more
  body-vs-.meta patterns accumulate.

- [ ] **DCT vocabulary helper for the codebase.** CSS's `DC` export is a
  3-term subset (description/modified/title) and does not include
  conformsTo, references, hasPart, etc. `ProfileLinkMetadataWriter`
  inlined the named-node URI directly. If more DCT-using extensions are
  added, consider publishing a shared `vocab/dct.ts` helper or a
  project-wide constant module.

### Confirmation of close-out

- [x] **PROF descriptor installation via overlay machinery** — done via
  `overlay:installsProfile` + apply.py upload step.
- [x] **`Link: rel="profile"` MetadataWriter CSS extension** — done via
  `css/extensions/profile-link/` + Components.js wiring in memento.json.

## Rung 1.4 close (2026-05-15)

### Critical — deferred to Rung 1.5 eval

- [ ] **RQ-Listener-1: Model A preservation across CSS .meta overwrite**.
  `test_agent_enrichment_survives_body_rewrite` xfailed with diagnosis. Mitigation paths:
  - Paths (A) Memento-history read, (B) `.meta.agent` sidecar, (C) PassthroughStore wrap analyzed in `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md`.
  - Path (D) RDF-star triple-level provenance + reification shim explored in `docs/plans/2026-05-15-rdf-star-provenance-exploration.md` — **candidate, not committed**. Avoids the `.meta.agent` sidecar entirely by partitioning substrate vs agent triples via `prov:wasGeneratedBy` annotations on quoted triples. Tooling probe: N3.js ready, CSS conneg ready with overrides, rdflib lacks RDF-star (hard blocker for Python clients) — ~50 LOC reification shim closes that gap by serving classical `rdf:Statement` reification to non-star clients. Decision criteria documented; promotes to D82 only when Rung 1.5 eval evidence justifies.
  Decision criterion (general): if Rung 1.5 eval surfaces real agent-extension use cases (agents PATCHing `.meta` outside the governed set), pick between paths (B) and (D) based on whether per-triple provenance is load-bearing for RLM behavior. If eval shows agents never extend, reframe the xfail as documentation.

### Small — fix when needed

- [x] ~~**WIKI_NS central constant**.~~ **Closed by Phase 5j (D84)**: all `urn:example:wiki#` and port-baked refs migrated to `https://pod.vardeman.me/vault/ontology/wiki#`. If the Pod hostname ever changes, the substitution remains sed-replaceable — but the IRI is now Pod-namespace-authority style, not placeholder. The "central constant" idea no longer applies (predicate IRIs reflect deployment intent, not a future TBD mint).

- [ ] **`foaf:affiliation` frontmatter mapping**.
  PersonShape allows `foaf:affiliation`, `governedPredicates` includes it, but `frontmatterProjection.ts` has no `affiliation:` key. Agents can't set affiliation via body+frontmatter today. Two-line fix when an eval task needs affiliation traversal.

### Documented elsewhere (cross-references)

- **RQ-Pod-4** — Comunica `.meta` traversal gap, workaround documented at `docs/plans/2026-05-15-rq-pod-4-workaround-notes.md`. Decision point: Rung 1.5+ if explicit-source pattern becomes a bottleneck.
- **K2 (triple-hyphen slugs)** — `slug()` doesn't collapse consecutive hyphens. Accepted for v1 in `decisions-index.md`; refinement is post-spike.
- **K3 (`.author` → `dct:contributor`)** — class-hint dispatch can't differentiate concept-contributor from source-creator. Distinct `.creator` class hint is a Rung 1.5+ option.
- **Task 42 (context-driven listener dispatch)** — `wikilinkProjection.ts` uses hardcoded class-hint table instead of reading `/meta/context.jsonld` at runtime. Functionally equivalent; deferred to Rung 1.5 cleanup per D79.

## Pre-existing (earlier rungs)

- **RQ-Harness-1** — fabric namespace minting at `https://cogitarelink.org/ns/fabric#` — blocks all `fabric:*` predicates past prototype.
- **RQ-Eval-1/2/3** — task suite design, sub-agent config, GEPA convergence (Rung 1.5 work).
- **RQ-Memento-1/2**, **RQ-Federation-1** — see `decisions-index.md`.
