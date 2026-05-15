# Solid Skills Restructure — Execution Plan

> **For agentic workers:** This is content shuffling, not engineering. No formal TDD. Verification is "Claude Code lists the skill" — a live check, not pytest. Steps use `- [ ]` for tracking.

**Goal:** Move upstream Solid docs out of `vendor/` and into proper `.claude/skills/<name>/SKILL.md` skills with frontmatter; add 4 local-only skills for our deltas; migrate 6 builder skills from flat-file to subdirectory; delete `vendor/`; update CLAUDE.md.

**Spec:** `docs/superpowers/specs/2026-05-15-solid-skills-restructure-design.md`

---

## Phase 1 — Sync script + 5 upstream-derived skills

### Task 1: Write the sync script

**File:** `scripts/sync_solid_skills.py`

- [ ] Write the script:

```python
#!/usr/bin/env python3
"""Sync upstream solid/solid-llm-skills content into .claude/skills/<name>/references/spec.md.

Usage:
    sync_solid_skills.py                  # refresh all
    sync_solid_skills.py solid-spec       # refresh one
    sync_solid_skills.py --check          # exit 1 if drift; no writes
"""
from __future__ import annotations
import argparse
import base64
import json
import subprocess
import sys
from pathlib import Path

UPSTREAM_REPO = "solid/solid-llm-skills"
SKILLS_ROOT = Path(__file__).resolve().parent.parent / ".claude" / "skills"

UPSTREAM_SKILLS = {
    "solid-spec":              "solid/spec.md",
    "solid-servers":           "solid/servers.md",
    "solid-data-modelling":    "solid/data-modelling.md",
    "solid-integration-guide": "solid/integration-guide.md",
    "solid-spec-documents":    "spec-documents.md",
}

def gh_api(path: str) -> dict:
    result = subprocess.run(
        ["gh", "api", f"repos/{UPSTREAM_REPO}/{path}"],
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)

def fetch_upstream(path: str) -> tuple[str, str]:
    """Return (content, sha) for the given upstream path at HEAD."""
    commit = gh_api("commits/main")
    head_sha = commit["sha"]
    file_data = gh_api(f"contents/{path}?ref={head_sha}")
    content = base64.b64decode(file_data["content"]).decode("utf-8")
    return content, head_sha

def local_spec_path(skill: str) -> Path:
    return SKILLS_ROOT / skill / "references" / "spec.md"

def local_upstream_path(skill: str) -> Path:
    return SKILLS_ROOT / skill / "UPSTREAM.md"

def read_local_sha(skill: str) -> str | None:
    p = local_upstream_path(skill)
    if not p.exists():
        return None
    for line in p.read_text().splitlines():
        if line.startswith("**SHA**:"):
            return line.split(":", 1)[1].strip().strip("`")
    return None

def write_upstream_md(skill: str, sha: str, upstream_path: str, date: str) -> None:
    body = (
        f"# Upstream sync record\n\n"
        f"**Source**: https://github.com/{UPSTREAM_REPO}/blob/{sha}/{upstream_path}\n"
        f"**SHA**: `{sha}`\n"
        f"**Synced**: {date}\n"
        f"**Refresh**: `scripts/sync_solid_skills.py {skill}`\n"
    )
    local_upstream_path(skill).write_text(body)

def update_skill_frontmatter(skill: str, sha: str, date: str) -> None:
    """Rewrite `upstream.sha` and `upstream.date` lines in SKILL.md frontmatter, preserve everything else."""
    skill_md = SKILLS_ROOT / skill / "SKILL.md"
    if not skill_md.exists():
        return  # SKILL.md created by hand; nothing to update yet
    text = skill_md.read_text()
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith("sha:"):
            indent = line[: len(line) - len(line.lstrip())]
            lines[i] = f"{indent}sha: {sha}"
        elif line.strip().startswith("date:"):
            indent = line[: len(line) - len(line.lstrip())]
            lines[i] = f"{indent}date: {date}"
    skill_md.write_text("\n".join(lines) + "\n")

