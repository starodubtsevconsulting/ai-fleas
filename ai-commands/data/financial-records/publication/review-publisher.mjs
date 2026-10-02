/**
 * Purpose: publish one validated PDF plus adjacent JSON sidecar with exclusive collision-safe filesystem operations.
 * Caller: financial-records command apply operations for reviewed Booking and payroll-tax normalization.
 * Input/output: PDF bytes, validated extraction, and absolute target paths; returns publication/hash status.
 * Effects: stages and exclusively links two files, rolls back owned partial output when safe, and never overwrites.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validPendingAccountingExtraction } from '../extraction/pending-accounting-extraction.mjs';
import { canonicalAccountingPdfBasename } from '../naming/accounting-recognition-naming-policy.mjs';
import { reconcileTaxExtraction } from '../tax-normalization/tax-normalization-contract.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;

export class ReviewPublisher {
  constructor({ fsApi = fs, nonce = randomUUID } = {}) {
    this.fs = fsApi;
    this.nonce = nonce;
  }

  publish({ sourceBytes, extraction, pdfPath, sidecarPath }) {
    const digest = Buffer.isBuffer(sourceBytes) ? hash(sourceBytes) : '';
    const booking = validPendingAccountingExtraction(extraction);
    const tax = typeof pdfPath === 'string' && extraction?.recordType === 'payroll-tax-document'
      && reconcileTaxExtraction({ extraction, pdfSha256: digest, pdfFilename: path.basename(pdfPath) }).status === 'normalized';
    if (!Buffer.isBuffer(sourceBytes) || sourceBytes.length < 4 || sourceBytes.length > 25 * 1024 * 1024 ||
        sourceBytes.toString('ascii', 0, 4) !== '%PDF' ||
        (!booking && !tax)) throw new Error('INVALID_PUBLICATION_INPUT');
    if (typeof pdfPath !== 'string' || typeof sidecarPath !== 'string' || !path.isAbsolute(pdfPath) ||
        sidecarPath !== `${pdfPath}.json`) throw new Error('INVALID_PUBLICATION_INPUT');
    if (booking && (
        !/^\d{4}-\d{2}-\d{2}_booking_marketplace-reservation\.pdf$/.test(path.basename(pdfPath)) ||
        canonicalAccountingPdfBasename({ issuer: 'Booking.com', documentKind: 'marketplace-reservation',
          documentDate: extraction.period.documentBucketDate }) !== path.basename(pdfPath) ||
        extraction.layoutHints?.issuer !== 'Booking.com' ||
        extraction.period.year !== Number(extraction.period.documentBucketDate.slice(0, 4)) ||
        extraction.period.quarter !== Math.floor((Number(extraction.period.documentBucketDate.slice(5, 7)) - 1) / 3) + 1)) {
      throw new Error('INVALID_PUBLICATION_INPUT');
    }
    const sidecar = Buffer.from(`${JSON.stringify(extraction)}\n`);
    if (sidecar.length > 16 * 1024) throw new Error('INVALID_PUBLICATION_INPUT');
    const token = this.nonce();
    if (!/^[a-f0-9-]{36}$/.test(token)) throw new Error('INVALID_PUBLICATION_INPUT');
    const stagePdf = path.join(path.dirname(pdfPath), `.${path.basename(pdfPath)}.${token}.stage`);
    const stageSidecar = `${stagePdf}.json`;
    const owned = [];
    let pdfLinked = false;
    let sidecarLinked = false;
    let cleanupFailed = false;
    const removeOwned = (pathname, identity) => {
      try {
        if (sameFile(this.fs.lstatSync(pathname), identity)) this.fs.unlinkSync(pathname);
        else cleanupFailed = true;
      } catch (error) {
        if (error.code !== 'ENOENT') cleanupFailed = true;
      }
    };
    const stage = (pathname, bytes) => {
      const fd = this.fs.openSync(pathname, 'wx', 0o600);
      try {
        const identity = this.fs.fstatSync(fd);
        owned.push({ pathname, identity });
        this.fs.writeFileSync(fd, bytes);
        this.fs.fsyncSync(fd);
      } finally { this.fs.closeSync(fd); }
    };
    try {
      stage(stagePdf, sourceBytes);
      if (hash(this.fs.readFileSync(stagePdf)) !== digest) throw new Error('PUBLICATION_HASH_MISMATCH');
      stage(stageSidecar, sidecar);
      this.fs.linkSync(stagePdf, pdfPath);
      pdfLinked = true;
      this.fs.linkSync(stageSidecar, sidecarPath);
      sidecarLinked = true;
    } catch (error) {
      if (pdfLinked && !sidecarLinked) removeOwned(pdfPath, owned[0].identity);
      for (const item of owned) removeOwned(item.pathname, item.identity);
      if (cleanupFailed) throw new Error('PUBLICATION_PARTIAL');
      throw new Error(error.code === 'EEXIST' ? 'PUBLICATION_COLLISION' : 'PUBLICATION_FAILED');
    }
    for (const item of owned) removeOwned(item.pathname, item.identity);
    return { status: 'applied', sha256: digest, stagingCleanupRequired: cleanupFailed };
  }
}
