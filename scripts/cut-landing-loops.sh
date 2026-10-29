#!/usr/bin/env bash
# Cuts the /welcome demo loops from the real-model take (docs/demo/raw/nimbus-demo-20261028-1915.webm, gitignored)
# at the beat times in docs/demo/raw/beats-20261028-1915.json (tStart/tEnd, listed in docs/LANDING.md).
# Output: public/landing/loop-N.mp4 (H.264, crf 24), loop-N.webm (VP9) and loop-N.jpg (poster), 1280 wide, 24 fps,
# no audio, each under 2 MB. Loop 9 (the tour) is recorded separately by scripts/record-tour-loop.ts.
#   RAW=/path/to/docs/demo/raw scripts/cut-landing-loops.sh [N ...]
set -euo pipefail
RAW="${RAW:-docs/demo/raw}"
TAKE="$RAW/nimbus-demo-20261028-1915.webm"
OUT="public/landing"
mkdir -p "$OUT"

# loop  start    end       beat(s)
CUTS=(
  "1 48.53 58.63"    # brief1-plan-arrives + brief1-approve-plan
  "2 58.63 70.63"    # brief1-timeline, first 12 s
  "3 118.60 124.59"  # brief1-agent-io
  "4 124.59 138.70"  # brief1-doc
  "5 138.70 151.31"  # brief1-approvals + approve-1
  "6 168.39 182.30"  # always-allow
  "7 189.27 199.91"  # memory-skill
  "8 208.07 219.18"  # brief2-plan-arrives + the first 6 s of brief2-run
)
WANT=("$@")
for row in "${CUTS[@]}"; do
  set -- $row
  n=$1; from=$2; to=$3
  if [ ${#WANT[@]} -gt 0 ] && ! printf '%s\n' "${WANT[@]}" | grep -qx "$n"; then continue; fi
  dur=$(awk "BEGIN{print $to-$from}")
  echo "loop-$n: $from to $to ($dur s)"
  VF="scale=1280:-2:flags=lanczos,fps=24"
  ffmpeg -v error -y -ss "$from" -i "$TAKE" -t "$dur" -an -vf "$VF" \
    -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart "$OUT/loop-$n.mp4"
  ffmpeg -v error -y -ss "$from" -i "$TAKE" -t "$dur" -an -vf "$VF" \
    -c:v libvpx-vp9 -crf 34 -b:v 0 -deadline good -cpu-used 4 -row-mt 1 "$OUT/loop-$n.webm"
  ffmpeg -v error -y -ss "$from" -i "$TAKE" -frames:v 1 -vf "scale=1280:-2:flags=lanczos" -q:v 4 "$OUT/loop-$n.jpg"
done
ls -la "$OUT"
