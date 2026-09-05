#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { navigateExistingChromeTab, runExistingChromeJavaScript } from './jira-existing-chrome.mjs';

const [project, status, outputDir] = process.argv.slice(2);
if (!/^[A-Z][A-Z0-9_]*$/.test(project || '')) throw new Error('Invalid Jira project key');
if (![status, outputDir].every(Boolean)) throw new Error('Missing Jira list-by-status input');
const baseUrl = (process.env.JIRA_BASE_URL || 'https://jira.example.invalid').replace(/\/$/, '');
const boardUrl = String(process.env.JIRA_CURRENT_SPRINT_BOARD_URL || '').trim();
const quote = (value) => `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
const jql = `project = ${project} AND status = ${quote(status)} ORDER BY updated DESC`;
const sourceMode = boardUrl ? 'configured-board' : 'project-status-search';
const sourceUrl = boardUrl || `${baseUrl}/issues/?jql=${encodeURIComponent(jql)}`;
await navigateExistingChromeTab(sourceUrl);
await new Promise((resolve) => setTimeout(resolve, 1800));

const deadline = Date.now() + Number(process.env.JIRA_ACTION_TIMEOUT_MS || 30000);
let encoded = '';
while (Date.now() < deadline) {
  encoded = await runExistingChromeJavaScript(`(() => {
    const requestedStatus = ${JSON.stringify(status)};
    const boardMode = ${JSON.stringify(Boolean(boardUrl))};
    const rows = boardMode
      ? [...document.querySelectorAll('[data-column-id],.ghx-column,.js-column,.rapid-board-column')]
      : [...document.querySelectorAll('tr,[role="row"]')];
    const candidates = [];
    let matchedStatusContainer = !boardMode;
    for (const row of rows) {
      const text = (row.innerText || '').trim();
      if (boardMode) {
        const heading = row.querySelector('.ghx-column-title,[data-testid*="column-header"],h1,h2,h3,[role="heading"]');
        const headingText = (heading?.innerText || '').trim();
        if (!headingText.toLowerCase().includes(requestedStatus.toLowerCase())) continue;
        matchedStatusContainer = true;
      }
      for (const link of row.querySelectorAll('a[href*="/browse/"]')) {
        const match = link.href.match(/\\/browse\\/([A-Z][A-Z0-9_]*-\\d+)/);
        if (match) candidates.push({ issueKey: match[1], url: link.href.split('?')[0], rowText: text });
      }
    }
    const bodyText = document.body ? document.body.innerText : '';
    const explicitEmpty = boardMode
      ? matchedStatusContainer && candidates.length === 0
      : /No issues (?:were )?found|No issues match/i.test(bodyText);
    const busy = !!document.querySelector('[aria-busy="true"],.loading,.aui-spinner,[data-testid*="loading"]');
    return JSON.stringify({ candidates, matchedStatusContainer, complete: matchedStatusContainer && (candidates.length > 0 || (explicitEmpty && !busy)) });
  })()`);
  if (encoded !== 'missing value' && JSON.parse(encoded).complete) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}

if (!encoded || encoded === 'missing value') throw new Error('Jira status query returned no readable page state');
const page = JSON.parse(encoded);
if (!page.complete) throw new Error('Jira status query did not produce a completed result set before the action timeout');
if (boardUrl && !page.matchedStatusContainer) throw new Error(`Configured Jira board did not expose a readable ${status} column`);
const issues = [...new Map(page.candidates.map((item) => [item.issueKey, item])).values()];
const result = { project, status, sourceMode, sourceUrl, jql: boardUrl ? null : jql, issueCount: issues.length, issues, capturedAt: new Date().toISOString() };
const resultFile = join(outputDir, 'jira-list-by-status-result.json');
await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`);
console.log('JIRA_LIST_BY_STATUS_STATUS: read');
console.log(`JIRA_LIST_BY_STATUS_COUNT: ${issues.length}`);
for (const issue of issues) console.log(`JIRA_LIST_BY_STATUS_ISSUE: ${issue.issueKey} ${issue.url}`);
console.log(`JIRA_LIST_BY_STATUS_RESULT: ${resultFile}`);
