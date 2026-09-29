#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const runDir = path.resolve(process.argv[2] || '');
if (!runDir || !fs.statSync(runDir, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('usage: verify.mjs RUN_DIRECTORY');
  process.exit(2);
}

const target = path.join(runDir, 'recognizers', 'snow-removal-contract-recognizer.mjs');
assert.equal(fs.statSync(target, { throwIfNoEntry: false })?.isFile(), true, 'target recognizer is missing');

const allowedFiles = new Set([
  'TASK.md',
  'agent-output.txt',
  'usage.json',
  'wall-time-seconds.txt',
  'recognizers/snow-removal-contract-recognizer.mjs',
]);
const discovered = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = path.relative(runDir, full).split(path.sep).join('/');
    if (entry.isDirectory()) walk(full);
    else discovered.push(relative);
  }
}
walk(runDir);
const unexpected = discovered.filter((file) => !allowedFiles.has(file));
assert.deepEqual(unexpected, [], `unexpected files created: ${unexpected.join(', ')}`);

const moduleUrl = pathToFileURL(target);
moduleUrl.searchParams.set('run', String(Date.now()));
const { SnowRemovalContractRecognizer } = await import(moduleUrl.href);
const recognizer = new SnowRemovalContractRecognizer();

function assertContract(output) {
  assert.equal(output.recognizedFamily, true);
  assert.deepEqual(
    {
      supported: output.result?.supported,
      relevant: output.result?.relevant,
      classification: output.result?.classification,
      confidence: output.result?.confidence,
      documentKind: output.result?.documentKind,
      section: output.result?.section,
    },
    {
      supported: false,
      relevant: false,
      classification: 'uncertain',
      confidence: 0.6,
      documentKind: 'service-contract',
      section: 'review',
    },
  );
}

const frenchVersement = recognizer.recognize({
  normalizedText: 'CONTRAT DE DÉNEIGEMENT\nVERSEMENT 1',
  compactText: 'contrat de deneigement versement 1',
});
assertContract(frenchVersement);
assert.ok(frenchVersement.result.evidenceFlags.includes('versement-keyword'));
assert.ok(!frenchVersement.result.evidenceFlags.includes('paiement-keyword'));

const frenchPaiement = recognizer.recognize({
  normalizedText: 'Contrat de déneigement\nPaiement final',
  compactText: 'contrat de deneigement paiement final',
});
assertContract(frenchPaiement);
assert.ok(frenchPaiement.result.evidenceFlags.includes('paiement-keyword'));
assert.ok(!frenchPaiement.result.evidenceFlags.includes('versement-keyword'));

const english = recognizer.recognize({
  normalizedText: 'SNOW REMOVAL CONTRACT\nPAYMENT DUE',
  compactText: 'snow removal contract payment due',
});
assertContract(english);
assert.ok(english.result.evidenceFlags.includes('service-contract-keyword'));
assert.ok(english.result.evidenceFlags.includes('snow-removal-contract-keyword'));
assert.ok(english.result.evidenceFlags.includes('payment-keyword'));
assert.ok(!english.result.evidenceFlags.includes('contrat-keyword'));
assert.ok(!english.result.evidenceFlags.includes('denigement-keyword'));
assert.ok(!english.result.evidenceFlags.includes('versement-keyword'));
assert.ok(!english.result.evidenceFlags.includes('paiement-keyword'));

const mixedCaseEnglish = recognizer.recognize({
  normalizedText: 'SnOw ReMoVaL CoNtRaCt\nPaYmEnT Due',
  compactText: '',
});
assertContract(mixedCaseEnglish);

const paymentWithDistractor = recognizer.recognize({
  normalizedText: 'SNOW REMOVAL CONTRACT\nPAYMENT DUE AFTER REPAYMENT ADJUSTMENT',
  compactText: 'snow removal contract payment due after repayment adjustment',
});
assertContract(paymentWithDistractor);
assert.ok(paymentWithDistractor.result.evidenceFlags.includes('payment-keyword'));

for (const input of [
  { normalizedText: 'SNOW REMOVAL CONTRACT', compactText: 'snow removal contract' },
  { normalizedText: 'PAYMENT DUE', compactText: 'payment due' },
  { normalizedText: 'SNOW REMOVAL CONTRACT\nREPAYMENT DUE', compactText: 'snow removal contract repayment due' },
  { normalizedText: 'SNOW REMOVAL CONTRACT\nPAYMENTS DUE', compactText: 'snow removal contract payments due' },
]) {
  assert.deepEqual(recognizer.recognize(input), { recognizedFamily: false });
}

console.log('PASS: financial recognizer coding fixture');
