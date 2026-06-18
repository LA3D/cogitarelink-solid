# Shape-Governance Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ShapeTrees the single source of truth for container→shape governance — deriving `ldp:constrainedBy` and codegen-ing `governedPredicates` from them — and factor the agentic write contract into one substrate `sub:WriteContractShape` injected by that derivation, uniform across all three lanes (`foaf:Document` on `<>`).

**Architecture:** Author once (ShapeTrees + leaf shapes), derive twice (container `.meta` `constrainedBy` via a Python generator; `governedPredicates.ts` via a TS-emitting Python generator), enforce unchanged (D108 floor). The write contract becomes one substrate NodeShape targeting `foaf:Document`, unioned into every durable container's derived `constrainedBy`. No ShapeTree runtime (declaration-only subset); agreement tests guard both derivations.

**Tech Stack:** SHACL Turtle shapes, ShapeTrees (`st:`), Python/rdflib generators (extending `scripts/gen_managers.py`), TypeScript (`governedPredicates.ts`, projection), pytest + vitest, Docker (`make reset`/`make verify`).

**Spec:** `docs/superpowers/specs/2026-06-17-shape-governance-reconciliation-design.md`

> **STATUS 2026-06-18 — MERGED to `main` (no-ff merge `6510e2a`; branch deleted; see D117).**
> **DONE + live-validated (wiki lane): Tasks 1, 2, 3, 4, 5 (Path B), 6, 8, 10, 11, 12.** The
> reconciliation thesis is proven on the live Pod and the multiple-`st:shape` union is cold-agent
> validated (Task 11: n=2 PASS first-try, `docs/plans/2026-06-17-write-contract-probe-report.md`).
> Task numbering differs from execution order (Task 5 became the Path-B agreement test, not codegen;
> Tasks 6/8 before 7/9). Task 12 (fixture sweep) was all expectation-updates EXCEPT one real coupling
> fixed on-thesis — the projection's new `<> a foaf:Document` made the contract 422 the *derived*
> `index.md`; `buildIndexMarkdown` now emits `rationale:` (commit `8d435ec`). Suite 474 passed;
> `make reset && make verify` 0 ERROR / 1 intentional D98 WARN; `make test-js` green.
> **REMAINING: Tasks 7 + 9 only (RDF-native lanes) — DEFERRED.** Their containers (addressbook,
> id-schemes) still enforce via their OWN per-app duplicated `mem:rationale` shapes (functional, not
> unified); `derive_constraints.py` derives their shape sets but writes wiki-only because their
> ShapeTrees diverge from the deployed layout (addressbook constrains `{Person,Organization}/`
> subcontainers; id-schemes is outside `/vault`). Blocked on the tree↔layout decision, not labor.
> Full resume notes in `FOLLOWUPS.md` ▶▶ RESUME + 🔵 sections.

**Conventions (every task):**
- Pod calls: prefix pytest with `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem`.
- After Turtle/shape/TS changes that must reach the live Pod: `make rebuild && make verify` (TS) or `make reset && make verify` (seed/shape data). Pure-Python generator + unit tests don't need the Pod.
- Run Python as a module from repo root: `~/uvws/.venv/bin/python -m scripts.<mod>` (relative imports).
- `mem:rationale` IRI = `https://pod.vardeman.me/vault/ontology/mem#rationale`; `sub:` = `https://pod.vardeman.me/vault/ontology/substrate#`; `foaf:Document` = `http://xmlns.com/foaf/0.1/Document`.
- The **validated laden message** (reuse verbatim): `"mem:rationale is required — record the task that triggered this write, what you concluded, and why, including what you consulted. Do not merely restate the record's name; a future agent audits this context before trusting it."`

## File Structure

