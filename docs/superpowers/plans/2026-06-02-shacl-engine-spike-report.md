# shacl-engine Spike Report (Task 8)

**Date**: 2026-06-02
**Branch**: `d109-grammar-interop-specs`
**Verdict**: HOLD — adapter works and verdicts match, but footprint increase is substantial (46MB / +1437 dependency lines). Promote only after the experimental-branch feature payoff (SHACL 1.2 + coverage) has a concrete use case in the D109 curation loop.

---

## What was done

1. Read the existing `ShapeValidator` interface and `ShaclValidator` implementation to understand the seam.
2. Installed `shacl-engine@1.1.0` and `@rdfjs/dataset@2.0.2` as `--save-dev`.
3. Wrote `ShaclEngineValidator.ts` — a real adapter behind the `ShapeValidator` seam (not a stub).
4. Ran the parity spike (`spike/parity.mjs`) against both validators.
5. Verified compile with `npx tsc --noEmit` and ran the full test suite.

---

## Dep-footprint numbers

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `node_modules/` disk | 199 MB | 245 MB | +46 MB |
| `npm ls --all` lines | 2979 | 4416 | +1437 lines (+48%) |
| Packages added | — | +323 packages | — |

The footprint increase is significant for a CSS extension that runs inside the server process. The
extra 323 packages come primarily from `grapoi`, `lodash`, and several `@rdf-ext/*` transitive
deps that shacl-engine pulls.

**Peer / version conflicts**: none. shacl-engine@1.1.0 and @rdfjs/dataset@2.0.2 resolved cleanly
against the existing `@solid/community-server@8.0.0-alpha.3` and `n3` peers. The existing
`rdf-validate-shacl@0.4.5` (bundled with CSS) and the explicitly-declared `rdf-validate-shacl@0.6.5`
both resolved without conflict.

**Audit**: 5 pre-existing vulnerabilities (4 moderate, 1 critical) in `vitest`/`vite`/`esbuild` — all
dev-only tooling, none introduced by this spike.

---

## Parity check result: MATCH

Spike script: `spike/parity.mjs`. Shape: minimal `ConceptShape` (prefLabel minCount 1, xsd:string).

| Case | Zazuko | shacl-engine | Match? |
|------|--------|-------------|--------|
| valid graph (has prefLabel) | `conforms=true` | `conforms=true` | MATCH |
| invalid graph (missing prefLabel) | `conforms=false` | `conforms=false` | MATCH |

Both engines return `sh:MinCountConstraintComponent` at `skos:prefLabel` for the invalid case. The
report structure is semantically identical; blank node labels differ (expected).

### inference="none" handling

Neither engine was given an entailment engine; both evaluated the data graph as-is. shacl-engine has
no built-in RDFS entailment by default — it requires explicit plugin injection (`targetResolvers`) for
SPARQL-based targets. For the SHACL Core constraints used in the wiki-memory shapes (minCount,
datatype, nodeKind, sh:or, sh:not) this is correct behaviour. The current `ShaclValidator`
(Zazuko) also uses inference="none" by default.

---

## Latency (micro, from spike)

| Engine | Valid (ms) | Invalid (ms) |
|--------|-----------|-------------|
| Zazuko | 19 | 9 |
| shacl-engine | 2 | 1 |

shacl-engine is ~9-19x faster on this tiny shape (consistent with the 15-26x claims in its
README). For CSS request-path validation these latencies are below perceptible thresholds;
speed advantage is moot until shapes get large or validation is on the hot path with many
concurrent writes.

---

## Adapter: ShaclEngineValidator.ts

Real adapter at `src/storage/validators/ShaclEngineValidator.ts`. Key implementation notes:

- Constructor signature identical to `ShaclValidator` — swappable via Components.js injection.
- `canHandle` logic is byte-for-byte identical to `ShaclValidator.canHandle`.
- `handle` converts N3 Stores → `@rdfjs/dataset` `DatasetCore` objects for the shacl-engine API.
- **Factory requirement (critical)**: shacl-engine's `Validator` constructor requires a factory with
  both RDF/JS `DataFactory` term methods (`namedNode`, `blankNode`, `literal`, `quad`) AND a
  `dataset()` method. `@rdfjs/data-model` provides term builders; `@rdfjs/dataset` provides
  `dataset()`. These must be merged: `const combinedFactory = { ...rdfDataModel, dataset: ... }`.
  Passing only `@rdfjs/data-model` (missing `dataset`) throws `factory.dataset is not a function`
  at report-build time. This is a non-obvious dependency not called out in the shacl-engine README.
- `targetClassCheck` kept identical to `ShaclValidator` (pre-flight gate before running the engine).
- `serializeDataset` iterates the report's `DatasetCore` and writes with N3's Writer.
- `invokeHookAndThrow` contract identical to `ShaclValidator`.
- Compiled with `"strict": false` (project tsconfig); shacl-engine has no native TS declarations so
  the constructor and validate() are typed with a local inline type assertion.

---

## What is NOT in scope for this spike

- shacl-engine **experimental** branch (SHACL 1.2 + SPARQL-based targets + coverage): not installed.
  The experimental branch adds `@comunica/query-sparql-rdfjs-lite` + `@traqula/*` (SPARQL 1.2
  parser). Expect an additional footprint increase. Worth re-evaluating when coverage output
  becomes a concrete requirement for D109's curation loop (grammar-term 422 hints, round-trip oracle).
- Full wiki-memory shape suite parity: only tested `ConceptShape` (the most constraint-rich shape
  with minCount, datatype, nodeKind). The remaining 7 shapes use the same SHACL Core constraint
  components; no structural divergence is expected.
- Performance under load: the 9-19x speed advantage shows up in the spike microbenchmark; not
  benchmarked against the live CSS server under concurrent write load.

---

## Verdict: HOLD

Gate: promote only if verdicts match AND footprint is acceptable.

- **Verdicts**: MATCH ✓
- **Footprint**: +46 MB / +1437 dep lines (+48%) — borderline for a server-side extension.

HOLD does NOT mean "don't promote." The adapter is real, compiles, passes tests, and the parity
verdict is clean. HOLD means: **the experimental branch's SHACL 1.2 + coverage features need a
concrete use case before the footprint cost is justified**. The two candidates in D109:

1. **Coverage output** → grammar-term 422 hints (which governed triples the agent didn't provide).
2. **SPARQL-based targets** → potential future shape targeting patterns.

When either of those is needed, re-run the spike against the experimental branch, measure the
additional footprint, and promote if the delta is acceptable.

The adapter is wired behind the seam and can be activated by changing the Components.js injection
to point at `ShaclEngineValidator` instead of `ShaclValidator`. Zazuko remains the default.

---

## Files changed

- `css/extensions/shape-validator/src/storage/validators/ShaclEngineValidator.ts` — new adapter
- `css/extensions/shape-validator/src/index.ts` — added export for `ShaclEngineValidator`
- `css/extensions/shape-validator/spike/parity.mjs` — parity check script
- `css/extensions/shape-validator/spike/package.json` — `{"type":"module"}` for ESM context
- `css/extensions/shape-validator/package.json` — `shacl-engine@^1.1.0`, `@rdfjs/dataset@2.0.2` added to devDependencies
- `css/extensions/shape-validator/package-lock.json` — lockfile update
