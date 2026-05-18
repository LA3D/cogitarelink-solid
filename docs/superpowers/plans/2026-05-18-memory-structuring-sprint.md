# Memory Structuring Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the wiki-memory L3 substrate completion in three phases — synthesis layer (Phase A), operations layer (Phase B), notifications layer (Phase C) — per `docs/superpowers/specs/2026-05-18-memory-structuring-sprint-design.md`.

**Architecture:** Direct LDP for memory writes; LDN inbox as side-channel for substrate-emitted analysis events; Solid Notifications fan-out for multi-user. Wiki-memory L3 synthesis dogfooded as a wiki-memory page at `/vault/wiki/`. Three RDF categories in the `mem:` vocabulary (Operation / Event / Announcement). MemTriggerListener CSS extension performs cross-resource analysis via MonitoringStore CDC and emits typed events.

**Tech Stack:** CSS v8 (Node 20+, TypeScript), Components.js DI, MonitoringStore (D17/D65), N3.js (Turtle parsing), pyshacl + rdflib (Python integration tests), `solid-pod` CLI (D29; sibling repo `solid-agent-skills`), Solid Notifications WebhookChannel2023, PROV-O, AS2.

---

## File structure

### New files

```
overlays/wiki-memory/
  ontology/
    mem.ttl                              # The mem: vocabulary (Phase B)
  synthesis/
    index.md                             # Synthesis body markdown (Phase A)
    index.md.meta.ttl                    # Synthesis .meta triples (Phase A)
  affordances/
    crystallize.ttl                      # Phase B
    supersede.ttl                        # Phase B
    merge.ttl                            # Phase B
    demote.ttl                           # Phase B
    archive.ttl                          # Phase B
    link.ttl                             # Phase B
  containers/wiki/
    operations.ttl                       # Manifest for /wiki/.operations/ (Phase C)
    events.ttl                           # Manifest for /wiki/.events/ (Phase C)

css/extensions/
  markdown-render/src/
    JsonLdScriptInjector.ts              # JSON-LD <script> injection (Phase A)
  mem-trigger/                           # New extension (Phase C)
    package.json
    tsconfig.json
    Dockerfile
    src/
      MemTriggerListener.ts              # MonitoringStore CDC subscriber
      EventEmitter.ts                    # POSTs typed events to /wiki/.events/
      detectors/
        UnprocessableWriteDetector.ts    # SHACL-rejection → mem:UnprocessableWrite
        ReflectionDueDetector.ts         # Schedule-based emission
        BoundExceededDetector.ts         # n>12 in ldp:contains
        ContradictionDetector.ts         # Conflicting typed edges (v1: limited)
    tests/
      MemTriggerListener.test.ts
      detectors/UnprocessableWriteDetector.test.ts
      detectors/ReflectionDueDetector.test.ts
      detectors/BoundExceededDetector.test.ts
      detectors/ContradictionDetector.test.ts

css/config/
  mem-trigger.json                       # Components.js wiring (Phase C)

tests/integration/
  test_synthesis_page.py                 # Phase A: blind-agent navigation
  test_jsonld_embedding.py               # Phase A: HTML script tag
  test_mem_operations.py                 # Phase B: all 6 operations E2E
  test_mem_events.py                     # Phase C: each Event class
  test_announcement_log.py               # Phase C: .operations/ log
  test_solid_notifications_fanout.py     # Phase C: subscriber webhook

# Cross-repo (~/dev/git/LA3D/agents/solid-agent-skills/)
skills/
  crystallize/SKILL.md                   # Phase B
  supersede/SKILL.md                     # Phase B
  merge/SKILL.md                         # Phase B
  demote/SKILL.md                        # Phase B
  archive/SKILL.md                       # Phase B
  link/SKILL.md                          # Phase B
  inbox-subscribe/SKILL.md               # Phase C
  inbox-list/SKILL.md                    # Phase C
  inbox-read/SKILL.md                    # Phase C
```

### Modified files

```
overlays/wiki-memory/
  manifest.ttl                           # Phases A/B/C: register new artifacts
  profiles/page.ttl                      # Phase A: strengthened PROF descriptor
                                         # (or replace with wiki-memory-l3.ttl
                                         #  per HR-1 naming review)
  vocabulary/wiki.ttl                    # Phase A: new predicates (profileDocument,
                                         #          bootstrapResource, eventStream)
  vocabulary/wikirole.ttl                # Phase A: 4 new role concepts

css/extensions/markdown-render/
  src/MarkdownRenderHandler.ts           # Phase A: integrate JsonLdScriptInjector

css/config/
  void-description.json                  # Phase A: wiki:profileDocument link
  dev-allow-all.json                     # Phase C: import mem-trigger.json

shapes/wiki-memory-l3/*.ttl              # Phase A: cross-refs back to synthesis
                                         #          (5-6 shape files)

.claude/skills/decision-lookup/decisions.md   # Phase D: D93, D94, K-note

~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md
                                         # Phase D: vault sync as D89, D90,
                                         #          K-note
```

---

## Setup

### Task S.1: Create isolated worktree for the sprint

**Files:** none yet.

- [ ] **Step 1: Verify clean working tree**

Run: `cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid && git status`
Expected: working tree clean on `main`.

- [ ] **Step 2: Invoke `superpowers:using-git-worktrees` to create the worktree**

This is a skill invocation, not a bash command. The skill will create a branch like `sprint/memory-structuring-2026-05-18` and a worktree at a sibling path.

- [ ] **Step 3: Confirm worktree path is writable and pwd is correct**

Run: `pwd && git branch --show-current`
Expected: pwd ends with the worktree name; branch is the new sprint branch.

### Task S.2: Confirm CSS stack is running

**Files:** none.

- [ ] **Step 1: Bring up CSS**

Run: `docker compose up -d`
Expected: container `cogitarelink-solid-css-1` (or similar) is running and healthy.

- [ ] **Step 2: Verify Pod root responds**

Run: `curl -sk -I https://pod.vardeman.me/vault/`
Expected: `HTTP/1.1 200` and a `Link` header containing `rel="http://www.w3.org/ns/solid/terms#storageDescription"`.

- [ ] **Step 3: Verify Python test env is available**

Run: `~/uvws/.venv/bin/python -m pytest tests/ --collect-only -q | tail -5`
Expected: tests collect without import errors.

---

# Phase A — Synthesis layer

## HR-5 checkpoint — Synthesis page prose

Before Task A.1 begins, Chuck reviews and approves a draft of the synthesis body markdown. The page can ship with placeholder prose initially per spec §A.1, but the structure must match the eight required sections.

- [ ] **HR-5: Pause and request Chuck's draft prose (or approval to ship with placeholder).**

If Chuck delivers prose, save to `/tmp/synthesis-draft.md` for Task A.1. If Chuck approves shipping with placeholders, Task A.1 uses the section headings only with a one-sentence `TODO` per section marked `<!-- HR-5 follow-up -->`.

### Task A.1: Author synthesis body markdown

**Files:**
- Create: `overlays/wiki-memory/synthesis/index.md`

- [ ] **Step 1: Create the synthesis page skeleton with the eight required sections per spec §A.1.**

Create `overlays/wiki-memory/synthesis/index.md` with this exact frontmatter and section structure:

```markdown
---
type: wiki:Page
dct:title: "Wiki-Memory L3 — Profile Synthesis"
dct:conformsTo: <https://pod.vardeman.me/vault/meta/profiles/wiki-memory-l3>
wiki:profileDocument: <>
---

# Wiki-Memory L3 — Profile Synthesis

<!-- This page is the primary entry point for agents navigating this Pod's
     wiki-memory. It is itself a wiki-memory page; if you can read it, you
     can read every other page in this substrate. -->

## Overview

[HR-5 prose: what wiki-memory L3 is, its position in the L1/L2/L3 stack,
 its purpose as a memory substrate for agentic applications.]

## Container layout

[HR-5 prose: pages, sources, people, procedures, working — what each holds.]

## Type taxonomy

[HR-5 prose: the 5-shape catalog at /vault/meta/shapes/, class-based
 targeting via Type Index.]

## Conventions

[HR-5 prose: dual-layer linking (body markdown + .meta predicates),
 two-stage commit, predicate-level governance.]

## Affordances available

[HR-5 prose: links into /vault/meta/affordances/ with one-line descriptions.]

## Operations

[HR-5 prose: link into the operation taxonomy, six Operation classes enumerated.]

## Events and announcements

[HR-5 prose: how /vault/wiki/.operations/ and /vault/wiki/.events/ work;
 subscription pattern.]

## Cross-session orientation

[HR-5 prose: how to read the operations log to learn what changed since
 prior session.]

## Pointers

- Storage description: <https://pod.vardeman.me/vault/.well-known/solid>
- Shape catalog: <https://pod.vardeman.me/vault/meta/shapes/>
- Capability catalog: <https://pod.vardeman.me/vault/meta/capabilities/>
- Affordance catalog: <https://pod.vardeman.me/vault/meta/affordances/>
- Type Index: <https://pod.vardeman.me/vault/settings/publicTypeIndex>
- Profile descriptors: <https://pod.vardeman.me/vault/meta/profiles/>
- Operations log: <https://pod.vardeman.me/vault/wiki/.operations/>
- Substrate events: <https://pod.vardeman.me/vault/wiki/.events/>
```

- [ ] **Step 2: Insert HR-5 prose if Chuck delivered it; otherwise leave placeholders.**

If `/tmp/synthesis-draft.md` exists, replace each `[HR-5 prose: ...]` block with the corresponding section from the draft. Otherwise leave placeholders; they'll be filled in a follow-up.

- [ ] **Step 3: Commit.**

```bash
git add overlays/wiki-memory/synthesis/index.md
git commit -m "[Agent: Claude] synthesis: scaffold wiki-memory L3 synthesis page body"
```

### Task A.2: Author synthesis `.meta` triples

**Files:**
- Create: `overlays/wiki-memory/synthesis/index.md.meta.ttl`

- [ ] **Step 1: Write the synthesis page's `.meta` triples.**

Create `overlays/wiki-memory/synthesis/index.md.meta.ttl`:

```turtle
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix rdf:      <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix prof:     <http://www.w3.org/ns/dx/prof/> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .

<>
    a wiki:Page ;
    dct:title "Wiki-Memory L3 — Profile Synthesis" ;
    dct:conformsTo <https://pod.vardeman.me/vault/meta/profiles/wiki-memory-l3> ;
    wiki:profileDocument <> ;
    wiki:bootstrapResource <https://pod.vardeman.me/vault/.well-known/solid> ,
                           <https://pod.vardeman.me/vault/meta/shapes/> ,
                           <https://pod.vardeman.me/vault/meta/affordances/> ,
                           <https://pod.vardeman.me/vault/settings/publicTypeIndex> ;
    dct:hasPart <https://pod.vardeman.me/vault/meta/shapes/> ,
                <https://pod.vardeman.me/vault/meta/affordances/> ,
                <https://pod.vardeman.me/vault/meta/capabilities/> ,
                <https://pod.vardeman.me/vault/meta/profiles/> ,
                <https://pod.vardeman.me/vault/wiki/.operations/> ,
                <https://pod.vardeman.me/vault/wiki/.events/> ,
                <https://pod.vardeman.me/vault/wiki/working/> ,
                <https://pod.vardeman.me/vault/wiki/concepts/> ,
                <https://pod.vardeman.me/vault/wiki/sources/> ,
                <https://pod.vardeman.me/vault/wiki/people/> ,
                <https://pod.vardeman.me/vault/wiki/procedures/> ,
                <https://pod.vardeman.me/vault/wiki/pages/> .
```

- [ ] **Step 2: Validate the Turtle parses.**

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/synthesis/index.md.meta.ttl', format='turtle', publicID='https://pod.vardeman.me/vault/wiki/'); print(f'{len(g)} triples')"`
Expected: prints a positive triple count (≥15) with no parse error.

- [ ] **Step 3: Commit.**

```bash
git add overlays/wiki-memory/synthesis/index.md.meta.ttl
git commit -m "[Agent: Claude] synthesis: .meta triples for wiki-memory L3 synthesis page"
```

### Task A.3: Add new predicates to wiki vocabulary

**Files:**
- Modify: `overlays/wiki-memory/vocabulary/wiki.ttl`

- [ ] **Step 1: Read the current wiki vocabulary.**

Run: `cat overlays/wiki-memory/vocabulary/wiki.ttl`

Note the existing structure (prefixes, existing predicates).

- [ ] **Step 2: Append three new predicates to the file.**

Append to `overlays/wiki-memory/vocabulary/wiki.ttl`:

```turtle

# Added 2026-05-18 — Memory Structuring Sprint Phase A
# See <https://pod.vardeman.me/vault/wiki/> for usage context.

wiki:profileDocument
    a rdf:Property ;
    rdfs:label "profile document" ;
    rdfs:comment "Points at the wiki-memory L3 synthesis page from any resource that wants to declare conformance to this substrate. Subject is any resource; object is the synthesis page URL. Used for U-shape reinforcement: every substrate self-description resource links back to the synthesis." ;
    rdfs:domain rdfs:Resource ;
    rdfs:range wiki:Page .

wiki:bootstrapResource
    a rdf:Property ;
    rdfs:label "bootstrap resource" ;
    rdfs:comment "Points at a resource a blind agent should fetch during cold-start orientation. Subject is the synthesis page; object is a catalog or descriptor needed for bootstrap. Multiple instances expected per synthesis." ;
    rdfs:domain wiki:Page ;
    rdfs:range rdfs:Resource .

wiki:eventStream
    a rdf:Property ;
    rdfs:label "event stream" ;
    rdfs:comment "Points at a substrate's event inbox (typically /wiki/.events/), a sibling concept to ldp:inbox. Distinguishes substrate-emitted analysis events from peer-emitted inbox notifications." ;
    rdfs:domain rdfs:Resource ;
    rdfs:range rdfs:Resource .
```

- [ ] **Step 3: Validate the Turtle parses.**

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/vocabulary/wiki.ttl', format='turtle'); print(f'{len(g)} triples')"`
Expected: prints a positive triple count.

- [ ] **Step 4: Commit.**

```bash
git add overlays/wiki-memory/vocabulary/wiki.ttl
git commit -m "[Agent: Claude] vocab: add wiki:profileDocument, bootstrapResource, eventStream predicates"
```

### Task A.4: Add wikirole concepts for synthesis-layer roles

**Files:**
- Modify: `overlays/wiki-memory/vocabulary/wikirole.ttl`

- [ ] **Step 1: Read the current wikirole scheme.**

Run: `cat overlays/wiki-memory/vocabulary/wikirole.ttl`

- [ ] **Step 2: Add four new concepts (per spec §A.3).**

Append to `overlays/wiki-memory/vocabulary/wikirole.ttl`:

```turtle

# Added 2026-05-18 — Memory Structuring Sprint Phase A
# Synthesis-layer role concepts referenced by /vault/meta/profiles/wiki-memory-l3
# via prof:hasRole. See </vault/wiki/> for full L3 profile.

wikirole:overview
    a skos:Concept , prof:ResourceRole ;
    skos:inScheme wikirole: ;
    skos:prefLabel "Profile overview" ;
    skos:definition "Synthesis page that describes the L3 profile's overall purpose, layout, conventions, and operations. The primary agent entry point." ;
    skos:topConceptOf wikirole: .

wikirole:operation-vocabulary
    a skos:Concept , prof:ResourceRole ;
    skos:inScheme wikirole: ;
    skos:prefLabel "Operation vocabulary" ;
    skos:definition "The mem:* class hierarchy declaring memory operations agents can perform, plus the events the substrate emits and announcements agents can post." ;
    skos:topConceptOf wikirole: .

wikirole:operation-log
    a skos:Concept , prof:ResourceRole ;
    skos:inScheme wikirole: ;
    skos:prefLabel "Operation log" ;
    skos:definition "Append-only LDP container holding agent-emitted memory-operation announcements (mem:Announcement subclasses)." ;
    skos:topConceptOf wikirole: .

wikirole:event-stream
    a skos:Concept , prof:ResourceRole ;
    skos:inScheme wikirole: ;
    skos:prefLabel "Event stream" ;
    skos:definition "Append-only LDP container holding substrate-emitted analysis events (mem:Event subclasses)." ;
    skos:topConceptOf wikirole: .
```

- [ ] **Step 3: Validate Turtle parses.**

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/vocabulary/wikirole.ttl', format='turtle'); print(f'{len(g)} triples')"`
Expected: positive count.

- [ ] **Step 4: Commit.**

```bash
git add overlays/wiki-memory/vocabulary/wikirole.ttl
git commit -m "[Agent: Claude] wikirole: 4 synthesis-layer role concepts"
```

### Task A.5: Strengthen the wiki-memory L3 PROF descriptor

**Files:**
- Modify or replace: `overlays/wiki-memory/profiles/page.ttl` (HR-1: confirm whether this should be renamed to `wiki-memory-l3.ttl`)

- [ ] **HR-1 sub-checkpoint: confirm the L3 profile descriptor's filename.** The existing file is `page.ttl` but the descriptor describes the *profile*, not the page shape. Ask Chuck whether to rename to `wiki-memory-l3.ttl`. Default: rename, since the spec consistently references `/vault/meta/profiles/wiki-memory-l3`.

- [ ] **Step 1: Read the current profile descriptor.**

Run: `cat overlays/wiki-memory/profiles/page.ttl`

- [ ] **Step 2: Rename the file if HR-1 confirmed.**

