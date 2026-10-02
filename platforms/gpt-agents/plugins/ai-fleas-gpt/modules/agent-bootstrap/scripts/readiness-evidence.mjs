/**
 * Purpose: derive readiness evidence only from a matching pending initialization turn.
 * Caller: agent-bootstrap-hook.mjs on the exact registry-keyed task's Stop event.
 * Inputs: trusted pending binding and host event; output: completion fields or null.
 * Effects: none. This proves prompt/turn/token matching, not source-loading or project identity;
 * the lifecycle controller must independently verify the live task and its scope.
 */
export function initializationCompletion(binding, event, now = new Date()) {
  if (binding?.status !== 'pending' || event?.hook_event_name !== 'Stop' ||
      !binding.initialization?.startedAt || !binding.initialization.turnId ||
      binding.initialization.turnId !== event.turn_id ||
      typeof binding.initialization.readinessToken !== 'string' || !binding.initialization.readinessToken ||
      String(event.last_assistant_message ?? '').trim() !== binding.initialization.readinessToken) return null;
  return { completedTurnId: event.turn_id, completedAt: now.toISOString() };
}
