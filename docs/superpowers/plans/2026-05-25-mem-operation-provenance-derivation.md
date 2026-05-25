# Mem-operation Provenance by Derivation from the Operation Log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a wiki resource's `.meta` carry a `prov:wasGeneratedBy` edge that is *re-derived* from the canonical `/vault/wiki/.operations/` log on every projection, instead of being PATCHed-and-clobbered — so the denormalized copy survives body rewrites by reconstruction and "log wins" holds structurally.

**Architecture:** The `MarkdownProjectionListener` already reads the body from the filesystem and writes `.meta`. We add the operation log as one more *projection source*: a new pure module `operationLog.ts` reads `/vault/wiki/.operations/` from disk, finds the latest announcement whose `as:object` is the resource, and the listener injects that action into the (still-pure) `projectionPipeline.run()`, which emits the derived edge and **stops** emitting the affordance "generation stamp" on the resource (a PROV category error). The canonical record stays the `.operations/` announcement; the resource edge is a derived view of it.

**Tech Stack:** TypeScript (CSS v8 extension, ESM `src/` + CJS `src-cjs/`, vitest), N3.js (RDF parse), Turtle (`mem.ttl` vocab + affordance descriptor), Python/pytest + httpx (live e2e), Docker (`make reset`), mkcert TLS.

**Design spec:** `docs/superpowers/specs/2026-05-25-mem-operation-provenance-derivation-design.md`

---

## Context the implementer needs

- **The 6 `tests/integration/test_mem_operations.py` tests already pass** via a workaround (provenance asserted only from `.operations/`). They are a **regression net**, not the target. This plan *adds* "derived edge appears in `.meta`" on top.
- **Why `prov:wasDerivedFrom` survives today but `prov:wasGeneratedBy` does not:** `wasGeneratedBy` is in `PAGE_GOVERNED_PREDICATES` (`governedPredicates.ts:41`) so projection deletes+rewrites it; `wasDerivedFrom` is ungoverned so projection leaves agent PATCHes alone. Keep `wasGeneratedBy` governed — but make the substrate *derive* its value from the log rather than stamp the affordance URI.
- **The listener never re-enters the store** for reads — it uses `readFileSync(fsPath)` (`listener.ts:228`). The op-log read MUST follow the same pattern (filesystem, not HTTP) to avoid re-entrancy.
- **`run()` is pure** (`projectionPipeline.ts:138`, params `resourceUri, body, typeIndex`). Keep it pure — inject the action as a new optional param, exactly like `typeIndex` is injected. All I/O stays in the listener and `operationLog.ts`.
- **Announce-first contract:** because the edge is *derived*, the announcement must exist in `.operations/` *before* the body PUT that triggers projection. The e2e tests must POST the announcement, then PUT the durable body.
- **Build:** the extension compiles ESM (`tsc`) + CJS (`tsc -p tsconfig.cjs.json`) via `npm run build` in `css/extensions/markdown-projection/`. Live changes need `make reset` (full fresh-volume rebuild — the only trustworthy verify; never `make up` alone).
- **TLS for Python:** `export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem` before live pytest. Tests use `verify=False`, but the env var avoids other friction.
- **Vitest cwd:** all `npx vitest run …` commands run from `css/extensions/markdown-projection/`.

## File structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `css/extensions/markdown-projection/src/operationLog.ts` | **Create** | Pure-ish: read `.operations/` from disk, return the latest `ActionProvenance` whose `as:object` = resource. |
| `css/extensions/markdown-projection/test/operationLog.test.ts` | **Create** | Unit tests for `findLatestAction` against temp-dir fixtures. |
| `css/extensions/markdown-projection/src/projectionPipeline.ts` | **Modify** | Drop resource affordance-stamp; add optional `action` param; emit derived edge; relocate audit stamp to the `.meta`-doc subject. |
| `css/extensions/markdown-projection/test/projectionPipeline.test.ts` | **Modify** | Assert derived edge when action injected; no resource-stamp when not; relocated audit stamp. |
| `css/extensions/markdown-projection/src-cjs/listener.ts` | **Modify** | Compute `opsDir`, call `findLatestAction`, inject action into `run()`; update `ProjectionModule` type. |
| `overlays/wiki-memory/ontology/mem.ttl` | **Modify** | Tighten: announcement subject = `<>`, `as:object` required + canonical on every `mem:Action`. |
| `overlays/wiki-memory/affordances/memory-history.ttl` | **Create** | History affordance descriptor (op log + Memento), per design §6. |
| `overlays/wiki-memory/manifest.ttl` | **Modify** | Register the new affordance for overlay install. |
| `tests/integration/test_mem_operations.py` | **Modify** | `_announce` → `<>`-subject; announce-first ordering; assert derived edge in `.meta`. |

---

## Phase 0 — Verification spike (gates everything)

### Task 1: Confirm the on-disk encoding of `.operations/` announcements

**Files:** none (probe only).

- [ ] **Step 1: Ensure the Pod is up with a fresh volume**

Run: `cd /Users/cvardema/dev/git/LA3D/agents/cogitarelink-solid && make reset`
Expected: completes; `make audit` (chained) shows 0 ERROR.

- [ ] **Step 2: PUT a probe announcement (`<>`-subject form) and inspect on-disk name + subject resolution**

