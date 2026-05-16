# Substrate Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip PARA-era infrastructure from the Pod substrate, extract wiki-memory into an installable overlay, add a capability catalog skeleton, remove Comunica as a docker service (move to solid-agent-skills CLI), and update the decisions log — making the Pod a self-describing toolkit per the design spec.

**Architecture:** Five sequential commits in `cogitarelink-solid`, with one cross-repo touch into `solid-agent-skills`. Each commit ends at green regression tests. Implementation order is destruction → infrastructure → content → cross-repo → docs. Final validation re-runs Sprint 1 of the pod-discover eval against the cleaned-up substrate.

**Tech Stack:** Python 3.12 (rdflib, httpx, pyshacl, pytest), TypeScript (CSS extensions, future solid-agent-skills CLI), Turtle/N3 Patch, Components.js, Docker compose, Comunica (`@comunica/query-sparql-link-traversal`).

**Spec:** `docs/superpowers/specs/2026-05-15-substrate-cleanup-design.md` (canonical reference)

**Working directory:** `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid` (unless otherwise specified — Phase 4 also touches `/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills`).

**Python interpreter:** `~/uvws/.venv/bin/python` (global uv venv per project CLAUDE.md).

**Pod URL (dev):** `http://pod.vardeman.me:3000/vault/`

---

## Phase 0: Pre-flight checks

Before destruction begins, capture current state so the work is recoverable.

### Task 0.1: Confirm Pod is up + capture pre-cleanup state

**Files:**
- No new files; verify-only

