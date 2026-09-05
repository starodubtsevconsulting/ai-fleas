#!/usr/bin/env python3
from __future__ import annotations

import sys
from importlib.machinery import SourceFileLoader
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
render = SourceFileLoader("render", str(ROOT / "render.py")).load_module()


def fail(message: str) -> None:
  raise SystemExit(message)


def expected_frame(text: str, font_dir: Path, vertical_position: str = "top", bottom_margin: int = 20, letter_height: int = 24) -> Image.Image:
  config = render.RenderConfig(
    text=text,
    font_dir=font_dir,
    frames_dir=Path("/tmp/video-handwriting-frame-check"),
    width=320,
    height=180,
    font_height=letter_height,
    line_spacing=34,
    left_margin=20,
    right_margin=20,
    top_margin=20,
    bottom_margin=bottom_margin,
    max_line_width=280,
    horizontal_position="left",
    vertical_position=vertical_position,
    fps=1,
    draw_seconds=1,
    hold_seconds=0,
    background=(255, 255, 255, 255),
    text_color=(0, 0, 0, 255),
    tail_symbols=0,
    clean=True,
    check_glyphs=False,
  )
  glyphs = render.load_glyphs(config.font_dir, config.font_height, config.text_color)
  frame = Image.new("RGBA", (config.width, config.height), config.background)
  for placement in render.layout_text(config, glyphs):
    frame.alpha_composite(placement.image, (placement.x, placement.y))
  return frame


def main() -> None:
  if len(sys.argv) < 4:
    fail("usage: check_rendered_frames.py <font-dir> <frames-root> [--frame-prefix prefix] [--text-position top|center|bottom] [--bottom-margin px] [--letter-height px] <line> [<line> ...]")
  font_dir = Path(sys.argv[1])
  frames_root = Path(sys.argv[2])
  vertical_position = "top"
  bottom_margin = 20
  letter_height = 24
  frame_prefix = "line"
  expected_lines = []
  index = 3
  while index < len(sys.argv):
    if sys.argv[index] == "--frame-prefix":
      frame_prefix = sys.argv[index + 1]
      index += 2
      continue
    if sys.argv[index] == "--text-position":
      vertical_position = sys.argv[index + 1]
      index += 2
      continue
    if sys.argv[index] == "--bottom-margin":
      bottom_margin = int(sys.argv[index + 1])
      index += 2
      continue
    if sys.argv[index] == "--letter-height":
      letter_height = int(sys.argv[index + 1])
      index += 2
      continue
    expected_lines.append(sys.argv[index])
    index += 1
  if not expected_lines:
    fail("no expected lines provided")

  for index, line in enumerate(expected_lines, start=1):
    frame_path = frames_root / f"{frame_prefix}-{index:03d}" / "frame_000000.png"
    if not frame_path.exists() and len(expected_lines) == 1:
      frame_path = frames_root / "frame_000000.png"
    if not frame_path.exists():
      fail(f"missing rendered frame: {frame_path}")
    actual = Image.open(frame_path).convert("RGBA")
    expected = expected_frame(line, font_dir, vertical_position, bottom_margin, letter_height)
    if actual.tobytes() != expected.tobytes():
      expected_path = frame_path.with_name("expected-frame_000000.png")
      expected.save(expected_path)
      fail(f"rendered frame does not match line {index}: {line!r}; inspect {frame_path} and {expected_path}")
    print(f"PASS rendered frame line {index}: {line}")


if __name__ == "__main__":
  main()
