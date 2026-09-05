# lyrics-timestamp.command

## Tags

#command #ai-command #lyrics #timestamp #audio #subtitle #multimedia #handwriting-video

Map lyrics text to audio timestamps and write reusable timed-lyrics artifacts.

## Intent

Use this command when an audio file and lyrics file need a line-level timing map before another command renders video,
subtitles, or overlays.

The primary downstream consumer is `video-handwriting-effect`, but this command is intentionally separate so
timestamped lyrics can also be used by YouTube, subtitle, and music-video workflows.

## Usage

```bash
./lyrics-timestamp.command.sh map \
  --lyrics-file path/to/lyrics.txt \
  --audio-file path/to/song.mp3 \
  --dist path/to/output/
```

## UI Launcher

Run the visual Electron launcher from `lyrics-timestamp/`:

```bash
./app.sh
```

The launcher provides:

- lyrics file input
- audio file input
- optional timing hints JSON input
- output folder input
- run action that previews mapped results without writing output files
- save action that writes the previewed JSON/SRT files
- audio playback progress with waveform level strip for spotting spikes
- mapped lyric rows with editable start/end timestamp controls
- raw JSON and SRT result tabs

The reusable panel entry is `launcher/panel/index.html`. Standalone `app.sh` loads this same panel through Electron,
where `launcher/electron/preload.cjs` provides `window.lyricsTimestamp`. The main AI app can embed the same panel in an
iframe when it provides an equivalent browser bridge for the `window.lyricsTimestamp` API.

It uses this command's CLI as the source of truth. When `lyrics-timestamp.json` already exists in the output folder,
the launcher loads it automatically on open and disables `Run` to prevent accidental remapping over the saved file. The
Run action also has a domain guard that refuses to map when the output JSON already exists. `Run` previews newly mapped
results in memory; editable row timing controls let the user tune start/end values or sync them from the current
playback position; `Now` sync actions save immediately; `Save` writes the tuned `lyrics-timestamp.json` /
`lyrics-timestamp.srt` to disk.

When launched from the AI multimedia workflow command panel, the app receives the current workbench context. For a
selected video folder, it defaults:

- lyrics input from `lyrics/lyrics.md`
- audio input from the first audio file found under `audio/`
- output folder to the selected video's `lyrics/` folder

## Inputs

- `map`: create timestamped lyric artifacts and write files.
- `preview`: create timestamped lyric artifacts and return them on stdout without writing files.
- `--lyrics-file <path>`: plain text or Markdown lyrics.
- `--audio-file <path>`: `.wav`, `.mp3`, or any audio file readable by `ffprobe`.
- `--dist <path>`: output directory or `.json` output file.

Optional:

- `--line-mode non-empty`: map non-empty lyric lines. This is the default.
- `--format json,srt`: output formats. This is the default.
- `--tail-ms <number>`: extra duration added to each line end when possible. Default: `250`.
- `--timing-hints-file <path>`: optional JSON file with known line start/end anchors. Hints can target the filtered
lyric line by exact `text` or by 1-based `index`. Empty and punctuation-only lyric lines, such as `--`, are ignored
before indexes are assigned.

## Output

When `--dist` is a directory, the command writes:

```text
lyrics-timestamp.json
lyrics-timestamp.srt
```

JSON is the stable renderer contract:

```json
{
  "audioFile": "song.mp3",
  "lyricsFile": "lyrics.txt",
  "durationMs": 180000,
  "lineMode": "non-empty",
  "alignmentMethod": "proportional-duration",
  "timingHintsFile": "",
  "ignoredLineRule": "skip empty and punctuation-only lines",
  "lines": [
    {
      "index": 1,
      "startMs": 61000,
      "endMs": 64500,
      "text": "hello it is me",
      "confidence": 0.1
    }
  ]
}
```

SRT is generated as an inspection/subtitle companion.

## Timing Hints

Use a hints JSON file when you know true start/end timings for one or more lyric lines. The mapper anchors those lines
exactly and proportionally fills the unknown lines before, between, and after the anchors.

```json
{
  "lines": [
    {
      "text": "And watching, with eternal lids apart,",
      "start": "00:20.106",
      "end": "00:24.128"
    }
  ]
}
```

A top-level list is also accepted. Time values may be numeric milliseconds or `MM:SS.mmm` / `HH:MM:SS.mmm`.

## Current Mapping Strategy

Without timing hints, the command produces a deterministic line-level timing map by distributing speakable lyric lines
across the detected audio duration. It is a low-confidence baseline intended to establish the command contract and let
downstream rendering integrate with timed lyrics.

Later implementations should add forced alignment:

- transcribe or align audio with word timestamps
- normalize lyric tokens
- match lyric tokens to recognized word timestamps
- collapse word timing into lyric line ranges
- flag unmatched or low-confidence lines

## Integration With Handwriting Render

`video-handwriting-effect` should later consume this command's JSON with:

```bash
./video-handwriting-effect.command.sh \
  --text-file lyrics.txt \
  --timing-file path/to/lyrics-timestamp.json \
  --audio-file path/to/song.mp3 \
  --video-mode single
```

`video-handwriting-effect` remains responsible for rendering handwriting. `lyrics-timestamp` remains responsible for
discovering or generating the timing map.

## Tests

Run from this folder:

```bash
./test/test.sh
```

The smoke test uses a generated silent WAV and fixture lyrics, then runs the copied John Keats `Bright star`
lyrics/audio fixture to verify JSON and SRT output with real media.
