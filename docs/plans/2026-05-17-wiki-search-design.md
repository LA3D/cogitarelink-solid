# Wiki-Search CSS Extension — Design Plan (Phase 7a)

**Date**: 2026-05-17
**Status**: Ready for implementation
**Decision anchor**: D87 (vault SOLID-Pod-Decisions.md — wiki-memory L3 search layer)
**Related vault notes**: `Phase 7 - Wiki-Memory Search Layer.md`, `Wiki-Memory L3 Search Layer.md`, `Solid Pod Full-Text Search Landscape 2026.md`
**Intended consumer**: a clean superpowers-driven implementation session

---

## 1. Problem statement

Wiki-memory L3 pages live in the pod as markdown bodies under `/vault/wiki/`. Dual-layer linking (D58/D71/D81) projects body wikilinks to `.meta` Turtle triples. Structural navigation (LDP containers + Type Index), graph queries (SPARQL over `.meta` via Comunica as a client library), and backlinks (D45 `?ext=backlinks` affordance) are all shipped. What is **not** shipped: full-text search over the markdown bodies. An agent consuming the pod as memory cannot currently ask "find pages mentioning *progressive disclosure*" without dragging every body across the wire.

This plan specifies the CSS extension that closes that gap.

## 2. Scope

**In scope (this plan):**

- A single CSS extension `css/extensions/wiki-search/` that intercepts container GETs with `?ext=search-grep&oslc.searchTerms=…`, runs regex over `text/markdown` bodies in the container, and returns an LDP+OSLC-conformant Turtle response with ranked matches.
- WAC enforcement at result construction (per D87) — omit, don't deny.
- A capability descriptor published via the existing overlay machinery (D83) so the affordance is agent-discoverable.
- A `wiki-search` consumer skill in the sibling `solid-agent-skills` repo that wraps the HTTP call.
- Integration tests that prove the extension works in the live pod (vitest unit + a Docker-up integration test).

**Out of scope (deferred to later phases or out of project):**

- BM25, RRF hybrid, vector retrieval (Phase 7b/7c — backend swaps under the same API).
- ESPRESSO-style WebID-partitioned in-pod indexes (Phase 7d, build only if 7a–7c demand it).
- Multi-pod / federated search (Round 4 of the research rounds).
- ACL-filtered TypeIndex (deferred; not needed for single-container search where WAC already gates the candidate set).
- Full OSLC ServiceProvider / ServiceProviderCatalog discovery machinery. OSLC Query 3.0 vocabulary is used in the **response shape only**; capability discovery happens through the pod's existing D83 capability catalog, not via OSLC service documents.
- SAI (Solid Application Interop) Authorization Agent integration. Confirmed CG-draft / demo-ware; not deployable today.

## 3. Architectural premises (carried forward, do not re-derive)

These are settled. The implementation session should read them as constraints.

1. **The pod is the agent's interface contract.** No MCP wrapper. The agent issues HTTP GET with Solid-OIDC/DPoP credentials and parses the Turtle response. Per D87.
2. **The `?ext=<affordance>` URL pattern is the pod's affordance-dispatch convention** (D45). Backlinks already use `?ext=backlinks`. Search uses `?ext=search-grep`. This is **not** OSLC-canonical discovery (OSLC would use distinct `oslc:queryBase` URIs per capability via a ServiceProvider document) — but cogitarelink-solid is a Solid pod with D45 affordances, not an OSLC server. The pod **speaks OSLC vocabulary** in responses for forward-compat with OSLC-aware clients without committing to OSLC's discovery machinery.
3. **Capability discovery is via the D83 capability catalog** at `/vault/meta/capabilities/`, not OSLC ServiceProvider, not Solid TypeIndex extensions, not a new W3C spec. The overlay manifest publishes `wiki-search-substrate` as a `cap:Capability` and an affordance descriptor at `/vault/meta/affordances/wiki-search-grep.ttl` (parallel to `contact-discovery` and `wiki-page-as-unit`).
4. **WAC enforcement at result construction**, not at query parsing or post-response client filter. Matches the requester cannot read never appear in `ldp:contains`. `oslc:totalCount` reflects the post-filter count. **Omit, don't deny** (Apache Jena Fuseki Data Access Control semantic precedent). Per D87 and ESPRESSO PG4.
5. **OSLC Query 3.0 (OASIS Standard, August 2021) supplies the response vocabulary**: `oslc:score`, `oslc:totalCount`, `oslc:ResponseInfo`, `ldp:contains`. Score range 0–100, results MUST be sorted descending by score (QUERY-45). `oslc:score` is a non-persistent pseudo-property valid only within the response (QUERY-44). Domain-specific predicates for match context: `vault:matchedLine`, `vault:matchedContext`.
6. **The agent reading the response is an LLM via Claude Code skills.** Response shape is optimized for LLM consumption — include enough context (snippet around match) that the agent doesn't need a follow-up GET on every hit to know whether it's relevant.

