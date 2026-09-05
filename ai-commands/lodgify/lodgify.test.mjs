import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  BOOKING_REPORT_HEADER,
  config,
  connectionTest,
  csv,
  cleanup,
  getBookings,
  normalize,
  publishReport,
  quarter,
  temporaryCsv,
} from './lodgify-core.mjs';
const execFileAsync = promisify(execFile);
test('validates strict config and quarter', () => {
  assert.throws(() => config(''));
  assert.throws(() => config('API_KEY=[TODO]\nRENTAL_ID=7'));
  assert.throws(() => config('API_KEY=x\nRENTAL_ID=x'));
  assert.deepEqual(config('API_KEY=x\nRENTAL_ID=7\nUSER_ID=8'), {
    apiKey: 'x',
    propertyId: '7',
    userId: '8',
    apiBase: 'https://api.lodgify.com',
  });
  assert.equal(quarter('2026-08-16', '2026-08-16').from, '2026-07-01');
  assert.equal(quarter('2026-08-16', '2026-09-30').completed, false);
  assert.equal(quarter('2026-08-16', '2026-10-01').completed, true);
  assert.throws(() => quarter('2027-01-01', '2026-08-16'));
});
test('normalizes synthetic bookings with checkout-exclusive cross-quarter semantics', () => {
  const q = quarter('2026-08-16', '2026-09-30');
  const rows = normalize(
    [
      {
        id: 'x',
        houseId: '7',
        checkIn: '2026-07-01',
        checkOut: '2026-08-01',
        nights: 31,
        status: '=Booked',
      },
      {
        id: 'y',
        houseId: '7',
        checkIn: '2026-09-30',
        checkOut: '2026-10-01',
        nights: 1,
        status: 'Booked',
      },
      {
        id: 'z',
        houseId: '7',
        checkIn: '2026-09-30',
        checkOut: '2026-10-02',
        nights: 2,
        status: 'Booked',
      },
    ],
    '7',
    q,
  );
  assert.match(csv(rows), /'=Booked/);
  assert.equal(rows[0].crossQuarter, false);
  assert.equal(rows[1].crossQuarter, false);
  assert.equal(rows[2].crossQuarter, true);
  assert.throws(() =>
    normalize(
      [
        {
          id: 'x',
          houseId: '7',
          checkIn: '2026-99-99',
          checkOut: '2026-10-01',
        },
      ],
      '7',
      q,
    ),
  );
});
test('normalization excludes valid bookings outside the requested check-in period', () => {
  const q = quarter('2026-08-16', '2026-08-16');
  const rows = normalize(
    [
      {
        id: 'past',
        houseId: '7',
        checkIn: '2026-06-29',
        checkOut: '2026-07-02',
      },
      {
        id: 'current',
        houseId: '7',
        checkIn: '2026-07-15',
        checkOut: '2026-07-18',
      },
      {
        id: 'future',
        houseId: '7',
        checkIn: '2026-08-17',
        checkOut: '2026-08-18',
      },
    ],
    '7',
    q,
  );
  assert.deepEqual(
    rows.map((row) => row.Id),
    ['current'],
  );
  assert.throws(
    () =>
      normalize(
        [
          {
            id: 'bad',
            houseId: '8',
            checkIn: '2026-06-01',
            checkOut: '2026-06-02',
          },
        ],
        '7',
        q,
      ),
    /property\/period\/schema mismatch/,
  );
});
test('CSV is deterministic RFC4180 and protects spreadsheet formulas', () => {
  const q = quarter('2026-08-16', '2026-09-30');
  const rows = normalize(
    [
      {
        id: 'b',
        houseId: '7',
        checkIn: '2026-07-01',
        checkOut: '2026-07-02',
        name: '=sum(1,1)',
      },
      {
        id: 'a',
        houseId: '7',
        checkIn: '2026-07-02',
        checkOut: '2026-07-03',
        name: 'Ada "A"',
      },
    ],
    '7',
    q,
  );
  const out = csv(rows);
  assert.match(out, /a,,,,"Ada ""A"""/);
  assert.match(out, /'=sum\(1,1\)/);
  assert.ok(out.indexOf('\r\na,') < out.indexOf('\r\nb,'));
});
test('51-column projection reads only supplied authoritative nested fields', () => {
  const q = quarter('2026-08-16', '2026-09-30'),
    row = normalize(
      [
        {
          id: 'fixture',
          houseId: '7',
          checkIn: '2026-07-04',
          checkOut: '2026-07-06',
          source: 'BookingCom',
          guest: {
            name: 'Guest',
            email: 'guest@example.invalid',
            phone: '+1',
            country_name: 'CA',
          },
          rooms: [{ guest_breakdown: { adults: 2, children: 1 } }],
          subtotals: { stay: 10, promotions: 2, fees: 3, taxes: 4, addons: 5 },
          total_amount: 20,
          currency_code: 'CAD',
          status: 'Booked',
        },
      ],
      '7',
      q,
    )[0];
  assert.equal(BOOKING_REPORT_HEADER.length, 51);
  assert.deepEqual(
    [
      row.Source,
      row.Name,
      row.Adults,
      row.Children,
      row.RoomRatesTotal,
      row.PromotionsTotal,
      row.FeesTotal,
      row.TaxesTotal,
      row.AddOnsTotal,
      row.Currency,
    ],
    ['Booking.com', 'Guest', 2, 1, '10', '2', '3', '4', '5', 'CAD'],
  );
  assert.equal(csv([row]).split('\r\n')[1].split(',').length, 51);
});
test('temporary output is 0600 and cleaned', () => {
  const t = temporaryCsv('x');
  assert.equal(fs.statSync(t.file).mode & 0o777, 0o600);
  cleanup(t.dir);
  assert.equal(fs.existsSync(t.dir), false);
});
test('persistent export is atomic, mode 0600, and never overwrites', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lodgify-output-')),
    period = { year: 2026, quarter: 'Q3' };
  const out = publishReport({ outputDir: dir, period, content: 'csv' });
  assert.equal(out.saved, true);
  assert.equal(fs.statSync(path.join(dir, out.filename)).mode & 0o777, 0o600);
  assert.throws(
    () => publishReport({ outputDir: dir, period, content: 'csv' }),
    /collision/,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
test('synthetic connection test uses the source-aligned properties endpoint and emits only allowed statuses', async () => {
  const ok = async (url, init) => {
    assert.equal(url.pathname, '/v1/properties');
    assert.equal(init.headers['X-ApiKey'], 'secret');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [{ HouseId: '7' }] }),
    };
  };
  assert.equal(
    await connectionTest({ apiKey: 'secret', propertyId: '7', fetchImpl: ok }),
    'connected',
  );
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([]),
      }),
    }),
    'property-not-accessible',
  );
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      fetchImpl: async () => ({ ok: false, status: 401, text: async () => '' }),
    }),
    'authentication-failed',
  );
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      fetchImpl: async () => ({ ok: false, status: 429, text: async () => '' }),
    }),
    'rate-limited',
  );
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => '{bad',
      }),
    }),
    'schema-drift',
  );
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      timeoutMs: 1,
      fetchImpl: () => new Promise(() => {}),
    }),
    'timeout',
  );
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      fetchImpl: async () => {
        throw Error('offline');
      },
    }),
    'request-failed',
  );
});
test('connection diagnostics are closed, redacted, and retry transient failures once', async () => {
  for (const [code, status] of [
    [400, 'bad-request'],
    [422, 'bad-request'],
    [404, 'endpoint-not-found'],
  ]) {
    let calls = 0;
    assert.equal(
      await connectionTest({
        apiKey: 'x',
        propertyId: '7',
        fetchImpl: async () => {
          calls++;
          return { ok: false, status: code, text: async () => 'secret' };
        },
      }),
      status,
    );
    assert.equal(calls, 1);
  }
  for (const [failure, status] of [
    [
      { ok: false, status: 503, headers: { get: () => '0' } },
      'service-unavailable',
    ],
    [new TypeError('network secret'), 'network-failed'],
  ]) {
    let calls = 0;
    assert.equal(
      await connectionTest({
        apiKey: 'x',
        propertyId: '7',
        fetchImpl: async () => {
          calls++;
          if (failure instanceof Error) throw failure;
          return failure;
        },
      }),
      status,
    );
    assert.equal(calls, 2);
  }
});
test('bounded synthetic v2 pagination uses exact query/X-ApiKey and fails closed', async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(init.headers['X-ApiKey'], 'secret');
    assert.equal(url.pathname, '/v2/reservations/bookings');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      page: '1',
      size: '50',
      stayFilter: 'All',
      includeCount: 'true',
      HouseId: '7',
    });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ id: 'x' }] }),
    };
  };
  assert.equal(
    (await getBookings({ apiKey: 'secret', propertyId: '7', fetchImpl }))
      .length,
    1,
  );
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'secret',
        propertyId: '7',
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          text: async () => '',
        }),
      }),
    /authentication failed/,
  );
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'secret',
        propertyId: '7',
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => '{bad',
        }),
      }),
    /malformed JSON/,
  );
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'secret',
        propertyId: '7',
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ id: '' }]),
        }),
      }),
    /schema drift/,
  );
});
test('pagination rejects duplicate IDs and respects its call budget', async () => {
  const page = Array.from({ length: 50 }, (_, i) => ({ id: `id${i}` }));
  const response = (rows) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ items: rows }),
  });
  let calls = 0;
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'x',
        propertyId: '7',
        maxCalls: 1,
        fetchImpl: async () => response(page),
      }),
    /call budget/,
  );
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'x',
        propertyId: '7',
        fetchImpl: async () => response(calls++ ? page : [...page]),
      }),
    /pagination loop/,
  );
});
test('response-body deadline, cap, and transient retry are bounded and abortable', async () => {
  let aborted = false;
  const hanging = {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () => new Promise(() => {}),
        cancel: async () => {
          aborted = true;
        },
        releaseLock() {},
      }),
    },
  };
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      timeoutMs: 1,
      fetchImpl: async () => hanging,
    }),
    'timeout',
  );
  assert.equal(aborted, true);
  const huge = {
    ok: true,
    status: 200,
    headers: { get: () => String(1024 * 1024 + 1) },
    text: async () => '',
  };
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      fetchImpl: async () => huge,
    }),
    'schema-drift',
  );
  let calls = 0;
  const transient = async () => ({
    ok: calls++ > 0,
    status: calls === 1 ? 503 : 200,
    text: async () => JSON.stringify([{ id: 'x' }]),
    headers: { get: () => null },
  });
  assert.equal(
    (await getBookings({ apiKey: 'x', propertyId: '7', fetchImpl: transient }))
      .length,
    1,
  );
  assert.equal(calls, 2);
});
test('only TypeError, timeout, 429, and 5xx retry once', async () => {
  const ok = {
    ok: true,
    status: 200,
    text: async () => JSON.stringify([{ id: 'x' }]),
    headers: { get: () => null },
  };
  let calls = 0;
  assert.equal(
    (
      await getBookings({
        apiKey: 'x',
        propertyId: '7',
        fetchImpl: async () =>
          ++calls === 1 ? Promise.reject(new TypeError('network')) : ok,
      })
    ).length,
    1,
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'x',
        propertyId: '7',
        fetchImpl: async () => {
          calls++;
          throw Error('offline');
        },
      }),
    /offline/,
  );
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'x',
        propertyId: '7',
        fetchImpl: async () => {
          calls++;
          return { ok: false, status: 401, text: async () => '' };
        },
      }),
    /authentication failed/,
  );
  assert.equal(calls, 1);
});
test('explicit response, retry, envelope, paging, and CSV boundaries fail closed', async () => {
  let aborted = false,
    read = false;
  const textHang = { ok: true, status: 200, text: () => new Promise(() => {}) };
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      timeoutMs: 1,
      fetchImpl: async (_, init) => {
        init.signal.addEventListener('abort', () => {
          aborted = true;
        });
        return textHang;
      },
    }),
    'timeout',
  );
  assert.equal(aborted, true);
  const capped = {
    ok: true,
    status: 200,
    headers: { get: () => String(1024 * 1024 + 1) },
    text: async () => {
      read = true;
      return '';
    },
  };
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      fetchImpl: async () => capped,
    }),
    'schema-drift',
  );
  assert.equal(read, false);
  const response = (rows) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(rows),
    headers: { get: () => null },
  });
  for (const body of [
    [{ id: 'x' }],
    { items: [{ id: 'x' }] },
    { data: [{ id: 'x' }] },
  ])
    assert.equal(
      (
        await getBookings({
          apiKey: 'x',
          propertyId: '7',
          fetchImpl: async () => response(body),
        })
      ).length,
      1,
    );
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'x',
        propertyId: '7',
        fetchImpl: async () => response([{ id: 'x' }, { id: 'x' }]),
      }),
    /pagination loop/,
  );
  const page = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}` }));
  let calls = 0;
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'x',
        propertyId: '7',
        maxPages: 1,
        fetchImpl: async () => response(page),
      }),
    /page limit/,
  );
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'x',
        propertyId: '7',
        maxRecords: 1,
        fetchImpl: async () => response(page),
      }),
    /record limit/,
  );
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'x',
        propertyId: '7',
        fetchImpl: async () => response(calls++ ? page : page),
      }),
    /pagination loop/,
  );
  const quoted = csv([
    {
      Id: 'x',
      Name: 'a,b',
      DateArrival: '2026-07-01',
      DateDeparture: '2026-07-02',
    },
  ]);
  assert.equal(
    quoted.split('\r\n')[0].split(',').length,
    BOOKING_REPORT_HEADER.length,
  );
  assert.match(quoted, /"a,b"/);
  assert.throws(
    () => csv([{ Id: 'x', Name: 'x'.repeat(2049) }]),
    /schema drift/,
  );
});
test('stream cap and retry classifications have explicit call-count proof', async () => {
  let cancelled = false,
    aborted = false;
  const chunk = new Uint8Array(600000),
    reader = {
      n: 0,
      async read() {
        return this.n++ < 2 ? { done: false, value: chunk } : { done: true };
      },
      async cancel() {
        cancelled = true;
      },
      releaseLock() {},
    };
  assert.equal(
    await connectionTest({
      apiKey: 'x',
      propertyId: '7',
      fetchImpl: async (_, init) => {
        init.signal.addEventListener('abort', () => {
          aborted = true;
        });
        return { ok: true, status: 200, body: { getReader: () => reader } };
      },
    }),
    'schema-drift',
  );
  assert.equal(cancelled, true);
  assert.equal(aborted, true);
  const ok = {
    ok: true,
    status: 200,
    text: async () => JSON.stringify([{ id: 'x' }]),
    headers: { get: () => '0' },
  };
  for (const failure of [
    new TypeError('network'),
    { ok: false, status: 429, headers: { get: () => '0' } },
    { ok: false, status: 503, headers: { get: () => '0' } },
  ]) {
    let calls = 0;
    assert.equal(
      (
        await getBookings({
          apiKey: 'x',
          propertyId: '7',
          fetchImpl: async () =>
            ++calls === 1
              ? failure instanceof Error
                ? Promise.reject(failure)
                : failure
              : ok,
        })
      ).length,
      1,
    );
    assert.equal(calls, 2);
  }
  for (const failure of [
    { ok: false, status: 404, text: async () => '' },
    { ok: true, status: 200, text: async () => '{' },
    { ok: true, status: 200, text: async () => JSON.stringify([{ id: '' }]) },
  ]) {
    let calls = 0;
    await assert.rejects(() =>
      getBookings({
        apiKey: 'x',
        propertyId: '7',
        fetchImpl: async () => {
          calls++;
          return failure;
        },
      }),
    );
    assert.equal(calls, 1);
  }
});
test('network exhaustion retries exactly twice and CLI failures redact all synthetic values', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      getBookings({
        apiKey: 'x',
        propertyId: '7',
        fetchImpl: async () => {
          calls++;
          throw new TypeError('network');
        },
      }),
    TypeError,
  );
  assert.equal(calls, 2);
  const server = http.createServer((req, res) => {
    res.statusCode = req.url === '/v1/properties' ? 401 : 500;
    res.end('UNIQUE_PAYLOAD_X');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port,
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lodgify-redact-')),
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'lodgify-redact-out-')),
    key = 'UNIQUE_KEY_X',
    rental = '987654321',
    guest = 'UNIQUE_GUEST_X',
    origin = `http://127.0.0.1:${port}`;
  try {
    for (const f of ['lodgify.command.mjs', 'lodgify-core.mjs'])
      fs.copyFileSync(
        path.join(path.dirname(new URL(import.meta.url).pathname), f),
        path.join(dir, f),
      );
    for (const directory of ['application', 'subcommands'])
      fs.cpSync(
        path.join(path.dirname(new URL(import.meta.url).pathname), directory),
        path.join(dir, directory),
        { recursive: true },
      );
    fs.writeFileSync(
      path.join(dir, 'lodgify.config'),
      `API_KEY=${key}\nRENTAL_ID=${rental}\nLODGIFY_API_BASE_URL=${origin}\n`,
      { mode: 0o600 },
    );
    const run = (args) =>
      execFileAsync(
        process.execPath,
        [path.join(dir, 'lodgify.command.mjs'), ...args],
        { env: { ...process.env, LODGIFY_TEST_ORIGIN: '1' } },
      );
    for (const args of [
      ['connection-test'],
      [
        'quarter-report',
        '--year',
        '2026',
        '--quarter',
        '3',
        '--output-dir',
        out,
      ],
    ]) {
      let error;
      try {
        await run(args);
      } catch (caught) {
        error = caught;
      }
      assert.ok(error);
      assert.notEqual(error.code, 0);
      const output = `${error.stdout}${error.stderr}`;
      assert.match(output, /authentication-failed|quarter-report failed/);
      for (const secret of [key, rental, guest, origin, 'UNIQUE_PAYLOAD_X'])
        assert.equal(output.includes(secret), false);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
  }
});
test('CLI orchestrates only against an injected local synthetic endpoint', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/v1/properties') {
      res.end(JSON.stringify({ items: [{ HouseId: '7' }] }));
      return;
    }
    if (req.url?.startsWith('/v2/reservations/bookings')) {
      res.end(
        JSON.stringify({
          items: [
            {
              id: 'x',
              houseId: '7',
              checkIn: '2026-07-01',
              checkOut: '2026-07-02',
              guest: { name: 'Synthetic' },
            },
          ],
        }),
      );
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port,
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lodgify-cli-')),
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'lodgify-cli-out-'));
  try {
    for (const f of ['lodgify.command.mjs', 'lodgify-core.mjs'])
      fs.copyFileSync(
        path.join(path.dirname(new URL(import.meta.url).pathname), f),
        path.join(dir, f),
      );
    for (const directory of ['application', 'subcommands'])
      fs.cpSync(
        path.join(path.dirname(new URL(import.meta.url).pathname), directory),
        path.join(dir, directory),
        { recursive: true },
      );
    fs.writeFileSync(
      path.join(dir, 'lodgify.config'),
      `API_KEY=synthetic\nRENTAL_ID=7\nLODGIFY_API_BASE_URL=http://127.0.0.1:${port}\n`,
      { mode: 0o600 },
    );
    const env = { ...process.env, LODGIFY_TEST_ORIGIN: '1' };
    const script = path.join(dir, 'lodgify.command.mjs');
    const connected = await execFileAsync(
      process.execPath,
      [script, 'connection-test'],
      { env },
    );
    assert.deepEqual(JSON.parse(connected.stdout), { status: 'connected' });
    const report = await execFileAsync(
      process.execPath,
      [
        script,
        'quarter-report',
        '--year',
        '2026',
        '--quarter',
        '3',
        '--output-dir',
        out,
      ],
      { env },
    );
    const summary = JSON.parse(report.stdout);
    assert.deepEqual(
      [
        summary.period,
        summary.fetched,
        summary.emitted,
        summary.review,
        summary.saved,
        summary.filename,
      ],
      ['Q3', 1, 1, 0, true, '2026-q3_lodgify_booking-report.csv'],
    );
    assert.equal(
      fs.statSync(path.join(out, summary.filename)).mode & 0o777,
      0o600,
    );
    await assert.rejects(
      () =>
        execFileAsync(
          process.execPath,
          [
            script,
            'quarter-report',
            '--year',
            '2026',
            '--quarter',
            '3',
            '--output-dir',
            out,
          ],
          { env },
        ),
      /quarter-report failed/,
    );
    await assert.rejects(
      () =>
        execFileAsync(
          process.execPath,
          [
            script,
            'quarter-report',
            '--year',
            '2025',
            '--quarter',
            '1',
            '--output-dir',
            out,
          ],
          { env },
        ),
      /completed quarter authorization required/,
    );
    await execFileAsync(
      process.execPath,
      [
        script,
        'quarter-report',
        '--dry-run',
        '--year',
        '2025',
        '--quarter',
        '1',
        '--authorize-completed',
      ],
      { env },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
  }
});
test('top-level dispatcher has strict help and output-dir gate', () => {
  const script = new URL('./lodgify.command.mjs', import.meta.url).pathname;
  assert.match(
    execFileSync(process.execPath, [script, '--help'], { encoding: 'utf8' }),
    /connection-test/,
  );
  assert.throws(
    () =>
      execFileSync(process.execPath, [script, 'quarter-report'], {
        stdio: 'pipe',
      }),
    /output-dir/,
  );
});
