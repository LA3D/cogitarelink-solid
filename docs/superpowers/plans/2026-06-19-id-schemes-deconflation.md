# id-schemes Write-Contract De-conflation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify the identifier-scheme RECORDS as operational reference data and remove the `mem:rationale` memory write-contract from scheme registration (lane A), while keeping the D112 curation-proposal contract (lane B) intact.

**Architecture:** `/id/schemes/<key>` records are a PID lookup table consulted in the agent's tool-calling loop (resolve an identifier via its `idot:urlPattern`) — operational reference data, structurally parallel to the vCard addressbook (de-conflated 2026-06-18). `mem:rationale` is a memory-substrate invariant and does not belong on operational reference writes. **Two `mem:rationale` lanes exist in this overlay and only lane A is touched:** lane A = `scheme-record.shacl.ttl` (every scheme registration) — REMOVED here; lane B = `curation-proposal.shacl.ttl` enforcing `mem:RealignAction` proposals on `/id/.operations/` (the D112 memory/curation loop, realignment-with-evidence) — KEPT. The two are independently enforced: lane A via `scheme-record.shacl.ttl` (the `/id/schemes/.meta` `ldp:constrainedBy` points only there), lane B via `curation-proposal.shacl.ttl` on the `.operations/` container `.meta`. Removing `overlays/identifier-schemes` from `CONTRACT_BEARING` affects only `derive_constrainedby`'s return for `/id/schemes/`; it does NOT touch lane B.

**Tech Stack:** SHACL Turtle + pyshacl (offline), Python/rdflib (`derive_constraints.py`), httpx + pytest (live Pod), Docker (`make reset`/`make verify`).

