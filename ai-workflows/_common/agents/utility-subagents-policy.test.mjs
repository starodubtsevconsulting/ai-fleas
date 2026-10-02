import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

const read = relative => readFile(resolve(root, relative), 'utf8');

const [common, selfCommands, admin, rootRules, writingTeam, governorPlatform, profileValidation] = await Promise.all([
  read('ai-workflows/_common/agents/utility-subagents.md'),
  read('ai-workflows/_common/agents/self-commands.md'),
  read('ai-workflows/_common/roles/admin.md'),
  read('AGENTS.md'),
  read('ai-workflows/writing/agents/team.md'),
  read('platforms/gpt-agents/agents/personal-governor-initialization.md'),
  read('ai-profile/validate-example.sh'),
]);

assert.match(common, /MUST dispatch and verify one bounded subagent for\n+each `INIT` audit and each substantive role-owned work item/);
assert.match(common, /unavailable or cannot safely support the required effect/);
assert.match(selfCommands, /read-only INIT audit subagent/);
assert.match(selfCommands, /BLOCKED_INIT_SUBAGENT/);
assert.match(admin, /Every Admin workflow run uses emulated execution/);
assert.match(admin, /MUST use a distinct role-scoped subagent/);
assert.match(rootRules, /Every Admin workflow run uses \*\*emulated mode\*\*/);
assert.match(rootRules, /Every agent with verified scope MUST dispatch and verify a bounded subagent/);
assert.match(writingTeam, /Admin uses emulated mode and explicitly names the selected roles/);
assert.doesNotMatch(writingTeam, /If dispatch is not useful or available/);
assert.match(governorPlatform, /common utility-subagent obligation applies to every Governor `INIT` audit and substantive work item/);
assert.match(governorPlatform, /MUST dispatch a native GPT utility subagent/);
assert.doesNotMatch(governorPlatform, /On another platform, leave this policy inactive/);
assert.match(profileValidation, /utility-subagents-policy\.test\.mjs/);

console.log('utility-subagent policy checks passed');
