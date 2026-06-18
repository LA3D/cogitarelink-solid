# AddressBook Write-Contract De-conflation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `mem:rationale` memory write-contract from the AddressBook (a traditional linked-data application), so it is governed by vcard domain shapes only — correcting the SP2/D117 conflation that imposed memory-substrate semantics on operational data.

**Architecture:** AddressBook is the *operational* substrate (vcard cards for the agent tool-calling loop), not memory. `mem:rationale` is a memory-substrate invariant and belongs only on the memory dimensions (per the 2026-06-18 memory-systems architecture spec). This plan strips the required `mem:rationale` `sh:property` from the four addressbook shapes, the four templates, and the one seed; stops the constraint-derivation from injecting the substrate write contract into `/vault/contacts/`; flips the live contract tests; and corrects the docs (D117, the reconciliation spec, FOLLOWUPS). Scope is **de-conflation only** — the addressbook ShapeTree↔layout reshape is a separate follow-on plan.

**Tech Stack:** SHACL Turtle shapes + pyshacl (offline shape tests), Python/rdflib (`scripts/overlay/derive_constraints.py`), httpx + pytest (live Pod tests), Docker (`make reset`/`make verify`).

**Spec:** `docs/superpowers/specs/2026-06-18-pod-memory-systems-architecture-design.md` (piece 1)

## Global Constraints

- Pod calls: prefix pytest with `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem`. Run from repo root.
- Run Python as a module: `~/uvws/.venv/bin/python -m scripts.<mod>` / `-m pytest`.
- After Turtle/shape/seed changes that must reach the live Pod: `make reset && make verify` (expect 0 ERROR / 1 intentional D98 WARN).
- `mem:rationale` IRI = `https://pod.vardeman.me/vault/ontology/mem#rationale`. Standard `prov:` provenance (L1) is NOT removed and is unaffected — only the `mem:rationale` memory contract is.
- **Out of scope (do NOT touch):** id-schemes' write contract (`scheme-record.shacl.ttl`, its templates/seeds) — its operational-vs-memory classification is a separate decision; leave it requiring `mem:rationale`. The addressbook ShapeTree (`addressbook.tree.ttl`) layout reshape — separate plan.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `overlays/addressbook/shapes/{contact-card,organization-card,group,membership}.shacl.ttl` | vcard domain shapes | remove the `sh:path mem:rationale` property block + the "Every write carries mem:rationale" prose from `sh:agentInstruction`; drop the now-unused `@prefix mem:` |
| `overlays/addressbook/templates/{contact,org,group,membership}-create.ttl` | front-loaded RDF skeletons | remove the `mem:rationale "<<RATIONALE>>"` line + the prose mention + `@prefix mem:` |
| `overlays/addressbook/containers/marie-curie.ttl` | seed contact | remove the `mem:rationale` triple |
| `overlays/addressbook/capabilities/vcard-individual-substrate.ttl` | capability doc | remove the `mem:rationale`-requirement prose |
| `scripts/overlay/derive_constraints.py` | constraint derivation | stop injecting `WRITE_CONTRACT_SHAPE` for the addressbook overlay |
| `tests/test_addressbook_no_memory_contract.py` (new) | guard: no addressbook shape requires `mem:rationale` | create |
| `tests/test_write_contract_turtle.py` | live contract test | flip the contacts assertions (bare card → 201); leave id-schemes assertions |
| `tests/test_constraints_derivation.py` | derivation agreement | drop contacts from the contract-injection assertion |
| `tests/test_addressbook_shapes.py`, `tests/integration/test_addressbook_e2e.py` | shape/e2e tests | drop `mem:rationale` from any bodies they write/assert |
| `.claude/skills/decision-lookup/decisions.md`, `docs/superpowers/specs/2026-06-17-shape-governance-reconciliation-design.md`, `FOLLOWUPS.md` | docs | correct the "uniform contract across all lanes" framing |

---

## Task 1: Strip the `mem:rationale` requirement from the four vcard shapes

**Files:**
- Modify: `overlays/addressbook/shapes/contact-card.shacl.ttl`, `organization-card.shacl.ttl`, `group.shacl.ttl`, `membership.shacl.ttl`
- Test: `tests/test_addressbook_no_memory_contract.py` (new)

