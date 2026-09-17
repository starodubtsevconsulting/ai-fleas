---
name: article-read-aloud
description: Create a faithful computer-narrated listening preview of a finished article for pre-publication review. Use when the writing workflow calls for an author listen-through; not for publication.
---

# Article read-aloud

The computer narrates the article. The author listens and gives feedback; they are not asked to read it aloud.

1. Identify the exact article revision being reviewed. Use the canonical archived Markdown unless the destination
   draft contains substantive edits not yet reflected there; in that case reconcile the text before narration.
2. Prepare a spoken script from the article, preserving title, prose, quotations, section order, and meaningful
   emphasis. Omit Markdown syntax, URLs, editor controls, and image credits unless essential to the argument.
   Briefly describe diagrams instead of speaking diagram source. The bundled
   [script](scripts/prepare_narration.py) handles ordinary Markdown; inspect its output and correct any awkward
   treatment of tables, code, unusual notation, or pronunciation before synthesis.
3. Resolve `review_preferences.listen_through` from the selected profile when present. When enabled and its configured
   command is authorized by the writing workflow, prefer that command. For `tts`, use the configured voice profile
   (the public example uses `narrator`) and preserve the command's normal autoplay behavior unless the profile/human
   disables it. The catalog `narrator` preset currently provides the default neutral English narration voice; a
   private profile may select another preset without changing this skill.
4. If the preferred command is unavailable, choose another computer voice from capabilities actually available and
   authorized in this workflow: local system speech or an editor/browser read-aloud feature. There is no required
   provider or file format. Prefer local speech for private drafts; do not send article text to an unconfigured
   external service. If none is available, report the listening gate pending instead of asking the author to read aloud.
5. Make the narration accessible to the author. For a generated file, verify nonempty audio and a plausible duration,
   then preserve the script and audio in the authorized article archive. Unless autoplay was disabled, start playback
   after successful generation so the review step naturally becomes a listen-through rather than merely returning a
   file path. For live read-aloud, verify the correct article is actually playable and record the tool and revision;
   do not invent an audio artifact. Flag meaningful differences from the destination draft.
6. Ask what sounds awkward, inaccurate, missing, or unlike the author. Audio generation and playback establish an
   available review aid, not that the author listened or approved it. Keep the author review pending until feedback
   or acceptance is explicit. Never publish, submit, or schedule.

## TTS execution note

When `tts` is selected, pass the prepared narration text as already-prepared speech input rather than asking the TTS
command to reinterpret the article. Use the active profile/workflow command runner and the session-scoped output path.
Do not add `--no-autoplay` for an enabled listen-through unless the human/profile explicitly requests silent generation.
The Reviewer owns the human-facing review gate; mechanical synthesis may remain delegated to command-runner according
to the command execution route.
