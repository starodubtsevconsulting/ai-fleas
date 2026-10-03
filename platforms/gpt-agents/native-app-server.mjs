/**
 * Native Codex app-server transport, called explicitly by lifecycle controllers.
 * connectNativeAppServer({socketPath}) connects to an existing Unix control socket,
 * performs RFC6455 Upgrade and JSON-RPC initialization, and returns request/close
 * plus explicitly registered server-request handlers for controller-owned tools.
 * Other server requests still require the caller's handler; none auto-approve.
 * This helper never starts a daemon or creates agents: effects depend on the exact
 * RPC method supplied by its caller. Request deadlines and frame sizes are bounded.
 */
import net from 'node:net';
import { randomBytes, createHash } from 'node:crypto';

/** Route decoded RPC messages; server request IDs occupy a separate direction.
 * The injected sender performs transport effects; missing handlers never approve.
 */
export async function routeNativeRpcMessage(body, { pending, sendResponse, onServerRequest }) {
  if (body.id === undefined) return;
  if (typeof body.method === 'string') {
    let response;
    try {
      if (typeof onServerRequest !== 'function') throw new Error('Native server request requires a trusted controller handler');
      response = { id: body.id, result: await onServerRequest(body) };
    } catch (error) {
      response = { id: body.id, error: { code: -32601, message: error.message } };
    }
    await sendResponse(response);
    return;
  }
  const item = pending.get(body.id);
  if (!item) return;
  pending.delete(body.id); clearTimeout(item.timer);
  if (body.error) item.reject(Object.assign(new Error(body.error.message || 'Native RPC failure'), { code: body.error.code, data: body.error.data }));
  else item.resolve(body.result);
}

export function encodeFrame(payload, opcode = 1) {
  const bytes = Buffer.from(payload); const mask = randomBytes(4);
  const lengthBytes = bytes.length < 126 ? 0 : bytes.length <= 65535 ? 2 : 8;
  const frame = Buffer.alloc(2 + lengthBytes + 4 + bytes.length);
  frame[0] = 0x80 | opcode; frame[1] = 0x80 | (lengthBytes === 0 ? bytes.length : lengthBytes === 2 ? 126 : 127);
  if (lengthBytes === 2) frame.writeUInt16BE(bytes.length, 2);
  if (lengthBytes === 8) frame.writeBigUInt64BE(BigInt(bytes.length), 2);
  mask.copy(frame, 2 + lengthBytes);
  for (let i = 0; i < bytes.length; i++) frame[6 + lengthBytes + i] = bytes[i] ^ mask[i % 4];
  return frame;
}

export function decodeFrame(buffer, maxFrameBytes = 8 * 1024 * 1024) {
  if (buffer.length < 2) return null;
  if (buffer[0] & 0x70) throw new Error('Unsupported WebSocket extension');
  const opcode = buffer[0] & 15; const fin = Boolean(buffer[0] & 128);
  if (buffer[1] & 128) throw new Error('Server WebSocket frame must be unmasked');
  let size = buffer[1] & 127; let offset = 2;
  if (size === 126) { if (buffer.length < 4) return null; size = buffer.readUInt16BE(2); offset = 4; }
  if (size === 127) {
    if (buffer.length < 10) return null;
    const big = buffer.readBigUInt64BE(2);
    // The desktop host has emitted a 127-byte JSON-RPC reply with the 64-bit
    // marker followed by a *16-bit* length. Recognize only that exact shape;
    // normal 64-bit frames continue through the strict RFC6455 path below.
    if (big > BigInt(maxFrameBytes) && maxFrameBytes >= 127 && opcode === 1 && fin &&
        buffer[2] === 0 && buffer[3] === 127 &&
        buffer.subarray(4, 10).equals(Buffer.from('{"id":'))) {
      if (buffer.length < 131) return null;
      const payload = buffer.subarray(4, 131);
      let body;
      try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload)); }
      catch { /* Reject malformed data as the oversized 64-bit frame it is. */ }
      if (body && typeof body === 'object' && !Array.isArray(body) &&
          (typeof body.id === 'number' || typeof body.id === 'string') &&
          (Object.hasOwn(body, 'result') || Object.hasOwn(body, 'error')) &&
          !Object.hasOwn(body, 'method'))
        return { opcode, fin, payload, consumed: 131 };
    }
    if (big > BigInt(maxFrameBytes))
      throw new Error(`WebSocket frame exceeds limit (${big} > ${maxFrameBytes} bytes)`);
    size = Number(big); offset = 10;
  }
  if (size > maxFrameBytes)
    throw new Error(`WebSocket frame exceeds limit (${size} > ${maxFrameBytes} bytes)`);
  if (opcode >= 8 && (!fin || size > 125)) throw new Error('Invalid WebSocket control frame');
  if (![0, 1, 8, 9, 10].includes(opcode)) throw new Error('Unsupported WebSocket opcode');
  if (buffer.length < offset + size) return null;
  return { opcode, fin, payload: buffer.subarray(offset, offset + size), consumed: offset + size };
}