## 4. Engine choice — RegexpSearchEngine behind a SearchEngine interface

### Engine survey (settled)

Four engine options were surveyed (see vault Phase 7 note for full discussion):

| Option | Verdict |
|---|---|
| **Pure Node `RegExp`** | **Chosen for Phase 1.** Zero deps. CSS already walks resources via `ResourceStore`; the "engine" is just a body-matcher. At ~1K-page scale (current vault size, expected wiki-memory scale), no observable latency issue. Same pattern as Letta MemFS / Karpathy `qmd` / Monigatti two-stage grep's fine stage. |
| `@vscode/ripgrep` (Microsoft, native binary) | Deferred. Real ripgrep semantics; subprocess overhead ~5ms/query; adds binary deps to Docker image; requires storage to be filesystem-backed *or* dump-to-tmpdir-per-query. Defer until profiling shows pure RegExp as the bottleneck. |
| `ripgrep` (WASM, wasm32-wasip1 + SIMD + brotli/z85 ESM) | Deferred. No subprocess, no native binary, deployment-uniform. WASI filesystem-access semantics need glue against CSS's `ResourceStore`. **The likely Phase 7b backend** when scale demands a real ripgrep. |
| `grepts` (TypeScript reimplementation) | Rejected. 8 stars, 3 commits, no releases. |

### The SearchEngine interface (forward-compat seam)

The implementation MUST factor engine choice behind an interface so the Phase 1 → Phase 7b swap is one new class + one Components.js binding change, not a rewrite.

```typescript
// css/extensions/wiki-search/src/SearchEngine.ts
export interface SearchEngine {
  /**
   * Search a single resource body for matches.
   * Returns matches in body order (callers sort by score for response).
   */
  search(body: string, pattern: SearchPattern): Match[];
}

export interface SearchPattern {
  /** Raw OSLC searchTerms — comma-separated quoted strings per QUERY-43 */
  terms: string[];
  /** Reserved for future: OSLC boolean operators, PCRE flags */
  options?: SearchOptions;
}

export interface Match {
  /** Byte offset into body where match starts */
  offset: number;
  /** Length of matched substring */
  length: number;
  /** 1-indexed line number (computed from offset for snippet rendering) */
  line: number;
  /** Which input term matched */
  term: string;
}

export interface SearchOptions {
  caseSensitive?: boolean;          // default false (smart-case in future)
  maxMatchesPerResource?: number;   // default 50; bound work per body
}
```

### Phase 1 — `RegexpSearchEngine` implementation

```typescript
// css/extensions/wiki-search/src/RegexpSearchEngine.ts
export class RegexpSearchEngine implements SearchEngine {
  search(body: string, pattern: SearchPattern): Match[] {
    const matches: Match[] = [];
    const flags = pattern.options?.caseSensitive ? 'g' : 'gi';
    const cap = pattern.options?.maxMatchesPerResource ?? 50;
    for (const term of pattern.terms) {
      const re = new RegExp(escapeRegExp(term), flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        matches.push({
          offset: m.index,
          length: m[0].length,
          line: lineNumberAt(body, m.index),
          term,
        });
        if (matches.length >= cap) return matches;
      }
    }
    return matches;
  }
}
```

