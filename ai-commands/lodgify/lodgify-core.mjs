import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export const DEFAULT_BASE = 'https://api.lodgify.com';
export const MAX_BYTES = 1024 * 1024;
export const PAGE_SIZE = 50;
export const BOOKING_REPORT_HEADER = [
  'Id',
  'Type',
  'Source',
  'SourceText',
  'Name',
  'DateArrival',
  'DateDeparture',
  'Nights',
  'HouseName',
  'HouseInternalName',
  'InternalCode',
  'House_Id',
  'RoomTypes',
  'People',
  'Adults',
  'Children',
  'Infants',
  'Pets',
  'DateCreated',
  'TotalAmount',
  'Currency',
  'PromotionCode',
  'Status',
  'Email',
  'Phone',
  'CountryName',
  'IPCreated',
  'IPCountry',
  'QuoteId',
  'QuoteStatus',
  'RoomRatesTotal',
  'PromotionsTotal',
  'FeesTotal',
  'TaxesTotal',
  'AddOnsTotal',
  'AddOnsDetail',
  'AmountPaid',
  'BalanceDue',
  'ChangeRequestAdjustment',
  'PolicyName',
  'PaymentPolicy',
  'CancellationPolicy',
  'DamageDepositPolicy',
  'OwnerId',
  'OwnerFirstName',
  'OwnerLastName',
  'OwnerEmail',
  'OwnerPayout',
  'IncludedVatTotal',
  'Notes',
  'CrossQuarterReview',
];
const isStableId = (value) =>
  /^[A-Za-z0-9_-]{1,128}$/.test(String(value || ''));
const toIsoDate = (value) => value.toISOString().slice(0, 10);
const isIsoDate = (value) =>
  /^\d{4}-\d\d-\d\d$/.test(value || '') &&
  toIsoDate(new Date(`${value}T00:00:00Z`)) === value;
const quarterKey = (isoDate) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return `${date.getUTCFullYear()}-${Math.floor(date.getUTCMonth() / 3) + 1}`;
};
const firstDefined = (object, ...keys) =>
  keys.map((key) => object?.[key]).find((value) => value != null);

export function base(value = DEFAULT_BASE, allowTestOrigin = false) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !(
      url.origin === DEFAULT_BASE ||
      (allowTestOrigin &&
        ['http:', 'https:'].includes(url.protocol) &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    )
  )
    throw Error('invalid Lodgify API origin');
  return url.origin;
}
export function config(source, { testOrigin = false } = {}) {
  const values = {};
  const allowedKeys = new Set([
    'API_KEY',
    'RENTAL_ID',
    'USER_ID',
    'LODGIFY_API_BASE_URL',
  ]);
  for (const raw of String(source).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (
      !match ||
      !allowedKeys.has(match[1]) ||
      !match[2].trim() ||
      values[match[1]]
    )
      throw Error('invalid config');
    values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  if (!values.API_KEY || /TODO|YOUR_|PLACEHOLDER/i.test(values.API_KEY))
    throw Error('API_KEY required');
  if (!/^\d+$/.test(values.RENTAL_ID || '') || Number(values.RENTAL_ID) < 1)
    throw Error('positive decimal RENTAL_ID required');
  return {
    apiKey: values.API_KEY,
    propertyId: values.RENTAL_ID,
    userId: values.USER_ID || '',
    apiBase: base(values.LODGIFY_API_BASE_URL || DEFAULT_BASE, testOrigin),
  };
}
export function quarter(value, now = new Date()) {
  const requestedDateText = String(value).slice(0, 10);
  const requestedDate = new Date(`${requestedDateText}T00:00:00Z`);
  const currentDate = new Date(now);
  if (Number.isNaN(requestedDate) || !isIsoDate(requestedDateText))
    throw Error('invalid quarter date');
  const quarterNumber = Math.floor(requestedDate.getUTCMonth() / 3) + 1;
  const quarterStart = new Date(
    Date.UTC(requestedDate.getUTCFullYear(), (quarterNumber - 1) * 3, 1),
  );
  const quarterEnd = new Date(
    Date.UTC(requestedDate.getUTCFullYear(), quarterNumber * 3, 0),
  );
  const today = new Date(
    Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate(),
    ),
  );
  const effectiveEnd = new Date(Math.min(+quarterEnd, +today));
  if (quarterStart > effectiveEnd) throw Error('future quarter');
  return {
    year: requestedDate.getUTCFullYear(),
    quarter: `Q${quarterNumber}`,
    from: toIsoDate(quarterStart),
    to: toIsoDate(effectiveEnd),
    completed: today > quarterEnd,
  };
}
export function parseQuarter(year, quarterNumber, now, authorized = false) {
  if (!/^\d{4}$/.test(String(year)) || !/^[1-4]$/.test(String(quarterNumber)))
    throw Error('invalid quarter');
  const period = quarter(
    `${year}-${String((+quarterNumber - 1) * 3 + 1).padStart(2, '0')}-01`,
    now,
  );
  if (period.completed && !authorized)
    throw Error('completed quarter authorization required');
  return period;
}
const withDeadline = (promise, controller, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(Error('timeout'));
    }, timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
