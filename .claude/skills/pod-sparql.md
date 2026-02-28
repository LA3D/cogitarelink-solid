# /pod-sparql

Execute SPARQL queries over Pod LDP resources via Comunica sidecar.

## Usage
```
/pod-sparql <query> [--endpoint <sparql-url>]
```
Example: `/pod-sparql "SELECT ?concept WHERE { ?concept a skos:Concept }" --endpoint http://localhost:8080/sparql`

## Steps

1. **Determine endpoint**:
   - Default: `http://localhost:8080/sparql` (Comunica over CSS LDP)
   - Override with `--endpoint` for remote or federated queries

2. **Execute query**:
   ```bash
   curl -s http://localhost:8080/sparql \
     -d "query=<SPARQL>" \
     -H "Accept: application/sparql-results+json"
   ```
   Or via Python:
   ```python
   import httpx
   r = httpx.post("http://localhost:8080/sparql",
                   data={"query": query},
                   headers={"Accept": "application/sparql-results+json"})
   ```

3. **Format results**:
   - SELECT → table format
   - CONSTRUCT → Turtle output
   - ASK → boolean

4. **Common queries** (from `.well-known/sparql-examples`):
   - List all concepts: `SELECT ?c ?label WHERE { ?c a skos:Concept ; skos:prefLabel ?label }`
   - Find by tag: `SELECT ?c WHERE { ?c dct:subject "tag-name" }`
   - Find related: `SELECT ?related WHERE { <iri> skos:related ?related }`
   - Navigate PARA: `SELECT ?child WHERE { ?child dct:isPartOf <container-iri> }`
