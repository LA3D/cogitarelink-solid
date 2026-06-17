# Markdown-lane Write Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require `mem:rationale` on every durable wiki note (concept/person/place/event/organization/howto/source), authored as a projected frontmatter field and enforced by the SHACL admission floor — the markdown-lane analogue of the shipped Turtle-lane contract.

**Architecture:** A new governed frontmatter key `rationale:` projects to a `mem:rationale` literal on the page's `<#this>` subject (via `frontmatterProjection.ts`). The 7 per-type durable SHACL shapes require `mem:rationale` (minCount 1) with a laden message. The in-band floor enforces it on every durable write; `working/` stays permissive (D73). Rationale is canonical on the resource `.meta`; the `.operations/` crystallize Activity reaches it by its existing `as:object` link (no copy). Folds in psp-1 (protect the substrate stamp predicates from agent PATCH).

**Tech Stack:** CSS v8 extension (TypeScript, vitest), SHACL Turtle shapes, Python/httpx integration tests (pytest), Docker (`make reset`/`make rebuild`/`make verify`).

**Spec:** `docs/superpowers/specs/2026-06-17-markdown-lane-write-contract-design.md`

**Conventions for every integration step:**
- Pod calls need TLS CA: prefix pytest with `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem`.
- After any change to TS (`css/extensions/**`) **or** overlay shapes/seeds, the live Pod must be rebuilt to pick them up: `make rebuild && make verify` (rebuild image + recreate; verify waits for the async seed then runs audit). TS-only unit tests (vitest) do **not** need the Pod.
- `mem:` namespace IRI = `https://pod.vardeman.me/vault/ontology/mem#`; `mem:rationale` = `https://pod.vardeman.me/vault/ontology/mem#rationale`.

---

### Task 1: Project the `rationale:` frontmatter key to `mem:rationale`

**Files:**
- Modify: `css/extensions/markdown-projection/src/frontmatterProjection.ts`
- Test: `css/extensions/markdown-projection/test/frontmatterProjection.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `frontmatterProjection.test.ts` inside the `describe("projectFrontmatter", …)` block:

```typescript
it("projects rationale to a mem:rationale string literal", () => {
    const triples = projectFrontmatter({
        type: "concept",
        rationale: "Crystallized to document the two-hierarchy rule; concluded the axes are distinct.",
    });
    const r = triples.find(t => t.predicate.value === "https://pod.vardeman.me/vault/ontology/mem#rationale");
    expect(r).toBeDefined();
    expect(r?.object.termType).toBe("Literal");
    expect(r?.object.value).toBe("Crystallized to document the two-hierarchy rule; concluded the axes are distinct.");
    expect((r?.object as any).datatype.value).toBe("http://www.w3.org/2001/XMLSchema#string");
});

