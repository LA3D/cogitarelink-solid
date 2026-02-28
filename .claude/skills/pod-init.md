# /pod-init

Scaffold a new Pod configuration: CSS config, Python adapter stub, docker-compose service, .well-known/ templates.

## Usage
```
/pod-init [--port <css-port>] [--adapter-port <adapter-port>]
```
Example: `/pod-init --port 3000 --adapter-port 8080`

## Steps

1. **CSS configuration** (`css/config/`):
   - `solid-config.json` — Components.js config importing `@css:config/file.json`
   - File backend, WAC authorization, dev token provider
   - Storage path: `/data`

2. **Python adapter** (`adapter/`):
   - `Dockerfile` — Python 3.12-slim
   - `requirements.txt` — fastapi, uvicorn, httpx, rdflib
   - `main.py` — FastAPI app with:
     - `.well-known/void` (VoID service description)
     - `.well-known/shacl` (SHACL shapes, `{base}` substitution)
     - `/health` endpoint
     - LDP proxy to CSS (optional)

3. **docker-compose.yml** entry:
   - CSS service (image, ports, volumes, healthcheck)
   - Adapter service (build context, depends_on CSS)
   - Oxigraph service (fabric metadata)
   - Named volumes for persistence

4. **Shared artifacts**:
   - `shapes/concept-note.ttl` — initial SHACL shape
   - `ontology/solid-pod-profile.ttl` — PROF CoreProfile for Pod

5. Report: files created + next steps (docker compose up, verify health, import vault)
