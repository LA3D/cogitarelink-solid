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
