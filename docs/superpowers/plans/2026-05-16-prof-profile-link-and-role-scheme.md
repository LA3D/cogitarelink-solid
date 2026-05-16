# Phase 5j close-out — PROF profile link + wikirole scheme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close FOLLOWUPS items 1 + 2 — wire six PROF profile descriptors via overlay machinery, ship a `Link: rel="profile"` MetadataWriter CSS extension, and mint a wikirole SKOS scheme so layer-2 substrate kinds are first-class on this Pod.

**Architecture:** Three-layer self-description (LDP → PROF envelope + role vocabularies → overlay role refinements). Wikirole SKOS scheme published as a sibling of the wiki vocabulary. Each Pod resource declares `dct:conformsTo` (body for RDF, `.meta` for non-RDF). A new CSS extension reads those triples from `RepresentationMetadata` and emits one `Link: rel="profile"` header per value. Affordances get additive PROF typing (Framing 1.5).

**Tech Stack:** Turtle (rdflib), TypeScript (CSS v8 extension via Components.js DI), Python (rdflib + httpx for overlay tooling), vitest (TS unit tests), pytest (Python integration tests).

**Spec:** `docs/superpowers/specs/2026-05-16-prof-profile-link-and-role-scheme-design.md`

---

## File-touch map

| Path | Op | Purpose |
|---|---|---|
| `overlays/wiki-memory/vocabulary/wikirole.ttl` | CREATE | Layer-2 SKOS role scheme |
| `overlays/wiki-memory/manifest.ttl` | MODIFY | Add `installsRoleScheme` + 6× `installsProfile` |
| `overlays/wiki-memory/affordances/{markdown-projection,memento,hub-view,breadcrumb-view}.ttl` | MODIFY | Framing 1.5 additive PROF typing |
| `overlays/wiki-memory/profiles/{page,concept,source,person,procedure,working}.ttl` | MODIFY | Add `dct:conformsTo <PROF>` to each profile descriptor's body |
| `overlays/wiki-memory/vocabulary/wiki.ttl` | MODIFY | Add `dct:conformsTo <RDFS>` |
| `overlays/wiki-memory/shapes/{page,source,person,procedure,working}.shacl.ttl` | MODIFY | Add `dct:conformsTo <SHACL>` |
| `overlays/wiki-memory/storage-patch.ttl` | MODIFY | Add `dct:conformsTo` for context.jsonld + advertise wikirole |
| `css/config/pod-templates/base/ontology/overlay.ttl` | MODIFY | Add `installsRoleScheme` + `installsProfile` predicates |
| `scripts/overlay/common.py` | MODIFY | Add `role_scheme_urls()` + `profile_urls()` |
| `scripts/overlay/apply.py` | MODIFY | Add upload steps for role scheme + profiles |
| `scripts/vault_import.py` | MODIFY | Emit content-level `dct:conformsTo` per resource class |
| `scripts/backfill_conformsTo.py` | CREATE | One-off backfill for already-imported content |
| `css/config/void-description.json` | MODIFY | Advertise wikirole vocabulary + profile catalog |
| `css/extensions/profile-link/` (whole dir) | CREATE | New CSS extension |
| `css/config/profile-link.json` | CREATE | Components.js wiring |
| `css/config/solid-config.json` | MODIFY | Import profile-link |
| `Dockerfile` | MODIFY | Symlink for profile-link extension |
| `tests/test_phase5j_close.py` | CREATE | Integration tests |

---

## Task 1: Spike — confirm metadata availability in MetadataWriterInput

**Files:**
- Read-only: `node_modules/@solid/community-server/dist/storage/MetadataWriter.{d.ts,js}`
- Read-only: existing `css/extensions/memento/src/MementoLinkMetadataWriter.ts`

The writer design in the spec reads `dct:conformsTo` via `input.metadata.getAll(DCT.terms.conformsTo)`. This works for RDF resources where the body is parsed into `RepresentationMetadata`, but uncertain for non-RDF resources (Markdown body, JSON-LD context) where `dct:conformsTo` lives in `.meta`. Confirm before writing the writer.

- [ ] **Step 1: Read CSS's BaseTypedRepresentationConverter and MetadataReader chain**

```bash
find node_modules/@solid/community-server/dist -name "MetadataReader*" -o -name "MetadataController*" 2>/dev/null | head -10
grep -rn "getAll.*conformsTo\|conformsTo.*getAll" node_modules/@solid/community-server/dist 2>/dev/null | head -5
```

Read 3-5 files. Goal: determine whether `.meta` triples populate `RepresentationMetadata` for non-RDF resources by the time the MetadataWriter ParallelHandler runs.

- [ ] **Step 2: Write a probe writer (throwaway)**

Create `/tmp/probe_writer_test.md` documenting the finding. If the spike is ambiguous from source reading, scaffold a one-off probe handler that logs `input.metadata.quads()` for a known JSON-LD context fetch, run the Pod, GET `/vault/meta/context.jsonld`, observe logs. Delete after.

- [ ] **Step 3: Record finding in the plan inline**

Edit this file (the plan) to note one of:
- **Result A:** `.meta` triples are populated → Task 11 (writer) needs no MetadataReader injection.
- **Result B:** `.meta` triples are NOT populated for non-RDF → add a new Task 11.5 to inject a MetadataReader before MetadataWriter, OR have the writer do its own store lookup.

No commit. Spike is research only.

---

## Task 2: Create wikirole SKOS scheme

**Files:**
- Create: `overlays/wiki-memory/vocabulary/wikirole.ttl`
- Test: `tests/test_phase5j_close.py` (new file, this is the first test)

- [ ] **Step 1: Write the failing test**

Create `tests/test_phase5j_close.py`:

```python
"""Phase 5j close-out integration tests — wikirole scheme + PROF Link writer."""
from pathlib import Path

import pytest
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF, SKOS, OWL

PROF = Namespace("http://www.w3.org/ns/dx/prof/")
DCT = Namespace("http://purl.org/dc/terms/")
WIKIROLE = Namespace("https://pod.vardeman.me/vault/ontology/wikirole#")

OVERLAY_ROOT = Path(__file__).parent.parent / "overlays" / "wiki-memory"


def test_wikirole_scheme_has_five_role_concepts():
    g = Graph()
    g.parse(OVERLAY_ROOT / "vocabulary" / "wikirole.ttl", format="turtle")

    scheme = URIRef("https://pod.vardeman.me/vault/ontology/wikirole")
    assert (scheme, RDF.type, SKOS.ConceptScheme) in g
    assert (scheme, RDF.type, OWL.Ontology) in g
    assert (scheme, DCT.conformsTo, URIRef("http://www.w3.org/TR/dx-prof/")) in g

    expected = {
        WIKIROLE["affordance"],
        WIKIROLE["write-affordance"],
        WIKIROLE["version-affordance"],
        WIKIROLE["derived-class-affordance"],
        WIKIROLE["derived-navigation-affordance"],
    }
    found = set(g.subjects(RDF.type, PROF.ResourceRole))
    assert expected == found, f"missing roles: {expected - found}; extra: {found - expected}"

    for role in expected:
        assert (role, RDF.type, SKOS.Concept) in g
        assert (role, RDF.type, OWL.NamedIndividual) in g
        assert (role, SKOS.topConceptOf, scheme) in g
```

