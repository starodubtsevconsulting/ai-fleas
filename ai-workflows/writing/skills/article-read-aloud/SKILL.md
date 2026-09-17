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
3. Choose a computer voice from capabilities actually available and authorized in this workflow: a configured
   `tts` command, local system speech, or an editor/browser read-aloud feature. There is no required provider or
   file format. Prefer local speech for private drafts; do not send article text to an unconfigured external
   service. If none is available, report the listening gate pending instead of asking the author to read aloud.
4. Make the narration accessible to the author. For a generated file, verify nonempty audio and a plausible
   duration, then preserve the script and audio in the authorized article archive. For live read-aloud, verify the
   correct article is actually playable and record the tool and revision; do not invent an audio artifact. Flag
   meaningful differences from the destination draft.
5. Ask what sounds awkward, inaccurate, missing, or unlike the author. Audio generation and playback establish an
   available review aid, not that the author listened or approved it. Keep the author review pending until feedback
   or acceptance is explicit. Never publish, submit, or schedule.
