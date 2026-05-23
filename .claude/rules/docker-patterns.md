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

## Rebuild reproducibility (learned 2026-05-22 cross-machine debug)

- **Never declare a rebuild "verified" without `down -v`.** `make up` / `compose up`
  alone reuses the existing `css-data` volume; the substrate-bootstrap path that
  creates containers + applies overlays only runs on a fresh volume. Use `make reset`
  for verification.
- **`ensure_container` HEAD-skip masks constraint regressions.** It does
  `HEAD → 200 → return` (idempotent), so a container created before a regression is
  reused on restart and the bug stays latent. Any change to a path constraint,
  `ldp:constrainedBy` shape, or container-creation-time validation MUST be tested via
  a fresh-volume rebuild, not an in-place restart.
- **Path constraints govern children at `<pathPrefix>*`, not the container itself.**
  When adding a path constraint, test both a container-bootstrap case (PUT to the
  constraint path → must pass; the matcher skips `resourcePath === pathPrefix`) and a
  child-resource case (PUT under the prefix → enforced).
- **Every overlay in `overlays/` must be wired into `docker-compose.yml`'s pod-setup
  command**, in dependency order (wiki-memory → addressbook → owner-identity). An
  overlay with integration tests but no compose entry is a reproducibility hole —
  cross-machine rebuilds will silently miss it. Anything done by hand to the live Pod
  that isn't in `docker-compose.yml` + the in-repo overlay/config tree is lost on the
  next machine.
