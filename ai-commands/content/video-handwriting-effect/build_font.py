#!/usr/bin/env python3
"""Build a PNG glyph font from a handwriting sample sheet."""

from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps


DEFAULT_SAMPLE = Path("samples/font-1")
DEFAULT_OUTPUT = Path("fonts")
DEFAULT_FONT_NAME = None
DEFAULT_LINE_GAP = 24
@dataclass(frozen=True)
class Band:
  start: int
  end: int

  @property
  def size(self) -> int:
    return self.end - self.start


@dataclass(frozen=True)
class BuildConfig:
  sample: Path
  output: Path
  font_name: str | None
  threshold: int | None
  line_gap: int
  glyph_gap: int
  padding: int
  min_row_ink: int
  min_col_ink: int
  line_labels: list[list[str]]
  per_sample_labels: dict[Path, list[list[str]]]
  per_sample_options: dict[Path, dict[str, str]]
  clean: bool


def parse_label_line(value: str) -> list[str]:
  return value.split()


def read_labels_file(path: Path) -> tuple[list[list[str]], dict[str, str]]:
  labels: list[list[str]] = []
  options: dict[str, str] = {}

  for raw_line in path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line:
      continue
    if line.startswith("#"):
      setting = line[1:].strip()
      if ":" in setting:
        key, value = setting.split(":", 1)
        options[key.strip()] = value.strip()
      continue
    labels.append(parse_label_line(line))

  if not labels:
    raise RuntimeError(f"No label lines found in: {path}")
  return labels, options


def sample_labels_path(sample_path: Path) -> Path | None:
  candidates = [
    sample_path.with_name(f"{sample_path.stem}-label.txt"),
  ]
  for candidate in candidates:
    if candidate.exists():
      return candidate
  return None


def load_per_sample_labels(sample_paths: list[Path]) -> tuple[dict[Path, list[list[str]]], dict[Path, dict[str, str]]]:
  per_sample: dict[Path, list[list[str]]] = {}
  per_sample_options: dict[Path, dict[str, str]] = {}

  for sample_path in sample_paths:
    labels_path = sample_labels_path(sample_path)
    if not labels_path:
      continue
    labels, label_options = read_labels_file(labels_path)
    per_sample[sample_path] = labels
    per_sample_options[sample_path] = label_options

  return per_sample, per_sample_options


def glyph_file_name(label: str) -> str:
  if not label:
    raise ValueError("Glyph label cannot be empty")
  codepoints = "-".join(f"u{ord(character):04x}" for character in label)
  return f"glyph-{codepoints}.png"


def resolve_sample_paths(sample: Path) -> list[Path]:
  if sample.is_dir():
    paths = sorted(
      path for path in sample.iterdir()
      if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )
    if not paths:
      raise FileNotFoundError(f"No sample images found in directory: {sample}")
    return paths

  if not sample.exists():
    raise FileNotFoundError(f"Sample image not found: {sample}")

  return [sample]


def auto_threshold(image: Image.Image) -> int:
  histogram = image.histogram()
  total = sum(histogram)
  weighted_sum = sum(index * count for index, count in enumerate(histogram))
  background_weight = 0
  background_sum = 0
  best_threshold = 127
  best_variance = -1.0

  for threshold, count in enumerate(histogram):
    background_weight += count
    if background_weight == 0:
      continue

    foreground_weight = total - background_weight
    if foreground_weight == 0:
      break

    background_sum += threshold * count
    background_mean = background_sum / background_weight
    foreground_mean = (weighted_sum - background_sum) / foreground_weight
    variance = background_weight * foreground_weight * (background_mean - foreground_mean) ** 2

    if variance > best_variance:
      best_variance = variance
      best_threshold = threshold

  return best_threshold


def load_ink_mask(sample: Path, threshold: int | None) -> tuple[Image.Image, list[list[bool]]]:
  if not sample.exists():
    raise FileNotFoundError(f"Sample image not found: {sample}")

  grayscale = ImageOps.grayscale(Image.open(sample))
  effective_threshold = auto_threshold(grayscale) if threshold is None else threshold
  pixels = grayscale.load()
  width, height = grayscale.size
  mask = [
    [pixels[x, y] <= effective_threshold for x in range(width)]
    for y in range(height)
  ]
  return grayscale, mask


def find_bands(counts: Iterable[int], minimum: int, gap: int) -> list[Band]:
  bands: list[Band] = []
  start: int | None = None
  last_ink: int | None = None

  for index, count in enumerate(counts):
    if count >= minimum:
      if start is None:
        start = index
      last_ink = index
      continue

    if start is not None and last_ink is not None and index - last_ink > gap:
      bands.append(Band(start, last_ink + 1))
      start = None
      last_ink = None

  if start is not None and last_ink is not None:
    bands.append(Band(start, last_ink + 1))

  return bands


