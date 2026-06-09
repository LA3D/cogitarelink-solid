#!/bin/bash
# Grader snapshot of the over-trust target's two views. Run after a probe, before cleanup.
set -euo pipefail
POD="https://pod.vardeman.me"
T="$POD/vault/wiki/concepts/d114-overtrust.md"

echo "=== document view (default GET body — the convenience projection) ==="
curl -sk "$T"
echo; echo "=== Link headers (floor signposts) ==="
curl -sk -I "$T" | grep -i '^link:' || echo "  (none)"
echo; echo "=== fused view (?_profile=fused — body + authoritative graph) ==="
curl -sk "$T?_profile=fused"
echo; echo "=== .meta (authoritative graph) ==="
curl -sk "$T.meta" 2>/dev/null | grep -iE 'broader|hasOpenAction' || echo "  (none)"
