# /pod-discover

Discover and summarize the capabilities of a Solid Pod via progressive disclosure (D9 four-layer KR + D10 three-layer RDF).

## Usage
```
/pod-discover <pod-url>
```
Example: `/pod-discover http://localhost:3000`

## Steps

1. **L1 — VoID + Solid metadata**: Fetch `{url}/.well-known/void` and `{url}/.well-known/solid`
   - Parse `dct:conformsTo` → profile link(s)
   - Extract `void:vocabulary` declarations
   - Note `void:feature` entries (Pod type: `feature/ldp-browse`)
   - Check Solid server metadata (storage, auth endpoints)

2. **L2 — TBox cache**: Check `/ontology/` container
   - List cached ontologies (SKOS, DC, PROV-O)
   - Verify availability for offline query resolution

3. **L3 — Pod-specific shapes**: Fetch `{url}/.well-known/shacl`
   - List `sh:NodeShape` names + `sh:intent` descriptions
   - Extract `sh:agentInstruction` annotations
   - Note `sh:targetClass` for each shape (concept-note, project-note, daily-note)

4. **L4 — SPARQL examples**: Fetch `{url}/.well-known/sparql-examples`
   - List `sh:SPARQLExecutable` instances with `rdfs:label`
   - Show which container/graph each query targets

5. **Container inventory**: Browse top-level LDP containers
   - `GET /vault/` → list sub-containers (concepts, projects, daily)
   - Count resources per container
   - Check Type Index for class → container mappings

## Output Format

```
Pod: {url}
Profile: {profile-iri}
Features: ldp-browse, [other features]

Containers:
  - /vault/concepts/   ({n} resources, skos:Concept)
  - /vault/projects/   ({n} resources, Project)
  - /vault/daily/      ({n} resources, DailyNote)

Vocabularies (TBox):
  - skos: (SKOS Core)
  - dct: (Dublin Core Terms)
  - prov: (PROV-O)

Shapes ({n} shapes):
  - ConceptNoteShape — targets skos:Concept
    agentInstruction: "..."
  ...

SPARQL examples ({n} examples):
  - "List all concepts" → Comunica over /vault/concepts/
  ...

Type Index:
  - skos:Concept → /vault/concepts/
  ...
```
