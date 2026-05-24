PYTHON := ~/uvws/.venv/bin/python
POD_URL ?= https://pod.vardeman.me/vault/
CA_FILE := $(shell mkcert -CAROOT 2>/dev/null)/rootCA.pem

.PHONY: up down reset status logs import test install clean sync-validator-tbox check-validator-tbox audit sync-curator-skill

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
	@echo "CSS:       $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/)"
	@echo "Pod:       $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/)"
	@echo "WebID:     $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/profile/card)"
	@echo "TypeIndex: $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/settings/publicTypeIndex)"
	@echo "Shapes:    $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/meta/shapes/)"
	@echo "Capabilities: $$(curl -s -o /dev/null -w '%{http_code}' https://pod.vardeman.me/vault/meta/capabilities/)"
	@echo "Setup:     $$(docker compose ps pod-setup --format '{{.State}}' 2>/dev/null || echo 'not run')"
	@echo "(Comunica is client-side via solid-agent-skills; no Pod sidecar — D3/D29.)"

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
	SSL_CERT_FILE="$(CA_FILE)" $(PYTHON) scripts/pod_audit.py $(POD_URL) --shapes-dir shapes/substrate/

CURATOR_SKILL := ../solid-agent-skills/skills/pod-curator/scripts
sync-curator-skill:  ## Sync canonical pod_audit.py + substrate shapes into the bundled pod-curator skill
	@test -d "$(CURATOR_SKILL)" || (echo "skill bundle dir not found: $(CURATOR_SKILL)"; exit 1)
	cp scripts/pod_audit.py "$(CURATOR_SKILL)/pod_audit.py"
	cp shapes/substrate/*.ttl "$(CURATOR_SKILL)/shapes/substrate/"
	@echo "synced pod_audit.py + shapes/substrate/ → $(CURATOR_SKILL)"

clean:  ## Stop and destroy all data
	docker compose down -v
