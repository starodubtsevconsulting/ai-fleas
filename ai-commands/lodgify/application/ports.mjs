export class LodgifyBookingsPort {
  async testConnection() {
    throw Error('LodgifyBookingsPort.testConnection must be implemented');
  }

  async fetchBookings() {
    throw Error('LodgifyBookingsPort.fetchBookings must be implemented');
  }
}

export class BookingReportBuilderPort {
  build() {
    throw Error('BookingReportBuilderPort.build must be implemented');
  }
}

export class QuarterReportPublisherPort {
  publish() {
    throw Error('QuarterReportPublisherPort.publish must be implemented');
  }
}

export class ConfigProviderPort {
  load() {
    throw Error('ConfigProviderPort.load must be implemented');
  }
}
