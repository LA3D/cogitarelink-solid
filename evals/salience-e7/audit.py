#!/usr/bin/env python3
# Raw-audit E7 trajectories: scan the actual curl tool calls (not the self-report) for
# the mechanism signals. Usage: python3 audit.py runs/g-run1 [runs/g-run2 ...]
import json, sys, re

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

for run in sys.argv[1:]:
    tj = f"{run}/trajectory.jsonl"
    cs = curls(tj)
    blob = "\n".join(cs)
    res = result_text(tj)
    rl = res.lower()
    # mechanism signals from the RAW curl calls
    grounded_vocab = bool(re.search(r"ontology/mem(?![a-z])", blob))   # GET the mem vocab (fragment stripped)
    reached_meta   = ".meta" in blob
    reached_ledger = ".operations/" in blob or "/id/" in blob
    n_calls = len(cs)
    # answer signal from the result text
    says_hr  = "hierarchical retrieval" in rl
    says_pd  = "progressive disclosure" in rl
    contested = any(w in rl for w in ["contest", "supersed", "stale", "pending", "realign", "not.*authoritative", "under revision", "outdated", "out of date"])
    print(f"=== {run} ===")
    print(f"  curl calls           : {n_calls}")
    print(f"  GET mem vocab (GROUND): {grounded_vocab}")
    print(f"  reached .meta        : {reached_meta}")
    print(f"  reached ledger/op    : {reached_ledger}")
    print(f"  answer mentions HR   : {says_hr}")
    print(f"  answer mentions PD   : {says_pd}")
    print(f"  contestation language: {contested}")
    print()
