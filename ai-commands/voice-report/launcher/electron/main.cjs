const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const commandDir = process.env.VOICE_REPORT_COMMAND_DIR || path.resolve(__dirname, '../..');
const rendererPath = path.join(commandDir, 'launcher/renderer/index.html');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function parseArgs(argv) {
  const state = { text: 'Voice Report launcher is ready.', audioFile: '', readyFile: '', voiceGender: '', voiceId: '', muted: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--serve-check') {
      state.serveCheck = true;
    } else if (arg === '--text') {
      state.text = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--text-file') {
      const textFile = argv[index + 1] || '';
      state.textFile = textFile;
      state.text = fs.existsSync(textFile) ? fs.readFileSync(textFile, 'utf8') : '';
      index += 1;
    } else if (arg === '--audio-file') {
      state.audioFile = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--ready-file') {
      state.readyFile = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--voice-gender') {
      state.voiceGender = String(argv[index + 1] || '').trim().toLowerCase();
      index += 1;
    } else if (arg === '--voice-id') {
      state.voiceId = String(argv[index + 1] || '').trim();
      index += 1;
    } else if (arg === '--muted') {
      state.muted = true;
    }
  }
  state.text = String(state.text || '').replace(/\s+/g, ' ').trim() || 'Voice Report launcher is ready.';
  return state;
}

const launchState = parseArgs(process.argv.slice(2));
let mainWindow;

function writeReadyStatus(payload) {
  if (!launchState.readyFile) return;
  const body = {
    status: payload && payload.status ? String(payload.status) : 'unknown',
    detail: payload && payload.detail ? String(payload.detail) : '',
    audioFile: launchState.audioFile || '',
    voiceGender: launchState.voiceGender || '',
    voiceId: launchState.voiceId || '',
    muted: Boolean(launchState.muted),
    windowVisible: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()),
    at: new Date().toISOString()
  };
  fs.mkdirSync(path.dirname(launchState.readyFile), { recursive: true });
  fs.writeFileSync(launchState.readyFile, `${JSON.stringify(body)}\n`);
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    title: 'Voice Report',
    backgroundColor: '#111418',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(rendererPath);
  if (launchState.serveCheck) {
    mainWindow.webContents.once('did-finish-load', async () => {
      const text = await mainWindow.webContents.executeJavaScript('document.body.innerText');
      if (!text.includes('Voice Report') || !text.includes('Replay')) {
        console.error('Voice Report launcher UI did not render expected controls.');
        app.exit(1);
        return;
      }
      app.exit(0);
    });
  }
}

ipcMain.handle('voice-report:initial-state', () => launchState);

ipcMain.handle('voice-report:ready', (_event, payload) => {
  writeReadyStatus(payload || {});
  return { ok: true };
});

ipcMain.handle('voice-report:audio-status', () => {
  const audioFile = launchState.audioFile || '';
  if (!audioFile) return { exists: false, size: 0, audioFile: '' };
  try {
    const stat = fs.statSync(audioFile);
    return { exists: stat.isFile(), size: stat.size, audioFile };
  } catch {
    return { exists: false, size: 0, audioFile };
  }
});



app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
