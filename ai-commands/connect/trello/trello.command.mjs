#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireCommandProfile } from '../_runtime/profile/command-profile.guard.mjs';

const idPattern = /^[0-9a-f]{24}$/i;
const shortPattern = /^[A-Za-z0-9]{8}$/;

export class TrelloBlocked extends Error {
  constructor(code) { super(code); this.name = 'TrelloBlocked'; }
}
function blocked(code) { throw new TrelloBlocked(code); }

export function serializeResult(result, env) {
  let output = JSON.stringify(result);
  for (const value of [env.TRELLO_API_KEY, env.TRELLO_API_TOKEN].filter(Boolean)) {
    output = output.replaceAll(value, '[REDACTED]');
  }
  return output + '\n';
}

function cardId(value) {
  if (idPattern.test(value) || shortPattern.test(value)) return value;
  const match = /^https:\/\/trello\.com\/c\/([A-Za-z0-9]{8})(?:\/[^?#]*)?$/.exec(value || '');
  if (!match) blocked('INVALID_CARD');
  return match[1];
}

function exactId(value) {
  if (!idPattern.test(value || '')) blocked('INVALID_ID');
  return value;
}

function content(value, limit = 16384) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) blocked('INVALID_CONTENT');
  return value;
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

async function request(resource, env, fetcher, method = 'GET', fields) {
  let response;
  const authorization = authHeader(env);
  try {
    response = await fetcher(`https://api.trello.com/1/${resource}`, {
      method, redirect: 'manual',
      headers: {Authorization: authorization, Accept: 'application/json',
        ...(fields ? {'Content-Type': 'application/x-www-form-urlencoded'} : {})},
      ...(fields ? {body: new URLSearchParams(fields).toString()} : {}),
      signal: AbortSignal.timeout(10000),
    });
  } catch { blocked('PROVIDER_UNREACHABLE'); }
  if (response.status !== 200) blocked(response.status === 401 || response.status === 403 ?
    'PROVIDER_AUTH_FAILED' : method === 'GET' ? 'PROVIDER_READ_FAILED' : 'PROVIDER_WRITE_FAILED');
  try { return await response.json(); } catch { blocked('INVALID_PROVIDER_RESPONSE'); }
}

export async function run(args, config, env = process.env, fetcher = fetch) {
  validateConfig(config);
  const [operation, target, ...rest] = args;
  if (!['status', 'read', 'list', 'create', 'update', 'move', 'comment',
    'checklist-add', 'checkitem-add', 'checkitem-set'].includes(operation)) blocked('USAGE');
  const state = value => {
    if (!Object.hasOwn(config.lists, value)) blocked('INVALID_STATE');
    return config.lists[value];
  };
  const checkedCard = async value => {
    const card = await request(`cards/${cardId(value)}?fields=id,idBoard,idList,closed`, env, fetcher);
    if (card?.idBoard !== config.board_id || !Object.values(config.lists).includes(card?.idList) || card.closed) blocked('CARD_OUT_OF_SCOPE');
    return card;
  };
  const checkedList = async value => {
    const id = state(value);
    const list = await request(`lists/${id}?fields=id,idBoard,closed`, env, fetcher);
    if (list?.id !== id || list?.idBoard !== config.board_id || list.closed) blocked('LIST_OUT_OF_SCOPE');
    return id;
  };
  if (operation === 'status') {
    if (target || rest.length) blocked('USAGE');
    await request('members/me?fields=id', env, fetcher);
    return {status: 'authenticated'};
  }
  if (operation === 'read') {
    if (!target || rest.length) blocked('USAGE');
    const card = await request(`cards/${cardId(target)}?fields=id,name,desc,idBoard,idList,url,closed,due,dueComplete`, env, fetcher);
    if (card?.idBoard !== config.board_id || !Object.values(config.lists).includes(card?.idList) ||
        card?.closed) blocked('CARD_OUT_OF_SCOPE');
    return {id: card.id, name: card.name, description: card.desc, list_id: card.idList,
      url: card.url, closed: card.closed, due: card.due, due_complete: card.dueComplete};
  }
  if (operation === 'list') {
    if (rest.length) blocked('USAGE');
    const id = state(target);
    const cards = await request(`lists/${id}/cards?fields=id,name,idBoard,idList,url,closed,due,dueComplete&limit=1000`, env, fetcher);
    if (!Array.isArray(cards) || cards.some(card => card?.idBoard !== config.board_id ||
        card?.idList !== id)) blocked('LIST_OUT_OF_SCOPE');
    if (cards.length === 1000) blocked('PAGINATION_REQUIRED');
    return {state: target, cards: cards.map(card => ({id: card.id, name: card.name,
      list_id: card.idList, url: card.url, closed: card.closed, due: card.due,
      due_complete: card.dueComplete}))};
  }
  if (operation === 'create') {
    if (rest.length < 1 || rest.length > 2) blocked('USAGE');
    const idList = await checkedList(target);
    const card = await request('cards', env, fetcher, 'POST',
      {idList, name: content(rest[0], 512), ...(rest[1] ? {desc: content(rest[1])} : {})});
    if (card?.idBoard !== config.board_id || card?.idList !== idList || !idPattern.test(card?.id || '')) blocked('INVALID_PROVIDER_RESPONSE');
    return {id: card.id, name: card.name, list_id: card.idList, url: card.url};
  }
  if (!target) blocked('USAGE');
  const card = await checkedCard(target);
  if (operation === 'update') {
    if (rest.length !== 2 || !['name', 'description'].includes(rest[0])) blocked('USAGE');
    const field = rest[0] === 'description' ? 'desc' : 'name';
    const updated = await request(`cards/${card.id}`, env, fetcher, 'PUT',
      {[field]: content(rest[1], field === 'name' ? 512 : 16384)});
    if (updated?.id !== card.id || updated?.idBoard !== config.board_id ||
        updated?.idList !== card.idList) blocked('INVALID_PROVIDER_RESPONSE');
    return {id: updated.id, name: updated.name, description: updated.desc, list_id: updated.idList};
  }
  if (operation === 'move') {
    if (rest.length !== 1) blocked('USAGE');
    const idList = await checkedList(rest[0]);
    const moved = await request(`cards/${card.id}`, env, fetcher, 'PUT', {idList});
    if (moved?.id !== card.id || moved?.idBoard !== config.board_id || moved?.idList !== idList) blocked('INVALID_PROVIDER_RESPONSE');
    return {id: moved.id, list_id: moved.idList, state: rest[0]};
  }
  if (operation === 'comment') {
    if (rest.length !== 1) blocked('USAGE');
    const action = await request(`cards/${card.id}/actions/comments`, env, fetcher, 'POST', {text: content(rest[0])});
    if (!idPattern.test(action?.id || '')) blocked('INVALID_PROVIDER_RESPONSE');
    return {card_id: card.id, comment_id: action.id};
  }
  if (operation === 'checklist-add') {
    if (rest.length !== 1) blocked('USAGE');
    const checklist = await request(`cards/${card.id}/checklists`, env, fetcher, 'POST', {name: content(rest[0], 512)});
    if (!idPattern.test(checklist?.id || '') || checklist?.idCard !== card.id) blocked('INVALID_PROVIDER_RESPONSE');
    return {card_id: card.id, checklist_id: checklist.id};
  }
  if (operation === 'checkitem-add') {
    if (rest.length !== 2) blocked('USAGE');
    const checklists = await request(`cards/${card.id}/checklists?fields=id,idCard`, env, fetcher);
    const checklistId = exactId(rest[0]);
    if (!Array.isArray(checklists) || !checklists.some(item => item.id === checklistId && item.idCard === card.id)) blocked('CHECKLIST_OUT_OF_SCOPE');
    const item = await request(`checklists/${checklistId}/checkItems`, env, fetcher, 'POST', {name: content(rest[1], 512)});
    if (!idPattern.test(item?.id || '')) blocked('INVALID_PROVIDER_RESPONSE');
    return {card_id: card.id, checklist_id: checklistId, item_id: item.id};
  }
  if (rest.length !== 3 || !['complete', 'incomplete'].includes(rest[2])) blocked('USAGE');
  const checklistId = exactId(rest[0]);
  const itemId = exactId(rest[1]);
  const checklists = await request(`cards/${card.id}/checklists?checkItems=all`, env, fetcher);
  if (!Array.isArray(checklists) || !checklists.some(item => item.id === checklistId && item.idCard === card.id &&
    item.checkItems?.some(checkItem => checkItem.id === itemId))) blocked('CHECKITEM_OUT_OF_SCOPE');
  const item = await request(`cards/${card.id}/checklist/${checklistId}/checkItem/${itemId}`, env, fetcher, 'PUT', {state: rest[2]});
  if (item?.id !== itemId || item?.state !== rest[2]) blocked('INVALID_PROVIDER_RESPONSE');
  return {card_id: card.id, checklist_id: checklistId, item_id: itemId, state: item.state};
}

if (process.argv[1]?.endsWith('/trello.command.mjs')) {
  try {
    requireCommandProfile('trello', fileURLToPath(import.meta.url));
    const source = fs.readFileSync(process.env.AI_COMMAND_CONFIG_PATH || '', 'utf8');
    const result = await run(process.argv.slice(2), JSON.parse(source));
    process.stdout.write(serializeResult(result, process.env));
  } catch (error) {
    const code = error instanceof TrelloBlocked ? error.message :
      error?.message?.startsWith('PROFILE_') ? error.message : 'INTERNAL_ERROR';
    process.stderr.write('BLOCKED_TRELLO: ' + code + '\n');
    process.exitCode = 2;
  }
}
