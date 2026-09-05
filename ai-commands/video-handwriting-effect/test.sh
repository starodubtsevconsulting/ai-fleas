#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"

cd "$SCRIPT_DIR"
printf 'When I have Fears
What I May Cease to
Be
' > output/frame-validation-lines.txt

printf '== syntax ==
'
bash -n video-handwriting-effect.command.sh app.sh test.sh
node --check launcher/electron/main.cjs
node --check launcher/electron/preload.cjs
command_python -m py_compile build_font.py render.py tests/test_build_font.py tests/test_portable_paths.py tests/check_rendered_frames.py

printf '== portable tracked paths ==\n'
command_python tests/test_portable_paths.py

printf '== ui launcher bootstrap decisions ==\n'
bootstrap_test_root="output/test/bootstrap"
rm -rf "$bootstrap_test_root"
mkdir -p "$bootstrap_test_root/fresh" "$bootstrap_test_root/partial/node_modules/.bin" "$bootstrap_test_root/runtime/node_modules/.bin"
touch "$bootstrap_test_root/fresh/package-lock.json" "$bootstrap_test_root/partial/package-lock.json" "$bootstrap_test_root/runtime/package-lock.json"
printf '#!/usr/bin/env bash\n' > "$bootstrap_test_root/partial/node_modules/.bin/ng"
printf '#!/usr/bin/env bash\n' > "$bootstrap_test_root/runtime/node_modules/.bin/ng"
printf '#!/usr/bin/env bash\n' > "$bootstrap_test_root/runtime/node_modules/.bin/electron"
chmod +x "$bootstrap_test_root/partial/node_modules/.bin/ng" "$bootstrap_test_root/runtime/node_modules/.bin/ng" "$bootstrap_test_root/runtime/node_modules/.bin/electron"

fresh_bootstrap="$(VHE_REPO_ROOT="$bootstrap_test_root/fresh" VHE_BOOTSTRAP_DRY_RUN=1 ./app.sh)"
if [[ "$fresh_bootstrap" != *"npm ci"* ]]; then
  echo "Expected fresh launcher bootstrap to choose npm ci, got: $fresh_bootstrap" >&2
  exit 1
fi

partial_bootstrap="$(VHE_REPO_ROOT="$bootstrap_test_root/partial" VHE_BOOTSTRAP_DRY_RUN=1 ./app.sh)"
if [[ "$partial_bootstrap" != *"npm install"* ]]; then
  echo "Expected partial launcher bootstrap to choose npm install, got: $partial_bootstrap" >&2
  exit 1
fi

runtime_bootstrap="$(VHE_REPO_ROOT="$bootstrap_test_root/runtime" VHE_BOOTSTRAP_DRY_RUN=1 ./app.sh)"
if [[ -n "$runtime_bootstrap" ]]; then
  echo "Expected complete runtime deps without Playwright to skip normal bootstrap, got: $runtime_bootstrap" >&2
  exit 1
fi


printf '== ui launcher serve ==
'
VHE_UI_PORT=4308 ./app.sh --serve-check

printf '== font label extraction ==
'
command_python tests/test_build_font.py

printf '== command glyph check isolated ==
'
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/fonts \
  --output-root output/test/render-output \
  --build \
  --text-file output/frame-validation-lines.txt \
  --dist output/test/videos/ \
  --check-glyphs

printf '== parallel max-lines smoke ==
'
rm -rf output/test/videos
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/fonts \
  --output-root output/test/render-output \
  --text-file output/frame-validation-lines.txt \
  --dist output/test/videos/ \
  --max-lines 3 \
  --jobs 2 \
  --width 320 \
  --height 180 \
  --internal-scale 1 \
  --font-height 24 \
  --line-spacing 34 \
  --left-margin 20 \
  --right-margin 20 \
  --top-margin 20 \
  --max-line-width 280 \
  --fps 1 \
  --draw-seconds 1 \
  --hold-seconds 0

video_count="$(find output/test/videos -maxdepth 1 -type f -name 'line-*.mp4' | wc -l)"
if [[ "$video_count" -ne 3 ]]; then
  echo "Expected 3 test videos, found $video_count" >&2
  exit 1
fi

command_python tests/check_rendered_frames.py \
  output/test/fonts/font-1-test \
  output/test/render-output/font-1-test/frames \
  "When I have Fears" \
  "What I May Cease to" \
  "Be"

printf '== selected line numbering ==
'
rm -rf output/test/selected-line-videos
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/fonts \
  --output-root output/test/selected-line-render-output \
  --text-file output/frame-validation-lines.txt \
  --dist output/test/selected-line-videos/ \
  --lines 2-3 \
  --jobs 1 \
  --width 320 \
  --height 180 \
  --internal-scale 1 \
  --font-height 24 \
  --line-spacing 34 \
  --left-margin 20 \
  --right-margin 20 \
  --top-margin 20 \
  --max-line-width 280 \
  --fps 1 \
  --draw-seconds 1 \
  --hold-seconds 0