```bash
git mv overlays/wiki-memory/profiles/page.ttl overlays/wiki-memory/profiles/wiki-memory-l3.ttl
```

- [ ] **Step 3: Add four new `prof:hasResource` blocks per spec §A.3.**

Edit `overlays/wiki-memory/profiles/wiki-memory-l3.ttl`. After the existing `prof:hasResource` blocks, append:

```turtle

    # Added 2026-05-18 — synthesis layer per Memory Structuring Sprint.
    prof:hasResource [
        a prof:ResourceDescriptor ;
        dct:title "Wiki-memory L3 synthesis (overview)" ;
        prof:hasRole wikirole:overview ;
        prof:hasArtifact <https://pod.vardeman.me/vault/wiki/> ;
        dct:format "text/markdown"
    ] ;
    prof:hasResource [
        a prof:ResourceDescriptor ;
        dct:title "Wiki-memory operation vocabulary" ;
        prof:hasRole wikirole:operation-vocabulary ;
        prof:hasArtifact <https://pod.vardeman.me/vault/ontology/mem> ;
        dct:format "text/turtle"
    ] ;
    prof:hasResource [
        a prof:ResourceDescriptor ;
        dct:title "Operation log" ;
        prof:hasRole wikirole:operation-log ;
        prof:hasArtifact <https://pod.vardeman.me/vault/wiki/.operations/>
    ] ;
    prof:hasResource [
        a prof:ResourceDescriptor ;
        dct:title "Substrate event stream" ;
        prof:hasRole wikirole:event-stream ;
        prof:hasArtifact <https://pod.vardeman.me/vault/wiki/.events/>
    ] ;
```

(Place these inside the existing `prof:Profile` subject block before its terminating `.`.)

- [ ] **Step 4: Validate Turtle.**

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/profiles/wiki-memory-l3.ttl', format='turtle'); print(f'{len(g)} triples')"`
Expected: positive count.

- [ ] **Step 5: Commit.**

```bash
git add overlays/wiki-memory/profiles/wiki-memory-l3.ttl
git commit -m "[Agent: Claude] profile: strengthen wiki-memory L3 PROF descriptor with synthesis-layer roles"
```

### Task A.6: Update storage description with `wiki:profileDocument`

**Files:**
- Modify: `css/config/void-description.json`

- [ ] **Step 1: Locate the storage description JSON.**

Run: `grep -n "void:vocabulary\|wiki:" css/config/void-description.json | head -20`

This shows where the substrate-level RDF lives in the JSON Components.js config.

- [ ] **Step 2: Add `wiki:profileDocument` predicate.**

Edit `css/config/void-description.json`. Find the existing block that emits substrate metadata (look for `void:vocabulary` entries — these are emitted at `/vault/.well-known/solid`). Add a new statement that emits:

```turtle
<../> wiki:profileDocument <../wiki/> .
```

In Components.js syntax, this is a new triple template entry. The exact JSON shape depends on which CSS component is emitting (likely `StaticStorageDescriber` or a custom describer). Pattern: copy an existing entry and adjust the predicate IRI to `https://pod.vardeman.me/vault/ontology/wiki#profileDocument` and the object to `<https://pod.vardeman.me/vault/wiki/>`.

- [ ] **Step 3: Restart CSS to reload config.**

```bash
docker compose restart css
sleep 5
```

- [ ] **Step 4: Verify the triple is emitted.**

Run: `curl -sk https://pod.vardeman.me/vault/.well-known/solid -H "Accept: text/turtle" | grep -i "profileDocument"`
Expected: one line containing `wiki:profileDocument` (or its expanded IRI) → `</vault/wiki/>`.

- [ ] **Step 5: Commit.**

```bash
git add css/config/void-description.json
git commit -m "[Agent: Claude] storage-description: add wiki:profileDocument pointer to synthesis page"
```

## JSON-LD `<script>` embedding (Phase A code work)

### Task A.7: Failing test for JsonLdScriptInjector

**Files:**
- Create: `css/extensions/markdown-render/tests/JsonLdScriptInjector.test.ts`

- [ ] **Step 1: Examine the existing markdown-render unit test setup.**

Run: `ls css/extensions/markdown-render/tests/ && cat css/extensions/markdown-render/vitest.config.ts 2>&1 | head -10`

This shows the test framework (vitest) and existing tests.

- [ ] **Step 2: Write the failing test for the new JsonLdScriptInjector module.**

Create `css/extensions/markdown-render/tests/JsonLdScriptInjector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Quad } from 'n3';
import { JsonLdScriptInjector } from '../src/JsonLdScriptInjector';
import { DataFactory } from 'n3';
const { namedNode, literal, quad } = DataFactory;

describe('JsonLdScriptInjector', () => {
    const resourceIri = 'https://pod.example.com/vault/wiki/';
    const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const WIKI_PAGE = 'https://pod.vardeman.me/vault/ontology/wiki#Page';
    const DCT_TITLE = 'http://purl.org/dc/terms/title';

    it('emits a <script type="application/ld+json"> block for a resource with meta triples', () => {
        const triples: Quad[] = [
            quad(namedNode(resourceIri), namedNode(RDF_TYPE), namedNode(WIKI_PAGE)),
            quad(namedNode(resourceIri), namedNode(DCT_TITLE), literal('Test Page'))
        ];
        const injector = new JsonLdScriptInjector();
        const result = injector.buildScriptTag(resourceIri, triples);
        expect(result).toMatch(/^<script type="application\/ld\+json">/);
        expect(result).toContain('"@id": "https://pod.example.com/vault/wiki/"');
        expect(result).toContain('"@type"');
        expect(result).toContain('Test Page');
        expect(result).toMatch(/<\/script>$/);
    });

    it('returns an empty string when there are no triples for the resource', () => {
        const injector = new JsonLdScriptInjector();
        const result = injector.buildScriptTag(resourceIri, []);
        expect(result).toBe('');
    });

    it('filters by subject — only emits triples where subject = resourceIri', () => {
        const otherIri = 'https://pod.example.com/vault/wiki/other.md';
        const triples: Quad[] = [
            quad(namedNode(resourceIri), namedNode(DCT_TITLE), literal('This page')),
            quad(namedNode(otherIri), namedNode(DCT_TITLE), literal('Other page'))
        ];
        const injector = new JsonLdScriptInjector();
        const result = injector.buildScriptTag(resourceIri, triples);
        expect(result).toContain('This page');
        expect(result).not.toContain('Other page');
    });
});
```

- [ ] **Step 3: Run the test to verify it fails.**

Run: `cd css/extensions/markdown-render && npx vitest run tests/JsonLdScriptInjector.test.ts`
Expected: FAIL with "Cannot find module '../src/JsonLdScriptInjector'".

### Task A.8: Implement JsonLdScriptInjector

**Files:**
- Create: `css/extensions/markdown-render/src/JsonLdScriptInjector.ts`

- [ ] **Step 1: Write the minimal implementation.**

Create `css/extensions/markdown-render/src/JsonLdScriptInjector.ts`:

```typescript
import { Quad, Writer, DataFactory } from 'n3';

export class JsonLdScriptInjector {
    public buildScriptTag(resourceIri: string, allTriples: Quad[]): string {
        const subjectTriples = allTriples.filter(
            (q) => q.subject.termType === 'NamedNode' && q.subject.value === resourceIri
        );
        if (subjectTriples.length === 0) {
            return '';
        }

        // Group triples by predicate for a compact JSON-LD shape.
        const byPredicate = new Map<string, string[]>();
        for (const q of subjectTriples) {
            const objValue = q.object.termType === 'Literal' ? q.object.value : q.object.value;
            const list = byPredicate.get(q.predicate.value) ?? [];
            list.push(objValue);
            byPredicate.set(q.predicate.value, list);
        }

        const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
        const jsonld: Record<string, unknown> = {
            '@context': {
                wiki: 'https://pod.vardeman.me/vault/ontology/wiki#',
                dct:  'http://purl.org/dc/terms/',
                prof: 'http://www.w3.org/ns/dx/prof/',
                ldp:  'http://www.w3.org/ns/ldp#',
                rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
            },
            '@id': resourceIri
        };
        for (const [pred, values] of byPredicate.entries()) {
            const key = pred === RDF_TYPE ? '@type' : pred;
            jsonld[key] = values.length === 1 ? values[0] : values;
        }

        const payload = JSON.stringify(jsonld, null, 2);
        return `<script type="application/ld+json">\n${payload}\n</script>`;
    }
}
```

- [ ] **Step 2: Run the test to verify it passes.**

Run: `cd css/extensions/markdown-render && npx vitest run tests/JsonLdScriptInjector.test.ts`
Expected: PASS all 3 tests.

- [ ] **Step 3: Commit.**

```bash
git add css/extensions/markdown-render/src/JsonLdScriptInjector.ts \
        css/extensions/markdown-render/tests/JsonLdScriptInjector.test.ts
git commit -m "[Agent: Claude] markdown-render: JsonLdScriptInjector with unit tests"
```

### Task A.9: Integrate JsonLdScriptInjector into MarkdownRenderHandler

**Files:**
- Modify: `css/extensions/markdown-render/src/MarkdownRenderHandler.ts`

- [ ] **Step 1: Locate the HTML emission point in MarkdownRenderHandler.**

Run: `grep -n "html\|<head\|</body\|render" css/extensions/markdown-render/src/MarkdownRenderHandler.ts | head -20`

Find where the handler produces the final HTML string (likely near a `</body>` closing tag insertion point or where rehype completes).

- [ ] **Step 2: Import JsonLdScriptInjector and inject the script tag before `</head>`.**

Edit `css/extensions/markdown-render/src/MarkdownRenderHandler.ts`. At the top, add:

```typescript
import { JsonLdScriptInjector } from './JsonLdScriptInjector';
```

Add an instance field:

```typescript
private readonly jsonLdInjector = new JsonLdScriptInjector();
```

