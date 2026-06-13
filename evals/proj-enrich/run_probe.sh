#!/bin/bash
# PSP enrichment round-trip (PSP-T7): does a cold agent's OWN .meta annotation survive
# a body re-projection? Mechanism-validation probe (Haiku per the model policy — the
# behavior under test is deterministic substrate behavior, NOT a disposition measurement).
# One run = cold agent, curl-only -> reads concept + .meta, PATCHes one own triple,
# rewrites the body, re-reads .meta -> we snapshot final .meta + raw-audit.
# The probe MUTATES the live photosynthesis concept; restore with `make reset` afterward.
# Usage: PROBE_MODEL=haiku ./run_probe.sh <tag>
set -euo pipefail
cd "$(dirname "$0")"
TAG="${1:-run1}"
RUN="runs/$TAG"
mkdir -p "$RUN/workdir"

PROMPT=$(cat prompts/task.txt)

# Snapshot the .meta BEFORE the agent touches it (ground-truth baseline for raw-audit).
curl -sk -H "Accept: text/turtle" \
  https://pod.vardeman.me/vault/wiki/concepts/photosynthesis.md.meta \
  > "$RUN/meta-before.ttl" 2>/dev/null || true

# Write is allowed (e5b lesson): the curl-only sandbox forces inline `-d` bodies, which
# collide with curl's leading-@ file semantics (N3/Turtle starts with @prefix; exit 26).
# Agents compose a scratch .n3 and send it with `curl --data-binary @file`. The
# Pod-interaction constraint (HTTP via curl only) is unchanged + enforced by the prompt.
( cd "$RUN/workdir" && env -u ANTHROPIC_API_KEY claude -p "$PROMPT" \
    --model "${PROBE_MODEL:-haiku}" --max-turns "${PROBE_MAX_TURNS:-60}" \
    --allowedTools "Bash(curl:*),Write" \
    --output-format stream-json --verbose \
    > ../trajectory.jsonl 2> ../stderr.log ) || echo "claude exited non-zero (see $RUN/stderr.log)"

python3 - "$RUN/trajectory.jsonl" > "$RUN/report.md" <<'PY'
import json, sys
for line in open(sys.argv[1]):
    try: d = json.loads(line)
    except json.JSONDecodeError: continue
    if d.get("type") == "result":
        print(d.get("result", ""))
PY

# Snapshot the FINAL .meta state directly (raw-audit ground truth — do not trust the
# agent's narration of survival; cross-check against this).
curl -sk -H "Accept: text/turtle" \
  https://pod.vardeman.me/vault/wiki/concepts/photosynthesis.md.meta \
  > "$RUN/meta-after.ttl" 2>/dev/null || true
curl -sk https://pod.vardeman.me/vault/wiki/concepts/photosynthesis.md \
  > "$RUN/body-after.md" 2>/dev/null || true

echo "run complete: $RUN"
echo "  meta-before.ttl / meta-after.ttl / body-after.md captured for raw-audit"
