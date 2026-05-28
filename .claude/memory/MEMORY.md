# cogitarelink-solid — Session Memory

Compact **operational state** for cross-session continuity. This file is `@`-imported
into context every session, so it stays small. Anything historical lives in its
authoritative home:

- **Sprint recaps + narrative** → git tags + git history (tags listed under "Shipped")
- **Decision text + substrate-behavior findings** → invoke the `decision-lookup` skill
  (`.claude/skills/decision-lookup/decisions.md`, D1–D104 / K1–K4 / RQ-*)
- **Caveats + cleanup queue** → `FOLLOWUPS.md`
- **Canonical decisions log** → vault `01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`

Repo decision IDs differ from vault IDs; both numberings are reconciled in `decisions.md`.

## Project state (as of 2026-05-24)

- **Branch**: main, clean. Direction (2026-05-15 pivot, D70–D74): wiki-memory L3 is the
  canonical reference profile; vault import is one application, not the MVP.
- **Live Pod**: dev-allow-all auth (see auto-memory `behavior_before_security.md`). TLS
  via mkcert. `make reset` = reproducible fresh-volume rebuild (use this to verify, never
  `make up` alone — see `docker-patterns.md`).
- Single-container stack: CSS only. SPARQL is a client concern (Comunica in
  `solid-agent-skills`, D3/D29). Python is client-only.

### Shipped (recaps in git tags + decisions.md)

| Sprint | Tag | Decisions |
|---|---|---|
| Phases 1/2/2b + Rung 1.1–1.4 (Memento + tombstones) | — | D61–D68, K1 |
| Phase 5j (URI conformance + TLS + PROF hints) | — | D84–D86 |
| AddressBook substrate | — | D87–D88 |
| owner-identity overlay + setup-owner skills | — | D89–D90 |
| Phase 7a wiki-search (OSLC Query 3.0) | — | D91/D92 |
| Memory Structuring Sprint | `memory-structuring-sprint-complete` | D93/D94, K4 |
| Wiki-Memory L3 Shape Completion (8-shape catalog) | `wiki-l3-shape-completion-complete` | D95–D100 |
| MemTrigger detector wiring | `mem-trigger-detector-wiring-complete` | D101 |
| Rung 1.5 redesign (design only) | — | D102 |
| Phase A pilot + skills-bootstrap + self-validating substrate | `phase-a-complete` | D103, D104 |
| Extensible conceptual structure + D98 migration complete (2026-05-23) | — | D104+ (auto-mem `conceptual_structure_as_extensible_data`) |
| Option-B substrate audit + curator (pod-audit walker + pod-curator skill, 2026-05-24) | — | D104 / vault-D99 |
| RQ-Substrate-4 URI re-layering Phases 1–4 (sub: namespace, reframe, storage-root, PROF; 2026-05-28, branch `rq-listener-1-provenance`, NOT merged; cold-probe eval RQ-View-2 + view layer still open) | — | **D107** |

Other tags: `substrate-cleanup-complete`, `phase-b-complete`, `phase-c-complete`.

