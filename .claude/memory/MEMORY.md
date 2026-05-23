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

## Project state (as of 2026-05-23)

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

Other tags: `substrate-cleanup-complete`, `phase-b-complete`, `phase-c-complete`.

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
  preferred) → B1 (Ingest + Query-with-file-back, runnable now) → B2 (Lint, gated on a
  Pod-side lint/curator skill not yet built) → D (multi-Pod federation, needs 2nd Pod +
  federation skill).
- Design doc: `docs/plans/2026-05-23-rung-1.5-redesign-design.md`. Pilot report:
  `docs/plans/2026-05-23-phase-a-pilot-report.md` (18 substrate failure modes in §4).

### Next-session candidate — option-B unified build (~3–4h)

SHACL shapes for substrate resources (2 exemplars: StorageDescription + AffordanceDescriptor),
`pod-audit.py` walker, `pod-curator` skill body, sweep the 4 highest-priority failure modes
(stale `rdfs:seeAlso`, missing catalog-entry labels, missing storage-description entry-point
agentInstruction, OSLC parameter-compliance map), then re-run pilot iter-3 with per-condition
assertions. Full breakdown in `FOLLOWUPS.md` "Substrate audit + curator" + pilot report §5.
Architecture rationale: auto-memory `shacl_plus_agent.md` (D104 — substrate is
self-validating wiki-memory L3 content; one unified curator/audit/review toolkit).

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

- **RQ-Discovery-1**: does the cold-Pod first-arrival ritual scale? (Rung 1.5; Phase A
  gave a positive datapoint.)
- **RQ-Hub-1**: is N=3 the right hub threshold? (Rung 1.5)
- **RQ-Atomic-Feedback-1**: atomic in-response feedback (Option B) vs deferred (A+C,
  shipped) for write-triggered signals — needs a Rung 1.5 task class that exercises it.
- **RQ-Listener-1**: `FileDataAccessor.writeMetadataFile()` overwrites `.meta` before the
  MonitoringStore event — Model A preserve-agent-triples needs a pre-write read. Test xfailed.
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
