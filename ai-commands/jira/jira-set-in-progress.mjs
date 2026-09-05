#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { navigateExistingChromeTab, runExistingChromeJavaScript } from './jira-existing-chrome.mjs';
import { verifyAiConfigIssueOwnership } from './jira-issue-ownership.mjs';

const args = process.argv.slice(2);
let issueKey = '';
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
  else if (arg === '--output-dir') outputDir = take(index++, arg);
  else if (arg === '--submit') submit = true;
  else if (arg === '--validate-only') validateOnly = true;
  else if (arg === '--help' || arg === '-h') {
    console.log('Usage: jira.command.sh set-in-progress ISSUE-KEY [--submit|--validate-only]');
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}

issueKey = issueKey.trim().toUpperCase();
const issuePattern = new RegExp(process.env.JIRA_ISSUE_KEY_PATTERN || '^[A-Z][A-Z0-9_]*-[0-9]+$');
if (!issuePattern.test(issueKey)) throw new Error(`Invalid Jira issue key: ${issueKey || '(missing)'}`);

const outDir = resolve(outputDir || join(process.cwd(), '.ai', 'jira'));
const resultFile = join(outDir, 'jira-set-in-progress-result.json');
await mkdir(outDir, { recursive: true });
const issueUrl = `${String(process.env.JIRA_BROWSE_BASE_URL || 'https://jira.example.invalid/browse/').replace(/\/?$/, '/')}${issueKey}`;
const result = { status: validateOnly ? 'validated' : 'starting', submitted: submit, issueKey, issueUrl, targetStatus: 'In Progress' };
const save = () => writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
if (validateOnly) {
  await save();
  console.log('JIRA_SET_IN_PROGRESS_STATUS: validated');
  console.log(`JIRA_SET_IN_PROGRESS_RESULT: ${resultFile}`);
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

try {
  await navigateExistingChromeTab(issueUrl);
  await poll(`return document.querySelector('#opsbar-transitions_more') ? 'ready' : 'waiting';`, 'Jira issue status control did not load');
  const snapshot = JSON.parse(await run(`
    const currentUser = document.querySelector('meta[name="ajs-remote-user"]')?.content || '';
    const reporter = document.querySelector('#reporter-val .user-hover')?.getAttribute('rel') || '';
    const comments = [...document.querySelectorAll('[id^="comment-"], [data-comment-id]')].map((comment) => ({
      author: comment.querySelector('a[id^="commentauthor_"]')?.getAttribute('rel') || '',
      text: comment.querySelector('.action-body')?.innerText || comment.innerText || '',
    }));
    const currentStatus = document.querySelector('#opsbar-transitions_more .dropdown-text')?.textContent?.trim() || '';
    return JSON.stringify({ currentUser, reporter, comments, currentStatus });
  `));
  result.currentStatus = snapshot.currentStatus;
  result.ownership = verifyAiConfigIssueOwnership(snapshot);
  if (!result.ownership.owned) {
    throw new Error('Refusing status transition: ticket reporter or an ai-config ownership-marker comment must belong to the authenticated Jira user');
  }
  if (/^In Progress$/i.test(snapshot.currentStatus)) result.status = 'already-in-progress';
  else if (!submit) result.status = 'verified-owned-preview';
  else {
    await run(`document.querySelector('#opsbar-transitions_more').click(); return 'done';`);
    await poll(`
      const menu = document.querySelector('#opsbar-transitions_more_drop');
      const transition = menu && [...menu.querySelectorAll('a,button,[role="menuitem"]')]
        .find((element) => /^In Progress(?:Change status toIn Progress)?/i.test((element.textContent || '').trim()));
      return transition ? 'ready' : 'waiting';
    `, 'Jira In Progress transition did not load');
    await run(`
      const menu = document.querySelector('#opsbar-transitions_more_drop');
      const transition = [...menu.querySelectorAll('a,button,[role="menuitem"]')]
        .find((element) => /^In Progress(?:Change status toIn Progress)?/i.test((element.textContent || '').trim()));
      if (transition instanceof HTMLAnchorElement && transition.href) window.location.href = transition.href;
      else transition.click();
      return 'done';
    `);
    await poll(`
      const confirmation = document.querySelector('#issue-workflow-transition-submit');
      const status = document.querySelector('#opsbar-transitions_more .dropdown-text')?.textContent?.trim() || '';
      return confirmation || /^In Progress$/i.test(status) ? 'ready' : 'waiting';
    `, 'Jira In Progress confirmation did not load');
    await run(`
      const confirmation = document.querySelector('#issue-workflow-transition-submit');
      if (confirmation && /^In Progress$/i.test((confirmation.textContent || confirmation.value || '').trim())) confirmation.click();
      return 'done';
    `);
    await poll(`
      const status = document.querySelector('#opsbar-transitions_more .dropdown-text')?.textContent?.trim() || '';
      return /^In Progress$/i.test(status) ? 'ready' : 'waiting';
    `, 'Jira did not confirm the In Progress status');
    result.status = 'in-progress';
    result.currentStatus = 'In Progress';
  }
  await save();
  console.log(`JIRA_SET_IN_PROGRESS_STATUS: ${result.status}`);
  console.log(`JIRA_SET_IN_PROGRESS_URL: ${issueUrl}`);
  console.log(`JIRA_SET_IN_PROGRESS_RESULT: ${resultFile}`);
} catch (error) {
  result.status = 'failed';
  result.error = error instanceof Error ? error.message : String(error);
  await save();
  console.error('JIRA_SET_IN_PROGRESS_STATUS: failed');
  console.error(`JIRA_SET_IN_PROGRESS_ERROR: ${result.error}`);
  console.error(`JIRA_SET_IN_PROGRESS_RESULT: ${resultFile}`);
  process.exitCode = 1;
}