**Shipped 2026-05-23 (merged to main, commit `5ce2b27`):** subclass-aware path-constraint
validation (fixes `.operations/`/`.events/` 422; the validator expands `rdf:type` by the
vocab's `rdfs:subClassOf` closure — `ShapeValidationStore` + `subClassClosure.ts`);
`wiki:ClassExtensionShape` meta-shape (agent class-extension contract, generalizes D100 to
classes); D98 source→concept migration **completed** across overlay + test suite (overlay was
half-migrated; `make reset` now reproduces the deployed Pod); `wiki:Source` re-introduced
*via the contract* (not baked-in); `mem:StalenessDetected`/`mem:RealignAction`/`mem:rationale`
+ `mem:StalenessClass` scheme in `mem.ttl`; realignment trace exemplar deployed to
`.operations/`. See auto-mem `conceptual_structure_as_extensible_data` + `stale_memory_realignment`.

**Shipped 2026-05-24 (option-B substrate audit + curator, D104 / vault-D99):** `scripts/pod_audit.py`
walker (PEP 723 self-contained; GET storage-description → SHACL-validate `inference="none"` →
HEAD-check catalog pointers + `rdfs:seeAlso` + `prof:hasResource` → walk affordance catalog →
validate each + `prof:hasRole` scheme-membership) + `StorageDescriptionShape`/`AffordanceDescriptorShape`/
`SearchAffordanceShape` (`shapes/substrate/`) + `make audit`. `pod-curator` skill shipped as a Pattern B
`context:fork` subagent-skill in `solid-agent-skills` (bundles `pod_audit.py` via `make sync-curator-skill`;
proposes `mem:RealignAction`, never patches). Substrate sweep brought the live audit to **0 ERROR / 1 WARN**
(lone WARN = StaticStorageDescriber can't emit the entry-point `sh:agentInstruction` literal); WoT-TD
alignment (`wiki:Affordance ⊑ td:InteractionAffordance`). Concrete-bug sweep closed (`4b434b9`,
`273b29a`): `pod_audit.py` cross-checks + `solid-pod invoke` port fix (D84). See auto-mems
`shacl_plus_agent` + `claude_code_skill_subagent_mechanics`.

## Active focus — Rung 1.5 (redesigned 2026-05-23, D102 / vault-D97)

Reframed as an **engineering feedback loop**, not a claim-proof experiment. Artifact is a
Pod design that demonstrably works. Original B1/B2/T framing dropped.

- **Stipulated** (not under test): Pod-as-substrate (filesystem dropped); wiki-memory L3
  as canonical profile; skills + structured memory both required.
- **Under test, by L-layer**: L1 — do agents use Solid features (storage description, Link
  headers, OIDC, Memento, LDN)? L2 — are the seven invariants observable in behavior?
  L3 — which affordances earn their keep; do Karpathy's three ops (Ingest w/ fan-out,
  Query-with-file-back, Lint) work; does the wiki *compound*? Multi-Pod — does
  L2-shared / L3-differing federation work?
- **Three measurement axes**: trajectory (self-logged) + outcome (skill-creator grader) +
  round-trip consistency (paired create+retrieve verifies compounding). A task that passes
  outputs but fails round-trip retrieval is the diagnostic-most finding.
- **Phase sequence**: A pilot ✅ → A full (wiki-search retrieval) → C (scale, vault import
  preferred) → B1 (Ingest + Query-with-file-back, runnable now) → B2 (Lint — now unblocked;
  pod-curator skill shipped 2026-05-24) → D (multi-Pod federation, needs 2nd Pod +
  federation skill).
- Design doc: `docs/plans/2026-05-23-rung-1.5-redesign-design.md`. Pilot report:
  `docs/plans/2026-05-23-phase-a-pilot-report.md` (18 substrate failure modes in §4).

### Next-session candidates (option-B shipped 2026-05-24)

Option-B is done (pod-audit walker + pod-curator skill + substrate sweep + concrete-bug sweep).
Open threads, roughly in priority order:

1. **Get the suite green.** (a) RQ-Listener-1 — ✅ **RESOLVED by collapse** on branch
   `rq-listener-1-provenance` (not yet merged). A first pass built a "derive-from-log" edge; a
   cold-discovery probe then showed it was **over-design** (a fresh agent did the whole task via the
   `.operations/` log; the edge never fired — the affordances prescribe announce-LAST). So the derived
   edge was removed. **Design**: operation provenance is canonical in `/vault/wiki/.operations/`
   (`<>`-subject `as:Announce, mem:*Action` + `as:object <target>`); the resource `.meta` doesn't carry
   it; history via the `memory-history` affordance. Kept the PROV category-error fix (no affordance stamp
   on the resource) + `mem.ttl` `as:object`. Also fixed: `schema:name` now derived on `<#this>` (concepts
   were failing ThingShape). Live: audit 0 ERROR, 6/6 e2e pass. Lesson captured: eval-as-engineering-
   feedback caught the over-build before merge (see `eval_as_engineering_feedback`). (b) 5 pre-existing
   `test_phase5j_close` count-drift failures — STILL OPEN, pure test-expectation realignment. FOLLOWUPS.
2. **pod-curator trigger-eval re-run.** Now *valid* via the corrected mechanism (install under
   `.claude/skills/`, `claude -p`, detect `Skill` tool_use + the subagent trajectory) — the old run
   measured `.claude/commands/` (never auto-triggered). `skills/pod-curator/evals/trigger-eval.json` staged.
3. **Phase A pilot iter-3** with per-condition assertions (Component 5 in FOLLOWUPS); compare against iter-1/2.
4. **Remaining substrate shapes** (capability descriptors, per-catalog-entry label/comment, vocab
   declarations, JSON-LD context, Type Index) + wire `make audit` into `make reset`/CI once iter-3 clears.
5. The lone audit WARN — entry-point `sh:agentInstruction` needs a tiny custom StorageDescriber
   (StaticStorageDescriber emits only IRIs, not literals).

Rung 1.5 phase sequence (above) resumes once the suite is green: A full → C (scale) → B1 → B2 → D.

## Key architecture patterns (quick-ref; full text via decision-lookup)

- **L1/L2/L3 stratification** (D70): L1 Pod substrate / L2 memory substrate (seven
  invariants) / L3 memory profile (wiki-memory canonical).
- **Dual-layer linking** (D58/D71): body wikilinks (token layer) + RDF in `.meta` (data
  layer); `MarkdownProjectionListener` projects body → `.meta` on write.
- **Thing-as-top-class** (D95) + **Page+Thing governance split** (D96): `PageShape` governs
  `<>`, Thing-shapes govern `<#this>`; two N3 Patch envelopes per write.
- **Predicate-level governance** (D81 Model A): SHACL declares which predicates the
  substrate governs; agent owns the rest.
- **Two-stage commit** (D73): `working/` permissive shape → `mem:Crystallize` to durable.
- **Three-tier access** (D55): brute-force (spec) → harness (descriptors) → skills. Lower
  tiers always functional.
- **Pod-as-toolkit** (D83): capability catalog at `/vault/meta/capabilities/`; apps are
  overlays declaring `cap:requires`. Capabilities-only deps (D87).
- **Skills bootstrap** (D103): skills under `solid-agent-skills/skills/` are minimal
  bootstrappers pointing at the on-Pod affordance descriptor (`sh:agentInstruction` =
  source of truth); they don't duplicate substrate content.
- **L4 extension contract** (D100): substrate is URI-independent — Type Index registration
  triggers full substrate treatment at any container path.
- **Two-hierarchy + Type-Index addressing** (D105/D106, 2026-05-26): `rdfs:subClassOf` =
  addressing/structure axis (Type Index → container/shape/governed predicates); `skos:broader`
  = content/navigation axis; **never substituted**. Bridge = the subclass axiom + Type Index;
  vault→kit transition is lossy (topic link drops the class → look it up). Wikilink `.role` →
  *predicate* only (D36); *container* → target's class via Type Index, NOT the role (retires the
  role→container map; D76(c) superseded). Extension types: `rdfs:subClassOf skos:Concept` (ESCO
  Pattern C) so an instance is both topic + typed individual; cross-scheme = `skos:exactMatch`
  (never `owl:equivalentClass`); no OWL punning. Grounded in W3C *Using OWL and SKOS* + ESCO
  (full prior-art list in decisions.md D105/D106). Cold-probe-surfaced.

