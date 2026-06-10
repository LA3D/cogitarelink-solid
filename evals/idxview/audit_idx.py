#!/usr/bin/env python3
# Raw-audit index-view trajectories from the actual curl calls (not the self-report).
# Usage: python3 audit_idx.py runs/a-run1 runs/b-run1 ...
import json, sys, re

TARGET = "n09"

def curls(path):
    out = []
    for line in open(path):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        if d.get("type") != "assistant": continue
        for b in d.get("message", {}).get("content", []):
            if isinstance(b, dict) and b.get("type") == "tool_use":
                cmd = b.get("input", {}).get("command", "")
                if "curl" in cmd: out.append(cmd)
    return out

def result_text(path):
    for line in open(path):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        if d.get("type") == "result": return d.get("result", "")
    return ""

print(f"{'run':10} {'curl':>4} {'concept GETs':>12} {'wrong GETs':>10} {'read index':>10} {'container list':>14} {'correct':>7}")
for run in sys.argv[1:]:
    tj = f"{run}/trajectory.jsonl"
    cs = curls(tj); blob = "\n".join(cs)
    res = result_text(tj)
    # every nNN.md fetched (GET of a concept note)
    concept_gets = re.findall(r'/probe-[ab]/(n\d\d)\.md', blob)
    n_concept = len(concept_gets)
    n_wrong = sum(1 for s in concept_gets if s != TARGET)
    read_index = bool(re.search(r'/probe-b/index\.md', blob))
    listed = bool(re.search(r'/probe-[ab]/["\' ]', blob) or re.search(r'/probe-[ab]/ ', blob) or re.search(r'/probe-[ab]/"', blob))
    # correctness: answer names n09 as the target URL
    correct = bool(re.search(r'n09\.md', res)) and "ANSWER" in res
    name = run.split('/')[-1]
    print(f"{name:10} {len(cs):>4} {n_concept:>12} {n_wrong:>10} {str(read_index):>10} {str(listed):>14} {str(correct):>7}")
