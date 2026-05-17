# Wiki-Search CSS Extension — Refinement Design (Phase 7a)

**Date**: 2026-05-18
**Status**: Ready for implementation planning
**Supersedes (partially)**: [`docs/plans/2026-05-17-wiki-search-design.md`](../../plans/2026-05-17-wiki-search-design.md) — read it first; this doc patches it
**Decision anchor**: D87 (vault `SOLID-Pod-Decisions.md` — wiki-memory L3 search layer)
**Brainstorm session**: 2026-05-18, refining the 2026-05-17 plan before implementation

---

## 1. Why this doc exists

The 2026-05-17 wiki-search design is comprehensive (536 lines, fully buildable) but a stress-test pass surfaced five architectural decisions the original plan papered over. Each would have caused real rework if the implementation session hit it cold. This refinement records the decisions reached in the brainstorming session and the sweep edits needed to keep the 2026-05-17 plan internally consistent.

Read this doc as **deltas applied to the 2026-05-17 plan**. Everything in the original plan that is not contradicted here stands unchanged.

## 2. Five architectural refinements

### Refinement 1 — Recursive container walk by default

**Decision**: `?ext=search-grep` recursively walks every descendant of the target container. No `oslc.depth` parameter.

**Why**: `/vault/wiki/` contains only subcontainers (`pages/`, `sources/`, `people/`, `procedures/`, `working/`); markdown bodies live nested. A single-level walk over `/vault/wiki/` would find zero matches. The agent-side mental model is "search this wiki" — recursion is the obvious affordance.

**Implementation**: BFS over `ResourceStore.getRepresentation` following `ldp:contains` transitively. Collect any descendant whose representation Content-Type is `text/markdown`.

**Subtree omission for WAC**: If WAC denies read on a subcontainer, the handler omits the entire subtree from enumeration (no descent). This extends omit-don't-deny to structure — an agent cannot infer denied-subcontainer existence from response shape.

### Refinement 2 — AND across terms; density-based score

**Decision**: A resource matches iff every term in `oslc.searchTerms` has at least one occurrence in its body. Score is TF-density-based, not raw match count.

**Why**: §9 of the 2026-05-17 plan describes AND ("Multi-term boolean intersection"); §4's engine code OR-collects. The skill description is the right semantics for a literal-witness affordance — "progressive disclosure ESPRESSO" should find pages mentioning both, not pages mentioning either.

**Score formula consequence**: Under AND, `uniqueTermsMatched == totalTerms` is invariant, so the original `min(100, 10 * matchCount + 10 * uniqueTermsMatched / totalTerms)` degenerates to `min(100, 10 * matchCount + 10)` — 9 matches caps the score, 1 match gives 20. Replace with density-based:

```typescript
function computeScore(matches: Match[], bodyLength: number): number {
  const matchesPerKB = (matches.length / Math.max(1, bodyLength)) * 1000;
  return Math.min(100, Math.round(
    20 * Math.log2(1 + matchesPerKB) + 10 * Math.min(matches.length, 10)
  ));
}
```

Density distinguishes "page that name-drops a term once" from "page genuinely about a term"; logarithmic dampening prevents one super-long body from monopolizing the rank. Still a v1 baseline — RQ-Search-1 stays open for Rung 1.5 eval to tune.

**Implementation split**: `RegexpSearchEngine` stays semantics-free (returns all per-term matches for a single body). The AND post-filter lives in `WikiSearchHttpHandler`:

```typescript
const matched = engine.search(body, pattern);
const distinctTerms = new Set(matched.map(m => m.term));
if (distinctTerms.size < pattern.terms.length) continue;  // omit this resource
```

### Refinement 3 — Strict OSLC term parsing

**Decision**: `oslc.searchTerms` accepts only the OSLC Query 3.0 §7.3 form — comma-separated double-quoted strings, URL-encoded. Anything else returns 400.

**Why**: The 2026-05-17 plan's §6 example used unquoted `progressive+disclosure`, but the spec text in §4/§12 references OSLC §7.3 quoted strings. Strict parsing removes ambiguity at the wire (one quoted phrase = one term, never whitespace-split).