**Interfaces:**
- Produces: the four addressbook shapes no longer declare `sh:path mem:rationale` with `sh:minCount`. Later tasks (templates, derivation, live tests) depend on this.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_addressbook_no_memory_contract.py
"""AddressBook is a traditional LD app (operational substrate) — its vcard shapes
must NOT require the memory write-contract (mem:rationale). See the 2026-06-18
pod-memory-systems architecture spec."""
import glob
from rdflib import Graph, URIRef

SH_PATH = URIRef("http://www.w3.org/ns/shacl#path")
MEM_RATIONALE = URIRef("https://pod.vardeman.me/vault/ontology/mem#rationale")

def test_no_addressbook_shape_constrains_mem_rationale():
    offenders = []
    for f in glob.glob("overlays/addressbook/shapes/*.shacl.ttl"):
        g = Graph(); g.parse(f, format="turtle")
        if (None, SH_PATH, MEM_RATIONALE) in g:
            offenders.append(f)
    assert offenders == [], f"mem:rationale still required by vcard shapes: {offenders}"

def test_addressbook_shapes_still_parse_and_target_vcard():
    # de-conflation must not break the vcard contracts the shapes still enforce
    g = Graph(); g.parse("overlays/addressbook/shapes/contact-card.shacl.ttl", format="turtle")
    SH_TC = URIRef("http://www.w3.org/ns/shacl#targetClass")
    VCARD_IND = URIRef("http://www.w3.org/2006/vcard/ns#Individual")
    assert (None, SH_TC, VCARD_IND) in g
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_addressbook_no_memory_contract.py -v`
Expected: `test_no_addressbook_shape_constrains_mem_rationale` FAILS (all four shapes still carry the property).

- [ ] **Step 3: Remove the property block + prose from each shape**

In **each** of the four shapes, delete the entire `mem:rationale` property block:

```turtle
    sh:property [
        sh:path mem:rationale ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "mem:rationale is required — record the task that triggered this write, what you concluded, and why, including what you consulted. Do not merely restate the record's name; a future agent audits this context before trusting it." ;
    ] ;
```

(In `contact-card.shacl.ttl` this block is preceded by a `# SP2 §6 agentic write contract ...` comment — delete that comment too.)

Then, in each shape's `sh:agentInstruction`, delete the sentence:

```
      Every write carries mem:rationale: the task that triggered it, what was
      concluded, and why — your write-context is unrecoverable after this session.
```

(wording varies slightly per file — `organization-card` line ~16/19, `group` line ~13/16, `membership` line ~15/17 also mention `mem:rationale` in their guidance prose; remove the `mem:rationale` mention, keep the vcard guidance). Finally delete the now-unused `@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .` line from each file.

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_addressbook_no_memory_contract.py -v`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/shapes/ tests/test_addressbook_no_memory_contract.py
git commit -m "refactor: strip mem:rationale from vcard shapes (addressbook is operational LD, not memory)"
```

---

## Task 2: Strip `mem:rationale` from the templates, the seed, and the capability prose

**Files:**
- Modify: `overlays/addressbook/templates/{contact,org,group,membership}-create.ttl`
- Modify: `overlays/addressbook/containers/marie-curie.ttl`
- Modify: `overlays/addressbook/capabilities/vcard-individual-substrate.ttl`
- Test: `tests/test_addressbook_templates.py` (existing — the template↔shape agreement test)

**Interfaces:**
- Consumes: Task 1's shapes (no `mem:rationale` requirement).
- Produces: templates/seeds that carry no `mem:rationale`. The template-substituted-body must still conform to the (now vcard-only) shape.

- [ ] **Step 1: Confirm the agreement test is the guard**

`tests/test_addressbook_templates.py::test_template_substituted_body_conforms_to_shape` substitutes template placeholders and validates against the declared shape. After Task 1 the shape no longer requires `mem:rationale`, so a template WITHOUT it still conforms. Run it now to see the current (passing) baseline:

Run: `~/uvws/.venv/bin/python -m pytest tests/test_addressbook_templates.py -v`
Expected: PASS currently (template has rationale, shape required it). It must STILL pass after the edits below (template lacks rationale, shape no longer requires it).

- [ ] **Step 2: Remove `mem:rationale` from each template**

