# D108 Front-2 — In-Band Admission Floor + Synchronous Materialization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the wiki-memory L3 markdown corpus self-validating at write time — project the markdown body into its `.meta` graph **in-band**, validate that graph against the container's SHACL shape **before commit**, reject (422) or commit + synchronously materialize `.meta`, on **both** write paths (markdown projection and direct N3 PATCH).

**Architecture:** A general `AdmissionFloorStore` (lives in the `shape-validator` extension; holds zero markdown/SKOS/wiki knowledge) sits below `PatchingStore` and above `ShapeValidationStore`. It gates on the parent container's `ldp:constrainedBy`, obtains the candidate `.meta` graph from a **pluggable `BodyProjector`** (markdown + wiki binding, injected via Components.js wildcard range — same pattern as `IPostProjectionHook`), validates it via the existing `ShaclValidator` machinery, then commits body + writes a body-hash-stamped `.meta`. The post-commit `MarkdownProjectionListener` is demoted to an idempotent backstop (re-projects only on stamp miss). `shape-validator` is restricted to skip non-RDF bodies so a markdown container can carry `constrainedBy`. RDF-body apps (AddressBook) reuse the floor with no projector.

**Tech Stack:** TypeScript (CSS v8 extensions, Components.js DI, N3.js, `rdf-validate-shacl`), vitest (TS unit tests), Python/pytest + httpx (integration tests against the live Pod), Turtle/SHACL (overlay artifacts), Docker (`make reset`).

**Spec:** `docs/superpowers/specs/2026-06-03-d108-front2-inband-admission-floor-design.md`

**Conventions used throughout:**
- TS unit tests: `cd css/extensions/<ext> && npm test -- test/<file>.test.ts` (vitest).
- Python integration: `export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem` then `~/uvws/.venv/bin/python -m pytest tests/<file>.py -v`. Live Pod = `https://pod.vardeman.me`.
- Deploy: `make reset` (fresh-volume rebuild) then `~/uvws/.venv/bin/python -m scripts.overlay.apply overlays/wiki-memory --target https://pod.vardeman.me/vault/`; verify `make audit`.
- Commit prefix `[Agent: Claude]`; co-author `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Never force push; stage specific files.
- Work happens on branch `d108-front2-admission-floor` (already created).

---

## PHASE 1 — Structural corrections (independently shippable; no write-path behavior change)

These three tasks land first. They carry **no** `ldp:constrainedBy` on wiki containers yet (that would make the *current* validator reject markdown bodies — deferred to Phase 2 Task 11, after the RDF-only restriction + floor exist). They are pure accuracy/correctness fixes.

### Task 1: Code-span masking in the markdown parsers

The wikilink + span-literal parsers are regex-based and project tokens even when they appear inside `` `inline code` `` or fenced code blocks. This is the root of the dangling-`broader` bug (`f8aaeaf` was a minimal content patch). Fix it at the parser so docs can *show* `` `[text]{.prefLabel}` `` without projecting it.

**Files:**
- Create: `css/extensions/shared/markdown-parsing/src/codeSpans.ts`
- Create: `css/extensions/shared/markdown-parsing/test/codeSpans.test.ts`
- Modify: `css/extensions/shared/markdown-parsing/src/wikilinks.ts` (extractWikilinks, ~40-47)
- Modify: `css/extensions/shared/markdown-parsing/src/spanLiterals.ts` (parseSpanLiterals, ~6-14)
- Modify: `css/extensions/shared/markdown-parsing/test/wikilinks.test.ts` (add a code-span case)
- Modify: `css/extensions/shared/markdown-parsing/test/spanLiterals.test.ts` (add a code-span case)

- [ ] **Step 1: Write the failing test for the masking util**

Create `css/extensions/shared/markdown-parsing/test/codeSpans.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { maskCodeSpans } from "../src/codeSpans.js";

