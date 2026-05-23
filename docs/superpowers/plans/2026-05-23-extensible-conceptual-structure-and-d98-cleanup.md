# Extensible Conceptual Structure + D98 Drift Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the wiki-memory L3 conceptual structure self-describing, self-validating, and extensible-by-contract — so agents can add kinds in a controlled, verifiable way — and bring `wiki:Source`, the path-constraint validator, and the half-finished D98 migration into conformance with that model.

**Architecture:** Three commitments. (1) The class hierarchy is *data* in the Pod's dereferenceable `wiki:`/`mem:` vocab graphs, rooted in known vocabularies. (2) Verification reasons over the **subclass closure** of that live structure, so agent-added subclasses are honored automatically — the path-constraint validator expands a resource's declared `rdf:type` values by their superclasses before the literal allow-list check. (3) Extension is a controlled, verifiable, provenance-recorded action gated by a SHACL **meta-shape** (`ClassExtensionShape`) — Experiment 9's "SHACL as agent meta-structure" applied to the shapes themselves, generalizing D100 from containers to classes. `wiki:Source` (citation/literature kind) is retired as a baked-in class and re-introduced *through* this contract as the first worked example.

**Tech Stack:** CSS v8 extension (TypeScript, ESM, Vitest, n3.js), SHACL (pyshacl client-side), Turtle overlays deployed via `scripts.overlay.apply`, Python 3.12 + pytest for shape conformance tests.

**Repair direction (why this is safe):** the decisions log (D98) and the *deployed* Pod already agree — `concepts/` exists, `sources/` is gone. The overlay source is the lone drifted artifact, so every change aligns the overlay *toward* the already-correct deployed state. After redeploy, `make reset` reproduces the D98 Pod exactly.

---

## File Structure

**TypeScript (subclass-aware validation) — `css/extensions/shape-validator/`**
- Create `src/subClassClosure.ts` — pure helpers: `buildSubClassClosure(quads)` → `Map<string,string[]>` (class → all ancestors), `expandSuperClasses(classes, closure)` → string[]. No deps, fully unit-testable (mirrors `pathConstraint.ts`).
- Modify `src/storage/ShapeValidationStore.ts` — load TBox once (lazy), expand `resourceClasses` before `evaluatePathConstraint`.
- Create `test/subClassClosure.test.ts` — Vitest unit tests for both helpers.
- Modify `css/config/shape-validation/resource-store.json` — inject `tboxPaths` parameter.
- Create `overlays/wiki-memory/ontology/as-subclass-axioms.ttl` — the minimal AS2 subclass axioms the validator relies on (`as:Announce/Flag/Offer/Reject/Move/Add/Delete/Undo rdfs:subClassOf as:Activity`), since the upstream AS2 vocab isn't loaded into the validator.

**SHACL meta-shape (extension contract) — `overlays/wiki-memory/shapes/`**
- Create `class-extension.shacl.ttl` — `wiki:ClassExtensionShape`: governs admissibility of a registered content class (rooted / shaped / disjoint / routed / documented).
- Create `tests/integration/test_class_extension_contract.py` — pyshacl conformance tests (a conforming + a malformed extension).

**D98 migration (overlay source) — `overlays/wiki-memory/`**
- Modify `storage-patch.ttl`, `synthesis/index.md`, `synthesis/index.md.meta.ttl`, `containers/wiki/procedures/.meta`, `profiles/procedure.ttl`, `resource.shacl.ttl`, `context-fragment.jsonld`, `capabilities/wiki-vocabulary.ttl`, `ontology/mem.ttl` (example URLs).
- Delete `containers/wiki/sources/.meta`, `profiles/source.ttl`.
- Modify `tests/test_wiki_memory_l3_shapes.py` (the failing test).

**`wiki:Source` re-introduced via contract — `overlays/wiki-memory/`**
- Create `shapes/source.shacl.ttl` — `wiki:SourceShape` targeting a `skos:Concept` subclass `wiki:Source`, `sh:node`-ing `wiki:ConceptShape`, adding `dct:identifier`.
- Modify `ontology/wiki.ttl` (or `capabilities/wiki-vocabulary.ttl`) — declare `wiki:Source rdfs:subClassOf skos:Concept`.
- Register `wiki:Source` → `concepts/` in the Type Index patch.

