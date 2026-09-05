# video-handwriting-effect.command

## What It Does

Builds a named handwriting font from PNG samples and renders text into handwriting MP4s/MOV video.
Text files default to one MP4 per non-empty line, or one combined video with `--video-mode single`.

## Files

```text
video-handwriting-effect/
├── video-handwriting-effect.command.sh
├── build_font.py
├── render.py
├── samples/
│   ├── font-1/
│   │   ├── 1.png
│   │   └── 1-label.txt
│   └── text/
│       └── lyrics-1.txt
├── fonts/
│   └── font-1/
└── output/
    └── font-1/
```

## UI Launcher

Run the Angular/Electron launcher from `video-handwriting-effect/`:

```bash
./app.sh
```

The launcher starts the local Angular dev server, opens an Electron window, and runs
`video-handwriting-effect.command.sh` with the selected options while streaming logs. It does not production-build
during normal local use.

Launcher behavior rules:

- Resolution is user-configurable from the launcher before rendering.
- Presets include 16:9 HD, 9:16 vertical HD, square HD, 16:9 4K, and custom.
- The launcher passes the selected width and height to the render command with `--width` and `--height`.
- Manual width or height edits switch the launcher to custom resolution unless they match a preset.
- Output selection is folder-based for both video modes.
- In `single` mode, the selected output folder is passed to `--dist` and the command writes one combined video there.
- In `per-line` mode, the launcher passes `<selected-output-folder>/per-line` to `--dist` so generated line videos stay
grouped in a dedicated subfolder.

## UI Development Rule

The UI launcher is local-only and must use Angular dev server for normal runs. Do not add production build steps to
`./app.sh` startup; production build validation belongs only in explicit checks, not in the interactive launcher path.

## Command

Run this from `video-handwriting-effect/`:

```bash
./video-handwriting-effect.command.sh \
  --font-name font-1 \
  --text-file samples/text/lyrics-1.txt \
  --dist output/font-1/
```

It writes one video per non-empty line, in parallel:

```text
output/font-1/line-1.mp4
output/font-1/line-2.mp4
output/font-1/line-3.mp4
...
```

To render each line separately and combine the result into one full video:

```bash
./video-handwriting-effect.command.sh \
  --font-name font-1 \
  --text-file samples/text/lyrics-1.txt \
  --dist output/font-1/full.mp4 \
  --video-mode single \
  --letter-height 48 \
  --text-position bottom \
  --text-align center \
  --bottom-margin 120 \
  --tail-symbols 20 \
  --reveal-style stroke
```

For an overlay video with transparency, write ProRes 4444 `.mov`:

```bash
./video-handwriting-effect.command.sh \
  --font-name font-1 \
  --text-file samples/text/lyrics-1.txt \
  --dist output/font-1/overlay.mov \
  --video-mode single \
  --transparent \
  --ink-color 255,255,255 \
  --letter-height 48 \
  --text-position bottom \
  --text-align center \
  --bottom-margin 120 \
  --tail-symbols 20 \
  --reveal-style stroke
```

Quick one-line test:

```bash
./video-handwriting-effect.command.sh \
  --font-name font-1 \
  --text-file samples/text/lyrics-1.txt \
  --dist output/font-1/ \
  --lines 1 \
  --transparent \
  --ink-color 255,255,255 \
  --letter-height 28 \
  --text-position bottom \
  --text-align center \
  --bottom-margin 120 \
  --tail-symbols 20 \
  --reveal-style stroke
```

If `fonts/font-1/manifest.json` is missing, the command builds it automatically from:

```text
samples/font-1/1.png
samples/font-1/1-label.txt
```

## Font Samples

Each PNG must have a matching label file:

```text
samples/font-1/1.png
samples/font-1/1-label.txt

samples/font-1/2.png
samples/font-1/2-label.txt
```

`1-label.txt` has one label line per detected handwriting line in `1.png`. Example:

```text
# line-gap: 10
0 1 2 3 4 5 6 7 8 9 . , ? ! : ; ' " ( ) -
a b c d e f g h i j k l m n o p q r s t u v w x y z
```

Generated glyph files use lowercase ASCII Unicode codepoint names such as
`glyph-u0041.png` (`A`), `glyph-u0061.png` (`a`), and `glyph-u00e9.png` (`é`).
Do not name generated assets directly after glyph characters: case-only names
and Unicode-normalized names collide on standard macOS and Windows filesystems.
Sample sheets must likewise use semantic names such as `latin-uppercase.png`
and `latin-lowercase.png`.

## Defaults

- Video size: `1920x1080`.
- Internal render: `3840x2160`, downscaled for smoother handwriting.
- Clip mode: `line`, so every non-empty text line becomes one clip chunk.
- Video mode: `per-line` writes one MP4 per chunk; `--video-mode single` combines the chunks into one MP4.
- Parallel jobs: `auto`, which uses `min(10, CPU cores, clip count)`. Override with `--jobs 4`.
- Letter size: `--letter-height 48` controls final handwriting height in pixels. `--font-height` is the same
lower-level option. Default is `48`.
- Text position: `--text-position top|center|bottom` controls vertical placement. Use `--top-margin` for top placement
and `--bottom-margin` for bottom placement.
- Text alignment: `--text-align center` horizontally centers each fully expanded line before reveal/fade. Default is `left`.
- Reveal style: `--reveal-style stroke` reveals the active glyph through its ink mask for a handwritten write-on
effect. Use `--reveal-style crop` for the older rectangular reveal. Default is `stroke`.
- Tail fade: `--tail-symbols 20` keeps a magical fading trail of the most recent 20 rendered glyphs; older glyphs
disappear, and the clip appends outro frames until the final tail fades to nothing. Default `0` disables the effect.
- Ink color: `--ink-color 255,255,255` renders white handwriting. It is an alias of `--text-color`; default is black `0,0,0`.
- Transparent overlay: `--transparent` is shorthand for `--background transparent --video-format alpha-mov`; alpha
output must use `.mov` because normal MP4/H.264 drops transparency.
- Line selection: `--lines all` renders all chunks; `--lines 1-17` renders a range; `--lines 1,3,4` renders exact
chunks in that order. `--max-lines 1` remains available for first-N test renders.
- `--dist` is the output folder for `per-line` mode. In `single` mode, `--dist output/name.mp4` writes that file;
folder-style `--dist output/font-1/` writes `output/font-1/font-1.mp4`.

## Tests

Run all command tests from `video-handwriting-effect/`:

```bash
./test.sh
```

Tests are isolated under `output/test/` and validate:

- `1-label.txt` label counts match detected glyph rows in `1.png`.
- `font-1` builds into a test font directory without touching normal `fonts/font-1`.
- Generated glyph filenames use portable Unicode codepoint names.
- Tracked paths do not collide after case-folding and Unicode normalization.
- Required glyphs for `samples/text/lyrics-1.txt` are present.
- Missing per-PNG label files fail clearly.