## Standards-stack + TLS caveats

- PROF is a WG Note (not Rec); Conneg-by-Profile is a WD; RFC 6906 (`Link: rel="profile"`)
  is the only IETF-published piece. **Never emit `Content-Profile`** (expired draft). Emit
  `prof:isTransitiveProfileOf` explicitly (dct:conformsTo chain is "at risk").
- Storage description PATCH returns 405 — fully static via Components.js
  `void-description.json`; no runtime PATCH.
- **TLS (D85)**: Node (Comunica, Bashlib, inrupt-authn) doesn't read macOS Keychain. Set
  `NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem`; Python httpx needs `SSL_CERT_FILE`.
  Never use `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Open research questions (active)

- **RQ-Substrate-4** — URI/namespace slice SHIPPED as **D107** (2026-05-28, Phases 1–4 deployed,
  audit 0 ERROR, branch `rq-listener-1-provenance`, NOT merged); **RQ itself still OPEN** (two
  pieces remain). Origin: substrate built *forward from the Obsidian vault* instead of *backward
  from LDP + dual document/graph views* (Verborgh); two cold probes (2026-05-26/27) misread the
  `wiki` URL segment as a MediaWiki *application*. **D107 shipped** (`docs/superpowers/specs/2026-05-28-rq-substrate-4-uri-relayering-decision.md`
  + plan `…/plans/2026-05-28-rq-substrate-4-uri-relayering.md`): three-bucket namespace partition
  — Bucket 1 aggressive standard-predicate reuse (`wiki:typeIndex`→`solid:publicTypeIndex`, a D48
  dual-mechanism cleanup); Bucket 2 mint `sub:` = `https://pod.vardeman.me/vault/ontology/substrate#`
  (35 general terms: catalogs/routing/governance/affordance vocab); Bucket 3 `wiki:` keeps only L3
  content + `/wiki/` reframed as "the wiki-memory **document view**" in *served* self-description
  (agentGuide + synthesis + PROF descriptors); `/vault` kept but storage-root **parameterized** (no
  source hardcode); PROF promoted to actionable out-of-band hint (`rel="profile"` + per-descriptor
  `sh:agentInstruction`). Grounded in Solid vocab-by-concern + Verborgh (our contamination *is* his
  contacts conundrum); aggressive standard-reuse is the data-level interoperability he argues for.
  Round-trip-across-views test green. **STILL OPEN — do NOT mark RQ closed:** (1) **cold-probe eval
  RQ-View-2** (Probes A/B/C — does the reframe kill the `wiki`→MediaWiki misread? behavioral
  validation vs the 2026-05-26/27 baseline; design in D107 §5 + decisions.md RQ-View-2) — teed up,
  not yet run; (2) the deep contacts-conundrum fix (one entity, multiple writable views) = the
  **deferred VIEW LAYER** (D107 §6 / spec §4.3: view processor + conneg-by-profile `?_profile=`).
  Pre-existing debt surfaced during the migration (NOT migration-caused): 2 stale live-tests +
  broken-but-unused `build:esm` → FOLLOWUPS "Pre-existing test/build debt". Lineage: continues
  RQ-Substrate-3 (closed by D84); D107 is the deeper contamination D84 didn't touch.