| File | Responsibility |
|---|---|
| `shapes/substrate/write-contract.shacl.ttl` (new) | `sub:WriteContractShape` — the single write-contract NodeShape (`foaf:Document` → `mem:rationale`) |
| `ontology/mem.ttl` (new, relocated) | substrate-hosted L2 `mem:` write-contract vocab slice (`mem:rationale`) |
| `overlays/wiki-memory/ontology/mem.ttl` | keeps wiki-L3 lifecycle terms (`mem:CrystallizeAction`, `mem:RealignAction`, …); `mem:rationale` removed (now substrate) |
| `scripts/overlay/derive_constraints.py` (new) | generator: ShapeTrees + managers → per-container `constrainedBy`, unioning `WriteContractShape`; writes container `.meta` |
| `scripts/gen_governed_predicates.py` (new) | generator: deployed SHACL shapes → `governedPredicates.ts` (page/thing partition) |
| `css/extensions/markdown-projection/src/governedPredicates.ts` | becomes generated (DO-NOT-EDIT header) |
| `overlays/*/shapetrees/*.tree.ttl` | wiki ResourceTrees gain multiple `st:shape` (Page+Thing+leaf); RDF-native unchanged |
| `overlays/{addressbook,identifier-schemes,wiki-memory}/shapes/*` | remove the per-app `mem:rationale` `sh:property` |
| `css/extensions/markdown-projection/src/frontmatterProjection.ts` + `projectionPipeline.ts` | emit `<> a foaf:Document`; keep `rationale:`→`mem:rationale` |
| `tests/test_constraints_derivation.py`, `tests/test_governed_predicates_codegen.py`, `tests/test_write_contract_e2e.py` (new) | agreement + integration tests |

---

## Phase 1 — Substrate write-contract shape + `foaf:Document` hook + `mem:` relocation

### Task 1: Create the substrate `WriteContractShape`

**Files:**
- Create: `shapes/substrate/write-contract.shacl.ttl`
- Test: `tests/test_write_contract_shape.py` (new)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_write_contract_shape.py
"""The substrate write-contract shape: foaf:Document must carry mem:rationale."""
from pathlib import Path
from pyshacl import validate
from rdflib import Graph

SHAPE = Path("shapes/substrate/write-contract.shacl.ttl")

def _data(ttl: str) -> Graph:
    g = Graph(); g.parse(data=ttl, format="turtle"); return g

def test_document_without_rationale_fails():
    shapes = Graph(); shapes.parse(SHAPE, format="turtle")
    data = _data('@prefix foaf: <http://xmlns.com/foaf/0.1/> . <urn:r> a foaf:Document .')
    conforms, _, _ = validate(data_graph=data, shacl_graph=shapes, inference="none")
    assert not conforms

def test_document_with_rationale_conforms():
    shapes = Graph(); shapes.parse(SHAPE, format="turtle")
    data = _data('@prefix foaf: <http://xmlns.com/foaf/0.1/> . '
                 '@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> . '
                 '<urn:r> a foaf:Document ; mem:rationale "because the task required it" .')
    conforms, _, _ = validate(data_graph=data, shacl_graph=shapes, inference="none")
    assert conforms
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_write_contract_shape.py -v`
Expected: FAIL (shape file does not exist → parse error).

- [ ] **Step 3: Create the shape**

```turtle
# shapes/substrate/write-contract.shacl.ttl
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix sub:  <https://pod.vardeman.me/vault/ontology/substrate#> .
@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:  <http://purl.org/dc/terms/> .

<> dct:conformsTo <https://www.w3.org/TR/shacl/> .

sub:WriteContractShape
    a sh:NodeShape ;
    rdfs:label "Agentic write contract" ;
    rdfs:comment "The L2 agentic-write-contract: every durable record document (foaf:Document) written to the Pod carries mem:rationale. Injected into every durable container's ldp:constrainedBy by the derivation; NOT declared per-app. Targets the document subject <> uniformly across lanes." ;
    sh:targetClass foaf:Document ;
    sh:agentInstruction """Every durable write MUST carry mem:rationale on the record document (<>): the task that triggered it, what you concluded, and why, including what you consulted. This is the agentic-vs-Solid difference (the spec only says MAY; this substrate says MUST). Your write-context is unrecoverable after this session.""" ;
    sh:property [
        sh:path mem:rationale ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "mem:rationale is required — record the task that triggered this write, what you concluded, and why, including what you consulted. Do not merely restate the record's name; a future agent audits this context before trusting it." ;
    ] .
