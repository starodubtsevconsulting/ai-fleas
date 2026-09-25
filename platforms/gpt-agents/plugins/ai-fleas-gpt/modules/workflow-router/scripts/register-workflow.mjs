import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const [workflowFile, runtimeFile] = process.argv.slice(2);
const dataRoot = process.env.PLUGIN_DATA;
if (!workflowFile || !dataRoot) {
  fail('usage: PLUGIN_DATA=<dir> node register-workflow.mjs <workflow-map.json> [runtime-scope-and-endpoints.json]');
}

const projection = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));
const runtime = runtimeFile ? JSON.parse(fs.readFileSync(runtimeFile, 'utf8')) : {};
const workflow = { ...projection, ...runtime, stages: projection.stages };
for (const field of ['profileId', 'workflowId', 'logicalProjectId', 'runtimeScopeId']) {
  if (!workflow.scope?.[field]) fail(`workflow.scope requires ${field}`);
}
if (!workflow.stages || !workflow.endpoints) fail('workflow requires stages and endpoints');
for (const [stageId, stage] of Object.entries(workflow.stages)) {
  if (!stage.role || !stage.transitions) fail(`stage ${stageId} requires role and transitions`);
}

fs.mkdirSync(dataRoot, { recursive: true });
const registryPath = path.join(dataRoot, 'bindings.json');
const registry = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  : { schemaVersion: 2, sessions: {}, workflows: {} };
registry.schemaVersion = 2;
registry.sessions ??= {};
registry.workflows ??= {};
const key = ['profileId', 'workflowId', 'logicalProjectId', 'runtimeScopeId']
  .map((field) => workflow.scope[field]).join(':');
registry.workflows[key] = workflow;

const temporary = `${registryPath}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporary, registryPath);
process.stdout.write(`${key}\n`);