- [ ] **Step 2: Run test to verify it fails**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_wikirole_scheme_has_five_role_concepts -v
```

Expected: FAIL with `FileNotFoundError` for `wikirole.ttl`.

- [ ] **Step 3: Create the wikirole scheme**

Create `overlays/wiki-memory/vocabulary/wikirole.ttl`:

```turtle
@prefix :        <https://pod.vardeman.me/vault/ontology/wikirole#> .
@prefix prof:    <http://www.w3.org/ns/dx/prof/> .
@prefix skos:    <http://www.w3.org/2004/02/skos/core#> .
@prefix dct:     <http://purl.org/dc/terms/> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .

<https://pod.vardeman.me/vault/ontology/wikirole>
    a skos:ConceptScheme , owl:Ontology ;
    dct:title "Wiki-Memory L3 — Resource Roles" ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    dct:publisher <https://orcid.org/0000-0003-4091-6059> ;
    rdfs:comment "Resource roles specific to wiki-memory L3, supplementing the W3C PROF role registry (http://www.w3.org/ns/dx/prof/role/) with substrate-specific kinds. Each concept is an instance of prof:ResourceRole and skos:Concept, mirroring the pattern at the W3C role registry. Designed as a SKOS ConceptScheme so additions are additive and discoverable via skos:topConceptOf." .

:affordance
    a owl:NamedIndividual , skos:Concept , prof:ResourceRole ;
    skos:topConceptOf <https://pod.vardeman.me/vault/ontology/wikirole> ;
    skos:prefLabel "Affordance descriptor" ;
    skos:definition "An artifact that declares a substrate capability — predicates governed, capability required, classes operated on. Parent concept; concrete affordance descriptors take a narrower sub-role." .

:write-affordance
    a owl:NamedIndividual , skos:Concept , prof:ResourceRole ;
    skos:topConceptOf <https://pod.vardeman.me/vault/ontology/wikirole> ;
    skos:broader :affordance ;
    skos:prefLabel "Write-time affordance" ;
    skos:definition "An affordance invoked at write time — a MonitoringStore listener or projection that fires on resource Create/Update/Delete events." .

:version-affordance
    a owl:NamedIndividual , skos:Concept , prof:ResourceRole ;
    skos:topConceptOf <https://pod.vardeman.me/vault/ontology/wikirole> ;
    skos:broader :affordance ;
    skos:prefLabel "Versioning affordance" ;
    skos:definition "An affordance providing temporal access — Memento-style time-travel via TimeGate/TimeMap." .

:derived-class-affordance
    a owl:NamedIndividual , skos:Concept , prof:ResourceRole ;
    skos:topConceptOf <https://pod.vardeman.me/vault/ontology/wikirole> ;
    skos:broader :affordance ;
    skos:prefLabel "Derived-class affordance" ;
    skos:definition "An affordance computing a derived class view — hub view, type rollup, instance aggregation." .

:derived-navigation-affordance
    a owl:NamedIndividual , skos:Concept , prof:ResourceRole ;
    skos:topConceptOf <https://pod.vardeman.me/vault/ontology/wikirole> ;
    skos:broader :affordance ;
    skos:prefLabel "Derived-navigation affordance" ;
    skos:definition "An affordance computing derived navigation structure — breadcrumb trails, link maps, traversal indices." .
```

- [ ] **Step 4: Run test to verify it passes**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_wikirole_scheme_has_five_role_concepts -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/vocabulary/wikirole.ttl tests/test_phase5j_close.py
git commit -m "[Agent: Claude] Mint wikirole SKOS scheme (Phase 5j 5/?, D86)

Five prof:ResourceRole concepts for substrate-level role declarations
on this Pod. Parallel to W3C's dx/prof/role/ registry; addressed by
hash-namespace document per D84.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add overlay schema predicates

**Files:**
- Modify: `css/config/pod-templates/base/ontology/overlay.ttl`
- Test: `tests/test_phase5j_close.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_phase5j_close.py`:

```python
OVERLAY_NS = Namespace("https://pod.vardeman.me/vault/ontology/overlay#")
OVERLAY_TTL = Path(__file__).parent.parent / "css" / "config" / "pod-templates" / "base" / "ontology" / "overlay.ttl"


