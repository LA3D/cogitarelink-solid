# AddressBook Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `overlays/addressbook/` overlay (SHACL shapes, templates, read-affordance descriptors, containers, storage description entries) so an agent with the existing `solid-pod` CLI can discover, read, find, and create contacts on this Pod.

**Architecture:** New overlay mirroring `overlays/wiki-memory/` structure. Uses existing `scripts/overlay/apply.py` deploy mechanism (idempotent PUT/PATCH). Adds `tmpl:` vocabulary at `/vault/ontology/template`. Adds `overlay:installsTemplate` predicate so apply.py can deploy templates. Adds `/vault/contacts/` container with SolidOS-compatible layout. Substrate guarantees: SHACL minimum-metadata invariant (vcard:fn + vcard:inAddressBook + ≥1 anchor) plus template + SHACL + 422-with-report feedback pipeline.

**Tech Stack:** CSS v8 alpha (Pod server), `scripts/overlay/apply.py` (deploy), rdflib + pyshacl (shape validation tests), httpx (integration tests), shape-validator CSS extension (already deployed). Python at `~/uvws/.venv/bin/python`.

**Companion design doc:** `docs/plans/2026-05-16-agentic-addressbook-design.md`

---

## Prerequisites and scope

- This plan covers Pod-side substrate only. Setup-owner CLI, AddressBook skill files, and Rung 1.5 eval are in separate plans.
- Pod must be running (`make up`) and reachable at `https://pod.vardeman.me/vault/`.
- Python env: `~/uvws/.venv/bin/python` with `rdflib`, `pyshacl`, `httpx` (already installed per `pyproject.toml`).
- Existing wiki-memory overlay assumed deployed (we depend on `wiki:` vocabulary and overlay machinery).

---

## File structure

**Created in this plan:**

```
overlays/addressbook/
├── manifest.ttl                                  # overlay declaration
├── vocabulary/
│   └── template.ttl                              # tmpl: vocabulary
├── containers/
│   ├── index.ttl                                 # vcard:AddressBook root
│   ├── people.ttl                                # vcard:nameEmailIndex
│   └── groups.ttl                                # vcard:groupIndex
├── shapes/
│   ├── contact-card.shacl.ttl                    # ContactCardShape
│   ├── organization-card.shacl.ttl               # OrganizationCardShape
│   ├── group.shacl.ttl                           # GroupShape
│   └── membership.shacl.ttl                      # MembershipShape
├── templates/
│   ├── contact-create.ttl
│   ├── contact-update.ttl
│   ├── org-create.ttl
│   ├── group-create.ttl
│   └── membership-create.ttl
├── affordances/
│   ├── contact-find-by-name.ttl
│   ├── contact-find-by-orcid.ttl
│   ├── contact-find-by-email.ttl
│   ├── contact-find-by-affiliation.ttl
│   ├── contact-find-by-group.ttl
│   ├── org-find-by-name.ttl
│   ├── org-find-by-ror.ttl
│   └── bridge-card-to-wiki.ttl
├── profiles/
│   ├── contact-card.ttl                          # PROF profile descriptor
│   └── organization-card.ttl
├── storage-patch.ttl                             # N3 Patch: wiki:contactCatalog, wiki:templateCatalog
└── typeindex-patch.ttl                           # N3 Patch: register vcard:AddressBook in publicTypeIndex
```

**Modified in this plan:**

- `css/config/pod-templates/base/ontology/overlay.ttl` — add `overlay:installsTemplate` predicate
- `scripts/overlay/apply.py` — handle `installsTemplate` (mirror `installsShape` logic)
- `scripts/overlay/verify.py` — verify deployed templates
- `tests/integration/test_addressbook_substrate.py` — new integration test file

---

## Task 0: Verify prerequisites

- [ ] **Step 1: Confirm Pod is running and healthy**

Run:
```bash
make status
```

Expected: all rows show 200 (CSS, Pod, WebID, TypeIndex, Shapes, Capabilities).

- [ ] **Step 2: Confirm Python env**

Run:
```bash
~/uvws/.venv/bin/python -c "import rdflib, pyshacl, httpx; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Confirm wiki-memory overlay is installed**

Run:
```bash
curl -s -H "Accept: text/turtle" https://pod.vardeman.me/vault/.well-known/solid | grep -i "wiki-memory"
```

Expected: at least one match showing `overlay:installedOverlay` pointing at the wiki-memory overlay IRI.

---

## Task 1: Verify CSS SHACL feedback path (blocker check)

The substrate pattern requires that SHACL violations return as agent-readable Turtle/JSON-LD response bodies. Confirm before building any shapes.

**Files:**
- Test: `tests/integration/test_shacl_feedback.py` (new)

- [ ] **Step 1: Write the test**

```python
"""Verify CSS returns SHACL ValidationReport on shape violations."""
import httpx
from rdflib import Graph, Namespace

POD = "https://pod.vardeman.me/vault/"
SH = Namespace("http://www.w3.org/ns/shacl#")


def test_shacl_violation_returns_readable_report():
    """Writing data that violates an existing shape returns sh:ValidationReport."""
    # Try to PUT a wiki:Concept with no rdfs:label (PageShape requires it).
    bad_concept = """
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<#this> a wiki:Concept .
"""
    url = POD + "wiki/pages/_test_shacl_feedback.md"
    r = httpx.put(
        url,
        content=bad_concept,
        headers={"Content-Type": "text/turtle"},
        verify=False,  # local mkcert
    )
    assert r.status_code in (400, 409, 422), f"Expected 4xx, got {r.status_code}: {r.text[:200]}"
    # Response should be parseable RDF
    assert "turtle" in r.headers.get("content-type", "") or \
           "ld+json" in r.headers.get("content-type", ""), \
        f"Expected RDF response, got Content-Type: {r.headers.get('content-type')}"
    g = Graph().parse(data=r.text, format=r.headers["content-type"].split(";")[0])
    reports = list(g.subjects(predicate=None, object=SH.ValidationReport))
    assert reports, "Expected at least one sh:ValidationReport in response"
```

- [ ] **Step 2: Run the test**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/integration/test_shacl_feedback.py -v
```

Three possible outcomes:

- **PASS**: CSS shape-validator returns SHACL reports — proceed to Task 2.
- **FAIL at status check**: shape-validator not gating writes — diagnose: is shape-validator extension actually deployed? Check `css/extensions/shape-validator/` and `css/config/`. If not deployed, that's a separate prerequisite to land first.
- **FAIL at body parse**: gating works but body is plain-text — need a small extension wrapper. Add subtask to convert shape-validator errors to Turtle response. Defer until other tasks are clear; document in plan as blocker for Tasks 5-13.

- [ ] **Step 3: Commit the test (regardless of outcome)**

```bash
git add tests/integration/test_shacl_feedback.py
git commit -m "[Agent: Claude] test: SHACL violation returns readable validation report

Verifies the agentic-substrate pattern's feedback contract: SHACL rejection
must return a parseable ValidationReport so agents can self-correct without
hitting CSS opaque error pages.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add `overlay:installsTemplate` predicate

Templates are a new artifact class. The overlay vocabulary needs to know about them so apply.py can deploy them.

**Files:**
- Modify: `css/config/pod-templates/base/ontology/overlay.ttl`

- [ ] **Step 1: Read the current overlay vocabulary**

Run:
```bash
cat css/config/pod-templates/base/ontology/overlay.ttl
```

Find the section defining `overlay:installsShape` and `overlay:installsAffordance`. Add a parallel predicate following the same style.

- [ ] **Step 2: Add the predicate definition**

Edit `css/config/pod-templates/base/ontology/overlay.ttl`, adding after the existing `installsShape` / `installsAffordance` definitions:

```turtle
overlay:installsTemplate
    a rdf:Property ;
    rdfs:label "installs template" ;
    rdfs:comment "An overlay installs a template document at the given URI. Templates are RDF skeletons paired with a SHACL shape via tmpl:validatesAgainst; agents fetch them before write operations to front-load structured context and reduce SHACL violation cycles." ;
    rdfs:domain overlay:Overlay ;
    rdfs:range  rdfs:Resource .
```

- [ ] **Step 3: Re-deploy the base pod-template ontology (idempotent)**

The overlay.ttl ships with the base pod-template. For dev re-deploy: rebuild the Pod's overlay vocabulary surface. Easiest path is `make reset` for a clean Pod, but for incremental dev:

```bash
~/uvws/.venv/bin/python -c "
import httpx
with open('css/config/pod-templates/base/ontology/overlay.ttl') as f:
    body = f.read()
r = httpx.put('https://pod.vardeman.me/vault/ontology/overlay',
              content=body,
              headers={'Content-Type': 'text/turtle'},
              verify=False)
