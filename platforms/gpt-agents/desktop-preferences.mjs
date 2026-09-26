import fs from 'node:fs';
import path from 'node:path';

const sectionPattern = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/;
const keyPattern = /^(\s*followUpQueueMode\s*=\s*)(?:"[^"]*"|'[^']*'|[^#\r\n]*)(\s*(?:#.*)?)$/;

export function withQueuedFollowUps(config) {
  const newline = config.includes('\r\n') ? '\r\n' : '\n';
  const lines = config.split(/\r?\n/);
  let desktopSections = 0;
  let inDesktop = false;
  let keyIndex = -1;
  let sectionEnd = lines.length;

  for (let index = 0; index < lines.length; index += 1) {
    const section = lines[index].match(sectionPattern);
    if (section) {
      if (inDesktop) sectionEnd = index;
      inDesktop = section[1] === 'desktop';
      if (inDesktop) desktopSections += 1;
      continue;
    }
    if (inDesktop && /^\s*followUpQueueMode\s*=/.test(lines[index])) {
      if (keyIndex !== -1) throw new Error('duplicate desktop.followUpQueueMode setting');
      keyIndex = index;
    }
  }
  if (desktopSections > 1) throw new Error('duplicate [desktop] sections');
  if (keyIndex !== -1) {
    const match = lines[keyIndex].match(keyPattern);
    if (!match) throw new Error('invalid desktop.followUpQueueMode setting');
    lines[keyIndex] = `${match[1]}"queue"${match[2]}`;
  } else if (desktopSections === 1) {
    lines.splice(sectionEnd, 0, 'followUpQueueMode = "queue"');
  } else {
    while (lines.length && !lines.at(-1)) lines.pop();
    if (lines.length) lines.push('');
    lines.push('[desktop]', 'followUpQueueMode = "queue"', '');
  }
  return lines.join(newline);
}

export function ensureQueuedFollowUps(configFile) {
  const existed = fs.existsSync(configFile);
  const previous = existed ? fs.readFileSync(configFile, 'utf8') : '';
  const next = withQueuedFollowUps(previous);
  if (next === previous) return { changed: false, mode: 'queue' };
  fs.mkdirSync(path.dirname(configFile), { recursive: true, mode: 0o700 });
  const temporary = `${configFile}.${process.pid}.tmp`;
  const mode = existed ? fs.statSync(configFile).mode & 0o777 : 0o600;
  try {
    fs.writeFileSync(temporary, next, { mode });
    const current = fs.existsSync(configFile) ? fs.readFileSync(configFile, 'utf8') : '';
    if (current !== previous) throw new Error('Codex config changed while updating follow-up behavior; retry');
    fs.renameSync(temporary, configFile);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return { changed: true, mode: 'queue' };
}
