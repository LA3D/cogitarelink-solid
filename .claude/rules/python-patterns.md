---
paths: ["**/*.py"]
---

# Python Patterns

## Environment

Python is client-only — CLI tools, tests, RLM agent integration. No Python in the server stack.

| Context | Python | Key packages |
|---|---|---|
| **Claude Code tool use** | `~/uvws/.venv/bin/python` (3.12) | rdflib, pyshacl, owlrl, httpx, pyyaml |

## Package management — uv

Global venv at `~/uvws/.venv`, managed by `uv`:

```bash
# Install project in dev mode
uv pip install -e ".[test]"

# Add a dependency
uv pip install <package>

# Run tests
~/uvws/.venv/bin/python -m pytest tests/ -v

# Ad-hoc RDF/SPARQL work
~/uvws/.venv/bin/python
```

Always use `~/uvws/.venv/bin/python` for Claude Code tool invocations, not system Python.
Never create a project-local venv — use the global uv workspace.

## Style (fastai philosophy)
- Brevity facilitates reasoning — one concept per screen
- Abbreviations: `g` for graph, `ep` for endpoint, `res` for resource, `ctr` for container
- No comments unless explaining WHY
- No docstrings on internal functions; type hints on public functions only
- No auto-linter formatting; maintain intentional style

## RDF — rdflib 7.x

```python
from rdflib import Graph, Dataset, Namespace, URIRef, Literal
from rdflib.namespace import RDF, RDFS, SKOS, PROV, DCAT, DCTERMS, FOAF

# Parse Turtle / JSON-LD
g = Graph()
g.parse("resource.ttl", format="turtle")
g.parse("index.jsonld", format="json-ld")

# Serialize
g.serialize("out.ttl", format="turtle")
g.serialize("out.jsonld", format="json-ld")
```

## HTTP — httpx

```python
import httpx

# Sync for RLM sandbox tools (dspy.RLM requires sync)
def sparql_query(query: str, endpoint: str = "http://localhost:8080/sparql") -> str:
    r = httpx.post(endpoint, data={"query": query},
                   headers={"Accept": "application/sparql-results+json"},
                   timeout=30.0)
    r.raise_for_status()
    return r.text

# Async for CLI tools and tests
async with httpx.AsyncClient(base_url="http://localhost:3000") as client:
    # LDP container listing
    r = await client.get("/vault/concepts/",
                         headers={"Accept": "text/turtle"})
    # Create resource (LDP POST)
    r = await client.post("/vault/concepts/",
                          content=turtle_bytes,
                          headers={"Content-Type": "text/turtle",
                                   "Slug": "context-graphs"})
```

## SHACL Validation — pyshacl

```python
from pyshacl import validate

conforms, report_g, report_text = validate(
    data_graph=data_g,
    shacl_graph=shapes_g,
    inference="rdfs",
    advanced=True,
)
```

## RLM Agent Tool Pattern (from cogitarelink-fabric)

```python
def make_pod_query_tool(ep, max_chars=10_000):
    """Closure bound to a discovered endpoint — same pattern as fabric."""
    def sparql_query(query: str) -> str:
        r = httpx.post(ep.sparql_url, data={"query": query},
                       headers={"Accept": "application/sparql-results+json"},
                       timeout=30.0)
        r.raise_for_status()
        txt = r.text
        if len(txt) > max_chars:
            return txt[:max_chars] + f"\n... truncated ({len(txt)} total chars)."
        return txt
    return sparql_query
```

## Async-first (for CLI tools)

All IO in CLI tools: async/await. Use `asyncio.gather` for parallel requests.
No blocking calls in async context.
Exception: RLM sandbox tools must be sync (dspy.RLM limitation).

## Error handling

Raise specific exceptions at system boundaries. Don't catch-all internally.
RLM tools return error strings (not exceptions) so the agent can reason about failures.
