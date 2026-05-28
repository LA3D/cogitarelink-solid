PYTHON := ~/uvws/.venv/bin/python
POD_URL ?= https://pod.vardeman.me/vault/
CA_FILE := $(shell mkcert -CAROOT 2>/dev/null)/rootCA.pem
GIT_SHA := $(shell git rev-parse --short HEAD)

.PHONY: up down reset rebuild rebuild-clean status logs import test install clean sync-validator-tbox check-validator-tbox audit verify sync-curator-skill

up:  ## Start everything (idempotent)
	docker compose up -d

down:  ## Stop services (keep data)
	docker compose down

reset:  ## Clean slate: destroy data, rebuild with SHA stamp, reseed
	docker compose down -v
	GIT_SHA=$(GIT_SHA) docker compose build css
	docker compose up -d --force-recreate

verify:  ## Wait for the async pod-setup seed to finish, then audit. Use after `make reset` — `make audit` alone races the seed (false ERRORs on an unseeded Pod).
	@echo "Waiting for pod-setup seed (polling $(POD_URL)wiki/index.md)..."
	@for i in $$(seq 1 72); do \
	  code=$$(curl -s -o /dev/null -w '%{http_code}' $(POD_URL)wiki/index.md); \
	  if [ "$$code" = "200" ]; then echo "seeded after ~$$((i*5))s"; break; fi; \
	  sleep 5; \
	done
	$(MAKE) audit

rebuild:  ## Rebuild the css image from source + recreate container (keeps data)
	GIT_SHA=$(GIT_SHA) docker compose build css
	docker compose up -d --force-recreate css

rebuild-clean:  ## Evict build cache, rebuild css with no cache, recreate (keeps data)
	docker builder prune -f
	GIT_SHA=$(GIT_SHA) docker compose build --no-cache css
	docker compose up -d --force-recreate css

status:  ## Health check all services + verify deployed image matches git HEAD
	@echo "=== Service Status ==="
	@echo "CSS:       $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/)"
	@echo "Pod:       $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/)"
	@echo "WebID:     $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/profile/card)"
	@echo "TypeIndex: $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/settings/publicTypeIndex)"
	@echo "Shapes:    $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/meta/shapes/)"
	@echo "Capabilities: $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/meta/capabilities/)"
	@echo "Setup:     $$(docker compose ps pod-setup --format '{{.State}}' 2>/dev/null || echo 'not run')"
	@echo "(Comunica is client-side via solid-agent-skills; no Pod sidecar — D3/D29.)"
	@echo ""
	@echo "=== Image Revision ==="
	@echo "Deployed:  $$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' cogitarelink-solid-css-1 2>/dev/null || echo 'n/a')"
	@echo "Git HEAD:  $(GIT_SHA)"
	@if [ "$$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' cogitarelink-solid-css-1 2>/dev/null)" != "$(GIT_SHA)" ]; then \
	  echo "  WARNING: MISMATCH — running image is not HEAD; run 'make rebuild'"; \
	else \
	  echo "  OK deployed image matches HEAD"; \
	fi

logs:  ## Tail all logs
	docker compose logs -f

import:  ## Re-run pod-setup init service
	docker compose run --rm pod-setup

test: check-validator-tbox  ## Run Python tests (also checks validator TBox bundle for drift)
	$(PYTHON) -m pytest tests/ -v

install:  ## Install Python project in dev mode
	uv pip install -e ".[test]"

sync-validator-tbox:  ## Copy canonical mem.ttl into the shape-validator extension data dir
	cp overlays/wiki-memory/ontology/mem.ttl css/extensions/shape-validator/data/mem.ttl
	cp overlays/wiki-memory/ontology/as-subclass-axioms.ttl css/extensions/shape-validator/data/as-subclass-axioms.ttl

check-validator-tbox:  ## Fail if the bundled validator TBox copies have drifted from canonical
	@diff -q overlays/wiki-memory/ontology/mem.ttl css/extensions/shape-validator/data/mem.ttl >/dev/null \
	  && diff -q overlays/wiki-memory/ontology/as-subclass-axioms.ttl css/extensions/shape-validator/data/as-subclass-axioms.ttl >/dev/null \
	  || (echo "ERROR: shape-validator data/ TBox drifted from overlays/wiki-memory/ontology/ — run 'make sync-validator-tbox'"; exit 1)

audit:  ## Validate the Pod's substrate self-description (D104); ERROR findings fail
	SSL_CERT_FILE="$(CA_FILE)" $(PYTHON) scripts/pod_audit.py $(POD_URL) --shapes-dir shapes/substrate/ --check-routing

CURATOR_SKILL := ../solid-agent-skills/skills/pod-curator/scripts
sync-curator-skill:  ## Sync canonical pod_audit.py + substrate shapes into the bundled pod-curator skill
	@test -d "$(CURATOR_SKILL)" || (echo "skill bundle dir not found: $(CURATOR_SKILL)"; exit 1)
	cp scripts/pod_audit.py "$(CURATOR_SKILL)/pod_audit.py"
	cp shapes/substrate/*.ttl "$(CURATOR_SKILL)/shapes/substrate/"
	@echo "synced pod_audit.py + shapes/substrate/ → $(CURATOR_SKILL)"

clean:  ## Stop and destroy all data
	docker compose down -v