Two small helpers (`escapeRegExp`, `lineNumberAt`) — Node RegExp doesn't interpret OSLC's quoted-phrase syntax as regex meta, so terms are escaped before compilation. `lineNumberAt(body, offset)` is a linear scan; for ~10K-line bodies (an outlier), this is still microseconds.

**Score formula (RQ-Search-1 v1 pick):**

```typescript
function computeScore(matches: Match[], terms: string[]): number {
  const matchCount = matches.length;
  const uniqueTermsMatched = new Set(matches.map(m => m.term)).size;
  const totalTerms = terms.length;
  return Math.min(100, 10 * matchCount + 10 * uniqueTermsMatched / totalTerms);
}
```

Document in code that this is a v1 placeholder pending Phase 7a eval validation.

**Snippet extraction:**

```typescript
function snippet(body: string, offset: number, length: number, halo = 80): string {
  const start = Math.max(0, offset - halo);
  const end = Math.min(body.length, offset + length + halo);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < body.length ? '…' : '';
  return prefix + body.slice(start, end).replace(/\s+/g, ' ').trim() + suffix;
}
```

Return the **first** match's snippet per resource as `vault:matchedContext`, and the first match's line as `vault:matchedLine`. Multi-match resources get the highest-scoring match's snippet.

## 5. CSS extension layout

Mirror the existing extension patterns. The most direct exemplar is `css/extensions/memento/` (which intercepts container GETs based on `Accept-Datetime`). `profile-link/` is the simpler MetadataWriter pattern; not the right model here because wiki-search needs to **replace** the response body for matching requests, not just decorate metadata.

```
css/extensions/wiki-search/
├── package.json                  # @cogitarelink/wiki-search, lsd:* fields
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                  # re-exports public classes
│   ├── WikiSearchHttpHandler.ts  # main CSS HTTP handler — intercepts GET ?ext=search-grep
│   ├── SearchEngine.ts           # interface
│   ├── RegexpSearchEngine.ts     # Phase 1 implementation
│   ├── parseQuery.ts             # parse oslc.searchTerms / oslc.pageSize from query string
│   ├── ResponseBuilder.ts        # build LDP+OSLC Turtle response
│   ├── snippet.ts                # snippet extraction helper
│   └── score.ts                  # score formula
├── tests/
│   ├── WikiSearchHttpHandler.test.ts
│   ├── RegexpSearchEngine.test.ts
│   ├── parseQuery.test.ts
│   └── ResponseBuilder.test.ts
└── dist/                         # tsc output; mirrors memento's layout
```

### CSS hook point

The right CSS class to extend is **`HttpHandler`** (composed via `WaterfallHandler` ahead of the default `OperationHttpHandler` chain). Pattern is the same as `MementoHttpHandler.ts`:

- `canHandle(input)` returns ok iff the request is a GET, the URL ends in a container path, and `?ext=search-grep` is present in the query string. Otherwise throws → next handler in waterfall takes over.
- `handle(input)` parses the query, walks the container's resources via the injected `ResourceStore`, runs the `SearchEngine` against each readable body, scores and ranks results, builds the Turtle response, returns a `Representation`.

DI components (Components.js):

- `ResourceStore` — to enumerate resources in the target container and fetch bodies.
- `PermissionReader` — to check WAC/ACP read permission per candidate resource against the requester's credentials.
- `CredentialsExtractor` — to resolve the requester's WebID from DPoP-bound tokens (reused from CSS's auth chain).
- `SearchEngine` — bound to `RegexpSearchEngine` in Components.js config; swappable via Override.

## 6. Wire contract

### Request

```http
GET /vault/wiki/?ext=search-grep&oslc.searchTerms=progressive+disclosure&oslc.pageSize=10 HTTP/1.1
Host: pod.vardeman.me
Authorization: DPoP <token>
DPoP: <proof>
Accept: text/turtle
```

