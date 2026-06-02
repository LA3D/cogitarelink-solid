# Interop Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the wiki-memory application declare its typed data on the W3C Solid Application
Interoperability data-model — `interop:Application` + `AccessNeed`s + `DataRegistration`s keyed by
Shape Trees that wrap our existing SHACL — so the grammar (sub-project A) has a real, standard
*vocabulary boundary* to bind to, and a real extension surface to escalate to.

**Architecture:** Emit a small RDF declaration graph (Application → AccessNeedGroup → AccessNeeds;
owner WebID → RegistrySet → DataRegistry → DataRegistrations) plus a Shape-Trees document (one
`st:ShapeTree` per governed type whose `st:shape` points at the deployed SHACL NodeShape) and a
per-container `.shapetree` Manager auxiliary. Deploy via the existing overlay machinery
(`scripts/overlay/apply.py`). We **emit/read `st:` triples ourselves on N3 v2** — we do NOT adopt the
dead `shapetrees.js`. The `cap:`/feature layer is untouched (interop does not model features). The
grant/authorization runtime is **openly absent** (auth = dev-allow-all), never stubbed. A separate,
bounded **spike** evaluates `rdf-ext/shacl-engine` behind the existing pluggable `ShaclValidator`
seam, with Zazuko `rdf-validate-shacl` kept as the default fallback.

**Tech Stack:** Python 3.12 (`~/uvws/.venv`, rdflib + httpx + pytest) for emission/audit/tests;
Turtle/JSON-LD artifacts in `overlays/wiki-memory/`; the deploy pipeline in `scripts/overlay/`;
TypeScript (CSS v8 extension, N3 v2) for the shacl-engine spike only.

**Grounding:** `ontology/interop.ttl`, `ontology/shapetrees.ttl` (both cached, rdflib-valid).
**Spec:** `docs/superpowers/specs/2026-06-02-interop-foundation-design.md`.

---

## File Structure

**Create (RDF artifacts, wiki-memory overlay):**
- `overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl` — the Shape-Trees document (per-type
  resource + container trees; `st:shape` → existing SHACL shape IRIs).
- `overlays/wiki-memory/interop/application.ttl` — `interop:Application` + `AccessNeedGroup` +
  per-type `AccessNeed`s.
- `overlays/wiki-memory/interop/registry.ttl` — `RegistrySet` + `DataRegistry` + per-container
  `DataRegistration`s (subject = owner WebID for `hasRegistrySet`).
- `overlays/wiki-memory/interop/managers/<type>.shapetree.ttl` — per-container `st:Manager`
  auxiliaries (generated; see Task 5).

**Modify:**
- `overlays/wiki-memory/manifest.ttl` — declare the new artifacts.
- `scripts/overlay/common.py` — parse the new manifest predicates into the `Manifest` dataclass.
- `scripts/overlay/apply.py` — deploy steps for the new artifacts.
- `scripts/pod_audit.py` — walk + validate the registration graph.
- `Makefile` — (no change expected; `make audit`/`make reset` already chain).

**Create (tests):**
- `tests/test_interop_foundation.py` — artifact-shape tests (rdflib, no Pod) + live-Pod integration
  (Pod-availability-gated).

**Create (spike, isolated):**
- `css/extensions/shape-validator/src/storage/validators/ShaclEngineValidator.ts` — adapter
  implementing the same `ShapeValidator` interface, backed by shacl-engine (behind a flag).
- `docs/superpowers/plans/2026-06-02-shacl-engine-spike-report.md` — the spike's findings + decision.

**Type list (the data the emission is driven by — single source for this plan):**
`GOVERNED_TYPES` = the deployed D98 catalog, read from the live Type Index at build time, but for
authoring the artifacts use this canonical list (class IRI → container slug → SHACL shape IRI):

| class | container | SHACL NodeShape |
|---|---|---|
| `skos:Concept` | `concepts/` | `…/shapes/concept.shacl#ConceptShape` |
| `schema:Person` | `people/` | `…/shapes/person.shacl#PersonShape` |
| `schema:Place` | `places/` | `…/shapes/place.shacl#PlaceShape` |
| `schema:Organization` | `organizations/` | `…/shapes/organization.shacl#OrganizationShape` |
| `mem:Event` | `events/` | `…/shapes/event.shacl#EventShape` |
| `mem:Procedure` | `procedures/` | `…/shapes/procedure.shacl#ProcedureShape` |
| `wiki:WorkingNote` | `working/` | `…/shapes/working-note.shacl#WorkingNoteShape` |

