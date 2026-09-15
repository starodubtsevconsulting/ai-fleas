const fs = require('node:fs');
const YAML = require('yaml');

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SAFE_HOST = /^[A-Za-z0-9][A-Za-z0-9.:-]*$/;

function targetsFromConfig(configPath) {
  const document = YAML.parse(fs.readFileSync(configPath, 'utf8')) || {};
  const output = [];
  for (const [id, box] of Object.entries(document.boxes || {})) {
    const rdp = box?.remote_desktop;
    const host = rdp?.host || box?.ssh_alias;
    const username = rdp?.username;
    if (!rdp || !SAFE_ID.test(id) || !SAFE_HOST.test(String(host || '')) || !SAFE_ID.test(String(username || ''))) continue;
    output.push({
      id,
      label: String(rdp.label || id),
      host: String(host),
      username: String(username),
      preferredClient: rdp.preferred_client === 'windows-app' ? 'windows-app' : 'freerdp',
      windowsAppCompatible: rdp.windows_app_compatible !== false,
      note: String(rdp.note || '')
    });
  }
  return output;
}

module.exports = { targetsFromConfig };
