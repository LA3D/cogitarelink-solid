# Read-Path View Authority (D114) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct D113's read-path delivery per `docs/superpowers/specs/2026-06-07-read-path-view-authority-design.md`: remove the markdown trailer, make `?_profile=fused` the substrate-wide content-type-agnostic fused-read contract, and add a declared view-authority contract — keeping PROF profiles, the Person demonstrator, and the declared-query engine.

**Architecture:** Mostly subtraction (revert the trailer/guard/doc-view that the cold probe didn't validate) plus two additions: fix `?_profile=fused` to cover every tree + content type, and add a teach-the-convention view-authority artifact. This reverts code merged earlier today on `main` (D113, merge `9dd3d92`); the Pod is live on it, so `make rebuild` + smoke after config/handler changes.

**Tech Stack:** TypeScript (CSS v8 extension, Components.js, vitest), Python (overlay scripts, pytest/httpx integration), Turtle/SHACL/PROF.

**Key current-state facts (verified 2026-06-07):**
- `css/extensions/view-layer/`: `ViewHttpHandler.ts` has `VALID_TOKENS = ["doc","fused","graph","alt"]`, `DESCRIPTOR_NAMES = ["document","fused","graph","people"]`; `serveDoc`/`serveFused`/`serveGraph`/`serveAlt`. `TrailerDecoratingStore.ts` + `trailer.ts` + their tests exist.
- `css/config/view-layer.json`: a `TrailerDecoratingStore` instance (`urn:cogitarelink:ResourceStore_Trailer`) + an OperationHandler override snapshot routing all LDP ops through it.
- `css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts`: `POD_NOTICE_MARKER` 422 guard in both `setRepresentation` and `addResource`.
- `overlays/wiki-memory/views/`: `document.ttl`, `fused.ttl`, `graph.ttl`, `people.ttl`, `fused-projection`, `people-projection`; manifest `overlay:installsView` lists all four descriptors.
- The 6 PROF class profiles live at `overlays/wiki-memory/profiles/{page,concept,source,person,procedure,working}.ttl`, overlay-installed.
- `?_profile=fused`/`graph` currently fail to surface `.meta` on `/id/` resources (the substrate-wide bug, Task 5).

---

## File structure

```
REMOVE:
  css/extensions/view-layer/src/TrailerDecoratingStore.ts        (+ tests/TrailerDecoratingStore.test.ts)
  css/extensions/view-layer/src/trailer.ts                       (+ tests/trailer.test.ts)
  overlays/wiki-memory/views/document.ttl, graph.ttl

MODIFY:
  css/extensions/view-layer/src/index.ts            — drop trailer exports
  css/extensions/view-layer/src/ViewHttpHandler.ts  — drop doc+graph tokens, keep fused+alt; fused content-type branch
  css/extensions/view-layer/tests/ViewHttpHandler.test.ts
  css/config/view-layer.json                        — remove Trailer instance + OperationHandler override
  css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts  — remove marker guard
  css/extensions/shape-validator/test/AdmissionFloorStore.test.ts
  overlays/wiki-memory/manifest.ttl                 — installsView drops document+graph
  overlays/wiki-memory/profiles/*.ttl               — add sh:agentInstruction view-authority (Task 7)
  overlays/wiki-memory/ (storage description seed)  — link the view-authority statement (Task 7)
  tests/test_view_layer_integration.py             — drop trailer/marker/doc; add fused-on-RDF + authority discovery

DOCS:
  docs/superpowers/specs/2026-06-07-view-layer-design.md  — supersession note
  FOLLOWUPS.md, .claude/memory/MEMORY.md
```

Commit after each task: `[Agent: Claude]` prefix + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Remove the trailer module from the extension

**Files:**
- Delete: `css/extensions/view-layer/src/TrailerDecoratingStore.ts`, `css/extensions/view-layer/src/trailer.ts`, `css/extensions/view-layer/tests/TrailerDecoratingStore.test.ts`, `css/extensions/view-layer/tests/trailer.test.ts`
- Modify: `css/extensions/view-layer/src/index.ts`

- [ ] **Step 1: Delete the four files.**

```bash
cd css/extensions/view-layer
git rm src/TrailerDecoratingStore.ts src/trailer.ts tests/TrailerDecoratingStore.test.ts tests/trailer.test.ts
```

- [ ] **Step 2: Drop the exports from `src/index.ts`.** Remove the lines `export * from "./trailer";` and `export * from "./TrailerDecoratingStore";`. The remaining exports are `uri`, `ViewAssembler`, `ViewHttpHandler`, `ViewSpaceHttpHandler`.

- [ ] **Step 3: Build + test (expect green, fewer tests).**

Run: `npm install --prefix . >/dev/null 2>&1; npm run build && npm test`
Expected: build exits 0; vitest passes with the trailer/uri-trailer suites gone (ViewAssembler, ViewHttpHandler, ViewSpaceHttpHandler, uri suites remain). componentsjs-generator must NOT emit a `TrailerDecoratingStore.jsonld` anymore.

- [ ] **Step 4: Commit.**

```bash
git add -A css/extensions/view-layer
git commit -m "[Agent: Claude] view-layer: remove TrailerDecoratingStore + trailer module (D114 revert A′)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Remove the trailer config wiring + revert the OperationHandler override

**Files:**
- Modify: `css/config/view-layer.json`

- [ ] **Step 1: Read the file** and locate (a) the `urn:cogitarelink:ResourceStore_Trailer` instance block (`@type: TrailerDecoratingStore`) and (b) the `Override` block on the LDP `OperationHandler` (the one whose comment mentions "Interpose the TrailerDecoratingStore ABOVE MonitoringStore" and whose `overrideParameters` replaces the handler list, routing each op `store` to `urn:cogitarelink:ResourceStore_Trailer`).

- [ ] **Step 2: Delete both blocks entirely.** Removing the OperationHandler override reverts the LDP read/write path to the CSS default (operations route through `urn:solid-server:default:ResourceStore` = Monitoring, as before D113). The ViewHttpHandler + ViewSpaceHttpHandler instances and the BaseHttpHandler waterfall inserts (in `memento.json`) STAY — those are the `?_profile=` interception, unrelated to the trailer. Verify nothing else references `urn:cogitarelink:ResourceStore_Trailer` after deletion: `grep -rn "ResourceStore_Trailer" css/config/`.

- [ ] **Step 3: Rebuild + boot-verify.**

Run: `make rebuild` (the trailer extension change from Task 1 + this config change; regenerate the local `dist` for the view-layer extension before rebuild so Docker doesn't serve a stale cached layer — `npm run build --prefix css/extensions/view-layer`).
Then:
```bash
docker compose logs css 2>&1 | grep -iE "error|cannot|fail" | grep -v "0 errors" | head
curl -sk https://pod.vardeman.me/vault/ -o /dev/null -w '%{http_code}\n'
```
Expected: no fatal Components.js errors; `200`.

- [ ] **Step 4: Smoke that the trailer is gone and the default GET is pristine.** Plant an open action on a wiki concept and confirm the default GET no longer carries the trailer:

```bash
# create a conformant concept + an open action targeting it
curl -sk -X PUT -H 'Content-Type: text/markdown' "https://pod.vardeman.me/vault/wiki/concepts/d114-smoke.md" \
  --data-binary $'---\ntype: Concept\n---\n# D114 Smoke\n\n[D114 Smoke]{.prefLabel} test.\n'
LOC=$(curl -sk -i -X POST -H 'Content-Type: text/turtle' "https://pod.vardeman.me/id/.operations/" --data-binary $'@prefix as: <https://www.w3.org/ns/activitystreams#> .\n@prefix mem: <https://pod.vardeman.me/vault/ontology/mem#> .\n@prefix prov: <http://www.w3.org/ns/prov#> .\n@prefix schema: <https://schema.org/> .\n<> a as:Announce, mem:RealignAction, prov:Activity ; as:object <https://pod.vardeman.me/vault/wiki/concepts/d114-smoke.md> ; schema:actionStatus schema:PotentialActionStatus ; mem:rationale "d114 smoke" .' | grep -i '^location:' | awk '{print $2}' | tr -d '\r')
sleep 2
curl -sk "https://pod.vardeman.me/vault/wiki/concepts/d114-smoke.md" | grep -c '<!-- pod:notice' # expect 0
# cleanup
curl -sk -X DELETE "$LOC"; curl -sk -X DELETE "https://pod.vardeman.me/vault/wiki/concepts/d114-smoke.md"; curl -sk -X DELETE "https://pod.vardeman.me/vault/wiki/concepts/d114-smoke.md.meta"
```
Expected: trailer count `0` (default GET is now pristine even with an open action present).

- [ ] **Step 5: Commit.**

```bash
git add css/config/view-layer.json
git commit -m "[Agent: Claude] view-layer: remove trailer store wiring + revert OperationHandler override (D114)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Remove the AdmissionFloor 422 marker guard

**Files:**
- Modify: `css/extensions/shape-validator/src/storage/AdmissionFloorStore.ts`, `css/extensions/shape-validator/test/AdmissionFloorStore.test.ts`

- [ ] **Step 1: Remove the guard.** Delete the `POD_NOTICE_MARKER` module constant and the two guard blocks (`if (body.includes(POD_NOTICE_MARKER)) throw new HttpError(422, "PodNoticeMarkerError", …)`) in both `setRepresentation` and `addResource`. Leave all SHACL-floor logic intact.

- [ ] **Step 2: Remove the marker tests.** In `test/AdmissionFloorStore.test.ts` delete the 4 marker-guard tests (the positive + negative cases on both write paths — search for `pod:notice` / `PodNoticeMarker`).

- [ ] **Step 3: Build + test.**

Run: `npm run build --prefix css/extensions/shape-validator && npm test --prefix css/extensions/shape-validator`
Expected: build 0; AdmissionFloorStore suite passes (marker tests gone, SHACL-floor tests remain). (The pre-existing `configGuard.test.ts` offline false-positive is unrelated — ignore.)

- [ ] **Step 4: Commit.**

```bash
git add css/extensions/shape-validator
git commit -m "[Agent: Claude] floor: remove pod:notice 422 marker guard (D114 — no trailer to protect)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: ViewHttpHandler — drop `doc` and `graph`, keep `fused` + `alt`

**Files:**
- Modify: `css/extensions/view-layer/src/ViewHttpHandler.ts`, `css/extensions/view-layer/tests/ViewHttpHandler.test.ts`

- [ ] **Step 1: Update the test first (TDD).** In `ViewHttpHandler.test.ts`: delete the `doc` and `graph` test cases. Add/keep: `fused` → 200 markdown (or turtle for RDF, Task 5) with body+graph; `alt` → 200 turtle listing `fused` + `people` + class profiles (NOT `doc`/`graph`); unknown/`doc`/`graph` token → 400 (they're no longer valid); write (PUT) → 405. Run `npm test --prefix css/extensions/view-layer` and watch the new `doc`/`graph`→400 assertions FAIL against the current code.

- [ ] **Step 2: Edit `ViewHttpHandler.ts`.**
  - `const VALID_TOKENS = ["fused", "alt"] as const;`
  - `const DESCRIPTOR_NAMES = ["fused", "people"] as const;` (alt lists these descriptors + the class profiles; `document`/`graph` descriptors are removed in Task 6)
  - Delete the `serveDoc` and `serveGraph` methods and their `case "doc":` / `case "graph":` switch arms. The default switch arm already 400s unknown tokens, which now includes `doc`/`graph`.

- [ ] **Step 3: Build + test.**

Run: `npm run build --prefix css/extensions/view-layer && npm test --prefix css/extensions/view-layer`
Expected: build 0; all view-layer tests pass.

- [ ] **Step 4: Commit.**

```bash
git add css/extensions/view-layer
git commit -m "[Agent: Claude] view-layer: ?_profile= keeps fused+alt, drops doc+graph (D114)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Make `?_profile=fused` substrate-wide + content-type-agnostic

**Files:**
- Modify: `css/extensions/view-layer/src/ViewHttpHandler.ts`, `css/extensions/view-layer/tests/ViewHttpHandler.test.ts`
- Test (live): `tests/test_view_layer_integration.py` (a focused case here; full suite in Task 8)

- [ ] **Step 1: Diagnose the `/id/` gap.** With an open action planted on `/id/schemes/orcid` (use the Task-2 plant idiom against that target), run `curl -sk "https://pod.vardeman.me/id/schemes/orcid?_profile=fused"` and trace why `mem:hasOpenAction` is absent. Candidate causes to check, in order: (a) `canHandle` rejects `/id/` because `baseUrl` is set to something narrower than the pod root in `view-layer.json` (it is the `variable:baseUrl` — confirm its resolved value covers `/id/`); (b) `readMetaQuads(target)` derives the `.meta` path assuming `/vault/` structure or strips a path segment; (c) the handler runs but `serveFused` renders markdown-style (body + fenced turtle) for a Turtle resource, so the `.meta` triples land inside a fence the grep missed. Write down the actual cause in the commit message.

- [ ] **Step 2: Write the failing unit test** in `ViewHttpHandler.test.ts`: a mock RDF resource (content-type `text/turtle`) whose `.meta` carries `mem:hasOpenAction`; `serveFused` must return `text/turtle` containing the open-action triple merged with the resource's own triples (one graph, no markdown fence). Run → FAIL.

- [ ] **Step 3: Implement the content-type branch in `serveFused`.** Read the base resource's content-type from its representation metadata. Then:
  - **markdown** (`text/markdown`): unchanged — `assembler.fuse(body, query, [metaStore])` → body + fenced turtle, served `text/markdown`.
  - **RDF** (`text/turtle` / any RDF content type): parse the resource's own triples into a store, union with the `.meta` `metaStore`, run the projection over the union (or simply serialize the union), serve `text/turtle` — one merged graph, no fence.

```typescript
// sketch — adapt to the file's helpers (readBody, readMetaQuads, assembler):
const rep = await this.store.getRepresentation({ path: target }, {});
const ct = rep.metadata.contentType ?? "";
if (ct === "text/markdown") {
  const body = await readableToString(rep.data);
  const metaStore = await this.readMetaQuads(target);
  const fused = await this.assembler.fuse(body, await this.readProjectionQuery(), [metaStore]);
  this.write(response, 200, "text/markdown", "fused", head ? undefined : fused);
} else {
  const own = await readableToQuads(rep.data);        // resource's own triples
  const metaStore = await this.readMetaQuads(target); // its .meta (incl. hasOpenAction)
  const merged = new Store([...own.getQuads(null,null,null,null), ...metaStore.getQuads(null,null,null,null)]);
  const ttl = await this.assembler.serializeTurtle(merged.getQuads(null,null,null,null));
  this.write(response, 200, "text/turtle", "fused", head ? undefined : ttl);
}
```
If Step 1 found the cause is `canHandle` scoping or `.meta`-path derivation, fix that too (the fix must make `?_profile=fused` work on any path under the pod root).

- [ ] **Step 4: Unit test passes; build 0.** `npm run build --prefix css/extensions/view-layer && npm test --prefix css/extensions/view-layer`

- [ ] **Step 5: Live verify.** `make rebuild` (rebuild local `dist` first), plant an open action on `/id/schemes/orcid`, then:
```bash
curl -sk "https://pod.vardeman.me/id/schemes/orcid?_profile=fused" | grep -i hasOpenAction   # expect a hit
curl -sk "https://pod.vardeman.me/vault/wiki/concepts/<a-seeded-concept>.md?_profile=fused" | grep -c '```turtle'  # markdown still fenced
```
Clean up the planted action.

- [ ] **Step 6: Commit** (state the root cause found in Step 1).

```bash
git add css/extensions/view-layer
git commit -m "[Agent: Claude] view-layer: ?_profile=fused substrate-wide + content-type-agnostic (D114)

Root cause: <fill in from Step 1>.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Overlay — remove the `document` and `graph` view descriptors

**Files:**
- Delete: `overlays/wiki-memory/views/document.ttl`, `overlays/wiki-memory/views/graph.ttl`
- Modify: `overlays/wiki-memory/manifest.ttl`, `tests/test_overlay_manifest.py`

- [ ] **Step 1: Delete the two descriptor files.** `git rm overlays/wiki-memory/views/document.ttl overlays/wiki-memory/views/graph.ttl`. Keep `fused.ttl`, `people.ttl`, `fused-projection`, `people-projection`.

- [ ] **Step 2: Update `manifest.ttl`.** In the `overlay:installsView` list remove the two `[ overlay:document "views/document.ttl" … ]` and `[ … "views/graph.ttl" … ]` blank nodes. Leave `fused` + `people`. (The `installsViewArtifact` list — `fused-projection`, `people-projection` — is unchanged.)

- [ ] **Step 3: Update `tests/test_overlay_manifest.py`.** The `view_urls` assertion should now expect `fused` + `people` only (no `document`/`graph`). Run `~/uvws/.venv/bin/python -m pytest tests/test_overlay_manifest.py -v` → PASS.

- [ ] **Step 4: Commit.**

```bash
git add overlays/wiki-memory/manifest.ttl overlays/wiki-memory/views/ tests/test_overlay_manifest.py
git commit -m "[Agent: Claude] overlay: drop document+graph view descriptors (D114, keep fused+people)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The view-authority contract (the new piece)

**Files:**
- Modify: `overlays/wiki-memory/profiles/page.ttl` (+ optionally the other 5 class profiles), the storage-description seed
- Test: `tests/test_view_layer_integration.py` (discovery assertion in Task 8)

- [ ] **Step 1: Add the view-authority statement to the base PROF profile.** In `overlays/wiki-memory/profiles/page.ttl`, add an `sh:agentInstruction` (the same predicate the shapes use for agent guidance) on the profile resource stating the read/write authority division. Exact text:

```turtle
# (add to the existing <…/profiles/page> subject; keep existing triples)
  sh:agentInstruction """View authority for resources of this kind:
- The DOCUMENT view (the resource body) is authoritative for prose and navigational/locally-authorable links. Author here with PUT/PATCH.
- The GRAPH view (the .meta description resource) is authoritative for typed edges, governed context (open actions, provenance, staleness), and substrate-derived triples. The body's typed wikilinks are a CONVENIENCE PROJECTION of the graph, not authoritative — do not rely on them for graph-correct answers.
- READ ?_profile=fused when your question is about the graph: it returns the resource content plus its authoritative governed graph in one representation (content-type-agnostic; works on markdown and RDF resources alike).
- WRITE: author content in the document view; propose graph-global judgment (realignment, staleness, cross-scheme links) to the operations ledger (the container linked by the curation affordance), not by editing the body.
- Floor signposts (no tool required): Link rel="describedby" -> the .meta graph; Link rel="…mem#hasOpenAction" -> an open curation action; Link rel="profile" -> this statement.""" .
```

(Verify `sh:` is declared in `page.ttl`'s prefix block; add `@prefix sh: <http://www.w3.org/ns/shacl#> .` if missing. Parse-check with rdflib.)

- [ ] **Step 2: Link it from the storage description so a cold agent meets it on arrival.** Find the storage-description seed (grep `void:Dataset` / `solid:storageDescription` / the D44 storage description resource in `overlays/`). Add a triple pointing at the base profile as the substrate's view-authority guidance, e.g. `<> sub:viewAuthority <https://pod.vardeman.me/vault/meta/profiles/page> .` — OR, if cleaner, mint `sub:viewAuthority` in `vocabulary/substrate.ttl` (an `rdf:Property`, `rdfs:comment` "Points at the PROF profile whose sh:agentInstruction states the document-vs-graph read/write authority division") and use it. Parse-check.

- [ ] **Step 3: Live verify discoverability after `make reset` (Task 8 runs reset; here just confirm the Turtle is valid).** `~/uvws/.venv/bin/python -c "import rdflib; [rdflib.Graph().parse(f, format='turtle') for f in ['overlays/wiki-memory/profiles/page.ttl','overlays/wiki-memory/vocabulary/substrate.ttl']]; print('ok')"`

- [ ] **Step 4: Commit.**

```bash
git add overlays/wiki-memory/profiles/page.ttl overlays/wiki-memory/vocabulary/substrate.ttl overlays/wiki-memory/  # + the storage-description seed file
git commit -m "[Agent: Claude] substrate: declared view-authority contract (D114 — the missing dual-view legibility)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Integration tests + full Pod verification

**Files:**
- Modify: `tests/test_view_layer_integration.py`

- [ ] **Step 1: Remove the now-invalid tests.** Delete `test_default_get_pristine_when_no_open_action` (still valid — keep), `test_profile_doc_byte_identical` (DELETE — doc gone), `test_profile_graph_is_turtle` (DELETE — graph gone), `test_view_write_405` (keep — now targets fused), `test_marker_guard_422` (DELETE — guard gone), `test_trailer_appears_with_open_action` (DELETE — trailer gone). Keep the people-view + bridge + profile-link tests.

- [ ] **Step 2: Add the D114 tests.** Append:

```python
def test_profile_fused_markdown_carries_body_and_graph():
    with C() as c:
        t = c.get(f"{R}?_profile=fused").text
        assert t.startswith("---") and "```turtle" in t

def test_profile_fused_rdf_carries_open_action():
    # plant an open action on a Turtle scheme record; fused must surface it
    target = f"{POD}/id/schemes/orcid"
    op = _post_realign(target)   # helper mirroring _proposal_body, POST to /id/.operations/
    try:
        with C() as c:
            time.sleep(2)
            t = c.get(f"{target}?_profile=fused")
            assert "turtle" in t.headers["content-type"]
            assert "hasOpenAction" in t.text
    finally:
        with C() as c: c.delete(op)

def test_default_get_pristine_even_with_open_action():
    # the trailer is gone: default GET stays byte-identical with an open action present
    op = _post_realign(R)
    try:
        with C() as c:
            time.sleep(2)
            assert "<!-- pod:notice" not in c.get(R).text
    finally:
        with C() as c: c.delete(op)

def test_view_authority_discoverable():
    with C() as c:
        prof = c.get(f"{POD}/vault/meta/profiles/page", headers={"Accept": "text/turtle"}).text
        assert "agentInstruction" in prof and "?_profile=fused" in prof and "authoritative" in prof
```

Add the `_post_realign(target)` helper next to `_proposal_body` (POST the proposal body to `OPS`, return the `Location`).

- [ ] **Step 2b: Run failing → implement nothing (tests exercise Tasks 1–7) → expect PASS after `make reset`.**

- [ ] **Step 3: Full verification.**

```bash
make reset                  # fresh volume; deploys the trimmed overlay + view-authority
~/uvws/.venv/bin/python -m pytest tests/test_view_layer_integration.py -v
make test                   # Pod-up suite — confirm no NEW failures vs the known baseline
make audit                  # expect 0 ERROR / 1 known WARN
make test-js                # view-layer + shape-validator suites green (pre-existing configGuard/markdownBodyProjector failures are not ours)
```
Expected: integration suite green; audit 0 ERROR.

- [ ] **Step 4: Commit.**

```bash
git add tests/test_view_layer_integration.py
git commit -m "[Agent: Claude] view-layer: integration suite for D114 (fused substrate-wide, pristine default, authority discoverable)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Documentation sync

**Files:**
- Modify: `docs/superpowers/specs/2026-06-07-view-layer-design.md`, `FOLLOWUPS.md`, `.claude/memory/MEMORY.md`

- [ ] **Step 1: Supersession note on the D113 view-layer spec.** Add a top banner: "**Read-path delivery (§3–§4: trailer, default GET, doc/graph views) SUPERSEDED by D114** (`2026-06-07-read-path-view-authority-design.md`): trailer removed, `?_profile=fused` is the substrate-wide content-type-agnostic contract, view authority is declared. PROF views, Person demonstrator, declared-query engine, write grammar stand."

- [ ] **Step 2: FOLLOWUPS.** Mark the three D114-reopened items (trailer disposition; substrate-wide fused view; — keep the Tier-3 eval-arm item OPEN) as DONE where done; add: "D114 view-authority contract shipped; next = the D114 eval (Tier-3 fused-read arm + over-trust probe + floor-honesty), §5 of the spec." Remove the now-stale `WIKI_CLASS_TO_PROFILE 5-of-8` and `mem: IRI 3rd site` items only if they no longer apply (the 3rd `mem:` site was `TrailerDecoratingStore` — now removed, so that item is resolved; note it).

- [ ] **Step 3: MEMORY.** Update the view-layer bullet: D114 BUILT (trailer removed; fused = contract; view authority declared); ▶ NEXT = the D114 eval (proof in the pudding). Keep terse.

- [ ] **Step 4: Commit.**

```bash
git add docs/superpowers/specs/2026-06-07-view-layer-design.md FOLLOWUPS.md .claude/memory/MEMORY.md
git commit -m "[Agent: Claude] docs: D114 supersession note + FOLLOWUPS/MEMORY sync

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes (done at plan-writing time)

- **Spec coverage:** §3.1 remove trailer → Tasks 1–3; §3.2 fused as contract → Tasks 4–5; drop graph → Tasks 4, 6; §3.3 view-authority contract → Task 7; §3.4 keeps (PROF/Person/engine untouched — no task touches them beyond the alt list); §5 eval → recorded as the next session in Task 9 (the probe itself is a separate cold-probe run, not in this plan). `doc` collapse → Task 4 (token removed) + Task 6 (descriptor removed).
- **Revert-of-merged-code caution:** Tasks 2 + 5 change config/handlers on a live Pod — both require `make rebuild` (regenerate `dist` first to bust Docker cache) + smoke before commit; Task 8 does the authoritative `make reset`.
- **Known uncertainty flagged inline:** Task 5 Step 1 is an explicit diagnosis step (the `/id/` fused gap root cause is not yet known) — the implementer records it before fixing.
- **Type consistency:** `VALID_TOKENS`/`DESCRIPTOR_NAMES` values consistent across Tasks 4–6; `_post_realign` helper defined in Task 8 Step 2; the fused content-type branch uses the file's existing `readMetaQuads`/`readBody`/`assembler` members.
