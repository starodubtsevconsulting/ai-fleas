#!/usr/bin/env node
/**
 * Purpose: portable source-backed financial-record recognition, preparation, and guarded publication command.
 * Caller: profile-authorized command launchers and direct CLI invocation documented in financial-records.command.md.
 * Inputs/output: explicit authorized roots, contained source files, context options, and bounded JSON results.
 * Effects: recognize/prepare operations are read-only; only apply-from-source publishes supported Booking artifacts.
 * prepare-tax-from-source is planning-only and never writes, renames, submits, or settles tax records.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { requireCommandProfile } from '../../_runtime/profile/command-profile.guard.mjs';
import { PdfReader } from './pdf-reader.mjs';
import { SnowRemovalContractRecognizer } from './recognizers/snow-removal-contract-recognizer.mjs';
import { BookingSourceRecognition } from './recognizers/booking-source-recognition.mjs';
import { PayrollTaxSourceRecognition } from './recognizers/payroll-tax-source-recognition.mjs';
import { canonicalAccountingPdfBasename } from './naming/accounting-recognition-naming-policy.mjs';
import { buildPendingAccountingExtraction, validPendingAccountingExtraction } from './extraction/pending-accounting-extraction.mjs';
import { ReviewPublisher } from './publication/review-publisher.mjs';
import {
  buildTaxReviewArtifact, normalizedTaxExtraction, reconcileTaxExtraction,
  reviewMatchesPrepared, taxProposalRevision,
} from './tax-normalization/tax-normalization-contract.mjs';
import { payrollTaxReadPlan } from './read-plans/payroll-tax-read-plan.mjs';

const VALID_COMMANDS = new Set(['recognize', 'prepare-review', 'prepare-from-source', 'prepare-tax-from-source',
  'review-tax-proposal', 'apply-tax-from-source', 'reconcile-tax-record', 'apply-from-source']);

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
  'INVALID_DESTINATION_NOT_ABSOLUTE',
  'INVALID_DESTINATION_NOT_DIRECTORY',
  'DESTINATION_OUTSIDE_ROOT',
  'INVALID_EXPECTATION',
  'INVALID_PROPOSAL',
  'INVALID_REVIEW',
  'REVIEW_MISMATCH',
  'INVALID_SIDECAR',
  'CLOSED_PERIOD',
  'OCR_VERIFICATION_REQUIRED',
  'PREVIEW_MISMATCH',
  'SOURCE_CHANGED',
  'PUBLICATION_COLLISION',
  'PUBLICATION_FAILED',
  'PUBLICATION_PARTIAL',
  'INVALID_PUBLICATION_INPUT',
  'INTERNAL_ERROR',
]);

export class FinancialRecordsCommand {
  constructor() {
    this.pdfReader = new PdfReader();
    this.recognizer = new SnowRemovalContractRecognizer();
    this.publisher = new ReviewPublisher();
  }

  resolveSourceAndReportsRoots(options) {
    if (options.root && (options['source-root'] || options['reports-root'])) throw new Error('USAGE');
    const sourceRootOption = options.root || options['source-root'];
    const reportsRootOption = options.root || options['reports-root'];
    if (!sourceRootOption || !reportsRootOption) throw new Error('USAGE');
    if (!path.isAbsolute(sourceRootOption) || !path.isAbsolute(reportsRootOption)) {
      throw new Error('INVALID_ROOT_NOT_ABSOLUTE');
    }
    let sourceRoot;
    let reportsRoot;
    try {
      sourceRoot = fs.realpathSync(sourceRootOption);
      reportsRoot = fs.realpathSync(reportsRootOption);
    } catch { throw new Error('PATH_RESOLVE_FAILED'); }
    if (!fs.statSync(sourceRoot).isDirectory() || !fs.statSync(reportsRoot).isDirectory()) {
      throw new Error('INVALID_ROOT_NOT_DIRECTORY');
    }
    return { sourceRoot, reportsRoot };
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
    if (command === 'prepare-tax-from-source') return this.prepareTaxFromSource(args.slice(1));
    if (command === 'review-tax-proposal') return this.reviewTaxProposal(args.slice(1));
    if (command === 'apply-tax-from-source') return this.applyTaxFromSource(args.slice(1));
    if (command === 'reconcile-tax-record') return this.reconcileTaxRecord(args.slice(1));
    if (command === 'apply-from-source') return this.applyFromSource(args.slice(1));

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
    const allowed = new Set(['root', 'source-root', 'reports-root', 'source', 'branch', 'year', 'quarter', 'section']);
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
    if (['source', 'branch', 'year', 'quarter', 'section'].some((name) => !options[name])) throw new Error('USAGE');
    const { sourceRoot } = this.resolveSourceAndReportsRoots(options);
    if (!path.isAbsolute(options.source)) throw new Error('INVALID_SOURCE_NOT_ABSOLUTE');
    let source;
    try {
      source = fs.realpathSync(options.source);
    } catch { throw new Error('PATH_RESOLVE_FAILED'); }
    const relative = path.relative(sourceRoot, source);
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

  async applyFromSource(args) {
    const required = ['source', 'destination', 'branch', 'year', 'quarter', 'section', 'expected-sha256', 'expected-filename'];
    const allowed = new Set([...required, 'root', 'source-root', 'reports-root']);
    const options = {};
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
    if (required.some((name) => !options[name])) throw new Error('USAGE');
    const { sourceRoot, reportsRoot } = this.resolveSourceAndReportsRoots(options);
    if (options.section !== 'in' || !/^\d{4}$/.test(options.year) || !/^q[1-4]$/.test(options.quarter) ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(options.branch) ||
        !/^[a-f0-9]{64}$/.test(options['expected-sha256']) ||
        !/^\d{4}-\d{2}-\d{2}_booking_marketplace-reservation\.pdf$/.test(options['expected-filename'])) {
      throw new Error('INVALID_EXPECTATION');
    }
    if (!path.isAbsolute(options.source)) throw new Error('INVALID_SOURCE_NOT_ABSOLUTE');
    if (!path.isAbsolute(options.destination)) throw new Error('INVALID_DESTINATION_NOT_ABSOLUTE');
    let source;
    let destination;
    try {
      source = fs.realpathSync(options.source);
      destination = fs.realpathSync(options.destination);
    } catch { throw new Error('PATH_RESOLVE_FAILED'); }
    if (!fs.statSync(source).isFile()) throw new Error('INVALID_SOURCE_NOT_FILE');
    if (!fs.statSync(destination).isDirectory() || fs.lstatSync(options.destination).isSymbolicLink()) {
      throw new Error('INVALID_DESTINATION_NOT_DIRECTORY');
    }
    const inside = (root, pathname) => {
      const relative = path.relative(root, pathname);
      return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    };
    if (!inside(sourceRoot, source)) throw new Error('SOURCE_OUTSIDE_ROOT');
    if (!inside(reportsRoot, destination) || destination !== path.join(reportsRoot, options.year, options.branch, options.quarter, 'in')) {
      throw new Error('DESTINATION_OUTSIDE_ROOT');
    }
    const prepared = await this.prepareFromSource([
      '--source-root', sourceRoot, '--reports-root', reportsRoot, '--source', source, '--branch', options.branch, '--year', options.year,
      '--quarter', options.quarter, '--section', options.section,
    ]);
    if (prepared.status !== 'eligible') return {
      schemaVersion: 1, operation: 'apply-from-source', status: 'review-required', reason: prepared.reason,
    };
    if (prepared.sourceEvidence.sha256 !== options['expected-sha256'] ||
        prepared.proposedFilename !== options['expected-filename']) throw new Error('PREVIEW_MISMATCH');
    const sourceBytes = fs.readFileSync(source);
    if (sourceBytes.length > 25 * 1024 * 1024 ||
        createHash('sha256').update(sourceBytes).digest('hex') !== prepared.sourceEvidence.sha256) {
      throw new Error('SOURCE_CHANGED');
    }
    const pdfPath = path.join(destination, prepared.proposedFilename);
    const sidecarPath = `${pdfPath}.json`;
    if (fs.existsSync(pdfPath) || fs.existsSync(sidecarPath)) throw new Error('PUBLICATION_COLLISION');
    const publication = this.publisher.publish({ sourceBytes, extraction: prepared.extraction, pdfPath, sidecarPath });
    if (publication.status !== 'applied' || publication.sha256 !== prepared.sourceEvidence.sha256) {
      throw new Error('PUBLICATION_FAILED');
    }
    return {
      schemaVersion: 1, operation: 'apply-from-source', status: 'applied',
      proposedFilename: prepared.proposedFilename, sha256: publication.sha256,
      stagingCleanupRequired: publication.stagingCleanupRequired,
    };
  }

  async prepareTaxFromSource(args) {
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
    if (['root', 'source', 'branch', 'year', 'quarter', 'section'].some((name) => !options[name])) {
      throw new Error('USAGE');
    }
    if (options.section !== 'out' || !/^\d{4}$/.test(options.year) || !/^q[1-4]$/.test(options.quarter)
      || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(options.branch)) throw new Error('INVALID_EXPECTATION');
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
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('SOURCE_OUTSIDE_ROOT');
    }
    const stat = fs.statSync(source);
    if (!stat.isFile() || stat.size > 25 * 1024 * 1024) throw new Error('INVALID_SOURCE_NOT_FILE');
    if (!this._isPdfFile(source)) throw new Error('INVALID_SOURCE_NOT_PDF');
    const sourceBytes = fs.readFileSync(source);
    const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
    let pdf;
    try { pdf = await this.pdfReader.read(source, payrollTaxReadPlan); }
    catch { throw new Error('PDF_READ_FAILED'); }
    const prepared = new PayrollTaxSourceRecognition().evaluate(pdf, {
      branchId: options.branch, year: options.year, quarter: options.quarter,
      section: options.section, sourceSha256,
    });
    if (sourceSha256 !== createHash('sha256').update(fs.readFileSync(source)).digest('hex')) {
      return { schemaVersion: 1, operation: 'prepare-tax-from-source', status: 'review-required', reason: 'source-changed' };
    }
    const result = { schemaVersion: 1, operation: 'prepare-tax-from-source', ...prepared };
    if (result.status === 'prepared') result.proposalRevision = taxProposalRevision(result);
    return result;
  }

  reviewTaxProposal(args) {
    const options = this._parseNamedOptions(args, new Set(['root', 'proposal', 'verify-ocr-fields']), ['root', 'proposal']);
    const { root, file: proposalPath } = this._resolveContainedFile(options.root, options.proposal,
      'INVALID_PROPOSAL');
    const proposal = this._readBoundedJson(proposalPath, 'INVALID_PROPOSAL');
    const required = proposal.extraction?.ocrVerificationRequired || [];
    const verified = options['verify-ocr-fields'] ? options['verify-ocr-fields'].split(',') : [];
    if (required.length > 0 && !options['verify-ocr-fields']) throw new Error('OCR_VERIFICATION_REQUIRED');
    const review = buildTaxReviewArtifact(proposal, verified);
    if (!review || proposal.proposalRevision !== review.proposalRevision) throw new Error('INVALID_PROPOSAL');
    return { operation: 'review-tax-proposal', ...review, authorizedRootBound: true,
      operationalDestination: proposal.proposedDestination };
  }

  async applyTaxFromSource(args) {
    const required = ['root', 'source', 'destination', 'review', 'branch', 'year', 'quarter', 'section',
      'expected-proposal-revision'];
    const options = this._parseNamedOptions(args, new Set(required), required);
    if (options.quarter === 'q3') throw new Error('CLOSED_PERIOD');
    if (options.section !== 'out') throw new Error('INVALID_EXPECTATION');
    if (!/^q[1-4]$/.test(options.quarter) || !/^\d{4}$/.test(options.year)
      || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(options.branch)
      || !/^[a-f0-9]{64}$/.test(options['expected-proposal-revision'])) throw new Error('INVALID_EXPECTATION');
    const { root, file: source } = this._resolveContainedFile(options.root, options.source,
      'INVALID_SOURCE_NOT_FILE');
    const reviewResolved = this._resolveContainedFile(root, options.review, 'INVALID_REVIEW');
    const review = this._readBoundedJson(reviewResolved.file, 'INVALID_REVIEW');
    if (!path.isAbsolute(options.destination)) throw new Error('INVALID_DESTINATION_NOT_ABSOLUTE');
    let destination;
    try { destination = fs.realpathSync(options.destination); }
    catch { throw new Error('PATH_RESOLVE_FAILED'); }
    if (!fs.statSync(destination).isDirectory() || fs.lstatSync(options.destination).isSymbolicLink()) {
      throw new Error('INVALID_DESTINATION_NOT_DIRECTORY');
    }
    const prepared = await this.prepareTaxFromSource([
      '--root', root, '--source', source, '--branch', options.branch, '--year', options.year,
      '--quarter', options.quarter, '--section', options.section,
    ]);
    if (prepared.status !== 'prepared' || prepared.reviewEligible !== true) throw new Error('REVIEW_REQUIRED');
    if (!reviewMatchesPrepared(review, prepared, options['expected-proposal-revision'])) {
      throw new Error('REVIEW_MISMATCH');
    }
    const expectedDestination = path.join(root, ...prepared.proposedDestination.split('/'));
    if (destination !== expectedDestination || prepared.extraction.operationalPeriod?.quarter === 'q3') {
      throw new Error('CLOSED_PERIOD');
    }
    const pdfPath = path.join(destination, prepared.proposedFilename);
    const sidecarPath = `${pdfPath}.json`;
    if (fs.existsSync(pdfPath) || fs.existsSync(sidecarPath)) throw new Error('PUBLICATION_COLLISION');
    const extraction = normalizedTaxExtraction(prepared.extraction, review);
    if (!extraction) throw new Error('INVALID_REVIEW');
    const sourceBytes = fs.readFileSync(source);
    if (createHash('sha256').update(sourceBytes).digest('hex') !== prepared.extraction.source.sha256) {
      throw new Error('SOURCE_CHANGED');
    }
    const publication = this.publisher.publish({ sourceBytes, extraction, pdfPath, sidecarPath });
    if (publication.status !== 'applied' || publication.sha256 !== prepared.extraction.source.sha256) {
      throw new Error('PUBLICATION_FAILED');
    }
    return { schemaVersion: 1, operation: 'apply-tax-from-source', status: 'applied',
      proposedFilename: prepared.proposedFilename, proposalRevision: review.proposalRevision,
      sha256: publication.sha256, stagingCleanupRequired: publication.stagingCleanupRequired };
  }

  reconcileTaxRecord(args) {
    const required = ['root', 'pdf', 'sidecar', 'branch', 'year', 'quarter', 'section'];
    const options = this._parseNamedOptions(args, new Set(required), required);
    if (options.quarter === 'q3') throw new Error('CLOSED_PERIOD');
    if (options.section !== 'out') throw new Error('INVALID_EXPECTATION');
    const { root, file: pdfPath } = this._resolveContainedFile(options.root, options.pdf,
      'INVALID_SOURCE_NOT_FILE');
    const sidecarResolved = this._resolveContainedFile(root, options.sidecar, 'INVALID_SIDECAR');
    if (sidecarResolved.file !== `${pdfPath}.json`) throw new Error('INVALID_SIDECAR');
    const extraction = this._readBoundedJson(sidecarResolved.file, 'INVALID_SIDECAR', 64 * 1024);
    if (extraction.operationalPeriod?.year !== options.year || extraction.operationalPeriod?.quarter !== options.quarter
      || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(options.branch)) throw new Error('INVALID_EXPECTATION');
    const expectedDirectory = path.join(root, options.year, options.branch, options.quarter, 'out', 'taxes',
      'payroll-remittances', extraction.jurisdiction, extraction.reportingPeriod?.end || '');
    if (path.dirname(pdfPath) !== expectedDirectory) throw new Error('DESTINATION_OUTSIDE_ROOT');
    const pdfSha256 = createHash('sha256').update(fs.readFileSync(pdfPath)).digest('hex');
    return { schemaVersion: 1, operation: 'reconcile-tax-record',
      ...reconcileTaxExtraction({ extraction, pdfSha256, pdfFilename: path.basename(pdfPath) }) };
  }

  _parseNamedOptions(args, allowed, required) {
    const options = {};
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
    if (required.some((name) => !options[name])) throw new Error('USAGE');
    return options;
  }

  _resolveContainedFile(rootOption, fileOption, errorCode) {
    if (!path.isAbsolute(rootOption)) throw new Error('INVALID_ROOT_NOT_ABSOLUTE');
    if (!path.isAbsolute(fileOption)) throw new Error('INVALID_SOURCE_NOT_ABSOLUTE');
    try { if (fs.lstatSync(rootOption).isSymbolicLink()) throw new Error('INVALID_ROOT_NOT_DIRECTORY'); }
    catch (error) { if (error.message === 'INVALID_ROOT_NOT_DIRECTORY') throw error; throw new Error('PATH_RESOLVE_FAILED'); }
    try { if (fs.lstatSync(fileOption).isSymbolicLink()) throw new Error(errorCode); }
    catch (error) { if (error.message === errorCode) throw error; throw new Error('PATH_RESOLVE_FAILED'); }
    let root;
    let file;
    try { root = fs.realpathSync(rootOption); file = fs.realpathSync(fileOption); }
    catch { throw new Error('PATH_RESOLVE_FAILED'); }
    if (!fs.statSync(root).isDirectory() || !fs.statSync(file).isFile()) throw new Error(errorCode);
    const relative = path.relative(root, file);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('SOURCE_OUTSIDE_ROOT');
    }
    return { root, file };
  }

  _readBoundedJson(file, errorCode, limit = 32 * 1024) {
    try {
      const bytes = fs.readFileSync(file);
      if (bytes.length > limit) throw new Error(errorCode);
      return JSON.parse(bytes.toString('utf8'));
    } catch { throw new Error(errorCode); }
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