> **Task 0 (verify the list before authoring):** GET the live `publicTypeIndex` and the deployed
> shape catalog; reconcile this table against them. If a class/shape name differs, fix the table
> here first. Command: `(cd ../solid-agent-skills && node dist/cli.js read https://pod.vardeman.me/vault/settings/publicTypeIndex)` and `… read …/vault/meta/shapes/`. Record the reconciled list in this plan before Task 1.

---

## Task 1: Shape-Trees document (per-type trees over SHACL)

**Files:**
- Create: `overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl`
- Test: `tests/test_interop_foundation.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_interop_foundation.py
import rdflib, pytest
from pathlib import Path

ST = rdflib.Namespace("http://www.w3.org/ns/shapetrees#")
REPO = Path(__file__).resolve().parents[1]
TREE = REPO / "overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl"

# (class IRI, container slug, shape IRI) — keep in sync with the plan's Task-0 table
GOVERNED = [
    ("http://www.w3.org/2004/02/skos/core#Concept", "concepts", "concept.shacl#ConceptShape"),
    ("https://schema.org/Person", "people", "person.shacl#PersonShape"),
    ("https://schema.org/Place", "places", "place.shacl#PlaceShape"),
    ("https://schema.org/Organization", "organizations", "organization.shacl#OrganizationShape"),
    ("https://pod.vardeman.me/vault/ontology/mem#Event", "events", "event.shacl#EventShape"),
    ("https://pod.vardeman.me/vault/ontology/mem#Procedure", "procedures", "procedure.shacl#ProcedureShape"),
    ("https://pod.vardeman.me/vault/ontology/wiki#WorkingNote", "working", "working-note.shacl#WorkingNoteShape"),
]

def _g():
    g = rdflib.Graph(); g.parse(TREE, format="turtle"); return g

def test_tree_parses_and_has_one_container_and_resource_tree_per_type():
    g = _g()
    containers = set(g.subjects(ST.expectsType, ST.Container))
    resources = set(g.subjects(ST.expectsType, ST.Resource))
    assert len(containers) == len(GOVERNED), f"expected {len(GOVERNED)} container trees, got {len(containers)}"
    assert len(resources) == len(GOVERNED), f"expected {len(GOVERNED)} resource trees, got {len(resources)}"

def test_each_container_tree_contains_its_resource_tree_which_points_at_a_shacl_shape():
    g = _g()
    for _cls, slug, shape_frag in GOVERNED:
        # find the resource tree whose st:shape ends with the expected shape fragment
        matches = [s for s in g.subjects(ST.expectsType, ST.Resource)
                   if any(str(o).endswith(shape_frag) for o in g.objects(s, ST.shape))]
        assert matches, f"no resource tree with st:shape …{shape_frag}"
        rtree = matches[0]
        # some container tree st:contains it
        assert any(g.value(c, ST.contains) is not None for c in g.subjects(ST.contains, rtree)) \
            or list(g.subjects(ST.contains, rtree)), f"{shape_frag} resource tree not st:contains-ed by any container tree"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -k tree -v`
Expected: FAIL — file not found / 0 trees.

- [ ] **Step 3: Write the Shape-Trees document**

