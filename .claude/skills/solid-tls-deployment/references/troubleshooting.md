# TLS Troubleshooting

Common failures and the actual fix. Symptoms come from real deployments.

---

## `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` / `self-signed certificate in certificate chain`

**Cause**: Node.js does not read the macOS Keychain or Linux system trust store. Even after `mkcert -install` succeeds, Node has no idea your local CA exists.

**Fix**: tell Node.js where the CA root is.

```bash
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"
```

Add to your shell rc. Add to every Docker container env. Affects:

- Comunica (any of `@comunica/*`)
- Bashlib (`solid-bashlib`)
- `@inrupt/solid-client-authn-node`
- Any `node-fetch` or `axios` call in custom code

If the variable is set but Node still can't find the file: the path is wrong, or the file isn't readable inside the container (check the volume mount).

---

## Python `httpx` / `requests`: same error, different fix

**Cause**: Python's SSL stack uses OpenSSL trust, not Keychain.

**Fix**:

```bash
export SSL_CERT_FILE="$(mkcert -CAROOT)/rootCA.pem"        # httpx
export REQUESTS_CA_BUNDLE="$(mkcert -CAROOT)/rootCA.pem"    # requests
```

Alternatively, pass `verify=<path>` per call. Don't use `verify=False` outside throwaway debugging — it disables certificate validation entirely.

---

## CSS startup error: "Detected multiple values for parameter `BaseServerFactory_configurator`"

**Cause**: Both `http.json` and `https.json` server-factory configs got imported. They each set the `configurator` parameter on `urn:solid-server:default:ServerFactory`, and Components.js refuses to resolve the conflict.

**Fix**: Import only one server-factory config. The cleanest path is to change `dev-allow-all.json` (or whichever config holds your server-factory import) to use `https.json`:

```diff
   "import": [
-    "css:config/http/server-factory/http.json",
+    "css:config/http/server-factory/https.json",
   ]
```

If you tried to add `-c @css:config/http/server-factory/https.json` as a second CLI flag, remove it — the file you already import transitively pulls in `http.json`, so you've got both.

---

## HTTP 500 on `/.well-known/solid` (or any URL) from sibling containers

**Cause**: CSS validates the Host header against its `--baseUrl`. If your `--baseUrl` is `https://pod.example.org` (port-less, implying 443), but a client connects to CSS at `https://pod.example.org:3443`, httpx auto-includes the port in the Host header (`pod.example.org:3443`), CSS sees the mismatch, and returns 500.

**Fix**: align internal and external ports. Either:

- Bind CSS on the internal port that matches the external port (e.g. internal 443, external 443:443), or
- Use Caddy as a reverse proxy that rewrites Host header from `:3443` to no-port before forwarding to CSS

The symptom from outside the docker network (host curl on port 443) is "everything works"; from inside the network (where the sibling container hits port 3443), the same URL returns 500. Surface this by always testing from both the host AND from a sibling container.

---

## Browser permanent pinning (Chrome especially)

**Cause**: HSTS or per-site security state pins TLS settings. If a user clicked through a self-signed warning early on, Chrome remembers and may refuse the new mkcert cert until site data is cleared.

**Fix**: in Chrome, `chrome://net-internals/#hsts` → "Delete domain security policies" → enter the hostname. Or just clear all data for that host.

**Prevent**: don't set HSTS in dev. Production HSTS is fine but start `max-age=300` and ratchet up only after you're sure you'll never need to debug over HTTP.

---

## `mkcert -install` fails or partially succeeds

**Symptom**: `mkcert -install` finishes but `security find-certificate` doesn't show the CA. Or it errors on the NSS database.

**Fix attempt 1**: install nss first, then re-run install:

```bash
brew install nss
mkcert -install
```

**Fix attempt 2**: re-run with verbose output to see which trust store failed:

```bash
mkcert -install -verbose
```

If the System Keychain succeeded but NSS failed, Firefox will fall back to "untrusted" warnings while Chrome/Safari (which read Keychain) work fine.

---

## Container clock skew vs cert `notBefore`

**Symptom**: "certificate is not yet valid" errors despite a valid-looking cert.

**Cause**: Docker container clock is more than 5 minutes behind the host clock. Common on Linux hosts after suspend/resume.

**Fix**: restart Docker Desktop or run `hwclock --hctosys` inside the container. Verify with `date` matching the host's `date`.

---

## CSS reads cert path but throws on startup

**Symptom**: CSS logs `ENOENT: no such file or directory, open '/certs/pod.key'` despite the file existing on the host.

**Fix**: volume mount missing or wrong path. Check `docker compose config` output to verify the mount resolves, then `docker compose exec css ls /certs/` to verify what the container sees.

---

## Cert expired in dev

**Symptom**: mkcert cert worked for years, suddenly TLS errors.

**Cause**: cert validity caps at 825 days for user-installed CAs on Apple platforms ([per Apple's cert policy](https://support.apple.com/en-us/HT211025) and mkcert's [issue #324](https://github.com/FiloSottile/mkcert/issues/324)).

**Fix**: regenerate the cert (the CA root itself is good for ~10 years):

```bash
cd css/certs
mkcert -cert-file pod.crt -key-file pod.key \
  pod.example.org localhost 127.0.0.1 ::1
```

Restart CSS.

---

## Let's Encrypt HTTP-01 fails for a Pod that's only on `/etc/hosts`

**Cause**: `/etc/hosts` is loopback-only. Let's Encrypt's validation servers can't reach the Pod from the public internet, so HTTP-01 challenge fails.

**Fix**: switch to DNS-01 challenge. Requires:

1. The Pod hostname is a real public DNS name (i.e. you control it at a registrar)
2. The registrar has API-controllable DNS (Cloudflare, Route53, DigitalOcean, etc.)
3. A Caddy image built with the DNS provider plugin (or another ACME client that supports DNS-01)

DNS-01 doesn't require the Pod to be publicly reachable — only DNS records to be writable. Works fine with `/etc/hosts` for local resolution.

---

## CSS health check fails immediately after switching to HTTPS

**Symptom**: `docker compose ps` shows healthy, then unhealthy, then container exits.

**Cause**: The healthcheck still uses `http://localhost:3000/` but CSS is now on `https://localhost:443/`.

**Fix**: update the healthcheck:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-check-certificate", "-q", "--spider",
         "--header", "Host: pod.example.org", "https://localhost/"]
```

The `--no-check-certificate` flag is fine here — it's a container-internal probe, not user-facing. The Host header bypasses CSS's baseUrl validation since the request resolves to localhost.
