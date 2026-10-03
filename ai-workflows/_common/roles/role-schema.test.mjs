/**
 * Purpose: prevent the reusable role schema from rejecting the Personal Governor's
 * governed-human scope and binding owner.
 * Invocation: node --test ai-workflows/_common/roles/role-schema.test.mjs
 * Passing result: verifies this portable role-schema contract only; it does not
 * initialize a Governor or verify any platform lifecycle behavior.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const rolesDirectory = path.dirname(fileURLToPath(import.meta.url));
const readRole = (name) => parse(fs.readFileSync(path.join(rolesDirectory, name), 'utf8'));

test('Personal Governor scope values are admitted by the base role schema', () => {
  const schema = readRole('_role.yml');
  const governor = readRole('personal-governor.yml');
  const scope = schema.fieldModel.scope;

  assert.deepEqual(scope.kind.values, [
    'workflow', 'cross-workflow', 'profile', 'platform', 'system', 'governed-human',
  ]);
  assert.deepEqual(scope.bindingOwner.values, [
    'workflow', 'profile', 'platform', 'profile-platform', 'binding', 'governed-human',
  ]);
  assert.ok(scope.kind.values.includes(governor.scope.kind));
  assert.ok(scope.bindingOwner.values.includes(governor.scope.bindingOwner));
  assert.equal(schema.inheritance.unknownFields, 'prohibited-unless-schema-allows');
});