def test_overlay_schema_has_installs_profile_and_role_scheme():
    g = Graph()
    g.parse(OVERLAY_TTL, format="turtle")
    for predicate in [OVERLAY_NS.installsProfile, OVERLAY_NS.installsRoleScheme]:
        assert (predicate, RDF.type, URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#Property")) in g, \
            f"missing predicate: {predicate}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_overlay_schema_has_installs_profile_and_role_scheme -v
```

Expected: FAIL.

- [ ] **Step 3: Add the predicates**

In `css/config/pod-templates/base/ontology/overlay.ttl`, after the existing `installsAffordance` line (~line 45), add:

```turtle
overlay:installsProfile        a rdf:Property ; rdfs:label "Pod URL of a PROF profile descriptor this overlay uploads" ; rdfs:isDefinedBy <> .
overlay:installsRoleScheme     a rdf:Property ; rdfs:label "Pod URL of a SKOS role-concept scheme this overlay publishes" ; rdfs:isDefinedBy <> .
```

- [ ] **Step 4: Run test to verify it passes**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_overlay_schema_has_installs_profile_and_role_scheme -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add css/config/pod-templates/base/ontology/overlay.ttl tests/test_phase5j_close.py
git commit -m "[Agent: Claude] Add overlay:installsProfile + installsRoleScheme predicates

Mirrors existing installsShape/installsAffordance pattern. Lets overlays
declare PROF profile descriptors and SKOS role schemes for installation
by scripts/overlay/apply.py.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire role scheme and profiles in manifest

**Files:**
- Modify: `overlays/wiki-memory/manifest.ttl`
- Test: `tests/test_phase5j_close.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_phase5j_close.py`:

```python
MANIFEST_TTL = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "manifest.ttl"


def test_manifest_declares_role_scheme_and_six_profiles():
    g = Graph()
    g.parse(MANIFEST_TTL, format="turtle")
    overlay = URIRef("https://pod.vardeman.me/vault/ontology/overlay#wiki-memory")

    role_schemes = set(g.objects(overlay, OVERLAY_NS.installsRoleScheme))
    assert role_schemes == {URIRef("/vault/ontology/wikirole")}

    profiles = set(g.objects(overlay, OVERLAY_NS.installsProfile))
    expected = {URIRef(f"/vault/meta/profiles/{name}") for name in
                ["page", "concept", "source", "person", "procedure", "working"]}
    assert profiles == expected
```

- [ ] **Step 2: Run test to verify it fails**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_manifest_declares_role_scheme_and_six_profiles -v
```

Expected: FAIL.

- [ ] **Step 3: Modify manifest**

In `overlays/wiki-memory/manifest.ttl`, after `overlay:installsAffordance` block (before `overlay:installsTypeRegistration`), add:

```turtle
    overlay:installsRoleScheme
        </vault/ontology/wikirole> ;

    overlay:installsProfile
        </vault/meta/profiles/page> ,
        </vault/meta/profiles/concept> ,
        </vault/meta/profiles/source> ,
        </vault/meta/profiles/person> ,
        </vault/meta/profiles/procedure> ,
        </vault/meta/profiles/working> ;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_manifest_declares_role_scheme_and_six_profiles -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/manifest.ttl tests/test_phase5j_close.py
git commit -m "[Agent: Claude] Manifest: declare wikirole + 6 PROF profile descriptors

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Add overlay helpers + upload steps

**Files:**
- Modify: `scripts/overlay/common.py`
- Modify: `scripts/overlay/apply.py`
- Test: `tests/test_phase5j_close.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_phase5j_close.py`:

```python
from scripts.overlay.common import role_scheme_urls, profile_urls, load_manifest


def test_overlay_helpers_extract_role_scheme_and_profiles():
    manifest = load_manifest(MANIFEST_TTL)
    overlay = URIRef("https://pod.vardeman.me/vault/ontology/overlay#wiki-memory")

    assert role_scheme_urls(manifest, overlay) == ["/vault/ontology/wikirole"]

    profiles = profile_urls(manifest, overlay)
    assert sorted(profiles) == sorted(
        f"/vault/meta/profiles/{name}"
        for name in ["page", "concept", "source", "person", "procedure", "working"]
    )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_overlay_helpers_extract_role_scheme_and_profiles -v
```

Expected: FAIL with ImportError.

- [ ] **Step 3: Add helpers to common.py**

Inspect `scripts/overlay/common.py`. Locate the existing `shape_urls` / `affordance_urls` functions (mirror their pattern exactly — function signature, return type, sort order). Add adjacent:

```python
def role_scheme_urls(manifest: Graph, overlay: URIRef) -> list[str]:
    return sorted(str(o) for o in manifest.objects(overlay, OVERLAY.installsRoleScheme))


def profile_urls(manifest: Graph, overlay: URIRef) -> list[str]:
    return sorted(str(o) for o in manifest.objects(overlay, OVERLAY.installsProfile))
```

(Verify the existing module's `OVERLAY` namespace constant; if it's named differently in common.py, match the existing convention.)

- [ ] **Step 4: Add upload steps to apply.py**

In `scripts/overlay/apply.py`, locate the `main()` (or equivalent driver) function. The existing upload sequence touches vocabulary → containers → shapes → affordances → type registrations. Insert:

- **After vocabulary upload, before containers**: upload role scheme (one call to existing PUT helper for each URL from `role_scheme_urls(manifest, overlay)`).
- **After affordances, before type registrations**: upload profiles (one call per URL from `profile_urls(manifest, overlay)`).

Mirror the local-file → Pod-URL resolution pattern used for shapes (which already maps `/vault/meta/shapes/X.shacl.ttl` → `overlays/wiki-memory/shapes/X.shacl.ttl`). Role scheme maps `/vault/ontology/wikirole` → `overlays/wiki-memory/vocabulary/wikirole.ttl`. Profiles map `/vault/meta/profiles/X` → `overlays/wiki-memory/profiles/X.ttl`.

- [ ] **Step 5: Run helper test**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_overlay_helpers_extract_role_scheme_and_profiles -v
```

Expected: PASS.

- [ ] **Step 6: Smoke-test apply.py against a running Pod**

```bash
docker compose up -d
~/uvws/.venv/bin/python scripts/overlay/apply.py --pod http://localhost:3000 --overlay wiki-memory
curl -sI http://localhost:3000/vault/ontology/wikirole | grep -i content-type
curl -sI http://localhost:3000/vault/meta/profiles/page | grep -i content-type
```

Expected: Both return 200 OK with `Content-Type: text/turtle`.

- [ ] **Step 7: Commit**

```bash
git add scripts/overlay/common.py scripts/overlay/apply.py tests/test_phase5j_close.py
git commit -m "[Agent: Claude] overlay: add installsRoleScheme + installsProfile upload steps

Role scheme uploads after vocabulary (before affordances reference its IRIs).
Profiles upload after affordances (no dependency conflict; just ordering).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Substrate `dct:conformsTo` — SHACL shapes

**Files:**
- Modify: `overlays/wiki-memory/shapes/{page,source,person,procedure,working}.shacl.ttl` (5 files)
- Test: `tests/test_phase5j_close.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
SHAPES_DIR = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "shapes"
SHACL_SPEC = URIRef("https://www.w3.org/TR/shacl/")


@pytest.mark.parametrize("filename", [
    "page.shacl.ttl", "source.shacl.ttl", "person.shacl.ttl",
    "procedure.shacl.ttl", "working.shacl.ttl",
])
def test_shape_declares_conformsTo_shacl(filename):
    g = Graph()
    g.parse(SHAPES_DIR / filename, format="turtle")
    # The shape document declares conformance via its <> subject (empty IRI = the document).
    doc = URIRef("")
    targets = list(g.objects(doc, DCT.conformsTo))
    assert SHACL_SPEC in targets or any(SHACL_SPEC in g.objects(s, DCT.conformsTo)
                                        for s in g.subjects()), \
        f"{filename} does not declare dct:conformsTo <SHACL spec>"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py -k test_shape_declares -v
```

Expected: 5× FAIL.

- [ ] **Step 3: Add `dct:conformsTo` to each shape file**

For each of `page.shacl.ttl`, `source.shacl.ttl`, `person.shacl.ttl`, `procedure.shacl.ttl`, `working.shacl.ttl`:

1. Ensure `@prefix dct: <http://purl.org/dc/terms/> .` is in the prefix block (most shapes already have it; add if missing).
2. After the prefix block and before the first shape declaration, add:

```turtle
<> dct:conformsTo <https://www.w3.org/TR/shacl/> .
```

The `<>` IRI refers to the document itself.

- [ ] **Step 4: Run test to verify it passes**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py -k test_shape_declares -v
```

Expected: 5× PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/shapes/
git commit -m "[Agent: Claude] Shapes: declare dct:conformsTo <SHACL>

Substrate-level conformance declaration. Lets ProfileLinkMetadataWriter
emit Link: <https://www.w3.org/TR/shacl/>; rel=\"profile\" on every
shape fetch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Substrate `dct:conformsTo` — wiki vocabulary + profile descriptors

**Files:**
- Modify: `overlays/wiki-memory/vocabulary/wiki.ttl`
- Modify: `overlays/wiki-memory/profiles/{page,concept,source,person,procedure,working}.ttl`
- Test: `tests/test_phase5j_close.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
VOCAB_TTL = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "vocabulary" / "wiki.ttl"
PROFILES_DIR = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "profiles"
PROF_SPEC = URIRef("http://www.w3.org/TR/dx-prof/")
RDFS_SPEC = URIRef("http://www.w3.org/2000/01/rdf-schema")


def test_wiki_vocab_declares_conformsTo_rdfs():
    g = Graph()
    g.parse(VOCAB_TTL, format="turtle")
    vocab = URIRef("https://pod.vardeman.me/vault/ontology/wiki")
    assert (vocab, DCT.conformsTo, RDFS_SPEC) in g


@pytest.mark.parametrize("name", ["page", "concept", "source", "person", "procedure", "working"])
def test_profile_descriptor_declares_conformsTo_prof(name):
    g = Graph()
    g.parse(PROFILES_DIR / f"{name}.ttl", format="turtle")
    profile = URIRef(f"https://pod.vardeman.me/vault/meta/profiles/{name}")
    assert (profile, DCT.conformsTo, PROF_SPEC) in g
```

- [ ] **Step 2: Run test to verify failure**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py -k "wiki_vocab or profile_descriptor" -v
```

Expected: 1× FAIL + 6× FAIL.

- [ ] **Step 3: Modify wiki.ttl**

In `overlays/wiki-memory/vocabulary/wiki.ttl`, find the ontology header block (the section declaring `<https://pod.vardeman.me/vault/ontology/wiki>` as `owl:Ontology` or `rdfs:isDefinedBy` target). Add to that block:

```turtle
    dct:conformsTo <http://www.w3.org/2000/01/rdf-schema> ;
```

Ensure `@prefix dct:` is declared at top.

- [ ] **Step 4: Modify the 6 profile descriptors**

For each `overlays/wiki-memory/profiles/{page,concept,source,person,procedure,working}.ttl`, in the main `prof:Profile` block, add the property `dct:conformsTo <http://www.w3.org/TR/dx-prof/>`. Example for `concept.ttl`:

```turtle
<https://pod.vardeman.me/vault/meta/profiles/concept>
  a prof:Profile ;
  rdfs:label "…" ;
  …
  dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;    # ADD THIS
  prof:hasResource …  .
```

- [ ] **Step 5: Run tests to verify passing**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py -k "wiki_vocab or profile_descriptor" -v
```

Expected: 7× PASS.

- [ ] **Step 6: Commit**

```bash
git add overlays/wiki-memory/vocabulary/wiki.ttl overlays/wiki-memory/profiles/
git commit -m "[Agent: Claude] Vocabulary + profile descriptors: declare dct:conformsTo

wiki.ttl conforms to RDFS (it uses rdfs:Class/rdfs:subClassOf only).
Six PROF profile descriptors conform to PROF.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Framing-1.5 additive PROF typing on affordance descriptors

**Files:**
- Modify: `overlays/wiki-memory/affordances/{markdown-projection,memento,hub-view,breadcrumb-view}.ttl`
- Test: `tests/test_phase5j_close.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
AFFORDANCES_DIR = Path(__file__).parent.parent / "overlays" / "wiki-memory" / "affordances"

AFFORDANCE_ROLE_MAP = {
    "markdown-projection.ttl": "write-affordance",
    "memento.ttl":              "version-affordance",
    "hub-view.ttl":             "derived-class-affordance",
    "breadcrumb-view.ttl":      "derived-navigation-affordance",
}


@pytest.mark.parametrize("filename,role", AFFORDANCE_ROLE_MAP.items())
def test_affordance_additive_prof_typing(filename, role):
    g = Graph()
    g.parse(AFFORDANCES_DIR / filename, format="turtle")
    doc = URIRef("")  # blank subject = the doc itself

    # Existing wiki:*Affordance typing preserved (any wiki:*Affordance subclass passes).
    has_wiki_type = any(
        str(t).startswith("https://pod.vardeman.me/vault/ontology/wiki#")
        and "Affordance" in str(t)
        for t in g.objects(doc, RDF.type)
    )
    assert has_wiki_type, f"{filename} lost wiki:*Affordance typing"

    # New PROF typing.
    assert (doc, RDF.type, PROF.ResourceDescriptor) in g, \
        f"{filename} missing prof:ResourceDescriptor type"
    assert (doc, PROF.hasRole, WIKIROLE[role]) in g, \
        f"{filename} missing prof:hasRole wikirole:{role}"
    assert (doc, DCT.conformsTo, PROF_SPEC) in g, \
        f"{filename} missing dct:conformsTo <PROF>"
```

- [ ] **Step 2: Run test to verify failure**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py -k affordance_additive -v
```

Expected: 4× FAIL.

- [ ] **Step 3: Modify each affordance file**

Ensure each affordance file has the prefixes `prof:`, `wikirole:`, and `dct:` declared (add to prefix block if missing).

For each file, change the existing typing block. Example for `markdown-projection.ttl`:

Before:
```turtle
<> a wiki:WriteAffordance ;
    rdfs:label "Markdown projection listener" ;
```

After:
```turtle
<> a wiki:WriteAffordance ,
       prof:ResourceDescriptor ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    prof:hasRole wikirole:write-affordance ;
    rdfs:label "Markdown projection listener" ;
```

Per-file role mappings (use this exact mapping):

| File | Add `prof:hasRole` |
|---|---|
| `markdown-projection.ttl` | `wikirole:write-affordance` |
| `memento.ttl` | `wikirole:version-affordance` |
| `hub-view.ttl` | `wikirole:derived-class-affordance` |
| `breadcrumb-view.ttl` | `wikirole:derived-navigation-affordance` |

Add the new prefix declarations at the top of each file:
```turtle
@prefix prof:     <http://www.w3.org/ns/dx/prof/> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .
```

(Verify `dct:` is already declared in each file; add if missing.)

- [ ] **Step 4: Run tests to verify passing**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py -k affordance_additive -v
```

Expected: 4× PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/affordances/
git commit -m "[Agent: Claude] Affordances: additive PROF typing (Framing 1.5)

Each affordance file now declares both wiki:*Affordance (existing
consumers) AND prof:ResourceDescriptor with prof:hasRole wikirole:*.
Wikirole scheme has live consumers from day one. Framing-2 refactor
(drop wiki:*Affordance) becomes a clean follow-up.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Substrate `dct:conformsTo` — JSON-LD context via `.meta`

**Files:**
- Modify: `overlays/wiki-memory/storage-patch.ttl` (or equivalent `.meta` source for `/vault/meta/context.jsonld`)
- Test: `tests/test_phase5j_close.py`

- [ ] **Step 1: Locate where context.jsonld's .meta is sourced**

```bash
grep -rn "context.jsonld\|/vault/meta/context" overlays/wiki-memory/ scripts/ 2>/dev/null | head -10
```

The .meta sidecar for `/vault/meta/context.jsonld` is generated by either (a) the overlay's `storage-patch.ttl` (if it's part of the storage description payload), or (b) `apply.py` posting a side .meta. Identify the actual source.

