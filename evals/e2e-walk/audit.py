#!/usr/bin/env python3
# Raw-audit e2e-walk trajectories: scan actual tool calls (curl + solid-pod) for the
# contract-walk signals on BOTH legs. Tool-call mining is necessary but NOT sufficient —
# read every assistant text block too (cold_probe_harness_pattern).
# Usage: python3 audit.py runs/skill-run1 [more runs ...]
import json, sys, re

def tool_uses(path):
    cmds, skills = [], []
    for line in open(path):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        if d.get("type") != "assistant": continue
        for b in d.get("message", {}).get("content", []):
            if isinstance(b, dict) and b.get("type") == "tool_use":
                if b.get("name") == "Skill":
                    skills.append(b.get("input", {}).get("skill", "?"))
                cmd = b.get("input", {}).get("command", "")
                if cmd: cmds.append(cmd)
    return cmds, skills

def result_text(path):
    for line in open(path):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        if d.get("type") == "result": return d.get("result", "")
    return ""

for run in sys.argv[1:]:
    tj = f"{run}/trajectory.jsonl"
    cmds, sk = tool_uses(tj)
    blob = "\n".join(cmds)
    rl = result_text(tj).lower()
    # orient
    oriented      = ".well-known/solid" in blob
    # wiki leg
    read_index    = "concepts/index.md" in blob or "wiki/index.md" in blob
    photo_meta    = "photosynthesis.md.meta" in blob or "photosynthesis.md?_profile=fused" in blob \
                    or bool(re.search(r"solid-pod read .*photosynthesis", blob))
    wiki_brute    = len(set(re.findall(r"concepts/(biology|how-identifiers-work|how-wiki-memory-works|two-hierarchy-memory-addressing)\.md(?!\.meta)", blob)))
    says_biology  = "biology" in rl
    says_current  = any(w in rl for w in ["current", "not contested", "no open action", "authoritative"])
    audit_checked = photo_meta or "memory-history" in blob or "timemap" in blob
    # addressbook leg
    right_store   = "/contacts/" in blob
    read_interop  = "interop" in blob
    read_afford   = "contact-find-by-orcid" in blob
    cli_invoke    = "solid-pod invoke" in blob
    cli_sparql    = "solid-pod sparql" in blob
    cli_afford    = "solid-pod affordances" in blob
    brute = len(set(re.findall(r"gen-[a-z-]+\.ttl", blob)))
    says_shannon  = "claude shannon" in rl
    used_pattern  = cli_invoke or cli_sparql or read_afford
    print(f"=== {run} ===")
    print(f"  skill invoked            : {sk if sk else False}")
    print(f"  tool calls               : {len(cmds)}")
    print(f"  ORIENT .well-known/solid : {oriented}")
    print(f"  -- wiki leg --")
    print(f"  routed via index.md      : {read_index}")
    print(f"  photosynthesis .meta/fused: {photo_meta}")
    print(f"  wiki brute (other notes) : {wiki_brute} / 4")
    print(f"  answer = Biology         : {says_biology}")
    print(f"  currency judgment present: {says_current}")
    print(f"  audited before trusting  : {audit_checked}")
    print(f"  -- addressbook leg --")
    print(f"  RIGHT store /contacts/   : {right_store}")
    print(f"  read interop/st:Descr    : {read_interop}")
    print(f"  saw find-by-orcid        : {read_afford}")
    print(f"  CLI afford/invoke/sparql : {cli_afford}/{cli_invoke}/{cli_sparql}")
    print(f"  used declared pattern    : {used_pattern}")
    print(f"  brute-force contacts     : {brute} / 6")
    print(f"  answer = Claude Shannon  : {says_shannon}")
    print()
