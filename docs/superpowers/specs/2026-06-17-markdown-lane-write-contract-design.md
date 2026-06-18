# Markdown-lane write contract — design

**Date:** 2026-06-17
**Status:** SUPERSEDED 2026-06-18 by the shape-governance reconciliation (D117; spec
`2026-06-17-shape-governance-reconciliation-design.md`, merged `6510e2a`). This standalone
markdown-lane design was folded into the broader reconciliation: the write contract became ONE
substrate `sub:WriteContractShape` (`foaf:Document` → `mem:rationale`) injected by the derivation,
rather than per-lane shape edits. The reusable commits from the paused `markdown-lane-write-contract`
branch (projection `rationale:`→`mem:rationale`, the durable-seed backfill, the crystallize affordance)
were cherry-picked into the reconciliation; the branch itself is a stale-branch cleanup candidate.
Retained as the design record of the markdown-lane sub-problem (`<>`-vs-`<#this>` subject placement,
D73 crystallization timing) that the reconciliation resolved by construction.
**Decision id:** extends D116 (PSP); closes FOLLOWUPS `🧷 (a)`; superseded by D117
**Supersedes/relates:** D73 (two-stage commit), D108 (admission floor), D109 (layer-partitioned authority), D112 (operations log / curation), D116 (provenance-scoped projection — the gate-lift)

## Problem

The Turtle-lane write contract shipped (SP2 T10/T10b): contacts and AddressBook
`Organization`/`Group`/`Membership` require `mem:rationale` on every write — the task that
triggered it, what was concluded, why — enforced by the SHACL admission floor with a laden 422.
The **wiki/markdown lane has no such contract.** A crystallized concept, person, place, event,
organization, how-to, or source carries no record of *why* it was committed to durable memory.

The FOLLOWUPS note gated this on D82/D116 (PSP), assuming rationale would be authored as
agent-`.meta`-enrichment (which a body rewrite would strip pre-PSP). The actual mechanism here is
a *body-projected frontmatter field* (§3), which survives rewrites via the normal projection path
and so never strictly needed the gate-lift. PSP remains valuable independently; the dependency was
mis-attributed. The contract is buildable now regardless.

This is the L2 agentic-write-contract invariant ([[agentic_write_contract]]): an agentic app MUST
describe + provenance every resource it writes (LDP/Solid only MAY). It is the defining
agentic-vs-Solid difference, and the wiki lane is the last durable lane missing it.

## Decisions (the four forks, settled)

### 1. Placement — canonical on the resource, reachable from the log by link

`mem:rationale` is **authored once** and is **canonical on the resource `.meta`** (the `<#this>`
Thing subject). The LM never chooses a provenance path.

`mem:rationale` does not compete with PROV-O — it is the prose slot *inside* the PROV frame. The
operations log already pairs them (`realign-2026-05-23.ttl`: a record is
`a as:Announce, mem:RealignAction, prov:Activity` carrying both `prov:used`/`prov:wasDerivedFrom`
*and* `mem:rationale`). PROV supplies the skeleton (who/from-what/when); `mem:rationale` is the why.

PROV purity would hang the rationale on the **Activity**. We instead hang it on the **resource
(Entity)** because the eval evidence wins: the D114/H1 probes showed agents miss things one deref
deep — they do not follow `prov:wasGeneratedBy` out to the activity, and the E5 audit disposition
reads the **resource's** `.meta`. Resource-canonical puts the rationale where the auditor already
looks.

### 2. Operations log — link-only

The crystallize Activity in `/vault/wiki/.operations/` already carries
`as:object`/`prov:generated → durable-resource`. The PROV structure is therefore complete:

```
Activity --prov:generated--> Entity(resource) --mem:rationale--> "the why"
```

The log **does not copy** the rationale literal. A curator (D112 probe-1 validated — curators
follow links) reads the Activity and dereferences one link to the resource for the rationale.
Zero duplication, zero new substrate code, maximally single-source — the tightest reading of
"both resource and log" that does not fork the authored fact.

**Deferred refinement (not in scope):** a *frozen snapshot* — copying the rationale literal into
the immutable crystallize record so the historical why is preserved verbatim even if the resource
is later re-edited. Build only if the curation loop demonstrates a need for frozen history; it
costs either a new snapshot listener or agent dual-authoring (drift risk). PSP already keeps the
resource rationale durable across rewrites, so MVP does not need it.

### 3. Authoring surface — frontmatter `rationale:` field, projected to `mem:rationale`