**Worked example (last) — repo + vault**
- Create `overlays/wiki-memory/examples/realign-2026-05-23.ttl` — today's cleanup as `mem:RealignAction` activities (deployable to `.operations/`).
- Create vault method-note via the `encode` skill (`Agentic Memory Systems/Methods/Stale-Memory Discovery and Realignment.md`).

---

## Phase 1 — Subclass-aware path-constraint validation

### Task 1: Pure subclass-closure helpers

**Files:**
- Create: `css/extensions/shape-validator/src/subClassClosure.ts`
- Test: `css/extensions/shape-validator/test/subClassClosure.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/subClassClosure.test.ts
import { describe, it, expect } from 'vitest';
import { buildSubClassClosure, expandSuperClasses } from '../src/subClassClosure';
import { Parser } from 'n3';

const AXIOMS = `
@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
as:Announce rdfs:subClassOf as:Activity .
mem:CrystallizeAction rdfs:subClassOf mem:Action .
mem:ContradictionDetected rdfs:subClassOf mem:Event .
mem:Event rdfs:subClassOf as:Activity .
`;

describe('subClassClosure', () => {
  it('maps a class to all transitive ancestors', () => {
    const quads = new Parser().parse(AXIOMS);
    const closure = buildSubClassClosure(quads);
    expect(closure.get('https://pod.vardeman.me/vault/ontology/mem#ContradictionDetected'))
      .toEqual(expect.arrayContaining([
        'https://pod.vardeman.me/vault/ontology/mem#Event',
        'https://www.w3.org/ns/activitystreams#Activity',
      ]));
  });

  it('expandSuperClasses includes declared types plus all ancestors', () => {
    const quads = new Parser().parse(AXIOMS);
    const closure = buildSubClassClosure(quads);
    const declared = ['https://www.w3.org/ns/activitystreams#Announce'];
    const expanded = expandSuperClasses(declared, closure);
    expect(expanded).toContain('https://www.w3.org/ns/activitystreams#Announce');
    expect(expanded).toContain('https://www.w3.org/ns/activitystreams#Activity');
  });

  it('returns declared types unchanged when no axioms apply', () => {
    const closure = buildSubClassClosure([]);
    expect(expandSuperClasses(['urn:x'], closure)).toEqual(['urn:x']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd css/extensions/shape-validator && npx vitest run test/subClassClosure.test.ts`
Expected: FAIL — module `../src/subClassClosure` not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/subClassClosure.ts
import type { Quad } from 'rdf-js';

const SUBCLASS = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

/** Build class -> all transitive superclasses from rdfs:subClassOf quads. */
export function buildSubClassClosure(quads: Quad[]): Map<string, string[]> {
  const direct = new Map<string, Set<string>>();
  for (const q of quads) {
    if (q.predicate.value === SUBCLASS) {
      if (!direct.has(q.subject.value)) direct.set(q.subject.value, new Set());
      direct.get(q.subject.value)!.add(q.object.value);
    }
  }
  const closure = new Map<string, string[]>();
  const ancestorsOf = (cls: string, seen: Set<string>): Set<string> => {
    for (const parent of direct.get(cls) ?? []) {
      if (!seen.has(parent)) { seen.add(parent); ancestorsOf(parent, seen); }
    }
    return seen;
  };
  for (const cls of direct.keys()) {
    closure.set(cls, [...ancestorsOf(cls, new Set())]);
  }
  return closure;
}

