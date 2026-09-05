#!/usr/bin/env python3
"""Render handwriting frames from a named PNG glyph font."""

from __future__ import annotations

import argparse
import json
import math
import sys
import shutil
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


STROKE_ORDER_CACHE: dict[int, list[float | None]] = {}


GLYPH_NAMES = {
  ".": "dot",
  ",": "comma",
  "?": "question",
  "!": "exclamation",
  ":": "colon",
  ";": "semicolon",
  "'": "apostrophe",
  '"': "quote",
  "/": "slash",
  "(": "paren-open",
  ")": "paren-close",
  "[": "bracket-open",
  "]": "bracket-close",
  "-": "dash",
  "–": "en-dash",
  "—": "em-dash",
  "―": "horizontal-bar",
  "…": "ellipsis",
  "‘": "left-single-quote",
  "’": "right-single-quote",
  "“": "left-double-quote",
  "”": "right-double-quote",
  "„": "low-double-quote",
  "«": "left-guillemet",
  "»": "right-guillemet",
}


@dataclass(frozen=True)
class RenderConfig:
  text: str
  font_dir: Path
  frames_dir: Path
  width: int
  height: int
  font_height: int
  line_spacing: int
  left_margin: int
  right_margin: int
  top_margin: int
  bottom_margin: int
  max_line_width: int
  horizontal_position: str
  vertical_position: str
  fps: int
  draw_seconds: float
  hold_seconds: float
  background: tuple[int, int, int, int]
  text_color: tuple[int, int, int, int]
  tail_symbols: int
  clean: bool
  check_glyphs: bool
  reveal_style: str = "stroke"


@dataclass(frozen=True)
class GlyphBitmap:
  image: Image.Image
  y_offset: int

  @property
  def width(self) -> int:
    return self.image.width

  @property
  def height(self) -> int:
    return self.image.height


@dataclass(frozen=True)
class GlyphPlacement:
  glyph: GlyphBitmap
  x: int
  y: int

  @property
  def image(self) -> Image.Image:
    return self.glyph.image

  @property
  def width(self) -> int:
    return self.glyph.width

  @property
  def height(self) -> int:
    return self.glyph.height


def parse_color(value: str) -> tuple[int, int, int, int]:
  if value == "transparent":
    return (0, 0, 0, 0)

  parts = value.split(",")
  if len(parts) not in (3, 4):
    raise argparse.ArgumentTypeError("Color must be r,g,b, r,g,b,a, or transparent.")

  channels = tuple(int(part) for part in parts)
  if any(channel < 0 or channel > 255 for channel in channels):
    raise argparse.ArgumentTypeError("Color channels must be between 0 and 255.")

  if len(channels) == 3:
    return channels + (255,)
  return channels


def glyph_key(character: str) -> str:
  return GLYPH_NAMES.get(character, character)


def load_manifest(font_dir: Path) -> dict[str, object]:
  manifest_path = font_dir / "manifest.json"
  if not manifest_path.exists():
    raise FileNotFoundError(f"Font manifest not found: {manifest_path}")
  return json.loads(manifest_path.read_text(encoding="utf-8"))


