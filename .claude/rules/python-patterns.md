---
paths: ["**/*.py"]
---

# Python Patterns

## Environments

Two environments — know which one applies:

| Context | Python | Key packages |
|---|---|---|
| **Claude Code tool use** | `~/uvws/.venv/bin/python` (3.12) | rdflib, pyshacl, owlrl, httpx |
| **Adapter Docker** | Docker container (Python 3.12-slim) | FastAPI, uvicorn, httpx, rdflib |

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

## HTTP — httpx (async)

```python
import httpx

async with httpx.AsyncClient(base_url=CSS_URL) as client:
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

## FastAPI Pattern (adapter)

```python
from contextlib import asynccontextmanager
import httpx

@asynccontextmanager
async def lifespan(app):
    app.state.css = httpx.AsyncClient(base_url=CSS_URL)
    app.state.oxigraph = httpx.AsyncClient(base_url=OXIGRAPH_URL)
    yield
    await app.state.oxigraph.aclose()
    await app.state.css.aclose()

app = FastAPI(lifespan=lifespan)
```

## Async-first

All IO: async/await. Use `asyncio.gather` for parallel requests.
No blocking calls in async context.

## Error handling

Raise specific exceptions at system boundaries. Don't catch-all internally.