print(r.status_code, r.headers.get('content-type'))
"
```

Expected: `200` or `205`.

- [ ] **Step 4: Verify**

```bash
curl -s -H "Accept: text/turtle" https://pod.vardeman.me/vault/ontology/overlay | grep installsTemplate
```

Expected: shows the new predicate line.

- [ ] **Step 5: Commit**

```bash
git add css/config/pod-templates/base/ontology/overlay.ttl
git commit -m "[Agent: Claude] overlay: add installsTemplate predicate

Templates are a new substrate artifact class (per AddressBook substrate
design §4). Adds the predicate parallel to installsShape / installsAffordance
so apply.py can iterate templates in overlay manifests.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Update apply.py to handle templates

**Files:**
- Modify: `scripts/overlay/apply.py`
- Modify: `scripts/overlay/common.py` (Manifest parsing)
- Test: `tests/test_overlay_template_parsing.py` (new)

- [ ] **Step 1: Write parsing test**

```python
"""Manifest parsing includes installsTemplate entries."""
from pathlib import Path
from scripts.overlay.common import parse_manifest


def test_manifest_parses_installs_template(tmp_path):
    manifest_text = """
@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> .
@prefix dct:     <http://purl.org/dc/terms/> .

<https://pod.vardeman.me/vault/ontology/overlay#test-overlay>
    a overlay:Overlay ;
    overlay:name "test" ;
    overlay:version "0.1" ;
    overlay:installsTemplate
        </vault/meta/templates/foo.ttl> ,
        </vault/meta/templates/bar.ttl> .
"""
    (tmp_path / "manifest.ttl").write_text(manifest_text)
    (tmp_path / "templates").mkdir()
    (tmp_path / "templates" / "foo.ttl").write_text("# foo")
    (tmp_path / "templates" / "bar.ttl").write_text("# bar")

    m = parse_manifest(tmp_path, pod_url="https://pod.vardeman.me/vault/")
    assert len(m.templates) == 2
    urls = {t.url for t in m.templates}
    assert "https://pod.vardeman.me/vault/meta/templates/foo.ttl" in urls
    assert "https://pod.vardeman.me/vault/meta/templates/bar.ttl" in urls
```

- [ ] **Step 2: Run test, verify it fails**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/test_overlay_template_parsing.py -v
```

Expected: FAIL with `AttributeError: 'Manifest' object has no attribute 'templates'`.

- [ ] **Step 3: Extend Manifest in common.py**

Read `scripts/overlay/common.py`. Find the `Manifest` dataclass and the section that parses `installsShape`. Add a parallel `templates` field and parsing block. The parsing follows the same pattern: query the graph for `?overlay overlay:installsTemplate ?url`, resolve each `?url` to a local file under `templates/`, collect into `TemplateEntry` objects.

Add (as a new dataclass alongside `ShapeEntry`):

```python
@dataclass
class TemplateEntry:
    url: str
    document: str  # raw turtle body
```

Update `Manifest` to include `templates: list[TemplateEntry] = field(default_factory=list)`.

Update `parse_manifest` to populate it (mirror the `shapes` parsing block exactly, substituting `installsTemplate` and `templates/` directory).

- [ ] **Step 4: Run test, verify it passes**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/test_overlay_template_parsing.py -v
```

Expected: PASS.

- [ ] **Step 5: Extend apply_overlay to deploy templates**

Edit `scripts/overlay/apply.py`. After the block that deploys shapes (look for `for shape in manifest.shapes:`), add a parallel block:

```python
# Upload templates
for tmpl in manifest.templates:
    put_file(client, tmpl.url, tmpl.document, "text/turtle")
    print(f"  template → {tmpl.url}")
```

- [ ] **Step 6: Extend verify.py**

Edit `scripts/overlay/verify.py`. Find the shapes-verification block (likely a function `verify_shapes` or inline loop). Add a parallel `verify_templates` step that GETs each template URL and checks 200 + Turtle content-type.

- [ ] **Step 7: Commit**

```bash
git add scripts/overlay/apply.py scripts/overlay/common.py scripts/overlay/verify.py tests/test_overlay_template_parsing.py
git commit -m "[Agent: Claude] overlay/apply: deploy templates alongside shapes/affordances

Mirrors the installsShape / installsAffordance handling for the new
installsTemplate predicate. Templates are RDF skeletons paired with shapes
via tmpl:validatesAgainst.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Create the `tmpl:` vocabulary

**Files:**
- Create: `overlays/addressbook/vocabulary/template.ttl`
- Test: `tests/test_addressbook_vocab.py` (new)

- [ ] **Step 1: Write parse test**

```python
"""tmpl: vocabulary parses and has required predicates."""
from rdflib import Graph, Namespace

TMPL = Namespace("https://pod.vardeman.me/vault/ontology/template#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")


def test_template_vocab_defines_required_terms():
    g = Graph().parse("overlays/addressbook/vocabulary/template.ttl", format="turtle")
    expected_terms = [
        TMPL.Template, TMPL.validatesAgainst, TMPL.operation,
        TMPL.targetContainer, TMPL.slugAlgorithm, TMPL.templateBody,
    ]
    for term in expected_terms:
        # Each term should appear as subject of at least one triple
        assert (term, None, None) in g, f"Missing definition for {term}"
        # Each term should have an rdfs:label
        labels = list(g.objects(term, RDFS.label))
        assert labels, f"Missing rdfs:label for {term}"
```

- [ ] **Step 2: Run test, verify FAIL** (file doesn't exist)

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_vocab.py -v
```

Expected: FAIL with file-not-found.

- [ ] **Step 3: Write the vocabulary**

Create `overlays/addressbook/vocabulary/template.ttl`:

```turtle
@prefix tmpl:    <https://pod.vardeman.me/vault/ontology/template#> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix sh:      <http://www.w3.org/ns/shacl#> .
@prefix dct:     <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<https://pod.vardeman.me/vault/ontology/template>
    a owl:Ontology ;
    rdfs:label "Substrate Template Vocabulary" ;
    rdfs:comment """
      Templates are RDF skeletons paired with a SHACL shape. Agents fetch a
      template before write operations to front-load structured context: this
      reduces SHACL violation cycles and the trajectory token cost they incur.

      Pattern: agent fetches template, fills <<PLACEHOLDER>> values from
      collected facts, PUTs result. SHACL backstops; 422+ValidationReport
      flows back for self-correction.
    """ ;
    dct:created "2026-05-16"^^xsd:date .

tmpl:Template
    a rdfs:Class ;
    rdfs:label "Template" ;
    rdfs:comment "An RDF skeleton document associated with a SHACL shape, intended to be filled in by an agent before a write operation." .

tmpl:validatesAgainst
    a rdf:Property ;
    rdfs:label "validates against" ;
    rdfs:comment "The SHACL shape this template's filled-in output must conform to." ;
    rdfs:domain tmpl:Template ;
    rdfs:range  sh:NodeShape .

tmpl:operation
    a rdf:Property ;
    rdfs:label "operation" ;
    rdfs:comment "The HTTP method used to apply a filled template (PUT, PATCH, POST)." ;
    rdfs:domain tmpl:Template ;
    rdfs:range  xsd:string .

tmpl:targetContainer
    a rdf:Property ;
    rdfs:label "target container" ;
    rdfs:comment "The container under which a filled template is created." ;
    rdfs:domain tmpl:Template ;
    rdfs:range  rdfs:Resource .

tmpl:slugAlgorithm
    a rdf:Property ;
    rdfs:label "slug algorithm" ;
    rdfs:comment "Identifier for the slug-minting algorithm (uuid4, mnemonic, etc.) that produces the path segment under the target container." ;
    rdfs:domain tmpl:Template ;
    rdfs:range  xsd:string .

tmpl:templateBody
    a rdf:Property ;
    rdfs:label "template body" ;
    rdfs:comment "The literal Turtle body to be filled in. Placeholders use <<UPPERCASE_NAME>> convention; agents replace before submission." ;
    rdfs:domain tmpl:Template ;
    rdfs:range  xsd:string .
```

- [ ] **Step 4: Run test, verify PASS**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_vocab.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/vocabulary/template.ttl tests/test_addressbook_vocab.py
git commit -m "[Agent: Claude] addressbook: tmpl: vocabulary for substrate templates

Defines tmpl:Template + 5 predicates (validatesAgainst, operation,
targetContainer, slugAlgorithm, templateBody). Vocabulary hosted at
/vault/ontology/template per D84 URI conformance. D87 candidate for ratification
once template-driven write paths ship.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: ContactCardShape

**Files:**
- Create: `overlays/addressbook/shapes/contact-card.shacl.ttl`
- Test: `tests/test_addressbook_shapes.py` (new file, multiple tasks add to it)

- [ ] **Step 1: Write shape conformance test**

Create `tests/test_addressbook_shapes.py`:

