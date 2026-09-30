import fs from 'node:fs';
import { parse } from 'yaml';

export function selectIndependentRole(manifest, adapter, roleId) {
  if (!roleId || typeof roleId !== 'string') throw new Error('ROLE_REQUIRED');
  const declared = manifest?.agents?.find((entry) => entry.agentId === roleId);
  if (!declared || declared.initializationMode !== 'independent') {
    throw new Error(`ROLE_NOT_INDEPENDENT: ${roleId}`);
  }
  if (declared.requiresTicket !== false || declared.lifecycle !== 'persistent-control') {
    throw new Error(`ROLE_NOT_STANDALONE: ${roleId}`);
  }
  const endpoints = adapter?.role_endpoints?.filter((entry) => entry.role === roleId) ?? [];
  if (endpoints.length !== 1 || adapter?.role_routes?.some((entry) => entry.role === roleId)) {
    throw new Error(`ROLE_ENDPOINT_MISMATCH: ${roleId}`);
  }
  if (!declared.readinessToken || !declared.roleDefinition || !adapter?.role_contracts?.[roleId]) {
    throw new Error(`ROLE_CONTRACT_INCOMPLETE: ${roleId}`);
  }
  return {
    roleId,
    readinessToken: declared.readinessToken,
    roleDefinition: declared.roleDefinition,
    endpoint: endpoints[0],
    schedule: declared.schedule,
  };
}

if (process.argv[1]?.endsWith('/select-role-initialization.mjs')) {
  try {
    const [manifestPath, adapterPath, roleId] = process.argv.slice(2);
    if (!manifestPath || !adapterPath) throw new Error('MANIFEST_AND_ADAPTER_REQUIRED');
    const manifest = parse(fs.readFileSync(manifestPath, 'utf8'));
    const adapter = parse(fs.readFileSync(adapterPath, 'utf8'));
    process.stdout.write(`${JSON.stringify(selectIndependentRole(manifest, adapter, roleId))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
