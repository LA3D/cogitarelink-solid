# View Layer (D107 §6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the view layer per `docs/superpowers/specs/2026-06-07-view-layer-design.md` — PROF-described per-resource views (`?_profile=doc|fused|graph|alt`), the conditional dynamic trailer on default GET, the 422 marker guard, the Person cross-cutting demonstrator at `/vault/views/people/`, and the overlay machinery to install profiles + view descriptors.

**Architecture:** One new CSS extension (`css/extensions/view-layer/`) holding a `ViewHttpHandler` (QSA interception before LdpHandler, modeled on `WikiSearchHttpHandler`), a `ViewSpaceHttpHandler` (the `/vault/views/people/` URL space), a `TrailerDecoratingStore` (PassthroughStore inserted ABOVE MonitoringStore so internal reads bypass it), and a `ViewAssembler` that executes the *declared* projection queries via embedded `@comunica/query-sparql` over explicit sources (declared-query, engine-executed — no hand-mirrored assembly). Plus: a string-marker guard in the existing `AdmissionFloorStore`, `overlay:installsProfile`/`overlay:installsView` parsing in the overlay scripts, and `sub:` vocabulary mints.

**Tech Stack:** TypeScript (CSS v8 extension, Components.js, componentsjs-generator, vitest), `@comunica/query-sparql` (plain, explicit sources — NOT link-traversal), N3.js, Python (overlay scripts, pytest integration tests, httpx, rdflib).

**Key spec deltas discovered during planning (already true in the codebase):**
- `css/extensions/profile-link/` ALREADY EXISTS with `ProfileLinkMetadataWriter` (reads `dct:conformsTo` from metadata → `Link: rel="profile"`) and `CurationLinkMetadataWriter`. Spec §7.2's "create profile-link extension" is ALREADY DONE; the remaining work is installing the 5 PROF profiles (Task 3) and ensuring `dct:conformsTo` lands in resource metadata (Task 3, Step 6).
- Store chain (top→bottom): `MonitoringStore → BinarySlice → Index → Locking → PatchingStore → AdmissionFloor → ShapeValidationStore → Converting → backend` (see `css/config/solid-config.json:64`). The trailer store wraps ABOVE MonitoringStore.

---

## File structure

```
overlays/wiki-memory/vocabulary/substrate.ttl        MODIFY  — sub: mints (Task 1)
overlays/wiki-memory/views/document.ttl              CREATE  — view descriptors (Task 2)
overlays/wiki-memory/views/fused.ttl                 CREATE
overlays/wiki-memory/views/graph.ttl                 CREATE
overlays/wiki-memory/views/people.ttl                CREATE
overlays/wiki-memory/views/fused-projection          CREATE  — SPARQL artifact (Task 2)
overlays/wiki-memory/views/people-projection         CREATE
overlays/wiki-memory/manifest.ttl                    MODIFY  — installsProfile/installsView (Task 3)
scripts/overlay/common.py                            MODIFY  — parse new predicates (Task 3)
scripts/overlay/apply.py                             MODIFY  — upload profiles/views (Task 3)
css/extensions/view-layer/                           CREATE  — extension (Tasks 4–9)
  package.json, tsconfig.json, vitest.config.ts
  src/index.ts
  src/uri.ts                                         — ?_profile= parsing
  src/ViewAssembler.ts                               — Comunica execution of declared queries
  src/ViewHttpHandler.ts                             — ?_profile= QSA routing
  src/ViewSpaceHttpHandler.ts                        — /vault/views/people/
  src/TrailerDecoratingStore.ts                      — conditional pod:notice trailer
  src/trailer.ts                                     — trailer rendering + marker constants
  tests/*.test.ts
css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts  MODIFY — marker guard (Task 10)
css/config/view-layer.json                           CREATE  — Components.js wiring (Task 11)
css/config/solid-config.json                         MODIFY  — import view-layer.json (Task 11)
css/Dockerfile                                       MODIFY  — build view-layer (Task 11)
Makefile                                             MODIFY  — JS_EXTENSIONS (Task 11)
tests/test_view_layer_integration.py                 CREATE  — live-Pod tests (Task 12)
overlays/wiki-memory/seed/...                        MODIFY  — sameAs bridge person (Task 12)
.claude/skills/decision-lookup/decisions.md          MODIFY  — D113 entry (Task 13)
.claude/skills/solid-profiles-and-conneg/references/deltas.md  MODIFY — installed status (Task 13)
FOLLOWUPS.md                                         MODIFY  — close items (Task 13)
```

Conventions every task must follow: fastai brevity for Python; existing extension idioms for TS (see `css/extensions/memento/` as the reference anatomy); commit after each task with `[Agent: Claude]` prefix + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `sub:` vocabulary mints

**Files:**
- Modify: `overlays/wiki-memory/vocabulary/substrate.ttl`