In each of `contact-create.ttl`, `org-create.ttl`, `group-create.ttl`, `membership-create.ttl`:
- delete the body line `mem:rationale "<<RATIONALE>>" ;` (it is the last property before the closing `.` in contact/org/group; in `membership-create.ttl` it is `mem:rationale "<<RATIONALE>>" .` — make the preceding triple's terminator the final `.`),
- delete the `mem:rationale`-related sentence in the leading `sh:agentInstruction`/comment prose,
- delete the `@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .` line.

- [ ] **Step 3: Remove `mem:rationale` from the seed + capability prose**

In `overlays/addressbook/containers/marie-curie.ttl`: delete the line
`mem:rationale "Seeded by the substrate bootstrap (pod_setup, SP2 2026-06): reference data deployed by the Pod owner, not an agent-session write." .`
(make the preceding triple end with `.`), and delete the `@prefix mem:` line.

In `overlays/addressbook/capabilities/vcard-individual-substrate.ttl`: remove the prose clause asserting `mem:rationale` is required on every write (keep the rest of the capability description).

- [ ] **Step 4: Verify templates parse + still conform**

Run:
```bash
~/uvws/.venv/bin/python -c "from rdflib import Graph; [Graph().parse(f, format='turtle') for f in __import__('glob').glob('overlays/addressbook/templates/*.ttl')]; print('templates parse')"
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_templates.py -v
```
Expected: "templates parse" + PASS (substituted bodies without `mem:rationale` conform to the vcard-only shapes).

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/templates/ overlays/addressbook/containers/marie-curie.ttl overlays/addressbook/capabilities/vcard-individual-substrate.ttl
git commit -m "refactor: drop mem:rationale from addressbook templates + seed + capability prose"
```

---

## Task 3: Stop the constraint-derivation injecting the write contract into `/vault/contacts/`

**Files:**
- Modify: `scripts/overlay/derive_constraints.py`
- Test: `tests/test_constraints_derivation.py`

**Interfaces:**
- Consumes: `derive_constrainedby(overlay_dir: str, container_url: str) -> set[str]` and the constant `WRITE_CONTRACT_SHAPE`.
- Produces: `derive_constrainedby("overlays/addressbook", "https://pod.vardeman.me/vault/contacts/")` no longer contains `WRITE_CONTRACT_SHAPE`. The wiki and id-schemes lanes are unchanged.

- [ ] **Step 1: Write the failing test**

Replace the body of `test_contract_injected_for_rdf_native_lanes` in `tests/test_constraints_derivation.py` and add the addressbook-exclusion assertion:

```python
def test_contract_injected_for_id_schemes_lane():
    # id-schemes keeps the contract (its operational-vs-memory classification is a
    # separate decision — 2026-06-18 memory-systems spec, open questions).
    got = derive_constrainedby("overlays/identifier-schemes", "https://pod.vardeman.me/id/schemes/")
    assert WRITE_CONTRACT_SHAPE in got

def test_contract_NOT_injected_for_addressbook():
    # AddressBook is operational LD, not memory — no memory write contract.
    got = derive_constrainedby("overlays/addressbook", "https://pod.vardeman.me/vault/contacts/")
    assert WRITE_CONTRACT_SHAPE not in got
    # but the vcard shapes are still derived
    assert any(s.endswith("contact-card.shacl.ttl") for s in got)
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_constraints_derivation.py::test_contract_NOT_injected_for_addressbook -v`
Expected: FAIL (`WRITE_CONTRACT_SHAPE` is currently injected unconditionally).

- [ ] **Step 3: Make the injection conditional on the overlay**

In `scripts/overlay/derive_constraints.py`, find where `derive_constrainedby` adds the contract (the `return mapped | {WRITE_CONTRACT_SHAPE}` / union step). Add a module constant and gate it:

```python
# Overlays whose writes carry the memory write contract (mem:rationale). AddressBook
# is operational LD (vcard) — excluded. id-schemes pending its classification
# (2026-06-18 memory-systems spec). Wiki = the memory lane.
CONTRACT_BEARING = {"overlays/wiki-memory", "overlays/identifier-schemes"}
```

and change the union to:

```python
    if overlay_dir in CONTRACT_BEARING:
        mapped = mapped | {WRITE_CONTRACT_SHAPE}
    return mapped
```

(adjust to the exact variable name in the file — the set being returned).

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_constraints_derivation.py -v`
Expected: PASS (all derivation tests, including the wiki agreement test, still green — wiki is in `CONTRACT_BEARING`).

- [ ] **Step 5: Commit**

```bash
git add scripts/overlay/derive_constraints.py tests/test_constraints_derivation.py
git commit -m "feat: derivation no longer injects write contract into the addressbook (operational) lane"
```

---

## Task 4: Flip the live contract tests — a bare contact is now admitted

**Files:**
- Modify: `tests/test_write_contract_turtle.py`
- Modify: `tests/test_addressbook_shapes.py`, `tests/integration/test_addressbook_e2e.py` (only where they add/assert `mem:rationale` on contacts)
- Requires: a freshly reseeded Pod (Task 5 reseeds; run this after `make reset`).

**Interfaces:**
- Consumes: the de-conflated shapes (Tasks 1-2) deployed to the Pod.

- [ ] **Step 1: Flip the contacts assertions in `test_write_contract_turtle.py`**

The contacts tests currently assert a rationale-less card is 422. After de-conflation a bare card is admitted. Replace `test_rationale_less_contact_422_with_laden_message` and `test_rationale_less_org_422_with_laden_message` with:

```python
def test_bare_contact_admitted_no_memory_contract():
    # AddressBook is operational LD — a vcard card with no mem:rationale is valid.
    r = httpx.post(f"{POD}/vault/contacts/Person/", content=BARE_CARD,
                   headers={"Content-Type": "text/turtle", "Slug": "deconflate-card"}, verify=_CA)
    assert r.status_code == 201, f"got {r.status_code}: {r.text[:300]}"
    httpx.delete(r.headers.get("location", f"{POD}/vault/contacts/Person/deconflate-card"), verify=_CA)

def test_bare_org_admitted_no_memory_contract():
    r = httpx.post(f"{POD}/vault/contacts/Organization/", content=BARE_ORG,
                   headers={"Content-Type": "text/turtle", "Slug": "deconflate-org"}, verify=_CA)
    assert r.status_code == 201, f"got {r.status_code}: {r.text[:300]}"
    httpx.delete(r.headers.get("location", f"{POD}/vault/contacts/Organization/deconflate-org"), verify=_CA)
```

Keep `test_contact_with_rationale_201` only if you also drop the `mem:rationale` triple from its body (a contact MAY still carry agent-added triples since shapes are `sh:closed false`); simplest is to delete `test_contact_with_rationale_201` (superseded by `test_bare_contact_admitted_no_memory_contract`). Leave any id-schemes assertions in the file untouched.

- [ ] **Step 2: Grep the other two test files for contacts `mem:rationale` and remove it**

Run: `grep -n "mem.rationale\|rationale" tests/test_addressbook_shapes.py tests/integration/test_addressbook_e2e.py`
For each hit that adds `mem:rationale` to a contact body or asserts it is required, delete that line/assertion (the bodies still need `vcard:fn` + `vcard:inAddressBook` + an anchor). Do not change anything else.

- [ ] **Step 3: (run after Task 5's reseed) verify live**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_write_contract_turtle.py tests/test_addressbook_shapes.py tests/integration/test_addressbook_e2e.py -v`
Expected: PASS (bare card/org → 201).

- [ ] **Step 4: Commit**

```bash
git add tests/test_write_contract_turtle.py tests/test_addressbook_shapes.py tests/integration/test_addressbook_e2e.py
git commit -m "test: bare contact/org admitted after write-contract de-conflation"
```

---

## Task 5: Reseed + correct the docs

**Files:**
- Modify: `.claude/skills/decision-lookup/decisions.md` (D117), `docs/superpowers/specs/2026-06-17-shape-governance-reconciliation-design.md`, `FOLLOWUPS.md`

- [ ] **Step 1: Reseed the Pod with the de-conflated overlay**

Run: `make reset && make verify`
Expected: seed completes; `make verify` audit 0 ERROR / 1 intentional D98 WARN (the marie-curie seed admits with no `mem:rationale`).

- [ ] **Step 2: Run the live tests (Task 4 Step 3) and the offline guards**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_no_memory_contract.py tests/test_addressbook_templates.py tests/test_constraints_derivation.py -v
SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_write_contract_turtle.py tests/integration/test_addressbook_e2e.py -v
```
Expected: all PASS.

- [ ] **Step 3: Correct the docs**

- In `decisions.md` D117: amend the "NOT done / NOT unified (Tasks 7/9)" paragraph to record that the addressbook lane is now **de-conflated** (vcard-only, no memory contract) per the 2026-06-18 memory-systems architecture spec, and that the "uniform write contract across all three lanes" goal is **superseded** — the contract is a memory-substrate invariant, not Pod-wide. Reference `docs/superpowers/specs/2026-06-18-pod-memory-systems-architecture-design.md`.
- In the shape-governance reconciliation spec's status line: note the addressbook de-conflation supersedes its Task 7/9 "remove per-app duplication so the injected shape supplies it" framing (the contract is removed from addressbook, not unified).
- In `FOLLOWUPS.md` 🔵 entry: record that addressbook is de-conflated; the remaining RDF-native item is the ShapeTree↔layout reshape (vcard-domain) + the id-schemes classification.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/decision-lookup/decisions.md docs/superpowers/specs/2026-06-17-shape-governance-reconciliation-design.md FOLLOWUPS.md
git commit -m "docs: record addressbook write-contract de-conflation; correct uniform-contract framing"
```

---

## Task 6: Full regression

- [ ] **Step 1:** `make reset && make verify` — seed completes, audit 0 ERROR / 1 intentional D98 WARN.
- [ ] **Step 2:** `make test-js` — TS guard suites green (unchanged by this plan, but confirm no incidental breakage).
- [ ] **Step 3:** `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/ -q` — full suite green (known `test_timemap_returns_parseable_turtle` flake passes in isolation). Triage any contact/addressbook-related failure as an expectation-update from the de-conflation, not a regression.
- [ ] **Step 4: Commit** any residual test-expectation updates surfaced in Step 3.

---

## Follow-on (separate plan, not this one)

- **AddressBook ShapeTree↔layout reshape:** reshape `addressbook.tree.ttl` to model the deployed subcontainer layout (`contacts/{Person,Organization,Group,Membership}/`) with per-class container trees + the missing Group/Membership resource trees, then extend `derive_constraints.py` to write the addressbook container `.meta` and add a floor↔tree parity test (like `test_floor_parity`). Pure vcard-domain interop accuracy; touches the registry/managers + `test_interop_foundation`.
- **id-schemes classification** (operational reference vs memory) — its own decision; gates whether its `mem:rationale` stays.

---

## Self-Review

**Spec coverage** (piece 1 of the memory-systems spec = "AddressBook de-conflation + vcard-domain ShapeTree fix"):
- De-conflate addressbook (strip `mem:rationale`, vcard-only) → Tasks 1 (shapes), 2 (templates/seed/capability), 3 (derivation), 4 (live tests). ✓
- Do not inject `sub:WriteContractShape` into `/vault/contacts/` → Task 3. ✓
- Correct the D117 "uniform contract" framing → Task 5. ✓
- The vcard-domain ShapeTree↔layout fix → **explicitly deferred** to a follow-on plan (scope-check split; recorded under "Follow-on"). ✓
- id-schemes left untouched (separate decision) → Global Constraints + Task 3 keeps it contract-bearing. ✓

**Placeholder scan:** Task 1/2 edits reference exact blocks (the `mem:rationale sh:property` block is quoted verbatim; prose sentence quoted). Task 3 gives the exact constant + gating code. No "TBD"/"handle edge cases"/"add validation". The per-file prose-line variation in Task 1 Step 3 is named by file+approx line, with the rule (remove the `mem:rationale` mention, keep vcard guidance) explicit — an authoring action, not a gap.

**Type consistency:** `derive_constrainedby(overlay_dir, container_url) -> set[str]`, `WRITE_CONTRACT_SHAPE`, `CONTRACT_BEARING` consistent across Task 3. `MEM_RATIONALE`/`SH_PATH` IRIs consistent in Task 1's test. `BARE_CARD`/`BARE_ORG` reused from the existing `test_write_contract_turtle.py` in Task 4.

**Ordering:** Tasks 1-3 are offline (no Pod) and can run in any order; Task 4's live assertions require the reseed in Task 5 Step 1, so Task 4 Step 3 is explicitly gated "run after Task 5's reseed." Task 6 is the final whole-suite gate.
