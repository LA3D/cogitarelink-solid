# `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` from Comunica against mkcert-backed Pod

## Short diagnosis

Node.js does **not** read the macOS Keychain. It ships with its own bundled CA list (Mozilla's, baked into the binary). `curl` and your browser are happy because:

- `curl` on macOS (the Apple-shipped one) reads the system trust store via Secure Transport.
- Browsers read Keychain / their own NSS store.

mkcert's `mkcert -install` adds the CA to Keychain (and Firefox's NSS DB, and on Linux to the system store), but it does **not** patch Node.js. Node has its own embedded CA bundle and only adds extras when you tell it to via `NODE_EXTRA_CA_CERTS`, an `https.Agent({ ca: ... })`, or `--use-system-ca` (Node 22.10+).

So Comunica's underlying `node-fetch` / `undici` request fails the chain build at the leaf cert because it can't find the mkcert root that signed it. Hence `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.

The fact that you're running Comunica **inside a Docker container** makes it worse: even if you fixed Node trust on the host, the container has its own filesystem and its own Node binary with its own (empty of your mkcert root) CA situation. The mkcert CA on the host's Keychain is invisible to the container.

## Concrete fix (without disabling validation)

You need to (a) get the mkcert root CA PEM file, and (b) make Node inside the container trust it.

### Step 1 — Find the mkcert root CA on the host

```bash
mkcert -CAROOT
# typically: /Users/cvardema/Library/Application Support/mkcert
ls "$(mkcert -CAROOT)"
# rootCA.pem  rootCA-key.pem
```

`rootCA.pem` is what you need. Do **not** ship `rootCA-key.pem` anywhere — that's the private key that lets anyone mint trusted certs for your machine.

### Step 2 — Mount the CA into the Comunica container and point Node at it

Two clean options.

**Option A — `NODE_EXTRA_CA_CERTS` (simplest, works on every Node version):**

In your `docker-compose.yml` for the Comunica sibling:

```yaml
services:
  comunica:
    # ...
    volumes:
      - ${HOME}/Library/Application Support/mkcert/rootCA.pem:/usr/local/share/ca-certificates/mkcert-root.crt:ro
    environment:
      NODE_EXTRA_CA_CERTS: /usr/local/share/ca-certificates/mkcert-root.crt
```

Then restart: `docker compose up -d comunica`. Inside the container, `node -e 'require("https").get("https://pod.vardeman.me:3000/", r => console.log(r.statusCode))'` should print `200` with no `-k`-equivalent.

**Option B — bake it into the image:**

```Dockerfile
COPY mkcert-rootCA.pem /usr/local/share/ca-certificates/mkcert-root.crt
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/mkcert-root.crt
```

(Copy `rootCA.pem` into the build context first; do not copy `rootCA-key.pem`.)

### Step 3 — Make sure the hostname is reachable from the container

You're using `pod.vardeman.me` (per your dev config), which resolves to `127.0.0.1` on the host via `/etc/hosts`. From inside the Comunica container, `127.0.0.1` is the container itself, not the host, and `pod.vardeman.me` won't resolve at all. Two fixes:

- If the Pod is another container in the same compose project, use the service name (e.g. `https://css:3000/`) and **re-issue the mkcert cert with that SAN**: `mkcert pod.vardeman.me css localhost 127.0.0.1`.
- Or add `extra_hosts: ["pod.vardeman.me:host-gateway"]` to the Comunica service so the hostname resolves to the host's published port.

The cert's SAN list has to include whatever hostname Comunica actually dials, or you'll trade `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` for `ERR_TLS_CERT_ALTNAME_INVALID`.

### Step 4 — Verify

From inside the container:

```bash
docker compose exec comunica node -e "
  require('https').get('https://pod.vardeman.me:3000/', r => {
    console.log('status', r.statusCode, 'authorized', r.socket.authorized);
  }).on('error', e => console.error(e.code, e.message));
"
```

Expect `status 200 authorized true`.

Then re-run your Comunica federation script. The `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` should be gone.

## Why not the alternatives

- `--use-system-ca` (Node ≥22.10) works on the host but is a no-op inside most Linux containers since there's no Keychain there. Stick with `NODE_EXTRA_CA_CERTS` for the container.
- `NODE_TLS_REJECT_UNAUTHORIZED=0` disables validation globally — exactly what you asked to avoid, and it masks the SAN-mismatch class of bugs that bite next.
- Passing a custom `https.Agent({ ca })` into Comunica works in principle but Comunica's HTTP layer doesn't expose an agent hook cleanly across all actors; `NODE_EXTRA_CA_CERTS` short-circuits the whole question.

## TL;DR

Node doesn't trust Keychain. Mount `$(mkcert -CAROOT)/rootCA.pem` into the Comunica container and set `NODE_EXTRA_CA_CERTS` to point at it. Also make sure the hostname the container dials is in the cert's SAN list and resolves from inside the container.
