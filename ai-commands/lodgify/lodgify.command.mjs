#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCoreAdapters } from './application/core-adapters.mjs';
import { LocalConfigProvider } from './application/local-config-provider.mjs';
import { runConnectionTest } from './subcommands/connection-test.command.mjs';
import { runQuarterReport } from './subcommands/quarter-report.command.mjs';

const USAGE = 'usage: lodgify <connection-test|quarter-report> [options]';

export async function runCommand(
  argumentsList,
  dependencies = createDependencies(),
  write = writeJson,
) {
  const [subcommand, ...subcommandArguments] = argumentsList;
  if (['help', '--help', '-h'].includes(subcommand)) {
    write(USAGE);
    return 0;
  }
  if (subcommand === 'connection-test') {
    return runConnectionTest({ argumentsList: subcommandArguments, dependencies, write });
  }
  if (subcommand === 'quarter-report') {
    return runQuarterReport({ argumentsList: subcommandArguments, dependencies, write });
  }
  throw Error(USAGE);
}

function createDependencies() {
  const commandDirectory = path.dirname(fileURLToPath(import.meta.url));
  const allowTestOrigin = process.env.LODGIFY_TEST_ORIGIN === '1';
  return {
    configProvider: new LocalConfigProvider({
      commandDirectory,
      allowTestOrigin,
    }),
    createAdapters: (settings) => createCoreAdapters({ settings, allowTestOrigin }),
  };
}

function writeJson(value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  process.stdout.write(`${serialized}\n`);
}

if (process.argv[1]?.endsWith('/lodgify.command.mjs')) {
  try {
    process.exitCode = await runCommand(process.argv.slice(2));
  } catch (error) {
    const message = displayErrorMessage(error.message, process.argv[2]);
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
}

function displayErrorMessage(errorMessage, subcommand) {
  if (errorMessage === USAGE || errorMessage === 'usage') return USAGE;
  if (
    errorMessage === 'completed quarter authorization required' ||
    errorMessage === 'output-dir required'
  ) {
    return errorMessage;
  }
  return subcommand === 'quarter-report'
    ? 'quarter-report failed'
    : 'lodgify command failed';
}
