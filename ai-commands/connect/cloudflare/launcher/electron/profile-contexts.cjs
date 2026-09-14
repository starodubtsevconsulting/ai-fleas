const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const SAFE_PROFILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SAFE_WORKFLOW = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function isSafeWorkflow(value) {
  return typeof value === 'string' && SAFE_WORKFLOW.test(value) && !path.isAbsolute(value) && !value.split('/').includes('..');
}

function contextsFromProfile(profileId, document) {
  if (!SAFE_PROFILE.test(profileId) || !document || document.name !== profileId) return [];
  const commandBound = Array.isArray(document.commands) && document.commands.some((entry) => entry && entry.id === 'cloudflare' && typeof entry.config === 'string');
  if (!commandBound || !Array.isArray(document.workflows)) return [];
  return document.workflows
    .filter((workflow) => workflow && isSafeWorkflow(workflow.path) && Array.isArray(workflow.commands) && workflow.commands.includes('cloudflare'))
    .map((workflow) => ({ profileId, workflow: workflow.path, providerId: workflow.local_ai?.provider || '' }));
}

function discoverContexts(profileRoot) {
  if (!fs.existsSync(profileRoot)) return [];
  const contexts = [];
  for (const entry of fs.readdirSync(profileRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !SAFE_PROFILE.test(entry.name)) continue;
    const profileFile = path.join(profileRoot, entry.name, `${entry.name}-work-profile.yml`);
    if (!fs.existsSync(profileFile)) continue;
    try {
      contexts.push(...contextsFromProfile(entry.name, YAML.parse(fs.readFileSync(profileFile, 'utf8'))));
    } catch (_) {
      // Invalid profiles remain unavailable; command validation owns detailed diagnostics.
    }
  }
  return contexts.sort((a, b) => `${a.profileId}/${a.workflow}`.localeCompare(`${b.profileId}/${b.workflow}`));
}

function contextEnv(baseEnv, selected) {
  const env = { ...baseEnv };
  delete env.AI_COMMAND_CONFIG_PATH;
  delete env.CLOUDFLARE_COMMAND_CONF;
  delete env.AI_PROFILE_FILE;
  env.AI_WORK_PROFILE_ID = selected.profileId;
  env.WORK_PROFILE_ID = selected.profileId;
  env.AI_FLOW_WORKFLOW = selected.workflow;
  if (selected.providerId) env.AI_MODEL_PROVIDER_ID = selected.providerId;
  else delete env.AI_MODEL_PROVIDER_ID;
  return env;
}

module.exports = { contextEnv, contextsFromProfile, discoverContexts, isSafeWorkflow };
