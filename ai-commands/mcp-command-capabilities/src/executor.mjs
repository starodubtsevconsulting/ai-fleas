import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { packageRoot } from './paths.mjs';

function redact(value) {
  return value
    .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASS|KEY)[A-Z0-9_]*=)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/g, '$1[REDACTED]');
}

function appendLimited(chunks, next, limitBytes) {
  const nextBuffer = Buffer.isBuffer(next) ? next : Buffer.from(String(next));
  const remaining = Math.max(0, limitBytes - chunks.bytes);
  if (remaining > 0) {
    chunks.parts.push(nextBuffer.subarray(0, remaining));
  }
  chunks.bytes += nextBuffer.length;
  if (nextBuffer.length > remaining) {
    chunks.truncated = true;
  }
}

export function envFromAllowlist(allowlist, source = process.env) {
  const env = {};
  for (const key of allowlist) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      env[key] = source[key];
    }
  }
  env.LC_ALL = env.LC_ALL || 'C';
  env.LANG = env.LANG || 'C';
  return env;
}

export function validateEnvAllowlist(allowlist) {
  const approved = new Set(['PATH', 'LANG', 'LC_ALL']);
  if (!Array.isArray(allowlist) || allowlist.length === 0) {
    throw new Error('executionPolicy.envAllowlist must be a non-empty array');
  }
  const seen = new Set();
  for (const value of allowlist) {
    if (typeof value !== 'string' || !/^[A-Z0-9_]+$/.test(value)) {
      throw new Error(`unsafe env allowlist entry: ${value}`);
    }
    if (!approved.has(value)) {
      throw new Error(`env allowlist entry is not approved for command execution: ${value}`);
    }
    if (/TOKEN|SECRET|PASS|PASSWORD|KEY|AWS|GITHUB|NPM|SSH/i.test(value)) {
      throw new Error(`secret-like env allowlist entry is prohibited: ${value}`);
    }
    if (seen.has(value)) {
      throw new Error(`duplicate env allowlist entry: ${value}`);
    }
    seen.add(value);
  }
}

export function normalizePolicy(policy = {}) {
  const normalized = {
    timeoutMs: policy.timeoutMs ?? 5000,
    maxStdoutBytes: policy.maxStdoutBytes ?? 32768,
    maxStderrBytes: policy.maxStderrBytes ?? 16384,
    envAllowlist: policy.envAllowlist ?? ['PATH', 'LANG', 'LC_ALL']
  };
  if (!Number.isInteger(normalized.timeoutMs) || normalized.timeoutMs < 100 || normalized.timeoutMs > 10000) {
    throw new Error('executionPolicy.timeoutMs must be 100..10000');
  }
  if (!Number.isInteger(normalized.maxStdoutBytes) || normalized.maxStdoutBytes < 256 || normalized.maxStdoutBytes > 65536) {
    throw new Error('executionPolicy.maxStdoutBytes must be 256..65536');
  }
  if (!Number.isInteger(normalized.maxStderrBytes) || normalized.maxStderrBytes < 256 || normalized.maxStderrBytes > 65536) {
    throw new Error('executionPolicy.maxStderrBytes must be 256..65536');
  }
  validateEnvAllowlist(normalized.envAllowlist);
  return normalized;
}

export async function spawnBounded(command, argv, options = {}) {
  const {
    cwd = packageRoot,
    env = {},
    timeoutMs = 5000,
    maxStdoutBytes = 32768,
    maxStderrBytes = 16384,
    signal
  } = options;
  const killGraceMs = options.killGraceMs ?? 250;
  const started = process.hrtime.bigint();
  const stdout = { parts: [], bytes: 0, truncated: false };
  const stderr = { parts: [], bytes: 0, truncated: false };
  let timedOut = false;
  let cancelled = false;
  let settled = false;
  let graceTimer = null;

  const child = spawn(command, argv, {
    cwd,
    env,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const terminate = (reason) => {
    if (settled) {
      return;
    }
    if (reason === 'timeout') {
      timedOut = true;
    }
    if (reason === 'cancel') {
      cancelled = true;
    }
    try {
      child.kill('SIGTERM');
    } catch {
      // Process may already be gone.
    }
    graceTimer = setTimeout(() => {
      if (!settled) {
        try {
          child.kill('SIGKILL');
        } catch {
          // Process may already be gone.
        }
      }
    }, killGraceMs);
  };

  const timeout = setTimeout(() => terminate('timeout'), timeoutMs);

  const abortHandler = () => terminate('cancel');
  signal?.addEventListener?.('abort', abortHandler, { once: true });
  if (signal?.aborted) {
    terminate('cancel');
  }

  child.stdout.on('data', (chunk) => appendLimited(stdout, chunk, maxStdoutBytes));
  child.stderr.on('data', (chunk) => appendLimited(stderr, chunk, maxStderrBytes));

  const result = await new Promise((resolve) => {
    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    child.on('error', (error) => {
      finish({ exitCode: null, signal: null, spawnError: error.message });
    });
    child.on('close', (exitCode, closeSignal) => {
      finish({ exitCode, signal: closeSignal, spawnError: null });
    });
  });

  clearTimeout(timeout);
  if (graceTimer) {
    clearTimeout(graceTimer);
  }
  signal?.removeEventListener?.('abort', abortHandler);
  const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  const errorCode = result.spawnError
    ? 'EXECUTION_SPAWN_FAILED'
    : cancelled
      ? 'EXECUTION_CANCELLED'
      : timedOut
        ? 'EXECUTION_TIMEOUT'
        : result.exitCode === 0
          ? null
          : 'EXECUTION_NONZERO_EXIT';

  return {
    ok: result.exitCode === 0 && !timedOut && !cancelled && !result.spawnError,
    exitCode: result.exitCode,
    signal: result.signal,
    durationMs: Math.round(durationMs * 100) / 100,
    stdout: redact(Buffer.concat(stdout.parts).toString('utf8')),
    stderr: redact(Buffer.concat(stderr.parts).toString('utf8')),
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated,
    timedOut,
    cancelled,
    errorCode,
    spawnError: result.spawnError
  };
}

export async function withRuntimeTmp(prefix, fn) {
  const runtimeTmp = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(runtimeTmp);
  } finally {
    await fs.rm(runtimeTmp, { recursive: true, force: true });
  }
}