**Spec:** `docs/superpowers/specs/2026-06-18-pod-memory-systems-architecture-design.md` (resolves its open question #3: id-schemes = operational, drop the contract). No separate spec doc — same pattern as the addressbook de-conflation (`docs/superpowers/plans/2026-06-18-addressbook-write-contract-deconflation.md`).

## Global Constraints

- Run Python as a module from repo root: `~/uvws/.venv/bin/python -m pytest …` / `-m scripts.overlay.derive_constraints`.
- Live Pod calls: prefix with `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem`.
- After Turtle/shape/seed changes that must reach the live Pod: `make reset && make verify` (expect **0 ERROR / 1 intentional D98 WARN**).
- `mem:rationale` IRI = `https://pod.vardeman.me/vault/ontology/mem#rationale`. Standard `prov:` provenance (L1) and `skos:note` caveats are NOT removed — only the `mem:rationale` memory contract on scheme records.
- **DO NOT TOUCH (lane B + adjacent):** `overlays/identifier-schemes/shapes/curation-proposal.shacl.ttl`, `overlays/identifier-schemes/containers/id/.operations/.meta`, and the tests `tests/test_id_operations_floor.py`, `tests/test_curation_proposal_shape.py`, `tests/test_curation_protocol_e2e.py` — these enforce/verify the curation lane (`mem:RealignAction` with HTTP evidence), which STAYS. `test_id_operations_floor.py::test_rationale_missing_422` must remain PASSING.
- No tree reshape: `id-schemes.tree.ttl` already matches its flat `/id/schemes/<key>` layout. Do not edit it.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `overlays/identifier-schemes/shapes/scheme-record.shacl.ttl` | lane-A domain+contract shape | remove the `mem:rationale` `sh:property` block, the agentInstruction `mem:rationale` example line + "Every write carries mem:rationale…" sentence, the unused `@prefix mem:` |
| `overlays/identifier-schemes/schemes/{doi,orcid,ror,arxiv,citekey,did,did-oyd,solid-resource}.ttl` | 8 seed scheme records | remove the `mem:rationale` triple + `@prefix mem:` from each |
| `scripts/overlay/derive_constraints.py` | constraint derivation | remove `overlays/identifier-schemes` from `CONTRACT_BEARING` |
| `tests/test_scheme_record_shape.py` | offline lane-A shape test | flip `test_missing_rationale_fails` → bare record admitted; drop rationale from the conformance fixture |
| `tests/test_constraints_derivation.py` | derivation agreement | flip `test_contract_injected_for_id_schemes_lane` → NOT injected |
| `tests/test_id_schemes_integration.py` | live registration e2e | drop `mem:rationale` from the registration body (still 201) |
| `tests/test_write_contract_turtle.py` | live contract test | flip the id-schemes assertions (bare scheme record → 201) |
| `tests/test_sp2_surfacing.py`, `tests/test_view_layer_integration.py` | may write scheme bodies w/ rationale | drop rationale where they register a scheme (grep-driven) |
| docs: `…/2026-06-18-pod-memory-systems-architecture-design.md`, `FOLLOWUPS.md`, `.claude/skills/decision-lookup/decisions.md` | record the classification | resolve open-Q #3; mark FOLLOWUPS 🔵 (b) done; D111/D117 addendum |

---

## Task 1: Strip the `mem:rationale` contract from `scheme-record.shacl.ttl`

**Files:**
- Modify: `overlays/identifier-schemes/shapes/scheme-record.shacl.ttl`
- Test: `tests/test_scheme_record_shape.py`

**Interfaces:**
- Produces: `scheme-record.shacl.ttl` no longer declares `sh:path mem:rationale`. The idot:/skos:/`foaf:primaryTopic`/`dct:title` requirements remain (the domain shape).

- [ ] **Step 1: Flip the offline shape test**

In `tests/test_scheme_record_shape.py`, the conformance fixture currently includes a `mem:rationale` line (line ~20) and `test_missing_rationale_fails` asserts a body without it FAILS. After de-conflation a bare record (no rationale) conforms. Edit:
- Remove the `mem:rationale "Fixture: …" ;` line from the conformance fixture body (the base `_BODY`/fixture string).
- Replace `test_missing_rationale_fails` with:

```python
def test_bare_record_admitted_no_memory_contract():
    # id-schemes records are operational reference data — a scheme record without
    # mem:rationale conforms to the (vcard-equivalent) domain shape. 2026-06-18
    # memory-systems architecture spec, open-Q #3 resolved: id-schemes = operational.
    from pyshacl import validate
    g = Graph(); g.parse(data=_BODY, format="turtle")  # _BODY no longer carries mem:rationale
    conforms, _, _ = validate(g, shacl_graph=_SHAPES, inference="none")
    assert conforms, "a bare scheme record (no mem:rationale) must conform after de-conflation"
```

(Match the file's existing helper names — `_BODY`, `_SHAPES`, and its validate-call idiom; the snippet above is the shape, adapt identifiers to the file.)

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_scheme_record_shape.py -v`
Expected: the new `test_bare_record_admitted_no_memory_contract` FAILS (the shape still requires `mem:rationale`).

- [ ] **Step 3: Remove the `mem:rationale` property block + prose + prefix**

In `overlays/identifier-schemes/shapes/scheme-record.shacl.ttl`:
1. Delete the property block (the comment line above it about `sh:message only fires on violation` belongs to this block — leave that comment only if it still reads correctly for the following `foaf:primaryTopic` block; otherwise delete the `mem:rationale`-specific part):

```turtle
    sh:property [
        sh:path mem:rationale ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "mem:rationale is required — record the task that triggered this write, what you concluded, and why, including what you consulted. Do not merely restate the record's name; a future agent audits this context before trusting it." ;
    ] ;
```

2. In the `sh:agentInstruction` string: delete the example line `      mem:rationale "<why this scheme is being registered, triggered by what task>" ;` and the sentence `Every write carries mem:rationale: the task that triggered it, what was concluded, and why — your write-context is unrecoverable after this session.` (keep the rest of the instruction — the topic-node/fragment-IRI/idot/provider guidance).
3. Delete the now-unused `@prefix mem:   <https://pod.vardeman.me/vault/ontology/mem#> .` line.

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_scheme_record_shape.py -v`
Expected: PASS (bare record conforms; the shape still parses and targets `foaf:Document`).

- [ ] **Step 5: Commit**

```bash
git add overlays/identifier-schemes/shapes/scheme-record.shacl.ttl tests/test_scheme_record_shape.py
git commit -m "refactor: strip mem:rationale from scheme-record shape (id-schemes records are operational reference data)"
```

---

## Task 2: Drop `mem:rationale` from the 8 seed scheme records

**Files:**
- Modify: `overlays/identifier-schemes/schemes/{doi,orcid,ror,arxiv,citekey,did,did-oyd,solid-resource}.ttl`

**Interfaces:**
- Consumes: Task 1's shape (no `mem:rationale` requirement).
- Produces: seed records that carry no `mem:rationale`; each must still conform to the (idot/skos/foaf) domain shape.

- [ ] **Step 1: Remove the triple + prefix from each seed**

Each of the 8 files carries one line `   mem:rationale "Seeded by the substrate bootstrap (pod_setup, SP2 2026-06): reference data deployed by the Pod owner, not an agent-session write." ;` and a `@prefix mem:` line. In each file: delete the `mem:rationale` line (ensure the preceding triple keeps a valid terminator — if `mem:rationale` was the last property before `.`, the preceding line's `;` becomes `.`), and delete the `@prefix mem:` line.

- [ ] **Step 2: Verify all seeds parse**

Run:
```bash
~/uvws/.venv/bin/python -c "from rdflib import Graph; import glob; [Graph().parse(f, format='turtle') for f in glob.glob('overlays/identifier-schemes/schemes/*.ttl')]; print('8 seeds parse')"
```
Expected: `8 seeds parse`.

- [ ] **Step 3: Commit**

```bash
git add overlays/identifier-schemes/schemes/
git commit -m "refactor: drop mem:rationale from the 8 seed scheme records"
```

---

## Task 3: Remove id-schemes from `CONTRACT_BEARING` + flip the derivation test

**Files:**
- Modify: `scripts/overlay/derive_constraints.py`
- Test: `tests/test_constraints_derivation.py`

**Interfaces:**
- Consumes: `derive_constrainedby(overlay_dir, container_url) -> set[str]`, `WRITE_CONTRACT_SHAPE`.
- Produces: `derive_constrainedby("overlays/identifier-schemes", "https://pod.vardeman.me/id/schemes/")` no longer contains `WRITE_CONTRACT_SHAPE` (only the scheme-record shape). Wiki lane unchanged.

- [ ] **Step 1: Flip the derivation test**

In `tests/test_constraints_derivation.py`, replace `test_contract_injected_for_id_schemes_lane` with:

```python
def test_contract_NOT_injected_for_id_schemes():
    # id-schemes records are operational reference data (2026-06-18 memory-systems
    # spec, open-Q #3 resolved) — no memory write contract, like addressbook.
    got = derive_constrainedby("overlays/identifier-schemes", "https://pod.vardeman.me/id/schemes/")
    assert WRITE_CONTRACT_SHAPE not in got
    assert any(s.endswith("scheme-record.shacl.ttl") for s in got)  # the domain shape stays
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_constraints_derivation.py::test_contract_NOT_injected_for_id_schemes -v`
Expected: FAIL (`WRITE_CONTRACT_SHAPE` is still injected — id-schemes is in `CONTRACT_BEARING`).

- [ ] **Step 3: Remove id-schemes from `CONTRACT_BEARING`**

In `scripts/overlay/derive_constraints.py`, change:

```python
CONTRACT_BEARING = {"overlays/wiki-memory", "overlays/identifier-schemes"}
```

to:

```python
# Overlays whose writes carry the memory write contract (mem:rationale). Wiki is the
# memory lane. AddressBook (vcard) and id-schemes (PID reference data) are operational
# LD — excluded (2026-06-18 memory-systems architecture spec: the contract is a
# memory-substrate invariant, not Pod-wide).
CONTRACT_BEARING = {"overlays/wiki-memory"}
```

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_constraints_derivation.py -v`
Expected: PASS (id-schemes no longer injected; the wiki agreement + addressbook tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add scripts/overlay/derive_constraints.py tests/test_constraints_derivation.py
git commit -m "feat: id-schemes excluded from CONTRACT_BEARING (operational reference lane)"
```

---

## Task 4: Flip the live lane-A tests; confirm lane B untouched

**Files:**
- Modify: `tests/test_id_schemes_integration.py`, `tests/test_write_contract_turtle.py`
- Possibly modify: `tests/test_sp2_surfacing.py`, `tests/test_view_layer_integration.py`
- Requires: a freshly reseeded Pod (run after Task 5 Step 1's `make reset`).

**Interfaces:**
- Consumes: the de-conflated shape (Tasks 1-2) deployed to the Pod.

- [ ] **Step 1: Drop `mem:rationale` from the registration bodies**

- `tests/test_id_schemes_integration.py` (line ~102-104): remove the `mem:rationale "Test write: …" ;` line (and the `# mem:rationale: SP2 §6 write contract …` comment) from the Turtle registration body; the registration must still return 201. Also the body-frontmatter at line ~148 (`rationale: "D111 span-axis projection test"`) — if it's a `mem:rationale` for a SCHEME record, drop it; if it belongs to a curation/operation body, leave it (check the surrounding test).
- `tests/test_write_contract_turtle.py`: it carries id-schemes assertions (the addressbook de-conflation "left id-schemes assertions"). Flip any `…_422`/rationale-required assertion for a SCHEME record to expect 201 for a bare record (model on the addressbook `test_bare_contact_admitted_no_memory_contract` already in that file). Leave any `.operations/` / curation assertions alone.

- [ ] **Step 2: Grep the two view/surfacing tests + fix scheme-record writes only**

Run: `grep -n "mem:rationale\|rationale" tests/test_sp2_surfacing.py tests/test_view_layer_integration.py`
For each hit that writes a SCHEME RECORD body (a `/id/schemes/<key>` PUT/POST), remove the `mem:rationale` line (the body still needs the idot/skos/foaf triples). Do NOT change any curation-proposal/`.operations/` body. If a hit is unrelated to id-schemes scheme records, leave it.

- [ ] **Step 3: Confirm lane B is untouched**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_id_operations_floor.py tests/test_curation_proposal_shape.py -v`
Expected: PASS unchanged — in particular `test_id_operations_floor.py::test_rationale_missing_422` STILL returns 422 (curation proposals still require `mem:rationale`). If either changed behavior, you touched lane B by mistake — revert that.

- [ ] **Step 4: (after Task 5 reseed) verify live**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_id_schemes_integration.py tests/test_write_contract_turtle.py tests/test_sp2_surfacing.py tests/test_view_layer_integration.py -v`
Expected: PASS (bare scheme record registers 201).

- [ ] **Step 5: Commit**

```bash
git add tests/test_id_schemes_integration.py tests/test_write_contract_turtle.py tests/test_sp2_surfacing.py tests/test_view_layer_integration.py
git commit -m "test: bare scheme record admitted after id-schemes de-conflation (lane B untouched)"
```

---

## Task 5: Reseed, docs, full regression

**Files:**
- Modify: `docs/superpowers/specs/2026-06-18-pod-memory-systems-architecture-design.md`, `FOLLOWUPS.md`, `.claude/skills/decision-lookup/decisions.md`

- [ ] **Step 1: Reseed**

Run: `make reset && make verify`
Expected: seed completes (the 8 schemes seed without `mem:rationale`); audit **0 ERROR / 1 intentional D98 WARN**. (Then run Task 4 Step 4's live tests.)

- [ ] **Step 2: Offline guards + full suite**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/test_scheme_record_shape.py tests/test_constraints_derivation.py tests/test_id_operations_floor.py -v
SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/ -q
make test-js
```
Expected: all PASS (the known `test_timemap_returns_parseable_turtle` flake passes in isolation if it trips; lane-B curation tests green).

- [ ] **Step 3: Docs**

- `docs/superpowers/specs/2026-06-18-pod-memory-systems-architecture-design.md` open questions: mark **id-schemes classification RESOLVED** — operational reference data; scheme records de-conflated (lane A), curation lane (B) kept.
- `FOLLOWUPS.md` 🔵 entry (b): mark id-schemes classification **DONE** (operational; lane-A contract removed, lane-B kept). Note the `evals/` D111 cold-probe planting scripts (`evals/d112/`, `evals/salience-*`, `evals/viewlayer/`, `evals/e2e-walk/`) still plant `mem:rationale` on scheme bodies — STALE research artifacts, refresh when those probes are next run (not CI-blocking).
- `.claude/skills/decision-lookup/decisions.md` (D111 and the D117 "Tasks 7/9" addendum): record id-schemes de-conflated; the contract is a memory-substrate invariant on the wiki lane only.

- [ ] **Step 4: Commit docs**

```bash
git add docs/superpowers/specs/2026-06-18-pod-memory-systems-architecture-design.md FOLLOWUPS.md .claude/skills/decision-lookup/decisions.md
git commit -m "docs: id-schemes classified operational; scheme-record contract de-conflated (memory-systems open-Q #3 resolved)"
```

- [ ] **Step 5: Adversarial cross-batch review**

Confirm as a set: no `mem:rationale` remains on any SCHEME RECORD path (`scheme-record.shacl.ttl`, the 8 seeds, the registration test bodies) — `git grep -n "mem:rationale" overlays/identifier-schemes/ | grep -v curation-proposal` should return nothing; and lane B is fully intact (`curation-proposal.shacl.ttl` unchanged, `test_id_operations_floor.py::test_rationale_missing_422` green). Confirm `derive_constrainedby` for `/id/schemes/` returns only the scheme-record shape.

---

## Self-Review

**Spec coverage** (memory-systems open-Q #3 = id-schemes operational, drop the contract):
- Strip lane-A contract from the shape → Task 1. ✓
- Strip from the 8 seeds → Task 2. ✓
- Exclude from `CONTRACT_BEARING` → Task 3. ✓
- Flip lane-A tests (offline + live) → Tasks 1, 3, 4. ✓
- Keep lane B (curation) → Global Constraints + Task 4 Step 3 (explicit untouched-verification). ✓
- Resolve docs → Task 5. ✓
- No tree reshape (flat layout already matches) → stated, not touched. ✓

**Placeholder scan:** Deletions are quoted verbatim (the `mem:rationale` block, the agentInstruction sentence, the seed line). Test flips give the exact new assertion. Task 4 Step 1/2 are grep-driven over named files with the explicit rule (scheme-record bodies only, never lane B) — an authoring action, not a gap. No "TBD"/"add validation".

**Type consistency:** `derive_constrainedby(overlay_dir, container_url) -> set[str]`, `WRITE_CONTRACT_SHAPE`, `CONTRACT_BEARING` consistent with the codebase (unchanged signatures; only `CONTRACT_BEARING`'s value shrinks). Lane-A/lane-B split named identically across Global Constraints and every task.

**Ordering:** Tasks 1-3 offline (any order); Task 4's live assertions gated on Task 5 Step 1 reseed (Task 4 Step 4 explicitly "after Task 5 reseed"); Task 5 Step 2 is the whole-suite gate.
