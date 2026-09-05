Use this spec for Codex:

````md
# Task: Parse `sample-text.txt` into structured JSON

## Goal

Read the text file `sample-text.txt` and convert it into machine-usable JSON with these sections:

- `recording_format`
- `pause_rules`
- `voices`
- `script`

## Input format

The file contains these major blocks in order:

1. Title line
   `WHISPER VOICE CONFIGURATION SCRIPT`

2. Purpose line
   Starts with `Purpose:`

3. `Recording format:` block
   Key-value pairs like:
   - `sample_rate: 16000`
   - `format: WAV`

4. `Pause rules:` block
   Key-value pairs like:
   - `Narrator pause: 600 ms`
   - `Dialogue pause: 400 ms`

5. `VOICE CONFIGURATION` block
   Repeated speaker definitions:
   - speaker name on its own line
   - then speaker attributes as key-value pairs:
     - `gender: ...`
     - `pitch: ...`
     - `speed: ...`
     - `accent: ...`
     - `tone: ...`

6. `Important:` note block
   Ignore for structured output, unless storing in `notes`

7. `SCRIPT` block
   Starts after:
   `------------------------------------`
   `SCRIPT`
   `------------------------------------`

8. Scene markers:
   - `SCENE_START`
   - `SCENE_END`

9. Spoken script lines:
   Speaker labels appear as:
   - `Narrator:`
   - `Maria:`
   - `Robert:`

   The content for that speaker continues until:
   - another speaker label
   - `SCENE_END`

## Required JSON output shape

```json
{
  "recording_format": {
    "sample_rate": 16000,
    "format": "WAV",
    "bit_depth": 16,
    "channels": "mono",
    "no_background_noise": true,
    "no_overlapping_speech": true
  },
  "pause_rules": {
    "narrator_pause_ms": 600,
    "dialogue_pause_ms": 400
  },
  "voices": {
    "Narrator": {
      "gender": "male",
      "pitch": "low (90–110 Hz)",
      "speed": "slow (0.85–0.9)",
      "accent": "neutral English",
      "tone": "calm / storytelling"
    },
    "Robert": {
      "gender": "male",
      "pitch": "medium (120–140 Hz)",
      "speed": "normal (1.0)",
      "accent": "neutral English",
      "tone": "deliberate / thoughtful"
    },
    "Maria": {
      "gender": "female",
      "pitch": "higher (200–230 Hz)",
      "speed": "slightly faster (1.05)",
      "accent": "mild Eastern European / Slavic",
      "tone": "warm / curious"
    }
  },
  "script": [
    {
      "type": "scene_marker",
      "value": "SCENE_START"
    },
    {
      "type": "line",
      "speaker": "Narrator",
      "text": "Two figures were sitting in the outdoor kitchen. A mesh hung in the doorway to keep the flies out. Even
after most of them had been chased outside, two flies still remained, flying in slow loops. The pair periodically
landed on the edge of the table, crawling closer to the board where the fish was laid out, which Robert was
methodically consuming."
    },
    {
      "type": "line",
      "speaker": "Maria",
      "text": "Do you like feesh?"
    },
    {
      "type": "line",
      "speaker": "Robert",
      "text": "Fish? I like the taste of the flesh."
    },
    {
      "type": "scene_marker",
      "value": "SCENE_END"
    }
  ]
}
```
````

## Parsing rules

### 1. General

- Trim leading and trailing whitespace on every line.
- Preserve original text wording.
- Join consecutive text lines belonging to the same speaker with spaces.
- Ignore decorative separator lines made of dashes.

### 2. Recording format

Map these lines:

- `sample_rate: 16000` → integer
- `format: WAV` → string
- `bit_depth: 16` → integer
- `channels: mono` → string
- `no background noise` → `no_background_noise: true`
- `no overlapping speech` → `no_overlapping_speech: true`

### 3. Pause rules

Map:

- `Narrator pause: 600 ms` → `narrator_pause_ms: 600`
- `Dialogue pause: 400 ms` → `dialogue_pause_ms: 400`

Extract integer milliseconds.

### 4. Voice configuration

Each voice starts with a standalone line equal to one of:

- `Narrator`
- `Robert`
- `Maria`

The following indented or plain key-value lines belong to that speaker until:

- next speaker name
- `Important:`
- next section header

### 5. Script parsing

Inside the script block:

- `SCENE_START` and `SCENE_END` become scene marker objects.
- A line exactly equal to `Narrator:` starts a narrator segment.
- Same for `Maria:` and `Robert:`.
- All following non-empty lines belong to that speaker until the next speaker label or scene marker.

### 6. Speaker normalization

Use exactly these speaker names in output:

- `Narrator`
- `Maria`
- `Robert`

### 7. Text normalization

For each script segment:

- join wrapped lines with a single space
- preserve punctuation
- preserve intentional spellings like:

  - `feesh`
  - `vot`
  - `vere`
  - `everysing`

### 8. Ignore these blocks unless optional

You may ignore:

- title line
- purpose line
- `Important:` example block

Optionally keep them under:

```json
{
  "meta": {
    "title": "...",
    "purpose": "...",
    "notes": ["..."]
  }
}
```

## Validation requirements

Reject or warn if:

- any of `Narrator`, `Maria`, `Robert` is missing in `voices`
- `SCENE_START` or `SCENE_END` is missing
- a speaker block in the script has empty text
- unknown speaker labels appear

## Output requirements

Return only valid JSON.
Do not rewrite the script.
Do not “correct” accent spellings.
Do not infer extra speakers.
