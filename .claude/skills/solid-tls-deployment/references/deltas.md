# TLS Deployment — Project Deltas (cogitarelink-solid)

What this Pod uses today, and the production plan. Read this when you're working *in this repo* and need to know specifics like cert paths or which Path (1/2/3/4) is in play.

---

## Dev: Path 1 (mkcert + CSS native HTTPS)

### Cert generation

```bash
brew install mkcert nss
mkcert -install
mkdir -p css/certs && cd css/certs
mkcert -cert-file pod.crt -key-file pod.key \
  pod.vardeman.me localhost 127.0.0.1 ::1
cp "$(mkcert -CAROOT)/rootCA.pem" ./rootCA.pem
```

`css/certs/` is in `.gitignore` — never commit the key.

### docker-compose

CSS listens on internal port 443 (it runs as root in the Alpine container). External port mapping `443:443`. baseUrl `https://pod.vardeman.me` — no port appears in IRIs.

```yaml
services:
  css:
    ports:
      - "443:443"
    networks:
      default:
        aliases: [pod.vardeman.me]
    volumes:
      - css-data:/data
      - ./css/config:/config:ro
      - ./css/certs:/certs:ro
    environment:
      NODE_EXTRA_CA_CERTS: /certs/rootCA.pem
    command:
      - -c
      - /config/solid-config.json
      - -f
      - /data
      - -b
      - https://pod.vardeman.me
      - -p
      - "443"
      - --httpsKey
      - /certs/pod.key
      - --httpsCert
      - /certs/pod.crt
      - --seedConfig
      - /config/seed.json
    healthcheck:
      test: ["CMD", "wget", "--no-check-certificate", "-q", "--spider",
             "--header", "Host: pod.vardeman.me", "https://localhost/"]
```

### CSS config

`css/config/dev-allow-all.json` imports `@css:config/http/server-factory/https.json` (NOT `http.json`). This is the only place the HTTPS config gets pulled in — adding it as a second `-c` flag would cause the "multiple configurator" error (see `troubleshooting.md`).

### Sibling-container env

The `pod-setup` container mounts the certs read-only and sets `SSL_CERT_FILE` / `REQUESTS_CA_BUNDLE` for Python httpx, and `NODE_EXTRA_CA_CERTS` for any Node.js client called from setup scripts.

## Prod: Path 3 (Caddy + Let's Encrypt DNS-01) — deferred

Plan, not yet implemented:

- Caddy reverse proxy in front of CSS (CSS reverts to plain HTTP behind it, port 3000)
- DNS-01 challenge against `pod.vardeman.me` via the registrar's API
- Same baseUrl (`https://pod.vardeman.me`) so vocabulary IRIs don't change between dev and prod
- Automatic 60-day renewal via Caddy

Detail in `setup.md` Path 3. To activate: build a Caddy image with the DNS provider plugin (xcaddy), point DNS at the prod host's public IP, write a `Caddyfile`, and Caddy handles the rest.

## What we don't do

- **w3id.org for vocabulary IRIs** — per-Pod vocabulary is hosted on the Pod itself (see `solid-uri-conformance` deltas). w3id is reserved for cross-Pod shared profiles only.
- **HSTS** — off in dev. Will turn on in prod with `max-age=300` as a starting point.
- **Wildcard certs** — single-host cert is sufficient; no subdomain Pods yet.

## Sibling skills

- `solid-uri-conformance` — what changes at the IRI layer once HTTPS is up (vocabularies become `https://`, port disappears)
- `solid-spec` — Solid Protocol §3 HTTPS mandate
- `solid-servers` — CSS server configuration in general
