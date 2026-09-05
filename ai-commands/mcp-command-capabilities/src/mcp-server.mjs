import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { ToolInputError, UnknownToolError } from './errors.mjs';
export { createToolRegistry } from './registry.mjs';

function jsonTool(value, isError = false) {
  return {
    isError,
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

export function createWorkflowMcpServer(registry) {
  const server = new Server(
    {
      name: `${registry.workflow.id}-workflow-mcp`,
      version: registry.workflow.version ?? '0.1.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.listTools()
  }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: registry.resources.map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      mimeType: resource.mimeType ?? 'application/json',
      description: resource.description
    }))
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = registry.resources.find((candidate) => candidate.uri === request.params.uri);
    if (!resource) {
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              ok: false,
              errorCode: 'UNKNOWN_RESOURCE'
            }, null, 2)
          }
        ]
      };
    }
    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType ?? 'application/json',
          text: JSON.stringify(await resource.read(), null, 2)
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
      const result = await registry.callTool(request.params.name, request.params.arguments, {
        signal: extra?.signal
      });
      return jsonTool(result, !result.ok);
    } catch (error) {
      const errorCode = error.errorCode || 'TOOL_CALL_FAILED';
      return jsonTool({
        schemaVersion: 'workflow-command-capability-error.v1',
        ok: false,
        errorCode,
        message: error.message,
        requestedTool: request.params.name
      }, true);
    }
  });

  return server;
}
