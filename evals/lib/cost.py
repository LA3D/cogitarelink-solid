#!/usr/bin/env python3
"""Per-run probe cost report from trajectory.jsonl result lines.

Usage: python3 evals/lib/cost.py runs/*/trajectory.jsonl
Prints per-run cost (CLI-reported total_cost_usd when present, else token-derived
estimate) + ensemble total. Run after every ensemble — cost surprises come from
not looking ($120 lesson, 2026-06-12).
"""
import json, sys

# $/MTok fallback (sonnet 4.x class) when the CLI doesn't report total_cost_usd
PRICE = {"in": 3.0, "out": 15.0, "cache_w": 3.75, "cache_r": 0.30}

def run_cost(path):
    for line in open(path):
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        if d.get("type") == "result":
            usd = d.get("total_cost_usd")
            u = d.get("usage", {})
            est = (u.get("input_tokens", 0) * PRICE["in"]
                   + u.get("output_tokens", 0) * PRICE["out"]
                   + u.get("cache_creation_input_tokens", 0) * PRICE["cache_w"]
                   + u.get("cache_read_input_tokens", 0) * PRICE["cache_r"]) / 1e6
            return usd if usd is not None else est, u, usd is not None
    return None, {}, False

total = 0.0
for p in sys.argv[1:]:
    c, u, reported = run_cost(p)
    if c is None:
        print(f"{p}: no result line (dead run?)")
        continue
    total += c
    tag = "cli" if reported else "est"
    print(f"{p}: ${c:.2f} ({tag})  in={u.get('input_tokens',0)} out={u.get('output_tokens',0)} "
          f"cache_r={u.get('cache_read_input_tokens',0)}")
print(f"\nTOTAL: ${total:.2f} across {len(sys.argv)-1} run(s)")