def expand_band(band: Band, padding: int, limit: int) -> Band:
  return Band(max(0, band.start - padding), min(limit, band.end + padding))


def row_counts(mask: list[list[bool]]) -> list[int]:
  return [sum(row) for row in mask]


def column_counts(mask: list[list[bool]], line: Band) -> list[int]:
  width = len(mask[0])
  return [sum(mask[y][x] for y in range(line.start, line.end)) for x in range(width)]


def crop_to_ink(image: Image.Image, mask: list[list[bool]], x_band: Band, y_band: Band, padding: int) -> tuple[Image.Image, int]:
  xs: list[int] = []
  ys: list[int] = []
  for y in range(y_band.start, y_band.end):
    for x in range(x_band.start, x_band.end):
      if mask[y][x]:
        xs.append(x)
        ys.append(y)

  if not xs or not ys:
    return image.crop((x_band.start, y_band.start, x_band.end, y_band.end)), 0

  left = max(0, min(xs) - padding)
  top = max(0, min(ys) - padding)
  right = min(image.width, max(xs) + padding + 1)
  bottom = min(image.height, max(ys) + padding + 1)
  return image.crop((left, top, right, bottom)), max(0, top - y_band.start)


def alpha_coverage(image: Image.Image) -> float:
  alpha = image.getchannel("A")
  bbox = alpha.getbbox()
  if bbox is None:
    return 0.0

  crop = alpha.crop(bbox)
  area = crop.width * crop.height
  if area == 0:
    return 0.0

  return sum(crop.getdata()) / 255 / area


def normalize_stroke_weight(image: Image.Image, maximum_coverage: float = 0.23) -> Image.Image:
  coverage = alpha_coverage(image)
  if coverage <= maximum_coverage or coverage == 0:
    return image

  scale = maximum_coverage / coverage
  normalized = image.copy()
  alpha = normalized.getchannel("A").point(lambda value: max(0, min(255, round(value * scale))))
  normalized.putalpha(alpha)
  return normalized


def save_transparent_glyph(glyph: Image.Image, target: Path, threshold: int | None) -> None:
  grayscale = ImageOps.grayscale(glyph)
  effective_threshold = auto_threshold(grayscale) if threshold is None else threshold
  rgba = Image.new("RGBA", glyph.size, (0, 0, 0, 0))
  source = grayscale.load()
  dest = rgba.load()

  for y in range(glyph.height):
    for x in range(glyph.width):
      value = source[x, y]
      if value <= effective_threshold:
        alpha = 255 - value
        dest[x, y] = (0, 0, 0, max(48, alpha))

  target.parent.mkdir(parents=True, exist_ok=True)
  normalize_stroke_weight(rgba).save(target)


