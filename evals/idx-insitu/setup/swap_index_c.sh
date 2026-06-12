#!/bin/bash
# Arm C format swap: replace the served definition-line index body with a
# prefLabel-only variant (strip the " — definition" tails; keep frontmatter,
# header, and the [Label](slug.md) link lines). PUT directly — same type, validates.
# Restore afterwards with restore_index.sh.
set -euo pipefail
IDX="https://pod.vardeman.me/vault/wiki/concepts/index.md"
ORIG=$(mktemp)
curl -sk "$IDX" > "$ORIG"
cp "$ORIG" "$(dirname "$0")/index.definition-line.bak.md"
python3 - "$ORIG" <<'PY' > /tmp/index-labelonly.md
import re, sys
for line in open(sys.argv[1]):
    if line.startswith("- ["):
        line = re.sub(r'\)\s+—\s.*$', ')', line.rstrip()) + "\n"
    print(line, end="")
PY
echo "--- label-only body:"
cat /tmp/index-labelonly.md
curl -sk -o /dev/null -w "PUT label-only index: %{http_code}\n" -X PUT \
  -H 'Content-Type: text/markdown' "$IDX" --data-binary @/tmp/index-labelonly.md
sleep 2
if curl -sk "$IDX" | grep -q 'The study of living organisms'; then
  echo "SWAP FAILED: definition tails still served (listener may have regenerated)"; exit 1
fi
echo "SWAPPED: served index is prefLabel-only"
