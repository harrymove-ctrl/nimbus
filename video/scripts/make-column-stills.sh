#!/usr/bin/env bash
# The ten app stills for Column Cut (scene 5), pulled from the take at fixed times. Re-run
# after a new take: bash scripts/make-column-stills.sh [take.webm]
set -euo pipefail
cd "$(dirname "$0")/.."
TAKE=${1:-public/demo/raw/nimbus-demo-20261027-1432.webm}
OUT=public/column
mkdir -p "$OUT"
# From the beats of the 21:32 take: overview ×2, ship1-checklist, ship1-loop-view, ship1-patch,
# memory-skill, radar, status-pill ×2, overview-after
i=0
for t in 17 21.5 58 70 110 228 241 250 256 348; do
  i=$((i + 1))
  ffmpeg -v error -y -ss "$t" -i "$TAKE" -frames:v 1 -vf scale=1600:-1 -q:v 3 "$OUT/$(printf %02d $i).jpg"
done
ls "$OUT" | wc -l | xargs echo "column stills:"
