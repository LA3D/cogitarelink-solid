# Two-Hierarchy Wikilink Resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve a wikilink target's container from the predicate's entailed class via the Type Index (D106), replacing the interim role→container default, with the entailment hosted **on the Pod** as the single source of truth and a minimal built-in kernel that bootstraps a fresh Pod.

**Architecture:** The pure projector maps `hint → predicate` (unchanged) then `predicate → entailed class` then `class → container` (by inverting the live Type Index). The `predicate → class` entailment is a JSON-LD doc on the Pod (`/vault/meta/routing.jsonld`, modeled with `wiki:routesToClass`); the listener loads it at runtime exactly as it loads the Type Index, falling back to a minimal **built-in kernel** before it loads. No write-time network I/O in the pure pipeline; no second copy of the map. Forward/cross-container refs mint a best-effort IRI whose container path encodes the expected class; the curator reconciles divergence. A Python sanity-check reads the Pod doc and enforces Type-Index coverage + published-range agreement.

**Tech Stack:** TypeScript (CSS extension, N3.js, vitest), Python 3.12 (pod_audit, rdflib JSON-LD, pyshacl, httpx, pytest), Docker (`make reset`).

**Spec:** `docs/superpowers/specs/2026-05-26-two-hierarchy-resolver-design.md`

---

## Confirmed plan-time decisions (resolved with user 2026-05-26)

1. **Spec §7 `wiki:expectedClass` edge annotation → container-path encoding.** Edge annotation needs RDF-star (N3.js uncertain) or reification (blank nodes rejected by N3 Patch). The minted target IRI's container path already encodes the expected class losslessly; the curator detects divergence. No `<target> a Class` ever emitted (D81-safe). **Revisit when RDF 1.2 + tooling lands** — do not hand-roll RDF-star now.

2. **Single source of truth = the Pod, not a repo file.** The `predicate → class` entailment lives in `/vault/meta/routing.jsonld` (JSON-LD: plain JSON to config consumers, RDF to agents). The projector reads it at runtime (like the Type Index); `pod_audit` reads it over HTTP. **No Python mirror.** This unlocks L4 extensibility: an extension adds an entailment by PATCHing `routing.jsonld` — no image rebuild (D100).

3. **Minimal built-in kernel (Option B) = the opinionated minimum agentic-memory substrate.** The projector ships a small `BOOTSTRAP_PREDICATE_TO_CLASS` used before the Pod doc loads (startup grace) or if it 404s. This is not a maintained mirror — it is the minimum structure that makes a freshly-minted Pod usable as agentic memory with guardrails intact, same status as `DEFAULT_WIKI_TYPE_INDEX`. The Pod's `routing.jsonld` **extends** the kernel; it does not replace the kernel's role as bootstrap.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `overlays/wiki-memory/vocabulary/wiki.ttl` | Mint `wiki:routesToClass` (FAIR metadata, D97) | Modify |
| `overlays/wiki-memory/<meta>/routing.jsonld` | The `predicate → class` entailment doc (Pod SoT) | Create |
| `overlays/wiki-memory/manifest.ttl` + `scripts/overlay/*.py` | Deploy `routing.jsonld` to `/vault/meta/` (mirror `context.jsonld` deploy) | Modify |
| `css/extensions/markdown-projection/src/wikilinkProjection.ts` | `BOOTSTRAP_PREDICATE_TO_CLASS` kernel, `classToContainerSegment`, class-driven `targetContainer`, injected `predicateToClass` | Modify |
| `css/extensions/markdown-projection/src/routingLoader.ts` | Fetch + parse `routing.jsonld` → `Record<predicate,class>` (CURIE-expand, no JSON-LD processor) | Create |
| `css/extensions/markdown-projection/src/projectionPipeline.ts` | Thread `typeIndex` + `predicateToClass` into `projectWikilinks` | Modify (line 152) |
| `css/extensions/markdown-projection/src-cjs/listener.ts` | Load routing doc at runtime (mirror `TypeIndexLoader`), inject into pipeline | Modify |
| `css/extensions/markdown-projection/test/*.test.ts` | Unit tests (pure: inject the map) | Modify/Create |
| `scripts/pod_audit.py` | `--check-routing`: GET+parse `routing.jsonld`, coverage ERROR + range WARN | Modify |
| `tests/test_pod_audit_routing.py` + `tests/fixtures/routing.jsonld` | pytest with a JSON-LD **fixture** (test data, not a map mirror) | Create |
| `tests/integration/test_two_hierarchy_resolver.py` | Live routing + extensibility (PATCH adds entailment, no rebuild) | Create |
| storage-description config (Task 11 pick) + dogfood doc | Self-description (§8) | Modify/Create |
| `docs/plans/2026-05-26-two-hierarchy-eval.md` | Cold trap-based eval (§9) | Create |

