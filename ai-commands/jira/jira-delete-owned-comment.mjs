#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { navigateExistingChromeTab, runExistingChromeJavaScript } from './jira-existing-chrome.mjs';
import { AI_CONFIG_COMMENT_MARKER, verifyAiConfigCommentOwnership } from './jira-comment-ownership.mjs';

const args = process.argv.slice(2);
let issueKey = '';
let commentId = '';
let outputDir = process.env.AI_FLOW_OUTPUT_DIR || '';
let submit = false;
let validateOnly = false;
const take = (index, flag) => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
  return value;
};
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--issue') issueKey = take(index++, arg);
  else if (arg === '--comment-id') commentId = take(index++, arg);
  else if (arg === '--output-dir') outputDir = take(index++, arg);
  else if (arg === '--submit') submit = true;
  else if (arg === '--validate-only') validateOnly = true;
  else if (arg === '--help' || arg === '-h') {
    console.log('Usage: jira.command.sh delete-owned-comment ISSUE-KEY --comment-id ID [--submit|--validate-only]');
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}
issueKey = issueKey.trim().toUpperCase();
if (!(new RegExp(process.env.JIRA_ISSUE_KEY_PATTERN || '^[A-Z][A-Z0-9_]*-[0-9]+$')).test(issueKey)) throw new Error(`Invalid Jira issue key: ${issueKey}`);
if (!/^\d+$/.test(commentId)) throw new Error(`Invalid Jira comment ID: ${commentId}`);

const outDir = resolve(outputDir || join(process.cwd(), '.ai', 'jira'));
const resultFile = join(outDir, 'jira-delete-comment-result.json');
await mkdir(outDir, { recursive: true });
const result = { status: validateOnly ? 'validated' : 'starting', submitted: submit, issueKey, commentId, requiredMarker: AI_CONFIG_COMMENT_MARKER };
const save = () => writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
if (validateOnly) {
  await save();
  console.log('JIRA_DELETE_COMMENT_STATUS: validated');
  console.log(`JIRA_DELETE_COMMENT_RESULT: ${resultFile}`);
  process.exit(0);
}

const run = (source) => runExistingChromeJavaScript(`(() => { ${source} })()`);
const wait = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));
const timeout = Number(process.env.JIRA_ACTION_TIMEOUT_MS || 30000);
const poll = async (source, message) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await run(source)) === 'ready') return;
    await wait(500);
  }
  throw new Error(message);
};
const issueUrl = `${String(process.env.JIRA_BROWSE_BASE_URL || 'https://jira.example.invalid/browse/').replace(/\/?$/, '/')}${issueKey}`;
try {
  await navigateExistingChromeTab(issueUrl);
  await poll(`return document.querySelector(${JSON.stringify(`#comment-${commentId}`)}) ? 'ready' : 'waiting';`, 'Target Jira comment did not load');
  const snapshot = JSON.parse(await run(`
    const root = document.querySelector(${JSON.stringify(`#comment-${commentId}`)});
    const author = root.querySelector('a[id^="commentauthor_"]')?.getAttribute('rel') || '';
    const currentUser = document.querySelector('meta[name="ajs-remote-user"]')?.content
      || document.querySelector('[data-username][id*="user"]')?.getAttribute('data-username') || '';
    const text = root.querySelector('.action-body')?.innerText || '';
    const deleteControl = [...root.querySelectorAll('a,button')].find((element) => /^Delete$/i.test((element.textContent || '').trim()));
    return JSON.stringify({ author, currentUser, text, deleteHref: deleteControl?.getAttribute('href') || '' });
  `));
  result.snapshot = snapshot;
  result.ownership = verifyAiConfigCommentOwnership(snapshot);
  if (!result.ownership.owned) throw new Error('Refusing to delete: comment author/current user/ai-config ownership marker did not all match');
  if (!snapshot.deleteHref) throw new Error('Refusing to delete: the owned comment has no visible Delete control');
  if (!submit) result.status = 'verified-owned-preview';
  else {
    await navigateExistingChromeTab(new URL(snapshot.deleteHref, issueUrl).href);
    await poll(`return document.querySelector('input[type="submit"],button[type="submit"]') ? 'ready' : 'waiting';`, 'Jira delete confirmation did not load');
    await run(`
      const submit = [...document.querySelectorAll('input[type="submit"],button[type="submit"]')]
        .find((element) => /^Delete$/i.test((element.textContent || element.value || '').trim()));
      if (!submit) return 'missing';
      submit.click();
      return 'done';
    `);
    await poll(`return !document.querySelector(${JSON.stringify(`#comment-${commentId}`)}) ? 'ready' : 'waiting';`, 'Owned Jira comment deletion could not be verified');
    result.status = 'deleted-owned-comment';
  }
  await save();
  console.log(`JIRA_DELETE_COMMENT_STATUS: ${result.status}`);
  console.log(`JIRA_DELETE_COMMENT_RESULT: ${resultFile}`);
} catch (error) {
  result.status = 'failed';
  result.error = error instanceof Error ? error.message : String(error);
  await save();
  console.error(`JIRA_DELETE_COMMENT_ERROR: ${result.error}`);
  console.error(`JIRA_DELETE_COMMENT_RESULT: ${resultFile}`);
  process.exitCode = 1;
}