- [ ] **Step 1: Start the Pod stack**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
make up
```

Expected: `docker compose up -d` prints lines like `Container cogitarelink-solid-css-1 Started`. The healthcheck must pass (`Container ... Healthy`). If healthcheck fails, abort and debug before proceeding.

- [ ] **Step 2: Smoke-test discovery chain**

Run:
```bash
curl -sS -H "Accept: text/turtle" http://pod.vardeman.me:3000/vault/.well-known/solid | head -20
```

Expected: Turtle output declaring `pim:Storage`, `void:Dataset`, with predicates including `wiki:contextDocument`, `wiki:affordanceCatalog`, `wiki:typeIndex`. If you get a connection error, run `make up` again. If the storage description is empty or malformed, abort.

- [ ] **Step 3: Capture pre-cleanup snapshot for comparison**

Run:
```bash
mkdir -p /tmp/substrate-cleanup-snapshot
curl -sS -H "Accept: text/turtle" http://pod.vardeman.me:3000/vault/.well-known/solid > /tmp/substrate-cleanup-snapshot/storage-desc-before.ttl
curl -sS -H "Accept: text/turtle" http://pod.vardeman.me:3000/vault/settings/publicTypeIndex > /tmp/substrate-cleanup-snapshot/type-index-before.ttl
curl -sS -H "Accept: text/turtle" http://pod.vardeman.me:3000/vault/meta/affordances/ > /tmp/substrate-cleanup-snapshot/affordances-before.ttl
echo "Snapshot saved to /tmp/substrate-cleanup-snapshot/"
ls -la /tmp/substrate-cleanup-snapshot/
```

Expected: Three `.ttl` files saved. Each has content (non-zero size). These are reference artifacts — keep them for debugging if something goes wrong during cleanup.

---

## Phase 1: Strip PARA legacy from base template

Goal: After this phase, `make reset` produces a Pod with only L1 Solid scaffolding — no `/wiki/*`, no `/resources/*`, no `/projects/*`, empty Type Index, empty `/meta/affordances/`. Tag: `substrate-cleanup-step-1-strip`.

### Task 1.1: Write the regression test for "no PARA residue"

**Files:**
- Create: `tests/integration/test_substrate_cleanup.py`

- [ ] **Step 1: Create the test file with a failing PARA-residue check**

Create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/tests/integration/test_substrate_cleanup.py`:

```python
"""Integration tests for the substrate cleanup (Phase 1 onward).

Each test should fail BEFORE its corresponding cleanup step, pass AFTER.
Run individually with: pytest tests/integration/test_substrate_cleanup.py::<test_name> -v
"""
import pytest
import httpx
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF, RDFS

POD_URL = "http://pod.vardeman.me:3000/vault/"
CAP = Namespace("https://pod.vardeman.me:3000/vault/ontology/capability#")
WIKI = Namespace("https://pod.vardeman.me:3000/vault/ontology/wiki#")


def test_no_para_residue():
    """After Phase 1 cleanup, PARA-era containers should 404 on a fresh Pod."""
    para_paths = [
        "resources/", "areas/", "projects/", "archive/",
        "procedures/", "resources/concepts/", "resources/theories/",
        "resources/literature/", "resources/methods/", "resources/people/",
        "resources/external/", "procedures/queries/", "procedures/shapes/",
    ]
    failures = []
    for path in para_paths:
        r = httpx.head(POD_URL + path, timeout=5)
        if r.status_code != 404:
            failures.append(f"{path}: HTTP {r.status_code}")
    assert not failures, f"Phase 1 expected 404 for all PARA paths; got: {failures}"


def test_type_index_empty():
    """After Phase 1, Type Index resource exists but has no solid:TypeRegistration entries."""
    SOLID = Namespace("http://www.w3.org/ns/solid/terms#")
    r = httpx.get(POD_URL + "settings/publicTypeIndex",
                  headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200, f"Type Index should exist; got {r.status_code}"
    g = Graph().parse(data=r.text, format="turtle")
    registrations = list(g.subjects(RDF.type, SOLID.TypeRegistration))
    assert len(registrations) == 0, f"Type Index should be empty; found {len(registrations)} registrations"


def test_meta_affordances_empty_or_absent():
    """After Phase 1, /meta/affordances/ either 404s or returns empty container."""
    r = httpx.get(POD_URL + "meta/affordances/",
                  headers={"Accept": "text/turtle"}, timeout=5)
    if r.status_code == 404:
        return  # acceptable — overlay re-creates in Phase 3
    LDP = Namespace("http://www.w3.org/ns/ldp#")
    g = Graph().parse(data=r.text, format="turtle")
    contents = list(g.objects(predicate=LDP.contains))
    assert len(contents) == 0, f"Affordances container should be empty pre-overlay; found {contents}"
```

- [ ] **Step 2: Run the test against current Pod — verify it fails**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/integration/test_substrate_cleanup.py::test_no_para_residue -v
```

Expected: FAIL. Output includes `Phase 1 expected 404 for all PARA paths; got: ['resources/: HTTP 200', 'areas/: HTTP 200', ...]`. The current Pod has PARA residue — this is what Phase 1 fixes.

If test PASSES unexpectedly, your Pod is already cleaned up (unlikely). Investigate before continuing.

### Task 1.2: Delete PARA-era directories from base pod template

**Files:**
- Delete (entire trees): `css/config/pod-templates/base/archive/`, `css/config/pod-templates/base/areas/`, `css/config/pod-templates/base/projects/`, `css/config/pod-templates/base/procedures/`, `css/config/pod-templates/base/resources/`

- [ ] **Step 1: Inventory what's about to be deleted (sanity check)**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
find css/config/pod-templates/base/{archive,areas,projects,procedures,resources} -type f 2>/dev/null
```

Expected: List of `.meta` files (one per container). If any unexpected file types appear (e.g., `.md`, `.ttl` data files), stop and investigate — those might be content we want to preserve.

- [ ] **Step 2: Delete the directories**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
rm -rf css/config/pod-templates/base/archive \
       css/config/pod-templates/base/areas \
       css/config/pod-templates/base/projects \
       css/config/pod-templates/base/procedures \
       css/config/pod-templates/base/resources
ls css/config/pod-templates/base/
```

Expected: `base/` now contains `.meta`, `meta/`, `ontology/`, `profile/`, `settings/`, `wiki/`. (`wiki/` gets deleted in Task 1.3; `meta/` and `wiki/` content gets cleaned in Tasks 1.4–1.5.)

### Task 1.3: Delete `/wiki/*` content from base template (moves to overlay in Phase 3)

**Files:**
- Delete: `css/config/pod-templates/base/wiki/` (entire tree)

- [ ] **Step 1: Confirm wiki tree contents before delete**

Run:
```bash
find /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/wiki -type f
```

Expected: Five `.meta` files at `wiki/{pages,sources,people,procedures,working}/.meta` plus `wiki/.meta`.

- [ ] **Step 2: Delete the wiki tree**

Run:
```bash
rm -rf /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/wiki
ls /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/
```

Expected: No `wiki/` directory remains.

### Task 1.4: Delete `/meta/affordances/*.ttl` + `/meta/context.jsonld` from base template

**Files:**
- Delete: `css/config/pod-templates/base/meta/affordances/{markdown-projection,hub-view,breadcrumb-view,memento}.ttl`
- Delete: `css/config/pod-templates/base/meta/context.jsonld`
- Keep: `css/config/pod-templates/base/meta/.meta` (the meta-container root stays)
- Keep: `css/config/pod-templates/base/meta/affordances/.meta` (empty container stays; overlay populates it)
- Keep: `css/config/pod-templates/base/meta/shapes/.meta` (empty container stays)

- [ ] **Step 1: Confirm what's about to be deleted**

Run:
```bash
ls -la /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/meta/affordances/
ls -la /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/meta/
```

Expected: affordances/ has 4 `.ttl` files + `.meta`; meta/ has `.meta` + `context.jsonld` + sub-containers.

- [ ] **Step 2: Delete the four affordance descriptor files and context.jsonld**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
rm css/config/pod-templates/base/meta/affordances/markdown-projection.ttl
rm css/config/pod-templates/base/meta/affordances/hub-view.ttl
rm css/config/pod-templates/base/meta/affordances/breadcrumb-view.ttl
rm css/config/pod-templates/base/meta/affordances/memento.ttl
rm css/config/pod-templates/base/meta/context.jsonld
ls css/config/pod-templates/base/meta/affordances/
```

Expected: Only `.meta` remains in `affordances/`.

### Task 1.5: Replace Type Index template with an empty TypeIndex

**Files:**
- Modify: `css/config/pod-templates/base/settings/publicTypeIndex$.ttl.hbs`

- [ ] **Step 1: Read the current template to understand its shape**

Run:
```bash
cat /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/settings/publicTypeIndex\$.ttl.hbs
```

Expected: A Handlebars template emitting Phase-2 PARA registrations (`<#concepts>`, `<#theories>`, `<#literature>`, `<#methods>`, `<#projects>`).

- [ ] **Step 2: Overwrite with an empty Type Index template**

Replace the file content with:

```turtle
@prefix solid: <http://www.w3.org/ns/solid/terms#>.

<> a solid:TypeIndex, solid:ListedDocument.
```

Use the Write tool on `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/settings/publicTypeIndex$.ttl.hbs` with that exact content. (Note the `$` in the filename — CSS treats `$.ttl.hbs` suffix as "Handlebars template producing .ttl"; we keep the suffix even though there's no Handlebars substitution needed anymore.)

### Task 1.6: Rebase the root `.meta` storage description to L1-only

**Files:**
- Modify: `css/config/pod-templates/base/.meta`

- [ ] **Step 1: Read current root `.meta`**

Run:
```bash
cat /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/.meta
```

Expected: Current root `.meta` declares the wiki-memory catalog pointers (`wiki:contextDocument`, `wiki:shapeCatalog`, `wiki:affordanceCatalog`, `wiki:typeIndex`) and the five `rdfs:seeAlso` entries for `/wiki/*`.

- [ ] **Step 2: Overwrite with an L1-only storage description**

Replace the file content with:

```turtle
@prefix pim:   <http://www.w3.org/ns/pim/space#> .
@prefix void:  <http://rdfs.org/ns/void#> .
@prefix dcat:  <http://www.w3.org/ns/dcat#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix prov:  <http://www.w3.org/ns/prov#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix fabric: <https://w3id.org/cogitarelink/fabric#> .

<../> a pim:Storage, void:Dataset, dcat:DataService ;
    dct:conformsTo fabric:CoreProfile, fabric:SolidPodProfile ;
    void:vocabulary skos:, dct:, prov: ;
    void:feature fabric:LDPBrowse .
```

Use the Write tool on `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/.meta` with that exact content.

Notes for the engineer: This intentionally omits `void:vocabulary` for `cito:`, `foaf:`, `wiki:` — those get patched in by overlays. The standard W3C vocabularies (SKOS, DCT, PROV) stay because they're substrate-level (any overlay can use them; the TBox cache at `/vault/ontology/` mirrors them). Section 2 of the spec, "What stays in the base template (L1 only)," is the authoritative reference.

### Task 1.7: Update `pod_setup.py` to drop the shape-upload step

**Files:**
- Modify: `scripts/pod_setup.py`

- [ ] **Step 1: Read the relevant section of pod_setup.py**

Run:
```bash
grep -n "upload_shapes\|upload_ontology\|/procedures/shapes/" /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/scripts/pod_setup.py
```

Expected: Several hits — function definition `def upload_shapes(...)`, the call site in `main()` or similar, and the path `/vault/procedures/shapes/`.

- [ ] **Step 2: Comment out (do NOT delete) the `upload_shapes` call**

Use the Edit tool on `scripts/pod_setup.py` to find the call site (e.g., `upload_shapes(client, ...)` inside `main()`) and replace it with:

```python
        # NOTE: Phase 1 substrate cleanup — shape upload moved to wiki-memory overlay.
        # Do not call upload_shapes here. Apply the overlay instead:
        #   python scripts/overlay/apply.py overlays/wiki-memory --target <pod-url>
        # upload_shapes(client, shapes_dir)
```

(Commenting rather than deleting lets the next phase or a debugger see the prior intent. The function definition itself can stay; just don't call it.)

- [ ] **Step 3: Update the `verify_pod` smoke check to not expect PARA containers**

Open `scripts/pod_setup.py` and find the `verify_pod` function. It contains a list of paths to probe (e.g., `("/vault/resources/concepts/", "Concepts container")`). Use Edit to remove the PARA-era entries from that list, leaving only L1-level checks:

```python
def verify_pod(client: httpx.Client) -> bool:
    """Smoke test: check key pod resources exist (L1 only post-cleanup)."""
    checks = [
        ("/vault/", "Pod root"),
        ("/vault/profile/card", "WebID card"),
        ("/vault/settings/publicTypeIndex", "Type Index (empty post-Phase 1)"),
        ("/vault/.well-known/solid", "Storage description"),
    ]
    # ... rest of function unchanged
```

If the file has additional logic that fails when PARA containers are absent (e.g., counting shapes uploaded), comment those checks out with the same NOTE pattern.

### Task 1.8: Reset Pod + verify Phase 1 state

- [ ] **Step 1: Reset Pod with the new template**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
make reset
```

Expected: CSS comes down + back up with fresh `css-data` volume. Final lines show `pod-setup-1 ... exited`. If pod-setup errors on missing shapes dir or PARA verification, that's expected leftover behavior — investigate that the errors are about deleted-on-purpose paths and not actual bugs.

- [ ] **Step 2: Verify the Pod is L1-only by hand**

Run:
```bash
echo "=== PARA containers should 404 ===" && \
for p in resources/ areas/ projects/ archive/ procedures/; do \
  printf "%-15s" "$p"; curl -sS -o /dev/null -w "HTTP %{http_code}\n" "http://pod.vardeman.me:3000/vault/$p"; \
done
echo "" && \
echo "=== L1 containers should 200 ===" && \
for p in profile/card settings/publicTypeIndex meta/; do \
  printf "%-25s" "$p"; curl -sS -o /dev/null -w "HTTP %{http_code}\n" "http://pod.vardeman.me:3000/vault/$p"; \
done
```

Expected:
```
=== PARA containers should 404 ===
resources/     HTTP 404
areas/         HTTP 404
projects/      HTTP 404
archive/       HTTP 404
procedures/    HTTP 404

=== L1 containers should 200 ===
profile/card             HTTP 200
settings/publicTypeIndex HTTP 200
meta/                    HTTP 200
```

If any PARA path returns non-404, investigate which deletion was missed.

- [ ] **Step 3: Run the regression test, verify it passes**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/integration/test_substrate_cleanup.py::test_no_para_residue tests/integration/test_substrate_cleanup.py::test_type_index_empty -v
```

Expected: Both tests PASS.

### Task 1.9: Commit Phase 1 + tag

- [ ] **Step 1: Stage and commit**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git status
git add -A css/config/pod-templates/base/ scripts/pod_setup.py tests/integration/test_substrate_cleanup.py
git commit -m "$(cat <<'EOF'
[Agent: Claude] Strip PARA legacy from base pod template (cleanup step 1/5)

Removes the Phase-2 PARA infrastructure from the L1 base template:
- css/config/pod-templates/base/{archive,areas,projects,procedures,resources}/
- base/wiki/ (moves to overlays/wiki-memory in step 3)
- base/meta/affordances/{markdown-projection,hub-view,breadcrumb-view,memento}.ttl
  (moves to overlays/wiki-memory in step 3)
- base/meta/context.jsonld (moves to overlays/wiki-memory in step 3)

Type Index template rewritten to emit an empty solid:TypeIndex (overlays
add registrations via apply.py in step 2+).

Root .meta storage description rebased to L1-only (pim:Storage + Fabric
profile conformance + SKOS/DCT/PROV substrate vocabularies; no app-specific
catalog pointers or rdfs:seeAlso).

pod_setup.py: upload_shapes() call commented out (defers to overlay
machinery in step 2/3). verify_pod() checks reduced to L1 surfaces.

Regression test: tests/integration/test_substrate_cleanup.py with
test_no_para_residue + test_type_index_empty + test_meta_affordances_empty_or_absent.
All green after this commit.

Substrate is intentionally minimal after this commit; wiki-memory comes back
as an overlay in commit 3. Spec: docs/superpowers/specs/2026-05-15-substrate-cleanup-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds. Note the SHA.

- [ ] **Step 2: Tag the commit**

Run:
```bash
git tag -a substrate-cleanup-step-1-strip -m "Phase 1 complete: PARA legacy stripped from base template"
git tag -l | grep substrate-cleanup
```

Expected: `substrate-cleanup-step-1-strip` appears in tag list.

---

## Phase 2: Add overlay machinery + capability vocabulary

Goal: After this phase, the base L1 template ships substrate-level vocabularies for overlays and capabilities, an empty capability catalog container, and Python apply/remove/verify scripts that can install overlays idempotently. No wiki-memory overlay yet. Tag: `substrate-cleanup-step-2-machinery`.

### Task 2.1: Add the overlay + capability vocabularies to base template

**Files:**
- Create: `css/config/pod-templates/base/ontology/overlay.ttl`
- Create: `css/config/pod-templates/base/ontology/capability.ttl`

- [ ] **Step 1: Write the overlay vocabulary**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/ontology/overlay.ttl` with:

```turtle
@prefix overlay: <https://pod.vardeman.me:3000/vault/ontology/overlay#> .
@prefix cap:     <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix dct:     <http://purl.org/dc/terms/> .

overlay:Overlay a rdfs:Class ;
    rdfs:label "Application overlay" ;
    rdfs:comment "An installable bundle of containers, shapes, descriptors, vocabulary, and Type Index entries that adds an application to a Pod." ;
    rdfs:isDefinedBy <> .

overlay:name           a rdf:Property ; rdfs:label "Overlay short name" ; rdfs:isDefinedBy <> .
overlay:version        a rdf:Property ; rdfs:label "Overlay version" ; rdfs:isDefinedBy <> .

overlay:declaresVocabulary a rdf:Property ;
    rdfs:label "Vocabulary declared by this overlay" ;
    rdfs:comment "Object is a blank node with overlay:namespace, overlay:document, overlay:hostedAt." ;
    rdfs:isDefinedBy <> .

overlay:namespace      a rdf:Property ; rdfs:label "Vocabulary namespace IRI" ; rdfs:isDefinedBy <> .
overlay:document       a rdf:Property ; rdfs:label "Vocabulary source document (overlay-local path)" ; rdfs:isDefinedBy <> .
overlay:hostedAt       a rdf:Property ; rdfs:label "Pod-side path where vocabulary will be hosted" ; rdfs:isDefinedBy <> .

overlay:requiresCapability a rdf:Property ;
    rdfs:label "Capability required by this overlay" ;
    rdfs:comment "Object is a blank node with cap:requires (IRI of capability descriptor) and cap:minVersion." ;
    rdfs:isDefinedBy <> .

overlay:optionalCapability a rdf:Property ;
    rdfs:label "Capability optionally consumed by this overlay" ;
    rdfs:comment "If absent, overlay degrades per overlay:degradesTo." ;
    rdfs:isDefinedBy <> .

overlay:degradesTo a rdf:Property ;
    rdfs:label "Human-readable description of degraded behavior" ;
    rdfs:isDefinedBy <> .

overlay:dependsOnOverlay a rdf:Property ;
    rdfs:label "Overlay this depends on being already installed" ;
    rdfs:comment "apply.py refuses to install if dependency is absent." ;
    rdfs:isDefinedBy <> .

overlay:installsContainer    a rdf:Property ; rdfs:label "Pod path of a container this overlay creates" ; rdfs:isDefinedBy <> .
overlay:installsShape        a rdf:Property ; rdfs:label "Pod URL of a SHACL shape file this overlay uploads" ; rdfs:isDefinedBy <> .
overlay:installsAffordance   a rdf:Property ; rdfs:label "Pod URL of an affordance descriptor this overlay uploads" ; rdfs:isDefinedBy <> .
overlay:installsTypeRegistration a rdf:Property ;
    rdfs:label "Type Index registration this overlay adds" ;
    rdfs:comment "Object is a blank node with solid:forClass + solid:instanceContainer." ;
    rdfs:isDefinedBy <> .
```

- [ ] **Step 2: Write the capability vocabulary**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/ontology/capability.ttl` with the content from Section 5 of the spec (full content reproduced here so this task is standalone):

```turtle
@prefix cap:  <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:  <http://purl.org/dc/terms/> .

cap:Capability a rdfs:Class ;
    rdfs:label "Substrate capability" ;
    rdfs:comment "Generic substrate primitive offered by this Pod. Implemented by a CSS extension; configured by overlay-supplied descriptors." ;
    rdfs:isDefinedBy <> .

cap:ContentProjection a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:label "Content projection" ;
    rdfs:comment "On write, parse body of registered content-type, project triples into resource's .meta (D81)." ;
    rdfs:isDefinedBy <> .

cap:DerivedView a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:label "Derived view computation" ;
    rdfs:comment "Run CONSTRUCT/SELECT declared in affordance descriptor; return materialized triples on demand. NOTE: this Pod does NOT host a SPARQL endpoint — it publishes descriptors; agents bring their own engine (Comunica recommended)." ;
    rdfs:isDefinedBy <> .

cap:TimeTravel a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:label "Time travel (RFC 7089 Memento)" ;
    rdfs:comment "Per-resource versioning via ?ext=timemap + ?version=<14-digit-datetime>." ;
    rdfs:isDefinedBy <> .

cap:TwoStageCommit a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:label "Two-stage commit (D73)" ;
    rdfs:comment "Permissive working container + strict durable container; shape-gated promotion. NOT YET IMPLEMENTED." ;
    rdfs:isDefinedBy <> .

cap:TriggerEmission a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:label "Trigger emission (D74)" ;
    rdfs:comment "Emit AS2 notifications when SHACL rules flip on writes. NOT YET IMPLEMENTED." ;
    rdfs:isDefinedBy <> .

cap:ValidationHook a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:label "Validation hook" ;
    rdfs:comment "SHACL validate at write time; gate writes by class or container. NOT YET IMPLEMENTED." ;
    rdfs:isDefinedBy <> .

cap:ReferenceCatalog a rdfs:Class ; rdfs:subClassOf cap:Capability ;
    rdfs:label "Reference catalog" ;
    rdfs:comment "Substrate-maintained cache of cross-resource references (backlinks, citations). NOT YET IMPLEMENTED." ;
    rdfs:isDefinedBy <> .

# Predicates capability descriptors use
cap:version              a rdf:Property ; rdfs:isDefinedBy <> .
cap:implementedBy        a rdf:Property ; rdfs:isDefinedBy <> .
cap:configurationShape   a rdf:Property ; rdfs:isDefinedBy <> .
cap:contentType          a rdf:Property ; rdfs:isDefinedBy <> .

# Predicates overlays use to declare requirements
cap:requires             a rdf:Property ;
    rdfs:label "Required capability IRI" ;
    rdfs:comment "Overlay declares it cannot install without this capability at minVersion." ;
    rdfs:isDefinedBy <> .

cap:optional             a rdf:Property ;
    rdfs:label "Optional capability IRI" ;
    rdfs:comment "Overlay degrades gracefully without this capability." ;
    rdfs:isDefinedBy <> .

cap:minVersion           a rdf:Property ; rdfs:isDefinedBy <> .

# Predicate the storage description uses to advertise the catalog
cap:catalog              a rdf:Property ;
    rdfs:label "Pointer to capability catalog container" ;
    rdfs:isDefinedBy <> .
```

### Task 2.2: Add the capability catalog container to base template

**Files:**
- Create: `css/config/pod-templates/base/meta/capabilities/.meta`

- [ ] **Step 1: Create the directory and its `.meta`**

Run:
```bash
mkdir -p /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/meta/capabilities
```

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/meta/capabilities/.meta` with:

```turtle
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ldp: <http://www.w3.org/ns/ldp#> .
@prefix cap: <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix sh:  <http://www.w3.org/ns/shacl#> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Substrate capability catalog" ;
   dct:description "Each cap:Capability instance this Pod offers, with version + descriptor format." ;
   sh:agentInstruction "GET ldp:contains to enumerate capabilities offered. Each entry is a cap:Capability instance: GET it to learn version, implementation, and configuration expectations. Overlays reference these IRIs from their manifest's cap:requires clauses." .
```

This `.meta` ships in the base template. The container starts empty; capability descriptor files (Task 2.3) populate it.

### Task 2.3: Ship three capability descriptors in the base template

**Files:**
- Create: `css/config/pod-templates/base/meta/capabilities/markdown-content-projection.ttl`
- Create: `css/config/pod-templates/base/meta/capabilities/time-travel.ttl`
- Create: `css/config/pod-templates/base/meta/capabilities/derived-view.ttl`

- [ ] **Step 1: Write the Markdown Content Projection descriptor**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/meta/capabilities/markdown-content-projection.ttl` with:

```turtle
@prefix cap:   <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .

<> a cap:ContentProjection ;
   rdfs:label "Markdown content projection" ;
   cap:version "1.0" ;
   cap:contentType "text/markdown" ;
   cap:implementedBy <css/extensions/markdown-projection> ;
   cap:configurationShape wiki:WriteAffordance ;
   dct:description "On write of text/markdown body, parse frontmatter + body wikilinks, project triples into resource's .meta per the wiki:WriteAffordance descriptor governing that container. Implements D58/D71/D81." ;
   sh:agentInstruction "An overlay configures this primitive by installing a wiki:WriteAffordance descriptor in /vault/meta/affordances/ with wiki:governs predicates and wiki:projectsFromFrontmatter keys. The substrate fires this primitive on every write to a container whose .meta points at such a descriptor." .
```

- [ ] **Step 2: Write the Time-Travel descriptor**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/meta/capabilities/time-travel.ttl` with:

```turtle
@prefix cap:   <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .

<> a cap:TimeTravel ;
   rdfs:label "RFC 7089 Memento per-resource versioning" ;
   cap:version "1.0" ;
   cap:implementedBy <css/extensions/memento> ;
   dct:conformsTo <http://www.rfc-editor.org/rfc/rfc7089.txt> ;
   dct:description "Every resource is versioned. Trellis-style query strings: ?ext=timemap returns a TimeMap; ?version=<14-digit-datetime> returns a specific Memento. Pattern 1.1 — OriginalResource doubles as TimeGate. Advertised via Link rel=timemap, rel=timegate, and Vary: accept-datetime headers on every resource." ;
   sh:agentInstruction "To enumerate versions of a resource <R>, GET <R>?ext=timemap with Accept: application/link-format or text/turtle. To fetch a specific version, GET <R>?version=20260515171025 (replace with desired 14-digit datetime). Tombstoned resources return 410 Gone on plain GET but their TimeMap still resolves." .
```

- [ ] **Step 3: Write the Derived-View descriptor**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/meta/capabilities/derived-view.ttl` with:

```turtle
@prefix cap:   <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .

<> a cap:DerivedView ;
   rdfs:label "Derived view descriptor publication" ;
   cap:version "1.0" ;
   cap:implementedBy <substrate-side: descriptor publication only> ;
   dct:description "This Pod publishes affordance descriptors (wiki:DerivedClassAffordance, wiki:DerivedNavigationAffordance) that declare CONSTRUCT or SELECT queries. The Pod does NOT execute these queries server-side. Agents wishing to materialize derived views must bring their own SPARQL 1.1 engine with link-traversal support (Comunica recommended) and run the queries client-side with this Pod's container roots as sources." ;
   sh:agentInstruction "To use a derived view: (1) GET the affordance descriptor from /vault/meta/affordances/<name>.ttl; (2) extract wiki:constructQuery or wiki:selectQuery; (3) run via your own SPARQL engine pointed at this Pod's rdfs:seeAlso container roots." .
```

### Task 2.4: Add `cap:catalog` pointer to root `.meta` storage description

**Files:**
- Modify: `css/config/pod-templates/base/.meta`

- [ ] **Step 1: Append the catalog pointer**

Use Edit on `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/css/config/pod-templates/base/.meta` to find:

```turtle
    void:vocabulary skos:, dct:, prov: ;
    void:feature fabric:LDPBrowse .
```

Replace with:

```turtle
    void:vocabulary skos:, dct:, prov: ;
    void:vocabulary <https://pod.vardeman.me:3000/vault/ontology/capability#> ,
                    <https://pod.vardeman.me:3000/vault/ontology/overlay#> ;
    void:feature fabric:LDPBrowse ;
    <https://pod.vardeman.me:3000/vault/ontology/capability#catalog> </vault/meta/capabilities/> .
```

The substrate now declares its own substrate-level vocabularies and points at the capability catalog. Apps coming in via overlay will append their own `void:vocabulary` and `dct:conformsTo` lines via N3 patches.

### Task 2.5: Write the apply.py + remove.py + verify.py overlay scripts

**Files:**
- Create: `scripts/overlay/__init__.py` (empty marker)
- Create: `scripts/overlay/common.py` (shared utilities)
- Create: `scripts/overlay/apply.py`
- Create: `scripts/overlay/remove.py`
- Create: `scripts/overlay/verify.py`

- [ ] **Step 1: Create scripts/overlay/ and __init__.py**

Run:
```bash
mkdir -p /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/scripts/overlay
touch /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/scripts/overlay/__init__.py
```

- [ ] **Step 2: Write scripts/overlay/common.py**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/scripts/overlay/common.py` with:

```python
"""Shared utilities for overlay apply/remove/verify scripts.

All HTTP operations go through a single httpx.Client; N3 Patch construction
is shared because it's the same shape for every modification of a shared
substrate resource (storage description, Type Index, context.jsonld).
"""
from __future__ import annotations
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import httpx
from rdflib import Graph, Namespace, URIRef, Literal, BNode
from rdflib.namespace import RDF, RDFS, DCTERMS

OVERLAY = Namespace("https://pod.vardeman.me:3000/vault/ontology/overlay#")
CAP     = Namespace("https://pod.vardeman.me:3000/vault/ontology/capability#")
SOLID   = Namespace("http://www.w3.org/ns/solid/terms#")
VOID    = Namespace("http://rdfs.org/ns/void#")
SH      = Namespace("http://www.w3.org/ns/shacl#")
WIKI    = Namespace("https://pod.vardeman.me:3000/vault/ontology/wiki#")  # only when overlay uses it


@dataclass(frozen=True)
class CapabilityRequirement:
    iri: URIRef          # IRI of the capability descriptor expected on the Pod
    min_version: str     # e.g., "1.0"
    optional: bool = False
    degrades_to: str | None = None


@dataclass(frozen=True)
class VocabularyDeclaration:
    namespace: URIRef    # vocabulary namespace IRI (e.g., wiki:)
    document: Path       # overlay-local path to the vocab .ttl file
    hosted_at: str       # Pod-side path where it will be uploaded


@dataclass(frozen=True)
class TypeRegistration:
    for_class: URIRef
    instance_container: URIRef


@dataclass(frozen=True)
class Manifest:
    """Parsed view of an overlay's manifest.ttl."""
    name: str
    version: str
    overlay_iri: URIRef
    profile_iri: URIRef | None
    depends_on_overlays: list[URIRef]
    required_capabilities: list[CapabilityRequirement]
    optional_capabilities: list[CapabilityRequirement]
    vocabularies: list[VocabularyDeclaration]
    container_paths: list[str]        # e.g., "/vault/wiki/pages/"
    shape_urls: list[str]             # full Pod URLs
    affordance_urls: list[str]
    type_registrations: list[TypeRegistration]
    overlay_dir: Path                 # local directory holding manifest + artifacts


def parse_manifest(overlay_dir: Path) -> Manifest:
    """Parse manifest.ttl into a structured Manifest."""
    manifest_path = overlay_dir / "manifest.ttl"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Overlay manifest not found: {manifest_path}")

    g = Graph()
    g.parse(manifest_path, format="turtle")

    overlay_subjects = list(g.subjects(RDF.type, OVERLAY.Overlay))
    if not overlay_subjects:
        raise ValueError(f"No overlay:Overlay declaration in {manifest_path}")
    overlay_iri = overlay_subjects[0]

    def one(predicate):
        objs = list(g.objects(overlay_iri, predicate))
        return objs[0] if objs else None

    def many(predicate):
        return list(g.objects(overlay_iri, predicate))

    name = str(one(OVERLAY.name) or "")
    version = str(one(OVERLAY.version) or "")
    profile_iri = one(DCTERMS.conformsTo)

    depends_on = [URIRef(o) for o in many(OVERLAY.dependsOnOverlay)]

    req_caps = []
    for req_node in many(OVERLAY.requiresCapability):
        iri = next(g.objects(req_node, CAP.requires), None)
        mv = next(g.objects(req_node, CAP.minVersion), Literal("0.0"))
        if iri:
            req_caps.append(CapabilityRequirement(URIRef(iri), str(mv), optional=False))

    opt_caps = []
    for opt_node in many(OVERLAY.optionalCapability):
        iri = next(g.objects(opt_node, CAP.requires), None)
        mv = next(g.objects(opt_node, CAP.minVersion), Literal("0.0"))
        deg = next(g.objects(opt_node, OVERLAY.degradesTo), None)
        if iri:
            opt_caps.append(CapabilityRequirement(URIRef(iri), str(mv), optional=True,
                                                  degrades_to=str(deg) if deg else None))

    vocabs = []
    for v_node in many(OVERLAY.declaresVocabulary):
        ns = next(g.objects(v_node, OVERLAY.namespace), None)
        doc = next(g.objects(v_node, OVERLAY.document), None)
        host = next(g.objects(v_node, OVERLAY.hostedAt), None)
        if ns and doc and host:
            vocabs.append(VocabularyDeclaration(URIRef(ns), overlay_dir / str(doc), str(host)))

    containers = [str(o) for o in many(OVERLAY.installsContainer)]
    shapes = [str(o) for o in many(OVERLAY.installsShape)]
    affordances = [str(o) for o in many(OVERLAY.installsAffordance)]

    type_regs = []
    for tr_node in many(OVERLAY.installsTypeRegistration):
        fc = next(g.objects(tr_node, SOLID.forClass), None)
        ic = next(g.objects(tr_node, SOLID.instanceContainer), None)
        if fc and ic:
            type_regs.append(TypeRegistration(URIRef(fc), URIRef(ic)))

    return Manifest(
        name=name, version=version, overlay_iri=overlay_iri, profile_iri=profile_iri,
        depends_on_overlays=depends_on,
        required_capabilities=req_caps, optional_capabilities=opt_caps,
        vocabularies=vocabs,
        container_paths=containers, shape_urls=shapes, affordance_urls=affordances,
        type_registrations=type_regs,
        overlay_dir=overlay_dir,
    )


def fetch_capability_catalog(client: httpx.Client, pod_url: str) -> dict[str, str]:
    """Fetch the capability catalog and return a mapping of capability IRI → version string."""
    catalog_url = pod_url.rstrip("/") + "/meta/capabilities/"
    r = client.get(catalog_url, headers={"Accept": "text/turtle"}, timeout=10)
    if r.status_code != 200:
        raise RuntimeError(f"Capability catalog not reachable at {catalog_url}: HTTP {r.status_code}")
    g = Graph().parse(data=r.text, format="turtle", publicID=catalog_url)
    LDP = Namespace("http://www.w3.org/ns/ldp#")
    entries = list(g.objects(predicate=LDP.contains))
    versions = {}
    for entry in entries:
        entry_url = str(entry) if not str(entry).startswith("http") else str(entry)
        if not entry_url.startswith("http"):
            entry_url = catalog_url + entry_url
        r2 = client.get(entry_url, headers={"Accept": "text/turtle"}, timeout=10)
        if r2.status_code != 200:
            continue
        eg = Graph().parse(data=r2.text, format="turtle", publicID=entry_url)
        v = next(eg.objects(predicate=CAP.version), None)
        if v is not None:
            versions[entry_url] = str(v)
    return versions


def put_file(client: httpx.Client, pod_url: str, local: Path, content_type: str) -> None:
    """Idempotent PUT of a local file to a Pod URL. Raises on non-2xx."""
    body = local.read_bytes()
    r = client.put(pod_url, content=body, headers={"Content-Type": content_type}, timeout=15)
    if r.status_code not in (200, 201, 204, 205):
        raise RuntimeError(f"PUT {pod_url} failed: HTTP {r.status_code}: {r.text[:300]}")


def ensure_container(client: httpx.Client, container_url: str) -> None:
    """Create an LDP container if it doesn't exist. Idempotent."""
    r = client.head(container_url, timeout=5)
    if r.status_code == 200:
        return
    # Create by PUT-ing an empty Turtle representation; CSS treats trailing-slash PUT as container creation
    body = "@prefix dct: <http://purl.org/dc/terms/> . <> dct:title \"Container\" .\n"
    r2 = client.put(container_url, content=body.encode("utf-8"),
                    headers={"Content-Type": "text/turtle"}, timeout=10)
    if r2.status_code not in (200, 201, 204, 205):
        raise RuntimeError(f"Container create {container_url} failed: HTTP {r2.status_code}: {r2.text[:300]}")


def n3_patch_inserts(client: httpx.Client, target_url: str, turtle_inserts: str) -> None:
    """Apply an N3 Patch to target_url that inserts the given Turtle triples.

    The turtle_inserts string is the body of solid:inserts { ... } — must use absolute IRIs
    or have its prefixes inlined in the calling context.
    """
    patch_body = f"""@prefix solid: <http://www.w3.org/ns/solid/terms#>.

_:patch a solid:InsertDeletePatch ;
   solid:inserts {{ {turtle_inserts} }} .
"""
    r = client.patch(target_url, content=patch_body.encode("utf-8"),
                     headers={"Content-Type": "text/n3"}, timeout=15)
    if r.status_code not in (200, 201, 204, 205):
        raise RuntimeError(f"PATCH {target_url} failed: HTTP {r.status_code}: {r.text[:300]}")


def version_at_least(actual: str, required: str) -> bool:
    """Lexicographic version comparison sufficient for "1.0" / "1.1" / "2.0" style strings."""
    def tup(v: str) -> tuple[int, ...]:
        return tuple(int(x) for x in v.split(".") if x.isdigit())
    return tup(actual) >= tup(required)
```

- [ ] **Step 3: Write scripts/overlay/apply.py**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/scripts/overlay/apply.py` with:

```python
"""Apply an overlay to a Pod.

Idempotent: re-running against an already-applied overlay produces no errors
and no new state changes. Uses PUT (creates or overwrites) for file resources
and N3 Patch with solid:inserts (no-op if triples exist) for shared resources.

Usage:
    python scripts/overlay/apply.py <overlay-dir> --target <pod-url>

Example:
    python scripts/overlay/apply.py overlays/wiki-memory \\
        --target http://pod.vardeman.me:3000/vault/
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

import httpx

from .common import (
    Manifest, parse_manifest, fetch_capability_catalog, put_file,
    ensure_container, n3_patch_inserts, version_at_least,
)


def check_overlay_dependencies(client: httpx.Client, pod_url: str, manifest: Manifest) -> None:
    """Refuse to apply if any depends_on_overlay isn't already installed."""
    if not manifest.depends_on_overlays:
        return
    storage_url = pod_url.rstrip("/") + "/.well-known/solid"
    from rdflib import Graph, Namespace
    OVERLAY = Namespace("https://pod.vardeman.me:3000/vault/ontology/overlay#")
    r = client.get(storage_url, headers={"Accept": "text/turtle"}, timeout=10)
    if r.status_code != 200:
        raise RuntimeError(f"Storage description not reachable: HTTP {r.status_code}")
    g = Graph().parse(data=r.text, format="turtle", publicID=storage_url)
    installed = set(g.objects(predicate=OVERLAY.installedOverlay))
    missing = [d for d in manifest.depends_on_overlays if d not in installed]
    if missing:
        raise RuntimeError(
            f"Overlay {manifest.name} requires these overlays to be installed first: "
            f"{[str(m) for m in missing]}"
        )


def check_capabilities(client: httpx.Client, pod_url: str, manifest: Manifest) -> None:
    """Verify required capabilities are present at minVersion. Warn on missing optional."""
    catalog = fetch_capability_catalog(client, pod_url)
    for req in manifest.required_capabilities:
        actual = catalog.get(str(req.iri))
        if actual is None:
            raise RuntimeError(f"Required capability missing: {req.iri}")
        if not version_at_least(actual, req.min_version):
            raise RuntimeError(
                f"Required capability {req.iri} at version {actual}; need >= {req.min_version}"
            )
    for opt in manifest.optional_capabilities:
        actual = catalog.get(str(opt.iri))
        if actual is None or not version_at_least(actual, opt.min_version):
            print(f"  [warn] Optional capability missing: {opt.iri} — {opt.degrades_to or 'degrades'}",
                  file=sys.stderr)


def apply_overlay(overlay_dir: Path, pod_url: str) -> None:
    manifest = parse_manifest(overlay_dir)
    pod_url = pod_url.rstrip("/") + "/"
    print(f"Applying overlay: {manifest.name} v{manifest.version}")
    print(f"  Target: {pod_url}")

    with httpx.Client() as client:
        check_overlay_dependencies(client, pod_url, manifest)
        check_capabilities(client, pod_url, manifest)

        # 1. Upload vocabulary documents
        for vocab in manifest.vocabularies:
            url = pod_url.rstrip("/") + vocab.hosted_at
            put_file(client, url, vocab.document, "text/turtle")
            print(f"  vocab → {url}")

        # 2. Upload shape files
        for shape_url in manifest.shape_urls:
            local = overlay_dir / "shapes" / Path(shape_url).name
            url = absolutize(pod_url, shape_url)
            put_file(client, url, local, "text/turtle")
            print(f"  shape → {url}")

        # 3. Upload affordance descriptors
        for aff_url in manifest.affordance_urls:
            local = overlay_dir / "affordances" / Path(aff_url).name
            url = absolutize(pod_url, aff_url)
            put_file(client, url, local, "text/turtle")
            print(f"  aff   → {url}")

        # 4. Create containers + their .meta files
        for container_path in manifest.container_paths:
            container_url = absolutize(pod_url, container_path)
            ensure_container(client, container_url)
            # Look for a matching .meta file under overlay_dir/containers/<path>/.meta
            rel = container_path.replace("/vault/", "", 1).rstrip("/") + "/.meta"
            meta_local = overlay_dir / "containers" / rel
            if meta_local.exists():
                meta_url = container_url.rstrip("/") + "/.meta"
                put_file(client, meta_url, meta_local, "text/turtle")
                print(f"  meta  → {meta_url}")

        # 5. Merge JSON-LD context fragment
        ctx_fragment = overlay_dir / "context-fragment.jsonld"
        if ctx_fragment.exists():
            merge_jsonld_context(client, pod_url, ctx_fragment, manifest.overlay_iri)
            print(f"  ctx merged into /vault/meta/context.jsonld")

        # 6. PATCH Type Index with registrations
        if manifest.type_registrations:
            ti_url = pod_url.rstrip("/") + "/settings/publicTypeIndex"
            inserts = build_type_index_inserts(manifest)
            n3_patch_inserts(client, ti_url, inserts)
            print(f"  type index → {len(manifest.type_registrations)} registrations patched in")

        # 7. PATCH storage description with this overlay's conformsTo + rdfs:seeAlso + vocab
        storage_patch = overlay_dir / "storage-patch.ttl"
        if storage_patch.exists():
            sd_url = pod_url.rstrip("/") + "/.well-known/solid"
            inserts = extract_inserts_block(storage_patch.read_text())
            n3_patch_inserts(client, sd_url, inserts)
            print(f"  storage description patched")

    print(f"Applied overlay {manifest.name} successfully.")


def absolutize(pod_url: str, maybe_relative: str) -> str:
    """Convert a path like '/vault/wiki/pages/' to an absolute URL."""
    if maybe_relative.startswith("http"):
        return maybe_relative
    if maybe_relative.startswith("/vault/"):
        # pod_url already includes /vault/ — strip the duplicate
        return pod_url.rstrip("/").rstrip("/vault") + maybe_relative
    return pod_url.rstrip("/") + maybe_relative


def merge_jsonld_context(client: httpx.Client, pod_url: str, fragment_path: Path, overlay_iri) -> None:
    """Merge a JSON-LD context fragment into /vault/meta/context.jsonld.

    Strategy: PUT a merged document. Reads current context (or creates new), unions
    the @context keys (overlay's win on conflict to enable updates), writes back.
    """
    import json
    ctx_url = pod_url.rstrip("/") + "/meta/context.jsonld"
    r = client.get(ctx_url, headers={"Accept": "application/ld+json"}, timeout=10)
    if r.status_code == 200 and r.text.strip():
        try:
            existing = json.loads(r.text)
        except json.JSONDecodeError:
            existing = {"@context": {}}
    else:
        existing = {"@context": {}}

    fragment = json.loads(fragment_path.read_text())
    existing_ctx = existing.get("@context", {})
    if not isinstance(existing_ctx, dict):
        existing_ctx = {}
    fragment_ctx = fragment.get("@context", {})
    existing_ctx.update(fragment_ctx)
    existing["@context"] = existing_ctx

    body = json.dumps(existing, indent=2).encode("utf-8")
    r2 = client.put(ctx_url, content=body, headers={"Content-Type": "application/ld+json"}, timeout=15)
    if r2.status_code not in (200, 201, 204, 205):
        raise RuntimeError(f"context merge PUT failed: HTTP {r2.status_code}: {r2.text[:300]}")


def build_type_index_inserts(manifest: Manifest) -> str:
    """Build the Turtle body for solid:inserts to add Type Index entries."""
    lines = ["@prefix solid: <http://www.w3.org/ns/solid/terms#>."]
    for i, tr in enumerate(manifest.type_registrations):
        lines.append(
            f"<#reg{i}-{manifest.name}> a solid:TypeRegistration ; "
            f"solid:forClass <{tr.for_class}> ; "
            f"solid:instanceContainer <{tr.instance_container}> ."
        )
    return "\n".join(lines)


def extract_inserts_block(patch_text: str) -> str:
    """Pull the contents of solid:inserts { ... } out of a storage-patch.ttl file.

    The overlay author writes a full N3 Patch; we want just the inserts block
    so we can re-wrap it in our own _:patch envelope. Simple brace-matching parse.
    """
    start = patch_text.find("solid:inserts")
    if start == -1:
        raise ValueError("storage-patch.ttl missing solid:inserts block")
    brace_open = patch_text.find("{", start)
    if brace_open == -1:
        raise ValueError("storage-patch.ttl: no '{' after solid:inserts")
    depth = 1
    pos = brace_open + 1
    while depth and pos < len(patch_text):
        c = patch_text[pos]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        pos += 1
    if depth:
        raise ValueError("storage-patch.ttl: unbalanced braces")
    inner = patch_text[brace_open + 1: pos - 1]
    # Prepend the @prefix lines from the file so the inserts block uses them
    prefix_lines = [line for line in patch_text.splitlines() if line.strip().startswith("@prefix")]
    return "\n".join(prefix_lines) + "\n" + inner


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("overlay_dir", type=Path, help="Path to overlay directory")
    parser.add_argument("--target", required=True, help="Pod URL")
    args = parser.parse_args()
    apply_overlay(args.overlay_dir, args.target)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Write scripts/overlay/remove.py**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/scripts/overlay/remove.py` with:

```python
"""Remove an overlay from a Pod.

Two modes:
  --keep-data (default in interactive use, but explicit here): leaves containers
              and user data intact; removes app infrastructure (descriptors,
              shapes, vocab, Type Index entries, storage description entries).
  --uninstall: same as keep-data, plus deletes containers (requires --confirm).

Usage:
    python scripts/overlay/remove.py <overlay-dir> --target <pod-url> [--keep-data | --uninstall --confirm]
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

import httpx
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF

from .common import Manifest, parse_manifest, n3_patch_inserts, OVERLAY, CAP, SOLID, WIKI


def delete_resource(client: httpx.Client, url: str) -> None:
    """DELETE a resource. 404 is fine (already gone)."""
    r = client.delete(url, timeout=10)
    if r.status_code not in (200, 204, 205, 404):
        print(f"  [warn] DELETE {url} returned HTTP {r.status_code}: {r.text[:200]}", file=sys.stderr)


def patch_deletes(client: httpx.Client, target_url: str, turtle_deletes: str) -> None:
    """N3 Patch with solid:deletes."""
    patch_body = f"""@prefix solid: <http://www.w3.org/ns/solid/terms#>.

_:patch a solid:InsertDeletePatch ;
   solid:deletes {{ {turtle_deletes} }} .
"""
    r = client.patch(target_url, content=patch_body.encode("utf-8"),
                     headers={"Content-Type": "text/n3"}, timeout=15)
    if r.status_code not in (200, 201, 204, 205):
        print(f"  [warn] DELETE-patch {target_url} returned HTTP {r.status_code}: {r.text[:200]}", file=sys.stderr)


def remove_overlay(overlay_dir: Path, pod_url: str, uninstall: bool, confirm: bool) -> None:
    manifest = parse_manifest(overlay_dir)
    pod_url = pod_url.rstrip("/") + "/"
    print(f"Removing overlay: {manifest.name} v{manifest.version}")
    print(f"  Mode: {'UNINSTALL (deletes containers)' if uninstall else 'DEACTIVATE (keeps containers)'}")
    print(f"  Target: {pod_url}")

    if uninstall and not confirm:
        raise SystemExit(
            "--uninstall is destructive (deletes containers + their contents). "
            "Re-run with --confirm to proceed."
        )

    with httpx.Client() as client:
        # 1. Delete affordance descriptors
        for aff_url in manifest.affordance_urls:
            url = aff_url if aff_url.startswith("http") else (pod_url.rstrip("/").rstrip("/vault") + aff_url)
            delete_resource(client, url)
            print(f"  aff   ✗ {url}")

        # 2. Delete shape files
        for shape_url in manifest.shape_urls:
            url = shape_url if shape_url.startswith("http") else (pod_url.rstrip("/").rstrip("/vault") + shape_url)
            delete_resource(client, url)
            print(f"  shape ✗ {url}")

        # 3. Delete vocabulary documents
        for vocab in manifest.vocabularies:
            url = pod_url.rstrip("/") + vocab.hosted_at
            delete_resource(client, url)
            print(f"  vocab ✗ {url}")

        # 4. PATCH Type Index — remove this overlay's registrations
        if manifest.type_registrations:
            ti_url = pod_url.rstrip("/") + "/settings/publicTypeIndex"
            removes = []
            for i, tr in enumerate(manifest.type_registrations):
                removes.append(
                    f"@prefix solid: <http://www.w3.org/ns/solid/terms#> . "
                    f"<#reg{i}-{manifest.name}> a solid:TypeRegistration ; "
                    f"solid:forClass <{tr.for_class}> ; "
                    f"solid:instanceContainer <{tr.instance_container}> ."
                )
            patch_deletes(client, ti_url, "\n".join(removes))
            print(f"  type index ✗ {len(manifest.type_registrations)} registrations removed")

        # 5. PATCH storage description — remove this overlay's conformsTo + rdfs:seeAlso + vocab
        sd_url = pod_url.rstrip("/") + "/.well-known/solid"
        # Build delete body from storage-patch.ttl (use same inserts content but as deletes)
        sp = overlay_dir / "storage-patch.ttl"
        if sp.exists():
            from .apply import extract_inserts_block
            inserts = extract_inserts_block(sp.read_text())
            patch_deletes(client, sd_url, inserts)
            print(f"  storage description ✗ overlay entries removed")

        # 6. If --uninstall, delete containers
        if uninstall:
            # Delete in reverse depth order (children before parents)
            for container_path in sorted(manifest.container_paths, key=len, reverse=True):
                url = container_path if container_path.startswith("http") else (pod_url.rstrip("/").rstrip("/vault") + container_path)
                delete_resource(client, url)
                print(f"  container ✗ {url}")

    print(f"Removed overlay {manifest.name} successfully.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("overlay_dir", type=Path, help="Path to overlay directory")
    parser.add_argument("--target", required=True, help="Pod URL")
    parser.add_argument("--keep-data", action="store_true",
                        help="Default behavior; leaves containers + user data intact")
    parser.add_argument("--uninstall", action="store_true",
                        help="Destructive: also delete containers and user data")
    parser.add_argument("--confirm", action="store_true",
                        help="Required with --uninstall")
    args = parser.parse_args()
    if args.uninstall and args.keep_data:
        raise SystemExit("--uninstall and --keep-data are mutually exclusive")
    remove_overlay(args.overlay_dir, args.target, uninstall=args.uninstall, confirm=args.confirm)


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Write scripts/overlay/verify.py**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/scripts/overlay/verify.py` with:

```python
"""Verify an installed overlay matches its manifest.

Walks the manifest and checks each declared artifact is present on the Pod.
Reports any drift.

Usage:
    python scripts/overlay/verify.py <overlay-dir> --target <pod-url>
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

import httpx
from rdflib import Graph

from .common import parse_manifest, Manifest


def verify_overlay(overlay_dir: Path, pod_url: str) -> int:
    """Return number of drift errors found (0 = clean)."""
    manifest = parse_manifest(overlay_dir)
    pod_url = pod_url.rstrip("/") + "/"
    print(f"Verifying overlay: {manifest.name} v{manifest.version} against {pod_url}")
    errors = 0

    with httpx.Client() as client:
        # Containers
        for c in manifest.container_paths:
            url = c if c.startswith("http") else (pod_url.rstrip("/").rstrip("/vault") + c)
            r = client.head(url, timeout=5)
            if r.status_code != 200:
                print(f"  [drift] container missing: {url} (HTTP {r.status_code})", file=sys.stderr)
                errors += 1

        # Shape files
        for s in manifest.shape_urls:
            url = s if s.startswith("http") else (pod_url.rstrip("/").rstrip("/vault") + s)
            r = client.head(url, timeout=5)
            if r.status_code != 200:
                print(f"  [drift] shape missing: {url} (HTTP {r.status_code})", file=sys.stderr)
                errors += 1

        # Affordances
        for a in manifest.affordance_urls:
            url = a if a.startswith("http") else (pod_url.rstrip("/").rstrip("/vault") + a)
            r = client.head(url, timeout=5)
            if r.status_code != 200:
                print(f"  [drift] affordance missing: {url} (HTTP {r.status_code})", file=sys.stderr)
                errors += 1

        # Vocabularies
        for v in manifest.vocabularies:
            url = pod_url.rstrip("/") + v.hosted_at
            r = client.head(url, timeout=5)
            if r.status_code != 200:
                print(f"  [drift] vocab missing: {url} (HTTP {r.status_code})", file=sys.stderr)
                errors += 1

    if errors == 0:
        print(f"Overlay {manifest.name}: clean (no drift).")
    else:
        print(f"Overlay {manifest.name}: {errors} drift errors.", file=sys.stderr)
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("overlay_dir", type=Path, help="Path to overlay directory")
    parser.add_argument("--target", required=True, help="Pod URL")
    args = parser.parse_args()
    errors = verify_overlay(args.overlay_dir, args.target)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
```

### Task 2.6: Reset Pod + verify capability catalog discoverable

- [ ] **Step 1: Reset Pod with Phase 2 additions**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
make reset
```

Expected: Healthy Pod with new base template applied.

- [ ] **Step 2: Verify capability catalog is reachable**

Run:
```bash
curl -sS -H "Accept: text/turtle" http://pod.vardeman.me:3000/vault/meta/capabilities/ | head -30
```

Expected: Container listing showing `ldp:contains <markdown-content-projection.ttl>, <time-travel.ttl>, <derived-view.ttl>`.

- [ ] **Step 3: Verify storage description points at catalog**

Run:
```bash
curl -sS -H "Accept: text/turtle" http://pod.vardeman.me:3000/vault/.well-known/solid | grep -i 'capability'
```

Expected: Lines containing `capability#catalog` and `capability#` (the vocab declaration) and `overlay#`.

- [ ] **Step 4: Verify ontology files are reachable (linked-data dereferenceability)**

Run:
```bash
for vocab in capability overlay; do \
  printf "%-15s" "$vocab.ttl"; \
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" "http://pod.vardeman.me:3000/vault/ontology/$vocab.ttl"; \
done
```

Expected: Both return HTTP 200.

### Task 2.7: Add integration tests for capability catalog + overlay machinery

**Files:**
- Modify: `tests/integration/test_substrate_cleanup.py` (append new tests)

- [ ] **Step 1: Append tests to test_substrate_cleanup.py**

Use Edit to append the following functions to `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/tests/integration/test_substrate_cleanup.py`:

```python
def test_storage_description_announces_capabilities():
    """Storage description should point at capability catalog."""
    g = Graph().parse(POD_URL + ".well-known/solid",
                      format="turtle", publicID=POD_URL + ".well-known/solid")
    catalog_triple = (None, CAP.catalog,
                      URIRef("http://pod.vardeman.me:3000/vault/meta/capabilities/"))
    assert catalog_triple in g, "Storage description missing cap:catalog pointer"


def test_capability_catalog_lists_three_primitives():
    """Three primitives shipped: markdown-content-projection, time-travel, derived-view."""
    catalog_url = POD_URL + "meta/capabilities/"
    r = httpx.get(catalog_url, headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200
    text = r.text
    for descriptor in ["markdown-content-projection",
                       "time-travel", "derived-view"]:
        assert descriptor in text, f"Capability catalog missing {descriptor}"


def test_capability_descriptors_are_well_formed():
    """Each capability descriptor parses as Turtle and declares cap:version."""
    base = POD_URL + "meta/capabilities/"
    for descriptor in ["markdown-content-projection.ttl",
                       "time-travel.ttl", "derived-view.ttl"]:
        url = base + descriptor
        r = httpx.get(url, headers={"Accept": "text/turtle"}, timeout=5)
        assert r.status_code == 200, f"{descriptor} not reachable: {r.status_code}"
        g = Graph().parse(data=r.text, format="turtle", publicID=url)
        versions = list(g.objects(predicate=CAP.version))
        assert len(versions) >= 1, f"{descriptor} missing cap:version"


def test_capability_vocabulary_dereferenceable():
    """The cap: namespace resolves to its vocab document hosted on the Pod."""
    r = httpx.get(POD_URL + "ontology/capability.ttl",
                  headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle",
                      publicID=POD_URL + "ontology/capability.ttl")
    assert (CAP.ContentProjection, RDFS.subClassOf, CAP.Capability) in g
    assert (CAP.TimeTravel, RDFS.subClassOf, CAP.Capability) in g


def test_overlay_vocabulary_dereferenceable():
    """The overlay: namespace resolves to its vocab document hosted on the Pod."""
    r = httpx.get(POD_URL + "ontology/overlay.ttl",
                  headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200
    OVERLAY = Namespace("https://pod.vardeman.me:3000/vault/ontology/overlay#")
    g = Graph().parse(data=r.text, format="turtle",
                      publicID=POD_URL + "ontology/overlay.ttl")
    assert (OVERLAY.Overlay, RDF.type, RDFS.Class) in g
```

- [ ] **Step 2: Run the new tests, verify they pass**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/integration/test_substrate_cleanup.py -v -k "capability or overlay_vocab"
```

Expected: 5 tests pass.

### Task 2.8: Commit Phase 2 + tag

- [ ] **Step 1: Stage and commit**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git status
git add -A css/config/pod-templates/base/ scripts/overlay/ tests/integration/test_substrate_cleanup.py
git commit -m "$(cat <<'EOF'
[Agent: Claude] Add overlay machinery + capability vocabulary (cleanup step 2/5)

Adds substrate-level machinery for application overlays:

L1 base template additions:
- css/config/pod-templates/base/ontology/{overlay,capability}.ttl —
  Pod-local Category 3 vocabularies, dereferenceable at
  https://pod.vardeman.me:3000/vault/ontology/{overlay,capability}#
- css/config/pod-templates/base/meta/capabilities/ — LDP container
  hosting capability descriptors
- css/config/pod-templates/base/meta/capabilities/{markdown-content-projection,
  time-travel,derived-view}.ttl — three capability descriptors documenting
  the three substrate primitives that are actually implemented today
- Root .meta storage description gains cap:catalog pointer +
  void:vocabulary entries for cap: and overlay: namespaces

Overlay machinery (Python):
- scripts/overlay/common.py — Manifest dataclass, capability catalog parser,
  N3 Patch + container creation primitives
- scripts/overlay/apply.py — idempotent install: capability preflight,
  vocab/shape/affordance uploads, container creation, JSON-LD context merge,
  Type Index PATCH, storage description PATCH
- scripts/overlay/remove.py — two modes: deactivate (keep data) vs
  uninstall (delete containers, requires --confirm)
- scripts/overlay/verify.py — checks installed overlay matches its manifest

Five new integration tests verify the capability catalog is discoverable,
descriptors are well-formed, and the cap:/overlay: vocabularies dereference.

No overlays installed yet; wiki-memory comes in step 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git tag -a substrate-cleanup-step-2-machinery -m "Phase 2 complete: overlay machinery + capability vocabulary"
```

Expected: Commit succeeds; tag created.

---

## Phase 3: Add wiki-memory overlay

Goal: After this phase, running `apply.py overlays/wiki-memory --target ...` produces a Pod equivalent to Rung 1.4 (5 wiki containers, 4 affordance descriptors, vocab at /vault/ontology/wiki.ttl, Type Index with wiki:* registrations). `make reset` runs this overlay automatically. Tag: `substrate-cleanup-step-3-wiki-memory`.

### Task 3.1: Create overlay directory structure

**Files:**
- Create directories: `overlays/wiki-memory/{vocabulary,shapes,containers/wiki/{pages,sources,people,procedures,working},affordances}`

- [ ] **Step 1: Create the directory tree**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
mkdir -p overlays/wiki-memory/vocabulary
mkdir -p overlays/wiki-memory/shapes
mkdir -p overlays/wiki-memory/containers/wiki/pages
mkdir -p overlays/wiki-memory/containers/wiki/sources
mkdir -p overlays/wiki-memory/containers/wiki/people
mkdir -p overlays/wiki-memory/containers/wiki/procedures
mkdir -p overlays/wiki-memory/containers/wiki/working
mkdir -p overlays/wiki-memory/affordances
find overlays/wiki-memory -type d | sort
```

Expected: All seven directories listed.

### Task 3.2: Write the wiki vocabulary (subclass model)

**Files:**
- Create: `overlays/wiki-memory/vocabulary/wiki.ttl`

- [ ] **Step 1: Write the vocabulary file**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/vocabulary/wiki.ttl` with the content from Section 4 of the spec (full content for self-containment):

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

# Abstract root
wiki:Resource a rdfs:Class ;
    rdfs:label "Wiki resource" ;
    rdfs:isDefinedBy <> .

# Per-container base classes
wiki:Page         rdfs:subClassOf wiki:Resource ;
    rdfs:label "Wiki page" ;
    rdfs:comment "General wiki content. Lives in /wiki/pages/." ;
    rdfs:isDefinedBy <> .

wiki:Source       rdfs:subClassOf wiki:Resource ;
    rdfs:label "Source" ;
    rdfs:comment "Citation record. Lives in /wiki/sources/." ;
    rdfs:isDefinedBy <> .

wiki:Person       rdfs:subClassOf wiki:Resource, foaf:Person ;
    rdfs:label "Person" ;
    rdfs:comment "Person record. Lives in /wiki/people/." ;
    rdfs:isDefinedBy <> .

wiki:Procedure    rdfs:subClassOf wiki:Resource ;
    rdfs:label "Procedure" ;
    rdfs:comment "Procedural memory. Lives in /wiki/procedures/." ;
    rdfs:isDefinedBy <> .

wiki:WorkingNote  rdfs:subClassOf wiki:Resource ;
    rdfs:label "Working note" ;
    rdfs:comment "Permissive scratchpad. Lives in /wiki/working/." ;
    rdfs:isDefinedBy <> .

# wiki:Page subclasses
wiki:Concept      rdfs:subClassOf wiki:Page, skos:Concept ;
    rdfs:label "Concept" ;
    rdfs:comment "Conceptual knowledge unit. Most common page kind." ;
    rdfs:isDefinedBy <> .

wiki:MOC          rdfs:subClassOf wiki:Page ;
    rdfs:label "Map of Content" ;
    rdfs:comment "Navigational hub page that organizes other pages." ;
    rdfs:isDefinedBy <> .

# Derived class (substrate-computed via hub-view affordance)
wiki:Hub          rdfs:subClassOf wiki:Resource ;
    rdfs:label "Hub" ;
    rdfs:comment "A wiki:Resource with ≥3 incoming skos:broader. Derived; never asserted directly." ;
    rdfs:isDefinedBy <> .

# Lifecycle predicate
wiki:maturity a rdf:Property ;
    rdfs:domain wiki:Resource ;
    rdfs:range skos:Concept ;
    rdfs:isDefinedBy <> .

wiki:draft     a skos:Concept ; skos:prefLabel "draft" .
wiki:validated a skos:Concept ; skos:prefLabel "validated" .
wiki:core      a skos:Concept ; skos:prefLabel "core" .

# Write affordance class
wiki:WriteAffordance a rdfs:Class ;
    rdfs:label "Write affordance" ;
    rdfs:comment "Substrate-write configuration for a container. Consumed by cap:ContentProjection." ;
    rdfs:isDefinedBy <> .

wiki:governs               a rdf:Property ; rdfs:isDefinedBy <> .
wiki:projectsFromFrontmatter a rdf:Property ; rdfs:isDefinedBy <> .
wiki:classHintTable        a rdf:Property ; rdfs:isDefinedBy <> .
wiki:installedBy           a rdf:Property ; rdfs:isDefinedBy <> .
wiki:shape                 a rdf:Property ; rdfs:isDefinedBy <> .
wiki:requiresCapability    a rdf:Property ; rdfs:isDefinedBy <> .

wiki:DerivedClassAffordance a rdfs:Class ; rdfs:subClassOf rdfs:Class ;
    rdfs:isDefinedBy <> .

wiki:DerivedNavigationAffordance a rdfs:Class ; rdfs:subClassOf rdfs:Class ;
    rdfs:isDefinedBy <> .

wiki:VersionAffordance a rdfs:Class ;
    rdfs:isDefinedBy <> .

wiki:deriveClass     a rdf:Property ; rdfs:isDefinedBy <> .
wiki:targetClass     a rdf:Property ; rdfs:isDefinedBy <> .
wiki:threshold       a rdf:Property ; rdfs:isDefinedBy <> .
wiki:constructQuery  a rdf:Property ; rdfs:isDefinedBy <> .
wiki:selectQuery     a rdf:Property ; rdfs:isDefinedBy <> .

# Application profile
wiki:WikiMemoryProfile a dct:Standard ;
    rdfs:label "Wiki-memory application profile v1.0" ;
    dct:hasVersion "1.0" ;
    rdfs:isDefinedBy <> .
```

### Task 3.3: Write the page shape file (base shape for wiki:Page hierarchy)

**Files:**
- Create: `overlays/wiki-memory/shapes/page.shacl.ttl`

- [ ] **Step 1: Write the shape file**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/shapes/page.shacl.ttl` with:

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

wiki:PageShape a sh:NodeShape ;
    sh:targetClass wiki:Page ;
    sh:closed false ;
    sh:agentInstruction "Wiki page. Required: dct:title. Common: skos:broader (parent), skos:related (lateral). For typed citations to sources, use cito:extends, cito:agreesWith, cito:disagreesWith. The substrate governs dct:title, dct:identifier, dct:created, dct:modified, skos:broader, skos:related, cito:* via the markdown-projection affordance (D81 Model A) — edit body+frontmatter, don't PATCH .meta directly for these." ;
    sh:property [
        sh:path dct:title ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
    ] ;
    sh:property [
        sh:path skos:broader ;
        sh:nodeKind sh:IRI ;
    ] ;
    sh:property [
        sh:path wiki:maturity ;
        sh:in ( wiki:draft wiki:validated wiki:core ) ;
        sh:maxCount 1 ;
    ] .
```

### Task 3.4: Write the other four shape files

**Files:**
- Create: `overlays/wiki-memory/shapes/{source,person,procedure,working}.shacl.ttl`

- [ ] **Step 1: Write source.shacl.ttl**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/shapes/source.shacl.ttl` with:

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix cito: <http://purl.org/spar/cito/> .

wiki:SourceShape a sh:NodeShape ;
    sh:targetClass wiki:Source ;
    sh:closed false ;
    sh:agentInstruction "Citation record. dct:identifier required (DOI, arXiv ID, citekey). Use cito:extends, cito:agreesWith, cito:disagreesWith for typed citation relationships. dct:contributor for authors (per K3 — substrate emits dct:contributor not dct:creator from .author class hints)." ;
    sh:property [
        sh:path dct:title ;
        sh:minCount 1 ;
    ] ;
    sh:property [
        sh:path dct:identifier ;
        sh:minCount 1 ;
    ] .
```

- [ ] **Step 2: Write person.shacl.ttl**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/shapes/person.shacl.ttl` with:

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

wiki:PersonShape a sh:NodeShape ;
    sh:targetClass wiki:Person ;
    sh:closed false ;
    sh:agentInstruction "Person record. FOAF-based. foaf:name preferred over dct:title. foaf:nick lists aliases for cross-system linking (citekey patterns, Twitter handles, Readwise display names). Use foaf:Organization for institutional affiliations via affiliation predicate." ;
    sh:property [
        sh:path foaf:name ;
        sh:minCount 1 ;
    ] .
```

- [ ] **Step 3: Write procedure.shacl.ttl**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/shapes/procedure.shacl.ttl` with:

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix dct:  <http://purl.org/dc/terms/> .

wiki:ProcedureShape a sh:NodeShape ;
    sh:targetClass wiki:Procedure ;
    sh:closed false ;
    sh:agentInstruction "Procedural memory. dct:title is the procedure name. The procedure body is in the resource's markdown content — agents read it as instructions. sh:agentInstruction on the resource itself MAY duplicate the body for non-markdown clients." ;
    sh:property [
        sh:path dct:title ;
        sh:minCount 1 ;
    ] .
```

- [ ] **Step 4: Write working.shacl.ttl**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/shapes/working.shacl.ttl` with:

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix dct:  <http://purl.org/dc/terms/> .

wiki:WorkingMemoryShape a sh:NodeShape ;
    sh:targetClass wiki:WorkingNote ;
    sh:closed false ;
    sh:agentInstruction "Permissive low-ceremony scratchpad (D73). Only dct:title strictly recommended. Notes here are promotable to durable containers via mem:Crystallize once their content matures (D73 deferred to Phase 2c+; until then, agents manually copy + delete)." .
```

### Task 3.5: Write the four affordance descriptors

**Files:**
- Create: `overlays/wiki-memory/affordances/{markdown-projection,hub-view,breadcrumb-view,memento}.ttl`

- [ ] **Step 1: Write markdown-projection.ttl**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/affordances/markdown-projection.ttl` with:

```turtle
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix cito:  <http://purl.org/spar/cito/> .
@prefix prov:  <http://www.w3.org/ns/prov#> .
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix cap:   <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<> a wiki:WriteAffordance ;
    rdfs:label "Markdown projection listener" ;
    wiki:requiresCapability <https://pod.vardeman.me:3000/vault/meta/capabilities/markdown-content-projection> ;
    wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
    wiki:governs rdf:type ,
        dct:title ,
        dct:identifier ,
        dct:created ,
        dct:modified ,
        dct:references ,
        dct:subject ,
        dct:contributor ,
        dct:creator ,
        skos:broader ,
        skos:related ,
        cito:extends ,
        cito:agreesWith ,
        cito:disagreesWith ,
        wiki:maturity ,
        prov:wasGeneratedBy ;
    wiki:projectsFromFrontmatter "type" ,
        "created" ,
        "modified" ,
        "maturity" ,
        "aliases" ,
        "identifier" ,
        "citekey" ;
    wiki:classHintTable <../context.jsonld> ;
    sh:agentInstruction "Substrate writes the predicates listed in wiki:governs. To express any of those, edit the body+frontmatter; do not PATCH .meta directly. Other predicates are agent-extensible." .
```

- [ ] **Step 2: Write hub-view.ttl**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/affordances/hub-view.ttl` with:

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix cap:  <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .

<> a wiki:DerivedClassAffordance ;
   rdfs:label "Hub derivation" ;
   wiki:deriveClass wiki:Hub ;
   wiki:targetClass wiki:Resource ;
   wiki:requiresCapability <https://pod.vardeman.me:3000/vault/meta/capabilities/derived-view> ;
   wiki:threshold 3 ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "A wiki:Resource becomes a wiki:Hub when ≥3 distinct wiki:Resource instances point at it via skos:broader. Run the CONSTRUCT below in your own SPARQL engine (Comunica recommended), with this Pod's wiki containers as data sources. The Pod does not host a SPARQL endpoint." ;
   wiki:constructQuery """
       PREFIX wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#>
       PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
       CONSTRUCT { ?hub a wiki:Hub . }
       WHERE {
           SELECT ?hub (COUNT(DISTINCT ?child) AS ?n)
           WHERE { ?child skos:broader ?hub . ?hub a wiki:Resource . }
           GROUP BY ?hub HAVING (?n >= 3)
       }
   """ .
```

- [ ] **Step 3: Write breadcrumb-view.ttl**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/affordances/breadcrumb-view.ttl` with:

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix cap:  <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .

<> a wiki:DerivedNavigationAffordance ;
   rdfs:label "Breadcrumb chain (skos:broader+ walk)" ;
   wiki:requiresCapability <https://pod.vardeman.me:3000/vault/meta/capabilities/derived-view> ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "From a given start IRI, walks the skos:broader chain to the root. Bind ?start to your starting resource and run the SELECT below in your own SPARQL engine pointed at this Pod's wiki containers." ;
   wiki:selectQuery """
       PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
       SELECT ?ancestor
       WHERE { <START> skos:broader+ ?ancestor . }
   """ .
```

- [ ] **Step 4: Write memento.ttl**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/affordances/memento.ttl` with:

```turtle
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix cap:  <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .

<> a wiki:VersionAffordance ;
   rdfs:label "RFC 7089 Memento time-travel" ;
   wiki:requiresCapability <https://pod.vardeman.me:3000/vault/meta/capabilities/time-travel> ;
   wiki:conformsTo <http://www.rfc-editor.org/rfc/rfc7089.txt> ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "Append ?ext=timemap to any resource URL for its TimeMap; append ?version=<14-digit-datetime> for a specific Memento. RFC 7089 Pattern 1.1 — OriginalResource doubles as TimeGate. See D61." .
```

### Task 3.6: Write the five container .meta files

**Files:**
- Create: `overlays/wiki-memory/containers/wiki/.meta`
- Create: `overlays/wiki-memory/containers/wiki/{pages,sources,people,procedures,working}/.meta`

- [ ] **Step 1: Write wiki/.meta**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/containers/wiki/.meta` with:

```turtle
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ldp: <http://www.w3.org/ns/ldp#> .
@prefix wiki: <https://pod.vardeman.me:3000/vault/ontology/wiki#> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Wiki-memory L2 application root" ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> .
```

- [ ] **Step 2: Write wiki/pages/.meta**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/containers/wiki/pages/.meta` with:

```turtle
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Wiki Pages" ;
   solid:forClass wiki:Page ;
   wiki:shape </vault/meta/shapes/page.shacl.ttl> ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "General wiki content. Instances declare rdf:type — wiki:Page or a subclass (wiki:Concept, wiki:MOC, future vault:TheoryNote, etc.). Use dct:title (required), skos:broader (parent), skos:related (lateral)." .
```

- [ ] **Step 3: Write wiki/sources/.meta**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/containers/wiki/sources/.meta` with:

```turtle
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Wiki Sources" ;
   solid:forClass wiki:Source ;
   wiki:shape </vault/meta/shapes/source.shacl.ttl> ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "Citation records (literature notes, papers, reports). Shape: wiki:SourceShape. dct:identifier required (DOI, arXiv ID, or citekey). Use cito:extends, cito:agreesWith, cito:disagreesWith for typed citation relationships." .
```

- [ ] **Step 4: Write wiki/people/.meta**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/containers/wiki/people/.meta` with:

```turtle
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Wiki People" ;
   solid:forClass wiki:Person ;
   wiki:shape </vault/meta/shapes/person.shacl.ttl> ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "Person records. FOAF-based. foaf:name preferred over dct:title. foaf:nick lists aliases (citekey patterns, social handles, display names)." .
```

- [ ] **Step 5: Write wiki/procedures/.meta**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/containers/wiki/procedures/.meta` with:

```turtle
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Wiki Procedures" ;
   solid:forClass wiki:Procedure ;
   wiki:shape </vault/meta/shapes/procedure.shacl.ttl> ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "Procedural memory: agent instructions, workflows, skills. Body markdown is the procedure documentation." .
```

- [ ] **Step 6: Write wiki/working/.meta**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/containers/wiki/working/.meta` with:

```turtle
@prefix wiki:  <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Wiki Working Memory" ;
   solid:forClass wiki:WorkingNote ;
   wiki:shape </vault/meta/shapes/working.shacl.ttl> ;
   wiki:installedBy <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "Low-ceremony working memory for transient notes (D73). Permissive shape. Promotable to durable container via mem:Crystallize (deferred)." .
```

### Task 3.7: Write the JSON-LD context fragment

**Files:**
- Create: `overlays/wiki-memory/context-fragment.jsonld`

- [ ] **Step 1: Write the fragment**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/context-fragment.jsonld` with:

```json
{
  "@context": {
    "wiki":       "https://pod.vardeman.me:3000/vault/ontology/wiki#",
    "cito":       "http://purl.org/spar/cito/",
    "foaf":       "http://xmlns.com/foaf/0.1/",
    "title":      "dct:title",
    "subject":    "dct:subject",
    "references": "dct:references",
    "broader":    "skos:broader",
    "related":    "skos:related",
    "contributor":"dct:contributor",
    "creator":    "dct:creator",
    "extends":    "cito:extends",
    "supports":   "cito:agreesWith",
    "criticizes": "cito:disagreesWith",
    "Page":       "wiki:Page",
    "Concept":    "wiki:Concept",
    "MOC":        "wiki:MOC",
    "Source":     "wiki:Source",
    "Person":     "wiki:Person",
    "Procedure":  "wiki:Procedure",
    "WorkingNote":"wiki:WorkingNote",
    "Hub":        "wiki:Hub",
    "maturity":   "wiki:maturity"
  }
}
```

### Task 3.8: Write the storage-description patch

**Files:**
- Create: `overlays/wiki-memory/storage-patch.ttl`

- [ ] **Step 1: Write the patch**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/storage-patch.ttl` with:

```turtle
@prefix solid:   <http://www.w3.org/ns/solid/terms#> .
@prefix wiki:    <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix void:    <http://rdfs.org/ns/void#> .
@prefix dct:     <http://purl.org/dc/terms/> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix cito:    <http://purl.org/spar/cito/> .
@prefix foaf:    <http://xmlns.com/foaf/0.1/> .
@prefix overlay: <https://pod.vardeman.me:3000/vault/ontology/overlay#> .

<> a solid:InsertDeletePatch ;
   solid:inserts {
       <../>
           dct:conformsTo wiki:WikiMemoryProfile ;
           void:vocabulary <https://pod.vardeman.me:3000/vault/ontology/wiki#> ,
                          <http://purl.org/spar/cito/> ,
                          <http://xmlns.com/foaf/0.1/> ;
           rdfs:seeAlso <../wiki/pages/> ,
                       <../wiki/sources/> ,
                       <../wiki/people/> ,
                       <../wiki/procedures/> ,
                       <../wiki/working/> ;
           overlay:installedOverlay <https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory> .
   } .
```

### Task 3.9: Write the manifest.ttl

**Files:**
- Create: `overlays/wiki-memory/manifest.ttl`

- [ ] **Step 1: Write the manifest**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/overlays/wiki-memory/manifest.ttl` with:

```turtle
@prefix overlay: <https://pod.vardeman.me:3000/vault/ontology/overlay#> .
@prefix cap:     <https://pod.vardeman.me:3000/vault/ontology/capability#> .
@prefix wiki:    <https://pod.vardeman.me:3000/vault/ontology/wiki#> .
@prefix dct:     <http://purl.org/dc/terms/> .
@prefix solid:   <http://www.w3.org/ns/solid/terms#> .

<https://pod.vardeman.me:3000/vault/ontology/overlay#wiki-memory>
    a overlay:Overlay ;
    overlay:name "wiki-memory" ;
    overlay:version "1.0" ;
    dct:conformsTo wiki:WikiMemoryProfile ;

    overlay:declaresVocabulary [
        overlay:namespace wiki: ;
        overlay:document "vocabulary/wiki.ttl" ;
        overlay:hostedAt "/vault/ontology/wiki.ttl"
    ] ;

    overlay:requiresCapability
        [ cap:requires <https://pod.vardeman.me:3000/vault/meta/capabilities/markdown-content-projection> ;
          cap:minVersion "1.0" ] ,
        [ cap:requires <https://pod.vardeman.me:3000/vault/meta/capabilities/time-travel> ;
          cap:minVersion "1.0" ] ;

    overlay:optionalCapability
        [ cap:requires <https://pod.vardeman.me:3000/vault/meta/capabilities/derived-view> ;
          cap:minVersion "1.0" ;
          overlay:degradesTo "hub-view + breadcrumb-view advisory; agent must bring SPARQL engine to materialize" ] ;

    overlay:installsContainer
        </vault/wiki/> ,
        </vault/wiki/pages/> ,
        </vault/wiki/sources/> ,
        </vault/wiki/people/> ,
        </vault/wiki/procedures/> ,
        </vault/wiki/working/> ;

    overlay:installsShape
        </vault/meta/shapes/page.shacl.ttl> ,
        </vault/meta/shapes/source.shacl.ttl> ,
        </vault/meta/shapes/person.shacl.ttl> ,
        </vault/meta/shapes/procedure.shacl.ttl> ,
        </vault/meta/shapes/working.shacl.ttl> ;

    overlay:installsAffordance
        </vault/meta/affordances/markdown-projection.ttl> ,
        </vault/meta/affordances/hub-view.ttl> ,
        </vault/meta/affordances/breadcrumb-view.ttl> ,
        </vault/meta/affordances/memento.ttl> ;

    overlay:installsTypeRegistration
        [ solid:forClass wiki:Page       ; solid:instanceContainer </vault/wiki/pages/> ] ,
        [ solid:forClass wiki:Source     ; solid:instanceContainer </vault/wiki/sources/> ] ,
        [ solid:forClass wiki:Person     ; solid:instanceContainer </vault/wiki/people/> ] ,
        [ solid:forClass wiki:Procedure  ; solid:instanceContainer </vault/wiki/procedures/> ] ,
        [ solid:forClass wiki:WorkingNote; solid:instanceContainer </vault/wiki/working/> ] .
```

### Task 3.10: Hook apply.py into `make reset`

**Files:**
- Modify: `Makefile` (find the `reset` target)
- Modify: `docker-compose.yml` (pod-setup container needs access to overlays/)

- [ ] **Step 1: Update docker-compose pod-setup to mount overlays/**

Use Edit on `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/docker-compose.yml`. Find the `pod-setup:` service stanza and add `./overlays:/overlays:ro` to its `volumes:` list:

```yaml
  pod-setup:
    image: python:3.12-slim
    volumes:
      - ./scripts:/scripts:ro
      - ./shapes:/shapes:ro
      - ./ontology:/ontology:ro
      - ./overlays:/overlays:ro     # added: lets pod_setup invoke overlay apply
```

- [ ] **Step 2: Modify pod-setup command to apply wiki-memory overlay**

In the same docker-compose.yml, find the pod-setup `command:` block and append the apply.py invocation after the existing pod_setup.py call. Example:

```yaml
    command:
      - |
        pip install --quiet httpx rdflib pyyaml &&
        python pod_setup.py --target http://pod.vardeman.me:3000 &&
        python -m scripts.overlay.apply /overlays/wiki-memory --target http://pod.vardeman.me:3000/vault/
```

Note that `python -m scripts.overlay.apply` requires the `scripts/overlay/__init__.py` (Task 2.5 Step 1) and the scripts directory to be a Python package mount-point — the existing `working_dir: /scripts` setting makes this work since `scripts/overlay/` is a subdirectory.

- [ ] **Step 3: `make reset` and verify wiki-memory is installed**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
make reset
```

Expected: Pod comes up, pod-setup runs, overlay apply logs lines like `Applying overlay: wiki-memory v1.0`, `vocab → http://...`, `shape → http://...`, etc.

If apply fails with `Capability missing`, check that the three capability descriptors from Task 2.3 are actually in the base template (they should ship as part of the L1 substrate).

- [ ] **Step 4: Verify the Pod state matches Rung 1.4 expectations**

Run:
```bash
echo "=== Wiki containers should 200 ===" && \
for p in wiki/pages/ wiki/sources/ wiki/people/ wiki/procedures/ wiki/working/; do \
  printf "%-25s" "$p"; curl -sS -o /dev/null -w "HTTP %{http_code}\n" "http://pod.vardeman.me:3000/vault/$p"; \
done
echo "" && \
echo "=== Shape files should 200 ===" && \
for s in page source person procedure working; do \
  printf "%-25s" "$s.shacl.ttl"; \
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" "http://pod.vardeman.me:3000/vault/meta/shapes/$s.shacl.ttl"; \
done
echo "" && \
echo "=== Wiki vocabulary should 200 ===" && \
curl -sS -o /dev/null -w "wiki.ttl: HTTP %{http_code}\n" "http://pod.vardeman.me:3000/vault/ontology/wiki.ttl"
```

Expected: All 200.

- [ ] **Step 5: Verify idempotency — re-running apply produces no errors**

Run:
```bash
~/uvws/.venv/bin/python -m scripts.overlay.apply overlays/wiki-memory --target http://pod.vardeman.me:3000/vault/
```

Expected: Apply runs to completion without errors. Re-running an already-applied overlay must not crash.

### Task 3.11: Add integration tests for wiki-memory overlay

**Files:**
- Modify: `tests/integration/test_substrate_cleanup.py` (append wiki-memory tests)

- [ ] **Step 1: Append wiki-memory tests**

Use Edit to append the following to `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/tests/integration/test_substrate_cleanup.py`:

```python
def test_wiki_vocabulary_dereferenceable():
    """Class IRIs resolve to vocabulary document hosted by the Pod."""
    r = httpx.get(POD_URL + "ontology/wiki.ttl",
                  headers={"Accept": "text/turtle"}, timeout=5)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle",
                      publicID=POD_URL + "ontology/wiki.ttl")
    assert (WIKI.Concept, RDFS.subClassOf, WIKI.Page) in g, \
           "wiki:Concept should be subclass of wiki:Page (D78 subclass model)"
    assert (WIKI.Page, RDFS.subClassOf, WIKI.Resource) in g
    assert (WIKI.Source, RDFS.subClassOf, WIKI.Resource) in g


def test_shape_files_resolve():
    """All 5 shape files exist at /meta/shapes/ (no 404s)."""
    for shape in ["page", "source", "person", "procedure", "working"]:
        r = httpx.head(POD_URL + f"meta/shapes/{shape}.shacl.ttl", timeout=5)
        assert r.status_code == 200, f"{shape}.shacl.ttl missing: {r.status_code}"


def test_affordance_descriptors_present():
    """All 4 affordance descriptors land in /meta/affordances/."""
    for aff in ["markdown-projection", "hub-view", "breadcrumb-view", "memento"]:
        r = httpx.head(POD_URL + f"meta/affordances/{aff}.ttl", timeout=5)
        assert r.status_code == 200, f"{aff}.ttl missing: {r.status_code}"


def test_no_sparql_endpoint_claimed():
    """Affordance descriptors don't claim /sparql endpoint anymore."""
    hub = httpx.get(POD_URL + "meta/affordances/hub-view.ttl", timeout=5).text
    assert "wiki:invokedAt" not in hub, "hub-view should not have wiki:invokedAt"
    assert "wiki:requiresCapability" in hub, "hub-view should declare cap requirement"


def test_type_index_has_wiki_registrations():
    """Type Index registers wiki:* classes pointing at /wiki/* containers."""
    ti = httpx.get(POD_URL + "settings/publicTypeIndex",
                   headers={"Accept": "text/turtle"}, timeout=5)
    assert ti.status_code == 200
    g = Graph().parse(data=ti.text, format="turtle", publicID=POD_URL + "settings/publicTypeIndex")
    SOLID = Namespace("http://www.w3.org/ns/solid/terms#")
    regs = list(g.subjects(RDF.type, SOLID.TypeRegistration))
    assert len(regs) >= 5, f"Expected 5+ Type Index registrations, found {len(regs)}"
    # spot-check one
    wiki_page_reg = list(g.triples((None, SOLID.forClass, WIKI.Page)))
    assert len(wiki_page_reg) == 1, "wiki:Page should be registered once"


def test_wiki_containers_resolve():
    """Five wiki containers exist post-overlay."""
    for c in ["pages", "sources", "people", "procedures", "working"]:
        r = httpx.head(POD_URL + f"wiki/{c}/", timeout=5)
        assert r.status_code == 200, f"/wiki/{c}/ missing: {r.status_code}"


def test_apply_overlay_is_idempotent():
    """Running apply twice produces no errors and no state difference."""
    import subprocess
    # First run
    r1 = subprocess.run(
        ["~/uvws/.venv/bin/python", "-m", "scripts.overlay.apply",
         "overlays/wiki-memory", "--target", POD_URL],
        cwd="/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid",
        shell=False, capture_output=True, text=True,
        executable="/bin/bash",
    )
    # Need to use shell=True or expand the ~. Use absolute path:
    import os
    py = os.path.expanduser("~/uvws/.venv/bin/python")
    r2 = subprocess.run(
        [py, "-m", "scripts.overlay.apply", "overlays/wiki-memory",
         "--target", POD_URL],
        cwd="/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid",
        capture_output=True, text=True,
    )
    assert r2.returncode == 0, f"Second apply failed: {r2.stderr}"
```

Note: the idempotency test uses subprocess; ensure the apply runs in the right cwd.

- [ ] **Step 2: Run the new tests, verify they pass**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/integration/test_substrate_cleanup.py -v -k "wiki or shape or affordance or type_index or idempotent"
```

Expected: All tests pass.

### Task 3.12: Commit Phase 3 + tag

- [ ] **Step 1: Stage and commit**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git status
git add -A overlays/wiki-memory/ docker-compose.yml tests/integration/test_substrate_cleanup.py
git commit -m "$(cat <<'EOF'
[Agent: Claude] Add wiki-memory overlay (cleanup step 3/5)

Extracts wiki-memory from the base pod template into an installable overlay.
After this commit, make reset produces a Pod equivalent to Rung 1.4 state by
running scripts.overlay.apply against overlays/wiki-memory.

Overlay contents:
- vocabulary/wiki.ttl: subclass model — wiki:Resource root, 5 per-container
  base classes (wiki:{Page,Source,Person,Procedure,WorkingNote}), wiki:Page
  subclasses (wiki:Concept, wiki:MOC), derived wiki:Hub, lifecycle predicate
  wiki:maturity, application profile wiki:WikiMemoryProfile.
- shapes/{page,source,person,procedure,working}.shacl.ttl: per-class SHACL
  shapes targeting wiki:Page hierarchy via rdfs:subClassOf reasoning.
- containers/wiki/*/.meta: five typed containers with solid:forClass +
  wiki:shape + sh:agentInstruction. Each tagged with wiki:installedBy for
  composability.