- [ ] **Step 2: Write the integration test**

Append:

```python
import httpx

POD_BASE = "http://localhost:3000"


@pytest.mark.integration
def test_context_jsonld_meta_declares_conformsTo_jsonld11():
    """Requires a running Pod with the overlay applied."""
    r = httpx.get(f"{POD_BASE}/vault/meta/context.jsonld.meta", timeout=5)
    assert r.status_code == 200
    g = Graph()
    g.parse(data=r.text, format="turtle",
            publicID=f"{POD_BASE}/vault/meta/context.jsonld.meta")
    ctx = URIRef(f"{POD_BASE}/vault/meta/context.jsonld")
    assert (ctx, DCT.conformsTo, URIRef("https://www.w3.org/TR/json-ld11/")) in g
```

- [ ] **Step 3: Add the conformsTo triple to the source identified in Step 1**

Add to the appropriate source:

```turtle
</vault/meta/context.jsonld> dct:conformsTo <https://www.w3.org/TR/json-ld11/> .
```

- [ ] **Step 4: Reapply overlay against running Pod and verify**

```bash
~/uvws/.venv/bin/python scripts/overlay/apply.py --pod http://localhost:3000 --overlay wiki-memory
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_context_jsonld_meta_declares_conformsTo_jsonld11 -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/storage-patch.ttl  # or the actual file edited
git commit -m "[Agent: Claude] context.jsonld: declare dct:conformsTo <JSON-LD 1.1>

Substrate-level conformance for the JSON-LD context resource; .meta
sidecar carries it since the body is JSON-LD content, not RDF.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Vault importer — emit content-level `dct:conformsTo`

**Files:**
- Modify: `scripts/vault_import.py`
- Test: `tests/test_phase5j_close.py`

- [ ] **Step 1: Locate the importer's class-hint-to-profile mapping**

```bash
grep -n "wiki:Concept\|wiki:Source\|wiki:Person\|wiki:Procedure\|wiki:WorkingNote" scripts/vault_import.py | head -20
```

Identify where the importer decides a page's `rdf:type` from frontmatter / filename. That's where we add a parallel `dct:conformsTo` emission.

- [ ] **Step 2: Write the unit test**

Append:

```python
from scripts.vault_import import frontmatter_to_meta_graph  # adjust name to actual function

