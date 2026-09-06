#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { requireCommandProfile } from '../_runtime/profile/command-profile.guard.mjs';

const commandDir = path.dirname(fileURLToPath(import.meta.url));
requireCommandProfile('kdenlive', fileURLToPath(import.meta.url));
const templatePath = path.join(commandDir, 'assets', 'empty-project.kdenlive');

function usage() {
  console.error('Usage: kdenlive.command.sh <scaffold|validate> --project-path <absolute path> [--force]');
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function scaffold(projectPath) {
  const target = path.join(projectPath, 'project.kdenlive');
  if (fs.existsSync(target) && !process.argv.includes('--force')) {
    throw new Error(`Refusing to overwrite existing project: ${target}`);
  }
  const template = fs.readFileSync(templatePath, 'utf8');
  const clips = [
    '<chain id="scaffold-audio" out="00:00:01.001">',
    '<property name="length">24</property><property name="eof">pause</property>',
    '<property name="resource">audio/narration-v1.wav</property><property name="mlt_service">avformat</property>',
    '<property name="audio_index">0</property><property name="video_index">-1</property>',
    '<property name="kdenlive:folderid">-1</property><property name="kdenlive:id">1001</property><property name="kdenlive:clip_type">1</property>',
    '</chain>',
    ...[1, 2, 3].flatMap((number) => {
      const id = String(number).padStart(3, '0');
      return [
        `<producer id="scaffold-scene-${id}" in="00:00:00.000" out="00:00:05.000">`,
        '<property name="length">120</property><property name="eof">pause</property><property name="ttl">25</property>',
        `<property name="resource">scene/${id}.png</property><property name="mlt_service">qimage</property>`,
        '<property name="aspect_ratio">1</property><property name="kdenlive:duration">00:00:05;00</property>',
        `<property name="kdenlive:folderid">-1</property><property name="kdenlive:id">100${number + 1}</property><property name="kdenlive:clip_type">2</property>`,
        '</producer>',
      ];
    }),
  ].join('');
  const entries = [
    '<entry in="00:00:00.000" out="00:00:01.001" producer="scaffold-audio"/>',
    ...[1, 2, 3].map((number) => `<entry in="00:00:00.000" out="00:00:05.000" producer="scaffold-scene-${String(number).padStart(3, '0')}"/>`),
  ].join('');
  const xml = template
    .replace(/\sroot="[^"]*"/, ` root="${escapeXml(projectPath)}"`)
    .replace('<playlist id="main_bin">', `${clips}<playlist id="main_bin">`)
    .replace(/(<playlist id="main_bin">[\s\S]*?)<\/playlist>/, `$1${entries}</playlist>`);
  fs.writeFileSync(target, xml, 'utf8');
  return target;
}

function validate(projectPath) {
  const projectName = fs.readdirSync(projectPath, { withFileTypes: true })
    .find((entry) => entry.isFile() && /\.kdenlive$/i.test(entry.name))?.name;
  const projectFile = projectName ? path.join(projectPath, projectName) : path.join(projectPath, 'project.kdenlive');
  if (!fs.existsSync(projectFile)) throw new Error(`Kdenlive project is missing: ${projectFile}`);
  const xml = fs.readFileSync(projectFile, 'utf8');
  const issues = [];
  const resources = [...xml.matchAll(/<property\s+name=["']resource["'][^>]*>([\s\S]*?)<\/property>/gi)]
    .map((match) => ({
      value: decodeXml(match[1]).trim().replace(/^\d+(?:\.\d+)?:/, ''),
      context: xml.slice(Math.max(0, match.index - 1200), Math.min(xml.length, match.index + match[0].length + 1200)),
    }))
    .filter((resource) => resource.value && !isGeneratedResource(resource.value));
  const audio = resources.filter((resource) => /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(resource.value) || /stream\.type">audio</i.test(resource.context) || /<property\s+name=["']audio_index["'][^>]*>(?!-1)/i.test(resource.context));
  const visual = resources.filter((resource) => /\.(png|jpg|jpeg|webp|gif|mp4|mov|mkv|webm)$/i.test(resource.value) || /stream\.type">video</i.test(resource.context) || /<property\s+name=["']video_index["'][^>]*>(?!-1)/i.test(resource.context));
  if (!audio.length) issues.push({ message: 'Kdenlive project has no audio media resource', paths: [] });
  if (!visual.length) issues.push({ message: 'Kdenlive project has no image or video media resource', paths: [] });
  const outside = new Set();
  const missing = new Set();
  for (const resource of resources) {
    if (/^[a-z]+:/i.test(resource.value)) continue;
    const resolved = path.resolve(projectPath, resource.value);
    const relative = path.relative(projectPath, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) outside.add(resolved);
    else if (!fs.existsSync(resolved)) missing.add(resolved);
  }
  if (outside.size) issues.push({ message: `Kdenlive media resource points outside the video folder (${outside.size})`, paths: [...outside].sort() });
  if (missing.size) issues.push({ message: `Kdenlive media resource is missing on disk (${missing.size})`, paths: [...missing].sort() });
  return { ready: issues.length === 0, path: projectFile, issues };
}

function isGeneratedResource(resource) {
  return ['black', 'white', 'transparent'].includes(resource.toLowerCase()) || /^#/.test(resource);
}

function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

const action = process.argv[2];
const projectPath = argument('--project-path');
try {
  if (!['scaffold', 'validate'].includes(action) || !projectPath || !path.isAbsolute(projectPath)) {
    usage();
    process.exitCode = 2;
  } else if (action === 'scaffold') {
    console.log(JSON.stringify({ created: scaffold(projectPath) }));
  } else {
    console.log(JSON.stringify(validate(projectPath)));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
