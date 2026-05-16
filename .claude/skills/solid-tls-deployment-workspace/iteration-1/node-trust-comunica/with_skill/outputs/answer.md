# Why Comunica throws `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` against your mkcert Pod

## Diagnosis

This is the single most common stumbling block when moving a CSS Pod from plain HTTP to mkcert-backed HTTPS, and it is not a problem with your cert or with `mkcert -install`.

**Node.js does not read the macOS Keychain.** It uses its own bundled CA list (Mozilla's CA bundle, compiled into the binary). curl and your browser both read Keychain, which is why they trust the mkcert leaf cert and Node refuses to. `security find-certificate` is finding the CA exactly where mkcert put it; Node simply never looks there.

The result: TLS handshake → CSS presents `pod.crt` signed by your mkcert root → Node walks the chain → can't find the issuer in its built-in bundle → `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Identical symptom would appear with Bashlib, `@inrupt/solid-client-authn-node`, `node-fetch`, `axios`, anything running on Node.

(Python has the same architecture problem with a different fix — OpenSSL trust store, not Keychain. `httpx`/`requests` would throw the same class of error and would need `SSL_CERT_FILE` / `REQUESTS_CA_BUNDLE`. Worth knowing because your vault importer is Python.)

## The fix

Point Node at the mkcert CA root via `NODE_EXTRA_CA_CERTS`. This is the supported, validation-preserving knob — it adds CAs to Node's trust set; it does not disable verification.

### On your host (where you run `node` directly)

```bash
echo 'export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"' >> ~/.zshrc
source ~/.zshrc
node -e 'console.log(process.env.NODE_EXTRA_CA_CERTS)'   # sanity check
```

### In the Comunica Docker sibling container (this is the part that bites people)

The env var has to be set **inside the container**, and the CA file has to be **readable inside the container** — setting `NODE_EXTRA_CA_CERTS` in your host shell does nothing for the sibling.

In `docker-compose.yml` for the Comunica service:

```yaml
services:
  comunica:
    # ... existing config ...
    environment:
      - NODE_EXTRA_CA_CERTS=/certs/rootCA.pem
    volumes:
      - ${HOME}/Library/Application Support/mkcert:/certs:ro
```

(`mkcert -CAROOT` on macOS prints `~/Library/Application Support/mkcert` — that's the directory holding `rootCA.pem` and `rootCA-key.pem`. Mount it read-only; you never want the key file writable from a sibling container.)

Then:

```bash
docker compose up -d --force-recreate comunica
docker compose exec comunica node -e 'console.log(process.env.NODE_EXTRA_CA_CERTS); require("fs").accessSync(process.env.NODE_EXTRA_CA_CERTS)'
# should print the path with no exception
```

### Verify end-to-end

```bash
docker compose exec comunica node -e "
  require('https').get('https://pod.vardeman.me/.well-known/solid', r => {
    console.log('OK', r.statusCode);
  }).on('error', e => console.error('FAIL', e.code));
"
```

If you see `OK 200`, your federation script will work. If you still see `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, the file path is wrong inside the container or the volume mount didn't take — `docker compose exec comunica ls -l /certs/` will tell you which.

## Do not reach for these

- **`NODE_TLS_REJECT_UNAUTHORIZED=0`** — disables certificate validation globally for the Node process. You'd be back to plain-HTTP security with extra steps. The skill flags this; don't do it.
- **`rejectUnauthorized: false`** in a Comunica HTTP options block — same problem, scoped narrower but still off.
- **Re-running `mkcert -install`** — won't help. The CA is already installed in Keychain; Keychain isn't where Node looks.

## Why this matters beyond "make the error go away"

You're about to mint vocabulary IRIs under `https://pod.vardeman.me/...` (D79 hybrid vocab + Pod-local Category-3 hosting per D83). Every Node-based client that dereferences those IRIs — Comunica, Bashlib, the `solid-pod` CLI in `solid-agent-skills` — needs to trust the chain. Setting `NODE_EXTRA_CA_CERTS` once, in your shell rc and in every container env, is the durable fix. When you move to production with Caddy + Let's Encrypt, you drop the variable entirely because the LE chain is in Node's bundled trust.

## Related gotcha worth pre-empting

If after fixing the trust issue you start seeing HTTP 500 from the sibling container (but the host works fine), check whether CSS's `--baseUrl` matches what the sibling's Host header carries — `httpx`/Node will auto-include a non-443 port and CSS rejects the mismatch. Skill troubleshooting doc covers it under "HTTP 500 on `/.well-known/solid` from sibling containers."