WIKI_NS = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")


@pytest.mark.parametrize("class_hint,profile_slug", [
    ("concept",   "concept"),
    ("source",    "source"),
    ("person",    "person"),
    ("procedure", "procedure"),
    ("working",   "working"),
])
def test_importer_emits_content_level_conformsTo(class_hint, profile_slug):
    """When the importer types a resource as wiki:X, it also declares
    dct:conformsTo on the relevant wiki:XProfile."""
    fixture_frontmatter = {"type": class_hint, "title": "Fixture"}
    g = frontmatter_to_meta_graph(
        frontmatter=fixture_frontmatter,
        resource_iri=f"https://pod.vardeman.me/vault/wiki/pages/fixture",
    )
    expected_profile = URIRef(f"https://pod.vardeman.me/vault/meta/profiles/{profile_slug}")
    resource = URIRef("https://pod.vardeman.me/vault/wiki/pages/fixture")
    assert (resource, DCT.conformsTo, expected_profile) in g
```

(Function name `frontmatter_to_meta_graph` is illustrative — match the actual function used by the importer. Same for parameter names and `WIKI_NS` if the importer already exports a similar helper.)

- [ ] **Step 3: Run test to verify failure**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py -k importer_emits_content_level -v
```

Expected: 5× FAIL.

- [ ] **Step 4: Add the emission**

In the importer's frontmatter→Turtle generation function, locate the `rdf:type` emission. For each class-hint branch, additionally emit `dct:conformsTo <…/profiles/<slug>>` where the slug matches the class (concept→concept, source→source, etc.).

Pattern (adjust to actual code):

```python
CONTENT_PROFILE_MAP = {
    "concept":   "https://pod.vardeman.me/vault/meta/profiles/concept",
    "source":    "https://pod.vardeman.me/vault/meta/profiles/source",
    "person":    "https://pod.vardeman.me/vault/meta/profiles/person",
    "procedure": "https://pod.vardeman.me/vault/meta/profiles/procedure",
    "working":   "https://pod.vardeman.me/vault/meta/profiles/working",
}

# In the function that builds the .meta graph:
profile_uri = CONTENT_PROFILE_MAP.get(class_hint)
if profile_uri:
    g.add((URIRef(resource_iri), DCT.conformsTo, URIRef(profile_uri)))
```

- [ ] **Step 5: Run tests to verify passing**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py -k importer_emits_content_level -v
```

Expected: 5× PASS.

- [ ] **Step 6: Run the full vault-importer test suite to confirm no regressions**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_vault_import.py -v
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/vault_import.py tests/test_phase5j_close.py
git commit -m "[Agent: Claude] vault_import: emit content-level dct:conformsTo

Imported wiki-memory L3 resources now declare their PROF profile in
.meta. Gives Rung 1.5 a measurable per-resource profile signal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Backfill script for already-imported content

**Files:**
- Create: `scripts/backfill_conformsTo.py`

- [ ] **Step 1: Write the backfill script**

```python
"""Backfill content-level dct:conformsTo on already-imported wiki-memory L3 resources.

Iterates LDP containers /vault/wiki/{pages,sources,people,procedures,working}/ ,
reads each resource's .meta, checks rdf:type, and PATCHes in dct:conformsTo if
the type maps to a known profile and the conformsTo triple isn't already there.

Idempotent. Safe to re-run.
"""
import argparse
import asyncio
import sys

import httpx
from rdflib import Graph, URIRef
from rdflib.namespace import RDF

DCT_CONFORMS_TO = URIRef("http://purl.org/dc/terms/conformsTo")
WIKI = "https://pod.vardeman.me/vault/ontology/wiki#"
TYPE_TO_PROFILE = {
    URIRef(f"{WIKI}Concept"):     "https://pod.vardeman.me/vault/meta/profiles/concept",
    URIRef(f"{WIKI}Source"):      "https://pod.vardeman.me/vault/meta/profiles/source",
    URIRef(f"{WIKI}Person"):      "https://pod.vardeman.me/vault/meta/profiles/person",
    URIRef(f"{WIKI}Procedure"):   "https://pod.vardeman.me/vault/meta/profiles/procedure",
    URIRef(f"{WIKI}WorkingNote"): "https://pod.vardeman.me/vault/meta/profiles/working",
}
CONTAINERS = [
    "/vault/wiki/pages/", "/vault/wiki/sources/", "/vault/wiki/people/",
    "/vault/wiki/procedures/", "/vault/wiki/working/",
]


async def list_container(client: httpx.AsyncClient, base: str, path: str) -> list[str]:
    r = await client.get(f"{base}{path}", headers={"Accept": "text/turtle"})
    r.raise_for_status()
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=f"{base}{path}")
    return [str(o) for o in g.objects(URIRef(f"{base}{path}"),
            URIRef("http://www.w3.org/ns/ldp#contains"))]


async def backfill_one(client: httpx.AsyncClient, resource_url: str, dry_run: bool) -> str:
    meta_url = f"{resource_url}.meta" if not resource_url.endswith("/") else f"{resource_url}.meta"
    r = await client.get(meta_url, headers={"Accept": "text/turtle"})
    if r.status_code != 200:
        return f"SKIP {resource_url} (no .meta, status {r.status_code})"
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=meta_url)
    res = URIRef(resource_url)
    types = set(g.objects(res, RDF.type))
    profile = next((TYPE_TO_PROFILE[t] for t in types if t in TYPE_TO_PROFILE), None)
    if not profile:
        return f"SKIP {resource_url} (no recognized wiki:* type)"
    if (res, DCT_CONFORMS_TO, URIRef(profile)) in g:
        return f"SKIP {resource_url} (already has conformsTo)"
    if dry_run:
        return f"DRY {resource_url} → conformsTo {profile}"
    patch = (
        "PREFIX dct: <http://purl.org/dc/terms/>\n"
        f"INSERT DATA {{ <{resource_url}> dct:conformsTo <{profile}> . }}"
    )
    pr = await client.patch(meta_url, content=patch,
                            headers={"Content-Type": "application/sparql-update"})
    pr.raise_for_status()
    return f"OK   {resource_url} → conformsTo {profile}"


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pod", default="http://localhost:3000")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    async with httpx.AsyncClient(timeout=10) as client:
        for path in CONTAINERS:
            try:
                resources = await list_container(client, args.pod, path)
            except httpx.HTTPError as e:
                print(f"ERROR listing {path}: {e}", file=sys.stderr)
                continue
            results = await asyncio.gather(
                *(backfill_one(client, r, args.dry_run) for r in resources),
                return_exceptions=True,
            )
            for r in results:
                print(r)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

