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
   (the public example uses `narrator`) and disable command autoplay unless the human explicitly asks to start
   playback now. Apply `listen_through.online_synthesis` before choosing a speech provider: when the exact article is
   intended for public publication, the profile names the configured TTS service, and
   `default_for_publication_intended_articles: true`, that is standing human authorization to send the prepared
   narration text to that named service. Use the configured online TTS route without asking for per-article consent or
   trying an offline voice first. This includes an unpublished draft being prepared for public release. Do not send
   private notes, metadata, or text outside the public-intended narration script. The catalog `narrator` preset
   currently provides the default neutral English narration voice; a private profile may select another preset
   without changing this skill.
4. Check the preferred command through the selected profile and workflow's command activation and runner before
   declaring it unavailable. An inherited shell `PATH` check alone cannot establish that `tts` or its provider is
   missing: the command entry point may add the user's executable directory and load profile-owned configuration.
   If activation or the authorized command run fails, record its actual error and only then choose another computer
   voice from capabilities actually available and authorized in this workflow: local system speech or an editor/browser
   read-aloud feature. There is no required
   provider or file format. For content outside the profile's approved public-publication scope, prefer local speech
   and do not send text to an unconfigured external service. If no authorized voice is available, report the listening
   gate pending instead of asking the author to read aloud. If automatic approval review rejects an otherwise
   profile-authorized online attempt, report the rejected action and reason as a blocker; do not ask the author to
   repeat the same service consent or attempt to bypass the rejection.
5. Make the narration accessible to the author. For a generated file, verify nonempty audio and a plausible duration,
   then preserve the script and audio in the authorized article archive. Inspect file metadata and, when useful,
   waveform, silence, clipping, or transcription evidence without sending sound to the user's audio device. Present a
   clearly labeled click-to-play/open link or audio control, but do not start playback automatically. Start playback
   only in direct response to an explicit human request to play that exact narration. For live read-aloud, verify the
   correct article is available, but do not invoke it until the human explicitly requests playback; record the tool and
   revision. Do not invent an audio artifact. Flag meaningful differences from the destination draft.
6. Ask what sounds awkward, inaccurate, missing, or unlike the author. Audio generation, presenting a player, and
   starting playback do not establish that the author listened or approved the article. When listen-through is enabled,
   keep the listening gate pending until the author explicitly confirms listening to the exact narrated revision.
   Record that confirmation separately from article acceptance; a review-only scheduling policy waives acceptance,
   not listening. Never publish, submit, or schedule.

## TTS execution note

Resolve the selected profile's repository/configuration and activate the Writing workflow with command ID `tts`
before synthesis. Confirm that activation resolves the authorized command and its profile-owned configuration; then
invoke `ai-commands/_runtime/profile/run-command.sh` with that same profile and workflow, `--command tts`,
`--entrypoint tts/tts.command.sh`, and synthesis arguments after `--`. The runner performs its own activation and
command guard. Use the selected profile/workflow values rather than copying an example or assuming a profile ID.
If activation or the host rejects the command, report that concrete failure. Do not replace a configured online
voice with an offline system voice merely because `edge-tts` is absent from the inherited shell `PATH`.

When `tts` is selected, pass the prepared narration text as already-prepared speech input rather than asking the TTS
command to reinterpret the article. Pass the configured `voice_profile` through `--voice-profile` and the exact
archived article file through `--article-file` when the profile-owned TTS config defines an article audio
subdirectory. The command writes a distinct WAV directly to that article's `audio`
folder, preserving earlier versions. Use the active
profile/workflow command runner; use its session-scoped output path only when no article folder is configured.
Pass `--no-autoplay` for generated listen-through audio by default. Omit it only when the human explicitly asks to
start playback immediately for that exact narration. Showing a link or player control is not an instruction to play.
For a publication-intended article under the approved `online_synthesis` default, any network execution request must
accurately identify the selected profile setting, exact destination service, and narration-text scope. A host approval
decision still applies; do not treat a rejection as permission to use another service.
The Reviewer owns the human-facing narration preview; mechanical synthesis may remain delegated to command-runner according
to the command execution route.
