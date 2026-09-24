import test from 'node:test';
import assert from 'node:assert/strict';
import { run, serializeResult } from './trello.command.mjs';

const board = '000000000000000000000001';
const list = '000000000000000000000002';
const config = {version: 1, transport: 'api', board_id: board,
  lists: {backlog: list, in_progress: '000000000000000000000003', done: '000000000000000000000004'}};
const env = {TRELLO_API_KEY: 'key-test', TRELLO_API_TOKEN: 'token-test'};

test('read uses header credentials and rejects cards on other boards', async () => {
  let url;
  const fetcher = async (target, options) => {
    url = target;
    assert.equal(options.headers.Authorization,
      'OAuth oauth_consumer_key="key-test", oauth_token="token-test"');
    assert.equal(options.redirect, 'manual');
    return {status: 200, json: async () => ({id: 'abc', name: 'Card', idBoard: board, idList: list})};
  };
  assert.equal((await run(['read', 'https://trello.com/c/AbCd1234/card'], config, env, fetcher)).name, 'Card');
  assert.match(url, /cards\/AbCd1234\?/);
  await assert.rejects(run(['read', 'AbCd1234'], config, env,
    async () => ({status: 200, json: async () => ({idBoard: '000000000000000000000009'})})),
  /CARD_OUT_OF_SCOPE/);
  await assert.rejects(run(['read', 'AbCd1234'], config, env,
    async () => ({status: 200, json: async () => ({idBoard: board,
      idList: '000000000000000000000099'})})), /CARD_OUT_OF_SCOPE/);
});

test('missing credentials, malformed card, auth failure and offline access fail closed', async () => {
  await assert.rejects(run(['status'], config, {}, async () => { throw Error('unexpected'); }), /CREDENTIAL_REQUIRED/);
  await assert.rejects(run(['read', 'https://example.invalid/c/AbCd1234'], config, env), /INVALID_CARD/);
  await assert.rejects(run(['status'], config, env, async () => ({status: 401})), /PROVIDER_AUTH_FAILED/);
  await assert.rejects(run(['status'], config, env, async () => { throw Error('token-test'); }), /PROVIDER_UNREACHABLE/);
});

test('list inventory rejects foreign board data and incomplete pages', async () => {
  const card = {idBoard: board, idList: list};
  const response = cards => async () => ({status: 200, json: async () => cards});
  assert.equal((await run(['list', 'backlog'], config, env, response([card]))).cards.length, 1);
  await assert.rejects(run(['list', 'backlog'], config, env,
    response([{idBoard: '000000000000000000000009', idList: list}])), /LIST_OUT_OF_SCOPE/);
  await assert.rejects(run(['list', 'backlog'], config, env,
    response(Array(1000).fill(card))), /PAGINATION_REQUIRED/);
});

test('credential values never enter results or error messages', async () => {
  const secretEnv = {TRELLO_API_KEY: 'privateKey123', TRELLO_API_TOKEN: 'privateToken456'};
  const result = await run(['read', 'AbCd1234'], config, secretEnv,
    async () => ({status: 200, json: async () => ({id: 'card', name: 'Safe',
      desc: 'ordinary card', idBoard: board, idList: list})}));
  assert.doesNotMatch(JSON.stringify(result), /privateKey123|privateToken456/);
  assert.equal(serializeResult({description: 'privateToken456 and privateKey123'}, secretEnv),
    '{"description":"[REDACTED] and [REDACTED]"}\n');
  try {
    await run(['status'], config, secretEnv, async () => { throw Error('privateToken456'); });
    assert.fail('offline request must fail');
  } catch (error) {
    assert.equal(error.message, 'PROVIDER_UNREACHABLE');
  }
});

test('create checks destination list and returns only bounded card metadata', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options});
    if (options.method === 'GET') return {status: 200, json: async () => ({id: list, idBoard: board, closed: false})};
    return {status: 200, json: async () => ({id: '000000000000000000000009', idBoard: board,
      idList: list, name: 'Task', url: 'https://trello.com/c/AbCd1234'})};
  };
  const result = await run(['create', 'backlog', 'Task', 'Detail'], config, env, fetcher);
  assert.equal(result.list_id, list);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(new URLSearchParams(calls[1].options.body).get('idList'), list);
  assert.equal(new URLSearchParams(calls[1].options.body).get('name'), 'Task');
  assert.ok(!calls[1].url.includes(env.TRELLO_API_TOKEN));
  await assert.rejects(run(['create', 'backlog', 'Task'], config, env,
    async () => ({status: 200, json: async () => ({id: list, idBoard: '000000000000000000000099'})})),
  /LIST_OUT_OF_SCOPE/);
});