```bash
export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem
PROBE="https://pod.vardeman.me/vault/wiki/.operations/probe-001.ttl"
TGT="https://pod.vardeman.me/vault/wiki/concepts/does-not-matter.md"
curl -sk -X PUT "$PROBE" -H "Content-Type: text/turtle" --data-binary @- <<EOF
@prefix as:  <https://www.w3.org/ns/activitystreams#> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce, mem:CrystallizeAction ;
   as:actor  <https://pod.vardeman.me/vault/profile/card#me> ;
   as:object <$TGT> ;
   as:published "2026-05-25T12:00:00Z"^^xsd:dateTime .
EOF
docker compose exec -T css sh -c 'find /data/vault/wiki/.operations -type f'
docker compose exec -T css sh -c 'cat /data/vault/wiki/.operations/probe-001* 2>/dev/null'
```

Expected: the find prints the exact on-disk filename for the probe (e.g. `probe-001.ttl` or `probe-001.ttl$.ttl`). The cat shows the Turtle. **Record the filename pattern** — `operationLog.ts` (Task 3) reconstructs the announcement URL from the filename, so the strip rule (`$.ttl` suffix? trailing `.ttl`?) must match what you see here.

- [ ] **Step 3: Confirm GET resolves `<>` to the resource URL and `as:object` is present**

```bash
curl -sk "$PROBE" -H "Accept: text/turtle"
```

Expected: Turtle where the subject is `<https://pod.vardeman.me/vault/wiki/.operations/probe-001.ttl>` (i.e. `<>` resolved to the resource URL) with `as:object <…does-not-matter.md>` and `a … mem:CrystallizeAction`.

- [ ] **Step 4: Clean up the probe**

```bash
curl -sk -X DELETE "$PROBE"
```

- [ ] **Step 5: Decision checkpoint (no commit)**

If Steps 2–3 show the announcement persists as a readable file whose `<>` resolves to its URL and carries `as:object`, proceed — the filesystem-derivation design holds. Record the filename strip rule for Task 3. If announcements do **not** persist as readable files (unexpected), STOP and revisit the design (fallback: a `.operations/`-triggered re-derivation listener instead of body-projection reading the log).

---

## Phase 1 — `operationLog.ts` (pure module + unit tests)

### Task 2: Define `findLatestAction` failing test

**Files:**
- Create: `css/extensions/markdown-projection/test/operationLog.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { findLatestAction } from "../src/operationLog.js";

const TGT = "https://pod.vardeman.me/vault/wiki/concepts/decay-theory.md";
const OPS_BASE = "https://pod.vardeman.me/vault/wiki/.operations/";

function announcement(target: string, action: string, published: string): string {
  return `@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce, ${action} ;
   as:object <${target}> ;
   as:published "${published}"^^xsd:dateTime .`;
}

describe("findLatestAction", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "ops-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns undefined when the ops dir is missing", () => {
    expect(findLatestAction(path.join(dir, "nope"), TGT, OPS_BASE)).toBeUndefined();
  });

  it("returns undefined when no announcement targets the resource", () => {
    writeFileSync(path.join(dir, "op-1.ttl"),
      announcement("https://pod.vardeman.me/vault/wiki/concepts/other.md",
                   "mem:CrystallizeAction", "2026-05-25T10:00:00Z"));
    expect(findLatestAction(dir, TGT, OPS_BASE)).toBeUndefined();
  });

  it("returns the action for a matching announcement, with dereferenceable URL", () => {
    writeFileSync(path.join(dir, "op-1.ttl"),
      announcement(TGT, "mem:CrystallizeAction", "2026-05-25T10:00:00Z"));
    const a = findLatestAction(dir, TGT, OPS_BASE);
    expect(a).toBeDefined();
    expect(a!.actionType).toBe("https://pod.vardeman.me/vault/ontology/mem#CrystallizeAction");
    expect(a!.activityUrl).toBe(OPS_BASE + "op-1.ttl");
    expect(a!.publishedAt).toBe("2026-05-25T10:00:00Z");
  });

  it("returns the latest by as:published when multiple target the resource", () => {
    writeFileSync(path.join(dir, "op-early.ttl"),
      announcement(TGT, "mem:CrystallizeAction", "2026-05-25T10:00:00Z"));
    writeFileSync(path.join(dir, "op-late.ttl"),
      announcement(TGT, "mem:SupersedeAction", "2026-06-01T09:00:00Z"));
    const a = findLatestAction(dir, TGT, OPS_BASE);
    expect(a!.actionType).toBe("https://pod.vardeman.me/vault/ontology/mem#SupersedeAction");
    expect(a!.activityUrl).toBe(OPS_BASE + "op-late.ttl");
  });

  it("ignores container internals (dotfiles) and non-ttl files", () => {
    writeFileSync(path.join(dir, ".meta"), "broken { not turtle");
    writeFileSync(path.join(dir, "README.txt"), "ignore me");
    writeFileSync(path.join(dir, "op-1.ttl"),
      announcement(TGT, "mem:CrystallizeAction", "2026-05-25T10:00:00Z"));
    expect(findLatestAction(dir, TGT, OPS_BASE)!.actionType)
      .toBe("https://pod.vardeman.me/vault/ontology/mem#CrystallizeAction");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `css/extensions/markdown-projection/`): `npx vitest run test/operationLog.test.ts`
Expected: FAIL — `Cannot find module '../src/operationLog.js'`.

### Task 3: Implement `findLatestAction`

**Files:**
- Create: `css/extensions/markdown-projection/src/operationLog.ts`

- [ ] **Step 1: Write the implementation**

> NOTE: the `filenameToUrl` strip rule below assumes the on-disk name equals the URL slug + `.ttl` (Task 1 Step 2 confirms). If Task 1 showed a `$.ttl` content-type suffix, extend `stripSuffix` to strip `$.ttl` first.

```typescript
// operationLog.ts
//
// Reads the canonical operation log at /vault/wiki/.operations/ from disk and
// returns the latest mem:Action announcement whose as:object is a given
// resource. Pure aside from the filesystem read (mirrors the listener's
// readFileSync pattern — never re-enters the store). Feeds the derived
// prov:wasGeneratedBy edge in projectionPipeline (RQ-Listener-1 design).