/** Declared types plus all their ancestors (deduplicated). */
export function expandSuperClasses(classes: string[], closure: Map<string, string[]>): string[] {
  const out = new Set<string>(classes);
  for (const c of classes) for (const a of closure.get(c) ?? []) out.add(a);
  return [...out];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd css/extensions/shape-validator && npx vitest run test/subClassClosure.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add css/extensions/shape-validator/src/subClassClosure.ts css/extensions/shape-validator/test/subClassClosure.test.ts
git commit -m "[Agent: Claude] subclass-closure helpers for type-hierarchy-aware path constraints

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2: AS2 subclass axioms file

**Files:**
- Create: `overlays/wiki-memory/ontology/as-subclass-axioms.ttl`

- [ ] **Step 1: Write the axioms file** (the AS2 subclass relationships the validator relies on; `mem.ttl` already declares the `mem:` ones)

```turtle
@prefix as:   <https://www.w3.org/ns/activitystreams#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Minimal AS2 subclass axioms loaded by the shape-validator so path
# constraints honour the activity-type hierarchy without pulling the full
# AS2 vocabulary. Every announcement/event verb the substrate uses IS-A
# as:Activity. Source: https://www.w3.org/ns/activitystreams#dfn-activity
as:Announce rdfs:subClassOf as:Activity .
as:Flag     rdfs:subClassOf as:Activity .
as:Offer    rdfs:subClassOf as:Activity .
as:Reject   rdfs:subClassOf as:Activity .
as:Move     rdfs:subClassOf as:Activity .
as:Add      rdfs:subClassOf as:Activity .
as:Delete   rdfs:subClassOf as:Activity .
as:Undo     rdfs:subClassOf as:Activity .
```

- [ ] **Step 2: Verify it parses**

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph; print(len(Graph().parse('overlays/wiki-memory/ontology/as-subclass-axioms.ttl', format='turtle')), 'triples')"`
Expected: `8 triples`

- [ ] **Step 3: Commit**

```bash
git add overlays/wiki-memory/ontology/as-subclass-axioms.ttl
git commit -m "[Agent: Claude] AS2 subclass axioms for validator type-hierarchy reasoning

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3: Wire subclass expansion into ShapeValidationStore

**Files:**
- Modify: `css/extensions/shape-validator/src/storage/ShapeValidationStore.ts`
- Modify: `css/config/shape-validation/resource-store.json`

- [ ] **Step 1: Add a failing Vitest covering the store-level expansion**

Create `css/extensions/shape-validator/test/pathConstraintExpansion.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildSubClassClosure, expandSuperClasses } from '../src/subClassClosure';
import { evaluatePathConstraint, PathConstraintConfig } from '../src/pathConstraint';
import { Parser } from 'n3';

// Regression: an as:Announce + mem:CrystallizeAction posted to .operations/
// (allow-list = [as:Activity]) must PASS once types are subclass-expanded.
it('announcement passes .operations/ constraint after subclass expansion', () => {
  const axioms = `
    @prefix as: <https://www.w3.org/ns/activitystreams#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    as:Announce rdfs:subClassOf as:Activity .`;
  const closure = buildSubClassClosure(new Parser().parse(axioms));
  const declared = [
    'https://www.w3.org/ns/activitystreams#Announce',
    'https://pod.vardeman.me/vault/ontology/mem#CrystallizeAction',
  ];
  const expanded = expandSuperClasses(declared, closure);
  const constraints = [new PathConstraintConfig(
    '/vault/wiki/.operations/',
    ['https://www.w3.org/ns/activitystreams#Activity'], [],
  )];
  const result = evaluatePathConstraint('/vault/wiki/.operations/x.ttl', expanded, constraints);
  expect(result.ok).toBe(true);
});
```

- [ ] **Step 2: Run to verify it passes** (this proves the *design*; helpers already exist)

Run: `cd css/extensions/shape-validator && npx vitest run test/pathConstraintExpansion.test.ts`
Expected: PASS.

- [ ] **Step 3: Modify the store to load TBox lazily and expand types**

In `ShapeValidationStore.ts`: add imports and a lazy closure field.

```typescript
// near other imports
import { Parser } from 'n3';
import { readFileSync } from 'fs';
import { buildSubClassClosure, expandSuperClasses } from '../subClassClosure';
```

Add a constructor param `tboxPaths: string[] = []` (after `pathConstraints`) and store it. Add a lazy field:

```typescript
private readonly tboxPaths: string[];
private subClassClosure?: Map<string, string[]>;

