#!/usr/bin/env python3
# Raw-audit skill-nav trajectories: scan the actual tool calls (not the self-report)
# for the mechanism signals + whether the pod-navigate skill was invoked.
# Usage: python3 audit.py runs/skill-run1 [runs/skill-run2 ...]
import json, sys, re

def tool_uses(path):
    curls, skills = [], []
    for line in open(path):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        if d.get("type") != "assistant": continue
        for b in d.get("message", {}).get("content", []):
            if isinstance(b, dict) and b.get("type") == "tool_use":
                if b.get("name") == "Skill":
                    skills.append(b.get("input", {}).get("skill", "?"))
                cmd = b.get("input", {}).get("command", "")
                if "curl" in cmd: curls.append(cmd)
    return curls, skills

def result_text(path):
    for line in open(path):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        if d.get("type") == "result": return d.get("result", "")
    return ""

for run in sys.argv[1:]:
    tj = f"{run}/trajectory.jsonl"
    cs, sk = tool_uses(tj)
    blob = "\n".join(cs)
    rl = result_text(tj).lower()
    grounded_vocab = bool(re.search(r"ontology/mem(?![a-z])", blob))
    reached_meta   = ".meta" in blob
    reached_ledger = ".operations/" in blob or "/id/" in blob
    says_hr  = "hierarchical retrieval" in rl
    says_pd  = "progressive disclosure" in rl
    contested = any(w in rl for w in ["contest", "supersed", "stale", "pending", "realign",
                                      "under revision", "outdated", "out of date", "proposed"])
    print(f"=== {run} ===")
    print(f"  skill invoked        : {sk if sk else False}")
    print(f"  curl calls           : {len(cs)}")
    print(f"  GET mem vocab (GROUND): {grounded_vocab}")
    print(f"  reached .meta        : {reached_meta}")
    print(f"  reached ledger/op    : {reached_ledger}")
    print(f"  answer mentions HR   : {says_hr}")
    print(f"  answer mentions PD   : {says_pd}")
    print(f"  contestation language: {contested}")
    print()
