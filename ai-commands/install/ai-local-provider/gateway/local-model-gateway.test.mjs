import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { createGateway } from './local-model-gateway.mjs';

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('serves a no-cache UI and proxies the OpenAI-compatible API', async () => {
  const upstream = http.createServer((request, response) => {
    if (request.url === '/v1/models') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"data":[{"id":"test-model"}]}');
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const upstreamPort = await listen(upstream);
  const gateway = createGateway({ upstreamUrl: `http://127.0.0.1:${upstreamPort}`, uiHtml: '<h1>Local Model Chat</h1>' });
  const gatewayPort = await listen(gateway);

  try {
    const uiResponse = await fetch(`http://127.0.0.1:${gatewayPort}/`);
    assert.equal(uiResponse.status, 200);
    assert.match(uiResponse.headers.get('cache-control'), /no-store/);
    assert.equal(await uiResponse.text(), '<h1>Local Model Chat</h1>');

    const modelsResponse = await fetch(`http://127.0.0.1:${gatewayPort}/v1/models`);
    assert.equal(modelsResponse.status, 200);
    assert.deepEqual(await modelsResponse.json(), { data: [{ id: 'test-model' }] });

    const healthResponse = await fetch(`http://127.0.0.1:${gatewayPort}/gateway-health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), { status: 'ready', upstream: 'ready' });

    const invalidPathResponse = await new Promise((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port: gatewayPort, path: '//external.invalid/v1/models' }, resolve);
      request.once('error', reject);
      request.end();
    });
    assert.equal(invalidPathResponse.statusCode, 400);
    invalidPathResponse.resume();
  } finally {
    await close(gateway);
    await close(upstream);
  }
});

test('reports loading when the upstream is unavailable', async () => {
  const gateway = createGateway({ upstreamUrl: 'http://127.0.0.1:1', uiHtml: 'ui' });
  const gatewayPort = await listen(gateway);
  try {
    const response = await fetch(`http://127.0.0.1:${gatewayPort}/gateway-health`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).status, 'loading');
  } finally {
    await close(gateway);
  }
});
