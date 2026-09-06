#!/usr/bin/env node

import { createCoreAdapters } from './application/core-adapters.mjs';
import { LocalConfigProvider } from './application/local-config-provider.mjs';
import { runConnectionTest } from './subcommands/connection-test.command.mjs';
import { runQuarterReport } from './subcommands/quarter-report.command.mjs';
import { fileURLToPath } from 'node:url';
import { requireCommandProfile } from '../_runtime/profile/command-profile.guard.mjs';

const USAGE = 'usage: lodgify <connection-test|quarter-report> [options]';

export async function runCommand(
  argumentsList,
  dependencies,
  write = writeJson,
) {
  const [subcommand, ...subcommandArguments] = argumentsList;
  if (['help', '--help', '-h'].includes(subcommand)) {
    write(USAGE);
    return 0;
  }
  if (subcommand === 'connection-test') {
    const resolvedDependencies = dependencies || createDependencies();
    return runConnectionTest({ argumentsList: subcommandArguments, dependencies: resolvedDependencies, write });
  }
  if (subcommand === 'quarter-report') {
    if (!subcommandArguments.includes('--dry-run') && !subcommandArguments.includes('--output-dir')) {
      throw Error('output-dir required');
    }
    const resolvedDependencies = dependencies || createDependencies();
    return runQuarterReport({ argumentsList: subcommandArguments, dependencies: resolvedDependencies, write });
  }
  throw Error(USAGE);
}

function createDependencies() {
  const allowTestOrigin = process.env.LODGIFY_TEST_ORIGIN === '1';
  const configPath = process.env.LODGIFY_CONFIG_PATH || process.env.AI_COMMAND_CONFIG_PATH;
  if (!configPath) throw Error('profile-owned Lodgify config required');
  return {
    configProvider: new LocalConfigProvider({
      configPath,
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
    requireCommandProfile('lodgify', fileURLToPath(import.meta.url));
    process.exitCode = await runCommand(process.argv.slice(2));
  } catch (error) {
    const message = displayErrorMessage(error.message, process.argv[2]);
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
}

function displayErrorMessage(errorMessage, subcommand) {
  if (errorMessage.startsWith('PROFILE_REQUIRED:') || errorMessage.startsWith('PROFILE_BLOCKED:')) return errorMessage;
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
