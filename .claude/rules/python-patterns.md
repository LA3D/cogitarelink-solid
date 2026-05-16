---
paths: ["**/*.py"]
---

# Python Patterns

Python is client-only — CLI tools, tests, RLM agent integration. No Python in the server stack.

## Environment

- Global uv venv at `~/uvws/.venv` (Python 3.12). Always use `~/uvws/.venv/bin/python` for tool invocations; never create a project-local venv.
- Install project in dev mode: `uv pip install -e ".[test]"`. Add deps: `uv pip install <package>`.
- Tests: `~/uvws/.venv/bin/python -m pytest tests/ -v`.

## Style (fastai philosophy)

- Brevity facilitates reasoning — one concept per screen.
- Abbreviations: `g` for graph, `ep` for endpoint, `res` for resource, `ctr` for container.
- No comments unless explaining WHY.
- No docstrings on internal functions; type hints on public functions only.
- No auto-linter formatting; maintain intentional style.

## Async vs sync

- CLI tools and tests: async/await with `httpx.AsyncClient`; use `asyncio.gather` for parallel requests.
- RLM sandbox tools must be sync (dspy.RLM limitation).
- RLM tools return error strings (not exceptions) so the agent can reason about failures. Everywhere else, raise specific exceptions at system boundaries.

## Key packages

rdflib (7.x), pyshacl, owlrl, httpx, pyyaml. Standard library usage applies — no project-specific wrappers.
