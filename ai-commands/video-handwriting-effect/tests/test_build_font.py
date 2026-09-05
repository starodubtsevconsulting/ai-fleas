#!/usr/bin/env python3
"""Regression tests for handwriting font label extraction."""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
from importlib.machinery import SourceFileLoader
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
build_font = SourceFileLoader("build_font", str(ROOT / "build_font.py")).load_module()
render = SourceFileLoader("render", str(ROOT / "render.py")).load_module()

SAMPLE_DIR = ROOT / "samples" / "font-1"
TEXT_FILE = ROOT / "samples" / "text" / "lyrics-1.txt"
TEST_ROOT = ROOT / "output" / "test"
TEST_FONTS = TEST_ROOT / "fonts"
FONT_NAME = "font-1-test"

LYRICS_REQUIRED = set("A a B b C c d e F f g H h I i J K k l M m N n O o p r s T t u v W w y è — ’".split())


def fail(message: str) -> None:
  raise AssertionError(message)


def sample_paths() -> list[Path]:
  return build_font.resolve_sample_paths(SAMPLE_DIR)


def label_data() -> tuple[dict[Path, list[list[str]]], dict[Path, dict[str, str]]]:
  labels, options = build_font.load_per_sample_labels(sample_paths())
  return labels, options


def detection_counts(sample: Path, options: dict[str, str]) -> list[int]:
  threshold = int(options["threshold"]) if "threshold" in options else None
  image, mask = build_font.load_ink_mask(sample, threshold)
  line_gap = int(options.get("line-gap", 24))
  glyph_gap = int(options.get("glyph-gap", 18))
  min_row_ink = int(options.get("min-row-ink", 12))
  min_col_ink = int(options.get("min-col-ink", 2))
  lines = build_font.find_bands(build_font.row_counts(mask), min_row_ink, line_gap)
  counts: list[int] = []
  for line in lines:
    expanded = build_font.expand_band(line, 8, image.height)
    glyphs = build_font.find_bands(build_font.column_counts(mask, expanded), min_col_ink, glyph_gap)
    counts.append(len(glyphs))
  return counts


def test_every_png_has_matching_label_file() -> None:
  missing = [str(path.with_name(f"{path.stem}-label.txt")) for path in sample_paths() if not build_font.sample_labels_path(path)]
  if missing:
    fail(f"missing per-PNG label file(s): {missing}")


def test_glyph_file_names_use_portable_codepoints() -> None:
  expected = {
    "A": "glyph-u0041.png",
    "a": "glyph-u0061.png",
    "À": "glyph-u00c0.png",
    "à": "glyph-u00e0.png",
    "e\u0301": "glyph-u0065-u0301.png",
    "—": "glyph-u2014.png",
  }
  actual = {label: build_font.glyph_file_name(label) for label in expected}
  if actual != expected:
    fail(f"unexpected portable glyph names: {actual}")
  folded = [name.casefold() for name in actual.values()]
  if len(folded) != len(set(folded)):
    fail(f"portable glyph names collide when case-folded: {actual}")


def test_label_files_match_detected_lines() -> None:
  labels_by_sample, options_by_sample = label_data()
  for sample in sample_paths():
    labels = labels_by_sample[sample]
    options = options_by_sample.get(sample, {})
    label_counts = [len(line) for line in labels]
    detected = detection_counts(sample, options)
    if detected[:len(label_counts)] != label_counts:
      fail(f"{sample.name} detected counts {detected} do not match label counts {label_counts}")
    extra = detected[len(label_counts):]
    if extra:
      fail(f"{sample.name} has unexpected extra detected line(s): {extra}")


def build_test_font() -> dict[str, object]:
  if TEST_ROOT.exists():
    shutil.rmtree(TEST_ROOT)
  TEST_FONTS.mkdir(parents=True, exist_ok=True)
  labels_by_sample, options_by_sample = label_data()
  config = build_font.BuildConfig(
    sample=SAMPLE_DIR,
    output=TEST_FONTS,
    font_name=FONT_NAME,
    threshold=None,
    line_gap=24,
    glyph_gap=18,
    padding=8,
    min_row_ink=12,
    min_col_ink=2,
    line_labels=[],
    per_sample_labels=labels_by_sample,
    per_sample_options=options_by_sample,
    clean=True,
  )
  return build_font.build_font(config)


