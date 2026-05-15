# Project deltas — solid-servers

This stack diverges from upstream Solid server defaults in two places.

## D1 — CSS + TypeScript extensions + Comunica sidecar

D1: CSS + TypeScript extensions + Comunica sidecar — CSS Pod server, CSS extensions for `.well-known/` (WaterfallHandler), Comunica SPARQL-over-LDP sidecar. Python is client-only (importer, SHACL dev, RLM agents)

**Authoritative artifact**: `docker-compose.yml` (CSS + Comunica two-container stack); `css/extensions/` (5 extensions: memento, markdown-projection, markdown-render, metadata-card, shape-validator).

## D28 — CSS v8 Alpha for development

D28: CSS v8 Alpha for development — chosen server, includes `@solidlab/policy-engine` for ACP

**Authoritative artifact**: `css/Dockerfile` (pins `@solid/community-server:next` → v8.0.0-alpha.3); `css/config/solid-config.json` includes `@solidlab/policy-engine`.
