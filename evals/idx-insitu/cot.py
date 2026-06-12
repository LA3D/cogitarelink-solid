#!/usr/bin/env python3
# Dump a trajectory's full in-flight CoT (assistant text blocks) interleaved with
# tool commands — the raw-audit read. Usage: python3 cot.py runs/g-run1
import json, sys
path = f"{sys.argv[1]}/trajectory.jsonl"
step = 0
for line in open(path):
    try: d = json.loads(line)
    except json.JSONDecodeError: continue
    if d.get("type") != "assistant": continue
    for b in d.get("message", {}).get("content", []):
        if b.get("type") == "text":
            step += 1
            print(f"--- TEXT {step} ---"); print(b["text"])
        elif b.get("type") == "tool_use":
            print(f">>> TOOL: {b.get('input',{}).get('command','')[:300]}")
