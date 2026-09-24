const { spawn } = require('node:child_process');

function run(executable, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      finish({ ok: false, code: null, stdout, stderr: `${stderr}\nCommand timed out.`.trim() });
    }, 8000);
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', (error) => finish({ ok: false, code: null, stdout, stderr: error.message }));
    child.once('exit', (code) => finish({ ok: code === 0, code, stdout, stderr }));
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

function controllerWantsRunning(result) {
  return Boolean(result?.ok && /^controller desired: running\b/m.test(String(result.stdout || '')));
}

async function status(context) {
  const validate = await run(context.commandPath, ['validate'], context.spawnOptions());
  const unavailable = { ok: false, stdout: '', stderr: 'Configuration validation failed.' };
  const [access, installed, observed, desired, server, origin] = await Promise.all([
    validate.ok ? run(context.commandPath, ['verify-access'], context.spawnOptions()) : unavailable,
    run('cloudflared', ['--version'], context.spawnOptions()),
    validate.ok ? run(context.commandPath, ['connector-status'], context.spawnOptions()) : unavailable,
    validate.ok && context.serviceControlled
      ? run(context.commandPath, ['controller-state'], context.spawnOptions())
      : unavailable,
    ...(validate.ok ? [
      run(context.commandPath, ['server-status'], context.spawnOptions()),
      run(context.commandPath, ['origin-status'], context.spawnOptions())
    ] : [unavailable, unavailable])
  ]);
  const uiManaged = Boolean(context.connector && context.connector.exitCode === null);
  const detected = uiManaged || connectorIsOpen(observed);
  const serviceManaged = Boolean(context.serviceControlled && detected);
  return {
    configured: validate.ok,
    connectorInstalled: installed.ok,
    connectorManaged: uiManaged || serviceManaged,
    connectorDesired: context.serviceControlled && desired.ok ? controllerWantsRunning(desired) : undefined,
    connectorDetected: detected,
    connectorCount: detected ? 1 : 0,
    connectorConflict: detected && !uiManaged && !serviceManaged,
    serverOnline: server.ok,
    originHealthy: origin.ok,
    accessHealthy: access.ok,
    publicUrl: publicUrlFromValidation(validate.stdout),
    version: installed.ok ? installed.stdout.trim() : '',
    message: safeLog(validate.stderr || access.stderr)
  };
}

module.exports = { connectorIsOpen, controllerWantsRunning, countPids, publicUrlFromValidation, run, safeLog, status };
