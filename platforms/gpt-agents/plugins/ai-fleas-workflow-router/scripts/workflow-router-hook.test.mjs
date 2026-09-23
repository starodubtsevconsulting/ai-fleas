import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./workflow-router-hook.mjs', import.meta.url));

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-fleas-router-hook-'));
  fs.writeFileSync(path.join(root, 'bindings.json'), JSON.stringify({
    schemaVersion: 2,
    sessions: {
      bound: {
        status: 'active',
        role: 'Reviewer',
        workflowSource: 'ai-workflows/example/example.workflow.md',
        capabilities: ['review'],
        scope: {
          profileId: 'example',
          workflowId: 'example',
          logicalProjectId: 'example-project',
          runtimeScopeId: 'scope-1',
        },
      },
      writer: {
        status: 'active', role: 'Writer', workflowSource: 'ai-workflows/example/example.workflow.md',
        capabilities: ['write'],
        scope: { profileId: 'example', workflowId: 'example', logicalProjectId: 'example-project', runtimeScopeId: 'scope-1' },
      },
      release: {
        status: 'active', role: 'Release Coordinator', workflowSource: 'ai-workflows/example/example.workflow.md',
        capabilities: ['release'],
        scope: { profileId: 'example', workflowId: 'example', logicalProjectId: 'example-project', runtimeScopeId: 'scope-1' },
      },
    },
    workflows: {
      'example:example:example-project:scope-1': {
        scope: { profileId: 'example', workflowId: 'example', logicalProjectId: 'example-project', runtimeScopeId: 'scope-1' },
        endpoints: { Writer: 'writer', Reviewer: 'bound', 'Release Coordinator': 'release' },
        stages: {
          drafting: { role: 'Writer', transitions: { review_ready: {
            to: 'review',
            requiredReferenceKinds: ['revision'],
          } } },
          review: { role: 'Reviewer', capability: 'review', transitions: {
            changes_required: { to: 'correction', requiredReferenceKinds: ['findings'] },
            accepted: {
              to: 'release',
              requiredReferenceKinds: ['review'],
              retryPolicy: { requireChangedProgress: true, progressReferenceKinds: ['review'] },
            },
            human_action_required: { to: 'human_review', waitForHuman: true, requiredReferenceKinds: ['human-action'] },
          } },
          human_review: { role: 'Reviewer', capability: 'human_review', transitions: {
            human_accepted: { to: 'release', requiredReferenceKinds: ['human-acceptance'] },
            human_rejected: { to: 'correction', requiredReferenceKinds: ['findings'] },
          } },
          correction: { role: 'Writer', transitions: { review_ready: {
            to: 'review',
            requiredReferenceKinds: ['revision'],
            retryPolicy: { requireChangedProgress: true, progressReferenceKinds: ['revision'] },
          } } },
          release: { role: 'Release Coordinator', transitions: {} },
        },
      },
    },
  }));
  return root;
}