def sync_one(skill: str, check_only: bool = False) -> bool:
    """Returns True if up-to-date (or freshly synced when check_only=False), False if drift exists."""
    upstream_path = UPSTREAM_SKILLS[skill]
    content, sha = fetch_upstream(upstream_path)
    spec_path = local_spec_path(skill)
    local_sha = read_local_sha(skill)
    local_content = spec_path.read_text() if spec_path.exists() else ""
    in_sync = local_content == content and local_sha == sha
    if in_sync:
        print(f"{skill}: up-to-date ({sha[:8]})")
        return True
    if check_only:
        print(f"{skill}: DRIFT (local={local_sha[:8] if local_sha else 'none'}, upstream={sha[:8]})")
        return False
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(content)
    commit = gh_api(f"commits/{sha}")
    date = commit["commit"]["author"]["date"][:10]
    write_upstream_md(skill, sha, upstream_path, date)
    update_skill_frontmatter(skill, sha, date)
    print(f"{skill}: synced {(local_sha or 'none')[:8]} -> {sha[:8]}")
    return True

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("skill", nargs="?", help="single skill to sync; default = all")
    parser.add_argument("--check", action="store_true", help="exit 1 on drift; no writes")
    args = parser.parse_args()
    targets = [args.skill] if args.skill else list(UPSTREAM_SKILLS.keys())
    for s in targets:
        if s not in UPSTREAM_SKILLS:
            print(f"unknown skill: {s}; known: {list(UPSTREAM_SKILLS)}", file=sys.stderr)
            return 2
    all_in_sync = all(sync_one(s, check_only=args.check) for s in targets)
    return 0 if all_in_sync else 1

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] `chmod +x scripts/sync_solid_skills.py`

- [ ] Smoke test against one skill:

```bash
mkdir -p .claude/skills/solid-spec/references
~/uvws/.venv/bin/python scripts/sync_solid_skills.py solid-spec
ls .claude/skills/solid-spec/
# Expect: references/ UPSTREAM.md
cat .claude/skills/solid-spec/UPSTREAM.md
# Expect: filled-in sync record with SHA and date
```

- [ ] Verify drift detection:

```bash
~/uvws/.venv/bin/python scripts/sync_solid_skills.py --check solid-spec
# Expect: "solid-spec: up-to-date" and exit 0
echo "x" >> .claude/skills/solid-spec/references/spec.md
~/uvws/.venv/bin/python scripts/sync_solid_skills.py --check solid-spec
# Expect: "solid-spec: DRIFT" and exit 1
~/uvws/.venv/bin/python scripts/sync_solid_skills.py solid-spec
# Expect: synced, file restored
```

- [ ] Commit:

```bash
git add scripts/sync_solid_skills.py
git commit -m "$(cat <<'EOF'
[Agent: Claude] Add sync_solid_skills.py for upstream skill refresh

Syncs upstream solid/solid-llm-skills content into per-skill
references/spec.md files. Drift-aware --check mode for pre-commit.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create `solid-spec` skill

**Files:**
- `.claude/skills/solid-spec/SKILL.md`
- `.claude/skills/solid-spec/references/spec.md` (created by sync script in Task 1)
- `.claude/skills/solid-spec/references/deltas.md`
- `.claude/skills/solid-spec/LICENSE.MIT.md`
- `.claude/skills/solid-spec/LICENSE.Apache-2.0.md`
- `.claude/skills/solid-spec/UPSTREAM.md` (created by sync script in Task 1)

- [ ] Copy license files from vendor:

```bash
cp vendor/solid-llm-skills/LICENSE.MIT.md .claude/skills/solid-spec/
cp vendor/solid-llm-skills/LICENSE.Apache-2.0.md .claude/skills/solid-spec/
```

- [ ] Write `SKILL.md`:

```markdown
---
name: solid-spec
description: Solid Protocol, WebID Profile, Solid-OIDC, ACP, and WAC specifications. References upstream content synced from solid/solid-llm-skills, with project-specific deltas where this Pod diverges (storage description per D44, RDFa drop per D75, alsoKnownAs DID-WebID bridge per D14).
when_to_use: When answering questions about Solid Protocol semantics, authentication flow, access control, or when implementing a Solid-conformant resource. Also when comparing this Pod's behavior against upstream Solid defaults.
license: MIT OR Apache-2.0
upstream:
  repo: solid/solid-llm-skills
  path: solid/spec.md
  sha: 9a1cab179346cd098d4f6e7fd8c8a611f86fe127
  date: 2026-05-14