```

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_write_contract_shape.py -v`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add shapes/substrate/write-contract.shacl.ttl tests/test_write_contract_shape.py
git commit -m "feat: substrate WriteContractShape (foaf:Document -> mem:rationale)"
```

### Task 2: Relocate the L2 `mem:rationale` vocab to the substrate layer

**Files:**
- Create: `ontology/mem.ttl` (the relocated write-contract slice)
- Modify: `overlays/wiki-memory/ontology/mem.ttl` (remove `mem:rationale` definition; keep lifecycle terms)
- Test: `tests/test_mem_vocab_layering.py` (new)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_mem_vocab_layering.py
"""mem:rationale (L2 write contract) is defined at the substrate layer, not inside the wiki overlay."""
from pathlib import Path
from rdflib import Graph, URIRef, RDFS

MEM_RATIONALE = URIRef("https://pod.vardeman.me/vault/ontology/mem#rationale")

def test_rationale_defined_in_substrate_ontology():
    g = Graph(); g.parse("ontology/mem.ttl", format="turtle")
    assert (MEM_RATIONALE, RDFS.label, None) in g or (MEM_RATIONALE, None, None) in g

def test_rationale_not_redefined_in_wiki_overlay():
    g = Graph(); g.parse("overlays/wiki-memory/ontology/mem.ttl", format="turtle")
    # the wiki overlay may REFERENCE mem:rationale in comments/examples but must not (re)define it
    assert (MEM_RATIONALE, RDFS.label, None) not in g
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_mem_vocab_layering.py -v`
Expected: FAIL (`ontology/mem.ttl` does not exist; `mem:rationale` still has `rdfs:label` in the wiki overlay at line ~339).

- [ ] **Step 3: Create the substrate vocab + strip the wiki one**

Create `ontology/mem.ttl` with the prefix block and the `mem:rationale` definition lifted from `overlays/wiki-memory/ontology/mem.ttl` (read its lines ~339–345 for the exact triples — `mem:rationale a rdf:Property ; rdfs:label "rationale" ; rdfs:comment ... ; rdfs:range xsd:string .`). Add a header comment: `# L2 memory-substrate vocabulary (write-contract slice). Deployed at /vault/ontology/mem# (Pod-general). Lifecycle actions live in overlays/wiki-memory/ontology/mem.ttl (wiki-L3).`

