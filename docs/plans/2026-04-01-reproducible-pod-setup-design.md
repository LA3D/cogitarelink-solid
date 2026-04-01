# Reproducible Pod Setup Design

> **Goal:** `git clone` + `make up` = fully structured Solid Pod at `http://pod.vardeman.me:3000`
> with account, WebID, PARA containers, and seed data. No manual steps beyond Docker installed
> and `pod.vardeman.me` in `/etc/hosts`.

**Date:** 2026-04-01
**Status:** Design approved
**Supersedes:** Manual pod setup in vertical slice plan (Task 2: `pod_init.py`)

---

## Problem

Current setup is fragile: `docker compose down -v && docker compose up -d` gives an empty CSS
with no containers, no profile, no credentials. Everything created manually inside the container
is lost. The repo cannot be cloned to a fresh machine and produce a working dev pod.

## Design Principles

1. **Everything in the repo, nothing manual** -- config, seed data, templates, scripts are committed
2. **Layered reproducibility** -- separate infrastructure, identity, structure, and content
3. **Use the app's own mechanisms** -- CSS seed config + pod templates over external scripts
4. **One command to working state** -- `make up` or `make reset`

---

## Architecture: Four Layers

```
Layer 1: Docker Infrastructure     docker-compose.yml + Dockerfile
Layer 2: CSS Seed + Pod Templates  seed.json + pod-templates/ (runs on CSS startup)
Layer 3: Init Service              pod-setup container (one-shot, after CSS healthy)
Layer 4: Makefile                  Developer interface
```

### Layer 1: Docker Infrastructure

Three services in `docker-compose.yml`:

| Service | Image | Purpose | Lifecycle |
|---------|-------|---------|-----------|
| `css` | Custom (Dockerfile) | Solid Pod server | Long-running |
| `pod-setup` | `python:3.12-slim` | Seed content + shapes | One-shot (exits 0) |
| `comunica` | `node:20-slim` | SPARQL-over-LDP sidecar | Long-running |

Key changes from current:
- Base URL: `http://pod.vardeman.me:3000` (was `http://localhost:3000`)
- `--seedConfig /config/seed.json` added to CSS command
- New `pod-setup` init service with `restart: "no"`
- Init service uses Docker networking (`http://css:3000`), not localhost

### Layer 2: CSS Seed Config + Pod Templates

#### Seed Config (`css/config/seed.json`)

```json
[
  {
    "email": "chuck@vardeman.me",
    "password": "cogitarelink-dev",
    "pods": [
      { "name": "vault" }
    ]
  }
]
```

Created on CSS startup by `SeededAccountInitializer`:
- Account with email/password login (email verification auto-confirmed)
- Pod at `http://pod.vardeman.me:3000/vault/`
- WebID at `http://pod.vardeman.me:3000/vault/profile/card#me`
- WAC authorization (owner = full access)
- Root marked as `pim:Storage`

Idempotent: on subsequent startups, logs warnings if account/pod already exists. Does not
corrupt existing data.

#### Pod Templates (`css/config/pod-templates/`)

CSS uses a `StaticFolderGenerator` that processes template directories at pod creation time.
We override the default template folder to include PARA containers and a Type Index.

**File naming conventions:**

| Pattern | CSS behavior |
|---------|-------------|
| `directory/` | Create LDP `BasicContainer` |
| `file.ext` | Copy as-is, content type from extension |
| `file$.ext.hbs` | Handlebars template, content type from `.ext` |
| `file.hbs` | Handlebars template, auxiliary resource (`.acl`, `.meta`) |

**Handlebars variables:** `{{webId}}`, `{{base.path}}`, `{{oidcIssuer}}`, `{{email}}`, `{{name}}`

**Template directory structure:**

```
css/config/pod-templates/
├── base/
│   ├── .meta                          # pim:Storage (same as CSS default)
│   ├── profile/
│   │   └── card$.ttl.hbs             # WebID card with pim:preferencesFile, solid:publicTypeIndex
│   ├── settings/
│   │   └── publicTypeIndex$.ttl.hbs  # Type Index pointing to PARA containers
│   ├── resources/
│   │   ├── concepts/                  # empty dir -> LDP container
│   │   ├── theories/                  # empty dir -> LDP container
│   │   ├── literature/                # empty dir -> LDP container
│   │   ├── methods/                   # empty dir -> LDP container
│   │   ├── people/                    # empty dir -> LDP container
│   │   └── external/                  # empty dir -> LDP container
│   ├── projects/                      # empty dir -> LDP container
│   ├── areas/                         # empty dir -> LDP container
│   ├── archive/                       # empty dir -> LDP container
│   ├── procedures/
│   │   ├── shapes/                    # empty dir -> LDP container
│   │   └── queries/                   # empty dir -> LDP container
│   └── ontology/                      # empty dir -> LDP container
└── wac/
    ├── .acl.hbs                       # Root ACL (same as CSS default)
    └── profile/
        └── card.acl.hbs              # WebID card ACL (same as CSS default)
```