---

# Solid Spec

Upstream Solid Protocol reference (verbatim): [`references/spec.md`](references/spec.md)

Project-specific deltas — D44 storage description, D75 RDFa drop, D14 DID-WebID bridge: [`references/deltas.md`](references/deltas.md)

## When to read which

| Question | Read |
|---|---|
| WebID profile structure, Solid-OIDC token flow, ACP matchers, WAC modes | `references/spec.md` |
| How this Pod diverges from defaults | `references/deltas.md` |
| Specific decision (D1-D81) | `.claude/rules/decisions-index.md` → this skill or a sibling |

## Related skills

- `solid-storage-description` — D44 storage description (replaces `.well-known/void`)
- `solid-memento` — RFC 7089 + tombstones (D61-D68)
- `solid-affordance-descriptors` — body-affordance harness (D52, D55, D58)
- `solid-wiki-memory-l3` — wiki-memory L3 reference profile (D70-D81)
```

- [ ] Write `references/deltas.md` by extracting D44, D75, D14 entries verbatim from `.claude/rules/decisions-index.md`. Wrap each in a heading:

```markdown
# Project deltas — solid-spec

## D14 — alsoKnownAs DID-WebID bridge

[Paste D14 body from decisions-index.md]

Authoritative artifact: WebID profile in `css/config/pod-templates/`.

## D44 — Storage description replaces `.well-known/void`

[Paste D44 body from decisions-index.md]

Authoritative artifact: `css/config/storage-description.json`. See sibling skill `solid-storage-description`.

## D75 — RDFa drop (revises D37)

[Paste D75 body from decisions-index.md]

Authoritative artifact: `css/extensions/markdown-render/` (renamed from markdown-rdfa). See `docs/superpowers/specs/2026-05-15-rung-1-4-wiki-memory-l3-implementation-design.md` for full reasoning.
```

- [ ] Verify discoverability — restart Claude Code session, check that `solid-spec` appears in available skills list (or list via `/help`).

- [ ] Commit:

```bash
git add .claude/skills/solid-spec/
git commit -m "$(cat <<'EOF'
[Agent: Claude] Add solid-spec skill (Category 1, upstream-derived)

Replaces vendor/solid-llm-skills/solid/spec.md routing in
.claude/skills/solid-spec.md (still flat, removed in Phase 4).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Tasks 3-6: Create remaining Category 1 skills

Repeat Task 2's pattern for `solid-servers`, `solid-data-modelling`, `solid-integration-guide`, `solid-spec-documents`. Specifics:

- [ ] **Task 3: `solid-servers`**
  - Run `~/uvws/.venv/bin/python scripts/sync_solid_skills.py solid-servers`
  - Copy LICENSE files
  - `SKILL.md` frontmatter `description`: "Community Solid Server, Pivot, public servers, Docker, CLI. References upstream content with project-specific deltas: this stack uses CSS v8 alpha (D1, D28) with custom extensions (memento, markdown-projection, markdown-render, metadata-card, shape-validator)."
  - `SKILL.md` `when_to_use`: "When working with the CSS stack — config overrides, Docker setup, CLI invocation. Also when comparing public servers (solidcommunity.net, etc.) against this Pod."
  - `deltas.md` extracts D1 + D28 from decisions-index.md
  - Commit

- [ ] **Task 4: `solid-data-modelling`**
  - Run `~/uvws/.venv/bin/python scripts/sync_solid_skills.py solid-data-modelling`
  - Copy LICENSE files
  - `description`: "Vocabularies (SKOS, FOAF, DCT, PROV, CITO), SHACL conventions, Type Index, FAIR data principles. References upstream content with project-specific deltas: SKOS for end-user content (D34, novel for Solid), shapes contributed upstream when domain-neutral (D46), 5-shape catalog for wiki-memory L3 (D77), class-based targeting (D78)."
  - `when_to_use`: "When designing a SHACL shape for this Pod, picking a vocabulary, registering a class in Type Index, or deciding which shapes belong upstream vs local."
  - `deltas.md` extracts D34, D46, D77, D78
  - Commit