Then in `overlays/wiki-memory/ontology/mem.ttl`, delete the `mem:rationale a rdf:Property ; … .` definition block (the term stays *used* by `mem:RealignAction` examples — those references are fine; only the definition moves).

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_mem_vocab_layering.py -v && ~/uvws/.venv/bin/python -c "from rdflib import Graph; Graph().parse('overlays/wiki-memory/ontology/mem.ttl', format='turtle'); print('wiki mem.ttl still parses')"`
Expected: PASS + "wiki mem.ttl still parses".

- [ ] **Step 5: Wire the substrate vocab into deployment**

The substrate `mem:` must still deploy at `/vault/ontology/mem`. Confirm which overlay/manifest hosts `/vault/ontology/mem` today (`grep -rn "ontology/mem" overlays/*/manifest.ttl`) and point that `overlay:document` at `ontology/mem.ttl` (or add a substrate-seed entry). The deployed IRI is unchanged; only the source file moves.

- [ ] **Step 6: Commit**

```bash
git add ontology/mem.ttl overlays/wiki-memory/ontology/mem.ttl tests/test_mem_vocab_layering.py overlays/*/manifest.ttl
git commit -m "refactor: relocate L2 mem:rationale vocab to substrate ontology/"
```

---

## Phase 2 — ShapeTree → `constrainedBy` derivation

### Task 3: Build the constraint-derivation generator

**Files:**
- Create: `scripts/overlay/derive_constraints.py`
- Test: `tests/test_constraints_derivation.py` (new)

**Context:** Model on `scripts/gen_managers.py` (rdflib graph parse + serialize). Input: an overlay dir with `shapetrees/*.tree.ttl` + `interop/managers/*.shapetree.ttl` (or `interop/managers/`); for each Manager (`st:manages` → container URL, `st:assigns` → a ContainerTree), resolve `ContainerTree st:contains → ResourceTree(s)`, collect each ResourceTree's `st:shape` IRIs, union the constant `sub:WriteContractShape`, and map shape IRIs → their hosted `/vault/meta/shapes/*.shacl.ttl` URLs. Output: the `ldp:constrainedBy` object set per container.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_constraints_derivation.py
"""The derivation computes a container's constrainedBy from its ShapeTree + the injected contract."""
from scripts.overlay.derive_constraints import derive_constrainedby

WRITE_CONTRACT = "https://pod.vardeman.me/vault/meta/shapes/write-contract.shacl.ttl"

def test_wiki_concepts_unions_tree_shapes_plus_contract():
    # concepts/ ContainerTree contains Concept + Source resource trees;
    # the Concept tree carries Page+Thing+Concept shapes (multiple st:shape).
    got = derive_constrainedby("overlays/wiki-memory", "https://pod.vardeman.me/vault/wiki/concepts/")
    assert WRITE_CONTRACT in got
    assert any(s.endswith("concept.shacl.ttl") for s in got)
    assert any(s.endswith("source.shacl.ttl") for s in got)
    assert any(s.endswith("page.shacl.ttl") for s in got)

def test_contract_injected_even_for_rdf_native():
    got = derive_constrainedby("overlays/identifier-schemes", "https://pod.vardeman.me/id/schemes/")
    assert WRITE_CONTRACT in got
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_constraints_derivation.py -v`
Expected: FAIL (module/function does not exist).

- [ ] **Step 3: Implement the generator**

Create `scripts/overlay/derive_constraints.py` with:
- `ST = Namespace("http://www.w3.org/ns/shapetrees#")`, `LDP`, and a constant `WRITE_CONTRACT_SHAPE = "https://pod.vardeman.me/vault/meta/shapes/write-contract.shacl.ttl"`.
- A `SHAPE_IRI_TO_URL` resolver: read the overlay manifest's `overlay:installsShape`/hosted-at entries (and the wiki vocab IRIs `wiki:ConceptShape` etc.) → the `/vault/meta/shapes/<file>` URL. (The ShapeTrees reference shapes either by hosted URL-with-fragment, e.g. `…/contact-card.shacl.ttl#ContactCardShape`, or by vocab CURIE, e.g. `wiki:ConceptShape`; normalize both to the hosted `.shacl.ttl` URL.)
- `def derive_constrainedby(overlay_dir: str, container_url: str) -> set[str]:` — load all `*.tree.ttl` + `interop/managers/*` into one graph; find the Manager whose `st:manages == container_url`; follow `st:assigns` → ContainerTree → `st:contains` → ResourceTrees; collect their `st:shape` objects; map each through `SHAPE_IRI_TO_URL`; `return mapped | {WRITE_CONTRACT_SHAPE}`.

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_constraints_derivation.py -v`
Expected: PASS. (Note: `test_wiki_concepts_unions...` requires the wiki ConceptResourceTree to carry Page+Thing+Concept `st:shape` — if the tree still has only the leaf, this test correctly fails until Task 13; if so, split: assert the contract + leaf now, add the Page/Thing asserts after Task 13. Prefer implementing Task 13's tree change *before* this assert — see Step 5.)

- [ ] **Step 5: Reconcile ordering**

Because the wiki tree's multiple-`st:shape` change (Task 13) and this derivation are mutually dependent for the full assertion, implement the wiki tree change (Task 13 Step 3) now as part of this task if the engineer is doing them together; otherwise weaken the Task-3 wiki assertion to `{contract, concept, source}` and restore the Page/Thing asserts in Task 13.

- [ ] **Step 6: Commit**

```bash
git add scripts/overlay/derive_constraints.py tests/test_constraints_derivation.py
git commit -m "feat: derive container constrainedBy from ShapeTrees + injected WriteContractShape"
```

### Task 4: Emit derived `constrainedBy` into container `.meta` + agreement test

**Files:**
- Modify: `scripts/overlay/derive_constraints.py` (add a `__main__` writer)
- Modify: each durable container `.meta` under `overlays/*/containers/` (generated content)
- Test: extend `tests/test_constraints_derivation.py`

- [ ] **Step 1: Write the failing agreement test**

```python
def test_committed_meta_matches_derivation():
    """Every durable container's committed .meta constrainedBy == the ShapeTree derivation."""
    from scripts.overlay.derive_constraints import committed_constrainedby, derive_constrainedby, DURABLE_CONTAINERS
    for overlay_dir, container_url in DURABLE_CONTAINERS:
        assert committed_constrainedby(overlay_dir, container_url) == derive_constrainedby(overlay_dir, container_url), container_url
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_constraints_derivation.py::test_committed_meta_matches_derivation -v`
Expected: FAIL (`committed_constrainedby`/`DURABLE_CONTAINERS` undefined; and the committed `.meta` lacks the write-contract URL).

- [ ] **Step 3: Implement the writer + helpers**

Add to `derive_constraints.py`: `DURABLE_CONTAINERS` (list of `(overlay_dir, container_url)` for all durable containers across the three apps — exclude `working/`), `committed_constrainedby(overlay_dir, container_url)` (parse the container's local `.meta`, return its `ldp:constrainedBy` object set as URLs), and a `__main__` that, for each durable container, rewrites the local `.meta`'s `ldp:constrainedBy` triples to the derived set (preserving other `.meta` triples). Run it: `~/uvws/.venv/bin/python -m scripts.overlay.derive_constraints` and commit the regenerated `.meta` files.

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_constraints_derivation.py -v`
Expected: PASS.

