---
paths: ["**/docker-compose*.yml", "**/Dockerfile*"]
---

# Docker Patterns

## Three-service stack

```yaml
services:
  css:              # Community Solid Server (TypeScript/Node.js)
    image: solidproject/community-server:7
    ports: ["3000:3000"]
    volumes:
      - css-data:/data
      - ./css/config:/config:ro

  adapter:          # Python FastAPI gateway
    build: ./adapter
    ports: ["8080:8080"]
    depends_on: [css, oxigraph]
    volumes:
      - ./shapes:/app/shapes:ro
      - ./ontology:/app/ontology:ro

  oxigraph:         # Fabric metadata store (catalog, crosswalks only)
    image: ghcr.io/oxigraph/oxigraph:latest
    ports: ["7878:7878"]
    volumes:
      - oxigraph-data:/data

volumes:
  css-data:
  oxigraph-data:
```

## Port conventions
- 3000: CSS (Community Solid Server)
- 8080: Python adapter (FastAPI gateway)
- 7878: Oxigraph SPARQL (internal only in production; exposed for dev)

## CSS container
- Official image: `solidproject/community-server:7`
- Config via `-c /config/solid-config.json`
- File backend via `-f /data`
- Base URL via `-b http://localhost:3000`
- Named volume for `css-data` — not bind mount (macOS permission issues)

## Apple Silicon
- CSS image is multi-arch (no issue)
- If adding Credo sidecar later: `platform: linux/amd64` required (Askar ARM unavailable)

## Health checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/.well-known/solid"]
  interval: 10s
  timeout: 5s
  retries: 3
```

## Named volumes
Use named volumes for persistence — not bind mounts.
Bind mounts cause permission issues on macOS Docker Desktop.
Exception: read-only config/shapes/ontology use bind mounts (`:ro`).