**Forced by the floor mechanics.** The admission floor is in-band and enforces the *full*
destination shape at body-PUT time (`test_preflabel_less_concept_rejected_422`,
`test_source_without_identifier_rejected_422`: a body whose projection lacks a *required*
predicate is 422'd at the PUT). So a *required* predicate must be present in the single
body PUT's projection. A "PUT body, then PATCH `.meta` with rationale" sequence (the original
Option B, modelled on the Turtle lane) cannot work on the markdown lane: the body-only PUT is
rejected before the PATCH can run. Option B works for contacts only because a contact is a
*Turtle body* — rationale rides in one atomic write; the markdown lane's atomic write is the
body + its projection.

So rationale is authored as a governed **frontmatter field** that projects to the `.meta`:

```markdown
---
type: concept
rationale: "Crystallized to document the two-hierarchy addressing rule; concluded
  RDFS-subsumption and SKOS-broader are distinct axes after reconciling D105/D106
  against the cold-probe misread."
---
# Two-Hierarchy Memory Addressing
...
```

The mechanism already exists: `css/extensions/markdown-projection/src/frontmatterProjection.ts`
maps a governed key set (`type`, `title`, `created`, `maturity`, `identifier`, `aliases`) to
`.meta` quads, and `mem:` is already in its CURIE prefix map. Adding rationale is one mapping line
(`projectFrontmatter`) + one `Frontmatter` type field.

Properties this preserves:
- **Atomic** — present in the single body PUT's projection, satisfies the in-band floor.
- **Canonical on `.meta`** (decision §1) — it projects *into* `.meta`; frontmatter is the
  authoring token. This is dual-layer linking (D58) / markdown-as-authoring-authority (D109).
- **Semantically honest** — rationale lives in the YAML metadata header, *not* the rendered prose.
- **Seeds trivial** — add a `rationale:` line to each durable seed `.md` frontmatter; no
  `.meta` sidecar, no PATCH-after.

> **Gate-lift footnote.** The original FOLLOWUPS note gated this on D82/PSP because it assumed
> the agent-`.meta`-enrichment authoring (Option B). Frontmatter rationale is *body-projected*,
> so it survives body rewrites via the normal projection path (re-projected on every write), not
> the PSP subtraction. The contract therefore did not strictly need the D116 gate-lift; PSP
> remains valuable independently. The contract is self-enforcing on every durable write including
> rewrites: drop the `rationale:` field on a rewrite and the floor 422s it.

### 4. Shape insertion point — the 7 per-type durable shapes

The floor loads **only** the shapes a container names in `ldp:constrainedBy`
(D108 §1.5: "container = the shape SET, class = dispatch within it"). The durable concepts/
container names `concept.shacl.ttl` + `source.shacl.ttl` — **not** `ThingShape`. Putting
`mem:rationale` on `ThingShape` would not enforce (its "inherits from ThingShape" comment is
documentary, not mechanical).

So `mem:rationale` goes on the **per-type durable shapes**:
`concept`, `person`, `place`, `event`, `organization`, `howto`, `source`. This is also exactly
the Turtle-lane precedent (contact-card, organization-card, group, membership each carry their own
`mem:rationale`) — per-type is the real pattern, not a compromise. Cost: one duplicated
`sh:property` block across 7 files, the same trade the shipped Turtle lane already accepted.

`working.shacl.ttl` is **not** touched (working/ is constrained only by it) → **D73 preserved**:
the drafting tier stays low-ceremony; the contract attaches at crystallization.

## Components / changes

| Unit | Change |
|---|---|
| `css/extensions/markdown-projection/src/frontmatterProjection.ts` | Add `rationale?: string` to the `Frontmatter` type + one mapping line in `projectFrontmatter`: `if (fm.rationale) out.push(quad(subj, namedNode(MEM + "rationale"), literal(fm.rationale)))`. `mem:` already in the CURIE prefix map; add the `MEM` namespace constant if not already present. Update the maps-sidecar / agreement test (`curiePrefixAgreement.test.ts` and any governed-key list) so `rationale` is a recognized governed key. |
| `overlays/wiki-memory/shapes/{concept,person,place,event,organization,howto,source}.shacl.ttl` | Add `sh:property [ sh:path mem:rationale ; sh:minCount 1 ; sh:datatype xsd:string ; sh:message "<laden>" ]` + a laden line in each `sh:agentInstruction`. Add the `@prefix mem:` declaration to the 5 files missing it (concept, person, place, organization, source; event + howto already declare it). |
| Durable seed `.md` frontmatter (6 seeds) | Add a real `rationale:` field to `concepts/{biology,photosynthesis,two-hierarchy-memory-addressing,how-identifiers-work,how-wiki-memory-works}` + `people/marie-curie` so the projected `.meta` satisfies the shape and `make reset` admission passes. `synthesis/index` is a derived view — exempt. |
| Crystallize affordance / template (`overlays/wiki-memory/affordances/crystallize.ttl`, any concept template) | Add a `rationale:` frontmatter slot to the destination-body composition step + procedure prose so agents produce it by default. |
| Admission floor (`ShapeValidationStore` / floor governed-set) | psp-1 fold-in: add `sub:projectorVersion` + `sub:bodyHash` to the floor's protected/governed predicate set so an agent N3 PATCH to `.meta` cannot mangle the substrate stamps. |
| Tests | New: durable write without a `rationale:` frontmatter field → laden 422; with → 201 + `mem:rationale` in `.meta`. Existing: `make reset` green; `make audit` 0 ERROR. |

