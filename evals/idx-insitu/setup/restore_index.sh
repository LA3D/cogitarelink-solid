#!/bin/bash
# Restore the derived definition-line index after arm C: trigger a regeneration by
# re-PUTting one member unchanged, then verify the definition tails are back.
# WARNING (D82, observed 2026-06-12): the re-PUT member's own seeded .meta enrichment
# (skos:definition) does NOT survive the projection rewrite — its index tail drops.
# A `make reset` afterwards fully heals the corpus; do not rely on this script alone.
set -euo pipefail
C="https://pod.vardeman.me/vault/wiki/concepts"
BODY=$(mktemp)
curl -sk "$C/photosynthesis.md" > "$BODY"
curl -sk -o /dev/null -w "re-PUT member: %{http_code}\n" -X PUT \
  -H 'Content-Type: text/markdown' "$C/photosynthesis.md" --data-binary @"$BODY"
for i in $(seq 1 16); do
  if curl -sk "$C/index.md" | grep -q ' — The study of living organisms'; then
    echo "RESTORED: definition-line index regenerated"; exit 0
  fi
  sleep 0.5
done
echo "NOT RESTORED — definition tails missing"; exit 1
