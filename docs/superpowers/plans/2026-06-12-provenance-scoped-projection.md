# Provenance-Scoped Projection Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the projection's predicate-keyed `.meta` strip with subtraction of its own prior output (`.meta_next = (.meta_pre − f(body_old)) ∪ f(body_new)`), per `docs/superpowers/specs/2026-06-12-provenance-scoped-projection-replacement.md` (§7 DECIDED: version-stamp + migration sweep) — dissolving D82 and flipping its strict-xfail test to pass.

**Architecture:** The admission floor runs PRE-commit, so it snapshots the old `.meta` and old body before CSS's `writeMetadataFile` clobbers anything (the actual D82 root cause, per the xfail message in `tests/test_wiki_memory_l3_listener_integration.py:162`) — primary path is exact and synchronous. The async listener backstop reconstructs `body_old` from the Memento git history; when it can't, it degrades to a pair-shadow subtraction (strictly narrower than today's strip) + a `mem:DeriveClass` curation signal. A `sub:projectorVersion` stamp (next to `sub:bodyHash`) detects projector drift; the migration sweep re-baselines a Pod after a version bump.

**Tech Stack:** TypeScript CSS v8 extensions (N3, vitest; ESM `src/` + CJS `src-cjs/` split in markdown-projection), the memento extension's git utils, pytest live-integration, one Haiku mechanism probe (per the model-selection policy).

**Branch:** `prov-scoped-projection` off main; merge no-ff at the end.

**Pre-flight:** `make reset` green; `make test && make test-js` green (1 known timemap flake; `test_agent_enrichment_survives_body_rewrite` is strict-xfail — it MUST currently xfail); `make audit` 0 ERROR.

---

## File structure

```
css/extensions/markdown-projection/
  src/projectionDelta.ts            CREATE — subtractProjected + pairShadow (pure)
  src/metaWriter.ts                 MODIFY — replaceProjected(); F7 special case + predicate strip deleted
  src/projectionPipeline.ts         MODIFY — export PROJECTOR_VERSION
  src-cjs/markdownBodyProjector.ts  MODIFY — snapshot() + materialize(..., snapshot)
  src-cjs/listener.ts               MODIFY — Memento old-body fetch; degraded mode + signal
  src-cjs/gitRead.ts                CREATE — thin gitLogBefore/gitShow (mirrors memento/src/git.ts)
  test/projectionDelta.test.ts      CREATE
  test/metaWriter.test.ts           MODIFY — new semantics
  test/listenerBackstop.test.ts     CREATE
  maps.json                         MODIFY — substrateInternal += projectorVersion
css/extensions/shape-validator/
  src/storage/AdmissionFloorStore.ts MODIFY — pre-commit snapshot; version stamp
  src/util/StampPredicate.ts         MODIFY — + VERSION_PRED
css/config/markdown-projection.json  MODIFY — gitDir param for the listener (mirror memento.json)
overlays/wiki-memory/vocabulary/substrate.ttl  MODIFY — sub:projectorVersion (content-laden)
scripts/projector_migrate.py         CREATE — the migration sweep
tests/test_wiki_memory_l3_listener_integration.py  MODIFY — D82 xfail FLIPPED
tests/test_projection_subtraction.py CREATE — live round-trips
evals/proj-enrich/                   CREATE — Haiku mechanism probe (slim template)
.claude/skills/decision-lookup/decisions.md  MODIFY — D82 resolution + D116
FOLLOWUPS.md, spec EXECUTED banner   MODIFY (final task)
```

---

### Task 1: `projectionDelta.ts` — the pure subtraction core

**Files:**
- Create: `css/extensions/markdown-projection/src/projectionDelta.ts`
- Create: `css/extensions/markdown-projection/test/projectionDelta.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { Parser, DataFactory } from "n3";
import type { Quad } from "n3";
import { subtractProjected, pairShadow } from "../src/projectionDelta";

const { namedNode, literal, quad } = DataFactory;
const parse = (ttl: string): Quad[] => new Parser({ baseIRI: "https://p.example/x.md.meta" }).parse(ttl);

const PAGE = "https://p.example/x.md";
const THIS = `${PAGE}#this`;
const q = (s: string, p: string, o: string, lit = false) =>
  quad(namedNode(s), namedNode(p), lit ? literal(o) : namedNode(o));

const PREF = "http://www.w3.org/2004/02/skos/core#prefLabel";
const BROADER = "http://www.w3.org/2004/02/skos/core#broader";

describe("subtractProjected", () => {
  it("removes exactly the old projection, term-equal", () => {
    const oldProj = [q(THIS, PREF, "Old", true), q(THIS, BROADER, "https://p.example/a.md#this")];
    const current = [...oldProj, q(THIS, "https://p.example/agent#note", "kept", true)];
    const out = subtractProjected(current, oldProj);
    expect(out).toHaveLength(1);
    expect(out[0].predicate.value).toBe("https://p.example/agent#note");
  });

  it("agent triple using a GOVERNED predicate on a foreign subject survives", () => {
    const oldProj = [q(THIS, PREF, "X", true)];
    const foreign = q("https://p.example/other#it", PREF, "Agent-asserted", true);
    const out = subtractProjected([...oldProj, foreign], oldProj);
    expect(out).toEqual([foreign]);
  });

  it("agent triple identical to a projected triple is removed with it (coincidence rule, spec §5)", () => {
    const t = q(THIS, BROADER, "https://p.example/b.md#this");
    expect(subtractProjected([t], [t])).toHaveLength(0);
  });

  it("empty old projection (first write) subtracts nothing", () => {
    const cur = [q(THIS, PREF, "New", true)];
    expect(subtractProjected(cur, [])).toEqual(cur);
  });

  it("idempotency: (S − f(b)) ∪ f(b) has the same canonical set as S ∪ f(b)", () => {
    const fb = [q(THIS, PREF, "L", true)];
    const s = [...fb, q(THIS, "https://p.example/agent#note", "n", true)];
    const once = [...subtractProjected(s, fb), ...fb];
    expect(new Set(once.map(String)).size).toBe(new Set(s.map(String)).size);
  });
});

describe("pairShadow (degraded mode — spec §5)", () => {
  it("removes only quads matching (subject, predicate) pairs the NEW projection emits", () => {
    const newProj = [q(THIS, PREF, "New", true)];
    const current = [
      q(THIS, PREF, "Stale", true),                                   // shadowed pair → removed
      q(THIS, BROADER, "https://p.example/old.md#this"),              // pair NOT in new proj → kept
      q("https://p.example/other#it", PREF, "foreign", true),         // foreign subject → kept
    ];
    const out = pairShadow(current, newProj);
    expect(out.map((x) => x.predicate.value + "|" + x.subject.value).sort()).toEqual([
      `${BROADER}|${THIS}`,
      `${PREF}|https://p.example/other#it`,
    ].sort());
  });
});
```

NOTE the **pair-shadow keeps a stale `broader` when the new body drops the edge** — that residue is exactly why degraded mode emits a curation signal (Task 5). The test documents the limitation deliberately.

- [ ] **Step 2: Run to verify failure**

Run: `cd css/extensions/markdown-projection && npx vitest run test/projectionDelta.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import type { Quad } from "n3";

/** Canonical key: term-equality including literal datatype/lang. */
const key = (q: Quad): string =>
  `${q.subject.value}|${q.predicate.value}|${q.object.termType}|${q.object.value}|` +
  `${(q.object as any).language ?? ""}|${(q.object as any).datatype?.value ?? ""}`;

/** Exact subtraction: remove from `current` every quad term-equal to one in `oldProjected`.
 *  Set semantics (RDF graphs are sets): one old quad removes all term-equal occurrences. */
export function subtractProjected(current: Quad[], oldProjected: Quad[]): Quad[] {
  const old = new Set(oldProjected.map(key));
  return current.filter((q) => !old.has(key(q)));
}

/** Degraded mode (no old body recoverable): remove quads whose (subject, predicate)
 *  pair the NEW projection emits — strictly narrower than the legacy predicate strip.
 *  May leave residue for pairs the new body no longer emits; callers MUST pair this
 *  with a mem:DeriveClass curation signal (spec §5). */
export function pairShadow(current: Quad[], newProjected: Quad[]): Quad[] {
  const pairs = new Set(newProjected.map((q) => `${q.subject.value}|${q.predicate.value}`));
  return current.filter((q) => !pairs.has(`${q.subject.value}|${q.predicate.value}`));
}
```

- [ ] **Step 4: Run to verify pass**, then **Step 5: Commit**

```bash
git checkout -b prov-scoped-projection
git add css/extensions/markdown-projection/src/projectionDelta.ts css/extensions/markdown-projection/test/projectionDelta.test.ts
git commit -m "[Agent: Claude] PSP-T1: projectionDelta — exact subtraction + pair-shadow degraded mode"
```

### Task 2: `MetaWriter.replaceProjected` — snapshot in, subtraction inside, strip deleted

**Files:**
- Modify: `css/extensions/markdown-projection/src/metaWriter.ts` (replaceGoverned at ~37-141; F7 case at ~74-79)
- Modify: `css/extensions/markdown-projection/test/metaWriter.test.ts`

- [ ] **Step 1: Write the failing tests.** READ metaWriter.test.ts first; REPLACE the strip-semantics cases (preserve-non-governed / replace-governed / F7 subject-scope) with the new contract, keeping the file's existing fixture idioms:

```typescript
// New contract: replaceProjected(target, newProjected, oldProjected, { resourceUrl, snapshotTtl })
it("preserves agent triples — including governed predicates on foreign subjects", async () => {
  // snapshotTtl = old .meta carrying: old projection (prefLabel "Old" on #this)
  //   + agent quad (foreign subject, prefLabel) + agent quad (ungoverned predicate)
  // oldProjected = the prefLabel-"Old" quad; newProjected = prefLabel "New"
  // EXPECT written .meta: prefLabel "New" on #this, BOTH agent quads, NO "Old"
});
it("uses the provided snapshot, NOT the on-disk .meta (CSS clobber simulation)", async () => {
  // write a DIFFERENT (clobbered/empty) .meta file on disk; pass the rich snapshotTtl
  // EXPECT the agent quads from the snapshot in the result — proving the pre-commit
  // snapshot wins over the post-clobber file (the D82 root-cause case)
});
it("falls back to reading the on-disk .meta when no snapshot is given (listener path)", async () => {});
it("null oldProjected triggers pairShadow semantics", async () => {});
it("prov:wasGeneratedBy on the resource subject survives without any special case", async () => {
  // the F7 regression case, now passing through plain subtraction
});
```

Fill the bodies concretely using the existing test file's tmp-dir + Turtle-fixture helpers (read them; mirror exactly).

- [ ] **Step 2: Run to verify failures.**

- [ ] **Step 3: Implement.** In `metaWriter.ts`:

```typescript
import { subtractProjected, pairShadow } from "./projectionDelta";

export interface ReplaceOpts {
  resourceUrl?: string;
  /** Pre-commit .meta snapshot (Turtle). When given, the on-disk .meta is IGNORED —
   *  the floor reads it before CSS's writeMetadataFile clobbers it (D82 root cause). */
  snapshotTtl?: string;
}

async replaceProjected(
  target: string,
  newProjected: Quad[],
  oldProjected: Quad[] | null,   // null → degraded pairShadow (caller emits the curation signal)
  opts: ReplaceOpts = {},
): Promise<void> {
  const metaPath = `${target}.meta`;
  const metaBaseIri = opts.resourceUrl ? `${opts.resourceUrl}.meta` : undefined;
  const existing = opts.snapshotTtl !== undefined
    ? this.parse(opts.snapshotTtl, metaBaseIri)
    : await this.readExisting(metaPath, metaBaseIri);
  const currentQuads = existing.getQuads(null, null, null, null);
  const preserved = oldProjected === null
    ? pairShadow(currentQuads, newProjected)
    : subtractProjected(currentQuads, oldProjected);
  this.write(metaPath, new Store([...preserved, ...newProjected]));
}
```

(Adapt names to the file's real private helpers — `readExisting`/`write` exist per the current code; add `parse` as a thin wrapper over the same N3 Parser call `readExisting` uses.) DELETE `replaceGoverned` and the F7 filter entirely — Task 3/5 migrate both callers in the same branch; `grep -rn "replaceGoverned" css/` must return zero at the end of Task 5.

- [ ] **Step 4: vitest run** (whole extension — `mapsSidecar`/`listenerGovernedSet`/`renderProjectionAgreement` must stay green; the governed sets still exist for the floor/declaration, untouched). **Step 5: Commit** `[Agent: Claude] PSP-T2: MetaWriter.replaceProjected — snapshot-aware subtraction; predicate strip + F7 case deleted`

### Task 3: Floor path — pre-commit snapshot, exact subtraction, version stamp

**Files:**
- Modify: `css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts` (setRepresentation ~96-166, materialize ~248-255)
- Modify: `css/extensions/shape-validator/src/util/StampPredicate.ts`
- Modify: `css/extensions/markdown-projection/src-cjs/markdownBodyProjector.ts` (project ~117-164, materialize ~175-199)
- Modify: `css/extensions/markdown-projection/src/projectionPipeline.ts` (export the version)
- Test: extend `css/extensions/shape-validator` + `markdown-projection` suites (read their existing floor/projector test files first; mirror idioms)

- [ ] **Step 1: Version constant.** In `projectionPipeline.ts`: read the extension's own `package.json` version at module load (`import pkg from "../package.json"` with `resolveJsonModule`, or `createRequire` per the file's existing import style — READ the tsconfig first) and export `export const PROJECTOR_VERSION: string = pkg.version;`. In `StampPredicate.ts` add `export const VERSION_PRED = "https://pod.vardeman.me/vault/ontology/substrate#projectorVersion";`.

- [ ] **Step 2: Failing integration-shaped unit test** (floor store stub, mirroring the existing AdmissionFloorStore tests): a `setRepresentation` over a resource whose stubbed old `.meta` contains an agent triple → after the write, the materialized `.meta` keeps the agent triple, carries the new projection, exactly one `sub:bodyHash` + one `sub:projectorVersion`.

- [ ] **Step 3: Implement the snapshot flow.** In `MarkdownBodyProjector` add:

```typescript
/** Pre-commit snapshot — MUST be called before super.setRepresentation commits
 *  (CSS writeMetadataFile clobbers .meta during commit; this is the D82 fix). */
async snapshot(identifier: ResourceIdentifier): Promise<{ oldBody: string | null; oldMetaTtl: string | null }> {
  const fsPath = this.fsPath(identifier);            // same fsPathFromUrl already used
  const read = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return null; } };
  return { oldBody: read(fsPath), oldMetaTtl: read(`${fsPath}.meta`) };
}
```

`materialize` gains the snapshot + computes the subtraction inputs:

```typescript
async materialize(identifier, quads, governed, snapshot): Promise<void> {
  const fsPath = this.fsPath(identifier);
  let oldProjected: Quad[] | null = null;
  if (snapshot?.oldBody !== null && snapshot?.oldMetaTtl !== null
      && this.stampMatches(snapshot.oldMetaTtl, VERSION_PRED, PROJECTOR_VERSION)) {
    oldProjected = await this.runPipelineFor(identifier, snapshot.oldBody);  // f(body_old), same params as project()
  }
  await metaWriter.replaceProjected(fsPath, quads, oldProjected,
    { resourceUrl: identifier.path, snapshotTtl: snapshot?.oldMetaTtl ?? undefined });
  // post-projection hook unchanged
}
```

`stampMatches` parses the snapshot Turtle and compares the `VERSION_PRED` object (absent stamp → no match → degraded; this is also the pre-migration state of every existing resource — by design, the sweep in Task 6 re-baselines). `runPipelineFor` refactors the existing `project()` body so both share one pipeline-invocation path (same typeIndex/routing args — extract the current lines ~138-151 into a private method; NOTE the Type-Index-drift caveat from the spec applies and is accepted). In `AdmissionFloorStore.setRepresentation`: take the snapshot BEFORE `super.setRepresentation` (line ~159) and pass it through to `this.materialize(...)`; `stampQuad` additionally emits the `VERSION_PRED` quad with `PROJECTOR_VERSION`, and the stamp predicates ride in the projected set exactly as `bodyHash` does today.

When `oldProjected === null` (degraded), call the same curation-signal emitter Task 5 builds (it lives in the projector so both paths share it) — for Task 3, land the call site with a no-op logger emitter; Task 5 fills it.

- [ ] **Step 4:** vitest both extensions + `npm run build` both + `make test-js`. **Step 5: live check** — `make reset`, then the PUT→PATCH→PUT sequence by hand (curl: PUT a concept; N3-PATCH an ungoverned triple into its `.meta`; PUT the same body again; GET `.meta` → the agent triple is still there, exactly one bodyHash/projectorVersion). **Step 6: Commit** `[Agent: Claude] PSP-T3: floor pre-commit snapshot + exact subtraction + projector version stamp`

### Task 4: substrate vocabulary + maps agreement

**Files:**
- Modify: `overlays/wiki-memory/vocabulary/substrate.ttl` — add `sub:projectorVersion` next to `sub:bodyHash`'s declaration, content-laden comment (the twin-probe lesson): `"The markdown-projection version that materialized this .meta (stamped beside sub:bodyHash). The projection subtracts exactly its own prior output when re-projecting; a version mismatch means the prior output cannot be recomputed exactly — re-projection then degrades to pair-shadow replacement and flags curation. Substrate-internal; agents never write it."` ALSO fix 🧷 (h) while in the file: give `sub:bodyHash` a definition (it's currently undeclared — the E7 re-run showed agents burning grounding budget on it) and (k): re-cut the stale `sub:viewAuthority` comment to past-tense/historical.
- Modify: `css/extensions/markdown-projection/maps.json` — `substrateInternal` += the projectorVersion IRI.
- The `mapsSidecar.test.ts` agreement test must pass (it pins maps.json ≡ TS constants — read it; if substrateInternal is pinned, update the TS-side constant it compares against).

- [ ] Steps: failing agreement test (or extend it) → edits → `npx vitest run` + `make reset` + `curl -sk https://pod.vardeman.me/vault/ontology/substrate -H "Accept: text/turtle" | grep -A3 projectorVersion` → commit `[Agent: Claude] PSP-T4: sub:projectorVersion + bodyHash defined in the vocabulary (🧷 h,k closed); maps agreement`