```python
"""SHACL conformance tests for AddressBook shapes."""
import pytest
from rdflib import Graph, Namespace
from pyshacl import validate

SHAPES_DIR = "overlays/addressbook/shapes"
VCARD = Namespace("http://www.w3.org/2006/vcard/ns#")
FOAF = Namespace("http://xmlns.com/foaf/0.1/")
OWL = Namespace("http://www.w3.org/2002/07/owl#")
ORG = Namespace("http://www.w3.org/ns/org#")


def load_shapes(filename: str) -> Graph:
    return Graph().parse(f"{SHAPES_DIR}/{filename}", format="turtle")


# ----- ContactCardShape -----

CONTACT_VALID_WITH_ORCID = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .

<#this> a vcard:Individual, foaf:Person ;
    vcard:fn "Jarek Nabrzyski" ;
    vcard:inAddressBook </contacts/index.ttl#this> ;
    owl:sameAs <https://orcid.org/0000-0001-7882-1326> .
"""

CONTACT_VALID_WITH_EMAIL = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .

<#this> a vcard:Individual, foaf:Person ;
    vcard:fn "Wang Wei" ;
    vcard:inAddressBook </contacts/index.ttl#this> ;
    vcard:hasEmail <mailto:wangwei@example.org> .
"""

CONTACT_MISSING_FN = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .

<#this> a vcard:Individual, foaf:Person ;
    vcard:inAddressBook </contacts/index.ttl#this> ;
    owl:sameAs <https://orcid.org/0000-0000-0000-0000> .
"""

CONTACT_NO_ANCHOR = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .

<#this> a vcard:Individual, foaf:Person ;
    vcard:fn "Just A Name" ;
    vcard:inAddressBook </contacts/index.ttl#this> .
"""


def _validate(data_turtle: str, shape_file: str) -> tuple[bool, str]:
    data = Graph().parse(data=data_turtle, format="turtle")
    shapes = load_shapes(shape_file)
    conforms, _report_graph, report_text = validate(data, shacl_graph=shapes)
    return conforms, report_text


def test_contact_valid_with_orcid_passes():
    conforms, report = _validate(CONTACT_VALID_WITH_ORCID, "contact-card.shacl.ttl")
    assert conforms, f"Expected conformance, got:\n{report}"


def test_contact_valid_with_email_passes():
    conforms, report = _validate(CONTACT_VALID_WITH_EMAIL, "contact-card.shacl.ttl")
    assert conforms, f"Expected conformance, got:\n{report}"


def test_contact_missing_fn_fails():
    conforms, report = _validate(CONTACT_MISSING_FN, "contact-card.shacl.ttl")
    assert not conforms
    assert "vcard:fn" in report or "fn" in report.lower()


def test_contact_no_anchor_fails():
    conforms, report = _validate(CONTACT_NO_ANCHOR, "contact-card.shacl.ttl")
    assert not conforms
    assert "anchor" in report.lower() or "owl:sameAs" in report or "vcard:hasEmail" in report
```

