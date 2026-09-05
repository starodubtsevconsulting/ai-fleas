const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const projectCreator = require('./project-creator-actions.cjs');

const repoRoot = process.env.PROJECT_CREATOR_REPO_ROOT || path.resolve(__dirname, '../../../../..');
const appRoot = process.env.PROJECT_CREATOR_APP_ROOT || path.join(repoRoot, 'ai');
const configRoot = process.env.PROJECT_CREATOR_CONFIG_ROOT || path.join(repoRoot, 'ai-config');
const commandRoot = process.env.PROJECT_CREATOR_COMMAND_ROOT || path.resolve(__dirname, '../..');
const cliPath = path.join(commandRoot, 'domain/projects-cli.ts');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 760,
    minWidth: 760,
    minHeight: 620,
    title: 'Project Creator',
    backgroundColor: '#f7f7f4',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', cliPath, ...args], {
      cwd: appRoot,
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
        resolve(stdout);
      } else {
        reject(new Error((stderr || stdout || `Project Creator exited with ${signal || code}`).trim()));
      }
    });
  });
}

const projectCreatorContext = { repoRoot, appRoot, configRoot, commandRoot };

ipcMain.handle('project-creator:defaults', () => projectCreator.defaults(projectCreatorContext));

ipcMain.handle('project-creator:spec-template', async (_event, input) => runCli(projectCreator.specTemplateArgs(input)));

ipcMain.handle('project-creator:create', async (_event, input) => projectCreator.createProject(input, projectCreatorContext, runCli));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