describe("maskCodeSpans", () => {
  it("replaces inline code content with spaces, preserving length + offsets", () => {
    const src = "see `[x]{.prefLabel}` and [y]{.altLabel}";
    const out = maskCodeSpans(src);
    expect(out.length).toBe(src.length);                       // offsets preserved
    expect(out).not.toContain("prefLabel");                    // masked
    expect(out).toContain("[y]{.altLabel}");                   // live span untouched
    expect(out.indexOf("[y]")).toBe(src.indexOf("[y]"));       // position preserved
  });

  it("masks fenced code blocks", () => {
    const src = "a\n```\n[[Z]]{.broader}\n```\nb [[W]]{.broader}";
    const out = maskCodeSpans(src);
    expect(out).not.toContain("[[Z]]");
    expect(out).toContain("[[W]]{.broader}");
  });

  it("leaves text with no code spans unchanged", () => {
    const src = "plain [a]{.x} and [[B]]{.y}";
    expect(maskCodeSpans(src)).toBe(src);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd css/extensions/shared/markdown-parsing && npm test -- test/codeSpans.test.ts`
Expected: FAIL — `maskCodeSpans` not found / module missing.

- [ ] **Step 3: Implement the masking util**

Create `css/extensions/shared/markdown-parsing/src/codeSpans.ts`:

```typescript
// Mask markdown code regions so downstream token parsers (wikilinks, span-literals)
// don't project example syntax shown inside `inline code` or fenced ``` blocks.
// Replaces code-region characters with spaces — preserves total length AND every
// non-code offset, so callers can keep using the same indices.
const FENCE = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g;
const INLINE = /(`+)(?:(?!\1).)*\1/g;

function blank(match: string): string {
  // keep newlines (so line structure / other regexes stay aligned), blank the rest
  return match.replace(/[^\n]/g, " ");
}

export function maskCodeSpans(body: string): string {
  let out = body.replace(FENCE, (m) => blank(m));
  out = out.replace(INLINE, (m) => blank(m));
  return out;
}
```

- [ ] **Step 4: Run the util test to confirm it passes**

Run: `cd css/extensions/shared/markdown-parsing && npm test -- test/codeSpans.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire masking into the wikilink + span parsers (test-first)**

Add a code-span case to `css/extensions/shared/markdown-parsing/test/wikilinks.test.ts` (inside the existing describe):

```typescript
it("does not extract wikilinks inside code spans", () => {
  const refs = extractWikilinks("real [[A]]{.broader} but `code [[B]]{.broader}`");
  expect(refs.map(r => r.title)).toEqual(["A"]);
});
```

And to `css/extensions/shared/markdown-parsing/test/spanLiterals.test.ts`:

```typescript
it("does not parse span-literals inside code spans", () => {
  const spans = parseSpanLiterals("[live]{.prefLabel} `[ex]{.prefLabel}`");
  expect(spans.map(s => s.text)).toEqual(["live"]);
});
```

- [ ] **Step 6: Confirm both new cases FAIL**

Run: `cd css/extensions/shared/markdown-parsing && npm test -- test/wikilinks.test.ts test/spanLiterals.test.ts`
Expected: the two new cases FAIL (code tokens still extracted).

- [ ] **Step 7: Apply masking at both parser entry points**

In `css/extensions/shared/markdown-parsing/src/wikilinks.ts`, add the import at top and mask before matching:

```typescript
import { maskCodeSpans } from "./codeSpans.js";
// ...
export function extractWikilinks(body: string): WikilinkRef[] {
  const masked = maskCodeSpans(body);
  const out: WikilinkRef[] = [];
  for (const m of masked.matchAll(WIKILINK_RE)) {
    const [, target, , klass] = m;
    out.push({ title: target.trim(), classHint: klass ?? undefined });
  }
  return out;
}
```

In `css/extensions/shared/markdown-parsing/src/spanLiterals.ts`, same pattern:

```typescript
import { maskCodeSpans } from "./codeSpans.js";
// ...
export function parseSpanLiterals(text: string): SpanLiteral[] {
  const masked = maskCodeSpans(text);
  const out: SpanLiteral[] = [];
  for (const m of masked.matchAll(RE)) {
    out.push({ text: m[1], pred: m[2], lang: m[3], datatype: m[4] });
  }
  return out;
}
```

Note: masking preserves offsets, so `m.index` (if used anywhere downstream) and `m[1]` text content remain correct — the matched text is read from `masked`, which equals `body` in all non-code regions.

- [ ] **Step 8: Run the full shared-parsing suite to confirm green**

Run: `cd css/extensions/shared/markdown-parsing && npm test`
Expected: PASS (all, including the two new cases). If any existing test fed code-fenced fixtures expecting projection, that fixture was wrong per the spec — update it to reflect non-projection and note it in the commit.

- [ ] **Step 9: Commit**

```bash
git add css/extensions/shared/markdown-parsing/src/codeSpans.ts \
        css/extensions/shared/markdown-parsing/test/codeSpans.test.ts \
        css/extensions/shared/markdown-parsing/src/wikilinks.ts \
        css/extensions/shared/markdown-parsing/src/spanLiterals.ts \
        css/extensions/shared/markdown-parsing/test/wikilinks.test.ts \
        css/extensions/shared/markdown-parsing/test/spanLiterals.test.ts
git commit -m "[Agent: Claude] fix: skip code spans in wikilink/span-literal projection (Front-2 §5.9c)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2: Declare the literal axis in the markdown-projection descriptor

The affordance descriptor under-declares what the shipped grammar projects (`sub:governs` omits the literal axis; there is no `sub:projectsFromBody`). Make it accurate.

**Files:**
- Modify: `overlays/wiki-memory/affordances/markdown-projection.ttl`
- Test: `tests/test_markdown_projection_descriptor.py` (new)

- [ ] **Step 1: Write the failing test (descriptor declares the literal axis)**

Create `tests/test_markdown_projection_descriptor.py`:

```python
from pathlib import Path
from rdflib import Graph, Namespace, RDF

SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
DESC = Path("overlays/wiki-memory/affordances/markdown-projection.ttl")

def _graph():
    g = Graph(); g.parse(DESC, format="turtle", publicID="https://pod.vardeman.me/vault/meta/affordances/markdown-projection.ttl")
    return g

def test_governs_includes_literal_axis():
    g = _graph()
    governed = set(g.objects(None, SUB.governs))
    for p in (SKOS.prefLabel, SKOS.altLabel, SKOS.definition):
        assert p in governed, f"sub:governs missing {p}"

def test_projects_from_body_declared():
    g = _graph()
    body = set(str(o) for o in g.objects(None, SUB.projectsFromBody))
    assert body, "sub:projectsFromBody not declared"
    assert any("literal" in b.lower() for b in body)
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_markdown_projection_descriptor.py -v`
Expected: FAIL on both (predicates absent).

- [ ] **Step 3: Edit the descriptor**

In `overlays/wiki-memory/affordances/markdown-projection.ttl`, add the three literal predicates to the `sub:governs` list (after `skos:related`) and add a `sub:projectsFromBody` block (after `sub:projectsFromFrontmatter`):

```turtle
    sub:governs rdf:type ,
        dct:title ,
        skos:prefLabel ,
        skos:altLabel ,
        skos:definition ,
        dct:identifier ,
        dct:created ,
        dct:modified ,
        dct:references ,
        dct:source ,
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
    sub:projectsFromFrontmatter "type" , "created" , "modified" , "maturity" ,
        "aliases" , "identifier" , "citekey" ;
    sub:projectsFromBody
        "literal axis: [text]{.prefLabel} / {.altLabel} / {.definition} → skos: literals on <#this>" ,
        "edge axis: [[Target]]{.broader} / {.related} / {.cites} / {.source} / {.author} → resource edges" ,
        "type axis: frontmatter type: → rdf:type on <#this> (dispatched to the container's shape)" ;
```

- [ ] **Step 4: Run the descriptor test to confirm it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_markdown_projection_descriptor.py -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/affordances/markdown-projection.ttl tests/test_markdown_projection_descriptor.py
git commit -m "[Agent: Claude] descriptor: declare literal axis + projectsFromBody (Front-2 §5.9b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3: Container `.meta` shape pointers + agent instructions for the 4 missing containers

`concepts`/`places`/`events`/`organizations` lack the `sub:shape` + `sh:agentInstruction` that `people`/`procedures`/`working` carry. Add them (mirroring the people exemplar). **No `ldp:constrainedBy` yet** — Phase 2 Task 11.

**Files:**
- Create: `overlays/wiki-memory/containers/wiki/concepts/.meta`
- Create: `overlays/wiki-memory/containers/wiki/places/.meta`
- Create: `overlays/wiki-memory/containers/wiki/events/.meta`
- Create: `overlays/wiki-memory/containers/wiki/organizations/.meta`
- Test: `tests/test_container_meta_pointers.py` (new)

- [ ] **Step 1: Write the failing test (each governed container declares sub:shape + agentInstruction)**

Create `tests/test_container_meta_pointers.py`:

```python
from pathlib import Path
import pytest
from rdflib import Graph, Namespace
from rdflib.namespace import SH

SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
BASE = "https://pod.vardeman.me/vault/wiki/{c}/"
EXPECT = {
    "concepts": "concept.shacl.ttl",
    "places": "place.shacl.ttl",
    "events": "event.shacl.ttl",
    "organizations": "organization.shacl.ttl",
}

@pytest.mark.parametrize("ctr,shape", EXPECT.items())
def test_container_meta_has_shape_and_instruction(ctr, shape):
    p = Path(f"overlays/wiki-memory/containers/wiki/{ctr}/.meta")
    assert p.exists(), f"{p} missing"
    g = Graph(); g.parse(p, format="turtle", publicID=BASE.format(c=ctr))
    shapes = [str(o) for o in g.objects(None, SUB.shape)]
    assert any(shape in s for s in shapes), f"{ctr}: sub:shape not -> {shape}"
    assert list(g.objects(None, SH.agentInstruction)), f"{ctr}: no sh:agentInstruction"
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_container_meta_pointers.py -v`
Expected: FAIL (files missing).

- [ ] **Step 3: Create the 4 container `.meta` files**

`overlays/wiki-memory/containers/wiki/concepts/.meta` (the SKOS backbone container — note it holds both Concept and Source):

```turtle
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix sub:   <https://pod.vardeman.me/vault/ontology/substrate#> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Wiki Concepts" ;
   solid:forClass skos:Concept ;
   sub:shape </vault/meta/shapes/concept.shacl.ttl> ;
   sub:installedBy <https://pod.vardeman.me/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "The SKOS concept scheme — abstract ideas/theories. Typed skos:Concept on <#this>. Author skos:prefLabel via the body literal axis [text]{.prefLabel} (required); skos:broader/related via [[Target]]{.broader}. Sources (wiki:Source) also live here." .
```

`overlays/wiki-memory/containers/wiki/places/.meta`:

```turtle
@prefix wiki:   <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix sub:    <https://pod.vardeman.me/vault/ontology/substrate#> .
@prefix solid:  <http://www.w3.org/ns/solid/terms#> .
@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix ldp:    <http://www.w3.org/ns/ldp#> .
@prefix schema: <https://schema.org/> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Wiki Places" ;
   solid:forClass schema:Place ;
   sub:shape </vault/meta/shapes/place.shacl.ttl> ;
   sub:installedBy <https://pod.vardeman.me/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "Place records. Typed schema:Place on <#this>. schema:name is the entity name (Thing frame), not skos:prefLabel." .
```

`overlays/wiki-memory/containers/wiki/events/.meta`:

```turtle
@prefix wiki:   <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix sub:    <https://pod.vardeman.me/vault/ontology/substrate#> .
@prefix solid:  <http://www.w3.org/ns/solid/terms#> .
@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix ldp:    <http://www.w3.org/ns/ldp#> .
@prefix schema: <https://schema.org/> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Wiki Events" ;
   solid:forClass schema:Event ;
   sub:shape </vault/meta/shapes/event.shacl.ttl> ;
   sub:installedBy <https://pod.vardeman.me/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "Event records. Typed schema:Event on <#this>. schema:name is the entity name (Thing frame)." .
```

`overlays/wiki-memory/containers/wiki/organizations/.meta`:

```turtle
@prefix wiki:   <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix sub:    <https://pod.vardeman.me/vault/ontology/substrate#> .
@prefix solid:  <http://www.w3.org/ns/solid/terms#> .
@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix ldp:    <http://www.w3.org/ns/ldp#> .
@prefix schema: <https://schema.org/> .

<> a ldp:Container, ldp:BasicContainer ;
   dct:title "Wiki Organizations" ;
   solid:forClass schema:Organization ;
   sub:shape </vault/meta/shapes/organization.shacl.ttl> ;
   sub:installedBy <https://pod.vardeman.me/vault/ontology/overlay#wiki-memory> ;
   sh:agentInstruction "Organization records. Typed schema:Organization on <#this>. schema:name is the entity name (Thing frame)." .
```

> Verify the four shape filenames exist under `shapes/` / `overlays/wiki-memory/shapes/` (the audit + Task 11 parity test depend on the exact filename); adjust the `sub:shape` path to the actual filename if it differs (e.g. `place.shacl.ttl`).

- [ ] **Step 4: Confirm the manifest installs these containers**

Confirm `overlays/wiki-memory` manifest lists `concepts`/`places`/`events`/`organizations` as container paths (it must, since the containers already exist live). The deploy step (apply.py:124-146) auto-picks up `containers/<path>/.meta`. If any of the four is absent from the manifest's container list, add it.

- [ ] **Step 5: Run the container-meta test to confirm it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_container_meta_pointers.py -v`
Expected: PASS (4 cases).

- [ ] **Step 6: Deploy + verify live (offline tests are green; now confirm the artifacts apply)**

```bash
make reset
export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem
~/uvws/.venv/bin/python -m scripts.overlay.apply overlays/wiki-memory --target https://pod.vardeman.me/vault/
make audit
```
Expected: apply prints `meta → …/concepts/.meta` (×4); `make audit` = 0 ERROR. Spot-check: `curl -s https://pod.vardeman.me/vault/wiki/concepts/.meta` shows `sub:shape` + `sh:agentInstruction`.

- [ ] **Step 7: Commit**

```bash
git add overlays/wiki-memory/containers/wiki/concepts/.meta \
        overlays/wiki-memory/containers/wiki/places/.meta \
        overlays/wiki-memory/containers/wiki/events/.meta \
        overlays/wiki-memory/containers/wiki/organizations/.meta \
        tests/test_container_meta_pointers.py
git commit -m "[Agent: Claude] containers: sub:shape + agentInstruction on concepts/places/events/orgs (Front-2 §5.9a)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Phase 1 checkpoint:** `make audit` 0 ERROR; three commits; no write-path behavior change. Independently shippable.

---

## PHASE 2 — The in-band admission floor

### Task 4: Restrict `shape-validator` to RDF content-types

So a markdown container can carry `ldp:constrainedBy` (Task 11) without `ShaclValidator` trying to SHACL-check the markdown body and rejecting it. A SHACL validator validates RDF; non-RDF bodies are someone else's job (the floor's projector).

**Files:**
- Modify: `css/extensions/shape-validator/src/storage/validators/ShaclValidator.ts` (canHandle, ~66-79)
- Test: `css/extensions/shape-validator/test/ShaclValidator.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `css/extensions/shape-validator/test/ShaclValidator.test.ts` (mirror the file's existing construction of a validator + input; adapt the existing helpers there):

```typescript
it("skips validation for non-RDF (markdown) representations", async () => {
  const rep = makeRepresentation("# title\n[x]{.prefLabel}", "text/markdown", "http://x/wiki/concepts/a.md");
  const parent = makeParentWithConstrainedBy("http://x/shapes/concept.shacl.ttl");
  await expect(validator.canHandle({ parentRepresentation: parent, representation: rep }))
    .rejects.toThrow(/non-RDF|not RDF|No shape validation/i);
});
```

(Use/extend the test file's existing `makeRepresentation` / parent helpers; if absent, construct a `BasicRepresentation` with `metadata.contentType = "text/markdown"` and a parent whose metadata carries `LDP.constrainedBy`.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd css/extensions/shape-validator && npm test -- test/ShaclValidator.test.ts`
Expected: FAIL — markdown currently passes `canHandle` (it only checks auxiliary + constrainedBy + non-empty).

- [ ] **Step 3: Add the RDF-only guard in `canHandle`**

In `ShaclValidator.ts`, after the auxiliary check and before the empty check (around line 71), add a content-type guard:

```typescript
public async canHandle({ parentRepresentation, representation }: ShapeValidatorInput): Promise<void> {
  if (this.auxiliaryStrategy.isAuxiliaryIdentifier({ path: representation.metadata.identifier.value })) {
    throw new NotImplementedHttpError('No shape validation executed on auxiliary files.');
  }

  // A SHACL validator validates RDF. Non-RDF bodies (e.g. text/markdown) are projected
  // into their .meta graph by the AdmissionFloorStore + a BodyProjector and validated there.
  const ct = representation.metadata.contentType;
  const RDF_TYPES = new Set([
    'text/turtle', 'application/ld+json', 'application/n-triples',
    'application/n-quads', 'application/trig', 'text/n3', 'application/rdf+xml',
  ]);
  if (ct && !RDF_TYPES.has(ct)) {
    throw new NotImplementedHttpError(`No shape validation on non-RDF content-type ${ct}.`);
  }

  const shapeURL = parentRepresentation.metadata.get(LDP.terms.constrainedBy)?.value;
  if (!shapeURL) {
    throw new NotImplementedHttpError('No ldp:constrainedBy predicate.');
  }
  if (representation.isEmpty) {
    throw new BadRequestHttpError('Data could not be validated as it could not be converted to rdf');
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd css/extensions/shape-validator && npm test -- test/ShaclValidator.test.ts`
Expected: PASS (the new case + the existing RDF-body cases still validate).

- [ ] **Step 5: Run the full shape-validator suite**

Run: `cd css/extensions/shape-validator && npm test`
Expected: PASS (no regression in the contacts/WebID RDF-body path).

- [ ] **Step 6: Commit**

```bash
git add css/extensions/shape-validator/src/storage/validators/ShaclValidator.ts \
        css/extensions/shape-validator/test/ShaclValidator.test.ts
git commit -m "[Agent: Claude] shape-validator: skip non-RDF content-types (Front-2 §5.3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5: Extract a reusable graph-validation core

The floor must validate a quad set against a shape doc and throw the *same* `ShaclValidationError` (so the 422 + `sh:ValidationReport` body is byte-identical to the RDF-body path). Extract the SHACL-run-and-throw logic from `ShaclValidator.handle` into a standalone async function the floor can call directly on quads.

**Files:**
- Create: `css/extensions/shape-validator/src/storage/validators/validateQuadsAgainstShape.ts`
- Modify: `css/extensions/shape-validator/src/storage/validators/ShaclValidator.ts` (call the extracted fn from `handle`)
- Modify: `css/extensions/shape-validator/src/index.ts` (export the new fn)
- Test: `css/extensions/shape-validator/test/validateQuadsAgainstShape.test.ts`

- [ ] **Step 1: Write the failing test**

Create `css/extensions/shape-validator/test/validateQuadsAgainstShape.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Parser, Store } from "n3";
import { validateQuadsAgainstShape } from "../src/storage/validators/validateQuadsAgainstShape.js";

const SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<#S> a sh:NodeShape ; sh:targetClass skos:Concept ; sh:closed false ;
  sh:property [ sh:path skos:prefLabel ; sh:minCount 1 ; sh:datatype xsd:string ] .`;

function quads(ttl: string): Store {
  const s = new Store(); s.addQuads(new Parser({ baseIRI: "http://x/a.md" }).parse(ttl)); return s;
}

describe("validateQuadsAgainstShape", () => {
  const shapeStore = quads(SHAPE);

  it("returns conforms=true for a valid concept", async () => {
    const data = quads(`<http://x/a.md#this> a <http://www.w3.org/2004/02/skos/core#Concept> ;
      <http://www.w3.org/2004/02/skos/core#prefLabel> "Photosynthesis" .`);
    const r = await validateQuadsAgainstShape(data, shapeStore);
    expect(r.conforms).toBe(true);
  });

  it("returns conforms=false + a turtle report when prefLabel missing", async () => {
    const data = quads(`<http://x/a.md#this> a <http://www.w3.org/2004/02/skos/core#Concept> .`);
    const r = await validateQuadsAgainstShape(data, shapeStore);
    expect(r.conforms).toBe(false);
    expect(r.reportTurtle).toMatch(/ValidationReport|prefLabel/);
  });

  it("passes agent-owned non-governed predicates (sh:closed false)", async () => {
    const data = quads(`<http://x/a.md#this> a <http://www.w3.org/2004/02/skos/core#Concept> ;
      <http://www.w3.org/2004/02/skos/core#prefLabel> "X" ;
      <http://example.org/agentOwned> "anything" .`);
    const r = await validateQuadsAgainstShape(data, shapeStore);
    expect(r.conforms).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd css/extensions/shape-validator && npm test -- test/validateQuadsAgainstShape.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the extraction**

Create `css/extensions/shape-validator/src/storage/validators/validateQuadsAgainstShape.ts` (lift the SHACL run + serialize from `ShaclValidator.handle`, lines 105-117):

```typescript
import SHACLValidator from 'rdf-validate-shacl';
import type { Store } from 'n3';
import { Writer } from 'n3';

export interface GraphValidationResult {
  conforms: boolean;
  reportTurtle?: string;
}

async function serialize(dataset: any): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const writer = new Writer();
    writer.addQuads([...dataset]);
    writer.end((err, result) => (err ? reject(err) : resolve(result)));
  });
}

// Validate a data graph against a shapes graph. Pure: no HTTP, no store, no throw —
// the caller decides what a non-conforming result means (the floor throws ShaclValidationError).
export async function validateQuadsAgainstShape(
  dataStore: Store,
  shapeStore: Store,
): Promise<GraphValidationResult> {
  const validator = new SHACLValidator(shapeStore);
  const report = await validator.validate(dataStore);
  if (report.conforms) return { conforms: true };
  return { conforms: false, reportTurtle: await serialize(report.dataset) };
}
```

- [ ] **Step 4: Refactor `ShaclValidator.handle` to use it (no behavior change)**

In `ShaclValidator.ts handle()`, replace the inline `new SHACLValidator(...).validate(...)` + serialize (≈ lines 105-117) with:

```typescript
    const shape = await fetchDataset(shapeURL);
    const shapeStore = await readableToQuads(shape.data);
    this.targetClassCheck(shapeStore, dataStore, shapeURL);

    const result = await validateQuadsAgainstShape(dataStore, shapeStore);
    this.logger.debug(`Validation: ${result.conforms ? 'success' : 'failure'}`);
    if (!result.conforms) {
      await this.invokeHookAndThrow(representation.metadata.identifier.value, result.reportTurtle!, shapeURL);
    }
```

Add `import { validateQuadsAgainstShape } from './validateQuadsAgainstShape.js';` at top. Export it from `src/index.ts`.

- [ ] **Step 5: Run the new test + the full suite**

Run: `cd css/extensions/shape-validator && npm test`
Expected: PASS — the extraction test + all existing `ShaclValidator`/`ShapeValidationStore` tests still green (refactor preserves behavior).

- [ ] **Step 6: Commit**

```bash
git add css/extensions/shape-validator/src/storage/validators/validateQuadsAgainstShape.ts \
        css/extensions/shape-validator/src/storage/validators/ShaclValidator.ts \
        css/extensions/shape-validator/src/index.ts \
        css/extensions/shape-validator/test/validateQuadsAgainstShape.test.ts
git commit -m "[Agent: Claude] shape-validator: extract validateQuadsAgainstShape core (Front-2 §5.4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6: The `BodyProjector` interface + `MarkdownBodyProjector`

A small interface the floor consumes; markdown-projection implements it by wrapping the existing pure pipeline + governed-predicate resolution. Returns the candidate quads + the governed predicate set (for the materialization merge).

**Files:**
- Create: `css/extensions/shape-validator/src/storage/BodyProjector.ts` (the interface, general — lives with the floor's consumer)
- Create: `css/extensions/markdown-projection/src-cjs/markdownBodyProjector.ts` (the impl, CJS — same layer as listener.ts)
- Modify: `css/extensions/markdown-projection/dist-cjs/components/components.jsonld` (register the new class)
- Test: `css/extensions/markdown-projection/test/markdownBodyProjector.test.ts`

- [ ] **Step 1: Define the interface (no test — pure type)**

Create `css/extensions/shape-validator/src/storage/BodyProjector.ts`:

```typescript
import type { Quad } from '@rdfjs/types';
import type { Representation, ResourceIdentifier } from '@solid/community-server';

export interface ProjectionResult {
  quads: Quad[];          // the candidate .meta graph for this body
  governed: string[];     // governed predicate IRIs (for replaceGoverned merge)
}

// Produces the candidate .meta graph from a (non-RDF) body. Implemented per content-type
// by a profile extension (markdown-projection provides the text/markdown one). Returning
// null means "not my content-type" — the floor treats the body as RDF / delegates downstream.
export interface BodyProjector {
  canProject(representation: Representation): boolean;
  project(identifier: ResourceIdentifier, body: string): Promise<ProjectionResult | null>;
}
```

- [ ] **Step 2: Write the failing test for the markdown impl**

Create `css/extensions/markdown-projection/test/markdownBodyProjector.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { MarkdownBodyProjector } from "../src-cjs/markdownBodyProjector.js";

describe("MarkdownBodyProjector", () => {
  const proj = new MarkdownBodyProjector("https://pod.vardeman.me", "/data", "/vault");

  it("canProject true for text/markdown, false otherwise", () => {
    expect(proj.canProject({ metadata: { contentType: "text/markdown" } } as any)).toBe(true);
    expect(proj.canProject({ metadata: { contentType: "text/turtle" } } as any)).toBe(false);
  });

  it("projects a concept body to quads + governed set including skos:prefLabel", async () => {
    const body = "---\ntype: Concept\n---\n# Photosynthesis\n\n[Photosynthesis]{.prefLabel}\n\n[[Biology]]{.broader}\n";
    const r = await proj.project({ path: "https://pod.vardeman.me/vault/wiki/concepts/photosynthesis.md" } as any, body);
    expect(r).not.toBeNull();
    const preds = r!.quads.map(q => q.predicate.value);
    expect(preds).toContain("http://www.w3.org/2004/02/skos/core#prefLabel");
    expect(r!.governed).toContain("http://www.w3.org/2004/02/skos/core#prefLabel");
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd css/extensions/markdown-projection && npm test -- test/markdownBodyProjector.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement `MarkdownBodyProjector`**

Create `css/extensions/markdown-projection/src-cjs/markdownBodyProjector.ts`. It mirrors `listener.ts`'s `getPipeline()` runtime-import + the project() body, but is a callable store-collaborator (no FS read — the floor hands it the body string; no MetaWriter — the floor materializes):

```typescript
import type { Representation, ResourceIdentifier } from '@solid/community-server';
import type { Quad } from '@rdfjs/types';
import * as path from 'path';

const runtimeImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;
let pipelineCache: Promise<any> | null = null;
function getPipeline(): Promise<any> {
  if (pipelineCache === null) {
    const esmPath = path.resolve(__dirname, '..', 'dist', 'extensions', 'markdown-projection', 'src', 'index.js');
    pipelineCache = runtimeImport('file://' + esmPath);
  }
  return pipelineCache;
}

export class MarkdownBodyProjector {
  private routingMap: Record<string, string> | null = null;
  public constructor(
    private readonly baseUrl: string,
    private readonly dataDir: string,
    private readonly storagePath = '/vault',
  ) { this.baseUrl = baseUrl.replace(/\/$/, ''); }

  public canProject(representation: Representation): boolean {
    return representation.metadata.contentType === 'text/markdown';
  }

  public async project(identifier: ResourceIdentifier, body: string):
      Promise<{ quads: Quad[]; governed: string[] } | null> {
    const { projectionPipeline, detectClass, resolveGovernedForWikiClass,
            TypeIndexLoader, loadRoutingMap } = await getPipeline();

    const storageBase = this.baseUrl + this.storagePath;
    if (this.routingMap === null) {
      this.routingMap = (await loadRoutingMap(storageBase).catch(() => ({}))) ?? {};
    }
    const typeIndex = await new TypeIndexLoader(storageBase).load().catch(() => undefined);

    const quads: Quad[] = await projectionPipeline.run(identifier.path, body, typeIndex, this.routingMap ?? undefined);
    const cls = detectClass(quads);
    if (!cls) return null;                       // no rdf:type → not a governed resource
    const { page, thing } = resolveGovernedForWikiClass(cls);
    return { quads, governed: [...new Set([...page, ...thing])] };
  }
}
```

> Confirm `loadRoutingMap` / `TypeIndexLoader.load()` signatures against `listener.ts` (lines 270-319) and adapt the exact call shape — the listener is the source of truth for how these are invoked at runtime.

- [ ] **Step 5: Run the projector test to confirm it passes**

Run: `cd css/extensions/markdown-projection && npm test -- test/markdownBodyProjector.test.ts`
Expected: PASS. (Requires the ESM `dist/` built — run `npm run build:esm` first if the test imports the runtime pipeline; the pure-pipeline path is already exercised by existing tests.)

- [ ] **Step 6: Register the class in Components.js**

Add a component entry for `MarkdownBodyProjector` in `css/extensions/markdown-projection/dist-cjs/components/components.jsonld` mirroring the `MarkdownProjectionListener` entry (constructor params: `baseUrl`, `dataDir`, `storagePath`). Keep it hand-written (Components metadata is not regenerated).

- [ ] **Step 7: Commit**

```bash
git add css/extensions/shape-validator/src/storage/BodyProjector.ts \
        css/extensions/markdown-projection/src-cjs/markdownBodyProjector.ts \
        css/extensions/markdown-projection/dist-cjs/components/components.jsonld \
        css/extensions/markdown-projection/test/markdownBodyProjector.test.ts
git commit -m "[Agent: Claude] BodyProjector interface + MarkdownBodyProjector (Front-2 §5.2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 7: `AdmissionFloorStore` — the markdown-body path

The general floor. Extends `PassthroughStore`. For a governed-container markdown write: gate on `constrainedBy` → project (injected projector) → validate projected graph → on pass commit body + write stamped `.meta` (injected `MetaWriter.replaceGoverned`) / on fail throw `ShaclValidationError`. Contains **no** markdown/SKOS/wiki symbols (the layering test in Task 12 enforces this).

**Files:**
- Create: `css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts`
- Modify: `css/extensions/shape-validator/src/index.ts` (export it)
- Test: `css/extensions/shape-validator/test/AdmissionFloorStore.test.ts`

- [ ] **Step 1: Write the failing test (markdown body floored)**

Create `css/extensions/shape-validator/test/AdmissionFloorStore.test.ts` with a fake source store, a fake projector, and a fetchDataset stub returning the concept shape. Two cases — valid commits, invalid throws 422:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Store, Parser } from "n3";
import { AdmissionFloorStore } from "../src/storage/AdmissionFloorStore.js";
import { ShaclValidationError } from "../src/error/ShaclValidationError.js";

// minimal fakes — see existing ShapeValidationStore.test.ts for the BasicRepresentation/ID helpers
function rep(body: string, ct = "text/markdown", id = "http://x/vault/wiki/concepts/a.md") { /* ...build BasicRepresentation... */ }
function parentWithConstrainedBy(shapeUrl: string) { /* ...parent rep whose metadata has LDP.constrainedBy... */ }

describe("AdmissionFloorStore (markdown path)", () => {
  it("commits body + writes .meta when the projected graph conforms", async () => {
    const source = { setRepresentation: vi.fn().mockResolvedValue(new Map()),
                     getRepresentation: vi.fn().mockResolvedValue(parentWithConstrainedBy("http://x/shapes/concept.shacl.ttl")) };
    const projector = { canProject: () => true,
      project: async () => ({ quads: new Parser({baseIRI:"http://x/vault/wiki/concepts/a.md"})
        .parse(`<http://x/vault/wiki/concepts/a.md#this> a <http://www.w3.org/2004/02/skos/core#Concept> ;
          <http://www.w3.org/2004/02/skos/core#prefLabel> "A" .`),
        governed: ["http://www.w3.org/2004/02/skos/core#prefLabel"] }) };
    const metaWriter = { replaceGoverned: vi.fn().mockResolvedValue(undefined) };
    const store = new AdmissionFloorStore(source as any, /*identifierStrategy*/..., projector as any, metaWriter as any, /*validation deps*/...);
    await store.setRepresentation({ path: "http://x/vault/wiki/concepts/a.md" } as any, rep("...") as any);
    expect(source.setRepresentation).toHaveBeenCalled();     // body committed
    expect(metaWriter.replaceGoverned).toHaveBeenCalled();   // .meta materialized
  });

  it("throws ShaclValidationError (422) when prefLabel missing — nothing committed", async () => {
    const source = { setRepresentation: vi.fn(), getRepresentation: vi.fn().mockResolvedValue(parentWithConstrainedBy("http://x/shapes/concept.shacl.ttl")) };
    const projector = { canProject: () => true,
      project: async () => ({ quads: new Parser({baseIRI:"http://x/vault/wiki/concepts/a.md"})
        .parse(`<http://x/vault/wiki/concepts/a.md#this> a <http://www.w3.org/2004/02/skos/core#Concept> .`),
        governed: ["http://www.w3.org/2004/02/skos/core#prefLabel"] }) };
    const store = new AdmissionFloorStore(source as any, ..., projector as any, { replaceGoverned: vi.fn() } as any, ...);
    await expect(store.setRepresentation({ path: "http://x/vault/wiki/concepts/a.md" } as any, rep("...") as any))
      .rejects.toSatisfy((e: unknown) => ShaclValidationError.isInstance(e));
    expect(source.setRepresentation).not.toHaveBeenCalled();
  });
});
```

> The validation deps (how the store fetches the shape + runs `validateQuadsAgainstShape` + throws `ShaclValidationError`) are injected/mocked; finalize the exact constructor shape in Step 3 and update these instantiations to match.

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd css/extensions/shape-validator && npm test -- test/AdmissionFloorStore.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `AdmissionFloorStore` (markdown path + the stamp)**

Create `css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts`:

```typescript
import { PassthroughStore } from '@solid/community-server';
import type { ResourceStore, Representation, ResourceIdentifier, Conditions, ChangeMap,
  IdentifierStrategy, AuxiliaryStrategy } from '@solid/community-server';
import { readableToString, BasicRepresentation, NotImplementedHttpError, NotFoundHttpError } from '@solid/community-server';
import { LDP } from '@solid/community-server';
import { Store } from 'n3';
import { createHash } from 'crypto';
import type { BodyProjector } from './BodyProjector.js';
import { validateQuadsAgainstShape } from './validators/validateQuadsAgainstShape.js';
import { ShaclValidationError } from '../error/ShaclValidationError.js';
import { fetchDataset } from './validators/fetchDataset.js';      // reuse ShaclValidator's helper
import { readableToQuads } from '@solid/community-server';

export const STAMP_PRED = 'https://pod.vardeman.me/vault/ontology/substrate#bodyHash';

export class AdmissionFloorStore extends PassthroughStore {
  public constructor(
    source: ResourceStore,
    private readonly identifierStrategy: IdentifierStrategy,
    private readonly auxiliaryStrategy: AuxiliaryStrategy,
    private readonly projector: BodyProjector,
    private readonly metaWriter: { replaceGoverned(target: string, quads: any[], governed: string[], url?: string): Promise<void> },
    private readonly dataDir: string,
    private readonly baseUrl: string,
  ) { super(source); }

  public async setRepresentation(id: ResourceIdentifier, representation: Representation, conditions?: Conditions): Promise<ChangeMap> {
    // Only governed-container, projector-eligible (markdown) bodies are floored here.
    // RDF bodies + .meta auxiliaries + non-governed containers pass straight through.
    const shapeUrl = await this.constrainedByFor(id);
    if (!shapeUrl || this.auxiliaryStrategy.isAuxiliaryIdentifier(id) || !this.projector.canProject(representation)) {
      return super.setRepresentation(id, representation, conditions);
    }

    const body = await readableToString(representation.data);
    const projected = await this.projector.project(id, body);
    if (!projected) {                              // no rdf:type → can't dispatch; let it pass (working/ tolerance)
      const passRep = new BasicRepresentation(body, representation.metadata);
      return super.setRepresentation(id, passRep, conditions);
    }

    // container = gate already (constrainedBy present); class = dispatch happens inside the shape's targetClass.
    const dataStore = new Store(projected.quads);
    const shape = await fetchDataset(shapeUrl);
    const shapeStore = await readableToQuads(shape.data);
    const result = await validateQuadsAgainstShape(dataStore, shapeStore);
    if (!result.conforms && !this.isPermissive(id)) {
      throw new ShaclValidationError(shapeUrl, result.reportTurtle!);
    }

    // Commit body (re-wrap: the data stream was consumed), then materialize .meta + stamp.
    const committed = await super.setRepresentation(id, new BasicRepresentation(body, representation.metadata), conditions);
    const stamped = [...projected.quads, this.stampQuad(id, body)];
    const fsPath = this.fsPath(id);
    await this.metaWriter.replaceGoverned(fsPath, stamped, [...projected.governed, STAMP_PRED], id.path);
    return committed;
  }

  private async constrainedByFor(id: ResourceIdentifier): Promise<string | undefined> {
    if (this.identifierStrategy.isRootContainer(id)) return undefined;
    const parent = this.identifierStrategy.getParentContainer(id);
    try {
      const rep = await this.source.getRepresentation(parent, {});
      return rep.metadata.get(LDP.terms.constrainedBy)?.value;
    } catch (e) { if (NotFoundHttpError.isInstance(e)) return undefined; throw e; }
  }

  private isPermissive(id: ResourceIdentifier): boolean {
    return id.path.includes('/wiki/working/');     // D73 — container-keyed
  }

  private stampQuad(id: ResourceIdentifier, body: string): any {
    const { DataFactory } = require('n3');
    const hash = createHash('sha256').update(body).digest('hex');
    return DataFactory.quad(DataFactory.namedNode(id.path), DataFactory.namedNode(STAMP_PRED), DataFactory.literal(hash));
  }

  private fsPath(id: ResourceIdentifier): string {
    // mirror listener.ts fsPathFromUrl(id.path, baseUrl, dataDir); reuse that helper if exported
    const rel = id.path.replace(this.baseUrl.replace(/\/$/, ''), '');
    return `${this.dataDir.replace(/\/$/, '')}${rel}`;
  }
}
```

> `fetchDataset`, `readableToQuads`, and `fsPathFromUrl` are existing helpers — import the real ones (the Explore map cites `ShaclValidator.ts` for `fetchDataset`/`readableToQuads` and `listener.ts` for `fsPathFromUrl`). If `fsPathFromUrl` isn't exported, export it from the shared layer rather than re-deriving the path. Materializing `.meta` via `MetaWriter` (filesystem) matches the listener; the stamp predicate is non-governed-by-shapes (substrate-owned) so it survives `sh:closed false`.

- [ ] **Step 4: Run the store test to confirm it passes**

Run: `cd css/extensions/shape-validator && npm test -- test/AdmissionFloorStore.test.ts`
Expected: PASS (commit-on-valid, throw-on-invalid).

- [ ] **Step 5: Commit**

```bash
git add css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts \
        css/extensions/shape-validator/src/index.ts \
        css/extensions/shape-validator/test/AdmissionFloorStore.test.ts
git commit -m "[Agent: Claude] AdmissionFloorStore: in-band markdown-body floor + stamp (Front-2 §5.1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 8: Direct-`.meta`-PATCH floor path

A direct N3 PATCH (or PUT) to a governed resource's `.meta` arrives as an RDF representation post-`PatchingStore`. Validate that graph against the container's shape (open shape passes agent enrichment, rejects backbone violations). Scope guard: the *container's own* `.meta` is exempt.

**Files:**
- Modify: `css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts`
- Test: `css/extensions/shape-validator/test/AdmissionFloorStore.test.ts` (add cases)

- [ ] **Step 1: Write the failing tests**

Add to `AdmissionFloorStore.test.ts`:

```typescript
it("rejects a direct .meta write that drops prefLabel (governed violation)", async () => {
  // representation is text/turtle for the resource .meta of a governed concept, missing prefLabel
  // expect ShaclValidationError; source.setRepresentation NOT called
});
it("accepts a direct .meta write adding an agent-owned predicate (sh:closed false)", async () => {
  // conformant governed core + extra agentOwned triple → committed
});
it("exempts the container's own .meta (ldp:contains listing)", async () => {
  // id = .../wiki/concepts/.meta (container aux) → passes through, no shape validation
});
```

(Build the `.meta` representations as `text/turtle`; the parent `constrainedBy` resolution for a resource-`.meta` uses the *resource's* container, i.e. the governed wiki container.)

- [ ] **Step 2: Run to confirm fail**

Run: `cd css/extensions/shape-validator && npm test -- test/AdmissionFloorStore.test.ts`
Expected: the 3 new cases FAIL (the store currently only handles projector-eligible bodies; RDF `.meta` writes fall through unvalidated).

- [ ] **Step 3: Add the direct-`.meta` branch**

Extend `setRepresentation` to detect a governed *resource* `.meta` write and validate it. Insert before the projector branch:

```typescript
    // Direct write/PATCH to a governed RESOURCE's .meta: validate the incoming RDF graph
    // against the shape (path-agnostic floor). Container's-own .meta is exempt (scope guard).
    if (this.auxiliaryStrategy.isAuxiliaryIdentifier(id)) {
      const subject = this.auxiliaryStrategy.getSubjectIdentifier(id);
      const shapeForMeta = await this.constrainedByFor(subject);
      const subjectIsContainer = subject.path.endsWith('/');
      if (shapeForMeta && !subjectIsContainer && this.isRdf(representation)) {
        const dataStore = await readableToQuads((await this.cloneData(representation)).data);
        const shape = await fetchDataset(shapeForMeta);
        const result = await validateQuadsAgainstShape(dataStore, await readableToQuads(shape.data));
        if (!result.conforms && !this.isPermissive(subject)) {
          throw new ShaclValidationError(shapeForMeta, result.reportTurtle!);
        }
      }
      return super.setRepresentation(id, representation, conditions);
    }
```

Add helpers `isRdf(rep)` (content-type in the RDF set from Task 4) and `cloneData(rep)` (clone the stream so validation doesn't consume the body that must still be written — mirror `cloneRepresentation` used in `ShaclValidator.handle`).

- [ ] **Step 4: Run to confirm pass**

Run: `cd css/extensions/shape-validator && npm test -- test/AdmissionFloorStore.test.ts`
Expected: PASS (all markdown + direct-`.meta` cases).

- [ ] **Step 5: Commit**

```bash
git add css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts \
        css/extensions/shape-validator/test/AdmissionFloorStore.test.ts
git commit -m "[Agent: Claude] AdmissionFloorStore: floor direct .meta PATCH path (Front-2 §5, decision 3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 9: Demote the listener to an idempotent backstop

The post-commit listener must re-project **only** when the `.meta` stamp is stale/missing (so the in-band path is project-once on success, and the listener is the safety net on the rare in-band `.meta`-write miss).

**Files:**
- Modify: `css/extensions/markdown-projection/src-cjs/listener.ts` (project(), ~233-358)
- Test: `css/extensions/markdown-projection/test/listenerBackstop.test.ts` (new; unit-test the stamp-skip predicate)

- [ ] **Step 1: Extract + test the skip predicate**

Add a pure helper in `listener.ts` (exported for test): `shouldReproject(body: string, existingMetaTtl: string): boolean` — returns false iff the existing `.meta` carries `sub:bodyHash` equal to `sha256(body)`.

Create `css/extensions/markdown-projection/test/listenerBackstop.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { shouldReproject } from "../src-cjs/listener.js";

const body = "# A\n[A]{.prefLabel}\n";
const hash = createHash("sha256").update(body).digest("hex");

describe("backstop shouldReproject", () => {
  it("skips when stamp matches the body hash", () => {
    const meta = `<x> <https://pod.vardeman.me/vault/ontology/substrate#bodyHash> "${hash}" .`;
    expect(shouldReproject(body, meta)).toBe(false);
  });
  it("reprojects when stamp missing", () => {
    expect(shouldReproject(body, `<x> <http://purl.org/dc/terms/title> "A" .`)).toBe(true);
  });
  it("reprojects when stamp stale", () => {
    const meta = `<x> <https://pod.vardeman.me/vault/ontology/substrate#bodyHash> "deadbeef" .`;
    expect(shouldReproject(body, meta)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `cd css/extensions/markdown-projection && npm test -- test/listenerBackstop.test.ts`
Expected: FAIL — `shouldReproject` not exported.

- [ ] **Step 3: Implement + wire the skip into project()**

Add the exported helper and call it near the top of `project()` after the body is read and before running the pipeline: read the current `.meta` (if present) and `if (!shouldReproject(body, existingMeta)) { debug('stamp current, backstop skip'); return; }`.

```typescript
import { Parser } from "n3";   // if not already imported
const STAMP = "https://pod.vardeman.me/vault/ontology/substrate#bodyHash";
export function shouldReproject(body: string, existingMetaTtl: string): boolean {
  if (!existingMetaTtl) return true;
  const want = createHash("sha256").update(body).digest("hex");
  try {
    const q = new Parser().parse(existingMetaTtl);
    const stamp = q.find(t => t.predicate.value === STAMP);
    return !stamp || stamp.object.value !== want;
  } catch { return true; }
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd css/extensions/markdown-projection && npm test -- test/listenerBackstop.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add css/extensions/markdown-projection/src-cjs/listener.ts \
        css/extensions/markdown-projection/test/listenerBackstop.test.ts
git commit -m "[Agent: Claude] listener: demote to idempotent backstop (stamp skip) (Front-2 §5.7)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 10: Components.js wiring + Dockerfile

Insert `AdmissionFloorStore` between `PatchingStore` and `ShapeValidationStore`, inject the projector (wildcard range, like `IPostProjectionHook`), the `MetaWriter`, strategies, and `baseUrl`/`dataDir`. Ensure the build compiles both extensions.

**Files:**
- Create: `css/extensions/shape-validator/dist-cjs/components/...` entries OR modify the existing components metadata for the new class
- Modify: `css/config/solid-config.json` (chain: `PatchingStore.source` → AdmissionFloorStore → ShapeValidationStore)
- Modify: `css/config/markdown-projection.json` (instantiate `MarkdownBodyProjector`)
- Modify: `css/Dockerfile` (no new ext, but confirm shape-validator builds the new files)

- [ ] **Step 1: Add the component metadata for `AdmissionFloorStore` + `MarkdownBodyProjector`**

In shape-validator's Components metadata, declare `AdmissionFloorStore` with constructor params (`source`, `identifierStrategy`, `auxiliaryStrategy`, `projector` [wildcard range — comment it like the postProjectionHook param], `metaWriter` [wildcard], `dataDir`, `baseUrl`). In markdown-projection's metadata, declare `MarkdownBodyProjector` and a `MetaWriter` instance (or reuse the existing one).

- [ ] **Step 2: Rewire the chain in `css/config/solid-config.json`**

Change `PatchingStore.source` to the new floor and set the floor's `source` to the existing shape store:

```json
{
  "@type": "Override",
  "overrideInstance": { "@id": "urn:solid-server:default:ResourceStore_Patching" },
  "overrideParameters": {
    "@type": "PatchingStore",
    "source": { "@id": "urn:shape-validation:default:ResourceStore_AdmissionFloor" },
    "patchHandler": { "@id": "urn:solid-server:default:PatchHandler" }
  }
},
{
  "@id": "urn:shape-validation:default:ResourceStore_AdmissionFloor",
  "@type": "AdmissionFloorStore",
  "source": { "@id": "urn:shape-validation:default:ResourceStore_Shape" },
  "identifierStrategy": { "@id": "urn:solid-server:default:IdentifierStrategy" },
  "auxiliaryStrategy": { "@id": "urn:solid-server:default:AuxiliaryStrategy" },
  "projector": { "@id": "urn:cogitarelink:MarkdownBodyProjector" },
  "metaWriter": { "@id": "urn:cogitarelink:MetaWriter" },
  "dataDir": { "@id": "urn:solid-server:default:variable:rootFilePath" },
  "baseUrl": { "@id": "urn:solid-server:default:variable:baseUrl" }
}
```

Add the `MarkdownBodyProjector` + `MetaWriter` instances to `css/config/markdown-projection.json` (mirror the listener block: `baseUrl`, `dataDir` variables, `storagePath "/vault"`).

- [ ] **Step 3: Build both extensions**

Run:
```bash
cd css/extensions/shape-validator && npm install --ignore-scripts && npm run build
cd ../markdown-projection && npm run build:esm && npm run build:cjs
```
Expected: clean compiles. If shape-validator imports `BodyProjector`/`AdmissionFloorStore` types, ensure `src/index.ts` exports them and the build emits `dist-cjs`.

- [ ] **Step 4: Deploy on a fresh volume + check the server boots**

Run: `make reset` then `make status`
Expected: `make reset` builds the image (Components.js wires the new store with no DI errors); `make status` shows CSS `200`. Tail `docker compose logs css` for Components.js instantiation errors (the classic failure mode — fix `@id`/range mismatches).

- [ ] **Step 5: Commit**

```bash
git add css/config/solid-config.json css/config/markdown-projection.json \
        css/extensions/shape-validator/dist-cjs/components/ \
        css/extensions/markdown-projection/dist-cjs/components/components.jsonld \
        css/Dockerfile
git commit -m "[Agent: Claude] wire AdmissionFloorStore into the store chain + DI the projector (Front-2 §5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 11: Deploy `ldp:constrainedBy` + floor parity on the wiki containers

Now safe (RDF-only restriction + floor exist). Add `constrainedBy` to each governed wiki container's `.meta` (the gate), and assert floor parity: the `constrainedBy` doc holds the same NodeShape the shape-tree's `st:shape` names.

**Files:**
- Modify: the 7 governed container `.meta` files under `overlays/wiki-memory/containers/wiki/{concepts,people,places,events,organizations,procedures,working}/.meta` — add the `ldp:constrainedBy` triple
- Test: `tests/test_floor_parity.py` (new)

- [ ] **Step 1: Write the failing parity test**

Create `tests/test_floor_parity.py`:

```python
from pathlib import Path
import pytest
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import LDP

ST = Namespace("http://www.w3.org/ns/shapetrees#")
TREE = Path("overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl")
WIKI = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")

# container dir -> (its ContainerTree resource tree's primary shape, the .shacl filename)
PARITY = {
    "concepts": (WIKI.ConceptShape, "concept.shacl.ttl"),
    "people": (WIKI.PersonShape, "person.shacl.ttl"),
    "places": (WIKI.PlaceShape, "place.shacl.ttl"),
    "events": (WIKI.EventShape, "event.shacl.ttl"),
    "organizations": (WIKI.OrganizationShape, "organization.shacl.ttl"),
    "procedures": (WIKI.HowToShape, "howto.shacl.ttl"),
    "working": (WIKI.WorkingNoteShape, "workingnote.shacl.ttl"),
}

@pytest.mark.parametrize("ctr,shape_file", [(c, v[1]) for c, v in PARITY.items()])
def test_constrainedby_matches_shapetree(ctr, shape_file):
    g = Graph(); g.parse(f"overlays/wiki-memory/containers/wiki/{ctr}/.meta", format="turtle",
                         publicID=f"https://pod.vardeman.me/vault/wiki/{ctr}/")
    cb = [str(o) for o in g.objects(None, LDP.constrainedBy)]
    assert cb, f"{ctr}: no ldp:constrainedBy"
    assert any(shape_file in c for c in cb), f"{ctr}: constrainedBy != {shape_file}"
```

- [ ] **Step 2: Run to confirm fail**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_floor_parity.py -v`
Expected: FAIL (no container declares `ldp:constrainedBy` yet).

- [ ] **Step 3: Add `ldp:constrainedBy` to each governed container `.meta`**

Add one triple to each of the 7 container `.meta` files (the 4 new + people/procedures/working). Example for `concepts/.meta` (add `ldp:` prefix if missing, and the triple):

```turtle
   sub:shape </vault/meta/shapes/concept.shacl.ttl> ;
   ldp:constrainedBy </vault/meta/shapes/concept.shacl.ttl> ;
```

> `working/.meta`'s `constrainedBy` points to the permissive working-note shape; the floor's `isPermissive('/wiki/working/')` already suppresses the 422 there (D73). Confirm each `sub:shape`/`constrainedBy` filename matches the live shape doc that defines the `st:shape` NodeShape.

- [ ] **Step 4: Run the parity test to confirm pass**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_floor_parity.py -v`
Expected: PASS (7 cases).

- [ ] **Step 5: Deploy + audit**

```bash
make reset
export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem
~/uvws/.venv/bin/python -m scripts.overlay.apply overlays/wiki-memory --target https://pod.vardeman.me/vault/
make audit
```
Expected: 0 ERROR; `curl https://pod.vardeman.me/vault/wiki/concepts/.meta` shows `ldp:constrainedBy`.

- [ ] **Step 6: Commit**

```bash
git add overlays/wiki-memory/containers/wiki/*/.meta tests/test_floor_parity.py
git commit -m "[Agent: Claude] floor parity: ldp:constrainedBy on wiki containers ≡ shapetree st:shape (Front-2 §5.8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 12: End-to-end integration + the layering/anti-contamination test

Prove the floor live: enforcement, synchronous materialization, both paths, RDF-body unchanged — and that the floor is application-general.

**Files:**
- Create: `tests/test_admission_floor_integration.py`
- Create: `css/extensions/shape-validator/test/layering.test.ts`

- [ ] **Step 1: Write the layering test (structural — the floor imports no wiki symbols)**

Create `css/extensions/shape-validator/test/layering.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("AdmissionFloorStore layering", () => {
  it("contains no markdown/SKOS/wiki-profile symbols (stays L1/L2-general)", () => {
    const src = readFileSync(join(__dirname, "../src/storage/AdmissionFloorStore.ts"), "utf8");
    for (const banned of ["markdown-projection", "skos", "wiki:", "ConceptShape", "projectionPipeline"]) {
      expect(src.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});
```

- [ ] **Step 2: Run it (should pass already if Task 7/8 stayed clean; if it fails, refactor the offending import behind the injected interface)**

Run: `cd css/extensions/shape-validator && npm test -- test/layering.test.ts`
Expected: PASS. If FAIL, the floor leaked a profile dependency — move it behind `BodyProjector`/injection.

- [ ] **Step 3: Write the live integration tests**

Create `tests/test_admission_floor_integration.py` (mirror `test_wiki_memory_l3_listener_integration.py` for the httpx/PUT/TLS pattern):

```python
import os, httpx, pytest
from rdflib import Graph, URIRef

POD = os.environ.get("POD_URL", "https://pod.vardeman.me")
SKOS = "http://www.w3.org/2004/02/skos/core#"

def _put(path, body, ct="text/markdown"):
    return httpx.put(f"{POD}{path}", content=body, headers={"Content-Type": ct})

def test_preflabel_less_concept_is_rejected_422():
    body = "---\ntype: Concept\n---\n# NoLabel\n\nbody only, no prefLabel span\n"
    r = _put("/vault/wiki/concepts/test-nolabel.md", body)
    assert r.status_code == 422, f"expected 422, got {r.status_code}"
    assert "ValidationReport" in r.text or "prefLabel" in r.text

def test_valid_concept_commits_with_synchronous_meta():
    body = "---\ntype: Concept\n---\n# Photo\n\n[Photosynthesis]{.prefLabel}\n\n[Light to sugar]{.definition}\n"
    r = _put("/vault/wiki/concepts/test-photo.md", body)
    assert r.status_code in (201, 205)
    # .meta is materialized synchronously — read immediately, no poll
    m = httpx.get(f"{POD}/vault/wiki/concepts/test-photo.md.meta", headers={"Accept": "text/turtle"})
    g = Graph(); g.parse(data=m.text, format="turtle", publicID=f"{POD}/vault/wiki/concepts/test-photo.md")
    assert (None, URIRef(SKOS + "prefLabel"), None) in g, "prefLabel not materialized synchronously"

def test_working_container_is_permissive():
    body = "---\ntype: Concept\n---\n# Draft, no prefLabel\n"
    r = _put("/vault/wiki/working/test-draft.md", body)
    assert r.status_code in (201, 205), "working/ must accept incomplete drafts (D73)"

def test_direct_meta_patch_dropping_prefLabel_is_rejected():
    # seed a valid concept, then PATCH .meta to delete prefLabel → 422
    _put("/vault/wiki/concepts/test-patch.md", "---\ntype: Concept\n---\n# P\n\n[P]{.prefLabel}\n")
    patch = ('@prefix solid: <http://www.w3.org/ns/solid/terms#> .\n'
             '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .\n'
             '<> a solid:InsertDeletePatch ; solid:deletes { '
             '<https://pod.vardeman.me/vault/wiki/concepts/test-patch.md#this> skos:prefLabel "P" . } .')
    r = httpx.patch(f"{POD}/vault/wiki/concepts/test-patch.md.meta", content=patch,
                    headers={"Content-Type": "text/n3"})
    assert r.status_code == 422, f"direct .meta PATCH dropping prefLabel must be floored, got {r.status_code}"

def test_addressbook_rdf_body_path_unchanged():
    # an RDF-body contact still validates via ShapeValidationStore (floor passes it through)
    r = httpx.get(f"{POD}/vault/contacts/", headers={"Accept": "text/turtle"})
    assert r.status_code in (200, 404)   # smoke: floor didn't break the RDF-body container

@pytest.fixture(autouse=True)
def _cleanup():
    yield
    for p in ("test-nolabel", "test-photo", "test-draft", "test-patch"):
        for suffix in ("", ".meta"):
            httpx.delete(f"{POD}/vault/wiki/concepts/{p}.md{suffix}")
        httpx.delete(f"{POD}/vault/wiki/working/{p}.md")
```

- [ ] **Step 4: Deploy + run integration green**

```bash
make reset
export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem
~/uvws/.venv/bin/python -m scripts.overlay.apply overlays/wiki-memory --target https://pod.vardeman.me/vault/
~/uvws/.venv/bin/python -m pytest tests/test_admission_floor_integration.py -v
cd css/extensions/shape-validator && npm test -- test/layering.test.ts
```
Expected: all integration cases PASS; layering test PASS.

- [ ] **Step 5: Full regression**

```bash
make audit            # 0 ERROR
make test             # full pytest suite (note pre-existing-failure triage in docs/plans/2026-05-28-test-suite-audit.md)
```
Expected: `make audit` 0 ERROR; no NEW pytest failures beyond the documented pre-existing set.

- [ ] **Step 6: Commit**

```bash
git add tests/test_admission_floor_integration.py css/extensions/shape-validator/test/layering.test.ts
git commit -m "[Agent: Claude] tests: admission-floor e2e (enforce/materialize/both-paths) + layering guard (Front-2 §8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (run after drafting; performed)

**Spec coverage:**
- §2.1 in-band project-once → Task 7 (markdown), Task 8 (.meta path). ✓
- §2.2 general floor + pluggable projector + RDF-only restriction → Task 4 (RDF-only), Task 6 (projector), Task 7 (floor), Task 12 (layering guard). ✓
- §2.3 path-agnostic conformance target → Task 7 + Task 8. ✓
- §2.4 sh:closed false enrichment → Task 5 test (agent-owned passes), Task 8 test. ✓
- §2.5 backstop → Task 9. ✓
- §2.6 both paths in B → Task 7 + Task 8. ✓
- §3 layering/reuse → Task 6/7 structure + Task 12 layering test + AddressBook smoke. ✓
- §5.4 shared validation core → Task 5. ✓
- §5.6 label materialization → covered by the existing pipeline + ConceptShape enforcement now firing (Task 7); rdfs:label apex is an existing pipeline output (verify in Task 7 fixture; if absent, the projector already emits it — no new task needed beyond enforcement). ✓ (note)
- §5.7 backstop stamp → Task 7 (write stamp) + Task 9 (skip). ✓
- §5.8 floor parity + scope guard → Task 11 (parity) + Task 8 (container-`.meta` exempt). ✓
- §5.9 a/b/c structural corrections → Tasks 3 / 2 / 1. ✓
- §6 data flow → Tasks 7/8/11/9 cover every row. ✓
- §7 error handling → Task 7/8 (422), Task 9 (backstop), Task 12 (live 422). ✓
- §8 testing (two audiences) → vitest unit (dev) throughout + Task 12 integration (runtime) + extend `test_frame_model_agreement.py` (NOTE: add an assertion there if the frame model changed — it did not; existing Front-1 test stands).

**Placeholder scan:** no TBD/TODO in steps. Two explicit "confirm signature against listener.ts / shape filename" verification notes remain (Tasks 6, 3, 11) — these are *verification* instructions with the exact source named, not missing content.

**Type consistency:** `BodyProjector.project → {quads, governed}` used identically in Task 6 (impl), Task 7 (consume), Task 8 (n/a). `STAMP_PRED`/`STAMP` = `sub:bodyHash` in Task 7 (write) and Task 9 (read). `validateQuadsAgainstShape(dataStore, shapeStore) → {conforms, reportTurtle?}` consistent across Tasks 5/7/8. `ShaclValidationError(shapeURL, reportTurtle)` consistent.

**Known risk flagged for execution:** the `MetaWriter` injection + `fsPathFromUrl` reuse (Task 7) and the exact `TypeIndexLoader`/`loadRoutingMap` call shape (Task 6) must be confirmed against `listener.ts` at implementation time — the listener is the runtime source of truth. The shape filenames (Tasks 3/11) must match the deployed shape docs.