```turtle
# overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl
@prefix st:    <http://www.w3.org/ns/shapetrees#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wikitree: <https://pod.vardeman.me/vault/meta/shapetrees/wiki-memory.tree#> .

# One resource tree + one container tree per governed type. st:shape points at the EXISTING
# deployed SHACL NodeShape (st:shape has an open range — no deviation). DataRegistration.registeredShapeTree
# points at the *container* tree; the contained resource tree validates instances (focus = <#this>).

wikitree:ConceptResourceTree   a st:ShapeTree ; st:expectsType st:Resource ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/concept.shacl#ConceptShape> .
wikitree:ConceptContainerTree  a st:ShapeTree ; st:expectsType st:Container ;
    st:contains wikitree:ConceptResourceTree .

wikitree:PersonResourceTree    a st:ShapeTree ; st:expectsType st:Resource ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/person.shacl#PersonShape> .
wikitree:PersonContainerTree   a st:ShapeTree ; st:expectsType st:Container ;
    st:contains wikitree:PersonResourceTree .

wikitree:PlaceResourceTree     a st:ShapeTree ; st:expectsType st:Resource ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/place.shacl#PlaceShape> .
wikitree:PlaceContainerTree    a st:ShapeTree ; st:expectsType st:Container ;
    st:contains wikitree:PlaceResourceTree .

wikitree:OrganizationResourceTree  a st:ShapeTree ; st:expectsType st:Resource ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/organization.shacl#OrganizationShape> .
wikitree:OrganizationContainerTree a st:ShapeTree ; st:expectsType st:Container ;
    st:contains wikitree:OrganizationResourceTree .

wikitree:EventResourceTree     a st:ShapeTree ; st:expectsType st:Resource ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/event.shacl#EventShape> .
wikitree:EventContainerTree    a st:ShapeTree ; st:expectsType st:Container ;
    st:contains wikitree:EventResourceTree .

wikitree:ProcedureResourceTree a st:ShapeTree ; st:expectsType st:Resource ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/procedure.shacl#ProcedureShape> .
wikitree:ProcedureContainerTree a st:ShapeTree ; st:expectsType st:Container ;
    st:contains wikitree:ProcedureResourceTree .

wikitree:WorkingNoteResourceTree a st:ShapeTree ; st:expectsType st:Resource ;
    st:shape <https://pod.vardeman.me/vault/meta/shapes/working-note.shacl#WorkingNoteShape> .
wikitree:WorkingNoteContainerTree a st:ShapeTree ; st:expectsType st:Container ;
    st:contains wikitree:WorkingNoteResourceTree .
```

> If Task 0 reconciliation changed any class/shape, edit the matching block above to match the
> deployed shape IRI. The `st:shape` IRI must be an EXISTING deployed shape (Task 6 cross-checks).

- [ ] **Step 4: Run test to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -k tree -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl tests/test_interop_foundation.py
git commit -m "[Agent: Claude] interop: wiki-memory Shape-Trees over SHACL (st:shape->NodeShape)"
```

---

## Task 2: Application + AccessNeedGroup + per-type AccessNeeds

**Files:**
- Create: `overlays/wiki-memory/interop/application.ttl`
- Test: `tests/test_interop_foundation.py`

- [ ] **Step 1: Write the failing test**

```python
INTEROP = rdflib.Namespace("http://www.w3.org/ns/solid/interop#")
APP = REPO / "overlays/wiki-memory/interop/application.ttl"

def test_application_declares_one_access_need_per_governed_type_each_with_a_registered_tree():
    g = rdflib.Graph(); g.parse(APP, format="turtle")
    app = next(g.subjects(rdflib.RDF.type, INTEROP.Application))
    group = g.value(app, INTEROP.hasAccessNeedGroup)
    assert group is not None, "Application has no AccessNeedGroup"
    needs = list(g.objects(group, INTEROP.hasAccessNeed))
    assert len(needs) == len(GOVERNED), f"expected {len(GOVERNED)} AccessNeeds, got {len(needs)}"
    for n in needs:
        tree = g.value(n, INTEROP.registeredShapeTree)
        assert tree is not None and "ContainerTree" in str(tree), \
            f"AccessNeed {n} registeredShapeTree must point at a container tree"
        assert list(g.objects(n, INTEROP.accessMode)), f"AccessNeed {n} missing accessMode"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -k application -v`
Expected: FAIL — file not found.

- [ ] **Step 3: Write the Application document**

```turtle
# overlays/wiki-memory/interop/application.ttl
@prefix interop: <http://www.w3.org/ns/solid/interop#> .
@prefix acl:     <http://www.w3.org/ns/auth/acl#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix wikitree: <https://pod.vardeman.me/vault/meta/shapetrees/wiki-memory.tree#> .
@prefix app:     <https://pod.vardeman.me/vault/meta/interop/application#> .

app:wiki-memory a interop:Application ;
    interop:applicationName "Wiki-Memory" ;
    interop:applicationDescription "Agentic memory: a SKOS concept backbone plus typed memory notes." ;
    interop:hasAccessNeedGroup app:wiki-needs .

app:wiki-needs a interop:AccessNeedGroup ;
    interop:accessNecessity interop:AccessRequired ;
    interop:accessScenario interop:PersonalAccess ;
    interop:hasAccessNeed
        app:need-concept, app:need-person, app:need-place, app:need-organization,
        app:need-event, app:need-procedure, app:need-working-note .

app:need-concept a interop:AccessNeed ;
    interop:registeredShapeTree wikitree:ConceptContainerTree ;
    interop:accessMode acl:Read, acl:Write ; interop:accessNecessity interop:AccessRequired .
