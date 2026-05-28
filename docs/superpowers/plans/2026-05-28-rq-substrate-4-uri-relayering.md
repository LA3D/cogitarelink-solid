# RQ-Substrate-4 URI Re-layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-layer the Pod's RDF namespaces per D107 — reuse standard Solid predicates, mint a `sub:` substrate namespace for general terms, keep `wiki:` for L3 content only, derive the storage root instead of hardcoding it, and make PROF an actionable out-of-band hint — without ever leaving the live substrate inconsistent.

**Architecture:** Single integrated migration in **5 phases**, smallest-blast-radius first, gated by a reproducible-rebuild + audit + consistency-test harness after every phase. The substrate is data + config + a CSS extension; migration is "edit artifacts → `make reset` (fresh volume) → `make audit` (0 ERROR) → unit tests → commit." The decision record is `docs/superpowers/specs/2026-05-28-rq-substrate-4-uri-relayering-decision.md` (D107); the source brainstorm is `…/2026-05-27-neurosymbolic-substrate-unification-design.md`.

**Tech Stack:** CSS v8 (Components.js), TypeScript (markdown-projection extension), Turtle/JSON-LD (vocab, shapes, affordances, storage description), Python 3.12 (`pod_audit.py`, overlay apply), pyshacl, N3.js, `make reset`/`make audit`.

