PYTHON := ~/uvws/.venv/bin/python

.PHONY: up down logs status test import clean install

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

status:
	@echo "=== Docker services ==="
	docker compose ps
	@echo ""
	@echo "=== CSS health ==="
	curl -sf http://localhost:3000/.well-known/solid | $(PYTHON) -m json.tool 2>/dev/null || echo "CSS not responding"
	@echo ""
	@echo "=== Adapter health ==="
	curl -sf http://localhost:8080/health 2>/dev/null || echo "Adapter not responding"
	@echo ""
	@echo "=== Oxigraph health ==="
	curl -sf http://localhost:7878/query -d "query=SELECT * WHERE {} LIMIT 1" -H "Accept: application/sparql-results+json" 2>/dev/null | head -1 || echo "Oxigraph not responding"

test:
	$(PYTHON) -m pytest tests/ -v

import:
	$(PYTHON) scripts/vault_import.py

install:
	uv pip install -e ".[test]"

clean:
	docker compose down -v