if [[ ! -f output/test/selected-line-videos/line-2.mp4 || ! -f output/test/selected-line-videos/line-3.mp4 || -f output/test/selected-line-videos/line-1.mp4 ]]; then
  echo "Expected --lines 2-3 to write line-2.mp4 and line-3.mp4 only" >&2
  find output/test/selected-line-videos -maxdepth 1 -type f -name 'line-*.mp4' | sort >&2
  exit 1
fi

printf '== single video mode ==
'
rm -rf output/test/single-render-output output/test/single-video
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/fonts \
  --output-root output/test/single-render-output \
  --text-file output/frame-validation-lines.txt \
  --dist output/test/single-video/full.mp4 \
  --video-mode single \
  --max-lines 2 \
  --jobs 2 \
  --width 320 \
  --height 180 \
  --internal-scale 1 \
  --letter-height 18 \
  --line-spacing 34 \
  --left-margin 20 \
  --right-margin 20 \
  --top-margin 20 \
  --bottom-margin 30 \
  --text-position bottom \
  --text-align center \
  --max-line-width 280 \
  --tail-symbols 3 \
  --reveal-style stroke \
  --fps 1 \
  --draw-seconds 1 \
  --hold-seconds 0

if [[ ! -f output/test/single-video/full.mp4 ]]; then
  echo "Expected single combined video output" >&2
  exit 1
fi

single_line_videos="$(find output/test/single-video -maxdepth 1 -type f -name 'full-*.mp4' | wc -l)"
if [[ "$single_line_videos" -ne 0 ]]; then
  echo "Expected no per-line videos in single-video destination, found $single_line_videos" >&2
  find output/test/single-video -maxdepth 1 -type f -name 'full-*.mp4' | sort >&2
  exit 1
fi

if [[ -d output/test/single-render-output/font-1-test/line-videos ]]; then
  echo "Expected single-video intermediate clips to stay temporary, but line-videos leaked into output" >&2
  exit 1
fi

frame_dir_count="$(find output/test/single-render-output/font-1-test/frames -mindepth 1 -maxdepth 1 -type d -name 'full-*' | wc -l)"
if [[ "$frame_dir_count" -ne 2 ]]; then
  echo "Expected 2 frame directories for single-video line chunks, found $frame_dir_count" >&2
  exit 1
fi

single_frame_count="$(find output/test/single-render-output/font-1-test/frames/full-001 -maxdepth 1 -type f -name 'frame_*.png' | wc -l)"
if [[ "$single_frame_count" -ne 4 ]]; then
  echo "Expected single-video chunk to keep tail fade frames, found $single_frame_count" >&2
  exit 1
fi

command_python - <<'PY'
from pathlib import Path
from PIL import Image
frames = sorted(Path("output/test/single-render-output/font-1-test/frames/full-001").glob("frame_*.png"))
if not frames:
  raise SystemExit("single-video option test has no frames")
first = Image.open(frames[0]).convert("RGBA")
last = Image.open(frames[-1]).convert("RGBA")
ink = []
for y in range(first.height):
  for x in range(first.width):
    r, g, b, a = first.getpixel((x, y))
    if a and (r, g, b) != (255, 255, 255):
      ink.append((x, y))
if not ink:
  raise SystemExit("single-video option test first frame has no ink")
ys = [y for _, y in ink]
ink_height = max(ys) - min(ys) + 1
if ink_height > 24:
  raise SystemExit(f"single-video did not respect --letter-height 18: ink height {ink_height}px")
bottom_space = first.height - max(ys) - 1
if bottom_space < 24 or bottom_space > 34:
  raise SystemExit(f"single-video did not respect bottom position/margin: bottom space {bottom_space}px")
last_ink = 0
for r, g, b, a in last.getdata():
  if a and (r, g, b) != (255, 255, 255):
    last_ink += 1
if last_ink != 0:
  raise SystemExit("single-video tail fade did not end on blank text")
print(f"PASS single-video options: frames={len(frames)}, ink_height={ink_height}px, bottom_space={bottom_space}px")
PY

printf '== max-lines stale output cleanup ==
'
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/fonts \
  --output-root output/test/render-output \
  --text-file output/frame-validation-lines.txt \
  --dist output/test/videos/ \
  --max-lines 1 \
  --jobs 1 \
  --width 320 \
  --height 180 \
  --internal-scale 1 \
  --font-height 24 \
  --line-spacing 34 \
  --left-margin 20 \
  --right-margin 20 \
  --top-margin 20 \
  --max-line-width 280 \
  --fps 1 \
  --draw-seconds 1 \
  --hold-seconds 0