private getClosure(): Map<string, string[]> {
  if (!this.subClassClosure) {
    const quads = [];
    for (const p of this.tboxPaths) {
      try { quads.push(...new Parser().parse(readFileSync(p, 'utf8'))); }
      catch (e) { this.logger.warn(`TBox load failed for ${p}: ${String(e)}`); }
    }
    this.subClassClosure = buildSubClassClosure(quads);
  }
  return this.subClassClosure;
}
```

In `checkPathConstraint`, replace the `evaluatePathConstraint(...)` call (line ~210) so the declared classes are expanded first:

```typescript
const expanded = expandSuperClasses(resourceClasses, this.getClosure());
const result = evaluatePathConstraint(resourcePath, expanded, this.pathConstraints);
```

- [ ] **Step 4: Inject `tboxPaths` in Components.js config**

In `css/config/shape-validation/resource-store.json`, add to the `ShapeValidationStore` instance arguments a `tboxPaths` array pointing at the deployed vocab files (container paths inside the running server image):

```json
"tboxPaths": [
  "/data/vault/ontology/mem",
  "/data/vault/ontology/as-subclass-axioms.ttl"
]
```

(Confirm the in-container vocab path during execution by checking how `void-description.json` / other config reference `/data`. If the vocab is served only over HTTP, fall back to bundling the two TTLs under `css/extensions/shape-validator/data/` and pointing `tboxPaths` there.)

- [ ] **Step 5: Build the extension + run the full Vitest suite**

Run: `cd css/extensions/shape-validator && npm run build && npx vitest run`
Expected: all pass (including the new tests).

- [ ] **Step 6: Commit**

```bash
git add css/extensions/shape-validator/src/storage/ShapeValidationStore.ts css/config/shape-validation/resource-store.json css/extensions/shape-validator/test/pathConstraintExpansion.test.ts
git commit -m "[Agent: Claude] validator: subclass-expand rdf:type before path-constraint check

Honors as:Announce ⊑ as:Activity and mem: subclass tree so agent-extended
kinds pass path constraints without config edits. Fixes 422 on .operations/
and .events/ announcement writes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — The extension contract (`ClassExtensionShape` meta-shape)

### Task 4: Author the meta-shape

**Files:**
- Create: `overlays/wiki-memory/shapes/class-extension.shacl.ttl`

- [ ] **Step 1: Write the meta-shape**

```turtle
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .

# ClassExtensionShape — the contract an agent-added content class must satisfy
# to be admissible. Generalizes D100 (L4 extension) from containers to classes:
# the conceptual structure is extensible, but only in a rooted, shaped, routed,
# documented, verifiable way. Validated by pod-audit and at crystallize time.
# Targets any class an agent registers as a wiki content kind (declared via
# rdfs:subClassOf reaching a known L3 root).
wiki:ClassExtensionShape
    a sh:NodeShape ;
    rdfs:label "Class extension contract" ;
    sh:agentInstruction """
To add a new content kind: (1) declare it rdfs:subClassOf an existing class that
reaches skos:Concept, schema:Thing, or wiki:Resource (rooting keeps the graph
navigable); (2) author a SHACL NodeShape with sh:targetClass = your class that
sh:node-s its parent's shape (constraint inheritance); (3) register the class →
container in the Type Index; (4) give it rdfs:label + rdfs:comment; (5) prefer a
parent in a vocabulary the LLM already knows (skos/schema/AS2). Land the proposal
in /vault/wiki/working/ first; it crystallizes after this shape validates and a
higher-trust reviewer approves. The act is recorded as a mem: action with
mem:rationale. See </vault/meta/extending-l3.md>.
""" ;
    # Rooted: at least one rdfs:subClassOf
    sh:property [ sh:path rdfs:subClassOf ; sh:minCount 1 ; sh:nodeKind sh:IRI ;
                  sh:message "An extension class must rdfs:subClassOf an existing class (rooting)." ] ;
    # Documented
    sh:property [ sh:path rdfs:label ; sh:minCount 1 ; sh:datatype xsd:string ] ;
    sh:property [ sh:path rdfs:comment ; sh:minCount 1 ; sh:datatype xsd:string ] .
```

- [ ] **Step 2: Verify it parses**

