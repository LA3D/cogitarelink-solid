# /pod-status

Health check: verify all services are running and Pod is functional.

## Usage
```
/pod-status
```

## Steps

1. **Docker services**:
   ```bash
   docker compose ps
   ```
   Verify: css (healthy), comunica (running)

2. **CSS health**:
   ```bash
   curl -s http://localhost:3000/.well-known/solid
   ```
   Expected: JSON with server metadata

3. **Comunica SPARQL**:
   ```bash
   curl -s http://localhost:8080/sparql -d "query=SELECT * WHERE {} LIMIT 1" -H "Accept: application/sparql-results+json"
   ```
   Expected: SPARQL results JSON

4. **LDP browsability**:
   ```bash
   curl -s http://localhost:3000/ -H "Accept: text/turtle"
   ```
   Expected: Turtle with root container description

5. Report: service status table, any issues found