At the point where the HTML body is finalized (after rehype's render but before returning), fetch the `.meta` Turtle for the resource, parse it with N3, and inject the script tag immediately before the `</head>` tag (or `</body>` as a fallback). Pattern:

```typescript
// Inside the handler's render method, after producing `htmlOutput: string`:
const metaQuads = await this.fetchMetaQuads(resourceIri);  // existing helper or
                                                            // new one as needed
const scriptTag = this.jsonLdInjector.buildScriptTag(resourceIri, metaQuads);
if (scriptTag) {
    htmlOutput = htmlOutput.replace('</head>', `${scriptTag}\n</head>`);
    // Fallback if no </head>:
    if (!htmlOutput.includes(scriptTag)) {
        htmlOutput = htmlOutput.replace('</body>', `${scriptTag}\n</body>`);
    }
}
```

The exact integration depends on the existing handler structure — adapt to its conventions.

- [ ] **Step 3: Run existing markdown-render tests to confirm no regression.**

Run: `cd css/extensions/markdown-render && npx vitest run`
Expected: PASS all previously-passing tests + the 3 new JsonLdScriptInjector tests.

- [ ] **Step 4: Rebuild the extension.**

Run: `cd css/extensions/markdown-render && npx tsc`
Expected: no errors; `dist/` updated.

- [ ] **Step 5: Restart CSS and verify a wiki-memory page returns JSON-LD script tag.**

```bash
docker compose restart css
sleep 5
curl -sk -H "Accept: text/html" https://pod.vardeman.me/vault/wiki/ | grep -A2 "application/ld+json"
```
Expected: a `<script type="application/ld+json">` block with `@id` and `@type` keys visible.

- [ ] **Step 6: Commit.**

```bash
git add css/extensions/markdown-render/src/MarkdownRenderHandler.ts
git commit -m "[Agent: Claude] markdown-render: inject JSON-LD script tag from .meta into rendered HTML"
```

### Task A.10: Add cross-references back to synthesis from existing SHACL shapes

**Files:**
- Modify: `shapes/wiki-memory-l3/*.ttl` (page.ttl, concept.ttl, source.ttl, person.ttl, procedure.ttl, working.ttl)

- [ ] **Step 1: List the shape files.**

Run: `ls shapes/wiki-memory-l3/`

- [ ] **Step 2: For each shape file, append a back-reference to its `sh:agentInstruction`.**

The standard pattern: each shape file has one or more `sh:agentInstruction` properties carrying agent-facing prose. The back-reference appends one sentence at the end of each `sh:agentInstruction` literal.

For each `.ttl` file in `shapes/wiki-memory-l3/`:
1. Read the file: `cat shapes/wiki-memory-l3/<name>.ttl`
2. Identify each `sh:agentInstruction "..."` literal.
3. Append ` See </vault/wiki/> for the full L3 profile and inter-shape conventions.` to each literal's content, preserving Turtle escaping.

Example before:

```turtle
    sh:agentInstruction "When creating a wiki:Concept, populate dct:title, skos:prefLabel, and at least one wiki:extends or skos:broader." ;
```

After:

```turtle
    sh:agentInstruction "When creating a wiki:Concept, populate dct:title, skos:prefLabel, and at least one wiki:extends or skos:broader. See </vault/wiki/> for the full L3 profile and inter-shape conventions." ;
```

- [ ] **Step 3: Validate each modified file parses.**

For each modified file:

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('shapes/wiki-memory-l3/<name>.ttl', format='turtle'); print(f'{len(g)} triples')"`
Expected: positive count.

- [ ] **Step 4: Commit.**

```bash
git add shapes/wiki-memory-l3/
git commit -m "[Agent: Claude] shapes: append synthesis back-references to sh:agentInstruction (U-shape)"
```

### Task A.11: Register synthesis page in the overlay manifest

**Files:**
- Modify: `overlays/wiki-memory/manifest.ttl`

- [ ] **Step 1: Read the manifest to see existing resource declarations.**

Run: `grep -n "installs\|index.md\|page" overlays/wiki-memory/manifest.ttl | head -20`

Identify which manifest predicate is used to install resource content (likely a custom predicate the apply.py script handles).

- [ ] **Step 2: Add a deployment declaration for the synthesis page.**

Add to `overlays/wiki-memory/manifest.ttl`:

```turtle

# Added 2026-05-18 — Memory Structuring Sprint Phase A
# Deploy the wiki-memory L3 synthesis page at /vault/wiki/.
<#wiki-memory-l3-overlay> overlay:installsPage [
    overlay:targetResource <https://pod.vardeman.me/vault/wiki/> ;
    overlay:body <synthesis/index.md> ;
    overlay:meta <synthesis/index.md.meta.ttl> ;
    dct:title "Wiki-memory L3 synthesis (deploy at substrate root)"
] .
```

The exact predicate names may need adjustment based on what `scripts/apply.py` handles (`installsResourceMetaPatch` already exists per the owner-identity sprint). If the manifest predicates for "deploy a page with body + meta to a specific URL" don't yet exist, extend `scripts/apply.py` to handle a new `overlay:installsPage` predicate (see Task A.12).

- [ ] **Step 3: Commit.**

```bash
git add overlays/wiki-memory/manifest.ttl
git commit -m "[Agent: Claude] manifest: declare synthesis-page deployment to /vault/wiki/"
```

### Task A.12: Extend `apply.py` to handle `overlay:installsPage`

**Files:**
- Modify: `scripts/apply.py`

- [ ] **Step 1: Read the existing apply.py to find the analogous handler.**

Run: `grep -n "installs\|targetResource\|installContent" scripts/apply.py | head -20`

Find the handlers for existing predicates like `overlay:installsCapability` or `overlay:installsResourceMetaPatch` to understand the pattern.

- [ ] **Step 2: Add an `installsPage` handler.**

In `scripts/apply.py`, add a new section that, when the manifest declares `overlay:installsPage`, performs:
1. Read the body file content (markdown).
2. Read the meta file content (Turtle).
3. PUT the body to the target resource URL with `Content-Type: text/markdown`.
4. PATCH (or PUT) the `.meta` to the target's `.meta` URL with `Content-Type: text/turtle`.
5. Verify both writes returned 200/201 status.
6. Idempotent: if target already has the same content (compare bytes), skip.

Pattern (sketch):

```python
def apply_installs_page(graph, target_resource, body_path, meta_path, client):
    body_content = Path(body_path).read_text()
    meta_content = Path(meta_path).read_text()
    body_url = str(target_resource)  # e.g. https://.../vault/wiki/
    meta_url = body_url.rstrip('/') + '.meta' if not body_url.endswith('/') else body_url + '.meta'
    # Or: container .meta is at <url>.meta
    r1 = client.put(body_url, content=body_content, headers={'Content-Type': 'text/markdown'})
    r1.raise_for_status()
    r2 = client.put(meta_url, content=meta_content, headers={'Content-Type': 'text/turtle'})
    r2.raise_for_status()
    print(f'  installsPage: {body_url}')
```

The exact integration depends on apply.py's existing structure — adapt to its conventions.

- [ ] **Step 3: Test by re-running apply on the wiki-memory overlay.**

```bash
~/uvws/.venv/bin/python scripts/apply.py overlays/wiki-memory
```
Expected: prints `installsPage: https://pod.vardeman.me/vault/wiki/` (or equivalent), no errors.

- [ ] **Step 4: Verify the synthesis is served at /vault/wiki/.**

```bash
curl -sk -H "Accept: text/markdown" https://pod.vardeman.me/vault/wiki/ | head -5
```
Expected: first line is `---` (frontmatter open) or `# Wiki-Memory L3 — Profile Synthesis`.

- [ ] **Step 5: Commit.**

```bash
git add scripts/apply.py
git commit -m "[Agent: Claude] apply.py: installsPage handler — deploy body+meta to target resource"
```

### Task A.13: Integration test — blind-agent navigates synthesis

**Files:**
- Create: `tests/integration/test_synthesis_page.py`

- [ ] **Step 1: Write the test.**

Create `tests/integration/test_synthesis_page.py`:

```python
"""Phase A — blind-agent navigation integration tests.

Verifies that a fresh client with only HTTP + RDF parsing can reach the
synthesis page from the Pod root, and that the synthesis carries the
bootstrap pointers a blind agent needs.
"""
import httpx
import pytest
from rdflib import Graph, URIRef

POD = "https://pod.vardeman.me/vault/"
WIKI = "https://pod.vardeman.me/vault/wiki/"
WIKI_NS = "https://pod.vardeman.me/vault/ontology/wiki#"


def test_pod_root_advertises_profile_document():
    """A GET on /vault/.well-known/solid should mention wiki:profileDocument."""
    r = httpx.get("https://pod.vardeman.me/vault/.well-known/solid",
                  headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=POD)
    profile_docs = list(g.objects(predicate=URIRef(f"{WIKI_NS}profileDocument")))
    assert len(profile_docs) >= 1
    assert any(URIRef(WIKI) == p for p in profile_docs)


def test_synthesis_page_returns_markdown_body():
    """GET /vault/wiki/ with Accept: text/markdown returns the synthesis body."""
    r = httpx.get(WIKI, headers={"Accept": "text/markdown"}, verify=False)
    assert r.status_code == 200
    assert "Wiki-Memory L3" in r.text
    # The eight required section headings.
    for heading in ["Overview", "Container layout", "Type taxonomy",
                    "Conventions", "Affordances", "Operations",
                    "Events and announcements", "Cross-session orientation"]:
        assert heading in r.text


def test_synthesis_page_returns_turtle_meta():
    """The synthesis page's .meta has bootstrap pointers."""
    r = httpx.get(WIKI, headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=WIKI)
    bootstrap = list(g.objects(predicate=URIRef(f"{WIKI_NS}bootstrapResource")))
    assert len(bootstrap) >= 4  # Per spec: storage-desc, shapes, affordances, type-index


def test_synthesis_page_returns_html_with_jsonld_script():
    """The synthesis page's HTML representation embeds JSON-LD."""
    r = httpx.get(WIKI, headers={"Accept": "text/html"}, verify=False)
    assert r.status_code == 200
    assert '<script type="application/ld+json">' in r.text
    assert "@id" in r.text
    assert WIKI in r.text


def test_all_shape_agent_instructions_reference_synthesis():
    """U-shape: every SHACL shape's sh:agentInstruction back-references the synthesis."""
    SHACL_AI = "http://www.w3.org/ns/shacl#agentInstruction"
    r = httpx.get("https://pod.vardeman.me/vault/meta/shapes/",
                  headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200
    container = Graph().parse(data=r.text, format="turtle",
                              publicID="https://pod.vardeman.me/vault/meta/shapes/")
    LDP_CONTAINS = URIRef("http://www.w3.org/ns/ldp#contains")
    shape_urls = list(container.objects(predicate=LDP_CONTAINS))
    assert len(shape_urls) >= 5
    for shape_url in shape_urls:
        rr = httpx.get(str(shape_url), headers={"Accept": "text/turtle"}, verify=False)
        assert rr.status_code == 200
        sg = Graph().parse(data=rr.text, format="turtle", publicID=str(shape_url))
        instructions = list(sg.objects(predicate=URIRef(SHACL_AI)))
        assert len(instructions) >= 1, f"No sh:agentInstruction on {shape_url}"
        assert any("/vault/wiki/" in str(i) for i in instructions), (
            f"{shape_url} sh:agentInstruction does not reference synthesis"
        )
```

- [ ] **Step 2: Run the test against the live Pod.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_synthesis_page.py -v`
Expected: all 5 tests PASS.

- [ ] **Step 3: Commit.**

```bash
git add tests/integration/test_synthesis_page.py
git commit -m "[Agent: Claude] test: Phase A blind-agent navigation integration tests"
```

### Task A.14: Phase A close-out commit

- [ ] **Step 1: Verify Phase A is complete.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_synthesis_page.py -v`
Expected: all PASS.

Run: `cd css/extensions/markdown-render && npx vitest run`
Expected: all PASS.

- [ ] **Step 2: Tag the Phase A boundary (optional but helpful).**

```bash
git tag -a phase-a-complete -m "Phase A: synthesis layer shipped"
```

Continue to Phase B.

---

# Phase B — Operations layer

## HR-1 checkpoint — Vocabulary class names

Before Task B.1 begins, Chuck reviews and approves the names of all `mem:Operation`, `mem:Event`, and `mem:Announcement` subclasses listed in spec §B.1.

- [ ] **HR-1: Pause and request Chuck's approval of class names.** Default approved set:
  - `mem:Operation`, `mem:CrystallizeOperation`, `mem:SupersedeOperation`, `mem:MergeOperation`, `mem:DemoteOperation`, `mem:ArchiveOperation`, `mem:LinkOperation`
  - `mem:Event`, `mem:BoundExceeded`, `mem:ContradictionDetected`, `mem:ConsolidationSuggested`, `mem:ReflectionDue`, `mem:OODQuerySignal`, `mem:UnprocessableWrite`
  - `mem:Announcement`, `mem:Crystallized`, `mem:Superseded`, `mem:Merged`, `mem:Demoted`, `mem:Archived`, `mem:Linked`

### Task B.1: Author the `mem:` vocabulary

**Files:**
- Create: `overlays/wiki-memory/ontology/mem.ttl`

- [ ] **Step 1: Write the vocabulary file.**

Create `overlays/wiki-memory/ontology/mem.ttl`:

```turtle
@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix as:   <https://www.w3.org/ns/activitystreams#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix dct:  <http://purl.org/dc/terms/> .

# Wiki-memory L3 operation/event/announcement vocabulary.
# See <https://pod.vardeman.me/vault/wiki/> for the full L3 profile and
# usage context.
#
# Three RDF categories:
#   - mem:Operation     — categories of agent action on memory; performed
#                         as direct LDP CRUD sequences; type recorded in
#                         the resulting resource's .meta via prov:wasGeneratedBy
#   - mem:Event         — substrate-emitted analysis signals; subclass of
#                         as:Activity; appear in /wiki/.events/
#   - mem:Announcement  — agent-emitted operation log entries; subclass of
#                         as:Activity; appear in /wiki/.operations/

# ---- Top-level classes ----

mem:Operation
    a owl:Class ;
    rdfs:label "Memory operation" ;
    rdfs:comment "A category of agent action on wiki-memory L3. Performed as a sequence of standard LDP operations; not transmitted as a message. The operation type is recorded in the resulting resource's .meta via prov:wasGeneratedBy. Subclasses enumerate the operations the substrate supports." ;
    rdfs:isDefinedBy <https://pod.vardeman.me/vault/wiki/> .

mem:Event
    a owl:Class ;
    rdfs:subClassOf as:Activity ;
    rdfs:label "Substrate analysis event" ;
    rdfs:comment "An event emitted by the wiki-memory substrate from cross-resource analysis or scheduled inspection. Subclass of as:Activity (these are inbox messages). Arrives in agents' subscriber inboxes via Solid Notifications fan-out." ;
    rdfs:isDefinedBy <https://pod.vardeman.me/vault/wiki/> .

mem:Announcement
    a owl:Class ;
    rdfs:subClassOf as:Activity ;
    rdfs:label "Memory operation announcement" ;
    rdfs:comment "A past-tense activity an agent posts to /vault/wiki/.operations/ after completing a memory operation. Informational; not a command. Operations are agent-performed via LDP CRUD; announcements communicate completion to subscribers." ;
    rdfs:isDefinedBy <https://pod.vardeman.me/vault/wiki/> .

# ---- Operation subclasses ----

mem:CrystallizeOperation
    a owl:Class ;
    rdfs:subClassOf mem:Operation ;
    rdfs:label "Crystallize" ;
    rdfs:comment "Promote a working note from /vault/wiki/working/ to its class-appropriate durable container, per Type Index class→container routing. Validates against the destination class's SHACL shape at PUT time." .

mem:SupersedeOperation
    a owl:Class ;
    rdfs:subClassOf mem:Operation ;
    rdfs:label "Supersede" ;
    rdfs:comment "Replace an existing durable resource with a refined version. Prior version captured by Memento; supersession recorded via prov:wasRevisionOf in the updated resource's .meta." .

mem:MergeOperation
    a owl:Class ;
    rdfs:subClassOf mem:Operation ;
    rdfs:label "Merge" ;
    rdfs:comment "Combine N durable resources into one. The merged resource's .meta carries prov:wasDerivedFrom for each input; inputs are deleted." .

mem:DemoteOperation
    a owl:Class ;
    rdfs:subClassOf mem:Operation ;
    rdfs:label "Demote" ;
    rdfs:comment "Move a durable resource back to working memory for reconsideration. The prior durable version is captured by Memento." .

mem:ArchiveOperation
    a owl:Class ;
    rdfs:subClassOf mem:Operation ;
    rdfs:label "Archive" ;
    rdfs:comment "Soft-delete a durable resource via tombstone (per D64). The resource is retained but marked archived." .

mem:LinkOperation
    a owl:Class ;
    rdfs:subClassOf mem:Operation ;
    rdfs:label "Link" ;
    rdfs:comment "Add a typed cross-reference edge to a resource's .meta. The predicate must be one of the substrate-governed edges (D81)." .

# ---- Event subclasses ----

mem:BoundExceeded
    a owl:Class ;
    rdfs:subClassOf mem:Event ;
    rdfs:label "Bound exceeded" ;
    rdfs:comment "A container's ldp:contains count crossed the substrate's branching bound (default 12, per xMemory Fano analysis). Emitted at most once per container per 24h to avoid flapping." .

mem:ContradictionDetected
    a owl:Class ;
    rdfs:subClassOf mem:Event ;
    rdfs:label "Contradiction detected" ;
    rdfs:comment "Two resources express conflicting typed-edge claims (e.g., A wiki:supports B and A wiki:criticizes B). v1 detection is limited to a hand-picked list of contradicting predicate pairs." .

mem:ConsolidationSuggested
    a owl:Class ;
    rdfs:subClassOf mem:Event ;
    rdfs:label "Consolidation suggested" ;
    rdfs:comment "Multiple resources cluster around a topic without a curated hub page. v1 may be log-only (no automatic emission) pending observation of clustering signals." .

mem:ReflectionDue
    a owl:Class ;
    rdfs:subClassOf mem:Event ;
    rdfs:label "Reflection due" ;
    rdfs:comment "Time-based signal that periodic reflection (lint, contradiction check, hub maintenance) is overdue. Emitted at a configurable interval (default 24h)." .

mem:OODQuerySignal
    a owl:Class ;
    rdfs:subClassOf mem:Event ;
    rdfs:label "Out-of-domain query signal" ;
    rdfs:comment "A wiki-search query returned zero or low-quality results, suggesting the substrate lacks coverage of the user's topic. v1 may be log-only pending observation of query data." .

mem:UnprocessableWrite
    a owl:Class ;
    rdfs:subClassOf mem:Event ;
    rdfs:label "Unprocessable write" ;
    rdfs:comment "A SHACL-validated write was rejected by the substrate. Carries the sh:ValidationReport as as:context. Targeted at the writer's inbox via the COAR-Notify pattern." .

# ---- Announcement subclasses ----

mem:Crystallized
    a owl:Class ;
    rdfs:subClassOf mem:Announcement ;
    rdfs:label "Crystallized" ;
    rdfs:comment "An agent has completed a mem:CrystallizeOperation. Past-tense announcement of the corresponding Operation class." .

mem:Superseded
    a owl:Class ;
    rdfs:subClassOf mem:Announcement ;
    rdfs:label "Superseded" ;
    rdfs:comment "An agent has completed a mem:SupersedeOperation." .

mem:Merged
    a owl:Class ;
    rdfs:subClassOf mem:Announcement ;
    rdfs:label "Merged" ;
    rdfs:comment "An agent has completed a mem:MergeOperation." .

mem:Demoted
    a owl:Class ;
    rdfs:subClassOf mem:Announcement ;
    rdfs:label "Demoted" ;
    rdfs:comment "An agent has completed a mem:DemoteOperation." .

mem:Archived
    a owl:Class ;
    rdfs:subClassOf mem:Announcement ;
    rdfs:label "Archived" ;
    rdfs:comment "An agent has completed a mem:ArchiveOperation." .

mem:Linked
    a owl:Class ;
    rdfs:subClassOf mem:Announcement ;
    rdfs:label "Linked" ;
    rdfs:comment "An agent has completed a mem:LinkOperation." .
```

- [ ] **Step 2: Validate Turtle parses.**

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/ontology/mem.ttl', format='turtle'); print(f'{len(g)} triples')"`
Expected: ≥60 triples; no parse errors.

- [ ] **Step 3: Register the vocabulary in the manifest.**

Edit `overlays/wiki-memory/manifest.ttl`. Add (under the existing `installsVocabulary` declarations if present, or as a sibling):

```turtle
<#wiki-memory-l3-overlay> overlay:installsVocabulary [
    overlay:targetResource <https://pod.vardeman.me/vault/ontology/mem> ;
    overlay:body <ontology/mem.ttl>
] .
```

- [ ] **Step 4: Re-run apply.py.**

```bash
~/uvws/.venv/bin/python scripts/apply.py overlays/wiki-memory
```
Expected: vocabulary installed at `/vault/ontology/mem`.

- [ ] **Step 5: Verify by dereferencing.**

Run: `curl -sk -H "Accept: text/turtle" https://pod.vardeman.me/vault/ontology/mem | grep -c "owl:Class"`
Expected: 19 (3 top-level + 6 Operation + 6 Event + 6 Announcement... actually 3+6+6+6 = 21 classes, but check at least ≥18 owl:Class lines).

- [ ] **Step 6: Commit.**

```bash
git add overlays/wiki-memory/ontology/mem.ttl overlays/wiki-memory/manifest.ttl
git commit -m "[Agent: Claude] mem-vocab: Operation/Event/Announcement taxonomy (HR-1 approved)"
```

## HR-3 + HR-4 checkpoints — Per-operation procedures and affordance prose

Before Tasks B.2–B.7 begin, Chuck reviews and approves:
- HR-3: the LDP procedure for each operation (per spec §B.2)
- HR-4: the `dct:title`, `dct:description`, `wiki:precondition`, `wiki:postcondition`, `wiki:errorMode`, and procedure-step strings for each affordance descriptor

- [ ] **HR-3 + HR-4: Pause and present the spec §B.2 procedures + draft affordance prose for each operation. Get sign-off before proceeding to B.2.**

### Task B.2: Crystallize affordance descriptor

**Files:**
- Create: `overlays/wiki-memory/affordances/crystallize.ttl`

- [ ] **Step 1: Write the affordance descriptor.**

Create `overlays/wiki-memory/affordances/crystallize.ttl`:

```turtle
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix prof:     <http://www.w3.org/ns/dx/prof/> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix mem:      <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .

<>
    a wiki:Affordance , prof:ResourceDescriptor ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    prof:hasRole wikirole:write-affordance ;
    rdfs:label "Crystallize" ;
    wiki:operation mem:CrystallizeOperation ;
    dct:title "Crystallize a working note to durable storage." ;
    dct:description "Promotes a working note from /vault/wiki/working/ to its class-appropriate durable container (per Type Index D78), validating against the destination class's SHACL shape. See </vault/wiki/> for the full L3 profile." ;
    dct:isPartOf </vault/wiki/> ;
    wiki:precondition "Source resource exists at /vault/wiki/working/{slug}.md and conforms to the working SHACL shape; rdf:type declares the destination class." ;
    wiki:postcondition "Resource appears at /vault/wiki/{class-container}/{slug}.md and conforms to that class's SHACL shape; source has been deleted; Memento has captured both events; PROV-O records a mem:CrystallizeOperation in the destination's .meta." ;
    wiki:errorMode "If destination SHACL rejects, 422 returned with sh:ValidationReport body; agent retries with a corrected resource. Source is not deleted on failure." ;
    wiki:procedure (
        "GET /vault/wiki/working/{slug}.md to fetch the source"
        "Determine destination class container via Type Index lookup on the source's rdf:type"
        "PUT /vault/wiki/{class-container}/{slug}.md with the source body + appropriate .meta (including prov:wasGeneratedBy a mem:CrystallizeOperation)"
        "On 201, DELETE /vault/wiki/working/{slug}.md"
        "POST mem:Crystallized announcement to /vault/wiki/.operations/"
    ) .
```

- [ ] **Step 2: Validate Turtle.**

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/affordances/crystallize.ttl', format='turtle', publicID='https://pod.vardeman.me/vault/meta/affordances/crystallize'); print(f'{len(g)} triples')"`
Expected: positive count.

- [ ] **Step 3: Commit.**

```bash
git add overlays/wiki-memory/affordances/crystallize.ttl
git commit -m "[Agent: Claude] affordance: crystallize descriptor (HR-3/4 approved)"
```

### Task B.3: Supersede affordance descriptor

**Files:**
- Create: `overlays/wiki-memory/affordances/supersede.ttl`

- [ ] **Step 1: Write the descriptor (same shape as crystallize, different operation).**

Create `overlays/wiki-memory/affordances/supersede.ttl`:

```turtle
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix prof:     <http://www.w3.org/ns/dx/prof/> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix mem:      <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .

<>
    a wiki:Affordance , prof:ResourceDescriptor ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    prof:hasRole wikirole:write-affordance ;
    rdfs:label "Supersede" ;
    wiki:operation mem:SupersedeOperation ;
    dct:title "Supersede an existing durable resource with a refined version." ;
    dct:description "Replaces a durable resource with a refined version, preserving the prior version as a Memento snapshot and recording the supersession via prov:wasRevisionOf. See </vault/wiki/> for the full L3 profile." ;
    dct:isPartOf </vault/wiki/> ;
    wiki:precondition "Target resource exists at /vault/wiki/{class}/{slug}.md; refined version conforms to the same class's SHACL shape." ;
    wiki:postcondition "Resource at /vault/wiki/{class}/{slug}.md is the refined version; Memento has captured the prior version; PROV-O records a mem:SupersedeOperation and prov:wasRevisionOf <prior-memento-uri>." ;
    wiki:errorMode "If destination SHACL rejects, 422 returned with sh:ValidationReport body; prior version remains intact." ;
    wiki:procedure (
        "GET /vault/wiki/{class}/{slug}.md to read the existing version"
        "Compose the refined version (including prov:wasRevisionOf in .meta pointing at the prior version's Memento URI)"
        "PUT /vault/wiki/{class}/{slug}.md with the refined body and .meta"
        "On 200/204, POST mem:Superseded announcement to /vault/wiki/.operations/"
    ) .
```

- [ ] **Step 2: Validate.**

Run: `~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/affordances/supersede.ttl', format='turtle', publicID='x'); print(f'{len(g)} triples')"`
Expected: positive count.

- [ ] **Step 3: Commit.**

```bash
git add overlays/wiki-memory/affordances/supersede.ttl
git commit -m "[Agent: Claude] affordance: supersede descriptor"
```

### Task B.4: Merge affordance descriptor

**Files:**
- Create: `overlays/wiki-memory/affordances/merge.ttl`

- [ ] **Step 1: Write the descriptor.**

Create `overlays/wiki-memory/affordances/merge.ttl`:

```turtle
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix prof:     <http://www.w3.org/ns/dx/prof/> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix mem:      <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .

<>
    a wiki:Affordance , prof:ResourceDescriptor ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    prof:hasRole wikirole:write-affordance ;
    rdfs:label "Merge" ;
    wiki:operation mem:MergeOperation ;
    dct:title "Combine multiple durable resources into one." ;
    dct:description "Composes N durable resources into a single merged resource, recording all inputs via prov:wasDerivedFrom and deleting the inputs. Used for deduplication and contradiction resolution. See </vault/wiki/>." ;
    dct:isPartOf </vault/wiki/> ;
    wiki:precondition "All N input resources exist and conform to the same class's SHACL shape; agent has write permission on all inputs and on the merged target." ;
    wiki:postcondition "Merged resource exists at /vault/wiki/{class}/{merged-slug}.md, conforms to the class's SHACL shape, and carries prov:wasDerivedFrom <input-1>, <input-2>, ...; inputs have been deleted." ;
    wiki:errorMode "If merged SHACL fails, 422 returned; no inputs deleted. If any input deletion fails after PUT, log and continue (operations log carries the inconsistency for human review)." ;
    wiki:procedure (
        "GET each input resource"
        "Compose the merged body and .meta (with prov:wasDerivedFrom for each input)"
        "PUT /vault/wiki/{class}/{merged-slug}.md"
        "On 201, DELETE each input resource"
        "POST mem:Merged announcement to /vault/wiki/.operations/ listing all inputs and the merged resource"
    ) .
```

- [ ] **Step 2: Validate and commit.**

```bash
~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/affordances/merge.ttl', format='turtle', publicID='x')"
git add overlays/wiki-memory/affordances/merge.ttl
git commit -m "[Agent: Claude] affordance: merge descriptor"
```

### Task B.5: Demote affordance descriptor

**Files:**
- Create: `overlays/wiki-memory/affordances/demote.ttl`

- [ ] **Step 1: Write the descriptor.**

Create `overlays/wiki-memory/affordances/demote.ttl`:

```turtle
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix prof:     <http://www.w3.org/ns/dx/prof/> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix mem:      <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .

<>
    a wiki:Affordance , prof:ResourceDescriptor ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    prof:hasRole wikirole:write-affordance ;
    rdfs:label "Demote" ;
    wiki:operation mem:DemoteOperation ;
    dct:title "Move a durable resource back to working memory for reconsideration." ;
    dct:description "Demotes a durable resource to /vault/wiki/working/ so it can be edited under permissive constraints before re-crystallization. The prior durable version is preserved by Memento. See </vault/wiki/>." ;
    dct:isPartOf </vault/wiki/> ;
    wiki:precondition "Durable resource exists at /vault/wiki/{class}/{slug}.md." ;
    wiki:postcondition "Resource appears at /vault/wiki/working/{slug}.md under the working SHACL shape; the durable URL is gone; Memento has captured the prior durable version; PROV-O records a mem:DemoteOperation and prov:wasDerivedFrom <prior-memento-uri>." ;
    wiki:errorMode "If working-shape PUT fails (shouldn't, given working is permissive), 422 returned; durable copy remains intact." ;
    wiki:procedure (
        "GET /vault/wiki/{class}/{slug}.md"
        "PUT /vault/wiki/working/{slug}.md with body and demoted .meta (including prov:wasGeneratedBy a mem:DemoteOperation)"
        "On 201, DELETE /vault/wiki/{class}/{slug}.md"
        "POST mem:Demoted announcement to /vault/wiki/.operations/"
    ) .
```

- [ ] **Step 2: Validate and commit.**

```bash
~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/affordances/demote.ttl', format='turtle', publicID='x')"
git add overlays/wiki-memory/affordances/demote.ttl
git commit -m "[Agent: Claude] affordance: demote descriptor"
```

### Task B.6: Archive affordance descriptor

**Files:**
- Create: `overlays/wiki-memory/affordances/archive.ttl`

- [ ] **Step 1: Write the descriptor.**

Create `overlays/wiki-memory/affordances/archive.ttl`:

```turtle
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix prof:     <http://www.w3.org/ns/dx/prof/> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix mem:      <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .

<>
    a wiki:Affordance , prof:ResourceDescriptor ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    prof:hasRole wikirole:write-affordance ;
    rdfs:label "Archive" ;
    wiki:operation mem:ArchiveOperation ;
    dct:title "Soft-delete a durable resource via tombstone." ;
    dct:description "Marks a durable resource as archived using the tombstone pattern (D64). The resource is retained at its URL but flagged as no longer active. See </vault/wiki/>." ;
    dct:isPartOf </vault/wiki/> ;
    wiki:precondition "Durable resource exists at /vault/wiki/{class}/{slug}.md and is not already archived." ;
    wiki:postcondition "Resource's .meta carries a tombstone triple (per D64); PROV-O records a mem:ArchiveOperation; the resource itself remains accessible for time-travel." ;
    wiki:errorMode "If PATCH fails, 422 returned; resource state unchanged." ;
    wiki:procedure (
        "PATCH /vault/wiki/{class}/{slug}.md.meta adding a tombstone triple (per D64) and prov:wasGeneratedBy a mem:ArchiveOperation"
        "POST mem:Archived announcement to /vault/wiki/.operations/"
    ) .
```

- [ ] **Step 2: Validate and commit.**

```bash
~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/affordances/archive.ttl', format='turtle', publicID='x')"
git add overlays/wiki-memory/affordances/archive.ttl
git commit -m "[Agent: Claude] affordance: archive descriptor"
```

### Task B.7: Link affordance descriptor

**Files:**
- Create: `overlays/wiki-memory/affordances/link.ttl`

- [ ] **Step 1: Write the descriptor.**

Create `overlays/wiki-memory/affordances/link.ttl`:

```turtle
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix prof:     <http://www.w3.org/ns/dx/prof/> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix mem:      <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .

<>
    a wiki:Affordance , prof:ResourceDescriptor ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    prof:hasRole wikirole:write-affordance ;
    rdfs:label "Link" ;
    wiki:operation mem:LinkOperation ;
    dct:title "Add a typed cross-reference edge between resources." ;
    dct:description "Patches a resource's .meta to add a typed edge (wiki:extends, wiki:supports, cito:cites, etc.) pointing at another resource. Only substrate-governed predicates per D81 are accepted. See </vault/wiki/>." ;
    dct:isPartOf </vault/wiki/> ;
    wiki:precondition "Subject and object resources both exist; the chosen predicate is one of the substrate-governed predicates listed in the relevant SHACL shape's wiki:governs property." ;
    wiki:postcondition "Subject's .meta contains the new triple; PROV-O records the operation." ;
    wiki:errorMode "If the chosen predicate is not substrate-governed for the subject's class, the PATCH validation rejects (422 with sh:ValidationReport); .meta unchanged." ;
    wiki:procedure (
        "PATCH /vault/wiki/{class}/{slug}.md.meta inserting the typed edge triple"
        "POST mem:Linked announcement to /vault/wiki/.operations/"
    ) .
```

- [ ] **Step 2: Validate and commit.**

```bash
~/uvws/.venv/bin/python -c "from rdflib import Graph; g = Graph(); g.parse('overlays/wiki-memory/affordances/link.ttl', format='turtle', publicID='x')"
git add overlays/wiki-memory/affordances/link.ttl
git commit -m "[Agent: Claude] affordance: link descriptor"
```

### Task B.8: Register all six affordances in the manifest

**Files:**
- Modify: `overlays/wiki-memory/manifest.ttl`

- [ ] **Step 1: Find the existing affordance installs.**

Run: `grep -n "installsAffordance\|markdown-projection" overlays/wiki-memory/manifest.ttl`

- [ ] **Step 2: Append six new `installsAffordance` entries.**

For each of crystallize / supersede / merge / demote / archive / link, add:

```turtle
<#wiki-memory-l3-overlay> overlay:installsAffordance [
    overlay:targetResource <https://pod.vardeman.me/vault/meta/affordances/crystallize> ;
    overlay:body <affordances/crystallize.ttl>
] .
```

Repeat for the other five (changing the operation name in target and body).

- [ ] **Step 3: Re-run apply.py.**

```bash
~/uvws/.venv/bin/python scripts/apply.py overlays/wiki-memory
```
Expected: six new affordances installed.

- [ ] **Step 4: Verify by listing the affordance catalog.**

Run: `curl -sk -H "Accept: text/turtle" https://pod.vardeman.me/vault/meta/affordances/ | grep -c "ldp:contains"`
Expected: at least 6 entries (the 6 new + existing ones).

- [ ] **Step 5: Commit.**

```bash
git add overlays/wiki-memory/manifest.ttl
git commit -m "[Agent: Claude] manifest: register 6 mem:* operation affordances"
```

## Operation skills (in `solid-agent-skills` sibling repo)

Tasks B.9–B.14 work in `~/dev/git/LA3D/agents/solid-agent-skills/`. Each creates a SKILL.md and corresponding logic that wraps the LDP procedure.

### Task B.9: Crystallize skill

**Files:**
- Create: `~/dev/git/LA3D/agents/solid-agent-skills/skills/crystallize/SKILL.md`

- [ ] **Step 1: Check the sibling repo's branch state.**

Run: `cd ~/dev/git/LA3D/agents/solid-agent-skills && git status`
Expected: clean main, ready to add new skills.

- [ ] **Step 2: Create the skill directory.**

```bash
mkdir -p ~/dev/git/LA3D/agents/solid-agent-skills/skills/crystallize
```

- [ ] **Step 3: Write SKILL.md.**

Create `~/dev/git/LA3D/agents/solid-agent-skills/skills/crystallize/SKILL.md`:

```markdown
---
name: crystallize
description: Promote a working note to durable storage via the wiki-memory L3 substrate. Use when the user says "crystallize this", "promote this to durable", "move this from working to concepts", or when a working note is mature enough to commit. Performs the LDP sequence: GET source → PUT destination → DELETE source → POST announcement. Failure modes documented inline.
---

# Crystallize a working note

Implements `mem:CrystallizeOperation` from the wiki-memory L3 operation vocabulary at <https://pod.vardeman.me/vault/ontology/mem#CrystallizeOperation>.

## Pre-flight

1. TLS dev cert: ensure `NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem` is set. See `solid-tls-deployment` skill if you hit cert errors.
2. The source resource must be a working note at `/vault/wiki/working/{slug}.md`.

## Procedure

1. `solid-pod read <working-url>` — fetch the source body + .meta.
2. Extract the `rdf:type` from the .meta. Look up the destination container via the Type Index at `<pod>/vault/settings/publicTypeIndex` (`solid-pod read <typeindex>` and grep for the class).
3. Compose the destination body (markdown) and `.meta` (Turtle), making sure `.meta` contains:
   - `prov:wasGeneratedBy [ a mem:CrystallizeOperation ; prov:wasAssociatedWith <agent-webid> ; prov:atTime "..." ]`
   - `prov:wasDerivedFrom <working-url>`
4. `solid-pod create <destination-url>` with the body. Pass `--meta` for the meta file. On HTTP 422 with `sh:ValidationReport`, surface the report to the user and stop (do NOT delete the source).
5. On 201, `solid-pod delete <working-url>` to remove the source.
6. POST a `mem:Crystallized` announcement to `/vault/wiki/.operations/`:

   ```turtle
   @prefix as:   <https://www.w3.org/ns/activitystreams#> .
   @prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
   @prefix prov: <http://www.w3.org/ns/prov#> .

   <urn:uuid:{generated-uuid}>
       a as:Activity, mem:Crystallized ;
       as:actor <{agent-webid}> ;
       prov:wasAssociatedWith <urn:agent:claude-code> ;
       as:object <{destination-url}> ;
       as:target <{pod}/vault/wiki/.operations/> ;
       as:published "{iso-timestamp}"^^xsd:dateTime ;
       prov:wasDerivedFrom <{source-url}> .
   ```

   Use `solid-pod create <pod>/vault/wiki/.operations/{timestamp}-{uuid}.ttl` to POST it.

## Failure handling

- **SHACL rejection on destination PUT**: report the `sh:ValidationReport` to the user; suggest specific fixes. Source is NOT deleted.
- **Source DELETE fails after destination PUT succeeds**: report to user. The substrate now has both copies; user may want to retry the delete or manually clean up. The crystallize announcement should still be emitted because the destination is durable.
- **Announcement POST fails**: log; do not retry indefinitely. The substrate state is correct (destination durable, source gone); the log is just missing the announcement entry.

## Related skills

- `supersede` — replace an existing durable resource (instead of promoting a working one)
- `demote` — move a durable resource back to working

## References

- Affordance descriptor: <https://pod.vardeman.me/vault/meta/affordances/crystallize>
- Operation class: <https://pod.vardeman.me/vault/ontology/mem#CrystallizeOperation>
- L3 profile: <https://pod.vardeman.me/vault/wiki/>
```

- [ ] **Step 4: Commit in the sibling repo.**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
git add skills/crystallize/SKILL.md
git commit -m "[Agent: Claude] skill: crystallize — mem:CrystallizeOperation"
```

### Task B.10: Supersede skill

**Files:**
- Create: `~/dev/git/LA3D/agents/solid-agent-skills/skills/supersede/SKILL.md`

- [ ] **Step 1: Write SKILL.md.**

Create `~/dev/git/LA3D/agents/solid-agent-skills/skills/supersede/SKILL.md` following the same structure as crystallize, adapted for supersession:

```markdown
---
name: supersede
description: Replace an existing durable wiki-memory resource with a refined version, preserving the prior version via Memento. Use when the user says "supersede X", "replace X with this", or when a durable concept needs a refined statement. The substrate captures the prior version automatically.
---

# Supersede a durable resource

Implements `mem:SupersedeOperation`.

## Procedure

1. `solid-pod read <target-url>` — read the existing version.
2. Compose the refined body and `.meta`, including:
   - `prov:wasGeneratedBy [ a mem:SupersedeOperation ; ... ]`
   - `prov:wasRevisionOf <prior-memento-uri>` — to get the Memento URI, check the response Link headers from step 1 for `rel="memento"` or `rel="timegate"`, OR query the timemap.
3. `solid-pod update <target-url>` (PUT) with the refined body + meta. SHACL validates against the destination class shape.
4. POST `mem:Superseded` announcement to `/vault/wiki/.operations/`.

## Failure handling

- SHACL rejection: report, do nothing. Prior version intact.
- Memento URI lookup fails: proceed without `prov:wasRevisionOf`; record a `mem:UnprocessableWrite` event manually if substrate doesn't (this is the failure mode the substrate detector catches in Phase C).

## References

- Affordance: <https://pod.vardeman.me/vault/meta/affordances/supersede>
- Operation: <https://pod.vardeman.me/vault/ontology/mem#SupersedeOperation>
```

- [ ] **Step 2: Commit.**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
git add skills/supersede/SKILL.md
git commit -m "[Agent: Claude] skill: supersede — mem:SupersedeOperation"
```

### Task B.11: Merge skill

**Files:**
- Create: `~/dev/git/LA3D/agents/solid-agent-skills/skills/merge/SKILL.md`

- [ ] **Step 1: Write SKILL.md.**

Create `~/dev/git/LA3D/agents/solid-agent-skills/skills/merge/SKILL.md`:

```markdown
---
name: merge
description: Combine multiple wiki-memory resources into one. Use when the user says "merge X and Y", "combine these duplicates", or when multiple durable resources should become a single canonical entry. Preserves provenance via prov:wasDerivedFrom for each input.
---

# Merge N durable resources into one

Implements `mem:MergeOperation`.

## Procedure

1. For each input URL: `solid-pod read <input-url>` to fetch.
2. Compose the merged body (markdown) and `.meta`, including:
   - `prov:wasGeneratedBy [ a mem:MergeOperation ; ... ]`
   - `prov:wasDerivedFrom <input-1>, <input-2>, ...` for each input
   - Class-appropriate shape conformance (all inputs MUST be the same class; the merged resource preserves the class)
3. Choose the merged target URL. Conventions: if one input has the canonical name, use it; otherwise compose a slug from the merged content's title.
4. `solid-pod create <merged-url>` with body + meta.
5. On 201, for each input: `solid-pod delete <input-url>`.
6. POST `mem:Merged` announcement listing all inputs and the merged URL.

## Failure handling

- SHACL rejection on merged PUT: stop. No inputs deleted.
- Delete fails after PUT: continue with other deletes; record any failures in the announcement so a human can clean up.

## References

- Affordance: <https://pod.vardeman.me/vault/meta/affordances/merge>
- Operation: <https://pod.vardeman.me/vault/ontology/mem#MergeOperation>
```

- [ ] **Step 2: Commit.**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
git add skills/merge/SKILL.md
git commit -m "[Agent: Claude] skill: merge — mem:MergeOperation"
```

### Task B.12: Demote skill

**Files:**
- Create: `~/dev/git/LA3D/agents/solid-agent-skills/skills/demote/SKILL.md`

- [ ] **Step 1: Write SKILL.md following same template.**

Create `~/dev/git/LA3D/agents/solid-agent-skills/skills/demote/SKILL.md`:

```markdown
---
name: demote
description: Move a durable wiki-memory resource back to working memory for reconsideration. Use when the user says "demote X", "move X back to working", or when a durable concept needs significant rework. The durable version is preserved via Memento.
---

# Demote a durable resource to working memory

Implements `mem:DemoteOperation`.

## Procedure

1. `solid-pod read <durable-url>` — read the current durable version.
2. Compose body (same markdown) and demoted `.meta`:
   - Update `rdf:type` if needed (or keep same; working shape is permissive)
   - `prov:wasGeneratedBy [ a mem:DemoteOperation ; ... ]`
   - `prov:wasDerivedFrom <prior-memento-uri>` (look up Memento URI from response Link headers)
3. `solid-pod create <pod>/vault/wiki/working/{slug}.md` with body + meta.
4. On 201, `solid-pod delete <durable-url>`.
5. POST `mem:Demoted` announcement to `/vault/wiki/.operations/`.

## References

- Affordance: <https://pod.vardeman.me/vault/meta/affordances/demote>
- Operation: <https://pod.vardeman.me/vault/ontology/mem#DemoteOperation>
```

- [ ] **Step 2: Commit.**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
git add skills/demote/SKILL.md
git commit -m "[Agent: Claude] skill: demote — mem:DemoteOperation"
```

### Task B.13: Archive skill

**Files:**
- Create: `~/dev/git/LA3D/agents/solid-agent-skills/skills/archive/SKILL.md`

- [ ] **Step 1: Write SKILL.md.**

Create `~/dev/git/LA3D/agents/solid-agent-skills/skills/archive/SKILL.md`:

```markdown
---
name: archive
description: Soft-delete a durable wiki-memory resource via the tombstone pattern (D64). Use when the user says "archive X", "soft-delete X", or when a resource should be marked inactive but kept for history.
---

# Archive a durable resource via tombstone

Implements `mem:ArchiveOperation`.

## Procedure

1. `solid-pod patch <target-url>.meta` with an N3 Patch inserting:

   ```turtle
   <{target-url}>
       a <https://www.w3.org/ns/activitystreams#Tombstone> ;
       prov:wasGeneratedBy [ a mem:ArchiveOperation ;
                              prov:wasAssociatedWith <{agent-webid}> ;
                              prov:atTime "{iso-timestamp}"^^xsd:dateTime ] .
   ```

2. POST `mem:Archived` announcement.

## References

- Affordance: <https://pod.vardeman.me/vault/meta/affordances/archive>
- Operation: <https://pod.vardeman.me/vault/ontology/mem#ArchiveOperation>
- Tombstone semantics: D64.
```

- [ ] **Step 2: Commit.**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
git add skills/archive/SKILL.md
git commit -m "[Agent: Claude] skill: archive — mem:ArchiveOperation (D64 tombstone)"
```

### Task B.14: Link skill

**Files:**
- Create: `~/dev/git/LA3D/agents/solid-agent-skills/skills/link/SKILL.md`

- [ ] **Step 1: Write SKILL.md.**

Create `~/dev/git/LA3D/agents/solid-agent-skills/skills/link/SKILL.md`:

```markdown
---
name: link
description: Add a typed cross-reference edge between two wiki-memory resources by PATCHing the subject's .meta. Use when the user says "link X to Y", "X extends Y", "X supports Y", etc. Only substrate-governed predicates (per the relevant shape's wiki:governs list) are accepted.
---

