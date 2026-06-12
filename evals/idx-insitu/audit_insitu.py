#!/usr/bin/env python3
# Raw-audit in-situ index-probe trajectories from the actual curl calls (not the
# self-report). Usage: python3 audit_insitu.py runs/a-run1 runs/b-run1 ...
import json, sys, re

TARGET = "how-wiki-memory-works"
MEMBERS = {"biology", "how-identifiers-work", "how-wiki-memory-works",
           "photosynthesis", "two-hierarchy-memory-addressing"}

def steps(path):
    curls, texts = [], []
    for line in open(path):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        if d.get("type") != "assistant": continue
        for b in d.get("message", {}).get("content", []):
            if isinstance(b, dict) and b.get("type") == "tool_use":
                cmd = b.get("input", {}).get("command", "")
                if "curl" in cmd: curls.append(cmd)
            elif isinstance(b, dict) and b.get("type") == "text":
                texts.append(b.get("text", ""))
    return curls, texts

def result_text(path):
    for line in open(path):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        if d.get("type") == "result": return d.get("result", "")
    return ""

hdr = f"{'run':10} {'curl':>4} {'memberGET':>9} {'wrongGET':>8} {'idx.md':>6} {'idx.meta':>8} {'provCoT':>7} {'correct':>7}"
print(hdr)
for run in sys.argv[1:]:
    tj = f"{run}/trajectory.jsonl"
    cs, txt = steps(tj); blob = "\n".join(cs); cot = "\n".join(txt).lower()
    res = result_text(tj)
    member_gets = re.findall(r'/concepts/([a-z0-9-]+)\.md(?!\.meta)', blob)
    member_gets = [m for m in member_gets if m in MEMBERS]
    n_member = len(member_gets)
    n_wrong = sum(1 for s in member_gets if s != TARGET)
    read_index = bool(re.search(r'/concepts/index\.md(?!\.meta)', blob))
    read_index_meta = bool(re.search(r'/concepts/index\.md\.meta', blob))
    prov_cot = bool(re.search(r'deriv|provenance|wasgeneratedby|generated', cot))
    correct = bool(re.search(r'how-wiki-memory-works\.md', res)) and "ANSWER" in res
    name = run.split('/')[-1]
    print(f"{name:10} {len(cs):>4} {n_member:>9} {n_wrong:>8} {str(read_index):>6} {str(read_index_meta):>8} {str(prov_cot):>7} {str(correct):>7}")
