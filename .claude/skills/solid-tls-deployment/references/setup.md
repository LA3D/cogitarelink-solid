# TLS Setup — Commands

Three paths, ordered from simplest dev to production. Pick one.

---

## Path 1 — mkcert + CSS native HTTPS (recommended for dev)

[mkcert](https://github.com/FiloSottile/mkcert) issues locally-trusted certificates. Install the CA once into the system trust store; thereafter, certificates issued by mkcert are trusted by browsers, curl, and (with one env var) Node.js.

### One-time setup

```bash
# macOS
brew install mkcert nss
mkcert -install  # installs CA into Keychain + NSS (prompts for sudo)

# Linux
# See https://github.com/FiloSottile/mkcert#installation for distro-specific
```

`mkcert -install` adds the root CA to:
- macOS System Keychain (where curl, browsers, `security` find it)
- NSS database (where Firefox finds it)
- Java cacerts (if Java is installed)

### Generate certs for your Pod

```bash
mkdir -p css/certs
cd css/certs

mkcert -cert-file pod.crt -key-file pod.key \
  pod.example.org localhost 127.0.0.1 ::1

# Copy the CA root for container mounts (Node trust)
cp "$(mkcert -CAROOT)/rootCA.pem" ./rootCA.pem
```

Validity: **825 days** (Apple's cap on user-installed CAs per [mkcert issue #324](https://github.com/FiloSottile/mkcert/issues/324)). When the cert expires, re-run the `mkcert -cert-file …` command — no automation.

**SANs always**: mkcert puts hostnames in the Subject Alternative Name field. CN is deprecated for hostname matching per RFC 2818 / [Chrome since 2017](https://chromestatus.com/feature/4981025180483584). List every hostname on the command line.

### Add to .gitignore

```
css/certs/
```

Private keys must never be committed.

### CSS docker-compose wiring

```yaml
services:
  css:
    image: cogitarelink-solid-css:latest
    ports:
      - "443:443"               # external 443 → internal 443
    networks:
      default:
        aliases: [pod.example.org]
    volumes:
      - css-data:/data
      - ./css/config:/config:ro
      - ./css/certs:/certs:ro   # mount certs read-only
    environment:
      NODE_EXTRA_CA_CERTS: /certs/rootCA.pem  # critical for Node trust
    command:
      - -c
      - /config/solid-config.json
      - -f
      - /data
      - -b
      - https://pod.example.org   # baseUrl — no port if external is 443
      - -p
      - "443"                     # internal port
      - --httpsKey
      - /certs/pod.key
      - --httpsCert
      - /certs/pod.crt
    healthcheck:
      test: ["CMD", "wget", "--no-check-certificate", "-q", "--spider",
             "--header", "Host: pod.example.org", "https://localhost/"]
      interval: 5s
      timeout: 5s
      retries: 12
```

### CSS HTTPS config import

CSS's default config imports `@css:config/http/server-factory/http.json`. To enable HTTPS, change that import to `@css:config/http/server-factory/https.json` in your top-level config (e.g. `dev-allow-all.json` or whichever file lists the server-factory import):

```diff
   "import": [
     ...
-    "css:config/http/server-factory/http.json",
+    "css:config/http/server-factory/https.json",
     ...
   ],
```

Do **not** add `https.json` as a second `-c` flag — Components.js will throw "Detected multiple values for parameter `BaseServerFactory_configurator`" because both http.json and https.json register a `configurator` on the same `@id`.

### Port binding

CSS in the container runs as root and `ip_unprivileged_port_start=0` on Alpine, so binding port 443 directly inside the container works. URL becomes `https://pod.example.org/` — no port. If you prefer not to run as root, map `443:3443` host:container and bind 3443 internally; clients hit `https://pod.example.org/` externally, but anything in the docker network must reach CSS at port 3443 (this creates a Host-header mismatch — see `troubleshooting.md`).

### Sibling-container clients

Any other container that talks to the Pod (a setup script, a Comunica sidecar, a test runner) needs the same NODE_EXTRA_CA_CERTS or SSL_CERT_FILE env var:

```yaml
  pod-setup:
    volumes:
      - ./css/certs:/certs:ro
    environment:
      SSL_CERT_FILE: /certs/rootCA.pem
      REQUESTS_CA_BUNDLE: /certs/rootCA.pem
      NODE_EXTRA_CA_CERTS: /certs/rootCA.pem
```

### Verify

```bash
# Should return 200 with no TLS verification flags
curl -s -o /dev/null -w "HTTP %{http_code}, TLS verify: %{ssl_verify_result}\n" \
  https://pod.example.org/

# Node.js should also work without rejectUnauthorized: false
NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem \
  node -e "require('https').get('https://pod.example.org/', r => console.log(r.statusCode))"
```

---

## Path 2 — Caddy reverse proxy + internal CA

When you want one TLS terminator across dev and prod. Caddy auto-issues from its own internal CA with `tls internal`.

```caddyfile
{
  local_certs
}

pod.example.org {
  reverse_proxy css:3000   # CSS speaks plain HTTP internally
}
```

```yaml
services:
  caddy:
    image: caddy:2-alpine
    ports: ["443:443", "80:80"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    networks:
      default:
        aliases: [pod.example.org]
  css:
    # No host port mapping needed; only caddy sees the host network
    # Keep -b https://pod.example.org so minted IRIs use external scheme/host
    command: [..., -b, https://pod.example.org, ...]
```

Caddy installs the internal CA into its data volume and tries to copy it into the host trust store ([per the docs](https://caddyserver.com/docs/automatic-https) this isn't guaranteed in containerized setups). Plan to `docker cp` it out and `security add-trusted-cert` manually, or use mkcert and feed Caddy the cert externally.

---

## Path 3 — Caddy + Let's Encrypt DNS-01 (production)

Real public certs. Requires:

1. A real DNS subdomain (e.g. `pod.example.org`) at a registrar with API-controllable DNS (Cloudflare, Route53, DigitalOcean, etc.).
2. A Caddy image built with the DNS provider plugin (via `xcaddy`).

```dockerfile
FROM caddy:builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

```caddyfile
pod.example.org {
  reverse_proxy css:3000
  tls {
    dns cloudflare {env.CLOUDFLARE_API_TOKEN}
  }
}
```

Validity is currently 90 days; automatic renewal every 60. ACME spec is moving to 47-day certs by 2029 ([see SSL Store](https://www.thesslstore.com/blog/47-day-ssl-certificate-validity-by-2029/)) — Caddy handles this automatically.

**HTTP-01 won't work** for a Pod that resolves only via `/etc/hosts` or only on the internal network. DNS-01 is the only Let's Encrypt path for Pods without a public-resolvable HTTP-reachable endpoint.

---

## Path 4 — CSS native + Let's Encrypt cert

Skip the reverse proxy by handing CSS `fullchain.pem` and `privkey.pem` from a `certbot --dns-cloudflare` run:

```yaml
command:
  - -c
  - /config/solid-config.json
  - -b
  - https://pod.example.org
  - --httpsKey
  - /certs/privkey.pem
  - --httpsCert
  - /certs/fullchain.pem
```

You'll need a renewal hook to reload CSS when certbot renews (CSS doesn't watch files). Usually a `SIGHUP` + container restart, or `inotifywait` on the cert path.

Not recommended unless you specifically want to avoid running a second container — Caddy's automatic renewal is much less operational burden.