---

## PHASE 0 — Substrate artifacts (Pod as source of truth)

### Task 1: Mint `wiki:routesToClass` with FAIR metadata

**Files:**
- Modify: `overlays/wiki-memory/vocabulary/wiki.ttl`

- [ ] **Step 1: Add the property** (after an existing `wiki:` property block; match the file's prefix style):

```turtle
wiki:routesToClass
    a rdf:Property ;
    rdfs:label "routes to class"@en ;
    rdfs:comment "Substrate-scoped addressing relation: a wikilink edge using this predicate routes its target resource into the container registered (in the Type Index) for the named class. This is NOT a global rdfs:range claim about the predicate — it is this Pod's routing entailment (D106). The target's authoritative type remains the target's own <#this> a … (D81)."@en ;
    rdfs:isDefinedBy <https://pod.vardeman.me/vault/ontology/wiki> ;
    rdfs:domain rdf:Property ;
    rdfs:range rdfs:Class ;
    dct:conformsTo <http://www.w3.org/2000/01/rdf-schema> ;
    dct:created "2026-05-26"^^xsd:date ;
    dct:creator <https://orcid.org/0000-0003-4091-6059> .
```

- [ ] **Step 2: Sync the validator TBox bundle if `wiki.ttl` is bundled**

Run: `make check-validator-tbox`
If it reports drift (it bundles `mem.ttl`/`as-subclass-axioms.ttl`, not `wiki.ttl` — likely clean): `make sync-validator-tbox`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add overlays/wiki-memory/vocabulary/wiki.ttl
git commit -m "[Agent: Claude] wiki.ttl: mint wiki:routesToClass (substrate routing relation, D106)"
```

### Task 2: Create `routing.jsonld` + wire into the overlay deploy

**Files:**
- Create: `overlays/wiki-memory/<meta>/routing.jsonld` (place beside the source that deploys to `/vault/meta/context.jsonld`)
- Modify: `overlays/wiki-memory/manifest.ttl`, `scripts/overlay/common.py` + `scripts/overlay/apply.py`

- [ ] **Step 1: Write the doc** (the minimal kernel entailments — same set as the built-in kernel in Task 3):

```json
{
  "@context": {
    "wiki":   "https://pod.vardeman.me/vault/ontology/wiki#",
    "schema": "https://schema.org/",
    "dct":    "http://purl.org/dc/terms/",
    "routesToClass": { "@id": "wiki:routesToClass", "@type": "@id" }
  },
  "@graph": [
    { "@id": "schema:affiliation", "routesToClass": "schema:Organization" },
    { "@id": "schema:location",    "routesToClass": "schema:Place" },
    { "@id": "dct:contributor",    "routesToClass": "schema:Person" }
  ]
}
```

- [ ] **Step 2: Find the deploy analog**

Run: `grep -n "context.jsonld" overlays/wiki-memory/manifest.ttl scripts/overlay/common.py scripts/overlay/apply.py`
Expected: locate how `/vault/meta/context.jsonld` is declared + uploaded.

- [ ] **Step 3: Wire `routing.jsonld` the same way** — add the manifest declaration and the upload step mirroring `context.jsonld`, targeting `/vault/meta/routing.jsonld` with `Content-Type: application/ld+json`.

- [ ] **Step 4: Verify on a fresh volume** (deferred to Task 8's `make reset`; for now a unit check that `apply.py` parses the manifest without error):

Run: `~/uvws/.venv/bin/python -c "from scripts.overlay import common; print('manifest parses')"` (adjust to the actual parse entrypoint surfaced in Step 2).
Expected: no error.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/manifest.ttl scripts/overlay/common.py scripts/overlay/apply.py overlays/wiki-memory
git commit -m "[Agent: Claude] overlay: deploy /vault/meta/routing.jsonld (predicate→class entailment, Pod SoT)"
```

---

## PHASE 1 — Resolver (pure TS, TDD)

### Task 3: `BOOTSTRAP_PREDICATE_TO_CLASS` kernel + class→container inversion

**Files:**
- Modify: `css/extensions/markdown-projection/src/wikilinkProjection.ts`
- Test: `css/extensions/markdown-projection/test/wikilinkProjection.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import {
    projectWikilinks, HINT_TO_PROJECTION,
    BOOTSTRAP_PREDICATE_TO_CLASS, classToContainerSegment,
} from "../src/wikilinkProjection.js";

describe("BOOTSTRAP_PREDICATE_TO_CLASS (D106 minimal kernel)", () => {
    it("affiliation→Organization, location→Place, contributor→Person", () => {
        expect(BOOTSTRAP_PREDICATE_TO_CLASS["https://schema.org/affiliation"]).toBe("https://schema.org/Organization");
        expect(BOOTSTRAP_PREDICATE_TO_CLASS["https://schema.org/location"]).toBe("https://schema.org/Place");
        expect(BOOTSTRAP_PREDICATE_TO_CLASS["http://purl.org/dc/terms/contributor"]).toBe("https://schema.org/Person");
    });
    it("does not entail a class for skos:related", () => {
        expect(BOOTSTRAP_PREDICATE_TO_CLASS["http://www.w3.org/2004/02/skos/core#related"]).toBeUndefined();
    });
});

describe("classToContainerSegment (inverts container→class Type Index)", () => {
    const typeIndex = {
        "/vault/wiki/concepts/":      "http://www.w3.org/2004/02/skos/core#Concept",
        "/vault/wiki/organizations/": "https://schema.org/Organization",
    };
    it("maps schema:Organization → 'organizations'", () => {
        expect(classToContainerSegment("https://schema.org/Organization", typeIndex)).toBe("organizations");
    });
    it("returns undefined for an unregistered class", () => {
        expect(classToContainerSegment("https://schema.org/Event", typeIndex)).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd css/extensions/markdown-projection && npx vitest run test/wikilinkProjection.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Write minimal implementation** (after `HINT_TO_PROJECTION`):

```typescript
// Minimal opinionated kernel (Option B): the smallest predicate→class entailment
// set that makes a freshly-minted Pod usable as agentic memory with the D106
// guardrails intact. The Pod's /vault/meta/routing.jsonld EXTENDS this at runtime
// (RoutingLoader); this kernel is the bootstrap default used before the doc loads
// or if it is absent — same status as DEFAULT_WIKI_TYPE_INDEX. Navigation
// predicates (skos:related/broader, cito:*) entail nothing → default content container.
export const BOOTSTRAP_PREDICATE_TO_CLASS: Record<string, string> = {
    [SCHEMA + "affiliation"]: SCHEMA + "Organization",
    [SCHEMA + "location"]:    SCHEMA + "Place",
    [DCT + "contributor"]:    SCHEMA + "Person",
};

export function classToContainerSegment(
    classIri: string,
    typeIndex: Record<string, string>,
): string | undefined {
    for (const [prefix, cls] of Object.entries(typeIndex)) {
        if (cls === classIri) {
            const m = prefix.match(/\/wiki\/([^/]+)\/$/);
            if (m) return m[1];
        }
    }
    return undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/wikilinkProjection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add css/extensions/markdown-projection/src/wikilinkProjection.ts css/extensions/markdown-projection/test/wikilinkProjection.test.ts
git commit -m "[Agent: Claude] wikilinkProjection: bootstrap kernel + Type-Index inversion (D106)"
```

### Task 4: Class-driven `targetContainer` + injected `predicateToClass` through `projectWikilinks`

**Files:**
- Modify: `css/extensions/markdown-projection/src/wikilinkProjection.ts:130-194`
- Test: `css/extensions/markdown-projection/test/wikilinkProjection.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
describe("projectWikilinks container routing (D106)", () => {
    const typeIndex = {
        "/vault/wiki/concepts/":      "http://www.w3.org/2004/02/skos/core#Concept",
        "/vault/wiki/people/":        "https://schema.org/Person",
        "/vault/wiki/organizations/": "https://schema.org/Organization",
        "/vault/wiki/places/":        "https://schema.org/Place",
    };
    const base = "https://pod.example/wiki/concepts/foo.md";
    const routing = BOOTSTRAP_PREDICATE_TO_CLASS;

    it("routes {.affiliation} into organizations/", () => {
        const q = projectWikilinks("[[Notre Dame]]{.affiliation}", base, typeIndex, routing);
        expect(q[0].object.value).toBe("https://pod.example/wiki/organizations/notre-dame.md#this");
    });
    it("routes {.location} into places/", () => {
        const q = projectWikilinks("[[South Bend]]{.location}", base, typeIndex, routing);
        expect(q[0].object.value).toBe("https://pod.example/wiki/places/south-bend.md#this");
    });
    it("defaults unentailed {.related} to concepts/", () => {
        const q = projectWikilinks("[[Context Graphs]]{.related}", base, typeIndex, routing);
        expect(q[0].object.value).toBe("https://pod.example/wiki/concepts/context-graphs.md#this");
    });
    it("falls back to concepts/ when entailed class is not Type-Index-registered", () => {
        const q = projectWikilinks("[[Some Org]]{.affiliation}", base, {}, routing);
        expect(q[0].object.value).toBe("https://pod.example/wiki/concepts/some-org.md#this");
    });
    it("honors a runtime-extended routing map (Pod doc adds an entailment)", () => {
        const extended = { ...routing, "https://schema.org/about": "https://schema.org/Place" };
        const q = projectWikilinks("[[Somewhere]]{.about}", base, typeIndex, extended);
        expect(q[0].object.value).toBe("https://pod.example/wiki/places/somewhere.md#this");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/wikilinkProjection.test.ts`
Expected: FAIL — `projectWikilinks` takes 2 args; no class routing.

- [ ] **Step 3: Write minimal implementation** — replace `HINT_TO_CONTAINER` + `targetContainer` (130-138) and update `projectWikilinks` (169):

```typescript
const DEFAULT_CONTENT_CONTAINER = "concepts";

// D106: hint → predicate → entailed class (predicateToClass) → container via the
// inverted Type Index. Defaults to concepts/ when the predicate entails no class
// or the class is not Type-Index-registered (forward/cross-container ref — the
// minted IRI is best-effort; the curator reconciles divergence). predicateToClass
// is injected (Pod routing.jsonld at runtime; bootstrap kernel otherwise).
function targetContainer(
    hint: string | undefined,
    title: string,
    typeIndex: Record<string, string>,
    predicateToClass: Record<string, string>,
): string {
    const proj = projectionFor(hint, title);
    const cls = predicateToClass[proj.predicate.value];
    if (cls) {
        const seg = classToContainerSegment(cls, typeIndex);
        if (seg) return seg;
    }
    return DEFAULT_CONTENT_CONTAINER;
}

export function projectWikilinks(
    body: string,
    baseUri: string,
    typeIndex: Record<string, string> = {},
    predicateToClass: Record<string, string> = BOOTSTRAP_PREDICATE_TO_CLASS,
): Quad[] {
    const pageIRI  = namedNode(baseUri);
    const thingIRI = namedNode(baseUri + "#this");
    const out: Quad[] = [];
    const root = baseRoot(baseUri);

    for (const link of extractWikilinks(body)) {
        const stripped = applyS3a(link.title);
        const slugged  = slug(stripped);
        const ctr      = targetContainer(link.classHint, link.title, typeIndex, predicateToClass);
        const targetPageURL = `${root}/wiki/${ctr}/${slugged}.md`;
        const proj     = projectionFor(link.classHint, link.title);

        const subject = proj.subject === "PAGE" ? pageIRI : thingIRI;
        const object  = proj.subject === "PAGE"
            ? namedNode(targetPageURL)
            : namedNode(targetPageURL + "#this");

        out.push(quad(subject, proj.predicate, object));
    }
    return out;
}
```

Grep for and delete the now-unused `sourceContainerOf` if nothing references it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/wikilinkProjection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add css/extensions/markdown-projection/src/wikilinkProjection.ts css/extensions/markdown-projection/test/wikilinkProjection.test.ts
git commit -m "[Agent: Claude] wikilinkProjection: class-driven routing with injected entailment map (D106)"
```

### Task 5: Pipeline threads `typeIndex` + `predicateToClass`

**Files:**
- Modify: `css/extensions/markdown-projection/src/projectionPipeline.ts:144-152`
- Test: `css/extensions/markdown-projection/test/projectionPipeline.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it("routes a body {.affiliation} link via injected Type Index + routing map", async () => {
    const typeIndex = {
        "/vault/wiki/concepts/":      "http://www.w3.org/2004/02/skos/core#Concept",
        "/vault/wiki/organizations/": "https://schema.org/Organization",
    };
    const routing = { "https://schema.org/affiliation": "https://schema.org/Organization" };
    const quads = await projectionPipeline.run(
        "https://pod.example/vault/wiki/concepts/jarek.md",
        "# Jarek\n\nWorks at [[Notre Dame]]{.affiliation}.\n",
        typeIndex, routing,
    );
    const edge = quads.find(q => q.predicate.value === "https://schema.org/affiliation");
    expect(edge?.object.value).toBe("https://pod.example/vault/wiki/organizations/notre-dame.md#this");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/projectionPipeline.test.ts`
Expected: FAIL — `run` takes 3 args; routing not threaded.

- [ ] **Step 3: Write minimal implementation** — add the param to `run` and pass it:

```typescript
    async run(
        resourceUri: string,
        body: string,
        typeIndex: TypeIndex = DEFAULT_WIKI_TYPE_INDEX,
        predicateToClass: Record<string, string> = BOOTSTRAP_PREDICATE_TO_CLASS,
    ): Promise<Quad[]> {
```
(import `BOOTSTRAP_PREDICATE_TO_CLASS` from `./wikilinkProjection.js`) and line 152:
```typescript
        const wikiTriples = projectWikilinks(rest, resourceUri, typeIndex, predicateToClass);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/projectionPipeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add css/extensions/markdown-projection/src/projectionPipeline.ts css/extensions/markdown-projection/test/projectionPipeline.test.ts
git commit -m "[Agent: Claude] projectionPipeline: thread routing map into wikilink routing"
```

---

## PHASE 2 — Runtime wiring (listener reads the Pod doc)

### Task 6: `RoutingLoader` + listener injects the loaded map

**Files:**
- Create: `css/extensions/markdown-projection/src/routingLoader.ts`
- Test: `css/extensions/markdown-projection/test/routingLoader.test.ts`
- Modify: `css/extensions/markdown-projection/src-cjs/listener.ts`

- [ ] **Step 1: Write the failing test** (pure parse, no network):

```typescript
import { parseRoutingDoc } from "../src/routingLoader.js";

describe("parseRoutingDoc (JSON-LD → predicate→class map, CURIE-expanded)", () => {
    const doc = {
        "@context": {
            "wiki": "https://pod.vardeman.me/vault/ontology/wiki#",
            "schema": "https://schema.org/",
            "dct": "http://purl.org/dc/terms/",
            "routesToClass": { "@id": "wiki:routesToClass", "@type": "@id" },
        },
        "@graph": [
            { "@id": "schema:affiliation", "routesToClass": "schema:Organization" },
            { "@id": "dct:contributor", "routesToClass": "schema:Person" },
        ],
    };
    it("expands CURIEs to full IRIs", () => {
        const map = parseRoutingDoc(doc);
        expect(map["https://schema.org/affiliation"]).toBe("https://schema.org/Organization");
        expect(map["http://purl.org/dc/terms/contributor"]).toBe("https://schema.org/Person");
    });
    it("returns empty map for a malformed doc", () => {
        expect(parseRoutingDoc({} as any)).toEqual({});
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/routingLoader.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation** (`routingLoader.ts`):

```typescript
// Loads /vault/meta/routing.jsonld and parses it into predicate IRI → class IRI.
// No JSON-LD processor: the doc uses simple CURIEs we expand via its @context.
type RoutingDoc = { "@context"?: Record<string, any>; "@graph"?: any[] };

function expand(curie: string, prefixes: Record<string, string>): string {
    const i = curie.indexOf(":");
    if (i < 0) return curie;
    const pfx = curie.slice(0, i);
    return prefixes[pfx] ? prefixes[pfx] + curie.slice(i + 1) : curie;
}

export function parseRoutingDoc(doc: RoutingDoc): Record<string, string> {
    const ctx = doc["@context"] ?? {};
    const prefixes: Record<string, string> = {};
    for (const [k, v] of Object.entries(ctx)) {
        if (typeof v === "string") prefixes[k] = v;
    }
    const out: Record<string, string> = {};
    for (const node of doc["@graph"] ?? []) {
        const id = node["@id"]; const cls = node["routesToClass"];
        if (typeof id === "string" && typeof cls === "string") {
            out[expand(id, prefixes)] = expand(cls, prefixes);
        }
    }
    return out;
}

// Runtime loader: fetch the Pod doc with the lock-safe fetch() pattern (NOT
// store.getRepresentation — re-entrant-lock hazard, D92). Returns the bootstrap
// kernel on any failure (404 / pre-deploy / parse error).
export async function loadRoutingMap(
    podBase: string,
    fetchFn: typeof fetch,
    bootstrap: Record<string, string>,
): Promise<Record<string, string>> {
    try {
        const res = await fetchFn(`${podBase}/meta/routing.jsonld`, {
            headers: { Accept: "application/ld+json" },
        });
        if (!res.ok) return bootstrap;
        const map = parseRoutingDoc(await res.json() as RoutingDoc);
        return Object.keys(map).length ? map : bootstrap;
    } catch {
        return bootstrap;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/routingLoader.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into the listener** — mirror the `TypeIndexLoader` lazy-load + 15s startup grace already in `listener.ts:242-258`. Load the routing map alongside the Type Index (cache it on the instance, `loadRoutingMap(this.baseUrl, fetch, BOOTSTRAP_PREDICATE_TO_CLASS)`), and pass it as the 4th arg to `projectionPipeline.run(uri, body, typeIndex, routingMap)`. Import `BOOTSTRAP_PREDICATE_TO_CLASS` via the same require block as the other pipeline pieces (listener.ts:235).

- [ ] **Step 6: Commit**

```bash
git add css/extensions/markdown-projection/src/routingLoader.ts css/extensions/markdown-projection/test/routingLoader.test.ts css/extensions/markdown-projection/src-cjs/listener.ts
git commit -m "[Agent: Claude] markdown-projection: runtime-load /meta/routing.jsonld (Pod SoT) with kernel fallback"
```

---

## PHASE 3 — Build & live integration

### Task 7: Build + full unit suite

- [ ] **Step 1:** `cd css/extensions/markdown-projection && npm run build` — expect tsc clean, `dist-cjs/` refreshed.
- [ ] **Step 2:** `npx vitest run` — expect all suites PASS, no regressions.
- [ ] **Step 3:** `git add css/extensions/markdown-projection/dist-cjs && git commit -m "[Agent: Claude] markdown-projection: rebuild dist-cjs after routing rewrite"`

### Task 8: Fresh-volume rebuild + live integration + extensibility

**Files:**
- Test: `tests/integration/test_two_hierarchy_resolver.py` (Create)

> Reproducibility rule (MEMORY): never declare verified without `make reset`; `ensure_container` HEAD-skips mask regressions.

- [ ] **Step 1: Write the failing integration test** (reuse the `pod_client` fixture + mkcert CA pattern from `tests/integration/test_addressbook_e2e.py`):

```python
import httpx, pytest
POD = "https://pod.vardeman.me/vault"

@pytest.mark.integration
def test_affiliation_routes_to_organizations(pod_client):
    url = f"{POD}/wiki/people/jarek-test.md"
    pod_client.put(url, content="# Jarek\n\nWorks at [[Notre Dame]]{.affiliation}.\n",
                   headers={"Content-Type": "text/markdown"})
    meta = pod_client.get(f"{url}.meta", headers={"Accept": "text/turtle"}).text
    assert "/wiki/organizations/notre-dame.md#this" in meta and "schema.org/affiliation" in meta

@pytest.mark.integration
def test_related_defaults_to_concepts(pod_client):
    url = f"{POD}/wiki/concepts/topic-test.md"
    pod_client.put(url, content="# Topic\n\nSee [[Context Graphs]]{.related}.\n",
                   headers={"Content-Type": "text/markdown"})
    meta = pod_client.get(f"{url}.meta", headers={"Accept": "text/turtle"}).text
    assert "/wiki/concepts/context-graphs.md#this" in meta

@pytest.mark.integration
def test_routing_doc_deployed_and_parseable(pod_client):
    r = pod_client.get(f"{POD}/meta/routing.jsonld", headers={"Accept": "application/ld+json"})
    assert r.status_code == 200
    assert "routesToClass" in r.text
```

- [ ] **Step 2:** `make reset`; poll `docker inspect -f '{{.State.Status}}' cogitarelink-solid-pod-setup-1` until `exited`; `make status` (all 200); confirm pod-setup exit 0.
- [ ] **Step 3:** `~/uvws/.venv/bin/python -m pytest tests/integration/test_two_hierarchy_resolver.py -v` — expect PASS.
- [ ] **Step 4 (extensibility check, manual):** PATCH `/vault/meta/routing.jsonld` to add `schema:about → schema:Place`; PUT a page with `[[X]]{.about}`; confirm its `.meta` routes to `/wiki/places/x.md#this` **without** an image rebuild. (Listener cache refresh: if the loader caches for process lifetime, document that a CSS restart — not a rebuild — picks up the change; tune cache TTL only if the eval needs live refresh.)
- [ ] **Step 5:** `git add tests/integration/test_two_hierarchy_resolver.py && git commit -m "[Agent: Claude] integration: two-hierarchy routing + Pod-doc extensibility (D106)"`

---

## PHASE 4 — Range sanity-check (Python, reads the Pod doc, TDD)

### Task 9: `pod_audit --check-routing` (no Python mirror)

**Files:**
- Modify: `scripts/pod_audit.py`
- Create: `tests/test_pod_audit_routing.py`, `tests/fixtures/routing.jsonld`

- [ ] **Step 1: Create the fixture** `tests/fixtures/routing.jsonld` (test data — NOT a mirror of the production map; deliberately includes a disagreement case):

```json
{
  "@context": { "wiki": "https://pod.vardeman.me/vault/ontology/wiki#",
    "schema": "https://schema.org/", "dct": "http://purl.org/dc/terms/",
    "routesToClass": { "@id": "wiki:routesToClass", "@type": "@id" } },
  "@graph": [
    { "@id": "schema:affiliation", "routesToClass": "schema:Organization" },
    { "@id": "schema:location",    "routesToClass": "schema:Place" }
  ]
}
```

- [ ] **Step 2: Write the failing test**

```python
from scripts.pod_audit import load_routing_from_jsonld, check_routing

def test_loads_map_from_jsonld(tmp_path):
    m = load_routing_from_jsonld("tests/fixtures/routing.jsonld")
    assert m["https://schema.org/affiliation"] == "https://schema.org/Organization"

def test_coverage_error_when_class_not_registered():
    routing = {"https://schema.org/affiliation": "https://schema.org/Organization"}
    type_index = {"https://schema.org/Person": "/vault/wiki/people/"}  # no Organization
    findings = check_routing(routing, type_index)
    assert any(f["severity"] == "ERROR" and "Organization" in f["location"] for f in findings)

def test_published_range_disagreement_warns():
    routing = {"https://schema.org/location": "https://schema.org/Organization"}  # wrong
    type_index = {"https://schema.org/Organization": "/vault/wiki/organizations/"}
    findings = check_routing(routing, type_index,
                             published_range={"https://schema.org/location": "https://schema.org/Place"})
    assert any(f["severity"] == "WARN" and "range" in f["constraint"] for f in findings)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_pod_audit_routing.py -v`
Expected: FAIL — functions undefined.

- [ ] **Step 4: Write minimal implementation** in `scripts/pod_audit.py` (use rdflib's JSON-LD parser; the map is read, never hardcoded):

```python
import rdflib

ROUTES_TO_CLASS = "https://pod.vardeman.me/vault/ontology/wiki#routesToClass"

# Cached published rdfs:range for the entailed predicates (schema.org / dct),
# used only for the agreement WARN. NOT the routing map — that is read live.
PUBLISHED_RANGE = {
    "https://schema.org/affiliation": "https://schema.org/Organization",
    "https://schema.org/location":    "https://schema.org/Place",
    "http://purl.org/dc/terms/contributor": "https://schema.org/Person",
}

def load_routing_from_jsonld(path_or_text, is_text=False):
    g = rdflib.Graph()
    g.parse(data=path_or_text, format="json-ld") if is_text else g.parse(path_or_text, format="json-ld")
    p = rdflib.URIRef(ROUTES_TO_CLASS)
    return {str(s): str(o) for s, o in g.subject_objects(p)}

def check_routing(routing, type_index, published_range=PUBLISHED_RANGE):
    """routing: {predicate: class}. type_index: {class_iri: container_path}."""
    registered = set(type_index.keys())
    findings = []
    for pred, cls in routing.items():
        if cls not in registered:
            findings.append({"severity": "ERROR", "constraint": "routing:type-index-coverage",
                "location": cls, "remediation": f"Register {cls} in the Type Index so {pred} can route."})
        pub = published_range.get(pred)
        if pub and pub != cls:
            findings.append({"severity": "WARN", "constraint": "routing:published-range-agreement",
                "location": pred, "remediation": f"{pred}→{cls} differs from published range {pub}; confirm intentional."})
    return findings
```

Wire `--check-routing` into `main()`: GET `<POD>/meta/routing.jsonld`, `load_routing_from_jsonld(text, is_text=True)`, invert the live class→container Type Index the walker already builds, append `check_routing(...)` findings.

- [ ] **Step 5: Run test to verify it passes**

Run: `~/uvws/.venv/bin/python -m pytest tests/test_pod_audit_routing.py -v`
Expected: PASS.

- [ ] **Step 6:** `make sync-curator-skill` (pod_audit is bundled into the pod-curator skill — re-sync per its drift note). Then commit:

```bash
git add scripts/pod_audit.py tests/test_pod_audit_routing.py tests/fixtures/routing.jsonld
git commit -m "[Agent: Claude] pod_audit: --check-routing reads /meta/routing.jsonld (no mirror); coverage+range checks"
```

### Task 10: Run the routing audit against the live Pod

- [ ] **Step 1:** Extend the `make audit` target (or run directly) with `--check-routing`. Run `make audit`. Expected: 0 routing ERROR (Organization/Place/Person all registered in the D98 layout); storage-description WARN remains (Task 11).
- [ ] **Step 2:** `git add Makefile && git commit -m "[Agent: Claude] make audit: include routing sanity-check"`

---

## PHASE 5 — Agentic self-description (§8)

### Task 11: Entry-point `sh:agentInstruction` (closes the audit WARN)

> **Plan-time pick:** `StaticStorageDescriber` emits only IRIs, not literals (audit-sweep finding). Options: (a) tiny custom StorageDescriber yielding the literal quad (~30 LOC, `MementoLinkMetadataWriter` pattern); (b) point a `wiki:agentGuide` IRI at the dogfood doc (Task 12) and satisfy the shape via the pointer. **Recommended (b).**

- [ ] **Step 1:** Implement the chosen option; the prose states the wikilink form (`[[Title]]{.hint}`, hint = edge type), container = predicate-range-class via Type Index (not the hint), target type is a hypothesis until `<target#this>` resolved, dangling refs reconcilable.
- [ ] **Step 2:** `make reset`; `make audit`; expect storage-description WARN cleared.
- [ ] **Step 3:** Commit.

### Task 12: Crystallize the dogfood doc into `/wiki/concepts/`

- [ ] **Step 1:** Adapt `~/Obsidian/obsidian/03 - Resources/Agentic Memory Systems/Two-Hierarchy Memory Addressing.md` into wiki-memory body form; include `dct:references` to W3C *Using OWL and SKOS* (https://www.w3.org/2006/07/SWD/SKOS/skos-and-owl/master.html) and the ESCO model (https://ec.europa.eu/esco/lod/model).
- [ ] **Step 2:** Add it to the wiki-memory overlay bootstrap content (so `make reset` reproduces it — reproducibility rule), targeting `/vault/wiki/concepts/two-hierarchy-memory-addressing.md`.
- [ ] **Step 3:** `make reset`; verify it resolves, its own `{.related}`/`{.source}` links route per the new resolver, and `dct:references` are present.
- [ ] **Step 4:** Commit (overlay content + bootstrap wiring).

---

## PHASE 6 — Cold comprehension eval (§9, acceptance gate)

### Task 13: Trap-based cold eval

**Files:** Create `docs/plans/2026-05-26-two-hierarchy-eval.md`

- [ ] **Step 1:** Write the procedure: cold HTTP-only agent (no hints, no repo); task = create a concept that cites a source, links a person, sits under a `broader` topic, **and** includes a **trap link** — an `{.affiliation}` edge pointing at a target whose actual authored class violates the range expectation (e.g. authored as a Place).
- [ ] **Step 2:** Run (same protocol as the 2026-05-26 cold probes); record trajectory.
- [ ] **Step 3:** Score three axes (D102): **form** (correct `[[Title]]{.hint}`); **addressing vs navigation** (`broader`-navigation vs `subClassOf`/container-addressing); **grounding (trap)** — does it resolve `<target#this>` for the real class, or token-entail the range-expected class? Divergence = the §7 failure-mode measurement.
- [ ] **Step 4:** Record whether skill-layer `resolve-before-assert` enforcement is justified (the follow-on `solid-agent-skills` spec trigger). Commit the eval doc.

---

## Self-Review

**Spec coverage:** §2 decision → Tasks 3-6; §3 resolver/purity → Tasks 3-5 (pure; map injected); §4 extensibility → Task 2 (Pod doc) + Task 4 runtime-extend test + Task 6 loader; §5 forward-ref/reconcile → Task 4 fallback + Task 9 coverage; §6 sanity-check → Task 9 (drift guard moot — single Pod source, audit reads it live; documented in decision #2); §7 surface=container-path (decision #1), enforce out-of-scope (spec §11); §8 → Tasks 11-12; §9 → Task 13. ✓

**Placeholder scan:** No TBD/TODO. Task 2 Step 3 ("mirror context.jsonld deploy") and Task 6 Step 5 ("mirror TypeIndexLoader") point at concrete existing analogs the implementer reads first — actionable, not placeholders. Task 11 has a deliberate recommended pick. ✓

**Type consistency:** `BOOTSTRAP_PREDICATE_TO_CLASS` (Record<string,string>), `classToContainerSegment(classIri, typeIndex)`, `projectWikilinks(body, baseUri, typeIndex, predicateToClass)`, `projectionPipeline.run(uri, body, typeIndex, predicateToClass)`, `parseRoutingDoc(doc)`, `loadRoutingMap(podBase, fetchFn, bootstrap)`, Python `check_routing(routing, type_index, published_range)` + `load_routing_from_jsonld(...)` — consistent across tasks. TS `typeIndex` is container→class; Python `check_routing` takes class→container (CLI inverts before calling, Task 9 Step 4). ✓

---

## Execution Handoff

Plan complete and saved. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks, fast iteration.
2. **Inline Execution** — execute in this session with checkpoints.

Note: tasks touch four surfaces (overlay/vocab, TS extension, Python audit, content/eval) but are sequenced so each leaves the tree green; PHASE 0 (artifacts) and PHASE 1 (pure resolver) can proceed in either order since the resolver defaults to the kernel until the doc exists.