**Wire example**:
```
?ext=search-grep&oslc.searchTerms=%22progressive%20disclosure%22,%22ESPRESSO%22
```

**Grammar**:
```
searchTerms  := quotedString ( "," quotedString )*
quotedString := '"' ( escapedChar | safeChar )* '"'
escapedChar  := '\\"' | '\\\\'
safeChar     := any char except '"' and '\'
```

**Error response** (400 Bad Request, `application/problem+json`):
```json
{
  "type": "https://pod.vardeman.me/vault/ontology/errors#malformed-search-terms",
  "title": "Malformed oslc.searchTerms",
  "detail": "Expected comma-separated quoted strings per OSLC Query 3.0 §7.3. Got: progressive+disclosure",
  "example": "oslc.searchTerms=%22progressive%20disclosure%22,%22ESPRESSO%22"
}
```

The `example` field is non-spec but high-leverage: agents that guess the format wrong get a corrected example back, making the affordance self-teaching.

**Consumer skill UX**: `solid-pod wiki-search <container> "phrase 1" "phrase 2"` handles quoting + URL encoding so the agent never writes the raw URL.

### Refinement 4 — OSLC paging

**Decision**: Add `oslc.startIndex` to the parameter table. Emit `oslc:nextPage` in `oslc:ResponseInfo` when more results exist. `oslc:totalCount` is the full WAC-filtered match count across the recursive walk, not the page size.

**Why**: 1243-note vault makes pageSize=100 truncation a real risk. The original plan was ambiguous about whether truncation was visible to the agent. OSLC Query 3.0 §6 already specifies the paging shape — adopt it.

**Updated parameter table**:

| Param | Required? | Semantics |
|---|---|---|
| `ext=search-grep` | Yes | Dispatch |
| `oslc.searchTerms` | Yes | Strict OSLC quoted form (Refinement 3) |
| `oslc.pageSize` | No | Page size. Default 25, max 100 (server-enforced) |
| `oslc.startIndex` | No | 0-based offset. Default 0. Negative → 400 |
| `oslc.where`, `oslc.select`, `oslc.orderBy`, `oslc.prefix` | **Deferred** | 501 if present |

**Response shape** (Turtle):
```turtle
@prefix oslc:  <http://open-services.net/ns/core#> .
@prefix ldp:   <http://www.w3.org/ns/ldp#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix vault: <https://pod.vardeman.me/vault/ontology/wiki#> .

</vault/wiki/?ext=search-grep&oslc.searchTerms=%22agent%22&oslc.pageSize=25>
    a ldp:BasicContainer, oslc:ResponseInfo ;
    dct:title "Search results for: agent" ;
    oslc:totalCount 247 ;
    oslc:nextPage </vault/wiki/?ext=search-grep&oslc.searchTerms=%22agent%22&oslc.pageSize=25&oslc.startIndex=25> ;
    ldp:contains
        </vault/wiki/pages/agent-architecture.md> ,
        </vault/wiki/pages/agentic-memory.md> ,
        … (23 more in score order) .

</vault/wiki/pages/agent-architecture.md>
    oslc:score 87 ;
    vault:matchedLine 12 ;
    vault:matchedContext "…the [[Agent Architecture]] question is whether…" .
```

**Invariants**:
- `oslc:totalCount` is the full count across the recursive walk after WAC filtering and AND filtering — never the page size.
- `oslc:nextPage` present iff `startIndex + pageSize < totalCount`; omitted on the final page.
- `oslc.startIndex > totalCount` → 200 with empty `ldp:contains` and the true `oslc:totalCount` (so the agent can re-paginate from a sane offset).
- Page boundaries are stable for a single instant but **not transactionally consistent** across calls. Document in the affordance descriptor; revisit only if Rung 1.5 surfaces a need for snapshot tokens (Memento-style).

