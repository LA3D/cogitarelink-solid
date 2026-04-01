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
