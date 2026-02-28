# Local dev overrides — not committed (gitignored)

## Running services
CSS=http://localhost:3000
ADAPTER=http://localhost:8080
OXIGRAPH_DIRECT=http://localhost:7878

## Local paths
VAULT=~/Obsidian/obsidian
SOLID_REPO=~/dev/git/LA3D/agents/cogitarelink-solid
FABRIC_REPO=~/dev/git/LA3D/agents/cogitarelink-fabric
RLM_REPO=~/dev/git/LA3D/agents/rlm

## Python (global uv venv — use for Claude Code tool invocations)
PYTHON=~/uvws/.venv/bin/python
# Packages: rdflib, pyshacl, owlrl, httpx
# Install project: uv pip install -e ".[test]"