- [ ] **Task 5: `solid-integration-guide`**
  - Run sync, copy LICENSE files
  - `description`: "@inrupt/solid-client, solid-client-authn, LDO, N3.js, Bashlib. References upstream content with project-specific deltas: solid-agent-skills CLI (D29, sibling repo), DID-WebID bridge in profiles (D14), N3.js RDF-star tooling probe findings."
  - `when_to_use`: "When writing TypeScript/JavaScript that talks to this Pod, choosing between client libraries, or implementing authentication."
  - `deltas.md` extracts D29, D14, plus a section on RDF-star tooling state pointing to `docs/plans/2026-05-15-rdf-star-provenance-exploration.md`
  - Commit

- [ ] **Task 6: `solid-spec-documents`**
  - Run sync (this fetches `spec-documents.md` from upstream root, not `solid/`)
  - Copy LICENSE files
  - `description`: "Canonical index of Solid specifications with version pins and URLs (Solid Protocol v0.11.0, WebID Profile v1.0.0, Solid-OIDC v0.1.0, ACP v0.9.0). References upstream content; no project deltas."
  - `when_to_use`: "When you need the authoritative URL or version of a Solid spec, or when picking which spec to read first."
  - `deltas.md`: a short note saying "No project-specific deltas — this skill is a pure index. For divergences, see sibling skills."
  - Commit

---

### Phase 1 verification

- [ ] All 5 Category 1 skill directories exist with SKILL.md + references/spec.md + references/deltas.md + LICENSE files + UPSTREAM.md
- [ ] `~/uvws/.venv/bin/python scripts/sync_solid_skills.py --check` exits 0
- [ ] Restart Claude Code session; spawn a fresh test agent with: "What does solid-spec cover?" — confirm the agent invokes the new skill (not the legacy flat-file router)

---

## Phase 2 — 4 local-only skills

### Task 7: Create `solid-memento`

**Files:**
- `.claude/skills/solid-memento/SKILL.md`
- `.claude/skills/solid-memento/references/design.md`

- [ ] Write `SKILL.md`:

```markdown
---
name: solid-memento
description: Memento (RFC 7089) integration on this Pod — Trellis-style query-string URI minting, MonitoringStore CDC, tombstone semantics via LDES + AS2. Read-only Memento shipped Rung 1.1; tombstones shipped Rung 1.2. VC-aware operation gating deferred to Rung 1.3.
when_to_use: When working with time-travel queries against this Pod, implementing or debugging the css/extensions/memento extension, designing VC-gated deletion workflows, or answering questions about how this Pod handles versioning.
---

# Solid Memento

Memento (RFC 7089) integration for time-travel + tombstone semantics. The full design lives in [`references/design.md`](references/design.md).

## Quick reference

- URI minting: Trellis-style query strings — `?ext=timemap` for TimeMap, `?version=<14-digit-datetime>` for Memento (D61)
- OriginalResource doubles as TimeGate (RFC 7089 Pattern 1.1)
- ACP applies to OriginalResource and inherits across all Mementos (D62)
- Soft delete via `ldes:DeletedLDPResource` + `as:Delete` commit; 410 Gone on plain GET (D64)
- MonitoringStore CDC over fswatch (D65) — listens to CSS's native `'changed'` event
- Per-path git commits with `.git/memento.lock` for multi-worker safety (D66, D68)
- Link/Vary advertisement via `MementoLinkMetadataWriter` (D67)

## Implementation

`css/extensions/memento/` — TypeScript CSS v8 extension. See `references/design.md` for the full architecture map.

## Known limitations

- K1: `OverrideListInsertAt` against empty handlers list fails in Components.js v8.0.0-alpha.3; worked around via full replacement of `urn:solid-server:default:WorkerParallelInitializer`
- RQ-Memento-1: ACP fragmentation across time (when does D62 inheritance break?) — open

## Related skills

- `solid-spec` — Solid Protocol baseline
- `monitoring-store` — CSS MonitoringStore CDC pattern this extension uses
- `metadata-writer` — `MetadataWriter` composition for Memento Link/Vary headers
```