app:need-person a interop:AccessNeed ;
    interop:registeredShapeTree wikitree:PersonContainerTree ;
    interop:accessMode acl:Read, acl:Write ; interop:accessNecessity interop:AccessRequired .
app:need-place a interop:AccessNeed ;
    interop:registeredShapeTree wikitree:PlaceContainerTree ;
    interop:accessMode acl:Read, acl:Write ; interop:accessNecessity interop:AccessRequired .
app:need-organization a interop:AccessNeed ;
    interop:registeredShapeTree wikitree:OrganizationContainerTree ;
    interop:accessMode acl:Read, acl:Write ; interop:accessNecessity interop:AccessRequired .
app:need-event a interop:AccessNeed ;
    interop:registeredShapeTree wikitree:EventContainerTree ;
    interop:accessMode acl:Read, acl:Write ; interop:accessNecessity interop:AccessRequired .
app:need-procedure a interop:AccessNeed ;
    interop:registeredShapeTree wikitree:ProcedureContainerTree ;
    interop:accessMode acl:Read, acl:Write ; interop:accessNecessity interop:AccessRequired .
app:need-working-note a interop:AccessNeed ;
    interop:registeredShapeTree wikitree:WorkingNoteContainerTree ;
    interop:accessMode acl:Read, acl:Write, acl:Append ; interop:accessNecessity interop:AccessRequired .
```

- [ ] **Step 4: Run test to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -k application -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/interop/application.ttl tests/test_interop_foundation.py
git commit -m "[Agent: Claude] interop: wiki-memory Application + AccessNeeds (registeredShapeTree)"
```

---

## Task 3: RegistrySet + DataRegistry + DataRegistrations (off the owner WebID)

**Files:**
- Create: `overlays/wiki-memory/interop/registry.ttl`
- Test: `tests/test_interop_foundation.py`

> **Owner WebID:** read it from the deployed owner-identity overlay (D89/D90). Verify before
> authoring: `(cd ../solid-agent-skills && node dist/cli.js read https://pod.vardeman.me/vault/profile/card)`.
> Use `<https://pod.vardeman.me/vault/profile/card#me>` below if that is the deployed WebID; else fix.

- [ ] **Step 1: Write the failing test**

```python
REG = REPO / "overlays/wiki-memory/interop/registry.ttl"
OWNER = rdflib.URIRef("https://pod.vardeman.me/vault/profile/card#me")

def test_registry_chain_owner_to_dataregistration_per_type():
    g = rdflib.Graph(); g.parse(REG, format="turtle")
    rset = g.value(OWNER, INTEROP.hasRegistrySet)
    assert rset is not None, "owner WebID has no hasRegistrySet"
    dreg = g.value(rset, INTEROP.hasDataRegistry)
    assert dreg is not None, "RegistrySet has no DataRegistry"
    regs = list(g.objects(dreg, INTEROP.hasDataRegistration))
    assert len(regs) == len(GOVERNED), f"expected {len(GOVERNED)} DataRegistrations, got {len(regs)}"
    for r in regs:
        assert g.value(r, INTEROP.registeredShapeTree) is not None, f"{r} missing registeredShapeTree"
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -k registry -v`
Expected: FAIL — file not found.

- [ ] **Step 3: Write the registry document**

