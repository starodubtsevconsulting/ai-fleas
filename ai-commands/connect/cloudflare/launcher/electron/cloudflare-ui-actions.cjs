const { spawn } = require('node:child_process');

function run(executable, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', (error) => resolve({ ok: false, code: null, stdout, stderr: error.message }));
    child.once('exit', (code) => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}

function publicUrlFromValidation(output) {
  const match = String(output || '').match(/\bpublic_host=([^\s]+)/);
  return match ? `https://${match[1]}` : '';
}

function safeLog(raw) {
  return String(raw || '')
    .replace(/(--token\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(Authorization:\s*Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .slice(-12000);
}

function countPids(raw, ok = true) {
  return ok ? String(raw || '').trim().split(/\s+/).filter(Boolean).length : 0;
}

function connectorIsOpen(result) {
  return Boolean(result?.ok && /^connector open:/m.test(String(result.stdout || '')));
}

async function status(context) {
  const validate = await run(context.commandPath, ['validate'], context.spawnOptions());
  const unavailable = { ok: false, stdout: '', stderr: 'Configuration validation failed.' };
  const [access, installed, observed, server, origin] = await Promise.all([
    validate.ok ? run(context.commandPath, ['verify-access'], context.spawnOptions()) : unavailable,
    run('cloudflared', ['--version'], context.spawnOptions()),
    validate.ok ? run(context.commandPath, ['connector-status'], context.spawnOptions()) : unavailable,
    ...(validate.ok ? [
      run(context.commandPath, ['server-status'], context.spawnOptions()),
      run(context.commandPath, ['origin-status'], context.spawnOptions())
    ] : [unavailable, unavailable])
  ]);
  const managed = Boolean(context.connector && context.connector.exitCode === null);
  const detected = managed || connectorIsOpen(observed);
  return {
    configured: validate.ok,
    connectorInstalled: installed.ok,
    connectorManaged: managed,
    connectorDetected: detected,
    connectorCount: detected ? 1 : 0,
    connectorConflict: detected && !managed,
    serverOnline: server.ok,
    originHealthy: origin.ok,
    accessHealthy: access.ok,
    publicUrl: publicUrlFromValidation(validate.stdout),
    version: installed.ok ? installed.stdout.trim() : '',
    message: safeLog(validate.stderr || access.stderr)
  };
}

module.exports = { connectorIsOpen, countPids, publicUrlFromValidation, run, safeLog, status };