Run: `~/uvws/.venv/bin/python -c "from pyshacl import validate; from rdflib import Graph; g=Graph().parse('overlays/wiki-memory/shapes/class-extension.shacl.ttl', format='turtle'); print('shapes parse OK', len(g))"`
Expected: prints `shapes parse OK <n>`.

### Task 5: Conformance tests for the contract

**Files:**
- Create: `tests/integration/test_class_extension_contract.py`

- [ ] **Step 1: Write tests (a conforming extension passes; a rootless one fails)**

```python
from pyshacl import validate
from rdflib import Graph

SHAPE = "overlays/wiki-memory/shapes/class-extension.shacl.ttl"

CONFORMING = """
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
wiki:Source a rdfs:Class ; rdfs:subClassOf skos:Concept ;
    rdfs:label "Source" ; rdfs:comment "Citation record / literature note." .
"""

ROOTLESS = """
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
wiki:Bad a rdfs:Class ; rdfs:label "Bad" ; rdfs:comment "no parent" .
"""

def _conforms(data):
    g = Graph().parse(data=data, format="turtle")
    s = Graph().parse(SHAPE, format="turtle")
    # Validate the candidate class node explicitly against ClassExtensionShape.
    from rdflib import URIRef
    s.add((URIRef("https://pod.vardeman.me/vault/ontology/wiki#ClassExtensionShape"),
           URIRef("http://www.w3.org/ns/shacl#targetNode"),
           URIRef("https://pod.vardeman.me/vault/ontology/wiki#" +
                  ("Source" if "Source" in data else "Bad"))))
    conforms, _, _ = validate(data_graph=g, shacl_graph=s, inference="rdfs")
    return conforms

def test_conforming_extension_passes():
    assert _conforms(CONFORMING) is True

def test_rootless_extension_fails():
    assert _conforms(ROOTLESS) is False
```

- [ ] **Step 2: Run** — `~/uvws/.venv/bin/python -m pytest tests/integration/test_class_extension_contract.py -v`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add overlays/wiki-memory/shapes/class-extension.shacl.ttl tests/integration/test_class_extension_contract.py
git commit -m "[Agent: Claude] ClassExtensionShape: verifiable contract for agent-added kinds (generalizes D100 to classes)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Finish the D98 drift cleanup (overlay → deployed truth)

Each task: read the file, apply the precise transformation, verify it parses, commit. The deployed Pod (`concepts/` present, `sources/` absent) is the target state.

### Task 6: storage-patch.ttl seeAlso

**Files:** Modify `overlays/wiki-memory/storage-patch.ttl:17-18`

- [ ] **Step 1:** Replace the `rdfs:seeAlso <../wiki/pages/> , <../wiki/sources/> , ...` list so it lists only D98 containers (`concepts/, people/, places/, events/, organizations/, procedures/, working/`), dropping `pages/` and `sources/`. (FOLLOWUPS notes removing `rdfs:seeAlso` entirely is also acceptable since the Type Index routes; keep it but corrected for discoverability.)
- [ ] **Step 2:** `~/uvws/.venv/bin/python -c "from rdflib import Graph; Graph().parse('overlays/wiki-memory/storage-patch.ttl', format='turtle'); print('OK')"` → `OK`
- [ ] **Step 3:** Commit (`[Agent: Claude] D98 cleanup: storage-description seeAlso → concepts/ container list`).

### Task 7: Delete the sources/ container + source profile; repoint procedures

**Files:** Delete `overlays/wiki-memory/containers/wiki/sources/.meta`, `overlays/wiki-memory/profiles/source.ttl`; Modify `overlays/wiki-memory/containers/wiki/procedures/.meta`, `overlays/wiki-memory/profiles/procedure.ttl`

