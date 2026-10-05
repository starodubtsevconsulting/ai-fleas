#!/usr/bin/env node
/**
 * Independently verifies one staged context-capacity integration candidate.
 * Caller: the benchmark coordinator after the worker process is confirmed stopped.
 * Invocation: node verify.mjs RUN_DIRECTORY
 * Input: RUN_DIRECTORY/recognizers/change-approval-recognizer.mjs.
 * Output: JSON group/assertion results on stdout and a zero exit only when all pass.
 * Effects: imports the staged module and executes in-memory cases; writes no files.
 * A passing result verifies fixture behavior only, not process stop, write scope,
 * packet placement, model identity, context configuration, or restoration.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const runDirectory = process.argv[2];
if (!runDirectory) {
  console.error('Usage: node verify.mjs RUN_DIRECTORY');
  process.exit(2);
}

const targetPath = path.resolve(runDirectory, 'recognizers/change-approval-recognizer.mjs');
const moduleUrl = `${pathToFileURL(targetPath).href}?verify=${Date.now()}`;
const { ChangeApprovalRecognizer } = await import(moduleUrl);
const recognizer = new ChangeApprovalRecognizer();

const negative = { recognizedFamily: false };
const positive = {
  recognizedFamily: true,
  family: 'workflow-decision',
  subtype: 'change-approval',
  evidence: [
    'change-request-keyword',
    'approval-keyword',
    'workflow-decision-keyword',
  ],
};
const legacy = {
  recognizedFamily: true,
  family: 'workflow-decision',
  subtype: 'legacy-maintenance',
  evidence: [
    'maintenance-notice-keyword',
    'legacy-authorization-keyword',
    'workflow-decision-keyword',
  ],
};

const input = (normalizedText, compactText = normalizedText.replaceAll(/\s+/g, '')) => ({
  normalizedText,
  compactText,
});

const groups = {
  EARLY: [
    ['CAP-E-mixed-case', input('Change Request\napprove'), positive],
    ['CAP-E-disapprove-negative', input('CHANGE REQUEST\nDISAPPROVE'), negative],
    ['CAP-E-approved-negative', input('CHANGE REQUEST\nAPPROVED'), negative],
    ['CAP-E-approves-negative', input('CHANGE REQUEST\nAPPROVES'), negative],
    ['CAP-E-compact-cannot-prove', input('CHANGE REQUEST', 'changerequestapprove'), negative],
    ['CAP-E-separate-approve-positive', input('CHANGE REQUEST\nDISAPPROVE THEN APPROVE'), positive],
  ],
  MIDDLE: [
    ['CAP-M-phrase-only-negative', input('CHANGE REQUEST'), negative],
    ['CAP-M-approval-only-negative', input('APPROVE'), negative],
    ['CAP-M-both-positive', input('CHANGE REQUEST\nAPPROVE'), positive],
    ['CAP-M-cancelled-veto', input('CHANGE REQUEST\nAPPROVE\nCANCELLED'), negative],
    ['CAP-M-uncancelled-positive', input('CHANGE REQUEST\nAPPROVE\nUNCANCELLED'), positive],
    ['CAP-M-separate-cancelled-veto', input('CHANGE REQUEST\nAPPROVE\nUNCANCELLED THEN CANCELLED'), negative],
  ],
  LATE: [
    ['CAP-L-exact-positive-result', input('CHANGE REQUEST\nAPPROVE'), positive],
    ['CAP-L-exact-negative-result', input('unrelated text'), negative],
  ],
  LEGACY: [
    ['CAP-L-legacy-positive', input('MAINTENANCE NOTICE\nAUTHORIZED'), legacy],
    ['CAP-L-legacy-mixed-case-extra-text', input('Please review Maintenance Notice 42; status Authorized today.'), legacy],
    ['CAP-L-legacy-missing-authorization', input('MAINTENANCE NOTICE'), negative],
    ['CAP-L-legacy-missing-notice', input('AUTHORIZED'), negative],
    ['CAP-L-legacy-plural-negative', input('MAINTENANCE NOTICES\nAUTHORIZED'), negative],
    ['CAP-L-legacy-unauthorized-negative', input('MAINTENANCE NOTICE\nUNAUTHORIZED'), negative],
    ['CAP-L-legacy-compact-cannot-prove', input('', 'maintenancenoticeauthorized'), negative],
  ],
};

const report = { passed: true, groups: {}, assertions: [] };
for (const [group, cases] of Object.entries(groups)) {
  let passed = 0;
  for (const [id, caseInput, expected] of cases) {
    let assertionPassed = true;
    let detail = null;
    try {
      assert.deepEqual(recognizer.recognize(caseInput), expected);
      passed += 1;
    } catch (error) {
      assertionPassed = false;
      detail = error.message;
      report.passed = false;
    }
    report.assertions.push({ id, group, passed: assertionPassed, detail });
  }
  report.groups[group] = { passed, total: cases.length };
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