def test_build_manifest_from_sample_labels() -> None:
  manifest = build_test_font()
  glyphs = manifest["glyphs"]
  labels_by_sample, _ = label_data()
  expected_unique = {label for labels in labels_by_sample.values() for line in labels for label in line}
  missing = sorted(expected_unique - set(glyphs), key=lambda value: (value.casefold(), value))
  if missing:
    fail(f"labeled glyphs missing from manifest: {missing}")

  manifest_path = TEST_FONTS / FONT_NAME / "manifest.json"
  loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
  if set(loaded["glyphs"]) != set(glyphs):
    fail("manifest on disk does not match built glyph set")
  file_names = [str(entry["file"]) for entry in glyphs.values()]
  expected_files = [build_font.glyph_file_name(label) for label in glyphs]
  if sorted(file_names) != sorted(expected_files):
    fail("manifest glyph files do not use portable codepoint names")
  folded_names = [name.casefold() for name in file_names]
  if len(folded_names) != len(set(folded_names)):
    fail("manifest glyph files collide on a case-insensitive filesystem")
  missing_files = [name for name in file_names if not (TEST_FONTS / FONT_NAME / name).is_file()]
  if missing_files:
    fail(f"manifest references missing portable glyph files: {missing_files}")


def test_missing_per_png_label_file_fails() -> None:
  with tempfile.TemporaryDirectory(dir=TEST_ROOT) as tmp:
    tmp_dir = Path(tmp)
    sample_dir = tmp_dir / "sample"
    sample_dir.mkdir()
    first_sample = sample_paths()[0]
    shutil.copy2(first_sample, sample_dir / first_sample.name)
    config = build_font.BuildConfig(
      sample=sample_dir,
      output=TEST_FONTS,
      font_name="missing-label-test",
      threshold=None,
      line_gap=24,
      glyph_gap=18,
      padding=8,
      min_row_ink=12,
      min_col_ink=2,
      line_labels=[],
      per_sample_labels={},
      per_sample_options={},
      clean=True,
    )
    try:
      build_font.build_font(config)
    except RuntimeError as error:
      if "Missing label file" not in str(error):
        fail(f"wrong missing-label error: {error}")
    else:
      fail("build succeeded without required per-PNG label file")


def write_glyph_atlas(glyphs: dict[str, dict[str, object]], font_dir: Path) -> Path:
  debug_dir = TEST_ROOT / "glyph-debug"
  debug_dir.mkdir(parents=True, exist_ok=True)
  labels = sorted(glyphs, key=lambda value: (str(glyphs[value].get("sample", "")), str(glyphs[value].get("line", 0)), value.casefold(), value))
  cell_w = 170
  cell_h = 135
  cols = 6
  rows = (len(labels) + cols - 1) // cols
  atlas = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
  draw = ImageDraw.Draw(atlas)
  for index, label in enumerate(labels):
    entry = glyphs[label]
    glyph = ImageOps.grayscale(Image.open(font_dir / str(entry["file"])))
    col = index % cols
    row = index // cols
    x0 = col * cell_w
    y0 = row * cell_h
    draw.rectangle((x0, y0, x0 + cell_w - 1, y0 + cell_h - 1), outline="gray")
    draw.text((x0 + 4, y0 + 4), f"{label} {entry.get('width')}x{entry.get('height')}", fill="black")
    scale = min((cell_w - 16) / max(1, glyph.width), (cell_h - 34) / max(1, glyph.height), 1.0)
    glyph = glyph.resize((max(1, int(glyph.width * scale)), max(1, int(glyph.height * scale))))
    atlas.paste(ImageOps.colorize(glyph, "black", "white"), (x0 + 8, y0 + 28))
  atlas_path = debug_dir / "atlas.png"
  atlas.save(atlas_path)
  return atlas_path