**Score-then-paginate order**: Handler scores all candidates → sorts descending → slices `[startIndex, startIndex + pageSize)`. Score-sort is global across pages, not per-page. Cost is the same as score-everything-and-return-top-25 since we already need totalCount.

### Refinement 5 — Tier-1 discoverability via `Link: rel="queryBase"` is in-scope

**Decision**: Ship `WikiSearchLinkMetadataWriter` in Phase 7a. Not optional polish.

**Why**: The whole affordance architecture rests on agents discovering capabilities cold. Without the Link header, an agent reading only HTTP headers (D55 Tier 1) cannot discover the search affordance — they have to know to GET `/vault/meta/capabilities/` first. ~30 LOC for a structural cold-start guarantee is a strong tradeoff.

**Behavior**: On GET responses whose target is an `ldp:BasicContainer` at or under `/vault/wiki/`, emit:
```
Link: </vault/wiki/?ext=search-grep>; rel="http://open-services.net/ns/core#queryBase"; title="wiki-search"
```

Path-prefix dispatch (not `wiki:Resource` rdf:type scan) — typing-based dispatch would require reading every child's `.meta` on every container GET, which is too costly for a header decoration. Path matching aligns exactly with the affordance descriptor's `wiki:targetContainer </vault/wiki/>` claim.

`addHeader` not `setHeader` (D67 metadata-writer composition): Link must compose with describedby, MementoLink (timegate/timemap), and ProfileLink (PROF profile URIs).

**Components.js wiring**: Follow the Phase 5j lesson — Components.js forbids multiple `Override` declarations against the same component instance. Consolidate into an existing `memento.json`-style override step or peer file; pick whichever keeps the DI tree readable. The implementation session decides.

## 3. Sweep edits to the 2026-05-17 plan

These are the small consequential changes needed to keep the original plan internally consistent. Apply during implementation; not architectural decisions on their own.

### §2 Scope — add to "In scope"

- Recursive container walk (BFS over `ldp:contains`)
- `Link: rel="queryBase"` MetadataWriter (no longer "optional Phase 7a polish")
- OSLC paging via `oslc:nextPage` + `oslc.startIndex`

### §4 Engine — replace score formula and clarify post-filter location

- Density-based score from Refinement 2.
- Engine stays semantics-free; AND post-filter is the handler's job (keeps the engine seam clean for Phase 7b BM25/ripgrep swaps).

### §5 Layout — add files

```
src/
├── WikiSearchHttpHandler.ts          # AND post-filter lives here
├── WikiSearchLinkMetadataWriter.ts   # NEW (Refinement 5)
├── parseSearchTerms.ts               # NEW — strict OSLC parser (Refinement 3)
├── parseQuery.ts                     # delegates searchTerms field to parseSearchTerms
└── …                                  # SearchEngine, RegexpSearchEngine, ResponseBuilder, snippet, score unchanged
tests/
├── …                                  # existing test files
├── WikiSearchLinkMetadataWriter.test.ts  # NEW
└── parseSearchTerms.test.ts          # NEW
```

### §6 Wire contract — fold Refinements 3 + 4

- Replace the §6 example URL with the quoted+URL-encoded form.
- Add `oslc.startIndex` and `oslc:nextPage` rows.

### §7 WAC — add subtree-omission rule

> If WAC denies read on a subcontainer, the handler omits its entire subtree from enumeration (no descent). This extends omit-don't-deny to structure: an agent cannot infer the existence of denied subcontainers from search response shape.

### §8.2 Affordance descriptor — note pagination and recursion

Add to `rdfs:comment`: "Recursive over the target container. Paginated per OSLC Query 3.0 — see `oslc:nextPage` in responses." Add two `wiki:queryParameter` entries for `oslc.pageSize` and `oslc.startIndex`.

### §10 Test plan — additional cases

