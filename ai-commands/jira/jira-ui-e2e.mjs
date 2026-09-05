#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const cli = { labels: [] };
let submit = false;
let validateOnly = false;
let ticketFile = '';
let descriptionFile = '';
let outputDir = process.env.AI_FLOW_OUTPUT_DIR || '';

const takeValue = (index, flag) => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
  return value;
};
const issueKeyPattern = new RegExp(process.env.JIRA_ISSUE_KEY_PATTERN || '^[A-Z][A-Z0-9_]*-[0-9]+$');

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (/^--(delete|remove|trash|archive)(?:-|$)/i.test(arg)) {
    throw new Error('Destructive Jira operations are forbidden; this command never deletes or archives Jira data');
  }
  if (arg === '--submit') submit = true;
  else if (arg === '--validate-only') validateOnly = true;
  else if (arg === '--ticket-file') ticketFile = takeValue(i++, arg);
  else if (arg === '--clone' || arg === '--clone-from') cli.cloneFrom = takeValue(i++, arg);
  else if (arg === '--update' || arg === '--update-issue') cli.updateIssue = takeValue(i++, arg);
  else if (arg === '--description-file') descriptionFile = takeValue(i++, arg);
  else if (arg === '--output-dir') outputDir = takeValue(i++, arg);
  else if (arg === '--project') cli.project = takeValue(i++, arg);
  else if (arg === '--issue-type') cli.issueType = takeValue(i++, arg);
  else if (arg === '--summary') cli.summary = takeValue(i++, arg);
  else if (arg === '--description') cli.description = takeValue(i++, arg);
  else if (arg === '--label') cli.labels.push(takeValue(i++, arg));
  else if (arg === '--priority') cli.priority = takeValue(i++, arg);
  else if (arg === '--assignee') cli.assignee = takeValue(i++, arg);
  else if (arg === '--parent') cli.parent = takeValue(i++, arg);
  else if (arg === '--story-points') cli.storyPoints = takeValue(i++, arg);
  else if (arg === '--help' || arg === '-h') {
    console.log('Usage: jira.command.sh --template | --update ISSUE-KEY (--description TEXT|--description-file FILE) [--summary TEXT] [--submit|--validate-only] | [--clone ISSUE-KEY | --project KEY --issue-type TYPE] --summary TEXT (--description TEXT|--description-file FILE) [--label VALUE ...] [--priority VALUE] [--assignee VALUE] [--parent KEY] [--story-points NUMBER] [--submit|--validate-only]');
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}

let fromFile = {};
if (ticketFile) fromFile = JSON.parse(await readFile(resolve(ticketFile), 'utf8'));
const requestedOperation = String(fromFile.operation || fromFile.action || '').trim().toLowerCase();
if (['delete', 'remove', 'trash', 'archive'].includes(requestedOperation)) {
  throw new Error('Destructive Jira operations are forbidden; this command never deletes or archives Jira data');
}
if (descriptionFile) cli.description = await readFile(resolve(descriptionFile), 'utf8');
const ticket = {
  ...fromFile,
  ...Object.fromEntries(Object.entries(cli).filter(([key, value]) => key !== 'labels' && value !== undefined)),
  labels: [...new Set([...(Array.isArray(fromFile.labels) ? fromFile.labels : []), ...cli.labels])],
};
ticket.project = String(ticket.project || '').trim();
ticket.updateIssue = String(ticket.updateIssue || '').trim().toUpperCase();
ticket.issueType = String(ticket.issueType || (ticket.updateIssue ? '' : 'Task')).trim();
ticket.cloneFrom = String(ticket.cloneFrom || '').trim().toUpperCase();
ticket.summary = String(ticket.summary || '').trim();
ticket.description = String(ticket.description || '').trim();
for (const name of ['priority', 'assignee', 'parent', 'storyPoints']) ticket[name] = String(ticket[name] ?? '').trim();

if (ticket.cloneFrom && ticket.updateIssue) throw new Error('--clone and --update are mutually exclusive');
if (ticket.cloneFrom && !ticket.project) ticket.project = ticket.cloneFrom.split('-')[0];
if (ticket.updateIssue && !ticket.project) ticket.project = ticket.updateIssue.split('-')[0];
const required = ticket.updateIssue
  ? ['updateIssue', 'description']
  : ticket.cloneFrom
    ? ['cloneFrom', 'summary', 'description']
    : ['project', 'issueType', 'summary', 'description'];
