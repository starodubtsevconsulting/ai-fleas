#!/usr/bin/env node
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const run = (command, args = []) => {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};
const df = run('df', ['-Pk', '/']).split(/\n/).at(-1)?.trim().split(/\s+/) || [];
const osVersion = process.platform === 'darwin' ? run('sw_vers', ['-productVersion']) : null;
let gpu = null;
if (process.platform === 'darwin') {
  try {
    const displays = JSON.parse(run('system_profiler', ['SPDisplaysDataType', '-json']));
    const card = displays.SPDisplaysDataType?.[0];
    if (card) gpu = { name: card.sppci_model || null, vram: card.spdisplays_vram || card.spdisplays_vram_shared || null };
  } catch {}
} else {
  const line = run('nvidia-smi', ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits']).split(/\n/)[0];
  if (line) { const [name, vram, driver] = line.split(',').map(value => value.trim()); gpu = { name, vram_mb: Number(vram), driver }; }
}
const profile = {
  schema: 'ai-machine-profile.v1',
  observed_at: new Date().toISOString(),
  target: { kind: 'local', logical_id: null },
  identity: { hostname: os.hostname(), user: os.userInfo().username },
  operating_system: { id: process.platform, version: osVersion, kernel: os.release(), architecture: os.arch() },
  cpu: { model: os.cpus()[0]?.model || null, logical_cpus: os.cpus().length },
  memory: { total_kb: Math.floor(os.totalmem() / 1024), total_gib: Math.floor(os.totalmem() / 1024 ** 3) },
  storage: { root_total_kb: Number(df[1]) || null, root_available_kb: Number(df[3]) || null },
  gpu,
  access: { sudo: null },
  services: { ai_local_provider: null }
};
process.stdout.write(`${JSON.stringify(profile, null, 2)}\n`);
