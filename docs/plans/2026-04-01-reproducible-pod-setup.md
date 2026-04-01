# Reproducible Pod Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Solid Pod fully reproducible from repo contents — `git clone` + `make up` = working pod at `http://pod.vardeman.me:3000` with account, WebID, PARA containers, Type Index, shapes, and ontology.

**Architecture:** CSS seed config creates the account + pod on startup. Custom pod templates pre-create the PARA container hierarchy and Type Index. A one-shot Docker init service uploads SHACL shapes and ontology stubs. The Makefile wraps everything so `make reset` goes from zero to working pod.

**Tech Stack:** CSS v8 (Components.js config, Handlebars templates), Docker Compose, Python 3.12 (httpx for init service), Make

**Design doc:** `docs/plans/2026-04-01-reproducible-pod-setup-design.md`

---

## Prerequisites

- Docker Desktop running
- `127.0.0.1 pod.vardeman.me` in `/etc/hosts`
- Current branch: `feature/vertical-slice`

---

### Task 1: Create CSS seed config and dev auth overlay

Create the seed config that pre-creates the account + pod on CSS startup, and a dev-only `allow-all` auth overlay for unauthenticated writes during development.

**Files:**
- Create: `css/config/seed.json`
- Create: `css/config/dev-allow-all.json`

**Step 1: Create seed.json**

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

Write to `css/config/seed.json`.

**Step 2: Create dev-allow-all.json**

```json
{
  "@context": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
  "import": [
    "css:config/ldp/authorization/allow-all.json"
  ]
}
```

Write to `css/config/dev-allow-all.json`. This overrides WebACL with allow-all auth for dev.

**Step 3: Commit**

```bash
git add css/config/seed.json css/config/dev-allow-all.json
git commit -m "[Agent: Claude] Add CSS seed config and dev-allow-all auth overlay

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Create pod templates — PARA container structure

Create the custom pod template directory tree. Empty directories become LDP containers at pod creation. Each directory gets a `.meta` file with an `rdfs:label` triple — this serves three purposes: (1) git tracks non-empty directories, (2) CSS processes it as container metadata, (3) containers get human-readable labels.

**Files:**
- Create: `css/config/pod-templates/base/.meta`
- Create: `css/config/pod-templates/base/profile/card$.ttl.hbs`
- Create: `css/config/pod-templates/base/settings/publicTypeIndex$.ttl.hbs`
- Create: `css/config/pod-templates/base/resources/.meta`
- Create: `css/config/pod-templates/base/resources/concepts/.meta`
- Create: `css/config/pod-templates/base/resources/theories/.meta`
- Create: `css/config/pod-templates/base/resources/literature/.meta`
- Create: `css/config/pod-templates/base/resources/methods/.meta`
- Create: `css/config/pod-templates/base/resources/people/.meta`
- Create: `css/config/pod-templates/base/resources/external/.meta`
- Create: `css/config/pod-templates/base/projects/.meta`
- Create: `css/config/pod-templates/base/areas/.meta`
- Create: `css/config/pod-templates/base/archive/.meta`
- Create: `css/config/pod-templates/base/procedures/.meta`
- Create: `css/config/pod-templates/base/procedures/shapes/.meta`
- Create: `css/config/pod-templates/base/procedures/queries/.meta`
- Create: `css/config/pod-templates/base/ontology/.meta`
- Create: `css/config/pod-templates/wac/.acl.hbs`
- Create: `css/config/pod-templates/wac/profile/card.acl.hbs`

**Step 1: Create root .meta (pim:Storage marker)**

Write to `css/config/pod-templates/base/.meta`:

```turtle
@prefix pim: <http://www.w3.org/ns/pim/space#>.

