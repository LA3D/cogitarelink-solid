# /pod-validate

Validate Pod resources against SHACL shapes and verify content integrity.

## Usage
```
/pod-validate [--pod <pod-url>] [--container <path>] [--check-integrity]
```
Example: `/pod-validate --pod http://localhost:3000 --container /vault/concepts/ --check-integrity`

## Steps

1. **Load shapes**: Read from `shapes/` directory or `{pod}/.well-known/shacl`

2. **Fetch resources**: GET each resource in the target container
   - Follow `ldp:contains` links to enumerate resources
   - Fetch `.meta` sidecar for each resource

3. **SHACL validation**: For each resource metadata graph:
   - Validate against appropriate shape (by `sh:targetClass`)
   - Report conformance/violations per resource
   - Extract `sh:agentInstruction` for any violations

4. **Content integrity check** (if `--check-integrity`):
   - Fetch resource content (Markdown)
   - Compute SHA-256 hash
   - Compare with `ni:digestMultibase` in `.meta`
   - Report mismatches

5. **PROV-O chain validation** (D20):
   - Verify every `.meta` has `prov:wasGeneratedBy`, `prov:wasDerivedFrom`, `prov:wasAttributedTo`
   - Validate against ProvShape if available

6. Report: conformance summary, integrity mismatches, missing provenance
