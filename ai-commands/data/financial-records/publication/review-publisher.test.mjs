import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPendingAccountingExtraction } from '../extraction/pending-accounting-extraction.mjs';
import { ReviewPublisher } from './review-publisher.mjs';

class MemoryFs {
  constructor() { this.files = new Map(); this.fds = new Map(); this.nextIno = 1; this.nextFd = 10; this.failSidecarWrite = false; this.replaceBeforeSecondLink = false; }
  error(code) { return Object.assign(new Error(code), { code }); }
  seed(name, data) { this.files.set(name, { data: Buffer.from(data), dev: 1, ino: this.nextIno++ }); }
  openSync(name, flag) {
    assert.equal(flag, 'wx');
    if (this.files.has(name)) throw this.error('EEXIST');
    const node = { data: Buffer.alloc(0), dev: 1, ino: this.nextIno++ };
    this.files.set(name, node);
    const fd = this.nextFd++;
    this.fds.set(fd, { name, node });
    return fd;
  }
  fstatSync(fd) { return this.fds.get(fd).node; }
  writeFileSync(fd, data) {
    const record = this.fds.get(fd);
    if (this.failSidecarWrite && record.name.endsWith('.stage.json')) throw this.error('EIO');
    record.node.data = Buffer.from(data);
  }
  fsyncSync() {}
  closeSync(fd) { this.fds.delete(fd); }
  readFileSync(name) { if (!this.files.has(name)) throw this.error('ENOENT'); return Buffer.from(this.files.get(name).data); }
  lstatSync(name) { if (!this.files.has(name)) throw this.error('ENOENT'); return this.files.get(name); }
  linkSync(source, target) {
    if (this.replaceBeforeSecondLink && target.endsWith('.pdf.json')) {
      this.seed(target.slice(0, -5), 'external replacement');
      throw this.error('EEXIST');
    }
    if (this.files.has(target)) throw this.error('EEXIST');
    this.files.set(target, this.lstatSync(source));
  }
  unlinkSync(name) { if (!this.files.delete(name)) throw this.error('ENOENT'); }
}

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-fixtures/booking-in.pdf');
const sourceBytes = readFileSync(fixture);
const extraction = buildPendingAccountingExtraction({
  status: 'eligible', destination: 'in', issuer: 'Booking.com', documentKind: 'marketplace-reservation',
  documentDate: '2026-08-14', year: '2026', quarter: 'q3', confidence: 1,
  primaryTotal: { amount: 1475.76, currency: 'CAD', label: 'total-room-price', provenance: 'visible-pdf-total' },
  reasons: ['credible-date'],
});
const pdfPath = '/records/2026-08-14_booking_marketplace-reservation.pdf';
const sidecarPath = `${pdfPath}.json`;
const args = { sourceBytes, extraction, pdfPath, sidecarPath };
const nonce = () => '00000000-0000-4000-8000-000000000001';
const publisher = (fsApi) => new ReviewPublisher({ fsApi, nonce });
const noStages = (fsApi) => assert.equal([...fsApi.files.keys()].filter((name) => name.includes('.stage')).length, 0);

const success = new MemoryFs();
assert.deepEqual(publisher(success).publish(args), {
  status: 'applied', sha256: createHash('sha256').update(sourceBytes).digest('hex'), stagingCleanupRequired: false,
});
assert.deepEqual(success.readFileSync(pdfPath), sourceBytes);
assert.deepEqual(JSON.parse(success.readFileSync(sidecarPath).toString()), extraction);
noStages(success);

const collision = new MemoryFs();
collision.seed(pdfPath, 'original');
assert.throws(() => publisher(collision).publish(args), /PUBLICATION_COLLISION/);
assert.equal(collision.readFileSync(pdfPath).toString(), 'original');
assert.equal(collision.files.has(sidecarPath), false);
noStages(collision);

const secondLinkFailure = new MemoryFs();
secondLinkFailure.seed(sidecarPath, 'existing sidecar');
assert.throws(() => publisher(secondLinkFailure).publish(args), /PUBLICATION_COLLISION/);
assert.equal(secondLinkFailure.files.has(pdfPath), false);
assert.equal(secondLinkFailure.readFileSync(sidecarPath).toString(), 'existing sidecar');
noStages(secondLinkFailure);

const replacedTarget = new MemoryFs();
replacedTarget.replaceBeforeSecondLink = true;
assert.throws(() => publisher(replacedTarget).publish(args), /PUBLICATION_PARTIAL/);
assert.equal(replacedTarget.readFileSync(pdfPath).toString(), 'external replacement');
noStages(replacedTarget);

const secondWriteFailure = new MemoryFs();
secondWriteFailure.failSidecarWrite = true;
assert.throws(() => publisher(secondWriteFailure).publish(args), /PUBLICATION_FAILED/);
assert.equal(secondWriteFailure.files.size, 0);
assert.throws(() => publisher(new MemoryFs()).publish({ ...args, pdfPath: '/records/other.pdf' }), /INVALID_PUBLICATION_INPUT/);
assert.throws(() => publisher(new MemoryFs()).publish({ ...args, extraction: {
  ...extraction, period: { ...extraction.period, quarter: 4 },
} }), /INVALID_PUBLICATION_INPUT/);
console.log('financial-records publication primitive: PASS');