<> a pim:Storage.
```

This is identical to the CSS default — marks the pod root as a Solid storage.

**Step 2: Create WebID card template**

Write to `css/config/pod-templates/base/profile/card$.ttl.hbs`:

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix pim: <http://www.w3.org/ns/pim/space#>.

<>
    a foaf:PersonalProfileDocument;
    foaf:maker <{{webId}}>;
    foaf:primaryTopic <{{webId}}>.

<{{webId}}>
    a foaf:Person;
    {{#if name}}foaf:name "{{name}}";{{/if}}
    {{#if oidcIssuer}}solid:oidcIssuer <{{oidcIssuer}}>;{{/if}}
    pim:storage <{{base.path}}>;
    solid:publicTypeIndex <{{base.path}}settings/publicTypeIndex>.
```

Note: the `$` in the filename tells CSS this is a content file (`.ttl`), not an auxiliary resource. The `.hbs` suffix triggers Handlebars processing.

**Step 3: Create Type Index template**

Write to `css/config/pod-templates/base/settings/publicTypeIndex$.ttl.hbs`:

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

<#methods> a solid:TypeRegistration;
    solid:forClass vault:MethodNote;
    solid:instanceContainer <{{base.path}}resources/methods/>.

<#projects> a solid:TypeRegistration;
    solid:forClass vault:Project;
    solid:instanceContainer <{{base.path}}projects/>.
```

**Step 4: Create PARA container .meta files**

Each `.meta` file contains a single `rdfs:label` triple. Write the following files:

`css/config/pod-templates/base/resources/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "Resources".
```

`css/config/pod-templates/base/resources/concepts/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "Concepts".
```

`css/config/pod-templates/base/resources/theories/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "Theories".
```

`css/config/pod-templates/base/resources/literature/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "Literature".
```

`css/config/pod-templates/base/resources/methods/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "Methods".
```

`css/config/pod-templates/base/resources/people/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "People".
```

`css/config/pod-templates/base/resources/external/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "External Resources".
```

`css/config/pod-templates/base/projects/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "Projects".
```

`css/config/pod-templates/base/areas/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "Areas".
```

`css/config/pod-templates/base/archive/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "Archive".
```

`css/config/pod-templates/base/procedures/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "Procedures".
```

`css/config/pod-templates/base/procedures/shapes/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "SHACL Shapes".
```

`css/config/pod-templates/base/procedures/queries/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "SPARQL Queries".
```

`css/config/pod-templates/base/ontology/.meta`:
```turtle
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<> rdfs:label "Ontology".
```

**Step 5: Create WAC ACL templates**

These are processed when CSS uses WebACL auth (not in dev allow-all mode, but included for completeness).

Write to `css/config/pod-templates/wac/.acl.hbs`:

```turtle
# Root ACL resource for the agent account
@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

# The homepage is readable by the public
<#public>
    a acl:Authorization;
    acl:agentClass foaf:Agent;
    acl:accessTo <./>;
    acl:mode acl:Read.