## Data flow

1. Agent drafts in `/vault/wiki/working/{slug}.md` (permissive — no rationale required, D73).
2. Agent invokes crystallize: composes the destination markdown body with a `rationale:`
   frontmatter field (alongside `type:` etc.); single PUT of the body.
3. Floor projects the body (frontmatter → `mem:rationale` quad, spans → labels, wikilinks →
   edges), loads the destination container's named shapes (per-type durable shape), dispatches by
   `rdf:type`, validates the projected `.meta`. Missing/empty `rationale:` → no `mem:rationale`
   quad → 422 with the laden `sh:message`; the laden `sh:agentInstruction` was already readable
   pre-write.
4. On 201, agent DELETEs the working source and POSTs the crystallize Activity to `.operations/`
   with `as:object → durable-resource` (link-only; no rationale copy).
5. Auditor reading the resource later gets `mem:rationale` in the same `.meta` fetch (E5
   disposition). Curator walking `.operations/` follows `as:object` to the resource for the why.
6. A later body rewrite re-projects the frontmatter; dropping `rationale:` on a rewrite re-fails
   the floor (self-enforcing). Agent `.meta` enrichment beyond projection survives via PSP
   subtraction (D116), independently of this contract.

## Error handling

- **Missing rationale:** laden 422 (`sh:ValidationReport`), source not deleted, agent retries.
  Mirrors the crystallize affordance `wiki:errorMode`.
- **Restating the name as rationale:** the threat model is cooperative-but-lazy (per the
  progressive-disclosure spec §6.1). The laden `sh:message` names the anti-pattern ("Do not merely
  restate the record's name; a future agent audits this context before trusting it"). Anti-boilerplate
  SHACL stays shallow — non-emptiness + datatype only. No semantic-quality gate.
- **Stamp tampering (psp-1):** with the floor governed-set widened, an N3 PATCH touching
  `sub:projectorVersion`/`sub:bodyHash` is rejected; substrate stamps stay substrate-internal.

## Testing

- Integration (Pod-up, `make reset`): crystallize a concept without rationale → 422; with → 201,
  assert `mem:rationale` present in the destination `.meta`; assert the working source is deleted
  and the `.operations/` Activity links via `as:object`.
- Per-type coverage: at least one positive + one negative across `concept` and one of
  person/place/event/organization/howto/source (the others share the identical block).
- Regression: `make reset` reproduces a green Pod (all 6 seeds admit); `make audit` 0 ERROR.
- psp-1: a PATCH attempting to overwrite `sub:projectorVersion` is rejected.

## Out of scope (YAGNI)

- Frozen-snapshot of rationale into the operations log (deferred refinement, §2).
- `prov:agent` / authenticated-WebID derivation — gated on the security profile (FOLLOWUPS (b)).
- A prose-body (rendered) authoring surface for rationale — rejected; rationale lives in the
  frontmatter metadata header, not the prose (§3).
- A shared-parent (`ThingShape`) DRY refactor — would require re-wiring all 7 durable containers'
  `constrainedBy` and changing the shape-set semantics; not worth the risk for a one-block dup.
- Re-rationale-on-edit as a *distinct* requirement: the field is required on every durable write
  (including rewrites — self-enforcing via projection), but we do not force a *fresh/different*
  rationale per edit; restating the same one passes.

## Open questions

None blocking. If implementation finds `ThingShape` *is* reliably applied to durable writes
(i.e., the floor loads the full catalog and `targetClass`-dispatches rather than loading only the
named set), revisit the single-property DRY option at plan time — but the per-type approach is
guaranteed-correct and precedent-matching regardless.