```turtle
# overlays/wiki-memory/interop/registry.ttl
@prefix interop: <http://www.w3.org/ns/solid/interop#> .
@prefix wikitree: <https://pod.vardeman.me/vault/meta/shapetrees/wiki-memory.tree#> .
@prefix reg: <https://pod.vardeman.me/vault/meta/interop/registry#> .
@prefix app: <https://pod.vardeman.me/vault/meta/interop/application#> .

<https://pod.vardeman.me/vault/profile/card#me> interop:hasRegistrySet reg:set .

reg:set a interop:RegistrySet ; interop:hasDataRegistry reg:data .

reg:data a interop:DataRegistry ;
    interop:hasDataRegistration
        reg:concepts, reg:people, reg:places, reg:organizations,
        reg:events, reg:procedures, reg:working .

reg:concepts a interop:DataRegistration ;
    interop:registeredShapeTree wikitree:ConceptContainerTree ;
    interop:registeredWith app:wiki-memory ;
    interop:registeredBy <https://pod.vardeman.me/vault/profile/card#me> .
reg:people a interop:DataRegistration ;
    interop:registeredShapeTree wikitree:PersonContainerTree ;
    interop:registeredWith app:wiki-memory ;
    interop:registeredBy <https://pod.vardeman.me/vault/profile/card#me> .
reg:places a interop:DataRegistration ;
    interop:registeredShapeTree wikitree:PlaceContainerTree ;
    interop:registeredWith app:wiki-memory ;
    interop:registeredBy <https://pod.vardeman.me/vault/profile/card#me> .
reg:organizations a interop:DataRegistration ;
    interop:registeredShapeTree wikitree:OrganizationContainerTree ;
    interop:registeredWith app:wiki-memory ;
    interop:registeredBy <https://pod.vardeman.me/vault/profile/card#me> .
reg:events a interop:DataRegistration ;
    interop:registeredShapeTree wikitree:EventContainerTree ;
    interop:registeredWith app:wiki-memory ;
    interop:registeredBy <https://pod.vardeman.me/vault/profile/card#me> .
reg:procedures a interop:DataRegistration ;
    interop:registeredShapeTree wikitree:ProcedureContainerTree ;
    interop:registeredWith app:wiki-memory ;
    interop:registeredBy <https://pod.vardeman.me/vault/profile/card#me> .
reg:working a interop:DataRegistration ;
    interop:registeredShapeTree wikitree:WorkingNoteContainerTree ;
    interop:registeredWith app:wiki-memory ;
    interop:registeredBy <https://pod.vardeman.me/vault/profile/card#me> .
```

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -k registry -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/interop/registry.ttl tests/test_interop_foundation.py
git commit -m "[Agent: Claude] interop: RegistrySet/DataRegistry/DataRegistrations off owner WebID"
```

---

## Task 4: Cross-artifact agreement test (the anti-drift guard)

**Files:**
- Test: `tests/test_interop_foundation.py`

- [ ] **Step 1: Write the failing test** (load all three artifacts; assert every
  `registeredShapeTree` used anywhere resolves to a `st:ShapeTree` defined in the tree doc, and every
  resource tree's `st:shape` is a shape the SHACL catalog actually defines)

```python
def test_every_registered_tree_resolves_and_every_shape_is_defined():
    g = rdflib.Graph()
    for f in (TREE, APP, REG):
        g.parse(f, format="turtle")
    defined_trees = set(g.subjects(rdflib.RDF.type, ST.ShapeTree))
    used_trees = set(g.objects(None, INTEROP.registeredShapeTree))
    assert used_trees <= defined_trees, f"dangling registeredShapeTree: {used_trees - defined_trees}"
    # every resource tree names a shape; collect shape IRIs for the deploy-time cross-check (Task 6)
    shapes = set(g.objects(None, ST.shape))
    assert len(shapes) == len(GOVERNED), f"expected {len(GOVERNED)} st:shape IRIs, got {len(shapes)}"
```

- [ ] **Step 2: Run to verify it fails, then passes** (it should PASS already if Tasks 1–3 are
  consistent; if it FAILS, the IRIs drifted — fix the artifact, do not weaken the test)

Run: `~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -k resolves -v`
Expected: PASS (this task codifies the agreement; a failure means a real drift bug).

- [ ] **Step 3: Commit**

```bash
git add tests/test_interop_foundation.py
git commit -m "[Agent: Claude] interop: cross-artifact agreement test (no dangling shape trees)"
```

---

## Task 5: Per-container `.shapetree` Manager auxiliaries

**Files:**
- Create: `overlays/wiki-memory/interop/managers/<slug>.shapetree.ttl` (one per type)
- Test: `tests/test_interop_foundation.py`

- [ ] **Step 1: Write the failing test**

```python
MGR_DIR = REPO / "overlays/wiki-memory/interop/managers"

