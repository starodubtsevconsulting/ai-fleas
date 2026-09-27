#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { requireCommandProfile } from '../../_runtime/profile/command-profile.guard.mjs';
import { PdfReader } from './pdf-reader.mjs';
import { SnowRemovalContractRecognizer } from './recognizers/snow-removal-contract-recognizer.mjs';

const VALID_COMMANDS = new Set(['recognize']);

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