### Task 5: Listener backstop — Memento old body, degraded mode + curation signal

**Files:**
- Create: `css/extensions/markdown-projection/src-cjs/gitRead.ts` — thin `gitLogBefore(gitDir, beforeIso, relPath)` + `gitShow(gitDir, hash, relPath)` mirroring `css/extensions/memento/src/git.ts` (~lines 99-114; READ it and mirror the exec/escaping exactly; do NOT import across extension packages — note the duplication with a header comment naming the source + an agreement test that both files' git invocation strings match, the repo's mirror-test idiom).
- Modify: `css/extensions/markdown-projection/src-cjs/listener.ts` (project() ~285-422)
- Modify: `css/config/markdown-projection.json` — `gitDir` param on the listener instance (mirror memento.json's `"gitDir": { "@id": "urn:solid-server:default:variable:rootFilePath" }`)
- Create: `css/extensions/markdown-projection/test/listenerBackstop.test.ts`

- [ ] **Step 1: failing unit tests** (stub store + a fixture git repo created in a tmp dir by the test — `git init`, commit body v1, write body v2 to the FS): backstop reprojection recovers `f(v1)` via gitRead and preserves an agent triple from the on-disk `.meta`; with NO git history → pairShadow used AND the curation signal emitted (assert via the emitter stub); version-stamp mismatch in `.meta` → same degraded behavior.

- [ ] **Step 2: implement.** In `listener.project()` where `shouldReproject` returned true: before running the pipeline, attempt `body_old`:

```typescript
const rel = relative(this.dataDir, fsPath);
let oldBody: string | null = null;
try {
  const prior = gitLogBefore(this.gitDir, new Date().toISOString(), rel);
  if (prior) oldBody = gitShow(this.gitDir, prior.hash, rel).toString("utf8");
} catch { /* no history → degraded */ }
```

Guard: if the recovered `oldBody` hashes to the CURRENT body's hash (git already committed the new write), walk one commit further back (`gitLogBefore` with the prior commit's datetime minus 1s — read how MementoCommitListener orders commit-vs-event to get this right; if ordering proves ambiguous, prefer degraded mode over a wrong subtraction and say so in a comment). Then: version stamp from the on-disk `.meta` must match `PROJECTOR_VERSION` AND `oldBody !== null` → `oldProjected = f(oldBody)`; else `null`. Call `metaWriter.replaceProjected(fsPath, triples, oldProjected, { resourceUrl: target.path })` (no snapshotTtl — the on-disk `.meta` IS the listener's best source). **Curation signal emitter** (shared, in the projector module): POSTs to `/vault/wiki/.operations/` a conformant `mem:RealignAction` proposal? NO — wrong class; READ how `css/extensions/mem-trigger`'s detectors emit events to `.events/` (the ContradictionDetector path) and mirror it exactly: a `mem:DeriveClass`-flagged event record `{ a mem:StalenessDetected? → use the event class mem-trigger actually emits with mem:stalenessClass mem:Materialization ; as:object <resource> ; as:summary "re-projection degraded (no recoverable prior body / version mismatch); residue possible" }`. Whatever shape mem-trigger emits, match it — the grader is the existing `.events/` consumer tests.

- [ ] **Step 3:** vitest + build + `make test-js` + live: `make reset`; out-of-band write simulation (the existing backstop integration test idiom — find it: `grep -rn "shouldReproject\|backstop" tests/`), verify survival + no signal on the happy path. **Step 4: Commit** `[Agent: Claude] PSP-T5: listener backstop — Memento old-body subtraction; degraded mode emits curation signal`

### Task 6: D82 flip + migration sweep

**Files:**
- Modify: `tests/test_wiki_memory_l3_listener_integration.py:162-223` — REMOVE the `@pytest.mark.xfail` decorator; replace its reason-comment with: `# D82 resolved by provenance-scoped projection (spec 2026-06-12): the floor snapshots .meta pre-commit and subtracts exactly its own prior output.` Complete the test body's second-PUT assertion if it was left partial (read it; assert the PATCHed triple present after the second PUT + projection settle).
- Create: `scripts/projector_migrate.py`:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx", "rdflib"]
# ///
"""Migration sweep (spec §6): after a projector version bump, re-baseline every
markdown resource — re-PUT each body unchanged; the floor re-projects (degraded
pair-shadow on the old-version resources), stamps the new version, and flags any
residue to the curation lane. Idempotent; run once per bump.

Usage: SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python scripts/projector_migrate.py [--pod https://pod.vardeman.me]
"""
import argparse, sys
import httpx
from rdflib import Graph, Namespace

LDP = Namespace("http://www.w3.org/ns/ldp#")
WIKI_CONTAINERS = ["concepts", "people", "places", "events", "organizations", "procedures", "working"]

def members(client, ctr):
    g = Graph()
    g.parse(data=client.get(ctr, headers={"Accept": "text/turtle"}).text, format="turtle", publicID=ctr)
    return [str(m) for m in g.objects(None, LDP.contains) if str(m).endswith(".md")]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pod", default="https://pod.vardeman.me")
    args = ap.parse_args()
    n = bad = 0
    with httpx.Client(verify=False, timeout=30) as c:
        for name in WIKI_CONTAINERS:
            for m in members(c, f"{args.pod}/vault/wiki/{name}/"):
                body = c.get(m).text
                r = c.put(m, content=body, headers={"Content-Type": "text/markdown"})
                n += 1
                if r.status_code not in (201, 205):
                    bad += 1
                    print(f"FAIL {m}: {r.status_code} {r.text[:120]}", file=sys.stderr)
    print(f"swept {n} resources, {bad} failures")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
```

- Create: `tests/test_projection_subtraction.py` — live round-trips:

```python
"""PSP live contract: enrichment survives; subtraction is idempotent; version stamped."""
import httpx, pytest, uuid
from rdflib import Graph, Namespace, URIRef, Literal
from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
SUB = Namespace("https://pod.vardeman.me/vault/ontology/substrate#")
pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")

BODY1 = "---\ntype: Concept\n---\n# PSP Probe\n\n[PSP Probe]{.prefLabel} is [a subtraction test concept.]{.definition}\n"
BODY2 = BODY1.replace("a subtraction test concept", "a REVISED subtraction test concept")
N3_ENRICH = """@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<> a solid:InsertDeletePatch;
solid:inserts { <%s#this> <https://example.org/agent#assessedBy> <https://example.org/agents/probe> . }.
"""

def _meta(url):
    g = Graph()
    g.parse(data=httpx.get(f"{url}.meta", headers={"Accept": "text/turtle"}, verify=_CA).text,
            format="turtle", publicID=url)
    return g

def test_enrichment_survives_and_projection_updates():
    slug = f"psp-{uuid.uuid4().hex[:8]}"
    url = f"{POD}/vault/wiki/concepts/{slug}.md"
    assert httpx.put(url, content=BODY1, headers={"Content-Type": "text/markdown"}, verify=_CA).status_code in (201, 205)
    r = httpx.patch(f"{url}.meta", content=N3_ENRICH % url,
                    headers={"Content-Type": "text/n3"}, verify=_CA)
    assert r.status_code in (200, 205), r.text[:200]
    assert httpx.put(url, content=BODY2, headers={"Content-Type": "text/markdown"}, verify=_CA).status_code in (201, 205)
    g = _meta(url)
    assert (URIRef(f"{url}#this"), URIRef("https://example.org/agent#assessedBy"), None) in g, "enrichment clobbered"
    assert "REVISED" in str(g.serialize(format="turtle")), "projection not updated"
    assert len(list(g.objects(None, SUB.projectorVersion))) == 1
    httpx.delete(url, verify=_CA)

def test_reput_same_body_is_noop_on_meta():
    slug = f"psp-{uuid.uuid4().hex[:8]}"
    url = f"{POD}/vault/wiki/concepts/{slug}.md"
    httpx.put(url, content=BODY1, headers={"Content-Type": "text/markdown"}, verify=_CA)
    before = _meta(url).serialize(format="ntriples")
    httpx.put(url, content=BODY1, headers={"Content-Type": "text/markdown"}, verify=_CA)
    after = _meta(url).serialize(format="ntriples")
    assert sorted(before.splitlines()) == sorted(after.splitlines()), "re-PUT not idempotent"
    httpx.delete(url, verify=_CA)
```

- [ ] Steps: flip the xfail → `make reset` → `~/uvws/.venv/bin/python -m pytest tests/test_wiki_memory_l3_listener_integration.py tests/test_projection_subtraction.py -v` ALL PASS (the D82 test now passes as a normal test) → run the sweep against the live Pod (`projector_migrate.py`) → expect 0 failures + `make audit` 0 ERROR → full suite (`make test`) no new failures → commit `[Agent: Claude] PSP-T6: D82 xfail FLIPPED + migration sweep + live subtraction contract tests`

### Task 7: the mechanism probe (Haiku, slim template)

**Files:** Create `evals/proj-enrich/` (README.md, prompts/task.txt per `evals/lib/PROMPT-TEMPLATE.md`, run_probe.sh copied from `evals/e5b-write/run_probe.sh` — it already has env-u + PROBE_MODEL/PROBE_MAX_TURNS).

- [ ] **Step 1:** task.txt (slim template; ROUTE ≤10 lines / ANSWER / PROVENANCE): "A Solid Pod is at https://pod.vardeman.me/vault/. (1) Read the concept https://pod.vardeman.me/vault/wiki/concepts/photosynthesis.md and its metadata. (2) Add ONE annotation of your own to its metadata: a triple on the concept subject using a predicate you mint under https://example.org/probe# recording today's date as your review date (the Pod accepts N3 PATCH on the .meta resource). (3) Change the concept's definition sentence in the body (keep everything else) and PUT it back. (4) Report whether your annotation survived the rewrite, quoting the metadata before and after."
- [ ] **Step 2:** copy rig outside the repo, run `PROBE_MODEL=haiku ./run_probe.sh run1` ×2 (mechanism probe = Haiku per the model policy; this is deterministic substrate behavior, not disposition measurement). Grade: annotation present post-rewrite in BOTH runs + the agent's own before/after quotes agree with a direct curl check. Cost-check with `python3 ../../evals/lib/cost.py runs/*/trajectory.jsonl`.
- [ ] **Step 3:** restore photosynthesis (`make reset`), port rig, short report `docs/plans/2026-06-12-psp-enrichment-probe-report.md` (or current date), commit `[Agent: Claude] PSP-T7: enrichment round-trip probe (Haiku mechanism check) — report + rig`

### Task 8: decisions + bookkeeping + merge

- [ ] **Step 1:** `.claude/skills/decision-lookup/decisions.md`: (a) D82 entry → annotate **RESOLVED BY DISSOLUTION 2026-06-12** (provenance-scoped projection; sidecar unbuilt; the strict-xfail test now passes; cite the spec + this plan); (b) new **D116 — provenance-scoped projection replacement** entry: the subtraction contract, the three-station table, version-stamp + migration sweep, degraded-mode + curation signal, the F7 fix superseded, prior-art lineage (LDP / OBO is_inferred / Graphiti / UMP corroboration); index line updated (D1-D116).
- [ ] **Step 2:** FOLLOWUPS: mark the ★ NEXT spec item EXECUTED; **ungate 🧷 (a)** (markdown-lane write contract — now schedulable; do NOT build it here); mark 🧷 (h) + (k) closed (Task 4); spec gets the EXECUTED banner; MEMORY anchor updated (one paragraph: PSP shipped, D82 dissolved, next = markdown-lane write contract or the 🧷 queue).
- [ ] **Step 3:** Full verification: `make test` (the timemap flake only) + `make test-js` + `make audit` 0 ERROR.
- [ ] **Step 4:** Merge: `git checkout main && git merge --no-ff prov-scoped-projection -m "[Agent: Claude] merge: provenance-scoped projection replacement (D116; D82 dissolved)" && git branch -d prov-scoped-projection`. Push = Chuck's call.

---

## Self-review notes (done at plan time)

- Spec coverage: §4 contract (T1/T2), §5 both paths incl. degraded+signal (T3/T5), §6 version stamp + sweep (T3/T4/T6), §8.5 D82 re-cut (T6/T8), §8.6 probe (T7 — Haiku per the model policy since it's mechanism-validation), 🧷 (h)/(k) opportunistic closes (T4). The §5 "narrower-never-wider" property is pinned by T1's pairShadow test.
- Honest soft spots for executors: the ESM/CJS import of `projectionDelta` from `src-cjs` callers must follow the existing lazy-ESM-import pattern (`getPipeline()` in listener.ts — mirror it); the memento commit-vs-event ordering in T5's one-commit-back walk must be read from `MementoCommitListener`, and degraded mode is the REQUIRED fallback whenever ordering is ambiguous; `metaWriter.test.ts` bodies are sketched by contract — fill from the file's existing fixtures.
- The coincidence rule (agent asserts a triple the body also projects → removed with the old projection if the body drops it) is deliberate spec §5 behavior, tested in T1, and documented — not a bug for reviewers to "fix".
