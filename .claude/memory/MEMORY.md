# cogitarelink-solid — Session Memory

Compact state for cross-session continuity. Historical narrative + completed-work
recaps live in git history and the vault decisions log
(`~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`).
For decision IDs, invoke the `decision-lookup` skill.

## Wiki-Memory L3 Shape Completion Sprint — Shipped (2026-05-19)

8-shape L3 catalog + URI-independent substrate + L4 extension contract. Sprint tag: `wiki-l3-shape-completion-complete`.

- **8-shape catalog** (D98 / supersedes D77): PageShape + ThingShape + ConceptShape + PersonShape + PlaceShape + EventShape + OrganizationShape + HowToShape. Container layout updated to `/wiki/{concepts,people,places,events,organizations,procedures,working}/`.
- **Thing-as-top-class** (D95): `schema:Thing` as L3 root. Every resource is 1-to-1 with a Thing at `<#this>`. `schema:mainEntity` / `schema:mainEntityOfPage` bridge. Wikilink projection targets `<#this>`.
- **Page+Thing governance split** (D96): extends D81 Model A. `PageShape` governs `<>` predicates; Thing-shapes govern `<#this>` predicates. Listener emits two N3 Patch envelopes per write.
- **FAIR vocabulary metadata invariant** (D97): every minted term carries `rdfs:label`, `rdfs:comment`, `rdfs:isDefinedBy`, `dct:conformsTo`, `dct:created`, `dct:creator`. `sh:agentInstruction` reserved for procedural content only. `test_fair_metadata_present.py` enforces. `resource.shacl.ttl` exempted (pre-D97 artifact; retrofit pending).
- **Belt-and-braces disjointness** (D99): 3-layer enforcement — OWL declaration in `wiki.ttl`, shape-validator path constraint (skips `.meta` resources), SHACL `sh:not` in EventShape + HowToShape.
- **L4 extension contract** (D100): 5-step procedure. Substrate is URI-independent — Type Index registration triggers full substrate treatment at any container path. `template.shacl.ttl` exemplar + `/vault/meta/extending-l3.md` guide. `overlay:installsHintMapping` manifest predicate for new class-hint mappings.
- **Test counts**: ~94 TS unit + ~53 Python local + 19–20 Phase G live-Pod integration tests green.
- **Pre-existing failures**: `test_synthesis_page` + `test_mem_operations` DemoteAction — Memory Structuring Sprint domain, out of scope.

**Decisions ratified** (repo → vault numbering):
- D95 → vault-D91 — Thing-as-top-class
- D96 → vault-D92 — Page+Thing governance split
- D97 → vault-D93 — FAIR vocabulary metadata invariant
- D98 → vault-D94 — L3 shape catalog (8 shapes, supersedes D77)
- D99 → vault-D95 — Belt-and-braces disjointness
- D100 → vault-D96 — L4 extension contract + URI-independent substrate

**Bug-fix sprint substrate-behavior findings** (durable):
- Path constraints skip `.meta` resources (substrate-internal vs agent-content distinction).
- Live Type Index is the canonical dispatch oracle (D78 alignment); container rename without Type Index update silently breaks `<#this>` projection.
- FAIR metadata invariant: D38 `resource.shacl.ttl` exempted; do not use as style reference.
- **Components.js cannot instantiate TypeScript `interface`** — config types referenced from Components.js Override entries (e.g., `PathConstraintConfig`) must be declared as `class` with a constructor; otherwise componentsjs-generator emits an `AbstractClass` descriptor and Components.js throws "Failed to get module element" at boot.
- **apply.py shape-deploy convention**: the local file lookup uses `basename(overlay:hostedAt)`. If an overlay manifest declares `installsShape` with mismatched `overlay:document` local name vs `overlay:hostedAt` hosted basename, the deploy step fails. Match the basenames or extend `common.py` to parse `overlay:document` explicitly.
- **Listener path filter is vestigial** — the original `isWikiResource()` `/wiki/` substring filter was replaced by Type-Index-based dispatch (D78 oracle). Any L4 overlay's Type Index registration triggers full substrate treatment without `/wiki/` prefix.

## Project state (as of 2026-05-21, end of MemTrigger detector wiring sprint)

