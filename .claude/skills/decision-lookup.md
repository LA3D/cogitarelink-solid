# /decision-lookup

Cross-reference architectural decisions for the cogitarelink-solid project.

## Usage
```
/decision-lookup <decision-id-or-topic>
```
Examples:
- `/decision-lookup D7` — frontmatter mapping
- `/decision-lookup SPARQL` — all SPARQL-related decisions
- `/decision-lookup Phase 1` — decisions relevant to Phase 1

## Steps

1. **Parse query**: Decision ID (D1-D27) or keyword/topic

2. **Search decisions**:
   - Check `.claude/rules/decisions-index.md` for concise index
   - For full detail: read `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md`

3. **Cross-reference**:
   - Link to related decisions (e.g., D7 relates to D11, D6, D10)
   - Link to vault theory notes where applicable
   - Link to implementation files if code exists

4. **Output**: Decision summary, rationale, related decisions, implementation status