# Add a typed edge to a resource's .meta

Implements `mem:LinkOperation`.

## Procedure

1. `solid-pod read <subject-url>.meta` to see the current edges and the shape's `wiki:governs` list.
2. Confirm the chosen predicate is in `wiki:governs` for the subject's class. If not, fail with a clear error (substrate will reject).
3. `solid-pod patch <subject-url>.meta` with an N3 Patch inserting the new triple.
4. POST `mem:Linked` announcement.

## References

- Affordance: <https://pod.vardeman.me/vault/meta/affordances/link>
- Operation: <https://pod.vardeman.me/vault/ontology/mem#LinkOperation>
- Predicate-level governance: D81.
```

- [ ] **Step 2: Commit.**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
git add skills/link/SKILL.md
git commit -m "[Agent: Claude] skill: link — mem:LinkOperation"
```

### Task B.15: Integration test — crystallize end-to-end

**Files:**
- Create: `tests/integration/test_mem_operations.py`

- [ ] **Step 1: Write the test (back in the cogitarelink-solid repo).**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
```

Create `tests/integration/test_mem_operations.py`:

```python
"""Phase B — mem:* operation end-to-end tests."""
import time
import uuid
import httpx
import pytest
from rdflib import Graph, URIRef, Namespace
from rdflib.namespace import RDF