- **Branch**: main. Shape Completion Sprint shipped 2026-05-19 (D95–D100 / vault-D91–D96). Memory Structuring Sprint merged 2026-05-18 (commits c87c6b2 → e990299, D93/D94/K4 at bcce5bf).
- **Shipped**: Phase 1 + 2 + 2b + Rung 1.4 + Phase 5j + AddressBook + owner-identity
  + Phase 7a wiki-search + Phase 7a closeout + Memory Structuring Sprint (2026-05-18)
  + **Wiki-Memory L3 Shape Completion Sprint** (2026-05-19).
  Read-only Memento, tombstone semantics, wiki-memory L3 reference profile (D78–D81),
  Pod-as-toolkit capability catalog (D83), PROF profile descriptors + wikirole (D84–D86),
  AddressBook substrate (D87/D88), owner-identity overlay (D89/D90 repo-numbered as
  D89/D90 in vault; vault skipped D78–D86), wiki-search OSLC Query 3.0 surface
  (repo D91 / vault D87; dual-numbering legacy), Phase 7a closeout DataAccessor walker
  (repo D92 / vault D88), Memory Structuring Sprint (repo D93/D94/K4 / vault D89/D90/K-note),
  and **Shape Completion Sprint** (repo D95–D100 / vault D91–D96): 8-shape L3 catalog +
  Thing-as-top-class + Page+Thing governance split + FAIR metadata invariant +
  belt-and-braces disjointness + L4 extension contract + URI-independent substrate.
  17 integration tests passing on the live Pod across Phase A (synthesis), Phase B
  (six action E2E), and Phase C (announcement log + Solid Notifications subscription
  smoke); 4 documented `pytest.skip` for substrate emission tests pending MemTriggerListener
  detector hook integration. ~94 TS unit + ~53 Python local + 19–20 Phase G live-Pod
  integration tests added by Shape Completion Sprint.
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

## AddressBook substrate + capabilities-only overlay deps — Shipped (2026-05-17)

- **`overlays/addressbook/`** — 4 SHACL shapes (Contact, Org, Group, Membership) + 5 templates + 8 read affordances + 5 provided capabilities + bootstrap content + TypeIndex patch + 4 container `.meta` patches wiring `ldp:constrainedBy`
- **`tmpl:` vocabulary** at `/vault/ontology/template` (D87 candidate)
- **`/vault/contacts/`** with SolidOS-compatible layout: UUIDv4-slugged Person/Org/Membership cards, mnemonic-slugged Group files, populated `vcard:nameEmailIndex` + `vcard:groupIndex`
- **ContactCardShape** minimum-metadata invariant enforced: `vcard:fn` + `vcard:inAddressBook` + ≥1 anchor (`owl:sameAs` / `vcard:hasEmail` / `vcard:hasTelephone`); rejected writes return 422 with `text/turtle` `sh:ValidationReport` body
- **shape-validator extension** now serializes the `sh:ValidationReport` as Turtle in the response body (was previously discarded; templates depended on the feedback loop)
- **Capabilities-only overlay deps** (`docs/plans/2026-05-16-capabilities-only-overlay-deps.md`): `overlay:dependsOnOverlay` + `overlay:installedOverlay` deprecated; `overlay:providesCapability` added to `apply.py`; storage description stays static in `css/config/void-description.json` per CSS 405-on-PATCH limitation. D87/D88 candidate.
- **wiki-memory** retroactively declares 4 provided capabilities (wiki-vocabulary, foaf-primarytopic-bridge, wiki-type-index-registration, wiki-page-as-unit) so future overlays can declare typed deps
- E2E tests at `tests/integration/test_addressbook_e2e.py` pass (4/4): cold-start TypeIndex discovery, create with ORCID, SHACL rejection on missing anchor, find by ORCID

### Known caveats / followups discovered during implementation

- **Person card layout deviates from design**: design said `/vault/contacts/Person/<uuid>/index.ttl#this` (per-person container for attachment co-location); implementation uses flat `/vault/contacts/Person/<uuid>.ttl#this` because CSS rejects sub-container creation within a constrained container. Attachment-on-Person workflows need redesign (e.g., add Photo/ as separate constrained container, OR drop constrainedBy on Person/ and validate on individual cards differently).
- **vcard:inAddressBook SHACL resolution quirk**: shape uses `sh:hasValue </contacts/index.ttl#this>` which CSS resolves relative to server root (`https://pod.vardeman.me/contacts/index.ttl#this`), not vault root. Cards must use the (counter-intuitive) absolute IRI form to validate. Either shapes need absolute IRIs OR templates document the resolved IRI form.
- **AddressBook overlay does not have a wiki page bridge instance yet** — no Pod owner contact card exists. Setup-owner CLI flow (next plan) addresses this.
- **`find-by-orcid` affordance not exercised end-to-end** — E2E test falls back to direct GET+parse because solid-pod CLI not on PATH in test runner. Add proper affordance invocation test in next plan.

Companion docs:
- Design: `docs/plans/2026-05-16-agentic-addressbook-design.md`
- Plan: `docs/superpowers/plans/2026-05-16-addressbook-substrate.md`
- Capabilities-only deps: `docs/plans/2026-05-16-capabilities-only-overlay-deps.md`

### Decisions ratified this sprint

- **D87** — Capabilities-only overlay dependencies (replaces deprecated `dependsOnOverlay`/`installedOverlay`)
- **D88** — `tmpl:` substrate template vocabulary (first consumer: AddressBook with 5 templates)

