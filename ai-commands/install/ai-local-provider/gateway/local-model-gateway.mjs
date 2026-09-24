#!/usr/bin/env node

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function cleanHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(([name, value]) => value !== undefined && !HOP_BY_HOP_HEADERS.has(name.toLowerCase())),
  );
}

function json(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(body);
}

function checkUpstream(upstreamUrl, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const target = new URL('/v1/models', upstreamUrl);
    const request = http.get(target, { timeout: timeoutMs }, (response) => {
      response.resume();
      response.once('end', () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) resolve();
        else reject(new Error(`upstream returned ${response.statusCode ?? 'no status'}`));
      });
    });
    request.once('timeout', () => request.destroy(new Error('upstream health check timed out')));
    request.once('error', reject);
  });
}

export function createGateway({ upstreamUrl, uiHtml }) {
  const upstream = new URL(upstreamUrl);
  const server = http.createServer(async (request, response) => {
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) {
      json(response, 400, { error: { message: 'invalid request path', type: 'invalid_request_error' } });
      return;
    }
    const requestUrl = new URL(request.url ?? '/', 'http://gateway.invalid');

    if (request.method === 'GET' && (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html')) {
      response.writeHead(200, {
        'cache-control': 'no-store, no-cache, must-revalidate',
        'clear-site-data': '"cache", "storage"',
        'content-length': Buffer.byteLength(uiHtml),
        'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'",
        'content-type': 'text/html; charset=utf-8',
        expires: '0',
        pragma: 'no-cache',
      });
      response.end(uiHtml);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/gateway-health') {
      try {
        await checkUpstream(upstream);
        json(response, 200, { status: 'ready', upstream: 'ready' });
      } catch (error) {
        json(response, 503, { status: 'loading', upstream: 'unavailable', error: error.message });
      }
      return;
    }

    const target = new URL(upstream);
    target.pathname = requestUrl.pathname;
    target.search = requestUrl.search;
    const headers = cleanHeaders(request.headers);
    headers.host = target.host;
    const upstreamRequest = http.request(target, {
      method: request.method,
      headers,
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, cleanHeaders(upstreamResponse.headers));
      upstreamResponse.pipe(response);
    });

    upstreamRequest.once('error', (error) => {
      if (!response.headersSent) json(response, 502, { error: { message: error.message, type: 'upstream_unavailable' } });
      else response.destroy(error);
    });
    request.pipe(upstreamRequest);
  });

  server.requestTimeout = 0;
  server.headersTimeout = 60_000;
  return server;
}

function parseArguments(argv) {
  const values = {
    listenHost: '127.0.0.1',
    listenPort: 8000,
    upstreamUrl: 'http://127.0.0.1:8001',
    uiFile: new URL('./index.html', import.meta.url),
  };
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`missing value for ${option}`);
    if (option === '--listen-host') values.listenHost = value;
    else if (option === '--listen-port') values.listenPort = Number(value);
    else if (option === '--upstream') values.upstreamUrl = value;
    else if (option === '--ui-file') values.uiFile = pathToFileURL(value);
    else throw new Error(`unknown option: ${option}`);
  }
  if (!Number.isInteger(values.listenPort) || values.listenPort < 1 || values.listenPort > 65_535) {
    throw new Error('listen port must be an integer from 1 to 65535');
  }
  const upstream = new URL(values.upstreamUrl);
  if (upstream.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(upstream.hostname)) {
    throw new Error('upstream must be a loopback HTTP URL');
  }
  return values;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const uiHtml = await readFile(options.uiFile, 'utf8');
  const server = createGateway({ upstreamUrl: options.upstreamUrl, uiHtml });
  server.listen(options.listenPort, options.listenHost, () => {
    process.stdout.write(`local model gateway listening on ${options.listenHost}:${options.listenPort}\n`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exit(1);
  });
}