- [ ] **Step 1:** `git rm overlays/wiki-memory/containers/wiki/sources/.meta overlays/wiki-memory/profiles/source.ttl`
- [ ] **Step 2:** In `containers/wiki/procedures/.meta` and `profiles/procedure.ttl`, repoint `procedure.shacl.ttl` → `howto.shacl.ttl` and `wiki:Procedure`/`wiki:ProcedureShape` → `schema:HowTo`/`wiki:HowToShape` (the D98 procedures container is governed by `howto.shacl.ttl`, targetClass `schema:HowTo`).
- [ ] **Step 3:** Parse-check both modified files → `OK`.
- [ ] **Step 4:** Commit (`[Agent: Claude] D98 cleanup: retire sources/ container + source profile; procedures→howto shape`).

### Task 8: resource.shacl.ttl, context-fragment.jsonld, capabilities/wiki-vocabulary.ttl

**Files:** Modify `overlays/wiki-memory/shapes/resource.shacl.ttl:10`, `overlays/wiki-memory/context-fragment.jsonld:42`, `overlays/wiki-memory/capabilities/wiki-vocabulary.ttl:10`

- [ ] **Step 1:** Remove the baked-in `wiki:Source a rdfs:Class ; rdfs:subClassOf wiki:Resource .` line from `resource.shacl.ttl` (Source returns in Phase 4 via the contract, rooted in `skos:Concept`). Remove the `"Source": "wiki:Source"` mapping from `context-fragment.jsonld`. In `capabilities/wiki-vocabulary.ttl`, update the class-hierarchy comment to the D98 set (drop `wiki:Source`, `wiki:Procedure`; the live kinds are `skos:Concept`, `schema:{Person,Place,Event,Organization,HowTo}`, `wiki:{Page,Resource,WorkingNote,Hub}`).
- [ ] **Step 2:** Parse-check all three → `OK` (JSON-LD: `~/uvws/.venv/bin/python -c "from rdflib import Graph; Graph().parse('overlays/wiki-memory/context-fragment.jsonld', format='json-ld'); print('OK')"`).
- [ ] **Step 3:** Commit (`[Agent: Claude] D98 cleanup: drop baked-in wiki:Source from resource shape/context/vocab`).

### Task 9: synthesis hub page + its .meta

**Files:** Modify `overlays/wiki-memory/synthesis/index.md`, `overlays/wiki-memory/synthesis/index.md.meta.ttl`

- [ ] **Step 1:** Rewrite the container-layout table and shape-catalog table in `index.md` to the D98 layout (`concepts/, people/, places/, events/, organizations/, procedures/, working/`), replacing `pages/`+`sources/` rows with `concepts/` and removing `source.shacl.ttl`/`procedure.shacl.ttl` rows (procedures governed by `howto.shacl.ttl`). In `index.md.meta.ttl`, replace the `rdfs:seeAlso` `sources/`+`pages/` URIs with the D98 container URIs.
- [ ] **Step 2:** Parse-check `index.md.meta.ttl` → `OK`.
- [ ] **Step 3:** Commit (`[Agent: Claude] D98 cleanup: synthesis hub container/shape tables → D98 layout`).

### Task 10: mem.ttl example URLs

**Files:** Modify `overlays/wiki-memory/ontology/mem.ttl` (example blocks using `/vault/wiki/pages/`)