- **Recursion**: 3-level container tree with markdown at every level; assert all readable bodies are scanned.
- **Subtree omission**: deny WebID read on `/vault/wiki/pages/private/`; assert that subtree's matches absent and total scan count unobservable.
- **Paging**: 75-result match set, `pageSize=25` → 3 pages, each with `oslc:totalCount 75`, last page has no `oslc:nextPage`.
- **`oslc.startIndex` > totalCount** → 200 + empty `ldp:contains` + correct `oslc:totalCount`.
- **Malformed `oslc.searchTerms`** (unquoted) → 400 with `application/problem+json` body matching Refinement 3 shape (assert `type`, `example` fields).
- **Link header**: GET `/vault/wiki/` includes `rel="queryBase"`; GET `/vault/profile/` does not.

### §12 Open questions — RQ-Search-1 reframed

Score formula is now density-based (Refinement 2 v1 baseline), not match-count. RQ-Search-1 is still open but tunes against a less-degenerate baseline.

### §13 Implementation order — insert step

After step 7 (WAC tests), add **step 7.5: WikiSearchLinkMetadataWriter + Components.js wiring + Link header integration test** (~1 hour). Subsequent steps unchanged. New total: ~19 hours.

## 4. What this refinement does NOT change

- The SearchEngine interface seam (Phase 1 = RegExp, Phase 7b = BM25/ripgrep swap).
- The choice not to use OSLC ServiceProvider/Catalog discovery (Appendix A of the original plan stands — D83 capability catalog is the discovery surface).
- WAC enforcement at result construction (not post-response client filter).
- D55 three-tier access framing.
- The consumer skill structure in `solid-agent-skills` (one-call HTTP wrapper).
- Multi-pod deferral to Round 4 (Appendix B).
- ACL-filtered TypeIndex deferral (Appendix C).

## 5. Open questions still standing

- **RQ-Search-1**: Density-score formula tuning (v1 baseline in Refinement 2).
- **RQ-Search-4**: Should responses include matched `.meta` triples (typed edges around the matched resource) for context? Phase 1 omits; Rung 1.5 evidence decides.
- **RQ-Search-2**: When to add `oslc.where` (combined text + structured filter). Phase 1 returns 501.
- Whether the "stable-within-instant" paging guarantee is strong enough or needs a Memento-style snapshot token. Defer to Rung 1.5.

## 6. Implementation order summary

For convenience, the full revised order including the Refinement 5 insertion:

1. Read 2026-05-17 plan + this refinement + existing exemplars (memento, profile-link, AddressBook overlay's contact-discovery affordance). 30 min.
2. Scaffold extension directory (mirrors profile-link layout). 30 min.
3. `SearchEngine` interface + `RegexpSearchEngine` + unit tests. ~2 h.
4. `parseSearchTerms` + `parseQuery` + unit tests. ~2 h.
5. `ResponseBuilder` (including OSLC paging) + unit tests. ~2 h.
6. `WikiSearchHttpHandler` skeleton + Components.js + smoke test. ~2 h.
7. Wire `ResourceStore` + `PermissionReader` + recursive walk + AND post-filter + score + paging. ~3 h.
8. WAC enforcement tests (5 scenarios from §7 + Refinement 1 subtree-omission). ~2 h.
9. `WikiSearchLinkMetadataWriter` + Components.js wiring + integration test. ~1 h.
10. Capability descriptor + affordance descriptor + overlay manifest entry + verify `apply.py` upload. ~1 h.
11. `wiki-search` consumer skill in `solid-agent-skills` + CLI command + live-pod integration test. ~3 h.
12. Performance smoke + p95 check (D87 success criterion < 500ms). ~1 h.
13. Update vault notes (Phase 7 note, SOLID-Pod-PLAN, D87 amendment) + cogitarelink-solid FOLLOWUPS.md. ~30 min.

Total: ~19 hours of focused work. Single-engineer 2.5–3 days.

---

## Appendix — Brainstorm session record

Refinements 1–5 were reached through five sequential AskUserQuestion exchanges on 2026-05-18, each addressing one gap surfaced by stress-testing the 2026-05-17 plan against the project's actual data shape and architectural commitments. All five answers picked the recommended option. The session record is available in the brainstorm conversation; key tradeoffs explored are inline in §2 above.