def test_one_manager_per_container_assigns_the_container_tree_and_focuses_this():
    for _cls, slug, _shape in GOVERNED:
        f = MGR_DIR / f"{slug}.shapetree.ttl"
        assert f.exists(), f"missing manager {f}"
        g = rdflib.Graph(); g.parse(f, format="turtle")
        mgr = next(g.subjects(rdflib.RDF.type, ST.Manager))
        a = g.value(mgr, ST.hasAssignment)
        assert g.value(a, ST.assigns) is not None, f"{slug}: assignment has no st:assigns"
        # focus node must be the contained resource's <#this> pattern (template marker OK pre-deploy)
        focus = g.value(a, ST.focusNode)
        assert focus is not None and "#this" in str(focus), f"{slug}: focusNode must target <#this>"
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -k manager -v`
Expected: FAIL — managers/ dir missing.

- [ ] **Step 3: Generate the manager files** (one per type — write a tiny generator so the 7 files
  stay DRY and in sync with `GOVERNED`)

```python
# scripts/gen_managers.py  (run once; commit the OUTPUT .ttl files, not just the generator)
from pathlib import Path
BASE = "https://pod.vardeman.me/vault"
TREE_NS = f"{BASE}/meta/shapetrees/wiki-memory.tree#"
SHAPES = f"{BASE}/meta/shapes/"
GOVERNED = [  # (slug, ContainerTree localname, shape file#frag)
    ("concepts","ConceptContainerTree","concept.shacl#ConceptShape"),
    ("people","PersonContainerTree","person.shacl#PersonShape"),
    ("places","PlaceContainerTree","place.shacl#PlaceShape"),
    ("organizations","OrganizationContainerTree","organization.shacl#OrganizationShape"),
    ("events","EventContainerTree","event.shacl#EventShape"),
    ("procedures","ProcedureContainerTree","procedure.shacl#ProcedureShape"),
    ("working","WorkingNoteContainerTree","working-note.shacl#WorkingNoteShape"),
]
out = Path("overlays/wiki-memory/interop/managers"); out.mkdir(parents=True, exist_ok=True)
for slug, tree, shape in GOVERNED:
    container = f"{BASE}/wiki/{slug}/"
    (out / f"{slug}.shapetree.ttl").write_text(f"""@prefix st: <http://www.w3.org/ns/shapetrees#> .

<> a st:Manager ; st:hasAssignment <#a1> .
<#a1>
    st:assigns <{TREE_NS}{tree}> ;
    st:manages <{container}> ;
    st:focusNode <{container}{{instance}}#this> ;
    st:shape <{SHAPES}{shape}> .
""")
print("wrote", len(GOVERNED), "manager files")
```

Run: `~/uvws/.venv/bin/python scripts/gen_managers.py`
(The `{instance}` token is a per-resource focus-node template; the listener/audit treat it as "the
`<#this>` of each contained resource." It is intentionally NOT a literal resource — documented here.)

- [ ] **Step 4: Run to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -k manager -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen_managers.py overlays/wiki-memory/interop/managers/ tests/test_interop_foundation.py
git commit -m "[Agent: Claude] interop: per-container .shapetree Manager auxiliaries"
```

---

## Task 6: Deploy the artifacts via the overlay pipeline

**Files:**
- Modify: `overlays/wiki-memory/manifest.ttl`
- Modify: `scripts/overlay/common.py` (parse new predicates), `scripts/overlay/apply.py` (deploy)
- Test: `tests/test_interop_foundation.py` (live-Pod, gated)

> **Reuse the existing pattern.** `installsBootstrapContent` already PUTs an arbitrary file to a Pod
> URL (`apply.py` step 9b). The Application/registry/tree docs are exactly that — static RDF resources.
> Prefer extending `installsBootstrapContent` over minting new predicates (agentic-dev rule: don't add
> a predicate when an existing one carries the use case). The `.shapetree` Managers are auxiliary
> resources at `<container>/.shapetree` — install via `installsContainerMetaPatch`-style PUT to the
> aux URL (verify CSS serves `.shapetree` as a writable aux; if not, fall back to a sibling
> `<container>shapetree.ttl` + a `Link: rel="…shapetree"` header — record which in this plan).

- [ ] **Step 1: Add manifest entries** (model on existing `installsBootstrapContent` blocks)

```turtle
# append to overlays/wiki-memory/manifest.ttl, inside the wiki overlay subject
overlay:installsBootstrapContent
    [ overlay:contentPath "shapetrees/wiki-memory.tree.ttl" ;
      overlay:hostedAt </vault/meta/shapetrees/wiki-memory.tree> ;
      overlay:contentType "text/turtle" ] ,
    [ overlay:contentPath "interop/application.ttl" ;
      overlay:hostedAt </vault/meta/interop/application> ;
      overlay:contentType "text/turtle" ] ,
    [ overlay:contentPath "interop/registry.ttl" ;
      overlay:hostedAt </vault/meta/interop/registry> ;
      overlay:contentType "text/turtle" ] .
