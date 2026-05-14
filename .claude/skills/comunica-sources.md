# /comunica-sources

How to drive Comunica SPARQL queries against this Pod with explicit source lists. The `comunica-sparql-link-traversal` sidecar (port 8080) requires sources per request, not as global config.

## When to invoke

You're writing a SPARQL query (test, harness skill, or agent) that needs Comunica to fetch specific Pod URLs as RDF sources, including `.meta` sidecars or other non-self-discoverable resources.

## How sources get passed

The Comunica HTTP endpoint runs with `--contextOverride`, which means each HTTP query must supply its own sources via the `context` form parameter as a JSON-encoded object. The CLI `-s` flag does NOT work over HTTP.

```bash
curl -X POST http://localhost:8080/sparql \
  -H "Accept: application/sparql-results+json" \
  --data-urlencode 'query=SELECT * WHERE { ?s ?p ?o } LIMIT 10' \
  --data-urlencode 'context={"sources":["http://pod.vardeman.me:3000/vault/resources/concepts/foo.md.meta"]}'
```

In Python (see `tests/pytest/test_sparql.py`):

```python
import json, httpx
def query(sparql: str, sources: list[str]) -> list[dict]:
    ctx = json.dumps({"sources": sources})
    r = httpx.post("http://localhost:8080/sparql",
                   data={"query": sparql, "context": ctx},
                   headers={"Accept": "application/sparql-results+json"},
                   timeout=120)
    r.raise_for_status()
    return r.json()["results"]["bindings"]
```

In TypeScript (programmatic engine):

```typescript
import { QueryEngine } from "@comunica/query-sparql-link-traversal";
const engine = new QueryEngine();
const bindings = await engine.queryBindings(sparql, {
  sources: ["http://pod.vardeman.me:3000/vault/resources/concepts/foo.md.meta"],
  lenient: true,
});
```

## Pre-discovering sources

The expensive part of any pod query is the source list. For pod-wide queries, discover `.meta` URLs from the LDP container:

```python
import httpx
from rdflib import Graph
LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains"

def discover_meta_sources(container_url: str) -> list[str]:
    r = httpx.get(container_url, headers={"Accept": "text/turtle"}, timeout=30)
    r.raise_for_status()
    g = Graph()
    g.parse(data=r.text, format="turtle", publicID=container_url)
    return [f"{res}.meta" for _, p, res in g if str(p) == LDP_CONTAINS]
```

This is the pattern in `tests/pytest/test_sparql.py:meta_sources`. Cache the result per session — container listing is one HTTP round-trip, but discovering 1000+ `.meta` URLs adds latency.

## Known limitation — describedby gap

Comunica's link-traversal **follows `ldp:contains`** but does NOT follow `describedby` Link headers on non-RDF resources (RQ-Pod-3 / 2026-04-02 finding). Practical consequence: a query that starts from a markdown resource will never auto-discover its `.meta` sidecar. You must enumerate `.meta` URLs explicitly in the `sources` list.

Comunica skips unparseable content types entirely, so handing it a `.md` URL also doesn't help — it sees `text/markdown`, can't parse, drops the source.

## Single-source vs federated (RQ-Memento-2)

Comunica's `actor-http-memento` provides `Accept-Datetime` negotiation for a **single source**. Confirmed via the `-d <datetime>` flag for `comunica-sparql` CLI. Federated propagation across multiple link-traversed sources is **unconfirmed** — see RQ-Memento-2 in `.claude/rules/decisions-index.md`. Rung 1.1 success is scoped to single-pod queries; cross-pod Memento federation is Round 4 territory.

## Lenient mode

CSS occasionally returns non-RDF responses for resources Comunica expects to be RDF (e.g., HTML 404 pages, status responses). `--lenient` makes Comunica log parse errors instead of failing the query. Default in our setup (`docker-compose.yml`):

```yaml
command: ... npx comunica-sparql-link-traversal-http -p 8080 --lenient --contextOverride -c /app/config.json
```

Strict mode is for tests where you want failures to surface. Lenient is for production agents.

## Custom Comunica config

`comunica/config.json` declares which extract-link actors are active. Defaults import:

- `extract-links/actors/predicates-common.json` — `rdfs:seeAlso` etc.
- `extract-links/actors/predicates-ldp.json` — `ldp:contains`, etc.
- `extract-links/actors/links-describedby.json` — `describedby` Link header (limited; see gap above)
- `extract-links/actors/predicates-solidstorage.json` — `pim:Storage` etc.
- `extract-links/actors/quad-pattern-query.json`
- `extract-links/actors/solid-type-index-noinference.json`

If you need additional link extraction (e.g., follow `cito:hasPageRange` for Round 2's bridge edges), extend this file. The actor pattern is documented in Comunica's link-traversal repo.

## traqula version pin

`@comunica/query-sparql-link-traversal@0.8.0` has a broken `@traqula/parser-sparql-1-2` dep. Fixed via `npm overrides` in `comunica/package.json`:

```json
"overrides": {
  "@traqula/parser-sparql-1-2": "^1.0.0",
  "@traqula/algebra-sparql-1-2": "^1.0.0",
  "@traqula/rules-sparql-1-1": "^1.0.0",
  "@traqula/core": "^1.0.0"
}
```

When bumping Comunica, re-check whether the overrides are still needed.

## Reference implementations

- `tests/pytest/test_sparql.py` — full pattern (discover sources, query with context override, assert bindings)
- `comunica/config.json` — link-extraction actor configuration
- `docker-compose.yml` — service config with `--lenient --contextOverride`

## Related skills

- `/solid-spec` — Solid Type Index for class-based discovery (alternative to listing `.meta` URLs)
- `/monitoring-store` — if you're emitting CDC events to drive incremental graph updates
