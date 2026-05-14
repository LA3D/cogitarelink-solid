# /solid-integration

Building Solid-compliant agents and clients against this Pod. Routes to the vendored upstream `solid/integration-guide.md` plus this repo's deltas for Memento + multi-pod patterns.

## Primary reference

Read `vendor/solid-llm-skills/solid/integration-guide.md` for: `@inrupt/solid-client`, `@inrupt/solid-client-authn-node`, LDO, N3.js, Bashlib `getPodRoot`. Synced from upstream commit `9a1cab17`.

Also read `vendor/solid-llm-skills/solid/data-modelling.md` for vocabulary + ShEx/SHACL background; `vendor/solid-llm-skills/solid/servers.md` for CSS + Pivot + Docker patterns.

## When to invoke

You're building (a) an agent skill that reads from / writes to this Pod, (b) a CLI tool against multiple Pods, (c) a harness that follows-your-nose through Pod resources, or (d) an integration test that authenticates with a real WebID.

## Where we diverge from upstream

### Comunica for SPARQL, NOT solid-client for graph queries

Upstream `integration-guide.md` shows `@inrupt/solid-client` for reading individual resources (`getSolidDataset`, `getThing`). That works fine for one-resource access. For **graph queries across multiple Pod resources**, use Comunica through the sidecar:

- See `/comunica-sources` for the explicit-source pattern
- See `tests/pytest/test_sparql.py` for working code
- Reason: `@inrupt/solid-client` fetches one resource at a time; Comunica handles link-traversal + federation

For single-resource read/write, follow upstream patterns. For cross-resource queries, switch to Comunica.

### Memento support is local

Upstream has no Memento. To consume our Pod's time-travel surface:

```typescript
// Fetch closest-prior version via Accept-Datetime
const r = await fetch("http://pod.example/note.md", {
  headers: { "Accept-Datetime": "Wed, 15 Apr 2026 12:00:00 GMT" }
});
// → 302 redirect to .../note.md?version=YYYYMMDDHHMMSS
// → follow redirect; response carries Memento-Datetime header + body
```

```typescript
// Fetch the TimeMap
const tm = await fetch("http://pod.example/note.md?ext=timemap",
                      { headers: { Accept: "text/turtle" } });
// → Turtle listing of all Mementos with memento:mementoDatetime
```

```typescript
// Detect tombstone
const r = await fetch("http://pod.example/note.md");
if (r.status === 410) {
  // resource was deleted; TimeMap still reachable via Link rel="timemap" header
}
```

See `tests/pytest/test_memento.py` for fully-worked examples; the same patterns translate directly to JS clients.

### solid-agent-skills CLI (D29)

For multi-Pod operations across the broader fabric, the sibling repo `~/dev/git/LA3D/agents/solid-agent-skills` provides a programmatic CLI (Bashlib-based) and 5 Claude Code skills. Reach for it when:

- You need to operate on multiple Pods (the CLI knows about pod roots)
- You're integrating Pod operations into a multi-step agent skill
- You want the Tier-3 (specialized) layer of D55's three-tier access

For one-off operations against THIS Pod, raw HTTP via `httpx` / `fetch` is fine.

### LDO and `solid/object` (D47)

Upstream `integration-guide.md` covers LDO (Linked Data Objects). Our medium-term direction (D47) is to prefer **`solid/object`** — shape-derived typed TypeScript classes generated from `solid/shapes` catalog — over LDO. Reasons in D47. For Rung 1.x we use ad-hoc N3.js / `@inrupt/solid-client` patterns; the proper `solid/object` integration lands in a future rung.

### Authentication during dev

In dev (`dev-allow-all.json`), the Pod accepts unauthenticated writes. Don't carry auth tokens unless you're testing the auth path itself. For production VC-gated operations (Rung 1.3), use `@inrupt/solid-client-authn-node` with a delegation VC; see D25 + D62.

## Common patterns for harness skills

### Discovering the storage description

```typescript
const root = await fetch("http://pod.example/");
const linkHeader = root.headers.get("Link");
// Parse Link rel="http://www.w3.org/ns/solid/terms#storageDescription"
// Fetch that URI for void:vocabulary declarations and Memento support flags
```

### Following the Type Index

```typescript
const profile = await fetch("http://pod.example/profile/card");
// Profile carries solid:publicTypeIndex IRI
// Fetch the type index — each registration maps RDF class → instanceContainer
// Now you know where to look for resources of that class
```

### Reading a resource + its .meta

```typescript
const body = await (await fetch(url)).text();           // Markdown/PDF/etc body
const meta = await (await fetch(`${url}.meta`, {
  headers: { Accept: "text/turtle" }
})).text();                                              // RDF metadata sidecar
// Body and .meta are independent; both first-class per D57 (hybrid contextualized KG)
```

## Reference implementations

- `tests/pytest/test_sparql.py` — Comunica integration via httpx
- `tests/pytest/test_memento.py` — Memento protocol via httpx + rdflib
- `scripts/lib/ldp_client.py` — minimal LDP put/patch/get pattern
- `~/dev/git/LA3D/agents/solid-agent-skills/` — programmatic CLI for multi-Pod operations

## Related skills

- `/comunica-sources` — SPARQL query patterns over the Pod
- `/solid-spec` — protocol-level reference
- `/monitoring-store` — if you're tailing pod changes (server-side; clients use D56 Solid Notifications when that lands)
- `/decision-lookup` — pull specific D-numbered decisions