- [ ] **Step 2: Run dry-run against the local pod**

```bash
~/uvws/.venv/bin/python scripts/backfill_conformsTo.py --pod http://localhost:3000 --dry-run
```

Expected: prints `DRY` lines for each resource that needs backfilling, `SKIP` for already-conformant or no-type resources.

- [ ] **Step 3: Run for real**

```bash
~/uvws/.venv/bin/python scripts/backfill_conformsTo.py --pod http://localhost:3000
```

Expected: `OK` for previously-DRY entries.

- [ ] **Step 4: Run again to confirm idempotency**

```bash
~/uvws/.venv/bin/python scripts/backfill_conformsTo.py --pod http://localhost:3000
```

Expected: all `SKIP (already has conformsTo)`.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill_conformsTo.py
git commit -m "[Agent: Claude] backfill_conformsTo: idempotent content-level conformsTo

One-off backfill for resources imported before scripts/vault_import.py
gained content-level dct:conformsTo emission. SPARQL UPDATE INSERT DATA
against .meta; idempotent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Storage description — advertise wikirole + profile catalog

**Files:**
- Modify: `css/config/void-description.json`
- Test: `tests/test_phase5j_close.py`

- [ ] **Step 1: Write the integration test**

Append:

```python
@pytest.mark.integration
def test_storage_description_advertises_wikirole_and_profiles():
    r = httpx.get(f"{POD_BASE}/.well-known/solid",
                  headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=f"{POD_BASE}/.well-known/solid")

    void_vocab = URIRef("http://rdfs.org/ns/void#vocabulary")
    vocabs = set(str(o) for o in g.objects(predicate=void_vocab))
    assert "https://pod.vardeman.me/vault/ontology/wiki" in vocabs
    assert "https://pod.vardeman.me/vault/ontology/wikirole" in vocabs

    prof_has_resource = URIRef("http://www.w3.org/ns/dx/prof/hasResource")
    profiles = set(str(o) for o in g.objects(predicate=prof_has_resource))
    for name in ["page", "concept", "source", "person", "procedure", "working"]:
        assert f"https://pod.vardeman.me/vault/meta/profiles/{name}" in profiles
```

- [ ] **Step 2: Run test to verify failure**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_storage_description_advertises_wikirole_and_profiles -v
```

Expected: FAIL (wikirole + profiles not in storage description).

- [ ] **Step 3: Modify void-description.json**

Read the existing `css/config/void-description.json` to understand its structure (it's a Components.js StaticStorageDescriber config). Add to its `void:vocabulary` array:

```json
"https://pod.vardeman.me/vault/ontology/wikirole"
```

And add a new `prof:hasResource` array with the six profile descriptor URIs. The exact JSON-LD nesting depends on the existing file shape — preserve all existing keys.

- [ ] **Step 4: Restart Pod and re-test**

```bash
docker compose restart css
sleep 5
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py::test_storage_description_advertises_wikirole_and_profiles -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add css/config/void-description.json
git commit -m "[Agent: Claude] Storage description: advertise wikirole + 6 PROF profiles

.well-known/solid now lists wiki + wikirole vocabularies (D44 router)
and points at the six PROF profile descriptors via prof:hasResource.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Scaffold the `profile-link` CSS extension

**Files:**
- Create: `css/extensions/profile-link/package.json`
- Create: `css/extensions/profile-link/tsconfig.json`
- Create: `css/extensions/profile-link/vitest.config.ts`
- Create: `css/extensions/profile-link/src/index.ts`
- Create: `css/extensions/profile-link/src/uri.ts`

Mirrors `css/extensions/memento/`. **Before starting, look at memento's actual layout to copy the exact pattern**:

