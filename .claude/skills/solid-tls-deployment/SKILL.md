---
name: solid-tls-deployment
description: TLS deployment for a Solid Pod (Community Solid Server). mkcert for local dev, Caddy + Let's Encrypt for production, Node.js / Python trust-store gotchas. Use when setting up HTTPS on a CSS Pod, debugging TLS errors (UNABLE_TO_GET_ISSUER_CERT_LOCALLY, self-signed certificate chain), choosing between native CSS HTTPS and reverse proxy, generating dev certificates, or addressing the Solid Protocol §3 HTTPS mandate. Also invoke whenever someone mentions cert renewal, port 443, Caddy, mkcert, Let's Encrypt, or HSTS in a Pod context.
---

# Solid TLS Deployment

How to serve a Solid Pod over HTTPS so vocabulary IRIs can be `https://`, no `-k` flag is needed for clients, and Node.js / Python tooling trusts the cert without ad-hoc environment overrides. Companion: [`solid-uri-conformance`](../solid-uri-conformance/SKILL.md) for why this matters at the IRI layer.

## The Solid Protocol HTTPS mandate

[Solid Protocol §3](https://solidproject.org/TR/protocol) (HTTP behaviour):

> "HTTPS is required; HTTP → HTTPS redirect if both schemes are exposed."

Plain-HTTP dev Pods are non-conformant. They also force every vocabulary IRI to encode the scheme (`http://`) and often the port — which then breaks the moment the Pod moves to production HTTPS. Get TLS up before minting any production-shaped IRIs.

## Pick your path

| Path | When |
|---|---|
| **mkcert + CSS native HTTPS** | Local dev. No reverse proxy. Cert valid 825 days, no renewal in dev. |
| **Caddy reverse proxy + internal CA** | Local dev when you want the same TLS terminator you'll use in prod. |
| **Caddy + Let's Encrypt DNS-01** | Production. Real DNS subdomain, automatic 60-day renewal. |
| **CSS native + real LE cert** | Single-container prod without a reverse proxy. Manual renewal hook required. |
| Self-signed manually distributed | Don't. Every client needs the leaf cert installed separately. |

See [`references/setup.md`](references/setup.md) for the full command-by-command walkthrough.

## Critical client-trust gotcha

Node.js does not read the macOS Keychain. So even after `mkcert -install` puts the CA in System Keychain, Comunica / Bashlib / `@inrupt/solid-client-authn-node` will throw `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` or `self-signed certificate in certificate chain` until you tell Node where to find the CA:

```bash
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"
```

Set this in your shell rc **and** in every Docker container's environment. Python `httpx` / `requests` have the same issue with a different fix:

```bash
export SSL_CERT_FILE="$(mkcert -CAROOT)/rootCA.pem"
export REQUESTS_CA_BUNDLE="$(mkcert -CAROOT)/rootCA.pem"
```

This is the single most common stumbling block. Browsers and curl just work (they read Keychain); Node.js and Python do not.

## CSS HTTPS config knob

CSS v8 supports native HTTPS via two CLI flags (`--httpsKey`, `--httpsCert`) and a config import (`@css:config/http/server-factory/https.json`). The `https.json` config replaces the default `http.json` server-factory — if both are imported, Components.js throws "Detected multiple values for parameter `BaseServerFactory_configurator`." Import only one.

Detail in [`references/setup.md`](references/setup.md).

## Quick reference

| Concern | Answer |
|---|---|
| Cert validity (mkcert) | 825 days (Apple's cap on user-installed CAs) |
| Renewal in dev | Re-run `mkcert -cert-file …` when cert expires; no automation |
| Renewal in prod | Caddy + Let's Encrypt: automatic every 60 days |
| Port 443 in container | CSS as root can bind 443; or map `443:3443` and bind 3443 internal |
| HSTS in dev | Off. Pinning will break http fallback during debugging. |
| HSTS in prod | On. Start `max-age=300`, ratchet up only after confident. |
| baseUrl flag | Set to externally-visible URL: `https://<host>` (no port if 443) |

## Reference material

| File | Read when |
|---|---|
| [`references/setup.md`](references/setup.md) | You're actually setting up TLS — full mkcert + docker-compose + Caddy commands |
| [`references/troubleshooting.md`](references/troubleshooting.md) | TLS errors, Node trust problems, Host-header validation failures |
| [`references/deltas.md`](references/deltas.md) | What cogitarelink-solid specifically uses (dev cert paths, prod plan) |

## Related skills

- `solid-uri-conformance` — once TLS is up, vocabulary IRIs become `https://` with no port
- `solid-spec` — Solid Protocol §3 HTTPS mandate
- `solid-servers` — CSS server configuration generally
