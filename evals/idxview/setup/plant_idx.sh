#!/bin/bash
# Index-view probe (RQ-Discovery-1 extension). Plants a synthetic 30-concept corpus
# with OPAQUE slugs (n01..n30) into two parallel containers:
#   probe-a/  — bare ldp:contains (no index)        [Arm A baseline]
#   probe-b/  — same 30 concepts + index.md         [Arm B: definition-line index view]
# The arms differ ONLY by the presence of the definition-line index. Each concept's
# body carries its label + one-line definition, so Arm A agents CAN find the target by
# GETting resources; the question is whether the index lets Arm B route with far fewer
# fetches. Target = n09 (Write-Ahead Log); the task paraphrases its definition and never
# names "write-ahead log", so the agent must comprehend, not keyword-grep.
set -euo pipefail
cd "$(dirname "$0")/.."
POD="https://pod.vardeman.me"
A="$POD/vault/probe-a"
B="$POD/vault/probe-b"
TSV="concepts.tsv"

put_one() {  # <container> <slug> <label> <definition>
  curl -sk -o /dev/null -w "" -X PUT -H 'Content-Type: text/markdown' "$1/$2.md" \
    --data-binary @- <<MD
# $3

$4
MD
}

echo "planting 30 concepts into probe-a and probe-b ..."
INDEX="# Concept Index

This container holds a collection of concept notes. Each entry below is the resource
slug followed by the concept's label and a one-line definition.

"
while IFS=$'\t' read -r slug label def; do
  [ -z "$slug" ] && continue
  put_one "$A" "$slug" "$label" "$def"
  put_one "$B" "$slug" "$label" "$def"
  INDEX+="- [$slug.md]($slug.md) — **$label**: $def
"
done < "$TSV"

# Arm B's discoverable definition-line index view (hand-written static resource).
curl -sk -o /dev/null -w "PUT index.md: %{http_code}\n" -X PUT \
  -H 'Content-Type: text/markdown' "$B/index.md" --data-binary "$INDEX"

echo "verify:"
TGT_A=$(curl -sk -o /dev/null -w '%{http_code}' "$A/n09.md")
TGT_B=$(curl -sk -o /dev/null -w '%{http_code}' "$B/n09.md")
NA=$(curl -sk -H 'Accept: text/turtle' "$A/" | grep -oE '<n[0-9]+\.md>' | sort -u | wc -l | tr -d ' ')
NB=$(curl -sk -H 'Accept: text/turtle' "$B/" | grep -oE '<(n[0-9]+|index)\.md>' | sort -u | wc -l | tr -d ' ')
IDX=$(curl -sk -o /dev/null -w '%{http_code}' "$B/index.md")
echo "  probe-a target n09: $TGT_A | probe-a concept count: $NA"
echo "  probe-b target n09: $TGT_B | probe-b child count (incl index): $NB | index.md: $IDX"
if [ "$TGT_A" = 200 ] && [ "$TGT_B" = 200 ] && [ "$NA" = 30 ] && [ "$IDX" = 200 ]; then
  echo "  ARMED: A=30 bare, B=30+index, target reachable in both"
else
  echo "  NOT ARMED"; exit 1
fi
