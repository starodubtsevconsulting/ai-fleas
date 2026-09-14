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

async function status(context) {
  const validate = await run(context.commandPath, ['validate'], context.spawnOptions());
  const access = validate.ok
    ? await run(context.commandPath, ['verify-access'], context.spawnOptions())
    : { ok: false, stdout: '', stderr: 'Configuration validation failed.' };
  const installed = await run('cloudflared', ['--version'], context.spawnOptions());
  const processes = await run('pgrep', ['-x', 'cloudflared'], context.spawnOptions());
  const connectorCount = countPids(processes.stdout, processes.ok);
  return {
    configured: validate.ok,
    connectorInstalled: installed.ok,
    connectorManaged: Boolean(context.connector && context.connector.exitCode === null),
    connectorDetected: connectorCount > 0,
    connectorCount,
    connectorConflict: connectorCount > 1,
    accessHealthy: access.ok,
    publicUrl: publicUrlFromValidation(validate.stdout),
    version: installed.ok ? installed.stdout.trim() : '',
    message: safeLog(validate.stderr || access.stderr)
  };
}

module.exports = { countPids, publicUrlFromValidation, run, safeLog, status };
