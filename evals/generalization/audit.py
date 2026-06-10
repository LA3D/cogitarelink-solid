#!/usr/bin/env python3
# Raw-audit generalization-probe trajectories: scan the actual tool calls (curl + solid-pod)
# for the routing signals — right store, affordance discovery + use, brute-force, correctness.
# Usage: python3 audit.py runs/skill-cli-run1 [more runs ...]
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
    right_store   = "/contacts/" in blob
    wrong_store   = "/wiki/people/" in blob
    saw_catalog   = bool(re.search(r"/meta/affordances/(\s|\"|'|$)", blob)) or "/meta/affordances/ " in blob or "affordances " in blob
    read_afford   = "contact-find-by-orcid" in blob
    cli_sparql    = "solid-pod sparql" in blob
    cli_invoke    = "solid-pod invoke" in blob
    cli_afford    = "solid-pod affordances" in blob
    # brute-force: how many individual gen-*.ttl contacts were fetched
    brute = len(set(re.findall(r"gen-[a-z-]+\.ttl", blob)))
    answer_correct = "claude shannon" in rl
    used_pattern = read_afford or cli_sparql or cli_invoke or cli_afford
    print(f"=== {run} ===")
    print(f"  skill invoked         : {sk if sk else False}")
    print(f"  tool calls            : {len(cmds)}")
    print(f"  RIGHT store /contacts/: {right_store}")
    print(f"  wrong store /wiki/ppl : {wrong_store}")
    print(f"  saw affordance catalog: {saw_catalog}")
    print(f"  read find-by-orcid    : {read_afford}")
    print(f"  CLI sparql/invoke/aff : {cli_sparql}/{cli_invoke}/{cli_afford}")
    print(f"  used declared pattern : {used_pattern}")
    print(f"  brute-force contacts  : {brute} / 6")
    print(f"  answer = Claude Shannon: {answer_correct}")
    print()