- [ ] Write `references/design.md` by extracting D61-D68 + K1 verbatim from `.claude/rules/decisions-index.md`, plus the "Phase 5 — Memento" section.

- [ ] Commit:

```bash
git add .claude/skills/solid-memento/
git commit -m "[Agent: Claude] Add solid-memento skill (Category 2, local-only)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Create `solid-affordance-descriptors`

- [ ] Write `SKILL.md`:

```markdown
---
name: solid-affordance-descriptors
description: Body-affordance descriptor architecture on this Pod — per-content-type discoverability for body content beyond LDP RDFSource/NRSource. Closes the Solid spec gap (D52); HATEOAS three-tier access (D55); body affordances first-class when descriptor-declared (D58).
when_to_use: When designing or debugging an affordance descriptor at /meta/affordances/, building a new content-type handler (markdown flavor, iCal, etc.), or deciding whether body content should project into `.meta` triples.
---

# Solid Affordance Descriptors

Per-content-type body-affordance descriptors at `/meta/affordances/<name>`. Closes the Solid spec gap on body-affordance discoverability. Full design in [`references/design.md`](references/design.md).

## Quick reference

- D52: Affordance descriptors at storage description root, declared as LDP resources at `/meta/affordances/<name>`
- D55: HATEOAS-correct three-tier access — brute-force (spec) + harness (descriptors) + skills (domain). Lower tiers always functional
- D58 (sharpened by D70/D71): body affordances first-class when descriptor-declared. `MarkdownProjectionListener` materializes `.meta` triples from body wikilinks on write — dual-layer linking at single-request cost

## Implementation

`css/extensions/markdown-projection/` — TypeScript CSS v8 extension; canonical example of an affordance descriptor in use (D58 implementation).

## Related skills

- `solid-wiki-memory-l3` — uses affordance descriptors for body wikilinks
- `solid-storage-description` — affordance catalog discoverable via storage description
- `monitoring-store` — projection listener pattern
```

- [ ] Write `references/design.md` extracting D52, D55, D58 from decisions-index.md plus relevant excerpts from `docs/plans/2026-04-01-pod-agentic-memory-structure-design.md`.

- [ ] Commit.

---

### Task 9: Create `solid-wiki-memory-l3`

- [ ] Write `SKILL.md`:

```markdown
---
name: solid-wiki-memory-l3
description: Wiki-memory L3 reference profile on this Pod — page-as-unit, dual-layer linking (markdown wikilinks + .meta predicates), 5-shape SHACL catalog. Substrate stratification L1/L2/L3 (D70). Class-based shape targeting (D78). Predicate-level governance (D81 Model A).
when_to_use: When working with /wiki/{pages,sources,people,procedures,working}/ containers, designing wiki-memory L3 content, implementing or debugging MarkdownProjectionListener, or answering questions about wiki-memory L3 conventions.
---

# Wiki-Memory L3 Reference Profile

Canonical L3 memory profile built from first principles on W3C standards. Full spec in [`references/design.md`](references/design.md); rung 1.4 implementation in [`references/rung-1-4-implementation.md`](references/rung-1-4-implementation.md).

## Quick reference

- D70: L1/L2/L3 stratification (Pod substrate / memory substrate / memory profile)
- D71: Wiki-memory as canonical L3 — dual-layer linking is the architectural commitment
- D72: Compile-once principle — substrate maintains compiled state, agents don't re-derive
- D73: Two-stage commit — `working-memory/` low-ceremony, `mem:Crystallize` to durable
- D74: `mem:*` AS2 trigger vocabulary on LDN + Notifications Protocol
- D75: Rendered HTML serves humans only; RDFa dropped (revises D37)
- D76: URI layout (5 containers), slug algorithm with S3a `@`-strip rule, class-hint resolver, attachment co-location
- D77: 5 SHACL shapes (resource + concept + source + person + procedure + working) — REVISED by D78
- D78: Class-based shape targeting via `rdf:type` + `rdfs:subClassOf`
- D79: Hybrid vocabulary + JSON-LD context at /meta/context.jsonld
- D80: Substrate-derived navigation classes (wiki:Hub, breadcrumbs) via Comunica CONSTRUCT
- D81: Predicate-level governance (Model A) — substrate owns governed predicates, agent owns rest
- K2: slug() doesn't collapse consecutive hyphens (accepted for v1)
- K3: `.author` class hint → `dct:contributor`