- [ ] **Step 5: Wire into `make`**

Add a `derive-constraints` target to the Makefile (`~/uvws/.venv/bin/python -m scripts.overlay.derive_constraints`) and call it from `reset`/build prerequisites or document it in the generator header. Add the agreement test to the default `make test`.

- [ ] **Step 6: Commit**

```bash
git add scripts/overlay/derive_constraints.py tests/test_constraints_derivation.py overlays/*/containers Makefile
git commit -m "feat: generate container constrainedBy from ShapeTrees + agreement test"
```

---

## Phase 3 — `governedPredicates` codegen

### Task 5: Generate `governedPredicates.ts` from the SHACL shapes

**Files:**
- Create: `scripts/gen_governed_predicates.py`
- Modify: `css/extensions/markdown-projection/src/governedPredicates.ts` (becomes generated)
- Test: `tests/test_governed_predicates_codegen.py` (new)

**Context:** Read each deployed wiki shape (`overlays/wiki-memory/shapes/*.shacl.ttl`) + `shapes/substrate/write-contract.shacl.ttl`. A shape with `sh:targetClass wiki:Page` (or `foaf:Document`) contributes its `sh:path`s to `PAGE_GOVERNED_PREDICATES`; a shape targeting `schema:Thing`/subclass contributes to `THING_GOVERNED_PREDICATES[targetClass]`. `mem:rationale` (on `WriteContractShape`, page axis via `foaf:Document` ⊇ `<>`) lands in PAGE.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_governed_predicates_codegen.py
"""governedPredicates.ts is generated from the shapes and is in sync with them."""
import subprocess, pathlib
TS = pathlib.Path("css/extensions/markdown-projection/src/governedPredicates.ts")

def test_regenerating_is_a_noop():
    before = TS.read_text()
    subprocess.run(["/Users/cvardema/uvws/.venv/bin/python", "-m", "scripts.gen_governed_predicates"], check=True)
    assert TS.read_text() == before, "governedPredicates.ts drifted from the shapes — regenerate + commit"

