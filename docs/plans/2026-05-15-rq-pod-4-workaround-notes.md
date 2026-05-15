# RQ-Pod-4: Comunica .meta Traversal Workarounds (Rung 1.4 findings)

**Date**: 2026-05-15
**Phase**: Rung 1.4 — wiki-memory L3 reference profile, traversal query validation (Phase 7)

## What worked

**Explicit-source context pattern** — pass each `.meta` URL as an explicit source in
the Comunica query context:

```python
import httpx, json

def _query(sparql: str, sources: list[str]) -> dict:
    ctx = json.dumps({"sources": sources})
    r = httpx.post(
        "http://localhost:8080/sparql",
        data={"query": sparql, "context": ctx},
        headers={"Accept": "application/sparql-results+json"},
        timeout=60.0,
    )
    r.raise_for_status()
    return r.json()

result = _query(sparql_text, [
    "http://pod.vardeman.me:3000/wiki/pages/wiki-memory-l3-profile.md.meta",
    "http://pod.vardeman.me:3000/wiki/people/karpathy-andrej.md.meta",
])
```

This is the `context` form parameter carrying a JSON object with `"sources"` — the
same pattern that existing `tests/pytest/test_sparql.py` uses for the vault concepts
container. All 3 traversal queries returned correct results in under 1 second.

**Absolute URIs in queries** — Comunica's HTTP endpoint rejects relative IRIs
(`</wiki/pages/foo.md>`) with `"Cannot resolve relative IRI ... because no base IRI
was set"`. All `.rq` files updated to use absolute `http://pod.vardeman.me:3000/...`
URIs. This is not a workaround limitation — it is the correct form for SPARQL queries
that don't have an associated document base.

**`dct:contributor` not `dct:creator`** — `MarkdownProjectionListener` emits
`dct:contributor` for `{.author}` class hints. Query 3 (`03-source-creator-roundtrip.rq`)
was updated from `dct:creator` to `dct:contributor`. Semantically appropriate: the
Ghumare source note records a contributor/associated person, not the authoring publisher.

## What did not work (or partially worked)

**Pure link-traversal from markdown body URL**: Starting a Comunica query from
`http://pod.vardeman.me:3000/wiki/pages/agentic-memory-systems-moc.md` (the body
resource) and expecting it to discover `.meta` triples via the `describedby` Link
header does NOT work. Comunica's link-traversal actor skips resources with
unparseable content types (`text/markdown`). The `describedby` header on the body
resource points to the `.meta`, but the actor never dereferences the body to read
the header, so the `.meta` sidecar is invisible to pure traversal.

This is the known gap flagged as RQ-Pod-4 since Phase 2 ("Comunica `.meta` traversal
vs pre-built index — blocked by link-traversal `.meta` gap").

**`default-graph-uri` form parameter** — `default-graph-uri` in the POST form body
(standard SPARQL 1.1 protocol §2.1.4) is not honored by `comunica-sparql-link-traversal-http`
in the configuration used here. The endpoint returns the same "none of the configured
actors" 400 error regardless.

**JSON body POST** — sending `Content-Type: application/json` with `{"query": "...",
"context": {...}}` causes a worker crash ("Invalid POST body received, query type could
not be determined"). The correct format is `Content-Type: application/x-www-form-urlencoded`
with `query=...&context=<JSON-escaped>`.

## Three-query validation results (Rung 1.4)

| Query | File | Sources passed | Result |
|-------|------|----------------|--------|
| MOC → source titles | `01-moc-to-source-titles.rq` | 3 `.meta` files | 1 binding: Ghumare title |
| Concept → author affiliation | `02-concept-to-author-affiliation.rq` | 2 `.meta` files | 1 binding: Karpathy, Andrej |
| Source contributor roundtrip | `03-source-creator-roundtrip.rq` | 3 `.meta` files | 1 binding: concept + contributor |

All queries ran via the explicit-source pattern — no pure link-traversal.

## Implications for Rung 1.5

- Evaluation harness should record which mode each query ran in: `pure-traversal` vs
  `explicit-source`. The B2 brute-force tier (spec-only navigation) requires explicit
  `.meta` URL construction; T-harness (descriptor-aware) can derive `.meta` URLs from
  the affordance catalog's URI pattern declaration.
- The explicit-source pattern is acceptable as a Tier 2 (harness-aware) operation: an
  agent that has dereferenced the affordance catalog knows the `.meta` URL scheme
  (`{resource}.meta`) and can construct source lists before querying.
- A Comunica actor that follows `describedby` Link headers on non-RDF resources would
  make `.meta` sidecars reachable from pure traversal (Tier 1). This is a possible
  Rung 1.5+ upstream contribution or local actor.
- Materialization (pre-building a named-graph index) is an alternative L2 substrate
  guarantee that would make `.meta` triples queryable without explicit source lists —
  aligns with D72 compile-once principle.

## Reference

- `RQ-Pod-4` in `.claude/rules/decisions-index.md`
- `D31` — `.meta` sidecars as source of truth
- `D72` — compile-once principle as substrate guarantee
- Test pattern: `tests/test_wiki_memory_l3_traversal.py::_query`
- Existing precedent: `tests/pytest/test_sparql.py::_query`