frame_dir_count="$(find output/test/render-output/font-1-test/frames -mindepth 1 -maxdepth 1 -type d -name 'line-*' | wc -l)"
if [[ "$frame_dir_count" -ne 1 ]]; then
  echo "Expected 1 line frame directory after --max-lines 1, found $frame_dir_count" >&2
  find output/test/render-output/font-1-test/frames -mindepth 1 -maxdepth 1 -type d -name 'line-*' | sort >&2
  exit 1
fi

video_count="$(find output/test/videos -maxdepth 1 -type f -name 'line-*.mp4' | wc -l)"
if [[ "$video_count" -ne 1 ]]; then
  echo "Expected 1 test video after --max-lines 1, found $video_count" >&2
  find output/test/videos -maxdepth 1 -type f -name 'line-*.mp4' | sort >&2
  exit 1
fi

command_python tests/check_rendered_frames.py \
  output/test/fonts/font-1-test \
  output/test/render-output/font-1-test/frames \
  "When I have Fears"

printf '== configurable letter height ==
'
rm -rf output/test/letter-size-render-output output/test/letter-size-videos
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/fonts \
  --output-root output/test/letter-size-render-output \
  --text "Be" \
  --dist output/test/letter-size-videos/letter-size.mp4 \
  --width 320 \
  --height 180 \
  --internal-scale 1 \
  --letter-height 18 \
  --line-spacing 24 \
  --left-margin 20 \
  --right-margin 20 \
  --top-margin 20 \
  --max-line-width 280 \
  --fps 1 \
  --draw-seconds 1 \
  --hold-seconds 0

command_python - <<'PY'
from pathlib import Path
from PIL import Image
frame = Image.open(Path("output/test/letter-size-render-output/font-1-test/frames/frame_000000.png")).convert("RGBA")
xs = []
ys = []
for y in range(frame.height):
  for x in range(frame.width):
    r, g, b, a = frame.getpixel((x, y))
    if a and (r, g, b) != (255, 255, 255):
      xs.append(x)
      ys.append(y)
if not xs:
  raise SystemExit("letter-height test frame has no ink")
ink_height = max(ys) - min(ys) + 1
if ink_height > 24:
  raise SystemExit(f"--letter-height 18 rendered too tall: ink height {ink_height}px")
print(f"PASS letter-height 18 ink height: {ink_height}px")
PY

printf '== configurable text position ==
'
rm -rf output/test/text-position-render-output output/test/text-position-videos
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/fonts \
  --output-root output/test/text-position-render-output \
  --text "Be" \
  --dist output/test/text-position-videos/bottom.mp4 \
  --width 320 \
  --height 180 \
  --internal-scale 1 \
  --letter-height 18 \
  --line-spacing 24 \
  --left-margin 20 \
  --right-margin 20 \
  --top-margin 20 \
  --bottom-margin 30 \
  --text-position bottom \
  --max-line-width 280 \
  --fps 1 \
  --draw-seconds 1 \
  --hold-seconds 0

command_python tests/check_rendered_frames.py \
  output/test/fonts/font-1-test \
  output/test/text-position-render-output/font-1-test/frames \
  --text-position bottom \
  --bottom-margin 30 \
  --letter-height 18 \
  "Be"

command_python - <<'PY'
from pathlib import Path
from PIL import Image
frame = Image.open(Path("output/test/text-position-render-output/font-1-test/frames/frame_000000.png")).convert("RGBA")
ys = []
for y in range(frame.height):
  for x in range(frame.width):
    r, g, b, a = frame.getpixel((x, y))
    if a and (r, g, b) != (255, 255, 255):
      ys.append(y)
if not ys:
  raise SystemExit("bottom-position test frame has no ink")
bottom_space = frame.height - max(ys) - 1
if bottom_space < 28 or bottom_space > 34:
  raise SystemExit(f"--text-position bottom expected about 30px bottom space, got {bottom_space}px")
print(f"PASS text-position bottom margin: {bottom_space}px")
PY

rm -rf output/test/text-position-center-render-output output/test/text-position-center-videos
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/fonts \
  --output-root output/test/text-position-center-render-output \
  --text "Be" \
  --dist output/test/text-position-center-videos/center.mp4 \
  --width 320 \
  --height 180 \
  --internal-scale 1 \
  --letter-height 18 \
  --line-spacing 24 \
  --left-margin 20 \
  --right-margin 20 \
  --text-position center \
  --max-line-width 280 \
  --fps 1 \
  --draw-seconds 1 \
  --hold-seconds 0

command_python tests/check_rendered_frames.py \
  output/test/fonts/font-1-test \
  output/test/text-position-center-render-output/font-1-test/frames \
  --text-position center \
  --letter-height 18 \
  "Be"