- [ ] **Step 1:** In the `skos:example` blocks, replace `/vault/wiki/pages/` → `/vault/wiki/concepts/` (lines ~78, 96, 102, 136, 149, 167, 168, 190, 210–211, 227–229, 245). These are illustrative examples; the `mem:StalenessDetected` example deliberately keeps the `pages/` 404 reference in its `as:summary` string (it's documenting the stale case) — leave that one.
- [ ] **Step 2:** `~/uvws/.venv/bin/python -c "from rdflib import Graph; print(len(Graph().parse('overlays/wiki-memory/ontology/mem.ttl', format='turtle')), 'triples')"` → parses.
- [ ] **Step 3:** Commit (`[Agent: Claude] D98 cleanup: mem.ttl example URLs pages/→concepts/`).

### Task 11: Fix the broken pytest (code drift #3)

**Files:** Modify `tests/test_wiki_memory_l3_shapes.py`

- [ ] **Step 1:** In `_load_shapes()`, replace `source.shacl.ttl` → `concept.shacl.ttl` and `procedure.shacl.ttl` → `howto.shacl.ttl`. Update `test_procedure_stub_validates` and the `procedure-stub.ttl` fixture to type the node `schema:HowTo` (was `wiki:Procedure`). If the `source`-specific fixtures assert citation requirements no longer in `ConceptShape`, move them to a new `test_source_shape` in Phase 4 (after `source.shacl.ttl` is re-introduced) rather than deleting the assertion.
- [ ] **Step 2:** Run `~/uvws/.venv/bin/python -m pytest tests/test_wiki_memory_l3_shapes.py -v`
Expected: previously-failing `test_procedure_stub_validates` now passes; no FileNotFoundError.
- [ ] **Step 3:** Commit (`[Agent: Claude] D98 cleanup: fix L3 shapes test loader (source→concept, procedure→howto)`).

---

## Phase 4 — Re-introduce `wiki:Source` through the contract (worked example)

### Task 12: Define `wiki:Source` as a contract-conforming extension

**Files:** Create `overlays/wiki-memory/shapes/source.shacl.ttl`; Modify `overlays/wiki-memory/ontology/wiki.ttl` (class declaration); Modify the Type Index registration patch.

- [ ] **Step 1:** Add `wiki:Source rdfs:subClassOf skos:Concept ; rdfs:label "Source" ; rdfs:comment "Citation record / literature note — a concept with an external identifier and citation edges." .` to `ontology/wiki.ttl`.
- [ ] **Step 2:** Author `source.shacl.ttl`:

```turtle
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

wiki:SourceShape
    a sh:NodeShape ;
    sh:targetClass wiki:Source ;
    sh:node wiki:ConceptShape ;          # inherit all Concept constraints
    rdfs:label "SHACL shape for wiki:Source" ;
    sh:agentInstruction "Citation record. Inherits ConceptShape (skos + cito edges). Adds dct:identifier (DOI/arXiv/citekey). wiki:Source is a worked example of the class-extension contract: skos:Concept subclass + shape + Type Index entry." ;
    sh:property [ sh:path dct:identifier ; sh:minCount 1 ; sh:datatype xsd:string ;
                  rdfs:label "External identifier (DOI, arXiv ID, or citekey)" ] .
```

- [ ] **Step 3:** Register `wiki:Source` → `/vault/wiki/concepts/` in the Type Index patch (sources live among concepts now).
- [ ] **Step 4:** Add `test_source_extension_conforms_to_contract` to `tests/integration/test_class_extension_contract.py` validating `wiki:Source` against `ClassExtensionShape` (passes) and a `wiki:Source`-typed node against `SourceShape` requiring `dct:identifier`.
- [ ] **Step 5:** Run the test → passes. Commit (`[Agent: Claude] re-introduce wiki:Source via class-extension contract (skos:Concept subclass + SourceShape)`).

---

## Phase 5 — Redeploy + end-to-end verification

### Task 13: Reproducible rebuild + announcement round-trip

**Files:** none (deploy + verify)

- [ ] **Step 1: Reset the Pod from the corrected overlay**

Run: `export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem && make reset`
Expected: completes; CSS healthy. (Per `docker-patterns.md`, `make reset` is the reproducible fresh-volume rebuild — use this, not `make up`.)

- [ ] **Step 2: Confirm container layout matches D98**

Run a script GET-ing `wiki/concepts/`, `wiki/people/`, `wiki/places/`, `wiki/events/`, `wiki/organizations/`, `wiki/procedures/`, `wiki/working/` (expect 200) and `wiki/sources/`, `wiki/pages/` (expect 404).
Expected: all assertions hold.

- [ ] **Step 3: Announcement write now succeeds (the original bug)**

Run the probe that PUTs `[as:Announce, mem:CrystallizeAction]` to `.operations/`.
Expected: **201/204** (was 422). Then GET `.operations/` and assert the resource appears in `ldp:contains`.

- [ ] **Step 4: Run the previously-failing integration tests**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_announcement_log.py tests/integration/test_mem_operations.py -v`
Expected: the `.operations/` write + listing tests now pass.

- [ ] **Step 5: Commit any config/Makefile adjustments discovered during deploy.**

---

## Phase 6 — The worked example (trace exemplar + vault method-note)

### Task 14: Deploy today's cleanup as a `mem:RealignAction` trace

**Files:** Create `overlays/wiki-memory/examples/realign-2026-05-23.ttl`

- [ ] **Step 1:** Encode each realignment from this sprint as a `mem:RealignAction` activity (the prose cleanup commits + the D98 migration), with `prov:wasGeneratedBy`, `prov:used` (the canonical source — D98 / the deployed Pod / `mem.ttl`), `prov:wasDerivedFrom` (the corrected resource), `mem:stalenessClass`, and `mem:rationale`. Include the `mem:FalsePositive` entry for the 8-vs-11 withdrawal.
- [ ] **Step 2:** Parse-check; then POST to `.operations/` (now that writes work) typed `[as:Announce, mem:RealignAction]`.
Expected: 201, appears in `.operations/` `ldp:contains` — the context-graph seed exists on the live Pod.
- [ ] **Step 3:** Commit the exemplar file.

### Task 15: Vault method-note via the encode skill

**Files:** Create (via `encode`) `~/Obsidian/obsidian/03 - Resources/Agentic Memory Systems/Methods/Stale-Memory Discovery and Realignment.md`

- [ ] **Step 1:** Invoke the `encode` skill. `type: method-note`; `up: [[Agentic Memory Systems MOC]]`; `extends: [[Experiment 9 - SHACL Shapes as Agent Meta-Structure]]`; `related: [[SHACL 1.2 and Next-Generation Curator Agents]]`; `area: [[Research & Scholarship]]`. Body: the staleness taxonomy (table), the two repair directions, the false-positive guard, the provenance requirement, the extension-contract framing, illustrated by today's run; link the repo trace exemplar and `mem:RealignAction`/`ClassExtensionShape`.
- [ ] **Step 2:** Per vault discipline-gates, run `/review-note --draft` on the created note; fix any Error findings.
- [ ] **Step 3:** Update the Methods folder / MOC index; commit in the vault repo.

---

## Self-Review

**Spec coverage:** (1) extensibility-as-data → Tasks 1–3 (validator reasons over vocab subclass closure) + Task 2 (axioms as data). (2) verification over live structure → Task 3. (3) controlled/verifiable extension → Tasks 4–5 (meta-shape + tests), demonstrated in Task 12. `wiki:Source` reframed as extension example → Tasks 8 (remove baked-in) + 12 (re-add via contract). D98 drift → Tasks 6–11. Validator bug → Task 3. Broken test #3 → Task 11. Deploy + verify → Task 13. Worked example (trace + note) → Tasks 14–15.

**Open verification points (resolve during execution, not placeholders):**
- Task 3 Step 4: confirm the in-container vocab path for `tboxPaths` (check how other configs reference `/data`); fallback to bundling the TTLs in the extension is specified.
- Task 11: whether `source` fixtures assert citation requirements — if so they move to Task 12's `SourceShape` test rather than being dropped (specified inline).

**Type consistency:** helper names `buildSubClassClosure` / `expandSuperClasses` used identically in Tasks 1 and 3; `wiki:ClassExtensionShape` / `wiki:SourceShape` / `wiki:ConceptShape` consistent across Tasks 4, 5, 12; `mem:RealignAction` / `mem:stalenessClass` / `mem:rationale` match the `mem.ttl` extension already committed.

---

## Risks / Notes

- **TBox staleness in the validator (extensibility caveat):** the lazy closure caches at first use; an agent crystallizing a new subclass into the vocab won't be honored until reload/restart. Acceptable for v1 (extension is two-stage and infrequent); a future task can invalidate the cache on vocab writes via the MonitoringStore. Note in FOLLOWUPS.
- **`make reset` is the only valid verification of reproducibility** (per `docker-patterns.md`); never verify with `make up` alone.
- This plan deliberately keeps `pathConstraint.ts` a pure literal-match function; all hierarchy reasoning lives in the (separately tested) closure helpers + the store. The auditor (option-B build) should later add a cross-check: every `allowedClasses` IRI is satisfiable by the vocab's subclass tree, and vocab examples conform to the path constraints.
