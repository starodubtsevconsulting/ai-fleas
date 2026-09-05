import { parseQuarter } from '../lodgify-core.mjs';

export async function runConnectionTest({ argumentsList, dependencies, write }) {
  const hasUnsupportedFlags =
    argumentsList.length > 1 ||
    (argumentsList.length === 1 && argumentsList[0] !== '--dry-run');
  if (hasUnsupportedFlags) throw Error('usage');
  if (argumentsList[0] === '--dry-run') {
    const now = new Date();
    const period = parseQuarter(
      String(now.getUTCFullYear()),
      String(Math.floor(now.getUTCMonth() / 3) + 1),
      now,
    );
    write({ period, counts: { 'dry-run': 1 } });
    return 0;
  }
  const settings = dependencies.configProvider.load();
  const adapters = dependencies.createAdapters(settings);
  const status = await adapters.bookingsPort.testConnection();
  write({ status });
  return status === 'connected' ? 0 : 1;
}