def test_suspicious_glyph_dimensions_fail_fast() -> None:
  manifest_path = TEST_FONTS / FONT_NAME / "manifest.json"
  if not manifest_path.exists():
    test_build_manifest_from_sample_labels()
  manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
  glyphs = manifest["glyphs"]
  font_dir = TEST_FONTS / FONT_NAME
  atlas_path = write_glyph_atlas(glyphs, font_dir)

  suspicious: list[str] = []
  for group in ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"]:
    present = [glyphs[ch] for ch in group if ch in glyphs]
    if not present:
      continue
    widths = sorted(int(entry["width"]) for entry in present)
    median_width = widths[len(widths) // 2]
    for ch in group:
      entry = glyphs.get(ch)
      if not entry:
        continue
      width = int(entry["width"])
      height = int(entry["height"])
      ratio = width / max(1, height)
      if width > median_width * 2.6 or ratio > 2.2:
        suspicious.append(f"{ch}: {width}x{height} ratio={ratio:.2f}")
  if suspicious:
    fail("suspicious glyph crop(s): " + ", ".join(suspicious) + f". Inspect {atlas_path}")




def glyph_alpha_coverage(path: Path) -> float:
  alpha = Image.open(path).convert("RGBA").getchannel("A")
  bbox = alpha.getbbox()
  if bbox is None:
    return 0.0
  crop = alpha.crop(bbox)
  area = crop.width * crop.height
  return sum(crop.getdata()) / 255 / area

def glyph_edge_ink(path: Path) -> set[str]:
  alpha = Image.open(path).convert("RGBA").getchannel("A")
  width, height = alpha.size
  pixels = alpha.load()
  edges: set[str] = set()
  if any(pixels[0, y] for y in range(height)):
    edges.add("left")
  if any(pixels[width - 1, y] for y in range(height)):
    edges.add("right")
  if any(pixels[x, 0] for x in range(width)):
    edges.add("top")
  if any(pixels[x, height - 1] for x in range(width)):
    edges.add("bottom")
  return edges


def test_alphabetic_glyphs_do_not_touch_crop_edges() -> None:
  manifest_path = TEST_FONTS / FONT_NAME / "manifest.json"
  if not manifest_path.exists():
    test_build_manifest_from_sample_labels()
  manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
  glyphs = manifest["glyphs"]
  font_dir = TEST_FONTS / FONT_NAME

  clipped: list[str] = []
  for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz":
    entry = glyphs.get(ch)
    if not entry:
      continue
    edge_ink = glyph_edge_ink(font_dir / str(entry["file"]))
    if edge_ink:
      clipped.append(f"{ch}: {','.join(sorted(edge_ink))}")
  if clipped:
    fail("alphabetic glyph crop touches image edge: " + ", ".join(clipped))



def test_alphabetic_glyph_stroke_weight_is_consistent() -> None:
  manifest_path = TEST_FONTS / FONT_NAME / "manifest.json"
  if not manifest_path.exists():
    test_build_manifest_from_sample_labels()
  manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
  glyphs = manifest["glyphs"]
  font_dir = TEST_FONTS / FONT_NAME

  coverages: dict[str, float] = {}
  for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz":
    entry = glyphs.get(ch)
    if not entry:
      continue
    coverages[ch] = glyph_alpha_coverage(font_dir / str(entry["file"]))

  heavy = {ch: value for ch, value in coverages.items() if value > 0.24}
  if heavy:
    details = ", ".join(f"{ch}={value:.3f}" for ch, value in sorted(heavy.items()))
    fail(f"alphabetic glyph stroke coverage too heavy: {details}")

  called_out = "hTMy"
  called_out_heavy = {ch: coverages[ch] for ch in called_out if ch in coverages and coverages[ch] > 0.24}
  if called_out_heavy:
    details = ", ".join(f"{ch}={value:.3f}" for ch, value in sorted(called_out_heavy.items()))
    fail(f"reported bold glyphs are still too heavy: {details}")


def test_render_preserves_relative_glyph_heights() -> None:
  manifest_path = TEST_FONTS / FONT_NAME / "manifest.json"
  if not manifest_path.exists():
    test_build_manifest_from_sample_labels()
  glyphs = render.load_glyphs(TEST_FONTS / FONT_NAME, 80, (0, 0, 0, 255))
  upper_heights = [glyphs[ch].height for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if ch in glyphs]
  if not upper_heights:
    fail("no uppercase glyphs loaded for relative height test")
  upper_median = sorted(upper_heights)[len(upper_heights) // 2]
  for ch in "eoa":
    if ch not in glyphs:
      fail(f"missing lowercase glyph for relative height test: {ch}")
    ratio = glyphs[ch].height / upper_median
    if ratio > 0.72:
      fail(f"lowercase glyph {ch!r} rendered too tall relative to uppercase: ratio={ratio:.2f}")


def test_short_lowercase_glyphs_keep_baseline_position() -> None:
  manifest_path = TEST_FONTS / FONT_NAME / "manifest.json"
  if not manifest_path.exists():
    test_build_manifest_from_sample_labels()

  config = render.RenderConfig(
    text="to aver s",
    font_dir=TEST_FONTS / FONT_NAME,
    frames_dir=TEST_ROOT / "baseline-validation",
    width=900,
    height=260,
    font_height=80,
    line_spacing=100,
    left_margin=24,
    right_margin=24,
    top_margin=24,
    bottom_margin=24,
    max_line_width=840,
    horizontal_position="left",
    vertical_position="top",
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
  placements = render.layout_text(config, glyphs)
  by_char = {character: placement for character, placement in zip([ch for ch in config.text if ch != " "], placements)}

  t_top = by_char["t"].y
  for ch in "oaevrs":
    if by_char[ch].y <= t_top:
      fail(f"glyph {ch!r} top-aligned with tall glyph t; y={by_char[ch].y}, t_y={t_top}")

  baseline_bottoms = [placement.y + placement.height for placement in by_char.values()]
  if max(baseline_bottoms) - min(baseline_bottoms) > 18:
    fail(f"glyph baselines drift too far: bottoms={baseline_bottoms}")


def ink_mass(image: Image.Image, box: tuple[int, int, int, int]) -> float:
  crop = image.crop(box).convert("RGBA")
  return sum(crop.getchannel("A").getdata()) / 255


def test_reveal_style_controls_partial_glyph_rendering() -> None:
  glyph = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
  draw = ImageDraw.Draw(glyph)
  draw.rectangle((2, 2, 17, 17), outline=(0, 0, 0, 255), width=2)
  placement = render.GlyphPlacement(render.GlyphBitmap(glyph, 0), 0, 0)
  base = render.RenderConfig(
    text="",
    font_dir=TEST_FONTS / FONT_NAME,
    frames_dir=TEST_ROOT / "reveal-style-validation",
    width=20,
    height=20,
    font_height=20,
    line_spacing=20,
    left_margin=0,
    right_margin=0,
    top_margin=0,
    bottom_margin=0,
    max_line_width=20,
    horizontal_position="left",
    vertical_position="top",
    fps=1,
    draw_seconds=1,
    hold_seconds=0,
    background=(0, 0, 0, 0),
    text_color=(0, 0, 0, 255),
    tail_symbols=0,
    clean=True,
    check_glyphs=False,
  )

  crop_config = render.RenderConfig(**{**base.__dict__, "reveal_style": "crop"})
  stroke_config = render.RenderConfig(**{**base.__dict__, "reveal_style": "stroke"})
  crop_frame = render.draw_progress(crop_config, [placement], 0.5)
  stroke_frame = render.draw_progress(stroke_config, [placement], 0.5)

  expected_crop = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
  expected_crop.alpha_composite(glyph.crop((0, 0, 10, 20)), (0, 0))
  if crop_frame.tobytes() != expected_crop.tobytes():
    fail("crop reveal style no longer matches the legacy rectangular partial glyph reveal")
  if stroke_frame.tobytes() == expected_crop.tobytes():
    fail("stroke reveal style still renders as a rectangular crop")
  if sum(stroke_frame.getchannel("A").getdata()) == 0:
    fail("stroke reveal style produced no visible partial glyph ink")


def test_center_alignment_uses_final_line_width() -> None:
  manifest_path = TEST_FONTS / FONT_NAME / "manifest.json"
  if not manifest_path.exists():
    test_build_manifest_from_sample_labels()

  config = render.RenderConfig(
    text="When I have Fears",
    font_dir=TEST_FONTS / FONT_NAME,
    frames_dir=TEST_ROOT / "center-line-validation",
    width=900,
    height=260,
    font_height=80,
    line_spacing=100,
    left_margin=24,
    right_margin=24,
    top_margin=24,
    bottom_margin=24,
    max_line_width=840,
    horizontal_position="center",
    vertical_position="bottom",
    fps=1,
    draw_seconds=1,
    hold_seconds=0,
    background=(255, 255, 255, 0),
    text_color=(0, 0, 0, 255),
    tail_symbols=20,
    clean=True,
    check_glyphs=False,
  )
  glyphs = render.load_glyphs(config.font_dir, config.font_height, config.text_color)
  placements = render.layout_text(config, glyphs)
  left = min(placement.x for placement in placements)
  right = max(placement.x + placement.width for placement in placements)
  center = (left + right) / 2
  available_center = config.left_margin + (config.width - config.left_margin - config.right_margin) / 2
  if abs(center - available_center) > 4:
    fail(f"center alignment used current reveal instead of final line width: line center={center:.1f}, expected={available_center:.1f}")

def test_tail_symbols_fades_old_glyphs() -> None:
  manifest_path = TEST_FONTS / FONT_NAME / "manifest.json"
  if not manifest_path.exists():
    test_build_manifest_from_sample_labels()

  base = render.RenderConfig(
    text="abcdef",
    font_dir=TEST_FONTS / FONT_NAME,
    frames_dir=TEST_ROOT / "tail-validation",
    width=900,
    height=260,
    font_height=80,
    line_spacing=100,
    left_margin=24,
    right_margin=24,
    top_margin=24,
    bottom_margin=24,
    max_line_width=840,
    horizontal_position="left",
    vertical_position="top",
    fps=1,
    draw_seconds=1,
    hold_seconds=0,
    background=(255, 255, 255, 0),
    text_color=(0, 0, 0, 255),
    tail_symbols=0,
    clean=True,
    check_glyphs=False,
  )
  tail = render.RenderConfig(**{**base.__dict__, "tail_symbols": 3})
  glyphs = render.load_glyphs(base.font_dir, base.font_height, base.text_color)
  placements = render.layout_text(base, glyphs)
  normal = render.draw_progress(base, placements, 1.0)
  faded = render.draw_progress(tail, placements, 1.0)

  first = placements[0]
  last = placements[-1]
  first_box = (first.x, first.y, first.x + first.width, first.y + first.height)
  last_box = (last.x, last.y, last.x + last.width, last.y + last.height)
  if ink_mass(faded, first_box) > ink_mass(normal, first_box) * 0.05:
    fail("tail fade left the oldest glyph visible")
  if ink_mass(faded, last_box) < ink_mass(normal, last_box) * 0.95:
    fail("tail fade dimmed the newest glyph")

def test_tail_symbols_render_outro_until_blank() -> None:
  manifest_path = TEST_FONTS / FONT_NAME / "manifest.json"
  if not manifest_path.exists():
    test_build_manifest_from_sample_labels()

  frames_dir = TEST_ROOT / "tail-outro-validation"
  config = render.RenderConfig(
    text="abcdef",
    font_dir=TEST_FONTS / FONT_NAME,
    frames_dir=frames_dir,
    width=900,
    height=260,
    font_height=80,
    line_spacing=100,
    left_margin=24,
    right_margin=24,
    top_margin=24,
    bottom_margin=24,
    max_line_width=840,
    horizontal_position="left",
    vertical_position="top",
    fps=6,
    draw_seconds=1,
    hold_seconds=0,
    background=(255, 255, 255, 0),
    text_color=(0, 0, 0, 255),
    tail_symbols=3,
    clean=True,
    check_glyphs=False,
  )
  frame_count = render.render_frames(config)
  glyphs = render.load_glyphs(config.font_dir, config.font_height, config.text_color)
  placements = render.layout_text(config, glyphs)
  drawing_frames = round(config.draw_seconds * config.fps)
  expected_count = drawing_frames + render.tail_fade_out_frames(config, placements, drawing_frames)
  if frame_count != expected_count:
    fail(f"expected tail outro frames in render count: got {frame_count}, expected {expected_count}")

  final_frame = Image.open(frames_dir / f"frame_{frame_count - 1:06d}.png").convert("RGBA")
  final_alpha = sum(final_frame.getchannel("A").getdata())
  if final_alpha != 0:
    fail("tail fade outro did not end on a blank transparent frame")

def test_final_frame_matches_expected_line_pixels() -> None:
  if not (TEST_FONTS / FONT_NAME / "manifest.json").exists():
    test_build_manifest_from_sample_labels()

  frames_dir = TEST_ROOT / "frame-validation"
  if frames_dir.exists():
    shutil.rmtree(frames_dir)

  text = "When I have Fears\nWhat I May Cease to\nBe"
  config = render.RenderConfig(
    text=text,
    font_dir=TEST_FONTS / FONT_NAME,
    frames_dir=frames_dir,
    width=900,
    height=260,
    font_height=36,
    line_spacing=58,
    left_margin=24,
    right_margin=24,
    top_margin=24,
    bottom_margin=24,
    max_line_width=840,
    horizontal_position="left",
    vertical_position="top",
    fps=1,
    draw_seconds=1,
    hold_seconds=0,
    background=(255, 255, 255, 255),
    text_color=(0, 0, 0, 255),
    tail_symbols=0,
    clean=True,
    check_glyphs=False,
  )
  frame_count = render.render_frames(config)
  if frame_count != 1:
    fail(f"expected one validation frame, rendered {frame_count}")

  glyphs = render.load_glyphs(config.font_dir, config.font_height, config.text_color)
  expected = Image.new("RGBA", (config.width, config.height), config.background)
  for placement in render.layout_text(config, glyphs):
    expected.alpha_composite(placement.image, (placement.x, placement.y))

  actual_path = frames_dir / "frame_000000.png"
  actual = Image.open(actual_path).convert("RGBA")
  if actual.tobytes() != expected.tobytes():
    diff_path = frames_dir / "expected-final-frame.png"
    expected.save(diff_path)
    fail(f"final frame pixels do not match expected text layout; inspect {actual_path} and {diff_path}")

  ink_bbox = actual.getbbox()
  if ink_bbox is None:
    fail("final frame has no visible pixels")

def test_lyrics_glyph_coverage_when_complete() -> None:
  manifest_path = TEST_FONTS / FONT_NAME / "manifest.json"
  if not manifest_path.exists():
    test_build_manifest_from_sample_labels()
  manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
  glyphs = set(manifest["glyphs"])
  missing_required = sorted(LYRICS_REQUIRED - glyphs, key=lambda value: (value.casefold(), value))
  if missing_required:
    print(f"SKIP full lyrics coverage; missing sample pages for: {' '.join(missing_required)}")
    return

  text = TEXT_FILE.read_text(encoding="utf-8")
  ignored = {" ", "\n", "\t", "\r"}
  aliases = {"’": "’", "‘": "’", "“": "\"", "”": "\"", "—": "—", "–": "–"}
  missing = sorted({character for character in text if character not in ignored and aliases.get(character, character) not in glyphs})
  if missing:
    fail(f"lyrics text has missing glyphs in test manifest: {missing}")


def main() -> None:
  tests = [
    test_every_png_has_matching_label_file,
    test_glyph_file_names_use_portable_codepoints,
    test_label_files_match_detected_lines,
    test_build_manifest_from_sample_labels,
    test_missing_per_png_label_file_fails,
    test_suspicious_glyph_dimensions_fail_fast,
    test_alphabetic_glyphs_do_not_touch_crop_edges,
    test_alphabetic_glyph_stroke_weight_is_consistent,
    test_render_preserves_relative_glyph_heights,
    test_short_lowercase_glyphs_keep_baseline_position,
    test_reveal_style_controls_partial_glyph_rendering,
    test_center_alignment_uses_final_line_width,
    test_tail_symbols_fades_old_glyphs,
    test_tail_symbols_render_outro_until_blank,
    test_final_frame_matches_expected_line_pixels,
    test_lyrics_glyph_coverage_when_complete,
  ]
  for test in tests:
    test()
    print(f"PASS {test.__name__}")


if __name__ == "__main__":
  try:
    main()
  except Exception as error:
    print(f"FAIL {error}", file=sys.stderr)
    raise
