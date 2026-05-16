# cogitarelink-solid — Session Memory

Compact state for cross-session continuity. Historical narrative + completed-work
recaps live in git history and the vault decisions log
(`~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`).
For decision IDs, invoke the `decision-lookup` skill.

## Project state (as of 2026-05-16)

- **Branch**: main
- **Shipped**: Phase 1 + 2 + 2b + Rung 1.4 + Phase 5j (URI conformance + TLS + PROF
  close-out). Read-only Memento, tombstone semantics, wiki-memory L3 reference
  profile (D78–D81), Pod-as-toolkit capability catalog (D83), PROF profile
  descriptors + ProfileLinkMetadataWriter + wikirole scheme (D84–D86). 32 Phase 5j
  integration tests green.
- **Direction pivot (2026-05-15)**: project reframed from "vault-to-Pod as MVP" to
  **wiki-memory L3 as canonical reference profile, vault as one application**
  (D70–D74).

## Phase 5j — Closed (2026-05-16)

All 9 tasks of the URI conformance + TLS + PROF round shipped, plus close-out:

- **D84/D85/D86 ratified** — URI conformance, TLS deployment, PROF-based
  resource-kind hints
- **Namespace migration** to https Pod-hosted IRIs (commit 4cb3a40)
- **TLS turn-up** mkcert + CSS native HTTPS (c172ff5)
- **PROF profile descriptors** (4abde5e) — 6 wiki-memory L3 profiles
- **Wikirole SKOS scheme** at `/vault/ontology/wikirole` — 5 `prof:ResourceRole`
  concepts as layer-2 substrate vocabulary
- **ProfileLinkMetadataWriter** at `css/extensions/profile-link/` — emits
  `Link: rel=profile` per `dct:conformsTo` in `.meta`; wired via memento.json
- **Overlay machinery** extended (`installsProfile` + `installsRoleScheme`;
  apply.py patches `.meta` for shapes/affordances/profiles — idempotent)
- **Storage description** advertises wikirole + 6 profiles at `/vault/.well-known/solid`
- **Framing-1.5 affordance enrichment** — additive PROF typing, `wiki:*Affordance`
  preserved (Framing-2 pure-PROF refactor deferred to post-Rung-1.5)
- **Substrate-level `dct:conformsTo`** on shapes, vocab, profiles, affordances,
  JSON-LD context, wikirole

Key implementation findings (see FOLLOWUPS.md for full cleanup list):
- Body triples on RDF resources don't reach `RepresentationMetadata` — only `.meta`
  triples do. Apply.py now patches `.meta` for substrate-governed resources.
- Components.js forbids multiple `Override` declarations against the same component
  instance; profile-link wiring consolidated into memento.json overrideSteps.
- CSS `DC` export is a 3-term subset; construct `dct:conformsTo` via
  `DataFactory.namedNode(...)` directly.
- CSS `.well-known/solid` served per `pim:Storage` container, not server root.

Open Phase 5j follow-ups deferred to post-Rung-1.5 decision points.
See FOLLOWUPS.md "Phase 5j close-out (2026-05-16)" section.

## Active focus — Rung 1.5 (next round)

First measurable evaluation. Conditions: B1 filesystem baseline / B2 brute-force
Pod / T Pod-harness. Task classes: typed-edge navigation, citation traversal,
temporal navigation. Reuses cogitarelink-fabric eval harness + OpenProse
navigator+judge pattern. See Active Plan (vault) for the full Rung 1.5
design (when written).

## Standards-stack caveats (Phase 5j)

- W3C PROF is a WG Note, not a Rec (§7/§8/§11 normative).
- W3C Conneg-by-Profile is a WD.
- RFC 6906 (`Link: rel="profile"`) is the only IETF-published piece (Informational, March 2013); the link relation is IANA-registered.
- `draft-svensson-profiled-representations-01` expired 10 Sept 2021; never adopted as a WG document — **never emit `Content-Profile`**.
- PROF `dct:conformsTo` property chain is "at risk" (Issue 1078) — emit
  `prof:isTransitiveProfileOf` explicitly.
- PROF role registry "at risk" (Issue 1073) but extensible (`wikirole:affordance` for D52).

## TLS client gotcha (D85)