export async function connectNativeAppServer({ socketPath, timeoutMs = 15000, maxFrameBytes = 8 * 1024 * 1024,
  clientInfo = { name: 'ai-fleas-controller', version: '1' }, onServerRequest }) {
  if (typeof socketPath !== 'string' || !socketPath.startsWith('/')) throw new Error('Absolute existing socketPath required');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) throw new Error('Invalid request timeout');
  if (!Number.isSafeInteger(maxFrameBytes) || maxFrameBytes < 125 || maxFrameBytes > 64 * 1024 * 1024) throw new Error('Invalid frame size limit');
  const socket = net.createConnection({ path: socketPath });
  const key = randomBytes(16).toString('base64');
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  let buffer = Buffer.alloc(0), upgraded = false, closed = false, sequence = 0, fragments = null, fragmentBytes = 0;
  const pending = new Map();
  const handlers = new Map();
  let resolveUpgrade, rejectUpgrade;
  const upgrade = new Promise((resolve, reject) => { resolveUpgrade = resolve; rejectUpgrade = reject; });
  const timer = setTimeout(() => fail(new Error('Native app-server handshake timed out')), timeoutMs);
  function fail(error) {
    if (closed) return; closed = true; clearTimeout(timer); rejectUpgrade(error);
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear(); socket.destroy();
  }
  function message(payload) {
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload));
    routeNativeRpcMessage(body, { pending, onServerRequest: request => {
      const handler = handlers.get(request.method);
      if (handler) return handler(request);
      if (typeof onServerRequest === 'function') return onServerRequest(request);
      throw new Error('Native server request requires a trusted controller handler');
    }, sendResponse(response) {
      if (!closed) socket.write(encodeFrame(JSON.stringify(response)));
    } }).catch(fail);
  }
  socket.on('connect', () => socket.write(`GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
  socket.on('error', fail); socket.on('close', () => fail(new Error('Native app-server connection closed')));
  socket.on('data', chunk => {
    try {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const boundary = buffer.indexOf('\r\n\r\n');
        if (boundary < 0) { if (buffer.length > 16384) throw new Error('Oversized Upgrade response'); return; }
        if (boundary > 16384) throw new Error('Oversized Upgrade response');
        const lines = buffer.subarray(0, boundary).toString().split('\r\n'); const headers = {};
        for (const line of lines.slice(1)) { const colon = line.indexOf(':'); headers[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim(); }
        if (!/^HTTP\/1\.[01] 101(?: |$)/.test(lines[0]) || headers['sec-websocket-accept'] !== accept || headers.upgrade?.toLowerCase() !== 'websocket' || !headers.connection?.toLowerCase().split(/\s*,\s*/).includes('upgrade')) throw new Error('Invalid native WebSocket Upgrade response');
        upgraded = true; clearTimeout(timer); buffer = buffer.subarray(boundary + 4); resolveUpgrade();
      }
      let frame;
      while ((frame = decodeFrame(buffer, maxFrameBytes))) {
        buffer = buffer.subarray(frame.consumed);
        if (frame.opcode === 8) { fail(new Error('Native app-server sent close')); return; }
        if (frame.opcode === 9) { socket.write(encodeFrame(frame.payload, 10)); continue; }
        if (frame.opcode === 10) continue;
        if (frame.opcode === 1) {
          if (fragments) throw new Error('Nested fragmented message');
          if (frame.fin) { message(frame.payload); continue; }
          fragments = [frame.payload]; fragmentBytes = frame.payload.length;
        } else {
          if (!fragments) throw new Error('Unexpected continuation frame');
          fragments.push(frame.payload); fragmentBytes += frame.payload.length;
        }
        if (fragmentBytes > maxFrameBytes) throw new Error('WebSocket message exceeds limit');
        if (frame.fin) { message(Buffer.concat(fragments)); fragments = null; fragmentBytes = 0; }
      }
    } catch (error) { fail(error); }
  });
  await upgrade;
  function request(method, params = {}) {
    if (closed) return Promise.reject(new Error('Native app-server connection closed'));
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Native RPC timeout: ${method}`)); }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      const body = JSON.stringify({ id, method, params });
      if (Buffer.byteLength(body) > maxFrameBytes) { clearTimeout(timer); pending.delete(id); reject(new Error('Native RPC request exceeds limit')); return; }
      socket.write(encodeFrame(body));
    });
  }
  try {
    await request('initialize', { clientInfo, capabilities: { experimentalApi: true } });
    socket.write(encodeFrame(JSON.stringify({ method: 'initialized' })));
  } catch (error) { fail(error); throw error; }
  return { request,
    registerServerRequestHandler(method, handler) {
      if (closed || typeof method !== 'string' || typeof handler !== 'function' || handlers.has(method))
        throw new Error('Native server handler registration invalid or already owned');
      handlers.set(method, handler);
      return () => { if (handlers.get(method) === handler) handlers.delete(method); };
    },
    close() { if (!closed) { socket.write(encodeFrame(Buffer.alloc(0), 8)); fail(new Error('Native transport closed by caller')); } } };
}
