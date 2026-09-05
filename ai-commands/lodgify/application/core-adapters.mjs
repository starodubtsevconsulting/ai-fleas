import {
  connectionTest,
  csv,
  getBookings,
  normalize,
  publishReport,
} from '../lodgify-core.mjs';

export function createCoreAdapters({ settings, allowTestOrigin }) {
  const requestSettings = { ...settings, testOrigin: allowTestOrigin };

  return {
    bookingsPort: {
      testConnection: () => connectionTest(requestSettings),
      fetchBookings: () => getBookings(requestSettings),
    },
    reportBuilder: {
      build(bookings, period) {
        const rows = normalize(bookings, settings.propertyId, period);
        return {
          period,
          rows,
          review: rows.filter((row) => row.CrossQuarterReview).length,
          content: csv(rows),
        };
      },
    },
    publisher: {
      publish(report, destination) {
        return publishReport({
          outputDir: destination,
          period: report.period,
          content: report.content,
        });
      },
    },
  };
}