- [ ] **Step 1: Add the view-layer terms.** Append to `substrate.ttl` (after the existing affordance classes, keeping the file's prefix block which already defines `sub:`, `rdfs:`, `owl:`, `xsd:`, `skos:`):

```turtle
### View layer (D107 §6 / 2026-06-07 view-layer spec)

sub:View a rdfs:Class ;
    rdfs:subClassOf <http://www.w3.org/ns/dx/prof/Profile> ;
    rdfs:label "View" ;
    rdfs:comment "A negotiable representation of pod resources: a PROF profile whose role:mapping artifact is the declared projection query. Selected via ?_profile={token} (conneg-by-profile QSA)." .

sub:realization a rdf:Property ;
    rdfs:label "realization" ;
    rdfs:domain sub:View ;
    rdfs:comment "How the view is produced: sub:Virtual (assembled per request) or sub:Materialized (stored, rederivable)." .

sub:Virtual a sub:RealizationMode ;
    rdfs:label "virtual realization" .

sub:Materialized a sub:RealizationMode ;
    rdfs:label "materialized realization" .

sub:RealizationMode a rdfs:Class ;
    rdfs:label "realization mode" .

sub:writable a rdf:Property ;
    rdfs:label "writable" ;
    rdfs:domain sub:View ;
    rdfs:range xsd:boolean ;
    rdfs:comment "The lens law as data: a view is writable iff its get admits a well-behaved put. Lossy/derived views are read-only (writes get 405)." .

sub:servesAt a rdf:Property ;
    rdfs:label "serves at" ;
    rdfs:domain sub:View ;
    rdfs:comment "For cross-cutting views: the URL space (container) this view mints. Per-resource views (selected by ?_profile= on existing URLs) omit this." .
```

- [ ] **Step 2: Verify the file parses.**

Run: `~/uvws/.venv/bin/python -c "import rdflib; g=rdflib.Graph(); g.parse('overlays/wiki-memory/vocabulary/substrate.ttl', format='turtle'); print(len(g), 'triples')"`
Expected: triple count printed, no exception.

- [ ] **Step 3: Commit.**

```bash
git add overlays/wiki-memory/vocabulary/substrate.ttl
git commit -m "[Agent: Claude] vocab: sub:View/realization/writable/servesAt mints (view layer)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: View descriptors + projection artifacts

**Files:**
- Create: `overlays/wiki-memory/views/document.ttl`, `fused.ttl`, `graph.ttl`, `people.ttl`
- Create: `overlays/wiki-memory/views/fused-projection`, `people-projection` (extension-less; served `application/sparql-query`)

- [ ] **Step 1: Write the four descriptors.** Shared prefix block for all four:

```turtle
@prefix sub:  <https://pod.vardeman.me/vault/ontology/substrate#> .
@prefix prof: <http://www.w3.org/ns/dx/prof/> .
@prefix role: <http://www.w3.org/ns/dx/prof/role/> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
```

`document.ttl`:

```turtle
<https://pod.vardeman.me/vault/meta/views/document> a sub:View, prof:Profile ;
  dct:title "Document view" ;
  prof:hasToken "doc" ;
  sub:writable true ;
  sh:agentInstruction "The stored markdown body, byte-identical, with no server-managed trailer. This is the writable view: author here with GET/PUT/POST. ?_profile=doc is the pristine escape hatch when the default GET carries a pod:notice trailer." ;
  prof:isProfileOf <https://pod.vardeman.me/vault/meta/profiles/page> ;
  prof:isTransitiveProfileOf <https://pod.vardeman.me/vault/meta/profiles/page>, <https://solidproject.org/TR/protocol> .
```

`fused.ttl`:

```turtle
<https://pod.vardeman.me/vault/meta/views/fused> a sub:View, prof:Profile ;
  dct:title "Fused view" ;
  prof:hasToken "fused" ;
  prof:hasResource [ a prof:ResourceDescriptor ;
    prof:hasRole role:mapping ;
    skos:note "CONSTRUCT-as-view: the declared projection producing the graph component. The served fused representation is the stored body plus this projection's result serialized as a fenced Turtle section." ;
    dct:format "application/sparql-query" ;
    prof:hasArtifact <https://pod.vardeman.me/vault/meta/views/fused-projection> ] ;
  sub:realization sub:Virtual ;
  sub:writable false ;
  sh:agentInstruction "Body + governed graph + open actions in one text/markdown response. Read-only; author via the document view (plain GET/PUT on the resource URL). The graph section is fenced ```turtle after the body." ;
  prof:isProfileOf <https://pod.vardeman.me/vault/meta/profiles/page> ;
  prof:isTransitiveProfileOf <https://pod.vardeman.me/vault/meta/profiles/page>, <https://solidproject.org/TR/protocol> .
```

`graph.ttl`:

```turtle
<https://pod.vardeman.me/vault/meta/views/graph> a sub:View, prof:Profile ;
  dct:title "Graph view" ;
  prof:hasToken "graph" ;
  sub:realization sub:Virtual ;
  sub:writable false ;
  sh:agentInstruction "The resource's description-resource (.meta) content as text/turtle — same graph the describedby Link header points at. Read-only on this URL; agent enrichment goes through PATCH on the .meta resource itself (governed predicates are listener-owned)." ;
  prof:isProfileOf <https://pod.vardeman.me/vault/meta/profiles/page> ;
  prof:isTransitiveProfileOf <https://pod.vardeman.me/vault/meta/profiles/page>, <https://solidproject.org/TR/protocol> .
```

`people.ttl`:

```turtle
<https://pod.vardeman.me/vault/meta/views/people> a sub:View, prof:Profile ;
  dct:title "People view (cross-cutting demonstrator)" ;
  prof:hasToken "people" ;
  prof:hasResource [ a prof:ResourceDescriptor ;
    prof:hasRole role:mapping ;
    skos:note "CONSTRUCT joining wiki person .meta graphs with addressbook contacts over the schema:sameAs bridge. Sources enumerated via Type Index (schema:Person + vcard:Individual containers) — no source hardcode (D107)." ;
    dct:format "application/sparql-query" ;
    prof:hasArtifact <https://pod.vardeman.me/vault/meta/views/people-projection> ] ;
  sub:servesAt <https://pod.vardeman.me/vault/views/people/> ;
  sub:realization sub:Virtual ;
  sub:writable false ;
  sh:agentInstruction "One person, one URL, assembled from every container that knows them (wiki note + addressbook contact). Read-only: writes get 405 naming the writable homes. Each member lists its sources via rdfs:seeAlso." ;
  prof:isProfileOf <https://pod.vardeman.me/vault/meta/profiles/person> ;
  prof:isTransitiveProfileOf <https://pod.vardeman.me/vault/meta/profiles/person>, <https://pod.vardeman.me/vault/meta/profiles/page>, <https://solidproject.org/TR/protocol> .
```

- [ ] **Step 2: Write the projection artifacts.**

`fused-projection` (the whole description graph — fused = body ⊕ serialize(this)):

```sparql
# Fused-view graph component (declared query of record — executed by the
# server's ViewAssembler, the planned Pod MCP sparql tool, and any client
# engine; diffable against the served view for self-validation).
CONSTRUCT { ?s ?p ?o }
WHERE     { ?s ?p ?o }
```

`people-projection`:

```sparql
# Person-unification view (cross-cutting demonstrator).
# Joins wiki person descriptions with addressbook contacts over sameAs.
PREFIX schema: <https://schema.org/>
PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
CONSTRUCT {
  ?person ?p ?o .
  ?person rdfs:seeAlso ?contact .
  ?contact ?cp ?co .
}
WHERE {
  ?person a schema:Person ; ?p ?o .
  OPTIONAL {
    ?person schema:sameAs ?contact .
    ?contact ?cp ?co .
  }
}
```

- [ ] **Step 3: Verify all four descriptors parse** (same rdflib one-liner as Task 1 Step 2, against each `views/*.ttl`).

- [ ] **Step 4: Commit.**

```bash
git add overlays/wiki-memory/views/
git commit -m "[Agent: Claude] views: 4 PROF view descriptors + 2 declared projection artifacts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Overlay machinery — `installsProfile` + `installsView`

**Files:**
- Modify: `scripts/overlay/common.py` (parse), `scripts/overlay/apply.py` (upload)
- Modify: `overlays/wiki-memory/manifest.ttl` (declare)
- Test: `tests/test_overlay_manifest.py` (extend existing manifest tests if present; else create)

- [ ] **Step 1: Write failing parse test.**

```python
def test_manifest_parses_profiles_and_views():
    m = parse_manifest(Path("overlays/wiki-memory"))
    assert any(u.endswith("/vault/meta/profiles/page") for u in m.profile_urls)
    assert any(u.endswith("/vault/meta/views/fused") for u in m.view_urls)
    assert any(u.endswith("/vault/meta/views/fused-projection") for u in m.view_artifact_urls)
```

- [ ] **Step 2: Run it, verify failure** (`AttributeError: profile_urls`).

Run: `~/uvws/.venv/bin/python -m pytest tests/test_overlay_manifest.py -v -k profiles_and_views`

- [ ] **Step 3: Add parsing to `common.py`.** Mirror the existing `installsShape` structured-blank-node parsing (common.py lines ~202-214) exactly — three new Manifest fields populated from `OVERLAY.installsProfile`, `OVERLAY.installsView`, `OVERLAY.installsViewArtifact`, each supporting `[overlay:document <path>; overlay:hostedAt <url>]` blank nodes. Keep the document-path → hostedAt pairing (the uploader needs both), e.g.:

```python
@dataclass(frozen=True)
class HostedDocument:
    document: Path
    hosted_at: str
    content_type: str = "text/turtle"

# in parse_manifest:
def hosted(pred, ct="text/turtle"):
    out = []
    for node in many(pred):
        doc = next(g.objects(node, OVERLAY.document), None)
        ha = next(g.objects(node, OVERLAY.hostedAt), None)
        if doc and ha:
            out.append(HostedDocument(overlay_dir / str(doc), str(ha), ct))
    return out

profiles = hosted(OVERLAY.installsProfile)
views = hosted(OVERLAY.installsView)
view_artifacts = hosted(OVERLAY.installsViewArtifact, ct="application/sparql-query")
```

(Adapt names to the file's existing style; expose `profile_urls`/`view_urls`/`view_artifact_urls` properties returning the hosted_at strings so the test reads naturally.)

- [ ] **Step 4: Declare in `manifest.ttl`.** Add (matching the existing `installsShape` block style):

```turtle
  overlay:installsProfile
    [ overlay:document "profiles/page.ttl" ;      overlay:hostedAt <https://pod.vardeman.me/vault/meta/profiles/page> ],
    [ overlay:document "profiles/concept.ttl" ;   overlay:hostedAt <https://pod.vardeman.me/vault/meta/profiles/concept> ],
    [ overlay:document "profiles/source.ttl" ;    overlay:hostedAt <https://pod.vardeman.me/vault/meta/profiles/source> ],
    [ overlay:document "profiles/person.ttl" ;    overlay:hostedAt <https://pod.vardeman.me/vault/meta/profiles/person> ],
    [ overlay:document "profiles/procedure.ttl" ; overlay:hostedAt <https://pod.vardeman.me/vault/meta/profiles/procedure> ],
    [ overlay:document "profiles/working.ttl" ;   overlay:hostedAt <https://pod.vardeman.me/vault/meta/profiles/working> ] ;
  overlay:installsView
    [ overlay:document "views/document.ttl" ; overlay:hostedAt <https://pod.vardeman.me/vault/meta/views/document> ],
    [ overlay:document "views/fused.ttl" ;    overlay:hostedAt <https://pod.vardeman.me/vault/meta/views/fused> ],
    [ overlay:document "views/graph.ttl" ;    overlay:hostedAt <https://pod.vardeman.me/vault/meta/views/graph> ],
    [ overlay:document "views/people.ttl" ;   overlay:hostedAt <https://pod.vardeman.me/vault/meta/views/people> ] ;
  overlay:installsViewArtifact
    [ overlay:document "views/fused-projection" ;  overlay:hostedAt <https://pod.vardeman.me/vault/meta/views/fused-projection> ],
    [ overlay:document "views/people-projection" ; overlay:hostedAt <https://pod.vardeman.me/vault/meta/views/people-projection> ] ;
```

Also add `overlay:installsContainer "/vault/meta/views/"` and `"/vault/views/"` entries next to the existing container list. Add the new `overlay:` predicates to the overlay vocabulary file if one exists (grep `installsShape` to find it).

- [ ] **Step 5: Add upload calls to `apply.py`.** Next to the existing shape-upload loop:

```python
for hd in m.profiles + m.views + m.view_artifacts:
    put_file(client, hd.hosted_at, hd.document, hd.content_type)
```

(`ensure_container` for `/vault/meta/views/` first, same as shapes do.)

- [ ] **Step 6: dct:conformsTo materialization check.** `ProfileLinkMetadataWriter` reads `dct:conformsTo` from resource metadata. Check `css/extensions/markdown-projection/src/governedPredicates.ts` + the projector: if `dct:conformsTo` is not currently emitted into `.meta` on write, add it to `PAGE_GOVERNED_PREDICATES` and have the projector derive it from the resource's wiki class → profile IRI map (derive-the-inferable; the map is 6 entries mirroring `WIKI_CLASS_TO_THING_CLASS`):

```typescript
export const WIKI_CLASS_TO_PROFILE: Record<string, string> = {
  [WIKI + "Concept"]:      PODBASE + "/vault/meta/profiles/concept",
  [WIKI + "Source"]:       PODBASE + "/vault/meta/profiles/source",
  [WIKI + "Person"]:       PODBASE + "/vault/meta/profiles/person",
  [WIKI + "Procedure"]:    PODBASE + "/vault/meta/profiles/procedure",
  [WIKI + "WorkingNote"]:  PODBASE + "/vault/meta/profiles/working",
};
// fallback: PODBASE + "/vault/meta/profiles/page"
```

Add a vitest in `css/extensions/markdown-projection/tests/` asserting a projected Concept body yields `<> dct:conformsTo <…/profiles/concept>`.

- [ ] **Step 7: Run tests** (`pytest tests/test_overlay_manifest.py -v` and `npm test --prefix css/extensions/markdown-projection`). Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add scripts/overlay/ overlays/wiki-memory/manifest.ttl tests/test_overlay_manifest.py css/extensions/markdown-projection/
git commit -m "[Agent: Claude] overlay: installsProfile/installsView + dct:conformsTo derivation (closes D86 FOLLOWUP)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: view-layer extension scaffold

**Files:**
- Create: `css/extensions/view-layer/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`

- [ ] **Step 1: Copy scaffold from memento.** Copy `css/extensions/memento/{tsconfig.json,vitest.config.ts}` verbatim. Write `package.json` (memento's, adjusted):

```json
{
  "name": "view-layer",
  "version": "0.1.0",
  "main": "dist/index.js",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/view-layer",
  "lsd:components": "dist/components/components.jsonld",
  "scripts": {
    "build": "npm run build:ts && npm run build:components",
    "build:ts": "tsc --skipLibCheck",
    "build:components": "componentsjs-generator -s src -c dist/components",
    "test": "vitest run"
  },
  "dependencies": {
    "n3": "^1.17.0",
    "@comunica/query-sparql": "^4.0.0"
  },
  "peerDependencies": {
    "@solid/community-server": "*",
    "asynchronous-handlers": "*"
  },
  "devDependencies": {
    "@solid/community-server": "^8.0.0-alpha.3",
    "componentsjs-generator": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

(Pin `@comunica/query-sparql` to whatever major is current in `solid-agent-skills`' package.json for consistency; check there first.)

`src/index.ts`:

```typescript
export * from "./uri";
export * from "./trailer";
export * from "./ViewAssembler";
export * from "./ViewHttpHandler";
export * from "./ViewSpaceHttpHandler";
export * from "./TrailerDecoratingStore";
```

- [ ] **Step 2: `npm install --prefix css/extensions/view-layer` and verify `npm run build:ts` fails only on missing source files** (expected at this point — index.ts re-exports modules that don't exist yet; create empty stub files OR defer index.ts content to the end of Task 9; choose stubs: each named file exporting `export {};` so the scaffold builds green).

- [ ] **Step 3: Commit.**

```bash
git add css/extensions/view-layer/
git commit -m "[Agent: Claude] view-layer: extension scaffold

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: URI utilities + trailer rendering

**Files:**
- Create: `css/extensions/view-layer/src/uri.ts`, `src/trailer.ts`
- Test: `css/extensions/view-layer/tests/uri.test.ts`, `tests/trailer.test.ts`

- [ ] **Step 1: Write failing tests.**

`tests/uri.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getProfileToken, stripProfileQuery } from "../src/uri";

describe("getProfileToken", () => {
  it("extracts the token", () => {
    expect(getProfileToken("https://p.me/vault/wiki/concepts/x?_profile=fused")).toBe("fused");
  });
  it("handles other params", () => {
    expect(getProfileToken("https://p.me/r?a=1&_profile=doc")).toBe("doc");
  });
  it("returns undefined when absent", () => {
    expect(getProfileToken("https://p.me/r")).toBeUndefined();
  });
});

describe("stripProfileQuery", () => {
  it("removes only _profile", () => {
    expect(stripProfileQuery("https://p.me/r?a=1&_profile=doc")).toBe("https://p.me/r?a=1");
    expect(stripProfileQuery("https://p.me/r?_profile=doc")).toBe("https://p.me/r");
  });
});
```

`tests/trailer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderTrailer, TRAILER_MARKER } from "../src/trailer";

describe("renderTrailer", () => {
  it("renders count, ops, rationale, pointers", () => {
    const t = renderTrailer([{ op: "https://p.me/vault/wiki/.operations/op-17",
                               type: "mem:RealignAction",
                               rationale: "broader link targets a renamed concept" }]);
    expect(t).toContain(TRAILER_MARKER);
    expect(t).toContain("1 open action");
    expect(t).toContain(".operations/op-17");
    expect(t).toContain("renamed concept");
    expect(t).toContain("?_profile=fused");
    expect(t).toContain("?_profile=alt");
    expect(t).toContain("<!-- /pod:notice -->");
  });
  it("omits rationale line when absent", () => {
    const t = renderTrailer([{ op: "https://p.me/ops/op-1", type: "mem:RealignAction" }]);
    expect(t).not.toContain("— \"");
  });
});
```

- [ ] **Step 2: Run, verify FAIL** (`npm test --prefix css/extensions/view-layer`): modules export nothing.

- [ ] **Step 3: Implement.**

`src/uri.ts` (model on memento's `src/uri.ts` splitQuery idiom):

```typescript
export function getProfileToken(uri: string): string | undefined {
  const q = uri.split("?")[1];
  if (!q) return undefined;
  return new URLSearchParams(q).get("_profile") ?? undefined;
}

export function stripProfileQuery(uri: string): string {
  const [base, q] = uri.split("?");
  if (!q) return uri;
  const params = new URLSearchParams(q);
  params.delete("_profile");
  const rest = params.toString();
  return rest ? `${base}?${rest}` : base;
}
```

`src/trailer.ts`:

```typescript
export const TRAILER_MARKER = "<!-- pod:notice";
export const TRAILER_END = "<!-- /pod:notice -->";

export interface OpenAction {
  op: string;
  type: string;
  rationale?: string;
}

export function renderTrailer(actions: OpenAction[]): string {
  const n = actions.length;
  const lines = actions.map((a) =>
    `> ${a.type} <${a.op}>${a.rationale ? ` — "${a.rationale}"` : ""}`);
  return [
    "",
    `${TRAILER_MARKER} — server-managed; do not include this block in writes -->`,
    `> ⚠ ${n} open action${n === 1 ? "" : "s"} on this resource:`,
    ...lines,
    `> Full graph + state: ?_profile=fused · all views: ?_profile=alt`,
    TRAILER_END,
    "",
  ].join("\n");
}
```

- [ ] **Step 4: Run tests, verify PASS.**

- [ ] **Step 5: Commit.**

```bash
git add css/extensions/view-layer/src/uri.ts css/extensions/view-layer/src/trailer.ts css/extensions/view-layer/tests/
git commit -m "[Agent: Claude] view-layer: _profile parsing + pod:notice trailer rendering

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: ViewAssembler — declared-query, engine-executed

**Files:**
- Create: `css/extensions/view-layer/src/ViewAssembler.ts`
- Test: `css/extensions/view-layer/tests/ViewAssembler.test.ts`

- [ ] **Step 1: Write failing test** (unit; in-memory N3 store as the source — no HTTP):

```typescript
import { describe, it, expect } from "vitest";
import { Store, DataFactory } from "n3";
import { ViewAssembler } from "../src/ViewAssembler";
const { namedNode, quad, literal } = DataFactory;

const META = new Store([
  quad(namedNode("https://p.me/r"), namedNode("http://purl.org/dc/terms/title"), literal("T")),
  quad(namedNode("https://p.me/r#this"),
       namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"), literal("T")),
]);

describe("ViewAssembler", () => {
  it("executes a CONSTRUCT over an explicit store source", async () => {
    const a = new ViewAssembler();
    const quads = await a.construct("CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }", [META]);
    expect(quads.length).toBe(2);
  });

  it("serializes a fused document: body + fenced turtle", async () => {
    const a = new ViewAssembler();
    const doc = await a.fuse("# Title\n\nbody text\n",
      "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }", [META]);
    expect(doc.startsWith("# Title")).toBe(true);
    expect(doc).toContain("```turtle");
    expect(doc).toContain("prefLabel");
    expect(doc.trim().endsWith("```")).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement.**

```typescript
import { QueryEngine } from "@comunica/query-sparql";
import { Store, Writer } from "n3";
import type * as RDF from "@rdfjs/types";

/**
 * Executes declared projection queries (the view descriptors' role:mapping
 * artifacts) over EXPLICIT sources. Declared-query, engine-executed: the
 * same query text is runnable by the Pod MCP sparql tool and client
 * engines — no hand-mirrored assembly to drift (view-layer spec §3.1).
 */
export class ViewAssembler {
  private readonly engine = new QueryEngine();

  public async construct(query: string, sources: unknown[]): Promise<RDF.Quad[]> {
    const stream = await this.engine.queryQuads(query, {
      sources: sources as [any, ...any[]],
    });
    return stream.toArray();
  }

  public async serializeTurtle(quads: RDF.Quad[]): Promise<string> {
    const writer = new Writer({ format: "Turtle" });
    writer.addQuads(quads as any);
    return new Promise((resolve, reject) =>
      writer.end((err, out) => (err ? reject(err) : resolve(out))));
  }

  /** Fused document = stored body ⊕ fenced serialization of the projection result. */
  public async fuse(body: string, query: string, sources: unknown[]): Promise<string> {
    const quads = await this.construct(query, sources);
    const ttl = await this.serializeTurtle(quads);
    return `${body.replace(/\n*$/, "\n")}\n## Graph\n\n\`\`\`turtle\n${ttl.trim()}\n\`\`\`\n`;
  }
}
```

(If `queryQuads(...).toArray()` is not available in the pinned Comunica major, collect via `stream.on("data"/"end")` — check the version's API and keep whichever compiles.)

- [ ] **Step 4: Run tests, verify PASS.**

- [ ] **Step 5: Commit.**

```bash
git add css/extensions/view-layer/src/ViewAssembler.ts css/extensions/view-layer/tests/ViewAssembler.test.ts
git commit -m "[Agent: Claude] view-layer: ViewAssembler — declared CONSTRUCT executed via embedded Comunica

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: ViewHttpHandler — `?_profile=` routing

**Files:**
- Create: `css/extensions/view-layer/src/ViewHttpHandler.ts`
- Test: `css/extensions/view-layer/tests/ViewHttpHandler.test.ts`

Model the class on `css/extensions/wiki-search/src/WikiSearchHttpHandler.ts` (constructor deps, canHandle/handle split, DataAccessor-or-store reads, response writing). Behavior table:

| Request | Response |
|---|---|
| GET `r?_profile=doc` | 200, stored body verbatim, `Content-Type: text/markdown`, `Link: <…/views/document>; rel="profile"` |
| GET `r?_profile=fused` | 200 `text/markdown`: body + fenced turtle from fused-projection over the resource's `.meta` quads (+ `Link: rel="profile"` fused IRI) |
| GET `r?_profile=graph` | 200 `text/turtle`: the `.meta` content (+ profile Link) |
| GET `r?_profile=alt` | 200 `text/turtle`: the view catalog — for each applicable view: IRI, `prof:hasToken`, `sub:writable`, `sh:agentInstruction` (read the 4 descriptor resources via the store; cache 60s) |
| GET `r?_profile=<unknown>` | 400 with one-line body listing valid tokens |
| PUT/POST/PATCH/DELETE `r?_profile=…` | 405, `Allow: GET, HEAD, OPTIONS`, body: `"This is a read-only view. Author via the document view: plain PUT/PATCH on <stripped-url>."` |

- [ ] **Step 1: Write failing tests.** Cover: canHandle accepts GET with `_profile`, rejects without; doc returns body bytes; fused contains fenced turtle; graph returns turtle; alt lists 3+ tokens; unknown → 400; PUT → 405 with Allow header. Use the wiki-search test file as the harness template (mock store/accessor + `HttpResponse` capture — copy its mock setup).

```typescript
// tests/ViewHttpHandler.test.ts — representative assertions (full file mirrors
// the wiki-search test harness for mocks):
it("405s a PUT to a view", async () => {
  const res = await run({ method: "PUT", url: "/vault/wiki/concepts/x?_profile=fused" });
  expect(res.statusCode).toBe(405);
  expect(res.getHeader("Allow")).toBe("GET, HEAD, OPTIONS");
  expect(res.body).toContain("document view");
});
it("doc view is byte-identical to the stored body", async () => {
  const res = await run({ method: "GET", url: "/vault/wiki/concepts/x?_profile=doc" });
  expect(res.body).toBe(STORED_BODY);
});
it("fused view appends the graph section", async () => {
  const res = await run({ method: "GET", url: "/vault/wiki/concepts/x?_profile=fused" });
  expect(res.body.startsWith(STORED_BODY.trimEnd())).toBe(true);
  expect(res.body).toContain("```turtle");
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `ViewHttpHandler extends HttpHandler`.** Skeleton:

```typescript
export class ViewHttpHandler extends HttpHandler {
  public constructor(
    private readonly store: ResourceStore,        // urn:solid-server:default:ResourceStore_Monitoring — internal reads, no trailer
    private readonly assembler: ViewAssembler,
    private readonly baseUrl: string,
    private readonly viewsBase: string,           // https://…/vault/meta/views/
  ) { super(); }

  public async canHandle({ request }: HttpHandlerInput): Promise<void> {
    if (!getProfileToken(request.url ?? "")) throw new NotImplementedHttpError("no _profile");
  }

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {
    const url = new URL(request.url!, this.baseUrl).href;
    const token = getProfileToken(url)!;
    const resourceUrl = stripProfileQuery(url);
    if (request.method !== "GET" && request.method !== "HEAD") return this.send405(response, resourceUrl);
    switch (token) {
      case "doc":   return this.serveDoc(response, resourceUrl);
      case "fused": return this.serveFused(response, resourceUrl);
      case "graph": return this.serveGraph(response, resourceUrl);
      case "alt":   return this.serveAlt(response, resourceUrl);
      default:      return this.send400(response);
    }
  }
  // serveFused: body = readableToString(store.getRepresentation(resource));
  //   metaQuads = store.getRepresentation({path: resource + ".meta"}, INTERNAL_QUADS);
  //   query = readableToString(store.getRepresentation({path: viewsBase + "fused-projection"}));
  //   doc = assembler.fuse(body, query, [new Store(metaQuads)]);
  //   write 200 text/markdown + Link: <viewsBase + "fused">; rel="profile"
}
```

Each `serve*` is ~10 lines following wiki-search's response-writing idiom (`response.writeHead(200, {...}); response.end(body)`). `.meta` path derivation: use the `AuxiliaryStrategy`-consistent suffix the ops-index extension uses (`metaPath()` in `css/extensions/ops-index` — import-copy the helper, it's 3 lines).

- [ ] **Step 4: Run tests, verify PASS.**

- [ ] **Step 5: Commit.**

```bash
git add css/extensions/view-layer/src/ViewHttpHandler.ts css/extensions/view-layer/tests/ViewHttpHandler.test.ts
git commit -m "[Agent: Claude] view-layer: ViewHttpHandler — ?_profile= QSA routing (doc/fused/graph/alt, 405 writes)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: ViewSpaceHttpHandler — `/vault/views/people/`

**Files:**
- Create: `css/extensions/view-layer/src/ViewSpaceHttpHandler.ts`
- Test: `css/extensions/view-layer/tests/ViewSpaceHttpHandler.test.ts`

- [ ] **Step 1: Write failing tests.** GET container → Turtle listing one member per person found via Type Index; GET member slug → Turtle person card (CONSTRUCT result for that person, `rdfs:seeAlso` both homes); GET unknown slug → 404; PUT/POST/PATCH → 405 with body naming writable homes; canHandle only for URLs under `/vault/views/`.

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement.** `ViewSpaceHttpHandler extends HttpHandler`:
  - `canHandle`: URL pathname starts with `/vault/views/` (constructor param `viewSpaceRoot`).
  - Source enumeration (no hardcode, D107): GET the publicTypeIndex via the store (`/vault/settings/publicTypeIndex`), collect `solid:instanceContainer` for `solid:forClass schema:Person` (wiki) and `vcard:Individual` (addressbook); list each container's `ldp:contains`; sources = members' `.meta` for markdown resources + the contact RDF resources themselves. Cache the source list 60s.
  - GET container: run people-projection via `ViewAssembler.construct(query, sources)`; emit one `ldp:contains` entry per distinct `?person` subject, slug = last path segment of the wiki resource.
  - GET member: filter the same CONSTRUCT result to the person whose slug matches; 404 if none; serialize Turtle.
  - Writes: 405 + `Allow: GET, HEAD, OPTIONS` + instruction body: `"Derived read-only view. Author at the wiki note (…/wiki/people/<slug>) or the contact resource (rdfs:seeAlso in this graph)."`

- [ ] **Step 4: Run tests, verify PASS.**

- [ ] **Step 5: Commit.**

```bash
git add css/extensions/view-layer/src/ViewSpaceHttpHandler.ts css/extensions/view-layer/tests/ViewSpaceHttpHandler.test.ts
git commit -m "[Agent: Claude] view-layer: ViewSpaceHttpHandler — /vault/views/people/ cross-cutting demonstrator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: TrailerDecoratingStore

**Files:**
- Create: `css/extensions/view-layer/src/TrailerDecoratingStore.ts`
- Test: `css/extensions/view-layer/tests/TrailerDecoratingStore.test.ts`
- Modify: `css/extensions/view-layer/src/index.ts` (replace stubs with real re-exports)

- [ ] **Step 1: Write failing tests.**

```typescript
// Mock source store; representations built with BasicRepresentation.
it("appends the trailer when metadata has mem:hasOpenAction and type is text/markdown", async () => {
  const rep = await store.getRepresentation({ path: RESOURCE }, {});
  const body = await readableToString(rep.data);
  expect(body).toContain("<!-- pod:notice");
  expect(body).toContain("op-17");
});
it("is byte-identical when no open action exists", async () => {
  const rep = await store.getRepresentation({ path: CLEAN_RESOURCE }, {});
  expect(await readableToString(rep.data)).toBe(STORED_BODY);
});
it("never decorates auxiliary (.meta) or non-markdown representations", async () => {
  const rep = await store.getRepresentation({ path: RESOURCE + ".meta" }, {});
  expect(await readableToString(rep.data)).not.toContain("pod:notice");
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** (model constructor/injection on `AdmissionFloorStore`):

```typescript
export class TrailerDecoratingStore extends PassthroughStore {
  public constructor(
    source: ResourceStore,
    private readonly auxiliaryStrategy: AuxiliaryStrategy,
  ) { super(source); }

  public async getRepresentation(id, prefs, conditions?): Promise<Representation> {
    const rep = await super.getRepresentation(id, prefs, conditions);
    if (this.auxiliaryStrategy.isAuxiliaryIdentifier(id)) return rep;
    if (rep.metadata.contentType !== "text/markdown") return rep;
    const actions = rep.metadata.getAll(MEM_HAS_OPEN_ACTION);   // same constant as CurationLinkMetadataWriter
    if (actions.length === 0) return rep;
    const body = await readableToString(rep.data);
    const open = await Promise.all(actions.map(async (a) => ({
      op: a.value,
      type: "mem:RealignAction",
      rationale: await this.rationaleOf(a.value),               // internal read; undefined on any error
    })));
    const decorated = body + renderTrailer(open);
    return new BasicRepresentation(decorated, rep.metadata);
  }

  private async rationaleOf(opUrl: string): Promise<string | undefined> {
    try {
      const rep = await this.source.getRepresentation({ path: opUrl }, { type: { [INTERNAL_QUADS]: 1 }});
      const store = await readableToQuads(rep.data);
      return store.getObjects(namedNode(opUrl), namedNode(MEM + "rationale"), null)[0]?.value;
    } catch { return undefined; }
  }
}
```

Note for the executor: `mem:hasOpenAction` reaches `rep.metadata` because `OperationsIndexListener` writes the back-pointer into the target's `.meta` and CSS folds `.meta` into `RepresentationMetadata` on GET — this is exactly the channel `CurationLinkMetadataWriter` already reads (`css/extensions/profile-link/src/CurationLinkMetadataWriter.ts:25-37`). Import `MEM_HAS_OPEN_ACTION` from a shared constants location or re-declare the IRI string identically.

- [ ] **Step 4: Run tests, verify PASS. Replace index.ts stubs; `npm run build` green.**

- [ ] **Step 5: Commit.**

```bash
git add css/extensions/view-layer/
git commit -m "[Agent: Claude] view-layer: TrailerDecoratingStore — conditional pod:notice on default GET

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: AdmissionFloorStore marker guard

**Files:**
- Modify: `css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts` (in `setRepresentation`, right after `readableToString(representation.data)` at ~line 143)
- Test: `css/extensions/shape-validator/tests/` (add to the existing AdmissionFloorStore test file)

- [ ] **Step 1: Write failing test.**

```typescript
it("422-rejects a body containing the server-managed pod:notice marker", async () => {
  const body = "---\ntype: Concept\n---\n# X\n\n<!-- pod:notice — copied --> stale\n";
  await expect(store.setRepresentation(id, asRepresentation(body)))
    .rejects.toThrow(/pod:notice|server-managed/);
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement.** After the body is read, before `projector.project()`:

```typescript
const POD_NOTICE_MARKER = "<!-- pod:notice";
if (body.includes(POD_NOTICE_MARKER)) {
  throw new UnprocessableEntityHttpError(
    "Body contains the server-managed <!-- pod:notice --> region. " +
    "This block is generated at serve time and must not be written back. " +
    "Re-fetch the pristine body with ?_profile=doc; make your assertion in prose, " +
    "typed wikilinks, or a PATCH to the .meta resource.");
}
```

(Use the same HttpError class family the file already imports for 422s — match `ShaclValidationError`'s status mechanics; a plain `UnprocessableEntityHttpError` from `@solid/community-server` is fine since no SHACL report applies.)

- [ ] **Step 4: Run shape-validator tests, verify PASS** (`npm test --prefix css/extensions/shape-validator`).

- [ ] **Step 5: Commit.**

```bash
git add css/extensions/shape-validator/
git commit -m "[Agent: Claude] floor: 422 marker guard — pod:notice region is server-managed (no silent strip)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Components.js wiring + build integration

**Files:**
- Create: `css/config/view-layer.json`
- Modify: `css/config/solid-config.json` (import), `css/Dockerfile`, `Makefile`

- [ ] **Step 1: Write `css/config/view-layer.json`.** Model every block on the named precedents:

```jsonc
{
  "@context": [ /* copy context array from css/config/memento.json, plus the view-layer bundle context */ ],
  "import": [],
  "@graph": [
    {
      "comment": "ViewHttpHandler — ?_profile= QSA conneg (view-layer spec §4). Inserted BEFORE LdpHandler like WikiSearchHttpHandler (memento.json:26-31). Store ref = ResourceStore_Monitoring: internal reads must NOT pass through the trailer decorator.",
      "@id": "urn:cogitarelink:ViewHttpHandler",
      "@type": "ViewHttpHandler",
      "store": { "@id": "urn:solid-server:default:ResourceStore_Monitoring" },
      "assembler": { "@id": "urn:cogitarelink:ViewAssembler" },
      "baseUrl": { "@id": "urn:solid-server:default:variable:baseUrl" },
      "viewsBase": "https://pod.vardeman.me/vault/meta/views/"
    },
    { "@id": "urn:cogitarelink:ViewAssembler", "@type": "ViewAssembler" },
    {
      "comment": "ViewSpaceHttpHandler — /vault/views/ cross-cutting URL space (spec §6).",
      "@id": "urn:cogitarelink:ViewSpaceHttpHandler",
      "@type": "ViewSpaceHttpHandler",
      "store": { "@id": "urn:solid-server:default:ResourceStore_Monitoring" },
      "assembler": { "@id": "urn:cogitarelink:ViewAssembler" },
      "baseUrl": { "@id": "urn:solid-server:default:variable:baseUrl" },
      "viewSpaceRoot": "/vault/views/"
    },
    {
      "comment": "Insert both handlers BEFORE LdpHandler (one Override per K1).",
      "@type": "Override", "overrideInstance": { "@id": "urn:solid-server:default:HandlersWaterfall" },
      "overrideSteps": [
        { "@type": "OverrideListInsertBefore", "overrideParameter": { "@id": "ah:dist/WaterfallHandler.jsonld#WaterfallHandler_handlers" },
          "overrideTarget": { "@id": "urn:solid-server:default:LdpHandler" },
          "overrideValue": { "@id": "urn:cogitarelink:ViewHttpHandler" } },
        { "@type": "OverrideListInsertBefore", "overrideParameter": { "@id": "ah:dist/WaterfallHandler.jsonld#WaterfallHandler_handlers" },
          "overrideTarget": { "@id": "urn:solid-server:default:LdpHandler" },
          "overrideValue": { "@id": "urn:cogitarelink:ViewSpaceHttpHandler" } }
      ]
    },
    {
      "comment": "TrailerDecoratingStore ABOVE MonitoringStore: only the outbound LDP read path sees the trailer; listeners/projector/handlers referencing ResourceStore_Monitoring or deeper bypass it (spec §4.3). Mirrors the AdmissionFloor insertion idiom (solid-config.json:64).",
      "@type": "Override",
      "overrideInstance": { "@id": "urn:solid-server:default:ResourceStore" },
      "overrideParameters": {
        "@type": "TrailerDecoratingStore",
        "source": { "@id": "urn:solid-server:default:ResourceStore_Monitoring" },
        "auxiliaryStrategy": { "@id": "urn:solid-server:default:AuxiliaryStrategy" }
      }
    }
  ]
}
```

**Executor caution:** the exact `@id` of the top-level store alias and the waterfall instance differ between CSS configs — *verify against the live names* with `grep -n "ResourceStore_Monitoring\|StatusWaterfallHandler\|default:ResourceStore\b" css/config/*.json` and against how `memento.json` addresses the waterfall (`StatusWaterfallHandler_handlers`). Copy the working idiom, don't trust this sketch's IDs over the repo's.

- [ ] **Step 2: Register the config + build.**
  - Add `view-layer.json` to the config import list (wherever `memento.json` is imported — `grep -rn "memento.json" css/config/ docker-compose.yml`).
  - Dockerfile: replicate the memento block (COPY → npm install → npm run build → symlink `@solid/community-server` → symlink into `node_modules`) for `extensions/view-layer`, placed after the memento block (`css/Dockerfile:71-87` as template).
  - Makefile: add `css/extensions/view-layer \` to `JS_EXTENSIONS`.

- [ ] **Step 3: Verify boot.**

Run: `make reset` (the only honest verification — fresh volume, overlay apply, all extensions).
Expected: CSS boots clean (no Components.js resolution errors in `docker compose logs css | head -50`), `curl -sk https://pod.vardeman.me/vault/ -o /dev/null -w '%{http_code}'` → 200.

- [ ] **Step 4: Run `make test-js`.** Expected: all extension suites pass.

- [ ] **Step 5: Commit.**

```bash
git add css/config/ css/Dockerfile Makefile
git commit -m "[Agent: Claude] view-layer: Components.js wiring — handlers before LdpHandler, trailer store above Monitoring

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Integration tests + seed bridge

**Files:**
- Create: `tests/test_view_layer_integration.py`
- Modify: wiki-memory seed content — add a person with a `schema:sameAs` bridge (find the seed person notes via `grep -rln "wiki/people" overlays/wiki-memory/` and add the sameAs to one's frontmatter/body span per the existing grammar; `schema:sameAs` is already in the COMMON governed set)

- [ ] **Step 1: Write the tests** (copy header/idioms — `_pod_up`, `resolve_ca`, `pytestmark` — from `tests/test_admission_floor_integration.py`):

```python
import httpx, pytest
from conftest import _pod_up, resolve_ca, POD_URL

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")
C = lambda: httpx.Client(verify=resolve_ca(), timeout=15)
R = f"{POD_URL}/vault/wiki/concepts/view-layer-e2e.md"
BODY = '---\ntype: Concept\n---\n# View Layer E2E\n\n[View Layer E2E]{.prefLabel} test page.\n'

def setup_module():
    with C() as c:
        c.put(R, content=BODY, headers={"Content-Type": "text/markdown"})

def test_default_get_pristine_when_no_open_action():
    with C() as c:
        assert c.get(R).text == BODY

def test_profile_doc_byte_identical():
    with C() as c:
        assert c.get(f"{R}?_profile=doc").text == BODY

def test_profile_fused_contains_body_and_graph():
    with C() as c:
        t = c.get(f"{R}?_profile=fused").text
        assert t.startswith("---") and "```turtle" in t and "prefLabel" in t

def test_profile_graph_is_turtle():
    with C() as c:
        r = c.get(f"{R}?_profile=graph")
        assert "turtle" in r.headers["content-type"] and "prefLabel" in r.text

def test_profile_alt_lists_tokens():
    with C() as c:
        t = c.get(f"{R}?_profile=alt").text
        for tok in ("doc", "fused", "graph"):
            assert f'"{tok}"' in t

def test_view_write_405():
    with C() as c:
        r = c.put(f"{R}?_profile=fused", content="x", headers={"Content-Type": "text/markdown"})
        assert r.status_code == 405 and "document view" in r.text

def test_marker_guard_422():
    with C() as c:
        bad = BODY + "\n<!-- pod:notice — imitated -->\n"
        r = c.put(f"{POD_URL}/vault/wiki/concepts/view-layer-e2e-marker.md",
                  content=bad, headers={"Content-Type": "text/markdown"})
        assert r.status_code == 422 and "server-managed" in r.text

def test_profile_link_header_present():
    with C() as c:
        links = c.get(R).headers.get_list("link")
        assert any('rel="profile"' in l for l in links)

def test_trailer_appears_with_open_action():
    # Seed a mem:RealignAction targeting R in the .operations ledger
    # (copy the exact proposal Turtle from the D112 integration fixture:
    #  grep -rn "RealignAction" tests/ for the working POST pattern),
    # then GET R and assert the trailer.
    op = seed_realign_action(target=R)            # helper: POST to /vault/wiki/.operations/
    with C() as c:
        t = c.get(R).text
        assert "<!-- pod:notice" in t and op.split("/")[-1] in t
        assert c.get(f"{R}?_profile=doc").text == BODY   # escape hatch stays pristine

def test_people_view_unifies_wiki_and_contact():
    with C() as c:
        listing = c.get(f"{POD_URL}/vault/views/people/", headers={"Accept": "text/turtle"})
        assert listing.status_code == 200 and "ldp" in listing.text
        # the seeded bridge person appears with both homes
        slug = "BRIDGE_PERSON_SLUG"  # set to the seeded person's slug in Step 2
        card = c.get(f"{POD_URL}/vault/views/people/{slug}").text
        assert "seeAlso" in card and "/contacts/" in card

def test_people_view_write_405():
    with C() as c:
        r = c.put(f"{POD_URL}/vault/views/people/x", content="x",
                  headers={"Content-Type": "text/turtle"})
        assert r.status_code == 405
```

Implement `seed_realign_action` by copying the proposal-document POST from the existing D112 integration tests (`grep -rn "RealignAction\|\.operations" tests/*.py`).

- [ ] **Step 2: Seed the bridge person.** Pick/add one wiki person seed with a body span or frontmatter producing `<#this> schema:sameAs <…/vault/contacts/people/…>` (grammar already supports it — `schema:sameAs` is COMMON-governed). Set `BRIDGE_PERSON_SLUG` accordingly. `make reset` to redeploy seeds.

- [ ] **Step 3: Run the suite.**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_view_layer_integration.py -v`
Expected: all PASS against the live Pod.

- [ ] **Step 4: Full verification:** `make test` (Pod-up) AND `make audit` (expect 0 ERROR; the 1 known intentional WARN).

- [ ] **Step 5: Commit.**

```bash
git add tests/test_view_layer_integration.py overlays/wiki-memory/
git commit -m "[Agent: Claude] view-layer: e2e integration suite + sameAs bridge person seed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Documentation + decision record

**Files:**
- Modify: `.claude/skills/decision-lookup/decisions.md` (new D113 entry), `FOLLOWUPS.md`, `.claude/skills/solid-profiles-and-conneg/references/deltas.md`, `.claude/memory/MEMORY.md`

- [ ] **Step 1: D113 entry** in decisions.md (match the existing one-paragraph house style): view layer shipped per `docs/superpowers/specs/2026-06-07-view-layer-design.md` — A′ default GET (conditional pod:notice trailer + 422 marker guard, never silent strip); doc/fused/graph PROF views via `?_profile=` QSA + `?_profile=alt`; declared-query engine-executed (embedded `@comunica/query-sparql`, explicit sources; D3/D29 intact — no SPARQL HTTP endpoint); lens-law writability as data (`sub:writable`); Person cross-cutting demonstrator at `/vault/views/people/` (`sub:servesAt`); profiles finally installed (closes D86 FOLLOWUP). Eval pending: re-run of the D112 Probe-2 read-path probe — passing leaves RQ-Substrate-4 closeable.

- [ ] **Step 2: FOLLOWUPS.md** — close the `overlay:installsProfile` and D86 Link-rel-profile items; add: "view-layer cold probe (D112 Probe-2 re-run) pending"; add "`?_profile=` + `Accept-Profile` header parse parity" if Accept-Profile was deferred.

- [ ] **Step 3: deltas.md** (profiles-and-conneg skill) — update "committed but not auto-installed" to installed-by-overlay; note `?_profile=alt` now live; list the 4 view profiles alongside the 6 class profiles.

- [ ] **Step 4: MEMORY.md** — update the "▶ NEXT" pointer: view layer BUILT; next = the cold-probe re-run.

- [ ] **Step 5: Commit.**

```bash
git add .claude/skills/decision-lookup/decisions.md FOLLOWUPS.md .claude/skills/solid-profiles-and-conneg/references/deltas.md .claude/memory/MEMORY.md
git commit -m "[Agent: Claude] docs: D113 view-layer decision record + FOLLOWUPS/deltas/MEMORY sync

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes (done at plan-writing time)

- **Spec coverage:** §3 formalism → Tasks 1–2; §3.1 engine-execution → Task 6; §4.1 inventory → Tasks 2, 7; §4.2 selection/advertisement → Tasks 3 (conformsTo), 7 (alt + profile Links), 11; §4.3 trailer → Tasks 5, 9; §5 write path → Tasks 7 (405), 10 (422); §6 demonstrator → Tasks 2, 8, 12; §7 map → Tasks 4, 11; §8 eval hook → recorded as pending in Task 13 (the probe itself is a separate session per the cold-probe rig pattern). `Accept-Profile` parsing (spec §4.2, "parsed if present") is NOT tasked — deliberately deferred to FOLLOWUPS (Task 13 Step 2): no floor consumer sends it, and the QSA path is the WD MUST.
- **Known uncertainty, flagged inline:** exact Components.js `@id`s for the top store alias and waterfall (Task 11 caution note); Comunica `queryQuads().toArray()` API surface (Task 6 note); whether `dct:conformsTo` already projects (Task 3 Step 6 starts with a check).
- **Type consistency:** `ViewAssembler.construct/fuse` signatures match between Tasks 6–8; `TRAILER_MARKER`/`renderTrailer` between Tasks 5, 9, 10; `HostedDocument` fields between Task 3 steps.
