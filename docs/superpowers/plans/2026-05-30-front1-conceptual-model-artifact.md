# Front 1 — Legible Conceptual-Model Artifact — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make wiki-memory's conceptual model (page/thing/concept ↔ `<>`/`<#this>` ↔ `dct:title`/`schema:name`/`skos:prefLabel`; SKOS-as-navigation) canonical, single-sourced, cheap-to-acquire, and drift-proof — so agents stop reconstructing it from scratch and the corpus stops drifting.

**Architecture:** The SHACL shapes ARE the normative spine, augmented with `sub:` frame annotations. A dogfooded on-Pod narrative + read-only worked example carries the in-context learning and traces back to the spine. Hand-authored gold exemplars serve simultaneously as worked-example read targets, agreement-test fixtures, and pattern-match corpus. Python agreement tests (the dev-agent guardrail) assert {shape annotations ↔ narrative ↔ gold exemplars} agree. A custom CSS StorageDescriber emits a terse literal model hook at the storage-description entry point (also closing the lone audit WARN).

**Tech Stack:** Turtle (SHACL shapes + `sub:` vocab), Markdown (narrative + exemplars), rdflib + pytest (agreement tests), TypeScript + Components.js (custom StorageDescriber CSS extension), the overlay apply machinery (`overlay:installsShape`/`installsBootstrap` in `manifest.ttl`), `make reset`/`make audit`/`make test`.

**Parent docs:** Decision D108 (`docs/superpowers/specs/2026-05-30-skos-backbone-dual-view-enforcement-decision.md`); Front-1 design (`docs/superpowers/specs/2026-05-30-front1-conceptual-model-artifact-design.md`). **Gates RQ-View-2.**

**Phasing:** **Phase A** (Tasks 1–8) is pure RDF/content/test — no Docker, ships the spine + narrative + exemplars + agreement tests independently. **Phase B** (Tasks 9–11) is the custom StorageDescriber TS extension (needs Docker rebuild) — the entry-point literal hook + WARN fix. Front 1 is valuable after Phase A alone (per spec §9 "ships independently"); Phase B is the delivery enhancement.

