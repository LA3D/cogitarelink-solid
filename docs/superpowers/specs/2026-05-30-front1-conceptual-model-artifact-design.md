# Front 1 — Legible Conceptual-Model Artifact (Design)

**Date:** 2026-05-30. **Parent decision:** D108
(`docs/superpowers/specs/2026-05-30-skos-backbone-dual-view-enforcement-decision.md`).
**Front:** 1 of 2 (agentic harness / making the model legible). Front 2 (substrate enforcement
plumbing) is a separate spec. **Gates:** RQ-View-2.

## 1. Problem

Across sessions, agents repeatedly failed to understand wiki-memory's underlying structure
(page vs thing vs concept; the three label frames; SKOS-as-navigation), and the corpus drifted as
a result (`skos:prefLabel` never materialized, content shapes silently inert — see D108 root
cause). The diagnostic: recovering the frame model took deliberate reverse-engineering, and **that
reconstruction cost is the cost every cold agent pays and mostly fails to pay.** RQ-View-2 showed
the failure was *delivery*, not content — the existing dogfood note resolved the confusion *when
read*, but agents found it by luck and dismissed bare `rel="profile"` pointers; the cold agent's
own remedy was *"a single one-page arrival guide at the storage description."*

**Goal:** make the conceptual model **canonical, single-sourced, and cheap-to-acquire** — delivered
where agents land, in a form that shapes their chain-of-thought before they act, and impossible to
silently drift from what the substrate enforces.

## 2. Decisions taken in brainstorm (2026-05-30)

- **Form = hybrid (C):** a machine-readable normative *spine* + a dogfooded human/agent-facing
  *narrative* with a runnable (read-only) worked example. Both required; the narrative supplies the
  token-cheap in-context learning, the spine supplies the drift-proof authority.
- **Spine = augment the shapes (option 3):** the SHACL shapes ARE the spine, extended with a small
  `sub:` vocabulary so the frame model is machine-readable on the same artifact that enforces it —
  no parallel frame-map to drift.
- **Delivery = B + C:** a terse literal hook at the storage-description entry point (custom
  StorageDescriber — also closes the lone audit WARN) for cold-start acquisition, **plus** the
  `constrainedBy` Link header + the 422 message as point-of-need reinforcement at write time.
- **Worked example = A (read-only only):** the narrative points at real read-only exemplars; no
  agent-write/sandbox/cleanup (explicitly rejected as a mess-risk). The in-context examples shape
  chain-of-thought so the agent already has the pattern before doing the real operation. The
  rejection is shown via a *captured* `sh:ValidationReport`, not a live-triggered 422.

## 3. Artifacts produced (four + one shared exemplar set)

1. **The spine** — augmented SHACL shapes (§4).
2. **The narrative memory** — a dogfooded on-Pod concept/page with the read-only worked example (§5).
3. **Delivery wiring** — entry-point literal hook + point-of-need channels (§6).
4. **The agreement tests** — the dev-agent guardrail (§7).
5. **Shared gold exemplars** — one canonical, hand-authored exemplar set that the worked example
   reads, the tests assert against, and the agent pattern-matches from (§8). Single-sourcing the
   exemplars collapses three would-be-divergent artifacts into one.

## 4. The spine (augmented shapes)

Add a small `sub:` vocabulary (namespace `https://pod.vardeman.me/vault/ontology/substrate#`, per
D107) so each content shape declares its frame machine-readably:

- `sub:governsSubject` — `<>` (page document) or `<#this>` (entity) — which subject the shape governs.
- `sub:labelProperty` — the frame's canonical label property (`dct:title` / `schema:name` /
  `skos:prefLabel`).
- `sub:frameRole` — a short literal token: `"page"` / `"thing"` / `"concept"`.

Applied to the existing shapes:

| Shape | `sub:frameRole` | `sub:governsSubject` | `sub:labelProperty` |
|---|---|---|---|
| PageShape (`wiki:Page`) | `page` | `<>` | `dct:title` |
| ThingShape (`schema:Thing`) | `thing` | `<#this>` | `schema:name` |
| ConceptShape (`skos:Concept`) | `concept` | `<#this>` | `skos:prefLabel` |

The shapes remain the single source of truth; these annotations make the frame model
machine-readable so the narrative, the agreement tests, and the 422 text can all bind to / generate
from one place. Mint the three `sub:` terms in the substrate vocabulary with `rdfs:label` +
`rdfs:comment` + scope notes (FAIR-conformant, per existing catalog conventions).

## 5. The narrative memory + read-only worked example

A dogfooded on-Pod resource (rework of / successor to
`/vault/wiki/concepts/two-hierarchy-memory-addressing.md`) that conveys, in progressive-disclosure
order:

1. **The 30-second model** — three node-frames (page/thing/concept ↔ `<>`/`<#this>` ↔
   `dct:title`/`schema:name`/`skos:prefLabel`); SKOS is the conceptual backbone (concepts = scheme,
   notes/pages are memories that attach via typed edges).
2. **The write recipe** — how to author each kind; what the substrate projects vs what the agent
   owns (D81).
3. **The validation contract** — what is enforced (gated, 422) vs derived (auto-filled) vs
   agent-owned; per D108: `prefLabel` is agent-authored (not silently derived), labels like
   `rdfs:label`/`schema:name` are derived.
