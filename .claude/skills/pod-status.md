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
   Verify: css (healthy), adapter (healthy), oxigraph (healthy)

2. **CSS health**:
   ```bash
   curl -s http://localhost:3000/.well-known/solid
   ```
   Expected: JSON with server metadata

3. **Adapter health**:
   ```bash
   curl -s http://localhost:8080/health
   ```
   Expected: `{"status": "ok"}`

4. **Oxigraph health**:
   ```bash
   curl -s http://localhost:7878/query -d "query=SELECT * WHERE {} LIMIT 1" -H "Accept: application/sparql-results+json"
   ```
   Expected: SPARQL results JSON

5. **VoID self-description**:
   ```bash
   curl -s http://localhost:8080/.well-known/void -H "Accept: text/turtle"
   ```
   Expected: VoID Turtle with `dct:conformsTo`

6. **LDP browsability**:
   ```bash
   curl -s http://localhost:3000/vault/ -H "Accept: text/turtle"
   ```
   Expected: Turtle with `ldp:contains` triples

7. Report: service status table, any issues found
