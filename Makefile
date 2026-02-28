.PHONY: up down logs status test import clean

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
	curl -sf http://localhost:3000/.well-known/solid | python3 -m json.tool 2>/dev/null || echo "CSS not responding"
	@echo ""
	@echo "=== Adapter health ==="
	curl -sf http://localhost:8080/health 2>/dev/null || echo "Adapter not responding"
	@echo ""
	@echo "=== Oxigraph health ==="
	curl -sf http://localhost:7878/query -d "query=SELECT * WHERE {} LIMIT 1" -H "Accept: application/sparql-results+json" 2>/dev/null | head -1 || echo "Oxigraph not responding"

test:
	pytest tests/ -v

import:
	python scripts/vault_import.py

clean:
	docker compose down -v
