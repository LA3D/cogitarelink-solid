# /pod-sparql

Execute SPARQL queries over Pod LDP resources via Comunica client-side federation.

## Usage
```
/pod-sparql <query> [--pod <pod-url>] [--include-oxigraph]
```
Example: `/pod-sparql "SELECT ?concept WHERE { ?concept a skos:Concept }" --pod http://localhost:3000`

## Steps

1. **Determine query target**:
   - Pod LDP resources only → Comunica over CSS
   - Pod + Oxigraph → Comunica federation across both sources
   - Use VoID catalog to select appropriate sources

2. **Configure Comunica**:
   - Source type: `ldp` for CSS Pod
   - Source type: `sparql` for Oxigraph
   - Base URL from Pod `.well-known/void`

3. **Execute query**:
   - For simple queries: use Comunica CLI or Node.js API
   - For complex federation: use Comunica config with heterogeneous sources
   - Apply `{base}` substitution in SPARQL examples templates

4. **Format results**:
   - SELECT → table format
   - CONSTRUCT → Turtle output
   - ASK → boolean

5. **Common queries** (from `.well-known/sparql-examples`):
   - List all concepts: `SELECT ?c ?label WHERE { ?c a skos:Concept ; skos:prefLabel ?label }`
   - Find by tag: `SELECT ?c WHERE { ?c dct:subject "tag-name" }`
   - Find related: `SELECT ?related WHERE { <iri> skos:related ?related }`
   - Navigate PARA: `SELECT ?child WHERE { ?child dct:isPartOf <container-iri> }`
