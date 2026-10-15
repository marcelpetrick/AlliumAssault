#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Render the repository history as ten-second Gource clips for LinkedIn.
#
#   linkedin/render-gource.sh            render every preset
#   linkedin/render-gource.sh bloom      render one preset
#
# Needs gource and ffmpeg. Gource renders through SDL's offscreen driver, so no display is
# needed. The whole history is squeezed into about nine seconds; the last second holds the
# finished tree. Output: linkedin/gource-*.mp4.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
OUT=linkedin
DURATION=10
FPS=60
FONT=/usr/share/fonts/noto/NotoSans-Bold.ttf
TITLE="Allium Assault - a 3D garlic artillery game in the browser"

# Gource's own git call needs a writable /tmp; hand it the log instead. Most commits landed in
# two busy September weeks, so calendar time would finish the tree in two seconds and then idle.
# Each commit gets its own day instead, and the history fills nine of the ten seconds.
log=$(mktemp --suffix=.log)
trap 'rm -f "$log"' EXIT
git log --pretty=format:user:%aN%n%ct --reverse --raw --encoding=UTF-8 --no-renames \
  --no-show-signature 2>/dev/null |
  awk 'prev ~ /^user:/ && /^[0-9]+$/ { $0 = 1700000000 + 86400 * n++ } { prev = $0; print }' >"$log"
commits=$(git rev-list --count HEAD)
spd=$(awk -v n="$commits" 'BEGIN { printf "%.4f", 9 / n }')

common=(
  --seconds-per-day "$spd"
  --auto-skip-seconds 0.05
  --stop-at-end
  --max-file-lag 0.05
  --file-idle-time 0
  --highlight-users
  --hide mouse,progress,filenames,date
  --font-file "$FONT"
  --output-framerate "$FPS"
  --multi-sampling
  --camera-mode overview
  --padding 0.95
  --font-size 26
  --no-vsync
)

render() {
  local name=$1 size=$2
  shift 2
  local file="$OUT/gource-$name.mp4"
  echo "rendering $file ($size)"
  SDL_VIDEODRIVER=offscreen gource "${common[@]}" -"$size" "$@" \
    --log-format git --output-ppm-stream - "$log" |
    ffmpeg -loglevel error -y -r "$FPS" -f image2pipe -vcodec ppm -i - \
      -vf "tpad=stop_mode=clone:stop_duration=$DURATION" -t "$DURATION" \
      -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "$file"
}

preset() {
  case $1 in
    # Glowing neon tree on near-black, the classic look turned up.
    bloom)
      render bloom 1080x1350 \
        --title "$TITLE" \
        --background-colour 0b0d17 --bloom-multiplier 1.3 --bloom-intensity 0.8 \
        --hide mouse,progress,filenames,dirnames,date \
        --dir-colour 3a3f5c --font-colour f5f0e1 --elasticity 0.02
      ;;
    # Garlic palette: aubergine background, cream text, labelled folders.
    garlic)
      render garlic 1080x1350 \
        --title "$TITLE" \
        --background-colour 2a1630 --bloom-multiplier 1.0 --bloom-intensity 0.7 \
        --dir-colour d9c7a3 --font-colour fff4dc --highlight-colour f2c14e \
        --dir-name-depth 2 --dir-name-position 1 --font-scale 1.2
      ;;
    # Pure structure: no names, no title, just the tree growing.
    minimal)
      render minimal 1080x1080 \
        --background-colour 000000 --bloom-multiplier 0.8 --bloom-intensity 0.5 \
        --hide mouse,progress,filenames,dirnames,usernames,date,users \
        --disable-auto-rotate --padding 1.1
      ;;
    # Widescreen with an extension legend, for a post with a link preview.
    wide)
      render wide 1920x1080 \
        --title "$TITLE" \
        --background-colour 101820 --bloom-multiplier 1.2 --bloom-intensity 0.8 \
        --key --dir-colour 6c7a89 --font-colour ffffff --dir-name-depth 1 \
        --font-scale 1.3
      ;;
    # High-contrast glow for a thumb-stopping square.
    glow)
      render glow 1080x1080 \
        --title "$TITLE" \
        --background-colour 05010a --bloom-multiplier 1.6 --bloom-intensity 0.9 \
        --hide mouse,progress,filenames,dirnames,usernames,date \
        --user-scale 1.5 --padding 1.15
      ;;
    *)
      echo "unknown preset: $1" >&2
      exit 1
      ;;
  esac
}

if (($#)); then
  for p in "$@"; do preset "$p"; done
else
  for p in bloom garlic minimal wide glow; do preset "$p"; done
fi
