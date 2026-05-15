# Solid Skills Restructure — Design

**Date**: 2026-05-15
**Status**: Approved design, ready for implementation plan
**Owner**: Chuck Vardeman + Claude

## Context

This project currently has a tangled relationship between three things:

1. **Vendored upstream Solid documentation** at `vendor/solid-llm-skills/solid/{spec,servers,data-modelling,integration-guide}.md` — verbatim from `solid/solid-llm-skills` upstream
2. **Project-local "router" skill files** at `.claude/skills/solid-spec.md` and `.claude/skills/solid-integration.md` that route to the vendored content and add deltas
3. **Project-local builder skills** at `.claude/skills/{css-extension,components-override,metadata-writer,monitoring-store,comunica-sources,shacl-shapes}.md` — flat markdown files documenting CSS extension authoring patterns

Three problems with the current arrangement:

- **Claude Code's RL-trained skill discovery looks inside `.claude/skills/`**, not into `vendor/`. The routing indirection makes the vendored content effectively invisible to natural agent navigation.
- **The vendored README has stale claims** (references an `engineering/` folder that was deleted from upstream). Source: PR #13 to upstream `solid/solid-llm-skills`.
- **`spec-documents.md` — the canonical Solid specs index — is not vendored.** Agents reading our skills have no enumerated map of Solid specifications (Solid Protocol v0.11.0, WebID Profile v1.0.0, Solid-OIDC v0.1.0, ACP v0.9.0).

Plus: project-specific decisions (Memento per D61-D68, affordance descriptors per D52/D55/D58, wiki-memory L3 per D70-D81, storage description per D44/D48/D49) live as D-numbered entries in `decisions-index.md` — discoverable only via `/decision-lookup`. They have no skill-level surface.

## Goal

Restructure project-local skills to:

1. **Match Claude Code's canonical skill format** (`<skill-name>/SKILL.md` subdirectory pattern with optional `references/`)
2. **Eliminate the `vendor/` indirection** — upstream content moves directly into skill directories, with sync discipline preserved by a script
3. **Surface project deltas as first-class skills** so agents discover Memento, affordance descriptors, wiki-memory L3, storage description naturally
4. **Cross-reference all Solid specifications** so agents can navigate from a skill to the relevant spec URLs and version pins

## Out of scope

- Operational slash commands (`pod-discover`, `pod-init`, `pod-sparql`, `pod-status`, `pod-validate`, `vault-import`, `sbom-update`, `decision-lookup`) — they're user-typed commands, not Claude-invoked skills. May migrate to `.claude/commands/` later in a separate restructure.
- Upstream contributions back to `solid/solid-llm-skills` — possible follow-up after this work, not part of it.
- Restructuring `.claude/rules/*.md` files — they stay always-loaded and remain unchanged.
- Migrating other Claude Code conventions (hooks, settings) — out of scope.

## Design

### Section 1: Skill format — subdirectory-per-skill

