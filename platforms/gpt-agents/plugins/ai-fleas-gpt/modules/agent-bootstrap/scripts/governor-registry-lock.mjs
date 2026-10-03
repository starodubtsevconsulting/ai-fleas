/**
 * Purpose: serialize short Governor binding transitions in the shared plugin registry.
 * Callers: Governor registration, Stop activation, and the explicit Governor initializer.
 * Input: registry path and synchronous transaction callback; output: callback result.
 * Effects: creates and removes one adjacent runtime lock file, never a task or binding.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function withGovernorRegistryLock(registryPath, action, { io = fs, now = Date.now } = {}) {
  if (typeof registryPath !== 'string' || !registryPath || typeof action !== 'function')
    throw new Error('GOVERNOR_LOCK_ARGUMENTS_INVALID');
  const lockPath = `${registryPath}.governor.lock`;
  const owner = randomUUID();
  let descriptor;
  io.mkdirSync(path.dirname(registryPath), { recursive: true });
  try {
    descriptor = io.openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    let stale = false;
    try { stale = now() - io.statSync(lockPath).mtimeMs > 60_000; } catch {}
    if (!stale) throw new Error('GOVERNOR_LIFECYCLE_BUSY');
    io.unlinkSync(lockPath);
    descriptor = io.openSync(lockPath, 'wx', 0o600);
  }
  try {
    io.writeFileSync(descriptor, owner);
    return action();
  } finally {
    io.closeSync(descriptor);
    try {
      if (io.readFileSync(lockPath, 'utf8') === owner) io.unlinkSync(lockPath);
    } catch {}
  }
}
