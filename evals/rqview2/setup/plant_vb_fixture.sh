#!/bin/bash
# V-B fixture: a SECOND concept under Biology so "what else is filed under the
# broader topic" has a real, graph-only answer (the sibling set lives in .meta
# narrower edges, not in any single .md body). Authored via the same path an
# agent would use: PUT .md with the body grammar; projection makes the graph.
set -euo pipefail
POD="https://pod.vardeman.me"
URL="$POD/vault/wiki/concepts/ecology.md"

curl -s -o /dev/null -w 'PUT ecology.md: %{http_code}\n' -X PUT \
  -H 'Content-Type: text/markdown' "$URL" --data-binary @- <<'MD'
---
title: Ecology
type: Concept
---
# Ecology

[Ecology]{.prefLabel} is the study of how organisms interact with each other and their environment.
A second concept filed under [[Biology]]{.broader}, sibling to photosynthesis.
MD

echo "verify projection produced the broader edge in the graph view:"
sleep 1
curl -s "$URL.meta" -H 'Accept: text/turtle' | grep -i 'broader' || echo "  NO broader edge — projection may not have run"
echo "verify Biology now has two narrower children:"
curl -s "$POD/vault/wiki/concepts/biology.md.meta" -H 'Accept: text/turtle' | grep -ic 'narrower'
