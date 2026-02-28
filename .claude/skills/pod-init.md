# /pod-init

Scaffold a new Pod configuration: CSS config, docker-compose service, shared artifacts.

## Usage
```
/pod-init [--port <css-port>] [--sparql-port <comunica-port>]
```
Example: `/pod-init --port 3000 --sparql-port 8080`

## Steps

1. **CSS configuration** (`css/config/`):
   - `solid-config.json` — Components.js config importing `@css:config/file.json`
   - File backend, WAC authorization, dev token provider
   - Storage path: `/data`

2. **docker-compose.yml** entry:
   - CSS service (image, ports, volumes, healthcheck)
   - Comunica service (node:20-slim, npx @comunica/query-sparql-solid-http, depends_on CSS)
   - Named volumes for persistence

3. **Shared artifacts**:
   - `shapes/concept-note.ttl` — initial SHACL shape
   - `ontology/solid-pod-profile.ttl` — PROF SolidPodProfile

4. Report: files created + next steps (docker compose up, verify health, import vault)
