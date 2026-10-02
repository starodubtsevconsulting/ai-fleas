/**
 * Purpose: select the platform for workflow-context command activation.
 * Caller: profile-runtime.sh invokes this automatically before command execution.
 * Invocation: node select-platform.mjs PROFILE WORKFLOW_PATH REGISTRY [EXPECTED_PLATFORM].
 * Effects: reads YAML configuration/contracts, prints one platform ID; no lifecycle writes.
 * No trusted role identity is supplied by this shell transport, so it does not infer
 * an agent from an instance name or apply role-specific execution overrides.
 */
import fs from 'node:fs';
import { parse } from 'yaml';
import { pathToFileURL } from 'node:url';
import { loadRegistry, resolveDispatchPlan } from '../../../platforms/dispatch-plan.mjs';

export function selectPlatform(profile, workflowPath, registry, expected = '') {
  const matches = (profile.workflows || []).filter(w => w.path === workflowPath);
  if (matches.length !== 1) throw new Error('WORKFLOW_SELECTION_INVALID');
  const workflow = matches[0];
  const contextId = '__workflow_context__';
  const plan = resolveDispatchPlan(profile, workflow, registry, {
    operation: 'single-agent', requestedAgentId: contextId,
    declaredAgentIds: [...new Set([contextId, ...Object.keys(workflow.agent_overrides || {})])],
  });
  const selected = workflow.platform ?? profile.platforms.default;
  if (plan.agents[0].platformId !== selected || Object.values(workflow.agent_overrides || {}).some(o => 'platform' in o && o.platform !== selected)) throw new Error('PLATFORM_AGENT_IDENTITY_REQUIRED');
  if (expected && expected !== selected) throw new Error('PLATFORM_REQUEST_MISMATCH: ' + expected + ' != ' + selected);
  return selected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [profileFile, workflowPath, registryFile, expected] = process.argv.slice(2);
    process.stdout.write(selectPlatform(parse(fs.readFileSync(profileFile, 'utf8')), workflowPath, loadRegistry(registryFile), expected) + '\n');
  } catch (error) { process.stderr.write('PROFILE_BLOCKED: ' + error.message + '\n'); process.exitCode = 1; }
}