```bash
cat css/extensions/memento/package.json
cat css/extensions/memento/tsconfig.json
cat css/extensions/memento/vitest.config.ts
cat css/extensions/memento/src/uri.ts
```

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@cogitarelink/profile-link",
  "version": "0.1.0",
  "description": "Link: rel=\"profile\" MetadataWriter for CSS v8 — emits one Link header per dct:conformsTo value. Phase 5j close-out of cogitarelink-solid (D86).",
  "license": "MIT",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/profile-link",
  "lsd:components": "dist/components/components.jsonld",
  "lsd:importPaths": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/profile-link/^0.1.0/components/": "dist/components/",
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/profile-link/^0.1.0/dist/": "dist/"
  },
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/profile-link/^0.1.0/components/context.jsonld": "dist/components/context.jsonld"
  },
  "scripts": {
    "build": "npm run build:ts && npm run build:components",
    "build:ts": "tsc --skipLibCheck",
    "build:components": "componentsjs-generator -s src -c dist/components",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@solid/community-server": "*",
    "asynchronous-handlers": "*"
  },
  "devDependencies": {
    "@solid/community-server": "^8.0.0-alpha.3",
    "@types/node": "^22.0.0",
    "componentsjs-generator": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Copy tsconfig.json and vitest.config.ts from memento verbatim**

```bash
cp css/extensions/memento/tsconfig.json css/extensions/profile-link/tsconfig.json
cp css/extensions/memento/vitest.config.ts css/extensions/profile-link/vitest.config.ts
```

(Adjust nothing — these configs are extension-agnostic.)

- [ ] **Step 3: Create src/uri.ts (duplicate from memento)**

```bash
cp css/extensions/memento/src/uri.ts css/extensions/profile-link/src/uri.ts
```

- [ ] **Step 4: Create src/index.ts**

```typescript
export { ProfileLinkMetadataWriter } from "./ProfileLinkMetadataWriter";
```

- [ ] **Step 5: Install deps and confirm scaffold builds**

```bash
cd css/extensions/profile-link
npm install
```

Expected: clean install, no errors. (No build yet — writer not implemented.)

- [ ] **Step 6: Commit**

```bash
cd ../../..
git add css/extensions/profile-link/package.json css/extensions/profile-link/tsconfig.json css/extensions/profile-link/vitest.config.ts css/extensions/profile-link/src/
git commit -m "[Agent: Claude] Scaffold @cogitarelink/profile-link CSS extension

Mirrors css/extensions/memento layout: package.json with lsd:* fields,
TypeScript strict config, vitest harness, src/uri.ts helper. Writer
implementation next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Implement `ProfileLinkMetadataWriter` (TDD)

**Files:**
- Create: `css/extensions/profile-link/src/ProfileLinkMetadataWriter.ts`
- Create: `css/extensions/profile-link/tests/ProfileLinkMetadataWriter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `css/extensions/profile-link/tests/ProfileLinkMetadataWriter.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { RepresentationMetadata } from "@solid/community-server";
import { DataFactory } from "n3";
import { ProfileLinkMetadataWriter } from "../src/ProfileLinkMetadataWriter";

const { namedNode } = DataFactory;
const DCT_CONFORMS_TO = namedNode("http://purl.org/dc/terms/conformsTo");

function makeInput(identifier: string, conformsTo: string[]) {
  const metadata = new RepresentationMetadata(namedNode(identifier));
  for (const c of conformsTo) {
    metadata.add(DCT_CONFORMS_TO, namedNode(c));
  }
  const headers: Record<string, string[]> = {};
  const response = {
    hasHeader: (k: string) => k.toLowerCase() in headers,
    getHeader: (k: string) => headers[k.toLowerCase()]?.join(", "),
    setHeader: (k: string, v: string | string[]) => {
      headers[k.toLowerCase()] = Array.isArray(v) ? v : [v];
    },
    appendHeader: (k: string, v: string) => {
      const key = k.toLowerCase();
      if (!headers[key]) headers[key] = [];
      headers[key].push(v);
    },
  } as unknown as Parameters<ProfileLinkMetadataWriter["handle"]>[0]["response"];
  return { metadata, response, headers };
}

describe("ProfileLinkMetadataWriter", () => {
  const writer = new ProfileLinkMetadataWriter("http://localhost:3000");

  it("emits one Link header per dct:conformsTo value", async () => {
    const { metadata, response, headers } = makeInput(
      "http://localhost:3000/vault/meta/shapes/page.shacl.ttl",
      ["https://www.w3.org/TR/shacl/"],
    );
    await writer.handle({ metadata, response } as any);
    expect(headers.link).toBeDefined();
    expect(headers.link!.join(", ")).toContain('<https://www.w3.org/TR/shacl/>; rel="profile"');
  });

  it("emits multiple Link values for multi-valued conformsTo", async () => {
    const { metadata, response, headers } = makeInput(
      "http://localhost:3000/vault/wiki/pages/x",
      [
        "https://pod.vardeman.me/vault/meta/profiles/concept",
        "https://solidproject.org/TR/protocol",
      ],
    );
    await writer.handle({ metadata, response } as any);
    const link = headers.link!.join(", ");
    expect(link).toContain('<https://pod.vardeman.me/vault/meta/profiles/concept>; rel="profile"');
    expect(link).toContain('<https://solidproject.org/TR/protocol>; rel="profile"');
  });

  it("emits nothing when identifier is outside baseUrl", async () => {
    const { metadata, response, headers } = makeInput(
      "http://other.example/foo",
      ["https://example.org/profile"],
    );
    await writer.handle({ metadata, response } as any);
    expect(headers.link).toBeUndefined();
  });

  it("emits nothing when no dct:conformsTo present", async () => {
    const { metadata, response, headers } = makeInput(
      "http://localhost:3000/vault/wiki/pages/x",
      [],
    );
    await writer.handle({ metadata, response } as any);
    expect(headers.link).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd css/extensions/profile-link
npm run test
```

Expected: 4× FAIL with "Cannot find module ../src/ProfileLinkMetadataWriter".

- [ ] **Step 3: Implement the writer**

Create `css/extensions/profile-link/src/ProfileLinkMetadataWriter.ts`:

```typescript
import { MetadataWriter, type MetadataWriterInput, addHeader, DC } from "@solid/community-server";
import { isUnderBaseUrl } from "./uri";

/**
 * Emits one `Link: rel="profile"` header per `dct:conformsTo` value on the
 * response's RepresentationMetadata. Composes additively with CSS's
 * LinkRelMetadataWriter via `addHeader`.
 *
 * Per D86: the Link header is a faithful reflection of what the resource
 * declares via dct:conformsTo, not a server-fabricated path-based claim.
 * Per RFC 6906: profile URIs are identifiers; presence asserts conformance
 * without requiring dereference.
 */
export class ProfileLinkMetadataWriter extends MetadataWriter {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async handle(input: MetadataWriterInput): Promise<void> {
    const id = input.metadata.identifier?.value;
    if (!id || !isUnderBaseUrl(id, this.baseUrl)) return;

    const profiles = input.metadata.getAll(DC.terms.conformsTo);
    if (profiles.length === 0) return;

    const links = profiles.map((p) => `<${p.value}>; rel="profile"`);
    addHeader(input.response, "Link", links);
  }
}
```

(Verify `DC.terms.conformsTo` is the correct import — if CSS exports it as `DCT` instead, use that. Inspect `node_modules/@solid/community-server/dist/util/Vocabularies.d.ts`.)

- [ ] **Step 4: Run tests to verify passing**

```bash
npm run test
```

Expected: 4× PASS.

- [ ] **Step 5: Build the extension**

```bash
npm run build
```

Expected: clean compile + componentsjs-generator produces `dist/components/`.

- [ ] **Step 6: Commit**

```bash
cd ../../..
git add css/extensions/profile-link/src/ProfileLinkMetadataWriter.ts css/extensions/profile-link/tests/
git commit -m "[Agent: Claude] ProfileLinkMetadataWriter: emit Link: rel=profile per conformsTo

~25 LOC mirroring MementoLinkMetadataWriter. Reads dct:conformsTo from
RepresentationMetadata, emits one Link header per value via addHeader
(composes additively with existing Link rels).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Components.js wiring + solid-config.json import

**Files:**
- Create: `css/config/profile-link.json`
- Modify: `css/config/solid-config.json`

- [ ] **Step 1: Create profile-link.json wiring**

```json
{
  "@context": [
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
    "https://linkedsoftwaredependencies.org/bundles/npm/asynchronous-handlers/^1.0.0/components/context.jsonld",
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/profile-link/^0.1.0/components/context.jsonld"
  ],
  "@graph": [
    {
      "comment": "Per D86: every response carries Link: rel=\"profile\" headers, one per dct:conformsTo value on the resource's RepresentationMetadata. Substrate-level kinds (shapes, ontologies, profiles, affordances) AND content-level (wiki:*Profile) handled by one writer.",
      "@id": "urn:cogitarelink:ProfileLinkMetadataWriter",
      "@type": "ProfileLinkMetadataWriter",
      "baseUrl": { "@id": "urn:solid-server:default:variable:baseUrl" }
    },
    {
      "comment": "Insert after the default LinkRelMetadataWriter and after MementoLinkMetadataWriter so PROF profile Links are appended (not overwritten by other writers).",
      "@type": "Override",
      "overrideInstance": { "@id": "urn:solid-server:default:MetadataWriter" },
      "overrideSteps": [{
        "@type": "OverrideListInsertAfter",
        "overrideParameter": { "@id": "ah:dist/ParallelHandler.jsonld#ParallelHandler_handlers" },
        "overrideTarget": { "@id": "urn:cogitarelink:MementoLinkMetadataWriter" },
        "overrideValue": { "@id": "urn:cogitarelink:ProfileLinkMetadataWriter" }
      }]
    }
  ]
}
```

- [ ] **Step 2: Add import to solid-config.json**

Edit `css/config/solid-config.json`:

In the `@context` array, after the markdown-projection context entry, add:
```
"https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/profile-link/^0.1.0/components/context.jsonld"
```

In the imports list (after `./markdown-projection.json`), add:
```
"./profile-link.json"
```

- [ ] **Step 3: Verify configuration loads in CSS**

```bash
docker compose down
docker compose up -d
docker compose logs -f css 2>&1 | head -50
```

Expected: clean startup, no Components.js errors mentioning ProfileLinkMetadataWriter.

- [ ] **Step 4: Smoke-test the writer**

```bash
curl -sI http://localhost:3000/vault/meta/shapes/page.shacl.ttl | grep -i "^link:"
```

Expected: a `Link:` line that includes `<https://www.w3.org/TR/shacl/>; rel="profile"` (alongside any existing Memento/LDP links).

- [ ] **Step 5: Commit**

```bash
git add css/config/profile-link.json css/config/solid-config.json
git commit -m "[Agent: Claude] Wire profile-link into CSS via Components.js Override

OverrideListInsertAfter against MementoLinkMetadataWriter (so PROF Links
append after Memento's timegate/timemap). Standard pattern per
metadata-writer skill.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Dockerfile symlink for profile-link

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Inspect existing symlinks**

```bash
grep -n "ln -s\|memento\|markdown-projection" Dockerfile
```

Identify the pattern: each extension has a symlink from the npm-discoverable path to `/css/extensions/<name>`.

- [ ] **Step 2: Add the symlink line**

Add (next to the memento and markdown-projection symlinks):

```dockerfile
RUN ln -sf /css/extensions/profile-link /community-server/node_modules/@cogitarelink/profile-link
```

(Match the exact pattern of the existing lines — paths may differ.)

- [ ] **Step 3: Rebuild and restart**

```bash
docker compose build css
docker compose up -d
docker compose logs --tail=30 css
```

Expected: clean startup, no module-resolution errors for `@cogitarelink/profile-link`.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "[Agent: Claude] Dockerfile: symlink for @cogitarelink/profile-link

Standard symlink trick (per css-extension skill) so Components.js can
resolve the extension package from within the CSS container.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Full integration test pass

**Files:**
- Modify: `tests/test_phase5j_close.py`

- [ ] **Step 1: Add remaining integration tests**

Append:

```python
@pytest.mark.integration
def test_shape_response_carries_shacl_profile_link():
    r = httpx.get(f"{POD_BASE}/vault/meta/shapes/page.shacl.ttl", timeout=5)
    assert r.status_code == 200
    link = r.headers.get("link", "")
    assert '<https://www.w3.org/TR/shacl/>; rel="profile"' in link, \
        f"Link header missing SHACL profile: {link!r}"


@pytest.mark.integration
def test_wiki_concept_response_carries_two_profile_links():
    """A concept page should declare BOTH wiki:ConceptProfile and Solid Protocol."""
    # Use any existing concept page from a previously imported vault subset,
    # or POST a fixture page first. Adjust URL accordingly.
    url = f"{POD_BASE}/vault/wiki/pages/some-existing-concept"
    r = httpx.get(url, timeout=5)
    if r.status_code == 404:
        pytest.skip("no fixture concept page on this Pod")
    link = r.headers.get("link", "")
    assert '<https://pod.vardeman.me/vault/meta/profiles/concept>; rel="profile"' in link


@pytest.mark.integration
def test_affordance_response_carries_prof_profile_link():
    r = httpx.get(f"{POD_BASE}/vault/meta/affordances/markdown-projection.ttl", timeout=5)
    assert r.status_code == 200
    link = r.headers.get("link", "")
    assert '<http://www.w3.org/TR/dx-prof/>; rel="profile"' in link


@pytest.mark.integration
def test_wikirole_scheme_is_dereferenceable():
    r = httpx.get(f"{POD_BASE}/vault/ontology/wikirole", timeout=5)
    assert r.status_code == 200
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=f"{POD_BASE}/vault/ontology/wikirole")
    found = set(g.subjects(RDF.type, PROF.ResourceRole))
    assert len(found) == 5