**Components.js override** (new file `css/config/pod-templates-override.json`):

```json
{
  "@context": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
  "@graph": [
    {
      "@id": "urn:solid-server:default:PodResourcesGenerator",
      "@type": "StaticFolderGenerator",
      "templateFolder": "/config/pod-templates"
    }
  ]
}
```

Imported in `solid-config.json`. Re-declares the same `@id` to override the default
template folder. The `wac/` subfolder addition from WebACL config still works.

**Enhanced WebID card** (`card$.ttl.hbs`):

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix pim: <http://www.w3.org/ns/pim/space#>.
@prefix ldp: <http://www.w3.org/ns/ldp#>.

<>
    a foaf:PersonalProfileDocument;
    foaf:maker <{{webId}}>;
    foaf:primaryTopic <{{webId}}>.

<{{webId}}>
    a foaf:Person;
    {{#if name}}foaf:name "{{name}}";{{/if}}
    {{#if oidcIssuer}}solid:oidcIssuer <{{oidcIssuer}}>;{{/if}}
    pim:storage <{{base.path}}>;
    solid:publicTypeIndex <{{base.path}}settings/publicTypeIndex>;
    pim:preferencesFile <{{base.path}}settings/prefs.ttl>.
```

**Type Index template** (`publicTypeIndex$.ttl.hbs`):

```turtle
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.
@prefix vault: <https://pod.vardeman.me/vault/ontology#>.

<> a solid:TypeIndex, solid:ListedDocument.

<#concepts> a solid:TypeRegistration;
    solid:forClass skos:Concept;
    solid:instanceContainer <{{base.path}}resources/concepts/>.

<#theories> a solid:TypeRegistration;
    solid:forClass vault:TheoryNote;
    solid:instanceContainer <{{base.path}}resources/theories/>.

<#literature> a solid:TypeRegistration;
    solid:forClass vault:LiteratureNote;
    solid:instanceContainer <{{base.path}}resources/literature/>.

<#projects> a solid:TypeRegistration;
    solid:forClass vault:Project;
    solid:instanceContainer <{{base.path}}projects/>.
```

**Result:** The moment CSS starts and processes the seed config, the full pod structure
exists -- account, WebID, PARA containers, Type Index. No scripts needed.

### Layer 3: Init Service (`pod-setup`)

Handles content that requires reading external files and generating RDF -- things that
can't be done via static templates:

1. **Upload SHACL shapes** to `/vault/procedures/shapes/` (from `./shapes/`)
2. **Upload ontology stubs** to `/vault/ontology/` (from `./ontology/`)
3. **Import vault notes** (optional, when vault path is mounted)
4. **Verify pod structure** (smoke test)

```yaml
pod-setup:
  image: python:3.12-slim
  volumes:
    - ./scripts:/scripts:ro
    - ./shapes:/shapes:ro
    - ./ontology:/ontology:ro
  working_dir: /scripts
  entrypoint: ["sh", "-c"]
  command:
    - |
      pip install --quiet httpx rdflib pyyaml &&
      python pod_setup.py --target http://css:3000
  depends_on:
    css:
      condition: service_healthy
  restart: "no"
```

This is a single Python script (`scripts/pod_setup.py`) that uses httpx to PUT/PATCH
resources. Dependencies are installed at container start (no custom image needed).

**Why a container instead of a host script?**
- Runs automatically on `docker compose up -d`
- Uses Docker networking (no localhost/port mapping issues)
- No Python/uv required on the host machine
- Exits cleanly -- `docker compose ps` shows "Exited (0)"

### Layer 4: Makefile

```makefile
PYTHON := ~/uvws/.venv/bin/python

.PHONY: up down reset status logs import test install

up:                     ## Start everything (idempotent)
	docker compose up -d

down:                   ## Stop services (keep data)
	docker compose down

reset:                  ## Clean slate: destroy data, rebuild, reseed
	docker compose down -v
	docker compose build css
	docker compose up -d

status:                 ## Health check all services
	@echo "CSS:      $$(curl -s -o /dev/null -w '%{http_code}' http://pod.vardeman.me:3000/)"
	@echo "Pod:      $$(curl -s -o /dev/null -w '%{http_code}' http://pod.vardeman.me:3000/vault/)"
	@echo "WebID:    $$(curl -s -o /dev/null -w '%{http_code}' http://pod.vardeman.me:3000/vault/profile/card)"
	@echo "TypeIdx:  $$(curl -s -o /dev/null -w '%{http_code}' http://pod.vardeman.me:3000/vault/settings/publicTypeIndex)"
	@echo "Comunica: $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/sparql)"
	@echo "Setup:    $$(docker compose ps pod-setup --format '{{.State}}')"

logs:                   ## Tail all logs
	docker compose logs -f

import:                 ## Re-run vault import only
	docker compose run --rm pod-setup

test:                   ## Run Python tests
	$(PYTHON) -m pytest tests/ -v

install:                ## Install Python project in dev mode
	uv pip install -e ".[test]"
```

---

## Developer Workflow

### Fresh clone (new machine)

```bash
git clone git@github.com:LA3D/cogitarelink-solid.git
cd cogitarelink-solid
# One-time: add to /etc/hosts
sudo sh -c 'echo "127.0.0.1  pod.vardeman.me" >> /etc/hosts'
# Start everything
make up
# Wait ~20 seconds for CSS startup + seed + pod-setup
make status
# CSS: 200, Pod: 200, WebID: 200, TypeIdx: 200, Comunica: 200, Setup: exited (0)
```

### Reset after experiments

```bash
make reset
# Destroys volume, rebuilds CSS image, re-seeds pod, re-runs init
```

### Re-import vault content only

```bash
make import
# Runs pod-setup container again (PUT/PATCH are idempotent)
```

---

## What Lives Where

| In the repo (committed) | In Docker volumes (ephemeral) |
|---|---|
| `docker-compose.yml` | Account state (`/data/accounts/`) |
| `css/Dockerfile` | Pod content (`/data/vault/...`) |
| `css/config/solid-config.json` | Comunica cache |
| `css/config/seed.json` | |
| `css/config/pod-templates/` | |
| `css/config/pod-templates-override.json` | |
| `shapes/*.ttl` | |
| `ontology/*.ttl` | |
| `scripts/pod_setup.py` | |
| `scripts/lib/rdf_gen.py` | |
| `scripts/lib/ldp_client.py` | |
| `Makefile` | |

Everything in the left column is version-controlled. Everything in the right column
is disposable and rebuilt from the left column via `make reset`.

---

## What This Eliminates

- `scripts/pod_init.py` -- replaced by pod templates (PARA containers exist at CSS startup)
- Manual container creation via curl
- Manual account/credential setup
- Manual WebID/Type Index creation
- "Run this sequence of 6 commands in order" instructions

## What Stays as Scripts

- `scripts/pod_setup.py` -- shape upload, ontology upload, vault import (runs in Docker init service)
- `scripts/lib/rdf_gen.py` -- frontmatter-to-RDF conversion (used by pod_setup)
- `scripts/lib/ldp_client.py` -- LDP HTTP operations (used by pod_setup)
- `scripts/vault_import.py` -- standalone CLI for ad-hoc re-imports from host

---

## Impact on Vertical Slice Plan

The vertical slice plan (`2026-04-01-vertical-slice-implementation.md`) is updated:

| Original Task | New Status |
|---|---|
| Task 1: Switch CSS to allow-all auth | **Replaced** -- seed config creates authenticated account; dev config uses allow-all overlay |
| Task 2: Create PARA containers (`pod_init.py`) | **Replaced** -- pod templates create containers at startup |
| Task 3: Frontmatter-to-RDF generator | **Unchanged** -- still needed for vault import |
| Task 4: LDP upload client | **Unchanged** -- still needed for vault import |
| Task 5: Wire vault importer | **Modified** -- becomes part of `pod_setup.py` init service |
| Task 6: Comunica + SPARQL tests | **Unchanged** |
| Task 7: End-to-end verify | **Simplified** -- `make reset && make status` |

---

## Open Questions

1. **Dev auth mode**: Should the seed config use real credentials (WAC) or should we also
   overlay `allow-all` auth for simpler development? Recommendation: keep WAC with seed
   credentials for realism; add a `make dev-up` target with allow-all for rapid iteration.

2. **Vault mount for import**: The pod-setup container can optionally mount the Obsidian vault
   for import. This makes the vault path a host dependency. Alternative: copy target notes
   into `data/seed-notes/` in the repo. Recommendation: keep as optional mount; the pod
   is useful even without vault content.

3. **Comunica source URL**: Currently points at a single container
   (`http://css:3000/vault/resources/concepts/`). Should be updated to traverse from pod root
   (`http://css:3000/vault/`) once Type Index-based discovery is working.
