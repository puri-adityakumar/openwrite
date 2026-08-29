#!/usr/bin/env bash
# Demo recording driver. Runs the 12 beats from docs/demo-script.md and saves
# one PNG per beat to ./demo-recording/frames/ (the source for ffmpeg).

set -u

cd "$(dirname "$0")/.."

FRAMES="${FRAMES_DIR:-demo-recording/frames}"
mkdir -p "$FRAMES"

# We'll capture via browser-use screenshots; this script just orchestrates
# the steps. Each beat:
#   1) navigate / click / wait
#   2) snapshot
#   3) capture PNG to frame-N.png
#
# We log the action and let the human (or follow-up agent) drive browser-use.
# For now we just print the script.

cat <<'EOF'
Demo recording driver — 12 beats from docs/demo-script.md.

This script is a *script*. It prints what to do; the actual browser control
is performed by the agent running browser-use, which then saves PNGs to
./demo-recording/frames/.

Beat-by-beat:
  1. Landing            -> /                  -> 00-landing.png
  2. Sign in            -> /signup            -> 02-signup.png
  3. Dashboard          -> /dashboard         -> 03-dashboard.png
  4. New paper form     -> /paper/new         -> 04-new-paper.png
  5. Live cockpit (running)
                          -> /paper/[slug]     -> 05-cockpit-running.png
                          (wait 30s for events)
  6. Verify card appears (gate)
                          -> /paper/[slug]     -> 06-verify-card.png
  7. Pulse close-up     -> /paper/[slug]      -> 07-pulse.png
  8. Pause (Halt 2-state)                        -> 08-pause.png
  9. Resume / replay    -> /paper/[slug]      -> 09-resume.png
 10. Audit page         -> /paper/[slug]/audit -> 10-audit.png
 11. Export page        -> /paper/[slug]/export -> 11-export.png
 12. README badge       -> github.com/.../openwrite -> 12-readme.png

After all 12 frames exist, build the video with:
  ffmpeg -y -framerate 12 -pattern_type glob -i 'demo-recording/frames/*.png' \
    -c:v libx264 -pix_fmt yuv420p -vf 'scale=1280:-2' demo-recording/demo.mp4
EOF

# Actually build the video if frames already exist
if [ -d "$FRAMES" ] && [ "$(ls -1 "$FRAMES"/*.png 2>/dev/null | wc -l)" -ge 1 ]; then
  echo "Found $(ls -1 "$FRAMES"/*.png | wc -l) frames — building demo.mp4"
  ffmpeg -y -framerate 12 -pattern_type glob -i "$FRAMES/*.png" \
    -c:v libx264 -pix_fmt yuv420p -vf 'scale=1280:-2' \
    demo-recording/demo.mp4 2>&1 | tail -5
fi