const remainingTime = (deadlineAt, controller) => {
  const milliseconds = deadlineAt - Date.now();
  if (milliseconds <= 0) {
    controller.abort();
    throw Error('timeout');
  }
  return milliseconds;
};
async function readResponseBody(response, controller, deadlineAt) {
  const contentLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
    controller.abort();
    throw Error('response too large');
  }
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let bytesRead = 0;
    try {
      for (;;) {
        const chunk = await withDeadline(
          reader.read(),
          controller,
          remainingTime(deadlineAt, controller),
        );
        if (chunk.done) break;
        bytesRead += chunk.value.byteLength;
        if (bytesRead > MAX_BYTES) {
          await reader.cancel();
          controller.abort();
          throw Error('response too large');
        }
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel?.().catch(() => {});
      reader.releaseLock?.();
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString();
  }
  const body = await withDeadline(
    response.text(),
    controller,
    remainingTime(deadlineAt, controller),
  );
  if (Buffer.byteLength(body) > MAX_BYTES) {
    controller.abort();
    throw Error('response too large');
  }
  return body;
}
async function requestJsonResponse({
  fetchImpl,
  url,
  apiKey,
  timeoutMs,
  requestBudget,
}) {
  const deadlineAt = Date.now() + timeoutMs;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    requestBudget.calls += 1;
    if (requestBudget.calls > requestBudget.max) throw Error('call budget');
    const controller = new AbortController();
    try {
      const response = await withDeadline(
        fetchImpl(url, {
          method: 'GET',
          headers: { 'X-ApiKey': apiKey, Accept: 'application/json' },
          signal: controller.signal,
        }),
        controller,
        remainingTime(deadlineAt, controller),
      );
      if (
        [429, 500, 502, 503, 504].includes(response.status) &&
        attempt === 0
      ) {
        await response.body?.cancel?.().catch(() => {});
        const retryDelayMs = Math.min(
          Math.max(0, Number(response.headers?.get?.('retry-after')) || 0) *
            1000,
          1000,
        );
        if (retryDelayMs)
          await withDeadline(
            new Promise((done) => setTimeout(done, retryDelayMs)),
            controller,
            remainingTime(deadlineAt, controller),
          );
        continue;
      }
      if (!response.ok)
        throw Error(
          response.status === 401 || response.status === 403
            ? 'authentication failed'
            : response.status === 429
              ? 'rate limited'
              : [400, 422].includes(response.status)
                ? 'bad request'
                : response.status === 404
                  ? 'endpoint not found'
                  : response.status >= 500
                    ? 'service unavailable'
                    : 'request failed',
        );
      return { response, controller, deadlineAt };
    } catch (caughtError) {
      const error = controller.signal.aborted ? Error('timeout') : caughtError;
      if (
        attempt === 0 &&
        (error.message === 'timeout' || error instanceof TypeError)
      )
        continue;
      throw error;
    }
  }
  throw Error('request failed');
}
export async function getBookings({
  apiKey,
  propertyId,
  apiBase = DEFAULT_BASE,
  testOrigin = false,
  fetchImpl = fetch,
  timeoutMs = 10000,
  maxPages = 10,
  maxRecords = 1000,
  maxCalls = 20,
}) {
  if (!apiKey || !/^\d+$/.test(String(propertyId)))
    throw Error('invalid credentials');
  const seenBookingIds = new Set();
  const bookings = [];
  const requestBudget = { calls: 0, max: maxCalls };
  const origin = base(apiBase, testOrigin);
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL('/v2/reservations/bookings', origin);
    for (const [name, value] of Object.entries({
      page,
      size: 50,
      stayFilter: 'All',
      includeCount: 'true',
      HouseId: propertyId,
    })) {
      url.searchParams.set(name, value);
    }
    const { response, controller, deadlineAt } = await requestJsonResponse({
      fetchImpl,
      url,
      apiKey,
      timeoutMs,
      requestBudget,
    });
    let body;
    try {
      body = JSON.parse(
        await readResponseBody(response, controller, deadlineAt),
      );
    } catch (error) {
      if (['response too large', 'timeout'].includes(error.message))
        throw error;
      throw Error('malformed JSON');
    }
    const pageBookings = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body?.data)
          ? body.data
          : null;
    if (!pageBookings || pageBookings.length > PAGE_SIZE)
      throw Error('schema drift');
    const bookingIds = pageBookings.map((booking) =>
      String(booking?.id ?? booking?.Id ?? ''),
    );
    if (bookingIds.some((id) => !isStableId(id))) throw Error('schema drift');
    if (
      new Set(bookingIds).size !== bookingIds.length ||
      bookingIds.some((id) => seenBookingIds.has(id))
    )
      throw Error('pagination loop');
    bookingIds.forEach((id) => seenBookingIds.add(id));
    bookings.push(...pageBookings);
    if (bookings.length > maxRecords) throw Error('record limit');
    if (pageBookings.length < PAGE_SIZE) return bookings;
  }
  throw Error('page limit');
}
export async function connectionTest(options) {
  try {
    const timeoutMs = options.timeoutMs || 10000;
    const { response, controller, deadlineAt } = await requestJsonResponse({
      fetchImpl: options.fetchImpl || fetch,
      url: new URL(
        '/v1/properties',
        base(options.apiBase || DEFAULT_BASE, options.testOrigin),
      ),
      apiKey: options.apiKey,
      timeoutMs,
      requestBudget: { calls: 0, max: 2 },
    });
    let body;
    try {
      body = JSON.parse(
        await readResponseBody(response, controller, deadlineAt),
      );
    } catch (error) {
      if (error.message === 'timeout') return 'timeout';
      return 'schema-drift';
    }
    const properties = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body?.data)
          ? body.data
          : null;
    if (!properties) return 'schema-drift';
    return properties.some(
      (property) =>
        String(
          property?.id ??
            property?.Id ??
            property?.houseId ??
            property?.HouseId ??
            property?.property_id,
        ) === String(options.propertyId),
    )
      ? 'connected'
      : 'property-not-accessible';
  } catch (error) {
    return (
      {
        'authentication failed': 'authentication-failed',
        'rate limited': 'rate-limited',
        'bad request': 'bad-request',
        'endpoint not found': 'endpoint-not-found',
        'service unavailable': 'service-unavailable',
        timeout: 'timeout',
        'response too large': 'schema-drift',
      }[error.message] ||
      (error instanceof TypeError ? 'network-failed' : 'request-failed')
    );
  }
}
export function normalize(bookings, propertyId, period) {
  if (!Array.isArray(bookings) || bookings.length > 1000)
    throw Error('schema drift');
  return bookings.flatMap((booking) => {
    const arrival = firstDefined(
      booking,
      'arrival',
      'DateArrival',
      'date_arrival',
      'checkIn',
    );
    const departure = firstDefined(
      booking,
      'departure',
      'DateDeparture',
      'date_departure',
      'checkOut',
    );
    const bookingPropertyId = firstDefined(
      booking,
      'property_id',
      'house_id',
      'House_Id',
      'houseId',
      'propertyId',
    );
    const bookingId = firstDefined(booking, 'id', 'Id');
    if (
      !isStableId(bookingId) ||
      String(bookingPropertyId) !== String(propertyId) ||
      !isIsoDate(arrival) ||
      !isIsoDate(departure) ||
      departure <= arrival
    )
      throw Error('property/period/schema mismatch');
    if (arrival < period.from || arrival > period.to) return [];

    const room = booking.rooms?.[0] || {};
    const guest = booking.guest || {};
    const subtotals = booking.subtotals || {};
    const nights = Math.round(
      (Date.parse(`${departure}T00:00:00Z`) -
        Date.parse(`${arrival}T00:00:00Z`)) /
        864e5,
    );
    const finalNight = toIsoDate(
      new Date(Date.parse(`${departure}T00:00:00Z`) - 864e5),
    );
    const crossesQuarter = quarterKey(arrival) !== quarterKey(finalNight);
    const sourceCode = firstDefined(booking, 'source', 'Source', 'channel');
    const sourceName =
      {
        AirbnbIntegration: 'Airbnb',
        BookingCom: 'Booking.com',
        HomeAway: 'Vrbo',
        OH: 'Website',
        Manual: 'Manual',
      }[sourceCode] ||
      sourceCode ||
      '';
    return [
      {
        Id: bookingId,
        Source: sourceName,
        SourceText: firstDefined(booking, 'source_text', 'SourceText') || '',
        Name: firstDefined(booking, 'name', 'Name') || guest.name || '',
        DateArrival: arrival,
        DateDeparture: departure,
        Nights: nights,
        House_Id: String(propertyId),
        RoomTypes: firstDefined(booking, 'room_types', 'RoomTypes') || '',
        People: firstDefined(booking, 'people', 'People') ?? room.people ?? '',
        Adults:
          firstDefined(booking, 'adults', 'Adults') ??
          room.guest_breakdown?.adults ??
          '',
        Children:
          firstDefined(booking, 'children', 'Children') ??
          room.guest_breakdown?.children ??
          '',
        Infants:
          firstDefined(booking, 'infants', 'Infants') ??
          room.guest_breakdown?.infants ??
          '',
        Pets:
          firstDefined(booking, 'pets', 'Pets') ??
          room.guest_breakdown?.pets ??
          '',
        DateCreated:
          firstDefined(
            booking,
            'date_created',
            'booked_at',
            'created_at',
            'DateCreated',
          ) || '',
        TotalAmount: normalizeNumber(
          firstDefined(booking, 'total_amount', 'TotalAmount'),
        ),
        Currency: firstDefined(booking, 'currency_code', 'Currency') || '',
        Status: firstDefined(booking, 'status', 'Status') || '',
        Email: guest.email || firstDefined(booking, 'email', 'Email') || '',
        Phone: guest.phone || firstDefined(booking, 'phone', 'Phone') || '',
        CountryName:
          guest.country_name ||
          firstDefined(booking, 'country_name', 'CountryName') ||
          '',
        RoomRatesTotal: normalizeNumber(
          firstDefined(booking, 'stay_total', 'RoomRatesTotal') ??
            subtotals.stay,
        ),
        PromotionsTotal: normalizeNumber(
          firstDefined(booking, 'promotions_total', 'PromotionsTotal') ??
            subtotals.promotions,
        ),
        FeesTotal: normalizeNumber(
          firstDefined(booking, 'fees_total', 'FeesTotal') ?? subtotals.fees,
        ),
        TaxesTotal: normalizeNumber(
          firstDefined(booking, 'tax_total', 'TaxesTotal') ?? subtotals.taxes,
        ),
        AddOnsTotal: normalizeNumber(
          firstDefined(booking, 'add_ons_total', 'AddOnsTotal') ??
            subtotals.addons,
        ),
        crossQuarter: crossesQuarter,
        CrossQuarterReview: crossesQuarter ? 'review' : '',
      },
    ];
  });
}
export function csv(rows) {
  return `${BOOKING_REPORT_HEADER.join(',')}\r\n${[...rows]
    .sort((left, right) => String(left.Id).localeCompare(String(right.Id)))
    .map((row) =>
      BOOKING_REPORT_HEADER.map((column) => csvCell(row[column] ?? '')).join(
        ',',
      ),
    )
    .join('\r\n')}\r\n`;
}
export function publishReport({ outputDir, period, content }) {
  if (!path.isAbsolute(String(outputDir || '')))
    throw Error('approved output directory required');
  let outputDirectoryStat;
  try {
    outputDirectoryStat = fs.statSync(outputDir);
  } catch {
    throw Error('approved output directory required');
  }
  if (!outputDirectoryStat.isDirectory())
    throw Error('approved output directory required');
  const filename = `${period.year}-${period.quarter.toLowerCase()}_lodgify_booking-report.csv`;
  const outputPath = path.join(outputDir, filename);
  const temporaryPath = path.join(
    outputDir,
    `.lodgify-${process.pid}-${Date.now()}.tmp`,
  );
  if (fs.existsSync(outputPath)) throw Error('collision');
  try {
    fs.writeFileSync(temporaryPath, content, { mode: 0o600, flag: 'wx' });
    const fileDescriptor = fs.openSync(temporaryPath, 'r');
    fs.fsyncSync(fileDescriptor);
    fs.closeSync(fileDescriptor);
    fs.linkSync(temporaryPath, outputPath);
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
    return { saved: true, filename };
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
    throw error;
  }
}
export function temporaryCsv(content) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lodgify-export-'));
  const file = path.join(directory, 'report.csv');
  fs.writeFileSync(file, content, { mode: 0o600, flag: 'wx' });
  return { dir: directory, file };
}
export function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
function normalizeNumber(value) {
  return value == null ? '' : Number.isFinite(+value) ? String(+value) : '';
}
function csvCell(value) {
  let text = String(value ?? '');
  if (text.length > 2048) throw Error('schema drift');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