Node.js (Comunica, Bashlib, inrupt-client-authn-node) doesn't read macOS Keychain.
Set `NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem` in shell AND in any sibling
container. Python httpx needs `SSL_CERT_FILE` likewise.

## Active plan — Unified Externalization Prototype

| Round | Claim | Status |
|---|---|---|
| **R1 Wiki-Memory L3 + Memento + Affordance Descriptor** | Pod-published affordance descriptors over wiki-memory L3 reduce harness cost vs spec-only navigation; RFC 7089 time-travel as substrate capability | Rungs 1.0–1.4 ✅; Rung 1.5 (first measurable eval) next |
| R2 Bridge edges with structural pointers | `cito:hasPageRange`/`cito:hasSection` enable demand-driven document granularity | Blocked on R1 |
| R3 Typed edges as ground truth | SPARQL over frontmatter edges beats flat semantic retrieval | Minimal new build |
| R4 Multi-pod federation | Cross-pod federated queries correct + tractable latency | Blocked on R1–3 |

## Sibling projects (under `~/dev/git/LA3D/agents/`)

| Repo | Role |
|---|---|
| `cogitarelink-solid` | Reference Pod: CSS + extensions + vault importer (this repo) |
| `solid-agent-skills` | General-purpose Solid Pod CLI + Claude Code skills (D29). Phase 2 complete |
| `cogitarelink-fabric` | Graph-native fabric nodes (Oxigraph + FastAPI + Credo) — eval harness pattern |
| `rlm` | RLM agent substrate (dspy.RLM) |

## Key architecture patterns (refer back when designing)

- **L1/L2/L3 stratification (D70)**: L1 = Pod substrate; L2 = memory substrate
  (seven invariants); L3 = memory profile (wiki-memory canonical).
- **Dual-layer linking (D58/D71)**: body wikilinks at token layer + RDF in `.meta`
  at data layer. `MarkdownProjectionListener` projects body → `.meta` on write.
- **Two-stage commit (D73)**: `working-memory/` permissive shape → `mem:Crystallize`
  promotes to durable container.
- **Memory-substrate triggers (D74)**: `mem:*` AS2 vocab on LDN inbox + Solid
  Notifications. Agent dispatches by `rdf:type`.
- **Three-tier access (D55)**: brute-force (spec) → harness (descriptors) →
  skills (`solid-agent-skills`). Lower tiers always functional.
- **Compile-once (D72)**: substrate maintains compiled state; agents don't
  re-derive at query time.
- **Predicate-level governance (D81 Model A)**: SHACL shape declares which
  predicates the substrate governs; agent owns the rest.
- **Pod-as-toolkit (D83)**: capability catalog at `/vault/meta/capabilities/`;
  applications are overlays declaring `cap:requires` against the catalog.

## Open research questions (active)

- **RQ-Listener-1**: CSS `FileDataAccessor.writeMetadataFile()` overwrites `.meta`
  before MonitoringStore event fires — Model A's preserve-agent-triples behavior
  needs pre-write read. Mitigation paths: pre-write Memento/git read; `.meta.agent`
  sidecar CSS never touches; PassthroughStore interception. Integration test xfailed.
- **RQ-Pod-4**: Comunica skips `text/markdown` `describedby` traversal. Workaround:
  explicit `default-graph-uri` parameters. Materialized SPARQL index deferred.
- **RQ-Pod-6**: `.meta` richness vs query overhead — needs 100+ resource benchmarks.
- **RQ-Hub-1**: Is N=3 the right hub threshold? Eval question for Rung 1.5.
- **RQ-Discovery-1**: Does the 7-step first-arrival ritual scale to agents arriving
  on cold Pods? Eval question for Rung 1.5.
- **RQ-Memento-1/2, RQ-Federation-1, RQ-Eval-1/2/3**: Round 4 and Rung 1.5 territory.
- **RQ-Harness-1**: fabric namespace minting at `https://cogitarelink.org/ns/fabric#` — blocks `fabric:*` past prototype.

H-D82 (inline JSON-LD blocks as level-4 affordance) is hypothesis, not decision —
test in Rung 1.5 eval before any listener-extension code lands.

## Vault sources of truth

- Active plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Unified Externalization Prototype Plan.md`
- Decisions log: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`
- Phase plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md`