- **RQ-Discovery-1**: does the cold-Pod first-arrival ritual scale? (Rung 1.5; Phase A
  gave a positive datapoint.)
- **RQ-Hub-1**: is N=3 the right hub threshold? (Rung 1.5)
- **RQ-Atomic-Feedback-1**: atomic in-response feedback (Option B) vs deferred (A+C,
  shipped) for write-triggered signals — needs a Rung 1.5 task class that exercises it.
- **RQ-Listener-1**: RESOLVED for mem-operation provenance by COLLAPSE (branch
  `rq-listener-1-provenance`, not yet merged). Provenance is canonical in the `.operations/` log
  (`as:object` link) + the `memory-history` affordance; the resource `.meta` does not carry the
  operation. A cold-probe showed a derived in-resource edge was over-design (unused + DOA under the
  affordances' announce-last order), so it was removed; the PROV category-error fix was kept. The
  *broad* agent-extension case (arbitrary non-governed triples surviving rewrites) stays deferred →
  `.meta.agent` sidecar / D82. See `docs/superpowers/specs/2026-05-25-mem-operation-provenance-derivation-design.md`
  (amended with the collapse note).
- **RQ-Pod-4**: Comunica skips `text/markdown` `describedby` traversal — use explicit
  `default-graph-uri`.
- **RQ-Pod-6**: `.meta` richness vs query overhead — needs 100+ resource benchmarks.
- **RQ-UI-1**: Pod-hosted substrate-aware memory-structure UI (post-Rung-1.5).
- **RQ-Harness-1**: fabric namespace minting blocks `fabric:*` past prototype.
- H-D82 (inline JSON-LD as level-4 affordance) is a hypothesis — test in Rung 1.5 before code.

### Research-track (unscoped)

- **VC credential extension**: CSS v8 has policy-engine VC matchers but no
  `VerifiableCredentialExtractor`. Three routes in `docs/plans/2026-05-18-vc-credential-roadmap.md`.
  Triggers on Rung 1.5 evidence or a concrete VC-gated use case.

## Sibling repos (under `~/dev/git/LA3D/agents/`)

| Repo | Role |
|---|---|
| `cogitarelink-solid` | Reference Pod: CSS + extensions + vault importer (this repo) |
| `solid-agent-skills` | General-purpose Solid Pod CLI + skills (D29). Phase 2 complete |
| `cogitarelink-fabric` | Graph-native fabric nodes (Oxigraph + FastAPI + Credo) — eval harness pattern |
| `rlm` | RLM agent substrate (dspy.RLM) |

## Vault sources of truth

- Active plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Unified Externalization Prototype Plan.md`
- Decisions log: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`
- Phase plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md`
- Canonical L2 source: `Memory Substrate vs Memory Profile.md`; Karpathy framing:
  `Karpathy - Agentic Wiki Design Document.md`