def test_rationale_is_page_governed():
    assert "mem#rationale" in TS.read_text().split("PAGE_GOVERNED_PREDICATES")[1].split("]")[0]
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_governed_predicates_codegen.py -v`
Expected: FAIL (generator missing; current hand-written file won't be a regeneration no-op; `mem:rationale` not yet in PAGE set).

- [ ] **Step 3: Implement the generator**

Create `scripts/gen_governed_predicates.py`: load every shape file into one graph; for each `sh:NodeShape` with a `sh:targetClass`, collect its `sh:property`/`sh:path` IRIs; bucket by axis (`wiki:Page`/`foaf:Document` → PAGE; `schema:Thing` + subclasses → THING per class). Emit `governedPredicates.ts` with a `// GENERATED — do not edit; run scripts/gen_governed_predicates.py` header, the `PAGE_GOVERNED_PREDICATES` array, the per-class `THING_GOVERNED_PREDICATES` map, and the existing exported helpers (`resolveGovernedFromQuads` consumes these — keep its signature). Preserve the namespace constants. Run it once and commit the regenerated file.

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_governed_predicates_codegen.py -v && cd css/extensions/markdown-projection && npx vitest run 2>&1 | tail -5`
Expected: pytest PASS; the projection vitest suite still green (the generated file is API-compatible).

- [ ] **Step 5: Commit**

```bash
git add scripts/gen_governed_predicates.py css/extensions/markdown-projection/src/governedPredicates.ts tests/test_governed_predicates_codegen.py
git commit -m "feat: codegen governedPredicates.ts from shapes; mem:rationale -> PAGE axis"
```

---

## Phase 4 — Projection emits `foaf:Document`; de-duplicate per-app contract

### Task 6: Project `<> a foaf:Document` on the page subject

**Files:**
- Modify: `css/extensions/markdown-projection/src/projectionPipeline.ts`
- Test: `css/extensions/markdown-projection/test/projectionPipeline.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it("projects <> a foaf:Document on the page subject", async () => {
  const quads = await projectionPipeline.run(
    "https://pod.vardeman.me/vault/wiki/concepts/x.md",
    "---\ntype: concept\nrationale: \"r\"\n---\n# X\n\n[X]{.prefLabel} body.\n");
  const isDoc = quads.some(q =>
    q.subject.value === "https://pod.vardeman.me/vault/wiki/concepts/x.md" &&
    q.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" &&
    q.object.value === "http://xmlns.com/foaf/0.1/Document");
  expect(isDoc).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd css/extensions/markdown-projection && npx vitest run test/projectionPipeline.test.ts -t "foaf:Document"`
Expected: FAIL (no `foaf:Document` quad emitted).

- [ ] **Step 3: Implement**

In `projectionPipeline.ts`'s `run`, after the frontmatter/derived quads, push `quad(namedNode(resourceUri), namedNode(RDF_TYPE), namedNode("http://xmlns.com/foaf/0.1/Document"))` (add a `FOAF_DOCUMENT` const). This is the page `<>` subject (the resource URI). Also add `wiki:Page rdfs:subClassOf foaf:Document` to `overlays/wiki-memory/ontology/wiki.ttl` for agent proto-knowledge (not load-bearing for the floor, which now sees the explicit type).

- [ ] **Step 4: Run to verify it passes**

Run: `cd css/extensions/markdown-projection && npx vitest run`
Expected: PASS (new + all existing).

- [ ] **Step 5: Commit**

```bash
git add css/extensions/markdown-projection/src/projectionPipeline.ts css/extensions/markdown-projection/test/projectionPipeline.test.ts overlays/wiki-memory/ontology/wiki.ttl
git commit -m "feat: project <> a foaf:Document (universal write-contract hook)"
```

### Task 7: Remove the per-app `mem:rationale` duplication

**Files:**
- Modify: `overlays/addressbook/shapes/contact-card.shacl.ttl`, `overlays/addressbook/shapes/organization-card.shacl.ttl`, `overlays/identifier-schemes/shapes/scheme-record.shacl.ttl`, `shapes/substrate/scheme-record.shacl.ttl`
- Test: `tests/test_no_duplicate_write_contract.py` (new)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_no_duplicate_write_contract.py
"""The write contract lives ONLY in WriteContractShape; no per-app shape re-declares mem:rationale minCount."""
import glob
from rdflib import Graph, URIRef
SH = URIRef("http://www.w3.org/ns/shacl#path")
MEM_R = URIRef("https://pod.vardeman.me/vault/ontology/mem#rationale")

def test_only_write_contract_shape_constrains_rationale():
    offenders = []
    for f in glob.glob("overlays/*/shapes/*.shacl.ttl") + ["shapes/substrate/scheme-record.shacl.ttl"]:
        g = Graph(); g.parse(f, format="turtle")
        if (None, SH, MEM_R) in g:
            offenders.append(f)
    assert offenders == [], f"mem:rationale property still duplicated in: {offenders}"
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_no_duplicate_write_contract.py -v`
Expected: FAIL (contact-card, scheme-record ×2 still have the property).

- [ ] **Step 3: Remove the `sh:property [ sh:path mem:rationale … ]` block** from each listed shape (and the now-stale "Every write carries mem:rationale" prose in their `sh:agentInstruction`, replaced by a one-line pointer: `"Subject to the substrate write contract (mem:rationale on <>); see /vault/meta/shapes/write-contract.shacl.ttl."`). Leave `vault/contacts/` etc. seed instances' `mem:rationale` data intact (only the SHAPE requirement moves; data is realigned in Task 9).

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_no_duplicate_write_contract.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/shapes/ overlays/identifier-schemes/shapes/scheme-record.shacl.ttl shapes/substrate/scheme-record.shacl.ttl tests/test_no_duplicate_write_contract.py
git commit -m "refactor: remove per-app mem:rationale duplication (now substrate WriteContractShape)"
```

---

## Phase 5 — Wire all three lanes

### Task 8: wiki ResourceTrees carry the full dual-layer `st:shape` set

**Files:**
- Modify: `overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl`
- Test: extend `tests/test_constraints_derivation.py` (restore the Page/Thing asserts from Task 3)

- [ ] **Step 1: Write the failing test**

Restore in `tests/test_constraints_derivation.py`:
```python
def test_wiki_concepts_includes_page_and_thing():
    got = derive_constrainedby("overlays/wiki-memory", "https://pod.vardeman.me/vault/wiki/concepts/")
    assert any(s.endswith("page.shacl.ttl") for s in got)
    assert any(s.endswith("thing.shacl.ttl") for s in got)
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_constraints_derivation.py::test_wiki_concepts_includes_page_and_thing -v`
Expected: FAIL (ResourceTrees only carry the leaf shape).

- [ ] **Step 3: Add the multiple `st:shape` values**

In `wiki-memory.tree.ttl`, give each `*ResourceTree` the full set, e.g.:
```turtle
wikitree:ConceptResourceTree a st:ShapeTree ; st:expectsType st:Resource ;
    st:shape wiki:PageShape , wiki:ThingShape , wiki:ConceptShape .
```
Repeat for Source/Person/Place/Event/Organization/HowTo resource trees (each adds `wiki:PageShape , wiki:ThingShape` to its existing leaf). Re-run the constraint generator (`-m scripts.overlay.derive_constraints`) and commit the regenerated container `.meta` files.

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_constraints_derivation.py -v`
Expected: PASS (including the agreement test, post-regeneration).

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl overlays/wiki-memory/containers tests/test_constraints_derivation.py
git commit -m "feat: wiki ResourceTrees declare full Page+Thing+leaf shape set"
```

### Task 9: Realign addressbook onto `<>`; emit `foaf:Document` in RDF-native templates/seeds

**Files:**
- Modify: `overlays/addressbook/templates/*.ttl`, `overlays/addressbook/containers/*.ttl` (seeds), `overlays/identifier-schemes/` seeds/templates as needed
- Modify: `overlays/addressbook/shapetrees/addressbook.tree.ttl` is unchanged (single `st:shape`); the contract is injected by derivation
- Test: `tests/test_write_contract_e2e.py` covers this at Pod level (Task 11)

- [ ] **Step 1: Type the contact document `<>` and move rationale there**

In each addressbook template + seed, add `<> a foaf:Document ; mem:rationale "<…>" .` and **remove** `mem:rationale` from the `<#this>` (vcard:Individual) subject. (id-schemes already types `<> a foaf:Document` with rationale there — verify and leave as-is.) Add the `foaf:` prefix where missing.

- [ ] **Step 2: Verify the seeds parse + carry rationale on `<>`**

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph,URIRef; g=Graph(); g.parse('overlays/addressbook/containers/marie-curie.ttl',format='turtle',publicID='https://pod.vardeman.me/vault/contacts/Person/marie-curie.ttl'); R=URIRef('https://pod.vardeman.me/vault/ontology/mem#rationale'); print('rationale on doc:', any(str(s).endswith('marie-curie.ttl') for s,_,_ in g.triples((None,R,None))))"`
Expected: `rationale on doc: True`.

- [ ] **Step 3: Commit**

```bash
git add overlays/addressbook/templates overlays/addressbook/containers overlays/identifier-schemes
git commit -m "refactor: realign RDF-native write contract onto <> (foaf:Document)"
```

---

## Phase 6 — Integration, agentic probe, regression

### Task 10: Live floor enforcement across all three lanes

**Files:**
- Test: `tests/test_write_contract_e2e.py` (new)

- [ ] **Step 1: Write the integration test**

```python
# tests/test_write_contract_e2e.py
"""Live: the injected WriteContractShape gates every durable lane on mem:rationale (on <>)."""
import httpx, pytest
from tests.conftest import _pod_base, _pod_up, resolve_ca as _ca
CA=_ca() or False; POD=_pod_base()
pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")

def _put(path, body, ct="text/markdown"):
    return httpx.put(f"{POD}{path}", content=body, headers={"Content-Type": ct}, verify=CA)

def test_wiki_without_rationale_422():
    r=_put("/vault/wiki/concepts/e2e-recon-norat.md","---\ntype: concept\n---\n# N\n\n[N]{.prefLabel} b.\n")
    assert r.status_code==422 and "rationale" in r.text

def test_wiki_with_rationale_201():
    r=_put("/vault/wiki/concepts/e2e-recon-ok.md",
           "---\ntype: concept\nrationale: \"recon e2e\"\n---\n# Ok\n\n[Ok]{.prefLabel} b.\n")
    assert r.status_code in (201,205)
```

- [ ] **Step 2: Rebuild + run**

Run:
```bash
make reset && make verify
SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_write_contract_e2e.py -v
```
Expected: `make verify` audit 0 ERROR (all seeds admit under the injected contract); both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/test_write_contract_e2e.py
git commit -m "test: e2e write contract enforcement across lanes via injected WriteContractShape"
```

### Task 11: Agentic probe — the multiple-`st:shape` wiki path

**Files:**
- Create: `evals/write-contract/` (rig, mirroring an existing `evals/<rig>` layout)

- [ ] **Step 1: Build the rig**

Copy an existing eval rig skeleton (`evals/proj-enrich/` is the closest recent template) into `evals/write-contract/`. The task: a cold agent crystallizes a wiki concept to a durable container; success = a first-try 201 (the agent supplies `rationale:` and the write validates against the unioned Page+Thing+leaf+contract set), failure = a 422 loop. Document the launch in the rig README (TLS shim + `$SOLID_AGENT_SKILLS`).

- [ ] **Step 2: Run the probe (manual, 1–2 cold runs)**

Run the rig per its README against a fresh `make reset` Pod. Record the trajectory + verdict in `docs/plans/2026-06-17-write-contract-probe-report.md`.

- [ ] **Step 3: Interpret**

If the agent satisfies the unioned shape set first try → the multiple-`st:shape` mechanism is validated (close the spec's open question). If it loops on a Page-level requirement it didn't expect, record it and consider surfacing the dual-layer set via a composed shape (spec §"Open questions"). Do NOT change the mechanism without a probe datapoint.

- [ ] **Step 4: Commit the report + rig**

```bash
git add evals/write-contract docs/plans/2026-06-17-write-contract-probe-report.md
git commit -m "eval: agentic probe of the multiple-st:shape wiki write path"
```

### Task 12: Full regression

- [ ] **Step 1:** `make reset && make verify` — seed completes, audit 0 ERROR.
- [ ] **Step 2:** `make test-js` — all TS guard suites green (projection + governedPredicates generated file).
- [ ] **Step 3:** `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/ -v` — full suite green (known timemap flake tolerated); the new agreement/codegen/e2e tests pass; the Turtle-lane contract tests pass after de-duplication.
- [ ] **Step 4:** Update FOLLOWUPS/MEMORY: the three-route drift is closed (ShapeTree source of truth + derivation + agreement tests); the write contract is one substrate shape; the markdown-lane branch can redo as the agentic follow-on. Commit.

---

## Self-Review

**Spec coverage:**
- Decision 1 (ShapeTree source of truth, no runtime) → Tasks 3–4, 8 (derivation; declaration-only). ✓
- Decision 2 (derive constrainedBy + codegen governedPredicates + agreement tests) → Tasks 3–4 (constrainedBy), 5 (governedPredicates). ✓
- Decision 3 (one substrate WriteContractShape, injected) → Tasks 1, 3 (injection), 7 (de-dup). ✓
- Decision 4 (`foaf:Document` on `<>`; rationale on document subject) → Tasks 6 (wiki projection), 9 (RDF-native). ✓
- Decision 5 (proto-knowledge: standard hook + laden message) → Task 1 (message), 6 (foaf:Document). ✓
- Decision 6 (big bang, all lanes) → Tasks 7, 8, 9 cover wiki + addressbook + id-schemes. ✓
- `mem:` relocation → Task 2. ✓
- Multiple `st:shape` + agentic verification → Tasks 8 + 11. ✓
- Testing (agreement, per-lane floor, probe, reset/audit) → Tasks 4, 5, 7, 10, 11, 12. ✓

**Placeholder scan:** Task 2 Step 3 and Task 9 Step 1 reference reading exact lines / filling `"<…>"` rationale text — these are concrete authoring actions (copy existing triples / write a real rationale), not unfilled spec gaps. Task 3 Step 3 and Task 5 Step 3 describe generator logic with the exact inputs/outputs/IRIs rather than full source — acceptable because they extend the documented `gen_managers.py` pattern and are gated by the failing tests in their Step 1. No "TBD"/"handle edge cases" placeholders.

**Type/name consistency:** `derive_constrainedby(overlay_dir, container_url) -> set[str]`, `committed_constrainedby`, `DURABLE_CONTAINERS`, `WRITE_CONTRACT_SHAPE` consistent across Tasks 3/4/8. `sub:WriteContractShape`, `foaf:Document`, `mem:rationale` IRIs consistent across Tasks 1/3/5/6/7/9/10. The generated `governedPredicates.ts` keeps `resolveGovernedFromQuads`'s signature (Task 5) so the projection (Task 6) and its consumers compile unchanged.

**Ordering note:** Tasks 3 and 8 are mutually dependent on the wiki tree's multiple-`st:shape` change; Task 3 Step 5 documents the weaken-then-restore approach so either order works.
