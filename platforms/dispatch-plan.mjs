import fs from 'node:fs';
import { parse } from 'yaml';
import path from 'node:path';
const map = (v, label) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('PLATFORM_CONFIG_INVALID: ' + label);
  return v;
};
export function loadRegistry(p) {
  const root = path.dirname(p instanceof URL ? new URL(p).pathname : path.resolve(p));
  const entries = parse(fs.readFileSync(p, 'utf8')).platforms;
  if (!Array.isArray(entries)) throw new Error('PLATFORM_REGISTRY_INVALID');
  for (const entry of entries) {
    if (typeof entry.contract !== 'string' || entry.contract.split('/').includes('..') || path.isAbsolute(entry.contract)) throw new Error('PLATFORM_CONTRACT_INVALID');
    const contract = parse(fs.readFileSync(path.join(root, entry.contract), 'utf8'));
    if (contract.id !== entry.id) throw new Error('PLATFORM_CONTRACT_MISMATCH');
  }
  return entries;
}
export function resolveDispatchPlan(profile, workflow, registry, request) {
  map(profile, 'profile'); map(workflow, 'workflow'); map(request, 'request');
  if (!Array.isArray(registry) || !registry.length) throw new Error('PLATFORM_REGISTRY_REQUIRED');
  const adapters = new Map();
  for (const e of registry) {
    if (!e?.id || typeof e.contract !== 'string' || !e.contract.startsWith(e.id + '/') ||
        e.contract.split('/').includes('..') || adapters.has(e.id)) throw new Error('PLATFORM_REGISTRY_INVALID');
    adapters.set(e.id, e.contract);
  }
  const config = map(profile.agent_platforms, 'agent_platforms');
  if (!Array.isArray(config.available) || !config.available.length ||
      new Set(config.available).size !== config.available.length) throw new Error('PLATFORM_AVAILABLE_INVALID');
  const check = v => {
    if (typeof v !== 'string' || !v.trim()) throw new Error('PLATFORM_SELECTION_MISSING');
    if (!adapters.has(v)) throw new Error('PLATFORM_UNSUPPORTED: ' + v);
    if (!config.available.includes(v)) throw new Error('PLATFORM_UNAVAILABLE: ' + v);
  };
  for (const v of config.available) if (!adapters.has(v)) throw new Error('PLATFORM_UNSUPPORTED: ' + v);
  check(config.default);
  if ('platform' in profile || 'agent_platform' in profile || 'platform' in workflow || 'agent_platforms' in workflow) throw new Error('PLATFORM_ALIAS_CONFLICT');
  if ('agent_platform' in workflow) check(workflow.agent_platform);
  const overrides = workflow.agent_overrides === undefined ? {} : map(workflow.agent_overrides, 'agent_overrides');
  for (const o of Object.values(overrides)) {
    map(o, 'agent override');
    if ('platform' in o || 'agent_platforms' in o) throw new Error('PLATFORM_ALIAS_CONFLICT');
    if ('agent_platform' in o) check(o.agent_platform);
  }
  const declared = request.declaredAgentIds;
  if (!Array.isArray(declared) || !declared.length || declared.some(id => typeof id !== 'string' || !id) ||
      new Set(declared).size !== declared.length) throw new Error('DECLARED_AGENTS_REQUIRED');
  for (const id of Object.keys(overrides)) if (!declared.includes(id)) throw new Error('UNKNOWN_AGENT_OVERRIDE: ' + id);
  let ids;
  if (request.operation === 'single-agent') {
    if (!declared.includes(request.requestedAgentId)) throw new Error('REQUESTED_AGENT_UNDECLARED');
    ids = [request.requestedAgentId];
  } else if (request.operation === 'full-roster') {
    if (request.requestedAgentId !== undefined) throw new Error('CONFLICTING_DISPATCH_REQUEST');
    ids = declared;
  } else throw new Error('DISPATCH_OPERATION_REQUIRED');
  const agents = ids.map(agentId => {
    const o = overrides[agentId];
    const source = o && 'agent_platform' in o ? 'agent' : 'agent_platform' in workflow ? 'workflow' : 'profile';
    const platformId = source === 'agent' ? o.agent_platform : source === 'workflow' ? workflow.agent_platform : config.default;
    return { agentId, platformId, contract: adapters.get(platformId), source };
  });
  if (request.operation === 'full-roster' && new Set(agents.map(a => a.platformId)).size > 1) throw new Error('MIXED_PLATFORM_ORCHESTRATION_UNSUPPORTED');
  return { operation: request.operation, agents };
}
export function requireAdapter(plan, expected) {
  if (!plan?.agents?.length || plan.agents.some(a => a.platformId !== expected)) throw new Error('LIFECYCLE_ADAPTER_MISMATCH: ' + expected);
  return plan;
}