# The owner has full access to every resource in their pod.
# Other agents have no access rights,
# unless specifically authorized in other .acl resources.
<#owner>
    a acl:Authorization;
    acl:agent <{{webId}}>;
    {{#if email}}acl:agent <mailto:{{{email}}}>;{{/if}}
    acl:accessTo <./>;
    acl:default <./>;
    acl:mode
        acl:Read, acl:Write, acl:Control.
```

Write to `css/config/pod-templates/wac/profile/card.acl.hbs`:

```turtle
# ACL resource for the WebID profile document
@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

# The WebID profile is readable by the public.
<#public>
    a acl:Authorization;
    acl:agentClass foaf:Agent;
    acl:accessTo <./card>;
    acl:mode acl:Read.

# The owner has full access to the profile
<#owner>
    a acl:Authorization;
    acl:agent <{{webId}}>;
    acl:accessTo <./card>;
    acl:mode acl:Read, acl:Write, acl:Control.
```

**Step 6: Commit**

```bash
git add css/config/pod-templates/
git commit -m "[Agent: Claude] Add custom pod templates with PARA container structure (D30)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Wire pod templates into CSS config

Create the Components.js override that points CSS at our custom template folder, and update `solid-config.json` to import it plus the dev-allow-all overlay.

**Files:**
- Create: `css/config/pod-templates-override.json`
- Modify: `css/config/solid-config.json`

**Step 1: Create pod-templates-override.json**

Write to `css/config/pod-templates-override.json`:

```json
{
  "@context": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^8.0.0/components/context.jsonld",
  "@graph": [
    {
      "comment": "Override default pod template folder with custom PARA structure (D30)",
      "@id": "urn:solid-server:default:PodResourcesGenerator",
      "@type": "StaticFolderGenerator",
      "templateFolder": "/config/pod-templates"
    }
  ]
}
```

This re-declares the same `@id` (`urn:solid-server:default:PodResourcesGenerator`) to override the default template folder. CSS resolves `/config/pod-templates` from the bind-mounted `./css/config:/config:ro` volume.

**Step 2: Update solid-config.json imports**

Add `"./dev-allow-all.json"` and `"./pod-templates-override.json"` to the `"import"` array in `css/config/solid-config.json`:

Current:
```json
"import": [
    "css:config/file.json"
],
```

Change to:
```json
"import": [
    "css:config/file.json",
    "./dev-allow-all.json",
    "./pod-templates-override.json"
],
```

The order matters: `file.json` sets up the base (including WebACL), `dev-allow-all.json` overrides auth to allow-all, `pod-templates-override.json` overrides the template folder.

**Step 3: Commit**

```bash
git add css/config/pod-templates-override.json css/config/solid-config.json
git commit -m "[Agent: Claude] Wire custom pod templates into CSS config

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Update docker-compose.yml

Change the base URL to `pod.vardeman.me`, add `--seedConfig`, and add the `pod-setup` init service.

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Update docker-compose.yml**

Replace the full contents of `docker-compose.yml`:

```yaml
services:
  css:
    build:
      context: ./css
      dockerfile: Dockerfile
    image: cogitarelink-solid-css:latest
    ports:
      - "3000:3000"
    volumes:
      - css-data:/data
      - ./css/config:/config:ro
    command:
      - -c
      - /config/solid-config.json
      - -f
      - /data
      - -b
      - http://pod.vardeman.me:3000
      - --seedConfig
      - /config/seed.json
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 10s

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

  comunica:
    image: node:20-slim
    ports:
      - "8080:8080"
    entrypoint: ["npx", "--yes", "@comunica/query-sparql-link-traversal-solid"]
    command: ["http://css:3000/", "-p", "8080", "--lenient"]
    depends_on:
      css:
        condition: service_healthy

volumes:
  css-data:
```

Key changes:
- Base URL: `http://pod.vardeman.me:3000` (was `http://localhost:3000`)
- `--seedConfig /config/seed.json` added to CSS command
- Health check: faster interval (5s) and more retries (12) for reliable startup detection
- New `pod-setup` service: one-shot Python container, installs deps then runs `pod_setup.py`
- `pod-setup` depends on CSS health check (runs after CSS is fully ready)

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "[Agent: Claude] Update docker-compose with seed config, pod-setup init service, pod.vardeman.me base URL

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Create pod_setup.py init service script

This script runs inside the `pod-setup` Docker container after CSS is healthy. It uploads SHACL shapes and ontology stubs to the pod via HTTP PUT.

**Files:**
- Create: `scripts/pod_setup.py`

**Step 1: Write pod_setup.py**

```python
"""Pod setup init service: uploads shapes + ontology to CSS after pod creation.

Runs inside Docker container via docker-compose pod-setup service.
CSS seed config + pod templates handle account, WebID, and PARA containers.
This script handles content that requires file-based generation.

Usage (inside container):
    python pod_setup.py --target http://css:3000

Usage (from host, for development):
    ~/uvws/.venv/bin/python scripts/pod_setup.py --target http://pod.vardeman.me:3000
"""
import argparse, pathlib, sys, time
import httpx


def wait_for_pod(base: str, retries: int = 30, delay: float = 2.0):
    """Wait for pod to be ready (seed config may still be running)."""
    pod_url = f"{base}/vault/"
    for i in range(retries):
        try:
            r = httpx.get(pod_url, timeout=5)
            if r.status_code == 200:
                print(f"  Pod ready at {pod_url}")
                return True
        except httpx.ConnectError:
            pass
        if i < retries - 1:
            print(f"  Waiting for pod... ({i+1}/{retries})")
            time.sleep(delay)
    print(f"  Pod not ready after {retries} attempts", file=sys.stderr)
    return False


def upload_file(client: httpx.Client, local_path: pathlib.Path,
                pod_path: str, content_type: str) -> bool:
    """PUT a file to the pod. Idempotent."""
    content = local_path.read_bytes()
    try:
        r = client.put(pod_path, content=content,
                       headers={"Content-Type": content_type})
        if r.status_code in (200, 201, 205):
            print(f"  PUT {pod_path} ({len(content)} bytes)")
            return True
        else:
            print(f"  FAILED {pod_path}: {r.status_code} {r.text[:200]}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"  ERROR {pod_path}: {e}", file=sys.stderr)
        return False


def upload_shapes(client: httpx.Client, shapes_dir: pathlib.Path) -> int:
    """Upload SHACL shapes to /vault/procedures/shapes/."""
    count = 0
    for f in sorted(shapes_dir.glob("*.ttl")):
        pod_path = f"/vault/procedures/shapes/{f.name}"
        if upload_file(client, f, pod_path, "text/turtle"):
            count += 1
    return count


def upload_ontology(client: httpx.Client, onto_dir: pathlib.Path) -> int:
    """Upload ontology stubs to /vault/ontology/."""
    count = 0
    for f in sorted(onto_dir.glob("*.ttl")):
        pod_path = f"/vault/ontology/{f.name}"
        if upload_file(client, f, pod_path, "text/turtle"):
            count += 1
    return count


def verify_pod(client: httpx.Client) -> bool:
    """Smoke test: check key pod resources exist."""
    checks = [
        ("/vault/", "Pod root"),
        ("/vault/profile/card", "WebID card"),
        ("/vault/settings/publicTypeIndex", "Type Index"),
        ("/vault/resources/concepts/", "Concepts container"),
        ("/vault/procedures/shapes/", "Shapes container"),
    ]
    ok = True
    for path, label in checks:
        r = client.get(path, timeout=10)
        status = "OK" if r.status_code == 200 else f"FAIL ({r.status_code})"
        print(f"  {label}: {status}")
        if r.status_code != 200:
            ok = False
    return ok


def main():
    p = argparse.ArgumentParser(description="Pod setup: upload shapes + ontology")
    p.add_argument("--target", default="http://css:3000",
                   help="CSS base URL (default: http://css:3000 for Docker networking)")
    p.add_argument("--shapes-dir", default="/shapes",
                   help="Path to SHACL shapes directory")
    p.add_argument("--ontology-dir", default="/ontology",
                   help="Path to ontology directory")
    args = p.parse_args()

    print(f"Pod setup targeting {args.target}")

    if not wait_for_pod(args.target):
        sys.exit(1)

    shapes_dir = pathlib.Path(args.shapes_dir)
    onto_dir = pathlib.Path(args.ontology_dir)

    with httpx.Client(base_url=args.target, timeout=30) as c:
        n_shapes = 0
        if shapes_dir.exists():
            print(f"\nUploading shapes from {shapes_dir}")
            n_shapes = upload_shapes(c, shapes_dir)

        n_onto = 0
        if onto_dir.exists():
            print(f"\nUploading ontology from {onto_dir}")
            n_onto = upload_ontology(c, onto_dir)

        print(f"\nVerifying pod structure:")
        ok = verify_pod(c)

    print(f"\nDone: {n_shapes} shapes, {n_onto} ontology files uploaded")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
git add scripts/pod_setup.py
git commit -m "[Agent: Claude] Add pod_setup.py init service for shape + ontology upload

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Update Makefile

Replace the Makefile with updated targets using `pod.vardeman.me` URLs and add `reset` target.

**Files:**
- Modify: `Makefile`

**Step 1: Update Makefile**

Replace full contents of `Makefile`:

```makefile
PYTHON := ~/uvws/.venv/bin/python

.PHONY: up down reset status logs import test install clean

up:  ## Start everything (idempotent)
	docker compose up -d

down:  ## Stop services (keep data)
	docker compose down

reset:  ## Clean slate: destroy data, rebuild, reseed
	docker compose down -v
	docker compose build css
	docker compose up -d

status:  ## Health check all services
	@echo "=== Service Status ==="
	@echo "CSS:       $$(curl -s -o /dev/null -w '%{http_code}' http://pod.vardeman.me:3000/)"
	@echo "Pod:       $$(curl -s -o /dev/null -w '%{http_code}' http://pod.vardeman.me:3000/vault/)"
	@echo "WebID:     $$(curl -s -o /dev/null -w '%{http_code}' http://pod.vardeman.me:3000/vault/profile/card)"
	@echo "TypeIndex: $$(curl -s -o /dev/null -w '%{http_code}' http://pod.vardeman.me:3000/vault/settings/publicTypeIndex)"
	@echo "Concepts:  $$(curl -s -o /dev/null -w '%{http_code}' http://pod.vardeman.me:3000/vault/resources/concepts/)"
	@echo "Shapes:    $$(curl -s -o /dev/null -w '%{http_code}' http://pod.vardeman.me:3000/vault/procedures/shapes/)"
	@echo "Comunica:  $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/sparql)"
	@echo "Setup:     $$(docker compose ps pod-setup --format '{{.State}}' 2>/dev/null || echo 'not run')"

logs:  ## Tail all logs
	docker compose logs -f

import:  ## Re-run pod-setup init service
	docker compose run --rm pod-setup

test:  ## Run Python tests
	$(PYTHON) -m pytest tests/ -v

install:  ## Install Python project in dev mode
	uv pip install -e ".[test]"

clean:  ## Stop and destroy all data
	docker compose down -v
```

**Step 2: Commit**

```bash
git add Makefile
git commit -m "[Agent: Claude] Update Makefile with pod.vardeman.me URLs, reset target

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Integration test and end-to-end verification

Write integration tests that verify the pod structure created by seed config + pod templates, then run `make reset` to verify the full pipeline.

**Files:**
- Create: `tests/pytest/test_pod_structure.py`
- Modify: `tests/pytest/conftest.py` (if needed for fixtures)

**Step 1: Write integration test**

```python
# tests/pytest/test_pod_structure.py
"""Verify pod structure created by CSS seed config + pod templates."""
import httpx
import pytest

BASE = "http://pod.vardeman.me:3000"

EXPECTED_CONTAINERS = [
    "/vault/",
    "/vault/resources/",
    "/vault/resources/concepts/",
    "/vault/resources/theories/",
    "/vault/resources/literature/",
    "/vault/resources/methods/",
    "/vault/resources/people/",
    "/vault/resources/external/",
    "/vault/projects/",
    "/vault/areas/",
    "/vault/archive/",
    "/vault/procedures/",
    "/vault/procedures/shapes/",
    "/vault/procedures/queries/",
    "/vault/ontology/",
]


@pytest.mark.integration
class TestPodStructure:

    def test_pod_root_is_storage(self):
        """Pod root should be marked as pim:Storage."""
        r = httpx.get(f"{BASE}/vault/", headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "pim:Storage" in r.text or "pim/space#Storage" in r.text

    def test_webid_exists(self):
        """WebID card should exist and contain foaf:Person."""
        r = httpx.get(f"{BASE}/vault/profile/card",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "foaf:Person" in r.text or "foaf/0.1/Person" in r.text

    def test_webid_references_type_index(self):
        """WebID should reference the public Type Index."""
        r = httpx.get(f"{BASE}/vault/profile/card",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "publicTypeIndex" in r.text

    def test_type_index_exists(self):
        """Type Index should exist and be a solid:TypeIndex."""
        r = httpx.get(f"{BASE}/vault/settings/publicTypeIndex",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "TypeIndex" in r.text

    def test_type_index_has_concept_registration(self):
        """Type Index should map skos:Concept to /resources/concepts/."""
        r = httpx.get(f"{BASE}/vault/settings/publicTypeIndex",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "Concept" in r.text
        assert "resources/concepts" in r.text

    @pytest.mark.parametrize("path", EXPECTED_CONTAINERS)
    def test_container_exists(self, path):
        """All PARA containers should exist as LDP containers."""
        r = httpx.get(f"{BASE}{path}",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200, f"Container {path} returned {r.status_code}"
        assert "ldp:BasicContainer" in r.text or "ldp#BasicContainer" in r.text or \
               "Container" in r.text, f"{path} is not a container"

    def test_unauthenticated_write_allowed(self):
        """Dev mode: unauthenticated PUT should succeed (allow-all auth)."""
        url = f"{BASE}/vault/resources/concepts/_test-write.md"
        r = httpx.put(url, content=b"# Test", headers={"Content-Type": "text/markdown"},
                      timeout=10)
        assert r.status_code in (200, 201, 205), f"PUT failed: {r.status_code}"
        # Cleanup
        httpx.delete(url, timeout=10)


@pytest.mark.integration
class TestPodSetup:

    def test_shapes_uploaded(self):
        """SHACL shapes should be uploaded by pod-setup service."""
        r = httpx.get(f"{BASE}/vault/procedures/shapes/concept-note.ttl",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "ConceptNoteShape" in r.text

    def test_ontology_uploaded(self):
        """Ontology stubs should be uploaded by pod-setup service."""
        r = httpx.get(f"{BASE}/vault/ontology/solid-pod-profile.ttl",
                      headers={"Accept": "text/turtle"}, timeout=10)
        assert r.status_code == 200
        assert "SolidPodProfile" in r.text
```

**Step 2: Check if conftest.py exists and needs updating**

Check `tests/pytest/conftest.py`. If it has a `css_url` fixture pointing to `localhost:3000`, update it to `pod.vardeman.me:3000`. If `conftest.py` doesn't exist, create it:

```python
# tests/pytest/conftest.py
import pytest

@pytest.fixture
def css_url():
    return "http://pod.vardeman.me:3000"

@pytest.fixture
def sparql_url():
    return "http://localhost:8080/sparql"
```

**Step 3: Run make reset to build and verify**

Run:
```bash
make reset
```

Wait ~30 seconds for CSS to start, seed the pod, and pod-setup to complete.

**Step 4: Run make status to verify**

Run:
```bash
make status
```

Expected output:
```
=== Service Status ===
CSS:       200
Pod:       200
WebID:     200
TypeIndex: 200
Concepts:  200
Shapes:    200
Comunica:  200
Setup:     exited (0)
```

**Step 5: Run integration tests**

Run:
```bash
PYTHONPATH=. ~/uvws/.venv/bin/python -m pytest tests/pytest/test_pod_structure.py -v -m integration
```

Expected: All PASS

**Step 6: Commit**

```bash
git add tests/pytest/test_pod_structure.py tests/pytest/conftest.py
git commit -m "[Agent: Claude] Add integration tests for reproducible pod structure

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Dependency Chain

```
Task 1 (seed + auth) ─┐
                       ├──→ Task 3 (wire config) ──→ Task 4 (docker-compose) ──→ Task 7 (test E2E)
Task 2 (pod templates) ┘                                      ↑
                                            Task 5 (pod_setup.py) ──┘
                                            Task 6 (Makefile) ─────────────────→ Task 7
```

Tasks 1 and 2 can be done in parallel.
Tasks 5 and 6 can be done in parallel (both independent of Tasks 1-3).
Task 3 depends on Tasks 1 and 2.
Task 4 depends on Task 3.
Task 7 depends on Tasks 4, 5, and 6.

---

## Relationship to Vertical Slice Plan

This plan replaces Tasks 1-2 of the vertical slice plan. After completing this plan:

- **Vertical slice Task 3** (rdf_gen.py) proceeds unchanged
- **Vertical slice Task 4** (ldp_client.py) proceeds unchanged
- **Vertical slice Task 5** (vault_import.py) is modified to run inside pod-setup or standalone
- **Vertical slice Tasks 6-7** (Comunica + SPARQL) proceed unchanged

The pod infrastructure is now reproducible. Content import builds on top.
