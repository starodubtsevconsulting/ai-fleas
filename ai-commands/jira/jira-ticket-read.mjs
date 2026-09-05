#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { navigateExistingChromeTab, runExistingChromeJavaScript } from './jira-existing-chrome.mjs';

const [issueKey, outputDir] = process.argv.slice(2);
if (!/^[A-Z][A-Z0-9_]*-[0-9]+$/.test(issueKey || '')) throw new Error('Invalid Jira issue key');
if (!outputDir) throw new Error('Missing output directory');

const baseUrl = (process.env.JIRA_BROWSE_BASE_URL || 'https://jira.example.invalid/browse/').replace(/\/$/, '/');
await navigateExistingChromeTab(`${baseUrl}${issueKey}`);
await new Promise((resolve) => setTimeout(resolve, 1500));
const encoded = await runExistingChromeJavaScript(`(() => {
  if (!document.body) return JSON.stringify({ error: 'JIRA_PAGE_NOT_READY' });
  const heading = document.querySelector('h1');
  const bodyText = document.body.innerText || '';
  const lines = bodyText.split('\\n').map((line) => line.trim()).filter(Boolean);
  const field = (label) => {
    const index = lines.findIndex((line) => line === label || line === label + ':');
    return index >= 0 ? (lines[index + 1] || null) : null;
  };
  const section = (start, end) => {
    const startIndex = lines.findIndex((line) => line === start);
    if (startIndex < 0) return null;
    const endIndex = lines.findIndex((line, index) => index > startIndex && line === end);
    return lines.slice(startIndex + 1, endIndex > startIndex ? endIndex : undefined).join('\\n') || null;
  };
  const moreIndex = lines.findIndex((line) => line === 'More');
  const mainStatus = moreIndex >= 0 ? (lines[moreIndex + 1] || null) : null;
  const profileElement = [...document.querySelectorAll('a,button')].find((element) =>
    ['aria-label', 'title', 'data-tooltip', 'data-tooltip-text']
      .some((name) => /User profile for/i.test(element.getAttribute(name) || ''))
  );
  const profileDescriptor = profileElement
    ? ['aria-label', 'title', 'data-tooltip', 'data-tooltip-text']
      .map((name) => profileElement.getAttribute(name) || '')
      .find((value) => /User profile for/i.test(value)) || ''
    : '';
  const authenticatedUserMatch = profileDescriptor.match(/User profile for\\s+(.+)/i);
  const titlePrefix = '[' + ${JSON.stringify(issueKey)} + '] ';
  const titleWithoutKey = document.title.startsWith(titlePrefix) ? document.title.slice(titlePrefix.length) : '';
  const jiraSuffixIndex = titleWithoutKey.lastIndexOf(' - ');
  const summaryFromTitle = titleWithoutKey
    ? titleWithoutKey.slice(0, jiraSuffixIndex >= 0 ? jiraSuffixIndex : undefined)
    : null;
  return JSON.stringify({
    issueKey: ${JSON.stringify(issueKey)},
    url: location.href,
    title: document.title,
    summary: heading ? heading.innerText.trim() : summaryFromTitle,
    status: mainStatus,
    type: field('Type'),
    priority: field('Priority'),
    team: field('Team(s)'),
    storyPoints: field('Story Points'),
    sprint: field('Sprint'),
    epicLink: field('Epic Link'),
    assignee: field('Assignee'),
    reporter: field('Reporter'),
    authenticatedUser: authenticatedUserMatch ? authenticatedUserMatch[1].trim() : null,
    description: section('Description', 'Smart Checklist'),
    bodyText,
    capturedAt: new Date().toISOString()
  });
})()`);
const result = JSON.parse(encoded);
if (result.error) throw new Error(result.error);
if (!result.url.includes(`/browse/${issueKey}`)) throw new Error(`Jira navigation mismatch: ${result.url}`);
if (!result.bodyText.includes(issueKey)) throw new Error(`Jira issue ${issueKey} was not present in the rendered page`);
const resultFile = join(outputDir, `${issueKey}.json`);
await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`);
console.log('JIRA_TICKET_STATUS: read');
console.log(`JIRA_TICKET_KEY: ${issueKey}`);
console.log(`JIRA_TICKET_URL: ${result.url}`);
if (result.summary) console.log(`JIRA_TICKET_SUMMARY: ${result.summary}`);
if (result.status) console.log(`JIRA_TICKET_WORKFLOW_STATUS: ${result.status}`);
console.log(`JIRA_TICKET_RESULT: ${resultFile}`);
