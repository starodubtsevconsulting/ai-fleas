/**
 * Run: node --test platforms/gpt-agents/native-app-server.test.mjs.
 * In-memory codec tests verify masking, lengths, limits and malformed-frame rejection.
 * They create no socket/files and do not prove live desktop lifecycle capabilities.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFrame, decodeFrame, connectNativeAppServer, routeNativeRpcMessage } from './native-app-server.mjs';

test('outgoing RFC6455 frames are masked at each supported length', () => {
  for (const length of [0, 5, 126, 65536]) {
    const payload = Buffer.alloc(length, 42), frame = encodeFrame(payload);
    assert.equal(frame[0], 129); assert.equal(frame[1] & 128, 128);
    const width = length < 126 ? 0 : length <= 65535 ? 2 : 8;
    const mask = frame.subarray(2 + width, 6 + width);
    const decoded = Buffer.from(frame.subarray(6 + width));
    for (let i = 0; i < decoded.length; i++) decoded[i] ^= mask[i % 4];
    assert.deepEqual(decoded, payload);
  }
});
test('incoming text and continuation/control frames decode without consuming partial input', () => {
  assert.equal(decodeFrame(Buffer.from([129])), null);
  assert.equal(decodeFrame(Buffer.from([129, 3, 65])), null);
  assert.deepEqual(decodeFrame(Buffer.from([129, 1, 65])), { opcode: 1, fin: true, payload: Buffer.from('A'), consumed: 3 });
  assert.equal(decodeFrame(Buffer.from([0, 0])).fin, false);
  assert.equal(decodeFrame(Buffer.from([137, 0])).opcode, 9);
});
test('invalid masked, extension, binary, oversized and control frames fail', () => {
  for (const bytes of [[129, 128], [193, 0], [130, 0], [9, 0], [137, 126, 0, 126]]) assert.throws(() => decodeFrame(Buffer.from(bytes)));
  assert.throws(() => decodeFrame(Buffer.from([129, 5]), 4), /limit/);
  assert.throws(() => decodeFrame(Buffer.from([129, 127, 127, 255, 255, 255, 255, 255, 255, 255])), /limit/);
});
test('desktop malformed 127-byte JSON-RPC reply decodes at request ID 10 without widening frame acceptance', () => {
  const prefix = '{"id":10,"result":';
  const payload = Buffer.from(prefix + '"' + 'x'.repeat(127 - Buffer.byteLength(prefix) - 3) + '"}');
  assert.equal(payload.length, 127);
  const frame = Buffer.concat([Buffer.from([0x81, 0x7f, 0x00, 0x7f]), payload]);
  assert.equal(decodeFrame(frame.subarray(0, 10)), null);
  assert.equal(decodeFrame(frame.subarray(0, 130)), null);
  assert.deepEqual(decodeFrame(frame), { opcode: 1, fin: true, payload, consumed: 131 });
  const following = Buffer.concat([frame, Buffer.from([0x81, 1, 65])]);
  assert.equal(decodeFrame(following).consumed, 131);
  assert.deepEqual(decodeFrame(following.subarray(131)).payload, Buffer.from('A'));

  const invalid = Buffer.from(frame);
  invalid[130] = 0x5d; // Invalid JSON, despite the expected length and prefix.
  assert.throws(() => decodeFrame(invalid), /limit/);
  const notification = Buffer.from(frame);
  notification.write('{"foo":', 4);
  assert.throws(() => decodeFrame(notification), /limit/);
  const masked = Buffer.from(frame); masked[1] |= 0x80;
  assert.throws(() => decodeFrame(masked), /unmasked/);
  const binary = Buffer.from(frame); binary[0] = 0x82;
  assert.throws(() => decodeFrame(binary), /limit/);
  const fragmented = Buffer.from(frame); fragmented[0] = 0x01;
  assert.throws(() => decodeFrame(fragmented), /limit/);
  const proper64 = Buffer.concat([Buffer.from([0x81, 0x7f]), Buffer.alloc(8), Buffer.alloc(65536, 65)]);
  proper64.writeBigUInt64BE(65536n, 2);
  assert.equal(decodeFrame(proper64).payload.length, 65536);
  const genuineLarge = Buffer.alloc(10);
  genuineLarge[0] = 0x81; genuineLarge[1] = 0x7f;
  genuineLarge.writeBigUInt64BE(67108865n, 2);
  assert.throws(() => decodeFrame(genuineLarge, 67108864), /limit/);
});
test('transport rejects unsafe connection configuration before dialing', async () => {
  await assert.rejects(connectNativeAppServer({ socketPath: 'relative' }), /Absolute/);
  await assert.rejects(connectNativeAppServer({ socketPath: '/unused', timeoutMs: 0 }), /timeout/);
});
test('server permission request ID collision never resolves a pending client RPC', async () => {
  let resolved = false, rejected = false;
  const pending = new Map([[1, { resolve: () => { resolved = true; }, reject: () => { rejected = true; } }]]);
  const responses = [];
  await routeNativeRpcMessage({ id: 1, method: 'item/permissions/requestApproval', params: {} }, { pending, sendResponse: response => responses.push(response) });
  assert.equal(resolved, false); assert.equal(rejected, false); assert.equal(pending.has(1), true);
  assert.equal(responses[0].error.code, -32601);
  assert.equal(Object.hasOwn(responses[0], 'result'), false);
});
test('trusted server handler returns its explicit response without touching pending clients', async () => {
  const responses = [], pending = new Map();
  await routeNativeRpcMessage({ id: 'server-id', method: 'permission', params: { exact: true } }, {
    pending, sendResponse: response => responses.push(response), onServerRequest: async request => {
      assert.equal(request.params.exact, true); return { decision: 'decline' };
    },
  });
  assert.deepEqual(responses, [{ id: 'server-id', result: { decision: 'decline' } }]);
});
test('unknown replies and notifications are ignored; known replies resolve once', async () => {
  const pending = new Map(), responses = [], values = [];
  const ports = { pending, sendResponse: response => responses.push(response) };
  await routeNativeRpcMessage({ id: 'unknown', result: 'ignored' }, ports);
  await routeNativeRpcMessage({ method: 'notification', params: {} }, ports);
  pending.set(2, { resolve: value => values.push(value), reject: () => assert.fail('unexpected rejection') });
  await routeNativeRpcMessage({ id: 2, result: 'answer' }, ports);
  await routeNativeRpcMessage({ id: 2, result: 'duplicate' }, ports);
  assert.deepEqual(values, ['answer']); assert.deepEqual(responses, []); assert.equal(pending.size, 0);
});
