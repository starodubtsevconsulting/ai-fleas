import assert from 'node:assert/strict';
import test from 'node:test';
import { DownloadQuarterReport } from './application/download-quarter-report.mjs';
import {
  BookingReportBuilderPort,
  ConfigProviderPort,
  LodgifyBookingsPort,
  QuarterReportPublisherPort,
} from './application/ports.mjs';
import { runCommand } from './lodgify.command.mjs';

test('abstract port methods reject unimplemented calls', async () => {
  await assert.rejects(new LodgifyBookingsPort().testConnection());
  await assert.rejects(new LodgifyBookingsPort().fetchBookings());
  assert.throws(() => new BookingReportBuilderPort().build());
  assert.throws(() => new QuarterReportPublisherPort().publish());
  assert.throws(() => new ConfigProviderPort().load());
});

test('DownloadQuarterReport orders dependencies and bounds metadata', async () => {
  const calls = [];
  const useCase = new DownloadQuarterReport({
    bookingsPort: {
      async fetchBookings() {
        calls.push('fetch');
        return [{ id: 'one' }];
      },
    },
    reportBuilder: {
      build(bookings, period) {
        calls.push('build');
        return { rows: bookings, review: 0, period };
      },
    },
    publisher: {
      publish(report) {
        calls.push('publish');
        return { saved: true, filename: `${report.period.quarter}.csv` };
      },
    },
  });
  const result = await useCase.execute({
    period: { quarter: 'Q3' },
    destination: '/approved',
  });
  assert.deepEqual(calls, ['fetch', 'build', 'publish']);
  assert.deepEqual(result, {
    period: 'Q3',
    fetched: 1,
    emitted: 1,
    review: 0,
    saved: true,
    filename: 'Q3.csv',
  });
});

test('router delegates routes after flags validate without premature config loads', async () => {
  let loads = 0;
  const dependencies = {
    configProvider: {
      load() {
        loads += 1;
        return {};
      },
    },
    createAdapters: () => ({
      bookingsPort: {
        async testConnection() {
          return 'connected';
        },
      },
    }),
  };
  const output = [];
  assert.equal(
    await runCommand(['help'], dependencies, (value) => output.push(value)),
    0,
  );
  await assert.rejects(runCommand(['unknown'], dependencies, () => {}));
  await assert.rejects(runCommand(['connection-test', '--year', '2026'], dependencies, () => {}));
  await assert.rejects(runCommand(['quarter-report', '--wat'], dependencies, () => {}));
  assert.equal(loads, 0);
  assert.equal(await runCommand(['connection-test'], dependencies, (value) => output.push(value)), 0);
  assert.deepEqual(output.pop(), { status: 'connected' });
  assert.equal(loads, 1);
  assert.equal(await runCommand(['quarter-report', '--dry-run'], dependencies, (value) => output.push(value)), 0);
  assert.equal(output.pop().counts['dry-run'], 1);
  assert.equal(loads, 1);
});
