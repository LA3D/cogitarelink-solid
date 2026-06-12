# SP2 — The Consumable Pod Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface + materialize the declared-but-inert interop/ShapeTree layer and enforce the agentic write contract on the RDF-native lanes, so a cold agent carrying the SP1 `pod-navigate` skill can walk Pod → app → container → resource through real materialized views (spec §8 SP2, `docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md`; grounding + closed forks in `docs/research/2026-06-12-solid-design-intent-harmonization.md`).

**Architecture:** One view-layer rework, five phases. (A) Surface the An declarations per SAI §3 owner-side conformance — `hasRegistrySet` discoverable from the dereferenced WebID card, all apps in the registry, per-app `st:Description` consumption hints — while keeping the registries OFF Layer-0 (they are access-controllable by design; harmonization delta 1). (B) Materialize the validated definition-line `index.md` child per registered container via an on-write MonitoringStore listener + the existing ViewAssembler (settled fork a/d), with derivation provenance in its `.meta` (spec §7); re-cut D80's dead CONSTRUCT affordances onto the served views. (C) Strip the profile-selection machinery (configured-client fork: DROPPED) and re-cut Layer-0 lean. (D) Extend the write contract on the **Turtle lanes only** (fork: Turtle-first; markdown lane is a named follow-on gated on D82), applying the twin-probe findings: require-or-derive, content-laden `sh:agentInstruction` on the shape, shallow anti-boilerplate. (E) Each mechanism lands WITH its cold probe (spec §12); the SP2 gate is the end-to-end contract walk.

**Tech Stack:** TypeScript CSS v8 extensions (Components.js, N3, `@comunica/query-sparql`, vitest), Turtle overlays seeded by `scripts/overlay/apply.py`, pytest live-integration tests, the `evals/` cold-probe rig pattern (`claude -p` headless + Sonnet).

**Repos touched:** `cogitarelink-solid` only (branch `sp2-consumable-pod`; merge to main no-ff at the end). The SP1 skill/CLI in `solid-agent-skills` is NOT modified (it already instructs reading `st:Description`).

