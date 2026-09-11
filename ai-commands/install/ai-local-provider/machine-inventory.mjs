#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';

const [boxId, target, preset, configPath] = process.argv.slice(2);
const text = fs.readFileSync(0, 'utf8');
const values = Object.fromEntries(text.trim().split(/\n/).map(line => {
  const separator = line.indexOf('=');
  return separator < 1 ? [line, ''] : [line.slice(0, separator), line.slice(separator + 1)];
}));
const integer = name => /^\d+$/.test(values[name] || '') ? Number(values[name]) : null;
const inventory = {
  schema: 'ai-machine-profile.v1',
  observed_at: new Date().toISOString(),
  target: { kind: 'remote', logical_id: boxId || null, connection: { target } },
  identity: { hostname: values.hostname || null, user: values.user || null },
  operating_system: { id: values.os_id || null, version: values.os_version || null, kernel: values.kernel || null, architecture: values.arch || null },
  cpu: { model: values.cpu_model || null, logical_cpus: integer('cpu_logical'), cores_per_socket: integer('cpu_cores_per_socket'), sockets: integer('cpu_sockets'), numa_nodes: integer('numa_nodes') },
  memory: { total_kb: integer('memory_kb'), total_gib: integer('memory_kb') === null ? null : Math.floor(integer('memory_kb') / 1024 / 1024) },
  storage: { selected_volume: values.storage_volume || '/', volume_total_kb: integer('storage_total_kb'), volume_available_kb: integer('storage_available_kb'), volume_available_gib: integer('storage_available_kb') === null ? null : Math.floor(integer('storage_available_kb') / 1024 / 1024), runtime_root_available_kb: integer('runtime_root_available_kb') },
  gpu: values.gpu_name === 'none' ? null : { name: values.gpu_name || null, vram_mb: integer('gpu_vram_mb'), driver: values.gpu_driver || null },
  access: { sudo: values.sudo || null },
  container: { engine: values.container_engine || null, gpu: values.container_gpu || null },
  services: { ai_local_provider: values.service || null },
  selection: { requested_preset: preset || null }
};

if (configPath) {
  if (!boxId || !fs.statSync(configPath, { throwIfNoEntry: false })?.isFile()) throw new Error('configured box and config file required');
  const config = parse(fs.readFileSync(configPath, 'utf8')) || {};
  if (!config.boxes?.[boxId]) throw new Error(`unknown configured box: ${boxId}`);
  const inventoryDir = path.join(path.dirname(configPath), 'inventory');
  fs.mkdirSync(inventoryDir, { recursive: true, mode: 0o700 });
  const inventoryPath = path.join(inventoryDir, `${boxId}.json`);
  fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, { mode: 0o600 });
  config.boxes[boxId].inventory = path.relative(path.dirname(configPath), inventoryPath);
  fs.writeFileSync(configPath, stringify(config), { mode: 0o600 });
  fs.chmodSync(configPath, 0o600);
  inventory.profile_inventory_path = inventoryPath;
}
process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
