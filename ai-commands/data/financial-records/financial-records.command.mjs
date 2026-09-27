#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { requireCommandProfile } from '../../_runtime/profile/command-profile.guard.mjs';
import { PdfReader } from './pdf-reader.mjs';
import { SnowRemovalContractRecognizer } from './recognizers/snow-removal-contract-recognizer.mjs';
import { BookingSourceRecognition } from './recognizers/booking-source-recognition.mjs';
import { canonicalAccountingPdfBasename } from './naming/accounting-recognition-naming-policy.mjs';
import { buildPendingAccountingExtraction, validPendingAccountingExtraction } from './extraction/pending-accounting-extraction.mjs';

const VALID_COMMANDS = new Set(['recognize', 'prepare-review', 'prepare-from-source']);

const FIXED_COMMAND_ERRORS = new Set([
  'DUPLICATE_OPTION',
  'MISSING_VALUE',
  'UNKNOWN_OPTION',
  'USAGE',
  'INVALID_ROOT_NOT_ABSOLUTE',
  'INVALID_SOURCE_NOT_ABSOLUTE',
  'PATH_RESOLVE_FAILED',
  'INVALID_ROOT_NOT_DIRECTORY',
  'INVALID_SOURCE_NOT_FILE',
  'SOURCE_OUTSIDE_ROOT',
  'INVALID_SOURCE_NOT_PDF',
  'PDF_READ_FAILED',
  'INVALID_OPERATION',
  'INVALID_RECOGNITION_NOT_ABSOLUTE',
  'INVALID_RECOGNITION_NOT_FILE',
  'RECOGNITION_OUTSIDE_ROOT',
  'INVALID_RECOGNITION',
  'REVIEW_REQUIRED',
  'INTERNAL_ERROR',
]);

export class FinancialRecordsCommand {
  constructor() {
    this.pdfReader = new PdfReader();
    this.recognizer = new SnowRemovalContractRecognizer();
  }

