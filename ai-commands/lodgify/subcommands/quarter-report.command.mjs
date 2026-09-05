import { DownloadQuarterReport } from '../application/download-quarter-report.mjs';
import { parseQuarter } from '../lodgify-core.mjs';

const VALUE_FLAGS = new Set(['--year', '--quarter', '--output-dir']);
const ALLOWED_FLAGS = new Set(['--dry-run', '--authorize-completed', ...VALUE_FLAGS]);

export async function runQuarterReport({ argumentsList, dependencies, write }) {
  const flags = parseFlags(argumentsList);
  if (!flags.get('--dry-run') && !flags.get('--output-dir')) {
    throw Error('output-dir required');
  }
  const now = new Date();
  const period = parseQuarter(
    flags.get('--year') || String(now.getUTCFullYear()),
    flags.get('--quarter') || String(Math.floor(now.getUTCMonth() / 3) + 1),
    now,
    flags.has('--authorize-completed'),
  );
  if (flags.get('--dry-run')) {
    write({
      period: {
        year: period.year,
        quarter: period.quarter,
        from: period.from,
        to: period.to,
      },
      counts: { 'dry-run': 1 },
    });
    return 0;
  }
  const settings = dependencies.configProvider.load();
  const adapters = dependencies.createAdapters(settings);
  const result = await new DownloadQuarterReport(adapters).execute({
    period,
    destination: flags.get('--output-dir'),
  });
  write(result);
  return 0;
}

function parseFlags(argumentsList) {
  const flags = new Map();
  for (let index = 0; index < argumentsList.length; index += 1) {
    const flag = argumentsList[index];
    if (!ALLOWED_FLAGS.has(flag) || flags.has(flag)) throw Error('usage');
    if (VALUE_FLAGS.has(flag)) {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith('--')) throw Error('usage');
      flags.set(flag, value);
      index += 1;
    } else {
      flags.set(flag, true);
    }
  }
  return flags;
}