const missing = required.filter((name) => !ticket[name]);
if (missing.length) throw new Error(`Missing required ticket fields: ${missing.join(', ')}`);
if (!/^[A-Z][A-Z0-9_]*$/.test(ticket.project)) throw new Error(`Invalid Jira project key: ${ticket.project}`);
if (ticket.cloneFrom && !issueKeyPattern.test(ticket.cloneFrom)) throw new Error(`Invalid Jira source issue key: ${ticket.cloneFrom}`);
if (ticket.updateIssue && !issueKeyPattern.test(ticket.updateIssue)) throw new Error(`Invalid Jira update issue key: ${ticket.updateIssue}`);
if (ticket.updateIssue && ticket.project !== ticket.updateIssue.split('-')[0]) {
  throw new Error(`Jira update project ${ticket.project} does not match issue ${ticket.updateIssue}`);
}
if (ticket.summary && /[\r\n]/.test(ticket.summary)) throw new Error('Invalid Jira summary: line breaks are not allowed');
if (ticket.storyPoints && !/^\d+(?:\.\d+)?$/.test(ticket.storyPoints)) {
  throw new Error('Invalid Jira story points: expected a non-negative number');
}
if (ticket.updateIssue && (ticket.issueType || ticket.labels.length || ticket.priority || ticket.assignee || ticket.parent || ticket.storyPoints)) {
  throw new Error('Existing Jira updates may change only description and an optional summary');
}

const outDir = resolve(outputDir || join(process.cwd(), '.ai', 'jira'));
const resultFile = join(outDir, 'jira-ticket-result.json');
const screenshotFile = join(outDir, 'jira-ticket.png');
const beforeFile = join(outDir, 'jira-ticket-before.json');
const afterFile = join(outDir, 'jira-ticket-after.json');
await mkdir(outDir, { recursive: true });

const publicTicket = { ...ticket };
const result = { status: validateOnly ? 'validated' : 'starting', submitted: submit, ticket: publicTicket };
const saveResult = async () => writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

if (validateOnly) {
  await saveResult();
  console.log('JIRA_TICKET_STATUS: validated');
  console.log(`JIRA_TICKET_RESULT: ${resultFile}`);
  process.exit(0);
}