Query parameters (Phase 1):

| Param | Required? | Semantics |
|---|---|---|
| `ext=search-grep` | Yes | Dispatch — selects this affordance |
| `oslc.searchTerms` | Yes | Comma-separated quoted strings per OSLC Query 3.0 §7.3. URL-encoded. Empty → 400 Bad Request. |
| `oslc.pageSize` | No | Max results in response. Default 25, max 100 (server-enforced). |
| `oslc.where` | **Deferred** | Not supported in Phase 7a. Future: combined text + structured filter (RQ-Search-2). Return 501 Not Implemented if present. |
| `oslc.select`, `oslc.orderBy`, `oslc.prefix` | **Deferred** | Phase 1 returns a fixed projection in fixed order (descending score). |

### Response (success)

`200 OK`, `Content-Type: text/turtle` (also support `application/ld+json` via existing CSS conneg machinery). Headers:

```
Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"
Link: <http://open-services.net/ns/core#ResponseInfo>; rel="type"
```

Body (Turtle):

```turtle
@prefix oslc:  <http://open-services.net/ns/core#> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix vault: <https://pod.vardeman.me/vault/ontology/wiki#> .

</vault/wiki/?ext=search-grep&oslc.searchTerms=progressive+disclosure>
    a ldp:BasicContainer, oslc:ResponseInfo ;
    dct:title "Search results for: progressive disclosure" ;
    oslc:totalCount 7 ;
    ldp:contains
        </vault/wiki/pages/progressive-disclosure.md>,
        </vault/wiki/pages/handle-first-retrieval.md>,
        </vault/wiki/pages/page-index.md> .

</vault/wiki/pages/progressive-disclosure.md>
    oslc:score 92 ;
    vault:matchedLine 42 ;
    vault:matchedContext "…as a [[Progressive Disclosure]]{.related} mechanism for narrowing the candidate set before deep retrieval…" .

</vault/wiki/pages/handle-first-retrieval.md>
    oslc:score 78 ;
    vault:matchedLine 15 ;
    vault:matchedContext "…handle-first is a flavor of progressive disclosure that…" .
```

Result members **MUST** be sorted descending by `oslc:score` (QUERY-45). The `ldp:contains` triples are unordered in RDF, but the textual order in the Turtle response carries the rank; the response builder MUST serialize in score order so a client reading the Turtle linearly gets ranked results.

### Response (no matches)