function run(root, input) {
  const queueLog = path.join(root, 'queue.jsonl');
  const result = spawnSync(process.execPath, [hook], {
    env: { ...process.env, PLUGIN_DATA: root, WORKFLOW_ROUTER_QUEUE_LOG: queueLog },
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('ignores tasks without an active binding', () => {
  const root = fixture();
  assert.deepEqual(run(root, { session_id: 'other', hook_event_name: 'Stop' }), {});
});

test('loads workflow-neutral identity context for a bound task', () => {
  const root = fixture();
  const output = run(root, { session_id: 'bound', hook_event_name: 'SessionStart' });
  const context = output.hookSpecificOutput.additionalContext;
  assert.match(context, /role exactly "Reviewer"|exact Reviewer endpoint/);
  assert.match(context, /workflowId=example/);
  assert.match(context, /Do not contact another endpoint/);
  assert.match(context, /review \(capability: review\)/);
  assert.match(context, /Return a stage ID, never a capability name/);
  assert.match(context, /durable artifact/);
});

test('allocates and persists a correlation when ingress omits turn_id', () => {
  const root = fixture();
  const output = run(root, {
    session_id: 'bound',
    hook_event_name: 'UserPromptSubmit',
    prompt: 'review this',
  });
  const context = output.hookSpecificOutput.additionalContext;
  assert.match(context, /codex:bound:prompt-[a-f0-9]{20}/);
  const stored = JSON.parse(fs.readFileSync(path.join(root, 'correlations', 'bound.json'), 'utf8'));
  assert.match(stored.correlationId, /^codex:bound:prompt-[a-f0-9]{20}$/);
});

test('continues once when a bound endpoint omits its Router result', () => {
  const root = fixture();
  const output = run(root, {
    session_id: 'bound',
    turn_id: 'turn-1',
    hook_event_name: 'Stop',
    stop_hook_active: false,
    last_assistant_message: 'Review complete.',
  });
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /WORKFLOW_ROUTER_RESULT/);
});

test('accepts a valid terminal Router result', () => {
  const root = fixture();
  const output = run(root, {
    session_id: 'bound',
    turn_id: 'turn-1',
    hook_event_name: 'Stop',
    stop_hook_active: false,
    last_assistant_message: `Done.\n\nWORKFLOW_ROUTER_RESULT\n\`\`\`json\n${JSON.stringify({
      acknowledgement: 'COPY THAT',
      correlationId: 'codex:bound:turn-1',
      stage: 'review',
      role: 'Reviewer',
      event: 'changes_required',
      references: [{ kind: 'findings', ref: 'artifact://review-1' }],
    })}\n\`\`\``,
  });
  assert.deepEqual(output, {});
  const queued = JSON.parse(fs.readFileSync(path.join(root, 'queue.jsonl'), 'utf8'));
  assert.equal(queued.thread, 'writer');
  assert.match(queued.message, /"stage":"correction","role":"Writer"/);
});

test('dispatches accepted review to release coordinator, not writer', () => {
  const root = fixture();
  const output = run(root, {
    session_id: 'bound', turn_id: 'turn-2', hook_event_name: 'Stop', stop_hook_active: false,
    last_assistant_message: `WORKFLOW_ROUTER_RESULT ${JSON.stringify({
      acknowledgement: 'COPY THAT', correlationId: 'codex:bound:turn-2', stage: 'review',
      role: 'Reviewer', event: 'accepted', references: [{ kind: 'review', ref: 'artifact://review-2' }],
    })}`,
  });
  assert.deepEqual(output, {});
  const queued = JSON.parse(fs.readFileSync(path.join(root, 'queue.jsonl'), 'utf8'));
  assert.equal(queued.thread, 'release');
});

test('does not re-dispatch release when Reviewer returns the same review evidence', () => {
  const root = fixture();
  function acceptedReview(turnId, review) {
    return run(root, {
      session_id: 'bound', turn_id: turnId, hook_event_name: 'Stop', stop_hook_active: false,
      last_assistant_message: `WORKFLOW_ROUTER_RESULT ${JSON.stringify({
        acknowledgement: 'COPY THAT', correlationId: `codex:bound:${turnId}`, stage: 'review',
        role: 'Reviewer', event: 'accepted', references: [{ kind: 'review', ref: review }],
      })}`,
    });
  }

  assert.deepEqual(acceptedReview('accepted-1', 'review://same-evidence'), {});
  const stopped = acceptedReview('accepted-2', 'review://same-evidence');
  assert.match(stopped.systemMessage, /progress references are unchanged/);
  const lines = fs.readFileSync(path.join(root, 'queue.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).thread, 'release');

  assert.deepEqual(acceptedReview('accepted-3', 'review://new-evidence'), {});
  const updatedLines = fs.readFileSync(path.join(root, 'queue.jsonl'), 'utf8').trim().split('\n');
  assert.equal(updatedLines.length, 2);
});

test('dispatch is idempotent for the same result', () => {
  const root = fixture();
  const input = {
    session_id: 'bound', turn_id: 'turn-3', hook_event_name: 'Stop', stop_hook_active: false,
    last_assistant_message: `WORKFLOW_ROUTER_RESULT ${JSON.stringify({
      acknowledgement: 'COPY THAT', correlationId: 'codex:bound:turn-3', stage: 'review',
      role: 'Reviewer', event: 'changes_required', references: [{ kind: 'findings', ref: 'artifact://findings-3' }],
    })}`,
  };
  assert.deepEqual(run(root, input), {});
  assert.deepEqual(run(root, input), {});
  const lines = fs.readFileSync(path.join(root, 'queue.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
});

test('does not re-dispatch review when correction keeps the drafting revision unchanged', () => {
  const root = fixture();
  function writerResult(turnId, stage, revision) {
    return run(root, {
      session_id: 'writer', turn_id: turnId, hook_event_name: 'Stop', stop_hook_active: false,
      last_assistant_message: `WORKFLOW_ROUTER_RESULT ${JSON.stringify({
        acknowledgement: 'COPY THAT', correlationId: `codex:writer:${turnId}`, stage,
        role: 'Writer', event: 'review_ready', references: [{ kind: 'revision', ref: revision }],
      })}`,
    });
  }

  assert.deepEqual(writerResult('draft-1', 'drafting', 'article://same-revision'), {});
  const stopped = writerResult('correction-1', 'correction', 'article://same-revision');
  assert.match(stopped.systemMessage, /progress references are unchanged/);
  const lines = fs.readFileSync(path.join(root, 'queue.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  const receipts = fs.readdirSync(path.join(root, 'dispatches'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(root, 'dispatches', name), 'utf8')));
  assert.equal(receipts.filter(({ unchangedProgress }) => unchangedProgress).length, 1);

  assert.deepEqual(writerResult('correction-2', 'correction', 'article://new-revision'), {});
  const updatedLines = fs.readFileSync(path.join(root, 'queue.jsonl'), 'utf8').trim().split('\n');
  assert.equal(updatedLines.length, 2);
});

test('records a human wait without dispatching an endpoint', () => {
  const root = fixture();
  const output = run(root, {
    session_id: 'bound', turn_id: 'turn-human', hook_event_name: 'Stop', stop_hook_active: false,
    last_assistant_message: `WORKFLOW_ROUTER_RESULT ${JSON.stringify({
      acknowledgement: 'COPY THAT', correlationId: 'codex:bound:turn-human', stage: 'review',
      role: 'Reviewer', event: 'human_action_required',
      references: [{ kind: 'human-action', ref: 'human-action://listen-through' }],
    })}`,
  });
  assert.match(output.systemMessage, /paused at human_review/);
  assert.equal(fs.existsSync(path.join(root, 'queue.jsonl')), false);
  const receipts = fs.readdirSync(path.join(root, 'dispatches'));
  assert.equal(receipts.length, 1);
  const receipt = JSON.parse(fs.readFileSync(path.join(root, 'dispatches', receipts[0]), 'utf8'));
  assert.equal(receipt.waitingForHuman, true);
});

test('does not create an infinite Stop continuation loop', () => {
  const root = fixture();
  const output = run(root, {
    session_id: 'bound',
    turn_id: 'turn-1',
    hook_event_name: 'Stop',
    stop_hook_active: true,
    last_assistant_message: 'Still malformed.',
  });
  assert.equal(output.decision, undefined);
  assert.match(output.systemMessage, /remains invalid/);
});

test('continues once when an endpoint returns a capability name instead of a stage ID', () => {
  const root = fixture();
  const output = run(root, {
    session_id: 'bound', turn_id: 'turn-4', hook_event_name: 'Stop', stop_hook_active: false,
    last_assistant_message: `WORKFLOW_ROUTER_RESULT ${JSON.stringify({
      acknowledgement: 'COPY THAT', correlationId: 'codex:bound:turn-4', stage: 'review_capability',
      role: 'Reviewer', event: 'changes_required', references: [{ kind: 'findings', ref: 'artifact://findings-4' }],
    })}`,
  });
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /stage ID \(review/);
});