const baseUrl = String(process.env.JIRA_BASE_URL || 'https://jira.example.invalid').replace(/\/$/, '');
const browseBaseUrl = String(process.env.JIRA_BROWSE_BASE_URL || `${baseUrl}/browse/`).replace(/\/?$/, '/');
const profileDir = resolve(process.env.JIRA_BROWSER_USER_DATA_DIR || join(dirname(outDir), 'jira-playwright-profile'));
const actionTimeout = Number(process.env.JIRA_ACTION_TIMEOUT_MS || 30000);
const authWaitMs = Number(process.env.JIRA_AUTH_WAIT_MS || 180000);
const reviewWaitMs = Number(process.env.JIRA_REVIEW_WAIT_MS || 5000);
const headless = String(process.env.JIRA_HEADLESS || 'false').toLowerCase() === 'true';
const browserMode = String(process.env.JIRA_BROWSER_MODE || 'existing-chrome').toLowerCase();
if (browserMode === 'existing-chrome') {
  try {
    const { addExistingChromeComment, runExistingChromeTicket } = await import('./jira-existing-chrome.mjs');
    const browserResult = await runExistingChromeTicket({
      ticket,
      submit,
      baseUrl,
      browseBaseUrl,
      authWaitMs,
      actionTimeout,
      reviewWaitMs,
    });
    Object.assign(result, browserResult);
    if (!ticket.updateIssue && submit && browserResult.issueKey) {
      const { buildCreatedIssueMarkerComment } = await import('./jira-issue-ownership.mjs');
      const { DEFAULT_AI_CONFIG_REPO_URL, DEFAULT_JIRA_COMMAND_URL } = await import('./jira-update-audit.mjs');
      const timestamp = new Date().toISOString();
      const markerComment = buildCreatedIssueMarkerComment({
        timestamp,
        repoUrl: process.env.AI_CONFIG_REPO_URL || DEFAULT_AI_CONFIG_REPO_URL,
        commandUrl: process.env.AI_CONFIG_JIRA_COMMAND_URL || DEFAULT_JIRA_COMMAND_URL,
      });
      await addExistingChromeComment({ issueKey: browserResult.issueKey, comment: markerComment, browseBaseUrl, authWaitMs, actionTimeout });
      result.ownershipMarkerComment = { status: 'commented', timestamp };
    }
    if (ticket.updateIssue && submit) {
      const { buildUpdateAttributionComment, compareJiraUpdate, DEFAULT_AI_CONFIG_REPO_URL, DEFAULT_JIRA_COMMAND_URL } = await import('./jira-update-audit.mjs');
      await writeFile(beforeFile, `${JSON.stringify(browserResult.before, null, 2)}\n`, 'utf8');
      await writeFile(afterFile, `${JSON.stringify(browserResult.after, null, 2)}\n`, 'utf8');
      result.audit = compareJiraUpdate({ before: browserResult.before, after: browserResult.after, ticket });
      result.audit.beforeFile = beforeFile;
      result.audit.afterFile = afterFile;
      if (!result.audit.verified) {
        throw new Error(`Jira update verification failed: mismatches=${result.audit.mismatches.join(',') || 'none'} unexpectedChangedFields=${result.audit.unexpectedChangedFields.join(',') || 'none'}`);
      }
      const timestamp = new Date().toISOString();
      const attributionComment = buildUpdateAttributionComment({
        timestamp,
        repoUrl: process.env.AI_CONFIG_REPO_URL || DEFAULT_AI_CONFIG_REPO_URL,
        commandUrl: process.env.AI_CONFIG_JIRA_COMMAND_URL || DEFAULT_JIRA_COMMAND_URL,
      });
      await addExistingChromeComment({ issueKey: ticket.updateIssue, comment: attributionComment, browseBaseUrl, authWaitMs, actionTimeout });
      result.attributionComment = { status: 'commented', timestamp, text: attributionComment };
    }
    delete result.before;
    delete result.after;
    await saveResult();
    console.log(`JIRA_TICKET_STATUS: ${result.status}`);
    if (result.issueKey) console.log(`JIRA_TICKET_KEY: ${result.issueKey}`);
    if (result.issueUrl) console.log(`JIRA_TICKET_URL: ${result.issueUrl}`);
    if (result.storyPoints) console.log(`JIRA_TICKET_STORY_POINTS: ${result.storyPoints}`);
    console.log(`JIRA_TICKET_RESULT: ${resultFile}`);
    process.exit(0);
  } catch (error) {
    result.status = 'failed';
    result.error = error instanceof Error ? error.message : String(error);
    await saveResult();
    console.error('JIRA_TICKET_STATUS: failed');
    console.error(`JIRA_TICKET_ERROR: ${result.error}`);
    console.error(`JIRA_TICKET_RESULT: ${resultFile}`);
    process.exit(1);
  }
}
let context;
const { chromium } = await import('@playwright/test').catch(() => {
  throw new Error('Playwright is not installed; run npm install in ai-config before browser execution');
});

const visible = async (locator, timeout = 1000) => locator.first().isVisible({ timeout }).catch(() => false);
const firstVisible = async (locators, timeout = 1500) => {
  for (const locator of locators) if (await visible(locator, timeout)) return locator.first();
  return undefined;
};

const waitForAny = async (locators, timeout) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const locator = await firstVisible(locators, 250);
    if (locator) return locator;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  return undefined;
};

const fillText = async (page, label, selectors, value) => {
  if (!value) return;
  const locator = await firstVisible([
    page.getByLabel(new RegExp(`^${label}`, 'i')),
    ...selectors.map((selector) => page.locator(selector)),
  ]);
  if (!locator) throw new Error(`Could not find Jira ${label} field`);
  await locator.fill(value);
};

const choose = async (page, label, selectors, value) => {
  if (!value) return;
  const locator = await firstVisible([
    page.getByLabel(new RegExp(`^${label}`, 'i')),
    ...selectors.map((selector) => page.locator(selector)),
  ]);
  if (!locator) throw new Error(`Could not find Jira ${label} field`);
  const tag = await locator.evaluate((element) => element.tagName.toLowerCase()).catch(() => '');
  if (tag === 'select') {
    await locator.selectOption({ label: value }).catch(() => locator.selectOption(value));
    return;
  }
  await locator.click();
  if (await locator.isEditable().catch(() => false)) await locator.fill(value);
  const option = page.getByRole('option', { name: value, exact: true }).or(page.getByText(value, { exact: true }));
  if (await visible(option, 3000)) await option.first().click();
  else await locator.press('Enter');
};