`200 OK` with `oslc:totalCount 0` and an empty `ldp:contains`. Do NOT return 404 (it leaks "no results for you" semantics vs "no results exist"; 200 with empty container is the omit-don't-deny choice).

### Response (no search terms)

`400 Bad Request` with `application/problem+json` body explaining `oslc.searchTerms` is required.

### Response (forbidden)

`403 Forbidden` if the requester cannot read the **container itself**. If they can read the container but no individual resources match-and-are-readable, return 200 + empty container per above. The 403/200-empty distinction is the omit-don't-deny invariant.

## 7. WAC enforcement

The handler MUST NOT return matches the requester cannot read. The flow:

1. Resolve requester WebID via `CredentialsExtractor` (CSS-supplied; DPoP+OIDC handled).
2. Enumerate resources in the target container via `ResourceStore`.
3. For each resource:
   a. Check `PermissionReader.handle({ credentials, requestedModes: { read: true }, resource })`.
   b. If the WebID lacks read permission: **omit silently**. Do not log to the requester, do not include in candidate set, do not increment any counter the requester can observe.
   c. If the WebID has read permission: fetch body via `ResourceStore.getRepresentation`, run search engine.
4. `oslc:totalCount` is the count of resources that **matched AND were readable**. Pre-filter scan-count is invisible to the requester.

This is the strongest possible enforcement — the search result set is structurally `(matches) ∩ (WAC-readable)`. There is no application-layer "did we remember to filter?" question.

### Test plan for WAC correctness

- **WebID A has read on all `/vault/wiki/pages/*.md`** → search returns all matches.
- **WebID B has read on `/vault/wiki/pages/public/*.md` only** → search returns only matches under `/public/`. `oslc:totalCount` reflects post-filter count.
- **WebID C has no read on the container** → 403 on container GET → 403 on search GET (same code path).
- **WebID D has read on container but no read on any matching resource** → 200 + empty `ldp:contains` + `oslc:totalCount 0`.

These four cases are non-negotiable; the integration test suite must include all of them.

## 8. Capability advertisement (D83 overlay machinery)

Wiki-search joins the existing wiki-memory overlay's capability set. Two files:

### 8.1 Capability descriptor

`overlays/wiki-memory/capabilities/wiki-search-substrate.ttl`:

```turtle
@prefix cap:   <https://pod.vardeman.me/vault/ontology/capability#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .

<>  a cap:Capability ;
    cap:name "wiki-search-substrate" ;
    cap:version "1.0" ;
    rdfs:label "Wiki Full-Text Search Substrate" ;
    rdfs:comment "Full-text search over wiki-memory L3 markdown bodies. GET /vault/wiki/?ext=search-grep&oslc.searchTerms=<terms> returns an LDP container of matches ranked by oslc:score per OSLC Query 3.0 (OASIS Standard, 2021). WAC/ACP enforced server-side at result construction (omit-don't-deny). Phase 1 engine is Node RegExp; engine is pluggable behind SearchEngine interface for future BM25/ripgrep upgrades. See docs/plans/2026-05-17-wiki-search-design.md." ;
    cap:providedBy <https://pod.vardeman.me/vault/ontology/overlay#wiki-memory> ;
    cap:hostedAt <https://pod.vardeman.me/vault/meta/affordances/wiki-search-grep.ttl> .
```

### 8.2 Affordance descriptor

`overlays/wiki-memory/affordances/wiki-search-grep.ttl`:

```turtle
@prefix wiki:  <https://pod.vardeman.me/vault/ontology/wiki#> .
@prefix oslc:  <http://open-services.net/ns/core#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:   <http://purl.org/dc/terms/> .

<>  a wiki:SearchAffordance ;
    rdfs:label "Wiki Grep Search" ;
    rdfs:comment "Grep-style full-text search over markdown bodies in a wiki-memory container. Returns matches ranked by oslc:score." ;
    wiki:targetContainer </vault/wiki/> ;
    wiki:dispatchPattern "?ext=search-grep" ;
    wiki:queryParameter [
        wiki:parameter "oslc.searchTerms" ;
        rdfs:comment "Comma-separated quoted strings per OSLC Query 3.0 §7.3" ;
        wiki:required true
    ] ,
    [
        wiki:parameter "oslc.pageSize" ;
        rdfs:comment "Max results in response. Default 25, max 100." ;
        wiki:required false
    ] ;
    dct:conformsTo <https://docs.oasis-open-projects.org/oslc-op/query/v3.0/oslc-query.html> .
```

The exact predicates may need adjustment to match what other affordance descriptors in the repo use (the AddressBook overlay's `wiki:selectQuery` pattern is the closest precedent — verify against `overlays/addressbook/affordances/contact-find-by-name.ttl` during implementation).

### 8.3 Overlay manifest entry

Add to `overlays/wiki-memory/manifest.ttl`:

```turtle
overlay:providesCapability
    # ... existing capabilities (wiki-vocabulary, wiki-page-as-unit, etc.) ...
    [ cap:capability <https://pod.vardeman.me/vault/meta/capabilities/wiki-search-substrate.ttl> ;
      cap:version "1.0" ;
      cap:descriptor "capabilities/wiki-search-substrate.ttl" ] ;

overlay:installsAffordance
    </vault/meta/affordances/wiki-search-grep.ttl> .
```

The existing `scripts/overlay/apply.py` pipeline uploads these automatically; no new machinery.

### 8.4 Link header on container GETs (optional Phase 7a polish)

To make the affordance discoverable via Tier-1 brute-force navigation (an agent reading only HTTP and Link headers), emit on every `/vault/wiki/` GET:

```
Link: </vault/wiki/?ext=search-grep>; rel="http://open-services.net/ns/core#queryBase"; title="wiki-search-grep"
```

This is a small `MetadataWriter` (~30 LOC, same pattern as `MementoLinkMetadataWriter`). Can ship in Phase 7a or follow-up; agents that read the D83 capability catalog don't need it.

## 9. Consumer skill (`solid-agent-skills` repo)

Mirror the structure of Sprint 2's `pod-read` skill (in flight; the implementation session should read its SKILL.md as the template).

`solid-agent-skills/skills/wiki-search/SKILL.md`:

```markdown
---
name: wiki-search
description: Full-text search over wiki-memory L3 markdown pages in a Solid pod.
  Returns ranked matches with snippets. Use for literal-witness queries
  (exact phrases, citation keys, named entities). For paraphrase/synthesis
  queries, follow up with wiki-meta-query (SPARQL over .meta).
---

# wiki-search

## When to use

Literal-witness search over wiki-memory pages. Best for:
- Exact phrases ("progressive disclosure", "ESPRESSO PG4")
- Named entities (people, projects, citation keys like `@sen-2026-grep-harnesses`)
- Code identifiers, URLs, dates
- Multi-term boolean intersection (currently AND across all terms)

NOT good for paraphrase or synthesis. If grep returns nothing or low-confidence
matches, escalate to wiki-meta-query.

## Invocation

`solid-pod wiki-search <container-url> <terms…>`

Example:
  solid-pod wiki-search https://pod.vardeman.me/vault/wiki/ "progressive disclosure"

## Response shape

JSON array of `{url, score, line, snippet}` sorted by descending score.
```

CLI implementation (~150 LOC):

1. Parse args, resolve container URL.
2. Build OSLC query: `?ext=search-grep&oslc.searchTerms=<URL-encoded-terms>&oslc.pageSize=25`.
3. Issue HTTP GET with DPoP-bound credentials (existing `solid-agent-skills` HTTP helper).
4. Parse Turtle response with N3.js or similar (existing pattern in `solid-pod sparql`).
5. Extract `ldp:contains` URIs + per-URI `oslc:score`, `vault:matchedLine`, `vault:matchedContext`.
6. Print as JSON or pretty table (--format flag).

The skill is **pure HTTP** — no Comunica, no SPARQL. The pod does the work; the skill is a thin wrapper.

## 10. Test plan

### Unit tests (vitest)

- `RegexpSearchEngine.test.ts` — pattern escaping, case-insensitive default, multi-term AND, max-matches cap, line number computation, score formula edge cases (0 matches, single term, all terms matched).
- `parseQuery.test.ts` — URL-decoded terms, comma-separated phrases, pageSize bounds (default 25, cap 100, reject negative), 400 on missing terms.
- `ResponseBuilder.test.ts` — Turtle serialization, sort order descending, `oslc:totalCount` correctness, empty-results response, `Link: rel="type"` headers.
- `snippet.test.ts` — halo bounds at body edges, whitespace normalization, multi-byte safety.

### Integration tests

- Docker compose up + Python pytest harness (existing pattern in `tests/`):
  - 5 markdown pages with known content
  - WebID A grants on all
  - WebID B grants on subset
  - Issue search via authenticated HTTP, parse Turtle, assert:
    - WebID A sees all matches
    - WebID B sees only granted subset
    - Anonymous request sees 200 + empty container (assuming public container) or 403 (private)
    - Empty `oslc.searchTerms` returns 400
    - `?ext=search-grep` without `oslc.searchTerms` returns 400
    - Results sorted descending by score
    - `oslc:totalCount` matches `ldp:contains` count

### Performance smoke test

- Vault import (1243 notes), then issue 10 representative search queries.
- Assert p95 < 500ms per query (D87 success criterion).
- If exceeded: log a follow-up to swap RegexpSearchEngine for @vscode/ripgrep or WASM ripgrep.

## 11. Forward-compatibility — what the SearchEngine seam buys

When Phase 7b (BM25) or Phase 7d (ESPRESSO trie) ships:

1. **New engine class** implementing `SearchEngine` interface (e.g., `Bm25SearchEngine`, `EspressoTrieSearchEngine`).
2. **New affordance descriptor** at `overlays/wiki-memory/affordances/wiki-search-bm25.ttl` declaring `?ext=search-bm25`.
3. **New capability descriptor** at `overlays/wiki-memory/capabilities/wiki-search-bm25-substrate.ttl`.
4. **Components.js Override** in CSS config binding `?ext=search-bm25` dispatch to the new engine instance.
5. **Existing `?ext=search-grep` route stays unchanged.** Old dialects never break when new ones ship.

The handler, parser, response builder, WAC enforcement, and capability advertisement mechanics are all stable. Only the engine class and the dispatch routing table change.

Phase 7c (hybrid RRF) is a ~200 LOC orchestrator that calls two existing engines and fuses; no new handler.

Phase 7d (WebID-partitioned in-pod index, ESPRESSO pattern) is a backend swap behind `?ext=search-bm25` — same dispatch, different engine implementation that reads from in-pod trie resources instead of computing on the fly.

## 12. Open questions to validate in implementation / Rung 1.5 eval

These are scoped narrowly to Phase 7a; broader open questions are in the vault Phase 7 note.

- **RQ-Search-1**: Score normalization formula. Current v1 pick: `min(100, 10 * matchCount + 10 * uniqueTermsMatched / totalTerms)`. Validate on Phase 7a eval tasks; expect tuning.
- **RQ-Search-4**: Should the response include matched `.meta` triples (typed edges around the matched resource) as additional context, or just text snippets? Phase 1 picks text snippets only. Revisit if Rung 1.5 eval shows agents repeatedly fetching `.meta` after a search hit.
- **RQ-Search-2**: When to add `oslc.where`. Phase 1 returns 501 if present. The implementation question is whether to post-filter via Comunica over `.meta`, or push the structured filter into a pre-scan resource-discovery step. Defer until eval shows a real workload.
- **Local-mtime in response**: Should each match carry `dct:modified` so an agent can rank by recency too? Phase 1 omits (the resource is dereferenceable; agent can GET if it cares). Revisit per eval.

## 13. Suggested implementation order for a clean session

This is sized for a focused TDD session using superpowers (writing-plans + test-driven-development + verification-before-completion).

1. **Read this plan + existing exemplars** (memento extension, profile-link extension, AddressBook overlay's contact-discovery affordance). 30 min.
2. **Scaffold extension directory** following profile-link structure, with empty src/, tests/, package.json from template. Build runs (empty tsc). 30 min.
3. **`SearchEngine` interface + `RegexpSearchEngine` impl + unit tests**. TDD. ~2 hours.
4. **`parseQuery` + `ResponseBuilder` + unit tests**. TDD. ~2 hours.
5. **`WikiSearchHttpHandler` skeleton + Components.js config + smoke test** (handler resolves at GET-time with `?ext=search-grep` but returns empty results). ~2 hours.
6. **Wire `ResourceStore` + `PermissionReader` + engine into handler** — full flow against a single test container with two markdown bodies. ~3 hours.
7. **WAC enforcement test cases** (the 4 scenarios in §7). Integration test against docker-compose pod. ~2 hours.
8. **Capability descriptor + affordance descriptor + overlay manifest entry + verify apply.py uploads them**. ~1 hour.
9. **Link header MetadataWriter** (optional 7a polish, §8.4). ~1 hour.
10. **`wiki-search` consumer skill in `solid-agent-skills`** + CLI command + integration test against the live pod. ~3 hours.
11. **Performance smoke + p95 check**. Adjust if needed. ~1 hour.
12. **Update vault notes** (Phase 7 note, SOLID-Pod-PLAN, D87 amendment) + cogitarelink-solid FOLLOWUPS.md. ~30 min.

Total: ~18 hours of focused work. Single-engineer 2–3 days.

## 14. What this plan does NOT decide (left for the implementation session)

- Exact CSS handler class hierarchy (HttpHandler vs OperationHttpHandler vs custom — read memento's `MementoHttpHandler.ts` and match its pattern).
- Components.js Override vs new component registration in `solid-config.json` (follow profile-link's pattern unless memento's differs).
- Whether to ship JSON-LD response alongside Turtle in Phase 7a (CSS's conneg machinery handles it for free; verify and ship if cost is zero).
- Exact predicate names in the affordance descriptor (match what the AddressBook overlay's affordances use; do not invent vocab if there's an existing one).
- Specific test assertion library inside vitest beyond what existing tests use.

These are all small, localizable decisions the implementation session can resolve by reading the existing patterns. They are not architectural commitments.

---

## Appendix A — Why not OSLC ServiceProvider discovery

The morning's design discussion (2026-05-17) considered using full OSLC Query 3.0 discovery — a `ServiceProviderCatalog` at `/oslc`, `ServiceProvider` documents per affordance, `QueryCapability` records with `oslc:queryBase` URIs. This would be the "OSLC-canonical" answer.

It was rejected for Phase 7a because:

1. cogitarelink-solid has a **better discovery mechanism for its own purposes** — the D83 capability catalog at `/vault/meta/capabilities/` — which already handles affordance publication for AddressBook, wiki-memory, and future overlays. Building a parallel OSLC discovery tree would duplicate this.
2. The OSLC ServiceProvider machinery is heavyweight (catalog, providers, capability records, resource shapes) and **adds nothing the capability catalog doesn't already provide** for our agent-consumer use case.
3. OSLC Query 3.0 vocabulary in the **response** is forward-compat for OSLC-aware clients; OSLC discovery **machinery** is not. The pod speaks the vocabulary without claiming to be a fully-conformant OSLC server.

This is the analog of the Apache Jena Fuseki precedent: Fuseki implements graph-level access control with omit-don't-deny semantics without claiming to be SPARQL-spec-extending — it speaks the existing vocabulary correctly under access constraints.

## Appendix B — Multi-pod considerations (deferred, for future readers)

When this work is extended to cross-pod search (Round 4), the architecture should:

1. **Path A (structural narrowing)** — agent uses SPARQL over `.meta` (via Comunica as a library import, per D87) plus link-traversal hints (Verborgh / Hanski 2024 / Hanski 2025) to identify candidate pods/containers across the federation.
2. **Path B (content retrieval)** — agent fans out OSLC Query 3.0 requests in parallel to each candidate container's `/vault/wiki/?ext=search-grep` endpoint.
3. **Merge** at the agent layer. Within-pod `oslc:score` is locally normalized; cross-pod score comparison is **not** meaningful (Q2 from the morning discussion). Use rank-within-pod plus a coarse cross-pod tier.

The Phase 7a single-pod implementation **does not need to do any of this** — each pod's wiki-search affordance is the same shape, so federation composes naturally at the agent layer with zero changes to the pod-side code.

## Appendix C — ACL-filtered TypeIndex (deferred)

ESPRESSO PG4 (Metadata Conservativity) implies a future need: even **structural** discovery (TypeIndex) should not leak the existence of resources the requester cannot read. The morning's research confirmed this is a Solid spec gap with no upstream implementation. A future CSS plugin would intercept `/settings/typeindex.ttl` GETs and omit registrations pointing at unreadable containers (Apache Jena Fuseki omit-don't-deny applied to TypeIndex).

Phase 7a does not require this — single-container search already gates the candidate set via WAC. ACL-filtered TypeIndex becomes important when:

- Multi-pod search where TypeIndex is the cross-pod discovery surface, OR
- The pod hosts containers with restricted access where the **existence** of the container is itself confidential.

Defer until either condition holds.
