import { UnknownToolError } from './errors.mjs';

const SAFE_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};
const ANNOTATION_KEYS = Object.keys(SAFE_ANNOTATIONS);
const CLASSIFICATION_KEYS = ['capabilityKind', 'definitionOwner', 'scope'];
const CLASSIFICATIONS = new Set([
  'command-extension|ai-command|reusable',
  'workflow-common|workflow-common|all-workflows'
]);

function publicAnnotations(tool) {
  if (tool.native !== true || tool.publicAnnotations === undefined) return SAFE_ANNOTATIONS;
  const value = tool.publicAnnotations;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !ANNOTATION_KEYS.includes(key)) || ANNOTATION_KEYS.some((key) => typeof value[key] !== 'boolean')) {
    throw new Error(`native tool ${tool.name} has invalid public annotations`);
  }
  return Object.fromEntries(ANNOTATION_KEYS.map((key) => [key, value[key]]));
}

function publicClassification(tool, workflowId) {
  const value = tool.publicClassification;
  const workflowSpecific = value?.capabilityKind === 'workflow-specific' && value.definitionOwner === `workflow:${workflowId}` && value.scope === workflowId && /^[a-z][a-z0-9-]{0,63}$/.test(workflowId);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !CLASSIFICATION_KEYS.includes(key)) || (!workflowSpecific && !CLASSIFICATIONS.has(`${value.capabilityKind}|${value.definitionOwner}|${value.scope}`))) {
    throw new Error(`tool ${tool.name} has invalid public classification`);
  }
  return { capabilityKind: value.capabilityKind, definitionOwner: value.definitionOwner, scope: value.scope };
}

export function createToolRegistry({ workflow, tools, resources = [] }) {
  const byName = new Map();
  for (const tool of tools) {
    if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*\.v[0-9]+$/.test(tool.name)) {
      throw new Error(`unsafe MCP tool name: ${tool.name}`);
    }
    if (byName.has(tool.name)) {
      throw new Error(`duplicate MCP tool name: ${tool.name}`);
    }
    publicClassification(tool, workflow.id);
    byName.set(tool.name, tool);
  }
  return {
    workflow,
    tools,
    resources,
    byName,
    listTools() {
      return tools.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: publicAnnotations(tool)
      }));
    },
    listPublicTools() {
      return tools.map((tool) => ({
        ...this.listTools().find((candidate) => candidate.name === tool.name),
        classification: publicClassification(tool, workflow.id)
      }));
    },
    publicToolGroups() {
      const publicTools = this.listPublicTools();
      return [
        { id: 'commandExtensions', capabilityKind: 'command-extension', definitionOwner: 'ai-command', scope: 'reusable' },
        { id: 'workflowCommon', capabilityKind: 'workflow-common', definitionOwner: 'workflow-common', scope: 'all-workflows' },
        { id: 'workflowSpecific', capabilityKind: 'workflow-specific', definitionOwner: `workflow:${workflow.id}`, scope: workflow.id }
      ].map((group) => {
        const toolNames = publicTools.filter((tool) => tool.classification.capabilityKind === group.capabilityKind).map((tool) => tool.name).sort();
        return { ...group, toolCount: toolNames.length, toolNames };
      });
    },
    async callTool(name, args, requestContext = {}) {
      const tool = byName.get(name);
      if (!tool) {
        throw new UnknownToolError(`Tool is not mounted in workflow ${workflow.id}: ${name}`);
      }
      return tool.invoke(args ?? {}, {
        ...requestContext,
        workflowId: workflow.id
      });
    }
  };
}