it("omits mem:rationale when rationale is absent", () => {
    const triples = projectFrontmatter({ type: "concept" });
    expect(triples.find(t => t.predicate.value.endsWith("mem#rationale"))).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd css/extensions/markdown-projection && npx vitest run test/frontmatterProjection.test.ts -t rationale`
Expected: FAIL — first test errors (`r` is undefined), because `rationale` is not yet projected.

- [ ] **Step 3: Add the `MEM` constant, the `Frontmatter` field, and the mapping line**

In `frontmatterProjection.ts`, beside the existing `const DCT = …` namespace constants (near line 163), add:

```typescript
const MEM = "https://pod.vardeman.me/vault/ontology/mem#";
```

In the `Frontmatter` interface (near line 172), add the field after `citekey?: string;`:

```typescript
    rationale?: string;
```

In `projectFrontmatter` (near line 184), add after the `aliases` block and before `return out;`:

```typescript
    // mem:rationale — the agentic-write-contract literal (markdown-lane). xsd:string
    // (n3 default for a plain literal). Required by the durable per-type shapes; the
    // floor 422s a durable write whose projection omits it. working/ is permissive.
    if (typeof fm.rationale === "string" && fm.rationale.trim() !== "") {
        out.push(quad(subj, namedNode(MEM + "rationale"), literal(fm.rationale)));
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd css/extensions/markdown-projection && npx vitest run test/frontmatterProjection.test.ts`
Expected: PASS (the two new tests plus all pre-existing ones).

- [ ] **Step 5: Run the prefix-agreement guard to confirm no regression**

Run: `cd css/extensions/markdown-projection && npx vitest run test/curiePrefixAgreement.test.ts`
Expected: PASS — `mem:` was already in the prefix map; adding a field does not change the prefix set.

- [ ] **Step 6: Commit**

```bash
git add css/extensions/markdown-projection/src/frontmatterProjection.ts css/extensions/markdown-projection/test/frontmatterProjection.test.ts
git commit -m "feat: project rationale: frontmatter key to mem:rationale (markdown-lane write contract)"
```

---

### Task 2: Backfill `rationale:` on the 6 durable seeds

These seeds are body-only PUTs at reset; once Task 4 requires `mem:rationale`, a seed without it fails admission. Add the field now (harmless before Task 4: nothing requires it yet) so `make reset` stays green across the activation step.

**Files (Modify, frontmatter only):**
- `overlays/wiki-memory/concepts/biology.md`
- `overlays/wiki-memory/concepts/photosynthesis.md`
- `overlays/wiki-memory/concepts/two-hierarchy-memory-addressing.md`
- `overlays/wiki-memory/concepts/how-identifiers-work.md`
- `overlays/wiki-memory/concepts/how-wiki-memory-works.md`
- `overlays/wiki-memory/people/marie-curie.md`

- [ ] **Step 1: Add a real `rationale:` line to each seed's YAML frontmatter**

Insert a `rationale:` key into the existing frontmatter block of each file (do not disturb other keys). Use these values verbatim:

- `biology.md`:
  ```yaml
  rationale: "Seed exemplar for the Concept shape — a broad parent concept used to demonstrate skos:broader nesting and as a wikilink target in tests. Authored as L3 reference content for the wiki-memory profile."
  ```
- `photosynthesis.md`:
  ```yaml
  rationale: "Seed exemplar for the Concept shape — a leaf concept under biology, used to demonstrate the prefLabel literal axis and broader edge. Authored as L3 reference content."
  ```
- `two-hierarchy-memory-addressing.md`:
  ```yaml
  rationale: "Crystallized the D105/D106 dogfood note: RDFS-subsumption (addressing axis, Type Index -> container) and skos:broader (navigation axis) are distinct and never substituted. Concluded from reconciling the cold-probe wiki->MediaWiki misread against the decisions log. Target of sub:agentGuide."
  ```
- `how-identifiers-work.md`:
  ```yaml
  rationale: "Bootstrapped memory for the D111 identifier-scheme substrate — explains compact-id form and the /id/schemes/ catalog so a cold agent can register and resolve PIDs. Authored from the D111 cold-probe findings; dog-foods the compact-id convention."
  ```
- `how-wiki-memory-works.md`:
  ```yaml
  rationale: "Orientation memory for the wiki-memory L3 profile — explains page-as-unit, dual-layer linking, and the crystallize lifecycle so a cold agent can author conformant notes. Authored as the agentGuide-linked entry point."
  ```
- `marie-curie.md`:
  ```yaml
  rationale: "Seed exemplar for the Person shape — demonstrates schema:name on <#this> and the people/ container routing. Authored as L3 reference content for the wiki-memory profile."
  ```

- [ ] **Step 2: Sanity-check the YAML still parses**

Run: `~/uvws/.venv/bin/python -c "import yaml,glob; [yaml.safe_load(open(f).read().split(chr(10)+'---')[0].lstrip('-'+chr(10))) for f in ['overlays/wiki-memory/concepts/biology.md','overlays/wiki-memory/people/marie-curie.md']]" && echo OK`
Expected: `OK` (no YAML exception).

- [ ] **Step 3: Commit**

```bash
git add overlays/wiki-memory/concepts/biology.md overlays/wiki-memory/concepts/photosynthesis.md overlays/wiki-memory/concepts/two-hierarchy-memory-addressing.md overlays/wiki-memory/concepts/how-identifiers-work.md overlays/wiki-memory/concepts/how-wiki-memory-works.md overlays/wiki-memory/people/marie-curie.md
git commit -m "seed: add rationale: frontmatter to the 6 durable wiki seeds (write contract backfill)"
```

---

### Task 3: Add the `rationale:` slot to the crystallize affordance + concept template

So agents author it by default. Documentation/prose only — no behavioral test (the floor enforces behavior in Task 5).

**Files:**
- Modify: `overlays/wiki-memory/affordances/crystallize.ttl`
- Modify: `overlays/wiki-memory/shapes/template.shacl.ttl` (the durable authoring template) — confirm path with `grep -rl "rationale\|prefLabel\|frontmatter" overlays/wiki-memory/templates overlays/wiki-memory/shapes/template.shacl.ttl 2>/dev/null` and edit whichever is the durable concept template.

- [ ] **Step 1: Amend the crystallize procedure prose**

In `crystallize.ttl`, in the `wiki:procedure` list, change the body-composition step to name the rationale frontmatter field. Replace the step:

```turtle
        "Compose destination body (markdown) and .meta (Turtle) including prov:wasDerivedFrom <working-source> (agent-authored, ungoverned; do NOT PATCH prov:wasGeneratedBy onto the resource — the substrate governs it and the operation is recorded in .operations/ per step 6)"
```

with:

```turtle
        "Compose the destination markdown body. The frontmatter MUST include a rationale: field — the task that triggered this crystallization, what you concluded, and why (including what you consulted). It projects to mem:rationale on <#this> and the durable shape REQUIRES it: a body whose projection omits it is 422'd. Optionally PATCH .meta with prov:wasDerivedFrom <working-source> (agent-authored, ungoverned; do NOT PATCH prov:wasGeneratedBy onto the resource — the substrate governs it and the operation is recorded in .operations/ per step 6)"
```

- [ ] **Step 2: Add the field to the durable template**

In the durable concept template identified above, add a `rationale:` line to the frontmatter exemplar (a placeholder prompt, e.g. `rationale: "<why you are committing this note to durable memory — task, conclusion, sources consulted>"`).

- [ ] **Step 3: Commit**

```bash
git add overlays/wiki-memory/affordances/crystallize.ttl overlays/wiki-memory/shapes/template.shacl.ttl
git commit -m "docs: crystallize affordance + template prompt for the rationale: frontmatter slot"
```

---

### Task 4: Require `mem:rationale` on the 7 per-type durable shapes

**Files (Modify):**
- `overlays/wiki-memory/shapes/concept.shacl.ttl`
- `overlays/wiki-memory/shapes/person.shacl.ttl`
- `overlays/wiki-memory/shapes/place.shacl.ttl`
- `overlays/wiki-memory/shapes/event.shacl.ttl`
- `overlays/wiki-memory/shapes/organization.shacl.ttl`
- `overlays/wiki-memory/shapes/howto.shacl.ttl`
- `overlays/wiki-memory/shapes/source.shacl.ttl`
- Test: `tests/test_wiki_memory_l3_shapes.py` (existing — re-run as the parse/well-formedness guard)

- [ ] **Step 1: Add the `@prefix mem:` declaration to the 5 files missing it**

Add to the prefix block of `concept`, `person`, `place`, `organization`, `source` (event + howto already declare it):

```turtle
@prefix mem:    <https://pod.vardeman.me/vault/ontology/mem#> .
```

- [ ] **Step 2: Add the identical `mem:rationale` property to all 7 shapes**

Inside each shape's NodeShape (alongside the other `sh:property` blocks), add:

```turtle
    sh:property [
        sh:path mem:rationale ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "mem:rationale is required — record the task that triggered this write, what you concluded, and why, including what you consulted. Do not merely restate the record's name; a future agent audits this context before trusting it. Author it as a `rationale:` frontmatter field." ;
    ] ;
```

- [ ] **Step 3: Add a laden line to each shape's `sh:agentInstruction`**

Append to the existing `sh:agentInstruction` triple-quoted string in each of the 7 shapes (so it is read pre-write, per the e5b-write finding):

```
Every durable write MUST carry a rationale: frontmatter field — the task that triggered it, what you concluded, and why (including sources consulted). It projects to mem:rationale and is required; your write-context is unrecoverable after this session.
```

- [ ] **Step 4: Run the shape-catalog guard to confirm the shapes still parse and are well-formed**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_wiki_memory_l3_shapes.py -v`
Expected: PASS (shapes parse; catalog structure intact). If this suite asserts a property count per shape, update that expectation to include the new property.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/shapes/concept.shacl.ttl overlays/wiki-memory/shapes/person.shacl.ttl overlays/wiki-memory/shapes/place.shacl.ttl overlays/wiki-memory/shapes/event.shacl.ttl overlays/wiki-memory/shapes/organization.shacl.ttl overlays/wiki-memory/shapes/howto.shacl.ttl overlays/wiki-memory/shapes/source.shacl.ttl tests/test_wiki_memory_l3_shapes.py
git commit -m "feat: require mem:rationale on the 7 durable wiki shapes (markdown-lane write contract)"
```

---

### Task 5: Integration — the floor enforces the contract end-to-end

**Files:**
- Test: `tests/test_markdown_lane_write_contract.py` (Create)

- [ ] **Step 1: Write the integration test**

Create `tests/test_markdown_lane_write_contract.py` (mirrors `tests/test_admission_floor_integration.py` helpers):

```python
"""E2E: the markdown-lane write contract — durable wiki writes require mem:rationale.

A durable Concept whose body projection omits mem:rationale (no rationale: frontmatter)
is 422'd by the in-band floor; one with the field commits and materializes mem:rationale
into .meta. working/ stays permissive (D73).

Run: SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem pytest tests/test_markdown_lane_write_contract.py -v
"""
import httpx
import pytest
from rdflib import Graph, URIRef

from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
MEM_RATIONALE = "https://pod.vardeman.me/vault/ontology/mem#rationale"

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def _put(path, body, ct="text/markdown"):
    return httpx.put(f"{POD}{path}", content=body, headers={"Content-Type": ct}, verify=_CA)


def _get(path, **kwargs):
    return httpx.get(f"{POD}{path}", verify=_CA, **kwargs)


def test_durable_concept_without_rationale_rejected_422():
    body = ("---\ntype: concept\n---\n# No Rationale\n\n"
            "[No Rationale]{.prefLabel} is a test concept.\n\n[[Biology]]{.broader}\n")
    r = _put("/vault/wiki/concepts/e2e-contract-norat.md", body)
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:200]}"
    assert "ValidationReport" in r.text and "rationale" in r.text


def test_rejected_write_leaves_no_artifacts():
    _put("/vault/wiki/concepts/e2e-contract-norat2.md",
         "---\ntype: concept\n---\n# NR2\n\n[NR2]{.prefLabel} body.\n")
    assert _get("/vault/wiki/concepts/e2e-contract-norat2.md").status_code == 404
    assert _get("/vault/wiki/concepts/e2e-contract-norat2.md.meta").status_code == 404


def test_durable_concept_with_rationale_commits_and_materializes_meta():
    body = ("---\ntype: concept\n"
            "rationale: \"Authored in the contract e2e to verify mem:rationale projects and admits.\"\n"
            "---\n# With Rationale\n\n[With Rationale]{.prefLabel} is a test concept.\n\n[[Biology]]{.broader}\n")
    r = _put("/vault/wiki/concepts/e2e-contract-withrat.md", body)
    assert r.status_code in (201, 205), f"expected commit, got {r.status_code}: {r.text[:200]}"
    m = _get("/vault/wiki/concepts/e2e-contract-withrat.md.meta", headers={"Accept": "text/turtle"})
    assert m.status_code == 200
    g = Graph()
    g.parse(data=m.text, format="turtle",
            publicID=f"{POD}/vault/wiki/concepts/e2e-contract-withrat.md")
    assert (None, URIRef(MEM_RATIONALE), None) in g, "mem:rationale not materialized in .meta"


def test_working_note_without_rationale_is_permissive():
    body = "---\ntype: concept\n---\n# Draft\n\n[Draft]{.prefLabel} drafting, no rationale yet.\n"
    r = _put("/vault/wiki/working/e2e-contract-draft.md", body)
    assert r.status_code in (201, 205), f"working/ must stay permissive (D73), got {r.status_code}"
```

- [ ] **Step 2: Run the test against the CURRENTLY-deployed Pod to verify the negative case fails**

Run: `make reset && make verify` (only if the Pod is not already up at pre-Task-4 image), then
`SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_markdown_lane_write_contract.py::test_durable_concept_without_rationale_rejected_422 -v`
Expected: FAIL — the rationale-less write returns 201/205 (shapes not yet rebuilt into the live Pod), so the 422 assertion fails. This proves the test exercises the new requirement.

- [ ] **Step 3: Rebuild the Pod so Tasks 1–4 take effect, then run the full contract suite**

Run:
```bash
make rebuild && make verify
SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_markdown_lane_write_contract.py -v
```
Expected: PASS (all four tests). `make verify` audit must show 0 ERROR (seeds admit because Task 2 gave them rationale).

- [ ] **Step 4: Commit**

```bash
git add tests/test_markdown_lane_write_contract.py
git commit -m "test: e2e markdown-lane write contract (mem:rationale required, working/ permissive)"
```

---

### Task 6: psp-1 fold-in — protect the substrate stamp predicates from agent PATCH

The floor must reject an agent N3 PATCH that mutates `sub:projectorVersion` / `sub:bodyHash` (they are substrate-internal stamps).

**Files:**
- Modify: `css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts` (the floor's protected/governed predicate set — `VERSION_PRED` + `STAMP_PRED` are already imported from `../util/StampPredicate`)
- Test: `tests/test_markdown_lane_write_contract.py` (add the stamp-protection case) — or `tests/test_admission_floor_integration.py` if you prefer it beside the other floor tests.

- [ ] **Step 1: Write the failing integration test**

Add to `tests/test_markdown_lane_write_contract.py`:

```python
def test_agent_patch_cannot_mutate_stamp_predicates():
    # First create a valid durable concept (carries substrate stamps).
    body = ("---\ntype: concept\n"
            "rationale: \"stamp-protection fixture\"\n---\n"
            "# Stamp Guard\n\n[Stamp Guard]{.prefLabel} body.\n\n[[Biology]]{.broader}\n")
    assert _put("/vault/wiki/concepts/e2e-contract-stamp.md", body).status_code in (201, 205)
    patch = (
        '@prefix sub: <https://pod.vardeman.me/vault/ontology/substrate#> .\n'
        '_:rename a <http://www.w3.org/ns/solid/terms#InsertDeletePatch> ;\n'
        '  <http://www.w3.org/ns/solid/terms#inserts> { <#this> sub:projectorVersion "999" . } .\n'
    )
    r = httpx.patch(f"{POD}/vault/wiki/concepts/e2e-contract-stamp.md.meta",
                    content=patch, headers={"Content-Type": "text/n3"}, verify=_CA)
    assert r.status_code == 422, f"stamp PATCH must be rejected, got {r.status_code}: {r.text[:200]}"
```

- [ ] **Step 2: Run it against the current Pod to verify it fails**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_markdown_lane_write_contract.py::test_agent_patch_cannot_mutate_stamp_predicates -v`
Expected: FAIL — the PATCH currently succeeds (stamp is mutable), so the 422 assertion fails.

- [ ] **Step 3: Add the stamp predicates to the floor's protected set**

In `AdmissionFloorStore.ts`, locate where an incoming `.meta` PATCH is reconciled against the existing graph (the projection/merge path). Add a guard: if the incoming change touches `VERSION_PRED` or `STAMP_PRED` on any subject, reject with a 422 `BadRequestHttpError`/validation report (reuse the existing rejection path). Confirm the exact insertion point by reading the PATCH-handling method; the predicate IRIs are already in scope via:

```typescript
import { DEFAULT_STAMP_PRED, VERSION_PRED } from '../util/StampPredicate';
```

Add a check before commit (pseudticode to adapt to the method's local variable names):

```typescript
const PROTECTED_STAMPS = new Set([DEFAULT_STAMP_PRED, VERSION_PRED]);
// after computing the incoming quads that the agent write would add/remove on .meta:
if (incomingQuads.some(q => PROTECTED_STAMPS.has(q.predicate.value))) {
    throw new BadRequestHttpError(
        'sub:projectorVersion / sub:bodyHash are substrate-managed stamps and cannot be written by an agent.');
}
```

- [ ] **Step 4: Unit-guard the protected-set logic (vitest, no Pod)**

Add a focused unit test next to the floor's existing TS tests (e.g. `css/extensions/shape-validator/test/`) asserting that a quad array containing `VERSION_PRED` is flagged by the guard helper. If the guard is inlined (not a pure helper), extract it to a small exported function `touchesProtectedStamp(quads): boolean` so it is unit-testable, and test that.

Run: `cd css/extensions/shape-validator && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Rebuild and run the integration test to verify it passes**

Run:
```bash
make rebuild && make verify
SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_markdown_lane_write_contract.py::test_agent_patch_cannot_mutate_stamp_predicates -v
```
Expected: PASS (422).

- [ ] **Step 6: Commit**

```bash
git add css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts css/extensions/shape-validator/src/util/StampPredicate.ts css/extensions/shape-validator/test tests/test_markdown_lane_write_contract.py
git commit -m "fix: floor rejects agent PATCH of sub:projectorVersion/bodyHash stamps (psp-1)"
```

---

### Task 7: Full regression — reset green, audit clean, suite green

**Files:** none (verification + any fixups).

- [ ] **Step 1: Clean reproducible rebuild**

Run: `make reset && make verify`
Expected: seed completes; `make verify` audit reports **0 ERROR** (the lone intentional D98 dup-container WARN is allowed). All 6 durable seeds admit.

- [ ] **Step 2: Run the TS guard suites**

Run: `make test-js`
Expected: PASS across every extension (frontmatter projection + floor guard included).

- [ ] **Step 3: Run the full pytest suite (Pod up)**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/ -v`
Expected: PASS. Known-tolerated flake: `test_timemap_returns_parseable_turtle` (ordering-dependent — passes in isolation). The new `tests/test_markdown_lane_write_contract.py` (5 tests) passes.

- [ ] **Step 4: Confirm working/ + Turtle-lane regressions intact**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_admission_floor_integration.py tests/test_wiki_memory_l3_shapes.py -v`
Expected: PASS (D73 permissive working/ unchanged; existing floor behavior intact).

- [ ] **Step 5: Update FOLLOWUPS — close (a), note psp-1 done**

Mark FOLLOWUPS `🧷 (a)` as `[x]` (shipped, this plan) and strike the psp-1 residue line for the stamp-protection item. Commit:

```bash
git add FOLLOWUPS.md
git commit -m "docs: close FOLLOWUPS (a) markdown-lane write contract + psp-1 stamp protection"
```

---

## Self-Review

**Spec coverage:**
- §1 placement (canonical on resource `.meta`) → Tasks 1+4 (projects into `.meta`, shape requires it). ✓
- §2 operations log link-only → no task needed (existing `as:object`; explicitly no copy). ✓
- §3 authoring via frontmatter projection → Task 1. ✓
- §4 per-type shapes (7) + `@prefix mem:` on 5 → Task 4. ✓
- Seeds backfill (6) → Task 2. ✓
- Crystallize affordance/template slot → Task 3. ✓
- psp-1 stamp protection → Task 6. ✓
- D73 working/ permissive → Task 5 Step 1 (test) + Task 7 Step 4. ✓
- Tests (422 / 201+meta / reset green / audit 0 ERROR) → Tasks 5 + 7. ✓

**Placeholder scan:** Task 3 names `template.shacl.ttl` with a `grep` to confirm the exact durable-template path before editing — resolve at execution, not a content placeholder. No TBD/TODO content steps. Task 6 Step 3 adapts to the method's local variable names (the guard logic and imports are concrete; only the surrounding variable names are read-then-matched). All code steps show code.

**Type consistency:** `MEM` constant + `mem:rationale` IRI (`…/mem#rationale`) consistent across Tasks 1/4/5/6. `VERSION_PRED`/`DEFAULT_STAMP_PRED` match the existing `StampPredicate.ts` exports. `Frontmatter.rationale?: string` matches the `fm.rationale` usage and the test inputs.
