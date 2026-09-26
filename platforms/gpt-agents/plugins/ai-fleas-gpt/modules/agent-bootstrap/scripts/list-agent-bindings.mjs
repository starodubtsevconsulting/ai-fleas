import fs from 'node:fs';
import path from 'node:path';

const idPattern = /^[a-z][a-z0-9-]*$/;

export function listAgentBindingCandidates(registry, filterKind, filterId) {
  if (!['profile', 'human'].includes(filterKind) || !idPattern.test(filterId)) {
    throw new Error('FILTER_REQUIRED');
  }
  if (!registry || typeof registry !== 'object' || Array.isArray(registry) ||
      !registry.instances || typeof registry.instances !== 'object' || Array.isArray(registry.instances)) {
    throw new Error('INVALID_HOST_BINDINGS');
  }
  const scopeField = filterKind === 'human' ? 'humanProfileId' : 'profileId';
  return Object.entries(registry.instances)
    .filter(([, binding]) => binding?.scope?.[scopeField] === filterId)
    .map(([taskId, binding]) => ({
      taskId,
      agentId: binding.agentId,
      generation: binding.generation,
      statusClaim: binding.status,
      scope: binding.scope,
    }))
    .sort((left, right) => left.taskId.localeCompare(right.taskId));
}

if (process.argv[1]?.endsWith('/list-agent-bindings.mjs')) {
  try {
    const [filterKind, filterId] = process.argv.slice(2);
    const dataRoot = process.env.PLUGIN_DATA;
    if (!dataRoot) throw new Error('PLUGIN_DATA_REQUIRED');
    const registryPath = path.join(dataRoot, 'agent-bindings.json');
    const registry = fs.existsSync(registryPath)
      ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
      : { instances: {} };
    const candidates = listAgentBindingCandidates(registry, filterKind, filterId);
    process.stdout.write(`${JSON.stringify({ candidates, liveStatus: 'unverified' })}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