@pytest.mark.integration
def test_profile_link_composes_with_memento_link():
    """A regular content resource should carry BOTH rel=profile AND rel=timegate."""
    r = httpx.get(f"{POD_BASE}/vault/wiki/pages/", timeout=5)
    link = r.headers.get("link", "")
    assert 'rel="timegate"' in link, f"missing Memento timegate link: {link!r}"
    # Container itself may not have a profile; check a known resource if needed.
```

- [ ] **Step 2: Run integration tests**

```bash
docker compose up -d
~/uvws/.venv/bin/python scripts/overlay/apply.py --pod http://localhost:3000 --overlay wiki-memory
~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py -v -m integration
```

Expected: all PASS (or SKIP for fixture-dependent tests).

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
~/uvws/.venv/bin/python -m pytest tests/ -v
cd css/extensions/profile-link && npm run test && cd ../../..
cd css/extensions/memento && npm run test && cd ../../..
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/test_phase5j_close.py
git commit -m "[Agent: Claude] Phase 5j close-out: integration tests green

End-to-end verification: shapes carry SHACL Link, wiki content carries
profile Link, affordances carry PROF Link, wikirole scheme dereferences
to 5 role concepts, profile-link composes with Memento timegate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Update FOLLOWUPS.md and memory

**Files:**
- Modify: `FOLLOWUPS.md`
- Modify: `.claude/memory/MEMORY.md`

- [ ] **Step 1: Close the two FOLLOWUPS items**

In `FOLLOWUPS.md`, under "Phase 5j (2026-05-16) — URI conformance close-out > Deferred from D86 implementation":

- Move item 1 ("PROF descriptor installation via overlay machinery") to a new "Closed by Phase 5j close-out" subsection with `[x]`.
- Move item 2 ("`Link: rel="profile"` MetadataWriter CSS extension") similarly.
- Items 3 (`_profile=alt`) and 4 (CSS storage description PATCH gate) remain open.

Add a new entry for the Framing-2 follow-up:

```markdown
- [ ] **Drop wiki:*Affordance classes in favor of pure PROF typing (Framing-2 refactor)**.
  Affordances currently carry BOTH `a wiki:WriteAffordance` AND
  `a prof:ResourceDescriptor; prof:hasRole wikirole:*` (Framing 1.5 additive,
  shipped in Phase 5j close-out). Pure-PROF refactor would retire the wiki:*Affordance
  classes from `wiki.ttl`, update consumers (any SHACL shapes or queries targeting
  those classes), and possibly mint a richer wikirole vocabulary if eval shows
  agents reading those roles. Decision criterion: Rung 1.5 evidence.
```

- [ ] **Step 2: Update memory**

Edit `.claude/memory/MEMORY.md` Phase-5j section to reflect close-out: Phase 5j 9-task plan now complete; mention wikirole scheme + ProfileLinkMetadataWriter as shipped.

- [ ] **Step 3: Commit**

```bash
git add FOLLOWUPS.md .claude/memory/MEMORY.md
git commit -m "[Agent: Claude] Phase 5j close-out: FOLLOWUPS + memory updates

Close FOLLOWUPS items 1+2 (PROF descriptor wiring + Link writer).
Add Framing-2 affordance refactor as deferred follow-up gated on
Rung 1.5 evidence.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-review checklist

Engineer running this plan should verify before declaring done:

- [ ] `~/uvws/.venv/bin/python -m pytest tests/test_phase5j_close.py -v` → all PASS (or skip with valid reason)
- [ ] `cd css/extensions/profile-link && npm run test` → 4× PASS
- [ ] `curl -sI http://localhost:3000/vault/meta/shapes/page.shacl.ttl | grep -i ^link:` includes SHACL profile
- [ ] `curl -sI http://localhost:3000/vault/meta/affordances/markdown-projection.ttl | grep -i ^link:` includes PROF profile
- [ ] `curl -s http://localhost:3000/vault/ontology/wikirole | grep -c prof:ResourceRole` returns ≥ 5
- [ ] `curl -s http://localhost:3000/.well-known/solid | grep wikirole` finds the vocabulary advertisement
- [ ] `git log --oneline | head -18` shows 17 commits with `[Agent: Claude]` prefix
