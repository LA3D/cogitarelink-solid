#!/usr/bin/env python3
"""Mine an e5b-write trajectory: write attempts to probe-w, 422s, shape reads, rationale evolution."""
import json, re, sys, pathlib

def mine(run_dir):
    p = pathlib.Path(run_dir)
    traj = p / "trajectory.jsonl"
    out = {"run": p.name, "calls": 0, "shape_read_call": None, "first_write_call": None,
           "writes": [], "s422": 0, "guide_read": False}
    call_n = 0
    pending = {}  # tool_use id -> (call_n, cmd)
    for line in open(traj):
        try: d = json.loads(line)
        except json.JSONDecodeError: continue
        t = d.get("type")
        if t == "assistant":
            for b in d.get("message", {}).get("content", []):
                if b.get("type") == "tool_use":
                    call_n += 1
                    cmd = b.get("input", {}).get("command", "")
                    pending[b.get("id")] = (call_n, cmd)
                    if "note.shacl.ttl" in cmd and out["shape_read_call"] is None and "-X P" not in cmd:
                        out["shape_read_call"] = call_n
                    if "how-wiki-memory-works" in cmd:
                        out["guide_read"] = True
                    if "probe-w/notes" in cmd and re.search(r"-X\s*(POST|PUT)|--data|--upload", cmd):
                        if out["first_write_call"] is None:
                            out["first_write_call"] = call_n
                        m = re.search(r"rationale\s+(\"\"\"|\")(.{0,400}?)(\"\"\"|\"\s*[;.])", cmd, re.S)
                        out["writes"].append({"call": call_n,
                                              "rationale_excerpt": (m.group(2)[:350] if m else None)})
        elif t == "user":
            for b in d.get("message", {}).get("content", []):
                if b.get("type") == "tool_result":
                    tid = b.get("tool_use_id")
                    content = b.get("content")
                    txt = ""
                    if isinstance(content, list):
                        txt = " ".join(x.get("text", "") for x in content if isinstance(x, dict))
                    elif isinstance(content, str):
                        txt = content
                    if tid in pending and "probe-w/notes" in pending[tid][1]:
                        code = re.search(r"\b(201|205|422|400|409|404)\b(?!\d)", txt[-400:] if len(txt) > 400 else txt)
                        if "ValidationReport" in txt or " 422" in txt:
                            out["s422"] += 1
                            if out["writes"]: out["writes"][-1]["result"] = "422"
                        elif out["writes"] and pending[tid][0] == out["writes"][-1]["call"]:
                            out["writes"][-1]["result"] = code.group(1) if code else "?"
    out["calls"] = call_n
    return out

for rd in sys.argv[1:]:
    r = mine(rd)
    print(f"\n## {r['run']}  ({r['calls']} tool calls)")
    print(f"  shape read proactively: call #{r['shape_read_call']}" if r["shape_read_call"] else "  shape NEVER read directly")
    print(f"  first write attempt: call #{r['first_write_call']}; 422 rounds: {r['s422']}")
    for w in r["writes"]:
        print(f"  write@{w['call']} -> {w.get('result','?')}")
        if w.get("rationale_excerpt"):
            print(f"    rationale: {w['rationale_excerpt'][:300]}")
