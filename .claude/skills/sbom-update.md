# /sbom-update

Generate or update SPDX 3.0 Software Bill of Materials for the project.

## Usage
```
/sbom-update
```

## Steps

1. **Scan dependencies**:
   - Python: parse `pyproject.toml`
   - Docker: parse `docker-compose.yml` for container images (CSS, node:20-slim)
   - CSS extensions (Phase 2): parse any `package.json` for Node.js dependencies

2. **Generate SPDX 3.0 SBOM**:
   - Create `provenance/sbom.spdx.json`
   - Include all direct dependencies with versions
   - Include container image references
   - Add creator info (ORCID, agent DID if available)

3. **Update codemeta.json**:
   - Sync dependency list
   - Update version if changed

4. **PROV-O activity record**:
   - Record SBOM generation as `prov:Activity`
   - Link to `prov:wasAssociatedWith` (Claude Code agent)

5. Report: dependencies counted, any new/changed/removed deps