  async run(argv) {
    const args = argv || [];

    if (args.length === 0) {
      throw new Error('USAGE');
    }

    const command = args[0];
    if (!VALID_COMMANDS.has(command)) {
      throw new Error('INVALID_OPERATION');
    }
    if (command === 'prepare-review') return this.prepareReview(args.slice(1));
    if (command === 'prepare-from-source') return this.prepareFromSource(args.slice(1));

    const options = { root: undefined, source: undefined };
    const seen = new Set();

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--root') {
        if (seen.has('root')) {
          throw new Error('DUPLICATE_OPTION');
        }
        if (i + 1 >= args.length) {
          throw new Error('MISSING_VALUE');
        }
        options.root = args[i + 1];
        seen.add('root');
        i++;
      } else if (arg === '--source') {
        if (seen.has('source')) {
          throw new Error('DUPLICATE_OPTION');
        }
        if (i + 1 >= args.length) {
          throw new Error('MISSING_VALUE');
        }
        options.source = args[i + 1];
        seen.add('source');
        i++;
      } else if (arg.startsWith('--root=')) {
        if (seen.has('root')) {
          throw new Error('DUPLICATE_OPTION');
        }
        options.root = arg.slice('--root='.length);
        seen.add('root');
      } else if (arg.startsWith('--source=')) {
        if (seen.has('source')) {
          throw new Error('DUPLICATE_OPTION');
        }
        options.source = arg.slice('--source='.length);
        seen.add('source');
      } else if (arg.startsWith('--')) {
        // Unknown option
        throw new Error('UNKNOWN_OPTION');
      } else {
        // Positional argument not allowed
        throw new Error('USAGE');
      }
    }

    // Check required options
    if (!options.root || !options.source) {
      throw new Error('USAGE');
    }

    // Verify root and source are absolute paths
    if (!path.isAbsolute(options.root)) {
      throw new Error('INVALID_ROOT_NOT_ABSOLUTE');
    }

    if (!path.isAbsolute(options.source)) {
      throw new Error('INVALID_SOURCE_NOT_ABSOLUTE');
    }

    // Resolve to real paths
    let realRoot;
    let realSource;
    try {
      realRoot = fs.realpathSync(options.root);
      realSource = fs.realpathSync(options.source);
    } catch {
      throw new Error('PATH_RESOLVE_FAILED');
    }

    // Verify root is a directory
    const rootStat = fs.statSync(realRoot);
    if (!rootStat.isDirectory()) {
      throw new Error('INVALID_ROOT_NOT_DIRECTORY');
    }

    // Verify source is a regular file
    const sourceStat = fs.statSync(realSource);
    if (!sourceStat.isFile()) {
      throw new Error('INVALID_SOURCE_NOT_FILE');
    }

    // Verify source is strictly inside root
    const relative = path.relative(realRoot, realSource);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('SOURCE_OUTSIDE_ROOT');
    }

    // Verify source is a PDF file
    if (!this._isPdfFile(realSource)) {
      throw new Error('INVALID_SOURCE_NOT_PDF');
    }

    // Read PDF and recognize
    let pdfContent;
    try {
      pdfContent = await this.pdfReader.read(realSource);
    } catch (error) {
      throw new Error('PDF_READ_FAILED');
    }

    // Recognize using SnowRemovalContractRecognizer
    const recognition = this.recognizer.recognize({
      normalizedText: pdfContent.normalizedText,
      compactText: pdfContent.compactText,
    });

    // Build bounded JSON result
    const result = {
      schemaVersion: 1,
      operation: 'recognize',
      recognizedFamily: recognition.recognizedFamily,
    };

    if (recognition.recognizedFamily && recognition.result) {
      result.result = recognition.result;
    } else {
      result.result = { status: 'review-pending' };
    }

    return result;
  }

  prepareReview(args) {
    const options = {};
    for (let i = 0; i < args.length; i++) {
      const separator = args[i].indexOf('=');
      const key = separator < 0 ? args[i] : args[i].slice(0, separator);
      const inline = separator < 0 ? undefined : args[i].slice(separator + 1);
      if (key !== '--root' && key !== '--recognition') throw new Error('UNKNOWN_OPTION');
      const name = key.slice(2);
      if (Object.hasOwn(options, name)) throw new Error('DUPLICATE_OPTION');
      const value = inline === undefined ? args[++i] : inline;
      if (!value || value.startsWith('--')) throw new Error('MISSING_VALUE');
      options[name] = value;
    }
    if (!options.root || !options.recognition) throw new Error('USAGE');
    if (!path.isAbsolute(options.root)) throw new Error('INVALID_ROOT_NOT_ABSOLUTE');
    if (!path.isAbsolute(options.recognition)) throw new Error('INVALID_RECOGNITION_NOT_ABSOLUTE');
    let root;
    let recognitionPath;
    try {
      root = fs.realpathSync(options.root);
      recognitionPath = fs.realpathSync(options.recognition);
    } catch { throw new Error('PATH_RESOLVE_FAILED'); }
    if (!fs.statSync(root).isDirectory()) throw new Error('INVALID_ROOT_NOT_DIRECTORY');
    const relative = path.relative(root, recognitionPath);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('RECOGNITION_OUTSIDE_ROOT');
    }
    const stat = fs.statSync(recognitionPath);
    if (!stat.isFile() || !recognitionPath.endsWith('.json')) throw new Error('INVALID_RECOGNITION_NOT_FILE');
    if (stat.size > 16 * 1024) throw new Error('INVALID_RECOGNITION');
    let recognition;
    try {
      const input = fs.readFileSync(recognitionPath);
      if (input.length > 16 * 1024) throw new Error('INVALID_RECOGNITION');
      recognition = JSON.parse(input.toString('utf8'));
    }
    catch { throw new Error('INVALID_RECOGNITION'); }
    const proposedFilename = canonicalAccountingPdfBasename(recognition);
    const extraction = buildPendingAccountingExtraction(recognition);
    if (!proposedFilename || !extraction || !validPendingAccountingExtraction(extraction) ||
        Buffer.byteLength(JSON.stringify(extraction)) > 16 * 1024) throw new Error('REVIEW_REQUIRED');
    return { schemaVersion: 1, operation: 'prepare-review', proposedFilename, extraction };
  }

  async prepareFromSource(args) {
    const options = {};
    const allowed = new Set(['root', 'source', 'branch', 'year', 'quarter', 'section']);
    for (let i = 0; i < args.length; i++) {
      const separator = args[i].indexOf('=');
      const key = separator < 0 ? args[i] : args[i].slice(0, separator);
      const name = key.startsWith('--') ? key.slice(2) : '';
      if (!allowed.has(name)) throw new Error('UNKNOWN_OPTION');
      if (Object.hasOwn(options, name)) throw new Error('DUPLICATE_OPTION');
      const value = separator < 0 ? args[++i] : args[i].slice(separator + 1);
      if (!value || value.startsWith('--')) throw new Error('MISSING_VALUE');
      options[name] = value;
    }
    if ([...allowed].some((name) => !options[name])) throw new Error('USAGE');
    if (!path.isAbsolute(options.root)) throw new Error('INVALID_ROOT_NOT_ABSOLUTE');
    if (!path.isAbsolute(options.source)) throw new Error('INVALID_SOURCE_NOT_ABSOLUTE');
    let root;
    let source;
    try {
      root = fs.realpathSync(options.root);
      source = fs.realpathSync(options.source);
    } catch { throw new Error('PATH_RESOLVE_FAILED'); }
    if (!fs.statSync(root).isDirectory()) throw new Error('INVALID_ROOT_NOT_DIRECTORY');
    const relative = path.relative(root, source);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('SOURCE_OUTSIDE_ROOT');
    }
    const stat = fs.statSync(source);
    if (!stat.isFile() || stat.size > 25 * 1024 * 1024) throw new Error('INVALID_SOURCE_NOT_FILE');
    if (!this._isPdfFile(source)) throw new Error('INVALID_SOURCE_NOT_PDF');
    const sourceSha256 = createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    let pdf;
    try { pdf = await this.pdfReader.read(source); }
    catch { throw new Error('PDF_READ_FAILED'); }
    const recognition = new BookingSourceRecognition().evaluate(pdf, {
      branchId: options.branch, year: options.year, quarter: options.quarter, section: options.section,
    });
    if (recognition.status !== 'eligible') return {
      schemaVersion: 1, operation: 'prepare-from-source', status: 'review-required', reason: recognition.reason,
    };
    const proposedFilename = canonicalAccountingPdfBasename(recognition);
    const extraction = buildPendingAccountingExtraction(recognition);
    if (!proposedFilename || !extraction || !validPendingAccountingExtraction(extraction) ||
        Buffer.byteLength(JSON.stringify(extraction)) > 16 * 1024) return {
      schemaVersion: 1, operation: 'prepare-from-source', status: 'review-required', reason: 'invalid-extraction',
    };
    if (sourceSha256 !== createHash('sha256').update(fs.readFileSync(source)).digest('hex')) return {
      schemaVersion: 1, operation: 'prepare-from-source', status: 'review-required', reason: 'source-changed',
    };
    return {
      schemaVersion: 1, operation: 'prepare-from-source', status: 'eligible', proposedFilename, extraction,
      sourceEvidence: { sha256: sourceSha256, pageCount: pdf.pageCount, provenance: 'visible-pdf-text-total' },
    };
  }

  _isPdfFile(pathname) {
    // Check file extension
    const ext = pathname.toLowerCase().slice(-4);
    if (ext !== '.pdf') {
      return false;
    }

    // Verify PDF magic bytes
    try {
      const buffer = Buffer.alloc(4);
      const fd = fs.openSync(pathname, 'r');
      try {
        fs.readSync(fd, buffer, 0, 4, 0);
      } finally {
        fs.closeSync(fd);
      }
      const header = buffer.toString();
      return header === '%PDF';
    } catch {
      return false;
    }
  }
}

// CLI execution
if (process.argv[1]?.endsWith('/financial-records.command.mjs')) {
  try {
    requireCommandProfile('financial-records', fileURLToPath(import.meta.url));
    const command = new FinancialRecordsCommand();
    const result = await command.run(process.argv.slice(2));
    console.log(JSON.stringify(result));
  } catch (error) {
    const code = FIXED_COMMAND_ERRORS.has(error.message)
      ? error.message
      : 'INTERNAL_ERROR';
    const output = JSON.stringify({
      error: {
        code,
      },
    });
    process.stderr.write(output + '\n');
    process.exit(1);
  }
}