POD = "https://pod.vardeman.me/vault/"
WORKING = f"{POD}wiki/working/"
CONCEPTS = f"{POD}wiki/concepts/"
OPS = f"{POD}wiki/.operations/"
MEM = Namespace("https://pod.vardeman.me/vault/ontology/mem#")
WIKI = Namespace("https://pod.vardeman.me/vault/ontology/wiki#")


@pytest.fixture
def test_slug():
    return f"test-{uuid.uuid4().hex[:8]}"


def test_crystallize_e2e(test_slug):
    """Crystallize moves a working note to durable, leaves PROV-O, fires announcement."""
    working_url = f"{WORKING}{test_slug}.md"
    durable_url = f"{CONCEPTS}{test_slug}.md"

    # 1. PUT working note
    body = f"# {test_slug}\n\nA concept under construction."
    meta = f"""@prefix wiki: <{WIKI}> .
@prefix dct:  <http://purl.org/dc/terms/> .
<{working_url}> a wiki:Concept ;
    dct:title "{test_slug}" .
"""
    r = httpx.put(working_url, content=body,
                  headers={"Content-Type": "text/markdown"}, verify=False)
    assert r.status_code in (201, 204)
    r = httpx.put(f"{working_url}.meta", content=meta,
                  headers={"Content-Type": "text/turtle"}, verify=False)
    assert r.status_code in (201, 204)

    # 2. Crystallize: PUT to concepts, then DELETE working
    durable_meta = f"""@prefix wiki: <{WIKI}> .
@prefix mem:  <{MEM}> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix dct:  <http://purl.org/dc/terms/> .
<{durable_url}> a wiki:Concept ;
    dct:title "{test_slug}" ;
    prov:wasGeneratedBy [ a mem:CrystallizeOperation ;
                          prov:atTime "{time.strftime('%Y-%m-%dT%H:%M:%SZ')}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ] ;
    prov:wasDerivedFrom <{working_url}> .
"""
    r = httpx.put(durable_url, content=body,
                  headers={"Content-Type": "text/markdown"}, verify=False)
    assert r.status_code in (201, 204)
    r = httpx.put(f"{durable_url}.meta", content=durable_meta,
                  headers={"Content-Type": "text/turtle"}, verify=False)
    assert r.status_code in (201, 204)
    r = httpx.delete(working_url, verify=False)
    assert r.status_code in (200, 204)

    # 3. Verify durable .meta has the PROV-O Operation type
    r = httpx.get(f"{durable_url}.meta",
                  headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=durable_url)
    # Find prov:wasGeneratedBy → an activity of type mem:CrystallizeOperation
    PROV = Namespace("http://www.w3.org/ns/prov#")
    activities = list(g.objects(URIRef(durable_url), PROV.wasGeneratedBy))
    assert len(activities) >= 1
    types = [t for a in activities for t in g.objects(a, RDF.type)]
    assert MEM.CrystallizeOperation in types

    # 4. Cleanup
    httpx.delete(durable_url, verify=False)
    httpx.delete(f"{durable_url}.meta", verify=False)
```

(Tests for the other operations follow the same structure; defer to Task B.16 to keep this task bite-sized.)

- [ ] **Step 2: Run the test.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_operations.py::test_crystallize_e2e -v`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add tests/integration/test_mem_operations.py
git commit -m "[Agent: Claude] test: Phase B crystallize end-to-end"
```

### Task B.16: Integration tests for remaining operations

**Files:**
- Modify: `tests/integration/test_mem_operations.py`

- [ ] **Step 1: Add tests for Supersede, Merge, Demote, Archive, Link.**

Each follows the same pattern as `test_crystallize_e2e`:
1. Set up the precondition (existing resource(s) in the right container)
2. Perform the LDP operations of the procedure
3. Verify the postcondition (PROV-O, container membership, tombstone, etc.)
4. Cleanup

Append five new test functions to `tests/integration/test_mem_operations.py`. Each function follows the same setup/perform/verify/cleanup structure. Reuse the `test_slug` fixture.

For Supersede: create a durable resource → PUT a refined version → verify Memento has the prior + .meta has `prov:wasRevisionOf` + the activity type is `SupersedeOperation`.

For Merge: create 2 durable resources → PUT merged + DELETE inputs → verify merged exists with `prov:wasDerivedFrom` listing both, inputs are gone.

For Demote: create a durable resource → PUT to /working/ + DELETE from /concepts/ → verify .meta has `DemoteOperation`.

For Archive: create a durable resource → PATCH .meta with tombstone → verify tombstone triple + Operation type.

For Link: create two durable resources → PATCH subject's .meta to add `wiki:extends` → verify the triple exists.

- [ ] **Step 2: Run all operation tests.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_operations.py -v`
Expected: all PASS.

- [ ] **Step 3: Commit.**

```bash
git add tests/integration/test_mem_operations.py
git commit -m "[Agent: Claude] test: Phase B remaining 5 operations end-to-end"
```

### Task B.17: Phase B close-out

