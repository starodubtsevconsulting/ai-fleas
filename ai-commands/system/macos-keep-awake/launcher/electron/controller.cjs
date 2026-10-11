const { spawn } = require('node:child_process');

/** Owns exactly one fixed power-assertion process. No shell, config or arbitrary args. */
class AwakeController {
  constructor({ spawnProcess = spawn, confirmStart, parentPid = process.pid } = {}) {
    this.spawnProcess = spawnProcess; this.confirmStart = confirmStart;
    if (!Number.isSafeInteger(parentPid) || parentPid < 1) throw new Error('INVALID_PARENT_PID');
    this.parentPid = parentPid; this.child = null; this.phase = 'inactive';
    this.error = ''; this.generation = 0; this.pending = null; this.closed = null;
  }
  status() { return { phase: this.phase, error: this.error }; }
  start() {
    if (this.phase !== 'inactive') return this.pending || Promise.resolve(this.status());
    this.phase = 'starting'; this.error = ''; const generation = ++this.generation;
    this.pending = this.begin(generation).finally(() => { if (generation === this.generation) this.pending = null; });
    return this.pending;
  }
  async begin(generation) {
    let approved;
    try { approved = await this.confirmStart(); } catch { approved = false; this.error = 'Confirmation unavailable. Try again.'; }
    if (generation !== this.generation) return this.status();
    if (!approved) { this.phase = 'inactive'; return this.status(); }
    let child;
    try { child = this.spawnProcess('/usr/bin/caffeinate', ['-disu', '-w', String(this.parentPid)], { shell: false, stdio: 'ignore' }); }
    catch { this.phase = 'inactive'; this.error = 'Could not start keeping awake.'; return this.status(); }
    this.child = child;
    let resolveClosed;
    this.closed = new Promise(resolve => { resolveClosed = resolve; });
    return new Promise(resolve => {
      child.once('spawn', () => { if (this.child === child && this.phase === 'starting') this.phase = 'active'; resolve(this.status()); });
      child.once('error', () => { if (this.child === child) this.error = 'Power assertion unavailable. Try again after it stops.'; resolve(this.status()); });
      child.once('close', () => {
        if (this.child === child) {
          if (this.phase === 'stopping') this.error = '';
          if (this.phase !== 'stopping' && !this.error) this.error = 'Keeping awake ended unexpectedly. Start again if needed.';
          this.child = null; this.phase = 'inactive'; this.closed = null;
        }
        resolveClosed(); resolve(this.status());
      });
    });
  }
  async stop() {
    if (!this.child) { ++this.generation; this.pending = null; this.phase = 'inactive'; return this.status(); }
    const child = this.child, closed = this.closed;
    if (this.phase !== 'stopping') {
      const previousPhase = this.phase; this.phase = 'stopping';
      try {
        if (!child.kill('SIGTERM')) { this.error = 'Stop is not confirmed. Keep this window open and try Stop again.'; this.phase = previousPhase; return this.status(); }
      } catch { this.error = 'Stop is not confirmed. Keep this window open and try Stop again.'; this.phase = previousPhase; return this.status(); }
    }
    await closed;
    return this.status();
  }
}
module.exports = { AwakeController };
