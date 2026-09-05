const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const commandDir = path.resolve(__dirname, '../..');
const launcherDir = path.join(commandDir, 'launcher');
const uiIndex = path.join(launcherDir, 'dist/ui/browser/index.html');
const rendererUrl = process.env.VHE_RENDERER_URL || '';
const preloadPath = path.join(__dirname, 'preload.cjs');
const scriptPath = path.join(commandDir, 'video-handwriting-effect.command.sh');
let win = null;
let activeChild = null;

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

function focusExistingWindow() {
  if (!win || win.isDestroyed()) {
    return;
  }
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.moveTop();
  win.focus();
}

if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}


function send(channel, payload) {
  if (!win || win.isDestroyed()) {
    return;
  }
  win.webContents.send(channel, payload);
}

function pidIsAlive(pid) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function childPids(pid, seen = new Set()) {
  if (!pid || seen.has(pid)) {
    return [];
  }
  seen.add(pid);
  const result = [pid];
  const pgrep = childProcess.spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8', timeout: 1000 });
  if (pgrep.status !== 0 || !pgrep.stdout) {
    return result;
  }
  for (const childPid of pgrep.stdout.split(/\s+/).map((value) => Number(value)).filter(Boolean)) {
    result.push(...childPids(childPid, seen));
  }
  return result;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function signalProcess(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function terminateProcessTree(pid) {
  if (!pid || !pidIsAlive(pid)) {
    return;
  }
  const pids = childPids(pid);
  signalProcess(-pid, 'SIGTERM');
  signalProcess(pid, 'SIGTERM');
  for (const childPid of pids.slice().reverse()) {
    signalProcess(childPid, 'SIGTERM');
  }
  sleepSync(500);
  for (const childPid of pids.slice().reverse()) {
    if (pidIsAlive(childPid)) {
      signalProcess(childPid, 'SIGKILL');
    }
  }
  if (pidIsAlive(pid)) {
    signalProcess(-pid, 'SIGKILL');
    signalProcess(pid, 'SIGKILL');
  }
}

function stopActiveChild() {
  if (!activeChild) {
    return;
  }
  const pid = activeChild.pid;
  log('system', 'Stopping render process tree.');
  terminateProcessTree(pid);
}

function log(stream, text) {
  for (const line of String(text).split(/\r?\n/)) {
    if (line.trim().length === 0) {
      continue;
    }
    send('launcher:log', { stream, text: line });
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    title: 'Handwriting Render',
    backgroundColor: '#111418',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (rendererUrl) {
    win.loadURL(rendererUrl);
  } else {
    win.loadFile(uiIndex);
  }
  win.once('ready-to-show', () => {
    focusExistingWindow();
  });
  win.on('closed', () => {
    win = null;
  });
}

function listFonts() {
  const fontsDir = path.join(commandDir, 'fonts');
  if (!fs.existsSync(fontsDir)) {
    return [];
  }
  return fs.readdirSync(fontsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function parseJsonObject(raw) {
  if (!raw || !String(raw).trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseLaunchArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] || '';
    if (arg === '--launch-context-json') {
      Object.assign(parsed, parseJsonObject(next));
      index += 1;
    } else if (arg === '--text-file') {
      parsed.textFilePath = next;
      index += 1;
    } else if (arg === '--dist') {
      parsed.outputPath = next;
      index += 1;
    } else if (arg === '--video-path') {
      parsed.videoPath = next;
      index += 1;
    } else if (arg === '--scope-type') {
      parsed.scopeType = next;
      index += 1;
    } else if (arg === '--scope-path') {
      parsed.scopePath = next;
      index += 1;
    } else if (arg === '--suggested-text-file') {
      parsed.suggestedTextFilePath = next;
      index += 1;
    } else if (arg === '--project-path') {
      parsed.projectPath = next;
      index += 1;
    } else if (arg === '--breadcrumb') {
      parsed.breadcrumbLabel = next;
      index += 1;
    }
  }
  return parsed;
}

function parseLaunchContext(argv = process.argv.slice(2)) {
  return {
    ...parseJsonObject(process.env.AI_CONFIG_LAUNCH_CONTEXT_JSON || ''),
    ...parseLaunchArgs(argv)
  };
}

let launchContext = parseLaunchContext();

function contextValue(key, fallback = '') {
  const value = launchContext[key] || fallback;
  return typeof value === 'string' ? value.trim() : '';
}

function isFile(candidate) {
  try {
    return Boolean(candidate) && fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function isDirectory(candidate) {
  try {
    return Boolean(candidate) && fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function firstExistingPath(paths) {
  for (const candidate of paths) {
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return '';
}

function launchVideoPath() {
  return contextValue('videoPath', process.env.AI_CONFIG_LAUNCH_VIDEO_PATH || '');
}

function launchScopePath() {
  return contextValue('scopePath', process.env.AI_CONFIG_LAUNCH_SCOPE_PATH || '') || launchVideoPath() || contextValue('projectPath', process.env.AI_CONFIG_LAUNCH_PROJECT_PATH || '');
}

function textCandidatesForVideo(videoPath) {
  if (!isDirectory(videoPath)) {
    return [];
  }
  const exact = [
    path.join(videoPath, 'lyrics.md'),
    path.join(videoPath, 'lyrics', 'lyrics.md'),
    path.join(videoPath, 'lyrycs', 'lyrics.md'),
    path.join(videoPath, 'script.md'),
    path.join(videoPath, 'script', 'script.md')
  ];
  const globbed = [];
  for (const folder of [videoPath, path.join(videoPath, 'lyrics'), path.join(videoPath, 'lyrycs'), path.join(videoPath, 'script')]) {
    if (!isDirectory(folder)) {
      continue;
    }
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      if (/^(lyrics|lyric|script)[^/]*\.(md|txt)$/i.test(entry.name)) {
        globbed.push(path.join(folder, entry.name));
      }
    }
  }
  return [...exact, ...globbed];
}

function videoDirectoriesIn(scopePath) {
  if (!isDirectory(scopePath)) {
    return [];
  }
  return fs.readdirSync(scopePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(scopePath, entry.name))
    .filter((candidate) => firstExistingPath(textCandidatesForVideo(candidate)))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}

function defaultTextFilePath() {
  const explicit = contextValue('textFilePath', process.env.AI_CONFIG_LAUNCH_TEXT_FILE || '');
  if (isFile(explicit)) {
    return explicit;
  }
  const scopePath = launchScopePath();
  const scopeType = contextValue('scopeType', process.env.AI_CONFIG_LAUNCH_SCOPE_TYPE || '');
  const direct = firstExistingPath(textCandidatesForVideo(scopePath));
  if (direct) {
    return direct;
  }
  if (scopeType !== 'video') {
    for (const videoPath of videoDirectoriesIn(scopePath)) {
      const resolved = firstExistingPath(textCandidatesForVideo(videoPath));
      if (resolved) {
        return resolved;
      }
    }
  }
  const suggested = contextValue('suggestedTextFilePath', process.env.AI_CONFIG_LAUNCH_SUGGESTED_TEXT_FILE || '');
  if (isFile(suggested)) {
    return suggested;
  }
  return explicit || suggested;
}

function outputFolderFromPath(targetPath) {
  const resolved = cleanOption(targetPath);
  if (!resolved) {
    return '';
  }
  const parsed = path.parse(resolved);
  if (parsed.ext) {
    return path.join(parsed.dir, parsed.name);
  }
  return resolved;
}

function defaultOutputPath() {
  const explicit = outputFolderFromPath(contextValue('outputPath', process.env.AI_CONFIG_LAUNCH_OUTPUT_PATH || ''));
  const scopePath = launchScopePath();
  return explicit || (scopePath ? path.join(scopePath, 'out', 'handwriting-render') : '');
}

function defaultTextDialogPath() {
  const textFile = defaultTextFilePath();
  if (textFile) {
    return fs.existsSync(textFile) ? textFile : path.dirname(textFile);
  }
  const scopePath = launchScopePath();
  return scopePath || path.join(commandDir, 'samples/text');
}

function initialState() {
  return {
    commandDir,
    fonts: listFonts(),
    launchContext,
    breadcrumbLabel: contextValue('breadcrumbLabel', process.env.AI_CONFIG_LAUNCH_BREADCRUMB || ''),
    defaultTextFile: defaultTextFilePath(),
    defaultOutputPath: defaultOutputPath()
  };
}

if (process.argv.includes('--print-initial-state')) {
  process.stdout.write(JSON.stringify(initialState()) + '\n');
  app.quit();
  process.exit(0);
}

app.on('second-instance', (_event, argv) => {
  launchContext = parseLaunchContext(argv);
  send('launcher:launch-context', initialState());
  focusExistingWindow();
});

function cleanOption(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : fallback;
}

function resolveUserPath(targetPath) {
  const normalized = cleanOption(targetPath);
  if (!normalized) {
    return '';
  }
  return path.isAbsolute(normalized) ? normalized : path.resolve(commandDir, normalized);
}

function readTextPreview(targetPath) {
  const resolved = resolveUserPath(targetPath);
  if (!resolved) {
    return { path: '', content: '', truncated: false, available: false, message: 'No text file selected.' };
  }
  if (!isFile(resolved)) {
    return { path: resolved, content: '', truncated: false, available: false, message: 'Text file is not available.' };
  }
  const maxBytes = 80 * 1024;
  const buffer = fs.readFileSync(resolved);
  const truncated = buffer.length > maxBytes;
  const content = buffer.subarray(0, maxBytes).toString('utf8');
  return { path: resolved, content, truncated, available: true, message: truncated ? 'Preview truncated.' : '' };
}

function outputDistForMode(options) {
  const base = cleanOption(options.dist);
  if (cleanOption(options.videoMode, 'single') !== 'per-line' || !base) {
    return base;
  }
  const normalized = base.replace(/[\\/]+$/, '');
  if (/(^|[\\/])per-line$/i.test(normalized)) {
    return normalized;
  }
  return path.join(normalized, 'per-line');
}

function buildArgs(options) {
  const args = [
    '--font-name', cleanOption(options.fontName, 'font-1'),
    '--text-file', cleanOption(options.textFile),
    '--dist', outputDistForMode(options),
    '--video-mode', cleanOption(options.videoMode, 'single'),
    '--width', cleanOption(options.width, '1920'),
    '--height', cleanOption(options.height, '1080'),
    '--lines', cleanOption(options.maxLines, 'all'),
    '--ink-color', cleanOption(options.inkColor, '0,0,0'),
    '--letter-height', cleanOption(options.letterHeight, '48'),
    '--text-position', cleanOption(options.textPosition, 'top'),
    '--text-align', cleanOption(options.textAlign, 'left'),
    '--bottom-margin', cleanOption(options.bottomMargin, '180'),
    '--tail-symbols', cleanOption(options.tailSymbols, '0'),
    '--reveal-style', cleanOption(options.revealStyle, 'stroke'),
    '--jobs', cleanOption(options.jobs, 'auto')
  ];
  if (options.transparent) {
    args.push('--transparent');
  }
  return args;
}

ipcMain.handle('launcher:initial-state', () => initialState());

ipcMain.handle('launcher:text-preview', (_event, targetPath) => readTextPreview(targetPath));

ipcMain.handle('launcher:choose-text-file', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose text file',
    defaultPath: defaultTextDialogPath(),
    properties: ['openFile'],
    filters: [{ name: 'Text', extensions: ['txt', 'md'] }, { name: 'All files', extensions: ['*'] }]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return '';
  }
  return result.filePaths[0];
});

ipcMain.handle('launcher:choose-output-path', async (_event, options) => {
  const result = await dialog.showOpenDialog(win, {
    title: options && options.videoMode === 'per-line' ? 'Choose output folder for line videos' : 'Choose output folder',
    defaultPath: defaultOutputPath() || path.join(commandDir, 'output', 'font-1'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return '';
  }
  return result.filePaths[0];
});

ipcMain.handle('launcher:run', (_event, options) => {
  if (activeChild) {
    return { started: false };
  }
  const normalizedOptions = options || {};
  if (!cleanOption(normalizedOptions.textFile) || !cleanOption(normalizedOptions.dist)) {
    log('stderr', 'Text file and output folder are required before rendering.');
    return { started: false };
  }
  const args = buildArgs(normalizedOptions);
  log('system', `${scriptPath} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`);
  activeChild = childProcess.spawn(scriptPath, args, {
    cwd: commandDir,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32'
  });
  send('launcher:running', true);
  activeChild.stdout.on('data', (chunk) => log('stdout', chunk.toString('utf8')));
  activeChild.stderr.on('data', (chunk) => log('stderr', chunk.toString('utf8')));
  activeChild.on('error', (error) => {
    log('stderr', error.message);
  });
  activeChild.on('close', (code, signal) => {
    log('system', `Exited with ${signal || code}`);
    activeChild = null;
    send('launcher:running', false);
  });
  return { started: true };
});

ipcMain.handle('launcher:stop', () => {
  stopActiveChild();
});

ipcMain.handle('launcher:open-path', async (_event, targetPath) => {
  const resolved = path.resolve(commandDir, cleanOption(targetPath, 'output'));
  const openTarget = fs.existsSync(resolved) ? resolved : path.dirname(resolved);
  await shell.openPath(openTarget);
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  stopActiveChild();
  app.quit();
});