See `.claude/skills/decision-lookup/decisions.md` for full text.

## owner-identity overlay + setup-owner skill suite — Shipped (2026-05-17)

Picked up MEMORY plan items #1 + #2 in one sprint as a skill-only approach (no
new CLI surface — orchestrates existing `solid-pod` commands).

- **`overlays/owner-identity/`** — new substrate overlay above AddressBook.
  Two shapes (PodOwnerWebIDShape spec-grounded against Solid WebID Profile
  editor draft https://solid.github.io/webid-profile/; PodOwnerPreferencesShape
  as agent↔human elicitation contract). Two templates (webid-enrich.ttl —
  first PATCH-flavor template using tmpl:targetResource v1.1; prefs-init.ttl).
  Five capability descriptors. Resource `.meta` patch on /vault/profile/card
  adds dct:conformsTo + ldp:constrainedBy via new `installsResourceMetaPatch`
  manifest predicate.
- **`tmpl:targetResource`** predicate added (v1.1) for PATCH templates
  targeting an existing resource. The XOR invariant (target either container
  OR resource, never both) is documented in the predicate's rdfs:comment;
  per-template tests in T6/T7 enforce; a SHACL TemplateShape with `sh:xone`
  is a candidate cleanup (see FOLLOWUPS).
- **Apply.py extension** — `installsResourceMetaPatch` predicate handled in
  manifest parser + applied in apply.py step 11b. Plain-Turtle patch bodies
  are re-parsed with the target as publicID, then wrapped in N3 Patch envelope
  via `n3_patch_inserts` (distinct from container-meta-patch which expects
  pre-wrapped N3 Patch bodies).
- **Three new agent skills** in `~/dev/git/LA3D/agents/solid-agent-skills/`:
  - `solid-addressbook` — discover, read, create Person/Org/Membership, find
    by 8 affordances. Documents the absolute-`vcard:inAddressBook` IRI quirk
    and flat-layout caveat from AddressBook MEMORY.
  - `solid-wiki-memory-l3` (minimal scope: Person class + bridge procedure).
    Two-stage commit, full shape coverage, mem:* triggers deferred to a
    follow-on Memory Structuring Sprint.
  - `solid-owner-identity` — orchestrator. SetupPodOwner Phases A–F with
    full idempotence semantics and failure-mode handling. Phase A walks the
    human through preferences-file elicitation; Phases B/C call into
    solid-addressbook; Phase D optionally calls into solid-wiki-memory-l3;
    Phase E PATCHes the WebID; Phase F marks setupOwnerCompleted.
- **Follow-the-nose discovery** (A+C combined per design): webid-enrich
  template inlines `<wiki-page> a wiki:Person` in the WebID response so a
  single dereference reveals the L3 agentic-memory record without extra
  round-trips.

Integration test (`tests/integration/test_owner_identity_e2e.py`) passes 3/3
against the live Pod: all 10 overlay artifacts dereference, `/vault/profile/card.meta`
advertises the shape via dct:conformsTo + ldp:constrainedBy, webid-enrich
template declares PATCH + targetResource correctly.

### Caveat / pre-flight requirement

The owner-identity overlay requires `tmpl-vocabulary v1.1` (for
`tmpl:targetResource`). On a fresh Pod, the AddressBook overlay's capability
descriptor needs to be re-uploaded before owner-identity applies — the
in-repo file is at v1.1 but the live Pod may still have v1.0 from the
AddressBook sprint. A direct PUT of `overlays/addressbook/capabilities/tmpl-vocabulary.ttl`
fixes this; future apply.py runs of addressbook will refresh it automatically.

### Decisions ratified this sprint

- **D89** — Owner-identity overlay as substrate-level concern (above
  AddressBook + wiki-memory). Ratified (2026-05-17) by successful cold-session
  end-to-end run; follow-the-nose A+C design held in practice.
- **D90** — Agent↔human elicitation via `pim:preferencesFile`
  (`/vault/settings/prefs.ttl`). Ratified (2026-05-17) by the same run;
  one-question-at-a-time walk-through with per-answer PATCH worked as designed.

See `.claude/skills/decision-lookup/decisions.md`.

### TLS gap surfaced + remediated

T30 cold-session revealed that the new skills didn't document the D85
`NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem` env var. The agent
reached for `NODE_TLS_REJECT_UNAUTHORIZED=0` (disables verification
globally) instead. Fixed in two layers:
- Skill-side: "Pre-flight — TLS dev cert" section added to all three new
  SKILL.md files (commit `d430c24` in solid-agent-skills).
