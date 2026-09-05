#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runExistingChromeJavaScript } from './jira-existing-chrome.mjs';

const args = process.argv.slice(2);
let issueKey = '';
let planFile = '';
let outputDir = process.env.AI_FLOW_OUTPUT_DIR || '';
let submit = false;
let validateOnly = false;

const takeValue = (index, flag) => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
  return value;
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--issue') issueKey = takeValue(index++, arg);
  else if (arg === '--session-plan') planFile = takeValue(index++, arg);
  else if (arg === '--output-dir') outputDir = takeValue(index++, arg);
  else if (arg === '--submit') submit = true;
  else if (arg === '--validate-only') validateOnly = true;
  else if (arg === '--help' || arg === '-h') {
    console.log('Usage: jira.command.sh sync-plan [ISSUE-KEY] [--session-plan FILE] [--submit|--validate-only]');
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}

const issuePattern = new RegExp(process.env.JIRA_ISSUE_KEY_PATTERN || '^[A-Z][A-Z0-9_]*-[0-9]+$');
const issueSearchPattern = /[A-Z][A-Z0-9_]*-[0-9]+/g;
const sessionsRoot = process.env.AI_SESSIONS_ROOT || '';
let sessionPath = '';
let sessionMetadata = '';
if (!planFile) {
  if (!sessionsRoot) throw new Error('AI_SESSIONS_ROOT is required when --session-plan is not provided');
  sessionPath = (await readFile(join(sessionsRoot, '.current-session-path'), 'utf8')).trim();
  if (!sessionPath) throw new Error('No active Flow session is available');
  planFile = join(sessionPath, 'session-plan.md');
  sessionMetadata = await readFile(join(sessionPath, 'session.env'), 'utf8').catch(() => '');
}

const planText = await readFile(resolve(planFile), 'utf8');
if (!issueKey) {
  const candidates = `${sessionMetadata}\n${planText}`.match(issueSearchPattern) || [];
  issueKey = candidates.find((candidate) => issuePattern.test(candidate)) || '';
}
issueKey = issueKey.trim().toUpperCase();
if (!issuePattern.test(issueKey)) {
  throw new Error('Could not infer a valid Jira issue key from the active session; pass it explicitly to sync-plan');
}