- [ ] **Step 1: Verify all Phase B tests pass.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_operations.py tests/integration/test_synthesis_page.py -v`
Expected: all PASS.

- [ ] **Step 2: Tag Phase B boundary.**

```bash
git tag -a phase-b-complete -m "Phase B: mem:* operations layer shipped"
```

Continue to Phase C.

---

# Phase C — Notifications layer

## Tasks for the two append-only containers

### Task C.1: Create `.operations/` container manifest

**Files:**
- Create: `overlays/wiki-memory/containers/wiki/operations.ttl`

- [ ] **Step 1: Examine the existing container declarations.**

Run: `ls overlays/wiki-memory/containers/wiki/`
Run: `cat overlays/wiki-memory/containers/wiki/*.ttl | head -30`

(or whichever existing wiki sub-container manifests exist — concepts.ttl, etc.)

- [ ] **Step 2: Write the operations container manifest.**

Create `overlays/wiki-memory/containers/wiki/operations.ttl`:

```turtle
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix ldp:      <http://www.w3.org/ns/ldp#> .
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix mem:      <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .

<>
    a ldp:BasicContainer ;
    dct:title "Wiki-memory operation log" ;
    dct:description "Append-only log of agent-emitted memory operation announcements (mem:Announcement subclasses). Subscribe via Solid Notifications for fan-out. Read this log on cold-start to learn what's happened in the wiki-memory across sessions. See </vault/wiki/>." ;
    dct:isPartOf <https://pod.vardeman.me/vault/wiki/> ;
    ldp:inbox <> ;
    wiki:profileDocument <https://pod.vardeman.me/vault/wiki/> .
```

- [ ] **Step 3: Register in manifest.**

Add to `overlays/wiki-memory/manifest.ttl`:

```turtle
<#wiki-memory-l3-overlay> overlay:installsContainer [
    overlay:targetResource <https://pod.vardeman.me/vault/wiki/.operations/> ;
    overlay:meta <containers/wiki/operations.ttl>
] .
```

- [ ] **Step 4: Apply and verify.**

```bash
~/uvws/.venv/bin/python scripts/apply.py overlays/wiki-memory
curl -sk -I https://pod.vardeman.me/vault/wiki/.operations/
```
Expected: 200 OK; Link header advertises `rel="http://www.w3.org/ns/ldp#inbox"`.

- [ ] **Step 5: Commit.**

```bash
git add overlays/wiki-memory/containers/wiki/operations.ttl \
        overlays/wiki-memory/manifest.ttl
git commit -m "[Agent: Claude] container: /vault/wiki/.operations/ — agent announcement log"
```

### Task C.2: Create `.events/` container manifest

**Files:**
- Create: `overlays/wiki-memory/containers/wiki/events.ttl`

- [ ] **Step 1: Write the events container manifest.**

Create `overlays/wiki-memory/containers/wiki/events.ttl`:

```turtle
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix ldp:      <http://www.w3.org/ns/ldp#> .
@prefix wiki:     <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix mem:      <https://pod.vardeman.me/vault/ontology/mem#> .

<>
    a ldp:BasicContainer ;
    dct:title "Wiki-memory substrate event stream" ;
    dct:description "Append-only stream of substrate-emitted analysis events (mem:Event subclasses). Subscribe via Solid Notifications to receive: BoundExceeded, ContradictionDetected, ReflectionDue, UnprocessableWrite, ConsolidationSuggested, OODQuerySignal. See </vault/wiki/>." ;
    dct:isPartOf <https://pod.vardeman.me/vault/wiki/> ;
    wiki:eventStream <> ;
    wiki:profileDocument <https://pod.vardeman.me/vault/wiki/> .
```

- [ ] **Step 2: Register in manifest.**

Add to `overlays/wiki-memory/manifest.ttl`:

```turtle
<#wiki-memory-l3-overlay> overlay:installsContainer [
    overlay:targetResource <https://pod.vardeman.me/vault/wiki/.events/> ;
    overlay:meta <containers/wiki/events.ttl>
] .
```

- [ ] **Step 3: Apply and verify.**

```bash
~/uvws/.venv/bin/python scripts/apply.py overlays/wiki-memory
curl -sk -I https://pod.vardeman.me/vault/wiki/.events/
```
Expected: 200 OK.

- [ ] **Step 4: Commit.**

```bash
git add overlays/wiki-memory/containers/wiki/events.ttl \
        overlays/wiki-memory/manifest.ttl
git commit -m "[Agent: Claude] container: /vault/wiki/.events/ — substrate event stream"
```

### Task C.3: Advertise `ldp:inbox` and `wiki:eventStream` on `/vault/wiki/`

**Files:**
- Modify: `overlays/wiki-memory/synthesis/index.md.meta.ttl`

- [ ] **Step 1: Append the two predicates.**

Edit `overlays/wiki-memory/synthesis/index.md.meta.ttl`. Inside the `<>` block, add:

```turtle
    ldp:inbox <https://pod.vardeman.me/vault/wiki/.operations/> ;
    wiki:eventStream <https://pod.vardeman.me/vault/wiki/.events/> ;
```

Include `@prefix ldp: <http://www.w3.org/ns/ldp#> .` in the file if not already present.

- [ ] **Step 2: Re-apply and verify the headers/triples surface.**

```bash
~/uvws/.venv/bin/python scripts/apply.py overlays/wiki-memory
curl -sk -I https://pod.vardeman.me/vault/wiki/ | grep -i "link"
```
Expected: Link header includes `rel="http://www.w3.org/ns/ldp#inbox"` pointing at `/vault/wiki/.operations/`.

- [ ] **Step 3: Commit.**

```bash
git add overlays/wiki-memory/synthesis/index.md.meta.ttl
git commit -m "[Agent: Claude] synthesis: advertise ldp:inbox + wiki:eventStream"
```

## HR-2 + HR-6 checkpoints — Subscription flow and event detector algorithms

Before Tasks C.4–C.11 begin, Chuck reviews and approves:
- HR-2: the agent-side subscription registration flow (`inbox-subscribe` skill design)
- HR-6: the detection algorithm for each Event class (thresholds, flapping protection, v1 scope reductions)

- [ ] **HR-2 + HR-6: Pause and present subscription flow + detector algorithms.**

## MemTriggerListener extension

Phase C.3.a in spec (must-ship detectors): UnprocessableWrite, ReflectionDue, BoundExceeded.
Phase C.3.b: ContradictionDetected (limited v1).
Phase C.3.c (deferred): ConsolidationSuggested, OODQuerySignal — log-only.

### Task C.4: Scaffold the mem-trigger CSS extension

**Files:**
- Create: `css/extensions/mem-trigger/package.json`
- Create: `css/extensions/mem-trigger/tsconfig.json`
- Create: `css/extensions/mem-trigger/Dockerfile`

- [ ] **Step 1: Use the `css-extension` skill conventions.**

Invoke the `css-extension` skill (or follow `.claude/skills/css-extension/SKILL.md`) to scaffold the package layout. Pattern from `css/extensions/wiki-search/` is the closest analog.

- [ ] **Step 2: Create package.json.**

Create `css/extensions/mem-trigger/package.json`:

```json
{
  "name": "@cogitarelink/css-mem-trigger",
  "version": "0.1.0",
  "description": "MemTriggerListener: emits mem:Event activities from MonitoringStore CDC.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "lsd:module": true,
  "lsd:components": "dist/components/components.jsonld",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/css-mem-trigger/^0.0.0/components/context.jsonld":
      "dist/components/context.jsonld"
  },
  "lsd:importPaths": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/css-mem-trigger/^0.0.0/components/":
      "dist/components/",
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/css-mem-trigger/^0.0.0/config/":
      "config/"
  },
  "scripts": {
    "build": "npm run build:ts && npm run build:components",
    "build:ts": "tsc",
    "build:components": "componentsjs-generator -s src -c dist/components -i .componentsignore"
  },
  "dependencies": {
    "@solid/community-server": "^8.0.0-alpha.3",
    "n3": "^1.17.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "componentsjs-generator": "^4",
    "typescript": "^5",
    "vitest": "^1"
  }
}
```

- [ ] **Step 3: Create tsconfig.json (CommonJS per the css-extension skill).**

Create `css/extensions/mem-trigger/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create Dockerfile (symlink trick per css-extension skill).**

Create `css/extensions/mem-trigger/Dockerfile`:

```dockerfile
# See .claude/skills/css-extension/SKILL.md for the symlink trick rationale.
FROM solidproject/community-server:latest
COPY ./dist /home/node/mem-trigger/dist
COPY ./package.json /home/node/mem-trigger/package.json
RUN ln -s /home/node/mem-trigger /community-server/node_modules/@cogitarelink/css-mem-trigger
```

- [ ] **Step 5: Install dependencies and verify it builds (no source yet, expect minimal output).**

```bash
cd css/extensions/mem-trigger
npm install
mkdir -p src
echo "export {};" > src/index.ts
npm run build:ts
```

Expected: `dist/index.js` created with no errors.

- [ ] **Step 6: Commit the scaffold.**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add css/extensions/mem-trigger/
git commit -m "[Agent: Claude] mem-trigger: scaffold CSS v8 extension"
```

### Task C.5: UnprocessableWriteDetector — failing test

**Files:**
- Create: `css/extensions/mem-trigger/tests/UnprocessableWriteDetector.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `css/extensions/mem-trigger/tests/UnprocessableWriteDetector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { UnprocessableWriteDetector } from '../src/detectors/UnprocessableWriteDetector';

describe('UnprocessableWriteDetector', () => {
    it('produces a mem:UnprocessableWrite event when given a SHACL ValidationReport', () => {
        const detector = new UnprocessableWriteDetector();
        const targetUri = 'https://pod.example.com/vault/wiki/working/foo.md';
        const validationReportTurtle = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            [] a sh:ValidationReport ;
                sh:conforms false ;
                sh:result [
                    a sh:ValidationResult ;
                    sh:resultSeverity sh:Violation ;
                    sh:resultMessage "Missing required dct:title"
                ] .
        `;
        const writerWebId = 'https://pod.example.com/profile/card#me';
        const event = detector.buildEvent({
            target: targetUri,
            validationReport: validationReportTurtle,
            writer: writerWebId,
            timestamp: new Date('2026-05-18T14:00:00Z')
        });
        expect(event).toMatch(/a as:Activity, mem:UnprocessableWrite/);
        expect(event).toContain(targetUri);
        expect(event).toContain(writerWebId);
        expect(event).toContain('Missing required dct:title');
    });

    it('returns null for non-SHACL-rejection failures', () => {
        const detector = new UnprocessableWriteDetector();
        const event = detector.buildEvent({
            target: 'https://x/',
            validationReport: null,
            writer: 'https://x/me',
            timestamp: new Date()
        });
        expect(event).toBeNull();
    });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `cd css/extensions/mem-trigger && npx vitest run tests/UnprocessableWriteDetector.test.ts`
Expected: FAIL with module not found.

### Task C.6: UnprocessableWriteDetector — implementation

**Files:**
- Create: `css/extensions/mem-trigger/src/detectors/UnprocessableWriteDetector.ts`

- [ ] **Step 1: Implement.**

Create `css/extensions/mem-trigger/src/detectors/UnprocessableWriteDetector.ts`:

```typescript
import { randomUUID } from 'crypto';

interface UnprocessableWriteInput {
    target: string;
    validationReport: string | null;
    writer: string;
    timestamp: Date;
}

export class UnprocessableWriteDetector {
    public buildEvent(input: UnprocessableWriteInput): string | null {
        if (!input.validationReport) {
            return null;
        }
        const uuid = randomUUID();
        const iso = input.timestamp.toISOString();
        return `@prefix as:   <https://www.w3.org/ns/activitystreams#> .
@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

<urn:uuid:${uuid}>
    a as:Activity, mem:UnprocessableWrite ;
    as:actor <urn:substrate:mem-trigger-listener> ;
    prov:wasAssociatedWith <urn:substrate:mem-trigger-listener> ;
    as:object <${input.target}> ;
    as:target <https://pod.vardeman.me/vault/wiki/.events/> ;
    as:published "${iso}"^^xsd:dateTime ;
    as:to <${input.writer}> ;
    as:context [
        ${input.validationReport.replace(/^\s*@prefix[^.]+\.\s*/gm, '').trim()}
    ] .
`;
    }
}
```

- [ ] **Step 2: Run the test.**

Run: `cd css/extensions/mem-trigger && npx vitest run tests/UnprocessableWriteDetector.test.ts`
Expected: PASS both tests.

- [ ] **Step 3: Commit.**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add css/extensions/mem-trigger/src/detectors/UnprocessableWriteDetector.ts \
        css/extensions/mem-trigger/tests/UnprocessableWriteDetector.test.ts
git commit -m "[Agent: Claude] mem-trigger: UnprocessableWriteDetector with unit tests"
```

### Task C.7: ReflectionDueDetector — TDD

**Files:**
- Create: `css/extensions/mem-trigger/src/detectors/ReflectionDueDetector.ts`
- Create: `css/extensions/mem-trigger/tests/ReflectionDueDetector.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `css/extensions/mem-trigger/tests/ReflectionDueDetector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ReflectionDueDetector } from '../src/detectors/ReflectionDueDetector';

describe('ReflectionDueDetector', () => {
    it('returns a mem:ReflectionDue event when the interval has elapsed and there has been activity', () => {
        const detector = new ReflectionDueDetector({ intervalMs: 24 * 3600 * 1000 });
        const lastEmitted = new Date(Date.now() - 25 * 3600 * 1000);  // 25h ago
        const lastActivity = new Date(Date.now() - 1 * 3600 * 1000);  // 1h ago
        const event = detector.maybeEmit({ lastEmitted, lastActivity, now: new Date() });
        expect(event).not.toBeNull();
        expect(event).toMatch(/mem:ReflectionDue/);
    });

    it('returns null when interval has not elapsed', () => {
        const detector = new ReflectionDueDetector({ intervalMs: 24 * 3600 * 1000 });
        const lastEmitted = new Date(Date.now() - 1 * 3600 * 1000);  // 1h ago
        const lastActivity = new Date(Date.now() - 30 * 60 * 1000);
        const event = detector.maybeEmit({ lastEmitted, lastActivity, now: new Date() });
        expect(event).toBeNull();
    });

    it('returns null when interval elapsed but no recent activity', () => {
        const detector = new ReflectionDueDetector({ intervalMs: 24 * 3600 * 1000 });
        const lastEmitted = new Date(Date.now() - 48 * 3600 * 1000);
        const lastActivity = new Date(Date.now() - 96 * 3600 * 1000);  // way before lastEmitted
        const event = detector.maybeEmit({ lastEmitted, lastActivity, now: new Date() });
        expect(event).toBeNull();
    });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `cd css/extensions/mem-trigger && npx vitest run tests/ReflectionDueDetector.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.**

Create `css/extensions/mem-trigger/src/detectors/ReflectionDueDetector.ts`:

```typescript
import { randomUUID } from 'crypto';

interface ReflectionDueOptions {
    intervalMs: number;
}

interface ReflectionDueInput {
    lastEmitted: Date | null;
    lastActivity: Date | null;
    now: Date;
}

export class ReflectionDueDetector {
    constructor(private readonly opts: ReflectionDueOptions) {}

    public maybeEmit(input: ReflectionDueInput): string | null {
        const now = input.now.getTime();
        const sinceEmit = input.lastEmitted ? (now - input.lastEmitted.getTime()) : Infinity;
        if (sinceEmit < this.opts.intervalMs) {
            return null;
        }
        // Activity must be after the last emission (otherwise nothing has happened that warrants reflection)
        if (!input.lastActivity || (input.lastEmitted && input.lastActivity <= input.lastEmitted)) {
            return null;
        }
        const uuid = randomUUID();
        return `@prefix as:   <https://www.w3.org/ns/activitystreams#> .
@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

<urn:uuid:${uuid}>
    a as:Activity, mem:ReflectionDue ;
    as:actor <urn:substrate:mem-trigger-listener> ;
    prov:wasAssociatedWith <urn:substrate:mem-trigger-listener> ;
    as:published "${input.now.toISOString()}"^^xsd:dateTime ;
    as:target <https://pod.vardeman.me/vault/wiki/.events/> .
`;
    }
}
```

- [ ] **Step 4: Run test.**

Run: `cd css/extensions/mem-trigger && npx vitest run tests/ReflectionDueDetector.test.ts`
Expected: PASS all 3.

- [ ] **Step 5: Commit.**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add css/extensions/mem-trigger/src/detectors/ReflectionDueDetector.ts \
        css/extensions/mem-trigger/tests/ReflectionDueDetector.test.ts
git commit -m "[Agent: Claude] mem-trigger: ReflectionDueDetector with unit tests"
```

### Task C.8: BoundExceededDetector — TDD

**Files:**
- Create: `css/extensions/mem-trigger/src/detectors/BoundExceededDetector.ts`
- Create: `css/extensions/mem-trigger/tests/BoundExceededDetector.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `css/extensions/mem-trigger/tests/BoundExceededDetector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BoundExceededDetector } from '../src/detectors/BoundExceededDetector';

describe('BoundExceededDetector', () => {
    it('emits when child count crosses the threshold going up', () => {
        const detector = new BoundExceededDetector({ threshold: 12 });
        const event = detector.maybeEmit({
            container: 'https://pod.example.com/vault/wiki/concepts/',
            childCount: 13,
            lastEmittedForContainer: null
        });
        expect(event).not.toBeNull();
        expect(event).toMatch(/mem:BoundExceeded/);
        expect(event).toContain('https://pod.example.com/vault/wiki/concepts/');
    });

    it('does not emit when child count is at or below threshold', () => {
        const detector = new BoundExceededDetector({ threshold: 12 });
        expect(detector.maybeEmit({
            container: 'https://pod.example.com/vault/wiki/concepts/',
            childCount: 12,
            lastEmittedForContainer: null
        })).toBeNull();
        expect(detector.maybeEmit({
            container: 'https://pod.example.com/vault/wiki/concepts/',
            childCount: 5,
            lastEmittedForContainer: null
        })).toBeNull();
    });

    it('rate-limits to once per container per 24h (flapping protection)', () => {
        const detector = new BoundExceededDetector({
            threshold: 12,
            flappingProtectionMs: 24 * 3600 * 1000
        });
        const recent = new Date(Date.now() - 1 * 3600 * 1000);  // 1h ago
        const event = detector.maybeEmit({
            container: 'https://pod.example.com/vault/wiki/concepts/',
            childCount: 15,
            lastEmittedForContainer: recent
        });
        expect(event).toBeNull();
    });
});
```

- [ ] **Step 2: Implement.**

Create `css/extensions/mem-trigger/src/detectors/BoundExceededDetector.ts`:

```typescript
import { randomUUID } from 'crypto';

interface BoundExceededOptions {
    threshold: number;
    flappingProtectionMs?: number;
}

interface BoundExceededInput {
    container: string;
    childCount: number;
    lastEmittedForContainer: Date | null;
}

export class BoundExceededDetector {
    private readonly flappingProtectionMs: number;

    constructor(private readonly opts: BoundExceededOptions) {
        this.flappingProtectionMs = opts.flappingProtectionMs ?? 24 * 3600 * 1000;
    }

    public maybeEmit(input: BoundExceededInput): string | null {
        if (input.childCount <= this.opts.threshold) {
            return null;
        }
        if (input.lastEmittedForContainer) {
            const since = Date.now() - input.lastEmittedForContainer.getTime();
            if (since < this.flappingProtectionMs) {
                return null;
            }
        }
        const uuid = randomUUID();
        const now = new Date().toISOString();
        return `@prefix as:   <https://www.w3.org/ns/activitystreams#> .
@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

<urn:uuid:${uuid}>
    a as:Activity, mem:BoundExceeded ;
    as:actor <urn:substrate:mem-trigger-listener> ;
    prov:wasAssociatedWith <urn:substrate:mem-trigger-listener> ;
    as:object <${input.container}> ;
    as:target <https://pod.vardeman.me/vault/wiki/.events/> ;
    as:published "${now}"^^xsd:dateTime ;
    mem:childCount ${input.childCount} ;
    mem:threshold ${this.opts.threshold} .
`;
    }
}
```

- [ ] **Step 3: Run tests.**

Run: `cd css/extensions/mem-trigger && npx vitest run tests/BoundExceededDetector.test.ts`
Expected: PASS all 3.

- [ ] **Step 4: Commit.**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add css/extensions/mem-trigger/src/detectors/BoundExceededDetector.ts \
        css/extensions/mem-trigger/tests/BoundExceededDetector.test.ts
git commit -m "[Agent: Claude] mem-trigger: BoundExceededDetector (Fano bound, 24h rate-limit)"
```

### Task C.9: ContradictionDetector v1 (limited predicate-pair list) — TDD

**Files:**
- Create: `css/extensions/mem-trigger/src/detectors/ContradictionDetector.ts`
- Create: `css/extensions/mem-trigger/tests/ContradictionDetector.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `css/extensions/mem-trigger/tests/ContradictionDetector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ContradictionDetector } from '../src/detectors/ContradictionDetector';

describe('ContradictionDetector', () => {
    const WIKI = 'https://pod.vardeman.me/vault/ontology/wiki#';
    const detector = new ContradictionDetector({
        contradictoryPairs: [
            [`${WIKI}supports`, `${WIKI}criticizes`]
        ]
    });

    it('emits when subject supports + criticizes the same object', () => {
        const event = detector.maybeEmit({
            subject: 'https://pod.example.com/vault/wiki/concepts/A',
            edges: [
                { predicate: `${WIKI}supports`, object: 'https://pod.example.com/vault/wiki/concepts/B' },
                { predicate: `${WIKI}criticizes`, object: 'https://pod.example.com/vault/wiki/concepts/B' }
            ]
        });
        expect(event).not.toBeNull();
        expect(event).toMatch(/mem:ContradictionDetected/);
    });

    it('does not emit when subject only supports', () => {
        const event = detector.maybeEmit({
            subject: 'https://pod.example.com/vault/wiki/concepts/A',
            edges: [
                { predicate: `${WIKI}supports`, object: 'https://pod.example.com/vault/wiki/concepts/B' }
            ]
        });
        expect(event).toBeNull();
    });

    it('does not emit when supports/criticizes target different objects', () => {
        const event = detector.maybeEmit({
            subject: 'https://pod.example.com/vault/wiki/concepts/A',
            edges: [
                { predicate: `${WIKI}supports`, object: 'https://pod.example.com/vault/wiki/concepts/B' },
                { predicate: `${WIKI}criticizes`, object: 'https://pod.example.com/vault/wiki/concepts/C' }
            ]
        });
        expect(event).toBeNull();
    });
});
```

- [ ] **Step 2: Implement.**

Create `css/extensions/mem-trigger/src/detectors/ContradictionDetector.ts`:

```typescript
import { randomUUID } from 'crypto';

interface Edge {
    predicate: string;
    object: string;
}

interface ContradictionInput {
    subject: string;
    edges: Edge[];
}

interface ContradictionOptions {
    contradictoryPairs: Array<[string, string]>;
}

export class ContradictionDetector {
    constructor(private readonly opts: ContradictionOptions) {}

    public maybeEmit(input: ContradictionInput): string | null {
        for (const [predA, predB] of this.opts.contradictoryPairs) {
            const aObjects = new Set(
                input.edges.filter((e) => e.predicate === predA).map((e) => e.object)
            );
            const bObjects = new Set(
                input.edges.filter((e) => e.predicate === predB).map((e) => e.object)
            );
            for (const obj of aObjects) {
                if (bObjects.has(obj)) {
                    return this.buildEvent(input.subject, obj, predA, predB);
                }
            }
        }
        return null;
    }

    private buildEvent(subject: string, object: string, predA: string, predB: string): string {
        const uuid = randomUUID();
        const now = new Date().toISOString();
        return `@prefix as:   <https://www.w3.org/ns/activitystreams#> .