- CLI-side: `src/lib/http.ts` now auto-detects the mkcert root CA at module
  load and registers it via undici's global dispatcher (zero-config dev
  TLS, silent no-op in prod). On TLS error the wrapped `safeFetch` emits a
  clear remediation message naming the `NODE_EXTRA_CA_CERTS` env var and
  warning against the unsafe `NODE_TLS_REJECT_UNAUTHORIZED=0` shortcut.
  Commit `9797ec1` in solid-agent-skills.

Companion docs:
- Design: `~/dev/git/LA3D/agents/solid-agent-skills/docs/superpowers/specs/2026-05-17-pod-owner-setup-skill-design.md`
- Plan: `~/dev/git/LA3D/agents/solid-agent-skills/docs/superpowers/plans/2026-05-17-pod-owner-setup-skill.md`

## Phase 7a wiki-search — Shipped (2026-05-18)

Wiki-search CSS extension shipping the first measurable affordance of D87.
16-task TDD sprint executed via superpowers:subagent-driven-development.

- **`css/extensions/wiki-search/`** — 12 source files: SearchEngine interface
  + RegexpSearchEngine (pure-Node, escaped literal substring); parseSearchTerms
  (strict OSLC §7.3 quoted phrases); parseQuery (paging + deferred-params 501
  flag); score (density-based, log-dampened); snippet (halo-bounded);
  ResponseBuilder (Turtle with `oslc:nextPage` + `oslc:totalCount`); uri helpers;
  walker (BFS + WAC subtree-omission, injectable fetch seam); WikiSearchHttpHandler
  (orchestrator); WikiSearchLinkMetadataWriter (Tier-1 discovery via
  `Link: rel="queryBase"`).
- **`overlays/wiki-memory/`** extended with capability `wiki-search-substrate.ttl`
  + affordance `wiki-search-grep.ttl` + manifest entries.
- **`css/config/`** wiki-search.json + Components.js consolidation into
  memento.json's Overrides (K1 limitation handled — single Override per
  BaseHttpHandler / MetadataWriter instance).
- **Sibling repo solid-agent-skills**: `solid-pod wiki-search` CLI command +
  `skills/wiki-search/SKILL.md` (commit `b17be6f`).
- **77 unit + 14 integration tests** green; p95 latency **26.7ms** (D87 ceiling
  500ms — 18.7× headroom).

### Architectural deviation — walker rewrite (D91 candidate)