command_python - <<'PY'
from pathlib import Path
from PIL import Image
frame = Image.open(Path("output/test/text-position-center-render-output/font-1-test/frames/frame_000000.png")).convert("RGBA")
ys = []
for y in range(frame.height):
  for x in range(frame.width):
    r, g, b, a = frame.getpixel((x, y))
    if a and (r, g, b) != (255, 255, 255):
      ys.append(y)
if not ys:
  raise SystemExit("center-position test frame has no ink")
center = (min(ys) + max(ys)) / 2
if abs(center - frame.height / 2) > 4:
  raise SystemExit(f"--text-position center expected near {frame.height / 2}px, got {center}px")
print(f"PASS text-position center y: {center:.1f}px")
PY

printf '== transparent alpha video ==
'
rm -rf output/test/transparent-render-output output/test/transparent-videos
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/fonts \
  --output-root output/test/transparent-render-output \
  --text "Be" \
  --dist output/test/transparent-videos/overlay.mov \
  --transparent \
  --ink-color 255,255,255 \
  --width 320 \
  --height 180 \
  --internal-scale 1 \
  --letter-height 18 \
  --line-spacing 24 \
  --left-margin 20 \
  --right-margin 20 \
  --top-margin 20 \
  --max-line-width 280 \
  --fps 1 \
  --draw-seconds 1 \
  --hold-seconds 0

if [[ ! -f output/test/transparent-videos/overlay.mov ]]; then
  echo "Expected transparent overlay MOV output" >&2
  exit 1
fi

alpha_pix_fmt="$(ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=nw=1:nk=1 output/test/transparent-videos/overlay.mov)"
case "$alpha_pix_fmt" in
  *a*) ;;
  *) echo "Expected alpha-capable pixel format, got $alpha_pix_fmt" >&2; exit 1 ;;
esac

command_python - <<'PY'
from pathlib import Path
from PIL import Image
frame = Image.open(Path("output/test/transparent-render-output/font-1-test/frames/frame_000000.png")).convert("RGBA")
alpha = frame.getchannel("A")
if min(alpha.getdata()) != 0:
  raise SystemExit("transparent frame has no fully transparent pixels")
if max(alpha.getdata()) == 0:
  raise SystemExit("transparent frame has no visible handwriting ink")
ink_pixels = [(r, g, b) for r, g, b, a in frame.getdata() if a > 0]
if not ink_pixels:
  raise SystemExit("transparent frame has no visible ink pixels")
if any((r, g, b) != (255, 255, 255) for r, g, b in ink_pixels):
  raise SystemExit("--ink-color 255,255,255 did not produce white handwriting ink")
print("PASS transparent alpha video with white ink")
PY

printf '== tail symbols fade ==
'
rm -rf output/test/tail-render-output output/test/tail-videos
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/fonts \
  --output-root output/test/tail-render-output \
  --text "abcdef" \
  --dist output/test/tail-videos/tail.mp4 \
  --width 320 \
  --height 180 \
  --internal-scale 1 \
  --letter-height 24 \
  --line-spacing 34 \
  --left-margin 20 \
  --right-margin 20 \
  --top-margin 20 \
  --max-line-width 280 \
  --tail-symbols 3 \
  --text-align center \
  --fps 1 \
  --draw-seconds 1 \
  --hold-seconds 0

if [[ ! -f output/test/tail-render-output/font-1-test/frames/frame_000000.png ]]; then
  echo "Expected tail fade frame output" >&2
  exit 1
fi

printf '== stale manifest auto-rebuild ==
'
rm -rf output/test/stale-fonts output/test/stale-render-output output/test/stale-videos
mkdir -p output/test/stale-fonts/font-1-test
printf '{"glyphs":{"W":{"file":"W.png","sample":"samples/font-1/1.png"}}}
' > output/test/stale-fonts/font-1-test/manifest.json
./video-handwriting-effect.command.sh \
  --font-name font-1-test \
  --sample samples/font-1/ \
  --fonts-root output/test/stale-fonts \
  --output-root output/test/stale-render-output \
  --text-file output/frame-validation-lines.txt \
  --dist output/test/stale-videos/ \
  --max-lines 3 \
  --jobs 2 \
  --width 320 \
  --height 180 \
  --internal-scale 1 \
  --font-height 24 \
  --line-spacing 34 \
  --left-margin 20 \
  --right-margin 20 \
  --top-margin 20 \
  --max-line-width 280 \
  --fps 1 \
  --draw-seconds 1 \
  --hold-seconds 0

command_python tests/check_rendered_frames.py \
  output/test/stale-fonts/font-1-test \
  output/test/stale-render-output/font-1-test/frames \
  "When I have Fears" \
  "What I May Cease to" \
  "Be"

printf 'All video-handwriting-effect tests passed.
'
