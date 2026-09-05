export class DownloadQuarterReport {
  constructor({ bookingsPort, reportBuilder, publisher }) {
    this.bookingsPort = bookingsPort;
    this.reportBuilder = reportBuilder;
    this.publisher = publisher;
  }

  async execute({ period, destination }) {
    const bookings = await this.bookingsPort.fetchBookings();
    const report = this.reportBuilder.build(bookings, period);
    const publication = this.publisher.publish(report, destination);
    return {
      period: period.quarter,
      fetched: bookings.length,
      emitted: report.rows.length,
      review: report.review,
      saved: publication.saved,
      filename: publication.filename,
    };
  }
}

export const downloadQuarterReport = (dependencies, request) =>
  new DownloadQuarterReport(dependencies).execute(request);
