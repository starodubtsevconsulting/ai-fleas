const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const actions = require('./project-creator-actions.cjs');

const repoRoot = path.resolve(__dirname, '../../../..');
const appRoot = path.join(repoRoot, 'ai');
const cliPath = path.join(repoRoot, 'ai-commands/projects/domain/projects-cli.ts');
const tsxPath = path.join(appRoot, 'node_modules/.bin/tsx');

function tmpContext() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-creator-actions-'));
  const configRoot = path.join(root, 'ai-config');
  const registryDir = path.join(configRoot, 'commands/projects/registry/multimedia-channels');
  const projectRoot = path.join(root, 'projects');
  fs.mkdirSync(registryDir, { recursive: true });
  fs.writeFileSync(path.join(registryDir, 'project.yml'), `root_path: ${projectRoot}\nprojects:\n`, 'utf8');
  return { root, projectRoot, registryPath: path.join(registryDir, 'project.yml'), context: { repoRoot: root, appRoot, configRoot } };
}

function runCli(args) {
  const result = spawnSync(tsxPath, [cliPath, ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || result.stdout || `projects cli exited with ${result.status}`);
  }
  return result.stdout;
}

test('Project Creator launcher actions build spec-template args with multimedia defaults', () => {
  assert.deepEqual(actions.specTemplateArgs({ name: 'New Song' }), [
    'spec-template',
    '--name', 'New Song',
    '--content-type', 'song',
    '--release-type', 'video',
    '--lyrics-source', 'write',
    '--cover-mode', 'video',
    '--thumbnail-mode', 'same-as-cover'
  ]);
});

test('Project Creator launcher actions use the external command catalog for defaults', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-creator-command-root-'));
  const commandRoot = path.join(root, 'ai-commands', 'projects');
  const configRoot = path.join(root, 'ai-config');
  const projectRoot = path.join(root, 'multimedia-projects');
  const registryPath = path.join(commandRoot, 'registry', 'multimedia-channels', 'project.yml');
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `root_path: ${projectRoot}\nprojects:\n`, 'utf8');

  const defaults = actions.defaults({ repoRoot: root, appRoot, configRoot, commandRoot });

  assert.equal(defaults.registryPath, registryPath);
  assert.equal(defaults.rootPath, projectRoot);
  assert.equal(defaults.configRoot, configRoot);
});

test('Project Creator launcher actions create project through shared CLI and scaffold folders', async () => {
  const fixture = tmpContext();
  const result = await actions.createProject({
    name: 'Launcher Created Song',
    contentType: 'song',
    releaseType: 'video',
    lyricsSource: 'ready-to-post',
    coverMode: 'static-picture',
    thumbnailMode: 'same-as-cover',
    specification: '# Launcher Created Song\n\nTODO: Fill the multimedia project specification.'
  }, fixture.context, runCli);

  const projectPath = path.join(fixture.projectRoot, 'launcher-created-song');
  assert.equal(result.id, 'launcher-created-song');
  assert.equal(result.path, projectPath);
  for (const name of ['spec.md', 'meta.yml', 'scene', 'out', 'lyrics', 'audio']) {
    assert.equal(fs.existsSync(path.join(projectPath, name)), true, `${name} should exist`);
  }
  assert.match(fs.readFileSync(path.join(projectPath, 'spec.md'), 'utf8'), /TODO: Fill the multimedia project specification/);
  assert.match(fs.readFileSync(path.join(projectPath, 'meta.yml'), 'utf8'), /lyrics_source: "ready-to-post"/);
  assert.match(fs.readFileSync(fixture.registryPath, 'utf8'), /id: "launcher-created-song"/);
});
