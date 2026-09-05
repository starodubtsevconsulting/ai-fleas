#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runExistingChromeJavaScript } from './jira-existing-chrome.mjs';
import { hasExistingAiConfigCommentLink } from './jira-comment-dedupe.mjs';

const args = process.argv.slice(2);
let issueKey = '';
let body = '';
let bodyFile = '';
let outputDir = process.env.AI_FLOW_OUTPUT_DIR || '';
let submit = false;
let validateOnly = false;
let skipIfLinkExists = false;
const mentions = [];
const links = [];

const takeValue = (index, flag) => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
  return value;
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--issue') issueKey = takeValue(index++, arg);
  else if (arg === '--body') body = takeValue(index++, arg);
  else if (arg === '--comment-file') bodyFile = takeValue(index++, arg);
  else if (arg === '--mention') mentions.push(takeValue(index++, arg));
  else if (arg === '--link') links.push(takeValue(index++, arg));
  else if (arg === '--output-dir') outputDir = takeValue(index++, arg);
  else if (arg === '--submit') submit = true;
  else if (arg === '--validate-only') validateOnly = true;
  else if (arg === '--skip-if-link-exists') skipIfLinkExists = true;
  else if (arg === '--help' || arg === '-h') {
    console.log('Usage: jira.command.sh comment ISSUE-KEY (--body TEXT|--comment-file FILE) [--mention USER] [--link "LABEL|URL"] [--skip-if-link-exists] [--submit|--validate-only]');
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}

issueKey = issueKey.trim().toUpperCase();
const issuePattern = new RegExp(process.env.JIRA_ISSUE_KEY_PATTERN || '^[A-Z][A-Z0-9_]*-[0-9]+$');
if (!issuePattern.test(issueKey)) throw new Error(`Invalid Jira issue key: ${issueKey || '(missing)'}`);
if (body && bodyFile) throw new Error('Use either --body or --comment-file, not both');
if (bodyFile) body = await readFile(resolve(bodyFile), 'utf8');
body = body.trim();
if (!body) throw new Error('A non-empty comment is required through --body or --comment-file');

for (const mention of mentions) {
  if (!/^[A-Za-z0-9._-]+$/.test(mention)) throw new Error(`Invalid Jira mention username: ${mention}`);
}
const formattedLinks = links.map((link) => {
  const separator = link.indexOf('|');
  if (separator <= 0) throw new Error(`Invalid --link value; expected LABEL|URL: ${link}`);
  const label = link.slice(0, separator).trim();
  const url = link.slice(separator + 1).trim();
  if (!label || /[\[\]|\r\n]/.test(label)) throw new Error(`Invalid Jira link label: ${label || '(empty)'}`);
  if (!/^https:\/\/[^\s\]]+$/.test(url)) throw new Error(`Jira link URL must be HTTPS: ${url}`);
  return { label, url };
});

const sections = [body];
if (mentions.length) sections.push(`FYI: ${mentions.map((mention) => `[~${mention}]`).join(' ')}`);
if (formattedLinks.length) sections.push(`References:\n${formattedLinks.map(({ label, url }) => `* [${label}|${url}]`).join('\n')}`);
if (!body.includes('/created-with-ai-config')) sections.push('/created-with-ai-config');
const formattedComment = sections.join('\n\n');

const outDir = resolve(outputDir || join(process.cwd(), '.ai', 'jira'));
const resultFile = join(outDir, 'jira-comment-result.json');
await mkdir(outDir, { recursive: true });
const issueUrl = `${String(process.env.JIRA_BROWSE_BASE_URL || 'https://jira.example.invalid/browse/').replace(/\/?$/, '/')}${issueKey}`;
const result = { status: validateOnly ? 'validated' : 'starting', submitted: submit, issueKey, issueUrl, formattedComment, mentions, links: formattedLinks, skipIfLinkExists };
const saveResult = () => writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

if (validateOnly) {
  await saveResult();
  console.log('JIRA_COMMENT_STATUS: validated');
  console.log(`JIRA_COMMENT_RESULT: ${resultFile}`);
  process.exit(0);
}