@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

<urn:uuid:${uuid}>
    a as:Activity, mem:ContradictionDetected ;
    as:actor <urn:substrate:mem-trigger-listener> ;
    prov:wasAssociatedWith <urn:substrate:mem-trigger-listener> ;
    as:object <${subject}> ;
    as:target <https://pod.vardeman.me/vault/wiki/.events/> ;
    as:published "${now}"^^xsd:dateTime ;
    mem:contradictoryEdges (
        [ mem:predicate <${predA}> ; mem:object <${object}> ]
        [ mem:predicate <${predB}> ; mem:object <${object}> ]
    ) .
`;
    }
}
```

- [ ] **Step 3: Run tests.**

Run: `cd css/extensions/mem-trigger && npx vitest run tests/ContradictionDetector.test.ts`
Expected: PASS all 3.

- [ ] **Step 4: Commit.**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add css/extensions/mem-trigger/src/detectors/ContradictionDetector.ts \
        css/extensions/mem-trigger/tests/ContradictionDetector.test.ts
git commit -m "[Agent: Claude] mem-trigger: ContradictionDetector v1 (limited predicate-pair list)"
```

### Task C.10: EventEmitter (POSTs events to /vault/wiki/.events/)

**Files:**
- Create: `css/extensions/mem-trigger/src/EventEmitter.ts`
- Create: `css/extensions/mem-trigger/tests/EventEmitter.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `css/extensions/mem-trigger/tests/EventEmitter.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../src/EventEmitter';

describe('EventEmitter', () => {
    it('writes the event Turtle to the events container via the injected store', async () => {
        const mockStore = {
            setRepresentation: vi.fn().mockResolvedValue(undefined),
            hasResource: vi.fn().mockResolvedValue(true)
        };
        const emitter = new EventEmitter({
            store: mockStore as any,
            eventsContainer: 'https://pod.example.com/vault/wiki/.events/'
        });
        const turtle = '@prefix mem: <x#> . <urn:uuid:1> a mem:BoundExceeded .';
        await emitter.emit(turtle);
        expect(mockStore.setRepresentation).toHaveBeenCalledTimes(1);
        const args = mockStore.setRepresentation.mock.calls[0];
        const targetUrl = args[0].path;
        expect(targetUrl).toMatch(/^https:\/\/pod\.example\.com\/vault\/wiki\/\.events\/.+\.ttl$/);
    });
});
```

- [ ] **Step 2: Implement.**

Create `css/extensions/mem-trigger/src/EventEmitter.ts`:

```typescript
import type { ResourceStore } from '@solid/community-server';
import { randomUUID } from 'crypto';

interface EventEmitterOptions {
    store: ResourceStore;
    eventsContainer: string;
}

export class EventEmitter {
    constructor(private readonly opts: EventEmitterOptions) {}

    public async emit(turtle: string): Promise<void> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const uuid = randomUUID();
        const filename = `${timestamp}-${uuid}.ttl`;
        const url = `${this.opts.eventsContainer}${filename}`;
        // CSS ResourceStore API: setRepresentation expects a ResourceIdentifier
        // and a Representation. Construct minimal forms.
        const identifier = { path: url };
        const representation = {
            data: this.stringToStream(turtle),
            metadata: { contentType: 'text/turtle' } as any,
            binary: false,
            isEmpty: false
        };
        await this.opts.store.setRepresentation(identifier as any, representation as any);
    }

    private stringToStream(s: string): NodeJS.ReadableStream {
        const { Readable } = require('stream');
        return Readable.from([Buffer.from(s, 'utf8')]);
    }
}
```

- [ ] **Step 3: Run.**

Run: `cd css/extensions/mem-trigger && npx vitest run tests/EventEmitter.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add css/extensions/mem-trigger/src/EventEmitter.ts \
        css/extensions/mem-trigger/tests/EventEmitter.test.ts
git commit -m "[Agent: Claude] mem-trigger: EventEmitter posts to /vault/wiki/.events/"
```

### Task C.11: MemTriggerListener — wire detectors to MonitoringStore CDC

**Files:**
- Create: `css/extensions/mem-trigger/src/MemTriggerListener.ts`
- Create: `css/extensions/mem-trigger/tests/MemTriggerListener.test.ts`

- [ ] **Step 1: Study the existing CDC pattern.**

Run: `cat css/extensions/memento/src/MementoCommitListener.ts | head -80`

Note how the existing memento listener subscribes to the MonitoringStore `'changed'` event and dispatches. Apply the same pattern.

- [ ] **Step 2: Write the listener.**

Create `css/extensions/mem-trigger/src/MemTriggerListener.ts`:

```typescript
import type {
    MonitoringStore,
    ResourceStore,
    ResourceIdentifier
} from '@solid/community-server';
import type { AS } from '@solid/community-server';
import { UnprocessableWriteDetector } from './detectors/UnprocessableWriteDetector';
import { BoundExceededDetector } from './detectors/BoundExceededDetector';
import { ReflectionDueDetector } from './detectors/ReflectionDueDetector';
import { ContradictionDetector } from './detectors/ContradictionDetector';
import { EventEmitter } from './EventEmitter';

export class MemTriggerListener {
    private readonly emitter: EventEmitter;
    private readonly bound: BoundExceededDetector;
    private readonly reflection: ReflectionDueDetector;
    private readonly contradiction: ContradictionDetector;
    private readonly unprocessable: UnprocessableWriteDetector;

    private readonly lastBoundEmit = new Map<string, Date>();

    constructor(opts: {
        store: ResourceStore;
        monitoringStore: MonitoringStore;
        eventsContainer: string;
        boundThreshold: number;
        reflectionIntervalMs: number;
        contradictoryPairs: Array<[string, string]>;
    }) {
        this.emitter = new EventEmitter({
            store: opts.store,
            eventsContainer: opts.eventsContainer
        });
        this.bound = new BoundExceededDetector({ threshold: opts.boundThreshold });
        this.reflection = new ReflectionDueDetector({ intervalMs: opts.reflectionIntervalMs });
        this.contradiction = new ContradictionDetector({
            contradictoryPairs: opts.contradictoryPairs
        });
        this.unprocessable = new UnprocessableWriteDetector();

        opts.monitoringStore.on('changed', (identifier: ResourceIdentifier, activity: AS) => {
            this.handleChanged(identifier, activity).catch((err) => {
                console.error('[mem-trigger] handler error:', err);
            });
        });
    }

    private async handleChanged(identifier: ResourceIdentifier, activity: AS): Promise<void> {
        // Filter: ignore writes to .operations/, .events/, or .meta itself
        // to avoid recursion.
        if (identifier.path.includes('/.events/') || identifier.path.includes('/.operations/')) {
            return;
        }
        // Bound check on container parents.
        const container = this.containerOf(identifier.path);
        if (container) {
            await this.checkBound(container);
        }
        // Contradiction check on .meta writes (skipped here; requires reading .meta —
        // wire into a real implementation by passing a meta-reader closure)
        // Reflection check (periodic, not per-event — would normally be on a timer)
    }

    private containerOf(path: string): string | null {
        const lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1 || lastSlash === path.length - 1) {
            return null;
        }
        return path.substring(0, lastSlash + 1);
    }

    private async checkBound(container: string): Promise<void> {
        // Stub: a real implementation reads ldp:contains via the data accessor
        // (similar to wiki-search walker, D92) and counts children.
        // For now this is a hook point.
    }
}
```

(Many parts are stubbed; the implementation is integration-test-driven from here on. Unit tests for each detector exercise the logic; integration tests exercise wiring.)

- [ ] **Step 3: Write a minimal unit test that the listener can be instantiated.**

Create `css/extensions/mem-trigger/tests/MemTriggerListener.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MemTriggerListener } from '../src/MemTriggerListener';
import { EventEmitter as NodeEventEmitter } from 'events';

describe('MemTriggerListener', () => {
    it('instantiates and attaches to MonitoringStore changed event', () => {
        const mockStore: any = {};
        const ms = new NodeEventEmitter();
        new MemTriggerListener({
            store: mockStore,
            monitoringStore: ms as any,
            eventsContainer: 'https://pod.example.com/vault/wiki/.events/',
            boundThreshold: 12,
            reflectionIntervalMs: 24 * 3600 * 1000,
            contradictoryPairs: [['urn:a', 'urn:b']]
        });
        expect(ms.listenerCount('changed')).toBe(1);
    });
});
```

- [ ] **Step 4: Build and run tests.**

Run: `cd css/extensions/mem-trigger && npm run build:ts && npx vitest run`
Expected: PASS all tests.

- [ ] **Step 5: Commit.**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add css/extensions/mem-trigger/src/MemTriggerListener.ts \
        css/extensions/mem-trigger/tests/MemTriggerListener.test.ts
git commit -m "[Agent: Claude] mem-trigger: MemTriggerListener with detector wiring"
```

### Task C.12: Components.js wiring for mem-trigger

**Files:**
- Create: `css/extensions/mem-trigger/config/components.jsonld`
- Create: `css/config/mem-trigger.json`

- [ ] **Step 1: Generate Components.js descriptors.**

Run: `cd css/extensions/mem-trigger && npm run build:components`
Expected: `dist/components/` directory populated.

- [ ] **Step 2: Write the CSS config that instantiates the listener.**

Create `css/config/mem-trigger.json`:

```jsonld
{
  "@context": [
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
    "https://linkedsoftwaredependencies.org/bundles/npm/@cogitarelink/css-mem-trigger/^0.0.0/components/context.jsonld"
  ],
  "@graph": [
    {
      "@id": "urn:solid-server:default:Initializer",
      "@type": "SequenceHandler",
      "handlers": [
        {
          "@type": "MemTriggerListener",
          "store": { "@id": "urn:solid-server:default:ResourceStore" },
          "monitoringStore": { "@id": "urn:solid-server:default:ResourceStore_Backend" },
          "eventsContainer": "https://pod.vardeman.me/vault/wiki/.events/",
          "boundThreshold": 12,
          "reflectionIntervalMs": 86400000,
          "contradictoryPairs": [
            ["https://pod.vardeman.me/vault/ontology/wiki#supports",
             "https://pod.vardeman.me/vault/ontology/wiki#criticizes"]
          ]
        }
      ]
    }
  ]
}
```

The exact `@id` of the ResourceStore + MonitoringStore depends on CSS v8's resolved URN; check existing extensions (`memento.json`, `markdown-projection.json`) for the correct URNs.

- [ ] **Step 3: Import mem-trigger.json in dev-allow-all.json.**

Edit `css/config/dev-allow-all.json` to import the mem-trigger config. Find the imports array (typically `"import"` field) and add `"css:../mem-trigger.json"` (relative path adjusted per CSS convention).

- [ ] **Step 4: Build and restart CSS.**

```bash
cd css/extensions/mem-trigger && npm run build
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
docker compose restart css
sleep 8
docker compose logs --tail 30 css
```
Expected: CSS starts without errors; logs show MemTriggerListener instantiated.

- [ ] **Step 5: Commit.**

```bash
git add css/extensions/mem-trigger/ css/config/mem-trigger.json css/config/dev-allow-all.json
git commit -m "[Agent: Claude] mem-trigger: Components.js wiring + dev-allow-all integration"
```

### Task C.13: inbox-subscribe skill (sibling repo)

**Files:**
- Create: `~/dev/git/LA3D/agents/solid-agent-skills/skills/inbox-subscribe/SKILL.md`

- [ ] **Step 1: Write the skill.**

Create the file:

```markdown
---
name: inbox-subscribe
description: Subscribe an agent to substrate events and operation announcements via Solid Notifications WebhookChannel2023. The agent's own /inbox/ is the webhook target. Use this on first contact with a new wiki-memory or to refresh subscriptions.
---

# Subscribe to wiki-memory notifications

## Procedure

1. Discover the agent's own inbox URL (likely `<own-pod>/inbox/` from the agent's WebID profile).
2. POST a subscription request to the wiki-memory's notification gateway at `<wiki-memory-pod>/.notifications/WebhookChannel2023/`. Body:

   ```jsonld
   {
     "@context": "https://www.w3.org/ns/solid/notifications/v1",
     "type": "WebhookChannel2023",
     "topic": "https://pod.vardeman.me/vault/wiki/.operations/",
     "sendTo": "<agent-own-inbox-url>"
   }
   ```

3. Repeat for `/vault/wiki/.events/` and optionally for `/vault/wiki/` itself (for per-resource CRUD).
4. Save the returned subscription `id` somewhere durable (config, vault note) so the subscription can be torn down later via inbox-unsubscribe.

## Failure handling

- 401 / 403: the agent is not authenticated to the wiki-memory pod; check Solid-OIDC + DPoP.
- 404: the .notifications endpoint isn't enabled; check CSS config (should be by default per dev-allow-all.json).

## References

- Solid Notifications Protocol: <https://solidproject.org/TR/notifications-protocol>
- WebhookChannel2023: <https://solid.github.io/notifications/webhook-channel-2023>
```

- [ ] **Step 2: Commit.**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
mkdir -p skills/inbox-subscribe
mv /tmp/inbox-subscribe-skill.md skills/inbox-subscribe/SKILL.md 2>/dev/null || true
# (If file was written directly, skip mv; otherwise rename from wherever it was placed)
git add skills/inbox-subscribe/SKILL.md
git commit -m "[Agent: Claude] skill: inbox-subscribe — Solid Notifications WebhookChannel2023"
```

### Task C.14: inbox-list + inbox-read skills

**Files:**
- Create: `~/dev/git/LA3D/agents/solid-agent-skills/skills/inbox-list/SKILL.md`
- Create: `~/dev/git/LA3D/agents/solid-agent-skills/skills/inbox-read/SKILL.md`

- [ ] **Step 1: Write inbox-list.**

Create `~/dev/git/LA3D/agents/solid-agent-skills/skills/inbox-list/SKILL.md`:

```markdown
---
name: inbox-list
description: List the contents of an LDN inbox or substrate notification container — operations log, events stream, or per-subscriber inbox. Returns entries sorted by published timestamp, optionally filtered by rdf:type (e.g., mem:Event subclasses). Use when the user asks "what's new in wiki-memory?" or "what has the substrate flagged?"
---

# List inbox / notification container contents

## Procedure

1. `solid-pod read <container-url>` with Accept: text/turtle.
2. Parse the response for `ldp:contains` triples — these are the entry URLs.
3. For each entry (in batches), fetch and read `rdf:type` + `as:published` from the .meta.
4. Sort by `as:published` descending.
5. Optionally filter by type — e.g., only `mem:Event` subclasses.
6. Output structured: per-entry timestamp + type + summary.

## Common containers

- `<pod>/vault/wiki/.operations/` — agent operations log
- `<pod>/vault/wiki/.events/` — substrate events
- `<own-pod>/inbox/` — per-subscriber inbox (after subscribing via inbox-subscribe)

## References

- L3 synthesis: `<pod>/vault/wiki/`
- Event vocabulary: `<pod>/vault/ontology/mem`
```

- [ ] **Step 2: Write inbox-read.**

Create `~/dev/git/LA3D/agents/solid-agent-skills/skills/inbox-read/SKILL.md`:

```markdown
---
name: inbox-read
description: Read one specific inbox entry by URL and parse its activity body (actor, object, target, type, payload). Returns a structured representation an agent can reason about. Pair with inbox-list to enumerate then drill in.
---

# Read a single inbox entry

## Procedure

1. `solid-pod read <entry-url>` with Accept: text/turtle.
2. Parse:
   - `rdf:type` — categorize (mem:Event / mem:Announcement subclass)
   - `as:actor`, `as:object`, `as:target`, `as:published`
   - `prov:wasAssociatedWith` — the runtime that posted
   - Type-specific payload (e.g., `mem:BoundExceeded` carries `mem:childCount`, `mem:threshold`; `mem:UnprocessableWrite` carries `as:context` with sh:ValidationReport)
3. Return structured for the calling agent.

## References

- Event/Announcement classes: <pod>/vault/ontology/mem
```

- [ ] **Step 3: Commit both.**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
git add skills/inbox-list/SKILL.md skills/inbox-read/SKILL.md
git commit -m "[Agent: Claude] skills: inbox-list + inbox-read"
```

### Task C.15: Integration test — UnprocessableWrite emission

**Files:**
- Create: `tests/integration/test_mem_events.py`

- [ ] **Step 1: Write the test.**

Back in cogitarelink-solid repo:

Create `tests/integration/test_mem_events.py`:

```python
"""Phase C — mem:Event emission integration tests."""
import time
import uuid
import httpx
import pytest
from rdflib import Graph, URIRef, Namespace
from rdflib.namespace import RDF

POD = "https://pod.vardeman.me/vault/"
EVENTS = f"{POD}wiki/.events/"
WORKING = f"{POD}wiki/working/"
MEM = Namespace("https://pod.vardeman.me/vault/ontology/mem#")


