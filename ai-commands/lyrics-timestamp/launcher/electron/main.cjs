const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const actions = require('./lyrics-timestamp-actions.cjs');

const repoRoot = process.env.LYRICS_TIMESTAMP_REPO_ROOT || path.resolve(__dirname, '../../../../..');
const appRoot = process.env.LYRICS_TIMESTAMP_APP_ROOT || path.join(repoRoot, 'ai');
const commandDir = process.env.LYRICS_TIMESTAMP_COMMAND_DIR || path.resolve(__dirname, '../..');

function parseJsonObject(raw) {
  if (!raw) return {};
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
    } else if (arg === '--text-file' || arg === '--lyrics-file') {
      parsed.textFilePath = next;
      index += 1;
    } else if (arg === '--audio-file') {
      parsed.audioFilePath = next;
      index += 1;
    } else if (arg === '--timing-hints-file') {
      parsed.timingHintsFilePath = next;
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
    audioFilePath: process.env.AI_CONFIG_LAUNCH_AUDIO_FILE || '',
    timingHintsFilePath: process.env.AI_CONFIG_LAUNCH_TIMING_HINTS_FILE || '',
    ...parseLaunchArgs(argv)
  };
}

const launchContext = parseLaunchContext();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 860,
    minHeight: 620,
    title: 'Lyrics Timestamp',
    backgroundColor: '#111418',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.loadFile(path.join(__dirname, '../panel/index.html'));
}

function runCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(commandDir, 'lyrics-timestamp.command.sh'), args, {
      cwd: commandDir,
      env: {
        ...process.env,
        PATH: [path.join(appRoot, 'node_modules/.bin'), process.env.PATH || ''].filter(Boolean).join(path.delimiter)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error((stderr || stdout || `lyrics-timestamp exited with ${signal || code}`).trim()));
      }
    });
  });
}

const context = { commandDir, launchContext };

ipcMain.handle('lyrics-timestamp:defaults', () => actions.defaults(context, fs));

ipcMain.handle('lyrics-timestamp:pick-lyrics', async (_event, currentPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select lyrics file',
    defaultPath: actions.dialogDefaultPath(fs, currentPath, actions.defaults(context, fs).lyricsFile),
    properties: ['openFile'],
    filters: [
      { name: 'Text and Markdown', extensions: ['txt', 'md', 'markdown'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  return result.canceled ? '' : result.filePaths[0];
});

ipcMain.handle('lyrics-timestamp:pick-audio', async (_event, currentPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select audio file',
    defaultPath: actions.dialogDefaultPath(fs, currentPath, actions.defaults(context, fs).audioFile),
    properties: ['openFile'],
    filters: [
      { name: 'Audio', extensions: ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  return result.canceled ? '' : result.filePaths[0];
});


ipcMain.handle('lyrics-timestamp:pick-hints', async (_event, currentPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select timing hints file',
    defaultPath: actions.dialogDefaultPath(fs, currentPath, actions.defaults(context, fs).timingHintsFile),
    properties: ['openFile'],
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  return result.canceled ? '' : result.filePaths[0];
});

ipcMain.handle('lyrics-timestamp:pick-dist', async (_event, currentPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select output folder',
    defaultPath: actions.dialogDefaultPath(fs, currentPath, actions.defaults(context, fs).dist),
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? '' : result.filePaths[0];
});

ipcMain.handle('lyrics-timestamp:audio-data', async (_event, audioPath) => {
  const resolved = path.resolve(String(audioPath || ''));
  const data = fs.readFileSync(resolved);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
});

ipcMain.handle('lyrics-timestamp:load-existing', async (_event, input) => actions.loadExistingMappedLyrics(input, fs));
ipcMain.handle('lyrics-timestamp:map', async (_event, input) => actions.mapLyrics(input, context, runCommand, fs));
ipcMain.handle('lyrics-timestamp:save', async (_event, input, mapped) => actions.saveMappedLyrics(input, mapped, fs));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