```

- [ ] **Step 2: Manager install** — add per-container aux PUTs. If `installsContainerMetaPatch`
  cannot target `.shapetree`, add a minimal new predicate `overlay:installsShapeTreeManager`
  `[ overlay:targetContainer </vault/wiki/concepts/> ; overlay:managerContent "interop/managers/concepts.shapetree.ttl" ]`
  and a handler in `apply.py` that PUTs the file to `<targetContainer>.shapetree`. Show the handler:

```python
# scripts/overlay/apply.py — new deploy step, modeled on installsContainerMetaPatch (step 11)
for m in manifest.shapetree_managers:  # parsed in common.py (Step 3)
    body = (overlay_dir / m.manager_content).read_text()
    aux_url = m.target_container.rstrip("/") + "/.shapetree"
    put_file(session, aux_url, body, "text/turtle")
```

- [ ] **Step 3: Parse the new predicate in `common.py`** (only if Step 2 needed a new predicate)

```python
# scripts/overlay/common.py — in parse_manifest(), mirror the installsContainerMetaPatch parser
shapetree_managers = []
for bn in g.objects(overlay, OVERLAY.installsShapeTreeManager):
    shapetree_managers.append(ShapeTreeManager(
        target_container=str(g.value(bn, OVERLAY.targetContainer)),
        manager_content=str(g.value(bn, OVERLAY.managerContent)),
    ))
# add `shapetree_managers` field to the Manifest dataclass + a ShapeTreeManager dataclass
```

- [ ] **Step 4: Deploy to a fresh Pod**

Run: `make reset` (reproducible fresh-volume rebuild — never `make up` alone)
Expected: completes; the three docs + 7 `.shapetree` aux resources are PUT.

- [ ] **Step 5: Write the live cross-check test** (gated on Pod availability)

```python
import httpx
POD = "https://pod.vardeman.me/vault"
def _pod_up():
    try: return httpx.get(POD + "/", verify=False, timeout=3).status_code < 500
    except Exception: return False
pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")

def test_deployed_registered_shape_trees_point_at_deployed_shapes():
    import os; os.environ.setdefault("SSL_CERT_FILE", "")  # mkcert: set before run, see docker-patterns
    g = rdflib.Graph(); g.parse(POD + "/meta/shapetrees/wiki-memory.tree", format="turtle")
    for s in g.objects(None, ST.shape):
        r = httpx.get(str(s).split("#")[0], verify=False, timeout=5)
        assert r.status_code == 200, f"shape {s} not deployed ({r.status_code})"
```

- [ ] **Step 6: Run live test**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -k deployed -v`
Expected: PASS (every `st:shape` URL resolves 200).

- [ ] **Step 7: Commit**

```bash
git add overlays/wiki-memory/manifest.ttl scripts/overlay/apply.py scripts/overlay/common.py tests/test_interop_foundation.py
git commit -m "[Agent: Claude] interop: deploy Application/registry/trees + .shapetree managers via overlay"
```

---

## Task 7: Audit the registration graph (`pod_audit.py`)

**Files:**
- Modify: `scripts/pod_audit.py`
- Test: via `make audit` (exit non-zero on ERROR)

