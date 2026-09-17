import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from './trello.command.mjs';

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
  try {
    await run(['status'], config, secretEnv, async () => { throw Error('privateToken456'); });
    assert.fail('offline request must fail');
  } catch (error) {
    assert.equal(error.message, 'PROVIDER_UNREACHABLE');
  }
});
