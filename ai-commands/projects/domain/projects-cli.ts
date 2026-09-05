#!/usr/bin/env tsx
import { createProject, createProjectSpecTemplate, ProjectCoverMode, ProjectLyricsSource, ProjectThumbnailMode } from './project-creation';

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = { positional: [], flags: {} };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith('--')) {
      parsed.positional.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      parsed.flags[key] = true;
      continue;
    }
    parsed.flags[key] = next;
    index += 1;
  }
  return parsed;
}

function flag(flags: Record<string, string | boolean>, key: string): string {
  const value = flags[key];
  return typeof value === 'string' ? value : '';
}

function multimedia(flags: Record<string, string | boolean>) {
  return {
    lyricsSource: (flag(flags, 'lyrics-source') === 'ready-to-post' ? 'ready-to-post' : 'write') as ProjectLyricsSource,
    coverMode: (flag(flags, 'cover-mode') === 'static-picture' ? 'static-picture' : 'video') as ProjectCoverMode,
    thumbnailMode: (flag(flags, 'thumbnail-mode') === 'separate' ? 'separate' : 'same-as-cover') as ProjectThumbnailMode
  };
}

function main(): void {
  const [action = 'help', ...rest] = process.argv.slice(2);
  const parsed = parseArgs(rest);
  if (action === 'spec-template') {
    process.stdout.write(createProjectSpecTemplate({
      name: flag(parsed.flags, 'name'),
      contentType: flag(parsed.flags, 'content-type') || flag(parsed.flags, 'project-type'),
      releaseType: flag(parsed.flags, 'release-type'),
      multimedia: multimedia(parsed.flags)
    }));
    return;
  }
  if (action === 'create') {
    const result = createProject({
      registryPath: flag(parsed.flags, 'registry-path'),
      rootPath: flag(parsed.flags, 'root-path'),
      name: flag(parsed.flags, 'name'),
      specification: flag(parsed.flags, 'specification'),
      specFile: flag(parsed.flags, 'spec-file'),
      projectType: flag(parsed.flags, 'content-type') || flag(parsed.flags, 'project-type') || 'song',
      releaseType: flag(parsed.flags, 'release-type') || 'video',
      multimedia: multimedia(parsed.flags)
    });
    if (parsed.flags['output-json']) {
      process.stdout.write(JSON.stringify(result) + '\n');
    } else {
      process.stdout.write(`Created project ${result.id} at ${result.path}\n`);
    }
    return;
  }
  process.stderr.write('Usage: projects-cli.ts spec-template|create [options]\n');
  process.exitCode = 2;
}

try {
  main();
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
}