**Consistency doctrine (Chuck's primary concern — applies to EVERY phase):**
1. The three hand-mirrors **always move together** in one commit: `BOOTSTRAP_PREDICATE_TO_CLASS` (`css/extensions/markdown-projection/src/wikilinkProjection.ts`), `overlays/wiki-memory/routing.jsonld`, `PUBLISHED_RANGE` (`scripts/pod_audit.py`). Phase 0 adds a test that fails if they diverge.
2. The substrate audit shapes (`shapes/substrate/storage-description.shacl.ttl`, `affordance-descriptor.shacl.ttl`) are BOTH a migration target AND the guard. Always edit the shape and the data it validates in the **same commit**, then run `make audit`.
3. After every phase: `make reset` (NOT `make up` — fresh volume reproduces the deployed Pod) then `make audit` must be **0 ERROR**. A phase is not done until both are green and committed.
4. Rollback = `git revert <phase commit>` + `make reset`. There is no in-place data migration; the Pod is regenerated from artifacts each `make reset`.
5. Set TLS env before any live-Pod Python: `export SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem`.

**Term-disposition reference (from D107 §4, confirmed against the live vocab):**

| Bucket | Disposition | Terms |
|---|---|---|
| **1 — standard reuse, delete `wiki:`** | `wiki:typeIndex`→`solid:publicTypeIndex`; `wiki:eventStream`→`ldp:inbox` *(verify §Phase 1.2)*; preferences already `pim:preferencesFile` (nothing to delete) | typeIndex, eventStream |
| **2 — mint `sub:`** | move to `https://pod.vardeman.me/vault/ontology/substrate#` | catalogs: `contextDocument shapeCatalog affordanceCatalog capabilityCatalog templateCatalog contactCatalog profileDocument bootstrapResource agentGuide extensionGuide`; routing/dispatch: `routesToClass dispatchPattern targetClass targetContainer queryParameter parameter required deriveClass threshold constructQuery selectQuery`; governance: `governs projectsFromFrontmatter classHintTable installedBy shape requiresCapability`; affordance classes: `Affordance WriteAffordance DerivedClassAffordance DerivedNavigationAffordance VersionAffordance SearchAffordance QueryAffordance` |
| **3 — stays `wiki:`** | wiki-memory L3 content | `Resource Page Concept Source Person Procedure WorkingNote MOC Hub ExtensionGuide`; `maturity draft validated core`; procedure-step vocab `action precondition postcondition errorMode procedure step`; profile machinery `WikiMemoryProfile L3Profile conformsTo` |

> NOTE on `conformsTo`/`WikiMemoryProfile`/`L3Profile`: these describe the wiki-memory L3 profile itself, so they stay in `wiki:` (Bucket 3). `ExtensionGuide` (the *class*) stays `wiki:`; `extensionGuide` (the storage-description *pointer predicate*) moves to `sub:`. Keep the class/predicate distinction explicit while editing.

---

## Phase 0 — Safety net & baseline (no migration yet)

**Goal:** lock the consistency guard and capture the pre-migration baseline so every later phase is verifiable and Probe A has a before-image.

### Task 0.1: Hand-mirror consistency test

**Files:**
- Create: `tests/test_substrate_mirror_consistency.py`
- Read (sources of truth): `css/extensions/markdown-projection/src/wikilinkProjection.ts` (`BOOTSTRAP_PREDICATE_TO_CLASS`), `overlays/wiki-memory/routing.jsonld`, `scripts/pod_audit.py` (`PUBLISHED_RANGE`)

- [ ] **Step 1: Write the failing test** — parse all three sources and assert the predicate→class entailment agrees across them.

```python
# tests/test_substrate_mirror_consistency.py
import json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]

def _bootstrap_from_ts():
    txt = (ROOT/"css/extensions/markdown-projection/src/wikilinkProjection.ts").read_text()
    block = re.search(r"BOOTSTRAP_PREDICATE_TO_CLASS\s*[:=].*?\{(.*?)\}", txt, re.S).group(1)
    return {m[0]: m[1] for m in re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', block)}

def _routing_jsonld():
    doc = json.loads((ROOT/"overlays/wiki-memory/routing.jsonld").read_text())
    ctx = {k: v for k, v in doc["@context"].items() if isinstance(v, str)}
    exp = lambda c: ctx[c.split(":")[0]] + c.split(":",1)[1] if ":" in c and c.split(":")[0] in ctx else c
    return {exp(n["@id"]): exp(n["routesToClass"]) for n in doc["@graph"]}

def _published_range():
    import importlib.util
    spec = importlib.util.spec_from_file_location("pa", ROOT/"scripts/pod_audit.py")
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return {str(k): str(v) for k, v in mod.PUBLISHED_RANGE.items()}

def test_three_mirrors_agree():
    ts, rj, pr = _bootstrap_from_ts(), _routing_jsonld(), _published_range()
    # routing.jsonld is the runtime SoT; every entry it declares must agree with the others where present.
    for pred, cls in rj.items():
        if pred in ts:  assert ts[pred] == cls, f"TS bootstrap disagrees on {pred}"
        if pred in pr:  assert pr[pred] == cls, f"pod_audit PUBLISHED_RANGE disagrees on {pred}"
```

- [ ] **Step 2: Run it** — `~/uvws/.venv/bin/python -m pytest tests/test_substrate_mirror_consistency.py -v`. Expected: **PASS** (the three currently agree, per the 2026-05-27 review). If it FAILS now, fix the divergence before proceeding — that is a pre-existing bug this plan must not build on.
- [ ] **Step 3: Commit.** `git add tests/test_substrate_mirror_consistency.py && git commit -m "[Agent: Claude] RQ-Substrate-4 Phase 0: hand-mirror consistency test (migration guard)"`

### Task 0.2: Capture baseline

**Files:**
- Create: `tests/fixtures/discovery-chain-baseline.ttl` (the storage description as deployed today)

- [ ] **Step 1:** `make reset` then `make audit`. Record both as green (expected 0 ERROR / 1 WARN — the known StaticStorageDescriber literal WARN). If not green, STOP — fix before migrating.
- [ ] **Step 2:** Snapshot the entry point: `curl -s -H "Accept: text/turtle" https://pod.vardeman.me/vault/.well-known/solid > tests/fixtures/discovery-chain-baseline.ttl`. This is the before-image for Phase 1/2 diffs and Probe A.
- [ ] **Step 3:** Record a cold-probe baseline pointer. The 2026-05-26/27 probes (`docs/plans/2026-05-27-two-hierarchy-eval.md`) are the misread baseline; no new run needed here — note in the eval doc (Phase 5) that Probe A compares against them.
- [ ] **Step 4: Commit.** `git add tests/fixtures/discovery-chain-baseline.ttl && git commit -m "[Agent: Claude] RQ-Substrate-4 Phase 0: discovery-chain baseline fixture"`

---

## Phase 1 — Bucket 1: standard-predicate reuse

**Goal:** delete our parallel `wiki:` predicates where a standard Solid predicate exists. This *shrinks* the surface and removes a D48 dual-mechanism self-violation.

### Task 1.1: `wiki:typeIndex` → `solid:publicTypeIndex`

**Files (edit all in one commit — shape + data together):**
- `css/config/void-description.json` — the `wiki#typeIndex` `StaticStorageDescriber` key (the storage-description pointer)
- `shapes/substrate/storage-description.shacl.ttl:35-38` (the `sh:path wiki:typeIndex` property shape + its `sh:message`) and the `sh:agentInstruction` at :27 (mentions `wiki:typeIndex`)
- `overlays/wiki-memory/vocabulary/wiki.ttl:762-774` (the `wiki:typeIndex` term definition — DELETE; the predicate is now `solid:publicTypeIndex`)
- `overlays/wiki-memory/capabilities/wiki-vocabulary.ttl:10` (doc text listing `wiki:typeIndex`)
- `scripts/pod_audit.py:47` (`"typeIndex": WIKI + "typeIndex"`) and `:163` (`URIRef(WIKI + "typeIndex")`)
- `overlays/wiki-memory/vocabulary/wiki.ttl:671` (WikiMemoryProfile comment referencing the Type Index — text only)

- [ ] **Step 1: Update the audit shape first** (`shapes/substrate/storage-description.shacl.ttl`): change `sh:path wiki:typeIndex` → `sh:path solid:publicTypeIndex`; update the `sh:message` and the `sh:agentInstruction` prose to say `solid:publicTypeIndex`. Add `@prefix solid: <http://www.w3.org/ns/solid/terms#> .` if absent.
- [ ] **Step 2: Update the storage-description data** (`css/config/void-description.json`): change the term key `https://pod.vardeman.me/vault/ontology/wiki#typeIndex` → `http://www.w3.org/ns/solid/terms#publicTypeIndex` (value unchanged: `…/vault/settings/publicTypeIndex`).
- [ ] **Step 3: Update `pod_audit.py`** — at :47 drop the `typeIndex` entry from the WIKI-keyed map; at :163 read the Type Index pointer via `URIRef("http://www.w3.org/ns/solid/terms#publicTypeIndex")`. Define `SOLID = "http://www.w3.org/ns/solid/terms#"` near the `WIKI` const.
- [ ] **Step 4: Delete the `wiki:typeIndex` term** from `wiki.ttl:762-774`; fix the doc text in `wiki-vocabulary.ttl:10` and the `wiki.ttl:671` profile comment to reference `solid:publicTypeIndex`.
- [ ] **Step 5: Confirm the WebID profile carries it too** — `overlays/owner-identity/shapes/webid-profile.shacl.ttl:102` already requires `solid:publicTypeIndex` (good; no change). Note in commit that the storage description now uses the same standard predicate as the WebID profile.
- [ ] **Step 6: Verify** — `make reset && make audit` (expect 0 ERROR; the audit now checks `solid:publicTypeIndex`), then `~/uvws/.venv/bin/python -m pytest tests/ -v` (mirror test still green). Re-snapshot `discovery-chain-baseline.ttl` diff to confirm only the predicate changed.
- [ ] **Step 7: Commit.** `git commit -m "[Agent: Claude] RQ-Substrate-4 Phase 1: wiki:typeIndex -> solid:publicTypeIndex (D48 dual-mechanism cleanup)"`

### Task 1.2: `wiki:eventStream` → standard predicate (verify-then-migrate)

**Files:** `overlays/wiki-memory/vocabulary/wiki.ttl:839-849`, `overlays/wiki-memory/synthesis/index.md.meta.ttl:19`

- [ ] **Step 1: Investigate the `.events/` / `.operations/` semantics** — read `overlays/wiki-memory/synthesis/index.md.meta.ttl` and the memory-history/memento affordances. Decide: is `/vault/wiki/.events/` an **LDN inbox** (`ldp:inbox`, RFC LDN) or an **LDES/event stream** (`tree:`/`ldes:`)? The `.operations/` log carries `as:Announce` (D106/RQ-Listener-1); `.events/` carries substrate-emitted `mem:Event` activities.
- [ ] **Step 2: Migrate per the finding.** If LDN inbox → `ldp:inbox`. If an append-only event stream → keep a substrate term but move it to `sub:eventStream` (Bucket 2, defer to Phase 2) rather than inventing an LDN mapping. **Record the decision inline in the commit message.** If unclear, default to `sub:eventStream` (Phase 2) — do NOT force a standard predicate that doesn't fit.
- [ ] **Step 3: Verify** — `make reset && make audit`; pytest. **Commit** (or fold into Phase 2 if deferred, noting that in the Phase 1 completion).

---

## Phase 2 — Bucket 2: mint `sub:` and migrate general terms

**Goal:** move ~40 general-substrate terms out of `wiki:` into `https://pod.vardeman.me/vault/ontology/substrate#`, framed as proto-view vocabulary.

### Task 2.1: Create the `sub:` vocabulary file

**Files:**
- Create: `overlays/wiki-memory/vocabulary/substrate.ttl` (Pod-hosted at `/vault/ontology/substrate`, extension-less per D84/uri-conformance rule 2)
- `overlays/wiki-memory/manifest.ttl` — add the vocab to the deploy set (mirror how `wiki.ttl`/`mem.ttl` are declared)
- `css/config/void-description.json` — add `void:vocabulary <https://pod.vardeman.me/vault/ontology/substrate#>`

- [ ] **Step 1:** Author `substrate.ttl` with `@prefix sub: <https://pod.vardeman.me/vault/ontology/substrate#> .`, a `vann:preferredNamespacePrefix "sub"`, an `owl:Ontology` header noting *"general agentic-substrate vocabulary; the primitive view-definition layer per D107 — destined to merge into the view layer (RQ-Substrate-4 spec §4.3)."* Define the Bucket-2 terms here (move definitions verbatim from `wiki.ttl`, re-typed to `sub:`).
- [ ] **Step 2:** Register in `manifest.ttl` + add the `void:vocabulary` declaration in `void-description.json`.
- [ ] **Step 3: Verify dereferenceability** — `make reset`; `curl -s -H "Accept: text/turtle" https://pod.vardeman.me/vault/ontology/substrate | head` returns the vocab (uri-conformance empirical test). `make audit`. **Commit.**

### Task 2.2: Add `sub:` to the JSON-LD context and routing context

**Files:** `overlays/wiki-memory/context-fragment.jsonld`, `overlays/wiki-memory/routing.jsonld`

- [ ] **Step 1:** Add `"sub": "https://pod.vardeman.me/vault/ontology/substrate#"` to `context-fragment.jsonld`'s `@context`. Move any Bucket-2 short-form terms (e.g. `routesToClass`) to expand against `sub:`.
- [ ] **Step 2:** In `routing.jsonld`, change `"routesToClass": { "@id": "wiki:routesToClass", … }` → `{ "@id": "sub:routesToClass", … }` and add the `sub:` prefix to its `@context`.
- [ ] **Step 3: Verify** — `make reset`; `make audit` with `--check-routing` (the audit reads `routing.jsonld`; the `routesToClass` IRI it looks for must match — see Task 2.4). `make reset && make audit`. Do NOT commit until Task 2.4 (the mirror) lands in the same commit.

### Task 2.3: Migrate the term references across all artifacts

**Files (bounded sets — grep then edit):**
- `overlays/wiki-memory/vocabulary/wiki.ttl` — delete the migrated term definitions (now in `substrate.ttl`)
- `shapes/substrate/affordance-descriptor.shacl.ttl`, `shapes/substrate/storage-description.shacl.ttl` — `wiki:` → `sub:` on every Bucket-2 `sh:path` and `sh:agentInstruction` mention
- All affordance descriptors: `overlays/wiki-memory/affordances/*.ttl`, `overlays/addressbook/affordances/*.ttl` (the `wiki:targetContainer`/`dispatchPattern`/`constructQuery`/`selectQuery`/`Affordance` subclass references)
- `css/config/void-description.json` — the catalog pointer keys (`wiki#shapeCatalog`, `wiki#affordanceCatalog`, `wiki#contextDocument`, `wiki#capabilityCatalog`, `wiki#templateCatalog`, `wiki#contactCatalog`, `wiki#profileDocument`, `wiki#agentGuide`, `wiki#extensionGuide`, `wiki#bootstrapResource`) → `substrate#…`
- `css/extensions/markdown-projection/src/governedPredicates.ts`, `wikilinkProjection.ts`, `frontmatterProjection.ts` — split the `WIKI` const: keep `WIKI` for Bucket-3 content classes, add `const SUB = "https://pod.vardeman.me/vault/ontology/substrate#"` for governance/routing predicates (`governs`, `projectsFromFrontmatter`, `classHintTable`)
- `overlays/wiki-memory/capabilities/wiki-vocabulary.ttl` — doc text

- [ ] **Step 1:** Grep the working set: `grep -rln "wiki:\(routesToClass\|targetContainer\|dispatchPattern\|shapeCatalog\|affordanceCatalog\|contextDocument\|capabilityCatalog\|templateCatalog\|contactCatalog\|profileDocument\|agentGuide\|extensionGuide\|bootstrapResource\|governs\|projectsFromFrontmatter\|classHintTable\|installedBy\|requiresCapability\|constructQuery\|selectQuery\|queryParameter\|deriveClass\|threshold\|Affordance\|WriteAffordance\|DerivedClassAffordance\|DerivedNavigationAffordance\|VersionAffordance\|SearchAffordance\|QueryAffordance\)" overlays/ shapes/ css/config/ css/extensions/ scripts/ | grep -v node_modules`. This is the exact file list to edit.
- [ ] **Step 2:** For each file, replace `wiki:<term>` → `sub:<term>` (and the full-IRI `…/wiki#<term>` → `…/substrate#<term>` in JSON keys). **Do NOT touch** the Bucket-3 content classes (`wiki:Concept`, `wiki:Page`, `wiki:Source`, `wiki:Person`, `wiki:Procedure`, `wiki:WorkingNote`, `wiki:MOC`, `wiki:Hub`, `wiki:Resource`, `wiki:ExtensionGuide` the class, `wiki:maturity`, `wiki:WikiMemoryProfile`, `wiki:L3Profile`, `wiki:conformsTo`, the procedure-step vocab). Verify each edited file still declares the `sub:` prefix.
- [ ] **Step 3:** `overlays/wiki-memory/vocabulary/wiki.ttl`: delete the now-migrated Bucket-2 term definitions (keep Bucket-3). Confirm `wiki.ttl` no longer defines any `sub:` term.
- [ ] **Step 4: Verify (no commit yet — Task 2.4 closes the commit)** — `make reset`; `make audit` (the substrate shapes now reference `sub:`; they must validate the migrated data). `~/uvws/.venv/bin/python -m pytest tests/ css/extensions/markdown-projection/test/ -v` if TS tests run via the JS harness (`cd css/extensions/markdown-projection && npm test`).

### Task 2.4: Move the three hand-mirrors together + close the commit

**Files:** `css/extensions/markdown-projection/src/wikilinkProjection.ts` (`BOOTSTRAP_PREDICATE_TO_CLASS`), `overlays/wiki-memory/routing.jsonld`, `scripts/pod_audit.py` (`WIKI`/`SUB` split, `ROUTES_TO_CLASS`, `PUBLISHED_RANGE`)

- [ ] **Step 1:** `pod_audit.py`: add `SUB = "https://pod.vardeman.me/vault/ontology/substrate#"`; change `ROUTES_TO_CLASS = WIKI + "routesToClass"` → `SUB + "routesToClass"`; update the catalog-pointer constants (`shapeCatalog` etc.) to `SUB + …`; leave content-class refs on `WIKI`.
- [ ] **Step 2:** Confirm `routing.jsonld` (Task 2.2) and `BOOTSTRAP_PREDICATE_TO_CLASS` agree — the bootstrap maps *predicate→class* and is unaffected by the `routesToClass` IRI rename, but its surrounding comment referencing `/vault/meta/routing.jsonld` is fine. Recompile the extension: `cd css/extensions/markdown-projection && npm run build` (regenerates `dist-cjs/`; the 2026-05-27 review flagged stale `dist-cjs` — rebuild is mandatory).
- [ ] **Step 3: Run the Phase-0 mirror test** — `~/uvws/.venv/bin/python -m pytest tests/test_substrate_mirror_consistency.py -v`. Expected PASS (guards the rename).
- [ ] **Step 4: Full verify** — `make reset && make audit && ~/uvws/.venv/bin/python -m pytest tests/ -v` and `cd css/extensions/markdown-projection && npm test`. All green.
- [ ] **Step 5: Commit the whole Bucket-2 migration as one unit** — `git commit -m "[Agent: Claude] RQ-Substrate-4 Phase 2: mint sub: substrate namespace; migrate ~40 general terms out of wiki: (3 mirrors in lockstep)"`

---

## Phase 3 — Bucket 3 reframe + storage-root derive

### Task 3.1: Re-frame `/wiki/` as "the wiki-memory document view"

**Files:** `shapes/substrate/storage-description.shacl.ttl` (the entry-point `sh:agentInstruction` at :27), `overlays/wiki-memory/synthesis/index.md` (the dogfood entry page), `overlays/wiki-memory/concepts/two-hierarchy-memory-addressing.md` (the `agentGuide` target)

- [ ] **Step 1:** Edit the storage-description `sh:agentInstruction` to state the dual-view model up front: *"This Pod is a hybrid contextualized knowledge graph (Verborgh). Resources have two views of the same entity: a document view (the markdown body) and a graph view (the `.meta` triples, queryable via SPARQL). `/vault/wiki/` is the wiki-memory **document view** — it is NOT a wiki application. Class→container routing is via the Type Index (`solid:publicTypeIndex`); it is one view's routing hint, not a privileged hierarchy."*
- [ ] **Step 2:** Add the same framing near the top of `synthesis/index.md` and the `agentGuide` concept page.
- [ ] **Step 3: Verify** — `make reset && make audit`; confirm `curl …/.well-known/solid` shows the new agentInstruction. **Commit.**

### Task 3.2: Derive the storage root (stop hardcoding `/vault`)

**Files:** `css/extensions/markdown-projection/src-cjs/listener.ts:245-263`, the Components.js wiring (`css/extensions/markdown-projection/config/*.json` or wherever the listener is instantiated), `css/extensions/markdown-projection/test/*` (loader tests)

- [ ] **Step 1: Write the failing test** — a listener/loader test that asserts the storage base is taken from an injected config value, not a hardcoded `/vault`. (Add to `css/extensions/markdown-projection/test/`.) Run `npm test`; expect FAIL.
- [ ] **Step 2: Parameterize the storage root.** Replace `const storageBase = \`${this.baseUrl}/vault\`;` with an injected `this.storagePath` (Components.js parameter, default `/vault` for the current deployment) so the literal lives in **one declared config location**, not in TS source. `storageBase = this.baseUrl + this.storagePath`. Document that the stronger form (derive from the written resource's `solid:storageDescription` Link header / `pim:Storage` ancestor) is a follow-on; the parameter removes the source-level hardcode now (FOLLOWUPS contamination item 1).
- [ ] **Step 3:** Wire the `storagePath` parameter in the Components.js config with default `/vault`. Recompile (`npm run build`).
- [ ] **Step 4: Verify** — `npm test` (new test passes), `make reset && make audit` (projection still resolves the live Type Index + routing.jsonld at `/vault/...`). **Commit.**

---

## Phase 4 — PROF delivery fix

**Goal:** make `Link: rel="profile"` actionable so an agent follows it (the cold probe dismissed the bare IRI).

### Task 4.1: Add `sh:agentInstruction` to each PROF descriptor

**Files:** `overlays/wiki-memory/profiles/{page,concept,person,howto,working,event,organization,place,procedure,template,thing}.ttl`

- [ ] **Step 1:** To each profile descriptor add an `sh:agentInstruction` stating the dual-view hint, e.g. for `concept.ttl`: *"You are reading the wiki-memory Concept **document view** of this entity. Its **graph view** is the `.meta` at `<this>.meta` (SPARQL over it for typed predicates). Shape: `/vault/meta/shapes/concept.shacl.ttl`. Canonical entity node: `<#this>`. To select a view explicitly (future): conneg-by-profile `?_profile=`."* (`?_profile=` selection is deferred — mention as forward-looking only.)
- [ ] **Step 2: Verify** — `make reset`; `curl -s -H "Accept: text/turtle" https://pod.vardeman.me/vault/meta/profiles/concept` shows the `sh:agentInstruction`. `make audit`.
- [ ] **Step 3: Commit.**

### Task 4.2: Announce PROF at the entry point + confirm headers

**Files:** `shapes/substrate/storage-description.shacl.ttl` (entry-point `sh:agentInstruction`), verify the profile-link metadata writer still emits `Link: rel="profile"`

- [ ] **Step 1:** Append to the storage-description `sh:agentInstruction`: *"Resources here carry `Link: rel=\"profile\"` (RFC 6906) — dereference it to learn the resource kind and how to read its document and graph views."*
- [ ] **Step 2: Confirm header behavior** — `curl -sI https://pod.vardeman.me/vault/wiki/index.md | grep -i '^link:'` shows a `rel="profile"` link and **no `Content-Profile`** (expired draft — must not appear).
- [ ] **Step 3: Verify** — `make reset && make audit`. **Commit.**

---

## Phase 5 — Dual-view eval harness & acceptance

**Goal:** validate the re-layering against agent behavior (RQ-View-2); tune the harness, never the server.

### Task 5.1: Round-trip-across-views test (deterministic)

**Files:** Create `tests/test_dual_view_roundtrip.py`

- [ ] **Step 1: Write the test** — against the live Pod (TLS env set): PUT a minimal markdown concept (document view) to `/vault/wiki/working/` (two-stage commit), then SPARQL the `.meta` (graph view) via the solid-agent-skills CLI or Comunica and assert the projected `<#this> a wiki:Concept` + the body wikilink predicate appear. Then the reverse: assert the document body is retrievable and consistent. (Pattern: `tests/` integration style; `verify=False` acceptable for local mkcert.)
- [ ] **Step 2: Run** — `~/uvws/.venv/bin/python -m pytest tests/test_dual_view_roundtrip.py -v`. This exercises D71 projection; failure = the dual-view model is broken (the diagnostic-most signal).
- [ ] **Step 3: Commit.**

### Task 5.2: Cold-probe eval (Probes A/B/C)

**Files:** Create `docs/plans/2026-05-28-dual-view-eval.md` (reuse the cold-probe instrument from `docs/plans/2026-05-27-two-hierarchy-eval.md`)

- [ ] **Step 1:** Define the three probes (A: misread regression vs the 2026-05-26/27 baseline; B: dual-view usage task; C: PROF with/without). Run a cold HTTP-only agent against the re-layered Pod.
- [ ] **Step 2:** Score on the Rung 1.5 axes (trajectory / outcome / round-trip). **Primary acceptance:** Probe A no longer misreads `wiki` as an application.
- [ ] **Step 3: If a probe fails, tune the harness** — adjust the entry-point `sh:agentInstruction` (Task 3.1), the PROF hints (Task 4.1), or the authoring skill in `solid-agent-skills` — and re-run. **Do NOT change server routing.** Record each tune→re-probe iteration in the eval doc.
- [ ] **Step 4: Commit the eval report.**

### Task 5.3: Wire `make audit` into the reproducible-rebuild loop

**Files:** `Makefile` (the `reset` target)

- [ ] **Step 1:** Have `make reset` run `make audit` at the end (or document a `make verify` that chains them) so a fresh rebuild always re-validates self-description — closes the FOLLOWUPS "wire make audit into reset/CI" item.
- [ ] **Step 2: Verify** — `make reset` now ends with an audit pass. **Commit.**

### Task 5.4: Update docs, FOLLOWUPS, memory

- [ ] **Step 1:** Update `FOLLOWUPS.md` — mark the four contamination couplings resolved (cite the phase commits); note RQ-Substrate-4's *URI slice* closed by D107+this plan, deep view-layer slice still open.
- [ ] **Step 2:** Update `.claude/memory/MEMORY.md` (repo) "Shipped" table + the RQ-Substrate-4 beacon, and the auto-memory `substrate-vault-contamination.md`.
- [ ] **Step 3:** Refresh affected skills' deltas if they name moved predicates (`solid-storage-description`, `solid-data-modelling`, `shacl-shapes`, `solid-affordance-descriptors`). **Commit.** Then use `superpowers:finishing-a-development-branch` to decide merge.

---

## Self-review

**Spec coverage (D107 §§4–6):** §4.1 Bucket 1 → Phase 1 ✓; §4.2 Bucket 2 → Phase 2 ✓; §4.3 Bucket 3 + `/wiki/` reframe → Phase 3.1 ✓; §4.4 storage-root derive → Phase 3.2 ✓; §4.5 PROF → Phase 4 ✓; §5 validation (Probes A/B/C, round-trip, tune-harness) → Phase 5 ✓; §6 deferred items explicitly NOT in plan ✓. RQ-View-2 → Phase 5.1/5.2 ✓.

**Consistency (Chuck's concern):** Phase-0 mirror test + `make reset`/`make audit` gate after every phase + audit-shape-and-data-in-same-commit rule + lockstep-mirrors rule (Task 2.4) + rollback doctrine. The substrate is never left half-migrated because each phase ends green or is reverted.

**Placeholder scan:** Term mappings are explicit (disposition table + per-task IRIs); the one deliberate in-task investigation (`eventStream`, Task 1.2) has a decision rule and a safe default (`sub:eventStream`), not a TODO. Storage-root derivation states the pragmatic form (config param) vs the stronger form (Link-header derivation) with a clear choice.

**Type/name consistency:** `WIKI` vs `SUB` const split named identically across `pod_audit.py` and the TS files; `solid:publicTypeIndex` used uniformly; Bucket-3 exclusion list repeated where deletions happen (Task 2.3 Step 2) to prevent over-migration.

**Open confirmations folded into tasks (not blockers):** substrate vocab file placement (under wiki-memory overlay vs a new `overlays/substrate/`) — Task 2.1 defaults to the wiki-memory overlay; single `sub:` ns vs concern-split — plan uses single per D107. Both are revisable without re-sequencing.
