const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { isSafeHost, isSafeUsername, targetsFromConfig } = require('./targets.cjs');

test('accepts Linux usernames and rejects command-like input', () => {
  assert.equal(isSafeUsername('operator'), true);
  assert.equal(isSafeUsername('site_admin-2'), true);
  assert.equal(isSafeUsername('bad;command'), false);
});

test('accepts hostnames and IP addresses but rejects shell input', () => {
  assert.equal(isSafeHost('server-01.local'), true);
  assert.equal(isSafeHost('192.0.2.26'), true);
  assert.equal(isSafeHost('host;open bad'), false);
});

test('loads only explicit safe remote desktop targets', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rdp-targets-')), 'config.yml');
  fs.writeFileSync(file, `boxes:\n  demo-box:\n    ssh_alias: demo-box\n    remote_desktop:\n      username: operator\n      preferred_client: freerdp\n      windows_app_compatible: false\n  ../bad:\n    remote_desktop:\n      host: bad host\n      username: root\n`);
  assert.deepEqual(targetsFromConfig(file), [{ id: 'demo-box', label: 'demo-box', host: 'demo-box', username: 'operator', preferredClient: 'freerdp', windowsAppCompatible: false, note: '' }]);
});