def test_unprocessable_write_event_emitted_on_shacl_rejection():
    """Attempting a malformed write should produce a mem:UnprocessableWrite event."""
    slug = f"bad-{uuid.uuid4().hex[:8]}"
    bad_url = f"{WORKING}{slug}.md.meta"
    # Submit Turtle that violates the working SHACL shape (missing required predicates).
    bad_meta = "<https://example.com/> <https://example.com/foo> 42 ."
    r = httpx.put(bad_url, content=bad_meta,
                  headers={"Content-Type": "text/turtle"}, verify=False)
    assert r.status_code in (422, 400)  # Rejected.

    # Wait a moment for the listener to react.
    time.sleep(2)

    # Poll the events container.
    r = httpx.get(EVENTS, headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=EVENTS)
    LDP_CONTAINS = URIRef("http://www.w3.org/ns/ldp#contains")
    entries = list(g.objects(predicate=LDP_CONTAINS))
    # Check at least one recent entry has rdf:type mem:UnprocessableWrite.
    found = False
    for entry in entries[-10:]:  # check last 10 entries
        er = httpx.get(str(entry), headers={"Accept": "text/turtle"}, verify=False)
        if er.status_code != 200:
            continue
        eg = Graph().parse(data=er.text, format="turtle", publicID=str(entry))
        types = list(eg.objects(predicate=RDF.type))
        if MEM.UnprocessableWrite in types:
            found = True
            break
    assert found, "No mem:UnprocessableWrite event surfaced after a SHACL rejection"
```

- [ ] **Step 2: Run the test.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_events.py::test_unprocessable_write_event_emitted_on_shacl_rejection -v`
Expected: PASS (may take a few seconds due to listener latency).

- [ ] **Step 3: Commit.**

```bash
git add tests/integration/test_mem_events.py
git commit -m "[Agent: Claude] test: Phase C UnprocessableWrite event emission"
```

### Task C.16: Integration test — BoundExceeded emission

**Files:**
- Modify: `tests/integration/test_mem_events.py`

- [ ] **Step 1: Add the test.**

Append to `tests/integration/test_mem_events.py`:

```python
def test_bound_exceeded_event_when_container_crosses_12():
    """Writing 13 resources into a test container should produce a mem:BoundExceeded event."""
    suffix = uuid.uuid4().hex[:8]
    test_container = f"{POD}wiki/working/test-bound-{suffix}/"
    # Create the container.
    httpx.put(test_container, headers={"Content-Type": "text/turtle"},
              content="", verify=False)
    # Write 13 resources.
    for i in range(13):
        url = f"{test_container}note-{i}.md"
        httpx.put(url, content=f"# Note {i}",
                  headers={"Content-Type": "text/markdown"}, verify=False)
    time.sleep(3)
    # Poll events.
    r = httpx.get(EVENTS, headers={"Accept": "text/turtle"}, verify=False)
    g = Graph().parse(data=r.text, format="turtle", publicID=EVENTS)
    LDP_CONTAINS = URIRef("http://www.w3.org/ns/ldp#contains")
    entries = list(g.objects(predicate=LDP_CONTAINS))
    found = False
    for entry in entries[-20:]:
        er = httpx.get(str(entry), headers={"Accept": "text/turtle"}, verify=False)
        if er.status_code != 200:
            continue
        eg = Graph().parse(data=er.text, format="turtle", publicID=str(entry))
        types = list(eg.objects(predicate=RDF.type))
        if MEM.BoundExceeded in types:
            objs = list(eg.objects(predicate=URIRef("https://www.w3.org/ns/activitystreams#object")))
            if any(test_container in str(o) for o in objs):
                found = True
                break
    assert found, "No mem:BoundExceeded for the test container"
```

- [ ] **Step 2: Run.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_events.py::test_bound_exceeded_event_when_container_crosses_12 -v`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add tests/integration/test_mem_events.py
git commit -m "[Agent: Claude] test: Phase C BoundExceeded event emission"
```

### Task C.17: Integration test — operations log + multi-user fan-out

**Files:**
- Create: `tests/integration/test_announcement_log.py`
- Create: `tests/integration/test_solid_notifications_fanout.py`

- [ ] **Step 1: Write the operations log test.**

Create `tests/integration/test_announcement_log.py`:

```python
"""Phase C — operations log integration tests."""
import time
import uuid
import httpx
from rdflib import Graph, URIRef, Namespace
from rdflib.namespace import RDF

POD = "https://pod.vardeman.me/vault/"
OPS = f"{POD}wiki/.operations/"
MEM = Namespace("https://pod.vardeman.me/vault/ontology/mem#")


def test_operations_log_accepts_announcement_post():
    """Agent can POST a mem:Crystallized activity to /vault/wiki/.operations/."""
    slug = uuid.uuid4().hex[:8]
    announcement_url = f"{OPS}test-{slug}.ttl"
    body = f"""@prefix as:   <https://www.w3.org/ns/activitystreams#> .
@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

<urn:uuid:{uuid.uuid4()}>
    a as:Activity, mem:Crystallized ;
    as:actor <https://pod.vardeman.me/profile/card#me> ;
    prov:wasAssociatedWith <urn:agent:claude-code> ;
    as:object <{POD}wiki/concepts/test.md> ;
    as:target <{OPS}> ;
    as:published "{time.strftime('%Y-%m-%dT%H:%M:%SZ')}"^^xsd:dateTime .
"""
    r = httpx.put(announcement_url, content=body,
                  headers={"Content-Type": "text/turtle"}, verify=False)
    assert r.status_code in (201, 204)


def test_operations_log_lists_recent_announcements():
    """GET /vault/wiki/.operations/ returns ldp:contains for posted announcements."""
    r = httpx.get(OPS, headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200
    g = Graph().parse(data=r.text, format="turtle", publicID=OPS)
    LDP_CONTAINS = URIRef("http://www.w3.org/ns/ldp#contains")
    entries = list(g.objects(predicate=LDP_CONTAINS))
    assert len(entries) >= 1  # at least one from the prior test
```

- [ ] **Step 2: Run.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_announcement_log.py -v`
Expected: PASS.

- [ ] **Step 3: Write a basic fan-out test.**

Create `tests/integration/test_solid_notifications_fanout.py`:

```python
"""Phase C — Solid Notifications fan-out integration test (single-user smoke)."""
import time
import httpx

POD = "https://pod.vardeman.me/vault/"


def test_can_subscribe_to_operations_container():
    """A POST to /.notifications/WebhookChannel2023/ for /.operations/ topic succeeds."""
    sub_url = f"{POD}.notifications/WebhookChannel2023/"
    body = {
        "@context": "https://www.w3.org/ns/solid/notifications/v1",
        "type": "WebhookChannel2023",
        "topic": f"{POD}wiki/.operations/",
        "sendTo": "https://example.com/fake-webhook"
    }
    r = httpx.post(sub_url, json=body, verify=False)
    assert r.status_code in (200, 201)
    # CSS returns the channel object including id / receiveFrom.
    assert "WebhookChannel2023" in r.text or r.json().get("type") == "WebhookChannel2023"
```

(Full multi-user fan-out test would require two Pods; deferred to a follow-on once the second Pod is provisioned.)

- [ ] **Step 4: Run.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_solid_notifications_fanout.py -v`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add tests/integration/test_announcement_log.py \
        tests/integration/test_solid_notifications_fanout.py
git commit -m "[Agent: Claude] test: Phase C operations log + Solid Notifications subscription"
```

### Task C.18: Phase C close-out

- [ ] **Step 1: Run the full Phase C test suite.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_events.py tests/integration/test_announcement_log.py tests/integration/test_solid_notifications_fanout.py -v`
Expected: all PASS.

- [ ] **Step 2: Run the mem-trigger unit tests.**

Run: `cd css/extensions/mem-trigger && npx vitest run`
Expected: all PASS.

- [ ] **Step 3: Tag Phase C boundary.**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git tag -a phase-c-complete -m "Phase C: notifications layer shipped"
```

Continue to Phase D — decision ratification.

---

# Phase D — Decision ratification

### Task D.1: Ratify D93 in repo decisions.md

**Files:**
- Modify: `.claude/skills/decision-lookup/decisions.md`

- [ ] **Step 1: Add the D93 entry.**

Find the location after D92 in `.claude/skills/decision-lookup/decisions.md` and add:

```markdown
### D93 — Wiki-Memory L3 Synthesis Page as Primary Agent Entry Point

**Status**: Ratified 2026-MM-DD (this sprint).

**Decision**: The wiki-memory L3 substrate exposes one well-known agent entry point at `/vault/wiki/` (the substrate root container) as a dogfooded wiki-memory page. The page returns body markdown, `.meta` Turtle, and rendered HTML with embedded JSON-LD `<script>` block (per the K-note clarification of D75). Cross-references from every SHACL shape's `sh:agentInstruction`, every affordance descriptor's `dct:description`, the storage description (`wiki:profileDocument`), the PROF descriptor (`prof:hasResource` with `prof:role wikirole:overview`), and the inbox/event container `.meta` resources all point back to the synthesis (U-shape reinforcement).

Parallels the emerging entry-point pattern in `llms.txt` (Howard / fast.ai), A2A `/.well-known/agent.json` (Google), and NLWeb's schema.org-embedded discovery (Microsoft + Schema.org), but uses Solid-native vocabularies (LDP, AS2, SHACL, PROF, VoID, PROV-O, RFC 6906) throughout.

Serves two agent use cases simultaneously: skilled agents (using `solid-wiki-memory-l3` or per-operation skills) and blind agents (generic web clients with only HTTP + RDF parsing).

**See also**: D44 (storage description as router), D52 (affordance descriptors), D58 (dual-layer linking), D70/D71 (L3 stratification), D75 (rendered HTML; K-note clarifies JSON-LD compatibility), D77/D78 (shape catalog + class-based targeting), D84/D86 (URI conformance + PROF), `docs/superpowers/specs/2026-05-18-memory-structuring-sprint-design.md`.
```

Also update the top-line index `D1-D92` to `D1-D94`.

- [ ] **Step 2: Commit.**

```bash
git add .claude/skills/decision-lookup/decisions.md
git commit -m "[Agent: Claude] decisions: ratify D93 — synthesis page as primary agent entry point"
```

### Task D.2: Ratify D94 in repo decisions.md

**Files:**
- Modify: `.claude/skills/decision-lookup/decisions.md`

- [ ] **Step 1: Add the D94 entry.**

After D93, append:

```markdown
### D94 — `mem:` vocabulary: Operation / Event / Announcement taxonomy

**Status**: Ratified 2026-MM-DD (this sprint).

**Decision**: The wiki-memory L3 memory-operation vocabulary is published at `https://pod.vardeman.me/vault/ontology/mem` (hash-namespace per D84) with three top-level classes: `mem:Operation` (categories of agent action; not messages), `mem:Event` (substrate-emitted analysis activities; subclass of `as:Activity`), and `mem:Announcement` (agent-emitted past-tense activities; subclass of `as:Activity`).

Operation subclasses: `CrystallizeOperation`, `SupersedeOperation`, `MergeOperation`, `DemoteOperation`, `ArchiveOperation`, `LinkOperation`.

Event subclasses: `BoundExceeded`, `ContradictionDetected`, `ConsolidationSuggested`, `ReflectionDue`, `OODQuerySignal`, `UnprocessableWrite`.

Announcement subclasses: `Crystallized`, `Superseded`, `Merged`, `Demoted`, `Archived`, `Linked`.

Operations are performed as direct LDP CRUD sequences (Model B from brainstorming: LDN is NOT the primary write API). The operation's type is recorded in the resulting resource's `.meta` via `prov:wasGeneratedBy`. Events are emitted by the `MemTriggerListener` CSS extension on cross-resource analysis and arrive in subscriber inboxes via Solid Notifications fan-out. Announcements are agent-posted to `/vault/wiki/.operations/` after operation completion, following Option 3 (skill-emits-announcement) from the brainstorming.

Refines D74 by enumerating the full Event set and adding the Operation and Announcement categories.

**See also**: D73 (two-stage commit; `CrystallizeOperation` is the durable-promotion verb), D74 (the original `mem:*` trigger framing), D58 (dual-layer linking; .meta is where PROV-O lives), D81 (predicate-level governance; affects `LinkOperation`), D17/D65 (MonitoringStore CDC; `MemTriggerListener` builds on this), D56 (Solid Notifications), AS2/PROV-O specifications. `docs/superpowers/specs/2026-05-18-memory-structuring-sprint-design.md`.
```

- [ ] **Step 2: Commit.**

```bash
git add .claude/skills/decision-lookup/decisions.md
git commit -m "[Agent: Claude] decisions: ratify D94 — mem: vocabulary taxonomy"
```

### Task D.3: K-note for JSON-LD script tag

**Files:**
- Modify: `.claude/skills/decision-lookup/decisions.md`

- [ ] **Step 1: Add a K-note after the existing K-notes.**

Find the K-notes section in `.claude/skills/decision-lookup/decisions.md` (after K1, K2, K3 if present). Add:

```markdown
### K4 — JSON-LD `<script>` Tag in Rendered HTML is Not RDFa (D75 Clarification)

**Status**: K-note, 2026-MM-DD.

**Clarification**: D75 ("Rendered HTML Serves Humans; No RDFa Embedding") forbids RDFa attribute-tangled markup. Embedded JSON-LD `<script type="application/ld+json">` blocks are not RDFa — they're cleanly separable from HTML body markup, follow the schema.org / NLWeb / Google Knowledge Graph pattern, and serve agents who chose HTML as their representation. The `markdown-render` extension's emission of JSON-LD script tags (per the Memory Structuring Sprint Phase A) is therefore compatible with D75's framing.

The motivation for D75 (avoiding maintenance complexity from attribute-tangled triples interleaved with display markup) does not apply to script tags.

**See also**: D75, this sprint's design doc.
```

- [ ] **Step 2: Commit.**

```bash
git add .claude/skills/decision-lookup/decisions.md
git commit -m "[Agent: Claude] K4: JSON-LD script tag is not RDFa (D75 clarification)"
```

### Task D.4: Sync ratifications to vault

**Files:**
- Modify: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`

- [ ] **Step 1: Add vault entries.**

Vault numbering: continues from vault-D88 (= repo D92). So:
- repo D93 = vault D89
- repo D94 = vault D90
- K4 = K-note in vault sequence

Add entries to the vault decisions log with the dual-numbering pattern. Use the same prose as the repo entries, prefixed with the vault numbering and a cross-reference back to repo numbering.

- [ ] **Step 2: Commit in the vault.**

```bash
cd ~/Obsidian/obsidian
git add "01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md"
git commit -m "[Agent: Claude] decisions: D89/D90 (= repo D93/D94) + K-note — synthesis page + mem: vocabulary"
```

### Task D.5: Update project MEMORY.md

**Files:**
- Modify: `.claude/memory/MEMORY.md`

- [ ] **Step 1: Update MEMORY with sprint completion.**

In the project's `.claude/memory/MEMORY.md`:
- Add a "Memory Structuring Sprint — shipped" section under the project state with the date and a summary
- Move "Memory Structuring Sprint" from Next Plans to a "Closed (2026-MM-DD)" subsection
- Reference D93, D94, K4 and link to this plan + the spec
- Update Next Plans #1 to be the shape-completion follow-on sprint, with Rung 1.5 as #2

- [ ] **Step 2: Commit.**

```bash
cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid
git add .claude/memory/MEMORY.md
git commit -m "[Agent: Claude] memory: Memory Structuring Sprint shipped (D93/D94/K4)"
```

### Task D.6: Final integration sweep

- [ ] **Step 1: Run the entire integration test suite.**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration/ -v --tb=short`
Expected: all PASS.

- [ ] **Step 2: Run all extension unit tests.**

Run:
```bash
for ext in markdown-render wiki-search mem-trigger; do
  echo "==> $ext"
  (cd css/extensions/$ext && npx vitest run)
done
```
Expected: all PASS.

- [ ] **Step 3: Final commit + sprint tag.**

```bash
git tag -a memory-structuring-sprint-complete \
        -m "Memory Structuring Sprint: synthesis + operations + notifications shipped"
```

Sprint complete.

---

## Self-review checklist

Run after the plan is committed:

1. **Spec coverage**: Each section of the spec (§A.1–§A.5, §B.1–§B.4, §C.1–§C.5, Details to Pin, HR-1..HR-6, Decisions to Ratify) maps to one or more tasks above.

2. **Placeholder scan**: No `TBD`/`TODO`/`fill in details` left in the plan. (One intentional reference in HR-5: the synthesis page can ship with placeholder prose — this is acknowledged in the spec.)

3. **Type consistency**: All `mem:*` class names match between Tasks B.1 (vocabulary definition), B.2-B.7 (affordances), B.9-B.14 (skills), C.5-C.9 (detectors), and D.2 (ratification). Verified by grep across tasks.

4. **Ambiguity scan**: Per-operation procedures are concretely specified in Tasks B.2-B.7 and the corresponding skills. WAC config for `.operations/` and `.events/` is in §C.1-§C.2 (and the spec's Details to Pin §2). Substrate-side write goes via in-process ResourceStore (not WebID-authenticated POST) per the spec clarification.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-18-memory-structuring-sprint.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for a sprint this size (≈50 tasks) because per-task scope is tight and review catches context drift early.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Better if you want me to handle the full sprint without per-task review overhead, with checkpoints at phase boundaries.

For a sprint this size, **subagent-driven is the safer choice**. Phase A and Phase B can largely run in serial; Phase C has more inter-task coupling (MemTriggerListener integrates many detectors) and may benefit from inline execution within Phase C.

Which approach?
