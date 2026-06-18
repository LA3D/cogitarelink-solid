# Task 11 probe — the multiple-`st:shape` wiki write gate

**Date:** 2026-06-18
**Rig:** `evals/write-contract/` · **Model:** Haiku (mechanism-validation) · **n=2** · **Cost:** $0.32
**Spec:** `docs/superpowers/specs/2026-06-17-shape-governance-reconciliation-design.md` (the "Open
questions" item — the one mechanism not covered by prior probes).

## Question

The reconciliation gives each wiki ResourceTree multiple `st:shape` values; the derivation unions
them — `PageShape` (`<>`), `ThingShape` (`<#this>`), leaf `ConceptShape`, plus the injected
`sub:WriteContractShape` (`mem:rationale` on `<>`) — into the container's `ldp:constrainedBy`. So
one durable `/vault/wiki/concepts/` write is gated by four shapes at once, dispatched by
`sh:targetClass` in a single floor pass. **Does that union present a coherent, satisfiable
contract to a cold agent, or does satisfying one shape just surface the next in a 422 loop?**

## Result — union VALIDATED (both runs PASS first try)

| Run | Concept | Write path | 422s from the union | Verdict |
|---|---|---|---|---|
| run1 | Artificial Intelligence | POST → **201** | 0 | PASS (first try) |
| run2 | Merkle Tree | POST → 404 (routing), PUT → **201** | 0 | PASS (first try) |

Raw-audited against `trajectory.jsonl` + the container listing (not the agents' narration); both
agents' self-reports matched ground truth. `merkle-tree.md.meta` carries `mem:rationale` on `<>`
(the cross-lane `foaf:Document` unification holds); the 201 is itself the floor's conformance
proof against the full unioned shape set.

Neither cold agent hit a single 422 from the shape union. Both **front-loaded discovery**: they
read the shape files directly (`concept` + `page` + `thing` + `write-contract`, each carrying
`sh:agentInstruction`) plus an existing exemplar (`photosynthesis.md`), reasoned about the union
explicitly — run2: *"page has dct:title and schema:mainEntity; Thing has skos:prefLabel via
{.prefLabel} syntax; Document has mem:rationale"* — and composed one conforming write
(`type: Concept` + `rationale:` frontmatter + the `[text]{.prefLabel}` body literal axis). The
union read as one coherent contract assembled from co-located, self-describing shapes, not a
sequence of surprises.

## What this does and does not establish

- **Does:** the multiple-`st:shape` union is satisfiable and coherent for a cold agent. The
  spec's default — keep multiple `st:shape` values unioned by the derivation — stands; no need to
  surface a composed single-`st:shape` shape. The shapes' `sh:agentInstruction` is discoverable
  enough that a capable-but-cold agent pre-satisfies the whole gate.
- **Does not:** exercise the laden-422 *convergence* path. Both agents satisfied the gate before
  submitting, so the "a 422 teaches, the agent fixes, re-submits" loop was never entered here.
  That path is covered indirectly by the e2e fixture tests (`test_write_contract_e2e`,
  `test_admission_floor_integration`), which assert the 422 bodies carry the laden messages. A
  future arm could force the 422 path by withholding the shapes from discovery (e.g. a no-read-
  shapes constraint), but that tests teaching, not the union question this probe targeted.

## Notes

- **run2 POST→404→PUT:** the agent's first attempt POSTed to the container and got 404 (a
  container POST routing/method artifact), then switched to PUT-with-slug → 201. Not a shape
  rejection; a tooling/method note, not a mechanism fault.
- **Discovery leaned on shape-reading + exemplars, not 422-teaching.** Consistent with the
  2026-06-07 RQ-View-2 write-side finding (cold agents authored full-grammar markdown first-try).
  The reconciliation's added `mem:rationale` requirement did not break that: both agents found the
  `rationale:` slot from `write-contract.shacl.ttl` and supplied it in the same first write.

## Verdict

Spec open question **closed**: multiple `st:shape` unioned by the derivation. Task 11 done. The
reconciliation's last unverified mechanism is validated on the live Pod by cold agents.
