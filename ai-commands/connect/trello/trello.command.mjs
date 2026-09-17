#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireCommandProfile } from '../_runtime/profile/command-profile.guard.mjs';

const idPattern = /^[0-9a-f]{24}$/i;
const shortPattern = /^[A-Za-z0-9]{8}$/;
const USAGE = 'usage: trello <status|read CARD_ID_OR_URL|list backlog|list in_progress|list done>';

export class TrelloBlocked extends Error {
  constructor(code) { super(code); this.name = 'TrelloBlocked'; }
}
function blocked(code) { throw new TrelloBlocked(code); }

function cardId(value) {
  if (idPattern.test(value) || shortPattern.test(value)) return value;
  const match = /^https:\/\/trello\.com\/c\/([A-Za-z0-9]{8})(?:\/[^?#]*)?$/.exec(value || '');
  if (!match) blocked('INVALID_CARD');
  return match[1];
}

export function validateConfig(config) {
  if (!config || config.version !== 1 || config.transport !== 'api' ||
      !idPattern.test(config.board_id || '') || !config.lists ||
      Object.keys(config).some(key => !['version', 'transport', 'board_id', 'lists'].includes(key)) ||
      Object.keys(config.lists).sort().join(',') !== 'backlog,done,in_progress' ||
      Object.values(config.lists).some(value => !idPattern.test(value))) blocked('INVALID_CONFIG');
  return config;
}

function authHeader(env) {
  const key = env.TRELLO_API_KEY;
  const token = env.TRELLO_API_TOKEN;
  if (!key || !token || /["\r\n]/.test(key) || /["\r\n]/.test(token)) blocked('CREDENTIAL_REQUIRED');
  return `OAuth oauth_consumer_key="${key}", oauth_token="${token}"`;
}

async function request(resource, env, fetcher) {
  let response;
  const authorization = authHeader(env);
  try {
    response = await fetcher(`https://api.trello.com/1/${resource}`, {
      method: 'GET', redirect: 'manual',
      headers: {Authorization: authorization, Accept: 'application/json'},
      signal: AbortSignal.timeout(10000),
    });
  } catch { blocked('PROVIDER_UNREACHABLE'); }
  if (response.status !== 200) blocked(response.status === 401 || response.status === 403 ?
    'PROVIDER_AUTH_FAILED' : 'PROVIDER_READ_FAILED');
  try { return await response.json(); } catch { blocked('INVALID_PROVIDER_RESPONSE'); }
}

export async function run(args, config, env = process.env, fetcher = fetch) {
  validateConfig(config);
  const [operation, target, extra] = args;
  if (extra || !['status', 'read', 'list'].includes(operation)) blocked('USAGE');
  if (operation === 'status') {
    if (target) blocked('USAGE');
    await request('members/me?fields=id', env, fetcher);
    return {status: 'authenticated'};
  }
  if (operation === 'read') {
    if (!target) blocked('USAGE');
    const card = await request(`cards/${cardId(target)}?fields=id,name,desc,idBoard,idList,url,closed,due,dueComplete`, env, fetcher);
    if (card?.idBoard !== config.board_id) blocked('CARD_OUT_OF_SCOPE');
    return {id: card.id, name: card.name, description: card.desc, list_id: card.idList,
      url: card.url, closed: card.closed, due: card.due, due_complete: card.dueComplete};
  }
  if (!Object.hasOwn(config.lists, target)) blocked('USAGE');
  const cards = await request(`lists/${config.lists[target]}/cards?fields=id,name,idBoard,idList,url,closed,due,dueComplete&limit=1000`, env, fetcher);
  if (!Array.isArray(cards) || cards.some(card => card?.idBoard !== config.board_id ||
      card?.idList !== config.lists[target])) blocked('LIST_OUT_OF_SCOPE');
  if (cards.length === 1000) blocked('PAGINATION_REQUIRED');
  return {state: target, cards: cards.map(card => ({id: card.id, name: card.name,
    list_id: card.idList, url: card.url, closed: card.closed, due: card.due,
    due_complete: card.dueComplete}))};
}

if (process.argv[1]?.endsWith('/trello.command.mjs')) {
  try {
    requireCommandProfile('trello', fileURLToPath(import.meta.url));
    const source = fs.readFileSync(process.env.AI_COMMAND_CONFIG_PATH || '', 'utf8');
    const result = await run(process.argv.slice(2), JSON.parse(source));
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    const code = error instanceof TrelloBlocked ? error.message :
      error?.message?.startsWith('PROFILE_') ? error.message : 'INTERNAL_ERROR';
    process.stderr.write('BLOCKED_TRELLO: ' + code + '\n');
    process.exitCode = 2;
  }
}
