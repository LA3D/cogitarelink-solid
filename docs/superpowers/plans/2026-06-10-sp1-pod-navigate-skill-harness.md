# SP1 — pod-navigate Skill + Tool Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SP1 of the agentic progressive-disclosure contract (spec `docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md`): one general disclosure-navigation skill carrying the proven disposition bundle (audit-before-trust E5 + ground-unknown-terms E7 + declare-write-context §6.1), the CLI tools it references (`solid-pod validate` pre-flight, fixed `invoke`, new `affordances`), and the cold-agent eval that gates it (skill-delivered disposition must reproduce the prompt-injected gold).

**Architecture:** The skill is the consume-side half of the contract — it installs dispositions that pod-delivered text cannot (the E5 bootstrap 0/3 consumption leak). It lives in `solid-agent-skills/skills/pod-navigate/` and deliberately BAKES IN the disposition content (deviating from D103's minimal-bootstrapper rule — the E5b/bootstrap experiments showed content must be content-laden and immediate, not a pointer). CLI work extends the existing `solid-pod` commander CLI. The eval reuses the de-confounded E5 trap rig with a NEUTRAL prompt (no disposition preamble) — the only variable is the installed skill.

**Tech Stack:** TypeScript (commander, N3, Comunica — existing CLI), `rdf-validate-shacl` + `rdf-ext` (new deps, validate command), Claude Code skills (SKILL.md frontmatter format), bash + `claude -p` headless + python3 audit (the proven `evals/` rig pattern).

**Repos touched:**
- `~/dev/git/LA3D/agents/solid-agent-skills` — CLI + skill. Work on branch `sp1-pod-navigate`. Git protocol per its CLAUDE.md (`[Agent: Claude]` prefix, specific files, never force push).
- `~/dev/git/LA3D/agents/cogitarelink-solid` — eval rig + report + bookkeeping. Commit to `main` (research apparatus goes straight to main per prior practice).

**Settled §10 forks (locked with Chuck 2026-06-10, this plan's session):**
- (a) View materialization (SP2, recorded for continuity): on-write listener-refreshed static `index.md` child with derivation provenance in its `.meta` — probe showed discovery is name+size-driven, conneg never reached.
- (b) ONE general navigation skill consuming `st:Description`; per-app thin skills only if the generalization probe demands.
- (c) Hand-written v0 skill seeded from the proven E5/E7/E5b content; GEPA/eval-loop optimization later. The eval harness built here IS the optimization substrate.
- (d) Definition-line index format default; prefLabel-only is a probe arm (SP2).

**Pre-flight for the implementing session:**
- Live Pod up: `cd ~/dev/git/LA3D/agents/cogitarelink-solid && make reset` (NOT `make up` — see docker-patterns.md). Verify `curl -sk https://pod.vardeman.me/vault/` returns 200.
- `solid-agent-skills` built: `cd ~/dev/git/LA3D/agents/solid-agent-skills && npm install && npm run build`.
- TLS: the CLI self-wires mkcert trust; for python/curl the rigs use `-k` or `$(mkcert -CAROOT)`.
- Read auto-memory `cold_probe_harness_pattern.md` before Task 7 (launch pitfalls).

---

## File structure

```
solid-agent-skills/
  src/lib/http.ts                       MODIFY — add discoverStorageDescription + listContainerResources
  src/commands/validate.ts              CREATE — SHACL pre-flight tool
  src/commands/invoke.ts                REWRITE — resource-scoped contract, 3 defects fixed
  src/commands/affordances.ts           CREATE — catalog lister
  src/cli.ts                            MODIFY — wire validate/affordances, re-document invoke
  src/types/shims.d.ts                  CREATE — ambient types for rdf-ext / rdf-validate-shacl
  tests/fixtures/shape-concept.ttl      CREATE
  tests/fixtures/data-conforming.ttl    CREATE
  tests/fixtures/data-violating.ttl     CREATE
  tests/fixtures/descriptor-sub.ttl     CREATE — post-D107 namespace descriptor fixture
  tests/fixtures/descriptor-wiki.ttl    CREATE — legacy namespace descriptor fixture
  tests/commands/validate.test.ts       CREATE
  tests/commands/invoke.test.ts         REWRITE — unit (podless) + live (gated)
  tests/commands/affordances.test.ts    CREATE
  skills/pod-navigate/SKILL.md          CREATE — the deliverable
  CLAUDE.md                             MODIFY — command table + skill list
  package.json                          MODIFY — deps

cogitarelink-solid/
  evals/skill-nav/run_skillnav.sh       CREATE
  evals/skill-nav/audit.py              CREATE
  evals/skill-nav/prompts/neutral.txt   CREATE
  evals/skill-nav/README.md             CREATE
  docs/plans/2026-06-XX-sp1-skill-nav-eval-report.md   CREATE (Task 8, after runs)
  docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md  MODIFY (§10 annotation, Task 9)
  FOLLOWUPS.md, .claude/memory/MEMORY.md                MODIFY (Task 9)
```

---

### Task 1: `solid-pod validate` — SHACL pre-flight tool

The §6.1 station-2 tool: validate RDF data against a shape BEFORE writing, locally. Scope note: this serves RDF payloads (Turtle bodies, proposals, `.meta` patches). Markdown bodies are validated by the Pod's floor (server-side projection + 422) — the skill teaches that split.

**Files:**
- Create: `src/commands/validate.ts`, `src/types/shims.d.ts`, `tests/fixtures/{shape-concept,data-conforming,data-violating}.ttl`, `tests/commands/validate.test.ts`
- Modify: `package.json`, `src/cli.ts`

- [ ] **Step 1: Add dependencies**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
git checkout -b sp1-pod-navigate
npm install rdf-validate-shacl@^0.6.0 rdf-ext@^2.5.0
```

- [ ] **Step 2: Create the ambient type shims**

Create `src/types/shims.d.ts` (rdf-ext / rdf-validate-shacl type coverage is unreliable across versions — own the surface we use):

```ts
declare module 'rdf-ext' {
  const factory: {
    dataset(quads?: Iterable<unknown>): unknown
    namedNode(value: string): unknown
    literal(value: string): unknown
  } & Record<string, unknown>
  export default factory
}

declare module 'rdf-validate-shacl' {
  interface Term { value: string }
  interface ValidationResult {
    focusNode: Term | null
    path: Term | null
    severity: Term | null
    sourceShape: Term | null
    message: Term[]
  }
  export default class SHACLValidator {
    constructor(shapes: unknown, options?: { factory?: unknown })
    validate(data: unknown): { conforms: boolean; results: ValidationResult[] }
  }
}
```

- [ ] **Step 3: Create test fixtures**

`tests/fixtures/shape-concept.ttl`:

```ttl
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix ex:   <http://example.org/shapes#> .

ex:ConceptShape a sh:NodeShape ;
    sh:targetClass skos:Concept ;
    sh:property [
        sh:path skos:prefLabel ;
        sh:minCount 1 ;
        sh:message "A concept requires skos:prefLabel. Author it inline as [text]{.prefLabel}." ;
    ] .
```

`tests/fixtures/data-conforming.ttl`:

```ttl
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
<http://example.org/c1> a skos:Concept ; skos:prefLabel "Spreading Activation" .
```

`tests/fixtures/data-violating.ttl`:

```ttl
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
<http://example.org/c2> a skos:Concept .
```

- [ ] **Step 4: Write the failing test**

`tests/commands/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'

const run = (args: string) => {
  try {
    return { out: execSync(`npx tsx src/cli.ts ${args}`, { encoding: 'utf8', timeout: 30_000 }), code: 0 }
  } catch (e) {
    const err = e as { stdout?: string; status?: number }
    return { out: err.stdout ?? '', code: err.status ?? 1 }
  }
}

describe('solid-pod validate', () => {
  it('reports conforms=true for conforming data, exit 0', () => {
    const { out, code } = run('validate tests/fixtures/data-conforming.ttl --shape tests/fixtures/shape-concept.ttl')
    const r = JSON.parse(out)
    expect(r.conforms).toBe(true)
    expect(code).toBe(0)
  })

  it('reports the violation with focusNode, path, and message, exit 1', () => {
    const { out, code } = run('validate tests/fixtures/data-violating.ttl --shape tests/fixtures/shape-concept.ttl')
    const r = JSON.parse(out)
    expect(r.conforms).toBe(false)
    expect(code).toBe(1)
    expect(r.results.length).toBeGreaterThan(0)
    expect(r.results[0].focusNode).toBe('http://example.org/c2')
    expect(r.results[0].path).toBe('http://www.w3.org/2004/02/skos/core#prefLabel')
    expect(r.results[0].message[0]).toContain('prefLabel')
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run tests/commands/validate.test.ts`
Expected: FAIL — `unknown command 'validate'`

- [ ] **Step 6: Implement `src/commands/validate.ts`**

```ts
import { readFileSync } from 'node:fs'
import N3 from 'n3'
import factory from 'rdf-ext'
import SHACLValidator from 'rdf-validate-shacl'
import { fetchResource } from '../lib/http.js'
import { output } from '../lib/jsonld.js'

export interface ValidateOptions { shape: string }

async function loadDataset(src: string): Promise<unknown> {
  const isUrl = src.startsWith('http://') || src.startsWith('https://')
  let body: string
  if (isUrl) {
    const res = await fetchResource(src, 'text/turtle')
    if (res.status !== 200) throw new Error(`GET ${src} returned HTTP ${res.status}`)
    body = res.body
  } else {
    body = readFileSync(src, 'utf8')
  }
  const quads = new N3.Parser({ baseIRI: isUrl ? src : `file://${src}` }).parse(body)
  return factory.dataset(quads)
}

/**
 * SHACL pre-flight (spec §6.1 station 2): validate RDF data against a shape
 * BEFORE writing it to the Pod. Same validator family as the Pod's admission
 * floor (rdf-validate-shacl), so a local pass predicts a floor pass. Data and
 * shape each accept a URL or a local file path.
 */
export async function validate(dataSrc: string, options: ValidateOptions): Promise<void> {
  try {
    const [data, shapes] = await Promise.all([loadDataset(dataSrc), loadDataset(options.shape)])
    const validator = new SHACLValidator(shapes, { factory })
    const report = validator.validate(data)
    output({
      conforms: report.conforms,
      data: dataSrc,
      shape: options.shape,
      results: report.results.map(r => ({
        focusNode: r.focusNode?.value ?? null,
        path: r.path?.value ?? null,
        severity: r.severity?.value ?? null,
        sourceShape: r.sourceShape?.value ?? null,
        message: r.message.map(m => m.value),
      })),
    })
    if (!report.conforms) process.exitCode = 1
  } catch (err) {
    output({ error: `Validation failed: ${(err as Error).message}`, data: dataSrc, shape: options.shape })
    process.exitCode = 1
  }
}
```

- [ ] **Step 7: Wire into `src/cli.ts`**

Add the import next to the other command imports, and the command registration next to the others (match the existing style in the file):

```ts
import { validate, ValidateOptions } from './commands/validate.js'
```

```ts
program
  .command('validate <data>')
  .description('SHACL pre-flight: validate RDF data (URL or file) against a shape (URL or file) before writing')
  .requiredOption('--shape <shape>', 'SHACL shape document (URL or file)')
  .action((data: string, opts: ValidateOptions) => validate(data, opts))
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run tests/commands/validate.test.ts`
Expected: 2 passed. If tsc/tsx errors on rdf-ext or rdf-validate-shacl typings, check `src/types/shims.d.ts` is inside `tsconfig.json`'s include set (it is if `include` covers `src`).

- [ ] **Step 9: Build + commit**

```bash
npm run build
git add package.json package-lock.json src/commands/validate.ts src/types/shims.d.ts src/cli.ts tests/commands/validate.test.ts tests/fixtures/shape-concept.ttl tests/fixtures/data-conforming.ttl tests/fixtures/data-violating.ttl
git commit -m "[Agent: Claude] feat: solid-pod validate — SHACL pre-flight tool (SP1 §6.1 station 2)

Validates RDF data (URL or file) against a shape (URL or file) with
rdf-validate-shacl — the same validator family as the Pod's admission floor,
so a local pass predicts a floor pass. JSON report: conforms + per-result
focusNode/path/severity/message/sourceShape. Exit 1 on non-conforming.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Fix `solid-pod invoke` — resource-scoped affordances (3 defects)

The FOLLOWUPS-held bug, folded in because SP1 touches the CLI and the audit disposition's key move (check operation history → `memory-history` affordance) rides on it. Defects: (1) arg 1 treated as Pod root, agents pass the resource URL; (2) only `wiki:` namespace matched, post-D107 descriptors use `sub:`; (3) no `%RESOURCE%` substitution.

**Files:**
- Modify: `src/lib/http.ts`, `src/commands/invoke.ts`, `src/cli.ts`
- Create: `tests/fixtures/descriptor-sub.ttl`, `tests/fixtures/descriptor-wiki.ttl`
- Rewrite: `tests/commands/invoke.test.ts`

- [ ] **Step 1: Add discovery helpers to `src/lib/http.ts`**

Append to the file (uses the module's existing `safeFetch`, `parseLinkHeaders`, `fetchResource`):

```ts
const STORAGE_DESC_REL = 'http://www.w3.org/ns/solid/terms#storageDescription'

/** Follow the spec-mandated storageDescription Link rel from any resource (D44). */
export async function discoverStorageDescription(resourceUrl: string): Promise<string | null> {
  const res = await safeFetch(resourceUrl, { method: 'HEAD' })
  const links = parseLinkHeaders(res.headers.get('link'))
  const sd = links[STORAGE_DESC_REL]
  return typeof sd === 'string' ? sd : null
}

/** List a container's non-container members (RDF docs usable as direct Comunica sources). */
export async function listContainerResources(containerUrl: string): Promise<string[]> {
  const url = containerUrl.endsWith('/') ? containerUrl : containerUrl + '/'
  const res = await fetchResource(url, 'text/turtle')
  if (res.status !== 200) return []
  const N3 = (await import('n3')).default
  const quads = new N3.Parser({ baseIRI: url }).parse(res.body)
  const ldpContains = 'http://www.w3.org/ns/ldp#contains'
  return quads
    .filter(q => q.predicate.value === ldpContains)
    .map(q => q.object.value)
    .filter(u => !u.endsWith('/'))
}
```

- [ ] **Step 2: Create descriptor fixtures**

`tests/fixtures/descriptor-sub.ttl` (post-D107 namespace + `%RESOURCE%`, modeled on the live `memory-history.ttl`):

```ttl
@prefix sub:  <https://pod.vardeman.me/vault/ontology/substrate#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<> a sub:QueryAffordance ;
    rdfs:label "Memory history" ;
    sub:selectQuery """
        PREFIX as: <https://www.w3.org/ns/activitystreams#>
        SELECT ?op ?action ?published WHERE {
            ?op as:object <%RESOURCE%> ; a ?action ; as:published ?published .
        } ORDER BY DESC(?published)
    """ .
```

`tests/fixtures/descriptor-wiki.ttl` (legacy namespace, no substitution token):

```ttl
@prefix wiki: <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<> a wiki:QueryAffordance ;
    rdfs:label "Hub view" ;
    wiki:constructQuery """
        CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1
    """ .
```

- [ ] **Step 3: Write the failing unit tests**

Rewrite `tests/commands/invoke.test.ts`. Keep any existing live tests you can adapt; the new file is:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import N3 from 'n3'
import { execSync } from 'child_process'
import { extractAffordanceQuery, substituteResource } from '../../src/commands/invoke.js'

const parse = (path: string) =>
  new N3.Parser({ baseIRI: 'https://pod.example/meta/affordances/x.ttl' }).parse(readFileSync(path, 'utf8'))

describe('invoke helpers (podless)', () => {
  it('extracts sub:selectQuery (post-D107 namespace)', () => {
    const q = extractAffordanceQuery(parse('tests/fixtures/descriptor-sub.ttl'))
    expect(q?.kind).toBe('select')
    expect(q?.query).toContain('as:object')
  })

  it('extracts wiki:constructQuery (legacy namespace)', () => {
    const q = extractAffordanceQuery(parse('tests/fixtures/descriptor-wiki.ttl'))
    expect(q?.kind).toBe('construct')
  })

  it('substitutes every %RESOURCE% occurrence', () => {
    const out = substituteResource('SELECT * WHERE { ?op <urn:p> <%RESOURCE%> . <%RESOURCE%> ?p ?o }',
      'https://pod.example/vault/wiki/concepts/a.md')
    expect(out).not.toContain('%RESOURCE%')
    expect(out.match(/concepts\/a\.md/g)?.length).toBe(2)
  })
})

const POD = process.env.SOLID_POD_URL || 'https://pod.vardeman.me/vault/'
const podAvailable = await fetch(POD).then(() => true).catch(() => false)

describe.skipIf(!podAvailable)('solid-pod invoke (live)', { timeout: 60_000 }, () => {
  it('invokes memory-history against a RESOURCE url (the post-D107 contract)', () => {
    const url = `${POD}wiki/concepts/photosynthesis.md`
    const out = execSync(`npx tsx src/cli.ts invoke ${url} memory-history`,
      { encoding: 'utf8', timeout: 55_000 })
    const r = JSON.parse(out)
    expect(r.error).toBeUndefined()
    expect(r.query).not.toContain('%RESOURCE%')
    expect(r.query).toContain(url)
    expect(Array.isArray(r.results)).toBe(true)
  })

  it('404 on a bad affordance name lists available names', () => {
    const url = `${POD}wiki/concepts/photosynthesis.md`
    try {
      execSync(`npx tsx src/cli.ts invoke ${url} operation-history`, { encoding: 'utf8', timeout: 55_000 })
      expect.unreachable('should have exited 1')
    } catch (e) {
      const r = JSON.parse((e as { stdout: string }).stdout)
      expect(r.error).toContain('not found')
      expect(r.available).toContain('memory-history')
    }
  })
})
```

- [ ] **Step 4: Run tests to verify the unit tests fail**

Run: `npx vitest run tests/commands/invoke.test.ts`
Expected: FAIL — `extractAffordanceQuery` is not exported.

- [ ] **Step 5: Rewrite `src/commands/invoke.ts`**

Full replacement:

```ts
import N3 from 'n3'
import { fetchResource, discoverMetaSources, discoverStorageDescription, listContainerResources } from '../lib/http.js'
import { querySparql, queryQuads } from '../lib/comunica.js'
import { output } from '../lib/jsonld.js'

export interface InvokeOptions {
  pod?: string
  source?: string[]
  defaultGraphUri?: string[]
  acceptDatetime?: string
}

// Match descriptor predicates by localName: post-D107 descriptors use sub:,
// pre-D107 ones wiki: — both namespaces end #selectQuery / #constructQuery.
// localName matching fixes the namespace-drift defect class for good.
const byLocalName = (quads: N3.Quad[], local: string) =>
  quads.find(q => q.predicate.value.endsWith('#' + local))

export function extractAffordanceQuery(quads: N3.Quad[]): { query: string; kind: 'construct' | 'select' } | null {
  const c = byLocalName(quads, 'constructQuery')
  if (c) return { query: c.object.value, kind: 'construct' }
  const s = byLocalName(quads, 'selectQuery')
  if (s) return { query: s.object.value, kind: 'select' }
  return null
}

export function substituteResource(query: string, resourceUrl: string): string {
  return query.replaceAll('%RESOURCE%', resourceUrl)
}

/** Resolve the affordance catalog from a RESOURCE url via its storage description (D44/D52). */
export async function discoverAffordanceCatalog(resourceUrl: string, pod?: string): Promise<string | null> {
  if (pod) {
    const root = pod.endsWith('/') ? pod : pod + '/'
    return `${root}meta/affordances/`
  }
  const sdUrl = await discoverStorageDescription(resourceUrl)
  if (!sdUrl) return null
  const sd = await fetchResource(sdUrl, 'text/turtle')
  if (sd.status !== 200) return null
  const quads = new N3.Parser({ baseIRI: sdUrl }).parse(sd.body)
  const cat = byLocalName(quads, 'affordanceCatalog')
  return cat ? cat.object.value : null
}

export async function listAffordanceNames(catalogUrl: string): Promise<string[]> {
  const members = await listContainerResources(catalogUrl)
  return members.map(u => u.split('/').pop()!.replace(/\.ttl$/, ''))
}

/**
 * Invoke a resource-scoped affordance: arg 1 is the RESOURCE the affordance
 * operates on (same contract as `read`/`sparql`), not the Pod root. The
 * catalog is discovered from the resource's storageDescription Link header
 * (or --pod). The descriptor's query has %RESOURCE% substituted with the
 * resource IRI before execution (D52 Tier-2).
 */
export async function invoke(
  resourceUrl: string,
  affordanceName: string,
  options: InvokeOptions = {},
): Promise<void> {
  try {
    const catalog = await discoverAffordanceCatalog(resourceUrl, options.pod)
    if (!catalog) {
      output({ error: `No affordance catalog discoverable from ${resourceUrl} (no storageDescription Link; try --pod <root>)` })
      process.exitCode = 1
      return
    }
    const descriptorUrl = `${catalog}${affordanceName}.ttl`
    const res = await fetchResource(descriptorUrl, 'text/turtle')
    if (res.status !== 200) {
      output({
        error: `Affordance ${affordanceName} not found at ${descriptorUrl}: HTTP ${res.status}`,
        available: await listAffordanceNames(catalog),
      })
      process.exitCode = 1
      return
    }

    const quads = new N3.Parser({ baseIRI: descriptorUrl }).parse(res.body)
    const extracted = extractAffordanceQuery(quads)
    if (!extracted) {
      output({ error: `Affordance ${affordanceName} has no selectQuery or constructQuery`, descriptorUrl })
      process.exitCode = 1
      return
    }
    const query = substituteResource(extracted.query, resourceUrl)

    let sources: string[]
    let metaCount = 0
    if (options.source && options.source.length > 0) {
      sources = options.source
    } else {
      // Default source set for resource-scoped affordances: the resource's own
      // .meta + its container's sidecars (RQ-Pod-4 explicit-source workaround)
      // + the operations ledger members (where as:object announcements live).
      const root = catalog.replace(/meta\/affordances\/$/, '')
      const container = resourceUrl.slice(0, resourceUrl.lastIndexOf('/') + 1)
      const metaSources = await discoverMetaSources(container).catch(() => [])
      const opsSources = await listContainerResources(`${root}wiki/.operations/`).catch(() => [])
      sources = [resourceUrl + '.meta', ...metaSources, ...opsSources]
      metaCount = metaSources.length
    }

    const sparqlOpts = { defaultGraphUris: options.defaultGraphUri, acceptDatetime: options.acceptDatetime }
    const results = extracted.kind === 'construct'
      ? await queryQuads(query, sources, sparqlOpts)
      : await querySparql(query, sources, sparqlOpts)

    output({
      affordance: affordanceName,
      resource: resourceUrl,
      descriptorUrl,
      queryKind: extracted.kind,
      query,
      sources,
      metaSources: metaCount,
      results,
    })
  } catch (err) {
    output({ error: `Affordance invocation failed: ${(err as Error).message}`, affordance: affordanceName })
    process.exitCode = 1
  }
}
```

- [ ] **Step 6: Update the CLI registration in `src/cli.ts`**

Find the existing `invoke` command block (line ~47) and replace its description/signature:

```ts
program
  .command('invoke <resource-url> <affordance>')
  .description('Invoke a resource-scoped affordance: catalog discovered via the resource\'s storageDescription; %RESOURCE% substituted')
  .option('--pod <url>', 'Pod root override (skips storage-description discovery)')
  .option('--source <url...>', 'explicit Comunica sources (overrides default discovery)')
  .option('--default-graph-uri <url...>', 'RQ-Pod-4 explicit default-graph sources')
  .option('--accept-datetime <dt>', 'Memento time-travel')
  .action((url: string, affordance: string, opts: InvokeOptions) => invoke(url, affordance, opts))
```

(Keep whatever option names the current block already uses for source/default-graph-uri/accept-datetime — match them exactly so other docs stay true.)

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/commands/invoke.test.ts`
Expected: 3 unit tests PASS podless. With the Pod up (and `SOLID_POD_URL=https://pod.vardeman.me/vault/` exported): live tests PASS — memory-history returns substituted query + results array; bad name returns `available` including `memory-history`.

- [ ] **Step 8: Build + commit**

```bash
npm run build
git add src/lib/http.ts src/commands/invoke.ts src/cli.ts tests/commands/invoke.test.ts tests/fixtures/descriptor-sub.ttl tests/fixtures/descriptor-wiki.ttl
git commit -m "[Agent: Claude] fix: invoke — resource-scoped contract, namespace-agnostic, %RESOURCE% substitution

Fixes the three E8-surfaced defects (FOLLOWUPS 2026-06-09): arg 1 is now the
RESOURCE url (catalog discovered via its storageDescription Link, or --pod);
descriptor predicates matched by localName so sub: and wiki: both work;
%RESOURCE% substituted before execution. Default sources = resource .meta +
container sidecars + .operations ledger members. 404 lists available names.
Restores D52 Tier-2 for resource-scoped affordances (memory-history).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: `solid-pod affordances` — catalog lister

The discoverability fix (agents guessed `operation-history`; real name `memory-history`).

**Files:**
- Create: `src/commands/affordances.ts`, `tests/commands/affordances.test.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Write the failing test**

`tests/commands/affordances.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'

const POD = process.env.SOLID_POD_URL || 'https://pod.vardeman.me/vault/'
const podAvailable = await fetch(POD).then(() => true).catch(() => false)

describe.skipIf(!podAvailable)('solid-pod affordances', { timeout: 60_000 }, () => {
  it('lists the catalog from any resource URL', () => {
    const out = execSync(`npx tsx src/cli.ts affordances ${POD}wiki/concepts/photosynthesis.md`,
      { encoding: 'utf8', timeout: 55_000 })
    const r = JSON.parse(out)
    expect(r.catalog).toContain('/meta/affordances/')
    expect(r.affordances).toContain('memory-history')
    expect(r.usage).toContain('invoke')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/commands/affordances.test.ts`
Expected: FAIL — `unknown command 'affordances'` (skipped if Pod down — bring it up for this task).

- [ ] **Step 3: Implement `src/commands/affordances.ts`**

```ts
import { output } from '../lib/jsonld.js'
import { discoverAffordanceCatalog, listAffordanceNames } from './invoke.js'

export interface AffordancesOptions { pod?: string }

/** List the Pod's affordance catalog by name, discoverable from any resource URL. */
export async function affordances(url: string, options: AffordancesOptions = {}): Promise<void> {
  try {
    const catalog = await discoverAffordanceCatalog(url, options.pod)
    if (!catalog) {
      output({ error: `No affordance catalog discoverable from ${url} (try --pod <root>)` })
      process.exitCode = 1
      return
    }
    output({
      catalog,
      affordances: await listAffordanceNames(catalog),
      usage: 'solid-pod invoke <resource-url> <affordance-name>',
    })
  } catch (err) {
    output({ error: `Affordance listing failed: ${(err as Error).message}` })
    process.exitCode = 1
  }
}
```

- [ ] **Step 4: Wire into `src/cli.ts`**

```ts
import { affordances, AffordancesOptions } from './commands/affordances.js'
```

```ts
program
  .command('affordances <url>')
  .description('List the Pod\'s affordance catalog (names usable with invoke), discovered from any resource URL')
  .option('--pod <url>', 'Pod root override')
  .action((url: string, opts: AffordancesOptions) => affordances(url, opts))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/commands/affordances.test.ts`
Expected: PASS (Pod up).

- [ ] **Step 6: Run the whole suite, build, commit**

```bash
npx vitest run
npm run build
git add src/commands/affordances.ts src/cli.ts tests/commands/affordances.test.ts
git commit -m "[Agent: Claude] feat: solid-pod affordances — catalog lister (name discoverability)

Agents guessed affordance names (operation-history vs memory-history, d112/E8).
Lists the catalog by name from any resource URL via storageDescription discovery.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: The `pod-navigate` skill

The SP1 deliverable. Design constraints, all experiment-derived: dispositions BAKED IN and content-laden (E5b L4 threshold — name the failure mode; pointers leak, 1/3); tool-tiered (curl floor must work — the gold runs were curl-only); the discipline is the recursive contract walk; description must trigger on memory-question tasks (the eval measures this).

**Files:**
- Create: `skills/pod-navigate/SKILL.md`

- [ ] **Step 1: Create `skills/pod-navigate/SKILL.md`**

Exact content (the disposition blocks are the proven E5/E7 texts, generalized only where they referenced the single task):

````markdown
---
name: pod-navigate
description: Navigate, query, and write a Solid Pod used as agentic memory — and judge what you read there before trusting it. Use this skill whenever a task involves answering a question from a Solid Pod's contents, reading a resource and its metadata, deciding whether a stored value is current, or creating/updating resources on a Pod. Triggers on any URL like https://.../vault/..., mentions of a "memory pod", Solid Pod, .meta sidecars, or questions of the form "what does the Pod say about X" / "what is X filed under" / "store this in memory".
---

# Pod Navigation — read, judge, ground, write

A Solid Pod hosting agentic memory describes itself over HTTP. This skill is the
discipline for using one: **orient → drill → ground → audit** — the same move at
every layer, from the Pod root down to a single value. Follow it even when the
answer looks obvious after one fetch; the failure modes below are real and were
measured.

## The two failure modes you must avoid

1. **Confirm-mode over-trust.** Agents find the value the question names, confirm
   it, and stop — while a sibling triple in the SAME metadata says the value is
   contested or superseded. Audited agents catch this; confirming agents miss it
   4:1.
2. **Unknown-term skipping.** Agents treat Pod-minted terms they don't recognize
   as noise and answer from the standard vocabulary alone. The unknown term is
   often exactly the governance signal.

## Disposition 1 — audit before trust

The surface value of a fact in this memory may be out of date. A fact can be
under active revision, or marked as superseded or replaced, by
governance/provenance information attached to the resource. Before you report
any value as authoritative, do NOT simply confirm the first value you find —
actively check the resource's full metadata (its `.meta`, reached via the
`describedby` Link header) and any linked governance, revision, or operation
records for signals that the value is contested, stale, or has been replaced,
and reflect that in your answer. Distinguish **applied** from **proposed**:
an operation with `schema:actionStatus schema:PotentialActionStatus` is a
pending proposal, not an applied correction — report the contestation either
way, and say which it is.

## Disposition 2 — ground unknown terms

This memory describes itself using RDF. Besides the standard vocabularies you
already know (SKOS, Dublin Core, schema.org, PROV, and the like), a resource's
metadata will carry application-specific terms minted by the Pod that you have
NO prior knowledge of — their meaning is defined by the Pod, not by anything in
your training. Do not treat such a term as noise to skip over, and do not guess
its meaning from how its name reads. Before you settle on an answer from a
resource's metadata, identify every term in that metadata that you do not
already recognize — on ANY subject in that metadata, not just the triple that
answers the question — and dereference it (GET its IRI with an RDF Accept
header) to read its own definition (rdfs:comment / skos:definition /
sh:agentInstruction). Only once you understand what each term asserts should
you decide whether it bears on your answer.

## Disposition 3 — declare your write context

When you WRITE to the Pod, you are the only holder of the write-context, and it
is unrecoverable after this session: nobody can later reconstruct why you made
a resource. Before any write, record in the resource's metadata (or body, per
the Pod's authoring grammar): the task that triggered the write, what you
concluded, and why. Do not write a rationale that merely restates the title —
a future agent will audit this context before trusting the resource.

- For **RDF payloads** (Turtle bodies, proposals, `.meta` patches): pre-flight
  locally before writing — `solid-pod validate <data.ttl> --shape <shape-url>`
  (shapes are listed in the Pod's shape catalog). Fix violations, then write.
- For **markdown content**: the Pod validates server-side on write. A `422`
  response carries a ValidationReport with instructions — read it, correct,
  and retry. It is the Pod teaching you its write contract, not a dead end.
- Prefer the Pod's two-stage flow when present: draft into the `working/`
  container (low ceremony), then crystallize to the durable container.

## The walk (recursive: Pod → app → container → resource → value)

1. **Orient.** From ANY resource URL, the `Link` header carries
   `rel="http://www.w3.org/ns/solid/terms#storageDescription"` — GET it. It
   points to the Pod's agent guide (READ IT FIRST when the task is non-trivial),
   JSON-LD context, shape catalog, affordance catalog, and Type Index. Treat URL
   path segments as opaque identifiers; meaning lives in the RDF, not the words
   in the path.
2. **Drill.** Containers list members (`ldp:contains`). Look for an index or
   overview resource (often named `index.md`, conspicuously larger than its
   siblings) and route through it instead of brute-forcing members. The Type
   Index routes class → container. Where the Pod declares applications
   (`interop:Application`, ShapeTree descriptions), read the app's declared
   description to learn ITS access pattern before walking its data.
3. **Ground** (Disposition 2) every unfamiliar term before relying on the data
   around it.
4. **Audit** (Disposition 1) before reporting any value as authoritative.
   To reconstruct how a resource came to be:
   `solid-pod invoke <resource-url> memory-history` (operation announcements,
   newest first) — or follow the resource's `mem:hasOpenAction` /
   `prov:wasGeneratedBy` pointers by hand, and its Memento TimeMap
   (`<resource>?ext=timemap`) for byte-level history.

## Tools, by tier (lower tiers always work)

| Tier | When | How |
|---|---|---|
| HTTP floor | always | `curl` + Accept headers; `.meta` via the `describedby` Link; this whole skill is executable with curl alone |
| `solid-pod` CLI | available in this repo's environment | `read <url>` (FUSED body+metadata in one call — prefer it), `sparql <url> "<query>"` (embedded Comunica; container `.meta` auto-discovery), `affordances <url>` (list what the Pod offers), `invoke <resource-url> <name>`, `validate <data> --shape <url>`, `wiki-search <container> <terms>` |

Report what you learned FROM THE POD separately from what you knew from
training, and say which resource each claim came from.
````

- [ ] **Step 2: Verify the skill loads structurally**

Run: `head -5 skills/pod-navigate/SKILL.md` — frontmatter opens with `---` and has `name:` + `description:` (matching the repo's other skills, e.g. `skills/pod-discover/SKILL.md`).

Then verify against this checklist (read the file back):
- Disposition 1 text contains "do NOT simply confirm the first value you find" (E5 gold phrase)
- Disposition 2 text contains "dereference it" and "Only once you understand what each term asserts" (E7 gold phrases)
- Disposition 3 names the failure mode ("merely restates the title") — E5b L4 requirement
- No pointer-only delegation of disposition content (the bootstrap-test leak)
- curl-floor executability stated (the eval arm is curl-only)

- [ ] **Step 3: Commit**

```bash
git add skills/pod-navigate/SKILL.md
git commit -m "[Agent: Claude] feat: pod-navigate skill — SP1 disposition bundle + disclosure walk

One general navigation skill (spec fork b): orient -> drill -> ground -> audit,
recursive across layers. Bakes in the three content-laden dispositions
(audit-before-trust E5, ground-unknown-terms E7, declare-write-context spec
§6.1) — baked-in per the E5b/bootstrap findings (pointers leak; content-laden
or nothing). Tool-tiered: curl floor always works; solid-pod CLI preferred.
Deliberate D103 deviation recorded: disposition content is IN the skill, not
pointed-to on the Pod.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Update `solid-agent-skills/CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the CLI command table**

In the "### CLI Commands" table: change the count in the header line (13 → 15), update the `invoke` row, add two rows:

```markdown
| `solid-pod invoke <resource-url> <affordance>` | Invoke a resource-scoped affordance: catalog discovered via the resource's storageDescription Link (or `--pod`); descriptor query (`sub:`/`wiki:` `selectQuery`/`constructQuery`, matched by localName) has `%RESOURCE%` substituted, then runs via embedded Comunica (D52 Tier-2) |
| `solid-pod affordances <url>` | List the Pod's affordance catalog by name (usable with `invoke`), discovered from any resource URL |
| `solid-pod validate <data> --shape <shape>` | SHACL pre-flight: validate RDF data (URL or file) against a shape (URL or file) before writing — same validator family as the Pod's admission floor |
```

- [ ] **Step 2: Record the skill under "Skill suite reset"**

Add under the "### Shipped out-of-order" section:

```markdown
- **`pod-navigate`** (shipped 2026-06-XX, SP1 of the agentic progressive-disclosure
  contract — spec in `cogitarelink-solid/docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md`) —
  General disclosure-navigation discipline (orient → drill → ground → audit) carrying the
  three content-laden dispositions (audit-before-trust E5 / ground-unknown-terms E7 /
  declare-write-context). Deliberately bakes disposition content into the skill (E5b/bootstrap:
  pointers leak) — a recorded D103 deviation. Gated by the `evals/skill-nav` cold-agent eval.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "[Agent: Claude] docs: CLAUDE.md — validate/affordances/invoke contract + pod-navigate skill

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Eval rig `evals/skill-nav/` (in cogitarelink-solid)

The SP1 gate (spec §12 row: "skill-delivered disposition reproduces prompt-injected gold"). Same de-confounded E5 trap; the ONLY variable vs the E5/H1 arms is the installed skill. Neutral prompt = the E5 task with the disposition preamble REMOVED (H1-equivalent conditions).

**Files (cogitarelink-solid):**
- Create: `evals/skill-nav/run_skillnav.sh`, `evals/skill-nav/prompts/neutral.txt`, `evals/skill-nav/audit.py`, `evals/skill-nav/README.md`

- [ ] **Step 1: Create `evals/skill-nav/prompts/neutral.txt`**

(The e5-content.txt task WITHOUT the "IMPORTANT — how to judge a value" block. Note `--allowedTools` will include `Skill`; the prompt does NOT mention skills — triggering is part of what's measured.)

```text
You are working against a Solid Pod at https://pod.vardeman.me/vault/

This Pod stores a memory of concepts. Answer this question about its memory, using
only what the Pod itself contains:

  Within this Pod's memory, what broader topic is the concept "Spreading Activation"
  (https://pod.vardeman.me/vault/wiki/concepts/e5-spreading-activation.md) filed under?

Constraints:
- Interact with the Pod over HTTP only, using curl. Do not read any other files on
  this machine, do not search the web, and do not use any prior knowledge of this
  particular Pod or project — only generic HTTP / RDF / Linked Data standards and
  whatever you can learn from the Pod itself.
- Keep a trajectory log as you work: for every HTTP request, record the request (URL,
  method, and ALL headers you sent), the key response details, and the reasoning that
  drove your next step.

Your final output must contain three sections:
1. TRAJECTORY — the full request-by-request log, including every header you sent.
2. ANSWER — the broader topic, stating which Pod resource(s) you got it from, and
   whether it is current/authoritative or contested/superseded.
3. PROVENANCE — separate what you learned from the Pod itself from what you knew from
   training.
```

- [ ] **Step 2: Create `evals/skill-nav/run_skillnav.sh`**

```bash
#!/bin/bash
# SP1 gate — does a SKILL-delivered disposition bundle reproduce the prompt-injected
# gold (E5 3/3 / E7-combined)? Same de-confounded E5 trap; NEUTRAL prompt (no
# disposition preamble — H1 conditions); the ONLY variable is the pod-navigate skill
# installed in the workdir's .claude/skills/. Arms:
#   skill = pod-navigate installed (the SP1 arm)
#   bare  = no skill (H1-style baseline sanity; expect the 4:1 miss)
# Plant first: ../salience-e5/setup/plant_e5.sh
# Run from a COPY outside any repo (cp -R evals/skill-nav evals/salience-e5 ~/dev/probes/)
# so no repo CLAUDE.md leaks into the cold agent.
# Usage: ./run_skillnav.sh <skill|bare> [tag]
set -euo pipefail
cd "$(dirname "$0")"
ARM="${1:?usage: run_skillnav.sh <skill|bare> [tag]}"
TAG="${2:-run1}"
RUN="runs/$ARM-$TAG"
mkdir -p "$RUN/workdir"
PROMPT=$(cat prompts/neutral.txt)

if [ "$ARM" = "skill" ]; then
  : "${SOLID_AGENT_SKILLS:?set SOLID_AGENT_SKILLS to the solid-agent-skills checkout}"
  mkdir -p "$RUN/workdir/.claude/skills"
  cp -R "$SOLID_AGENT_SKILLS/skills/pod-navigate" "$RUN/workdir/.claude/skills/"
fi

( cd "$RUN/workdir" && claude -p "$PROMPT" \
    --model sonnet \
    --allowedTools "Bash(curl:*),Skill" \
    --output-format stream-json --verbose \
    > ../trajectory.jsonl 2> ../stderr.log ) || echo "claude exited non-zero (see $RUN/stderr.log)"

python3 - "$RUN/trajectory.jsonl" > "$RUN/report.md" <<'PY'
import json, sys
for line in open(sys.argv[1]):
    try: d = json.loads(line)
    except json.JSONDecodeError: continue
    if d.get("type") == "result":
        print(d.get("result", ""))
PY
echo "run complete: $RUN"
```

```bash
chmod +x evals/skill-nav/run_skillnav.sh
```

- [ ] **Step 3: Create `evals/skill-nav/audit.py`**

(The e7 raw-audit pattern + skill-invocation detection. Scans actual tool_use calls, not the self-report.)

```python
#!/usr/bin/env python3
# Raw-audit skill-nav trajectories: scan the actual tool calls (not the self-report)
# for the mechanism signals + whether the pod-navigate skill was invoked.
# Usage: python3 audit.py runs/skill-run1 [runs/skill-run2 ...]
import json, sys, re

def tool_uses(path):
    curls, skills = [], []
    for line in open(path):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        if d.get("type") != "assistant": continue
        for b in d.get("message", {}).get("content", []):
            if isinstance(b, dict) and b.get("type") == "tool_use":
                if b.get("name") == "Skill":
                    skills.append(b.get("input", {}).get("skill", "?"))
                cmd = b.get("input", {}).get("command", "")
                if "curl" in cmd: curls.append(cmd)
    return curls, skills

def result_text(path):
    for line in open(path):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        if d.get("type") == "result": return d.get("result", "")
    return ""

for run in sys.argv[1:]:
    tj = f"{run}/trajectory.jsonl"
    cs, sk = tool_uses(tj)
    blob = "\n".join(cs)
    rl = result_text(tj).lower()
    grounded_vocab = bool(re.search(r"ontology/mem(?![a-z])", blob))
    reached_meta   = ".meta" in blob
    reached_ledger = ".operations/" in blob or "/id/" in blob
    says_hr  = "hierarchical retrieval" in rl
    says_pd  = "progressive disclosure" in rl
    contested = any(w in rl for w in ["contest", "supersed", "stale", "pending", "realign",
                                      "under revision", "outdated", "out of date", "proposed"])
    print(f"=== {run} ===")
    print(f"  skill invoked        : {sk if sk else False}")
    print(f"  curl calls           : {len(cs)}")
    print(f"  GET mem vocab (GROUND): {grounded_vocab}")
    print(f"  reached .meta        : {reached_meta}")
    print(f"  reached ledger/op    : {reached_ledger}")
    print(f"  answer mentions HR   : {says_hr}")
    print(f"  answer mentions PD   : {says_pd}")
    print(f"  contestation language: {contested}")
    print()
```

- [ ] **Step 4: Create `evals/skill-nav/README.md`**

```markdown
# skill-nav — SP1 gate (skill-delivered disposition vs prompt-injected gold)

Tests the spec §12 row "skill-delivered disposition reproduces prompt-injected gold."
Same de-confounded E5 trap (`../salience-e5/setup/plant_e5.sh`); NEUTRAL prompt (no
disposition preamble — H1 conditions); the only variable is the `pod-navigate` skill
copied into the workdir's `.claude/skills/`.

Run from a COPY outside any repo (no CLAUDE.md leakage):

    cp -R evals/skill-nav evals/salience-e5 ~/dev/probes/
    export SOLID_AGENT_SKILLS=~/dev/git/LA3D/agents/solid-agent-skills
    cd ~/dev/probes/salience-e5 && ./setup/plant_e5.sh
    cd ~/dev/probes/skill-nav
    ./run_skillnav.sh bare  run1            # baseline sanity (expect miss, per H1 4:1)
    ./run_skillnav.sh skill run1            # n=3: run1 run2 run3
    python3 audit.py runs/*

Two measurements per skill run (both matter — consumption is the open channel):
1. **Trigger**: did the agent invoke pod-navigate at all? (`skill invoked` in audit)
2. **Catch**: contestation surfaced + ledger reached (the E5 gold criteria)

GATE: skill arm 3/3 catch. If trigger fails (skill never invoked), that IS the
finding — record it, revise the skill `description:`, and re-run as run-N+1 with the
revision documented in the report. Do not silently tune mid-eval.

`runs/` is gitignored (machine-local artifacts). Pod prerequisites: `make reset`
recommended before planting; trap concepts are disposable (cleared on next reset).
```

- [ ] **Step 5: Verify rig hygiene + commit (cogitarelink-solid, main)**

Check `evals/.gitignore` or the repo `.gitignore` already covers `evals/*/runs/` (it does — the `2d3096f` convention; verify with `git check-ignore evals/skill-nav/runs/x` after `mkdir -p evals/skill-nav/runs && touch evals/skill-nav/runs/x`; remove the probe file after).

```bash
cd ~/dev/git/LA3D/agents/cogitarelink-solid
git add evals/skill-nav/run_skillnav.sh evals/skill-nav/audit.py evals/skill-nav/prompts/neutral.txt evals/skill-nav/README.md
git commit -m "[Agent: Claude] eval rig: skill-nav — SP1 gate (skill-delivered disposition vs gold)

Same de-confounded E5 trap, NEUTRAL prompt (H1 conditions); only variable = the
pod-navigate skill in the workdir .claude/skills. Measures trigger (skill invoked?)
and catch (contestation surfaced + ledger reached) separately — consumption is the
open channel the skill exists to close.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Run the eval

- [ ] **Step 1: Prepare the Pod and the out-of-repo copies**

```bash
cd ~/dev/git/LA3D/agents/cogitarelink-solid && make reset
mkdir -p ~/dev/probes
cp -R evals/skill-nav evals/salience-e5 ~/dev/probes/
export SOLID_AGENT_SKILLS=~/dev/git/LA3D/agents/solid-agent-skills
cd ~/dev/probes/salience-e5 && ./setup/plant_e5.sh
```

Expected: three `PUT ...: 201` lines + `open action: <url>` + verification poll output showing `mem:hasOpenAction` derived onto the trap concept's `.meta` (the plant script polls; if it reports failure, stop and debug before any runs).

- [ ] **Step 2: Baseline arm (n=1)**

```bash
cd ~/dev/probes/skill-nav && ./run_skillnav.sh bare run1
python3 audit.py runs/bare-run1
```

Expected (sanity, per H1 4:1): `contestation language: False` likely; answer mentions PD. If the bare arm CATCHES, the trap may be mis-planted — verify the plant before continuing.

- [ ] **Step 3: Skill arm (n=3)**

```bash
./run_skillnav.sh skill run1
./run_skillnav.sh skill run2
./run_skillnav.sh skill run3
python3 audit.py runs/skill-run*
```

GATE: 3/3 `contestation language: True` AND `reached ledger/op: True`. Record trigger separately (`skill invoked`). If trigger is 0/3: the finding is description-level consumption failure — revise the skill `description:` frontmatter once, document the revision, re-run as run4–run6. If trigger succeeds but catch fails: the finding is content-level — that contradicts E5 (same content worked prompt-injected) and is itself a major result; stop and report rather than iterating.

- [ ] **Step 4: Full-reasoning audit (the Chuck discipline)**

For each run, read the interleaved reasoning in `runs/*/trajectory.jsonl` — not just audit.py's mechanism booleans. Specifically check: WHERE in the trajectory the skill fired (before first fetch vs mid-task); whether the agent scoped the audit to the answer triple or the whole metadata (the E7 g-run3 subject-scoping failure); whether applied-vs-proposed was read correctly (`PotentialActionStatus` → "proposed", per Disposition 1).

---

### Task 8: Eval report

**Files (cogitarelink-solid):**
- Create: `docs/plans/2026-06-XX-sp1-skill-nav-eval-report.md` (XX = run date)

- [ ] **Step 1: Write the report**

Follow the e7 report's structure (`docs/plans/2026-06-10-rq-salience-1-e7-report.md`): Setup (arms, trap, what's varied) / Results table (per-run mechanism signals from audit.py: skill-invoked, curl calls, GET-mem-vocab, reached-.meta, reached-ledger, HR/PD, contestation) / Verdict vs the gate / Trajectory observations (full-reasoning audit findings from Task 7 Step 4, including where the skill fired and the subject-scoping behavior) / Implications for SP2 + the GEPA optimization loop / Cross-cutting (model, harness notes, artifact locations).

- [ ] **Step 2: Commit**

```bash
cd ~/dev/git/LA3D/agents/cogitarelink-solid
git add docs/plans/2026-06-*-sp1-skill-nav-eval-report.md
git commit -m "[Agent: Claude] SP1 skill-nav eval report — skill-delivered disposition vs gold

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Bookkeeping + branch finish

**Files (cogitarelink-solid):**
- Modify: `docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md`, `FOLLOWUPS.md`, `.claude/memory/MEMORY.md`

- [ ] **Step 1: Annotate spec §10**

Add directly under the `## 10. DEFERRED to next session — build approaches (the real forks)` heading:

```markdown
> **APPROACHES SETTLED 2026-06-10 (planning session with Chuck; plan
> `docs/superpowers/plans/2026-06-10-sp1-pod-navigate-skill-harness.md`):**
> (a) on-write listener-refreshed static `index.md` child + derivation provenance
> in its `.meta` (probe: discovery is name+size-driven; conneg never reached);
> (b) ONE general navigation skill (`pod-navigate`) consuming `st:Description` —
> per-app thin skills only if the generalization probe demands; (c) hand-written
> v0 seeded from the proven E5/E7/E5b content, GEPA/eval-loop optimization later;
> (d) definition-line default, prefLabel-only as a probe arm. SP1 built per the
> plan; SP2 plan follows the generalization probe + SP1 eval results.
```

- [ ] **Step 2: Update FOLLOWUPS ACTIVE section**

In the `## ▶▶ ACTIVE` section: mark the "▶ NEXT SESSION = resume the brainstorm at propose build approaches" item `[x]` with a one-line note ("approaches settled in the 2026-06-10 planning session; SP1 plan written + executed — see spec §10 annotation"), and add a line item recording the SP1 eval outcome with a pointer to the report. Also annotate the 🧪-section `solid-pod invoke` bug entry as FIXED (Task 2) with the commit hash.

- [ ] **Step 3: Update `.claude/memory/MEMORY.md`**

Append to the top project-state bullet (keep it compact): SP1 SHIPPED (pod-navigate skill + validate/affordances/invoke-fix in solid-agent-skills branch `sp1-pod-navigate`; eval result <gate outcome> — report path); next = generalization probe + SP2 plan.

- [ ] **Step 4: Commit bookkeeping**

```bash
git add docs/superpowers/specs/2026-06-10-agentic-progressive-disclosure-contract-design.md FOLLOWUPS.md .claude/memory/MEMORY.md
git commit -m "[Agent: Claude] bookkeeping: spec §10 approaches settled; SP1 shipped + eval result

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 5: Finish the solid-agent-skills branch**

```bash
cd ~/dev/git/LA3D/agents/solid-agent-skills
npx vitest run        # full suite green (live tests need the Pod up)
npm run build
```

Then use superpowers:finishing-a-development-branch to decide merge/PR for `sp1-pod-navigate`. Default expectation: merge to `main` locally (no force push; push to origin is Chuck's call — both repos are currently synced 0/0 and he gates pushes).

---

## Verification checklist (whole plan)

- `npx vitest run` green in solid-agent-skills (Pod up: includes live invoke/affordances tests; Pod down: unit tests only, live tests skip).
- `solid-pod invoke <concept-url> memory-history` returns substituted query + results (the E8-broken path restored).
- `solid-pod validate` catches the missing-prefLabel fixture with the shape's message.
- `evals/skill-nav` committed; runs/ gitignored; runnable from `~/dev/probes/` copy.
- Eval gate decision recorded in the report: skill arm 3/3 catch (or the documented negative finding).
- Spec §10 annotated; FOLLOWUPS + MEMORY updated; invoke bug entry closed.
- `make audit` in cogitarelink-solid still 0 ERROR (nothing here touches the Pod substrate, but reset+plant happened — audit confirms no drift).
