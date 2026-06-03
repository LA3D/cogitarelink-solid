# Agentic-Code Fragility Audit — holistic sweep (2026-06-03)

**Trigger:** the D108 Front-2 pre-merge review found four instances of a pattern family in
*freshly-reviewed* code (hardcoded deployment IRIs in general code; path-string heuristics where CSS
APIs exist; duplicated constants without agreement tests; regex where the data model fits). Chuck's
hypothesis: upstream CSS is human-written against its own semantics, but everything in
`css/extensions/`, `scripts/`, and the overlay machinery is agent-written across ~15 sprints and
likely carries the same patterns repo-wide.

**Method:** four parallel read-only reviewers (one per slice: projection core; other CSS extensions;
shape-validator + configs + Docker; Python scripts + test conventions), each applying four lenses —
(1) hardcodes that should be dynamic, (2) bypassing the RDF model / platform APIs, (3) fragile
regex, (4) duplication without agreement tests + mock-masked tests — each required to cite the
specific idiom that should have been used and to report healthy patterns for calibration.

**Verdict: the hypothesis holds, with a sharp signature.** The fragility is *bimodal and stratified
by age*, not uniform:

- **Healthy:** wherever agent code had an N3 `Store`/`Parser`/`Writer` or rdflib `Graph` in hand, or
  closely mirrored an upstream-CSS idiom (MetadataWriters, Memento datetime, the runtime
  `replaceGoverned` write path, `pod_audit`'s walker, `TypeIndexLoader`, the mem-trigger detectors),
  it did the right thing. The newest code (yesterday's floor, written under per-task review) is the
  cleanest in the repo.
- **Fragile:** wherever agent code held a *string* — markdown text, slugs, CURIEs, container paths,
  config plumbing, cross-language mirrors — it stayed in string-land: regex, substring heuristics,
  f-string Turtle, and hand-maintained constant tables duplicated 2–5× with nothing asserting
  agreement.

---

## The five systemic patterns

### P1 — Architectural decisions stop at the component that was touched

D107 parameterized the storage root (`storagePath`) — but only in `markdown-projection`. The sweep
never reached the siblings:

- `wiki-search/src/uri.ts:1` — `const WIKI_PREFIX = "/vault/wiki/"` (gates the search affordance).
- `css/config/mem-trigger.json:17,28` — full literal IRIs `https://pod.vardeman.me/vault/wiki/.events/`
  and `…/settings/publicTypeIndex` while the same block injects `variable:baseUrl`.
- `css/config/solid-config.json:33` — render `podBase` is a literal, not `variable:baseUrl`.
- `pod.vardeman.me` embedded in ≥6 extension source files (`mem-trigger/types.ts`,
  `metadata-card/vocab.ts`, `JsonLdScriptInjector.ts`, `wiki-search/*`…).
- `markdown-projection` itself: `DEFAULT_WIKI_TYPE_INDEX` keys (`typeIndexLookup.ts:19-27`),
  `baseRoot()`'s literal `/wiki/` split (`wikilinkProjection.ts:175-178`), `couldBeL4Container`'s
  `includes("/wiki/")` — the parameterization stopped at the listener boundary.
- `pathConstraint.ts:100` — `/vault` in an agent-facing message inside a "dependency-free" module.

**Consequence:** the repo will break first on any host/storage-root change, in scattered silent ways.
**Countermeasure:** when a decision parameterizes something, grep-sweep the whole repo for the old
literal AND add a guard (the `layering.test.ts` banned-strings pattern, or `storageBase.test.ts`).

### P2 — Hand-mirrored constant tables without agreement tests (the dominant pattern, ~9 instances)

| Mirror | Files | Status |
|---|---|---|
| `CURIE_PREFIXES` ↔ served `context-fragment.jsonld` | `frontmatterProjection.ts:11-26` | **already diverged** (neither superset; `vann:`/`td:`/`sub:` missing TS-side → silent ungoverned resources) |
| `PAGE_PREDICATES` ↔ `PAGE_GOVERNED_PREDICATES` | `subjectFrame.ts:3` ↔ `governedPredicates.ts:35-53` | **already diverged**: `identifier` is page-frame in one, thing-governed in the other → projected subject vs governed-delete subject mismatch → stale/duplicate triples |
| `TYPE_MAP` ×3 | `frontmatterProjection.ts:49-66`, `scripts/lib/rdf_gen.py:10`, served context | three encodings of type→class, different coverage |
| slug TS ↔ Python | `resolver.ts:37-54` ↔ `rdf_gen.py:47-49` | comment stakes correctness on byte-identical behavior; already differs (`#heading`/`folder/` stripping) |
| `pathConstraints` + `tboxPaths` ×2 configs | `solid-config.json:98-130` ↔ `shape-validation/resource-store.json:30-62` | byte-identical today; one file self-describes as dead reference |
| mem-trigger namespace consts ×5 | `types.ts` exports unused; 4 detectors re-declare locally | 5 copies of the AS/PROV/XSD strings |
| `memento/src/uri.ts` ↔ `profile-link/src/uri.ts` | byte-identical duplicates | profile-link uses 1 of 6 functions |
| `JsonLdScriptInjector` `DEFAULT_CONTEXT` ↔ served `/vault/meta/context.jsonld` | `JsonLdScriptInjector.ts:21` | unguarded duplicate of the D79 canonical context |
| expected-count `7` ×3 | `pod_audit.py:323,388`, `gen_managers.py`, `backfill_conformsTo.py` | substrate growth ⇒ spurious audit ERROR |

Where agreement tests EXIST they work: `stampAgreement.test.ts`, `make check-validator-tbox`
(guards the validator `mem.ttl` copy — the slice-3 auditor missed this; it IS guarded),
`test_substrate_mirror_consistency.py` (weakness: its TS leg is regex-scraped),
`test_shape_vs_hint_table_agreement.py`. The pattern is *known* in this repo but applied to ~1/3 of
the mirrors. **Countermeasure:** an agreement-test sweep is the single highest-leverage structural
fix (see remediation R3).

### P3 — String/regex where the model or platform API was already in hand

- **Python f-string Turtle/SPARQL (injection class):** `overlay/common.py:388-403` `n3_patch_inserts`,
  `lib/ldp_client.py:13-24`, the conformsTo/mainEntity callers in `apply.py:82-105,274-275`,
  `backfill_conformsTo.py:57-62` (a *second* patch dialect: SPARQL-update), `gen_managers.py:32-38`
  (whose own header documents a prior bug from exactly this class). Note `apply.py` does the
  Graph→nt round-trip CORRECTLY for the structurally hard patches — the f-strings are the lone
  regression against the file's own standard.
- **TS Turtle by concatenation:** `wiki-search/ResponseBuilder.ts:27-83` (hand escaper +
  `;`-sentinel punctuation) — while `memento/timemap.ts` in the same repo is the exemplary N3
  `Writer` version.
- **String heuristics over platform APIs:** `ShapeValidationStore.checkPathConstraint:213`
  `.endsWith('.meta')` in a class that already injects `metadataStrategy` and uses
  `isAuxiliaryIdentifier` three methods away; `pathConstraint.ts:82` raw `startsWith` prefix
  matching; `AdmissionFloorStore.isPermissive` `/working/` substring (recorded in FOLLOWUPS;
  empirically redundant — the working shape already conforms trivially);
  `MementoHttpHandler.ts:61-63` query-substring sniffing while the same file imports the proper
  `URLSearchParams`-based parsers; `listener.ts:138-149` regex frontmatter-`type:` extraction while
  the pipeline it loads uses `YAML.parse` (dispatch and projection can disagree on the same body);
  `routingLoader.ts:11-32` hand-rolled JSON-LD CURIE expansion that silently drops object-form
  context terms (the form the served context uses for half its terms).
- **Lossy serialization:** `JsonLdScriptInjector.buildScriptTag` collapses NamedNode vs Literal —
  the injected JSON-LD cannot distinguish a relationship IRI from a string value.

### P4 — Tests that mock the load-bearing seam (the Floor-Bug-1 class)

- `wiki-search/walker.test.ts:42-48` — the **WAC permission gate** is tested only through a
  mock-shaped reader (`{read: boolean}`); the real CSS-v8 `IdentifierMap` +
  `urn:report:permissions:Read` branch — the code whose own comment says "a bug here is a data
  leak" — has zero coverage, and `handle()` orchestration is never exercised.
- `pathConstraintIntegration.test.ts:29-57,107-126` — stubs the `RepresentationConverter` (the exact
  seam class where Floor-Bug-1 lived) AND fabricates its own constraint prefixes (`/wiki/events/`)
  that don't match the deployed config (`/vault/wiki/events/`) — so nothing in the fast suite ties
  the shipped `pathConstraints` to any assertion.
- `MementoCommitListener.ts:47` discards `_metadata` → the tested `WebID:` commit trailer is
  permanently dead at runtime (tested branch, no runtime path — the inverse failure).
- Python tests: ~22 files copy-paste POD/TLS scaffolding (half ignore `POD_URL`), substring-assert
  RDF presence (`"pim:Storage" in r.text or "pim/space#Storage" in r.text`) where parsing is the
  correctness mechanism; `tests/pytest/conftest.py` fixtures are used by one file.

### P5 — Dual-view divergence (the project-specific severity amplifier)

For this substrate, "document view and graph view agree" is the core claim (Verborgh, D109). Three
findings break it structurally:

- **Identity split:** render mints `${base}/vault/resources/concepts/${slug}.md`
  (`resolver.ts:62-65` — stale PARA-era path, pre-D98!) while projection mints
  `${root}/wiki/${ctr}/${slug}.md` (`wikilinkProjection.ts:206-212`). The `<a href>` in the
  document view and the `.meta` edge in the graph view point at DIFFERENT resources. (Also explains
  the known `test_no_para_residue` 200.)
- **Authority inversion:** `typeIndexLoader.ts:46` merges `{ ...live, ...DEFAULT_WIKI_TYPE_INDEX }`
  — the hardcoded map OVERRIDES the live Type Index, so a deployer's actual `publicTypeIndex`
  registrations are silently overruled. Backwards.
- **Parse split:** render parses via remark/GFM AST (code, link destinations, HTML blocks,
  autolinks structurally inert); projection regex-parses the flat string with only
  `maskCodeSpans` (fenced+inline only). Indented code, link destinations, HTML blocks, autolinks
  silently PROJECT while rendering inert. This is the structural root of the known mask gaps.

---

## Prioritized remediation

### R1 — Correctness-now (silent wrongness on the live Pod today)

1. **Fix the render-path resolver** (`HardcodedResolver`, `resolver.ts:62-65`): delegate URL minting
   to the projection's Type-Index routing (single minter) so render href ≡ projected edge IRI; add
   the `resolve(t) == projected object IRI` test. Retires a pre-D98 path.
2. **Flip the Type-Index merge** (`typeIndexLoader.ts:46`) to `{ ...DEFAULT, ...live }` (live wins),
   or drop DEFAULT once live is authoritative; add a test that a live registration overrides.
3. **Fix `PAGE_PREDICATES`/`identifier` frame mismatch** (`subjectFrame.ts:3` ↔
   `governedPredicates.ts:53`): derive the frame partition from `PAGE_GOVERNED_PREDICATES` via the
   binding; agreement test.
4. **`JsonLdScriptInjector` IRI-vs-literal collapse:** branch on `termType` (`@id` wrapping for
   NamedNodes, `@value`/`@language` for literals).

### R2 — Security/test-integrity

5. **wiki-search WAC gate:** add walker tests using the REAL `IdentifierMap` permission shape +
   a `handle()`-level test (fake DataAccessor, real-shape PermissionReader, assert denied resources
   are excluded from results).
6. **De-mock `pathConstraintIntegration`:** drive ≥1 case through the real
   `RepresentationConverter`; parametrize the test's constraints from the actual
   `solid-config.json` (the `stampAgreement` pattern).
7. **Unify N3-patch construction in Python** on the Graph→nt path `apply.py` already uses for the
   hard cases; `n3_patch_inserts` accepts a Graph, never a raw string; retire
   `backfill_conformsTo`'s SPARQL dialect. (Injection class.)

### R3 — The agreement-test sweep (one focused sprint, highest structural leverage)

Copy the `stampAgreement.test.ts` / `check-validator-tbox` pattern to every mirror in the P2 table:
`CURIE_PREFIXES`↔served context (or better: load prefixes from the served context at startup, the
`loadRoutingMap` pattern); `TYPE_MAP`×3 (cross-language golden vectors); slug TS↔Python (golden
vectors); `pathConstraints`×2 (or delete the dead reference block); mem-trigger namespaces (import
from `types.ts`, delete dead exports); `memento`/`profile-link` `uri.ts` (extract `shared/uri-parsing/`
or trim profile-link to the 3 lines it uses); injector context ↔ served context; derive the
audit's expected-registration count from the deployed ShapeTree doc instead of `7`.

### R4 — The D107 completion sweep

Thread `storagePath`/`variable:baseUrl` through: `wiki-search` (`WIKI_PREFIX`), `mem-trigger.json`
(events container + Type-Index URIs — derive in the listener from baseUrl+storagePath), render
`podBase`, `DEFAULT_WIKI_TYPE_INDEX` keys, `baseRoot()`/`couldBeL4Container`. Add the
banned-literal guard per extension (the `layering.test.ts` pattern) so the sweep can't regress.

### R5 — Direction (not a sprint): unify projection parsing on the render AST

Extract `collectTypedNodes(tree)` from `remarkTypedWikilinks` and have
`extractWikilinks`/`parseSpanLiterals` walk remark+GFM `text` nodes instead of regex-over-string.
Eliminates the whole P5 parse-split class (indented code, link destinations, HTML blocks,
autolinks) and retires `maskCodeSpans`. Interim: a parity test feeding pathological bodies through
both paths.

### R6 — Hygiene batch (when touched)

`.endsWith('.meta')`→`metadataStrategy.isAuxiliaryIdentifier` (`ShapeValidationStore:213`);
Memento tombstone guard→reuse its own URL parsers; listener frontmatter regex→pipeline
`splitFrontmatter`; `routingLoader`→jsonld lib or N3; tbox load failure→fail loudly + post-boot
non-empty-closure assertion; `ResponseBuilder`→N3 Writer (template: `timemap.ts`); URL string
surgery→CSS `PathUtil`; conftest consolidation (one `pod_url`/`pod_client`/`requires_pod` fixture
set; migrate the 22 files); substring RDF asserts→parse-based; `MementoCommitListener` WebID
trailer→wire or delete; dead `buildTwoSubjectPatch`→delete or reimplement on N3 Writer.

---

## Calibration: what the agents got right (and the lesson)

`memento/timemap.ts`, `datetime.ts`, all three `MetadataWriter`s, the mem-trigger detectors,
`metadata-card/parse.ts`, `MetaWriter.replaceGoverned`, `TypeIndexLoader`, `pod_audit.py`'s walker,
`overlay/apply.py`'s structural patches, `parseSearchTerms` (a recursive-descent parser where the
grammar isn't regular!), and the entire 2026-06-03 floor are model-faithful. The signature is
consistent: **agents write semantically-correct code when an exemplar idiom is in view (upstream
CSS, an N3 Store in hand, a sibling file doing it right) and revert to string-land when inventing
at unfamiliar boundaries** (markdown↔RDF, config plumbing, cross-language mirrors). The
countermeasures that demonstrably work in this repo are: agreement tests, banned-literal guards,
de-mocked seams, and pointing the implementer at the in-repo exemplar — i.e., make the right idiom
the visible one.

Slice reports (full text) live in the four auditor transcripts; this doc is the canonical summary.