def tint_glyph(image: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
  glyph = image.convert("RGBA")
  alpha = glyph.getchannel("A")
  tinted = Image.new("RGBA", glyph.size, color)
  tinted.putalpha(alpha)
  return tinted


def font_reference_height(glyph_entries: dict[str, object]) -> int:
  uppercase_heights: list[int] = []
  all_heights: list[int] = []
  for label, entry in glyph_entries.items():
    if not isinstance(label, str) or not isinstance(entry, dict):
      continue
    height = entry.get("height")
    if not isinstance(height, int) or height <= 0:
      continue
    all_heights.append(height)
    if len(label) == 1 and label.isupper() and label.isascii():
      uppercase_heights.append(height)

  heights = uppercase_heights or all_heights
  if not heights:
    return 1
  heights = sorted(heights)
  return heights[len(heights) // 2]


def load_glyphs(font_dir: Path, target_height: int, text_color: tuple[int, int, int, int]) -> dict[str, GlyphBitmap]:
  manifest = load_manifest(font_dir)
  glyph_entries = manifest.get("glyphs", {})
  if not isinstance(glyph_entries, dict):
    raise RuntimeError(f"Invalid glyph manifest: {font_dir / 'manifest.json'}")

  reference_height = font_reference_height(glyph_entries)
  scale = target_height / max(1, reference_height)
  glyphs: dict[str, GlyphBitmap] = {}
  for label, entry in glyph_entries.items():
    if not isinstance(entry, dict) or not isinstance(entry.get("file"), str):
      continue
    source = Image.open(font_dir / entry["file"]).convert("RGBA")
    resized = source.resize((max(1, round(source.width * scale)), max(1, round(source.height * scale))), Image.Resampling.LANCZOS)
    y_offset = entry.get("y_offset", 0)
    if not isinstance(y_offset, int):
      y_offset = 0
    glyphs[label] = GlyphBitmap(tint_glyph(resized, text_color), max(0, round(y_offset * scale)))
  return glyphs


def glyph_available(character: str, glyphs: dict[str, GlyphBitmap]) -> bool:
  return glyph_key(character) in glyphs or character in glyphs


def get_glyph(character: str, glyphs: dict[str, GlyphBitmap]) -> GlyphBitmap:
  glyph = glyphs.get(glyph_key(character)) or glyphs.get(character)
  if glyph is None:
    raise RuntimeError(f"Missing glyph for {character!r}.")
  return glyph


def missing_characters(text: str, glyphs: dict[str, GlyphBitmap]) -> list[str]:
  ignored = {" ", "\n", "\t", "\r"}
  missing = {
    character
    for character in text
    if character not in ignored and not glyph_available(character, glyphs)
  }
  return sorted(missing, key=lambda character: (character.casefold(), character))


def format_missing_characters(missing: list[str]) -> str:
  uppercase = [character for character in missing if character.isupper()]
  lowercase = [character for character in missing if character.islower() and character.isascii()]
  accented = [character for character in missing if character.isalpha() and not character.isascii()]
  punctuation = [character for character in missing if not character.isalpha() and not character.isdigit()]

  lines = [
    "Missing handwriting glyphs. Generate new sample PNG line(s), then rebuild the font.",
    "Characters:",
    " ".join(missing),
  ]

  if uppercase:
    lines.extend(["", "Uppercase sample line:", " ".join(uppercase)])
  if lowercase:
    lines.extend(["", "Lowercase sample line:", " ".join(lowercase)])
  if accented:
    lines.extend(["", "Accented sample line:", " ".join(accented)])
  if punctuation:
    lines.extend(["", "Punctuation sample line:", " ".join(punctuation)])

  lines.extend([
    "",
    "Suggested workflow:",
    "1. Generate one or more black-on-white PNG sample sheets with these characters separated by spaces.",
    "2. Save them under samples/<font-name>/, for example samples/font-1/2.png.",
    "3. Rebuild with matching --build-labels lines, or add those lines to the default font sample.",
  ])
  return "\n".join(lines)


def measure_word(word: str, glyphs: dict[str, GlyphBitmap], space_width: int, letter_spacing: int) -> int:
  width = 0
  for character in word:
    if character == " ":
      width += space_width
      continue
    glyph = get_glyph(character, glyphs)
    width += glyph.width + letter_spacing
  return max(0, width - letter_spacing)


def wrap_line(line: str, glyphs: dict[str, GlyphBitmap], max_width: int, space_width: int, letter_spacing: int) -> list[str]:
  if not line.strip():
    return [""]

  wrapped: list[str] = []
  current = ""
  for word in line.split(" "):
    candidate = word if not current else f"{current} {word}"
    if measure_word(candidate, glyphs, space_width, letter_spacing) <= max_width:
      current = candidate
      continue

    if current:
      wrapped.append(current)
    current = word

  if current:
    wrapped.append(current)
  return wrapped


def wrapped_text_lines(config: RenderConfig, glyphs: dict[str, GlyphBitmap], space_width: int, letter_spacing: int) -> list[str]:
  max_width = min(config.max_line_width, config.width - config.left_margin - config.right_margin)
  lines: list[str] = []
  for source_line in config.text.splitlines():
    lines.extend(wrap_line(source_line, glyphs, max_width, space_width, letter_spacing))
  return lines


def initial_y(config: RenderConfig, line_count: int) -> int:
  if line_count <= 0:
    return config.top_margin

  block_height = config.font_height + max(0, line_count - 1) * config.line_spacing
  if config.vertical_position == "center":
    return max(0, round((config.height - block_height) / 2))
  if config.vertical_position == "bottom":
    return max(0, config.height - config.bottom_margin - block_height)
  return config.top_margin



def measure_line(line: str, glyphs: dict[str, GlyphBitmap], space_width: int, letter_spacing: int) -> int:
  return measure_word(line, glyphs, space_width, letter_spacing)


def initial_x(config: RenderConfig, line: str, glyphs: dict[str, GlyphBitmap], space_width: int, letter_spacing: int) -> int:
  if config.horizontal_position != "center":
    return config.left_margin

  available_left = config.left_margin
  available_width = config.width - config.left_margin - config.right_margin
  line_width = measure_line(line, glyphs, space_width, letter_spacing)
  return max(0, available_left + round((available_width - line_width) / 2))

def layout_text(config: RenderConfig, glyphs: dict[str, GlyphBitmap]) -> list[GlyphPlacement]:
  letter_spacing = max(1, round(config.font_height * 0.08))
  space_width = max(1, round(config.font_height * 0.45))
  lines = wrapped_text_lines(config, glyphs, space_width, letter_spacing)
  placements: list[GlyphPlacement] = []
  y = initial_y(config, len(lines))

  for line in lines:
    x = initial_x(config, line, glyphs, space_width, letter_spacing)
    for character in line:
      if character == " ":
        x += space_width
        continue
      glyph = get_glyph(character, glyphs)
      placements.append(GlyphPlacement(glyph, x, y + glyph.y_offset))
      x += glyph.width + letter_spacing
    y += config.line_spacing

  return placements



def connected_component(start: int, ink: set[int], width: int, height: int) -> set[int]:
  component: set[int] = set()
  queue: deque[int] = deque([start])
  ink.remove(start)

  while queue:
    index = queue.popleft()
    component.add(index)
    x = index % width
    y = index // width
    for dy in (-1, 0, 1):
      for dx in (-1, 0, 1):
        if dx == 0 and dy == 0:
          continue
        nx = x + dx
        ny = y + dy
        if nx < 0 or nx >= width or ny < 0 or ny >= height:
          continue
        neighbor = ny * width + nx
        if neighbor not in ink:
          continue
        ink.remove(neighbor)
        queue.append(neighbor)
  return component


def component_distances(component: set[int], width: int) -> dict[int, int]:
  min_x = min(index % width for index in component)
  center_y = (min(index // width for index in component) + max(index // width for index in component)) / 2
  seeds = [index for index in component if index % width == min_x]
  seed = min(seeds, key=lambda index: abs((index // width) - center_y))
  distances = {seed: 0}
  queue: deque[int] = deque([seed])

  while queue:
    index = queue.popleft()
    x = index % width
    y = index // width
    for dy in (-1, 0, 1):
      for dx in (-1, 0, 1):
        if dx == 0 and dy == 0:
          continue
        nx = x + dx
        ny = y + dy
        neighbor = ny * width + nx
        if neighbor in component and neighbor not in distances:
          distances[neighbor] = distances[index] + 1
          queue.append(neighbor)
  return distances


def stroke_order(image: Image.Image) -> list[float | None]:
  key = id(image)
  cached = STROKE_ORDER_CACHE.get(key)
  if cached is not None:
    return cached

  alpha = image.getchannel("A")
  width, height = image.size
  ink = {index for index, value in enumerate(alpha.getdata()) if value > 0}
  order: list[float | None] = [None] * (width * height)
  if not ink:
    STROKE_ORDER_CACHE[key] = order
    return order

  components: list[set[int]] = []
  while ink:
    components.append(connected_component(next(iter(ink)), ink, width, height))

  components.sort(key=lambda component: (min(index % width for index in component), min(index // width for index in component)))
  component_offset = 0.0
  for component in components:
    distances = component_distances(component, width)
    max_distance = max(distances.values()) or 1
    min_x = min(index % width for index in component)
    for index, distance in distances.items():
      x = index % width
      order[index] = component_offset + min_x + distance / max_distance
    component_offset += width + 1

  STROKE_ORDER_CACHE[key] = order
  return order


def reveal_glyph(image: Image.Image, progress: float) -> Image.Image:
  progress = max(0.0, min(1.0, progress))
  if progress >= 0.999:
    return image
  if progress <= 0.0:
    return Image.new("RGBA", image.size, (0, 0, 0, 0))

  order = stroke_order(image)
  visible_orders = [value for value in order if value is not None]
  if not visible_orders:
    return Image.new("RGBA", image.size, (0, 0, 0, 0))

  start = min(visible_orders)
  end = max(visible_orders)
  cutoff = start + (end - start) * progress
  edge = max(0.04, (end - start) * 0.035)
  alpha = image.getchannel("A")
  next_alpha: list[int] = []
  for index, alpha_value in enumerate(alpha.getdata()):
    value = order[index]
    if value is None or value > cutoff + edge:
      next_alpha.append(0)
    elif value <= cutoff:
      next_alpha.append(alpha_value)
    else:
      opacity = 1.0 - ((value - cutoff) / edge)
      next_alpha.append(max(0, min(255, round(alpha_value * opacity))))

  revealed = image.copy()
  mask = Image.new("L", image.size)
  mask.putdata(next_alpha)
  revealed.putalpha(mask)
  return revealed

def apply_opacity(image: Image.Image, opacity: float) -> Image.Image:
  opacity = max(0.0, min(1.0, opacity))
  if opacity >= 0.999:
    return image
  adjusted = image.copy()
  adjusted.putalpha(adjusted.getchannel("A").point(lambda value: max(0, min(255, round(value * opacity)))))
  return adjusted


def placement_opacity(config: RenderConfig, placement_index: int, active_index: int) -> float:
  if config.tail_symbols <= 0:
    return 1.0
  distance = active_index - placement_index
  if distance < 0:
    return 0.0
  if distance >= config.tail_symbols:
    return 0.0
  return max(0.08, 1.0 - (distance / max(1, config.tail_symbols)))

def draw_progress(config: RenderConfig, placements: list[GlyphPlacement], progress: float, active_index: int | None = None) -> Image.Image:
  canvas = Image.new("RGBA", (config.width, config.height), config.background)
  total_width = sum(placement.width for placement in placements)
  visible_width = total_width * progress
  consumed = 0.0
  resolved_active_index = -1

  if active_index is None:
    for index, placement in enumerate(placements):
      if visible_width - consumed <= 0:
        break
      resolved_active_index = index
      consumed += placement.width
  else:
    resolved_active_index = active_index

  consumed = 0.0
  for index, placement in enumerate(placements):
    remaining = visible_width - consumed
    if remaining <= 0:
      break

    opacity = placement_opacity(config, index, resolved_active_index)
    if opacity <= 0:
      consumed += placement.width
      continue

    if remaining >= placement.width:
      canvas.alpha_composite(apply_opacity(placement.image, opacity), (placement.x, placement.y))
    else:
      if config.reveal_style == "crop":
        crop_width = max(1, min(placement.width, math.ceil(remaining)))
        partial = placement.image.crop((0, 0, crop_width, placement.height))
      else:
        partial = reveal_glyph(placement.image, remaining / placement.width)
      canvas.alpha_composite(apply_opacity(partial, opacity), (placement.x, placement.y))
      break

    consumed += placement.width

  return canvas


def tail_fade_out_frames(config: RenderConfig, placements: list[GlyphPlacement], drawing_frames: int) -> int:
  if config.tail_symbols <= 0 or not placements:
    return 0
  frames_per_symbol = drawing_frames / max(1, len(placements))
  return max(config.tail_symbols, round(config.tail_symbols * frames_per_symbol))


def render_frames(config: RenderConfig) -> int:
  if not config.text.strip():
    raise RuntimeError("Text cannot be empty.")

  glyphs = load_glyphs(config.font_dir, config.font_height, config.text_color)
  missing = missing_characters(config.text, glyphs)
  if missing:
    raise RuntimeError(format_missing_characters(missing))
  if config.check_glyphs:
    print("All required glyphs are available.")
    return 0

  if config.clean and config.frames_dir.exists():
    shutil.rmtree(config.frames_dir)
  config.frames_dir.mkdir(parents=True, exist_ok=True)

  placements = layout_text(config, glyphs)
  drawing_frames = max(1, round(config.draw_seconds * config.fps))
  hold_frames = max(0, round(config.hold_seconds * config.fps))
  fade_out_frames = tail_fade_out_frames(config, placements, drawing_frames)
  frame_number = 0

  for frame_index in range(drawing_frames):
    progress = (frame_index + 1) / drawing_frames
    draw_progress(config, placements, progress).save(config.frames_dir / f"frame_{frame_number:06d}.png")
    frame_number += 1

  final_frame = draw_progress(config, placements, 1.0)
  for _ in range(hold_frames):
    final_frame.save(config.frames_dir / f"frame_{frame_number:06d}.png")
    frame_number += 1

  for frame_index in range(fade_out_frames):
    virtual_symbols = math.ceil(((frame_index + 1) / fade_out_frames) * config.tail_symbols)
    active_index = len(placements) - 1 + virtual_symbols
    draw_progress(config, placements, 1.0, active_index=active_index).save(config.frames_dir / f"frame_{frame_number:06d}.png")
    frame_number += 1

  return frame_number


def text_from_args(args: argparse.Namespace) -> str:
  if args.text_file:
    return Path(args.text_file).read_text(encoding="utf-8")
  return args.text or ""


def parse_args() -> RenderConfig:
  parser = argparse.ArgumentParser(description="Render handwriting frames from a named PNG font.")
  parser.add_argument("--text", default=None, help="Text to render.")
  parser.add_argument("--text-file", default=None, help="UTF-8 text file to render.")
  parser.add_argument("--font-dir", type=Path, required=True, help="Directory containing glyph PNG files and manifest.json.")
  parser.add_argument("--frames-dir", type=Path, required=True, help="Frame output directory.")
  parser.add_argument("--width", type=int, default=3840, help="Internal render width. Default: 3840.")
  parser.add_argument("--height", type=int, default=2160, help="Internal render height. Default: 2160.")
  parser.add_argument("--font-height", type=int, default=160, help="Internal glyph height. Default: 160 for 80px final at 2x.")
  parser.add_argument("--line-spacing", type=int, default=250, help="Internal line spacing. Default: 250 for 125px final at 2x.")
  parser.add_argument("--left-margin", type=int, default=360, help="Internal left margin. Default: 360 for 180px final at 2x.")
  parser.add_argument("--right-margin", type=int, default=360, help="Internal right margin. Default: 360 for 180px final at 2x.")
  parser.add_argument("--top-margin", type=int, default=360, help="Internal top margin. Default: 360 for 180px final at 2x.")
  parser.add_argument("--bottom-margin", type=int, default=360, help="Internal bottom margin used by --vertical-position bottom. Default: 360 for 180px final at 2x.")
  parser.add_argument("--max-line-width", type=int, default=2800, help="Internal max line width. Default: 2800 for 1400px final at 2x.")
  parser.add_argument("--horizontal-position", choices=["left", "center"], default="left", help="Horizontal text position based on final expanded line width. Default: left.")
  parser.add_argument("--vertical-position", choices=["top", "center", "bottom"], default="top", help="Vertical text position. Default: top.")
  parser.add_argument("--fps", type=int, default=30, help="Frames per second.")
  parser.add_argument("--draw-seconds", type=float, default=5.0, help="Seconds spent revealing handwriting.")
  parser.add_argument("--hold-seconds", type=float, default=2.0, help="Seconds to hold the completed handwriting.")
  parser.add_argument("--background", type=parse_color, default=parse_color("255,255,255"), help="Background color r,g,b[,a] or transparent.")
  parser.add_argument("--text-color", type=parse_color, default=parse_color("0,0,0"), help="Text color r,g,b[,a].")
  parser.add_argument("--tail-symbols", type=int, default=0, help="Fade older glyphs and keep only this many recent symbols visible. Default: 0 disables tail fading.")
  parser.add_argument("--reveal-style", choices=["stroke", "crop"], default="stroke", help="How the active glyph appears: stroke follows the glyph ink mask, crop uses the legacy rectangular reveal. Default: stroke.")
  parser.add_argument("--keep", action="store_true", help="Keep existing frames in the output directory.")
  parser.add_argument("--check-glyphs", action="store_true", help="Report missing glyphs without rendering frames.")
  args = parser.parse_args()

  if args.text and args.text_file:
    raise SystemExit("Use either --text or --text-file, not both.")

  return RenderConfig(
    text=text_from_args(args),
    font_dir=args.font_dir,
    frames_dir=args.frames_dir,
    width=args.width,
    height=args.height,
    font_height=args.font_height,
    line_spacing=args.line_spacing,
    left_margin=args.left_margin,
    right_margin=args.right_margin,
    top_margin=args.top_margin,
    bottom_margin=args.bottom_margin,
    max_line_width=args.max_line_width,
    horizontal_position=args.horizontal_position,
    vertical_position=args.vertical_position,
    fps=args.fps,
    draw_seconds=args.draw_seconds,
    hold_seconds=args.hold_seconds,
    background=args.background,
    text_color=args.text_color,
    tail_symbols=args.tail_symbols,
    clean=not args.keep,
    check_glyphs=args.check_glyphs,
    reveal_style=args.reveal_style,
  )


def main() -> None:
  try:
    frame_count = render_frames(parse_args())
  except RuntimeError as error:
    print(error, file=sys.stderr)
    raise SystemExit(1) from None
  print(f"{frame_count} frames created")


if __name__ == "__main__":
  main()