**Closed forks (do not reopen):**
- Write contract lands **Turtle-first**; markdown/projection lane is a NAMED follow-on gated on D82 (record, don't build).
- **Drop `?_profile=` selection + `alt`**; keep `rel="profile"`/`dct:conformsTo`/PROF descriptors as hints + `?_profile=fused` (aggregation). Re-entry path for a future configured client = new derived views + hints.
- **`prov:agent` derivation DEFERRED to the security profile** (Chuck 2026-06-12) — record as a named follow-on; do not derive placeholder identities under dev-allow-all.

**Pre-flight for the implementing session:**
- Live Pod: `cd ~/dev/git/LA3D/agents/cogitarelink-solid && make reset` (never `make up` alone). Verify `curl -sk https://pod.vardeman.me/vault/` → 200.
- `make test` green (Pod-up), `make test-js` green, `make audit` 0 ERROR / 1 known WARN (D98 dup-container).
- Known flake: `test_timemap_returns_parseable_turtle` (ordering-dependent; passes in isolation).
- Read auto-memory `cold_probe_harness_pattern.md` before Phase E (read ALL trajectories, full CoT).
- Python: `~/uvws/.venv/bin/python` always.

---

## File structure

```
overlays/owner-identity/patches/profile-card-meta.ttl      MODIFY — + interop:hasRegistrySet (Task 1)
overlays/wiki-memory/interop/registry.ttl                  MODIFY — + id-schemes + addressbook DataRegistrations (Task 1)
overlays/addressbook/interop/application.ttl               CREATE — third interop:Application (Task 2)
overlays/addressbook/manifest.ttl                          MODIFY — install the application doc (Task 2)
overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl       MODIFY — + st:Description (consumption hints) (Task 2)
overlays/identifier-schemes/interop/application.ttl        MODIFY — + st:Description hint (Task 2)
overlays/wiki-memory/manifest.ttl                          MODIFY — template hostedAt out of shape catalog (Task 3)
overlays/wiki-memory/extending-l3.md                       MODIFY — template pointer (Task 3)
tests/test_sp2_surfacing.py                                CREATE — Tasks 1–3 live assertions
css/extensions/view-layer/src/indexView.ts                 CREATE — buildIndexMarkdown + INDEX_QUERY (Task 4)
css/extensions/view-layer/src/IndexViewListener.ts         CREATE — on-write refresh (Task 5)
css/extensions/view-layer/src/index.ts                     MODIFY — exports (Tasks 4–5)
css/extensions/view-layer/test/indexView.test.ts           CREATE (Task 4)
css/extensions/view-layer/test/indexViewListener.test.ts   CREATE (Task 5)
css/config/view-layer.json                                 MODIFY — listener wiring (Task 5); alt-token removal (Task 7)
overlays/wiki-memory/views/container-index.ttl             CREATE — declared-query descriptor (Task 4)
tests/test_index_views.py                                  CREATE — live integration (Task 5)
overlays/wiki-memory/affordances/{hub-view,breadcrumb-view}.ttl   MODIFY — D80 re-cut (Task 6)
css/extensions/view-layer/src/ViewHttpHandler.ts           MODIFY — drop alt; 404; metadata filter; prefixes (Task 7)
css/config/void-description.json                           MODIFY — lean Layer-0 re-cut (Task 8)
css/extensions/markdown-projection/src/governedPredicates.ts      MODIFY — WIKI_CLASS_TO_PROFILE +3 (Task 8)
.claude/skills/decision-lookup/decisions.md                MODIFY — D86/D80/D113 annotations + D115 (Task 9)
overlays/addressbook/shapes/contact-card.shacl.ttl         MODIFY — write-context requirement (Task 10)
overlays/identifier-schemes/shapes/scheme-record.shacl.ttl MODIFY — write-context requirement (Task 10)
overlays/{addressbook,identifier-schemes} seed data        MODIFY — seeds carry bootstrap rationale (Task 10)
tests/test_write_contract_turtle.py                        CREATE (Task 10)
css/extensions/ops-index/src/OperationsIndexListener.ts    MODIFY — D96 subject placement (Task 11)
css/extensions/ops-index/test/subjectPlacement.test.ts     CREATE (Task 11)
evals/e2e-walk/                                            CREATE — the SP2 gate rig (Task 13)
docs/plans/2026-06-XX-sp2-{e7-rerun,index-insitu,e2e-walk}-report.md   CREATE (Tasks 12–13)
FOLLOWUPS.md, .claude/memory/MEMORY.md, spec §8 annotation MODIFY (Task 14)
```

---

## PHASE A — Surface the declared layer

### Task 1: `hasRegistrySet` on the WebID card + complete the registry

A real SAI client discovers the RegistrySet by dereferencing the WebID; today the triple only exists inside the registry doc itself (`overlays/wiki-memory/interop/registry.ttl:6`). Add it to the card's `.meta` via the owner-identity patch. Also register the two non-wiki apps' data in `reg:data` so the registry covers everything deployed.

**Files:**
- Modify: `overlays/owner-identity/patches/profile-card-meta.ttl`
- Modify: `overlays/wiki-memory/interop/registry.ttl`
- Create: `tests/test_sp2_surfacing.py`

- [ ] **Step 1: Write the failing live test**

```python
"""SP2 Phase A: the An layer is discoverable the way SAI §3/§7 intends (owner side).

Run: SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_sp2_surfacing.py -v
"""
import httpx
import pytest
from rdflib import Graph, URIRef, Namespace

from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
INTEROP = Namespace("http://www.w3.org/ns/solid/interop#")
CARD = URIRef(f"{POD}/vault/profile/card#me")
REGSET = URIRef(f"{POD}/vault/meta/interop/registry#set")

pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def _graph(path, accept="text/turtle"):
    r = httpx.get(f"{POD}{path}", headers={"Accept": accept}, verify=_CA)
    assert r.status_code == 200, f"{path}: {r.status_code}"
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=f"{POD}{path}")
    return g


def test_card_meta_carries_has_registry_set():
    g = _graph("/vault/profile/card.meta")
    assert (CARD, INTEROP.hasRegistrySet, REGSET) in g, \
        "SAI §3: hasRegistrySet must be discoverable from the dereferenced WebID"


def test_registry_covers_all_three_apps():
    g = _graph("/vault/meta/interop/registry")
    regs = set(g.objects(None, INTEROP.hasDataRegistration))
    frag = {str(r).split("#")[-1] for r in regs}
    assert "id-schemes" in frag and "contacts" in frag, f"got: {sorted(frag)}"
```

- [ ] **Step 2: Run it to verify the two new assertions fail**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_sp2_surfacing.py -v`
Expected: both tests FAIL (card `.meta` lacks the triple; registry lacks the registrations).

- [ ] **Step 3: Add the triple to the card patch**

Append to `overlays/owner-identity/patches/profile-card-meta.ttl` (after the existing `</vault/profile/card>` block):

```turtle
@prefix interop: <http://www.w3.org/ns/solid/interop#> .

# SP2 (2026-06-12): SAI §3 — a client discovers the RegistrySet from the
# dereferenced WebID. The registry doc also asserts this triple about the card;
# this patch makes it true AT the card. NOTE (harmonization delta 1): the
# RegistrySet is access-controllable BY DESIGN — it is An-layer declaration,
# NOT Layer-0 orientation; .well-known must not route through it.
<https://pod.vardeman.me/vault/profile/card#me>
    interop:hasRegistrySet <https://pod.vardeman.me/vault/meta/interop/registry#set> .
```

(Use the absolute card IRI with `#me`, matching registry.ttl line 6 — the existing patch's relative `</vault/profile/card>` subject is the Page; `#me` is the agent.)

- [ ] **Step 4: Register the two other apps' data in the registry**

Append to `overlays/wiki-memory/interop/registry.ttl`:

```turtle
@prefix idapp: <https://pod.vardeman.me/vault/meta/interop/id-schemes-application#> .
@prefix abapp: <https://pod.vardeman.me/vault/meta/interop/addressbook-application#> .

# SP2: the registry covers every deployed app (FOLLOWUPS ⚙ interop gap + D112 item 6).
reg:data interop:hasDataRegistration reg:id-schemes , reg:contacts .

reg:id-schemes a interop:DataRegistration ;
    interop:registeredWith idapp:id-schemes ;
    interop:registeredBy <https://pod.vardeman.me/vault/profile/card#me> .
    # No registeredShapeTree yet — id-schemes has no shapetree (D112 T6 note kept).

reg:contacts a interop:DataRegistration ;
    interop:registeredWith abapp:addressbook ;
    interop:registeredBy <https://pod.vardeman.me/vault/profile/card#me> .
```

- [ ] **Step 5: Redeploy + run the test to verify it passes**

Run: `make reset && SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_sp2_surfacing.py -v`
Expected: PASS ×2. (Note: `abapp:addressbook` 404s until Task 2 — that's a registry forward-pointer, valid Turtle; the test only checks registration fragments.)

- [ ] **Step 6: Commit**

```bash
git add overlays/owner-identity/patches/profile-card-meta.ttl overlays/wiki-memory/interop/registry.ttl tests/test_sp2_surfacing.py
git commit -m "[Agent: Claude] SP2-T1: hasRegistrySet on the WebID card + registry covers all apps"
```

### Task 2: Third app declaration + `st:Description` consumption hints

The addressbook is a live agentic app (D87) with no `interop:Application`. Declare it. Then give each app an `st:Description` that tells a consuming agent the app's CONSUMPTION SHAPE (index-shaped vs operation-shaped — the generalization probe's split, spec §3); `pod-navigate` already instructs "read the app's declared description." Record the audience extension (spec says `st:Description` is human-facing "data listings"; we consume it agent-facing).

**Files:**
- Create: `overlays/addressbook/interop/application.ttl`
- Modify: `overlays/addressbook/manifest.ttl` (mirror how wiki-memory's manifest installs `interop/application.ttl` — find its `interop` install block with `grep -n interop overlays/wiki-memory/manifest.ttl` and copy the idiom)
- Modify: `overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl`
- Modify: `overlays/identifier-schemes/interop/application.ttl`
- Test: extend `tests/test_sp2_surfacing.py`

- [ ] **Step 1: Add the failing tests**

Append to `tests/test_sp2_surfacing.py`:

```python
ST = Namespace("http://www.w3.org/ns/shapetrees#")


def test_addressbook_application_declared():
    g = _graph("/vault/meta/interop/addressbook-application")
    app = URIRef(f"{POD}/vault/meta/interop/addressbook-application#addressbook")
    assert (app, None, None) in g
    assert (app, INTEROP.applicationName, None) in g


def test_each_app_declares_consumption_shape():
    # wiki-memory: index-shaped, declared on the shapetree's st:Description
    g = _graph("/vault/meta/shapetrees/wiki-memory.tree")
    descs = list(g.subjects(None, None))
    texts = " ".join(str(o) for o in g.objects(None, ST.describes) ) + \
            " ".join(str(o) for s, p, o in g if "skos" in str(p) or "definition" in str(p))
    body = g.serialize(format="turtle")
    assert "index-shaped" in body, "wiki-memory st:Description must declare its consumption shape"
    # id-schemes + addressbook: operation-shaped, on the application docs
    for path, marker in [("/vault/meta/interop/id-schemes-application", "operation-shaped"),
                         ("/vault/meta/interop/addressbook-application", "operation-shaped")]:
        body = _graph(path).serialize(format="turtle")
        assert marker in body, f"{path} must declare {marker}"
```

- [ ] **Step 2: Run to verify failure**

Run: `SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_sp2_surfacing.py -v -k "addressbook or consumption"`
Expected: FAIL (404 on the addressbook application doc; markers absent).

- [ ] **Step 3: Create the addressbook application declaration**

`overlays/addressbook/interop/application.ttl`:

```turtle
@prefix interop: <http://www.w3.org/ns/solid/interop#> .
@prefix acl:     <http://www.w3.org/ns/auth/acl#> .
@prefix sh:      <http://www.w3.org/ns/shacl#> .
@prefix st:      <http://www.w3.org/ns/shapetrees#> .
@prefix app:     <https://pod.vardeman.me/vault/meta/interop/addressbook-application#> .

app:addressbook a interop:Application ;
    interop:applicationName "AddressBook" ;
    interop:applicationDescription "vCard contact store (D87): /vault/contacts/ — flat Person/Organization records, find-by-ORCID/ROR affordances." ;
    interop:hasAccessNeedGroup app:ab-needs .

app:ab-needs a interop:AccessNeedGroup ;
    interop:accessNecessity interop:AccessRequired ;
    interop:accessScenario interop:PersonalAccess ;
    interop:hasAccessNeed app:need-contacts .

app:need-contacts a interop:AccessNeed ;
    interop:accessMode acl:Read , acl:Write ;
    interop:accessNecessity interop:AccessRequired .

# SP2 consumption hint (spec §3 disclosure-vs-operation split; audience extension
# of st:Description's human-facing "data listings" — recorded in decisions.md D115).
app:addressbook-description a st:Description ;
    st:describes app:addressbook ;
    sh:agentInstruction """This app is OPERATION-SHAPED: do not enumerate members to
answer lookups. Discover its affordances (`solid-pod affordances <any-resource-url>`)
and invoke the declared query — e.g. contact-find-by-orcid with
--param orcid=<iri> — or run the descriptor's SPARQL yourself. Container listing is
the fallback, not the access pattern. Data: /vault/contacts/ (vCard Individuals,
flat Person/*.ttl + Organization/*.ttl).""" .
```

- [ ] **Step 4: Add the consumption hints to the two existing apps**

Append to `overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl`:

```turtle
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix app:  <https://pod.vardeman.me/vault/meta/interop/application#> .

wikitree:wiki-memory-description a st:Description ;
    st:describes app:wiki-memory ;
    sh:agentInstruction """This app is INDEX-SHAPED: each registered container
maintains a definition-line index.md child (derived; its .meta carries derivation
provenance — audit it before trusting). Route through the index, not by enumerating
members. Navigation axis = skos:broader/narrower between concepts; addressing
axis = the Type Index (class -> container). Write path: draft in working/, then
crystallize (two-stage, D73).""" .
```

Append to `overlays/identifier-schemes/interop/application.ttl`:

```turtle
@prefix st: <http://www.w3.org/ns/shapetrees#> .

app:id-schemes-description a st:Description ;
    st:describes app:id-schemes ;
    sh:agentInstruction """This app is OPERATION-SHAPED: resolve and register
identifiers via the catalog's declared affordances and scheme records
(/id/schemes/ — server-derived index document at /id/schemes/ itself). To resolve:
match the identifier against each record's idot:luiPattern, substitute into a
provider's idot:urlPattern. To register: POST a conformant scheme record (the
container's shape teaches via 422). Curation lane: /id/.operations/ (propose-only).""" .
```

- [ ] **Step 5: Install the addressbook application doc via its manifest**

In `overlays/addressbook/manifest.ttl`, add an install entry for `interop/application.ttl` hosted at `/vault/meta/interop/addressbook-application` — copy the exact predicate idiom wiki-memory's manifest uses for its `interop/application.ttl` (find it: `grep -n -B2 -A2 "interop" overlays/wiki-memory/manifest.ttl`). Keep the hostedAt extension-less (D84).

- [ ] **Step 6: Redeploy + verify, then commit**

Run: `make reset && SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_sp2_surfacing.py -v`
Expected: PASS ×4. Then:

```bash
git add overlays/addressbook/interop/application.ttl overlays/addressbook/manifest.ttl overlays/wiki-memory/shapetrees/wiki-memory.tree.ttl overlays/identifier-schemes/interop/application.ttl tests/test_sp2_surfacing.py
git commit -m "[Agent: Claude] SP2-T2: addressbook Application + st:Description consumption hints (all 3 apps)"
```

### Task 3: Shape catalog parses clean (template placeholder out)

`overlays/wiki-memory/shapes/template.shacl.ttl` carries `rdfs:isDefinedBy <[YOUR VOCABULARY IRI]>` and is served INTO the shape catalog (manifest lines 85–86: hostedAt `/vault/meta/shapes/template.shacl.ttl`) — it breaks N3 parsing of catalog members for the `shapes` CLI command and `pod-navigate`'s validate path (3 pinned KNOWN-FAILURES in the sibling repo).

**Files:**
- Modify: `overlays/wiki-memory/manifest.ttl:85-86`
- Modify: `overlays/wiki-memory/extending-l3.md` (the template pointer, ~line 53)
- Test: extend `tests/test_sp2_surfacing.py`

- [ ] **Step 1: Add the failing test**

```python
def test_shape_catalog_members_all_parse():
    g = _graph("/vault/meta/shapes/")
    LDP = Namespace("http://www.w3.org/ns/ldp#")
    members = list(g.objects(None, LDP.contains))
    assert members, "catalog empty?"
    for m in members:
        r = httpx.get(str(m), headers={"Accept": "text/turtle"}, verify=_CA)
        Graph().parse(data=r.text, format="turtle", publicID=str(m))  # raises on the placeholder
```

- [ ] **Step 2: Run to verify it fails** on `template.shacl.ttl` (BadSyntax at `<[YOUR VOCABULARY IRI]>`).

- [ ] **Step 3: Move the template out of the catalog**

In `overlays/wiki-memory/manifest.ttl` change the hostedAt (line ~86):

```turtle
        [ overlay:document "shapes/template.shacl.ttl" ;
          overlay:hostedAt "/vault/meta/templates/shape-template.shacl.ttl" ] ;
```

In `overlays/wiki-memory/extending-l3.md`, update the template reference from `/vault/meta/shapes/template.shacl.ttl` to `/vault/meta/templates/shape-template.shacl.ttl` (grep for the old path; update every occurrence).

- [ ] **Step 4: Redeploy + verify + run `make audit` (expect: the rdflib traceback noise from the placeholder is gone from the shapes walk; still 0 ERROR / 1 known WARN), then commit**

```bash
git add overlays/wiki-memory/manifest.ttl overlays/wiki-memory/extending-l3.md tests/test_sp2_surfacing.py
git commit -m "[Agent: Claude] SP2-T3: shape catalog parses clean — template relocated to /vault/meta/templates/"
```

(Sibling-repo note for Task 14: the 2 pinned `shapes` KNOWN-FAILURES in solid-agent-skills should now pass on a fresh Pod — un-pin them there when that repo is next touched, not in this plan.)

---

## PHASE B — Materialize the index views

### Task 4: `buildIndexMarkdown` + the declared index query (pure unit)

The validated definition-line format (RQ-Discovery-1, fork d). The query is DECLARED (D113 principle): the same text lives in a view descriptor on the Pod and as the extension constant, locked by an agreement test (the repo's maps.json idiom).

**Files:**
- Create: `css/extensions/view-layer/src/indexView.ts`
- Create: `css/extensions/view-layer/test/indexView.test.ts`
- Create: `overlays/wiki-memory/views/container-index.ttl`
- Modify: `css/extensions/view-layer/src/index.ts` (add `export * from "./indexView";`)

- [ ] **Step 1: Write the failing unit test**

`css/extensions/view-layer/test/indexView.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { DataFactory } from "n3";
import { buildIndexMarkdown, INDEX_QUERY } from "../src/indexView";

const { namedNode, literal, quad } = DataFactory;
const C = "https://pod.example/vault/wiki/concepts/";

function conceptQuads(slug: string, label: string, definition?: string) {
  const thing = namedNode(`${C}${slug}.md#this`);
  const qs = [
    quad(thing, namedNode("http://www.w3.org/2004/02/skos/core#prefLabel"), literal(label)),
  ];
  if (definition) {
    qs.push(quad(thing, namedNode("http://www.w3.org/2004/02/skos/core#definition"), literal(definition)));
  }
  return qs;
}

describe("buildIndexMarkdown", () => {
  it("emits one definition line per member, sorted by label", () => {
    const quads = [
      ...conceptQuads("zzz", "Zebra Topic", "Stripes for memory."),
      ...conceptQuads("aaa", "Aardvark Topic", "Digs for facts."),
    ];
    const md = buildIndexMarkdown(C, quads);
    const lines = md.trim().split("\n").filter((l) => l.startsWith("- "));
    expect(lines).toEqual([
      "- [Aardvark Topic](aaa.md) — Digs for facts.",
      "- [Zebra Topic](zzz.md) — Stripes for memory.",
    ]);
  });

  it("falls back to the slug-relative link with no definition", () => {
    const md = buildIndexMarkdown(C, conceptQuads("bare", "Bare"));
    expect(md).toContain("- [Bare](bare.md)");
    expect(md).not.toContain("— undefined");
  });

  it("skips the index resource itself", () => {
    const quads = [
      ...conceptQuads("index", "The Index"),
      ...conceptQuads("real", "Real", "A real one."),
    ];
    const md = buildIndexMarkdown(C, quads);
    expect(md).not.toContain("(index.md)");
  });

  it("INDEX_QUERY selects prefLabel-or-name with optional definition-or-description", () => {
    for (const term of ["prefLabel", "definition", "schema.org/name", "description", "OPTIONAL"]) {
      expect(INDEX_QUERY).toContain(term);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd css/extensions/view-layer && npx vitest run test/indexView.test.ts`
Expected: FAIL — module `../src/indexView` not found.

- [ ] **Step 3: Implement**

`css/extensions/view-layer/src/indexView.ts`:

```typescript
import type { Quad } from "n3";

/**
 * The declared container-index projection (SP2; RQ-Discovery-1 fork a/d).
 * SAME TEXT as the role:mapping artifact in
 * overlays/wiki-memory/views/container-index.ttl — agreement-tested; edit both.
 */
export const INDEX_QUERY = `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX schema: <https://schema.org/>
SELECT ?thing ?label ?def WHERE {
  { ?thing skos:prefLabel ?label } UNION { ?thing schema:name ?label }
  OPTIONAL { { ?thing skos:definition ?def } UNION { ?thing schema:description ?def } }
}`;

const PREF = "http://www.w3.org/2004/02/skos/core#prefLabel";
const NAME = "https://schema.org/name";
const DEF = "http://www.w3.org/2004/02/skos/core#definition";
const DESC = "https://schema.org/description";

/** Definition-line index over a container's member `<...#this>` subjects. */
export function buildIndexMarkdown(containerUrl: string, quads: Quad[]): string {
  const bySubject = new Map<string, { label?: string; def?: string }>();
  for (const q of quads) {
    const s = q.subject.value;
    if (!s.startsWith(containerUrl)) continue;
    const entry = bySubject.get(s) ?? {};
    if ((q.predicate.value === PREF || q.predicate.value === NAME) && !entry.label) {
      entry.label = q.object.value;
    }
    if ((q.predicate.value === DEF || q.predicate.value === DESC) && !entry.def) {
      entry.def = q.object.value;
    }
    bySubject.set(s, entry);
  }
  const lines: string[] = [];
  for (const [subject, { label, def }] of bySubject) {
    if (!label) continue;
    const doc = subject.slice(containerUrl.length).replace(/#.*$/, "");
    if (doc === "index.md" || doc === "index") continue;
    const firstSentence = def ? ` — ${def.split(/(?<=\.)\s/)[0]}` : "";
    lines.push(`- [${label}](${doc})${firstSentence}`);
  }
  lines.sort((a, b) => a.localeCompare(b, "en"));
  return `# Index\n\nOne line per member; derived — see this document's .meta for derivation provenance.\n\n${lines.join("\n")}\n`;
}
```

- [ ] **Step 4: Run the test to verify it passes**, adjust the sentence-split if Node's lookbehind differs.

- [ ] **Step 5: Create the declared-query descriptor (the agreement twin)**

`overlays/wiki-memory/views/container-index.ttl` — copy the descriptor frame from `overlays/wiki-memory/views/fused.ttl` (a `sub:View` with `sub:realization`, `prof:hasArtifact` role:mapping) and quote `INDEX_QUERY` verbatim as the mapping artifact literal; add `sub:writable false` and a `sh:agentInstruction`: `"Each registered container serves a derived index.md child built from this query. Derived — audit its .meta derivation provenance before trusting."` Install it via the wiki-memory manifest the same way `views/fused.ttl` is installed (grep `views/fused` in `overlays/wiki-memory/manifest.ttl`, mirror the entry with hostedAt `/vault/meta/views/container-index`).

- [ ] **Step 6: Add the agreement test** (append to `test/indexView.test.ts`):

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("descriptor quotes INDEX_QUERY verbatim (declared-query agreement)", () => {
  const ttl = readFileSync(
    resolve(__dirname, "../../../../overlays/wiki-memory/views/container-index.ttl"), "utf8");
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  expect(normalize(ttl)).toContain(normalize(INDEX_QUERY));
});
```

- [ ] **Step 7: Run all view-layer tests + commit**

```bash
cd css/extensions/view-layer && npx vitest run && cd ../../..
git add css/extensions/view-layer/src/indexView.ts css/extensions/view-layer/test/indexView.test.ts css/extensions/view-layer/src/index.ts overlays/wiki-memory/views/container-index.ttl overlays/wiki-memory/manifest.ttl
git commit -m "[Agent: Claude] SP2-T4: definition-line index builder + declared-query descriptor (agreement-tested)"
```

### Task 5: `IndexViewListener` — on-write refresh with derivation provenance

Settled fork (a): listener-refreshed static `index.md` child. Model the wiring on `OperationsIndexListener` (same MonitoringStore `changed` event, same re-entrancy guard idiom, same `getRepresentation`/`setRepresentation` INTERNAL_QUADS access — open `css/extensions/ops-index/src/OperationsIndexListener.ts` and mirror its import block and guard pattern exactly; adapt names if they differ from the sketch below).

**Files:**
- Create: `css/extensions/view-layer/src/IndexViewListener.ts`
- Create: `css/extensions/view-layer/test/indexViewListener.test.ts`
- Modify: `css/config/view-layer.json`, `css/extensions/view-layer/src/index.ts`
- Create: `tests/test_index_views.py`

- [ ] **Step 1: Write the failing unit test** (in-memory store stub, the ops-index test style — open `css/extensions/ops-index/test/` and reuse its store stub helper):

```typescript
import { describe, it, expect } from "vitest";
// Reuse the ops-index test stub idiom: a fake store capturing setRepresentation calls
// and serving canned INTERNAL_QUADS representations for container + member .meta reads.
import { IndexViewListener } from "../src/IndexViewListener";

describe("IndexViewListener", () => {
  it("regenerates index.md + .meta with derivation provenance on a member write", async () => {
    const { store, written } = makeStubStore(/* container with 2 members + their .meta quads */);
    const l = new IndexViewListener(store as any, "https://pod.example/", [
      "https://pod.example/vault/wiki/concepts/",
    ]);
    await l.handleChanged("https://pod.example/vault/wiki/concepts/zebra.md");
    const idx = written.get("https://pod.example/vault/wiki/concepts/index.md");
    expect(idx.body).toContain("- [");
    expect(idx.meta).toContain("prov:wasDerivedFrom");
    expect(idx.meta).toContain("prov:generatedAtTime");
    expect(idx.meta).toContain("container-index");  // pointer to the declared query descriptor
  });

  it("ignores writes outside registered containers and its own index writes (re-entrancy)", async () => {
    const { store, written } = makeStubStore();
    const l = new IndexViewListener(store as any, "https://pod.example/", [
      "https://pod.example/vault/wiki/concepts/",
    ]);
    await l.handleChanged("https://pod.example/vault/contacts/x.ttl");
    await l.handleChanged("https://pod.example/vault/wiki/concepts/index.md");
    expect(written.size).toBe(0);
  });
});
```

(Write `makeStubStore` in the test file by copying the ops-index stub and parameterizing the canned members; it must record `setRepresentation` paths+bodies into `written`.)

- [ ] **Step 2: Run to verify failure**, then **Step 3: implement** `IndexViewListener.ts`:

Core shape (mirror OperationsIndexListener's actual imports/utilities):

```typescript
export class IndexViewListener {
  private readonly deriving = new Set<string>();

  public constructor(
    private readonly store: ResourceStore,
    private readonly baseUrl: string,
    private readonly containers: string[],   // registered container URLs (config)
  ) {}

  public async handleChanged(url: string): Promise<void> {
    const ctr = this.containers.find((c) => url.startsWith(c));
    if (!ctr) return;
    const indexUrl = `${ctr}index.md`;
    if (url === indexUrl || url === `${indexUrl}.meta` || this.deriving.has(indexUrl)) return;
    this.deriving.add(indexUrl);
    try {
      // 1. enumerate members (container INTERNAL_QUADS -> ldp:contains)
      // 2. read each member's .meta quads (the governed graph)
      // 3. buildIndexMarkdown(ctr, allQuads)
      // 4. setRepresentation(index.md, text/markdown body)
      // 5. PATCH index.md.meta with derivation provenance:
      //    <index.md> prov:wasDerivedFrom <ctr> ;
      //       prov:wasGeneratedBy <baseUrl + "vault/meta/views/container-index"> ;
      //       prov:generatedAtTime "<now>"^^xsd:dateTime .
    } finally {
      this.deriving.delete(indexUrl);
    }
  }
}
```

Fill the five numbered steps with the exact read/write idioms from `OperationsIndexListener.setBackPointer` (INTERNAL_QUADS reads, merge-don't-clobber `.meta` writes). The listener subscribes to the MonitoringStore `changed` event the same way OperationsIndexListener does — copy its activation/subscription code path, including how it's attached in config.

- [ ] **Step 4: Unit tests pass**, **Step 5: wire the config** — add to `css/config/view-layer.json` `@graph` (mirror the OperationsIndexListener block in its config file — find it: `grep -rn "OperationsIndexListener" css/config/`):

```json
{
  "comment": "SP2 IndexViewListener (fork a): on-write refresh of each registered container's derived index.md child, with derivation provenance in its .meta (spec §7 — derived views are self-describing). Registered containers = the wiki-memory An-layer DataRegistrations.",
  "@id": "urn:cogitarelink:IndexViewListener",
  "@type": "IndexViewListener",
  "store": { "@id": "urn:solid-server:default:ResourceStore" },
  "baseUrl": { "@id": "urn:solid-server:default:variable:baseUrl" },
  "containers": [
    "https://pod.vardeman.me/vault/wiki/concepts/",
    "https://pod.vardeman.me/vault/wiki/people/",
    "https://pod.vardeman.me/vault/wiki/places/",
    "https://pod.vardeman.me/vault/wiki/events/",
    "https://pod.vardeman.me/vault/wiki/organizations/",
    "https://pod.vardeman.me/vault/wiki/procedures/"
  ]
}
```

(Deliberately NOT `working/` — drafts are low-ceremony, D73. Attach the listener to the same initializer the other listeners use — see the memento.json comment: "WorkerParallelInitializer override moved to markdown-projection.json (both listeners must be in one place)"; add this listener THERE, alongside them.)

- [ ] **Step 6: Live integration test** `tests/test_index_views.py`:

```python
"""SP2: derived index.md children — write a concept, the index updates, provenance present."""
import httpx, pytest, uuid
from rdflib import Graph, Namespace, URIRef
from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
PROV = Namespace("http://www.w3.org/ns/prov#")
pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")


def test_concept_write_refreshes_index_with_provenance():
    slug = f"sp2-idx-{uuid.uuid4().hex[:8]}"
    body = f"---\ntype: Concept\n---\n# SP2 Index Probe\n\n[SP2 Index Probe]{{.prefLabel}} is [a test marker for the derived index.]{{.definition}}\n"
    r = httpx.put(f"{POD}/vault/wiki/concepts/{slug}.md", content=body,
                  headers={"Content-Type": "text/markdown"}, verify=_CA)
    assert r.status_code in (201, 205)
    idx = httpx.get(f"{POD}/vault/wiki/concepts/index.md", verify=_CA)
    assert idx.status_code == 200
    assert "SP2 Index Probe" in idx.text and f"({slug}.md)" in idx.text
    m = httpx.get(f"{POD}/vault/wiki/concepts/index.md.meta",
                  headers={"Accept": "text/turtle"}, verify=_CA)
    g = Graph(); g.parse(data=m.text, format="turtle", publicID=f"{POD}/vault/wiki/concepts/index.md")
    assert (None, PROV.wasDerivedFrom, URIRef(f"{POD}/vault/wiki/concepts/")) in g
    assert (None, PROV.generatedAtTime, None) in g
    httpx.delete(f"{POD}/vault/wiki/concepts/{slug}.md", verify=_CA)  # cleanup
```

- [ ] **Step 7: Rebuild + redeploy + verify**

Run: `cd css/extensions/view-layer && npm run build && cd ../../.. && make reset && SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_index_views.py -v && make test-js`
Expected: PASS; no staleness-guard trips.

- [ ] **Step 8: Commit**

```bash
git add css/extensions/view-layer/ css/config/view-layer.json css/config/markdown-projection.json tests/test_index_views.py
git commit -m "[Agent: Claude] SP2-T5: IndexViewListener — on-write derived index.md + derivation provenance"
```

### Task 6: D80 re-cut — hub-view/breadcrumb-view off the dead surface

Agents never run handed CONSTRUCTs (PD audit). Re-cut the two affordance descriptors from "invoke this query" to pointers at the served views.

**Files:**
- Modify: `overlays/wiki-memory/affordances/hub-view.ttl`, `overlays/wiki-memory/affordances/breadcrumb-view.ttl` (exact paths: `ls overlays/wiki-memory/affordances/ | grep -E "hub|breadcrumb"`)
- Test: extend `tests/test_sp2_surfacing.py`

- [ ] **Step 1: Failing test** — assert the two descriptors no longer carry `sub:selectQuery`/`sub:constructQuery` (or `wiki:` equivalents) and DO carry an `sh:agentInstruction` pointing at `index.md` / the views space.

```python
def test_d80_recut_no_handed_constructs():
    for name in ("hub-view", "breadcrumb-view"):
        body = _graph(f"/vault/meta/affordances/{name}").serialize(format="turtle")
        assert "constructQuery" not in body and "selectQuery" not in body, name
        assert "index.md" in body or "views/" in body, name
```

- [ ] **Step 2–3: Re-cut each descriptor**: keep the descriptor's type/label/PROF frame; replace the query artifact with `sh:agentInstruction` prose: hub-view → "Hub navigation is served: each container's derived `index.md` lists members with definitions; concepts with ≥3 inbound `skos:broader` links are hubs — read the index, then follow `skos:broader`/`narrower`." breadcrumb-view → "Breadcrumbs are the `skos:broader` chain on the resource's `<#this>` subject in its `.meta`; follow it upward. No query invocation needed." Mark both `dct:isReplacedBy </vault/meta/views/container-index>` style pointers if the descriptor frame has a place for it.

- [ ] **Step 4: Redeploy, test passes, `make audit` 0 ERROR, commit**

```bash
git add overlays/wiki-memory/affordances/ tests/test_sp2_surfacing.py
git commit -m "[Agent: Claude] SP2-T6: D80 re-cut — hub/breadcrumb affordances point at served views"
```

---

## PHASE C — Strip-back + lean Layer-0

### Task 7: ViewHttpHandler — drop `alt`, fix the 404, clean the fused graph

**Files:**
- Modify: `css/extensions/view-layer/src/ViewHttpHandler.ts`, `css/extensions/view-layer/src/ViewAssembler.ts`
- Modify: `css/extensions/view-layer/test/` (existing handler tests — extend)
- Modify: `overlays/wiki-memory/views/` (delete/blank the `alt` descriptor if one exists: `grep -rln "alt" overlays/wiki-memory/views/`)

- [ ] **Step 1: Failing tests** (extend the existing handler test file; find it with `ls css/extensions/view-layer/test/`):

```typescript
it("?_profile=alt is no longer claimed (falls through to LDP)", async () => {
  // handler.canHandle / handle on ?_profile=alt -> NotImplementedHttpError
});
it("?_profile=fused on a missing base resource -> 404 NotFoundHttpError, not 500", async () => {});
it("fused RDF output excludes the CSS ResponseMetadata named-graph quads", async () => {});
it("serializeTurtle emits prefixed Turtle (skos/schema/dct/prov/mem prefixes)", async () => {});
```

- [ ] **Step 2: Run to verify failures.** **Step 3: Implement** — in `ViewHttpHandler.ts`: remove `alt` from the accepted token set (D114 note in the config comment says tokens are `fused|alt`); catch the store's `NotFoundHttpError` and rethrow it (don't wrap — the current handler bypasses CSS's error→HTTP converter; mirror how `WikiSearchHttpHandler` propagates it: `grep -n "NotFoundHttpError" css/extensions/wiki-search/src/*.ts`); filter quads whose graph term is the CSS `ResponseMetadata` named graph before serialization. In `ViewAssembler.serializeTurtle`: pass a `prefixes` map to the N3 Writer (`skos`, `schema`, `dct`, `prov`, `mem`, `sub`, `ldp`, `xsd`).

- [ ] **Step 4: Tests pass; rebuild; live-check** `curl -sk "https://pod.vardeman.me/vault/wiki/concepts/nonexistent.md?_profile=fused" -o /dev/null -w "%{http_code}"` → 404. **Step 5: Commit**

```bash
git add css/extensions/view-layer/ overlays/wiki-memory/views/
git commit -m "[Agent: Claude] SP2-T7: strip ?_profile=alt; fused 404-not-500; clean prefixed fused graph"
```

### Task 8: Lean Layer-0 re-cut + PROF hint completeness

`css/config/void-description.json` (410 lines) is re-cut to lead with orientation, keep the disposition literal, fold IN the view-authority content (D114 move 3 reversed per the strip-back), and drop selection-era descriptors. PROF hints stay (H0-validated). Plus the two PROF-hint completeness items.

**Files:**
- Modify: `css/config/void-description.json`
- Modify: `css/extensions/markdown-projection/src/governedPredicates.ts:188-195` (`WIKI_CLASS_TO_PROFILE`)
- Test: extend `tests/test_sp2_surfacing.py`

- [ ] **Step 1: Failing tests**

```python
def test_layer0_is_lean_and_orientation_first():
    body = _graph("/vault/.well-known/solid").serialize(format="turtle")
    assert "_profile=alt" not in body
    assert "viewAuthority" not in body  # folded into the instruction literal, not a PROF artifact pointer
    g = _graph("/vault/.well-known/solid")
    SH = Namespace("http://www.w3.org/ns/shacl#")
    instr = " ".join(str(o) for o in g.objects(None, SH.agentInstruction))
    for marker in ("index.md", "audit", "describedby", ".meta"):
        assert marker in instr, f"Layer-0 instruction must orient: missing {marker}"
    assert "registry" not in instr.lower(), "Layer-0 must NOT route through the An registries (delta 1)"


def test_place_event_organization_get_class_profiles():
    for slug, cls in [("places", "Place"), ("events", "Event"), ("organizations", "Organization")]:
        r = httpx.get(f"{POD}/vault/wiki/{slug}/", verify=_CA)
        # spot-check one member resource's Link rel=profile after Step 3 deploys; see step for exact assert
```

(Write the second test concretely after reading how the existing 5-class profile hints surface — mirror the existing passing test for concept/person profiles if one exists: `grep -rn "rel=\"profile\"" tests/ | head`.)

- [ ] **Step 2: Re-cut the JSON.** Concrete edits to `css/config/void-description.json`:
  (a) REWRITE the `sh:agentInstruction` literal (lines ~397–405) to the lean orientation text — merge the current 30-second-model content with the view-authority contract content (read the current sub:viewAuthority target's text first) into ONE literal, ordered: what this Pod is → route via each container's derived `index.md` → `.meta` via `describedby` is the governed graph → audit-before-trust + ground-unknown-terms (keep the existing E5/Cut-A disposition sentences VERBATIM — they are eval-validated) → write path: shapes teach via 422, two-stage commit. Do NOT mention the interop registries.
  (b) DELETE the `sub:viewAuthority` block (lines ~376–405's pointer half) — its content now lives in (a).
  (c) KEEP: capability catalog, shape catalog, context document, Type Index, agentGuide, PROF `prof:hasResource` descriptors, `sub:profileDocument`.
  (d) ADD nothing about the RegistrySet (delta 1).

- [ ] **Step 3: Extend `WIKI_CLASS_TO_PROFILE`** in `governedPredicates.ts` with the three missing entries mapping `wiki:`/`schema:` Place/Event/Organization classes to their existing profiles (`overlays/wiki-memory/profiles/{place,event,organization}.ttl` exist — verify with `ls overlays/wiki-memory/profiles/`; if a profile file is missing, create it by copying `person.ttl` and adjusting the class/shape/token). Mirror the 5 existing map entries' exact format. NOTE: this map feeds `dct:conformsTo` → the ProfileLinkMetadataWriter emits `Link: rel="profile"` — finish Step 1's second test now with the real assertion (HEAD a member of `/vault/wiki/places/` after reset; assert a `Link` header containing `rel="profile"` and the place profile IRI).

- [ ] **Step 4: Config guard + rebuild + reset + tests + audit; commit**

```bash
make test-js && make reset && SSL_CERT_FILE=$(mkcert -CAROOT)/rootCA.pem ~/uvws/.venv/bin/python -m pytest tests/test_sp2_surfacing.py tests/test_index_views.py -v && make audit
git add css/config/void-description.json css/extensions/markdown-projection/src/governedPredicates.ts tests/test_sp2_surfacing.py
git commit -m "[Agent: Claude] SP2-T8: lean Layer-0 (view-authority folded in; no registry routing) + full class-profile hints"
```

### Task 9: Decision-text reconciliation

**Files:** Modify `.claude/skills/decision-lookup/decisions.md`

- [ ] **Step 1:** Add status annotations: **D86** (PROF hints VALIDATED / selection half retired — cite H0 + the harmonization doc), **D80** (re-cut to served views, SP2-T6), **D113/D114** (`?_profile=alt` removed SP2-T7; view-authority folded into Layer-0 SP2-T8; fused remains the contract).
- [ ] **Step 2:** Add **D115 — SP2 consumable pod**: one entry recording: the surfaced An layer + st:Description audience extension (agent-facing); derived index views w/ provenance (fork a/d); Turtle-first write contract w/ **markdown lane = named follow-on gated on D82**; **prov:agent derivation = named follow-on gated on the security profile** (Chuck 2026-06-12); configured-client dropped w/ re-entry path. Cite the spec + harmonization doc.
- [ ] **Step 3: Commit** `git add .claude/skills/decision-lookup/decisions.md && git commit -m "[Agent: Claude] SP2-T9: decisions — D115 + D80/D86/D113 reconciliation"`

---

## PHASE D — Write contract, Turtle lanes

### Task 10: Write-context requirement on the RDF-native app shapes

Twin-probe findings applied: REQUIRE `mem:rationale` (agents fill required literals richly; they never volunteer); content-laden `sh:agentInstruction` ON THE SHAPE (the violation channel reaches nobody who conforms); keep anti-boilerplate shallow (minCount only). Lanes: contacts (`contact-card.shacl.ttl`) + id-schemes records (`scheme-record.shacl.ttl`). The curation ledgers already require it (D112). Seeds must conform — they get an honest bootstrap rationale (dog-foods the contract).

**Files:**
- Modify: `overlays/addressbook/shapes/contact-card.shacl.ttl`
- Modify: `overlays/identifier-schemes/shapes/scheme-record.shacl.ttl`
- Modify: seed data — every seeded `vcard:Individual` + scheme record (find them: `grep -rln "vcard:Individual" overlays/addressbook/ ; ls overlays/identifier-schemes/records/ 2>/dev/null || grep -rln "idot:" overlays/identifier-schemes/`)
- Create: `tests/test_write_contract_turtle.py`

- [ ] **Step 1: Failing live test**

```python
"""SP2 §6 write contract, Turtle lanes: rationale required, laden instruction, seeds conform."""
import httpx, pytest
from rdflib import Graph, Namespace
from tests.conftest import _pod_base, _pod_up, resolve_ca as _resolve_ca

_CA = _resolve_ca() or False
POD = _pod_base()
pytestmark = pytest.mark.skipif(not _pod_up(), reason="Pod not running")

BARE_CARD = """@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
<> a vcard:Individual ; vcard:fn "No Context" ;
   vcard:inAddressBook <https://pod.vardeman.me/vault/contacts/index.ttl#this> ;
   vcard:hasEmail <mailto:noctx@example.org> .
"""

def test_rationale_less_contact_422_with_laden_message():
    r = httpx.post(f"{POD}/vault/contacts/Person/", content=BARE_CARD,
                   headers={"Content-Type": "text/turtle", "Slug": "sp2-wc-probe"}, verify=_CA)
    assert r.status_code == 422, f"got {r.status_code}: {r.text[:200]}"
    assert "rationale" in r.text and "task" in r.text  # the laden sh:message rides the report

def test_contact_with_rationale_201():
    body = BARE_CARD.replace(
        "vcard:hasEmail <mailto:noctx@example.org> .",
        'vcard:hasEmail <mailto:noctx@example.org> ;\n   '
        '<https://pod.vardeman.me/vault/ontology/mem#rationale> '
        '"Test write: SP2 contract conformance check (test_write_contract_turtle)." .')
    r = httpx.post(f"{POD}/vault/contacts/Person/", content=body,
                   headers={"Content-Type": "text/turtle", "Slug": "sp2-wc-ok"}, verify=_CA)
    assert r.status_code == 201
    httpx.delete(f"{POD}/vault/contacts/Person/sp2-wc-ok", verify=_CA)

def test_seeds_conform():
    # every seeded contact + scheme record carries mem:rationale (reset-reproducible)
    MEM = Namespace("https://pod.vardeman.me/vault/ontology/mem#")
    for ctr in ("/vault/contacts/Person/", "/id/schemes/"):
        g = Graph()
        listing = httpx.get(f"{POD}{ctr}", headers={"Accept": "text/turtle"}, verify=_CA).text
        g.parse(data=listing, format="turtle", publicID=f"{POD}{ctr}")
        # spot-check at least one member resource
        # (full sweep: iterate ldp:contains, GET each, assert (None, MEM.rationale, None) in graph)
```

(Finish `test_seeds_conform` as a full `ldp:contains` sweep — same iteration idiom as `test_shape_catalog_members_all_parse` in Task 3.)

- [ ] **Step 2: Run to verify failure** (the 422 test fails — today the bare card is accepted with 201).

- [ ] **Step 3: Extend the two shapes.** Add to `<#ContactCardShape>` (or whatever the NodeShape in `contact-card.shacl.ttl` is named — open it) and to the scheme-record NodeShape:

```turtle
    # SP2 §6 agentic write contract (Turtle lane; twin-probe grounded):
    # REQUIRED — agents fill required literals richly and never volunteer optional
    # ones (e5b-write 2026-06-11; D112 35/35). Laden instruction lives HERE (the
    # shape is read pre-write; sh:message only fires on violation).
    sh:property [
        sh:path mem:rationale ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "mem:rationale is required — record the task that triggered this write, what you concluded, and why, including what you consulted. Do not merely restate the record's name; a future agent audits this context before trusting it." ;
    ] ;
```

Also append one sentence to each shape's node-level `sh:agentInstruction`: `"Every write carries mem:rationale: the task that triggered it, what was concluded, and why — your write-context is unrecoverable after this session."` Add the `mem:` prefix declaration if absent.

- [ ] **Step 4: Update the seeds.** Every seeded contact / scheme record gains:

```turtle
mem:rationale "Seeded by the substrate bootstrap (pod_setup, SP2 2026-06): reference data deployed by the Pod owner, not an agent-session write." ;
```

(Exact file list from Step 1's grep. The D111 bootstrapped `how-identifiers-work` memory is markdown — out of scope, Turtle-first.)

- [ ] **Step 5: `make reset` + full test run** — `tests/test_write_contract_turtle.py` PASS ×3; **the D111 e2e suite + addressbook e2e must stay green** (`~/uvws/.venv/bin/python -m pytest tests/test_id_schemes_integration.py tests/integration/test_addressbook_e2e.py -v`) — if their register/create paths now 422, update those tests' payloads to carry rationale (that IS the contract landing; annotate, don't weaken).

- [ ] **Step 6: Commit**

```bash
git add overlays/addressbook/ overlays/identifier-schemes/ tests/test_write_contract_turtle.py tests/test_id_schemes_integration.py tests/integration/test_addressbook_e2e.py
git commit -m "[Agent: Claude] SP2-T10: write contract on Turtle lanes — mem:rationale required, laden shape instruction, seeds dog-food"
```

### Task 11: D96 — `mem:hasOpenAction` onto `<#this>`

The E7 g-run3 miss: the governance signal sits on the `<>` page subject; agents scan the `<#this>` concept subject. Derive the back-pointer onto `<#this>` when the target's `.meta` declares `schema:mainEntity <#this>`; keep `<>` otherwise (RDF-native lanes have no `#this` convention).

**Files:**
- Modify: `css/extensions/ops-index/src/OperationsIndexListener.ts` (`setBackPointer`, ~lines 130–160)
- Create: `css/extensions/ops-index/test/subjectPlacement.test.ts`

- [ ] **Step 1: Failing unit test** (reuse the ops-index store stub):

```typescript
it("back-pointer lands on <#this> when .meta declares schema:mainEntity", async () => {
  // canned target .meta: <target> schema:mainEntity <target#this> .
  // after setBackPointer: quad(<target#this>, mem:hasOpenAction, <op>) present
});
it("back-pointer stays on <> when no mainEntity is declared", async () => {});
it("retraction removes whichever subject carries it", async () => {});
```

- [ ] **Step 2: Run to verify failure.** **Step 3: Implement** in `setBackPointer`: after reading `existingQuads`, look for a quad `(targetUrl, https://schema.org/mainEntity, ?o)`; if found, use `?o` as the back-pointer subject (`targetNode = namedNode(o.value)`); the removal filter must match BOTH possible subjects (idempotent across the change). **Step 4: Unit + the existing ops-index suite pass** (`cd css/extensions/ops-index && npx vitest run`).

- [ ] **Step 5: Rebuild, reset, live spot-check** (plant a wiki-lane proposal exactly as `evals/salience-e7/setup` does; assert the concept's `.meta` carries `<...#this> mem:hasOpenAction <op>`), **commit**

```bash
git add css/extensions/ops-index/
git commit -m "[Agent: Claude] SP2-T11: D96 — hasOpenAction derived onto <#this> via schema:mainEntity"
```

---

## PHASE E — Probes + the SP2 gate + bookkeeping

Each probe: copy the rig OUTSIDE the repo (`cp -R evals/<rig> ~/dev/probes/`), `make reset` between cells, raw-audit ALL trajectories (full CoT — the three-strikes rule in `cold_probe_harness_pattern.md`), report to `docs/plans/`, port any new rig back to `evals/`.

### Task 12: E7 re-run (D96 validation) + in-situ index probe with format A/B

- [ ] **Step 1: E7 re-run** — `evals/salience-e7`, grounding-only arm, n=3, unchanged prompts. Question: does g-run3's registration miss close now that `hasOpenAction` sits on `<#this>` (the subject a broader-scan visits)? Gate: ≥2/3 catch with at least one trajectory showing the `<#this>` sibling registered. Write `docs/plans/2026-06-12-sp2-e7-rerun-report.md` (or current date).
- [ ] **Step 2: In-situ index probe** — adapt `evals/idxview` to the REAL `/vault/wiki/concepts/` (no mock corpus): locate-among-N task, arm A = prompt forbids reading `index.md` (control), arm B = bare (index available), arm C = prefLabel-only index variant (temporarily swap the served index body via direct PUT for the arm, restore after) — the format A/B feed-in. n=2/arm. Metrics: resource fetches, wrong GETs, index-read+used, **derivation-provenance consulted?** (does any agent check the index `.meta` before trusting — spec §7's ~1/3 baseline). Report: `docs/plans/2026-06-12-sp2-index-insitu-report.md`. Port the adapted rig to `evals/idx-insitu/`.
- [ ] **Step 3: Commit reports + rigs.**

### Task 13: The SP2 gate — end-to-end contract walk

Cold agent + the SP1 `pod-navigate` skill on the SP2-materialized pod; ONE task spanning two apps across the layers (Ad→An→R): e.g. *"Find what this Pod's memory says about how identifiers are resolved, then look up the contact whose ORCID is <X> and record their name + the resolution procedure's source."* — forces: orient (Layer-0) → app discovery (st:Description: wiki = index-shaped → route via index.md; addressbook = operation-shaped → invoke the affordance) → ground + audit → answer.

- [ ] **Step 1: Build `evals/e2e-walk/`** on the skill-nav rig pattern (`evals/skill-nav/` has the skill-arm launcher — copy `run_skillnav.sh` + the skill-installation idiom verbatim; new prompt; grading criteria from spec §12's walk row: right store per sub-task, index routed (not enumerated), affordance invoked (not brute-forced), dispositions fired, answer correct).
- [ ] **Step 2: Pre-flight** (the E7 lesson): hand-verify each leg with curl + the CLI before burning agent runs.
- [ ] **Step 3: n=3 skill arm** (the bare arm is already known-bad from SP1 — run 1 bare control only). **Gate: 3/3 correct answers with the walk shape visible in the trajectories** (index-routed + affordance-executed + ≥1 disposition firing where applicable).
- [ ] **Step 4: Raw-audit ALL runs (full CoT), report** `docs/plans/2026-06-12-sp2-e2e-walk-report.md`, port rig, commit.

### Task 14: Bookkeeping + merge

- [ ] **Step 1:** FOLLOWUPS: new `▶▶ ACTIVE` status (SP2 SHIPPED + gate result); mark the 📐 strip-back/index items `[x]`; **named follow-ons recorded**: (a) markdown-lane write contract gated on D82, (b) `prov:agent` derivation gated on the security profile, (c) sibling-repo KNOWN-FAILURES un-pin (`shapes` ×2) on next touch, (d) optional de-confounded write-twin arm.
- [ ] **Step 2:** MEMORY.md anchor: SP2 shipped + gate verdict + next pointer (SP3 MCP stays LATER; next = whatever the gate report surfaces).
- [ ] **Step 3:** Spec §8 annotation (SP2 EXECUTED banner, like §10's SP1 banner).
- [ ] **Step 4:** Full suite: `make test && make test-js && make audit` — honestly green Pod-up; audit 0 ERROR.
- [ ] **Step 5:** Merge: `git checkout main && git merge --no-ff sp2-consumable-pod && git branch -d sp2-consumable-pod`. Push = Chuck's call.

---

## Self-review notes (done at plan time)

- Spec §8 SP2 bullet coverage: entry-point surfacing (T1), Ad+An materialization (T4–T6), D96 (T11), write-contract floor extension (T10; **NonRDFSource lane explicitly deferred to D82** per the Turtle-first fork — recorded T9/T14, not silently dropped), lean Layer-0 (T8), strip-back + D80 re-cut (T6–T8). §9 fold-ins: PROF hint quality (T8), interop surfacing fixes (T1–T2; the shapetrees namespace-drift annotation already exists in `ontology/shapetrees.ttl` — T9 cites it), provenance derivation (deferred, recorded). §12 probes (T12–T13).
- Known soft spots flagged for executors: T2 Step 5 and T5 Step 3/5 require mirroring existing manifest/listener idioms — the referenced files and grep commands are given; mirror exactly rather than inventing. T8's instruction-literal rewrite must preserve the eval-validated disposition sentences verbatim.
- `/id/` `dct:conformsTo`-for-`rel=profile` (D111 item 5) is NOT in this plan — small, unblocked, stays in FOLLOWUPS.