const run = (source) => runExistingChromeJavaScript(`(() => { ${source} })()`);
const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
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
  await run(`window.location.href = ${JSON.stringify(issueUrl)}; return 'done';`);
  // Chrome can acknowledge the navigation before Jira has installed its issue
  // controls. Do not send the Add comment probe into that transition state:
  // an Apple Event can otherwise remain blocked until its transport timeout.
  await poll(
    "return document.readyState === 'complete' && document.body ? 'ready' : 'waiting';",
    'Jira issue page did not finish loading before the comment action',
  );
  if (skipIfLinkExists) {
    const comments = JSON.parse(await run(`
      const nodes = [...document.querySelectorAll('[id^="comment-"], [data-comment-id]')];
      return JSON.stringify(nodes.map((node) => ({
        text: node.textContent || '',
        hrefs: [...node.querySelectorAll('a[href]')].map((anchor) => anchor.href),
      })));
    `));
    if (hasExistingAiConfigCommentLink({ comments, links: formattedLinks })) {
      result.status = 'skipped-existing-link';
      await saveResult();
      console.log('JIRA_COMMENT_STATUS: skipped-existing-link');
      console.log(`JIRA_COMMENT_URL: ${issueUrl}`);
      console.log(`JIRA_COMMENT_RESULT: ${resultFile}`);
      process.exit(0);
    }
  }
  await poll(`
    const buttons = [...document.querySelectorAll('button,a')];
    const add = document.querySelector('#footer-comment-button') || buttons.find((element) => /^(Add comment|Comment)$/i.test((element.textContent || '').trim()));
    return add ? 'ready' : 'waiting';
  `, 'Jira Add comment control did not load');
  await run(`
    const buttons = [...document.querySelectorAll('button,a')];
    const add = document.querySelector('#footer-comment-button') || buttons.find((element) => /^(Add comment|Comment)$/i.test((element.textContent || '').trim()));
    add.click();
    return 'done';
  `);
  await poll(`return document.querySelector('#comment,textarea[name="comment"]') ? 'ready' : 'waiting';`, 'Jira comment editor did not open');
  await run(`
    const input = document.querySelector('#comment,textarea[name="comment"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(formattedComment)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return 'done';
  `);
  if (!submit) result.status = 'previewed';
  else {
    await poll(`
      const form = document.querySelector('#comment-add,form[action*="AddComment"]') || document;
      const buttons = [...form.querySelectorAll('button,input[type="submit"]')];
      const submit = document.querySelector('#issue-comment-add-submit') || buttons.find((element) => /^(Add|Comment)$/i.test((element.textContent || element.value || '').trim()));
      if (!submit) return 'waiting';
      submit.click();
      return 'ready';
    `, 'Jira Add comment submit button did not load');
    await poll(`
      const expectedBody = ${JSON.stringify(body)};
      const expectedLinks = ${JSON.stringify(formattedLinks.map(({ url }) => url))};
      const comments = [...document.querySelectorAll('[id^="comment-"], [data-comment-id]')];
      const persisted = comments.some((comment) =>
        (comment.textContent || '').includes(expectedBody)
        && expectedLinks.every((url) => [...comment.querySelectorAll('a[href]')].some((anchor) => anchor.href === url))
      );
      return persisted ? 'ready' : 'waiting';
    `, 'Jira comment did not persist with the expected text and links');
    result.status = 'commented';
  }
  await saveResult();
  console.log(`JIRA_COMMENT_STATUS: ${result.status}`);
  console.log(`JIRA_COMMENT_URL: ${issueUrl}`);
  console.log(`JIRA_COMMENT_RESULT: ${resultFile}`);
} catch (error) {
  result.status = 'failed';
  result.error = error instanceof Error ? error.message : String(error);
  await saveResult();
  console.error('JIRA_COMMENT_STATUS: failed');
  console.error(`JIRA_COMMENT_ERROR: ${result.error}`);
  console.error(`JIRA_COMMENT_RESULT: ${resultFile}`);
  process.exitCode = 1;
}