Task 8's original plan called for in-process `ResourceStore.getRepresentation`
access. Integration testing in Task 12 surfaced a re-entrant lock crash (CSS's
per-resource write lock + handler running inside its own request context →
6s lock-expiry + N3StreamWriter crash). Walker rewritten in `eb37bb7` to use
undici-based HTTP self-requests; `WalkFetch` interface injected for unit
testability (Approach B, commit `5e9c6c1`). D91 ratification deferred pending
larger-scale evidence (current pod content is ~dozens of pages; perf measured
fine but the projected ~1000-page vault hasn't been stress-tested).

### Known gap (blocks WAC tests)

HTTP self-requests in the walker are currently anonymous. WAC enforcement
runs via `PermissionReader` with real credentials BEFORE the self-request,
but the self-request itself omits `Authorization` / `DPoP` headers. Under
dev-allow-all config this is invisible. With real auth, a WAC-protected
resource that passes the permission gate would fail the anonymous content
fetch silently (anon-deny = resource excluded from results, even when the
authenticated user is entitled). **Must fix before un-stubbing the 6 WAC
scenario tests in `tests/integration/test_wiki_search_e2e.py`.** Pragmatic
fix: forward original request's Authorization + DPoP headers into the
undici self-request (~20 LOC in walker.ts). See FOLLOWUPS.md.

Companion docs:
- Spec: `docs/superpowers/specs/2026-05-18-wiki-search-refinement-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-18-wiki-search-implementation.md`
- Original design: `docs/plans/2026-05-17-wiki-search-design.md`

## Cross-machine rebuild reproducibility debug (2026-05-22)

Triggered on Mac Studio after pulling main (work was done on MacBook Pro). Fresh
`docker compose down -v && build && up` failed at the `pod-setup` step; live Pod
on MacBook had been working. Investigation surfaced two latent bugs that were
masked by stale state on MacBook.

### Finding 1: `.operations/` SHACL 422 — 29-minute commit-order race

Symptom: `ensure_container` PUT to `https://pod.vardeman.me/vault/wiki/.operations/`
returns 422 with `sh:resultMessage "Resources at /vault/wiki/.operations/* must
declare one of: as:Activity. Got: ."`.

Root cause: `evaluatePathConstraint` (`css/extensions/shape-validator/src/pathConstraint.ts`)
uses `resourcePath.startsWith(c.pathPrefix)`. For the literal container PUT the
path equals the prefix → match → empty body has no `rdf:type` → fails the
`allowedClasses: [as:Activity]` check. The constraint targets *children* at
`<pathPrefix>*`, but the matcher can't distinguish the container itself from
its children.

Why MacBook worked:
- `665e9c8` "Task 30: hard rebuild + apply fixes for shape-completion sprint" —
  2026-05-19 **15:17:32** — message: "Pod rebuilt from scratch. All 3 overlays
  applied successfully."
- `c9c3077` "config fix: wire pathConstraints into ShapeValidationStore (Bug B)" —
  2026-05-19 **15:46:45** — moved pathConstraints from inactive
  `shape-validation/resource-store.json` into the active `solid-config.json`.
  29 minutes later.

The "successful rebuild" test ran *before* the regression-causing change. After
c9c3077, MacBook never re-ran `down -v`. `ensure_container` does
`HEAD → 200 → return` (idempotent), so the existing-from-15:17 container was
reused on every subsequent restart and the bug stayed latent. Mac Studio's
`down -v` removed that container and the bug surfaced.

Fix shipped: skip path constraint when `resourcePath === c.pathPrefix` (container
itself). `ShapeValidationStore.ts:200-207`. Mirrors the existing `.meta` skip
pattern. Integration test covers container-bootstrap case alongside Bug E
regression guard.

### Finding 2: AddressBook + owner-identity not applied on rebuild

Symptom: `docker-compose.yml` pod-setup invoked `overlay.apply /overlays/wiki-memory`
only. Both newer overlays (`addressbook` 273e314 + `owner-identity` 1757215 —
both 2026-05-17) shipped with passing E2E integration tests on the live Pod,
but their `apply` invocations were never added to docker-compose.

Hypothesis: on MacBook these were applied by hand after the wiki-memory
pod-setup completed (manual `python -m scripts.overlay.apply` invocations from
the host). The manual step was never folded back into compose.

Fix shipped: chain all three applies in `docker-compose.yml` pod-setup, in
dependency order (wiki-memory provides capabilities → addressbook consumes
them and provides its own → owner-identity consumes addressbook's
tmpl-vocabulary v1.1).

### Durable rules

- **Never declare a rebuild "verified" without `down -v`.** `make up` /
  `compose up` alone exercises the existing volume; the substrate-bootstrap
  path that creates containers + applies overlays only runs on a fresh
  `css-data`. Use `make reset` for verification.
- **`ensure_container` HEAD-skip masks constraint regressions.** Any change
  that adds or modifies a path constraint, ldp:constrainedBy shape, or
  container-creation-time validation MUST be tested via a fresh-volume rebuild,
  not an in-place restart.
- **Path constraints govern children at `<pathPrefix>*`, not the container
  itself.** When adding a new path constraint, the test suite must include
  both a container-bootstrap case (PUT to the constraint path → must pass) and
  a child-resource case (PUT to a path under the constraint → enforced as
  designed).
- **Every overlay in `overlays/` must be wired into `docker-compose.yml`'s
  pod-setup command** in dependency order. If an overlay has integration tests
  but isn't in the compose pod-setup command, that's a reproducibility hole —
  any cross-machine rebuild will be missing it.
- **Cross-machine handoffs** — after `down -v && build && up` succeeds, the
  reproducibility envelope is captured by `docker-compose.yml` + the in-repo
  overlay/config tree. Anything done by hand to the live Pod that isn't
  represented there will be lost on the next machine.

## Rung 1.5 redesign — Design Landed (2026-05-23)

The Rung 1.5 evaluation framing was redesigned in a planning session. Original
three-condition framing (B1 filesystem / B2 brute-force Pod / T Pod-harness)
dropped; replaced with an engineering-feedback loop testing L1/L2/L3 axes +
multi-Pod federation. **No code shipped this session — only design.**

Ratified **D97** (vault) / **D102** (repo) — Rung 1.5 reframed as L1/L2/L3
engineering evaluation.

**Why the reframe**:
- Pod-as-substrate is settled; filesystem-baseline is comparing to a non-option
- Wiki-memory L3 is stipulated good (three-tradition convergence); the question
  shifts from "is the L3 right?" to "do agents use it correctly?"
- L2 invariants have been treated as axioms but never measured. The canonical
  L2 doc (`Memory Substrate vs Memory Profile.md`) explicitly defers operational
  details to "Rung 1.5+ evaluation" — this rung cashes that in
- The original T condition was "one harness skill"; we now have a multi-skill
  suite, so T = "agent equipped with skill X" — exactly what skill-creator's
  harness measures
- Karpathy's three operations (Ingest / Query-with-file-back / Lint) make the
  *compounding* claim explicit. Retrieval-only or creation-only evals can't
  observe compounding; the round-trip is the actual measurement
- Multi-Pod federation has nowhere to land in the old design but is the obvious
  next engineering question (matches RQ-Substrate-4)

**Three measurement axes** (new):
- Trajectory (self-logged `trajectory.jsonl` per subagent)
- Outcome (skill-creator native grader — tokens, duration, output-assertion pass rate)
- Round-trip consistency (paired create + retrieve — verifies compounding directly)

**Phase sequence** (A pilot → A full → C → B1 → B2 → D):
- A: wiki-search retrieval at current scale
- C: scale extension *before* the B subdivision; informs B design
- B1: Karpathy Ingest + Query-with-file-back, runnable now
- B2: Karpathy Lint, gated on Pod-side lint skill (not yet built)
- D: multi-Pod federation, gated on second Pod + federation skill

**Build queue surfaced by the design**:
- Pod-side lint/audit/curator skill (analogous to vault `/audit` + `/curator` +
  `/review-note`) — gates Phase B2. Build trigger: Phase A or C surfacing
  specific failure modes that lint catches. Not built prophylactically.
- Federation skill — gates Phase D. Design after Phase C lands evidence on
  what federation needs to support.

**Design doc** (durable engineering artifact):
`docs/plans/2026-05-23-rung-1.5-redesign-design.md`

**Superseded docs**:
- `docs/plans/2026-05-15-rung-1-5-eval-matrix.md` (v2 matrix; useful as
  historical input but no longer canonical)
- `docs/plans/2026-05-15-rung-1-5-session-handoff.md` (handoff doc; same)

**Substrate-behavior input** (back-of-envelope evidence already gathered):
`~/Obsidian/obsidian/retrieve-workspace/iteration-1/benchmark.json` — vault
retrieval eval via skill-creator pattern. Confirms the harness works
end-to-end at meaningful scale and produces measurable with-skill vs
without-skill deltas on a non-trivial L3.

## Next plans (post-Shape-Completion-Sprint)

In dependency order:

1. ~~**MemTriggerListener detector wiring**~~ — closed 2026-05-21 (D101). See Closed section below.

2. **Rung 1.5 — Phase A pilot** (entry point per D97 redesign, 2026-05-23).
   skill-creator harness with-skill vs without-skill on wiki-search. Two task
   prompts initially (literal-substring find + paged retrieval). Trajectory
   capture via `trajectory.jsonl` self-logging + separate behavior judge
   reading the trajectory. Decision criterion: if both agents complete both
   tasks and the trajectory + behavior judge produce useful signal, Phase A
   proceeds with the full task suite. Otherwise harness gets fixed first.
   See `docs/plans/2026-05-23-rung-1.5-redesign-design.md` §9 for the pilot
   specification.

3. **Rung 1.5 — Phase C (scale extension)** runs *before* the B1/B2 split.
   Vault import preferred (real semantic diversity, real hub/dead-end
   distribution) over synthetic expansion. Phase C output informs B
   subdivision.

4. **Rung 1.5 — Phase B1 (Karpathy Ingest + Query-with-file-back)** —
   round-trip paired tasks (create + retrieve) against existing skill suite
   (solid-addressbook, solid-wiki-memory-l3 Person creation, wiki-search for
   the retrieval half). Compounding observation: does fan-out happen, or do
   agents dump everything into one page?

5. **Rung 1.5 — Phase B2 (Karpathy Lint)** — gated on building a Pod-side
   lint/audit/curator skill (analogous to vault `/audit` + `/curator` +
   `/review-note`). Build trigger: A or C surfacing failure modes that lint
   catches. Don't build prophylactically.

6. **Rung 1.5 — Phase D (multi-Pod federation)** — second Pod fixture +
   federation skill (likely new build). Cross-Pod discovery, queries,
   identity, indexing. Operationalizes RQ-Substrate-4.

Phase 7b/c/d (engine swap, hybrid RRF, in-pod index) are deferred until
Rung 1.5 evidence justifies. Wiki URI scheme rethink (per FOLLOWUPS) slots
in if surfaced by Phase A or C.

### Closed (2026-05-21)

- ~~**MemTrigger detector wiring sprint**~~ — shipped 2026-05-20 (implementation) /
  2026-05-21 (close). Ratified **D101** (MemTrigger detector wiring and substrate-signal
  delivery model). Sprint tag: `mem-trigger-detector-wiring-complete`.
  - D101: A+C combined delivery (post-write LDN GET + Solid Notifications subscription);
    Pattern B (atomic in-response Link headers) deferred to RQ-Atomic-Feedback-1.
    Two-hook DI pattern (IUnprocessableWriteHook + IPostProjectionHook) with no-op
    defaults in producer extensions. PendingEventsBuffer singleton for circular-DI
    workaround.
  - **Test counts**: 44 mem-trigger TS unit + 31 shape-validator TS unit + 75
    markdown-projection TS unit; 3/4 live-Pod integration tests passing
    (test_reflection_due_emits_event remains pytest.skip pending test-mode config).
  - **Substrate-behavior findings** (durable):
    - **PendingEventsBuffer pattern** — hooks that fire before `ResourceStore` is
      ready (e.g., `IUnprocessableWriteHook` inside `ShaclValidator`) cannot hold
      an `EventEmitter`. Module-level singleton buffer; `MemTriggerListener` drains
      on startup + on every `'changed'` event. Drain runs regardless of startup grace.
    - **`fetch()` not `store.getRepresentation()` for lock re-entrancy** — `'changed'`
      fires while CSS may still hold a write lock on the parent container.
      `store.getRepresentation` on parent during that window triggers the 6s
      `WrappedExpiringReadWriteLocker` crash. `fetch()` sidesteps the in-process lock.
    - **`mem:Event` multi-typing required** — events in `/vault/wiki/.events/` must
      carry `a mem:Event` in addition to their specific subclass (`mem:BoundExceeded`,
      `mem:UnprocessableWrite`, etc.). The path constraint on `/vault/wiki/.events/`
      does literal-IRI matching (no subclass inference), so a subclass-only emission
      gets rejected as a path-constraint violation. All four detectors now emit both.
    - **`cito:` URIs for `{.supports}` / `{.criticizes}` wikilink projection** —
      `wikilinkProjection.ts` (HINT_TO_PROJECTION map) emits `cito:agreesWith` for
      `[[X]]{.supports}` and `cito:disagreesWith` for `[[X]]{.criticizes}`, NOT the
      naive `wiki:supports`/`wiki:criticizes`. `mem-trigger.json` `contradictoryPairs`
      ships with `[[cito:agreesWith, cito:disagreesWith]]` (T13 fix); unit tests
      mirror this (T27 fix). Future contradictoryPairs additions must match the
      actual emitted predicate IRIs in `wikilinkProjection.ts`, not the class hint
      names.
    - **15s startup grace + lazy Type Index load** — `handle()` defers Type Index
      read to first write after a 15s startup grace, avoiding the write-lock crash
      during pod-setup bulk initialization. `checkBound` is gated by this grace;
      `drainPendingEvents` is not.
    - **`getLoggerFor` silenced in extension packages** — CSS's global-logger-factory
      suppresses info/warn from extension packages at default log level. Debug-critical
      messages use `console.error` directly for visibility.

### Closed (2026-05-19)

- ~~**Wiki-Memory L3 Shape Completion Sprint**~~ — shipped 2026-05-19. Ratified
  D95–D100 (repo) / vault-D91–D96. 8-shape L3 catalog (supersedes D77) + Thing-as-top-class
  (D95) + Page+Thing governance split (D96) + FAIR metadata invariant (D97) +
  belt-and-braces disjointness (D99) + L4 extension contract + URI-independent substrate
  (D100). ~94 TS unit + ~53 Python local + 19–20 Phase G live-Pod tests green.
  Sprint tag: `wiki-l3-shape-completion-complete`.

- ~~**Memory Structuring Sprint**~~ — shipped 2026-05-18. Ratified
  D93 (synthesis page) + D94 (mem: vocabulary, Action/Event taxonomy
  with proto-grounded parents) + K4 (JSON-LD <script> compatible with
  D75) in repo decisions; vault D89/D90/K-note. 17 integration tests
  passing across Phase A/B/C, 4 documented skips for substrate emission
  pending detector hook integration (see Next plan #1). Sprint tag:
  `memory-structuring-sprint-complete`. Substantive deviations from
  original spec: vocabulary renamed Operation→Action (proto-knowledge
  with schema.org), Announcement category collapsed into multi-typed
  as:Announce activities (COAR Notify pattern). Six substrate-behavior
  findings recorded in decisions.md.

- ~~**Wiki-search walker Path 1a redesign**~~ — shipped commit `2f2f28b`.
  Ratified as **D92** in repo / vault-D88. DataAccessor end-to-end
  (broader than the originally-planned hybrid — see decision text for
  why). p95 7.6 ms.

### Memory Structuring Sprint findings (durable substrate constraints)

Recorded in vault decisions log "Substrate-behavior findings" section.
Worth remembering across sessions:

- **N3 Patch rejects blank nodes in `solid:inserts`** (HTTP 422). PROV-O
  activity nodes MUST use named fragment URIs, not `[a Type; ...]` blank
  nodes. Agents performing memory actions: translate. Detectors emit
  with `urn:uuid:{...}` activity subjects.
- **CSS treats trailing-slash URLs as LDP containers**. Body PUTs to
  `/foo/` are rejected or body ignored. The synthesis page is at
  `/vault/wiki/index.md`, not `/vault/wiki/`.
- **Storage description PATCH returns 405** — fully static via Components.js
  void-description.json; runtime PATCH not supported.
- **Components.js Override enforcement**: only ONE Override per instance
  at preprocess time. Multiple Overrides raise ErrorResourcesContext. Last-
  imported does NOT win. mem-trigger.json is the canonical owner of the
  WorkerParallelInitializer Override (lists Memento+MarkdownProjection+
  MemTrigger handlers).

### Research-track (not scoped to a sprint)

- **VC credential extension** — CSS v8 has policy-engine VC matchers but
  no `VerifiableCredentialExtractor`. Three routes documented in
  `docs/plans/2026-05-18-vc-credential-roadmap.md` (B rejected as
  duplicating SolidLab UMA AS; C as ~150-LOC custom-header v1 prototype;
  A' as SolidLab-UMA + contributed `VcVerifier` for v2 production).
  Implementation triggers on Rung 1.5 evidence or a concrete VC-gated
  access use case.

## Active focus — Rung 1.5 (redesigned 2026-05-23 per D97 / repo-D102)

**Reframed as engineering feedback loop, not claim-proof experiment.** The artifact is a Pod
design that demonstrably works, not a publication. Original B1/B2/T framing dropped.

**Stipulated** (not under test): Pod-as-substrate (filesystem dropped — not a real option for
multi-machine/multi-agent use); wiki-memory L3 as canonical profile (three-tradition
convergence + D98 8-shape catalog); skills + structured memory both required.

**Under test** (engineering questions by L-layer):
- **L1**: do agents use Solid features (storage description, Link headers, Solid-OIDC, Memento, LDN)?
- **L2**: are the seven invariants (bounded branching, tiered retrieval, lifecycle metadata,
  explicit + implicit signals, hybrid storage, separable procedural memory, OOD honesty)
  from `Memory Substrate vs Memory Profile.md` observable in agent behavior? (The L2 doc
  explicitly defers operational details to "Rung 1.5+ evaluation"; this rung cashes that in.)
- **L3 instance**: which specific wiki-memory L3 affordances earn their keep? Which are YAGNI?
- **L3 Karpathy 3 ops**: do agents Ingest with fan-out, Query-with-file-back, and Lint
  correctly? Does the wiki *compound*?
- **Multi-Pod federation**: when 2+ Pods, does L2-shared / L3-differing federation work?

**Three measurement axes**: trajectory (self-logged `trajectory.jsonl`), outcome
(skill-creator native grader), round-trip consistency (paired create+retrieve verifies
compounding). A creation task that passes outputs but fails round-trip retrieval is the
diagnostic-most finding — substrate design failure, not agent failure.

**Phase sequence** (committed; B subdivision provisional):
- A pilot → A full (wiki-search retrieval)
- C (scale extension, vault import preferred — informs B design)
- B1 (Karpathy Ingest + Query-with-file-back, runnable now)
- B2 (Karpathy Lint, gated on Pod-side lint skill not yet built)
- D (multi-Pod federation, needs second Pod + federation skill)

**Pilot-first**: single Phase A pilot shakes down the harness before scaling.

**Reference docs**:
- Design doc (durable engineering artifact): `docs/plans/2026-05-23-rung-1.5-redesign-design.md`
- Decision: D102 (this repo) / vault-D97
- Canonical L2 source: `Memory Substrate vs Memory Profile.md` (vault)
- Karpathy framing: `Karpathy - Agentic Wiki Design Document.md` (vault)
- Superseded: `docs/plans/2026-05-15-rung-1-5-eval-matrix.md`, `2026-05-15-rung-1-5-session-handoff.md`

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
- **RQ-Atomic-Feedback-1**: For write-triggered substrate signals (`mem:BoundExceeded`, `mem:ContradictionDetected`), does **atomic in-response delivery** (Option B — synchronous detector firing pre-response + Link header augmentation) improve agent behavior over **deferred delivery** (Option A — client-side post-write `/.events/` query, or Option C — Solid Notifications subscription)? MemTrigger wiring sprint (2026-05-20) ships A+C; B is deferred pending eval evidence that atomic feedback is worth the architectural cost (restructuring detectors away from MonitoringStore's `'changed'` event). Rung 1.5 must include a task class that exercises this — measure outcome quality between agents that get atomic feedback vs deferred. Connects to the in-context feedback design question for the agentic harness.
- **RQ-UI-1**: A Pod-hosted, substrate-aware memory-structure UI for end-user transparency (wikilink graph, shape conformance per resource, `/.events/` stream, affordance catalog, Type Index, Memento history). The Pod is localhost-only, so externally-hosted Solid apps (Penny, SolidOS) work only via the user's own browser — not robust for end-users / demos. Triggered post-Rung-1.5 or when an end-user-facing affordance is needed. See FOLLOWUPS "Pod-hosted memory-structure UI" for the architectural sketch.

H-D82 (inline JSON-LD blocks as level-4 affordance) is hypothesis, not decision —
test in Rung 1.5 eval before any listener-extension code lands.

## Vault sources of truth

- Active plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/Unified Externalization Prototype Plan.md`
- Decisions log: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`
- Phase plan: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-PLAN.md`