## Open caveats

- RQ-Listener-1: CSS overwrites `.meta` on body PUT before listener fires. Mitigation paths in `docs/plans/2026-05-15-rq-listener-1-mitigation-design.md` (A/B/C) plus `docs/plans/2026-05-15-rdf-star-provenance-exploration.md` (candidate D).

## Implementation

- `css/extensions/markdown-projection/` — MarkdownProjectionListener
- `css/extensions/markdown-render/` — HTML rendering with semantic CSS classes (RDFa dropped)
- `shapes/wiki-memory-l3/` — 6 SHACL shapes

## Related skills

- `solid-affordance-descriptors` — D58 body affordance projection
- `solid-spec` — D75 RDFa drop divergence
- `shacl-shapes` — shape design conventions
```

- [ ] Write `references/design.md` extracting D70-D81 + K2-K3 from decisions-index.md (Phase 5d-5g sections).

- [ ] Write `references/rung-1-4-implementation.md` by quoting summary sections from `docs/superpowers/specs/2026-05-15-rung-1-4-wiki-memory-l3-implementation-design.md` (the existing wiki-memory L3 implementation design).

- [ ] Commit.

---

### Task 10: Create `solid-storage-description`

- [ ] Write `SKILL.md`:

```markdown
---
name: solid-storage-description
description: Storage description as router (D44) replacing legacy `.well-known/void`. Agent affordance architecture guiding principle (D48). Vocabulary grounding via void:vocabulary declarations (D49).
when_to_use: When designing or debugging the storage description resource, adding affordance catalog entries, or answering questions about how agents discover this Pod's capabilities.
---

# Solid Storage Description

Storage Description Resource at the standard slot (`solid:storageDescription` Link header) is this Pod's primary discovery surface. Replaces the older `.well-known/void` pattern. Full design in [`references/design.md`](references/design.md).

## Quick reference

- D44: Storage Description Resource replaces `.well-known/void`. Router, not manifest — points to browseable catalog containers via `rdfs:seeAlso`
- D48: Agent affordance architecture as guiding principle. Anti-patterns: flat `.well-known/*` endpoints, embedded SPARQL literals, magic paths, dual parallel mechanisms
- D49: Vocabulary grounding — `void:vocabulary` declarations MUST be present, each MUST be dereferenceable (canonical source or D23 TBox cache)

## Implementation

`css/config/storage-description.json` — Components.js config that wires the storage description endpoint. Discoverable via `Link: <...>; rel="http://www.w3.org/ns/solid/terms#storageDescription"` on every resource.

## Related skills