4. **The correction protocol** — what a 422 + `sh:ValidationReport` looks like and how to fix it
   (shown via a captured example, not a live trigger).
5. **The read-only worked example** — walks **narrative → spine → live exemplar**:
   - GET the exemplar concept's `.md` (document view) and `.meta` (graph view); observe
     `skos:prefLabel` on `<#this>` and the SKOS edges.
   - GET the governing shape; observe `sub:frameRole "concept"; sub:governsSubject <#this>;
     sub:labelProperty skos:prefLabel` — i.e. *find the model through the spine*.
   - Read the captured `sh:ValidationReport` for a `prefLabel`-omitted write and the fix.

All steps read-only; no mutation.

## 6. Delivery

- **Cold-start (B):** a **custom StorageDescriber** emits a one-screen literal `sh:agentInstruction`
  on `/vault/.well-known/solid` — "this Pod's memory is a SKOS concept backbone with three
  node-frames; writes are SHACL-gated; read `<agentGuide>` before writing" — closing the lone audit
  WARN (StaticStorageDescriber emits IRIs only). Then `sub:agentGuide` → the full narrative.
- **Progressive disclosure:** literal hook (unavoidable) → narrative + worked example (on demand) →
  augmented shapes/spine (on demand) → per-write guidance.
- **Point-of-need (C):** the `constrainedBy` Link header (a-priori contract, once Front 2 wires it)
  + the 422 `sh:agentInstruction` remediation at write time.

## 7. The agreement tests (dev-agent audience)

Parametric pytest, following the existing `tests/test_addressbook_templates.py` agreement-contract
pattern. Assertions:

1. **Spine completeness:** every content shape declares `sub:frameRole`, `sub:governsSubject`,
   `sub:labelProperty`.
2. **Narrative ↔ spine agreement:** the narrative's frame table matches the shapes' declarations
   (no shape the narrative omits; no claim the shapes contradict).
3. **Exemplar ↔ spine agreement:** each gold exemplar's `.meta` materializes exactly the
   `sub:labelProperty` on the `sub:governsSubject` its shape declares (e.g. exemplar concept carries
   `skos:prefLabel` on `<#this>`).
4. **Meaningful failure messages:** each assertion names the specific drift, e.g. "ConceptShape
   declares `sub:labelProperty skos:prefLabel` but gold exemplar `.meta` carries none —
   frame/materialization mismatch; see <narrative>."

This is the red a software-engineering agent (Claude Code) gets for rewriting the structure without
understanding it — the symbolic guardrail for the dev audience (D108 audience #2).

## 8. Shared gold exemplars

One canonical, **hand-authored** exemplar set (a concept with its page `<>` + concept `<#this>`, a
`skos:broader` hop, `prefLabel` present; plus a page and a thing exemplar). Hand-authored means the
`.meta` is made correct *by hand* (explicit `.meta` authoring / N3 PATCH to add `prefLabel` on
`<#this>`) — because pre-Front-2 the projection does **not** materialize `prefLabel`, so a plain
markdown PUT would leave the exemplar non-conformant. This makes them correct *targets* regardless of
whether the runtime auto-materializes yet. They serve three
roles simultaneously — worked-example read targets (§5), agreement-test fixtures (§7), and the corpus
the agent pattern-matches from — which is the single-source move that prevents the three from
drifting apart.

## 9. Scope boundary + sequencing

**In Front 1:** the `sub:` spine vocabulary + shape annotations; the narrative memory + read-only
worked example; the entry-point literal (custom StorageDescriber); the agreement tests; the
hand-authored gold exemplars.

**Deferred to Front 2** (separate spec): the enforcement *plumbing* — in-band/synchronous projection
(RQ-Enforce-1), `ldp:constrainedBy` on durable wiki containers, auto-materialization of
`prefLabel`/`rdfs:label`, and the live 422 write-gate.

**Useful property — Front 1 ships independently.** Because the gold exemplars are hand-authored
correct, Front 1's agreement tests assert *exemplars conform to augmented shapes* (true by
construction) and *narrative matches spine* — none of which require the Front-2 plumbing. So Front 1
delivers the legible model + reliable delivery + the drift-proof spine **now**, directly attacking
the comprehension/drift problem, while Front 2 later makes the runtime *auto-produce* the gold
standard (and the gold exemplars become Front 2's test targets). The point-of-need `constrainedBy`
channel (§6) only goes live when Front 2 wires it; until then the entry-point literal + narrative +
shape-discovery carry delivery.

## 10. Success criteria

- A cold agent landing at `.well-known/solid` acquires the 30-second model without following a bare
  IRI by hope (the literal hook is in the response).
- The narrative's worked example lets an agent confirm the frame model read-only and trace it to the
  governing shape (`sub:*` annotations) and the live exemplar.
- The agreement tests fail loudly + specifically if any of {shape annotations, narrative, gold
  exemplars} drift from each other.
- Front 1 is mergeable without Front 2 (independently shippable).

## 11. Open / deferred

- **RQ-Enforce-1** (Front 2): how to make projection in-band/synchronous.
- The live 422 demonstration in the narrative is a *captured* report until Front 2 makes the gate
  live; revisit the captured text when the real gate ships.
- Whether the narrative supersedes or extends `two-hierarchy-memory-addressing.md` (rework vs new) —
  resolve at plan time.