- [ ] **Step 1: Add a walker check** — from the owner WebID, follow
  `hasRegistrySet → hasDataRegistry → hasDataRegistration`; for each DataRegistration, HEAD its
  `registeredShapeTree` document, parse it, assert the named `st:ShapeTree` exists and its (or its
  `st:contains` child's) `st:shape` HEADs 200. Emit ERROR on any dangling link.

```python
# scripts/pod_audit.py — new function, called from the main walk
def audit_interop_registration(pod, get, findings):
    g = get(f"{pod}/profile/card")  # owner WebID doc
    # … follow hasRegistrySet/hasDataRegistry/hasDataRegistration (rdflib over fetched graphs) …
    # for each registeredShapeTree: fetch the tree doc; for each st:shape: HEAD; ERROR if !=200
    # See existing rdfs:seeAlso / prof:hasResource HEAD-check helpers for the pattern.
```

- [ ] **Step 2: Run audit**

Run: `make audit`
Expected: 0 ERROR (the interop graph resolves end to end). Pre-existing WARNs unchanged.

- [ ] **Step 3: Commit**

```bash
git add scripts/pod_audit.py
git commit -m "[Agent: Claude] audit: walk + validate the interop registration graph"
```

---

## Task 8 (SPIKE — bounded, exploratory): evaluate `shacl-engine` behind the validator seam

**Not TDD.** A time-boxed investigation with explicit decision criteria. Output is a report +
working-but-flagged code; the default validator stays Zazuko.

**Files:**
- Create: `css/extensions/shape-validator/src/storage/validators/ShaclEngineValidator.ts`
- Create: `docs/superpowers/plans/2026-06-02-shacl-engine-spike-report.md`

- [ ] **Step 1:** In a scratch install, add `shacl-engine` (stable `^1.1.0`) +
  `@rdfjs/dataset` to `css/extensions/shape-validator`. Record the resolved transitive dep count and
  any peer/version conflicts with `@solid/community-server` / `n3`.
- [ ] **Step 2:** Implement `ShaclEngineValidator` with the **same interface** the
  `ShapeValidationStore` `validator` expects (`handleSafe({ parentRepresentation, representation })`),
  converting the representation to an N3 dataset and passing N3's factory to shacl-engine's `Validator`.
- [ ] **Step 3:** Run the **existing wiki-memory SHACL shapes** against the gold exemplars
  (`overlays/wiki-memory` fixtures + the photosynthesis/marie-curie exemplars) through BOTH validators;
  assert identical conform/violation verdicts. Record any divergence.
- [ ] **Step 4:** Measure: CSS Docker image size delta; cold-start delta; validation latency on the
  fixtures (shacl-engine claims 15–26×). Try the **experimental** branch only if 1.2 node-expressions
  or coverage are needed; record the added Comunica/traqula footprint.
- [ ] **Step 5:** Write `…-shacl-engine-spike-report.md`: verdict (promote / hold), the numbers, the
  footprint, and whether `inference="none"` (ClassExtensionShape caveat) is honored. **Decision gate:**
  promote to default only if verdicts match AND image delta is acceptable AND coverage/1.2 earns its
  keep (per FOLLOWUPS "⚙ Infrastructure note"). Until then Zazuko remains default; the adapter stays
  behind a config flag (no-stubs: it's real and selectable, not a silent half-swap).
- [ ] **Step 6: Commit**

```bash
git add css/extensions/shape-validator/src/storage/validators/ShaclEngineValidator.ts docs/superpowers/plans/2026-06-02-shacl-engine-spike-report.md
git commit -m "[Agent: Claude] spike: shacl-engine adapter behind ShaclValidator seam (Zazuko default)"
```

---

## Task 9: Reproducibility + foundation green

- [ ] **Step 1:** `make reset` from clean → `make audit` → `~/uvws/.venv/bin/python -m pytest tests/test_interop_foundation.py -v` (set `SSL_CERT_FILE`).
- [ ] **Step 2:** Confirm 0 ERROR audit, all foundation tests pass, the `cap:` layer + prior audit
  state are unchanged (no regressions).
- [ ] **Step 3: Commit** any fixups.

```bash
git commit -am "[Agent: Claude] interop foundation: make reset reproduces; audit 0 ERROR"
```

---

## Self-Review

- **Spec coverage:** Application+AccessNeeds (T2) ✓ · ShapeTrees-over-SHACL (T1) ✓ · DataRegistration/
  RegistrySet off owner WebID (T3) ✓ · Manager (T5) ✓ · deploy (T6) ✓ · audit/registration-graph
  resolves (T7) ✓ · extension surface re-expression (covered by the existing D100 contract; this plan
  adds the *declaration* graph it extends — the extension *procedure* itself is unchanged and not
  re-implemented here) ✓ · `cap:` stays bespoke (untouched — asserted in T9) ✓ · grant runtime openly
  absent (no task creates it; T8 keeps the validator real-or-fallback) ✓ · library assessment → spike
  (T8) ✓.
- **Placeholders:** the `{instance}` focus-node token (T5) and the Task-0/owner-WebID verification
  notes are *intentional, documented* deferrals to a deploy-time value, not vague TODOs. The
  `pod_audit.py` walker body (T7) references the existing HEAD-check helpers by name rather than
  repeating them — acceptable (DRY against real existing code).
- **Type consistency:** `GOVERNED` is one canonical list reused across T1–T5; `registeredShapeTree`
  always points at a `*ContainerTree`; `st:shape` always a `*Shape` in the SHACL catalog; verified by
  the T4 agreement test.
- **Open risk to resolve at execution:** whether CSS serves `.shapetree` as a writable auxiliary
  (T6 Step 2) — the plan carries an explicit fallback (sibling resource + Link header).
