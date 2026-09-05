import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createWorkflowMcpServer } from './mcp-server.mjs';

async function readJsonBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) {
      throw new Error('request body too large');
    }
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
}

function writeJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function publicWorkflowIdentity(workflow) {
  return {
    id: workflow.id,
    version: workflow.version
  };
}

export async function startWorkflowHttpMcpServer({ registry, host = '127.0.0.1', port = 0 }) {
  if (host !== '127.0.0.1') {
    throw new Error('Part 1 local MCP server must bind only to 127.0.0.1');
  }
  const transports = new Set();
  const protocolServers = new Set();
  const httpServer = http.createServer(async (req, res) => {
    let transport;
    let mcpServer;
    try {
      const url = new URL(req.url || '/', `http://${host}`);
      if (url.pathname === '/healthz' && req.method === 'GET') {
        writeJson(res, 200, {
          ok: true,
          transport: 'streamable-http',
          workflow: publicWorkflowIdentity(registry.workflow),
          mountedToolCount: registry.tools.length
        });
        return;
      }
      if (url.pathname === '/tools' && req.method === 'GET') {
        const tools = registry.listPublicTools();
        writeJson(res, 200, {
          ok: true,
          transport: 'streamable-http',
          workflow: publicWorkflowIdentity(registry.workflow),
          mountedToolCount: tools.length,
          tools,
          capabilityGroups: registry.publicToolGroups()
        });
        return;
      }
      if (url.pathname !== '/mcp' || req.method !== 'POST') {
        writeJson(res, 404, { ok: false, errorCode: 'NOT_FOUND' });
        return;
      }
      const body = await readJsonBody(req);
      mcpServer = createWorkflowMcpServer(registry);
      protocolServers.add(mcpServer);
      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      transports.add(transport);
      res.on('close', async () => {
        transports.delete(transport);
        protocolServers.delete(mcpServer);
        await Promise.allSettled([transport.close(), mcpServer.close()]);
      });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      if (!res.headersSent) {
        writeJson(res, 500, {
          ok: false,
          errorCode: 'MCP_HTTP_FAILURE',
          message: error.message
        });
      } else {
        res.end();
      }
    }
  });
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });
  const address = httpServer.address();
  return {
    host,
    port: address.port,
    url: `http://${host}:${address.port}/mcp`,
    async close() {
      await Promise.allSettled([...transports].map((transport) => transport.close()));
      await Promise.allSettled([...protocolServers].map((server) => server.close()));
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}