test('updates, moves, comments and checklists require an in-scope open card', async () => {
  const id = '000000000000000000000010';
  const checklistId = '000000000000000000000011';
  const itemId = '000000000000000000000012';
  const commentId = '000000000000000000000013';
  const memberId = '000000000000000000000014';
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options});
    let data;
    if (options.method === 'DELETE') data = {};
    else if (url.includes(`/actions/${commentId}?`)) data = {id: commentId, type: 'commentCard',
      idMemberCreator: memberId, data: {card: {id}, text: 'Note'}};
    else if (url.includes('/actions?filter=commentCard')) data = [{id: commentId, type: 'commentCard',
      idMemberCreator: memberId, data: {card: {id}, text: 'Note'}, date: '2026-09-24T00:00:00.000Z'}];
    else if (url.includes('/members/me?')) data = {id: memberId};
    else if (url.includes('/checkItem/')) data = {id: itemId, state: 'complete'};
    else if (url.includes('/checkItems') && options.method === 'POST') data = {id: itemId};
    else if (url.includes('/checklists') && options.method === 'POST') data = {id: checklistId, idCard: id};
    else if (url.includes('/checklists?')) data = [{id: checklistId, idCard: id, checkItems: [{id: itemId}]}];
    else if (url.includes('/actions/comments')) data = {id: commentId};
    else if (options.method === 'PUT' && new URLSearchParams(options.body).has('idList')) data =
      {id, idBoard: board, idList: config.lists.done};
    else if (options.method === 'PUT') data = {id, idBoard: board, idList: list, name: 'New'};
    else if (url.includes('/lists/')) data = {id: config.lists.done, idBoard: board, closed: false};
    else data = {id, idBoard: board, idList: list, closed: false};
    return {status: 200, json: async () => data};
  };
  assert.equal((await run(['update', id, 'name', 'New'], config, env, fetcher)).name, 'New');
  assert.equal((await run(['move', id, 'done'], config, env, fetcher)).state, 'done');
  assert.equal((await run(['comment', id, 'Note'], config, env, fetcher)).card_id, id);
  assert.equal((await run(['comments', id], config, env, fetcher)).comments[0].id, commentId);
  assert.equal((await run(['comment-delete', id, commentId], config, env, fetcher)).deleted, true);
  assert.equal((await run(['checklist-add', id, 'Checks'], config, env, fetcher)).checklist_id, checklistId);
  assert.equal((await run(['checkitem-add', id, checklistId, 'Item'], config, env, fetcher)).item_id, itemId);
  assert.equal((await run(['checkitem-set', id, checklistId, itemId, 'complete'], config, env, fetcher)).state, 'complete');
  assert.ok(calls.filter(call => call.options.method === 'GET' && call.url.includes(`/cards/${id}?`)).length >= 8);
  assert.ok(calls.some(call => call.options.method === 'DELETE' &&
    call.url.includes(`/cards/${id}/actions/${commentId}/comments`)));
  let writes = 0;
  await assert.rejects(run(['comment', id, 'Note'], config, env, async (url, options) => {
    if (options.method !== 'GET') writes++;
    return {status: 200, json: async () => ({id, idBoard: '000000000000000000000099', idList: list})};
  }), /CARD_OUT_OF_SCOPE/);
  assert.equal(writes, 0);

  let deleteWrites = 0;
  await assert.rejects(run(['comment-delete', id, commentId], config, env, async (url, options) => {
    if (options.method === 'DELETE') deleteWrites++;
    if (url.includes(`/cards/${id}?`)) return {status: 200, json: async () =>
      ({id, idBoard: board, idList: list, closed: false})};
    if (url.includes('/members/me?')) return {status: 200, json: async () => ({id: memberId})};
    return {status: 200, json: async () => ({id: commentId, type: 'commentCard',
      idMemberCreator: '000000000000000000000099', data: {card: {id}, text: 'Foreign'}})};
  }), /COMMENT_OUT_OF_SCOPE/);
  assert.equal(deleteWrites, 0);
});