- `solid-spec` — D44 divergence from upstream defaults
- `solid-affordance-descriptors` — discoverable from storage description's affordance catalog
```

- [ ] Write `references/design.md` extracting D44, D48, D49 from decisions-index.md.

- [ ] Commit.

---

### Phase 2 verification

- [ ] All 4 Category 2 skill directories exist
- [ ] Restart Claude Code session; confirm new skills appear in listing
- [ ] Spawn a test agent: "How does this Pod do time travel?" — confirm `solid-memento` is invoked

---

## Phase 3 — Migrate 6 builder skills

### Task 11: Migrate all 6 builder skills in one go

**Pattern (apply to each):**

```bash
SKILL=css-extension  # then components-override, metadata-writer, monitoring-store, comunica-sources, shacl-shapes
mkdir -p .claude/skills/$SKILL
git mv .claude/skills/$SKILL.md .claude/skills/$SKILL/SKILL.md
```

Then for each, edit `.claude/skills/<name>/SKILL.md` to add frontmatter at the top.

- [ ] **`css-extension`** — add frontmatter:

```yaml
---
name: css-extension
description: Scaffold a new Community Solid Server (CSS) v8 extension that loads via Components.js DI. Codifies the pattern used by markdown-projection, shape-validator, metadata-card, memento, and markdown-render extensions in this repo.
when_to_use: When building a new CSS extension — defining package.json lsd:* fields, tsconfig CommonJS settings, Components.js wiring, Dockerfile symlink trick. Also for debugging componentsjs-generator failures.
---
```

- [ ] **`components-override`**:

```yaml
---
name: components-override
description: Components.js Override patterns for CSS v8 — InsertBefore, InsertAfter, InsertAt, full replacement. Parameter @id format. Workaround for OverrideListInsertAt against empty list (K1).
when_to_use: When inserting a custom handler into an existing CSS WaterfallHandler, ParallelHandler, or chain. Also when overrideParameters error messages are confusing.
---
```

- [ ] **`metadata-writer`**:

```yaml
---
name: metadata-writer
description: MetadataWriter composition in CSS — additive Link/Vary headers via parallel writers, the addHeader vs setHeader distinction (D67). Reference implementation: MementoLinkMetadataWriter.
when_to_use: When emitting response headers from a CSS extension, especially Link/Vary that must coexist with CSS's own LinkRelMetadataWriter.
---
```

- [ ] **`monitoring-store`**:

```yaml
---
name: monitoring-store
description: MonitoringStore CDC pattern (D17 + D65) — subscribe to CSS's native 'changed' event for write-time hooks. Reference implementations: MementoCommitListener and MarkdownProjectionListener.
when_to_use: When implementing a write-time hook on a CSS extension (Memento commit, projection listener, notification generator, audit logger).
---
```

- [ ] **`comunica-sources`**:

```yaml
---
name: comunica-sources
description: Comunica explicit-source SPARQL queries against this Pod — works around the link-traversal `.meta` gap (RQ-Pod-4). default-graph-uri parameter pattern.
when_to_use: When writing a SPARQL query that needs to read `.meta` content, debugging "no quads in source" errors, or designing federated queries that span resource + `.meta` graphs.
---
```

- [ ] **`shacl-shapes`**:

```yaml
---
name: shacl-shapes
description: SHACL shape design for Pod content on this stack. sh:agentInstruction conventions (D7, D50). LDP RDFS/NR split for validation targeting (D38). Class-based targeting vs container-path targeting (D78). 5-shape catalog (D77).
when_to_use: When designing a new SHACL shape for a content type, picking sh:targetClass vs sh:targetNode, deciding sh:closed vs sh:closed false, or writing sh:agentInstruction text.
---
```

- [ ] Verify each moved file still has the original content below the frontmatter (no accidental truncation).

- [ ] Restart Claude Code session; confirm all 6 are discoverable.

- [ ] Commit:

```bash
git add .claude/skills/css-extension/ .claude/skills/components-override/ .claude/skills/metadata-writer/ .claude/skills/monitoring-store/ .claude/skills/comunica-sources/ .claude/skills/shacl-shapes/
git commit -m "$(cat <<'EOF'
[Agent: Claude] Migrate 6 builder skills to subdirectory pattern + frontmatter

css-extension, components-override, metadata-writer, monitoring-store,
comunica-sources, shacl-shapes: flat-file -> <name>/SKILL.md with
description + when_to_use frontmatter for Claude Code discovery.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Cleanup

### Task 12: Delete vendor + remove legacy router skills

- [ ] Delete vendored content:

```bash
git rm -r vendor/solid-llm-skills/
rmdir vendor/ 2>/dev/null || true
```

- [ ] Delete the two legacy router skills (their content is now in Category 1 skills):

```bash
git rm .claude/skills/solid-spec.md .claude/skills/solid-integration.md
```

(These are the OLD flat-file routers, not the new subdirectory skills. The new `solid-spec/` and `solid-integration-guide/` directories stay.)

- [ ] Verify zero remaining references:

```bash
grep -rn "vendor/solid-llm-skills" --include="*.md" --include="*.py" --include="*.json" --include="*.yml" .
# Expected: no output
```