- [ ] **Step 2: Run tests, verify FAIL** (shape file doesn't exist)

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_shapes.py -v
```

Expected: FAIL with file-not-found.

- [ ] **Step 3: Write the shape**

Create `overlays/addressbook/shapes/contact-card.shacl.ttl`:

```turtle
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix dct:   <http://purl.org/dc/terms/> .

<https://pod.vardeman.me/vault/meta/shapes/contact-card.shacl.ttl#ContactCardShape>
    a sh:NodeShape ;
    sh:targetClass vcard:Individual ;
    sh:closed false ;
    sh:agentInstruction """
      A vcard:Individual card. Required: vcard:fn (one), vcard:inAddressBook
      (one, value </contacts/index.ttl#this>), and at least one operational
      anchor — owl:sameAs (ORCID, WebID, wikidata), vcard:hasEmail, or
      vcard:hasTelephone. Without an anchor, no deterministic agent operation
      can act on this contact. Substrate-governed predicates: rdf:type,
      vcard:inAddressBook. Agent-owned: everything else.
    """ ;

    sh:property [
        sh:path vcard:fn ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Contact must have exactly one vcard:fn (display name)." ;
    ] ;

    sh:property [
        sh:path vcard:inAddressBook ;
        sh:minCount 1 ;
        sh:hasValue </contacts/index.ttl#this> ;
        sh:nodeKind sh:IRI ;
        sh:message "Contact must declare vcard:inAddressBook </contacts/index.ttl#this>." ;
    ] ;

    sh:or (
        [ sh:property [ sh:path owl:sameAs ;        sh:minCount 1 ; sh:nodeKind sh:IRI ] ]
        [ sh:property [ sh:path vcard:hasEmail ;    sh:minCount 1 ] ]
        [ sh:property [ sh:path vcard:hasTelephone ; sh:minCount 1 ] ]
    ) ;
    sh:message """
      Contact must have at least one external anchor:
        owl:sameAs (ORCID, WebID, wikidata, etc.) — preferred for cross-pod reconciliation
        vcard:hasEmail
        vcard:hasTelephone
      Without an anchor, the contact serves no deterministic operation (email,
      lookup, dedupe, scheduling) and belongs in working memory (/wiki/working/),
      not the AddressBook.
    """ .
```

- [ ] **Step 4: Run tests, verify PASS**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_shapes.py -v -k contact
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/shapes/contact-card.shacl.ttl tests/test_addressbook_shapes.py
git commit -m "[Agent: Claude] addressbook: ContactCardShape with minimum-metadata invariant

vcard:fn + vcard:inAddressBook + ≥1 anchor (owl:sameAs / hasEmail / hasTelephone).
Without an anchor, contact serves no deterministic operation and belongs in
working memory instead. See design §4.1.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: OrganizationCardShape

**Files:**
- Create: `overlays/addressbook/shapes/organization-card.shacl.ttl`
- Modify: `tests/test_addressbook_shapes.py`

- [ ] **Step 1: Add tests**

Append to `tests/test_addressbook_shapes.py`:

```python
# ----- OrganizationCardShape -----

ORG_VALID_WITH_ROR = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .

<#this> a vcard:Organization, foaf:Organization ;
    vcard:fn "University of Notre Dame" ;
    vcard:inAddressBook </contacts/index.ttl#this> ;
    owl:sameAs <https://ror.org/00mkhxb43> .
"""

ORG_MISSING_FN = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .

<#this> a vcard:Organization, foaf:Organization ;
    vcard:inAddressBook </contacts/index.ttl#this> ;
    owl:sameAs <https://ror.org/00mkhxb43> .
"""

ORG_NO_ANCHOR = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .

<#this> a vcard:Organization, foaf:Organization ;
    vcard:fn "Mystery Lab" ;
    vcard:inAddressBook </contacts/index.ttl#this> .
"""


def test_org_valid_with_ror_passes():
    conforms, report = _validate(ORG_VALID_WITH_ROR, "organization-card.shacl.ttl")
    assert conforms, f"Expected conformance:\n{report}"


def test_org_missing_fn_fails():
    conforms, _ = _validate(ORG_MISSING_FN, "organization-card.shacl.ttl")
    assert not conforms


def test_org_no_anchor_fails():
    conforms, _ = _validate(ORG_NO_ANCHOR, "organization-card.shacl.ttl")
    assert not conforms
```

- [ ] **Step 2: Run tests, verify FAIL**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_shapes.py -v -k org
```

Expected: file-not-found errors.

- [ ] **Step 3: Write the shape**

Create `overlays/addressbook/shapes/organization-card.shacl.ttl`:

```turtle
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .

<https://pod.vardeman.me/vault/meta/shapes/organization-card.shacl.ttl#OrganizationCardShape>
    a sh:NodeShape ;
    sh:targetClass vcard:Organization ;
    sh:closed false ;
    sh:agentInstruction """
      A vcard:Organization card. Required: vcard:fn (one), vcard:inAddressBook
      (one), and at least one external anchor — owl:sameAs (ROR strongly
      preferred for institutional orgs) or vcard:hasURL (for non-ROR orgs).
      ROR provides stable cross-system identity (https://ror.org/...). Without
      an anchor, the organization can't be matched across pods or to external
      knowledge bases.
    """ ;

    sh:property [
        sh:path vcard:fn ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Organization must have exactly one vcard:fn (display name)." ;
    ] ;

    sh:property [
        sh:path vcard:inAddressBook ;
        sh:minCount 1 ;
        sh:hasValue </contacts/index.ttl#this> ;
        sh:nodeKind sh:IRI ;
        sh:message "Organization must declare vcard:inAddressBook </contacts/index.ttl#this>." ;
    ] ;

    sh:or (
        [ sh:property [ sh:path owl:sameAs ;     sh:minCount 1 ; sh:nodeKind sh:IRI ] ]
        [ sh:property [ sh:path vcard:hasURL ;   sh:minCount 1 ; sh:nodeKind sh:IRI ] ]
    ) ;
    sh:message "Organization must have at least one anchor: owl:sameAs (ROR preferred) or vcard:hasURL." .
```

- [ ] **Step 4: Run tests, verify PASS**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_shapes.py -v -k org
```

Expected: all 3 org tests pass.

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/shapes/organization-card.shacl.ttl tests/test_addressbook_shapes.py
git commit -m "[Agent: Claude] addressbook: OrganizationCardShape (ROR-anchored)

Parallel to ContactCardShape. ROR preferred for institutional orgs;
vcard:hasURL fallback for non-ROR (commercial, informal).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: GroupShape

**Files:**
- Create: `overlays/addressbook/shapes/group.shacl.ttl`
- Modify: `tests/test_addressbook_shapes.py`

- [ ] **Step 1: Add tests**

Append to `tests/test_addressbook_shapes.py`:

```python
# ----- GroupShape -----

GROUP_VALID = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .

<#this> a vcard:Group ;
    vcard:fn "Notre Dame Collaborators" ;
    vcard:hasMember </contacts/Person/7f3a1b8c-9d2e-4c5a-8f1b-2e6d4a8c0f9e/index.ttl#this> ,
                    </contacts/Person/c4e5d6f7-1234-5678-9abc-def012345678/index.ttl#this> .
"""

GROUP_EMPTY = """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .

<#this> a vcard:Group ;
    vcard:fn "Empty Group" .
"""


def test_group_valid_passes():
    conforms, report = _validate(GROUP_VALID, "group.shacl.ttl")
    assert conforms, f"Expected conformance:\n{report}"


def test_group_empty_fails():
    conforms, _ = _validate(GROUP_EMPTY, "group.shacl.ttl")
    assert not conforms
```

- [ ] **Step 2: Run, verify FAIL**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_shapes.py -v -k group
```

Expected: file-not-found.

- [ ] **Step 3: Write the shape**

Create `overlays/addressbook/shapes/group.shacl.ttl`:

```turtle
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .

<https://pod.vardeman.me/vault/meta/shapes/group.shacl.ttl#GroupShape>
    a sh:NodeShape ;
    sh:targetClass vcard:Group ;
    sh:closed false ;
    sh:agentInstruction """
      A vcard:Group is a named collection of contacts. Required: vcard:fn
      (one) and vcard:hasMember (at least one — empty groups have no purpose).
      Members must be IRIs of Person or Organization cards. Groups are
      author-controlled with mnemonic slugs (kebab-case); collisions are
      manageable because you control naming.
    """ ;

    sh:property [
        sh:path vcard:fn ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Group must have exactly one vcard:fn (display name)." ;
    ] ;

    sh:property [
        sh:path vcard:hasMember ;
        sh:minCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:message "Group must have at least one vcard:hasMember (IRI of a Person or Organization card)." ;
    ] .
```

- [ ] **Step 4: Run, verify PASS**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_shapes.py -v -k group
```

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/shapes/group.shacl.ttl tests/test_addressbook_shapes.py
git commit -m "[Agent: Claude] addressbook: GroupShape (minimum: fn + ≥1 member)

Empty groups serve no purpose; require at least one hasMember.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: MembershipShape

**Files:**
- Create: `overlays/addressbook/shapes/membership.shacl.ttl`
- Modify: `tests/test_addressbook_shapes.py`

- [ ] **Step 1: Add tests**

Append to `tests/test_addressbook_shapes.py`:

```python
# ----- MembershipShape -----

MEMBERSHIP_VALID = """
@prefix org:  <http://www.w3.org/ns/org#> .
@prefix time: <http://www.w3.org/2006/time#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

<#this> a org:Membership ;
    org:member </contacts/Person/7f3a1b8c.../index.ttl#this> ;
    org:organization </contacts/Organization/a8b9c1d2.../index.ttl#this> ;
    org:memberDuring [ time:hasBeginning [ time:inXSDDate "2024-01-01"^^xsd:date ] ] .
"""

MEMBERSHIP_MISSING_ORG = """
@prefix org:  <http://www.w3.org/ns/org#> .

<#this> a org:Membership ;
    org:member </contacts/Person/7f3a1b8c.../index.ttl#this> .
"""


def test_membership_valid_passes():
    conforms, report = _validate(MEMBERSHIP_VALID, "membership.shacl.ttl")
    assert conforms, f"Expected conformance:\n{report}"


def test_membership_missing_org_fails():
    conforms, _ = _validate(MEMBERSHIP_MISSING_ORG, "membership.shacl.ttl")
    assert not conforms
```

- [ ] **Step 2: Run, verify FAIL**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_shapes.py -v -k membership
```

- [ ] **Step 3: Write the shape**

Create `overlays/addressbook/shapes/membership.shacl.ttl`:

```turtle
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix org:  <http://www.w3.org/ns/org#> .
@prefix time: <http://www.w3.org/2006/time#> .

<https://pod.vardeman.me/vault/meta/shapes/membership.shacl.ttl#MembershipShape>
    a sh:NodeShape ;
    sh:targetClass org:Membership ;
    sh:closed false ;
    sh:agentInstruction """
      A reified org:Membership records a Person's affiliation with an
      Organization over a time interval. Required: org:member (the Person),
      org:organization (the Org), and org:memberDuring (time:Interval with
      time:hasBeginning; time:hasEnd optional for ongoing). Optional:
      org:role (vcard:role or bibo:Author etc.). UUIDv4 slug.
    """ ;

    sh:property [
        sh:path org:member ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:message "Membership must have exactly one org:member (Person card IRI)." ;
    ] ;

    sh:property [
        sh:path org:organization ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:message "Membership must have exactly one org:organization (Organization card IRI)." ;
    ] ;

    sh:property [
        sh:path org:memberDuring ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "Membership must declare org:memberDuring with at least time:hasBeginning." ;
    ] .
```

- [ ] **Step 4: Run, verify PASS**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_shapes.py -v -k membership
```

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/shapes/membership.shacl.ttl tests/test_addressbook_shapes.py
git commit -m "[Agent: Claude] addressbook: MembershipShape (reified time-scoped affiliation)

W3C ORG ontology pattern. member + organization + memberDuring with
time:hasBeginning required; time:hasEnd optional for ongoing.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: contact-create template

**Files:**
- Create: `overlays/addressbook/templates/contact-create.ttl`
- Test: `tests/test_addressbook_templates.py` (new)

- [ ] **Step 1: Write test**

Create `tests/test_addressbook_templates.py`:

```python
"""Templates parse and reference correct shapes."""
from rdflib import Graph, Namespace

TMPL = Namespace("https://pod.vardeman.me/vault/ontology/template#")
RDF  = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")


def test_contact_create_template_parses():
    g = Graph().parse("overlays/addressbook/templates/contact-create.ttl", format="turtle")
    tmpls = list(g.subjects(RDF.type, TMPL.Template))
    assert len(tmpls) == 1
    tmpl_iri = tmpls[0]

    # Required predicates per design §4.2
    assert (tmpl_iri, TMPL.validatesAgainst, None) in g
    assert (tmpl_iri, TMPL.operation, None) in g
    assert (tmpl_iri, TMPL.targetContainer, None) in g
    assert (tmpl_iri, TMPL.slugAlgorithm, None) in g
    assert (tmpl_iri, TMPL.templateBody, None) in g


def test_contact_create_template_body_contains_required_predicates():
    g = Graph().parse("overlays/addressbook/templates/contact-create.ttl", format="turtle")
    tmpl_iri = next(iter(g.subjects(RDF.type, TMPL.Template)))
    body = str(next(g.objects(tmpl_iri, TMPL.templateBody)))
    # Body must reference the required vcard predicates
    assert "vcard:fn" in body
    assert "vcard:inAddressBook" in body
    # And mention at least one anchor option
    assert "owl:sameAs" in body or "vcard:hasEmail" in body
```

- [ ] **Step 2: Run, verify FAIL**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_templates.py -v -k contact_create
```

- [ ] **Step 3: Write the template**

Create `overlays/addressbook/templates/contact-create.ttl`:

```turtle
@prefix tmpl:  <https://pod.vardeman.me/vault/ontology/template#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .

</vault/meta/templates/contact-create.ttl>
    a tmpl:Template ;
    tmpl:validatesAgainst </vault/meta/shapes/contact-card.shacl.ttl#ContactCardShape> ;
    tmpl:operation       "PUT" ;
    tmpl:targetContainer </vault/contacts/Person/> ;
    tmpl:slugAlgorithm   "uuid4" ;

    sh:agentInstruction """
      To create a Person contact:
        1. Generate UUIDv4 for slug (e.g., Python: uuid.uuid4().hex with dashes)
        2. PUT /vault/contacts/Person/<uuid>/index.ttl with the body below,
           replacing <<...>> placeholders
        3. On 201: PATCH /vault/contacts/people.ttl to add the index entry:
             solid:inserts { <#book> vcard:fn <<FULL_NAME>> ;
                                     vcard:hasMember </vault/contacts/Person/<uuid>/index.ttl#this> . }
        4. On 422: read the SHACL ValidationReport in the response body, fix
           the cited fields (sh:focusNode, sh:resultPath, sh:resultMessage),
           retry the PUT

      Minimum to satisfy SHACL: vcard:fn + vcard:inAddressBook + one anchor.
      Prefer owl:sameAs <orcid> when known — ORCID is the canonical cross-pod
      anchor. Fall back to vcard:hasEmail when ORCID isn't available. Fall back
      further to vcard:hasTelephone if neither.

      If you have only a name with no anchor, do NOT create a contact card —
      record the mention in /vault/wiki/working/ instead (D73 two-stage commit);
      promote to AddressBook when an anchor is found.
    """ ;

    tmpl:templateBody """
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix org:   <http://www.w3.org/ns/org#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .

<>  a vcard:VCard, foaf:PersonalProfileDocument ;
    foaf:primaryTopic <#this> ;
    dct:creator </vault/profile/card#me> ;
    dct:created  \"<<ISO_DATETIME>>\"^^xsd:dateTime .

<#this>
    a vcard:Individual, foaf:Person ;
    vcard:fn               \"<<FULL_NAME>>\" ;
    vcard:inAddressBook    </vault/contacts/index.ttl#this> ;

    # AT LEAST ONE of the following — required for operational utility
    owl:sameAs             <https://orcid.org/<<ORCID>>> ;
    vcard:hasEmail         <mailto:<<EMAIL>>> ;
    # vcard:hasTelephone   <tel:<<PHONE>>> ;

    # OPTIONAL — add when known
    # vcard:role           \"<<ROLE>>\" ;
    # org:hasMembership    </vault/contacts/Membership/<<MEMBERSHIP_UUID>>/index.ttl#this> ;
    # owl:sameAs           <https://<<HOST>>/profile/card#me> .
""" .
```

- [ ] **Step 4: Run, verify PASS**

```bash
~/uvws/.venv/bin/python -m pytest tests/test_addressbook_templates.py -v
```

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/templates/contact-create.ttl tests/test_addressbook_templates.py
git commit -m "[Agent: Claude] addressbook: contact-create template

Front-loads structured context for Person creation: required + optional fields,
slug algorithm (uuid4), and agentInstruction guiding the agent through
PUT + PATCH-people.ttl + on-422-correction loop.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: contact-update template

**Files:**
- Create: `overlays/addressbook/templates/contact-update.ttl`
- Modify: `tests/test_addressbook_templates.py`

- [ ] **Step 1: Add test**

Append to `tests/test_addressbook_templates.py`:

```python
def test_contact_update_template_parses():
    g = Graph().parse("overlays/addressbook/templates/contact-update.ttl", format="turtle")
    tmpls = list(g.subjects(RDF.type, TMPL.Template))
    assert len(tmpls) == 1
    tmpl_iri = tmpls[0]
    assert str(next(g.objects(tmpl_iri, TMPL.operation))) == "PATCH"
    body = str(next(g.objects(tmpl_iri, TMPL.templateBody)))
    assert "solid:inserts" in body or "solid:deletes" in body
```

- [ ] **Step 2: Run, verify FAIL**

- [ ] **Step 3: Write the template**

Create `overlays/addressbook/templates/contact-update.ttl`:

```turtle
@prefix tmpl:  <https://pod.vardeman.me/vault/ontology/template#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .

</vault/meta/templates/contact-update.ttl>
    a tmpl:Template ;
    tmpl:validatesAgainst </vault/meta/shapes/contact-card.shacl.ttl#ContactCardShape> ;
    tmpl:operation       "PATCH" ;
    tmpl:targetContainer </vault/contacts/Person/> ;
    tmpl:slugAlgorithm   "existing-uuid" ;

    sh:agentInstruction """
      To add or remove triples on an existing Person card, use N3 Patch. The
      target URL is the existing card document (/vault/contacts/Person/<uuid>/
      index.ttl). Substrate-governed predicates (vcard:inAddressBook, rdf:type)
      should not be touched by agent writes — substrate owns them per D81
      Model A. Everything else is agent-owned and can be added or removed.

      Common updates:
        - Add an ORCID: insert owl:sameAs <https://orcid.org/...>
        - Add an email: insert vcard:hasEmail <mailto:...>
        - Add a membership: insert org:hasMembership <membership-card-uri>
        - Add a sameAs WebID: insert owl:sameAs <https://otherpod/profile/card#me>

      SHACL re-validates after the patch; 422 on violation. Don't remove
      vcard:fn or all anchors at once (SHACL will reject).
    """ ;

    tmpl:templateBody """
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix org:   <http://www.w3.org/ns/org#> .

<>  a solid:InsertDeletePatch ;
    solid:inserts {
        <#this> <<PREDICATE>> <<OBJECT>> .
    } .

# Example — add ORCID:
# <> a solid:InsertDeletePatch ;
#    solid:inserts {
#        <#this> owl:sameAs <https://orcid.org/0000-0003-4091-6059> .
#    } .
""" .
```

- [ ] **Step 4: Run, verify PASS**

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/templates/contact-update.ttl tests/test_addressbook_templates.py
git commit -m "[Agent: Claude] addressbook: contact-update template (N3 Patch)

PATCH-shaped template for adding agent-owned triples (anchors, memberships).
Substrate-governed predicates (vcard:inAddressBook, rdf:type) excluded per
D81 Model A.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Tasks 11–13: org-create, group-create, membership-create templates

These follow the exact pattern of Tasks 9–10:
- Add test asserting the template parses and references its shape
- Run test to verify FAIL
- Write template TTL (use `contact-create.ttl` as the structural model)
- Run test to verify PASS
- Commit

**Template specifics:**

**org-create.ttl** — target `</vault/contacts/Organization/>`, slug `uuid4`, body has `a vcard:Organization, foaf:Organization`, REQUIRED `vcard:fn` + `vcard:inAddressBook`, anchor `owl:sameAs <https://ror.org/...>` (preferred) OR `vcard:hasURL`. Index entry goes in `/vault/contacts/people.ttl` (orgs co-listed with people for unified name lookup) OR in a separate `/vault/contacts/organizations.ttl` — choose people.ttl per SolidOS convention.

**group-create.ttl** — target `</vault/contacts/Group/>`, slug `kebab-case-mnemonic` (you provide the name), body has `a vcard:Group`, REQUIRED `vcard:fn` + at least one `vcard:hasMember`. Index entry in `/vault/contacts/groups.ttl`.

**membership-create.ttl** — target `</vault/contacts/Membership/>`, slug `uuid4`, body has `a org:Membership`, REQUIRED `org:member` + `org:organization` + `org:memberDuring` with `time:hasBeginning`. Optional `org:role`.

Commit message format: `[Agent: Claude] addressbook: <name> template`

---

## Task 14: bridge-card-to-wiki affordance

The bridge predicate (`foaf:primaryTopic`) is read in both directions. Card→wiki uses an inverse lookup over the wiki container's `.meta`.

**Files:**
- Create: `overlays/addressbook/affordances/bridge-card-to-wiki.ttl`
- Test: `tests/test_addressbook_affordances.py` (new)

- [ ] **Step 1: Write test**

Create `tests/test_addressbook_affordances.py`:

```python
"""Affordance descriptors parse and embed valid SPARQL."""
from rdflib import Graph, Namespace
from rdflib.plugins.sparql.parser import parseQuery

WIKI = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")
RDF  = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")


def _load_affordance(name: str):
    g = Graph().parse(f"overlays/addressbook/affordances/{name}.ttl", format="turtle")
    return g


def _query_text(g: Graph, query_predicate) -> str:
    return str(next(g.objects(None, query_predicate)))


def test_bridge_card_to_wiki_parses():
    g = _load_affordance("bridge-card-to-wiki")
    query = _query_text(g, WIKI.selectQuery)
    assert "foaf:primaryTopic" in query or "primaryTopic" in query
    # SPARQL must be syntactically valid
    parseQuery(query)
```

- [ ] **Step 2: Run, verify FAIL**

- [ ] **Step 3: Write the affordance**

Create `overlays/addressbook/affordances/bridge-card-to-wiki.ttl`:

```turtle
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .

</vault/meta/affordances/bridge-card-to-wiki.ttl>
    a wiki:Affordance ;
    sh:agentInstruction """
      Given a Person or Organization card IRI, find the wiki page that has
      this card as its foaf:primaryTopic. The wiki side declares the bridge;
      this query inverts it.

      Returns 0..1 wiki page URLs. Most cards have either zero (no narrative
      page yet) or one (the typical case). Multiple wiki pages targeting one
      card would be unusual but valid.

      Parameter: $card — the card IRI with hash fragment (e.g.,
      </vault/contacts/Person/c4e5.../index.ttl#this>).

      Sources required: the /vault/wiki/people/ container's .meta resources.
      Use solid-pod sparql with --default-graph-uri pointing at each relevant
      .meta (RQ-Pod-4 workaround).
    """ ;
    wiki:selectQuery """
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?wikiPage WHERE {
  ?wikiPage foaf:primaryTopic $card .
}
    """ .
```

- [ ] **Step 4: Run, verify PASS**

- [ ] **Step 5: Commit**

```bash
git add overlays/addressbook/affordances/bridge-card-to-wiki.ttl tests/test_addressbook_affordances.py
git commit -m "[Agent: Claude] addressbook: bridge-card-to-wiki affordance

Inverse lookup of foaf:primaryTopic. Returns 0..1 wiki page URLs for a
given card IRI. Wiki side owns the bridge declaration; this query reads it
backward.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Tasks 15-21: 7 more read affordances

Each task: add test (parse + SPARQL valid + key predicate present in query), run-fail, write affordance, run-pass, commit.

**Affordance specifics** (write each as a separate task to keep granularity bite-sized):

**Task 15 — `contact-find-by-name`:**
```sparql
PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>

SELECT ?person ?fn WHERE {
  ?person vcard:fn ?fn .
  FILTER(CONTAINS(LCASE(STR(?fn)), LCASE(STR($name))))
}
```
Source: `</vault/contacts/people.ttl>`. Parameter: `$name`.

**Task 16 — `contact-find-by-orcid`:**
```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?person WHERE {
  ?person owl:sameAs $orcid .
}
```
Sources: all `/vault/contacts/Person/*/index.ttl`. Parameter: `$orcid` (full IRI like `<https://orcid.org/...>`).

**Task 17 — `contact-find-by-email`:**
```sparql
PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>

SELECT ?person WHERE {
  ?person vcard:hasEmail $email .
}
```
Sources: `/vault/contacts/people.ttl` + Person cards. Parameter: `$email` (`<mailto:...>`).

**Task 18 — `contact-find-by-affiliation`:**
```sparql
PREFIX org: <http://www.w3.org/ns/org#>

SELECT ?person ?membership WHERE {
  ?person org:hasMembership ?membership .
  ?membership org:organization $org .
}
```
Sources: Person cards + Membership cards. Parameter: `$org` (Organization card IRI).

**Task 19 — `contact-find-by-group`:**
```sparql
PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>

SELECT ?person WHERE {
  $group vcard:hasMember ?person .
}
```
Source: the Group file. Parameter: `$group` (Group IRI).

**Task 20 — `org-find-by-name`:** Same pattern as contact-find-by-name but filtering on `vcard:Organization` typing.

**Task 21 — `org-find-by-ror`:** Same as contact-find-by-orcid but expected anchor is ROR IRI.

Each affordance follows the same TTL skeleton as Task 14 (`a wiki:Affordance`, `sh:agentInstruction`, `wiki:selectQuery`). Commit each separately.

---

## Task 22: Container bootstrap content

**Files:**
- Create: `overlays/addressbook/containers/index.ttl`
- Create: `overlays/addressbook/containers/people.ttl`
- Create: `overlays/addressbook/containers/groups.ttl`
- Test: `tests/test_addressbook_bootstrap.py` (new)

- [ ] **Step 1: Write the AddressBook root index.ttl**

Create `overlays/addressbook/containers/index.ttl`:

```turtle
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix acl:   <http://www.w3.org/ns/auth/acl#> .

<#this>
    a vcard:AddressBook ;
    dct:title "Vault AddressBook" ;
    dct:description "Operational identity substrate for vault contacts. Paired with /vault/wiki/people/ via foaf:primaryTopic for narrative-memory context." ;
    vcard:nameEmailIndex </vault/contacts/people.ttl> ;
    vcard:groupIndex     </vault/contacts/groups.ttl> ;
    acl:owner </vault/profile/card#me> .
```

- [ ] **Step 2: Write empty people.ttl**

Create `overlays/addressbook/containers/people.ttl`:

```turtle
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .

<#book> a vcard:AddressBook .
# Name → URI entries added via PATCH as contacts are created
```

- [ ] **Step 3: Write empty groups.ttl**

Create `overlays/addressbook/containers/groups.ttl`:

```turtle
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .

<#book> a vcard:AddressBook .
# Group → URI entries added via PATCH as groups are created
```

- [ ] **Step 4: Write parse test**

Create `tests/test_addressbook_bootstrap.py`:

```python
from rdflib import Graph, Namespace, URIRef

VCARD = Namespace("http://www.w3.org/2006/vcard/ns#")
DCT   = Namespace("http://purl.org/dc/terms/")


def test_addressbook_index_declares_required_predicates():
    g = Graph().parse("overlays/addressbook/containers/index.ttl",
                      format="turtle",
                      publicID="https://pod.vardeman.me/vault/contacts/index.ttl")
    book = URIRef("https://pod.vardeman.me/vault/contacts/index.ttl#this")
    assert (book, VCARD.AddressBook.startswith("http"))  # type check via direct probe
    assert (book, DCT.title, None) in g
    assert (book, VCARD.nameEmailIndex, None) in g
    assert (book, VCARD.groupIndex, None) in g
```

- [ ] **Step 5: Run, verify PASS**

- [ ] **Step 6: Commit**

```bash
git add overlays/addressbook/containers/ tests/test_addressbook_bootstrap.py
git commit -m "[Agent: Claude] addressbook: bootstrap containers (index, people, groups)

vcard:AddressBook root with nameEmailIndex + groupIndex pointing at the
initially-empty people.ttl + groups.ttl. acl:owner declared inline.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 23: TypeIndex registration patch

**Files:**
- Create: `overlays/addressbook/typeindex-patch.ttl`

- [ ] **Step 1: Write the patch**

Create `overlays/addressbook/typeindex-patch.ttl`:

```turtle
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix dct:   <http://purl.org/dc/terms/> .

<> a solid:InsertDeletePatch ;
   solid:inserts {
       </vault/settings/publicTypeIndex#addressbook>
           a solid:TypeRegistration ;
           solid:forClass vcard:AddressBook ;
           solid:instance </vault/contacts/index.ttl#this> ;
           dct:description "The vault's primary AddressBook." .
   } .
```

- [ ] **Step 2: Test the patch is well-formed (parses as Turtle)**

Add to `tests/test_addressbook_bootstrap.py`:

```python
def test_typeindex_patch_parses():
    Graph().parse("overlays/addressbook/typeindex-patch.ttl", format="turtle")
```

- [ ] **Step 3: Run, verify PASS**

- [ ] **Step 4: Commit**

```bash
git add overlays/addressbook/typeindex-patch.ttl tests/test_addressbook_bootstrap.py
git commit -m "[Agent: Claude] addressbook: TypeIndex registration patch

N3 Patch inserts solid:TypeRegistration for vcard:AddressBook pointing at
/vault/contacts/index.ttl#this so agents can discover the book via standard
Solid Type Index lookup.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 24: Storage description patch (catalog entries)

**Files:**
- Create: `overlays/addressbook/storage-patch.ttl`

- [ ] **Step 1: Write the patch**

Create `overlays/addressbook/storage-patch.ttl`:

```turtle
@prefix solid:   <http://www.w3.org/ns/solid/terms#> .
@prefix wiki:    <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> .

<> a solid:InsertDeletePatch ;
   solid:inserts {
       </vault/.well-known/solid>
           wiki:contactCatalog  </vault/contacts/> ;
           wiki:templateCatalog </vault/meta/templates/> ;
           overlay:installedOverlay <https://pod.vardeman.me/vault/ontology/overlay#addressbook> .
   } .
```

- [ ] **Step 2: Add parse test to test_addressbook_bootstrap.py**

```python
def test_storage_patch_parses():
    Graph().parse("overlays/addressbook/storage-patch.ttl", format="turtle")
```

- [ ] **Step 3: Run, verify PASS, commit**

```bash
git add overlays/addressbook/storage-patch.ttl tests/test_addressbook_bootstrap.py
git commit -m "[Agent: Claude] addressbook: storage description patch

Inserts wiki:contactCatalog + wiki:templateCatalog discovery entries so cold
agents arriving at /vault/.well-known/solid can find the AddressBook + template
catalog without prior knowledge.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 25: AddressBook overlay manifest

**Files:**
- Create: `overlays/addressbook/manifest.ttl`

- [ ] **Step 1: Write the manifest**

Create `overlays/addressbook/manifest.ttl`:

```turtle
@prefix overlay: <https://pod.vardeman.me/vault/ontology/overlay#> .
@prefix cap:     <https://pod.vardeman.me/vault/ontology/capability#> .
@prefix wiki:    <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix tmpl:    <https://pod.vardeman.me/vault/ontology/template#> .
@prefix vcard:   <http://www.w3.org/2006/vcard/ns#> .
@prefix dct:     <http://purl.org/dc/terms/> .

<https://pod.vardeman.me/vault/ontology/overlay#addressbook>
    a overlay:Overlay ;
    overlay:name "addressbook" ;
    overlay:version "0.1" ;
    dct:conformsTo <https://pod.vardeman.me/vault/ontology/wiki#WikiMemoryProfile> ;

    overlay:declaresVocabulary [
        overlay:namespace tmpl: ;
        overlay:document "vocabulary/template.ttl" ;
        overlay:hostedAt "/vault/ontology/template"
    ] ;

    overlay:dependsOnOverlay
        <https://pod.vardeman.me/vault/ontology/overlay#wiki-memory> ;

    overlay:installsContainer
        </vault/contacts/> ,
        </vault/contacts/Person/> ,
        </vault/contacts/Organization/> ,
        </vault/contacts/Group/> ,
        </vault/contacts/Membership/> ;

    overlay:installsShape
        </vault/meta/shapes/contact-card.shacl.ttl> ,
        </vault/meta/shapes/organization-card.shacl.ttl> ,
        </vault/meta/shapes/group.shacl.ttl> ,
        </vault/meta/shapes/membership.shacl.ttl> ;

    overlay:installsTemplate
        </vault/meta/templates/contact-create.ttl> ,
        </vault/meta/templates/contact-update.ttl> ,
        </vault/meta/templates/org-create.ttl> ,
        </vault/meta/templates/group-create.ttl> ,
        </vault/meta/templates/membership-create.ttl> ;

    overlay:installsAffordance
        </vault/meta/affordances/contact-find-by-name.ttl> ,
        </vault/meta/affordances/contact-find-by-orcid.ttl> ,
        </vault/meta/affordances/contact-find-by-email.ttl> ,
        </vault/meta/affordances/contact-find-by-affiliation.ttl> ,
        </vault/meta/affordances/contact-find-by-group.ttl> ,
        </vault/meta/affordances/org-find-by-name.ttl> ,
        </vault/meta/affordances/org-find-by-ror.ttl> ,
        </vault/meta/affordances/bridge-card-to-wiki.ttl> ;

    overlay:installsTypeIndexPatch "typeindex-patch.ttl" ;
    overlay:installsStoragePatch   "storage-patch.ttl" ;

    overlay:installsBootstrapContent
        [ overlay:contentPath "containers/index.ttl" ;
          overlay:hostedAt "/vault/contacts/index.ttl" ] ,
        [ overlay:contentPath "containers/people.ttl" ;
          overlay:hostedAt "/vault/contacts/people.ttl" ] ,
        [ overlay:contentPath "containers/groups.ttl" ;
          overlay:hostedAt "/vault/contacts/groups.ttl" ] .
```

- [ ] **Step 2: Test manifest parses via existing common.py**

Add to `tests/test_overlay_template_parsing.py`:

```python
def test_addressbook_manifest_parses_with_all_artifacts():
    from pathlib import Path
    from scripts.overlay.common import parse_manifest
    m = parse_manifest(Path("overlays/addressbook"), pod_url="https://pod.vardeman.me/vault/")
    assert m.name == "addressbook"
    assert len(m.shapes) == 4
    assert len(m.templates) == 5
    assert len(m.affordances) == 8
    assert len(m.containers) == 5
```

- [ ] **Step 3: Run, verify PASS** (the test may surface common.py gaps if the manifest uses predicates apply.py doesn't yet know — fix any gaps and retry)

- [ ] **Step 4: Commit**

```bash
git add overlays/addressbook/manifest.ttl tests/test_overlay_template_parsing.py
git commit -m "[Agent: Claude] addressbook: overlay manifest

Declares 4 shapes, 5 templates, 8 affordances, 5 containers, TypeIndex +
storage patches. Depends on wiki-memory overlay. Declares tmpl: vocabulary at
/vault/ontology/template.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 26: Apply the overlay to the running Pod

- [ ] **Step 1: Apply**

Run:
```bash
~/uvws/.venv/bin/python scripts/overlay/apply.py overlays/addressbook \
    --target https://pod.vardeman.me/vault/
```

Expected output: prints each artifact uploaded (vocab, shapes, templates, affordances, bootstrap content, patches), exits 0.

- [ ] **Step 2: Verify**

Run:
```bash
~/uvws/.venv/bin/python scripts/overlay/verify.py overlays/addressbook \
    --target https://pod.vardeman.me/vault/
```

Expected: all artifacts return 200; report ends "verified ok" or similar.

- [ ] **Step 3: Confirm AddressBook is discoverable via TypeIndex**

Run:
```bash
curl -s -H "Accept: text/turtle" https://pod.vardeman.me/vault/settings/publicTypeIndex \
    | grep -A2 "vcard:AddressBook"
```

Expected: shows `solid:forClass vcard:AddressBook` with `solid:instance </vault/contacts/index.ttl#this>`.

- [ ] **Step 4: Confirm storage description advertises the catalogs**

Run:
```bash
curl -s -H "Accept: text/turtle" https://pod.vardeman.me/vault/.well-known/solid \
    | grep -E "(contactCatalog|templateCatalog)"
```

Expected: both predicates present.

- [ ] **Step 5: No commit (deployment-only step)**

---

## Task 27: End-to-end integration test

**Files:**
- Create: `tests/integration/test_addressbook_e2e.py`

- [ ] **Step 1: Write the test**

Create `tests/integration/test_addressbook_e2e.py`:

```python
"""End-to-end: cold-start discovery → create contact → find by name + ORCID."""
import uuid
import datetime as dt
import httpx
import pytest
from rdflib import Graph, Namespace, URIRef

POD = "https://pod.vardeman.me/vault/"
VCARD = Namespace("http://www.w3.org/2006/vcard/ns#")
OWL   = Namespace("http://www.w3.org/2002/07/owl#")
FOAF  = Namespace("http://xmlns.com/foaf/0.1/")
SOLID = Namespace("http://www.w3.org/ns/solid/terms#")

CLIENT = httpx.Client(verify=False, timeout=10)


def test_addressbook_discoverable_via_typeindex():
    """Cold agent: TypeIndex → AddressBook root."""
    r = CLIENT.get(POD + "settings/publicTypeIndex", headers={"Accept": "text/turtle"})
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=r.url)
    matches = list(g.subjects(SOLID.forClass, VCARD.AddressBook))
    assert matches, "vcard:AddressBook not registered in publicTypeIndex"


def test_create_contact_with_orcid_succeeds():
    contact_uuid = str(uuid.uuid4())
    card_url = f"{POD}contacts/Person/{contact_uuid}/index.ttl"
    body = f"""
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .

<> a vcard:VCard, foaf:PersonalProfileDocument ;
   foaf:primaryTopic <#this> ;
   dct:creator </vault/profile/card#me> ;
   dct:created  "{dt.datetime.utcnow().isoformat()}Z"^^xsd:dateTime .

<#this> a vcard:Individual, foaf:Person ;
   vcard:fn "Test Person {contact_uuid[:8]}" ;
   vcard:inAddressBook </vault/contacts/index.ttl#this> ;
   owl:sameAs <https://orcid.org/0000-0001-0000-{contact_uuid[:4]}> .
"""
    r = CLIENT.put(card_url, content=body, headers={"Content-Type": "text/turtle"})
    assert r.status_code in (201, 205), f"PUT failed: {r.status_code} {r.text[:300]}"

    # Card is readable
    r = CLIENT.get(card_url, headers={"Accept": "text/turtle"})
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=card_url)
    person = URIRef(card_url + "#this")
    assert (person, VCARD.fn, None) in g


def test_create_contact_missing_anchor_rejected():
    """SHACL minimum-metadata invariant fires."""
    contact_uuid = str(uuid.uuid4())
    card_url = f"{POD}contacts/Person/{contact_uuid}/index.ttl"
    body = f"""
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .

<#this> a vcard:Individual, foaf:Person ;
   vcard:fn "Anchorless {contact_uuid[:8]}" ;
   vcard:inAddressBook </vault/contacts/index.ttl#this> .
"""
    r = CLIENT.put(card_url, content=body, headers={"Content-Type": "text/turtle"})
    assert r.status_code in (400, 409, 422), f"Expected SHACL rejection, got {r.status_code}"


def test_find_by_orcid_returns_created_contact():
    """Affordance invocation: create then find."""
    contact_uuid = str(uuid.uuid4())
    orcid = f"https://orcid.org/0000-0002-{contact_uuid[:4]}-{contact_uuid[4:8]}"
    card_url = f"{POD}contacts/Person/{contact_uuid}/index.ttl"
    body = f"""
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .

<#this> a vcard:Individual, foaf:Person ;
   vcard:fn "Findable {contact_uuid[:8]}" ;
   vcard:inAddressBook </vault/contacts/index.ttl#this> ;
   owl:sameAs <{orcid}> .
"""
    CLIENT.put(card_url, content=body, headers={"Content-Type": "text/turtle"})

    # Now query via solid-pod CLI (or direct Comunica) to find this contact
    # via owl:sameAs <orcid>. If solid-agent-skills CLI is on PATH:
    import subprocess
    result = subprocess.run(
        ["solid-pod", "sparql", f"{POD}contacts/Person/{contact_uuid}/index.ttl",
         f"PREFIX owl: <http://www.w3.org/2002/07/owl#> "
         f"SELECT ?p WHERE {{ ?p owl:sameAs <{orcid}> }}"],
        capture_output=True, text=True,
    )
    assert contact_uuid in result.stdout, f"Did not find contact via ORCID lookup:\n{result.stdout}"
```

- [ ] **Step 2: Run the tests**

Run:
```bash
~/uvws/.venv/bin/python -m pytest tests/integration/test_addressbook_e2e.py -v
```

Expected: all 4 tests pass. If a test fails, diagnose:
- `discoverable_via_typeindex` FAIL → Task 23 patch didn't land; re-apply
- `create_with_orcid` FAIL with 4xx → shape-validator gating an unexpected condition; check response body
- `missing_anchor_rejected` FAIL with 201 → SHACL not actually enforcing; verify shape-validator extension is loaded
- `find_by_orcid` FAIL → solid-pod CLI not on PATH or Comunica source missing — fall back to direct httpx SPARQL via Comunica sidecar

- [ ] **Step 3: Commit**

```bash
git add tests/integration/test_addressbook_e2e.py
git commit -m "[Agent: Claude] addressbook: end-to-end integration tests

Cold-start discovery, contact creation with ORCID, SHACL rejection of
anchorless contact, find by ORCID. Validates the full substrate ships
agent-usable.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 28: Update CLAUDE.md and MEMORY.md

**Files:**
- Modify: `CLAUDE.md` (Skills section + Repo Structure)
- Modify: `.claude/memory/MEMORY.md`

- [ ] **Step 1: Add to CLAUDE.md Repo Structure section**

Edit the `## Repo Structure` block to add:

```
overlays/
  wiki-memory/              — Phase 5d-5g wiki-memory L3 overlay
  addressbook/              — AddressBook substrate (new; D87 candidate)
```

- [ ] **Step 2: Add to MEMORY.md "Shipped" section**

In `.claude/memory/MEMORY.md`, find the Phase 5j entry and add a new entry below it:

```
## AddressBook substrate — Shipped (2026-MM-DD)

- overlays/addressbook/ — 4 SHACL shapes + 5 templates + 8 read affordances
- tmpl: vocabulary at /vault/ontology/template (D87 candidate)
- /vault/contacts/ container per SolidOS layout (UUIDv4 slugs for Person/Org,
  mnemonic for Group)
- ContactCardShape minimum-metadata invariant: vcard:fn + vcard:inAddressBook +
  ≥1 anchor (owl:sameAs / hasEmail / hasTelephone)
- Template + SHACL + readable-feedback pattern proven on this overlay; could
  generalize back to wiki-memory shapes if Rung 1.5 eval confirms agent lift
- Companion design: docs/plans/2026-05-16-agentic-addressbook-design.md
- Plan: docs/superpowers/plans/2026-05-16-addressbook-substrate.md
```

(Replace MM-DD with the actual completion date.)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md .claude/memory/MEMORY.md
git commit -m "[Agent: Claude] AddressBook substrate shipped: update CLAUDE.md + MEMORY.md

Adds overlays/addressbook/ to repo structure overview. Records substrate
shipping under MEMORY.md alongside Phase 5j close-out so future sessions can
find it without spelunking git history.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 29: Push the URI conformance delta

The design's §3.1 delta to `solid-uri-conformance/references/deltas.md` was not previously committed. Add it now since the substrate is shipped and the delta is operational.

**Files:**
- Modify: `.claude/skills/solid-uri-conformance/references/deltas.md`

- [ ] **Step 1: Edit deltas.md**

Find the `## Naming choices specific to this project` section. Add after the existing bullet:

```markdown
- **Person and Organization entities in /vault/contacts/** use opaque UUIDv4
  slugs, not mnemonic. Documented exception to "mnemonic over opaque for
  everything" — name collision risk (CJK, common Western names,
  marriage/transition renames) substantively exceeds vault notes. Display
  name and external anchors (ORCID, ROR, email, WebID) live in card data via
  vcard:fn and owl:sameAs, not in URI slugs. Wiki pages about people
  (/vault/wiki/people/) retain mnemonic slugs for wikilink affordance,
  bridged to opaque cards via foaf:primaryTopic. See
  docs/plans/2026-05-16-agentic-addressbook-design.md §3.1.
- **Group entities in /vault/contacts/Group/** use mnemonic kebab-case slugs.
  Author-controlled, low volume, low collision risk.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/solid-uri-conformance/references/deltas.md
git commit -m "[Agent: Claude] solid-uri-conformance: document AddressBook UUID-slug delta

Class-by-class exception to mnemonic-over-opaque for Person and Organization
entities. Group entities stay mnemonic. Wiki bridge uses foaf:primaryTopic.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Definition of done

- All 29 tasks complete; tests pass
- `make test` runs the full suite green (new tests + existing wiki-memory L3 tests)
- `make status` shows AddressBook discoverable
- Manual verification:
  - `curl https://pod.vardeman.me/vault/contacts/index.ttl` returns AddressBook root
  - `curl https://pod.vardeman.me/vault/meta/shapes/contact-card.shacl.ttl` returns the shape
  - `curl https://pod.vardeman.me/vault/meta/templates/contact-create.ttl` returns the template
  - `curl https://pod.vardeman.me/vault/meta/affordances/bridge-card-to-wiki.ttl` returns the affordance
- TypeIndex registered, storage description advertises catalogs
- MEMORY.md updated; CLAUDE.md updated; URI conformance delta documented

---

## Out of scope (subsequent plans)

- `solid-pod setup-owner` CLI flow → next plan
- `.claude/skills/solid-addressbook/` SKILL.md + `solid-wiki-memory-l3` SKILL.md refinement → next plan
- Rung 1.5 eval with skill-creator harness → next plan after skills land
- `tmpl:` vocabulary ratification as D87 → defer until eval confirms agent lift
- ProvenanceCommitListener integration (companion doc Thread 3)
- ACP migration before ACL turn-on (companion doc Thread 4)

---

## Self-review notes (for the implementing agent)

A few things worth re-verifying as you go:

1. **Manifest predicate completeness.** Task 25's manifest uses `overlay:installsTypeIndexPatch`, `overlay:installsStoragePatch`, and `overlay:installsBootstrapContent`. If `apply.py` doesn't recognize any of these, you may need to add them (mirror Task 3's pattern: add predicate to vocab + extend Manifest parsing + extend apply_overlay). Verify against `scripts/overlay/common.py` and `apply.py` early — ideally during Task 1 (prerequisites).

2. **Comunica source for `find-by-orcid`.** Cross-card SPARQL needs explicit sources (RQ-Pod-4). The affordance can declare expected sources via `wiki:expectedSources` (check the wiki-memory affordance pattern) or the agent supplies `--source` per `solid-pod sparql` invocation. The integration test uses single-card source for simplicity; production lookup needs container-level enumeration.

3. **CSS SHACL feedback (Task 1).** If Task 1 reveals CSS doesn't return SHACL reports as Turtle, all SHACL-feedback-dependent assumptions in Tasks 9–13 need revisiting. Either build a wrapper extension before continuing, or temporarily document the gap and proceed (agents see opaque error pages until fixed).

4. **TLS in tests.** `verify=False` in httpx is acceptable for the local mkcert deployment. The Node-trust issue (per D85) doesn't apply because tests use httpx (Python), which honors `SSL_CERT_FILE` if set; `verify=False` sidesteps both.

5. **Test isolation.** Each `test_create_*` in Task 27 generates a fresh UUID, so reruns don't collide. Tests are not idempotent — they accumulate cards. Consider a cleanup fixture (`@pytest.fixture(autouse=True)` that DELETEs created cards) if test pollution becomes an issue. Out of scope for v1.
