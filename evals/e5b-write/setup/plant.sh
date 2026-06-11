#!/bin/bash
# Write-side E5b twin — plant the probe substrate (spec §12, §6.1).
# A floor-governed Turtle container (the D112 .operations lane pattern):
#   /vault/probe-w/note.shacl.ttl   — the write contract (arm A or B variant)
#   /vault/probe-w/notes/           — the write target, ldp:constrainedBy the shape
# The container .meta instruction is NEUTRAL and identical across arms; only
# the shape content (and arm C's prompt) varies.
set -euo pipefail
cd "$(dirname "$0")"
POD="https://pod.vardeman.me"
W="$POD/vault/probe-w"
ARM="${1:-a}"

# 1. shape (parent container probe-w/ is unconstrained, so this PUT is floor-free)
curl -sk -o /dev/null -w "PUT note.shacl.ttl (arm $ARM): %{http_code}\n" -X PUT \
  -H 'Content-Type: text/turtle' "$W/note.shacl.ttl" --data-binary "@shape-$ARM.ttl"

# 2. the notes/ container
curl -sk -o /dev/null -w "PUT notes/: %{http_code}\n" -X PUT \
  -H 'Content-Type: text/turtle' "$W/notes/" --data-binary ""

# 3. constrainedBy + neutral instruction on the container .meta
curl -sk -o /dev/null -w "PATCH notes/.meta: %{http_code}\n" -X PATCH \
  -H 'Content-Type: text/n3' "$W/notes/.meta" --data-binary @- <<N3
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix ldp:   <http://www.w3.org/ns/ldp#>.
@prefix sh:    <http://www.w3.org/ns/shacl#>.
<> a solid:InsertDeletePatch;
solid:inserts {
    <$W/notes/> ldp:constrainedBy <$W/note.shacl.ttl> ;
        sh:agentInstruction "Writes to this container are validated against the write contract at <$W/note.shacl.ttl>. Read it before writing." .
}.
N3

echo "--- verify ---"
curl -sk -H 'Accept: text/turtle' "$W/notes/.meta" | grep -E "constrainedBy|agentInstruction" | head -4