- [ ] If grep returns results, fix them (likely in `.claude/rules/`, `CLAUDE.md`, scripts). Most likely targets:
  - `CLAUDE.md` mentions "Upstream Solid documentation is vendored at `vendor/solid-llm-skills/`..."
  - `.claude/rules/solid-patterns.md` may reference vendor paths

- [ ] Commit:

```bash
git add -u
git commit -m "$(cat <<'EOF'
[Agent: Claude] Remove vendor/solid-llm-skills/ and legacy router skills

Content has moved into .claude/skills/<name>/SKILL.md subdirectories
with proper Claude Code skill structure. Sync is now via
scripts/sync_solid_skills.py.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Update CLAUDE.md + decisions-index.md

- [ ] Edit `CLAUDE.md`:
  - In the "Tech Stack" preamble, delete the paragraph mentioning `vendor/solid-llm-skills/`
  - In the "Operational skills (on demand)" + "Builder skills (on demand)" tables — leave operational commands alone, but update the Builder skills table to list all 15 skills (5 upstream-derived + 4 local-only + 6 builder = the new layout)
  - Add a "Sync upstream Solid skills" line under Key Commands: `~/uvws/.venv/bin/python scripts/sync_solid_skills.py [--check]`

- [ ] Edit `.claude/rules/decisions-index.md` to add "see also" pointers. At the end of each D-cluster, append:
  - End of D44/D48/D49 → "**Skill**: `.claude/skills/solid-storage-description/`"
  - End of D52/D55/D58 → "**Skill**: `.claude/skills/solid-affordance-descriptors/`"
  - End of D61-D68 (and K1) → "**Skill**: `.claude/skills/solid-memento/`"
  - End of D70-D81 (and K2-K3) → "**Skill**: `.claude/skills/solid-wiki-memory-l3/`"

- [ ] Edit `.claude/rules/solid-patterns.md` to remove any `vendor/` references (if grep found them in Task 12).

- [ ] Commit:

```bash
git add CLAUDE.md .claude/rules/decisions-index.md .claude/rules/solid-patterns.md
git commit -m "$(cat <<'EOF'
[Agent: Claude] Update CLAUDE.md + rules for new skill layout

CLAUDE.md skills table reflects 15 .claude/skills/<name>/SKILL.md
entries. decisions-index.md adds cross-references from D-clusters to
their corresponding skills.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Sync hygiene

### Task 14: Document sync procedure

- [ ] In `CLAUDE.md`, add a short section near the existing Key Commands:

```markdown
## Sync upstream Solid skills

Upstream `solid/solid-llm-skills` evolves slowly. Periodically refresh:

\`\`\`bash
~/uvws/.venv/bin/python scripts/sync_solid_skills.py --check  # detect drift
~/uvws/.venv/bin/python scripts/sync_solid_skills.py          # refresh all
~/uvws/.venv/bin/python scripts/sync_solid_skills.py solid-spec  # refresh one
\`\`\`

Commit message format: `[Agent: Claude] sync: solid-llm-skills <new-sha>`.
```

- [ ] Commit:

```bash
git add CLAUDE.md
git commit -m "[Agent: Claude] Document sync_solid_skills.py procedure in CLAUDE.md

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] `find .claude/skills -name SKILL.md | wc -l` returns 15
- [ ] `~/uvws/.venv/bin/python scripts/sync_solid_skills.py --check` exits 0
- [ ] `grep -rn vendor/solid-llm-skills .` returns nothing
- [ ] Fresh Claude Code session: ask "what skills are available for Solid?" — agent lists all 15
- [ ] Ask "how does this Pod do time travel?" — confirm `solid-memento` is invoked, references `references/design.md`

---

## Notes for the executor

- Each phase is one or more commits; commit boundaries are explicit
- "Verify discoverability" steps require restarting Claude Code (close + reopen) since skills are loaded at session start
- If the sync script fails with a `gh` auth error, run `gh auth status` and re-auth before retrying
- If extracting D-numbered content from `decisions-index.md`, copy verbatim — those entries are the authoritative source
- D-cluster boundaries: D44/D48/D49 (Phase 3), D52/D55/D58 (Phase 4), D61-D68 (Phase 5), D70-D81 (Phases 5d-5g)
