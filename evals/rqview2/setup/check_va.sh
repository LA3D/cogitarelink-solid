#!/bin/bash
# V-A grader snapshot: did the cold-authored cellular-respiration note round-trip
# from the markdown document view into the .meta graph view? And did Biology gain
# the inverse narrower edge?
set -euo pipefail
POD="https://pod.vardeman.me"
# Agent chooses the slug; find any new concept whose body mentions respiration.
echo "=== concepts container now ==="
curl -s "$POD/vault/wiki/concepts/" -H 'Accept: text/turtle' | grep -oE '[a-z-]+\.md' | sort -u
echo
echo "=== candidate cellular-respiration note (document view) ==="
for slug in cellular-respiration cellular_respiration respiration cellularrespiration; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$POD/vault/wiki/concepts/$slug.md")
  if [ "$code" = "200" ]; then
    echo "--- $slug.md ---"; curl -s "$POD/vault/wiki/concepts/$slug.md"
    echo "--- $slug.md.meta (graph view) ---"; curl -s "$POD/vault/wiki/concepts/$slug.md.meta" -H 'Accept: text/turtle'
    break
  fi
done
echo
echo "=== Biology graph view — did it gain a narrower edge to the new concept? ==="
curl -s "$POD/vault/wiki/concepts/biology.md.meta" -H 'Accept: text/turtle' | grep -i 'narrower'