Verified against official Claude Code skill spec (https://code.claude.com/docs/en/skills.md):

- Canonical format: `<skill-name>/SKILL.md` with optional `references/` subdirectory
- Frontmatter: `name` and `description` are recommended; `when_to_use` is the trigger-phrase field; all other fields optional including custom ones
- `description` + `when_to_use` combined truncated at 1,536 chars in skill listing
- `references/` is a community pattern, NOT auto-ingested — SKILL.md must explicitly link to reference files
- License files have no official convention; colocation in skill directory is acceptable for vendored content

Structure per skill:

```
.claude/skills/<skill-name>/
├── SKILL.md
├── references/
│   ├── spec.md          ← upstream verbatim (Category 1 only; sync target)
│   └── deltas.md        ← project divergences
├── LICENSE.MIT.md       ← Category 1 only
├── LICENSE.Apache-2.0.md ← Category 1 only
└── UPSTREAM.md          ← Category 1 only — sync record
```

### Section 2: Skill scope (15 skills total)

**Category 1 — upstream-derived (5 skills)**

| Skill | Upstream source | Deltas captured |
|---|---|---|
| `solid-spec` | `solid/spec.md` | D44 storage description, D75 RDFa drop, D14 DID-WebID bridge |
| `solid-servers` | `solid/servers.md` | D1 CSS+TS+Comunica architecture, D28 CSS v8 alpha |
| `solid-data-modelling` | `solid/data-modelling.md` | D34 SKOS, D46 upstream shape contribution, D77 5-shape catalog |
| `solid-integration-guide` | `solid/integration-guide.md` | D29 solid-agent-skills CLI, N3.js star findings |
| `solid-spec-documents` | `spec-documents.md` | Net-new — currently un-vendored canonical specs index |

`solid/style-guide.md` deliberately skipped (branding, irrelevant to engineering).

**Category 2 — local-only Solid extensions (4 NEW skills)**

| Skill | Decisions covered | Source material |
|---|---|---|
| `solid-memento` | D61-D68, K1 | `decisions-index.md` Phase 5 + `Memento Vocabulary Alignment.md` (vault) |
| `solid-affordance-descriptors` | D52, D55, D58 | `decisions-index.md` Phase 4 + `docs/plans/2026-04-01-pod-agentic-memory-structure-design.md` |
| `solid-wiki-memory-l3` | D70-D81, K2-K3 | `decisions-index.md` Phase 5d-5g + `docs/superpowers/specs/2026-05-15-rung-1-4-wiki-memory-l3-implementation-design.md` |
| `solid-storage-description` | D44, D48, D49 | `decisions-index.md` Phase 3 + storage description config files |

**Category 3 — builder skills migrated (6 skills)**

Convert from flat `.claude/skills/<name>.md` to `<name>/SKILL.md` subdirectory pattern; preserve content, add frontmatter, split into `references/` if appropriate:

- `css-extension`, `components-override`, `metadata-writer`, `monitoring-store`, `comunica-sources`, `shacl-shapes`

**Category 4 — deferred (8 operational slash commands)**

`pod-discover`, `pod-init`, `pod-sparql`, `pod-status`, `pod-validate`, `vault-import`, `sbom-update`, `decision-lookup` — out of scope per "Out of scope" section above.

### Section 3: File structure conventions

#### Frontmatter

Category 1 example:

```yaml
---
name: solid-spec
description: Solid Protocol, WebID Profile, Solid-OIDC, ACP, and WAC specifications. References upstream content synced from solid/solid-llm-skills, with project-specific deltas where this Pod diverges (storage description per D44, RDFa drop per D75).
when_to_use: When answering questions about Solid Protocol semantics, authentication flow, access control, or when implementing a Solid-conformant resource. Also when comparing this Pod's behavior against upstream Solid defaults.
license: MIT OR Apache-2.0
upstream:
  repo: solid/solid-llm-skills
  path: solid/spec.md
  sha: 9a1cab179346cd098d4f6e7fd8c8a611f86fe127
  date: 2026-05-14
---
```

Category 2 example (no upstream/license fields):

```yaml
---
name: solid-memento
description: Memento (RFC 7089) integration on this Pod — Trellis-style query-string URI minting, MonitoringStore CDC, tombstone semantics via LDES + AS2. Read-only Memento shipped Rung 1.1; tombstones shipped Rung 1.2.
when_to_use: When working with time-travel queries against this Pod, implementing or debugging the Memento extension at css/extensions/memento/, or designing VC-gated deletion workflows.
---
```

Category 3 example (builder skill, no upstream):

```yaml
---
name: css-extension
description: Scaffold a new Community Solid Server (CSS) v8 extension that loads via Components.js DI. Codifies the pattern used by markdown-projection, shape-validator, metadata-card, and memento extensions.
when_to_use: When building a new CSS extension — defining package.json lsd:* fields, tsconfig CommonJS settings, Components.js wiring, Dockerfile symlink trick. Also for debugging componentsjs-generator failures.
---
```

#### SKILL.md content shape

Each `SKILL.md` is short and routes-by-pointer to detail:

```markdown
---
<frontmatter>
---

# Solid Spec

Upstream Solid Protocol reference (verbatim): [references/spec.md](references/spec.md)

Project-specific deltas — D44 storage description, D75 RDFa drop, D14 DID-WebID bridge: [references/deltas.md](references/deltas.md)

## When to read which

| If the question is about... | Read |
|---|---|
| WebID profile, Solid-OIDC flow, ACP/WAC | `references/spec.md` |
| How this Pod diverges from defaults | `references/deltas.md` |
| A specific decision (D1-D81) | `.claude/rules/decisions-index.md`, then this or sibling skill |
```

#### `references/spec.md`

Verbatim upstream content. Sync script overwrites this on each refresh. No hand edits.

#### `references/deltas.md`

Free-form markdown. Per-delta heading with D-number reference, one paragraph on the divergence, pointer to authoritative artifact.

#### `LICENSE.MIT.md` + `LICENSE.Apache-2.0.md`

Verbatim from upstream. Per-skill colocation makes SPDX-License-Identifier locally verifiable.

#### `UPSTREAM.md`

Sync record:

```markdown
# Upstream sync record

**Source**: https://github.com/solid/solid-llm-skills/blob/main/solid/spec.md
**SHA**: 9a1cab179346cd098d4f6e7fd8c8a611f86fe127
**Synced**: 2026-05-14
**Refresh**: `scripts/sync_solid_skills.py solid-spec`
```

### Section 4: Sync script

Path: `scripts/sync_solid_skills.py`

Usage:

```bash
~/uvws/.venv/bin/python scripts/sync_solid_skills.py             # refresh all Category 1 skills
~/uvws/.venv/bin/python scripts/sync_solid_skills.py solid-spec  # refresh one
~/uvws/.venv/bin/python scripts/sync_solid_skills.py --check     # drift check; exit 1 if out of date; no writes
~/uvws/.venv/bin/python scripts/sync_solid_skills.py --licenses  # refresh LICENSE files (manual, rare)
```

Mapping table embedded in script:

```python
UPSTREAM_SKILLS = {
    "solid-spec":             "solid/spec.md",
    "solid-servers":          "solid/servers.md",
    "solid-data-modelling":   "solid/data-modelling.md",
    "solid-integration-guide": "solid/integration-guide.md",
    "solid-spec-documents":   "spec-documents.md",
}
```

Per-skill sync flow:

1. `gh api repos/solid/solid-llm-skills/contents/<path>` → fetch upstream content (base64-decoded)
2. `gh api repos/solid/solid-llm-skills/commits/main` → fetch current SHA + commit date
3. Compare upstream content vs local `references/spec.md`; compare SHA in `UPSTREAM.md`
4. If both match → no-op, exit 0
5. If different → overwrite `references/spec.md`, rewrite `UPSTREAM.md`, update SKILL.md frontmatter `upstream.sha` + `upstream.date` (preserve everything else); print one-line diff
6. Never touch `references/deltas.md`, LICENSE files, or anything else

`--check` mode: same flow but exits 1 on drift without writing. Suitable for pre-commit hook.

Dependencies: `httpx` (already in `~/uvws/.venv`), Python stdlib only otherwise. No new project deps.

### Section 5: Migration plan (5 phases)

#### Phase 1 — Foundation

1. Add `scripts/sync_solid_skills.py` + smoke test against one upstream file
2. Create 5 Category 1 skills (`solid-spec`, `solid-servers`, `solid-data-modelling`, `solid-integration-guide`, `solid-spec-documents`):
   - Create directory + `references/`
   - Run sync script → populates `references/spec.md` + `UPSTREAM.md`
   - Hand-write `SKILL.md` frontmatter + content (per Section 3 template)
   - Hand-write `references/deltas.md` extracting relevant D-numbers
   - Copy `LICENSE.MIT.md` + `LICENSE.Apache-2.0.md` from `vendor/solid-llm-skills/`
3. Verify discovery: fresh test agent confirms new skills appear in available-skills listing

**Commit boundary**: one commit, low risk (additive only).

#### Phase 2 — Local-only extensions

4. Create 4 Category 2 skills (`solid-memento`, `solid-affordance-descriptors`, `solid-wiki-memory-l3`, `solid-storage-description`):
   - Directory + SKILL.md + references/ (no UPSTREAM.md, no LICENSE)
   - Content extracted from `decisions-index.md` D-clusters and `docs/plans/*.md` / `docs/superpowers/specs/*.md` excerpts
   - `when_to_use` written to match questions agents would naturally ask

**Commit boundary**: one commit, low risk (additive only).

#### Phase 3 — Migrate builder skills

5. Convert 6 Category 3 skills from flat-file to subdirectory pattern:
   - `mv .claude/skills/<name>.md .claude/skills/<name>/SKILL.md`
   - Add YAML frontmatter (`description`, `when_to_use`)
   - Optionally split large content into `references/` (e.g., `css-extension/references/dockerfile-pattern.md` for the symlink trick)

**Commit boundary**: one commit for all 6 — the migration is mechanical and bounded; coherent diff helps review. Medium risk — could affect agent discovery in subtle ways; verify before Phase 4.

#### Phase 4 — Cleanup

6. Delete `vendor/solid-llm-skills/` entirely (content has moved)
7. Update `CLAUDE.md` rules + skills tables to reflect new layout (specifically the "Operational skills" and "Builder skills" tables, and the vendor-related text in the "Tech stack" / preamble)
8. Update `decisions-index.md` to add "see also" pointers from D-clusters to their new skills:
   - D61-D68 → `.claude/skills/solid-memento/`
   - D52/D55/D58 → `.claude/skills/solid-affordance-descriptors/`
   - D70-D81 → `.claude/skills/solid-wiki-memory-l3/`
   - D44/D48/D49 → `.claude/skills/solid-storage-description/`
9. Verify `pod-init`, `vault-import`, `decision-lookup` operational commands still work (Category 4 — out of scope but shouldn't break)

**Commit boundary**: one commit, highest risk (deletion). Depends on Phases 1-3 being verified.

#### Phase 5 — Sync hygiene

10. Document the refresh procedure in `CLAUDE.md`: "Run `scripts/sync_solid_skills.py` periodically; one commit per refresh, message format `[Agent: Claude] sync: solid-llm-skills <new-sha>`"
11. (Optional) Add `--check` to pre-commit hook so drift is caught early

**Commit boundary**: one commit, low risk (documentation + optional hook).

### Verification gates between phases

- **After Phase 1**: confirm `solid-spec` is invokable via Skill tool in a fresh session; confirm `references/spec.md` matches upstream byte-for-byte
- **After Phase 2**: confirm new local-only skills appear in available-skills listing
- **After Phase 3**: confirm migrated skills still respond to the same questions they did before (regression check)
- **After Phase 4**: grep entire repo for `vendor/solid-llm-skills` references — must be zero
- **After Phase 5**: confirm `--check` flag exits 0 on a clean repo

## Open questions

1. **Plugin vs project-local namespace**: Project-local skills don't have a plugin prefix in `available-skills`. Do we need to namespace them (e.g., `solid:spec`) to avoid collision with eventual upstream Solid-themed plugins? Decision: leave un-namespaced for now; rename if collision becomes a problem.

2. **deltas.md granularity**: One `deltas.md` per skill (4-6 sections) vs one delta entry per file (e.g., `references/d44-storage-description.md`). Decision: single `deltas.md` for v1; split later if any individual deltas exceed ~500 lines.

3. **Sync script identity**: Use `gh api` (requires `gh` CLI auth) vs direct `httpx.get('https://raw.githubusercontent.com/...')` (no auth needed for public repos). Decision: `gh api` is preferred — already used in `vendor/solid-llm-skills/README.md` refresh procedure, handles rate limits, and the user has it configured.

4. **CLAUDE.md update wording**: How much detail to leave in CLAUDE.md vs delegate to skills? Decision: CLAUDE.md keeps the skill index (one-liner per skill); detail lives in skills.

## References

- Claude Code skills spec: https://code.claude.com/docs/en/skills.md
- Upstream repo: https://github.com/solid/solid-llm-skills
- Upstream HEAD: `9a1cab179346cd098d4f6e7fd8c8a611f86fe127` (2026-05-14)
- Closed upstream PR #13 (engineering/ deletion context): https://github.com/solid/solid-llm-skills/pull/13
- Sibling design doc (wiki-memory L3 — source material for `solid-wiki-memory-l3`): `docs/superpowers/specs/2026-05-15-rung-1-4-wiki-memory-l3-implementation-design.md`
- Project decisions index: `.claude/rules/decisions-index.md`