try {
  context = await chromium.launchPersistentContext(profileDir, {
    channel: process.env.JIRA_BROWSER_CHANNEL || 'chrome',
    headless,
    viewport: { width: 1600, height: 1000 },
    args: ['--new-window', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(actionTimeout);
  const summaryCandidates = [page.getByLabel(/^Summary/i), page.locator('#summary'), page.locator('input[name="summary"]')];
  const descriptionCandidates = [
    page.getByLabel(/^Description/i),
    page.locator('#description'),
    page.locator('textarea[name="description"]'),
    page.locator('[contenteditable="true"][data-testid*="description"]'),
    page.locator('.ProseMirror[contenteditable="true"]'),
  ];
  if (ticket.updateIssue) {
    await page.goto(`${baseUrl}/browse/${ticket.updateIssue}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (/login|auth|sso|signin/i.test(page.url()) || await visible(page.getByText(/log in|sign in|single sign-on/i), 1000)) {
      console.log(`JIRA_AUTH_REQUIRED: complete Jira SSO in the opened browser within ${authWaitMs}ms`);
    }
    const edit = await waitForAny([
      page.getByRole('button', { name: /^Edit$/i }),
      page.getByRole('link', { name: /^Edit$/i }),
      page.locator('#edit-issue'),
      page.locator('[data-testid*="issue.edit"]'),
    ], authWaitMs);
    if (!edit) throw new Error(`Jira issue ${ticket.updateIssue} or its Edit control did not become available before the authentication timeout`);
    await edit.click();
    if (!(await waitForAny(descriptionCandidates, actionTimeout))) throw new Error('Jira Edit form did not open');
  } else if (ticket.cloneFrom) {
    await page.goto(`${baseUrl}/browse/${ticket.cloneFrom}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (/login|auth|sso|signin/i.test(page.url()) || await visible(page.getByText(/log in|sign in|single sign-on/i), 1000)) {
      console.log(`JIRA_AUTH_REQUIRED: complete Jira SSO in the opened browser within ${authWaitMs}ms`);
    }
    const actionTriggers = [
      page.getByRole('button', { name: /^(More|Actions)$/i }),
      page.locator('#opsbar-operations_more'),
      page.locator('[data-testid*="issue.actions"]'),
    ];
    const actions = await waitForAny(actionTriggers, authWaitMs);
    if (!actions) throw new Error(`Jira issue ${ticket.cloneFrom} or its actions menu did not become available before the authentication timeout`);
    await actions.click();
    const cloneAction = await firstVisible([
      page.getByRole('menuitem', { name: /^Clone$/i }),
      page.getByRole('link', { name: /^Clone$/i }),
      page.getByText(/^Clone$/i),
      page.locator('#clone-issue'),
    ], 5000);
    if (!cloneAction) throw new Error('Could not find Clone in the Jira issue actions menu');
    await cloneAction.click();
    if (!(await waitForAny(summaryCandidates, actionTimeout))) throw new Error('Jira Clone form did not open');
  } else {
    await page.goto(`${baseUrl}/secure/CreateIssue!default.jspa`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!(await firstVisible(summaryCandidates, 2500))) {
      if (/login|auth|sso|signin/i.test(page.url()) || await visible(page.getByText(/log in|sign in|single sign-on/i), 1000)) {
        console.log(`JIRA_AUTH_REQUIRED: complete Jira SSO in the opened browser within ${authWaitMs}ms`);
      }
      const createTriggers = [
        page.getByRole('link', { name: /^Create$/i }),
        page.locator('#create_link'),
        page.locator('[data-testid="create-button"]'),
      ];
      const ready = await waitForAny([...summaryCandidates, ...createTriggers], authWaitMs);
      if (!ready) throw new Error('Jira create form did not become available before the authentication timeout');
      if (!(await firstVisible(summaryCandidates, 1000))) await ready.click();
    }
    await choose(page, 'Project', ['#project-field', 'select[name="pid"]'], ticket.project);
    await choose(page, 'Issue Type', ['#issuetype-field', 'select[name="issuetype"]'], ticket.issueType);
  }

  await fillText(page, 'Summary', ['#summary', 'input[name="summary"]'], ticket.summary);

  const description = await firstVisible(descriptionCandidates, 3000);
  if (!description) throw new Error('Could not find Jira Description field');
  if (await description.isEditable().catch(() => false)) await description.fill(ticket.description);
  else {
    await description.click();
    await page.keyboard.insertText(ticket.description);
  }

  if (!ticket.updateIssue) {
    await choose(page, 'Priority', ['#priority-field', 'select[name="priority"]'], ticket.priority);
    await choose(page, 'Assignee', ['#assignee-field', 'input[name="assignee"]'], ticket.assignee);
    await fillText(page, 'Parent', ['#parent-field', 'input[name="parent"]'], ticket.parent);
    for (const label of ticket.labels) {
      await choose(page, 'Labels', ['#labels-textarea', 'input[name="labels"]'], label);
    }
    const storyPointsFieldId = process.env.JIRA_STORY_POINTS_FIELD_ID || 'customfield_10004';
    await fillText(page, 'Story Points', [`#${storyPointsFieldId}`, `input[name="${storyPointsFieldId}"]`], ticket.storyPoints);
  }

  await page.screenshot({ path: screenshotFile, fullPage: true });
  if (!submit) {
    result.status = 'preview';
    await saveResult();
    console.log('JIRA_TICKET_STATUS: preview');
    console.log(`JIRA_TICKET_SCREENSHOT: ${screenshotFile}`);
    console.log(`JIRA_TICKET_RESULT: ${resultFile}`);
    await page.waitForTimeout(reviewWaitMs);
    process.exitCode = 0;
  } else {
    const submitLabel = ticket.updateIssue ? 'Update' : ticket.cloneFrom ? 'Clone' : 'Create';
    const scope = page.getByRole('dialog').or(page.locator('form')).first();
    const create = await firstVisible([
      scope.getByRole('button', { name: new RegExp(`^${submitLabel}$`, 'i') }),
      page.locator('button[type="submit"]').filter({ hasText: new RegExp(`^${submitLabel}$`, 'i') }),
      page.locator('#create-issue-submit'),
      page.locator('#clone-issue-submit'),
      page.locator('#edit-issue-submit'),
    ], 5000);
    if (!create) throw new Error(`Could not find Jira form ${submitLabel} button`);
    await create.click();
    await page.waitForURL(/\/browse\/[A-Z][A-Z0-9_]*-\d+|selectedIssue=/, { timeout: 60000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const pageText = await page.locator('body').innerText().catch(() => '');
    const urlKey = page.url().match(/\/browse\/([A-Z][A-Z0-9_]*-\d+)/)?.[1] || '';
    const textKeys = pageText.match(new RegExp(`${ticket.project}-\\d+`, 'g')) || [];
    const key = ticket.updateIssue || (urlKey && urlKey !== ticket.cloneFrom ? urlKey : '')
      || textKeys.find((candidate) => candidate !== ticket.cloneFrom)
      || '';
    if (!key) throw new Error('Jira form was submitted, but the issue key could not be confirmed');
    result.status = ticket.updateIssue ? 'updated' : 'created';
    result.issueKey = key;
    result.issueUrl = `${baseUrl}/browse/${key}`;
    if (ticket.storyPoints) {
      const storyPointsMatch = pageText.match(/Story Points\s*:?\s*\n?\s*(\d+(?:\.\d+)?)/i);
      const actualStoryPoints = storyPointsMatch?.[1] || '';
      if (actualStoryPoints !== ticket.storyPoints) {
        throw new Error(`Jira story-point verification failed: expected ${ticket.storyPoints}, actual ${actualStoryPoints || 'missing'}`);
      }
      result.storyPoints = actualStoryPoints;
    }
    await page.screenshot({ path: screenshotFile, fullPage: true });
    await saveResult();
    console.log(`JIRA_TICKET_STATUS: ${result.status}`);
    console.log(`JIRA_TICKET_KEY: ${key}`);
    console.log(`JIRA_TICKET_URL: ${result.issueUrl}`);
    if (result.storyPoints) console.log(`JIRA_TICKET_STORY_POINTS: ${result.storyPoints}`);
    console.log(`JIRA_TICKET_RESULT: ${resultFile}`);
  }
} catch (error) {
  result.status = 'failed';
  result.error = error instanceof Error ? error.message : String(error);
  await saveResult();
  console.error(`JIRA_TICKET_STATUS: failed`);
  console.error(`JIRA_TICKET_ERROR: ${result.error}`);
  console.error(`JIRA_TICKET_RESULT: ${resultFile}`);
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => undefined);
}
