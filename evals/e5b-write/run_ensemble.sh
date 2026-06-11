#!/bin/bash
# Run the remaining ensemble sequentially (a-run1 already done as shakedown).
# One retry per run on transient API death (report.md starts with "API Error").
set -uo pipefail
cd "$(dirname "$0")"
RUNS=("a run2" "a run3" "b run1" "b run2" "b run3" "c run1" "c run2" "c run3")
for spec in "${RUNS[@]}"; do
  set -- $spec
  ARM=$1; TAG=$2
  for attempt in 1 2; do
    echo "=== $ARM-$TAG (attempt $attempt) ==="
    ./run_probe.sh "$ARM" "$TAG"
    if grep -q "^API Error" "runs/$ARM-$TAG/report.md" 2>/dev/null; then
      echo "$ARM-$TAG attempt $attempt died on API error"
      mv "runs/$ARM-$TAG" "runs/$ARM-$TAG-apierror$attempt"
    else
      break
    fi
  done
done
echo "ENSEMBLE COMPLETE"
ls runs/