**Conventions confirmed (verified against the codebase during plan self-review — do not re-derive):**
- Python: `~/uvws/.venv/bin/python`; live-Pod tests use `httpx` with `verify=False` (mkcert dev) OR `export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem`. No project venv. **No `tests/conftest.py` exists** — the test file is self-contained.
- `sub:` namespace = `https://pod.vardeman.me/vault/ontology/substrate#`; vocab file `overlays/wiki-memory/vocabulary/substrate.ttl` (term pattern: `a rdf:Property ; rdfs:label ; rdfs:comment ; rdfs:isDefinedBy ; rdfs:domain ; rdfs:range ; skos:scopeNote`). **`sub:agentGuide` already exists** at `substrate.ttl:517`.
- Shapes live in `overlays/wiki-memory/shapes/*.shacl.ttl`, declared in `manifest.ttl` via `overlay:installsShape [ overlay:document "shapes/<f>" ; overlay:hostedAt "/vault/meta/shapes/<f>" ]` (structured blank node, NOT a flat string).
- **Content WITH a hand-authored `.meta` deploys via `overlay:installsPage [ overlay:body <path.md> ; overlay:meta <path.md.meta.ttl> ; dct:title "..." ]`** — `apply.py` PUTs the body then PATCHes the `.meta` (manifest.ttl:111 `installsPage`; apply.py:168 `for page in manifest.page_installs`). Source `.meta` files are named `<name>.md.meta.ttl` in the overlay tree (e.g. `synthesis/index.md.meta.ttl`). **`overlay:installsBootstrapContent [ overlay:contentPath "..." ; overlay:hostedAt "..." ]` is body-only** (common.py:270, `BootstrapContent`) — use it only for prose with no required `.meta`. Since our exemplars + narrative need hand-authored `.meta` (pre-Front-2 the projection won't add `prefLabel`), they use **`installsPage`**.
- **The dogfood note `two-hierarchy-memory-addressing.md` IS in the overlay** at `overlays/wiki-memory/concepts/two-hierarchy-memory-addressing.md`, wired via `installsBootstrapContent` (manifest.ttl:153). The narrative this plan adds is its **rework/successor** (richer, frame-explicit), not a reproducibility fix.
- **The entry-point `sub:agentGuide` pointer is in `css/config/void-description.json`** (a `StaticStorageDescriber` term, currently → `two-hierarchy-memory-addressing.md`), NOT in `storage-patch.ttl` (which is INERT — storage-description PATCH = 405). The `void-description.json` comment warns this entry is **hard-required by `shapes/substrate/storage-description.shacl.ttl` (Violation severity)** and its target must HEAD-resolve or `make audit` ERRORs. Repoint it there.
- `StaticStorageDescriber` emits **IRIs only** (cannot emit a string literal) — the entry-point literal model REQUIRES the custom StorageDescriber (Phase B).
- Run overlay scripts as modules: `~/uvws/.venv/bin/python -m scripts.overlay.apply ...`. Verify after reset with `make verify` (waits for async seed) then `make audit` — NOT `make audit` alone (it races the seed).
- Commit prefix `[Agent: Claude]`; co-author trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**Phase A:**
- Modify: `overlays/wiki-memory/vocabulary/substrate.ttl` — add 3 spine terms (`sub:frameRole`, `sub:governsSubject`, `sub:labelProperty`).
- Modify: `overlays/wiki-memory/shapes/{page,thing,concept}.shacl.ttl` — add the 3 frame annotations to each NodeShape. (Subtype shapes person/place/event/organization/howto are thing-frame by inheritance; deliberately NOT annotated this plan — the 3 archetypes carry the model. Noted in §"Scoping".)
- Create: `overlays/wiki-memory/concepts/photosynthesis.md` + `photosynthesis.md.meta.ttl` — hand-authored gold concept exemplar (body + meta).
- Create: `overlays/wiki-memory/concepts/biology.md` + `biology.md.meta.ttl` — the `skos:broader` target concept.
- Create: `overlays/wiki-memory/people/marie-curie.md` + `marie-curie.md.meta.ttl` — a thing-frame (`schema:Person`) exemplar.
- Create: `overlays/wiki-memory/concepts/how-wiki-memory-works.md` + `how-wiki-memory-works.md.meta.ttl` — the narrative memory + read-only worked example (rework/successor of `two-hierarchy-memory-addressing.md`).
- Modify: `overlays/wiki-memory/manifest.ttl` — add `installsPage` entries for narrative + 3 exemplars (body+meta).
- Modify: `css/config/void-description.json` — repoint the `sub:agentGuide` StaticStorageDescriber term → the new narrative (hard-required by the substrate audit shape; target must resolve).
- Create: `tests/test_frame_model_agreement.py` — the agreement tests (spine completeness; narrative↔spine; exemplar↔spine + pyshacl conformance).

Note on container routing: concepts → `/vault/wiki/concepts/`, Person → `/vault/wiki/people/` (per the Type Index, D106). The `overlay:hostedAt` in each `installsPage` entry sets the live path; source files mirror the container under `overlays/wiki-memory/`.

**Phase B:**
- Create: `css/extensions/storage-describer/` — custom CSS StorageDescriber extension (TS + Components.js + package.json + tsconfig + dist-cjs).
- Modify: `css/config/void-description.json` — add the custom describer to the existing `StatusArrayUnionHandler` handler list (additive, composes with the StaticStorageDescribers).
- Modify: `css/Dockerfile` — copy the new extension's dist-cjs (mirror existing extensions).
- Modify: `tests/test_frame_model_agreement.py` — add the entry-point-literal live assertion.

---

## Phase A — Spine + narrative + exemplars + agreement tests (no Docker)

### Task 1: Mint the 3 `sub:` spine terms

**Files:**
- Modify: `overlays/wiki-memory/vocabulary/substrate.ttl`
- Test: `tests/test_frame_model_agreement.py`

- [ ] **Step 1: Write the failing test** (create the test file with the first assertion)

```python
# tests/test_frame_model_agreement.py
from pathlib import Path
from rdflib import Graph, Namespace, URIRef, RDF, RDFS

ROOT = Path(__file__).resolve().parent.parent
OVL = ROOT / "overlays" / "wiki-memory"
SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")

def _g(p: Path) -> Graph:
    g = Graph(); g.parse(p, format="turtle"); return g

def test_spine_terms_defined():
    g = _g(OVL / "vocabulary" / "substrate.ttl")
    for term in ("frameRole", "governsSubject", "labelProperty"):
        t = SUB[term]
        assert (t, RDF.type, None) in g, f"sub:{term} not typed in substrate.ttl"
        assert (t, RDFS.label, None) in g, f"sub:{term} missing rdfs:label"
        assert (t, RDFS.comment, None) in g, f"sub:{term} missing rdfs:comment"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py::test_spine_terms_defined -v`
Expected: FAIL (`sub:frameRole not typed`).

- [ ] **Step 3: Add the 3 terms to `substrate.ttl`** (append after the existing routing/governance block, matching the file's term pattern)

```turtle
# ─────────────────────────────────────────────────────────────
# Frame-model spine (D108) — make each content shape's node-frame
# machine-readable on the shape itself (the normative spine).
# ─────────────────────────────────────────────────────────────

sub:frameRole
    a rdf:Property ;
    rdfs:label "Frame role" ;
    rdfs:comment "The node-frame a content SHACL shape governs: \"page\", \"thing\", or \"concept\" (D108)." ;
    rdfs:domain sh:NodeShape ;
    rdfs:range rdfs:Literal ;
    skos:scopeNote "page = the document resource <>; thing = the entity <#this>; concept = a SKOS unit at <#this>. Read this off a shape to learn which frame it enforces." .

sub:governsSubject
    a rdf:Property ;
    rdfs:label "Governs subject" ;
    rdfs:comment "Which subject of a wiki page's .meta the shape governs: the page document (<>) or the entity (<#this>) (D96/D108)." ;
    rdfs:domain sh:NodeShape ;
    rdfs:range rdfs:Literal ;
    skos:scopeNote "Literal token \"<>\" (page document) or \"<#this>\" (entity). PageShape governs <>; Thing/Concept shapes govern <#this>." .

sub:labelProperty
    a rdf:Property ;
    rdfs:label "Label property" ;
    rdfs:comment "The canonical label property for this shape's frame: dct:title (page), schema:name (thing), or skos:prefLabel (concept) (D108)." ;
    rdfs:domain sh:NodeShape ;
    rdfs:range rdf:Property ;
    skos:scopeNote "The label property an agent must supply (or the substrate must materialize) for a node of this frame. Concepts use skos:prefLabel because the conceptual backbone is SKOS." .
```

- [ ] **Step 4: Run test to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py::test_spine_terms_defined -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/vocabulary/substrate.ttl tests/test_frame_model_agreement.py
git commit -m "[Agent: Claude] D108 Front-1: mint sub: frame-model spine terms

frameRole / governsSubject / labelProperty — make each content shape's
node-frame machine-readable on the shape (the normative spine).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Annotate Page/Thing/Concept shapes with frame metadata

**Files:**
- Modify: `overlays/wiki-memory/shapes/page.shacl.ttl`, `thing.shacl.ttl`, `concept.shacl.ttl`
- Test: `tests/test_frame_model_agreement.py`

- [ ] **Step 1: Write the failing test** (add to the test file)

```python
# the three governed content shapes and their expected frame annotations
SCHEMA = Namespace("https://schema.org/")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
DCT = Namespace("http://purl.org/dc/terms/")
WIKI = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")

# (shape_file, shape_iri, frameRole, governsSubject, labelProperty)
FRAMES = [
    ("page.shacl.ttl",    WIKI.PageShape,    "page",    "<>",     DCT.title),
    ("thing.shacl.ttl",   WIKI.ThingShape,   "thing",   "<#this>", SCHEMA.name),
    ("concept.shacl.ttl", WIKI.ConceptShape, "concept", "<#this>", SKOS.prefLabel),
]

import pytest

@pytest.mark.parametrize("fname,shape,role,subj,labelprop", FRAMES)
def test_shape_declares_frame(fname, shape, role, subj, labelprop):
    g = _g(OVL / "shapes" / fname)
    assert (shape, SUB.frameRole, None) in g, f"{shape} missing sub:frameRole"
    assert str(g.value(shape, SUB.frameRole)) == role
    assert str(g.value(shape, SUB.governsSubject)) == subj
    assert g.value(shape, SUB.labelProperty) == labelprop
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py::test_shape_declares_frame -v`
Expected: FAIL (`PageShape missing sub:frameRole`).

- [ ] **Step 3: Add `@prefix sub:` + the 3 annotations to each shape**

In `page.shacl.ttl` — add the prefix line with the others, then add to the `wiki:PageShape` node (after `sh:targetClass`):
```turtle
@prefix sub:     <https://pod.vardeman.me/vault/ontology/substrate#> .
```
```turtle
    sub:frameRole "page" ;
    sub:governsSubject "<>" ;
    sub:labelProperty dct:title ;
```

In `thing.shacl.ttl` — add `@prefix sub:` (and `@prefix schema:` already present), then to `wiki:ThingShape`:
```turtle
    sub:frameRole "thing" ;
    sub:governsSubject "<#this>" ;
    sub:labelProperty schema:name ;
```

In `concept.shacl.ttl` — add `@prefix sub:`, then to `wiki:ConceptShape`:
```turtle
    sub:frameRole "concept" ;
    sub:governsSubject "<#this>" ;
    sub:labelProperty skos:prefLabel ;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py::test_shape_declares_frame -v`
Expected: PASS (3 parametrized cases).

- [ ] **Step 5: Verify shapes still parse as valid SHACL** (no structural break)

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph; [Graph().parse('overlays/wiki-memory/shapes/%s'%f, format='turtle') for f in ('page.shacl.ttl','thing.shacl.ttl','concept.shacl.ttl')]; print('parse OK')"`
Expected: `parse OK`.

- [ ] **Step 6: Commit**

```bash
git add overlays/wiki-memory/shapes/page.shacl.ttl overlays/wiki-memory/shapes/thing.shacl.ttl overlays/wiki-memory/shapes/concept.shacl.ttl tests/test_frame_model_agreement.py
git commit -m "[Agent: Claude] D108 Front-1: annotate Page/Thing/Concept shapes with frame spine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Hand-author the gold exemplar — concept (body + .meta.ttl)

**Files:**
- Create: `overlays/wiki-memory/concepts/photosynthesis.md`
- Create: `overlays/wiki-memory/concepts/photosynthesis.md.meta.ttl`
- Test: `tests/test_frame_model_agreement.py`

**Why hand-authored `.meta.ttl`:** pre-Front-2 the projection does NOT materialize `skos:prefLabel`; a plain markdown PUT would leave the exemplar non-conformant. We author the `.meta` by hand (source named `<name>.md.meta.ttl`, deployed to the live `.meta` sidecar via `installsPage` in Task 7) so the exemplar is a correct *target* now. (Front 2 later makes the runtime produce this.) The test below reads the source `.md.meta.ttl` directly.

- [ ] **Step 1: Write the failing test** (the exemplar↔spine agreement — the crown assertion)

```python
# exemplar source meta files (named <name>.md.meta.ttl in the overlay tree) and the frame each must satisfy
EX_DIR = OVL / "concepts"   # concept exemplars live in the concepts container
EXEMPLARS = [
    # (meta_file, entity_subject_suffix, shape_label_prop)
    ("photosynthesis.md.meta.ttl", "photosynthesis.md#this", SKOS.prefLabel),
]

@pytest.mark.parametrize("meta,subj_suffix,labelprop", EXEMPLARS)
def test_exemplar_materializes_frame_label(meta, subj_suffix, labelprop):
    g = _g(EX_DIR / meta)
    # find the entity subject (ends with the suffix)
    subj = [s for s in set(g.subjects()) if str(s).endswith(subj_suffix)]
    assert subj, f"entity subject ...{subj_suffix} not found in {meta}"
    s = subj[0]
    assert (s, labelprop, None) in g, f"{s} missing required {labelprop} (frame label)"

def test_exemplar_concept_is_skos_concept():
    g = _g(EX_DIR / "photosynthesis.md.meta.ttl")
    s = URIRef([str(x) for x in g.subjects() if str(x).endswith("photosynthesis.md#this")][0])
    assert (s, RDF.type, SKOS.Concept) in g, "exemplar concept not typed skos:Concept"
    assert (s, SKOS.broader, None) in g, "exemplar concept missing a skos:broader hop"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -k exemplar -v`
Expected: FAIL (file not found / no quads).

- [ ] **Step 3: Author the exemplar body**

`overlays/wiki-memory/concepts/photosynthesis.md`:
```markdown
---
title: Photosynthesis
type: Concept
---
# Photosynthesis

The process by which plants convert light into chemical energy.
A worked-example concept demonstrating all three label frames and a SKOS [[Biology]]{.broader} navigation hop.
```

- [ ] **Step 4: Author the exemplar `.meta.ttl`** (hand-authored; both subjects correct, `prefLabel` present)

`overlays/wiki-memory/concepts/photosynthesis.md.meta.ttl`:
```turtle
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .
@prefix skos:   <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:   <https://pod.vardeman.me/vault/ontology/wiki#> .

<photosynthesis.md>
    a wiki:Page ;
    dct:title "Photosynthesis" ;
    rdfs:label "Photosynthesis" ;
    schema:mainEntity <photosynthesis.md#this> .

<photosynthesis.md#this>
    a skos:Concept ;
    schema:name "Photosynthesis" ;
    skos:prefLabel "Photosynthesis" ;
    rdfs:label "Photosynthesis" ;
    skos:definition "The process by which plants convert light into chemical energy." ;
    skos:broader <biology.md#this> ;
    schema:mainEntityOfPage <photosynthesis.md> .
```

- [ ] **Step 5: Run test to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -k exemplar -v`
Expected: PASS.

- [ ] **Step 6: Validate the exemplar `.meta` actually conforms to the deployed shapes** (real SHACL, not just presence)

```python
# add to test file
import pyshacl

def _shapes_graph():
    g = Graph()
    for f in ("page.shacl.ttl", "thing.shacl.ttl", "concept.shacl.ttl"):
        g.parse(OVL / "shapes" / f, format="turtle")
    return g

def test_exemplar_concept_conforms_to_shapes():
    data = _g(EX_DIR / "photosynthesis.md.meta.ttl")
    conforms, _, report = pyshacl.validate(
        data, shacl_graph=_shapes_graph(), inference="none")
    assert conforms, f"gold exemplar violates its own shapes:\n{report}"
```

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py::test_exemplar_concept_conforms_to_shapes -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add overlays/wiki-memory/concepts/photosynthesis.md overlays/wiki-memory/concepts/photosynthesis.md.meta.ttl tests/test_frame_model_agreement.py
git commit -m "[Agent: Claude] D108 Front-1: gold exemplar concept (all 3 frames, prefLabel, SKOS hop)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Hand-author the `broader` target + a thing exemplar (so the hop + thing-frame resolve)

**Files:**
- Create: `overlays/wiki-memory/concepts/biology.md` (+ `.md.meta.ttl`) — the `skos:broader` target (a concept).
- Create: `overlays/wiki-memory/people/marie-curie.md` (+ `.md.meta.ttl`) — a `schema:Person` thing exemplar (demonstrates the thing-frame: `schema:name`, no `prefLabel`).
- Test: `tests/test_frame_model_agreement.py`

- [ ] **Step 1: Write the failing test**

```python
PEOPLE_DIR = OVL / "people"

def test_broader_target_exists_and_conforms():
    p = EX_DIR / "biology.md.meta.ttl"
    assert p.exists(), "skos:broader target biology.md.meta.ttl missing (would dangle)"
    data = _g(p)
    conforms, _, report = pyshacl.validate(data, shacl_graph=_shapes_graph(), inference="none")
    assert conforms, f"biology exemplar violates shapes:\n{report}"

def test_thing_exemplar_uses_schema_name_not_preflabel():
    g = _g(PEOPLE_DIR / "marie-curie.md.meta.ttl")
    s = URIRef([str(x) for x in g.subjects() if str(x).endswith("marie-curie.md#this")][0])
    assert (s, SCHEMA.name, None) in g, "person thing missing schema:name"
    assert (s, RDF.type, SCHEMA.Person) in g
    # thing-frame: a Person is not a concept, must NOT carry prefLabel
    assert (s, SKOS.prefLabel, None) not in g, "person wrongly carries skos:prefLabel (frame confusion)"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -k "broader_target or thing_exemplar" -v`
Expected: FAIL (files missing).

- [ ] **Step 3: Author `biology.md` + `.md.meta.ttl`** (in `overlays/wiki-memory/concepts/`)

`concepts/biology.md`:
```markdown
---
title: Biology
type: Concept
---
# Biology

The study of living organisms. Broader topic of [[Photosynthesis]]{.narrower}.
```
`concepts/biology.md.meta.ttl`:
```turtle
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .
@prefix skos:   <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:   <https://pod.vardeman.me/vault/ontology/wiki#> .

<biology.md>
    a wiki:Page ; dct:title "Biology" ; rdfs:label "Biology" ;
    schema:mainEntity <biology.md#this> .
<biology.md#this>
    a skos:Concept ; schema:name "Biology" ; skos:prefLabel "Biology" ; rdfs:label "Biology" ;
    skos:narrower <photosynthesis.md#this> ;
    schema:mainEntityOfPage <biology.md> .
```

- [ ] **Step 4: Author `marie-curie.md` + `.md.meta.ttl`** (thing-frame exemplar — `schema:Person`, in `overlays/wiki-memory/people/`)

`people/marie-curie.md`:
```markdown
---
title: Marie Curie
type: Person
---
# Marie Curie

Physicist and chemist; a worked-example *thing* (entity), not a concept.
```
`people/marie-curie.md.meta.ttl`:
```turtle
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:   <https://pod.vardeman.me/vault/ontology/wiki#> .

<marie-curie.md>
    a wiki:Page ; dct:title "Marie Curie" ; rdfs:label "Marie Curie" ;
    schema:mainEntity <marie-curie.md#this> .
<marie-curie.md#this>
    a schema:Person ; schema:name "Marie Curie" ; rdfs:label "Marie Curie" ;
    schema:givenName "Marie" ; schema:familyName "Curie" ;
    schema:mainEntityOfPage <marie-curie.md> .
```
Note: the person exemplar `<#this>` is typed only `schema:Person` (not `schema:Thing`), so under `inference="none"` ThingShape (targetClass `schema:Thing`) does not fire — `schema:name` is present for frame correctness, not to satisfy a firing constraint. PersonShape (targetClass `schema:Person`) has no required fields beyond the optional ones, so it conforms. This matches live projection behavior (concepts/people are typed by their leaf class only).

- [ ] **Step 5: Run tests to verify they pass**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -k "broader_target or thing_exemplar" -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add overlays/wiki-memory/concepts/biology.md overlays/wiki-memory/concepts/biology.md.meta.ttl overlays/wiki-memory/people/marie-curie.md overlays/wiki-memory/people/marie-curie.md.meta.ttl tests/test_frame_model_agreement.py
git commit -m "[Agent: Claude] D108 Front-1: broader-target + person thing exemplars

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Write the narrative memory + read-only worked example

**Files:**
- Create: `overlays/wiki-memory/concepts/how-wiki-memory-works.md`
- Create: `overlays/wiki-memory/concepts/how-wiki-memory-works.md.meta.ttl` (hand-authored, so the narrative — itself a concept — conforms with `prefLabel`)
- Test: `tests/test_frame_model_agreement.py`

The narrative is content, but the agreement test (Task 6) pins its load-bearing claims. This task authors it to satisfy a structural test now.

- [ ] **Step 1: Write the failing test** (structural — required sections + the frame table the agreement test will cross-check)

```python
NARRATIVE = OVL / "concepts" / "how-wiki-memory-works.md"
REQUIRED_HEADINGS = [
    "The model in 30 seconds",
    "SKOS is the conceptual backbone",
    "The write recipe",
    "The validation contract",
    "The correction protocol",
    "Worked example",
]

def test_narrative_has_required_sections():
    assert NARRATIVE.exists(), "narrative memory missing"
    text = NARRATIVE.read_text()
    for h in REQUIRED_HEADINGS:
        assert h in text, f"narrative missing section: {h}"

def test_narrative_states_each_frame_label():
    text = NARRATIVE.read_text()
    # the three frame label-property names must appear (drift guard with the spine)
    for token in ("dct:title", "schema:name", "skos:prefLabel"):
        assert token in text, f"narrative omits frame label property {token}"
    # and the worked example must point at the gold exemplar + its shape
    assert "photosynthesis.md" in text, "worked example must reference the gold exemplar"
    assert "sub:labelProperty" in text or "sub:frameRole" in text, "worked example must trace to the spine annotations"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -k narrative -v`
Expected: FAIL (file missing).

- [ ] **Step 3: Author the narrative** (`overlays/wiki-memory/concepts/how-wiki-memory-works.md`)

```markdown
---
title: How Wiki-Memory Works
type: Concept
---
# How Wiki-Memory Works

This Pod's memory is a **SKOS concept scheme**. Concepts are the backbone; notes/pages are
memories that attach to concepts via typed edges. Read this before writing.

## The model in 30 seconds

Every wiki page has TWO subjects in its `.meta`, and each gets a different label property:

| Node frame | Subject | Label property | Shape | What it is |
|---|---|---|---|---|
| page | `<>` | `dct:title` | PageShape | the document/record |
| thing | `<#this>` | `schema:name` | ThingShape | the entity (person, org, place) |
| concept | `<#this>` | `skos:prefLabel` | ConceptShape | a SKOS unit of meaning |

`schema:name` and `skos:prefLabel` are NOT redundant: a concept's `<#this>` carries both — the
entity name (Thing-level) AND its canonical term (Concept-level, one per language, with
`skos:altLabel` synonyms).

## SKOS is the conceptual backbone

`skos:broader`/`narrower`/`related` are the real navigation axis (D105/D106), not decoration.
Concepts form the scheme; you navigate meaning by traversing them. That is why a concept MUST
have a `skos:prefLabel` — it is the term SKOS navigation labels results with.

## The write recipe

Write a markdown body + frontmatter. `type: Concept` (or Person, Organization, …) sets the
`<#this>` class; body wikilinks `[[Target]]{.role}` project to typed edges (the `.role` picks
the predicate; the container of the target is resolved from the target's class via the Type
Index — D106). The substrate projects your body into the `.meta` graph view.

## The validation contract

Per D81, the substrate governs a declared set of predicates; you own the rest.
- **Derived for you** (do not hand-write): `rdfs:label`, `schema:name`, page/thing plumbing.
- **You must supply** (judgment — not inferable): `skos:prefLabel` on a concept; `dct:identifier`
  on a Source (a DOI/arXiv id); the right `skos:broader`.
- A write that omits required judgment metadata is rejected (see correction protocol).

## The correction protocol

If a write violates a shape you get an HTTP `422` with a SHACL `sh:ValidationReport`. Read the
`sh:resultMessage` + `sh:resultPath` — they name the missing/invalid predicate — fix the body or
`.meta`, and re-write. Example: omitting `skos:prefLabel` on a concept yields a report with
`sh:resultPath skos:prefLabel ; sh:resultMessage "Less than 1 value"`. Fix: add a `prefLabel`.

## Worked example (read-only — try this)

1. GET the document view: `GET /vault/wiki/concepts/photosynthesis.md` — the markdown body.
2. GET the graph view: `GET /vault/wiki/concepts/photosynthesis.md.meta` — observe on
   `<photosynthesis.md#this>`: `a skos:Concept`, `schema:name`, **`skos:prefLabel`**,
   `skos:broader <biology.md#this>`. Two subjects, two/three label frames.
3. Find the model through the spine: `GET /vault/meta/shapes/concept.shacl.ttl` — observe
   `sub:frameRole "concept" ; sub:governsSubject "<#this>" ; sub:labelProperty skos:prefLabel`.
   The shape both *enforces* and *describes* the concept frame.
4. Follow the SKOS hop: `GET /vault/wiki/concepts/biology.md.meta` — the broader concept, itself
   carrying `skos:prefLabel`, so navigation results are labelable in-frame.

Now you have the pattern: write the body, supply `prefLabel` for concepts, let the substrate
project the rest, and correct against the `422` if you miss a required field.
```

- [ ] **Step 4: Author the narrative's `.meta.ttl`** (so it conforms as a concept — `overlays/wiki-memory/concepts/how-wiki-memory-works.md.meta.ttl`)

```turtle
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .
@prefix skos:   <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:   <https://pod.vardeman.me/vault/ontology/wiki#> .

<how-wiki-memory-works.md>
    a wiki:Page ; dct:title "How Wiki-Memory Works" ; rdfs:label "How Wiki-Memory Works" ;
    schema:mainEntity <how-wiki-memory-works.md#this> .
<how-wiki-memory-works.md#this>
    a skos:Concept ;
    schema:name "How Wiki-Memory Works" ;
    skos:prefLabel "How Wiki-Memory Works" ;
    rdfs:label "How Wiki-Memory Works" ;
    skos:definition "The conceptual model of this Pod's memory: three node-frames and the SKOS backbone." ;
    schema:mainEntityOfPage <how-wiki-memory-works.md> .
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -k narrative -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add overlays/wiki-memory/concepts/how-wiki-memory-works.md overlays/wiki-memory/concepts/how-wiki-memory-works.md.meta.ttl tests/test_frame_model_agreement.py
git commit -m "[Agent: Claude] D108 Front-1: narrative memory + read-only worked example

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The narrative↔spine agreement test (drift guard across artifacts)

**Files:**
- Test: `tests/test_frame_model_agreement.py`

This is the dev-agent guardrail core: the narrative's frame table, the shape annotations, and the gold exemplars must all agree. A dev-agent that changes one without the others gets a red with a specific message.

- [ ] **Step 1: Write the failing-then-passing agreement test**

```python
def test_narrative_frame_table_matches_spine():
    """The narrative's frame table rows must match each shape's sub: annotations.
    Drift guard: change a shape's labelProperty without the narrative -> red."""
    text = NARRATIVE.read_text()
    for fname, shape, role, subj, labelprop in FRAMES:
        g = _g(OVL / "shapes" / fname)
        decl_role = str(g.value(shape, SUB.frameRole))
        decl_label = g.value(shape, SUB.labelProperty)
        # the narrative table row for this role must name the same label property
        # find the markdown row containing the role token
        rows = [ln for ln in text.splitlines() if ln.strip().startswith("| " + decl_role + " ")]
        assert rows, f"narrative frame table has no row for role '{decl_role}'"
        label_short = str(decl_label).split("/")[-1].split("#")[-1]
        # label_short e.g. 'title','name','prefLabel'; the row must reference the prefixed form
        prefixed = {"title": "dct:title", "name": "schema:name", "prefLabel": "skos:prefLabel"}[label_short]
        assert prefixed in rows[0], (
            f"narrative role '{decl_role}' row says {rows[0].strip()!r} but shape "
            f"{shape} declares sub:labelProperty {prefixed} — FRAME DRIFT between narrative and spine")
```

- [ ] **Step 2: Run the full agreement suite**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -v`
Expected: ALL PASS.

- [ ] **Step 3: Prove the drift guard works** (temporarily mutate, confirm red, revert)

Temporarily change `concept.shacl.ttl`'s `sub:labelProperty skos:prefLabel` → `schema:name`, run the suite, confirm `test_narrative_frame_table_matches_spine` AND `test_exemplar_concept_conforms_to_shapes`-area tests fail with the drift message, then `git checkout overlays/wiki-memory/shapes/concept.shacl.ttl`.

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -v` (after revert)
Expected: ALL PASS again.

- [ ] **Step 4: Commit**

```bash
git add tests/test_frame_model_agreement.py
git commit -m "[Agent: Claude] D108 Front-1: narrative<->spine drift-guard agreement test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Wire narrative + exemplars into the overlay manifest (installsPage); repoint agentGuide

**Files:**
- Modify: `overlays/wiki-memory/manifest.ttl`
- Modify: `css/config/void-description.json`
- Test: `tests/test_frame_model_agreement.py`

**Mechanism (verified):** content with a hand-authored `.meta` deploys via `overlay:installsPage [ overlay:body <body.md> ; overlay:meta <body.md.meta.ttl> ; dct:title "..." ]` (apply.py:168 PUTs body then PATCHes `.meta`). The `hostedAt`/live container is determined by the body's resolved path; mirror the existing `installsPage` entry at manifest.ttl:111 for exact predicate shape. The `sub:agentGuide` entry-point pointer lives in `css/config/void-description.json` (a StaticStorageDescriber term), NOT in the inert `storage-patch.ttl`.

- [ ] **Step 0: Read the existing `installsPage` entry to copy its exact predicate shape**

Run: `sed -n '108,160p' overlays/wiki-memory/manifest.ttl`
Note the exact predicates (`overlay:body`, `overlay:meta`, `dct:title`, and any `overlay:hostedAt`/container predicate) and replicate them.

- [ ] **Step 1: Write the failing test** (manifest installs the 4 pages via installsPage with body+meta; agentGuide in void-description.json points at the narrative)

```python
import json
OVERLAY_NS = Namespace("https://pod.vardeman.me/vault/ontology/overlay#")
VOID_DESC = ROOT / "css" / "config" / "void-description.json"
SUB_AGENTGUIDE = "https://pod.vardeman.me/vault/ontology/substrate#agentGuide"

def test_manifest_installs_narrative_and_exemplars_as_pages():
    g = _g(OVL / "manifest.ttl")
    bodies = {str(o) for o in g.objects(None, OVERLAY_NS.body)}
    expected = {
        "concepts/how-wiki-memory-works.md",
        "concepts/photosynthesis.md",
        "concepts/biology.md",
        "people/marie-curie.md",
    }
    missing = expected - bodies
    assert not missing, f"installsPage missing bodies: {missing}"
    # each must also declare a meta sibling
    metas = {str(o) for o in g.objects(None, OVERLAY_NS.meta)}
    for b in expected:
        assert b + ".meta.ttl" in metas, f"{b} installsPage entry missing overlay:meta"

def test_agentguide_in_void_points_at_narrative():
    data = json.loads(VOID_DESC.read_text())
    # find the StaticStorageDescriber term whose key is sub:agentGuide
    found = []
    def walk(o):
        if isinstance(o, dict):
            if o.get("StaticStorageDescriber:_terms_key") == SUB_AGENTGUIDE:
                found.append(o.get("StaticStorageDescriber:_terms_value"))
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(data)
    assert found, "no sub:agentGuide StaticStorageDescriber term in void-description.json"
    assert any("how-wiki-memory-works.md" in v for v in found), \
        f"agentGuide still points elsewhere: {found}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -k "manifest_installs or agentguide_in_void" -v`
Expected: FAIL.

- [ ] **Step 3: Add four `installsPage` entries to `manifest.ttl`** (mirroring the shape from Step 0; container via the same predicate the existing entry uses)

```turtle
    overlay:installsPage [
        overlay:body <concepts/how-wiki-memory-works.md> ;
        overlay:meta <concepts/how-wiki-memory-works.md.meta.ttl> ;
        dct:title "How Wiki-Memory Works (conceptual model + worked example)"
    ] , [
        overlay:body <concepts/photosynthesis.md> ;
        overlay:meta <concepts/photosynthesis.md.meta.ttl> ;
        dct:title "Photosynthesis (gold exemplar concept)"
    ] , [
        overlay:body <concepts/biology.md> ;
        overlay:meta <concepts/biology.md.meta.ttl> ;
        dct:title "Biology (broader-concept exemplar)"
    ] , [
        overlay:body <people/marie-curie.md> ;
        overlay:meta <people/marie-curie.md.meta.ttl> ;
        dct:title "Marie Curie (thing-frame exemplar)"
    ] ;
```
**IMPORTANT:** match the existing `installsPage` entry's predicate set exactly (Step 0). If it uses an explicit container/`hostedAt` predicate rather than deriving the path from the body filename, add it (concepts → `/vault/wiki/concepts/`, person → `/vault/wiki/people/`). Confirm `manifest.page_installs` parsing in `common.py` accepts multiple `installsPage` blank nodes (it iterates, so multiple are fine).

- [ ] **Step 4: Repoint `sub:agentGuide` in `css/config/void-description.json`**

Find the StaticStorageDescriber term with key `https://pod.vardeman.me/vault/ontology/substrate#agentGuide` (near end of file, value currently `…/wiki/concepts/two-hierarchy-memory-addressing.md`) and change the value to `https://pod.vardeman.me/vault/wiki/concepts/how-wiki-memory-works.md`. (Per the in-file comment, this is hard-required by the substrate audit shape and must HEAD-resolve — which it will, since Task 7 deploys it.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -k "manifest_installs or agentguide_in_void" -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add overlays/wiki-memory/manifest.ttl css/config/void-description.json tests/test_frame_model_agreement.py
git commit -m "[Agent: Claude] D108 Front-1: install narrative+exemplars (installsPage); agentGuide->narrative

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Deploy to a fresh Pod + live verification (Phase A end-to-end)

**Files:** none (verification task).

- [ ] **Step 1: Rebuild a clean Pod**

Run: `make reset && make verify`
Expected: `make reset` completes; pod-setup applies the wiki-memory overlay (including the 4 new `installsPage` entries); `make verify` waits for the async seed then audits.

- [ ] **Step 2: Verify the narrative + exemplars are live**

Run:
```bash
export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem
for u in how-wiki-memory-works photosynthesis biology; do
  echo "$u: $(curl -sk -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/wiki/concepts/$u.md)"
done
echo "marie-curie: $(curl -sk -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/wiki/people/marie-curie.md)"
```
Expected: all `200`. (If a Person routes elsewhere per the live Type Index, adjust — but `people/` is the D98 container.)

- [ ] **Step 3: Verify the gold exemplar `.meta` materialized `prefLabel` live** (deployed by installsPage's `overlay:meta` PATCH)

Run: `curl -sk https://pod.vardeman.me/vault/wiki/concepts/photosynthesis.md.meta | grep -i prefLabel`
Expected: a `skos:prefLabel "Photosynthesis"` line on `#this`.
**If empty:** the `installsPage` `overlay:meta` PATCH didn't land — check `apply.py:168` page-install handler ran for the new entries and the `.meta.ttl` parsed; re-run `make reset && make verify`, re-check. (installsPage is the proven body+meta mechanism, so this should just work — unlike the body-only `installsBootstrapContent`.)

- [ ] **Step 4: Verify the spine annotations are live on the shape**

Run: `curl -sk https://pod.vardeman.me/vault/meta/shapes/concept.shacl.ttl | grep -i "frameRole\|labelProperty\|governsSubject"`
Expected: the 3 `sub:` annotations present.

- [ ] **Step 5: Run the full agreement suite + the substrate audit against the live Pod**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -v && make audit`
Expected: tests PASS; audit `0 ERROR` (WARN count unchanged from baseline — the entry-point literal WARN is closed only in Phase B).

- [ ] **Step 6: Commit any apply.py fix from Step 3** (only if the page-install handler needed a change)

```bash
git add scripts/overlay/apply.py
git commit -m "[Agent: Claude] D108 Front-1: fix overlay page-install meta deploy (if needed)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Phase A is independently shippable here.** The conceptual model is canonical (spine), reproducible (overlay), delivered (narrative + agentGuide + shape discovery), and drift-guarded (agreement tests). Phase B adds the entry-point literal.

---

## Phase B — Entry-point literal hook (custom StorageDescriber; closes the lone audit WARN)

### Task 9: Scaffold the custom StorageDescriber CSS extension

**Files:**
- Create: `css/extensions/storage-describer/package.json`, `tsconfig.json`, `.componentsjs-generator-config.json`, `src/index.ts`, `src/FrameModelStorageDescriber.ts`
- Reference: invoke the `css-extension` skill; read an existing extension (`css/extensions/memento/` or `markdown-projection/`) for the package.json `lsd:*` fields + Dockerfile symlink trick; read upstream CSS `StaticStorageDescriber` for the `StorageDescriber` interface (the `getMetadata`/handle signature that yields RDF quads on the storage subject).

- [ ] **Step 1: Read the references** (no code yet)

Run: `ls css/extensions/memento/ && sed -n '1,40p' css/extensions/memento/package.json`
Then locate the upstream describer interface:
Run: `grep -rl "StorageDescriber" css/extensions/*/node_modules/@solid/community-server/dist 2>/dev/null | head` and read the `.d.ts`.
Goal: confirm the method that yields quads for the storage description and its signature.

- [ ] **Step 2: Scaffold package.json + tsconfig + componentsjs config** following the `css-extension` skill exactly (CommonJS, `lsd:components`/`lsd:contexts`/`lsd:importPaths`, dist-cjs output — mirror `markdown-projection`'s working config since Front-2/Dockerfile already builds `dist-cjs`).

- [ ] **Step 3: Commit the scaffold**

```bash
git add css/extensions/storage-describer/
git commit -m "[Agent: Claude] D108 Front-1: scaffold custom StorageDescriber extension

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Implement + unit-test the literal-emitting describer

**Files:**
- Create: `css/extensions/storage-describer/src/FrameModelStorageDescriber.ts`
- Test: `css/extensions/storage-describer/test/FrameModelStorageDescriber.test.ts` (vitest, mirroring the test setup in `markdown-projection`)

- [ ] **Step 1: Write the failing unit test** — the describer yields a quad `<storageSubject> sh:agentInstruction "<literal>"` where the literal contains the 30-second model.

```typescript
// pseudocode-precise; adapt imports to the confirmed interface
import { FrameModelStorageDescriber } from "../src/FrameModelStorageDescriber";
import { DataFactory } from "n3";

test("emits a literal sh:agentInstruction on the storage subject", async () => {
  const d = new FrameModelStorageDescriber();
  const subject = DataFactory.namedNode("https://pod.vardeman.me/vault/");
  const quads = await d.describe(subject); // adapt to confirmed method name
  const ai = quads.find(q => q.predicate.value === "http://www.w3.org/ns/shacl#agentInstruction");
  expect(ai).toBeTruthy();
  expect(ai!.object.termType).toBe("Literal");
  expect(ai!.object.value).toContain("SKOS concept");
  expect(ai!.object.value).toContain("three");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd css/extensions/storage-describer && npm test`
Expected: FAIL (class not implemented).

- [ ] **Step 3: Implement `FrameModelStorageDescriber`** — yields one literal quad. The literal text (terse, ≤ one screen):

```
This Pod's memory is a SKOS concept backbone. Every wiki page has three node-frames:
the page document <> (dct:title), the entity <#this> (schema:name), and — for concepts —
the SKOS unit <#this> (skos:prefLabel). Writes are validated by SHACL shapes; a 422 returns
a sh:ValidationReport you correct against. Read the agentGuide before writing.
```
Emit it as `sh:agentInstruction` on the storage subject (in addition to whatever the static describer emits — this is additive, like the MetadataWriter composition pattern D67).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd css/extensions/storage-describer && npm test`
Expected: PASS.

- [ ] **Step 5: Build + commit**

```bash
cd css/extensions/storage-describer && npm run build:cjs   # match markdown-projection's working build (D107 Phase 3)
cd ../../.. && git add css/extensions/storage-describer/
git commit -m "[Agent: Claude] D108 Front-1: implement literal entry-point sh:agentInstruction describer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Wire the describer into CSS config; deploy; verify the WARN is closed

**Files:**
- Modify: `css/config/solid-config.json` (or `void-description.json`) — register the custom describer alongside/replacing the StaticStorageDescriber, composing additively.
- Modify: `css/Dockerfile` if needed (mirror how other extensions' dist-cjs are copied).
- Test: `tests/test_frame_model_agreement.py` (live assertion).

- [ ] **Step 1: Write the failing live test** (skip if Pod unavailable)

```python
import os, httpx, pytest

POD = "https://pod.vardeman.me/vault/.well-known/solid"

def _pod_up():
    try:
        return httpx.get(POD, verify=False, timeout=3).status_code == 200
    except Exception:
        return False

@pytest.mark.skipif(not _pod_up(), reason="live Pod unavailable")
def test_entrypoint_emits_literal_agent_instruction():
    g = Graph(); g.parse(data=httpx.get(POD, verify=False, headers={"Accept":"text/turtle"}).text, format="turtle")
    SH = Namespace("http://www.w3.org/ns/shacl#")
    lits = [o for o in g.objects(None, SH.agentInstruction) if isinstance(o, Literal)]
    assert lits, "entry point has no literal sh:agentInstruction (custom describer not wired)"
    assert any("SKOS" in str(o) for o in lits)
```

- [ ] **Step 2: Run to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py::test_entrypoint_emits_literal_agent_instruction -v`
Expected: FAIL (no literal yet — describer not deployed).

- [ ] **Step 3: Wire the describer** in `solid-config.json` (follow `components-override` skill for additive insertion; the describer composes with the static one). Rebuild image if Dockerfile needs the new dist-cjs.

- [ ] **Step 4: Deploy clean + verify**

Run: `make reset && ~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py::test_entrypoint_emits_literal_agent_instruction -v`
Expected: PASS.

- [ ] **Step 5: Verify the audit WARN is closed**

Run: `make audit`
Expected: `0 ERROR`; the lone "entry-point lacks `sh:agentInstruction`" WARN is gone (WARN count drops by 1).

- [ ] **Step 6: Full suite + commit**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -v
git add css/config/ css/Dockerfile tests/test_frame_model_agreement.py
git commit -m "[Agent: Claude] D108 Front-1: wire entry-point literal describer; close lone audit WARN

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria (whole plan)

- `make reset` reproduces: augmented shapes, the narrative memory, the gold exemplars (with materialized `prefLabel`), and the entry-point literal.
- `~/uvws/.venv/bin/python -m pytest tests/test_frame_model_agreement.py -v` all green.
- `make audit` `0 ERROR` and the entry-point `sh:agentInstruction` WARN closed.
- A cold agent at `.well-known/solid` reads the 30-second model in the response; the narrative's worked example lets it confirm the frames read-only and trace them to the spine.
- Drift guard proven: mutating a shape's `sub:labelProperty` without the narrative/exemplar turns the suite red with a specific message.

## Scoping

- **Frame annotations cover the 3 archetypes** (Page/Thing/Concept). The subtype shapes
  person/place/event/organization/howto are **thing-frame by inheritance** (`<#this>` entity,
  `schema:name`) and source is thing-frame `<#this>` plus `dct:identifier`; they are deliberately
  NOT annotated this plan to keep the spine minimal. The agreement tests iterate only the 3
  archetypes (`FRAMES`). A later pass MAY annotate subtypes if a dev-agent guardrail over all
  governed shapes proves needed — out of scope here (YAGNI).
- **`two-hierarchy-memory-addressing.md`** stays as-is (still installed, still the `broader`-rich
  addressing exemplar). The new narrative is the frame-model entry point; whether to merge the two
  is the low-priority decision in "Notes / deferred."

## Notes / deferred (not this plan)

- **Front 2** (separate spec): in-band/synchronous projection (RQ-Enforce-1), `ldp:constrainedBy` on durable wiki containers, runtime auto-materialization of `prefLabel`/`rdfs:label`, the live 422 write-gate. The gold exemplars become Front-2 test targets; the narrative's 422 example becomes live-triggerable.
- Decide at execution whether to merge/retire `two-hierarchy-memory-addressing.md` (now complemented by the frame-model narrative) or keep both as distinct concepts — low priority, not blocking. (It is overlay-installed, not live-only.)
- After this plan lands, **RQ-View-2** is unblocked — resume the dual-view cold-probe eval against the corrected structure.
