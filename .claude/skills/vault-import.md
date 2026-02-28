# /vault-import

Import a subset of the Obsidian vault into a Solid Pod as LDP resources.

## Usage
```
/vault-import [--source <vault-path>] [--target <pod-url>] [--subset <folder>]
```
Example: `/vault-import --source ~/Obsidian/obsidian --target http://localhost:3000 --subset "03 - Resources/Agentic Memory Systems"`

## Steps

1. **Select vault subset**: Default is Agentic Memory Systems concept notes (~20 files)
   - Read files from source path
   - Filter by frontmatter `type:` (concept-note, theory-note, method-note)

2. **Map PARA folders → LDP containers** (D6):
   - `03 - Resources/Agentic Memory Systems/` → `/vault/concepts/`
   - `01 - Projects/` → `/vault/projects/`
   - `Daily/` → `/vault/daily/`

3. **Map frontmatter → RDF metadata** (D7):
   - Read SHACL shape from `shapes/concept-note.ttl`
   - For each note: parse YAML frontmatter → generate Turtle `.meta` content
   - Resolve wikilinks → Pod URIs (using SSSOM crosswalk if available)
   - Default wikilink predicate: `skos:related`

4. **Generate PROV-O provenance** (D20):
   - `prov:wasGeneratedBy` → import activity
   - `prov:wasDerivedFrom` → source Markdown file path
   - `prov:wasAttributedTo` → ORCID

5. **Compute content integrity** (D21):
   - SHA-256 hash of Markdown content → `ni:digestMultibase` in `.meta`

6. **Upload to CSS**:
   - Create LDP containers (POST with BasicContainer type)
   - Upload Markdown as primary resource (Content-Type: text/markdown)
   - Upload Turtle metadata as `.meta` sidecar (PATCH)
   - Validate each resource against SHACL shape before upload

7. **Update navigation indexes** (D9):
   - Generate/update Solid Type Index
   - Generate/update JSON-LD index document
   - Update `.well-known/void` with dataset statistics

8. Report: resources created, validation results, any errors
