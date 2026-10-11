#!/usr/bin/env node
'use strict';
/** Offline packaging only. The parent runner builds/tests first; no npm/download occurs here. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const commandRoot = __dirname;
const launcher = path.join(commandRoot, 'launcher');
const runtime = path.join(launcher, 'node_modules/electron/dist');
const args = process.argv.slice(2);
function fail(code) { throw new Error(code); }
function run(binary, argv, options = {}) { return execFileSync(binary, argv, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options }).trim(); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function inventory(root, relative = '') {
  const entries = [];
  for (const name of fs.readdirSync(path.join(root, relative)).sort()) {
    const entry = path.join(relative, name);
    const stat = fs.lstatSync(path.join(root, entry));
    entries.push(entry);
    if (stat.isDirectory()) entries.push(...inventory(root, entry));
  }
  return entries;
}
function main() {
  if (args.length !== 1 || args[0] !== '--unsigned-preview') fail('USE_UNSIGNED_PREVIEW_ARGUMENT');
  if (process.platform !== 'darwin') fail('MACOS_PACKAGING_REQUIRED');
  const packageJson = JSON.parse(fs.readFileSync(path.join(launcher, 'package.json'), 'utf8'));
  const version = packageJson.version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail('RELEASE_VERSION_REQUIRED');
  const electronVersion = fs.readFileSync(path.join(runtime, 'version'), 'utf8').trim();
  if (electronVersion !== '44.3.0' || packageJson.devDependencies.electron !== electronVersion) fail('PINNED_ELECTRON_REQUIRED');
  const sourceApp = path.join(runtime, 'Electron.app');
  const executable = path.join(sourceApp, 'Contents/MacOS/Electron');
  if (run('/usr/bin/lipo', ['-archs', executable]) !== 'arm64') fail('APPLE_SILICON_RUNTIME_REQUIRED');
  const sourcePlist = path.join(sourceApp, 'Contents/Info.plist');
  const minimumMacOS = run('/usr/libexec/PlistBuddy', ['-c', 'Print :LSMinimumSystemVersion', sourcePlist]);
  if (minimumMacOS !== '13.0') fail('RUNTIME_MINIMUM_MACOS_CHANGED_REVIEW_REQUIRED');
  const dist = path.join(launcher, 'dist');
  for (const file of ['index.html', '3rdpartylicenses.txt']) if (!fs.statSync(path.join(dist, file)).isFile()) fail('PRODUCTION_ANGULAR_BUILD_REQUIRED');
  if (inventory(dist).some(file => file.endsWith('.map'))) fail('PRODUCTION_BUILD_WITHOUT_SOURCE_MAPS_REQUIRED');
  const epoch = process.env.SOURCE_DATE_EPOCH ?? '1704067200';
  if (!/^\d+$/.test(epoch) || Number(epoch) < 315532800 || Number(epoch) > 4354819199) fail('SOURCE_DATE_EPOCH_REJECTED');
  const timestamp = new Date(Number(epoch) * 1000);
  const releaseName = `Keep-Awake-${version}-macOS-arm64-unsigned-preview`;
  const releaseRoot = path.join(commandRoot, 'output/release', releaseName);
  for (const directory of [path.join(commandRoot, 'output'), path.join(commandRoot, 'output/release')]) {
    if (fs.existsSync(directory) && (fs.lstatSync(directory).isSymbolicLink() || !fs.lstatSync(directory).isDirectory())) fail('RELEASE_OUTPUT_DIRECTORY_REJECTED');
  }
  if (fs.existsSync(releaseRoot)) fail('RELEASE_OUTPUT_EXISTS_USE_NEW_VERSION_OR_REVIEW_EXISTING_OUTPUT');
  // Never remove/replace another run or write outside this command's ignored release directory.
  fs.mkdirSync(releaseRoot, { recursive: true });
  const app = path.join(releaseRoot, 'Keep Awake.app');
  fs.cpSync(sourceApp, app, { recursive: true, dereference: false, verbatimSymlinks: true });
  const resources = path.join(app, 'Contents/Resources');
  fs.rmSync(path.join(resources, 'default_app.asar'), { force: true });
  const appRoot = path.join(resources, 'app');
  fs.mkdirSync(path.join(appRoot, 'electron'), { recursive: true });
  for (const name of ['main.cjs', 'controller.cjs', 'preload.cjs']) fs.copyFileSync(path.join(launcher, 'electron', name), path.join(appRoot, 'electron', name));
  fs.cpSync(dist, path.join(appRoot, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(appRoot, 'package.json'), JSON.stringify({ name: 'keep-awake', productName: 'Keep Awake', version, private: true, main: 'electron/main.cjs' }, null, 2) + '\n');
  const notices = path.join(resources, 'licenses');
  fs.mkdirSync(notices);
  fs.copyFileSync(path.resolve(commandRoot, '../../../LICENSE'), path.join(notices, 'Keep-Awake-MIT-LICENSE.txt'));
  fs.copyFileSync(path.join(runtime, 'LICENSE'), path.join(notices, 'Electron-LICENSE.txt'));
  fs.copyFileSync(path.join(runtime, 'LICENSES.chromium.html'), path.join(notices, 'Chromium-LICENSES.html'));
  fs.copyFileSync(path.join(dist, '3rdpartylicenses.txt'), path.join(notices, 'Angular-third-party-licenses.txt'));
  fs.writeFileSync(path.join(notices, 'README.txt'), 'Keep Awake bundles Electron 44.3.0, Chromium, Node.js and the production Angular renderer. Their license notices are provided here. Keep Awake application source is MIT licensed; its full copyright and permission notice is included in Keep-Awake-MIT-LICENSE.txt. This preview is ad-hoc signed for local bundle integrity only; it is not Developer ID signed or notarized.\n');
  const plist = path.join(app, 'Contents/Info.plist');
  function plistExists(key) {
    try { run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist]); return true; }
    catch (error) {
      if (/Does Not Exist/i.test(String(error.stderr ?? '') + String(error.stdout ?? ''))) return false;
      throw error;
    }
  }
  for (const [key, value] of Object.entries({ CFBundleDisplayName: 'Keep Awake', CFBundleName: 'Keep Awake', CFBundleIdentifier: 'consulting.starodubtsev.keepawake', CFBundleShortVersionString: version, CFBundleVersion: version, LSApplicationCategoryType: 'public.app-category.utilities' }))
    run('/usr/libexec/PlistBuddy', ['-c', plistExists(key) ? `Set :${key} ${value}` : `Add :${key} string ${value}`, plist]);
  if (plistExists('ElectronAsarIntegrity')) run('/usr/libexec/PlistBuddy', ['-c', 'Delete :ElectronAsarIntegrity', plist]);
  // Preserve Electron executable/helper/framework names and layouts. Ad-hoc is NOT Developer ID.
  run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', app]);
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  const entries = inventory(app);
  for (const entry of entries.slice().reverse()) {
    const target = path.join(app, entry);
    if (fs.lstatSync(target).isSymbolicLink()) fs.lutimesSync(target, timestamp, timestamp);
    else fs.utimesSync(target, timestamp, timestamp);
  }
  fs.utimesSync(app, timestamp, timestamp);
  const releaseReadme = 'Keep Awake — unsigned Apple Silicon preview\n\nRequires macOS 13.0 or later and Apple Silicon. No Node.js/npm or repository is needed. Keep Awake.app contains the complete runtime. This draft has an ad-hoc integrity signature only; it is not Developer ID signed or notarized. Gatekeeper may block downloaded copies. For an approved local preview, extract the ZIP and open Keep Awake.app; use Stop or close the window to release its temporary assertions. If macOS blocks it, stop and request a signed release. No quarantine removal or bypass instructions are provided. Native UI and extended idle behavior require separate acceptance; manual lock, lid closure and managed policy remain outside the awake guarantee. The application MIT license and Electron/Chromium/Angular third-party notices are inside Keep Awake.app/Contents/Resources/licenses.\n';
  fs.writeFileSync(path.join(releaseRoot, 'README.txt'), releaseReadme);
  fs.utimesSync(path.join(releaseRoot, 'README.txt'), timestamp, timestamp);
  const zipName = `${releaseName}.zip`;
  const zipPath = path.join(releaseRoot, zipName);
  const zipEntries = ['README.txt', 'Keep Awake.app/', ...entries.map(entry => `Keep Awake.app/${entry}${fs.lstatSync(path.join(app, entry)).isDirectory() ? '/' : ''}`)].sort();
  run('/usr/bin/zip', ['-q', '-X', '-y', zipPath, '-@'], { cwd: releaseRoot, input: zipEntries.join('\n') + '\n', env: { ...process.env, TZ: 'UTC' } });
  const metadata = {
    product: 'Keep Awake', version, releaseKind: 'unsigned-preview', architecture: 'arm64', minimumMacOS,
    runtime: { electron: electronVersion }, signing: { kind: 'ad-hoc', developerId: false, notarized: false },
    sourceDateEpoch: Number(epoch), archive: zipName, archiveBytes: fs.statSync(zipPath).size, archiveSha256: hash(zipPath),
    standalone: true, requiresNodeOrNpmOnBuyerMac: false,
    inputSha256: Object.fromEntries(['package.json', 'package-lock.json', 'electron/main.cjs', 'electron/controller.cjs', 'electron/preload.cjs'].map(file => [file, hash(path.join(launcher, file))])),
    rendererSha256: Object.fromEntries(inventory(dist).filter(file => fs.lstatSync(path.join(dist, file)).isFile()).map(file => [file, hash(path.join(dist, file))])),
    releaseAcceptance: 'Draft only. Native app launch, awake/stop/quit and quarantined download acceptance require separate verification. No Developer ID/notarization or Intel/universal compatibility claim.'
  };
  const metadataName = 'release.json';
  fs.writeFileSync(path.join(releaseRoot, metadataName), JSON.stringify(metadata, null, 2) + '\n');
  fs.writeFileSync(path.join(releaseRoot, 'SHA256SUMS'), `${hash(zipPath)}  ${zipName}\n${hash(path.join(releaseRoot, metadataName))}  ${metadataName}\n`);
  console.log(`UNSIGNED_PREVIEW_PACKAGED ${releaseRoot}`);
}
try { main(); } catch (error) { console.error(error instanceof Error ? error.message : 'PREVIEW_PACKAGING_FAILED'); process.exitCode = 1; }
