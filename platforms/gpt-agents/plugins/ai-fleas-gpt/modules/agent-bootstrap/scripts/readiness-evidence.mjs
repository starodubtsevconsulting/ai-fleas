/**
 * Purpose: derive readiness evidence only from a matching pending initialization turn.
 * Caller: agent-bootstrap-hook.mjs on the exact registry-keyed task's prompt/Stop events.
 * Inputs: trusted pending binding and host event; output: completion fields or null.
 * Effects: none. This proves prompt/turn/token matching, not source-loading or project identity;
 * the lifecycle controller must independently verify the live task and its scope.
 */
import { createHash } from 'node:crypto';

/** One pending nonce permit may bind only one initialization turn. */
export function initializationPromptMatches(binding, event) {
  const permit = binding?.initialization;
  if (binding?.status !== 'pending' || event?.hook_event_name !== 'UserPromptSubmit' ||
      typeof event.turn_id !== 'string' || !event.turn_id ||
      typeof permit?.nonce !== 'string' || !permit.nonce.trim() ||
      typeof permit.promptSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(permit.promptSha256) ||
      (permit.turnId != null && permit.turnId !== event.turn_id)) return false;
  return createHash('sha256').update(String(event.prompt ?? '')).digest('hex') === permit.promptSha256;
}

export function initializationCompletion(binding, event, now = new Date()) {
  const nonce = binding?.initialization?.nonce || binding?.initialization?.delivery?.nonce;
  if (binding?.status !== 'pending' || event?.hook_event_name !== 'Stop' ||
      typeof nonce !== 'string' || !nonce.trim() ||
      !binding.initialization?.startedAt || !binding.initialization.turnId ||
      binding.initialization.turnId !== event.turn_id ||
      typeof binding.initialization.readinessToken !== 'string' || !binding.initialization.readinessToken ||
      String(event.last_assistant_message ?? '').trim() !== binding.initialization.readinessToken) return null;
  return { completedTurnId: event.turn_id, completedAt: now.toISOString() };
}
