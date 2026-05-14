# vendor/solid-llm-skills

Snapshot of relevant files from [`solid/solid-llm-skills`](https://github.com/solid/solid-llm-skills) — the official Solid community's collection of LLM skill files. These files give Claude Code background context for building Solid-compliant applications against this repo's Pod.

## Sync record

- **Upstream**: https://github.com/solid/solid-llm-skills
- **Commit**: `9a1cab179346cd098d4f6e7fd8c8a611f86fe127`
- **Author date**: 2026-05-14T17:19:07Z (commit message: "Add Web Access Control (WAC) to specifications (#14)")
- **Synced into this repo on**: 2026-05-14

## What's vendored

Only the four files from upstream's `solid/` subdirectory that are relevant to Pod authoring:

| File | Topic |
|---|---|
| `solid/spec.md` | Solid Protocol, WebID Profile, Solid-OIDC, ACP, WAC |
| `solid/servers.md` | Community Solid Server, Pivot, Docker, CLI |
| `solid/data-modelling.md` | Vocabularies, SHACL, Type Index |
| `solid/integration-guide.md` | `@inrupt/solid-client`, authn, LDO, N3.js, Bashlib |

## What's omitted

- `solid/style-guide.md` — branding (irrelevant to engineering).
- All 15 files under `engineering/` upstream — general-purpose skills (full-stack engineer, DevOps, etc.) that aren't Solid-specific.

## License

Upstream is dual-licensed under MIT and Apache 2.0. Both license files are reproduced here verbatim — see `LICENSE.MIT.md` and `LICENSE.Apache-2.0.md`. `SPDX-License-Identifier: MIT OR Apache-2.0`.

## How to refresh

Manual re-sync — there is no automated pipeline. To pull updates from upstream:

```bash
SHA=$(gh api repos/solid/solid-llm-skills/commits/main --jq '.sha')
for f in spec.md servers.md data-modelling.md integration-guide.md; do
  gh api repos/solid/solid-llm-skills/contents/solid/$f --jq '.content' | base64 -d \
    > vendor/solid-llm-skills/solid/$f
done
# Then update the SHA / date / message above and commit with [Agent: Claude] vendor: sync solid-llm-skills to <sha>
```

## How these are loaded by skills

The `.claude/skills/solid-spec.md` and `.claude/skills/solid-integration.md` slash-commands route to these files when invoked. The rules in `.claude/rules/solid-patterns.md` link to them for always-on lightweight reference.

## Relationship to our work

The upstream content is general Solid background. **It does not document Memento, LDES tombstones, or our affordance descriptor architecture** — those are local to this codebase, captured in:

- `.claude/rules/decisions-index.md` (D1–D68, K1)
- Vault: `~/Obsidian/obsidian/01 - Projects/SOLID Pod Integration/SOLID-Pod-Decisions.md` (canonical decisions log)
- `.claude/skills/*.md` for builder-side lessons learned (CSS extension authoring, Components.js Override patterns, MetadataWriter composition, MonitoringStore CDC, Comunica sources, SHACL shape design)

Where upstream and our decisions diverge (e.g., we use D44 storage description instead of `.well-known/void`; D63 mints nothing but says "use Memento+LDES+AS2+PROV-O+VCDM"), the diverging information lives in our skills and decisions, not here.