const checklistItems = planText
  .split(/\r?\n/)
  .map((line) => line.match(/^\s*-\s+\[([ xX])\]\s+(.+?)\s*$/))
  .filter(Boolean)
  .map((match) => ({
    completed: match[1].toLowerCase() === 'x',
    text: match[2].replace(/`([^`]+)`/g, '{{$1}}'),
  }));
if (!checklistItems.length) throw new Error(`No Markdown checkboxes found in session plan: ${planFile}`);

const managedHeader = '# AI Flow Plan (managed by ai-config)';
const managedFooter = '# End AI Flow Plan (managed by ai-config)';
const managedLines = [
  managedHeader,
  ...checklistItems.map((item) => `${item.completed ? '+' : '-'} ${item.text}`),
  managedFooter,
];

const outDir = resolve(outputDir || join(process.cwd(), '.ai', 'jira'));
const resultFile = join(outDir, 'jira-smart-checklist-result.json');
await mkdir(outDir, { recursive: true });
const result = {
  status: validateOnly ? 'validated' : 'starting',
  submitted: submit,
  issueKey,
  issueUrl: `${String(process.env.JIRA_BROWSE_BASE_URL || 'https://jira.example.invalid/browse/').replace(/\/?$/, '/')}${issueKey}`,
  sessionPlan: resolve(planFile),
  checklistItems,
  managedChecklist: managedLines,
};
const saveResult = () => writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

if (validateOnly) {
  await saveResult();
  console.log('JIRA_SMART_CHECKLIST_STATUS: validated');
  console.log(`JIRA_SMART_CHECKLIST_ITEMS: ${checklistItems.length}`);
  console.log(`JIRA_SMART_CHECKLIST_RESULT: ${resultFile}`);
  process.exit(0);
}

const encode = (value) => Buffer.from(value, 'utf8').toString('base64');
const run = (body) => runExistingChromeJavaScript(`(() => { ${body} })()`);
const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const timeout = Number(process.env.JIRA_ACTION_TIMEOUT_MS || 30000);
const deadline = () => Date.now() + timeout;
const poll = async (body, failureMessage) => {
  const end = deadline();
  while (Date.now() < end) {
    if ((await run(body)) === 'ready') return;
    await wait(500);
  }
  throw new Error(failureMessage);
};

try {
  await run(`window.location.href = ${JSON.stringify(result.issueUrl)}; return 'done';`);
  await poll(`
    const editorFrame = document.querySelector('#rw-checklist-editor-iframe');
    const editor = editorFrame && editorFrame.contentDocument && editorFrame.contentDocument.querySelector('textarea.ace_text-input');
    if (editor) return 'ready';
    const frame = document.querySelector('#rw-checklist');
    const doc = frame && frame.contentDocument;
    return doc && doc.querySelector('[data-testid="edit-button"] button') ? 'ready' : 'waiting';
  `, 'Smart Checklist did not load on the Jira issue');
  const editorAlreadyOpen = await run(`
    const frame = document.querySelector('#rw-checklist-editor-iframe');
    const editor = frame && frame.contentDocument && frame.contentDocument.querySelector('textarea.ace_text-input');
    return editor ? 'ready' : 'closed';
  `);
  if (editorAlreadyOpen !== 'ready') {
    await run(`
    const frame = document.querySelector('#rw-checklist');
    const doc = frame && frame.contentDocument;
    const dismiss = doc && [...doc.querySelectorAll('button')].find((button) => /^Dismiss$/i.test((button.textContent || '').trim()));
    if (dismiss) {
      dismiss.click();
      return 'dismissed';
    }
    return 'ready';
    `);
    await wait(500);
    await poll(`
      const frame = document.querySelector('#rw-checklist');
      const doc = frame && frame.contentDocument;
      const button = doc && doc.querySelector('[data-testid="edit-button"] button');
      if (!button) return 'waiting';
      button.click();
      return 'ready';
    `, 'Smart Checklist Edit button was not available');
  }
  await poll(`
    const frame = document.querySelector('#rw-checklist-editor-iframe');
    const editor = frame && frame.contentDocument && frame.contentDocument.querySelector('textarea.ace_text-input');
    return editor ? 'ready' : 'waiting';
  `, 'Smart Checklist bulk editor did not open');

  const existingValue = await run(`
    const frame = document.querySelector('#rw-checklist-editor-iframe');
    const doc = frame.contentDocument;
    return [...doc.querySelectorAll('.ace_line')].map((line) => line.textContent).join('\\n');
  `);
  const existingLines = existingValue ? existingValue.split(/\r?\n/) : [];
  const unmanagedLines = [];
  for (let index = 0; index < existingLines.length;) {
    if (existingLines[index] !== managedHeader) {
      unmanagedLines.push(existingLines[index]);
      index += 1;
      continue;
    }
    index += 1;
    while (index < existingLines.length && existingLines[index] !== managedFooter && !/^#\s+/.test(existingLines[index])) index += 1;
    if (existingLines[index] === managedFooter) index += 1;
  }
  while (unmanagedLines.at(-1) === '') unmanagedLines.pop();
  const synchronizedLines = [...unmanagedLines, ...(unmanagedLines.length ? [''] : []), ...managedLines];
  const synchronizedValue = synchronizedLines.join('\n').trim();
  const encodedValue = encode(synchronizedValue);

  await run(`
    const frame = document.querySelector('#rw-checklist-editor-iframe');
    const doc = frame.contentDocument;
    const input = doc.querySelector('textarea.ace_text-input');
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', metaKey: true, controlKey: true, bubbles: true }));
    doc.execCommand('insertText', false, atob('${encodedValue}'));
    return 'done';
  `);
  await wait(500);

  if (!submit) {
    await run(`
      const frame = document.querySelector('#rw-checklist-editor-iframe');
      const doc = frame.contentDocument;
      const cancel = [...doc.querySelectorAll('button')].find((button) => /^Cancel$/i.test((button.textContent || '').trim()));
      if (cancel) cancel.click();
      return 'done';
    `);
    result.status = 'previewed';
  } else {
    await run(`
      const frame = document.querySelector('#rw-checklist-editor-iframe');
      const doc = frame.contentDocument;
      const save = [...doc.querySelectorAll('button')].find((button) => /^Save$/i.test((button.textContent || '').trim()));
      if (!save) return 'missing';
      save.click();
      return 'done';
    `);
    await poll(`
      const wrapper = document.querySelector('#rw-checklist-editor');
      return !wrapper || getComputedStyle(wrapper).display === 'none' ? 'ready' : 'waiting';
    `, 'Smart Checklist did not finish saving');
    const encodedItems = encode(JSON.stringify(checklistItems));
    await poll(`
      const frame = document.querySelector('#rw-checklist');
      const doc = frame && frame.contentDocument;
      const inputs = doc && [...doc.querySelectorAll('input[type="checkbox"]')];
      return inputs && inputs.length >= ${checklistItems.length} ? 'ready' : 'waiting';
    `, 'Smart Checklist items did not render after saving');
    const statusResult = await run(`
      const desiredItems = JSON.parse(atob('${encodedItems}'));
      const frame = document.querySelector('#rw-checklist');
      const doc = frame && frame.contentDocument;
      const inputs = [...doc.querySelectorAll('input[type="checkbox"]')];
      for (const item of desiredItems) {
        const textFragments = item.text.split(/[A-Z][A-Z0-9_]*-\\d+/).map((value) => value.trim()).filter(Boolean);
        const input = inputs.find((candidate) => {
          let container = candidate.parentElement;
          while (container && !/^Checklist-item-\\d+$/.test(container.getAttribute('data-testid') || '')) container = container.parentElement;
          const renderedText = container && (container.innerText || '');
          return renderedText && (renderedText.includes(item.text) || textFragments.some((fragment) => fragment.length >= 12 && renderedText.includes(fragment)));
        });
        if (!input) {
          if (item.completed) return 'missing:' + item.text;
          continue;
        }
        if (input.checked !== item.completed) input.click();
      }
      return 'done';
    `);
    if (statusResult !== 'done') throw new Error(`Could not synchronize Smart Checklist item status: ${statusResult}`);
    await wait(500);
    result.status = 'synced';
  }
  await saveResult();
  console.log(`JIRA_SMART_CHECKLIST_STATUS: ${result.status}`);
  console.log(`JIRA_SMART_CHECKLIST_ITEMS: ${checklistItems.length}`);
  console.log(`JIRA_SMART_CHECKLIST_URL: ${result.issueUrl}`);
  console.log(`JIRA_SMART_CHECKLIST_RESULT: ${resultFile}`);
} catch (error) {
  result.status = 'failed';
  result.error = error instanceof Error ? error.message : String(error);
  await saveResult();
  console.error('JIRA_SMART_CHECKLIST_STATUS: failed');
  console.error(`JIRA_SMART_CHECKLIST_ERROR: ${result.error}`);
  console.error(`JIRA_SMART_CHECKLIST_RESULT: ${resultFile}`);
  process.exitCode = 1;
}