import { readdirSync, readFileSync, existsSync } from "fs";
import * as path from "path";
import { Parser } from "n3";

const AS         = "https://www.w3.org/ns/activitystreams#";
const AS_OBJECT  = AS + "object";
const AS_PUBLISHED = AS + "published";
const RDF_TYPE   = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const MEM        = "https://pod.vardeman.me/vault/ontology/mem#";

export interface ActionProvenance {
    activityUrl: string;  // dereferenceable announcement resource URL (the <> subject)
    actionType: string;   // mem:*Action IRI
    publishedAt: string;  // xsd:dateTime lexical value (ISO 8601, lexically sortable)
}

// Reconstruct the announcement resource URL from its on-disk filename.
// CSS stores a Turtle resource PUT at <ops>/<slug>.ttl on disk; confirm the
// exact suffix in Task 1 and adjust here if a $.ttl content-type suffix is present.
function filenameToUrl(opsBaseUrl: string, fname: string): string {
    const slug = fname.endsWith("$.ttl") ? fname.slice(0, -"$.ttl".length) : fname;
    return opsBaseUrl + slug;
}

export function findLatestAction(
    opsDir: string,
    resourceUri: string,
    opsBaseUrl: string,
): ActionProvenance | undefined {
    if (!existsSync(opsDir)) return undefined;

    let best: ActionProvenance | undefined;
    for (const fname of readdirSync(opsDir)) {
        if (fname.startsWith(".")) continue;            // .meta / .acl / .internal
        if (!fname.endsWith(".ttl")) continue;          // only Turtle announcements
        const annUrl = filenameToUrl(opsBaseUrl, fname);

        let quads;
        try {
            quads = new Parser({ baseIRI: annUrl })
                .parse(readFileSync(path.join(opsDir, fname), "utf8"));
        } catch {
            continue;  // unparseable → skip, never block projection
        }

        const targets = quads.filter(q => q.predicate.value === AS_OBJECT)
                             .map(q => q.object.value);
        if (!targets.includes(resourceUri)) continue;

        const actionType = quads.find(
            q => q.predicate.value === RDF_TYPE && q.object.value.startsWith(MEM),
        )?.object.value;
        if (!actionType) continue;

        const publishedAt = quads.find(
            q => q.predicate.value === AS_PUBLISHED,
        )?.object.value ?? "";

        if (!best || publishedAt > best.publishedAt) {
            best = { activityUrl: annUrl, actionType, publishedAt };
        }
    }
    return best;
}
```

- [ ] **Step 2: Run to verify it passes**

Run: `npx vitest run test/operationLog.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Commit**

```bash
git add css/extensions/markdown-projection/src/operationLog.ts \
        css/extensions/markdown-projection/test/operationLog.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] markdown-projection: operationLog.findLatestAction (RQ-Listener-1)

Pure-ish filesystem read of /vault/wiki/.operations/; returns the latest
mem:Action announcement (by as:published) whose as:object is the resource.
Feeds the derived prov:wasGeneratedBy edge. Unit-tested with temp-dir fixtures.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — `projectionPipeline` (derive edge, drop stamp, relocate audit)

### Task 4: Failing tests for the pipeline changes

**Files:**
- Modify: `css/extensions/markdown-projection/test/projectionPipeline.test.ts`

- [ ] **Step 1: Add failing tests**

Append these to the existing describe block (import `ActionProvenance` type alongside the existing pipeline import):

```typescript
import type { ActionProvenance } from "../src/operationLog.js";

const RES = "https://pod.vardeman.me/vault/wiki/concepts/decay-theory.md";
const PROV_GEN = "http://www.w3.org/ns/prov#wasGeneratedBy";
const AFFORDANCE = "https://pod.vardeman.me/vault/meta/affordances/markdown-projection";

const BODY = `---
type: concept
---
# Decay Theory

A concept.
`;

