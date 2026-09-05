const fs = require('node:fs');
const path = require('node:path');

function commandRoot(context) {
  return context.commandRoot || path.join(context.configRoot, 'commands/projects');
}

function defaultRegistryPath(context) {
  const root = typeof context === 'string'
    ? path.join(context, 'commands/projects')
    : commandRoot(context);
  const preferred = path.join(root, 'registry/multimedia-channels/project.yml');
  return fs.existsSync(preferred) ? preferred : path.join(root, 'registry/project.yml');
}

function defaultRootPath(repoRoot, context) {
  const registryPath = defaultRegistryPath(context);
  if (fs.existsSync(registryPath)) {
    const text = fs.readFileSync(registryPath, 'utf8');
    const match = text.match(/^root_path:\s*(.+)$/m);
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return path.join(repoRoot, 'projects');
}

function defaults(context) {
  return {
    repoRoot: context.repoRoot,
    appRoot: context.appRoot,
    configRoot: context.configRoot,
    registryPath: defaultRegistryPath(context),
    rootPath: defaultRootPath(context.repoRoot, context)
  };
}

function specTemplateArgs(input = {}) {
  return [
    'spec-template',
    '--name', input.name || 'TODO: Project title',
    '--content-type', input.contentType || 'song',
    '--release-type', input.releaseType || 'video',
    '--lyrics-source', input.lyricsSource || 'write',
    '--cover-mode', input.coverMode || 'video',
    '--thumbnail-mode', input.thumbnailMode || 'same-as-cover'
  ];
}

function createArgs(input = {}, context) {
  return [
    'create',
    '--registry-path', input.registryPath || defaultRegistryPath(context),
    '--root-path', input.rootPath || defaultRootPath(context.repoRoot, context),
    '--name', input.name || '',
    '--content-type', input.contentType || 'song',
    '--release-type', input.releaseType || 'video',
    '--specification', input.specification || '',
    '--lyrics-source', input.lyricsSource || 'write',
    '--cover-mode', input.coverMode || 'video',
    '--thumbnail-mode', input.thumbnailMode || 'same-as-cover',
    '--output-json'
  ];
}

async function createProject(input, context, runCli) {
  const output = await runCli(createArgs(input, context));
  return JSON.parse(output);
}

module.exports = {
  createArgs,
  createProject,
  defaultRegistryPath,
  defaultRootPath,
  defaults,
  specTemplateArgs
};
