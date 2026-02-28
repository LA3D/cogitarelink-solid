---
paths: ["**/docker-compose*.yml", "**/Dockerfile*"]
---

# Docker Patterns

## Two-service stack (Phase 1)

```yaml
services:
  css:              # Community Solid Server (TypeScript/Node.js)
    image: solidproject/community-server:7
    ports: ["3000:3000"]
    volumes:
      - css-data:/data
      - ./css/config:/config:ro

  comunica:         # SPARQL-over-LDP sidecar (D28)
    image: node:20-slim
    ports: ["8080:8080"]
    entrypoint: ["npx", "--yes", "@comunica/query-sparql-solid-http"]
    command: ["http://css:3000/", "-p", "8080", "--lenient"]
    depends_on: [css]

volumes:
  css-data:
```

Phase 2 adds Oxigraph for fabric metadata federation (D4, D13).

## Port conventions
- 3000: CSS (Community Solid Server)
- 8080: Comunica SPARQL endpoint (was Python adapter)

## CSS container
- Official image: `solidproject/community-server:7`
- Config via `-c /config/solid-config.json`
- File backend via `-f /data`
- Base URL via `-b http://localhost:3000`
- Named volume for `css-data` — not bind mount (macOS permission issues)

## Comunica container
- Uses `node:20-slim` with npx to run `@comunica/query-sparql-solid-http`
- `--lenient` flag: log errors instead of crashing on invalid documents
- Queries CSS over internal Docker network (`http://css:3000/`)
- Exposes standard SPARQL Protocol at `http://localhost:8080/sparql`

## Apple Silicon
- CSS image is multi-arch (no issue)
- node:20-slim is multi-arch (no issue)
- If adding Credo sidecar later: `platform: linux/amd64` required (Askar ARM unavailable)

## Health checks
```yaml
# CSS
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/.well-known/solid"]
  interval: 10s
  timeout: 5s
  retries: 3
```

Comunica has no built-in health check; test via `curl /sparql?query=...`.

## Named volumes
Use named volumes for persistence — not bind mounts.
Bind mounts cause permission issues on macOS Docker Desktop.
Exception: read-only config/shapes/ontology use bind mounts (`:ro`).
