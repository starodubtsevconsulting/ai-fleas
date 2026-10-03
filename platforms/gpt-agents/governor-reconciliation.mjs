/**
 * Purpose: verify host evidence for a pending Personal Governor initialization whose Stop hook did not activate it.
 * Caller: initialize-governor.mjs after its canonical human, role, and memory preflight.
 * Inputs: exact pending receipt, recorded prompt, host thread with turns, and registry predecessor.
 * Output: an activation decision or a bounded wait/retry/block reason.
 * Effects: none; the controller alone writes the verified decision to the lifecycle registry.
 */
import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');

function lastMessage(turn, type) {
  return turn.items?.filter(item => item.type === type).at(-1);
}

export function inspectGovernorPending({ registry, taskId, humanId, binding, prompt, thread, now = Date.now() }) {
  if (binding?.status !== 'pending' || binding.agentId !== 'personal-governor' ||
      binding.platformAdapter !== 'codex-app' || binding.scope?.kind !== 'governed-human' ||
      binding.scope?.humanProfileId !== humanId || !Number.isInteger(binding.generation) ||
      binding.generation < 1 || binding.initialization?.readinessToken !== 'PERSONAL_GOVERNOR_READY' ||
      typeof binding.initialization?.nonce !== 'string' || !binding.initialization.nonce.trim() ||
      binding.initialization.promptSha256 !== digest(prompt))
    return { status: 'blocked', reason: 'GOVERNOR_PENDING_BINDING_UNVERIFIED' };
  if (thread?.id !== taskId || thread.projectId != null ||
      !Array.isArray(thread.turns))
    return { status: 'blocked', reason: 'GOVERNOR_HOST_TASK_UNVERIFIED' };
  if (thread.status?.type === 'active' || thread.turns.some(turn => turn.status === 'inProgress'))
    return { status: 'wait', reason: 'GOVERNOR_HOST_TASK_RUNNING' };
  if (!['idle', 'notLoaded'].includes(thread.status?.type))
    return { status: 'blocked', reason: 'GOVERNOR_HOST_TASK_UNVERIFIED' };

  const replacement = binding.replaces;
  const competing = Object.entries(registry?.instances ?? {}).filter(([id, item]) =>
    id !== taskId && item?.agentId === 'personal-governor' &&
    item.scope?.humanProfileId === humanId && ['active', 'pending'].includes(item.status) &&
    id !== replacement?.taskId);
  if (competing.length)
    return { status: 'blocked', reason: 'GOVERNOR_COMPETING_BINDING' };
  if (replacement) {
    const predecessor = registry?.instances?.[replacement.taskId];
    if (replacement.strategy !== 'successor-first' || replacement.taskId === taskId ||
        !['active', 'archived'].includes(predecessor?.status) ||
        predecessor.agentId !== 'personal-governor' ||
        predecessor.platformAdapter !== 'codex-app' || predecessor.generation !== replacement.generation ||
        predecessor.scope?.kind !== 'governed-human' ||
        predecessor.scope?.humanProfileId !== humanId)
      return { status: 'blocked', reason: 'GOVERNOR_PREDECESSOR_UNVERIFIED' };
  } else if (Object.entries(registry?.instances ?? {}).some(([id, item]) =>
    id !== taskId && item?.agentId === 'personal-governor' &&
    item.scope?.humanProfileId === humanId && item.status === 'active')) {
    return { status: 'blocked', reason: 'GOVERNOR_PREDECESSOR_UNVERIFIED' };
  }

  const init = binding.initialization;
  const expiry = Date.parse(init.expiresAt ?? '');
  const registered = Date.parse(binding.registeredAt ?? '');
  const submitted = Date.parse(init.startedAt ?? '');
  if (!Number.isFinite(expiry) || !Number.isFinite(registered) || registered > expiry)
    return { status: 'blocked', reason: 'GOVERNOR_PERMIT_UNVERIFIED' };
  const turns = thread.turns.filter(turn => turn.id === init.turnId);
  if (init.turnId != null && turns.length !== 1)
    return { status: 'blocked', reason: 'GOVERNOR_INIT_TURN_UNVERIFIED' };
  const turn = turns[0];
  if (turn) {
    const started = Number(turn.startedAt) * 1000;
    const completed = Number(turn.completedAt) * 1000;
    if (!Number.isFinite(submitted) || submitted < registered || submitted > expiry ||
        !Number.isFinite(started) || started < registered - 1000 || started > expiry ||
        Math.abs(started - submitted) > 60_000)
      return { status: 'blocked', reason: 'GOVERNOR_INIT_TIMING_UNVERIFIED' };
    const user = turn.items?.find(item => item.type === 'userMessage');
    const userText = user?.content?.filter(part => part.type === 'text').map(part => part.text).join('');
    if (userText !== prompt || digest(userText) !== init.promptSha256)
      return { status: 'blocked', reason: 'GOVERNOR_INIT_PROMPT_UNVERIFIED' };
    const answer = lastMessage(turn, 'agentMessage');
    if (turn.status === 'completed' && answer?.phase === 'final_answer' &&
        answer.text?.trim() === 'PERSONAL_GOVERNOR_READY') {
      if (!Number.isFinite(completed) || completed < started)
        return { status: 'blocked', reason: 'GOVERNOR_COMPLETION_TIME_UNVERIFIED' };
      return { status: 'ready', completedTurnId: turn.id, completedAt: new Date(completed).toISOString() };
    }
    if (['interrupted', 'failed'].includes(turn.status))
      return { status: 'retry', reason: 'GOVERNOR_INIT_TURN_STOPPED' };
  }
  if (now < expiry) return { status: 'wait', reason: 'GOVERNOR_PERMIT_STILL_VALID' };
  return { status: 'retry', reason: 'GOVERNOR_PENDING_PERMIT_EXPIRED' };
}