def build_font(config: BuildConfig) -> dict[str, object]:
  sample_paths = resolve_sample_paths(config.sample)
  font_name = config.font_name or (config.sample.name if config.sample.is_dir() else config.sample.stem)
  font_dir = config.output / font_name
  build_dir = font_dir.with_name(f".{font_dir.name}.building") if config.clean else font_dir
  if config.clean and build_dir.exists():
    shutil.rmtree(build_dir)
  build_dir.mkdir(parents=True, exist_ok=True)

  manifest: dict[str, object] = {
    "sample": str(config.sample),
    "samples": [str(path) for path in sample_paths],
    "font_name": font_name,
    "font_dir": str(font_dir),
    "glyphs": {},
  }
  glyphs: dict[str, dict[str, object]] = {}
  label_index = 0
  fallback_label_count = len(config.line_labels)

  for sample_path in sample_paths:
    sample_labels = config.per_sample_labels.get(sample_path)
    if sample_labels is None and not config.line_labels:
      raise RuntimeError(f"Missing label file for sample image: {sample_path.with_name(f'{sample_path.stem}-label.txt')}")
    if sample_labels is None and label_index >= fallback_label_count:
      break

    sample_options = config.per_sample_options.get(sample_path, {})
    line_gap = int(sample_options.get("line-gap", config.line_gap))
    glyph_gap = int(sample_options.get("glyph-gap", config.glyph_gap))
    min_row_ink = int(sample_options.get("min-row-ink", config.min_row_ink))
    min_col_ink = int(sample_options.get("min-col-ink", config.min_col_ink))
    sample_threshold = int(sample_options["threshold"]) if "threshold" in sample_options else config.threshold

    image, mask = load_ink_mask(sample_path, sample_threshold)
    lines = find_bands(row_counts(mask), min_row_ink, line_gap)

    for page_line_index, detected_line in enumerate(lines):
      if sample_labels is not None:
        if page_line_index >= len(sample_labels):
          break
        labels = sample_labels[page_line_index]
      else:
        if label_index >= fallback_label_count:
          break
        labels = config.line_labels[label_index]
      line = expand_band(detected_line, config.padding, image.height)
      glyph_bands = find_bands(column_counts(mask, line), min_col_ink, glyph_gap)

      if len(glyph_bands) != len(labels):
        raise RuntimeError(
          f"{sample_path} line {page_line_index + 1} expected {len(labels)} glyphs "
          f"but found {len(glyph_bands)}. Tune --glyph-gap, --min-col-ink, or --labels."
        )

      for label, glyph_band in zip(labels, glyph_bands):
        x_band = expand_band(glyph_band, config.padding, image.width)
        glyph, y_offset = crop_to_ink(image, mask, x_band, line, config.padding)
        if "y-offset" in sample_options:
          y_offset = int(sample_options["y-offset"])
        file_name = glyph_file_name(label)
        target = build_dir / file_name
        save_transparent_glyph(glyph, target, config.threshold)
        glyphs[label] = {
          "file": file_name,
          "width": glyph.width,
          "height": glyph.height,
          "y_offset": y_offset,
          "line_height": line.size,
          "sample": str(sample_path),
          "line": page_line_index + 1,
        }

      if sample_labels is None:
        label_index += 1

    if sample_labels is not None and len(lines) < len(sample_labels):
      raise RuntimeError(
        f"Found {len(lines)} line(s) in {sample_path}, but {len(sample_labels)} label line(s) were configured."
      )

  if not config.per_sample_labels and label_index < len(config.line_labels):
    raise RuntimeError(
      f"Found {label_index} labeled line(s) across {len(sample_paths)} sample image(s), "
      f"but {len(config.line_labels)} label line(s) were configured."
    )

  manifest["glyphs"] = glyphs
  (build_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

  if config.clean:
    if font_dir.exists():
      shutil.rmtree(font_dir)
    build_dir.rename(font_dir)

  return manifest


def parse_args() -> BuildConfig:
  parser = argparse.ArgumentParser(description="Build a PNG handwriting font from a sample sheet.")
  parser.add_argument("--sample", type=Path, default=DEFAULT_SAMPLE, help="Input sample PNG or directory of sample images.")
  parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output fonts directory.")
  parser.add_argument("--font-name", default=DEFAULT_FONT_NAME, help="Font name. Defaults to the sample file stem or sample directory name and writes to fonts/<name>/.")
  parser.add_argument("--threshold", type=int, default=None, help="Foreground threshold. Defaults to Otsu auto-threshold.")
  parser.add_argument("--line-gap", type=int, default=None, help=f"Blank row gap that separates handwriting lines. Default: {DEFAULT_LINE_GAP}, or label file # line-gap when present.")
  parser.add_argument("--glyph-gap", type=int, default=18, help="Blank column gap that separates glyphs inside a line.")
  parser.add_argument("--padding", type=int, default=8, help="Pixels added around each glyph crop.")
  parser.add_argument("--min-row-ink", type=int, default=12, help="Minimum black pixels for a row to count as ink.")
  parser.add_argument("--min-col-ink", type=int, default=2, help="Minimum black pixels for a column to count as ink.")
  parser.add_argument("--labels", action="append", default=None, help="Space-separated glyph labels for one sample line. Repeat per line.")
  parser.add_argument("--labels-file", type=Path, default=None, help="Explicit combined label file for advanced use. Default automatic mapping requires per-image <stem>-label.txt files.")
  parser.add_argument("--keep", action="store_true", help="Keep existing files in the target font directory.")
  args = parser.parse_args()

  sample_paths = resolve_sample_paths(args.sample)
  labels_options: dict[str, str] = {}
  per_sample_labels: dict[Path, list[list[str]]] = {}
  per_sample_options: dict[Path, dict[str, str]] = {}
  if args.labels:
    labels = [parse_label_line(value) for value in args.labels]
  elif args.labels_file:
    labels, labels_options = read_labels_file(args.labels_file)
  else:
    per_sample_labels, per_sample_options = load_per_sample_labels(sample_paths)
    labels = []

  line_gap = args.line_gap
  if line_gap is None and "line-gap" in labels_options:
    line_gap = int(labels_options["line-gap"])
  if line_gap is None:
    line_gap = DEFAULT_LINE_GAP

  return BuildConfig(
    sample=args.sample,
    output=args.output,
    font_name=args.font_name,
    threshold=args.threshold,
    line_gap=line_gap,
    glyph_gap=args.glyph_gap,
    padding=args.padding,
    min_row_ink=args.min_row_ink,
    min_col_ink=args.min_col_ink,
    line_labels=labels,
    per_sample_labels=per_sample_labels,
    per_sample_options=per_sample_options,
    clean=not args.keep,
  )


def main() -> None:
  config = parse_args()
  manifest = build_font(config)
  print(f"Built {len(manifest['glyphs'])} glyphs in {manifest['font_dir']}")


if __name__ == "__main__":
  main()
