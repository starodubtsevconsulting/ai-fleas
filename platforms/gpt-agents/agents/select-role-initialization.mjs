import fs from 'node:fs';
import { parse } from 'yaml';
import { resolveDispatchPlan, requireAdapter, loadRegistry } from '../../dispatch-plan.mjs';

export function selectLifecycleRole(profile, workflow, registry, manifest, adapter, roleId) {
  const declaredAgentIds = [manifest?.initializer, ...(manifest?.agents || [])].filter(Boolean).map(role => role.agentId);
  const plan = requireAdapter(resolveDispatchPlan(profile, workflow, registry,
    { operation: 'single-agent', requestedAgentId: roleId, declaredAgentIds }), 'gpt-agents');
  if (adapter?.platform !== 'gpt-agents') throw new Error('LIFECYCLE_ADAPTER_MISMATCH');
  if (roleId === manifest?.initializer?.agentId) {
    const initializer = manifest.initializer;
    const endpoints = adapter.role_endpoints?.filter(e => e.role === roleId) || [];
    if (!initializer.roleDefinition || !initializer.readinessToken || endpoints.length !== 1 ||
        !adapter.role_contracts?.[roleId]) throw new Error('ROLE_CONTRACT_INCOMPLETE: ' + roleId);
    return { ...plan.agents[0], readinessToken: manifest.initializer.readinessToken };
  }
  return { ...plan.agents[0], ...selectIndependentRole(manifest, adapter, roleId) };
}

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
    const [manifestPath, adapterPath, roleId, profilePath, workflowId, registryPath] = process.argv.slice(2);
    if (!manifestPath || !adapterPath) throw new Error('MANIFEST_AND_ADAPTER_REQUIRED');
    const manifest = parse(fs.readFileSync(manifestPath, 'utf8'));
    const adapter = parse(fs.readFileSync(adapterPath, 'utf8'));
    if (!profilePath || !workflowId || !registryPath) throw new Error('PROFILE_WORKFLOW_REGISTRY_REQUIRED');
    const profile = parse(fs.readFileSync(profilePath, 'utf8'));
    const workflows = profile.workflows?.filter(w => w.path === workflowId || w.path === workflowId + '.workflow.md') || [];
    if (workflows.length !== 1) throw new Error('WORKFLOW_SELECTION_AMBIGUOUS');
    process.stdout.write(`${JSON.stringify(selectLifecycleRole(profile, workflows[0], loadRegistry(registryPath), manifest, adapter, roleId))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
