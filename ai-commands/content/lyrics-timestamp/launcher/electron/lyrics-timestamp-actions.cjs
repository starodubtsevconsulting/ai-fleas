const path = require('node:path');

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg']);

function clean(value) {
  return String(value || '').trim();
}

function isFile(fs, candidate) {
  try {
    return Boolean(candidate) && fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function isDirectory(fs, candidate) {
  try {
    return Boolean(candidate) && fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function firstExistingFile(fs, candidates) {
  for (const candidate of candidates) {
    if (isFile(fs, candidate)) {
      return candidate;
    }
  }
  return '';
}

function launchScopePath(launchContext = {}) {
  return clean(launchContext.scopePath) || clean(launchContext.videoPath) || clean(launchContext.projectPath);
}

function textCandidatesForVideo(videoPath) {
  if (!videoPath) {
    return [];
  }
  return [
    path.join(videoPath, 'lyrics.md'),
    path.join(videoPath, 'lyrics', 'lyrics.md'),
    path.join(videoPath, 'lyrycs', 'lyrics.md'),
    path.join(videoPath, 'script.md'),
    path.join(videoPath, 'script', 'script.md')
  ];
}

function videoDirectoriesIn(fs, scopePath) {
  if (!isDirectory(fs, scopePath)) {
    return [];
  }
  return fs.readdirSync(scopePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(scopePath, entry.name))
    .filter((candidate) => firstExistingFile(fs, textCandidatesForVideo(candidate)))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}

function defaultLyricsFile(fs, launchContext = {}) {
  const explicitText = clean(launchContext.textFilePath);
  if (isFile(fs, explicitText)) {
    return explicitText;
  }
  const suggestedText = clean(launchContext.suggestedTextFilePath);
  if (isFile(fs, suggestedText)) {
    return suggestedText;
  }
  const scopePath = launchScopePath(launchContext);
  const direct = firstExistingFile(fs, textCandidatesForVideo(scopePath));
  if (direct) {
    return direct;
  }
  for (const videoPath of videoDirectoriesIn(fs, scopePath)) {
    const resolved = firstExistingFile(fs, textCandidatesForVideo(videoPath));
    if (resolved) {
      return resolved;
    }
  }
  return explicitText || suggestedText;
}

function audioFilesIn(fs, folder) {
  if (!isDirectory(fs, folder)) {
    return [];
  }
  const found = [];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const entryPath = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      found.push(...audioFilesIn(fs, entryPath));
    } else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      found.push(entryPath);
    }
  }
  return found.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}

function defaultAudioFile(fs, launchContext = {}) {
  const explicitAudio = clean(launchContext.audioFilePath);
  if (isFile(fs, explicitAudio)) {
    return explicitAudio;
  }
  const scopePath = launchScopePath(launchContext);
  const videoPaths = [clean(launchContext.videoPath), scopePath, ...videoDirectoriesIn(fs, scopePath)].filter(Boolean);
  for (const videoPath of [...new Set(videoPaths)]) {
    const audioFile = audioFilesIn(fs, path.join(videoPath, 'audio'))[0] || '';
    if (audioFile) {
      return audioFile;
    }
  }
  return explicitAudio;
}

function lyricsFolderFromFile(lyricsFile) {
  return lyricsFile ? path.dirname(lyricsFile) : '';
}

function defaultDist(fs, launchContext = {}) {
  const lyricsFile = defaultLyricsFile(fs, launchContext);
  const lyricsFolder = lyricsFolderFromFile(lyricsFile);
  if (lyricsFolder) {
    return lyricsFolder;
  }
  const scopePath = launchScopePath(launchContext);
  if (scopePath) {
    return path.join(scopePath, 'lyrics');
  }
  return clean(launchContext.outputPath) || path.join(launchContext.commandDir || '', 'output', 'manual');
}

function dialogDefaultPath(fs, currentPath, fallbackPath = "") {
  const current = clean(currentPath);
  if (isDirectory(fs, current)) {
    return current;
  }
  if (isFile(fs, current)) {
    return path.dirname(current);
  }
  const fallback = clean(fallbackPath);
  if (isDirectory(fs, fallback)) {
    return fallback;
  }
  if (isFile(fs, fallback)) {
    return path.dirname(fallback);
  }
  return undefined;
}

function defaults(context, fs) {
  const launchContext = context.launchContext || {};
  return {
    commandDir: context.commandDir,
    breadcrumbLabel: clean(launchContext.breadcrumbLabel),
    scopePath: launchScopePath(launchContext),
    lyricsFile: defaultLyricsFile(fs, launchContext),
    audioFile: defaultAudioFile(fs, launchContext),
    dist: defaultDist(fs, { ...launchContext, commandDir: context.commandDir }),
    timingHintsFile: clean(launchContext.timingHintsFilePath)
  };
}

function mapArgs(input = {}, action = 'map') {
  const args = [
    action,
    '--lyrics-file', input.lyricsFile || '',
    '--audio-file', input.audioFile || '',
    '--dist', input.dist || '',
    '--line-mode', input.lineMode || 'non-empty',
    '--format', input.format || 'json,srt',
    '--tail-ms', String(input.tailMs || 250)
  ];
  if (clean(input.timingHintsFile)) {
    args.push('--timing-hints-file', input.timingHintsFile);
  }
  return args;
}

function outputPaths(input = {}) {
  const dist = path.resolve(input.dist || '');
  if (path.extname(dist).toLowerCase() === '.json') {
    return {
      jsonPath: dist,
      srtPath: dist.replace(/\.json$/i, '.srt')
    };
  }
  return {
    jsonPath: path.join(dist, 'lyrics-timestamp.json'),
    srtPath: path.join(dist, 'lyrics-timestamp.srt')
  };
}

function validateInput(input = {}) {
  const missing = [];
  if (!input.lyricsFile) missing.push('lyrics file');
  if (!input.audioFile) missing.push('audio file');
  if (!input.dist) missing.push('output folder');
  if (missing.length > 0) {
    throw new Error(`Select ${missing.join(', ')} before mapping.`);
  }
  if (!(input.format || 'json,srt').split(',').map((item) => item.trim()).includes('json')) {
    throw new Error('The visual launcher requires JSON output for preview.');
  }
}

function loadExistingMappedLyrics(input = {}, fs) {
  const paths = outputPaths(input);
  if (!isFile(fs, paths.jsonPath)) {
    return {
      ...paths,
      found: false
    };
  }
  const payload = JSON.parse(fs.readFileSync(paths.jsonPath, 'utf8'));
  const srt = isFile(fs, paths.srtPath) ? fs.readFileSync(paths.srtPath, 'utf8') : '';
  return {
    ...paths,
    found: true,
    saved: true,
    payload,
    srt
  };
}

function assertNoExistingMappedOutput(input = {}, fs) {
  const paths = outputPaths(input);
  if (isFile(fs, paths.jsonPath)) {
    throw new Error(`Refusing to run mapping because mapped output already exists: ${paths.jsonPath}`);
  }
}

async function mapLyrics(input, context, runCommand, fs) {
  validateInput(input);
  assertNoExistingMappedOutput(input, fs);
  const args = mapArgs(input, 'preview');
  const result = await runCommand(args);
  const paths = outputPaths(input);
  const preview = JSON.parse(result.stdout);
  return {
    ...paths,
    ...preview,
    stdout: result.stdout,
    stderr: result.stderr,
    saved: false
  };
}

async function saveMappedLyrics(input = {}, mapped = {}, fs) {
  validateInput(input);
  if (!mapped.payload || !Array.isArray(mapped.payload.lines)) {
    throw new Error('Run mapping before saving.');
  }
  const paths = outputPaths(input);
  const formats = (input.format || 'json,srt').split(',').map((item) => item.trim());
  const writeSrt = formats.includes('srt');
  fs.mkdirSync(path.dirname(paths.jsonPath), { recursive: true });
  fs.writeFileSync(paths.jsonPath, `${JSON.stringify(mapped.payload, null, 2)}\n`, 'utf8');
  if (writeSrt) {
    fs.writeFileSync(paths.srtPath, mapped.srt || '', 'utf8');
  }
  return {
    jsonPath: paths.jsonPath,
    srtPath: writeSrt ? paths.srtPath : '',
    saved: true
  };
}

module.exports = {
  defaults,
  dialogDefaultPath,
  defaultAudioFile,
  defaultDist,
  defaultLyricsFile,
  mapArgs,
  assertNoExistingMappedOutput,
  loadExistingMappedLyrics,
  mapLyrics,
  saveMappedLyrics,
  outputPaths,
  validateInput
};