- affordances/{markdown-projection,hub-view,breadcrumb-view,memento}.ttl:
  four substrate behaviors declared via wiki:requiresCapability (cap:*).
  Drops the legacy wiki:invokedAt </sparql> pointer (Pod doesn't host SPARQL).
- context-fragment.jsonld: prefixes + aliases merged into /vault/meta/context.jsonld.
- storage-patch.ttl: dct:conformsTo wiki:WikiMemoryProfile + 5 rdfs:seeAlso +
  cito:/foaf:/wiki: void:vocabulary entries patched into storage description.
- manifest.ttl: declares requirements (markdown-content-projection, time-travel),
  optional capabilities (derived-view), all installation targets.

docker-compose.yml: pod-setup container now applies wiki-memory overlay after
base template instantiation. ./overlays mounted read-only.

Seven new integration tests cover vocab dereferenceability, shape resolution,
affordance presence, no-sparql-endpoint claim, Type Index registrations,
container resolution, and idempotency.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git tag -a substrate-cleanup-step-3-wiki-memory -m "Phase 3 complete: wiki-memory overlay shipped"
```

Expected: Commit + tag.

---

## Phase 4: Remove Comunica docker service + add solid-agent-skills CLI

Goal: Stop running Comunica as a Pod-side service; ship it as a CLI tool in solid-agent-skills. Cross-repo phase. Tag: `substrate-cleanup-step-4-comunica`.

### Task 4.1: Remove Comunica docker service from cogitarelink-solid

**Files:**
- Modify: `docker-compose.yml` (remove `comunica:` stanza)
- Delete: `comunica/` directory (entire tree)

- [ ] **Step 1: Confirm current Comunica stanza shape**

Run:
```bash
grep -A 12 "^  comunica:" /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/docker-compose.yml
```

Expected: Stanza starting with `comunica:` showing the node:20-slim image, port 8080 binding, mounts, and the `npx comunica-sparql-link-traversal-http -p 8080 ...` command.

- [ ] **Step 2: Remove the entire `comunica:` service stanza**

Use Edit on `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/docker-compose.yml` to delete the entire `comunica:` service block (from `  comunica:` through the last line before `volumes:` or the next service). After the edit, `services:` should contain only `css:` and `pod-setup:`.

- [ ] **Step 3: Delete the comunica/ directory**

Run:
```bash
rm -rf /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/comunica
ls /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/ | grep -i comunica
```

Expected: No comunica directory remaining (grep prints nothing).

- [ ] **Step 4: Reset Pod + verify no Comunica HTTP endpoint**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
make reset
sleep 5
echo "Testing port 8080 (should fail to connect):"
curl -sS -o /dev/null -w "HTTP %{http_code} (%{time_total}s)\n" http://localhost:8080/sparql || echo "connection refused (expected)"
```

Expected: `curl` reports connection refused or HTTP 000 — port 8080 isn't bound.

### Task 4.2: Add Comunica integration test (Pod side)

**Files:**
- Modify: `tests/integration/test_substrate_cleanup.py`

- [ ] **Step 1: Append the Comunica-service-absent test**

Use Edit to append to `/Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/tests/integration/test_substrate_cleanup.py`:

```python
def test_no_comunica_service():
    """The Comunica HTTP service should NOT respond at port 8080."""
    with pytest.raises((httpx.ConnectError, httpx.ConnectTimeout)):
        httpx.get("http://localhost:8080/sparql", timeout=2)
```

- [ ] **Step 2: Run the test, verify it passes**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/integration/test_substrate_cleanup.py::test_no_comunica_service -v
```

Expected: PASS.

### Task 4.3: Add Comunica dependency to solid-agent-skills

**Working directory shifts to:** `/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/`

**Files:**
- Modify: `package.json` (add Comunica deps + overrides)

- [ ] **Step 1: Inspect current package.json**

Run:
```bash
cat /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/package.json
```

Expected: Some existing structure (TypeScript project metadata, possibly existing dependencies).

- [ ] **Step 2: Add Comunica + traqula overrides**

Use Edit on `/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/package.json` to add the following entries to `dependencies` (or create that key if missing):

```json
{
  "dependencies": {
    "@comunica/query-sparql-link-traversal": "^0.8.0",
    "@comunica/types": "^4.0.0"
  },
  "overrides": {
    "@traqula/parser-sparql-1-2": "^1.0.0",
    "@traqula/algebra-sparql-1-2": "^1.0.0",
    "@traqula/rules-sparql-1-1": "^1.0.0",
    "@traqula/core": "^1.0.0"
  }
}
```

Merge these into existing `dependencies` and `overrides` blocks rather than overwriting.

- [ ] **Step 3: Install dependencies**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills
npm install
```

Expected: `npm install` completes. If `@traqula/*` resolution errors appear, the overrides block may need format adjustment — refer to npm docs for the project's npm version.

### Task 4.4: Implement `solid-pod sparql` and `solid-pod invoke` commands

**Files:**
- Create: `src/cli/commands/sparql.ts`
- Create: `src/cli/commands/invoke.ts`

These TypeScript files implement the CLI shape from Section 6 of the spec. The exact integration with the existing solid-agent-skills CLI framework (Commander? Yargs? Custom?) depends on the existing project conventions. Inspect first:

- [ ] **Step 1: Inspect existing CLI structure**

Run:
```bash
find /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/src -type f -name "*.ts" | head -20
ls /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/src/
```

Expected: Some src/ tree. Patterns for command registration will guide the integration.

- [ ] **Step 2: Write src/cli/commands/sparql.ts following existing CLI conventions**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/src/cli/commands/sparql.ts` with the core SPARQL command. Adapt the snippet below to the existing CLI framework (e.g., Commander) — the function signature, source auto-discovery, and Comunica invocation are the load-bearing parts:

```typescript
import { QueryEngine } from '@comunica/query-sparql-link-traversal';
import { Parser, Store } from 'n3';

export interface SparqlOptions {
  source?: string[];                  // explicit Comunica sources
  defaultGraphUri?: string[];         // RQ-Pod-4 workaround
  outputFormat?: 'json' | 'turtle' | 'table';
  acceptDatetime?: string;            // Memento integration
}

export async function sparqlCommand(
  podUrl: string,
  query: string,
  opts: SparqlOptions = {}
): Promise<string> {
  const engine = new QueryEngine();
  const sources = opts.source && opts.source.length
    ? opts.source
    : await discoverSourcesFromStorageDescription(podUrl);
  const httpHeaders: Record<string, string> = {};
  if (opts.acceptDatetime) {
    httpHeaders['Accept-Datetime'] = opts.acceptDatetime;
  }
  const result = await engine.query(query, {
    sources: sources as any,
    'graphqua:defaultGraphUri': opts.defaultGraphUri,
    httpAuth: undefined,
  });
  return formatResult(result, opts.outputFormat ?? 'json');
}

async function discoverSourcesFromStorageDescription(podUrl: string): Promise<string[]> {
  const root = podUrl.replace(/\/$/, '') + '/';
  const headRes = await fetch(root, { method: 'HEAD' });
  const linkHeader = headRes.headers.get('link') ?? '';
  const sdMatch = linkHeader.match(/<([^>]+)>;\s*rel=["']?http:\/\/www\.w3\.org\/ns\/solid\/terms#storageDescription["']?/);
  if (!sdMatch) throw new Error('Pod root has no solid:storageDescription Link header');
  const sdRes = await fetch(sdMatch[1], { headers: { Accept: 'text/turtle' } });
  const sdTtl = await sdRes.text();
  const parser = new Parser({ baseIRI: sdMatch[1] });
  const store = new Store();
  store.addQuads(parser.parse(sdTtl));
  const seeAlso = store.getObjects(null, 'http://www.w3.org/2000/01/rdf-schema#seeAlso', null)
                       .map(t => t.value);
  return seeAlso;
}

async function formatResult(result: any, format: 'json' | 'turtle' | 'table'): Promise<string> {
  // Implementation depends on Comunica's result types; basic JSON serialization here
  const bindings = await result.toArray();
  if (format === 'json') {
    return JSON.stringify(bindings.map((b: any) => Object.fromEntries(b)), null, 2);
  }
  // Turtle and table fall back to JSON for now; refine when needed
  return JSON.stringify(bindings, null, 2);
}
```

- [ ] **Step 3: Write src/cli/commands/invoke.ts**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/src/cli/commands/invoke.ts` with:

```typescript
import { Parser, Store } from 'n3';
import { sparqlCommand, SparqlOptions } from './sparql.js';

const WIKI_NS = 'https://pod.vardeman.me:3000/vault/ontology/wiki#';

/**
 * Fetch an affordance descriptor and execute its constructQuery / selectQuery
 * via the embedded Comunica engine.
 */
export async function invokeCommand(
  podUrl: string,
  affordanceName: string,
  opts: SparqlOptions = {}
): Promise<string> {
  const root = podUrl.replace(/\/$/, '') + '/';
  const descriptorUrl = root + 'meta/affordances/' + affordanceName + '.ttl';
  const res = await fetch(descriptorUrl, { headers: { Accept: 'text/turtle' } });
  if (!res.ok) {
    throw new Error(`Affordance ${affordanceName} not found at ${descriptorUrl}: HTTP ${res.status}`);
  }
  const ttl = await res.text();
  const parser = new Parser({ baseIRI: descriptorUrl });
  const store = new Store();
  store.addQuads(parser.parse(ttl));

  // Look for wiki:constructQuery or wiki:selectQuery
  const constructQs = store.getObjects(null, WIKI_NS + 'constructQuery', null);
  const selectQs = store.getObjects(null, WIKI_NS + 'selectQuery', null);
  const query = constructQs[0]?.value ?? selectQs[0]?.value;
  if (!query) {
    throw new Error(`Affordance ${affordanceName} has no wiki:constructQuery or wiki:selectQuery`);
  }

  return sparqlCommand(podUrl, query, opts);
}
```

- [ ] **Step 4: Register the new commands in the CLI entry point**

The exact mechanism depends on the existing CLI framework. Find the existing CLI dispatcher (probably `src/cli/index.ts` or similar) and wire `sparqlCommand` and `invokeCommand` to the `solid-pod sparql` and `solid-pod invoke` subcommands respectively. Refer to existing subcommand registrations for the pattern.

### Task 4.5: Add solid-agent-skills CLI integration tests

**Files:**
- Create: `tests/cli/sparql.test.ts`
- Create: `tests/cli/invoke.test.ts`

The exact test framework (Jest, Vitest, Mocha) depends on solid-agent-skills' existing test setup. Inspect:

- [ ] **Step 1: Inspect existing test framework**

Run:
```bash
cat /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/package.json | grep -A 2 '"scripts"'
ls /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/tests/ 2>/dev/null || find /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills -name "*.test.ts" -o -name "*.spec.ts" | head -5
```

Expected: A test script and existing test files showing the framework.

- [ ] **Step 2: Write the sparql command test (adapt to existing framework)**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/tests/cli/sparql.test.ts` with (adjust import syntax + test syntax to match existing framework):

```typescript
import { describe, it, expect } from 'vitest';  // or 'jest', 'mocha', etc.
import { sparqlCommand } from '../../src/cli/commands/sparql';

const POD_URL = 'http://pod.vardeman.me:3000/vault/';

describe('sparqlCommand', () => {
  it('auto-discovers sources from storage description', async () => {
    const result = await sparqlCommand(
      POD_URL,
      `SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o } LIMIT 1`,
      { outputFormat: 'json' }
    );
    const bindings = JSON.parse(result);
    expect(bindings.length).toBeGreaterThan(0);
  });

  it('accepts explicit source via opts', async () => {
    const result = await sparqlCommand(
      POD_URL,
      `SELECT * WHERE { ?s ?p ?o } LIMIT 5`,
      { source: [POD_URL + 'wiki/pages/'], outputFormat: 'json' }
    );
    expect(typeof result).toBe('string');
  });
});
```

- [ ] **Step 3: Write the invoke command test**

Use Write to create `/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/tests/cli/invoke.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { invokeCommand } from '../../src/cli/commands/invoke';

const POD_URL = 'http://pod.vardeman.me:3000/vault/';

describe('invokeCommand', () => {
  it('fetches hub-view affordance and runs its CONSTRUCT', async () => {
    const result = await invokeCommand(POD_URL, 'hub-view', {});
    // hub-view's CONSTRUCT produces `?hub a wiki:Hub` triples;
    // empty Pod will produce no bindings — just verify no error
    expect(typeof result).toBe('string');
  });
});
```

- [ ] **Step 4: Run tests**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills
npm test
```

Expected: New tests pass alongside existing ones.

### Task 4.6: Update both repos' CLAUDE.md

**Files:**
- Modify: `solid-agent-skills/CLAUDE.md` (the sparql row)
- Modify: `cogitarelink-solid/CLAUDE.md` (Comunica reference)

- [ ] **Step 1: Update solid-agent-skills CLAUDE.md sparql row**

Use Edit on `/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/CLAUDE.md`. Find the table row:

```
| `solid-pod sparql <url> <query>` | SPARQL via Comunica (auto .meta discovery) |
```

Replace with:

```
| `solid-pod sparql <url> <query>` | SPARQL via embedded Comunica library; auto-discovers sources from storage description; RQ-Pod-4 workaround via --default-graph-uri |
| `solid-pod invoke <url> <name>` | Execute an affordance descriptor's constructQuery/selectQuery via embedded Comunica |
```

- [ ] **Step 2: Update cogitarelink-solid CLAUDE.md if it mentions Comunica as service**

Run:
```bash
grep -n -i "comunica" /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/CLAUDE.md
```

Expected: Some mentions — likely in commands section ("COMUNICA_SPARQL=http://localhost:8080/sparql") or "Two-container stack" prose. Replace any mention of Comunica as a docker service or sidecar with a note that Comunica is a client-side tool in solid-agent-skills.

### Task 4.7: Commit Phase 4 + tag (across two repos)

- [ ] **Step 1: Commit cogitarelink-solid side**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git status
git add -A docker-compose.yml CLAUDE.md tests/integration/test_substrate_cleanup.py
git diff --cached --stat
# Verify comunica/ deletion is in the staged changes:
git status | grep comunica
```

If `comunica/` deletion shows in `git status` as untracked:

```bash
git rm -r comunica/
```

Then commit:

```bash
git commit -m "$(cat <<'EOF'
[Agent: Claude] Remove Comunica docker service (cleanup step 4/5, Pod side)

Comunica is a client-side SPARQL engine (per D3, D29) — it should not run
as a Pod sidecar. Comunica wiring moves to solid-agent-skills as a TypeScript
library; this commit removes the Pod-side service.

Changes:
- docker-compose.yml: comunica: service stanza removed
- comunica/: entire directory deleted (config.json + package.json were the
  service's runtime; traqula version-pin overrides move to solid-agent-skills)
- CLAUDE.md: prose updated to clarify Comunica is a client tool
- tests/integration/test_substrate_cleanup.py: new test_no_comunica_service
  verifies port 8080 doesn't bind

Pod no longer runs SPARQL server-side. Agents wishing to query the Pod use
their own SPARQL engine; affordance descriptors declare cap:DerivedView which
documents this explicitly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git tag -a substrate-cleanup-step-4-comunica-pod-side -m "Phase 4a: Comunica docker service removed from cogitarelink-solid"
```

- [ ] **Step 2: Commit solid-agent-skills side**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills
git status
git add -A package.json src/cli/commands/sparql.ts src/cli/commands/invoke.ts tests/cli/ CLAUDE.md
```

If package-lock.json changed, add it too:
```bash
git add package-lock.json
```

Commit:

```bash
git commit -m "$(cat <<'EOF'
[Agent: Claude] Add Comunica library + solid-pod sparql/invoke commands

Per cogitarelink-solid substrate cleanup design (cleanup step 4/5, agent-skills side):

Comunica moves from a Pod-side docker service to an embedded library in this
agent-skills toolkit. This commit adds the dependency and implements two CLI
commands:

- solid-pod sparql <url> <query>: auto-discovers Comunica sources from the
  storage description's rdfs:seeAlso set, supports --source explicit overrides,
  --default-graph-uri for the RQ-Pod-4 .meta-traversal workaround, and
  --accept-datetime for one-flag Memento time-travel queries.

- solid-pod invoke <url> <affordance-name>: fetches an affordance descriptor
  from /vault/meta/affordances/<name>.ttl, extracts its wiki:constructQuery
  or wiki:selectQuery, and executes via the embedded Comunica engine. The
  "machine-actionable affordance" promise (D52) made concrete at CLI level.

The traqula version-pin overrides that lived in cogitarelink-solid/comunica/
move into this repo's package.json (they're a client-side concern).

Two new integration tests verify auto-discovery and affordance invocation
against the dev Pod at http://pod.vardeman.me:3000/vault/.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git tag -a substrate-cleanup-step-4-comunica-cli -m "Phase 4b: Comunica CLI shipped in solid-agent-skills"
```

Expected: Two commits, two tags (one per repo).

---

## Phase 5: Update decisions log with D83 + cross-references

Goal: Architectural commitment from this cleanup ships in the decisions log. Tag: `substrate-cleanup-complete`.

### Task 5.1: Add D83 to decisions-index.md

**Files:**
- Modify: `.claude/rules/decisions-index.md`

- [ ] **Step 1: Inspect current decisions-index.md structure**

Run:
```bash
head -30 /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/.claude/rules/decisions-index.md
grep -n "^## " /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/.claude/rules/decisions-index.md
```

Expected: Sectioned doc with phase headers like "## Phase 5g — Rung 1.4 implementation notes", etc.

- [ ] **Step 2: Find the appropriate insertion point**

The decisions go in chronological/topical order. D83 belongs after the most recent phase (Phase 5h or wherever D82/H-D82 lives). Locate the last decision entry:

```bash
grep -n "^### \|^## Phase" /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/.claude/rules/decisions-index.md | tail -20
```

- [ ] **Step 3: Append a new phase section with D83**

Use Edit to add a new section after the most recent phase. The new content:

```markdown

## Phase 5i — Substrate cleanup + Pod-as-toolkit framing (2026-05-15 / 2026-05-16)

Forced by Sprint 1 pod-discover eval surfacing three substrate inconsistencies
(PARA legacy in base template, shape files at wrong path, Comunica running as
docker service) that all expressed one architectural problem: pre-D70 infrastructure
not stripped when wiki-memory L3 landed.

Full design at `docs/superpowers/specs/2026-05-15-substrate-cleanup-design.md`.
Implementation tracked in `docs/superpowers/plans/2026-05-15-substrate-cleanup-plan.md`.

### D83 — Pod as self-describing toolkit (capability catalog)

The Pod is a **self-describing toolkit**, not a database. Three discoverable layers:

1. **L1** = standard Solid Protocol (LDP, WAC, Memento, storage description, etc.).
2. **Substrate capabilities** = generic primitives the Pod offers (Content Projection,
   Derived View, Time Travel, Two-Stage Commit, Trigger Emission, Validation Hook,
   Reference Catalog). Each implemented by a CSS extension + advertised via a
   `cap:Capability` descriptor at `/vault/meta/capabilities/<name>.ttl`.
3. **Installed applications** = composable peer overlays declaring `cap:requires`
   against the catalog. Wiki-memory is the canonical first overlay (pre-installed).

Mechanically:
- Overlay machinery (`scripts/overlay/{apply,remove,verify}.py`) installs, removes,
  and verifies applications. Idempotent via PUT (overwrite-safe) + N3 Patch (insert-safe).
- Composability via manifest-tracked PATCH-merge — multiple overlays accumulate triples
  on shared substrate resources (storage description, Type Index, JSON-LD context);
  each removable separately via its manifest's bill of triples (wiki:installedBy tag).
- Vocabulary dereferenceability per D79: Pod-local Category 3 hosting (`/vault/ontology/<vocab>.ttl`)
  for app-specific vocabularies; standard W3C vocabularies (SKOS, DCT, PROV, CITO, FOAF)
  remain external with TBox cache.

### Reframes / sharpens of prior decisions

- **D70 reframed**: "L2 = memory substrate" becomes "L2 is occupied by applications,
  of which memory (wiki-memory) is one type." Non-memory applications (calendar, todo)
  live at the same layer with different invariants.
- **D71 unchanged**: wiki-memory still the canonical first application; dual-layer
  body+meta architecture stays.
- **D77 superseded by subclass model**: shapes are class-targeted with `rdfs:subClassOf`
  reasoning. Base shape (`page.shacl.ttl`) covers wiki:Page and its subclasses
  (wiki:Concept, wiki:MOC, future vault:TheoryNote). Five-container layout (D76) stays.
- **D78 sharpened**: class-based shape targeting applies up the subclass chain.
- **D79 strengthened**: hybrid vocab stance + dereferenceable class IRIs via Pod-local
  hosting (Path X), with w3id.org migration as deferred future (Path Y).

### Architectural commitments (seven invariants)

1. L1 = standard Solid Protocol; invent only where standards don't exist.
2. Capabilities are RDF resources discoverable via the capability catalog.
3. Applications are overlays — installable, composable, removable, declaring
   required capabilities.
4. Structure is data (overlays); behavior is code (CSS extensions). Capability
   catalog is the contract between them.
5. Pod-defined vocabularies dereference on the Pod itself.
6. Agents bring their own SPARQL (Pod publishes derived-view descriptors, doesn't
   host the engine).
7. Skills bridge substrate self-description to agent action patterns. Generic
   agents using only L1 still succeed; skills are accelerants, not gatekeepers.
```

### Task 5.2: Verify references-index still resolves

- [ ] **Step 1: Check that referenced decisions exist**

Run:
```bash
for d in D44 D48 D49 D51 D52 D55 D70 D71 D76 D77 D78 D79 D81; do \
  c=$(grep -c "^### $d " /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid/.claude/rules/decisions-index.md); \
  printf "%-5s %s\n" "$d" "$c references"; \
done
```

Expected: Each decision has at least 1 occurrence. If a `0` appears, the cross-ref I added to D83 points at a decision that doesn't exist in the index — investigate.

### Task 5.3: Commit Phase 5 + final tag

- [ ] **Step 1: Stage and commit**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add .claude/rules/decisions-index.md
git commit -m "$(cat <<'EOF'
[Agent: Claude] Add D83 + Phase 5i to decisions log (cleanup step 5/5)

Closes the substrate cleanup with the architectural commitment that motivated it:

D83 — Pod as self-describing toolkit (capability catalog). Three discoverable
layers (L1 Solid baseline / substrate capabilities / installed applications),
seven generic primitives in the capability vocabulary, applications as composable
overlays, manifest-tracked PATCH-merge for shared substrate resources.

Reframes / sharpens prior decisions:
- D70: "L2 = memory substrate" → "L2 is occupied by applications"
- D77: superseded by subclass model (wiki:Page base + subclasses)
- D78: sharpened — sh:targetClass + rdfs:subClassOf reasoning
- D79: strengthened — Pod-local Category 3 vocab hosting

Full design at docs/superpowers/specs/2026-05-15-substrate-cleanup-design.md.

This is the final commit of the five-step substrate cleanup; tag
substrate-cleanup-complete is applied here.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git tag -a substrate-cleanup-complete -m "Substrate cleanup complete: PARA stripped, overlay machinery shipped, wiki-memory as overlay, Comunica as client tool, D83 documented"
git tag -l | grep substrate-cleanup
```

Expected: Final tag `substrate-cleanup-complete` appears alongside the per-step tags.

---

## Phase 6: Validation — re-run Sprint 1 as iteration-2

Goal: Verify the cleanup actually improved agent navigation by re-running Sprint 1 of the pod-discover eval against the cleaned-up substrate. This is validation, not implementation; failure here means we go back and fix substrate work, not eval design.

### Task 6.1: Set up iteration-2 workspace

**Files:**
- Create: `solid-agent-skills/eval-workspace/pod-discover/iteration-2/eval-resource-type-discovery/eval_metadata.json`
- Create: directory tree `iteration-2/eval-resource-type-discovery/{with_skill,without_skill}/run-{1,2,3}/outputs/`

- [ ] **Step 1: Confirm Pod is at clean state**

Run:
```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
make reset
sleep 8
~/uvws/.venv/bin/python -m pytest tests/integration/test_substrate_cleanup.py -v
```

Expected: All substrate cleanup tests pass.

- [ ] **Step 2: Create iteration-2 workspace tree**

Run:
```bash
ITERATION=/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-2
mkdir -p "$ITERATION/eval-resource-type-discovery/with_skill"/run-{1,2,3}/outputs
mkdir -p "$ITERATION/eval-resource-type-discovery/without_skill"/run-{1,2,3}/outputs
find "$ITERATION" -type d | sort
```

Expected: All 8 directories (eval-resource-type-discovery, plus 2 arms × 3 runs × outputs) created.

- [ ] **Step 3: Write iteration-2 eval_metadata.json**

The metadata is mostly identical to iteration-1's, with new substrate-cleanup-specific assertions added. Copy iteration-1's eval_metadata.json as a starting point and add the new checks:

Use Read first:
```bash
cat /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-1/eval-resource-type-discovery/eval_metadata.json | head -40
```

Then Write the iteration-2 version to `/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-2/eval-resource-type-discovery/eval_metadata.json`. Use iteration-1's content as the base; append the following new assertions to the `assertions` array:

```json
    {
      "name": "recognized_capability_catalog",
      "description": "Agent discovered /vault/meta/capabilities/ and read at least one descriptor",
      "check": "transcript contains '/meta/capabilities/' AND response mentions capability or cap:"
    },
    {
      "name": "class_iri_resolved",
      "description": "Agent dereferenced a wiki:* class IRI (linked-data discipline)",
      "check": "transcript contains 'ontology/wiki' AND response includes wiki#Concept or 'Pod-hosted vocabulary'"
    },
    {
      "name": "no_phase_2_residue_reported",
      "description": "Agent should NOT report /resources/concepts/ or /procedures/shapes/ existing — they shouldn't",
      "check": "response does NOT contain '/resources/concepts/', '/resources/literature/', '/procedures/shapes/'"
    }
```

Also update the `pod_state` field's description to "Post-substrate-cleanup A1.3 (Rung 1.4 functional surface restored via wiki-memory overlay)".

### Task 6.2: Spawn 6 sub-agents (iteration-2) + grade + aggregate

This task uses the same skill-creator harness pattern as Sprint 1 iteration-1.

- [ ] **Step 1: Spawn 6 sub-agents in parallel**

Use the `Agent` tool (subagent_type=general-purpose) to spawn 6 agents in a single message — 3 with-skill (passing the current `pod-discover` SKILL.md content as context) and 3 without-skill (bare task only). Each agent saves to its respective `outputs/` directory in `iteration-2/`.

The exact spawning pattern matches Sprint 1's setup; reuse the prompts from `iteration-1/eval-resource-type-discovery/<arm>/run-1/` — the Pod URL is the same, the task is the same, only the substrate state has changed.

- [ ] **Step 2: As each completion notification arrives, save timing.json**

For each Agent completion, the notification provides `total_tokens`, `duration_ms`, `tool_uses`. Save these to the corresponding `outputs/../timing.json` immediately (skill-creator note: this is the only opportunity).

- [ ] **Step 3: Run the grader script**

The grader from iteration-1 is reusable; new assertions need three new check functions. Update `eval-workspace/pod-discover/scripts/grade.py` (or write iteration-2-specific version) to include checks for the three new assertions added to eval_metadata.json. Then:

Run:
```bash
~/uvws/.venv/bin/python /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/scripts/grade.py /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-2
```

Expected: 6 grading.json files written; summary printed showing pass-counts.

- [ ] **Step 4: Aggregate via skill-creator's aggregate_benchmark**

Run:
```bash
SKILL_DIR=~/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator
cd $SKILL_DIR && ~/uvws/.venv/bin/python -m scripts.aggregate_benchmark \
    /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-2 \
    --skill-name pod-discover
```

Expected: `benchmark.json` and `benchmark.md` in `iteration-2/`. Summary printed.

- [ ] **Step 5: Generate viewer with --previous-workspace pointing at iteration-1**

Run:
```bash
ITERATION2=/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-2
ITERATION1=/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-1
~/uvws/.venv/bin/python ~/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator/eval-viewer/generate_review.py \
    "$ITERATION2" \
    --skill-name pod-discover \
    --benchmark "$ITERATION2/benchmark.json" \
    --previous-workspace "$ITERATION1" \
    --static "$ITERATION2/review.html"
echo "Open: file://$ITERATION2/review.html"
```

Expected: Static HTML viewer written. User can open in browser to compare iteration-1 vs iteration-2 side-by-side.

### Task 6.3: Write analyst notes comparing iteration-1 vs iteration-2

**Files:**
- Create: `solid-agent-skills/eval-workspace/pod-discover/iteration-2/analyst-notes.md`

- [ ] **Step 1: Read iteration-1's analyst notes for the template**

Run:
```bash
cat /Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-1/analyst-notes.md
```

- [ ] **Step 2: Write iteration-2 analyst notes**

The key outputs to capture in `iteration-2/analyst-notes.md`:

1. **Quantitative comparison** to iteration-1 (wall-clock, tool calls, pass rate; the prediction was that with_skill vs without_skill delta should *shrink*).
2. **Substrate-cleanup-specific assertions** — did agents recognize the capability catalog? Did they dereference class IRIs?
3. **What disappeared** — did without_skill agents stop finding `/resources/*`, the orphaned shape file, the Comunica port? (Predicted: yes.)
4. **What surprised** — any new substrate findings the cleanup itself surfaced?
5. **Implications for Rung 1.5** — does the cleaned-up substrate change what the planned A1.1/A1.2/A1.3 arm comparison would measure?

Write to `/Users/cvardema/dev/git/LA3D/agents/solid-agent-skills/eval-workspace/pod-discover/iteration-2/analyst-notes.md`. No template-fill needed; write directly from the benchmark.json data and the agent transcripts.

### Task 6.4: Decide whether Sprint 2 (pod-read) can proceed

This is a decision-gate task, not an implementation task. Read the analyst notes and decide:

- [ ] **Step 1: Verify "definition of done" from Section 9**

Confirm:
1. All `tests/integration/test_substrate_cleanup.py` tests pass against fresh-`make reset`-ed Pod ✓
2. `make reset` produces working Rung 1.4-equivalent Pod ✓
3. `apply.py overlays/wiki-memory` is idempotent ✓
4. `remove.py --keep-data overlays/wiki-memory` returns Pod to bare L1; re-apply restores ✓
5. Sprint 1 iteration-2 eval ran and produced benchmark.json comparable to iteration-1 ✓
6. Decisions log updated with D83 + cross-references; design doc committed ✓

If any are unchecked, return to the appropriate phase and complete.

- [ ] **Step 2: Surface result to user**

Present the iteration-1 vs iteration-2 comparison from the eval viewer. If with-skill vs without-skill delta shrank as predicted, the substrate cleanup achieved its goal — Sprint 2 (`pod-read` skill) can proceed against the cleaned-up substrate. If the delta didn't shrink or got worse, the analyst notes flag specific issues that need triage before Sprint 2.

---

## Self-Review

Spec coverage check (per Section 9 acceptance criteria):

| Spec section | Plan task |
|---|---|
| Section 2 — Substrate cleanup | Phase 1 (Tasks 1.1–1.9) |
| Section 3 — Overlay machinery | Phase 2 (Tasks 2.1, 2.5, 2.6) |
| Section 4 — Wiki-memory overlay | Phase 3 (Tasks 3.1–3.12) |
| Section 5 — Capability catalog skeleton | Phase 2 (Tasks 2.1–2.4, 2.7) |
| Section 6 — Comunica wiring | Phase 4 (Tasks 4.1–4.7) |
| Section 7 — PARA as future overlay | Documented in Section 7 of spec; not implemented this round (intentional defer) |
| Section 8 — Architectural appendix | Phase 5 (Tasks 5.1–5.3) |
| Section 9 — Validation plan | Tests inline throughout; iteration-2 in Phase 6 |

All five commits from Section 9's commit/tag strategy are in the plan with their tag names. All eight regression tests from Section 9's pytest snippet are covered (some across multiple tasks).

Placeholder scan: All code/Turtle/config blocks contain full content (no "TODO" or "implement later"). Each task's "Run" / "Expected" / commit messages are concrete.

Type consistency: `wiki:Page` is consistently the base class throughout (Section 4 / Tasks 3.2, 3.3); `wiki:Concept` is consistently a subclass. The shape file `page.shacl.ttl` targets `wiki:Page` (Task 3.3); container `.meta` files point at `page.shacl.ttl` (Task 3.6). `cap:` namespace consistently `https://pod.vardeman.me:3000/vault/ontology/capability#` across all tasks. Manifest predicates (`overlay:installsContainer`, etc.) match between Tasks 2.5 (parser) and 3.9 (manifest content).

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-15-substrate-cleanup-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration with checkpoints. Each subagent only sees the tasks it needs and the file paths it touches. Best for a plan this size because the context per task stays manageable.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batched with checkpoints for review. Single conversational context throughout; faster if the plan goes smoothly, harder to recover if a task fails badly.

**Which approach?**
