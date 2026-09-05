#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { navigateExistingChromeTab, runExistingChromeJavaScript } from './jira-existing-chrome.mjs';

const [project, issueType, summary, label, outputDir] = process.argv.slice(2);
if (!/^[A-Z][A-Z0-9_]*$/.test(project || '')) throw new Error('Invalid Jira project key');
if (![issueType, summary, label, outputDir].every(Boolean)) throw new Error('Missing Jira search input');
const baseUrl = (process.env.JIRA_BASE_URL || 'https://jira.example.invalid').replace(/\/$/, '');
const quote = (value) => `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
const jql = `project = ${project} AND issuetype = ${quote(issueType)} ORDER BY created DESC`;
await navigateExistingChromeTab(`${baseUrl}/issues/?jql=${encodeURIComponent(jql)}`);
await new Promise((resolve) => setTimeout(resolve, 1800));
const deadline = Date.now() + Number(process.env.JIRA_ACTION_TIMEOUT_MS || 30000);
let encoded = '';
while (Date.now() < deadline) {
  const redirectedEncoded = await runExistingChromeJavaScript(`(() => {
    const match = location.href.match(/\\/browse\\/([A-Z][A-Z0-9_]*-\\d+)/);
    const expected = ${JSON.stringify(summary)};
    return JSON.stringify({ issueKey: match ? match[1] : '', url: location.href.split('?')[0], matches: !!match && document.body.innerText.includes(expected) });
  })()`);
  if (redirectedEncoded !== 'missing value') {
    const redirected = JSON.parse(redirectedEncoded);
    if (redirected.matches) {
      encoded = JSON.stringify({ url: redirected.url, title: '', candidates: [{ issueKey: redirected.issueKey, url: redirected.url, rowText: summary, source: 'redirected-issue' }], complete: true });
      break;
    }
  }
  encoded = await runExistingChromeJavaScript(`(() => {
  const expected = ${JSON.stringify(summary)};
  const rows = [...document.querySelectorAll('tr,[role="row"]')];
  const candidates = [];
  for (const row of rows) {
    const text = (row.innerText || '').trim();
    if (!text.includes(expected)) continue;
    const links = [...row.querySelectorAll('a[href*="/browse/"]')];
    for (const link of links) {
      const match = link.href.match(/\\/browse\\/([A-Z][A-Z0-9_]*-\\d+)/);
      if (match) candidates.push({ issueKey: match[1], url: link.href, rowText: text });
    }
  }
  const bodyText = document.body ? document.body.innerText : '';
  const explicitEmpty = /No issues (?:were )?found|No issues match/i.test(bodyText);
  const busy = !!document.querySelector('[aria-busy="true"],.loading,.aui-spinner,[data-testid*="loading"]');
  return JSON.stringify({ url: location.href, title: document.title, candidates, complete: candidates.length > 0 || (explicitEmpty && !busy) });
})()`);
  if (encoded === 'missing value') {
    await new Promise((resolve) => setTimeout(resolve, 500));
    continue;
  }
  const snapshot = JSON.parse(encoded);
  if (snapshot.complete) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
const page = JSON.parse(encoded);
if (!page.complete) throw new Error('Jira search did not produce a completed result set before the action timeout');
const unique = [...new Map(page.candidates.map((item) => [item.issueKey, item])).values()];
const result = { project, issueType, summaryExact: summary, requestedLabel: label, summaryMatchedClientSide: true, labelUsedForIdentity: false, jql, matchCount: unique.length, matches: unique, capturedAt: new Date().toISOString() };
const resultFile = join(outputDir, 'jira-search-result.json');
await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`);
console.log('JIRA_SEARCH_STATUS: read');
console.log(`JIRA_SEARCH_MATCH_COUNT: ${unique.length}`);
for (const match of unique) console.log(`JIRA_SEARCH_MATCH: ${match.issueKey} ${match.url}`);
console.log(`JIRA_SEARCH_RESULT: ${resultFile}`);