describe("operation-derived provenance", () => {
  it("does NOT stamp the affordance URI on the resource subject anymore", async () => {
    const triples = await projectionPipeline.run(RES, BODY);
    const stamp = triples.find(
      q => q.subject.value === RES && q.predicate.value === PROV_GEN
           && q.object.value === AFFORDANCE);
    expect(stamp).toBeUndefined();
  });

  it("relocates the projector audit stamp onto the .meta document subject", async () => {
    const triples = await projectionPipeline.run(RES, BODY);
    const audit = triples.find(
      q => q.subject.value === RES + ".meta" && q.predicate.value === PROV_GEN
           && q.object.value === AFFORDANCE);
    expect(audit).toBeDefined();
  });

  it("emits NO resource-level wasGeneratedBy when no action is injected", async () => {
    const triples = await projectionPipeline.run(RES, BODY);
    const onResource = triples.find(
      q => q.subject.value === RES && q.predicate.value === PROV_GEN);
    expect(onResource).toBeUndefined();
  });

  it("derives wasGeneratedBy on the resource from an injected action", async () => {
    const action: ActionProvenance = {
      activityUrl: "https://pod.vardeman.me/vault/wiki/.operations/op-1.ttl",
      actionType: "https://pod.vardeman.me/vault/ontology/mem#CrystallizeAction",
      publishedAt: "2026-05-25T10:00:00Z",
    };
    const triples = await projectionPipeline.run(RES, BODY, undefined, action);
    const edge = triples.find(
      q => q.subject.value === RES && q.predicate.value === PROV_GEN
           && q.object.value === action.activityUrl);
    expect(edge).toBeDefined();
    // and the action's type is inlined for at-a-glance reading
    const typed = triples.find(
      q => q.subject.value === action.activityUrl
           && q.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
           && q.object.value === action.actionType);
    expect(typed).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/projectionPipeline.test.ts`
Expected: FAIL — `run` takes 3 args not 4; the affordance stamp still appears on `RES`.

### Task 5: Change the pipeline

**Files:**
- Modify: `css/extensions/markdown-projection/src/projectionPipeline.ts`

- [ ] **Step 1: Add the constant and the import**

Near the top constants (after line 27), add:

```typescript
const MEM_PUBLISHED = "https://www.w3.org/ns/activitystreams#published";
const PROV_AT_TIME  = "http://www.w3.org/ns/prov#atTime";
```

Add to the imports at the top of the file:

```typescript
import type { ActionProvenance } from "./operationLog.js";
```

- [ ] **Step 2: Replace the provenance-stamp block and the `run` signature**

Replace the stamp block (currently lines ~168–174):

```typescript
        // Provenance stamp — absolute URI constructed from pod root (D52/D69)
        const affordanceUri = `${podRoot(resourceUri)}${AFFORDANCE_PATH}`;
        const provTriple = quad(
            namedNode(resourceUri),
            namedNode(PROV_GEN_BY),
            namedNode(affordanceUri),
        );
```

with:

```typescript
        // Metadata-provenance audit stamp (design §3.1 statement #3): the
        // projector generated the *metadata document*, not the resource. Attach
        // it to the .meta-document subject — NOT the resource — to free
        // prov:wasGeneratedBy on the resource for operation provenance.
        const affordanceUri = `${podRoot(resourceUri)}${AFFORDANCE_PATH}`;
        const auditStamp = quad(
            namedNode(`${resourceUri}.meta`),
            namedNode(PROV_GEN_BY),
            namedNode(affordanceUri),
        );

        // Resource generation (design §3.2): derived from the operation log when
        // an action targets this resource. Emit the edge + inline the action's
        // type and time for at-a-glance reading (context economy: pointer + minimal
        // summary, full record via the history affordance). Absent for non-operation
        // resources (plain PUTs) — that is intended.
        const provTriples: Quad[] = [auditStamp];
        if (action) {
            const act = namedNode(action.activityUrl);
            provTriples.push(quad(namedNode(resourceUri), namedNode(PROV_GEN_BY), act));
            provTriples.push(quad(act, namedNode(RDF_TYPE), namedNode(action.actionType)));
            if (action.publishedAt) {
                provTriples.push(quad(act, namedNode(PROV_AT_TIME),
                    literal(action.publishedAt,
                        namedNode("http://www.w3.org/2001/XMLSchema#dateTime"))));
            }
        }
```

Change the `run` signature (line ~138) from:

```typescript
    async run(
        resourceUri: string,
        body: string,
        typeIndex: TypeIndex = DEFAULT_WIKI_TYPE_INDEX,
    ): Promise<Quad[]> {
```

to:

```typescript
    async run(
        resourceUri: string,
        body: string,
        typeIndex: TypeIndex = DEFAULT_WIKI_TYPE_INDEX,
        action?: ActionProvenance,
    ): Promise<Quad[]> {
```

- [ ] **Step 3: Update the return statement**

Change the final return (line ~209) from:

```typescript
        return [...filteredFmTriples, ...derived, ...wikiTriples, provTriple, ...invariants];
```

to:

```typescript
        return [...filteredFmTriples, ...derived, ...wikiTriples, ...provTriples, ...invariants];
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/projectionPipeline.test.ts`
Expected: PASS (existing tests + 4 new).

- [ ] **Step 5: Run the full extension suite (no regressions)**

Run: `npx vitest run`
Expected: PASS. (`governedPredicates.test.ts` still asserts `wasGeneratedBy` is in the governed list — unchanged, since the substrate still governs the predicate; it now derives the value rather than stamping it.)

- [ ] **Step 6: Commit**

```bash
git add css/extensions/markdown-projection/src/projectionPipeline.ts \
        css/extensions/markdown-projection/test/projectionPipeline.test.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] markdown-projection: derive resource prov:wasGeneratedBy from op log

Stop stamping the affordance URI on the resource subject (a PROV category error:
the projector generates metadata, not the resource). Relocate that audit stamp to
the .meta-document subject. Add an optional ActionProvenance param to run(); when
present, emit <resource> prov:wasGeneratedBy <announcement> + inline the action
type/time. Absent for non-operation resources. run() stays pure.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Listener wiring

### Task 6: Wire `findLatestAction` into the listener

**Files:**
- Modify: `css/extensions/markdown-projection/src-cjs/listener.ts`

- [ ] **Step 1: Extend the `ProjectionModule` interface**

In `listener.ts`, change the `projectionPipeline` member of `interface ProjectionModule` (line ~58) and add `findLatestAction`:

```typescript
interface ProjectionModule {
    projectionPipeline: { run(uri: string, body: string, typeIndex?: Record<string, string>, action?: import("../src/operationLog.js").ActionProvenance): Promise<import("n3").Quad[]> };
    findLatestAction: (opsDir: string, resourceUri: string, opsBaseUrl: string) => import("../src/operationLog.js").ActionProvenance | undefined;
    resolveGovernedForWikiClass: (cls: string) => { page: string[]; thing: string[] };
    detectClass: (triples: import("n3").Quad[]) => string | undefined;
    MetaWriter: new() => { replaceGoverned(target: string, projected: import("n3").Quad[], governed: string[], resourceUrl?: string): Promise<void> };
    resolveThingClass: (path: string, typeIndex: Record<string, string>, frontmatterType: string | undefined) => string | undefined;
    TypeIndexLoader: new(podBase: string) => {
        getTypeIndex(): Promise<Record<string, string>>;
        refresh(): Promise<Record<string, string>>;
        invalidate(): void;
    };
}
```

- [ ] **Step 2: Confirm `findLatestAction` is exported from the ESM index**

Run: `grep -n "operationLog\|findLatestAction" css/extensions/markdown-projection/src/index.ts`
Expected: a re-export line. If absent, add to `css/extensions/markdown-projection/src/index.ts`:

```typescript
export { findLatestAction } from "./operationLog.js";
export type { ActionProvenance } from "./operationLog.js";
```

- [ ] **Step 3: Pull `findLatestAction` from the loaded pipeline and inject the action**

In `project()` (line ~235), add `findLatestAction` to the destructure:

```typescript
        const { projectionPipeline, findLatestAction, resolveGovernedForWikiClass, detectClass, MetaWriter,
                resolveThingClass, TypeIndexLoader } =
            await getPipeline();
```

Then, immediately before the `const triples = await projectionPipeline.run(...)` call (line ~279), compute the action and pass it in. Replace:

```typescript
        const triples = await projectionPipeline.run(target.path, body, typeIndex);
```

with:

```typescript
        // Resource generation provenance: derive from the canonical operation log
        // (RQ-Listener-1). The ops container lives at <pod>/wiki/.operations/; read
        // it from disk (same pattern as the body read — never re-enter the store).
        // Announce-first contract: the announcement must already exist for the edge
        // to appear (design §5).
        let action;
        try {
            const wikiRootUrl = target.path.slice(
                0, target.path.indexOf("/wiki/") + "/wiki/".length);
            const opsBaseUrl = `${wikiRootUrl}.operations/`;
            const opsDir = fsPathFromUrl(opsBaseUrl, this.baseUrl, this.dataDir);
            action = findLatestAction(opsDir, target.path, opsBaseUrl);
        } catch (err) {
            debug(`op-log read skipped: ${(err as Error).message}`);
        }

        const triples = await projectionPipeline.run(target.path, body, typeIndex, action);
```

- [ ] **Step 4: Build the extension**

Run (from `css/extensions/markdown-projection/`): `npm run build`
Expected: ESM + CJS compile cleanly, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add css/extensions/markdown-projection/src-cjs/listener.ts \
        css/extensions/markdown-projection/src/index.ts
git commit -m "$(cat <<'EOF'
[Agent: Claude] markdown-projection: listener injects op-log action into projection

project() reads <pod>/wiki/.operations/ from disk (same no-re-entrancy pattern as
the body read), finds the latest action targeting the resource, and passes it to
run() so prov:wasGeneratedBy is derived from the canonical log. Announce-first.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — `mem.ttl` vocabulary tightening

### Task 7: Make `as:object` the canonical, required announcement→target link

**Files:**
- Modify: `overlays/wiki-memory/ontology/mem.ttl`

- [ ] **Step 1: Read the current mem:Action base + announcement prose**

Run: `sed -n '40,60p;280,330p' overlays/wiki-memory/ontology/mem.ttl`
Expected: see the `mem:Action` class comment/scopeNote and the RealignAction `.operations/` example (which currently uses `prov:wasDerivedFrom` to point at the source, with `as:object` only described in prose).

- [ ] **Step 2: Tighten the `mem:Action` scopeNote to mandate `<>`-subject + `as:object`**

In the `mem:Action` block, replace the scopeNote text so it states the canonical announcement form explicitly. Find:

```
    skos:scopeNote "Abstract class; never used as rdf:type directly. Use a concrete subclass (mem:CrystallizeAction, mem:SupersedeAction, mem:MergeAction, mem:DemoteAction, mem:ArchiveAction, mem:LinkAction). The subclass IRI appears (a) on the prov:Activity blank node inside the durable resource's .meta and (b) as one of the rdf:type values on the as:Announce activity posted to /vault/wiki/.operations/." ;
```

Replace with:

```
    skos:scopeNote "Abstract class; never used as rdf:type directly. Use a concrete subclass (mem:CrystallizeAction, mem:SupersedeAction, mem:MergeAction, mem:DemoteAction, mem:ArchiveAction, mem:LinkAction). CANONICAL announcement form (the source of truth for operation provenance): a resource POSTed/PUT to /vault/wiki/.operations/ whose own subject <> is multi-typed `a as:Announce, mem:<Subclass>`, carrying `as:object <target>` (REQUIRED — the resource the operation produced or rewrote; the substrate derives that resource's prov:wasGeneratedBy from this link), `as:actor <webid>`, and `as:published`^^xsd:dateTime. The resource's own .meta then carries prov:wasGeneratedBy pointing back at this announcement, DERIVED by the projector (RQ-Listener-1 design) — agents do not PATCH it. n-ary operations put sources/partners on prov:wasDerivedFrom, never as:object." ;
```

- [ ] **Step 3: Fix the RealignAction example to the canonical `<>`/`as:object` form**

Find the RealignAction `skos:example` block (lines ~318–328) and replace its body so the announcement subject is `<>` and the target is `as:object`:

```
    skos:example """
        # In <https://pod.vardeman.me/vault/wiki/.operations/<id>> (the resource's own subject):
        <> a as:Announce , mem:RealignAction ;
           as:object <https://pod.vardeman.me/vault/meta/affordances/wiki-search-grep.ttl> ;
           as:actor <https://orcid.org/0000-0003-4091-6059> ;
           prov:used <https://pod.vardeman.me/vault/ontology/mem#> ;
           mem:stalenessClass mem:SupersededConcept ;
           mem:rationale "skill descriptions asserted '5-shape catalog (D77)'; D98 supersedes D77 with 8 NodeShapes / 11 files. Realigned three skill descriptions to D98." ;
           as:published "2026-05-23T10:05:00Z"^^xsd:dateTime .
    """ ;
```

- [ ] **Step 4: Apply the overlay and verify the vocab parses**

Run:
```bash
~/uvws/.venv/bin/python -c "import rdflib; rdflib.Graph().parse('overlays/wiki-memory/ontology/mem.ttl', format='turtle'); print('mem.ttl parses OK')"
```
Expected: `mem.ttl parses OK`.

- [ ] **Step 5: Commit**

```bash
git add overlays/wiki-memory/ontology/mem.ttl
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem.ttl: canonical <>-subject announcement + required as:object (RQ-Listener-1)

Tighten mem:Action so every operation announcement is a <>-subject resource in
.operations/ carrying as:object <target> (the link the projector derives the
target's prov:wasGeneratedBy from). Fix the RealignAction example to the canonical
form. Resolves the prior as:object-vs-prov:wasDerivedFrom prose/example divergence.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — History affordance descriptor

### Task 8: Create the `memory-history` affordance descriptor

**Files:**
- Create: `overlays/wiki-memory/affordances/memory-history.ttl`
- Modify: `overlays/wiki-memory/manifest.ttl`

- [ ] **Step 1: Write the descriptor**

> Model it on an existing query-affordance descriptor. First read one for the exact shape:
> `sed -n '1,40p' overlays/wiki-memory/affordances/wiki-search-grep.ttl`
> Match its prefixes, `prof:ResourceDescriptor` typing, `prof:hasRole`, `rdfs:label/comment`, `dct:conformsTo`, `wiki:installedBy`, and `sh:agentInstruction` style.

```turtle
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix wikirole: <https://pod.vardeman.me/vault/ontology/wikirole#> .
@prefix prof: <http://www.w3.org/ns/dx/prof/> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix as:   <https://www.w3.org/ns/activitystreams#> .

<>
    a wiki:QueryAffordance , prof:ResourceDescriptor ;
    prof:hasRole wikirole:query-affordance ;
    rdfs:label "Memory history" ;
    rdfs:comment "Reconstruct the operation history of a memory resource: the .operations/ announcements that targeted it, ordered by time, optionally joined with its Memento TimeMap for byte-level versions." ;
    dct:conformsTo <http://www.w3.org/TR/dx-prof/> ;
    wiki:installedBy <https://pod.vardeman.me/vault/ontology/overlay#wiki-memory> ;
    wiki:selectQuery """
        PREFIX as: <https://www.w3.org/ns/activitystreams#>
        SELECT ?op ?action ?published WHERE {
            ?op as:object <%RESOURCE%> ;
                a ?action ;
                as:published ?published .
            FILTER(STRSTARTS(STR(?action), \"https://pod.vardeman.me/vault/ontology/mem#\"))
        } ORDER BY DESC(?published)
    """ ;
    sh:agentInstruction "To reconstruct how a memory came to be (beyond the single derived prov:wasGeneratedBy edge on its .meta), run this SELECT with %RESOURCE% bound to the resource IRI, over an explicit source set covering /vault/wiki/.operations/ (Comunica does not traverse describedby — pass the .operations/ container + its members as default-graph-uri sources, per RQ-Pod-4). Each row is one operation that targeted the resource, newest first. For byte-level versions, follow the resource's Memento TimeMap at {resource}?ext=timemap." .
```

- [ ] **Step 2: Register the affordance in the manifest**

`overlay:installsAffordance` is a plain comma-list of hosted IRIs. Add the new affordance to that list — find the `link.ttl` entry (the last one, terminated with `;`) and insert the new IRI before it. The block becomes:

```turtle
    overlay:installsAffordance
        </vault/meta/affordances/markdown-projection.ttl> ,
        </vault/meta/affordances/hub-view.ttl> ,
        </vault/meta/affordances/breadcrumb-view.ttl> ,
        </vault/meta/affordances/memento.ttl> ,
        </vault/meta/affordances/wiki-search-grep.ttl> ,
        </vault/meta/affordances/crystallize.ttl> ,
        </vault/meta/affordances/supersede.ttl> ,
        </vault/meta/affordances/merge.ttl> ,
        </vault/meta/affordances/demote.ttl> ,
        </vault/meta/affordances/archive.ttl> ,
        </vault/meta/affordances/link.ttl> ,
        </vault/meta/affordances/memory-history.ttl> ;
```

- [ ] **Step 3: Verify both files parse**

Run:
```bash
~/uvws/.venv/bin/python -c "import rdflib; [rdflib.Graph().parse(f, format='turtle') for f in ['overlays/wiki-memory/affordances/memory-history.ttl','overlays/wiki-memory/manifest.ttl']]; print('parse OK')"
```
Expected: `parse OK`.

- [ ] **Step 4: Commit**

```bash
git add overlays/wiki-memory/affordances/memory-history.ttl overlays/wiki-memory/manifest.ttl
git commit -m "$(cat <<'EOF'
[Agent: Claude] affordance: memory-history (op log + Memento) per RQ-Listener-1 design §6

On-demand history reconstruction — the context-economy counterpart to the minimal
derived edge: the resource .meta carries one prov:wasGeneratedBy pointer; this
affordance reconstructs the full operation history when an agent needs it.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Live integration + regression net

### Task 9: Switch `_announce` to the canonical `<>`-subject form

**Files:**
- Modify: `tests/integration/test_mem_operations.py`

- [ ] **Step 1: Replace `_announce` body**

Replace the `_announce` function with the `<>`-subject form (PUT keeps the resource URL; the subject becomes the resource itself, so `_assert_announced` and the projector both key on the resource URL):

```python
def _announce(action_class_iri, subject_url):
    """PUT a <>-subject [as:Announce, mem:*Action] announcement to OPERATIONS; return (url, url).

    Canonical form per mem.ttl: the announcement resource's own subject <> is the
    activity, carrying as:object <target>. The projector derives the target's
    prov:wasGeneratedBy from this announcement.
    """
    iso_now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    ann_url = f"{OPERATIONS}{uuid.uuid4().hex}.ttl"
    body = (
        "@prefix as:   <https://www.w3.org/ns/activitystreams#> .\n"
        "@prefix mem:  <https://pod.vardeman.me/vault/ontology/mem#> .\n"
        "@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .\n\n"
        f"<> a as:Announce, <{action_class_iri}> ;\n"
        f"    as:actor <https://pod.vardeman.me/vault/profile/card#me> ;\n"
        f"    as:object <{subject_url}> ;\n"
        f'    as:published "{iso_now}"^^xsd:dateTime .\n'
    )
    r = httpx.put(ann_url, content=body,
                  headers={"Content-Type": "text/turtle"}, verify=False)
    assert r.status_code in (201, 204, 205), (
        f"PUT announcement {ann_url}: {r.status_code} {r.text[:200]}"
    )
    return ann_url, ann_url   # subject == resource url now
```

- [ ] **Step 2: Update `_assert_announced` to use the resource URL as subject**

Change the `ann = URIRef(ann_id)` line so the subject is the resource URL (the function's 2nd arg is now `ann_url`):

```python
def _assert_announced(ann_url, ann_subject, action_class_iri, subject_url):
    r = httpx.get(ann_url, headers={"Accept": "text/turtle"}, verify=False)
    assert r.status_code == 200, f"GET announcement {ann_url}: {r.status_code}"
    g = Graph().parse(data=r.text, format="turtle", publicID=ann_url)
    ann = URIRef(ann_subject)
    types = set(g.objects(ann, RDF.type))
    assert AS.Announce in types, f"as:Announce missing; got {types}"
    assert URIRef(action_class_iri) in types, f"{action_class_iri} missing; got {types}"
    objects = list(g.objects(ann, AS.object))
    assert URIRef(subject_url) in objects, f"as:object {subject_url} missing; got {objects}"
```

- [ ] **Step 3: Run the suite as-is to confirm no regression from the `<>` switch**

Run: `export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem && ~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_operations.py -v`
Expected: 6 PASS (announcements now `<>`-subject; assertions still hold).

> NOTE: This step runs against the **currently deployed** Pod. The derived-edge behavior is only live after Task 11's `make reset`. This step just guards the `<>` refactor.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/test_mem_operations.py
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem-op e2e: announcements use canonical <>-subject form

Aligns the test's announcement shape with the tightened mem.ttl (subject <> =
the activity, as:object = target). Prereq for asserting the derived edge.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Task 10: Add announce-first ordering + derived-edge assertion (regression net → enhancement)

**Files:**
- Modify: `tests/integration/test_mem_operations.py`

- [ ] **Step 1: Add a shared assertion helper**

Add near the other helpers:

```python
def _assert_derived_genesis(resource_url, ann_url, action_class_iri):
    """The resource's .meta carries prov:wasGeneratedBy pointing at the announcement,
    derived by the projector from the op log (RQ-Listener-1). The announcement is
    typed with the action class for at-a-glance reading."""
    g = _meta_graph(resource_url)
    gen = list(g.objects(URIRef(resource_url), PROV.wasGeneratedBy))
    assert URIRef(ann_url) in gen, (
        f"derived prov:wasGeneratedBy -> {ann_url} missing from .meta; got {gen}"
    )
    types = set(g.objects(URIRef(ann_url), RDF.type))
    assert URIRef(action_class_iri) in types, (
        f"inlined action type {action_class_iri} missing; got {types}"
    )
```

- [ ] **Step 2: Reorder `test_crystallize_e2e` to announce-first and assert the derived edge**

In `test_crystallize_e2e`, move the announcement *before* the durable PUT, and add the derived-edge assertion. Replace the "Perform" + "Step 4" region so the order is: announce → PUT durable → (PATCH .meta for the ungoverned wasDerivedFrom) → DELETE working. Concretely, change the sequence to:

```python
    act = _act_uri(durable_url, "crystallize")

    # Step 4 FIRST (announce-first contract): the projector derives the resource's
    # prov:wasGeneratedBy from this announcement, so it must exist before the PUT.
    ann_url, ann_subject = _announce(str(MEM.CrystallizeAction), durable_url)

    # Perform: PUT durable (projection now finds the announcement and derives the edge)
    _put(durable_url, f"# {slug}\n\nCrystallized concept.\n")

    # PATCH only the ungoverned provenance the substrate does NOT derive
    # (wasDerivedFrom links to the working source).
    durable_triples = _nt_triples(
        f'<{durable_url}> <http://www.w3.org/ns/prov#wasDerivedFrom> <{working_url}> .',
    )
    _patch_meta(durable_url, durable_triples)

    # Step 3: DELETE working note
    _delete(working_url)
```

Then in the `try:` verifications, keep Verify 1–3 and add:

```python
        # Verify 4: operation provenance recorded canonically in .operations/
        _assert_announced(ann_url, ann_subject, str(MEM.CrystallizeAction), durable_url)

        # Verify 5 (NEW): the derived denormalized edge appears in the resource .meta
        _assert_derived_genesis(durable_url, ann_url, str(MEM.CrystallizeAction))
```

- [ ] **Step 3: Apply the same announce-first + Verify-5 change to the other 5 tests**

For each of `test_supersede_e2e`, `test_merge_e2e`, `test_demote_e2e`, `test_archive_e2e`, `test_link_e2e`: (a) move its `_announce(...)` call to *before* the PUT of the resource that is the announcement's `as:object`; (b) drop any `prov:wasGeneratedBy`/action-node triples from its `_patch_meta` (the substrate derives those now); (c) add `_assert_derived_genesis(<resource>, ann_url, <action_class>)` in the `try:` block. The `<resource>` is whichever URL each test passes as the `_announce` subject. Do NOT use "same as crystallize" — edit each test's actual body with these three concrete edits.

- [ ] **Step 4: (cannot pass yet — needs Task 11's reset) Commit the test changes**

```bash
git add tests/integration/test_mem_operations.py
git commit -m "$(cat <<'EOF'
[Agent: Claude] mem-op e2e: announce-first + assert derived prov:wasGeneratedBy in .meta

Each test now POSTs its operation announcement before the body PUT (announce-first
contract) and asserts the projector-derived prov:wasGeneratedBy edge appears in the
resource .meta pointing at the announcement, on top of the canonical .operations/
assertion. Action-node triples removed from the manual PATCH (substrate derives them).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Task 11: Deploy and verify live

**Files:** none (build + reset + run).

- [ ] **Step 1: Rebuild the extension and reset the Pod**

Run:
```bash
cd css/extensions/markdown-projection && npm run build && cd ../../..
make reset
```
Expected: build clean; `make reset` completes; chained `make audit` shows 0 ERROR.

- [ ] **Step 2: Run the mem-operation e2e suite live**

Run: `export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem && ~/uvws/.venv/bin/python -m pytest tests/integration/test_mem_operations.py -v`
Expected: 6 PASS — including the new Verify-5 derived-edge assertions.

- [ ] **Step 3: Spot-check a derived edge by hand**

```bash
export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem
# announce-first, then PUT, then read .meta
ANN="https://pod.vardeman.me/vault/wiki/.operations/manual-check.ttl"
RES="https://pod.vardeman.me/vault/wiki/concepts/manual-check.md"
curl -sk -X PUT "$ANN" -H "Content-Type: text/turtle" --data-binary @- <<EOF
@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<> a as:Announce, mem:CrystallizeAction ; as:object <$RES> ;
   as:published "2026-05-25T12:00:00Z"^^xsd:dateTime .
EOF
curl -sk -X PUT "$RES" -H "Content-Type: text/markdown" --data-binary $'---\ntype: concept\n---\n# Manual Check\n\nbody\n'
curl -sk "$RES.meta" -H "Accept: text/turtle" | grep -i "wasGeneratedBy"
curl -sk -X DELETE "$RES"; curl -sk -X DELETE "$ANN"
```
Expected: the `.meta` shows `prov:wasGeneratedBy <…/.operations/manual-check.ttl>` (NOT the markdown-projection affordance URI), confirming derivation end-to-end.

- [ ] **Step 4: Run the broader suite to confirm no regressions**

Run: `~/uvws/.venv/bin/python -m pytest tests/integration -v`
Expected: no NEW failures versus the pre-change baseline. (Pre-existing `test_phase5j_close` count-drift failures are out of scope — see FOLLOWUPS — confirm the set of failures is unchanged, not that it is empty.)

- [ ] **Step 5: Commit any fixups + update FOLLOWUPS/MEMORY**

Mark the RQ-Listener-1 FOLLOWUPS entry resolved (the workaround is retired; the derived edge ships), and correct the stale "silently red" note in `.claude/memory/MEMORY.md` (the 6 tests were green via workaround; they now assert the derived edge).

```bash
git add FOLLOWUPS.md .claude/memory/MEMORY.md
git commit -m "$(cat <<'EOF'
[Agent: Claude] FOLLOWUPS/MEMORY: RQ-Listener-1 resolved via op-log derivation

The 6 mem-op tests now assert a projector-derived prov:wasGeneratedBy on the
resource .meta (derived from the canonical .operations/ log), retiring the
.operations/-only workaround. Broad agent-extension xfail stays deferred (path B).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Follow-on (not part of this build; research/eval-harness)

The design's §7 experiments (P-current vs P-origin vs P-both; announce-first reliability; op-log+Memento sufficiency; context-economy payoff; VC-readiness; op-log scan scale) are validated via Rung-1.5 agentic trajectories, not unit/e2e tests. This plan ships **P-current** (latest action wins) as the v1 policy — the `derive()` returns the latest by `as:published`; switching to P-origin (earliest) or P-both (two edges) is a localized change in `operationLog.findLatestAction` + the pipeline emit block. Defer until trajectory evidence indicates a switch. Track under the existing Rung-1.5 candidates.

---

## Notes for the implementer

- **Sync the bundled `pod_audit.py`?** No — this plan does not touch `scripts/pod_audit.py` or `shapes/substrate/`. Ignore `make sync-curator-skill`.
- **If `make reset` is slow / you only changed TS:** still use `make reset` for the final live verification — projection changes load via Components.js at server init, and the volume must be fresh to trust the result (per `docker-patterns.md`).
- **If Task 1 revealed a `$.ttl` on-disk suffix:** the only code affected is `filenameToUrl` in `operationLog.ts` — extend the strip. The unit tests use plain `.ttl` names and still pass; add one fixture with a `$.ttl` name if the live encoding uses it.
- **Commit cadence:** every task ends in a commit. Stage specific files (never `git add -A`).
